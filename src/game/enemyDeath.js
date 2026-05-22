import { ENEMIES } from "../data/enemies.js";
import { dropLoot } from "./loot.js";
import { pushEvent } from "./events.js";
import { sourceId } from "./effects.js";
import { runEnemyEliteDeath } from "./enemyElites.js";

export function finishEnemyKill(state, enemy, source = null, hit = null) {
  // ARCHITECTURE GUARD: all systems that remove enemies after damage should
  // pass through this finalizer so score/drop/events stay consistent. Systems
  // may run their own hook commands before calling this, but should not delete
  // state.enemies[id] directly on kill.
  if (!state?.enemies?.[enemy?.id]) return false;
  const data = ENEMIES[enemy.kind] || { score: 0 };
  const sid = sourceId(source) || (typeof source === "string" ? source : null) || hit?.sourceId || null;
  runEnemyEliteDeath(state, enemy, source, hit);
  dropLoot(state, enemy.x, enemy.y, enemy.kind === "boss" ? 1 : 0.32, sid);
  pushEvent(state, {
    type: "kill",
    kind: enemy.kind,
    x: enemy.x,
    y: enemy.y,
    score: data.score || 0,
    sourceId: sid,
    sourceType: typeof source === "object" ? source?.kind || source?.type || null : null
  });
  delete state.enemies[enemy.id];
  return true;
}
