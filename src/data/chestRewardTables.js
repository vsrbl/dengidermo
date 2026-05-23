import { ABILITY_IDS } from "./abilities.js";
import { REWARD_TYPES } from "./rewardTypes.js";

export const CHEST_REWARD_TABLES = Object.freeze({
  basic_chest: Object.freeze({
    id: "basic_chest",
    name: "BASIC CHEST",
    category: "chest-basic",
    rolls: 1,
    scatter: 34,
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "heal", weight: 10, text: "CHEST" }),
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "seeker", weight: 2, text: "WEAPON" }),
      Object.freeze({ type: REWARD_TYPES.ABILITY_SHARD, abilityId: ABILITY_IDS.TELEPORT_DASH, amount: 1, weight: 1, text: "SHARD" })
    ])
  }),

  weapon_chest: Object.freeze({
    id: "weapon_chest",
    name: "WEAPON CHEST",
    category: "chest-weapon",
    rolls: 1,
    scatter: 38,
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "shotgun", weight: 2, text: "WEAPON" }),
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "seeker", weight: 4, text: "WEAPON" }),
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "rocket", weight: 3, text: "WEAPON" })
    ])
  }),

  ability_chest: Object.freeze({
    id: "ability_chest",
    name: "ABILITY CHEST",
    category: "chest-ability",
    rolls: 1,
    scatter: 38,
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.ABILITY_SHARD, abilityId: ABILITY_IDS.TELEPORT_DASH, amount: 1, weight: 6, text: "DASH SHARD" }),
      Object.freeze({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, weight: 2, text: "ACTIVE" })
    ])
  }),

  rare_chest: Object.freeze({
    id: "rare_chest",
    name: "RARE CHEST",
    category: "chest-rare",
    rolls: 3,
    scatter: 50,
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "heal", weight: 6, text: "RARE" }),
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "seeker", weight: 4, text: "RARE" }),
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "rocket", weight: 3, text: "RARE" }),
      Object.freeze({ type: REWARD_TYPES.ABILITY_SHARD, abilityId: ABILITY_IDS.TELEPORT_DASH, amount: 1, weight: 3, text: "SHARD" }),
      Object.freeze({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, weight: 1, text: "ACTIVE" })
    ])
  }),

  cursed_chest: Object.freeze({
    id: "cursed_chest",
    name: "CURSED CHEST",
    category: "chest-cursed",
    rolls: 2,
    scatter: 48,
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.MODIFIER_INJECTION, modifierId: "live_chat_hates_you", weight: 3, text: "CURSE", apply: "next_room" }),
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "rocket", weight: 3, text: "CURSED" }),
      Object.freeze({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, weight: 1, text: "CURSED" })
    ])
  })
});

export function getChestRewardTable(tableId) {
  return CHEST_REWARD_TABLES[tableId] || null;
}
