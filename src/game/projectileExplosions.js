import { GREEN } from "../core/constants.js";
import { dist2 } from "../core/math.js";
import { DAMAGE_TAGS, EFFECT_HOOKS, effectCommand, getEffect } from "./effects.js";
import { addSpark, pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import {
  createClusterExplosionRequests,
  createSplitProjectileChildren,
  resolveExplosionBehavior
} from "./projectileBehaviors.js";
import {
  addImpulse,
  dealProjectileDamage,
  finishProjectileEnemyKill,
  hitArmor,
  runProjectileHitEffects
} from "./projectileHits.js";

const CHILD_DEPTH_MAX = 2;

function queryEnemies(context, x, y, range) {
  return context.queryEnemies ? context.queryEnemies(x, y, range) : [];
}

export function explode(state, projectile, effect, x = projectile.x, y = projectile.y, context = {}) {
  const { radius, damage, force, life } = resolveExplosionBehavior(projectile, effect);

  for (const e of queryEnemies(context, x, y, radius + 80)) {
    if (!state.enemies[e.id]) continue;
    const r = radius + e.radius;
    const d2 = dist2(x, y, e.x, e.y);
    if (d2 > r * r) continue;
    const falloff = Math.max(0.35, 1 - Math.sqrt(d2) / Math.max(1, r));
    const explosionHit = dealProjectileDamage(state, projectile, e, damage * falloff, e.x, e.y, [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.EXPLOSION]);
    if (!hitArmor(explosionHit)) {
      runProjectileHitEffects(state, projectile, e, explosionHit, { x: e.x, y: e.y }, { spark: false, chain: false, status: true, hitShake: true }, context);
    }
    addImpulse(e, x, y, force * falloff);
    if (e.hp <= 0) finishProjectileEnemyKill(state, e, projectile, explosionHit.damage || explosionHit, context);
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

export function chainLightning(state, projectile, firstEnemy, effect, context = {}) {
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
    for (const e of queryEnemies(context, from.x, from.y, range)) {
      if (!state.enemies[e.id] || hit.has(e.id)) continue;
      const d = dist2(from.x, from.y, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    if (!best) break;
    hit.add(best.id);
    const chainHit = dealProjectileDamage(state, projectile, best, damage, best.x, best.y, [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.CHAIN]);
    const chainStatus = getEffect(projectile, "chainStatus");
    if (!hitArmor(chainHit)) {
      runProjectileHitEffects(state, projectile, best, chainHit, { x: best.x, y: best.y }, { spark: false, chain: false, status: !!chainStatus, hitShake: true }, context);
    }
    pushVisualEffect(state, {
      type: "chain",
      amount: Math.round(chainHit.damage?.armorHit ? chainHit.damage.armorDamage : chainHit.amount),
      x: Math.round(from.x),
      y: Math.round(from.y),
      x2: Math.round(best.x),
      y2: Math.round(best.y),
      life: 0.14,
      maxLife: 0.14,
      color: GREEN
    });
    if (best.hp <= 0) finishProjectileEnemyKill(state, best, projectile, chainHit.damage || chainHit, context);
    from = best;
    damage *= falloff;
  }
}

export function spawnSplitProjectiles(state, projectile, effect) {
  const depth = projectile.childDepth || 0;
  if (depth >= CHILD_DEPTH_MAX) return;
  for (const child of createSplitProjectileChildren(projectile, effect)) {
    state.projectiles[child.id] = child;
  }
}

export function spawnClusterExplosions(state, projectile, effect, context = {}) {
  for (const request of createClusterExplosionRequests(state, projectile, effect)) {
    explode(state, projectile, request.effect, request.x, request.y, context);
  }
}

export function projectileCommandHandlers(context = {}) {
  return {
    chainLightning(command, hookCtx) { chainLightning(hookCtx.state, hookCtx.projectile, hookCtx.enemy, command.effect, context); },
    explode(command, hookCtx) { explode(hookCtx.state, hookCtx.projectile, command.effect, command.x, command.y, context); },
    splitRockets(command, hookCtx) { spawnSplitProjectiles(hookCtx.state, hookCtx.projectile, command.effect); },
    clusterBomb(command, hookCtx) { spawnClusterExplosions(hookCtx.state, hookCtx.projectile, command.effect, context); }
  };
}

export function fireExpireEffects(state, projectile, context = {}) {
  if (projectile.expiredEffectsFired) return;
  projectile.expiredEffectsFired = true;

  context.runProjectileHook(state, projectile, EFFECT_HOOKS.PROJECTILE_EXPIRE, {
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
