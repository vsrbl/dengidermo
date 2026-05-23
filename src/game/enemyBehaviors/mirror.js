import { norm } from "../../core/math.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyEnemyTouchDamage, enemySpeed, moveEnemyWithVelocity } from "./common.js";

function runtime(enemy, cfg) {
  if (!enemy.mirrorState || typeof enemy.mirrorState !== "object") enemy.mirrorState = { history: [] };
  if (!Array.isArray(enemy.mirrorState.history)) enemy.mirrorState.history = [];
  enemy.mirrorState.delay = cfg.delay;
  return enemy.mirrorState;
}

export function updateMirrorEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = data.mirror || {};
  const rt = runtime(enemy, { delay: cfg.delay || 0.72 });
  const now = state.time || 0;
  rt.history.push({ t: now, x: target.x, y: target.y });
  const memory = cfg.memory || 1.35;
  while (rt.history.length > 2 && now - rt.history[0].t > memory) rt.history.shift();
  let ghost = rt.history[0] || target;
  const desiredT = now - (cfg.delay || 0.72);
  for (const item of rt.history) {
    if (item.t <= desiredT) ghost = item;
    else break;
  }
  const dir = norm(ghost.x - enemy.x, ghost.y - enemy.y);
  const speed = enemySpeed(state, enemy, data, updateCtx);
  const turn = 1 - Math.exp(-(cfg.turnRate || 9) * dt);
  enemy.vx += (dir.x * speed - enemy.vx) * turn;
  enemy.vy += (dir.y * speed - enemy.vy) * turn;
  moveEnemyWithVelocity(enemy, geometry, dt);
  if (state.rng.next() < 6 * dt) {
    pushVisualEffect(state, { type: "afterimage", x: Math.round(enemy.x - dir.x * 18), y: Math.round(enemy.y - dir.y * 18), angle: Math.atan2(dir.y, dir.x), life: 0.16, maxLife: 0.16, skin: "white" });
  }
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
