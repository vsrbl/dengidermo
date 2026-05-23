import { CHEST_REWARD_TABLES } from "./chestRewardTables.js";

export const CHEST_STATES = Object.freeze({
  CLOSED: "closed",
  OPENING: "opening",
  OPENED: "opened",
  CLAIMED: "claimed"
});

export const CHEST_IDS = Object.freeze({
  BASIC: "basic_chest",
  WEAPON: "weapon_chest",
  ABILITY: "ability_chest",
  RARE: "rare_chest",
  CURSED: "cursed_chest"
});

function chestVisual(label, accent, tier, glyph) {
  return Object.freeze({ renderer: "chest", label, accent, tier, glyph });
}

export const CHESTS = Object.freeze({
  [CHEST_IDS.BASIC]: Object.freeze({
    id: CHEST_IDS.BASIC,
    name: "BASIC CHEST",
    tier: "basic",
    radius: 24,
    interactRadius: 48,
    minSpawnDistance: 165,
    rewardTable: CHEST_REWARD_TABLES.basic_chest.id,
    tags: Object.freeze(["chest", "loot", "exploration", "basic"]),
    visual: chestVisual("CHEST", "green", "basic", "B")
  }),

  [CHEST_IDS.WEAPON]: Object.freeze({
    id: CHEST_IDS.WEAPON,
    name: "WEAPON CHEST",
    tier: "weapon",
    radius: 25,
    interactRadius: 50,
    minSpawnDistance: 170,
    rewardTable: CHEST_REWARD_TABLES.weapon_chest.id,
    tags: Object.freeze(["chest", "loot", "weapon", "exploration"]),
    visual: chestVisual("WEAPON", "white", "weapon", "W")
  }),

  [CHEST_IDS.ABILITY]: Object.freeze({
    id: CHEST_IDS.ABILITY,
    name: "ABILITY CHEST",
    tier: "ability",
    radius: 25,
    interactRadius: 50,
    minSpawnDistance: 170,
    rewardTable: CHEST_REWARD_TABLES.ability_chest.id,
    tags: Object.freeze(["chest", "loot", "ability", "exploration"]),
    visual: chestVisual("ACTIVE", "green", "ability", "A")
  }),

  [CHEST_IDS.RARE]: Object.freeze({
    id: CHEST_IDS.RARE,
    name: "RARE CHEST",
    tier: "rare",
    radius: 28,
    interactRadius: 54,
    minSpawnDistance: 180,
    rewardTable: CHEST_REWARD_TABLES.rare_chest.id,
    tags: Object.freeze(["chest", "loot", "rare", "reward", "exploration"]),
    visual: chestVisual("RARE", "green", "rare", "R")
  }),

  [CHEST_IDS.CURSED]: Object.freeze({
    id: CHEST_IDS.CURSED,
    name: "CURSED CHEST",
    tier: "cursed",
    radius: 27,
    interactRadius: 54,
    minSpawnDistance: 180,
    rewardTable: CHEST_REWARD_TABLES.cursed_chest.id,
    tags: Object.freeze(["chest", "loot", "cursed", "risk", "exploration"]),
    visual: chestVisual("CURSE", "red", "cursed", "!")
  })
});

export function getChest(chestId) {
  return CHESTS[chestId] || null;
}

export function chestRewardTable(chestId) {
  const chest = getChest(chestId);
  return chest?.rewardTable || null;
}

export function chestStateIsKnown(state) {
  return Object.values(CHEST_STATES).includes(state);
}
