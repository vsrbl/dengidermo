export { nearestAlivePlayer } from "./enemyBehaviors/common.js";

import { updateAnchorEnemy } from "./enemyBehaviors/anchor.js";
import { updateBouncerEnemy } from "./enemyBehaviors/bouncer.js";
import { updateHeraldEnemy } from "./enemyBehaviors/herald.js";
import { updateLeechEnemy } from "./enemyBehaviors/leech.js";
import { updateEchoEnemy } from "./enemyBehaviors/echo.js";
import { updateGlitchEnemy } from "./enemyBehaviors/glitch.js";
import { updateOrbiterEnemy } from "./enemyBehaviors/orbiter.js";
import { updatePrismEnemy } from "./enemyBehaviors/prism.js";
import { updatePulseEnemy } from "./enemyBehaviors/pulse.js";
import { updateSplitterEnemy } from "./enemyBehaviors/splitter.js";
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
  boss: updateBossEnemy,
  echo: updateEchoEnemy,
  orbiter: updateOrbiterEnemy,
  anchor: updateAnchorEnemy,
  splitter: updateSplitterEnemy,
  prism: updatePrismEnemy,
  pulse: updatePulseEnemy,
  leech: updateLeechEnemy,
  glitch: updateGlitchEnemy,
  bouncer: updateBouncerEnemy,
  herald: updateHeraldEnemy
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
