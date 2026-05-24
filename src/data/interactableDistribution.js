import { INTERACTABLE_DENSITY_BALANCE } from "./economyBalance.js";

export const INTERACTABLE_DISTRIBUTION_SCHEMA_VERSION = 2;

function entry(id, interactableId, chance, overrides = {}) {
  return Object.freeze({
    id,
    interactableId,
    chance,
    minLoop: Number.isFinite(overrides.minLoop) ? overrides.minLoop : 0,
    maxLoop: Number.isFinite(overrides.maxLoop) ? overrides.maxLoop : null,
    placement: overrides.placement || "distributed",
    tags: Object.freeze([...(overrides.tags || [])]),
    rewardTable: overrides.rewardTable || null
  });
}

const NORMAL = INTERACTABLE_DENSITY_BALANCE.normal;

export const INTERACTABLE_DISTRIBUTIONS = Object.freeze({
  normal: Object.freeze({
    id: "normal_exploration_chests",
    maxSlotsByLoop: NORMAL.maxSlotsByLoop,
    budgetRolls: NORMAL.budgetRolls,
    entries: Object.freeze([
      entry("normal_bsc_primary", "basic_chest", NORMAL.chances.basicPrimary, { placement: "distributed", tags: ["economy", "exploration", "free"] }),
      entry("normal_wpn_medium", "weapon_chest", NORMAL.chances.weapon, { minLoop: 1, placement: "distributed", tags: ["weapon", "priced"] }),
      entry("normal_abl_rare", "ability_chest", NORMAL.chances.ability, { minLoop: 1, placement: "distributed", tags: ["ability", "priced"] }),
      entry("normal_rar_rare", "rare_chest", NORMAL.chances.rare, { minLoop: 2, placement: "distributed", tags: ["rare", "priced"] }),
      entry("normal_crs_cursed", "cursed_chest", NORMAL.chances.cursed, { minLoop: 2, placement: "distributed", tags: ["cursed", "risk", "priced"] }),
      entry("normal_bsc_secondary", "basic_chest", NORMAL.chances.basicSecondary, { minLoop: 1, placement: "distributed", tags: ["economy", "exploration", "secondary", "free"] })
    ])
  })
});

function hashString(input = "") {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed = "") {
  return (hashString(seed) % 1000000) / 1000000;
}

function ruleAllowsLoop(rule, loopIndex) {
  if (Number.isFinite(rule?.minLoop) && loopIndex < rule.minLoop) return false;
  if (Number.isFinite(rule?.maxLoop) && loopIndex > rule.maxLoop) return false;
  return true;
}

function fallbackMaxSlots(profile, loopIndex) {
  let maxSlots = 0;
  for (const rule of profile.maxSlotsByLoop || []) {
    if (loopIndex >= (rule.minLoop || 0)) maxSlots = Math.max(maxSlots, Math.floor(rule.maxSlots || 0));
  }
  return maxSlots;
}

function rolledMaxSlots(profile, progression, loopIndex, fallback) {
  const rolls = (profile.budgetRolls || []).filter((rule) => ruleAllowsLoop(rule, loopIndex) && (rule.weight || 0) > 0);
  if (!rolls.length) return fallback;
  const seed = String(progression.seed || progression.roomSeed || progression.roomId || `${progression.runDepth || 0}:${progression.roomInLoop || 0}`);
  const total = rolls.reduce((sum, rule) => sum + Math.max(0, rule.weight || 0), 0);
  let pick = seededUnit(`${seed}:interactable-budget:${loopIndex}`) * total;
  for (const rule of rolls) {
    pick -= Math.max(0, rule.weight || 0);
    if (pick <= 0) return Math.min(fallback, Math.max(0, Math.floor(rule.maxSlots || 0)));
  }
  return Math.min(fallback, Math.max(0, Math.floor(rolls.at(-1)?.maxSlots || 0)));
}

export function interactableDistributionForRoom(room = {}) {
  const tags = new Set([...(room.tags || []), room.category].filter(Boolean));
  if (tags.has("boss") || tags.has("no-combat") || room.category === "reward" || room.category === "cursed") return null;
  return INTERACTABLE_DISTRIBUTIONS.normal;
}

export function maxDistributionSlots(profile, progression = {}) {
  if (!profile) return 0;
  const loopIndex = Math.max(0, Math.floor(Number.isFinite(progression.loopIndex) ? progression.loopIndex : 0));
  const fallback = fallbackMaxSlots(profile, loopIndex);
  return rolledMaxSlots(profile, progression, loopIndex, fallback);
}
