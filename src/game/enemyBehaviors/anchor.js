import { dist2, norm } from "../../core/math.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget } from "./common.js";

function runtime(enemy) {
  if (!enemy.anchorState || typeof enemy.anchorState !== "object") enemy.anchorState = { pulseAt: 0 };
  return enemy.anchorState;
}

function slowProjectiles(state, enemy, cfg, dt) {
  const r = cfg.fieldRadius || 188;
  for (const p of Object.values(state.projectiles || {})) {
    if (!p || p.hostile || p.ownerType === "enemy") continue;
    if (dist2(enemy.x, enemy.y, p.x, p.y) > r * r) continue;
    const slow = Math.pow(cfg.projectileSlow || 0.18, dt * 8);
    p.vx *= slow;
    p.vy *= slow;
    p.anchorDragUntil = Math.max(p.anchorDragUntil || 0, (state.time || 0) + 0.12);
  }
}

function destroyPickup(state, bag, id, item, enemy) {
  delete bag[id];
  pushVisualEffect(state, {
    type: "rewardRevealPulse",
    x: Math.round(item.x),
    y: Math.round(item.y),
    r: 24,
    color: "#777777",
    mode: "anchor_consume",
    life: 0.22,
    maxLife: 0.22
  });
  pushVisualEffect(state, {
    type: "anomalyLine",
    x: Math.round(item.x),
    y: Math.round(item.y),
    x2: Math.round(enemy.x),
    y2: Math.round(enemy.y),
    color: "#777777",
    life: 0.1,
    maxLife: 0.1
  });
}

function pullPickups(state, enemy, cfg, dt) {
  const r = cfg.fieldRadius || 188;
  const pull = cfg.pickupPull || 340;
  const destroyR = cfg.pickupDestroyRadius || 20;
  for (const bag of [state.economyPickups || {}, state.rewardPickups || {}]) {
    for (const [id, item] of Object.entries(bag)) {
      if (!item || item.claimed) continue;
      if (dist2(enemy.x, enemy.y, item.x, item.y) > r * r) continue;
      const d = norm(enemy.x - item.x, enemy.y - item.y);
      item.x += d.x * pull * dt;
      item.y += d.y * pull * dt;
      item.anchorPulledUntil = Math.max(item.anchorPulledUntil || 0, (state.time || 0) + 0.18);
      if (dist2(enemy.x, enemy.y, item.x, item.y) <= destroyR * destroyR) destroyPickup(state, bag, id, item, enemy);
    }
  }
}

function slowPlayers(state, enemy, cfg, dt) {
  const r = cfg.fieldRadius || 188;
  for (const player of Object.values(state.players || {})) {
    if (!player || player.hp <= 0) continue;
    if (dist2(enemy.x, enemy.y, player.x, player.y) > (r + player.radius) ** 2) continue;
    const drag = Math.pow(cfg.playerDrag || 0.35, dt * 8);
    player.vx *= drag;
    player.vy *= drag;
    player.anchorSnaredUntil = Math.max(player.anchorSnaredUntil || 0, (state.time || 0) + 0.18);
  }
}

export function updateAnchorEnemy(ctx) {
  const { state, enemy, data, target, dt, updateCtx } = ctx;
  const cfg = data.anchor || {};
  const rt = runtime(enemy);
  slowProjectiles(state, enemy, cfg, dt);
  pullPickups(state, enemy, cfg, dt);
  slowPlayers(state, enemy, cfg, dt);
  if ((rt.pulseAt || 0) <= (state.time || 0)) {
    rt.pulseAt = (state.time || 0) + (cfg.pulseEvery || 0.42);
    pushVisualEffect(state, { type: "anomalyField", x: Math.round(enemy.x), y: Math.round(enemy.y), r: cfg.fieldRadius || 188, color: "#ffffff", life: 0.34, maxLife: 0.34 });
  }
  moveEnemyTowardTarget(ctx, { speedScale: 0.32 });
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
