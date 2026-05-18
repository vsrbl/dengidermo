import { PLAYER_HP } from "../core/constants.js";
import { getUpgrade, rollUpgradeOffer } from "../data/upgrades.js";
import { activeSynergies } from "../data/synergies.js";
import { ensureInventory } from "./inventory.js";
import { healPlayer } from "./effects.js";

const DEFAULT_STATS = Object.freeze({
  speedMult: 1,
  fireRateMult: 1,
  damageMult: 1,
  projectileSpeedMult: 1,
  explosionRadiusMult: 1,
  explosionDamageMult: 1,
  knockbackMult: 1
});

export function ensureUpgradeState(player) {
  if (!player.stats) player.stats = { ...DEFAULT_STATS };
  for (const [key, value] of Object.entries(DEFAULT_STATS)) {
    if (!Number.isFinite(player.stats[key])) player.stats[key] = value;
  }
  if (!player.upgrades) player.upgrades = { choices: [], taken: {}, offered: {}, offers: {}, pending: false };
  if (!player.upgrades.taken) player.upgrades.taken = {};
  if (!player.upgrades.offered) player.upgrades.offered = {};
  if (!player.upgrades.offers) player.upgrades.offers = {};
  if (!Array.isArray(player.upgrades.choices)) player.upgrades.choices = [];
  ensureInventory(player);
  return player.upgrades;
}

export function upgradeSnapshot(player) {
  const upgrades = ensureUpgradeState(player);
  return {
    choices: upgrades.choices.slice(0, 3),
    taken: { ...upgrades.taken },
    offers: { ...(upgrades.offers || {}) },
    synergies: activeSynergies(player).map((rule) => rule.id)
  };
}

function addPassive(player, upgradeId) {
  const inventory = ensureInventory(player);
  if (!Array.isArray(inventory.passives)) inventory.passives = [];
  inventory.passives.push(upgradeId);
}

export function applyUpgrade(player, upgradeId, state = null) {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) return false;
  const upgrades = ensureUpgradeState(player);
  const stacks = upgrades.taken[upgradeId] || 0;
  if (stacks >= (upgrade.maxStacks || 1)) return false;

  const mods = upgrade.mods || {};
  if (mods.speedMult) player.stats.speedMult += mods.speedMult;
  if (mods.fireRateMult) player.stats.fireRateMult += mods.fireRateMult;
  if (mods.damageMult) player.stats.damageMult += mods.damageMult;
  if (mods.projectileSpeedMult) player.stats.projectileSpeedMult += mods.projectileSpeedMult;
  if (mods.explosionRadiusMult) player.stats.explosionRadiusMult += mods.explosionRadiusMult;
  if (mods.explosionDamageMult) player.stats.explosionDamageMult += mods.explosionDamageMult;
  if (mods.knockbackMult) player.stats.knockbackMult += mods.knockbackMult;
  if (mods.maxHp) {
    player.maxHp = Math.max(1, (player.maxHp || PLAYER_HP) + mods.maxHp);
    healPlayer(state, player, { amount: mods.heal || mods.maxHp, sourceType: "upgrade", tags: ["upgrade", upgradeId], allowRevive: false });
  } else if (mods.heal) {
    healPlayer(state, player, { amount: mods.heal, sourceType: "upgrade", tags: ["upgrade", upgradeId], allowRevive: false });
  }

  upgrades.taken[upgradeId] = stacks + 1;
  addPassive(player, upgradeId);
  return true;
}

export function offerUpgradeChoices(state, player, count = 3) {
  const upgrades = ensureUpgradeState(player);
  const offer = rollUpgradeOffer(state.rng, player, count, state);
  upgrades.choices = offer.choices;
  upgrades.offers = offer.offers;
  for (const id of upgrades.choices) upgrades.offered[id] = (upgrades.offered[id] || 0) + 1;
  upgrades.pending = upgrades.choices.length > 0;
  return upgrades.choices;
}

export function offerUpgradesToPlayers(state, count = 3) {
  for (const player of Object.values(state.players || {})) {
    if (player.hp > 0) offerUpgradeChoices(state, player, count);
  }
}

export function chooseUpgrade(state, playerId, choiceIndex) {
  const player = state.players?.[playerId];
  if (!player) return false;
  const upgrades = ensureUpgradeState(player);
  const index = Number(choiceIndex);
  if (!Number.isInteger(index) || index < 0 || index >= upgrades.choices.length) return false;
  const upgradeId = upgrades.choices[index];
  const ok = applyUpgrade(player, upgradeId, state);
  if (!ok) return false;
  upgrades.choices = [];
  upgrades.offers = {};
  upgrades.pending = false;
  if (state.events) {
    state.events.push({ id: `up${state.tick}-${playerId}`, t: state.time, type: "upgrade", playerId, upgradeId });
    if (state.events.length > 32) state.events.splice(0, state.events.length - 32);
  }
  return true;
}
