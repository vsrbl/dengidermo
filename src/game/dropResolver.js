import { DROP_TABLES } from "../data/dropTables.js";
import { ENEMIES } from "../data/enemies.js";
import { ECONOMY_PICKUP_TYPES } from "../data/economy.js";
import { enemyRewardSourceId, rewardSourceAllowsEconomyType } from "../data/rewardSources.js";
import { spawnEconomyPickup } from "./economyPickups.js";
import { pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { resolveEconomyDropHook } from "./economyDropHooks.js";

function bossJitter(entry) {
  return entry.type === ECONOMY_PICKUP_TYPES.MONEY ? 26 : 18;
}

function emitEconomyDropHookEvent(state, enemy, entry, hook) {
  if (!hook?.rareRoll && hook.chance === hook.baseChance) return;
  pushEvent(state, {
    type: "drop",
    action: "economy_drop_hook_roll",
    enemyId: enemy?.id || null,
    enemyKind: enemy?.kind || null,
    pickupType: entry.type,
    baseChance: hook.baseChance,
    finalChance: hook.chance,
    rareBonus: hook.rareBonus || 0,
    rareRoll: !!hook.rareRoll,
    luckProc: !!hook.luckProc,
    modifierProc: !!hook.modifierProc,
    procType: hook.procType || null,
    sourcePlayerId: hook.sourcePlayerId || null,
    sourceContractId: hook.sourceContractId || null
  });
}


export function resolveEnemyDropEntries(state, enemy, context = {}) {
  const enemyData = ENEMIES[enemy?.kind] || null;
  const tableId = enemyData?.dropTable || enemy?.kind;
  const table = DROP_TABLES[tableId];
  if (!state || !enemy || !table) return [];
  const results = [];
  for (const entry of table.entries || []) {
    const sourceContractId = enemyRewardSourceId(enemy);
    if (!rewardSourceAllowsEconomyType(sourceContractId, entry.type)) continue;
    const roll = resolveEconomyDropHook(state, enemy, entry, { ...context, sourceContractId });
    emitEconomyDropHookEvent(state, enemy, entry, roll);
    if (!roll.hit) continue;
    results.push({
      type: entry.type,
      amount: roll.amount,
      radius: entry.radius,
      label: entry.label,
      tableId,
      sourceContractId: roll.sourceContractId,
      chance: roll.chance,
      baseChance: roll.baseChance,
      rareBonus: roll.rareBonus,
      rareRoll: !!roll.rareRoll,
      luckProc: !!roll.luckProc,
      modifierProc: !!roll.modifierProc,
      procType: roll.procType || null,
      procText: roll.procText || null
    });
  }
  return results;
}

export function spawnEnemyDrops(state, enemy, context = {}) {
  const drops = resolveEnemyDropEntries(state, enemy, context);
  const spawned = [];
  for (const drop of drops) {
    const pickup = spawnEconomyPickup(state, drop, enemy.x, enemy.y, {
      jitter: enemy.kind === "boss" ? bossJitter(drop) : 16,
      sourceType: context.sourceType || "enemy",
      sourceId: context.sourceId || enemy.id,
      enemyKind: enemy.kind,
      sourceContractId: drop.sourceContractId,
      lucky: drop.luckProc,
      boosted: drop.modifierProc || drop.rareRoll,
      procType: drop.procType || null
    });
    if (!pickup) continue;
    spawned.push(pickup);
    if (drop.procText) {
      pushVisualEffect(state, {
        type: "damageText",
        x: Math.round(pickup.x),
        y: Math.round(pickup.y - 26),
        text: drop.procText,
        color: "#00ff66",
        life: 0.62,
        maxLife: 0.62
      });
    }
  }
  if (spawned.length) {
    pushEvent(state, {
      type: "drop",
      action: "enemy_drops",
      enemyId: enemy.id,
      enemyKind: enemy.kind,
      count: spawned.length,
      sourceId: context.sourceId || null,
      sourceContractId: enemyRewardSourceId(enemy),
      luckyCount: drops.filter((drop) => drop.luckProc).length,
      modifierProcCount: drops.filter((drop) => drop.modifierProc).length,
      boostedCount: drops.filter((drop) => drop.modifierProc || drop.rareRoll).length,
      x: Math.round(enemy.x),
      y: Math.round(enemy.y)
    });
  }
  return spawned;
}
