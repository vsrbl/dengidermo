import { ABILITY_IDS } from "./abilities.js";
import { ECONOMY_PICKUP_TYPES } from "./economy.js";
import { CHEST_REWARD_BALANCE } from "./economyBalance.js";
import { REWARD_TYPES } from "./rewardTypes.js";

const BSC = CHEST_REWARD_BALANCE.basic;
const RAR = CHEST_REWARD_BALANCE.rare;
const CRS = CHEST_REWARD_BALANCE.cursed;

export const CHEST_REWARD_TABLES = Object.freeze({
  basic_chest: Object.freeze({
    id: "basic_chest",
    name: "BASIC CHEST",
    category: "chest-basic",
    rolls: 2,
    scatter: 34,
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.ECONOMY_PICKUP, pickupType: ECONOMY_PICKUP_TYPES.MONEY, amount: BSC.moneyAmount, weight: BSC.moneyWeight, text: "GLD" }),
      Object.freeze({ type: REWARD_TYPES.ECONOMY_PICKUP, pickupType: ECONOMY_PICKUP_TYPES.XP, amount: BSC.xpAmount, weight: BSC.xpWeight, text: "EXP" }),
      Object.freeze({ type: REWARD_TYPES.ECONOMY_PICKUP, pickupType: ECONOMY_PICKUP_TYPES.HEAL, amount: BSC.healAmount, weight: BSC.healWeight, text: "HEA" })
    ])
  }),

  weapon_chest: Object.freeze({
    id: "weapon_chest",
    name: "WEAPON CHEST",
    category: "chest-weapon",
    rolls: 1,
    scatter: 38,
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "shotgun", weight: 2, text: "SHG" }),
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "seeker", weight: 4, text: "SEK" }),
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "rocket", weight: 3, text: "RKT" })
    ])
  }),

  ability_chest: Object.freeze({
    id: "ability_chest",
    name: "ABILITY CHEST",
    category: "chest-ability",
    rolls: 1,
    scatter: 38,
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.ABILITY_SHARD, abilityId: ABILITY_IDS.TELEPORT_DASH, amount: 1, weight: 6, text: "DASH" }),
      Object.freeze({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, weight: 2, text: "ACTIVE" })
    ])
  }),

  rare_chest: Object.freeze({
    id: "rare_chest",
    name: "RARE CHEST",
    category: "chest-rare",
    rolls: 2,
    scatter: 54,
    guaranteedEntries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.ECONOMY_PICKUP, pickupType: ECONOMY_PICKUP_TYPES.MONEY, amount: RAR.guaranteedMoney, text: "GLD" })
    ]),
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "heal", weight: RAR.healWeight, text: "RARE" }),
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "seeker", weight: RAR.seekerWeight, text: "SEK" }),
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "rocket", weight: RAR.rocketWeight, text: "RKT" }),
      Object.freeze({ type: REWARD_TYPES.ABILITY_SHARD, abilityId: ABILITY_IDS.TELEPORT_DASH, amount: 1, weight: RAR.shardWeight, text: "SHARD" }),
      Object.freeze({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, weight: RAR.activeWeight, text: "ACTIVE" })
    ])
  }),

  cursed_chest: Object.freeze({
    id: "cursed_chest",
    name: "CURSED CHEST",
    category: "chest-cursed",
    rolls: 2,
    scatter: 54,
    guaranteedEntries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.MODIFIER_INJECTION, modifierId: "live_chat_hates_you", text: "CRS DEBT", apply: "next_room" }),
      Object.freeze({ type: REWARD_TYPES.ECONOMY_PICKUP, pickupType: ECONOMY_PICKUP_TYPES.MONEY, amount: CRS.guaranteedMoney, text: "CRS GLD" })
    ]),
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "rocket", weight: CRS.rocketWeight, text: "CRS RKT" }),
      Object.freeze({ type: REWARD_TYPES.LOOT, kind: "seeker", weight: CRS.seekerWeight, text: "CRS SEK" }),
      Object.freeze({ type: REWARD_TYPES.ABILITY_SHARD, abilityId: ABILITY_IDS.TELEPORT_DASH, amount: 1, weight: CRS.shardWeight, text: "CRS SHARD" }),
      Object.freeze({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, weight: CRS.activeWeight, text: "CRS ACTIVE" })
    ])
  })
});

export function getChestRewardTable(tableId) {
  return CHEST_REWARD_TABLES[tableId] || null;
}
