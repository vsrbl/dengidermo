import { WORLD } from "../core/constants.js";
import { clamp, dist2, norm } from "../core/math.js";
import { ENEMIES, ENEMY_WAVES } from "../data/enemies.js";
import { currentLocation } from "./portals.js";
import { nextId, pushEvent } from "./state.js";

function nearestAlivePlayer(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const p of Object.values(state.players)) {
    if (p.hp <= 0) continue;
    const d = dist2(x, y, p.x, p.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function spawnEnemy(state, kind, x = null, y = null) {
  const data = ENEMIES[kind];
  if (!data) return null;
  const id = nextId("en");
  if (x === null || y === null) {
    const side = state.rng.int(0, 3);
    if (side === 0) { x = state.rng.range(80, WORLD.w - 80); y = 80; }
    if (side === 1) { x = WORLD.w - 80; y = state.rng.range(80, WORLD.h - 80); }
    if (side === 2) { x = state.rng.range(80, WORLD.w - 80); y = WORLD.h - 80; }
    if (side === 3) { x = 80; y = state.rng.range(80, WORLD.h - 80); }
  }
  state.enemies[id] = {
    id,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    hp: data.hp,
    maxHp: data.hp,
    radius: data.radius,
    shootAt: 0
  };
  return state.enemies[id];
}

export function updateSpawner(state, dt) {
  const playerCount = Math.max(1, Object.keys(state.players).length);
  const enemyCount = Object.keys(state.enemies).length;
  state.spawnTimer -= dt;

  const loc = currentLocation(state);
  const locTime = state.locationTime || 0;

  if (!state.bossSpawned && locTime > 20 && ((state.locationIndex || 0) % 4 === 3 || locTime > 36)) {
    state.bossSpawned = true;
    spawnEnemy(state, "boss", WORLD.w / 2, 180);
    pushEvent(state, { type: "boss", x: WORLD.w / 2, y: 180 });
  }

  const cap = Math.floor((24 + playerCount * 8 + Math.min(18, Math.floor(locTime / 18))) * (loc.spawnBoost || 1));
  if (enemyCount >= cap || state.spawnTimer > 0) return;

  const batch = 2 + Math.floor(locTime / 35) + playerCount;
  const pool = Array.isArray(loc.enemyPool) && loc.enemyPool.length ? loc.enemyPool : ENEMY_WAVES;
  for (let i = 0; i < batch; i += 1) {
    const kind = state.rng.pick(pool);
    spawnEnemy(state, kind);
  }
  state.wave += 1;
  state.spawnTimer = Math.max(0.45, 2.2 - locTime * 0.006);
}

export function updateEnemies(state, dt) {
  for (const enemy of Object.values(state.enemies)) {
    const data = ENEMIES[enemy.kind];
    const target = nearestAlivePlayer(state, enemy.x, enemy.y);
    if (!target) continue;

    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    const dir = norm(dx, dy);
    let speed = data.speed;
    if (data.behavior === "ranged" && d < 300) speed *= -0.45;

    const targetVx = dir.x * speed;
    const targetVy = dir.y * speed;
    const t = 1 - Math.exp(-8 * dt);
    enemy.vx += (targetVx - enemy.vx) * t;
    enemy.vy += (targetVy - enemy.vy) * t;
    enemy.kx = (enemy.kx || 0) * Math.exp(-6.8 * dt);
    enemy.ky = (enemy.ky || 0) * Math.exp(-6.8 * dt);

    enemy.x = clamp(enemy.x + (enemy.vx + (enemy.kx || 0)) * dt, enemy.radius, WORLD.w - enemy.radius);
    enemy.y = clamp(enemy.y + (enemy.vy + (enemy.ky || 0)) * dt, enemy.radius, WORLD.h - enemy.radius);

    const touchR = enemy.radius + target.radius;
    if (dist2(enemy.x, enemy.y, target.x, target.y) <= touchR * touchR) {
      target.hp -= data.damage * dt;
      const push = norm(target.x - enemy.x, target.y - enemy.y);
      target.kx = (target.kx || 0) + push.x * 70;
      target.ky = (target.ky || 0) + push.y * 70;
    }
  }
}
