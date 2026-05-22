import { dist2, segmentCircleHitT } from "../core/math.js";
import { SpatialGrid } from "../core/spatialGrid.js";
import { START_WEAPON, WEAPONS } from "../data/weapons.js";
import {
  EFFECT_HOOKS,
  createEffectContext,
  dealDamage,
  runEffectHook,
  sourceId,
  runEnemyStatusTickPipeline
} from "./effects.js";
import { statusDamageTags } from "./damageSourceMatrix.js";
import { addSpark, executeEffectCommands, pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { firstSolidWallHitInState } from "./roomGeometry.js";
import { updateHostileProjectile } from "./hostileProjectiles.js";
import { ROOM_MODIFIER_HOOKS, runRoomModifierHooks } from "./roomModifiers.js";
import { applyProjectileHomingBehavior } from "./projectileBehaviors.js";
import { applyProjectileHit, canHit, finishProjectileEnemyKill } from "./projectileHits.js";
import { explode, fireExpireEffects, projectileCommandHandlers } from "./projectileExplosions.js";
import { handleWallOrEnd } from "./projectileWallResolution.js";

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

function projectilePipelineContext() {
  const context = {
    runProjectileHook,
    queryEnemies(x, y, range) {
      return enemyGrid.query(x, y, range);
    }
  };
  context.explode = (state, projectile, effect, x, y) => explode(state, projectile, effect, x, y, context);
  context.fireExpireEffects = (state, projectile) => fireExpireEffects(state, projectile, context);
  return context;
}

function runProjectileHook(state, projectile, hook, context, effectHandlers = {}, commandHandlers = projectileCommandHandlers(projectilePipelineContext())) {
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
    const statusTicks = tick.ticks?.length ? tick.ticks : (tick.damage > 0 ? [{ damage: tick.damage, sourceId: tick.sources?.[0] || null, tags: statusDamageTags() }] : []);

    for (const statusHit of statusTicks) {
      if (!state.enemies[enemy.id] || !(statusHit.damage > 0)) continue;
      const damage = dealDamage(state, enemy, {
        amount: statusHit.damage,
        sourceId: statusHit.sourceId || null,
        tags: statusHit.tags || statusDamageTags()
      });
      if (damage.killed) {
        finishProjectileEnemyKill(state, enemy, statusHit.sourceId || null, damage, projectilePipelineContext());
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
        color: tick.sources?.length ? "#00ff66" : "#ffffff",
        life: 0.16,
        maxLife: 0.16
      });
    }
  }
}

function moveProjectileWithRoomHooks(state, projectile, dt, tags = ["projectile", "update"]) {
  const prevX = projectile.x;
  const prevY = projectile.y;
  const updateCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.PROJECTILE_UPDATE, {
    projectile,
    weaponId: projectile.weaponId || null,
    ownerType: projectile.ownerType || "player",
    dt,
    speedMult: 1,
    tags
  });
  const speedMult = Math.max(0.05, updateCtx.speedMult || 1);
  projectile.x += projectile.vx * dt * speedMult;
  projectile.y += projectile.vy * dt * speedMult;
  projectile.life -= dt;
  projectile.distance = (projectile.distance || 0) + Math.hypot(projectile.x - prevX, projectile.y - prevY);
  return { prevX, prevY, speedMult };
}

function applyHoming(state, projectile, _weapon, dt) {
  return applyProjectileHomingBehavior({ state, projectile, dt, nearestEnemy, runProjectileHook });
}

export function updateProjectiles(state, dt) {
  tickEnemyStatusDamage(state, dt);
  rebuildEnemyGrid(state);

  for (const p of Object.values(state.projectiles)) {
    const pipeline = projectilePipelineContext();

    if (p.hostile || p.ownerType === "enemy") {
      updateHostileProjectile(state, p, dt, {
        moveProjectileWithRoomHooks,
        handleWallOrEnd: (hostileState, hostileProjectile, wallHit) => handleWallOrEnd(hostileState, hostileProjectile, wallHit, pipeline)
      });
      continue;
    }

    const weapon = WEAPONS[p.weaponId] || WEAPONS[START_WEAPON];
    const prevX = p.x;
    const prevY = p.y;

    applyHoming(state, p, weapon, dt);

    moveProjectileWithRoomHooks(state, p, dt, ["projectile", "update", "player"]);
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
      remove = applyProjectileHit(state, p, e, pipeline);
      if (remove) break;
    }

    if (!remove) remove = handleWallOrEnd(state, p, wallHit, pipeline);
    if (remove) delete state.projectiles[p.id];
  }

  for (const fx of state.effects) fx.life -= dt;
  state.effects = state.effects.filter((fx) => fx.life > 0);
}

export { makeProjectile, makeEnemyProjectile } from "./projectileFactories.js";
