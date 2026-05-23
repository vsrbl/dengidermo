import { LOOT } from "./loot.js";

export const REWARD_TABLES = Object.freeze({
  field_cache: Object.freeze({
    id: "field_cache",
    name: "FIELD CACHE",
    category: "exploration",
    rolls: 1,
    scatter: 30,
    entries: Object.freeze([
      Object.freeze({ type: "loot", kind: "heal", weight: 8 }),
      Object.freeze({ type: "loot", kind: "seeker", weight: 2 }),
      Object.freeze({ type: "loot", kind: "rocket", weight: 1 })
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
      Object.freeze({ type: "nothing", weight: 7, text: "BUST" }),
      Object.freeze({ type: "loot", kind: "heal", weight: 7, text: "PAYOUT" }),
      Object.freeze({ type: "loot", kind: "seeker", weight: 3, text: "PAYOUT" }),
      Object.freeze({ type: "loot", kind: "rocket", weight: 2, text: "PAYOUT" }),
      Object.freeze({ type: "loot", kind: "shotgun", weight: 1, text: "JACKPOT" })
    ])
  })
});

export function getRewardTable(tableId) {
  return REWARD_TABLES[tableId] || null;
}

export function rewardTableEntries(tableId) {
  return [...(getRewardTable(tableId)?.entries || [])];
}

export function rewardEntryIsKnown(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (entry.type === "loot") return !!LOOT[entry.kind];
  if (entry.type === "nothing") return true;
  return false;
}
