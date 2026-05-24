import { CHEST_REWARD_TABLES } from "./chestRewardTables.js";
import { chestOpenCostFor, chestVisualFor } from "./chestEconomy.js";

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

function chestVisual(chestId, tier) {
  const visual = chestVisualFor(chestId);
  return Object.freeze({
    renderer: "chest",
    label: visual.label,
    code: visual.code,
    accent: visual.accent,
    color: visual.color,
    tier,
    glyph: visual.code
  });
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
    visual: chestVisual(CHEST_IDS.BASIC, "basic"),
    openCost: chestOpenCostFor(CHEST_IDS.BASIC)
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
    visual: chestVisual(CHEST_IDS.WEAPON, "weapon"),
    openCost: chestOpenCostFor(CHEST_IDS.WEAPON)
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
    visual: chestVisual(CHEST_IDS.ABILITY, "ability"),
    openCost: chestOpenCostFor(CHEST_IDS.ABILITY)
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
    visual: chestVisual(CHEST_IDS.RARE, "rare"),
    openCost: chestOpenCostFor(CHEST_IDS.RARE)
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
    visual: chestVisual(CHEST_IDS.CURSED, "cursed"),
    openCost: chestOpenCostFor(CHEST_IDS.CURSED)
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
