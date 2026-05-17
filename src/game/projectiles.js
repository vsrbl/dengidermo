import { WORLD, GREEN } from "../core/constants.js";
import { angleToVec, clamp, dist2, norm, segmentCircleHit } from "../core/math.js";
import { SpatialGrid } from "../core/spatialGrid.js";
import { WEAPONS } from "../data/weapons.js";
import { ENEMIES } from "../data/enemies.js";
import { dropLoot } from "./loot.js";
import { pushEvent } from "./state.js";

const enemyGrid = new SpatialGrid(112);

function rebuildEnemyGrid(state) {
  enemyGrid.clear();
  for (const e of Object.values(state.enemies)) enemyGrid.insert(e);
}

function nearestEnemy(state, x, y, maxRange = 520) {
  let best = null;
  let bestD = maxRange * maxRange;
  for (const e of enemyGrid.query(x, y, maxRange)) {
    const d = dist2(x, y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function explode(state, projectile, effect) {
  const radius = effect.radius || 80;
  const damage = effect.damage || projectile.damage;
  for (const e of enemyGrid.query(projectile.x, projectile.y, radius + 60)) {
    const r = radius + e.radius;
    if (dist2(projectile.x, projectile.y, e.x, e.y) <= r * r) {
      e.hp -= damage;
      pushEvent(state, { type: "hit", x: e.x, y: e.y, amount: damage });
      if (e.hp <= 0) killEnemy(state, e);
    }
  }
  state.effects.push({ type: "explosion", x: Math.round(projectile.x), y: Math.round(projectile.y), r: radius, life: 0.22, color: GREEN });
  pushEvent(state, { type: "explosion", x: projectile.x, y: projectile.y, radius });
}

function killEnemy(state, enemy) {
  if (!state.enemies[enemy.id]) return;
  const data = ENEMIES[enemy.kind];
  dropLoot(state, enemy.x, enemy.y, enemy.kind === "boss" ? 1 : 0.32);
  pushEvent(state, { type: "kill", kind: enemy.kind, x: enemy.x, y: enemy.y, score: data.score });
  delete state.enemies[enemy.id];
}

function applyProjectileHit(state, projectile, enemy) {
  enemy.hp -= projectile.damage;
  pushEvent(state, { type: "hit", x: enemy.x, y: enemy.y, amount: projectile.damage });
  if (enemy.hp <= 0) killEnemy(state, enemy);

  const weapon = WEAPONS[projectile.weaponId];
  const explodeEffect = weapon.effects.find((e) => e.type === "explode");
  if (explodeEffect) explode(state, projectile, explodeEffect);

  const pierce = weapon.effects.find((e) => e.type === "pierce");
  if (pierce && projectile.pierced < pierce.count) {
    projectile.pierced += 1;
    return false;
  }
  return true;
}

export function updateProjectiles(state, dt) {
  rebuildEnemyGrid(state);

  for (const p of Object.values(state.projectiles)) {
    const weapon = WEAPONS[p.weaponId];
    const prevX = p.x;
    const prevY = p.y;

    if (p.kind === "homing") {
      const target = nearestEnemy(state, p.x, p.y, 560);
      if (target) {
        const desired = norm(target.x - p.x, target.y - p.y);
        const current = norm(p.vx, p.vy);
        const strength = (weapon.effects.find((e) => e.type === "homing")?.strength || 6) * dt;
        const nx = current.x + (desired.x - current.x) * clamp(strength, 0, 1);
        const ny = current.y + (desired.y - current.y) * clamp(strength, 0, 1);
        const nd = norm(nx, ny);
        p.vx = nd.x * p.speed;
        p.vy = nd.y * p.speed;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.distance += Math.hypot(p.x - prevX, p.y - prevY);

    let remove = false;
    const range = p.radius + 56;
    for (const e of enemyGrid.query(p.x, p.y, range + Math.hypot(p.x - prevX, p.y - prevY))) {
      const hitRadius = e.radius + p.radius + (p.ownerId === "p1" ? 1 : 4);
      if (!segmentCircleHit(prevX, prevY, p.x, p.y, e.x, e.y, hitRadius)) continue;
      remove = applyProjectileHit(state, p, e);
      if (remove) break;
    }

    if (p.x < 0 || p.x > WORLD.w || p.y < 0 || p.y > WORLD.h || p.life <= 0 || p.distance >= p.range) {
      const explodeEffect = weapon.effects.find((e) => e.type === "explode");
      if (explodeEffect && p.life <= 0) explode(state, p, explodeEffect);
      remove = true;
    }
    if (remove) delete state.projectiles[p.id];
  }

  for (const fx of state.effects) fx.life -= dt;
  state.effects = state.effects.filter((fx) => fx.life > 0);
}

export function makeProjectile({ id, ownerId, weaponId, x, y, angle, pelletIndex = 0 }) {
  const weapon = WEAPONS[weaponId] || WEAPONS.pistol;
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
    pierced: 0
  };
}
