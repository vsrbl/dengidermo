import { dist2, norm } from "../../core/math.js";
import { healEnemy } from "../effects.js";
import { applyEnemyTouchDamage, emitAnomalyLink, moveEnemyTowardTarget, moveEnemyWithVelocity } from "./common.js";

function findHealTarget(state, enemy, cfg) {
  const r = cfg.range || 260;
  let best = null;
  let bestMissing = 0;
  for (const other of Object.values(state.enemies || {})) {
    if (!other || other.id === enemy.id || other.hp <= 0) continue;
    const missing = (other.maxHp || other.hp) - other.hp;
    if (missing <= bestMissing) continue;
    if (dist2(enemy.x, enemy.y, other.x, other.y) > r * r) continue;
    best = other;
    bestMissing = missing;
  }
  return best;
}

export function updateLeechEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = data.leech || {};
  const ally = findHealTarget(state, enemy, cfg);
  if (ally) {
    healEnemy(state, ally, {
      amount: (cfg.healPerSecond || 10) * dt,
      sourceId: enemy.id,
      sourceType: "enemyLeech",
      tags: ["enemy", "leech", "heal"],
      color: "#00ff66"
    });
    emitAnomalyLink(state, enemy, ally, "#00ff66", 0.09);
    const away = norm(enemy.x - target.x, enemy.y - target.y);
    enemy.vx = away.x * data.speed * (cfg.retreatSpeedScale || 0.72);
    enemy.vy = away.y * data.speed * (cfg.retreatSpeedScale || 0.72);
    moveEnemyWithVelocity(enemy, geometry, dt);
  } else {
    moveEnemyTowardTarget(ctx, { speedScale: 0.82 });
  }
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
