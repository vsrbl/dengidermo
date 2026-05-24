import { ABILITY_IDS } from "./abilities.js";
import { REWARD_TYPES } from "./rewardTypes.js";

export const ABILITY_LOOT_TABLES = Object.freeze({
  active_ability_cache: Object.freeze({
    id: "active_ability_cache",
    name: "ACTIVE ABILITY CACHE",
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, weight: 1 })
    ])
  }),
  active_ability_shards: Object.freeze({
    id: "active_ability_shards",
    name: "ACTIVE ABILITY SHARDS",
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.ABILITY_SHARD, abilityId: ABILITY_IDS.TELEPORT_DASH, amount: 1, weight: 1 })
    ])
  })
});

export function getAbilityLootTable(tableId) {
  return ABILITY_LOOT_TABLES[tableId] || null;
}
