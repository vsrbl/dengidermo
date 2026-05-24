import { ENEMIES } from "../data/enemies.js";
import { spawnEnemyDrops } from "./dropResolver.js";
import { pushEvent } from "./events.js";
import { sourceId } from "./effects.js";
import { runEnemyEliteDeath } from "./enemyElites.js";
import { registerKillCombo } from "./killCombos.js";
import { spawnBehaviorEnemy } from "./enemyBehaviors/common.js";

function roomLoopIndex(state) {
  return Math.max(0, Math.floor(Number(state?.roomPlan?.loopIndex ?? state?.loopIndex ?? 0) || 0));
}

function runEnemyDeathSpawn(state, enemy, data) {
  const cfg = data?.deathSpawn;
  if (!cfg?.kind || !ENEMIES[cfg.kind]) return [];
  const loop = roomLoopIndex(state);
  if (Number.isFinite(cfg.minLoop) && loop < cfg.minLoop) return [];
  const maxChildren = Number.isFinite(cfg.maxChildren) ? cfg.maxChildren : 8;
  const existing = Object.values(state.enemies || {}).filter((item) => item?.parentEnemyId === enemy.id).length;
  const scaledCount = (cfg.count || 0) + Math.max(0, loop - Math.max(0, cfg.minLoop || 0)) * Math.max(0, cfg.countPerLoop || 0);
  const count = Math.max(0, Math.min(cfg.maxCount || scaledCount, scaledCount, maxChildren - existing));
  const spawned = [];
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / Math.max(1, count) + ((state.rng?.next?.() || 0) - 0.5) * 0.35;
    const r = cfg.radius || 30;
    const child = spawnBehaviorEnemy(state, cfg.kind, enemy.x + Math.cos(a) * r, enemy.y + Math.sin(a) * r, {
      parentEnemyId: enemy.id,
      role: "death_spawn",
      color: "#ffffff",
      text: "SPL"
    });
    if (!child) continue;
    const impulse = cfg.impulse || 150;
    child.vx = Math.cos(a) * impulse;
    child.vy = Math.sin(a) * impulse;
    spawned.push(child);
  }
  if (spawned.length) pushEvent(state, { type: "enemy", action: "death_spawn", enemyId: enemy.id, enemyKind: enemy.kind, childKind: cfg.kind, count: spawned.length, splitStage: data?.splitStage ?? null, loopIndex: loop, x: enemy.x, y: enemy.y });
  return spawned;
}

export function finishEnemyKill(state, enemy, source = null, hit = null) {
  // ARCHITECTURE GUARD: all systems that remove enemies after damage should
  // pass through this finalizer so score/drop/events stay consistent. Systems
  // may run their own hook commands before calling this, but should not delete
  // state.enemies[id] directly on kill.
  if (!state?.enemies?.[enemy?.id]) return false;
  const data = ENEMIES[enemy.kind] || { score: 0 };
  const sid = sourceId(source) || (typeof source === "string" ? source : null) || hit?.sourceId || null;
  runEnemyEliteDeath(state, enemy, source, hit);
  runEnemyDeathSpawn(state, enemy, data);
  spawnEnemyDrops(state, enemy, { sourceType: "enemy", sourceId: enemy.id, playerId: sid });
  if (sid && state.players?.[sid]) registerKillCombo(state, enemy, { playerId: sid, sourceType: typeof source === "object" ? source?.kind || source?.type || null : null });
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
