import { norm } from "../../core/math.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget, moveEnemyWithVelocity } from "./common.js";

function runtime(enemy) {
  if (!enemy.prismState || typeof enemy.prismState !== "object") enemy.prismState = { facingX: 1, facingY: 0, pulseAt: 0 };
  return enemy.prismState;
}

export function updatePrismEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const rt = runtime(enemy);
  const d = norm(target.x - enemy.x, target.y - enemy.y);
  rt.facingX = d.x;
  rt.facingY = d.y;
  moveEnemyTowardTarget(ctx, { speedScale: 0.42 });
  enemy.vx *= Math.exp(-1.6 * dt);
  enemy.vy *= Math.exp(-1.6 * dt);
  moveEnemyWithVelocity(enemy, geometry, dt);
  if ((rt.pulseAt || 0) <= (state.time || 0)) {
    rt.pulseAt = (state.time || 0) + 0.36;
    pushVisualEffect(state, { type: "anomalyLine", x: Math.round(enemy.x), y: Math.round(enemy.y), x2: Math.round(enemy.x + d.x * 34), y2: Math.round(enemy.y + d.y * 34), color: "#ffffff", life: 0.1, maxLife: 0.1 });
  }
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
