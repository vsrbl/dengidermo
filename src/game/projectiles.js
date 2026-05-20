import { WORLD, GREEN } from "../core/constants.js";
import { angleToVec, dist2, norm, segmentCircleHitT } from "../core/math.js";
import { SpatialGrid } from "../core/spatialGrid.js";
import { START_WEAPON, WEAPONS } from "../data/weapons.js";
import {
  DAMAGE_TAGS,
  EFFECT_HOOKS,
  cloneEffect,
  createEffectContext,
  dealDamage,
  effectCommand,
  getEffect,
  healProjectileOwner,
  resolveProjectileDamage,
  runEffectHook,
  sourceId,
  runEnemyStatusTickPipeline
} from "./effects.js";
import { addSpark, executeEffectCommands, pushVisualEffect } from "./effectCommands.js";
import { finishEnemyKill } from "./enemyDeath.js";
import { pushEvent } from "./events.js";
import { firstSolidWallHitInState } from "./roomGeometry.js";
import { ROOM_MODIFIER_HOOKS, runRoomModifierHooks } from "./roomModifiers.js";
import {
  applyProjectileHomingBehavior,
  applyProjectileWallPosition,
  createClusterExplosionRequests,
  createSplitProjectileChildren,
  resolveExplosionBehavior,
  resolveProjectileWallEnd,
  resolveRicochetCommands
} from "./projectileBehaviors.js";

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

function killEnemy(state, enemy, source = null, hit = null) {
  if (!state.enemies[enemy.id]) return;

  // v36: projectile on-kill hooks run before the shared enemy finalizer.
  // ARCHITECTURE GUARD: do not delete enemies directly here; finishEnemyKill()
  // owns drop/score/event cleanup so companions and future systems stay aligned.
  if (source && typeof source === "object") {
    runProjectileHook(state, source, EFFECT_HOOKS.PROJECTILE_KILL, {
      enemy,
      target: enemy,
      hit,
      position: { x: enemy.x, y: enemy.y },
      tags: hit?.tags || []
    }, {
      spark(effect, c) {
        return effectCommand("spark", { x: c.position.x, y: c.position.y, amount: effect.count ?? 4, power: 145 });
      },
      hitShake(effect, c) {
        return effectCommand("shake", { power: effect.power || 2.5, life: effect.life || 0.12 });
      }
    });
  }

  finishEnemyKill(state, enemy, source, hit);
}

function addImpulse(enemy, fromX, fromY, force) {
  const d = norm(enemy.x - fromX, enemy.y - fromY);
  enemy.kx = (enemy.kx || 0) + d.x * force;
  enemy.ky = (enemy.ky || 0) + d.y * force;
}

function statusColor(type) {
  if (type === "freeze") return "#ffffff";
  if (type === "poison") return GREEN;
  return "#ff3048";
}

function addDamageText(state, x, y, amount, critical = false) {
  pushVisualEffect(state, {
    type: "damageText",
    x: Math.round(x),
    y: Math.round(y - (critical ? 18 : 12)),
    vy: critical ? -34 : -24,
    text: `${critical ? "!" : ""}${Math.max(1, Math.round(amount))}`,
    color: critical ? GREEN : "#ffffff",
    life: critical ? 0.42 : 0.3,
    maxLife: critical ? 0.42 : 0.3
  });
}

function addStatusBurst(state, x, y, applied) {
  for (const item of applied || []) {
    const color = statusColor(item.type);
    pushVisualEffect(state, {
      type: "statusBurst",
      status: item.type,
      x: Math.round(x),
      y: Math.round(y),
      r: item.type === "freeze" ? 34 : 26,
      color,
      life: 0.22,
      maxLife: 0.22
    });
    addSpark(state, x, y, item.type === "freeze" ? 3 : 2, item.type === "burn" ? 150 : 115, color);
  }
}



function projectileCommandHandlers() {
  return {
    chainLightning(command, ctx) { chainLightning(ctx.state, ctx.projectile, ctx.enemy, command.effect); },
    explode(command, ctx) { explode(ctx.state, ctx.projectile, command.effect, command.x, command.y); },
    splitRockets(command, ctx) { spawnSplitProjectiles(ctx.state, ctx.projectile, command.effect); },
    clusterBomb(command, ctx) { spawnClusterExplosions(ctx.state, ctx.projectile, command.effect); }
  };
}

function runProjectileHook(state, projectile, hook, context, effectHandlers = {}, commandHandlers = projectileCommandHandlers()) {
  const ctx = createEffectContext({
    state,
    projectile,
    sourceId: sourceId(projectile),
    weaponId: projectile?.weaponId || null,
    rng: state.rng,
    ...context
  });
  runEffectHook(projectile, hook, ctx, effectHandlers);
  executeEffectCommands(state, ctx.commands, ctx, commandHandlers);
  return ctx;
}

function tickEnemyStatusDamage(state, dt) {
  for (const enemy of Object.values(state.enemies)) {
    const tick = runEnemyStatusTickPipeline(state, enemy, dt);
    const statusTicks = tick.ticks?.length ? tick.ticks : (tick.damage > 0 ? [{ damage: tick.damage, sourceId: tick.sources?.[0] || null, tags: [DAMAGE_TAGS.STATUS] }] : []);

    for (const statusHit of statusTicks) {
      if (!state.enemies[enemy.id] || !(statusHit.damage > 0)) continue;
      const damage = dealDamage(state, enemy, {
        amount: statusHit.damage,
        sourceId: statusHit.sourceId || null,
        tags: statusHit.tags || [DAMAGE_TAGS.STATUS]
      });
      if (damage.killed) {
        killEnemy(state, enemy, statusHit.sourceId || null, damage);
        break;
      }
    }

    if (!state.enemies[enemy.id]) continue;
    if (tick.active && state.rng.next() < 5 * dt) addSpark(state, enemy.x, enemy.y, 1, 80);
    if (tick.active && state.rng.next() < 2.2 * dt) {
      pushVisualEffect(state, {
        type: "statusTick",
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        r: 18 + Math.min(16, tick.damage * 1.5),
        color: tick.sources?.length ? GREEN : "#ffffff",
        life: 0.16,
        maxLife: 0.16
      });
    }
  }
}

function dealProjectileDamage(state, projectile, enemy, baseDamage, eventX = enemy.x, eventY = enemy.y, tags = [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.DIRECT]) {
  const hit = resolveProjectileDamage(state, projectile, baseDamage, enemy, tags);
  const damage = dealDamage(state, enemy, {
    amount: hit.amount,
    sourceId: projectile.ownerId,
    weaponId: projectile.weaponId,
    projectileId: projectile.id,
    tags: hit.tags
  });
  healProjectileOwner(state, projectile, damage.done, hit.tags);
  pushEvent(state, { type: "hit", x: eventX, y: eventY, amount: hit.amount, crit: hit.critical, sourceId: projectile.ownerId, tags: hit.tags });
  addDamageText(state, eventX, eventY, hit.amount, hit.critical);
  if (hit.critical) {
    addSpark(state, eventX, eventY, 5, 190);
    pushVisualEffect(state, { type: "critFlash", x: Math.round(eventX), y: Math.round(eventY), r: 30, life: 0.18, maxLife: 0.18, color: GREEN });
  }
  hit.damage = damage;
  return hit;
}

function runProjectileHitEffects(state, projectile, enemy, hit, position, options = {}) {
  const handlers = {};

  if (options.hitShake !== false) {
    handlers.hitShake = (effect, c) => effectCommand("shake", {
      power: (effect.power || 2.5) * (c.hit?.critical ? 1.25 : 1),
      life: effect.life || 0.12
    });
  }

  if (options.spark !== false) {
    handlers.spark = (effect, c) => {
      const fallback = c.projectile.kind === "bullet" ? 2 : 4;
      const amount = c.hit?.critical ? Math.max(6, (effect.count ?? fallback) + 3) : (effect.count ?? fallback);
      return effectCommand("spark", { x: c.position.x, y: c.position.y, amount, power: c.hit?.critical ? 210 : 120 });
    };
  }

  if (options.chain !== false) {
    handlers.chainLightning = (effect) => effectCommand("chainLightning", { effect });
  }

  if (options.status !== false) {
    handlers.burn = (effect, c) => effectCommand("status", { status: "burn", target: c.enemy, effect, source: c.projectile });
    handlers.poison = (effect, c) => effectCommand("status", { status: "poison", target: c.enemy, effect, source: c.projectile });
    handlers.freeze = (effect, c) => effectCommand("status", { status: "freeze", target: c.enemy, effect, source: c.projectile });
  }

  const ctx = runProjectileHook(state, projectile, EFFECT_HOOKS.PROJECTILE_HIT, {
    enemy,
    target: enemy,
    hit,
    damage: hit.damage,
    position,
    tags: hit.tags || []
  }, handlers);

  if (ctx.appliedStatuses?.length) addStatusBurst(state, position.x, position.y, ctx.appliedStatuses);
  hit.commands = [...(hit.commands || []), ...ctx.commands];
  return ctx;
}

function explode(state, projectile, effect, x = projectile.x, y = projectile.y) {
  const { radius, damage, force, life } = resolveExplosionBehavior(projectile, effect);

  for (const e of enemyGrid.query(x, y, radius + 80)) {
    if (!state.enemies[e.id]) continue;
    const r = radius + e.radius;
    const d2 = dist2(x, y, e.x, e.y);
    if (d2 > r * r) continue;
    const falloff = Math.max(0.35, 1 - Math.sqrt(d2) / Math.max(1, r));
    const explosionHit = dealProjectileDamage(state, projectile, e, damage * falloff, e.x, e.y, [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.EXPLOSION]);
    runProjectileHitEffects(state, projectile, e, explosionHit, { x: e.x, y: e.y }, { spark: false, chain: false, status: true, hitShake: true });
    addImpulse(e, x, y, force * falloff);
    if (e.hp <= 0) killEnemy(state, e, projectile, explosionHit.damage || explosionHit);
  }

  pushVisualEffect(state, {
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
    const chainHit = dealProjectileDamage(state, projectile, best, damage, best.x, best.y, [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.CHAIN]);
    const chainStatus = getEffect(projectile, "chainStatus");
    runProjectileHitEffects(state, projectile, best, chainHit, { x: best.x, y: best.y }, { spark: false, chain: false, status: !!chainStatus, hitShake: true });
    pushVisualEffect(state, {
      type: "chain",
      amount: Math.round(chainHit.amount),
      x: Math.round(from.x),
      y: Math.round(from.y),
      x2: Math.round(best.x),
      y2: Math.round(best.y),
      life: 0.14,
      maxLife: 0.14,
      color: GREEN
    });
    if (best.hp <= 0) killEnemy(state, best, projectile, chainHit.damage || chainHit);
    from = best;
    damage *= falloff;
  }
}

function spawnSplitProjectiles(state, projectile, effect) {
  const depth = projectile.childDepth || 0;
  if (depth >= CHILD_DEPTH_MAX) return;
  for (const child of createSplitProjectileChildren(projectile, effect)) {
    state.projectiles[child.id] = child;
  }
}

function spawnClusterExplosions(state, projectile, effect) {
  for (const request of createClusterExplosionRequests(state, projectile, effect)) {
    explode(state, projectile, request.effect, request.x, request.y);
  }
}

function fireExpireEffects(state, projectile) {
  if (projectile.expiredEffectsFired) return;
  projectile.expiredEffectsFired = true;

  runProjectileHook(state, projectile, EFFECT_HOOKS.PROJECTILE_EXPIRE, {
    position: { x: projectile.x, y: projectile.y }
  }, {
    explode(effect, c) {
      if (c.projectile.exploded) return null;
      c.projectile.exploded = true;
      return effectCommand("explode", { effect });
    },
    splitRockets(effect) {
      return effectCommand("splitRockets", { effect });
    },
    clusterBomb(effect) {
      return effectCommand("clusterBomb", { effect });
    },
    screenShake(effect) {
      if (!(effect.power > 0)) return null;
      return effectCommand("shake", { power: Math.min(12, effect.power), life: effect.life || 0.22 });
    }
  });
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
  runProjectileHitEffects(state, projectile, enemy, hit, { x: enemy.x, y: enemy.y }, { spark: true, chain: true, status: true, hitShake: true });
  addImpulse(enemy, projectile.x, projectile.y, (weapon.knockback || 120) * (projectile.knockbackMult || 1));

  if (enemy.hp <= 0) killEnemy(state, enemy, projectile, hit.damage || hit);

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
  return applyProjectileHomingBehavior({ state, projectile, dt, nearestEnemy, runProjectileHook });
}

function handleWallOrEnd(state, projectile, wallHit = null) {
  const wallState = resolveProjectileWallEnd(projectile, wallHit, WORLD);
  if (!wallState.shouldEnd) return false;

  if (wallState.out || wallState.hitWall) {
    applyProjectileWallPosition(projectile, wallState);
    const ctx = runProjectileHook(state, projectile, EFFECT_HOOKS.PROJECTILE_WALL, {
      position: wallState.position,
      normal: wallState.normal,
      wallId: wallHit?.wall?.id || null,
      outX: wallState.hookOutX,
      outY: wallState.hookOutY,
      didRicochet: false
    }, {
      ricochet(effect, c) {
        return resolveRicochetCommands(effect, c);
      }
    });

    if (ctx.didRicochet) return false;
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

    const updateCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.PROJECTILE_UPDATE, {
      projectile: p,
      weaponId: p.weaponId,
      dt,
      speedMult: 1,
      tags: ["projectile", "update"]
    });
    const speedMult = Math.max(0.05, updateCtx.speedMult || 1);

    p.x += p.vx * dt * speedMult;
    p.y += p.vy * dt * speedMult;
    p.life -= dt;
    p.distance += Math.hypot(p.x - prevX, p.y - prevY);
    const wallHit = firstSolidWallHitInState(state, prevX, prevY, p.x, p.y, p.radius || 0);

    let remove = false;
    const sweep = Math.hypot(p.x - prevX, p.y - prevY);
    const range = p.radius + sweep + 64;
    for (const e of enemyGrid.query(p.x, p.y, range)) {
      if (!state.enemies[e.id] || !canHit(p, e)) continue;
      const hitRadius = e.radius + p.radius + (weapon.hitPadding || 3);
      const hitT = segmentCircleHitT(prevX, prevY, p.x, p.y, e.x, e.y, hitRadius);
      if (hitT === null) continue;
      if (wallHit && wallHit.t <= hitT) continue;
      remove = applyProjectileHit(state, p, e);
      if (remove) break;
    }

    if (!remove) remove = handleWallOrEnd(state, p, wallHit);
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
