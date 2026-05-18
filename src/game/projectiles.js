import { WORLD, GREEN } from "../core/constants.js";
import { angleToVec, clamp, dist2, norm, segmentCircleHit } from "../core/math.js";
import { SpatialGrid } from "../core/spatialGrid.js";
import { START_WEAPON, WEAPONS } from "../data/weapons.js";
import { ENEMIES } from "../data/enemies.js";
import {
  applyProjectileStatuses,
  cloneEffect,
  getEffect,
  healProjectileOwner,
  resolveProjectileDamage,
  sourceId,
  tickEnemyStatuses
} from "./effects.js";
import { dropLoot } from "./loot.js";
import { nextId, pushEvent } from "./state.js";

const enemyGrid = new SpatialGrid(112);
const CHILD_DEPTH_MAX = 2;

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
    if (projectile.hitIds?.[e.id]) continue;
    const d = dist2(projectile.x, projectile.y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) projectile.targetId = best.id;
  return best;
}

function killEnemy(state, enemy, source = null) {
  if (!state.enemies[enemy.id]) return;
  const data = ENEMIES[enemy.kind];
  const sid = sourceId(source);
  dropLoot(state, enemy.x, enemy.y, enemy.kind === "boss" ? 1 : 0.32, sid);
  pushEvent(state, { type: "kill", kind: enemy.kind, x: enemy.x, y: enemy.y, score: data.score, sourceId: sid });
  delete state.enemies[enemy.id];
}

function addImpulse(enemy, fromX, fromY, force) {
  const d = norm(enemy.x - fromX, enemy.y - fromY);
  enemy.kx = (enemy.kx || 0) + d.x * force;
  enemy.ky = (enemy.ky || 0) + d.y * force;
}


function addShake(state, power = 0.2, life = 0.08) {
  const p = Math.max(0, Math.min(3, Number.isFinite(power) ? power : 0));
  if (p <= 0) return;
  const l = Math.max(0.03, Math.min(0.22, Number.isFinite(life) ? life : 0.08));
  state.effects.push({
    type: "shake",
    power: p,
    life: l,
    maxLife: l
  });
}

function addSpark(state, x, y, amount = 3, power = 110, color = GREEN) {
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
      color
    });
  }
}

function tickEnemyStatusDamage(state, dt) {
  for (const enemy of Object.values(state.enemies)) {
    const tick = tickEnemyStatuses(enemy, dt);
    if (tick.damage > 0) {
      enemy.hp -= tick.damage;
      if (tick.active && state.rng.next() < 5 * dt) addSpark(state, enemy.x, enemy.y, 1, 80);
      if (enemy.hp <= 0) killEnemy(state, enemy, tick.sources?.[0] || null);
    }
  }
}

function dealProjectileDamage(state, projectile, enemy, baseDamage, eventX = enemy.x, eventY = enemy.y) {
  const hit = resolveProjectileDamage(state, projectile, baseDamage, enemy);
  const before = Math.max(0, enemy.hp || 0);
  enemy.hp -= hit.amount;
  const done = Math.min(before, hit.amount);
  healProjectileOwner(state, projectile, done);
  pushEvent(state, { type: "hit", x: eventX, y: eventY, amount: hit.amount, crit: hit.critical, sourceId: projectile.ownerId });
  if (hit.critical) addSpark(state, eventX, eventY, 5, 190);
  const hitShake = getEffect(projectile, "hitShake");
  if (hitShake) addShake(state, (hitShake.power || 0.18) * (hit.critical ? 1.35 : 1), hitShake.life || 0.08);
  return hit;
}

function explode(state, projectile, effect, x = projectile.x, y = projectile.y) {
  const radius = (effect.radius || 80) * (projectile.explosionRadiusMult || 1);
  const damage = (effect.damage || projectile.damage) * (projectile.explosionDamageMult || 1);
  const force = (effect.force || 220) * (projectile.knockbackMult || 1);

  for (const e of enemyGrid.query(x, y, radius + 80)) {
    if (!state.enemies[e.id]) continue;
    const r = radius + e.radius;
    const d2 = dist2(x, y, e.x, e.y);
    if (d2 > r * r) continue;
    const falloff = Math.max(0.35, 1 - Math.sqrt(d2) / Math.max(1, r));
    dealProjectileDamage(state, projectile, e, damage * falloff, e.x, e.y);
    applyProjectileStatuses(projectile, e);
    addImpulse(e, x, y, force * falloff);
    if (e.hp <= 0) killEnemy(state, e, projectile);
  }

  const life = effect.visual === "large" ? 0.36 : 0.24;
  state.effects.push({
    type: "explosion",
    x: Math.round(x),
    y: Math.round(y),
    r: radius,
    life,
    maxLife: life,
    color: GREEN
  });
  addSpark(state, x, y, effect.visual === "large" ? 14 : 7, effect.visual === "large" ? 260 : 170);
  pushEvent(state, { type: "explosion", x, y, radius, sourceId: projectile.ownerId });
}

function chainLightning(state, projectile, firstEnemy, effect) {
  const jumps = Math.max(0, Math.floor(effect.jumps || 0));
  if (!jumps || !firstEnemy) return;
  const range = effect.range || 260;
  const falloff = Math.max(0.1, Math.min(1, effect.falloff || 0.72));
  let damage = effect.damage || Math.max(4, projectile.damage * 0.55);
  let from = firstEnemy;
  const hit = new Set([firstEnemy.id]);

  for (let i = 0; i < jumps; i += 1) {
    let best = null;
    let bestD = range * range;
    for (const e of enemyGrid.query(from.x, from.y, range)) {
      if (!state.enemies[e.id] || hit.has(e.id)) continue;
      const d = dist2(from.x, from.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) break;
    hit.add(best.id);
    dealProjectileDamage(state, projectile, best, damage, best.x, best.y);
    state.effects.push({
      type: "chain",
      x: Math.round(from.x),
      y: Math.round(from.y),
      x2: Math.round(best.x),
      y2: Math.round(best.y),
      life: 0.14,
      maxLife: 0.14,
      color: GREEN
    });
    if (best.hp <= 0) killEnemy(state, best, projectile);
    from = best;
    damage *= falloff;
  }
}

function spawnSplitProjectiles(state, projectile, effect) {
  const depth = projectile.childDepth || 0;
  if (depth >= CHILD_DEPTH_MAX) return;
  const count = Math.max(0, Math.min(12, Math.floor(effect.count || 0)));
  if (!count) return;
  const baseAngle = Math.atan2(projectile.vy || 0, projectile.vx || 1);
  const spread = effect.spread ?? Math.PI * 0.92;
  const speed = effect.speed || projectile.speed * 0.82;
  const damage = effect.damage || projectile.damage * 0.45;
  const childEffects = (projectile.effects || [])
    .filter((e) => e.type !== "splitRockets")
    .map((e) => cloneEffect(e));

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = baseAngle - spread / 2 + spread * t;
    const dir = angleToVec(angle);
    const id = nextId("pr");
    state.projectiles[id] = {
      ...projectile,
      id,
      x: projectile.x + dir.x * 14,
      y: projectile.y + dir.y * 14,
      vx: dir.x * speed,
      vy: dir.y * speed,
      speed,
      damage,
      radius: Math.max(3, projectile.radius * 0.68),
      distance: 0,
      range: Math.min(projectile.range || 520, effect.range || 460),
      life: Math.min(projectile.life || 0.55, 0.75),
      effects: childEffects,
      hitIds: {},
      pierced: 0,
      ricocheted: 0,
      exploded: false,
      expiredEffectsFired: false,
      childDepth: depth + 1,
      targetId: null
    };
  }
}

function spawnClusterExplosions(state, projectile, effect) {
  const count = Math.max(0, Math.min(16, Math.floor(effect.count || 0)));
  if (!count) return;
  const radius = effect.radius || 46;
  const damage = effect.damage || projectile.damage * 0.42;
  for (let i = 0; i < count; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const d = state.rng.range(18, effect.spread || 120);
    explode(state, projectile, { type: "explode", radius, damage, force: effect.force || 110, visual: "small" }, projectile.x + Math.cos(a) * d, projectile.y + Math.sin(a) * d);
  }
}

function fireExpireEffects(state, projectile) {
  if (projectile.expiredEffectsFired) return;
  projectile.expiredEffectsFired = true;

  const explodeEffect = getEffect(projectile, "explode");
  if (explodeEffect && !projectile.exploded) {
    projectile.exploded = true;
    explode(state, projectile, explodeEffect);
  }

  const split = getEffect(projectile, "splitRockets");
  if (split) spawnSplitProjectiles(state, projectile, split);

  const cluster = getEffect(projectile, "clusterBomb");
  if (cluster) spawnClusterExplosions(state, projectile, cluster);

  const shake = getEffect(projectile, "screenShake");
  if (shake?.power > 0) {
    addShake(state, Math.min(14, shake.power), 0.18);
  }
}

function registerHit(projectile, enemy) {
  if (!projectile.hitIds) projectile.hitIds = {};
  projectile.hitIds[enemy.id] = true;
}

function canHit(projectile, enemy) {
  return !projectile.hitIds?.[enemy.id];
}

function applyProjectileHit(state, projectile, enemy) {
  const weapon = WEAPONS[projectile.weaponId] || WEAPONS[START_WEAPON];
  registerHit(projectile, enemy);
  const hit = dealProjectileDamage(state, projectile, enemy, projectile.damage, enemy.x, enemy.y);
  applyProjectileStatuses(projectile, enemy);
  addImpulse(enemy, projectile.x, projectile.y, (weapon.knockback || 120) * (projectile.knockbackMult || 1));

  const spark = getEffect(projectile, "spark");
  const sparkCount = spark?.count ?? (projectile.kind === "bullet" ? 2 : 4);
  addSpark(state, enemy.x, enemy.y, hit.critical ? Math.max(6, sparkCount + 3) : sparkCount, hit.critical ? 210 : 120);

  const chain = getEffect(projectile, "chainLightning");
  if (chain) chainLightning(state, projectile, enemy, chain);

  if (enemy.hp <= 0) killEnemy(state, enemy, projectile);

  const pierce = getEffect(projectile, "pierce");
  const canPierce = pierce && projectile.pierced < (pierce.count || 0);
  const explodeEffect = getEffect(projectile, "explode");

  // Explosive projectiles used to terminate before pierce could do real work.
  // That made combinations like SEEKER + PIERCE feel visual-only: the first
  // impact drew the green explosion, but the projectile never carried damage
  // through to the next target. Impact explosions now resolve immediately,
  // while the projectile may continue if pierce still has charges. Split/cluster
  // stay reserved for the final expire path, so rocket upgrades do not fan out
  // on every pierced enemy.
  if (explodeEffect && canPierce) {
    explode(state, projectile, explodeEffect);
    projectile.pierced += 1;
    projectile.targetId = null;
    return false;
  }

  if (explodeEffect) {
    fireExpireEffects(state, projectile);
    return true;
  }

  if (canPierce) {
    projectile.pierced += 1;
    projectile.targetId = null;
    return false;
  }
  return true;
}

function applyHoming(state, projectile, _weapon, dt) {
  const baseHoming = getEffect(projectile, "homing");
  const core = getEffect(projectile, "homingCore");
  if (!baseHoming && !core) return;
  const homing = {
    strength: (baseHoming?.strength || 0) + (core?.strength || 0),
    acquireRange: Math.max(baseHoming?.acquireRange || 0, core?.acquireRange || 0, 620)
  };
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

function handleWallOrEnd(state, projectile) {
  const outX = projectile.x < 0 || projectile.x > WORLD.w;
  const outY = projectile.y < 0 || projectile.y > WORLD.h;
  const out = outX || outY;
  const exhausted = projectile.life <= 0 || projectile.distance >= projectile.range;
  if (!out && !exhausted) return false;

  if (out) {
    const ricochet = getEffect(projectile, "ricochet");
    if (ricochet && projectile.ricocheted < (ricochet.count || 0)) {
      projectile.ricocheted += 1;
      projectile.x = clamp(projectile.x, 0, WORLD.w);
      projectile.y = clamp(projectile.y, 0, WORLD.h);
      if (outX) projectile.vx *= -1;
      if (outY) projectile.vy *= -1;
      projectile.targetId = null;
      projectile.hitIds = {};
      addSpark(state, projectile.x, projectile.y, 3, 150);
      return false;
    }
  }

  fireExpireEffects(state, projectile);
  return true;
}

export function updateProjectiles(state, dt) {
  tickEnemyStatusDamage(state, dt);
  rebuildEnemyGrid(state);

  for (const p of Object.values(state.projectiles)) {
    const weapon = WEAPONS[p.weaponId] || WEAPONS[START_WEAPON];
    const prevX = p.x;
    const prevY = p.y;

    applyHoming(state, p, weapon, dt);

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.distance += Math.hypot(p.x - prevX, p.y - prevY);

    let remove = false;
    const sweep = Math.hypot(p.x - prevX, p.y - prevY);
    const range = p.radius + sweep + 64;
    for (const e of enemyGrid.query(p.x, p.y, range)) {
      if (!state.enemies[e.id] || !canHit(p, e)) continue;
      const hitRadius = e.radius + p.radius + (weapon.hitPadding || 3);
      if (!segmentCircleHit(prevX, prevY, p.x, p.y, e.x, e.y, hitRadius)) continue;
      remove = applyProjectileHit(state, p, e);
      if (remove) break;
    }

    if (!remove) remove = handleWallOrEnd(state, p);
    if (remove) delete state.projectiles[p.id];
  }

  for (const fx of state.effects) fx.life -= dt;
  state.effects = state.effects.filter((fx) => fx.life > 0);
}

export function makeProjectile({ id, ownerId, weaponId, x, y, angle, pelletIndex = 0, effects = null }) {
  const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
  const dir = angleToVec(angle);
  const projectileEffects = Array.isArray(effects) ? effects.map((effect) => cloneEffect(effect)) : (weapon.effects || []).map((effect) => cloneEffect(effect));
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
    effects: projectileEffects,
    pelletIndex,
    pierced: 0,
    ricocheted: 0,
    exploded: false,
    expiredEffectsFired: false,
    targetId: null,
    hitIds: {},
    childDepth: 0
  };
}
