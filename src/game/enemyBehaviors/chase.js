import { applyEnemyTouchDamage, moveEnemyTowardTarget } from "./common.js";

export function updateChaseEnemy(ctx) {
  moveEnemyTowardTarget(ctx);
  applyEnemyTouchDamage(ctx.state, ctx.enemy, ctx.data, ctx.target, ctx.dt, ctx.updateCtx);
}
