import { REWARD_TABLES } from "./rewardTables.js";

export const INTERACTABLE_CATEGORIES = Object.freeze({
  CHEST: "chest",
  TERMINAL: "terminal",
  SHRINE: "shrine",
  CASINO: "casino"
});

export const INTERACTABLES = Object.freeze({
  field_cache: Object.freeze({
    id: "field_cache",
    name: "FIELD CACHE",
    category: INTERACTABLE_CATEGORIES.CHEST,
    radius: 18,
    interactRadius: 38,
    maxUses: 1,
    autoOpen: false,
    minSpawnDistance: 140,
    rewardTable: "field_cache",
    tags: Object.freeze(["chest", "loot", "exploration"]),
    visual: Object.freeze({ label: "CACHE", accent: "green" })
  }),

  reward_cache: Object.freeze({
    id: "reward_cache",
    name: "REWARD CACHE",
    category: INTERACTABLE_CATEGORIES.CHEST,
    radius: 24,
    interactRadius: 46,
    maxUses: 1,
    autoOpen: false,
    minSpawnDistance: 160,
    rewardTable: "reward_cache",
    tags: Object.freeze(["chest", "loot", "rare", "reward"]),
    visual: Object.freeze({ label: "REWARD", accent: "green" })
  }),

  casino_slot: Object.freeze({
    id: "casino_slot",
    name: "SIGNAL SLOT",
    category: INTERACTABLE_CATEGORIES.CASINO,
    radius: 26,
    interactRadius: 54,
    maxUses: 1,
    autoOpen: false,
    minSpawnDistance: 170,
    rewardTable: "casino_slot",
    tags: Object.freeze(["casino", "gamble", "activity", "reward", "exploration"]),
    visual: Object.freeze({ label: "SLOT", accent: "red" })
  })
});

export function getInteractable(interactableId) {
  return INTERACTABLES[interactableId] || null;
}

export function interactableRewardTable(interactableId) {
  const data = getInteractable(interactableId);
  return data?.rewardTable && REWARD_TABLES[data.rewardTable] ? data.rewardTable : null;
}
