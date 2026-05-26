'use strict';

const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 900;
const PLAYER_SPEED = 280;
const PLAYER_RADIUS = 13;
const ENEMY_RADIUS = 18;
const PROJECTILE_RADIUS = 5;
const PROJECTILE_SPEED = 720;
const PROJECTILE_TTL_MS = 900;
const PLAYER_FIRE_COOLDOWN_MS = 150;
const FIXED_DT_MS = 1000 / 60;
const DEFAULT_ENEMY_COUNT = 5;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(x, y) {
  const len = Math.hypot(x, y);
  if (!Number.isFinite(len) || len <= 0.0001) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

function makeRng(seed) {
  let s = (Number(seed) >>> 0) || 0x9e3779b9;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function createArenaState(options = {}) {
  const seed = Number(options.seed) || 1337;
  const rng = makeRng(seed);
  const state = {
    version: 1,
    authority: 'server',
    tick: 0,
    timeMs: 0,
    seed,
    nextProjectileId: 1,
    players: {},
    enemies: {},
    projectiles: {},
    metrics: {
      acceptedInputs: 0,
      staleInputs: 0,
      shotsFired: 0,
      enemyHits: 0
    }
  };

  const enemyCount = Number.isFinite(options.enemyCount) ? Math.max(0, Math.floor(options.enemyCount)) : DEFAULT_ENEMY_COUNT;
  for (let i = 0; i < enemyCount; i += 1) {
    const id = `e${i + 1}`;
    state.enemies[id] = {
      id,
      x: Math.round(240 + rng() * (ARENA_WIDTH - 480)),
      y: Math.round(180 + rng() * (ARENA_HEIGHT - 360)),
      hp: 40,
      radius: ENEMY_RADIUS
    };
  }
  return state;
}

function spawnForSlot(slot) {
  const index = Math.max(0, Number(String(slot || '').replace(/\D/g, '')) - 1);
  const offsets = [
    { x: -48, y: -36 },
    { x: 48, y: -36 },
    { x: -48, y: 36 },
    { x: 48, y: 36 }
  ];
  const offset = offsets[index % offsets.length];
  return { x: ARENA_WIDTH / 2 + offset.x, y: ARENA_HEIGHT / 2 + offset.y };
}

function addPlayer(state, playerId, options = {}) {
  if (!state || !playerId) return null;
  const existing = state.players[playerId];
  if (existing) {
    existing.online = true;
    existing.sessionId = options.sessionId || existing.sessionId || '';
    existing.input = existing.input || neutralInput();
    return existing;
  }
  const spawn = spawnForSlot(playerId);
  const player = {
    id: playerId,
    sessionId: options.sessionId || '',
    x: Number(options.x) || spawn.x,
    y: Number(options.y) || spawn.y,
    vx: 0,
    vy: 0,
    hp: 100,
    radius: PLAYER_RADIUS,
    online: true,
    lastInputSeq: 0,
    lastShotMs: -9999,
    input: neutralInput()
  };
  state.players[playerId] = player;
  return player;
}

function markPlayerOffline(state, playerId) {
  const player = state?.players?.[playerId];
  if (!player) return;
  player.online = false;
  player.input = neutralInput();
}

function removePlayer(state, playerId) {
  if (state?.players) delete state.players[playerId];
}

function neutralInput() {
  return { seq: 0, left: false, right: false, up: false, down: false, shoot: false, aimX: 1, aimY: 0 };
}

function sanitizeInput(raw = {}) {
  const aim = normalize(Number(raw.aimX) || 0, Number(raw.aimY) || 0);
  const seq = Math.max(0, Math.floor(Number(raw.seq ?? raw.inputSeq ?? 0)));
  return {
    seq,
    left: !!raw.left,
    right: !!raw.right,
    up: !!raw.up,
    down: !!raw.down,
    shoot: !!raw.shoot,
    dash: !!raw.dash,
    interact: !!raw.interact,
    aimX: aim.x || 1,
    aimY: aim.y || 0
  };
}

function applyInput(state, playerId, rawInput = {}) {
  const player = state?.players?.[playerId];
  if (!player || !player.online) return { accepted: false, reason: 'missing_player' };
  const input = sanitizeInput(rawInput);
  if (input.seq <= player.lastInputSeq) {
    state.metrics.staleInputs += 1;
    return { accepted: false, reason: 'stale', lastInputSeq: player.lastInputSeq, seq: input.seq };
  }
  player.lastInputSeq = input.seq;
  player.input = input;
  state.metrics.acceptedInputs += 1;
  return { accepted: true, seq: input.seq };
}

function createProjectile(state, player, input) {
  const dir = normalize(input.aimX, input.aimY);
  const id = `p${state.nextProjectileId++}`;
  state.projectiles[id] = {
    id,
    ownerId: player.id,
    x: player.x + dir.x * (player.radius + PROJECTILE_RADIUS + 2),
    y: player.y + dir.y * (player.radius + PROJECTILE_RADIUS + 2),
    vx: dir.x * PROJECTILE_SPEED,
    vy: dir.y * PROJECTILE_SPEED,
    ageMs: 0,
    radius: PROJECTILE_RADIUS,
    damage: 20
  };
  state.metrics.shotsFired += 1;
}

function stepPlayers(state, dtSeconds) {
  for (const player of Object.values(state.players)) {
    if (!player.online || player.hp <= 0) continue;
    const input = player.input || neutralInput();
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const move = normalize(dx, dy);
    player.vx = move.x * PLAYER_SPEED;
    player.vy = move.y * PLAYER_SPEED;
    player.x = clamp(player.x + player.vx * dtSeconds, player.radius, ARENA_WIDTH - player.radius);
    player.y = clamp(player.y + player.vy * dtSeconds, player.radius, ARENA_HEIGHT - player.radius);

    if (input.shoot && state.timeMs - player.lastShotMs >= PLAYER_FIRE_COOLDOWN_MS) {
      player.lastShotMs = state.timeMs;
      createProjectile(state, player, input);
    }
  }
}

function nearestLivingPlayer(state, enemy) {
  let best = null;
  let bestD2 = Infinity;
  for (const player of Object.values(state.players)) {
    if (!player.online || player.hp <= 0) continue;
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      best = player;
      bestD2 = d2;
    }
  }
  return best;
}

function stepEnemies(state, dtSeconds) {
  for (const enemy of Object.values(state.enemies)) {
    const target = nearestLivingPlayer(state, enemy);
    if (!target) continue;
    const dir = normalize(target.x - enemy.x, target.y - enemy.y);
    const speed = 78;
    enemy.x = clamp(enemy.x + dir.x * speed * dtSeconds, enemy.radius, ARENA_WIDTH - enemy.radius);
    enemy.y = clamp(enemy.y + dir.y * speed * dtSeconds, enemy.radius, ARENA_HEIGHT - enemy.radius);
  }
}

function stepProjectiles(state, dtSeconds, dtMs) {
  for (const projectile of Object.values(state.projectiles)) {
    projectile.x += projectile.vx * dtSeconds;
    projectile.y += projectile.vy * dtSeconds;
    projectile.ageMs += dtMs;
  }

  for (const [projectileId, projectile] of Object.entries(state.projectiles)) {
    if (
      projectile.ageMs >= PROJECTILE_TTL_MS ||
      projectile.x < -32 ||
      projectile.y < -32 ||
      projectile.x > ARENA_WIDTH + 32 ||
      projectile.y > ARENA_HEIGHT + 32
    ) {
      delete state.projectiles[projectileId];
      continue;
    }

    for (const [enemyId, enemy] of Object.entries(state.enemies)) {
      const hitRange = projectile.radius + enemy.radius;
      if (Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) <= hitRange) {
        enemy.hp -= projectile.damage;
        state.metrics.enemyHits += 1;
        delete state.projectiles[projectileId];
        if (enemy.hp <= 0) delete state.enemies[enemyId];
        break;
      }
    }
  }
}

function stepArena(state, dtMs = FIXED_DT_MS) {
  const boundedDtMs = clamp(Number(dtMs) || FIXED_DT_MS, 1, 100);
  const dtSeconds = boundedDtMs / 1000;
  state.tick += 1;
  state.timeMs += boundedDtMs;
  stepPlayers(state, dtSeconds);
  stepEnemies(state, dtSeconds);
  stepProjectiles(state, dtSeconds, boundedDtMs);
  return state;
}

function compactSnapshot(state) {
  return {
    authority: state.authority,
    tick: state.tick,
    timeMs: Math.round(state.timeMs),
    players: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, {
      x: Math.round(p.x),
      y: Math.round(p.y),
      hp: Math.round(p.hp),
      online: !!p.online,
      lastInputSeq: p.lastInputSeq
    }])),
    enemies: Object.fromEntries(Object.entries(state.enemies).map(([id, e]) => [id, {
      x: Math.round(e.x),
      y: Math.round(e.y),
      hp: Math.round(e.hp)
    }])),
    projectiles: Object.fromEntries(Object.entries(state.projectiles).map(([id, p]) => [id, {
      x: Math.round(p.x),
      y: Math.round(p.y),
      ownerId: p.ownerId
    }])),
    metrics: { ...state.metrics }
  };
}

module.exports = {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  FIXED_DT_MS,
  createArenaState,
  addPlayer,
  markPlayerOffline,
  removePlayer,
  applyInput,
  stepArena,
  compactSnapshot,
  sanitizeInput
};
