import { DROP_TABLES } from "../data/dropTables.js";
import { ENEMIES } from "../data/enemies.js";
import { ECONOMY_PICKUP_TYPES, normalizeEconomyAmount } from "../data/economy.js";
import { spawnEconomyPickup } from "./economyPickups.js";
import { pushEvent } from "./events.js";

function rollAmount(rng, amount) {
  if (Array.isArray(amount) && amount.length === 2) {
    const min = Math.floor(Math.min(amount[0], amount[1]));
    const max = Math.floor(Math.max(amount[0], amount[1]));
    if (max <= min) return normalizeEconomyAmount(min, 0);
    return normalizeEconomyAmount(Math.floor(rng.range(min, max + 1)), min);
  }
  return normalizeEconomyAmount(amount, 0);
}

function eliteMultiplier(enemy) {
  return enemy?.elite ? 1.65 : 1;
}

function bossJitter(entry) {
  return entry.type === ECONOMY_PICKUP_TYPES.MONEY ? 26 : 18;
}

export function resolveEnemyDropEntries(state, enemy) {
  const enemyData = ENEMIES[enemy?.kind] || null;
  const tableId = enemyData?.dropTable || enemy?.kind;
  const table = DROP_TABLES[tableId];
  if (!state || !enemy || !table) return [];
  const mult = eliteMultiplier(enemy);
  const results = [];
  for (const entry of table.entries || []) {
    const chance = Math.max(0, Math.min(1, Number.isFinite(entry.chance) ? entry.chance : 0));
    if (state.rng.next() > chance) continue;
    const rolled = rollAmount(state.rng, entry.amount);
    const amount = Math.max(1, Math.round(rolled * mult));
    results.push({
      type: entry.type,
      amount,
      radius: entry.radius,
      label: entry.label,
      tableId
    });
  }
  return results;
}

export function spawnEnemyDrops(state, enemy, context = {}) {
  const drops = resolveEnemyDropEntries(state, enemy);
  const spawned = [];
  for (const drop of drops) {
    const pickup = spawnEconomyPickup(state, drop, enemy.x, enemy.y, {
      jitter: enemy.kind === "boss" ? bossJitter(drop) : 16,
      sourceType: context.sourceType || "enemy",
      sourceId: context.sourceId || enemy.id,
      enemyKind: enemy.kind
    });
    if (pickup) spawned.push(pickup);
  }
  if (spawned.length) {
    pushEvent(state, {
      type: "drop",
      action: "enemy_drops",
      enemyId: enemy.id,
      enemyKind: enemy.kind,
      count: spawned.length,
      sourceId: context.sourceId || null,
      x: Math.round(enemy.x),
      y: Math.round(enemy.y)
    });
  }
  return spawned;
}
