import { WORLD, GREEN } from "../core/constants.js";
import { angleToVec, clamp, dist2, norm, segmentCircleHit } from "../core/math.js";
import { SpatialGrid } from "../core/spatialGrid.js";
import { START_WEAPON, WEAPONS } from "../data/weapons.js";
import { ENEMIES } from "../data/enemies.js";
import { dropLoot } from "./loot.js";
import { pushEvent } from "./state.js";

const enemyGrid = new SpatialGrid(112);

function rebuildEnemyGrid(state) {
  enemyGrid.clear();
  for (const e of Object.values(state.enemies)) enemyGrid.insert(e);
}

function nearestEnemy(state, projectile, maxRange = 620) {
  if (projectile.targetId && state.enemies[projectile.targetId]) return state.enemies[projectile.targetId];

  let best = null;
  let bestD = maxRange * maxRange;
  for (const e of enemyGrid.query(projectile.x, projectile.y, maxRange)) {
    if (!state.enemies[e.id]) continue;
    const d = dist2(projectile.x, projectile.y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) projectile.targetId = best.id;
  return best;
}

function killEnemy(state, enemy) {
  if (!state.enemies[enemy.id]) return;
  const data = ENEMIES[enemy.kind];
  dropLoot(state, enemy.x, enemy.y, enemy.kind === "boss" ? 1 : 0.32);
  pushEvent(state, { type: "kill", kind: enemy.kind, x: enemy.x, y: enemy.y, score: data.score });
  delete state.enemies[enemy.id];
}

function addImpulse(enemy, fromX, fromY, force) {
  const d = norm(enemy.x - fromX, enemy.y - fromY);
  enemy.kx = (enemy.kx || 0) + d.x * force;
  enemy.ky = (enemy.ky || 0) + d.y * force;
}

function addSpark(state, x, y, amount = 3, power = 110) {
  for (let i = 0; i < amount; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const v = state.rng.range(power * 0.45, power);
    state.effects.push({
      type: "spark",
      x: Math.round(x),
      y: Math.round(y),
      vx: Math.round(Math.cos(a) * v),
      vy: Math.round(Math.sin(a) * v),
      life: 0.18,
      maxLife: 0.18,
      color: GREEN
    });
  }
}

function explode(state, projectile, effect) {
  const radius = (effect.radius || 80) * (projectile.explosionRadiusMult || 1);
  const damage = (effect.damage || projectile.damage) * (projectile.explosionDamageMult || 1);
  const force = (effect.force || 220) * (projectile.knockbackMult || 1);

  for (const e of enemyGrid.query(projectile.x, projectile.y, radius + 80)) {
    if (!state.enemies[e.id]) continue;
    const r = radius + e.radius;
    if (dist2(projectile.x, projectile.y, e.x, e.y) > r * r) continue;
    const falloff = Math.max(0.35, 1 - Math.sqrt(dist2(projectile.x, projectile.y, e.x, e.y)) / Math.max(1, r));
    const dealt = Math.round(damage * falloff);
    e.hp -= dealt;
    addImpulse(e, projectile.x, projectile.y, force * falloff);
    pushEvent(state, { type: "hit", x: e.x, y: e.y, amount: dealt });
    if (e.hp <= 0) killEnemy(state, e);
  }

  const life = effect.visual === "large" ? 0.36 : 0.24;
  state.effects.push({
    type: "explosion",
    x: Math.round(projectile.x),
    y: Math.round(projectile.y),
    r: radius,
    life,
    maxLife: life,
    color: GREEN
  });
  addSpark(state, projectile.x, projectile.y, effect.visual === "large" ? 14 : 7, effect.visual === "large" ? 260 : 170);
  pushEvent(state, { type: "explosion", x: projectile.x, y: projectile.y, radius });
}

function detonateProjectile(state, projectile, weapon) {
  const explodeEffect = weapon.effects.find((e) => e.type === "explode");
  if (explodeEffect && !projectile.exploded) {
    projectile.exploded = true;
    explode(state, projectile, explodeEffect);
  }
}

function applyProjectileHit(state, projectile, enemy) {
  const weapon = WEAPONS[projectile.weaponId] || WEAPONS[START_WEAPON];
  enemy.hp -= projectile.damage;
  addImpulse(enemy, projectile.x, projectile.y, (weapon.knockback || 120) * (projectile.knockbackMult || 1));
  addSpark(state, enemy.x, enemy.y, projectile.kind === "bullet" ? 2 : 4, 120);
  pushEvent(state, { type: "hit", x: enemy.x, y: enemy.y, amount: projectile.damage });
  if (enemy.hp <= 0) killEnemy(state, enemy);

  const explodeEffect = weapon.effects.find((e) => e.type === "explode");
  if (explodeEffect) {
    detonateProjectile(state, projectile, weapon);
    return true;
  }

  const pierce = weapon.effects.find((e) => e.type === "pierce");
  if (pierce && projectile.pierced < pierce.count) {
    projectile.pierced += 1;
    return false;
  }
  return true;
}

function applyHoming(state, projectile, weapon, dt) {
  const homing = weapon.effects.find((e) => e.type === "homing");
  if (!homing) return;
  const target = nearestEnemy(state, projectile, homing.acquireRange || 620);
  if (!target) return;

  const desired = norm(target.x - projectile.x, target.y - projectile.y);
  const current = norm(projectile.vx, projectile.vy);
  const strength = (homing.strength || 8) * dt;
  const nx = current.x + (desired.x - current.x) * clamp(strength, 0, 1);
  const ny = current.y + (desired.y - current.y) * clamp(strength, 0, 1);
  const nd = norm(nx, ny);
  projectile.vx = nd.x * projectile.speed;
  projectile.vy = nd.y * projectile.speed;
}

export function updateProjectiles(state, dt) {
  rebuildEnemyGrid(state);

  for (const p of Object.values(state.projectiles)) {
    const weapon = WEAPONS[p.weaponId] || WEAPONS[START_WEAPON];
    const prevX = p.x;
    const prevY = p.y;

    if (p.kind === "homing") applyHoming(state, p, weapon, dt);

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.distance += Math.hypot(p.x - prevX, p.y - prevY);

    let remove = false;
    const sweep = Math.hypot(p.x - prevX, p.y - prevY);
    const range = p.radius + sweep + 64;
    for (const e of enemyGrid.query(p.x, p.y, range)) {
      if (!state.enemies[e.id]) continue;
      const hitRadius = e.radius + p.radius + (weapon.hitPadding || 3);
      if (!segmentCircleHit(prevX, prevY, p.x, p.y, e.x, e.y, hitRadius)) continue;
      remove = applyProjectileHit(state, p, e);
      if (remove) break;
    }

    const ended = p.x < 0 || p.x > WORLD.w || p.y < 0 || p.y > WORLD.h || p.life <= 0 || p.distance >= p.range;
    if (ended) {
      detonateProjectile(state, p, weapon);
      remove = true;
    }
    if (remove) delete state.projectiles[p.id];
  }

  for (const fx of state.effects) fx.life -= dt;
  state.effects = state.effects.filter((fx) => fx.life > 0);
}

export function makeProjectile({ id, ownerId, weaponId, x, y, angle, pelletIndex = 0 }) {
  const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
  const dir = angleToVec(angle);
  return {
    id,
    ownerId,
    weaponId,
    kind: weapon.projectile,
    x,
    y,
    vx: dir.x * weapon.bulletSpeed,
    vy: dir.y * weapon.bulletSpeed,
    speed: weapon.bulletSpeed,
    damage: weapon.damage,
    radius: weapon.radius,
    range: weapon.range,
    distance: 0,
    life: weapon.range / weapon.bulletSpeed,
    color: weapon.color,
    pelletIndex,
    pierced: 0,
    exploded: false,
    targetId: null
  };
}
