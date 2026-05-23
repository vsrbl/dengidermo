import { LOOT } from "./loot.js";
import { ECONOMY_PICKUP_TYPES, economyPickupTypeIsKnown } from "./economy.js";
import { abilityIsRewardable } from "./abilities.js";
import { MODIFIER_DOMAINS } from "./modifierDomains.js";
import { getRuleModifierInDomain } from "./ruleModifiers.js";
import { REWARD_TYPES, rewardTypeIsKnown } from "./rewardTypes.js";
import { CHEST_REWARD_TABLES } from "./chestRewardTables.js";
import { CHEST_REWARD_BALANCE } from "./economyBalance.js";

export const REWARD_TABLES = Object.freeze({
  ...CHEST_REWARD_TABLES,
  field_cache: Object.freeze({
    id: "field_cache",
    name: "FIELD CACHE",
    category: "exploration",
    rolls: 2,
    scatter: 30,
    entries: Object.freeze([
      Object.freeze({ type: REWARD_TYPES.ECONOMY_PICKUP, pickupType: ECONOMY_PICKUP_TYPES.MONEY, amount: CHEST_REWARD_BALANCE.basic.moneyAmount, weight: CHEST_REWARD_BALANCE.basic.moneyWeight, text: "GLD" }),
      Object.freeze({ type: REWARD_TYPES.ECONOMY_PICKUP, pickupType: ECONOMY_PICKUP_TYPES.XP, amount: CHEST_REWARD_BALANCE.basic.xpAmount, weight: CHEST_REWARD_BALANCE.basic.xpWeight, text: "EXP" }),
      Object.freeze({ type: REWARD_TYPES.ECONOMY_PICKUP, pickupType: ECONOMY_PICKUP_TYPES.HEAL, amount: CHEST_REWARD_BALANCE.basic.healAmount, weight: CHEST_REWARD_BALANCE.basic.healWeight, text: "HEA" })
    ])
  }),

  reward_cache: Object.freeze({
    id: "reward_cache",
    name: "REWARD CACHE",
    category: "special-room",
    rolls: 3,
    scatter: 46,
    entries: Object.freeze([
      Object.freeze({ type: "loot", kind: "heal", weight: 7 }),
      Object.freeze({ type: "loot", kind: "seeker", weight: 3 }),
      Object.freeze({ type: "loot", kind: "rocket", weight: 2 }),
      Object.freeze({ type: "ability_shard", abilityId: "teleport_dash", amount: 1, weight: 2, text: "DASH SHARD" }),
      Object.freeze({ type: "ability_pickup", abilityId: "teleport_dash", weight: 1, text: "ACTIVE" }),
      Object.freeze({ type: "loot", kind: "shotgun", weight: 1 })
    ])
  }),

  casino_slot: Object.freeze({
    id: "casino_slot",
    name: "SIGNAL SLOT",
    category: "casino",
    rolls: 1,
    scatter: 54,
    entries: Object.freeze([
      Object.freeze({ type: "nothing", weight: 5, text: "BUST" }),
      Object.freeze({ type: "modifier_injection", modifierId: "live_chat_hates_you", weight: 4, text: "DEBT SIGNAL", apply: "next_room" }),
      Object.freeze({ type: "loot", kind: "heal", weight: 7, text: "PAYOUT" }),
      Object.freeze({ type: "loot", kind: "seeker", weight: 3, text: "PAYOUT" }),
      Object.freeze({ type: "loot", kind: "rocket", weight: 2, text: "PAYOUT" }),
      Object.freeze({ type: "ability_pickup", abilityId: "teleport_dash", weight: 1, text: "JACKPOT" }),
      Object.freeze({ type: "loot", kind: "shotgun", weight: 1, text: "JACKPOT" })
    ])
  })
});

export function getRewardTable(tableId) {
  return REWARD_TABLES[tableId] || null;
}

export function rewardTableEntries(tableId) {
  const table = getRewardTable(tableId);
  return [...(table?.guaranteedEntries || []), ...(table?.entries || [])];
}

export function rewardEntryIsKnown(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (!rewardTypeIsKnown(entry.type)) return false;
  if (entry.type === REWARD_TYPES.LOOT) return !!LOOT[entry.kind];
  if (entry.type === REWARD_TYPES.ECONOMY_PICKUP) {
    const amountKnown = Number.isFinite(entry.amount) || (Array.isArray(entry.amount) && entry.amount.length === 2 && entry.amount.every(Number.isFinite));
    return economyPickupTypeIsKnown(entry.pickupType) && amountKnown;
  }
  if (entry.type === REWARD_TYPES.ABILITY_PICKUP) return abilityIsRewardable(entry.abilityId);
  if (entry.type === REWARD_TYPES.ABILITY_SHARD) return abilityIsRewardable(entry.abilityId);
  if (entry.type === REWARD_TYPES.MODIFIER_INJECTION || entry.type === REWARD_TYPES.CURSE) return !!getRuleModifierInDomain(entry.modifierId, MODIFIER_DOMAINS.ROOM);
  if (entry.type === REWARD_TYPES.NOTHING) return true;
  return true;
}
