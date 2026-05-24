import { norm } from "../../core/math.js";
import { firstSolidWallHitInLocation } from "../roomGeometry.js";
import { pushVisualEffect } from "../effectCommands.js";
import { devEnemyDamageMult, devEnemySpeedMult } from "../dev.js";
import { nextId } from "../entityIds.js";
import { makeEnemyProjectile } from "../projectileFactories.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget, moveEnemyWithVelocity } from "./common.js";

function rangedRuntime(enemy, data) {
  if (!enemy.rangedState || typeof enemy.rangedState !== "object") {
    enemy.rangedState = { cooldown: data.ranged?.firstShotDelay ?? 0.35 };
  }
  return enemy.rangedState;
}

function rangedConfig(data) {
  const cfg = data.ranged || {};
  return {
    acquireRange: cfg.acquireRange || 620,
    preferredRange: cfg.preferredRange || 360,
    retreatRange: cfg.retreatRange || 230,
    cooldown: cfg.cooldown || 1.15,
    projectileSpeed: cfg.projectileSpeed || 430,
    projectileDamage: cfg.projectileDamage || data.damage,
    projectileRadius: cfg.projectileRadius || 5,
    projectileRange: cfg.projectileRange || 740,
    knockback: cfg.knockback || 120,
    muzzleLife: cfg.muzzleLife || 0.1
  };
}

function hasLineOfFire(geometry, enemy, target, cfg) {
  return !firstSolidWallHitInLocation(geometry, enemy.x, enemy.y, target.x, target.y, cfg.projectileRadius || 0);
}

function fireRangedProjectile(state, enemy, target, cfg, updateCtx) {
  const dir = norm(target.x - enemy.x, target.y - enemy.y);
  const x = enemy.x + dir.x * (enemy.radius + cfg.projectileRadius + 3);
  const y = enemy.y + dir.y * (enemy.radius + cfg.projectileRadius + 3);
  const id = nextId("ep");
  state.projectiles[id] = makeEnemyProjectile({
    id,
    enemyId: enemy.id,
    x,
    y,
    angle: Math.atan2(dir.y, dir.x),
    speed: cfg.projectileSpeed * Math.max(0.05, updateCtx.speedMult || 1) * devEnemySpeedMult(state),
    damage: cfg.projectileDamage * Math.max(0, updateCtx.damageMult || 1) * devEnemyDamageMult(state),
    radius: cfg.projectileRadius,
    range: cfg.projectileRange,
    knockback: cfg.knockback,
    color: "red"
  });
  pushVisualEffect(state, {
    type: "enemyMuzzle",
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    x2: Math.round(x + dir.x * 28),
    y2: Math.round(y + dir.y * 28),
    color: "#ff3048",
    life: cfg.muzzleLife,
    maxLife: cfg.muzzleLife
  });
}

export function updateRangedEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = rangedConfig(data);
  const runtime = rangedRuntime(enemy, data);
  runtime.cooldown = Math.max(0, (runtime.cooldown || 0) - dt);

  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;

  if (distance < cfg.retreatRange) {
    moveEnemyTowardTarget(ctx, { speedScale: -0.55 });
  } else if (distance > cfg.preferredRange) {
    moveEnemyTowardTarget(ctx, { speedScale: 0.66 });
  } else {
    enemy.vx *= Math.exp(-6 * dt);
    enemy.vy *= Math.exp(-6 * dt);
    moveEnemyWithVelocity(enemy, geometry, dt);
  }

  if (distance <= cfg.acquireRange && runtime.cooldown <= 0 && hasLineOfFire(geometry, enemy, target, cfg)) {
    fireRangedProjectile(state, enemy, target, cfg, updateCtx);
    runtime.cooldown = cfg.cooldown * (0.92 + (state.rng?.next?.() || 0.5) * 0.16);
  }

  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
