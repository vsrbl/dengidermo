import { dist2, norm } from "../../core/math.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget } from "./common.js";

function runtime(enemy) {
  if (!enemy.anchorState || typeof enemy.anchorState !== "object") enemy.anchorState = { pulseAt: 0 };
  return enemy.anchorState;
}

function slowProjectiles(state, enemy, cfg, dt) {
  const r = cfg.fieldRadius || 150;
  for (const p of Object.values(state.projectiles || {})) {
    if (!p || p.hostile || p.ownerType === "enemy") continue;
    if (dist2(enemy.x, enemy.y, p.x, p.y) > r * r) continue;
    const slow = Math.pow(cfg.projectileSlow || 0.72, dt * 8);
    p.vx *= slow;
    p.vy *= slow;
  }
}

function pullPickups(state, enemy, cfg, dt) {
  const r = cfg.fieldRadius || 150;
  const pull = cfg.pickupPull || 42;
  for (const bag of [state.economyPickups || {}, state.rewardPickups || {}]) {
    for (const item of Object.values(bag)) {
      if (!item || dist2(enemy.x, enemy.y, item.x, item.y) > r * r) continue;
      const d = norm(enemy.x - item.x, enemy.y - item.y);
      item.x += d.x * pull * dt;
      item.y += d.y * pull * dt;
    }
  }
}

export function updateAnchorEnemy(ctx) {
  const { state, enemy, data, target, dt, updateCtx } = ctx;
  const cfg = data.anchor || {};
  const rt = runtime(enemy);
  slowProjectiles(state, enemy, cfg, dt);
  pullPickups(state, enemy, cfg, dt);
  if ((rt.pulseAt || 0) <= (state.time || 0)) {
    rt.pulseAt = (state.time || 0) + (cfg.pulseEvery || 0.32);
    pushVisualEffect(state, { type: "anomalyField", x: Math.round(enemy.x), y: Math.round(enemy.y), r: cfg.fieldRadius || 150, color: "#ffffff", text: "ANC", life: 0.18, maxLife: 0.18 });
  }
  moveEnemyTowardTarget(ctx, { speedScale: 0.42 });
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
