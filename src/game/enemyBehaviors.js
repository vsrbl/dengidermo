export { nearestAlivePlayer } from "./enemyBehaviors/common.js";

import { updateBossEnemy } from "./enemyBehaviors/boss.js";
import { updateBomberEnemy } from "./enemyBehaviors/bomber.js";
import { updateChargerEnemy } from "./enemyBehaviors/charger.js";
import { updateChaseEnemy } from "./enemyBehaviors/chase.js";
import { updateRangedEnemy } from "./enemyBehaviors/ranged.js";

export const ENEMY_BEHAVIORS = Object.freeze({
  chase: updateChaseEnemy,
  ranged: updateRangedEnemy,
  charger: updateChargerEnemy,
  bomber: updateBomberEnemy,
  boss: updateBossEnemy
});

export function resolveEnemyBehavior(data) {
  if (!data?.behavior) return null;
  return ENEMY_BEHAVIORS[data.behavior] || null;
}

export function unknownEnemyBehaviors(enemyDefs) {
  return Object.entries(enemyDefs || {})
    .filter(([, data]) => !resolveEnemyBehavior(data))
    .map(([kind, data]) => ({ kind, behavior: data?.behavior || null }));
}
