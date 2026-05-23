import { dist2 } from "../../core/math.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget } from "./common.js";

function runtime(enemy) {
  if (!enemy.nullState || typeof enemy.nullState !== "object") enemy.nullState = { pulseAt: 0 };
  return enemy.nullState;
}

function applyNullField(state, enemy, cfg, dt) {
  const r = cfg.fieldRadius || 132;
  for (const player of Object.values(state.players || {})) {
    if (!player || player.hp <= 0) continue;
    if (dist2(enemy.x, enemy.y, player.x, player.y) > (r + player.radius) ** 2) continue;
    player.vx *= Math.pow(cfg.drag || 0.72, dt * 7);
    player.vy *= Math.pow(cfg.drag || 0.72, dt * 7);
    player.nullifiedUntil = Math.max(player.nullifiedUntil || 0, (state.time || 0) + 0.18);
  }
}

export function updateNullifierEnemy(ctx) {
  const { state, enemy, data, target, dt, updateCtx } = ctx;
  const cfg = data.nullifier || {};
  const rt = runtime(enemy);
  applyNullField(state, enemy, cfg, dt);
  if ((rt.pulseAt || 0) <= (state.time || 0)) {
    rt.pulseAt = (state.time || 0) + (cfg.pulseEvery || 0.28);
    pushVisualEffect(state, { type: "anomalyField", x: Math.round(enemy.x), y: Math.round(enemy.y), r: cfg.fieldRadius || 132, color: "#b45cff", text: "NUL", life: 0.18, maxLife: 0.18 });
  }
  moveEnemyTowardTarget(ctx, { speedScale: 0.48 });
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
