import { PLAYER_HP } from "../core/constants.js";
import { UPGRADE_OFFER_SOURCES } from "../data/economy.js";
import { getUpgrade, rollUpgradeOffer } from "../data/upgrades.js";
import { activeSynergies } from "../data/synergies.js";
import { ensureInventory } from "./inventory.js";
import { healPlayer } from "./effects.js";
import { pushEvent } from "./events.js";
import { consumePendingUpgrade, ensurePlayerEconomy, hasPendingLevelUpUpgrade } from "./playerEconomy.js";

const DEFAULT_STATS = Object.freeze({
  speedMult: 1,
  fireRateMult: 1,
  damageMult: 1,
  projectileSpeedMult: 1,
  explosionRadiusMult: 1,
  explosionDamageMult: 1,
  knockbackMult: 1
});

function clearUpgradeOffer(upgrades) {
  upgrades.choices = [];
  upgrades.offers = {};
  upgrades.pending = false;
  upgrades.offerSource = null;
  upgrades.requiresPendingUpgrade = false;
  upgrades.queueRemainingAtOffer = 0;
  upgrades.levelQueueSeqAtOffer = 0;
}

export function ensureUpgradeState(player) {
  if (!player.stats) player.stats = { ...DEFAULT_STATS };
  for (const [key, value] of Object.entries(DEFAULT_STATS)) {
    if (!Number.isFinite(player.stats[key])) player.stats[key] = value;
  }
  if (!player.upgrades) player.upgrades = { choices: [], taken: {}, offered: {}, offers: {}, pending: false, offerSeq: 0 };
  if (!player.upgrades.taken) player.upgrades.taken = {};
  if (!player.upgrades.offered) player.upgrades.offered = {};
  if (!player.upgrades.offers) player.upgrades.offers = {};
  if (!Array.isArray(player.upgrades.choices)) player.upgrades.choices = [];
  if (!Number.isFinite(player.upgrades.offerSeq)) player.upgrades.offerSeq = 0;
  if (typeof player.upgrades.offerSource !== "string" && player.upgrades.offerSource !== null) player.upgrades.offerSource = null;
  player.upgrades.requiresPendingUpgrade = !!player.upgrades.requiresPendingUpgrade;
  player.upgrades.queueRemainingAtOffer = Math.max(0, Math.floor(Number.isFinite(player.upgrades.queueRemainingAtOffer) ? player.upgrades.queueRemainingAtOffer : 0));
  player.upgrades.levelQueueSeqAtOffer = Math.max(0, Math.floor(Number.isFinite(player.upgrades.levelQueueSeqAtOffer) ? player.upgrades.levelQueueSeqAtOffer : 0));
  ensureInventory(player);
  return player.upgrades;
}

export function upgradeSnapshot(player) {
  const upgrades = ensureUpgradeState(player);
  return {
    choices: upgrades.choices.slice(0, 3),
    taken: { ...upgrades.taken },
    offers: { ...(upgrades.offers || {}) },
    pending: !!upgrades.pending,
    offerSeq: upgrades.offerSeq || 0,
    offerSource: upgrades.offerSource || null,
    requiresPendingUpgrade: !!upgrades.requiresPendingUpgrade,
    queueRemainingAtOffer: upgrades.queueRemainingAtOffer || 0,
    levelQueueSeqAtOffer: upgrades.levelQueueSeqAtOffer || 0,
    pendingUpgradeCount: ensurePlayerEconomy(player).pendingUpgradeCount,
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

export function offerUpgradeChoices(state, player, count = 3, context = {}) {
  const upgrades = ensureUpgradeState(player);
  const economy = ensurePlayerEconomy(player);
  const offer = rollUpgradeOffer(state.rng, player, count, state);
  upgrades.choices = offer.choices;
  upgrades.offers = offer.offers;
  upgrades.offerSeq = (upgrades.offerSeq || 0) + 1;
  for (const id of upgrades.choices) upgrades.offered[id] = (upgrades.offered[id] || 0) + 1;
  upgrades.pending = upgrades.choices.length > 0;
  upgrades.offerSource = context.offerSource || UPGRADE_OFFER_SOURCES.MANUAL;
  upgrades.requiresPendingUpgrade = !!context.requiresPendingUpgrade;
  upgrades.queueRemainingAtOffer = context.requiresPendingUpgrade ? economy.pendingUpgradeCount : 0;
  upgrades.levelQueueSeqAtOffer = economy.levelQueueSeq || 0;
  pushEvent(state, {
    type: "upgrade",
    action: "offer_created",
    playerId: player.id,
    offerSeq: upgrades.offerSeq,
    offerSource: upgrades.offerSource,
    requiresPendingUpgrade: upgrades.requiresPendingUpgrade,
    pendingUpgradeCount: economy.pendingUpgradeCount,
    queueRemainingAtOffer: upgrades.queueRemainingAtOffer,
    levelQueueSeqAtOffer: upgrades.levelQueueSeqAtOffer,
    choiceCount: upgrades.choices.length
  });
  return upgrades.choices;
}

export function offerUpgradesToPlayers(state, count = 3) {
  for (const player of Object.values(state.players || {})) {
    if (player.hp > 0) offerUpgradeChoices(state, player, count, { offerSource: UPGRADE_OFFER_SOURCES.SYSTEM, requiresPendingUpgrade: false });
  }
}

export function offerQueuedUpgradeChoice(state, player, count = 3) {
  const economy = ensurePlayerEconomy(player);
  const upgrades = ensureUpgradeState(player);
  if (player.hp <= 0 || !hasPendingLevelUpUpgrade(player) || upgrades.choices.length > 0) return false;
  return offerUpgradeChoices(state, player, count, {
    offerSource: UPGRADE_OFFER_SOURCES.QUEUED_LEVEL_UP,
    requiresPendingUpgrade: true
  }).length > 0;
}

export function offerQueuedUpgradesToPlayers(state, count = 3) {
  for (const player of Object.values(state.players || {})) {
    offerQueuedUpgradeChoice(state, player, count);
  }
}

export function chooseUpgrade(state, playerId, choiceIndex) {
  const player = state.players?.[playerId];
  if (!player) return false;
  const upgrades = ensureUpgradeState(player);
  const economy = ensurePlayerEconomy(player);
  const index = Number(choiceIndex);
  if (!Number.isInteger(index) || index < 0 || index >= upgrades.choices.length) return false;
  if (upgrades.requiresPendingUpgrade && economy.pendingUpgradeCount <= 0) {
    clearUpgradeOffer(upgrades);
    pushEvent(state, { type: "upgrade", action: "stale_offer_rejected", playerId, reason: "no_pending_upgrade" });
    return false;
  }
  const upgradeId = upgrades.choices[index];
  const offerSource = upgrades.offerSource || null;
  const requiresPendingUpgrade = !!upgrades.requiresPendingUpgrade;
  const offerSeq = upgrades.offerSeq || 0;
  const ok = applyUpgrade(player, upgradeId, state);
  if (!ok) return false;
  clearUpgradeOffer(upgrades);
  let consumed = { ok: false, pendingUpgradeCount: economy.pendingUpgradeCount };
  if (requiresPendingUpgrade) {
    consumed = consumePendingUpgrade(state, player, { sourceType: "upgrade_choice", sourceId: upgradeId, offerSeq });
    if (!consumed.ok) return false;
  }
  if (requiresPendingUpgrade && consumed.pendingUpgradeCount > 0) offerQueuedUpgradeChoice(state, player);
  pushEvent(state, {
    type: "upgrade",
    action: "chosen",
    playerId,
    upgradeId,
    offerSeq,
    offerSource,
    consumedPendingUpgrade: requiresPendingUpgrade,
    pendingUpgradeCount: ensurePlayerEconomy(player).pendingUpgradeCount
  });
  return true;
}
