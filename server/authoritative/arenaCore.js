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
const ENEMY_TOUCH_DAMAGE = 8;
const ENEMY_TOUCH_COOLDOWN_MS = 650;
const PICKUP_RADIUS = 11;
const PICKUP_TTL_MS = 14000;
const FIXED_DT_MS = 1000 / 60;
const DEFAULT_ENEMY_COUNT = 5;
const COMPACT_COMBAT_SNAPSHOT_PROTOCOL = 'compact-combat-snapshot-v1';

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
    nextPickupId: 1,
    nextCombatEventSeq: 1,
    players: {},
    enemies: {},
    projectiles: {},
    pickups: {},
    combatEvents: [],
    metrics: {
      acceptedInputs: 0,
      staleInputs: 0,
      shotsFired: 0,
      enemyHits: 0,
      enemyKills: 0,
      playerHits: 0,
      pickupsSpawned: 0
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
      maxHp: 40,
      radius: ENEMY_RADIUS,
      lastTouchMsByPlayer: {}
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
    if (options.name) existing.name = String(options.name).slice(0, 12);
    existing.input = existing.input || neutralInput();
    existing.queuedInput = existing.queuedInput || null;
    existing.lastInputSeq = Number.isFinite(existing.lastInputSeq) ? existing.lastInputSeq : 0;
    existing.lastProcessedInputSeq = Number.isFinite(existing.lastProcessedInputSeq) ? existing.lastProcessedInputSeq : 0;
    existing.serverTick = Number.isFinite(existing.serverTick) ? existing.serverTick : 0;
    return existing;
  }
  const spawn = spawnForSlot(playerId);
  const player = {
    id: playerId,
    sessionId: options.sessionId || '',
    name: String(options.name || playerId).slice(0, 12),
    x: Number(options.x) || spawn.x,
    y: Number(options.y) || spawn.y,
    vx: 0,
    vy: 0,
    hp: 100,
    radius: PLAYER_RADIUS,
    online: true,
    lastInputSeq: 0,
    lastProcessedInputSeq: 0,
    serverTick: 0,
    lastShotMs: -9999,
    input: neutralInput(),
    queuedInput: null,
    angle: 0
  };
  state.players[playerId] = player;
  return player;
}

function markPlayerOffline(state, playerId) {
  const player = state?.players?.[playerId];
  if (!player) return;
  player.online = false;
  player.input = neutralInput();
  player.queuedInput = null;
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
  player.queuedInput = input;
  player.angle = Math.atan2(input.aimY || 0, input.aimX || 1);
  state.metrics.acceptedInputs += 1;
  return { accepted: true, seq: input.seq };
}

function consumeQueuedInput(player, tick) {
  if (player.queuedInput) {
    player.input = player.queuedInput;
    player.lastProcessedInputSeq = player.queuedInput.seq;
    player.serverTick = tick;
    player.queuedInput = null;
  }
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
    consumeQueuedInput(player, state.tick);
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


function pushCombatEvent(state, event = {}) {
  if (!state) return null;
  const item = {
    seq: state.nextCombatEventSeq++,
    tick: state.tick,
    timeMs: Math.round(state.timeMs),
    ...event
  };
  if (!Array.isArray(state.combatEvents)) state.combatEvents = [];
  state.combatEvents.push(item);
  if (state.combatEvents.length > 48) state.combatEvents.splice(0, state.combatEvents.length - 48);
  return item;
}

function spawnCombatPickup(state, source, type, amount = 1) {
  if (!state || !source) return null;
  if (!state.pickups) state.pickups = {};
  const id = `cp${state.nextPickupId++}`;
  const jitterSeed = state.nextPickupId * 0.61803398875;
  const angle = (jitterSeed % 1) * Math.PI * 2;
  const spread = type === 'money' ? 18 : 28;
  const pickup = {
    id,
    type,
    amount: Math.max(1, Math.round(Number(amount) || 1)),
    x: clamp(source.x + Math.cos(angle) * spread, PICKUP_RADIUS, ARENA_WIDTH - PICKUP_RADIUS),
    y: clamp(source.y + Math.sin(angle) * spread, PICKUP_RADIUS, ARENA_HEIGHT - PICKUP_RADIUS),
    spawnX: source.x,
    spawnY: source.y,
    radius: PICKUP_RADIUS,
    ageMs: 0,
    sourceId: source.id || '',
    sourceType: source.kind || 'enemy'
  };
  state.pickups[id] = pickup;
  state.metrics.pickupsSpawned += 1;
  pushCombatEvent(state, { type: 'pickup_spawned', pickupId: id, pickupType: pickup.type, amount: pickup.amount, sourceId: pickup.sourceId });
  return pickup;
}

function killEnemy(state, enemy, source = {}) {
  if (!state?.enemies?.[enemy?.id]) return false;
  delete state.enemies[enemy.id];
  state.metrics.enemyKills += 1;
  pushCombatEvent(state, { type: 'enemy_killed', enemyId: enemy.id, sourceId: source.ownerId || source.playerId || '', sourceType: source.type || 'projectile' });
  spawnCombatPickup(state, enemy, 'money', 1);
  spawnCombatPickup(state, enemy, 'xp', 1);
  return true;
}

function damageEnemy(state, enemy, amount, source = {}) {
  if (!state?.enemies?.[enemy?.id]) return { killed: false, hp: 0 };
  const damage = Math.max(0, Number(amount) || 0);
  if (damage <= 0) return { killed: false, hp: enemy.hp };
  enemy.hp = Math.max(0, enemy.hp - damage);
  state.metrics.enemyHits += 1;
  pushCombatEvent(state, { type: 'enemy_damaged', enemyId: enemy.id, amount: damage, hp: enemy.hp, sourceId: source.ownerId || source.playerId || '', sourceType: source.type || 'projectile' });
  if (enemy.hp <= 0) return { killed: killEnemy(state, enemy, source), hp: 0 };
  return { killed: false, hp: enemy.hp };
}

function damagePlayer(state, player, amount, source = {}) {
  if (!state?.players?.[player?.id] || player.hp <= 0) return { hp: 0 };
  const damage = Math.max(0, Number(amount) || 0);
  if (damage <= 0) return { hp: player.hp };
  player.hp = Math.max(0, player.hp - damage);
  state.metrics.playerHits += 1;
  pushCombatEvent(state, { type: 'player_damaged', playerId: player.id, amount: damage, hp: player.hp, sourceId: source.enemyId || source.sourceId || '', sourceType: source.type || 'enemy_touch' });
  return { hp: player.hp };
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

    for (const enemy of Object.values(state.enemies)) {
      const hitRange = projectile.radius + enemy.radius;
      if (Math.hypot(projectile.x - enemy.x, projectile.y - enemy.y) <= hitRange) {
        damageEnemy(state, enemy, projectile.damage, { type: 'projectile', ownerId: projectile.ownerId, projectileId });
        delete state.projectiles[projectileId];
        break;
      }
    }
  }
}

function stepEnemyContactDamage(state) {
  for (const enemy of Object.values(state.enemies)) {
    if (!enemy.lastTouchMsByPlayer) enemy.lastTouchMsByPlayer = {};
    for (const player of Object.values(state.players)) {
      if (!player.online || player.hp <= 0) continue;
      const range = (enemy.radius || ENEMY_RADIUS) + (player.radius || PLAYER_RADIUS);
      if (Math.hypot(player.x - enemy.x, player.y - enemy.y) > range) continue;
      const last = Number(enemy.lastTouchMsByPlayer[player.id] || -9999);
      if (state.timeMs - last < ENEMY_TOUCH_COOLDOWN_MS) continue;
      enemy.lastTouchMsByPlayer[player.id] = state.timeMs;
      damagePlayer(state, player, ENEMY_TOUCH_DAMAGE, { type: 'enemy_touch', enemyId: enemy.id });
    }
  }
}

function stepPickups(state, dtMs) {
  if (!state.pickups) state.pickups = {};
  for (const [id, pickup] of Object.entries(state.pickups)) {
    pickup.ageMs = (Number(pickup.ageMs) || 0) + dtMs;
    if (pickup.ageMs >= PICKUP_TTL_MS) {
      delete state.pickups[id];
      pushCombatEvent(state, { type: 'pickup_expired', pickupId: id, pickupType: pickup.type || 'unknown' });
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
  stepEnemyContactDamage(state);
  stepPickups(state, boundedDtMs);
  return state;
}

function compactNumber(value, scale = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * scale) / scale;
}

function estimatePacketBytes(payload) {
  try { return Buffer.byteLength(JSON.stringify(payload)); } catch { return 0; }
}

function compactCombatSnapshot(state) {
  const enemies = Object.entries(state.enemies).map(([id, e]) => ([
    id,
    Math.round(e.x),
    Math.round(e.y),
    Math.round(e.hp),
    Math.round(e.radius || ENEMY_RADIUS)
  ]));
  const projectiles = Object.entries(state.projectiles).map(([id, p]) => ([
    id,
    Math.round(p.x),
    Math.round(p.y),
    compactNumber(p.vx, 10),
    compactNumber(p.vy, 10),
    p.ownerId || '',
    Math.round(p.radius || PROJECTILE_RADIUS)
  ]));
  const pickups = Object.entries(state.pickups || {}).map(([id, item]) => ([
    id,
    Math.round(item.x),
    Math.round(item.y),
    item.type || 'money',
    Math.round(item.amount || 1),
    Math.round(item.radius || PICKUP_RADIUS),
    item.sourceId || '',
    Math.round(item.spawnX ?? item.x),
    Math.round(item.spawnY ?? item.y)
  ]));
  const payload = {
    protocol: COMPACT_COMBAT_SNAPSHOT_PROTOCOL,
    tick: state.tick,
    timeMs: Math.round(state.timeMs),
    enemies,
    projectiles,
    pickups,
    counts: {
      enemies: enemies.length,
      projectiles: projectiles.length,
      pickups: pickups.length
    },
    combat: {
      authority: 'server-owned-combat-damage-v1',
      enemyHits: state.metrics.enemyHits,
      enemyKills: state.metrics.enemyKills,
      playerHits: state.metrics.playerHits,
      pickupsSpawned: state.metrics.pickupsSpawned
    },
    events: Array.isArray(state.combatEvents) ? state.combatEvents.slice(-16) : []
  };
  payload.byteEstimate = estimatePacketBytes(payload);
  return payload;
}

function compactSnapshot(state) {
  const combat = compactCombatSnapshot(state);
  return {
    authority: state.authority,
    tick: state.tick,
    timeMs: Math.round(state.timeMs),
    players: Object.fromEntries(Object.entries(state.players).map(([id, p]) => [id, {
      x: Math.round(p.x),
      y: Math.round(p.y),
      hp: Math.round(p.hp),
      online: !!p.online,
      lastInputSeq: p.lastInputSeq,
      lastProcessedInputSeq: p.lastProcessedInputSeq || 0,
      serverTick: p.serverTick || 0
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
    pickups: Object.fromEntries(Object.entries(state.pickups || {}).map(([id, item]) => [id, {
      x: Math.round(item.x),
      y: Math.round(item.y),
      type: item.type,
      amount: item.amount
    }])),
    combat,
    combatEvents: Array.isArray(state.combatEvents) ? state.combatEvents.slice(-16) : [],
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
  compactCombatSnapshot,
  COMPACT_COMBAT_SNAPSHOT_PROTOCOL,
  damageEnemy,
  damagePlayer,
  spawnCombatPickup,
  sanitizeInput
};
