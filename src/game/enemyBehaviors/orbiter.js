import { norm, dist2 } from "../../core/math.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyEnemyTouchDamage, enemySpeed, moveEnemyWithVelocity } from "./common.js";

function runtime(enemy, cfg, state) {
  if (!enemy.orbitState || typeof enemy.orbitState !== "object") {
    const roll = state?.rng?.next?.() ?? 0.5;
    enemy.orbitState = { angle: 0, radius: cfg.radius || 164, side: roll < 0.5 ? -1 : 1 };
  }
  return enemy.orbitState;
}

export function updateOrbiterEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = data.orbit || {};
  const rt = runtime(enemy, cfg, state);
  const dx = enemy.x - target.x;
  const dy = enemy.y - target.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  rt.radius = Math.max(cfg.minRadius || 58, (rt.radius || cfg.radius || 164) - (cfg.shrinkPerSecond || 10) * dt);
  const radial = norm(dx, dy);
  const tangent = { x: -radial.y * (rt.side || 1), y: radial.x * (rt.side || 1) };
  const radialError = d - rt.radius;
  const speed = enemySpeed(state, enemy, data, updateCtx);
  enemy.vx = tangent.x * speed + radial.x * (-radialError * 2.7);
  enemy.vy = tangent.y * speed + radial.y * (-radialError * 2.7);
  moveEnemyWithVelocity(enemy, geometry, dt);
  if (state.rng.next() < 5 * dt) pushVisualEffect(state, { type: "anomalyField", x: Math.round(target.x), y: Math.round(target.y), r: Math.round(rt.radius), color: "#ffffff", life: 0.08, maxLife: 0.08 });
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
