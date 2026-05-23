import { CHEST_IDS, CHESTS, getChest } from "./chests.js";
import { REWARD_TABLES } from "./rewardTables.js";
import { CASINO_MACHINE_IDS, CASINO_MACHINES, getCasinoMachine } from "./casinoMachines.js";

export const INTERACTABLE_CATEGORIES = Object.freeze({
  CHEST: "chest",
  TERMINAL: "terminal",
  SHRINE: "shrine",
  CASINO: "casino"
});

function chestInteractable(chestId, overrides = {}) {
  const chest = getChest(chestId);
  if (!chest) throw new Error(`unknown chest interactable data: ${chestId}`);
  return Object.freeze({
    id: overrides.id || chest.id,
    name: overrides.name || chest.name,
    category: INTERACTABLE_CATEGORIES.CHEST,
    chestId: chest.id,
    radius: overrides.radius || chest.radius,
    interactRadius: overrides.interactRadius || chest.interactRadius,
    maxUses: 1,
    autoOpen: false,
    minSpawnDistance: overrides.minSpawnDistance || chest.minSpawnDistance,
    rewardTable: overrides.rewardTable || chest.rewardTable,
    tags: Object.freeze([...(chest.tags || []), ...(overrides.tags || [])]),
    visual: Object.freeze({ ...(chest.visual || {}), ...(overrides.visual || {}) })
  });
}

export const INTERACTABLES = Object.freeze({
  basic_chest: chestInteractable(CHEST_IDS.BASIC),
  weapon_chest: chestInteractable(CHEST_IDS.WEAPON),
  ability_chest: chestInteractable(CHEST_IDS.ABILITY),
  rare_chest: chestInteractable(CHEST_IDS.RARE),
  cursed_chest: chestInteractable(CHEST_IDS.CURSED),

  field_cache: chestInteractable(CHEST_IDS.BASIC, {
    id: "field_cache",
    name: "FIELD CHEST",
    tags: ["legacy_cache_alias"],
    visual: { label: "BSC", glyph: "BSC" }
  }),

  reward_cache: chestInteractable(CHEST_IDS.RARE, {
    id: "reward_cache",
    name: "REWARD CHEST",
    tags: ["legacy_cache_alias"],
    visual: { label: "RAR", glyph: "RAR" }
  }),

  casino_slot: Object.freeze({
    id: "casino_slot",
    name: CASINO_MACHINES[CASINO_MACHINE_IDS.SIGNAL_SLOT].name,
    category: INTERACTABLE_CATEGORIES.CASINO,
    casinoMachineId: CASINO_MACHINE_IDS.SIGNAL_SLOT,
    radius: CASINO_MACHINES[CASINO_MACHINE_IDS.SIGNAL_SLOT].radius,
    interactRadius: CASINO_MACHINES[CASINO_MACHINE_IDS.SIGNAL_SLOT].interactRadius,
    maxUses: 999,
    autoOpen: false,
    minSpawnDistance: CASINO_MACHINES[CASINO_MACHINE_IDS.SIGNAL_SLOT].minSpawnDistance,
    rewardTable: "casino_slot",
    tags: Object.freeze([...CASINO_MACHINES[CASINO_MACHINE_IDS.SIGNAL_SLOT].tags, "activity", "exploration"]),
    visual: CASINO_MACHINES[CASINO_MACHINE_IDS.SIGNAL_SLOT].visual
  })
});

export function getInteractable(interactableId) {
  return INTERACTABLES[interactableId] || null;
}

export function interactableRewardTable(interactableId) {
  const data = getInteractable(interactableId);
  return data?.rewardTable && REWARD_TABLES[data.rewardTable] ? data.rewardTable : null;
}

export function interactableChest(interactableId) {
  const data = getInteractable(interactableId);
  return data?.chestId ? CHESTS[data.chestId] || null : null;
}

export function interactableCasinoMachine(interactableId) {
  const data = getInteractable(interactableId);
  return data?.casinoMachineId ? getCasinoMachine(data.casinoMachineId) : null;
}
