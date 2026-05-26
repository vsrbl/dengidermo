import { GREEN, WORLD } from "../core/constants.js";
import { angleToVec, clamp, norm } from "../core/math.js";
import { EFFECT_HOOKS, cloneEffect, effectCommand } from "./effects.js";
import { nextId } from "./entityIds.js";

export function applyProjectileHomingBehavior({ state, projectile, dt, nearestEnemy, runProjectileHook }) {
  const ctx = runProjectileHook(state, projectile, EFFECT_HOOKS.PROJECTILE_UPDATE, {
    dt,
    homing: { strength: 0, acquireRange: 0 }
  }, {
    homing(effect, c) {
      c.homing.strength += effect.strength || 0;
      c.homing.acquireRange = Math.max(c.homing.acquireRange || 0, effect.acquireRange || 0);
    },
    homingCore(effect, c) {
      c.homing.strength += effect.strength || 0;
      c.homing.acquireRange = Math.max(c.homing.acquireRange || 0, effect.acquireRange || 0);
    }
  });

  const homing = ctx.homing;
  if (!(homing.strength > 0 || homing.acquireRange > 0)) return false;
  homing.acquireRange = Math.max(homing.acquireRange || 0, 620);
  const target = nearestEnemy(state, projectile, homing.acquireRange || 620);
  if (!target) return false;

  const desired = norm(target.x - projectile.x, target.y - projectile.y);
  const current = norm(projectile.vx, projectile.vy);
  const strength = (homing.strength || 8) * dt;
  const nx = current.x + (desired.x - current.x) * clamp(strength, 0, 1);
  const ny = current.y + (desired.y - current.y) * clamp(strength, 0, 1);
  const nd = norm(nx, ny);
  projectile.vx = nd.x * projectile.speed;
  projectile.vy = nd.y * projectile.speed;
  return true;
}

export function resolveExplosionBehavior(projectile, effect = {}) {
  const radius = (effect.radius || 80) * (projectile.explosionRadiusMult || 1);
  const damage = (effect.damage || projectile.damage) * (projectile.explosionDamageMult || 1);
  const force = (effect.force || 220) * (projectile.knockbackMult || 1);
  const life = effect.visual === "large" ? 0.36 : 0.24;
  return { radius, damage, force, life };
}

export function createSplitProjectileChildren(projectile, effect = {}) {
  const depth = projectile.childDepth || 0;
  const count = Math.max(0, Math.min(12, Math.floor(effect.count || 0)));
  if (!count) return [];

  const baseAngle = Math.atan2(projectile.vy || 0, projectile.vx || 1);
  const spread = effect.spread ?? Math.PI * 0.92;
  const speed = effect.speed || projectile.speed * 0.82;
  const damage = effect.damage || projectile.damage * 0.45;
  const childEffects = (projectile.effects || [])
    .filter((e) => e.type !== "splitRockets")
    .map((e) => cloneEffect(e));

  const children = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const angle = baseAngle - spread / 2 + spread * t;
    const dir = angleToVec(angle);
    const id = nextId("pr");
    children.push({
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
    });
  }
  return children;
}

export function createClusterExplosionRequests(state, projectile, effect = {}) {
  const count = Math.max(0, Math.min(16, Math.floor(effect.count || 0)));
  if (!count) return [];

  const radius = effect.radius || 46;
  const damage = effect.damage || projectile.damage * 0.42;
  const requests = [];
  for (let i = 0; i < count; i += 1) {
    const a = state.rng.range(0, Math.PI * 2);
    const d = state.rng.range(18, effect.spread || 120);
    requests.push({
      x: projectile.x + Math.cos(a) * d,
      y: projectile.y + Math.sin(a) * d,
      effect: { type: "explode", radius, damage, force: effect.force || 110, visual: "small" }
    });
  }
  return requests;
}

export function resolveProjectileWallEnd(projectile, wallHit = null, world = WORLD) {
  const outX = projectile.x < 0 || projectile.x > world.w;
  const outY = projectile.y < 0 || projectile.y > world.h;
  const out = outX || outY;
  const hitWall = !!wallHit;
  const exhausted = projectile.life <= 0 || projectile.distance >= projectile.range;
  if (!out && !hitWall && !exhausted) return { shouldEnd: false, outX, outY, out, hitWall, exhausted };

  const normal = hitWall
    ? wallHit.normal
    : { x: outX ? -Math.sign(projectile.vx || 1) : 0, y: outY ? -Math.sign(projectile.vy || 1) : 0 };
  const position = hitWall
    ? { x: wallHit.x, y: wallHit.y }
    : { x: clamp(projectile.x, 0, world.w), y: clamp(projectile.y, 0, world.h) };

  return {
    shouldEnd: true,
    outX,
    outY,
    out,
    hitWall,
    exhausted,
    normal,
    position,
    hookOutX: hitWall ? Math.abs(normal.x) > 0 : outX,
    hookOutY: hitWall ? Math.abs(normal.y) > 0 : outY
  };
}

export function applyProjectileWallPosition(projectile, wallState) {
  if (!wallState?.hitWall || !wallState.position) return false;
  projectile.x = wallState.position.x;
  projectile.y = wallState.position.y;
  return true;
}

export function resolveRicochetCommands(effect, c) {
  const count = Math.max(0, Math.floor(effect.count || 0));
  if (c.projectile.ricocheted >= count) return null;
  c.projectile.ricocheted += 1;
  c.projectile.x = c.position.x + (c.normal?.x || 0) * 0.5;
  c.projectile.y = c.position.y + (c.normal?.y || 0) * 0.5;
  if (c.outX) c.projectile.vx *= -1;
  if (c.outY) c.projectile.vy *= -1;
  c.projectile.targetId = null;
  c.projectile.hitIds = {};
  c.didRicochet = true;
  return [
    effectCommand("spark", { x: c.projectile.x, y: c.projectile.y, amount: 5, power: 165 }),
    effectCommand("visual", {
      event: {
        type: "ricochet",
        x: Math.round(c.projectile.x),
        y: Math.round(c.projectile.y),
        vx: Math.round(c.projectile.vx),
        vy: Math.round(c.projectile.vy),
        life: 0.16,
        maxLife: 0.16,
        color: GREEN
      }
    }),
    effectCommand("shake", { power: 2.2, life: 0.09, source: "ricochet" })
  ];
}

export const PROJECTILE_BEHAVIOR_HELPERS = Object.freeze({
  homing: applyProjectileHomingBehavior,
  wall: resolveProjectileWallEnd,
  explosion: resolveExplosionBehavior,
  split: createSplitProjectileChildren,
  cluster: createClusterExplosionRequests,
  ricochet: resolveRicochetCommands
});
