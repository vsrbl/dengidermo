import { norm } from "../../core/math.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyEnemyTouchDamage, enemySpeed, moveEnemyWithVelocity } from "./common.js";

function runtime(enemy, cfg, state) {
  if (!enemy.orbitState || typeof enemy.orbitState !== "object") {
    const roll = state?.rng?.next?.() ?? 0.5;
    enemy.orbitState = { radius: cfg.radius || 176, side: roll < 0.5 ? -1 : 1, pulseAt: 0 };
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
  rt.radius = Math.max(cfg.minRadius || 50, (rt.radius || cfg.radius || 176) - (cfg.shrinkPerSecond || 14) * dt);
  const fromTarget = norm(dx, dy);
  const toTarget = { x: -fromTarget.x, y: -fromTarget.y };
  enemy.projectileDefenseFacingX = toTarget.x;
  enemy.projectileDefenseFacingY = toTarget.y;
  const tangent = { x: -fromTarget.y * (rt.side || 1), y: fromTarget.x * (rt.side || 1) };
  const radialError = d - rt.radius;
  const speed = enemySpeed(state, enemy, data, updateCtx);
  const desiredX = tangent.x * speed + fromTarget.x * (-radialError * 3.1);
  const desiredY = tangent.y * speed + fromTarget.y * (-radialError * 3.1);
  const turn = 1 - Math.exp(-(cfg.turnRate || 18) * dt);
  enemy.vx += (desiredX - enemy.vx) * turn;
  enemy.vy += (desiredY - enemy.vy) * turn;
  moveEnemyWithVelocity(enemy, geometry, dt);
  if ((rt.pulseAt || 0) <= (state.time || 0)) {
    rt.pulseAt = (state.time || 0) + 0.2;
    pushVisualEffect(state, { type: "anomalyLine", x: Math.round(enemy.x), y: Math.round(enemy.y), x2: Math.round(enemy.x + toTarget.x * 32), y2: Math.round(enemy.y + toTarget.y * 32), color: "#ffffff", life: 0.08, maxLife: 0.08 });
  }
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
