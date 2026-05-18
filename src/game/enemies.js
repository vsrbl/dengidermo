import { WORLD } from "../core/constants.js";
import { clamp, dist2, norm } from "../core/math.js";
import { ENEMIES, ENEMY_WAVES } from "../data/enemies.js";
import { currentLocation } from "./portals.js";
import { nextId, pushEvent } from "./state.js";
import { applyShieldDamage, enemySlowMult } from "./effects.js";
import { areDevSpawnsPaused, devEnemyDamageMult, devEnemySpeedMult, devSpawnBatch, devSpawnCap, devSpawnInterval } from "./dev.js";

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
  if (areDevSpawnsPaused(state)) return;

  const loc = currentLocation(state);
  const locTime = state.locationTime || 0;
  const spawn = loc.spawn || {};
  const boss = loc.boss || {};

  if (!state.bossSpawned && boss.enabled && locTime >= (boss.spawnAt ?? 12)) {
    state.bossSpawned = true;
    const x = Number.isFinite(boss.x) ? boss.x : WORLD.w / 2;
    const y = Number.isFinite(boss.y) ? boss.y : 180;
    spawnEnemy(state, boss.kind || "boss", x, y);
    pushEvent(state, { type: "boss", x, y });
  }

  const capBase = spawn.capBase ?? 24;
  const capPerPlayer = spawn.capPerPlayer ?? 8;
  const capGrowthTime = spawn.capGrowthTime ?? 18;
  const capGrowthMax = spawn.capGrowthMax ?? 18;
  const capGrowth = Math.min(capGrowthMax, Math.floor(locTime / Math.max(1, capGrowthTime)));
  const normalCap = Math.floor((capBase + playerCount * capPerPlayer + capGrowth) * (loc.spawnBoost || 1));
  const cap = devSpawnCap(state, normalCap);
  if (enemyCount >= cap || state.spawnTimer > 0) return;

  const batchBase = spawn.batchBase ?? 2;
  const batchGrowthTime = spawn.batchGrowthTime ?? 35;
  const batch = devSpawnBatch(state, batchBase + Math.floor(locTime / Math.max(1, batchGrowthTime)) + playerCount);
  const pool = Array.isArray(loc.enemyPool) && loc.enemyPool.length ? loc.enemyPool : ENEMY_WAVES;
  for (let i = 0; i < batch; i += 1) {
    const kind = state.rng.pick(pool);
    spawnEnemy(state, kind);
  }
  state.wave += 1;
  const intervalBase = spawn.intervalBase ?? 2.2;
  const intervalMin = spawn.intervalMin ?? 0.45;
  const intervalScale = spawn.intervalScale ?? 0.006;
  state.spawnTimer = devSpawnInterval(state, Math.max(intervalMin, intervalBase - locTime * intervalScale));
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
    let speed = data.speed * enemySlowMult(enemy) * devEnemySpeedMult(state);
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
      target.hp -= applyShieldDamage(target, data.damage * devEnemyDamageMult(state) * dt);
      const push = norm(target.x - enemy.x, target.y - enemy.y);
      target.kx = (target.kx || 0) + push.x * 70;
      target.ky = (target.ky || 0) + push.y * 70;
    }
  }
}
