import { LEVEL_UP_QUEUE_SOURCE, PLAYER_ECONOMY_DEFAULTS, normalizeEconomyAmount, xpRequiredForNextLevel } from "../data/economy.js";
import { pushEvent } from "./events.js";

function normalizePendingUpgradeCount(value, fallback = 0) {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : fallback));
}

function normalizeQueueSeq(value, fallback = 0) {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : fallback));
}

export function createPlayerEconomy(overrides = {}) {
  return {
    money: normalizeEconomyAmount(overrides.money, PLAYER_ECONOMY_DEFAULTS.money),
    xp: normalizeEconomyAmount(overrides.xp, PLAYER_ECONOMY_DEFAULTS.xp),
    lifetimeXp: normalizeEconomyAmount(overrides.lifetimeXp, PLAYER_ECONOMY_DEFAULTS.lifetimeXp),
    level: Math.max(1, Math.floor(Number.isFinite(overrides.level) ? overrides.level : PLAYER_ECONOMY_DEFAULTS.level)),
    pendingUpgradeCount: normalizePendingUpgradeCount(overrides.pendingUpgradeCount, PLAYER_ECONOMY_DEFAULTS.pendingUpgradeCount || 0),
    levelQueueSeq: normalizeQueueSeq(overrides.levelQueueSeq, PLAYER_ECONOMY_DEFAULTS.levelQueueSeq || 0)
  };
}

export function ensurePlayerEconomy(player) {
  if (!player.economy || typeof player.economy !== "object") player.economy = createPlayerEconomy();
  const economy = player.economy;
  economy.money = normalizeEconomyAmount(economy.money, 0);
  economy.xp = normalizeEconomyAmount(economy.xp, 0);
  economy.lifetimeXp = normalizeEconomyAmount(economy.lifetimeXp, 0);
  economy.level = Math.max(1, Math.floor(Number.isFinite(economy.level) ? economy.level : 1));
  economy.pendingUpgradeCount = normalizePendingUpgradeCount(economy.pendingUpgradeCount, 0);
  economy.levelQueueSeq = normalizeQueueSeq(economy.levelQueueSeq, 0);
  return economy;
}

export function isSharedEconomyCreditEligible(player) {
  return !!player && player.hp > 0;
}

export function sharedEconomyCreditRecipients(state) {
  return Object.values(state?.players || {}).filter((player) => isSharedEconomyCreditEligible(player));
}

export function hasPendingLevelUpUpgrade(player) {
  return ensurePlayerEconomy(player).pendingUpgradeCount > 0;
}

export function economySnapshot(player) {
  const economy = ensurePlayerEconomy(player);
  return {
    money: economy.money,
    xp: economy.xp,
    lifetimeXp: economy.lifetimeXp,
    level: economy.level,
    nextLevelXp: xpRequiredForNextLevel(economy.level),
    pendingUpgradeCount: economy.pendingUpgradeCount,
    levelQueueSeq: economy.levelQueueSeq
  };
}

export function queuePendingLevelUpUpgrades(state, player, levelsGained, context = {}) {
  if (!player) return { ok: false, reason: "invalid_player" };
  const count = normalizePendingUpgradeCount(levelsGained, 0);
  if (count <= 0) return { ok: false, reason: "invalid_count" };
  const economy = ensurePlayerEconomy(player);
  economy.pendingUpgradeCount += count;
  economy.levelQueueSeq += 1;
  pushEvent(state, {
    type: "economy",
    action: "queue_level_up",
    playerId: player.id,
    source: LEVEL_UP_QUEUE_SOURCE,
    levelsGained: count,
    level: economy.level,
    pendingUpgradeCount: economy.pendingUpgradeCount,
    levelQueueSeq: economy.levelQueueSeq,
    sourceType: context.sourceType || null,
    sourceId: context.sourceId || null,
    collectorId: context.collectorId || null,
    sharedCredit: !!context.sharedCredit
  });
  return { ok: true, economy, levelsGained: count, pendingUpgradeCount: economy.pendingUpgradeCount, levelQueueSeq: economy.levelQueueSeq };
}

export function consumePendingUpgrade(state, player, context = {}) {
  if (!player) return { ok: false, reason: "invalid_player" };
  const economy = ensurePlayerEconomy(player);
  if (economy.pendingUpgradeCount <= 0) return { ok: false, reason: "no_pending_upgrades", economy };
  economy.pendingUpgradeCount -= 1;
  economy.levelQueueSeq += 1;
  pushEvent(state, {
    type: "economy",
    action: "consume_pending_upgrade",
    playerId: player.id,
    source: LEVEL_UP_QUEUE_SOURCE,
    pendingUpgradeCount: economy.pendingUpgradeCount,
    levelQueueSeq: economy.levelQueueSeq,
    sourceType: context.sourceType || null,
    sourceId: context.sourceId || null,
    offerSeq: context.offerSeq || null
  });
  return { ok: true, economy, pendingUpgradeCount: economy.pendingUpgradeCount, levelQueueSeq: economy.levelQueueSeq };
}

export function grantMoney(state, player, amount, context = {}) {
  if (!player) return { ok: false, reason: "invalid_player" };
  const value = normalizeEconomyAmount(amount, 0);
  if (value <= 0) return { ok: false, reason: "invalid_amount" };
  const economy = ensurePlayerEconomy(player);
  economy.money += value;
  pushEvent(state, {
    type: "economy",
    action: "grant_money",
    playerId: player.id,
    amount: value,
    money: economy.money,
    collectorId: context.collectorId || null,
    sharedCredit: !!context.sharedCredit,
    sourceType: context.sourceType || null,
    sourceId: context.sourceId || null
  });
  return { ok: true, amount: value, economy };
}

export function spendMoney(state, player, amount, context = {}) {
  if (!player) return { ok: false, reason: "invalid_player" };
  const value = normalizeEconomyAmount(amount, 0);
  if (value <= 0) return { ok: false, reason: "invalid_amount" };
  const economy = ensurePlayerEconomy(player);
  if (economy.money < value) return { ok: false, reason: "not_enough_money", money: economy.money, cost: value };
  economy.money -= value;
  pushEvent(state, {
    type: "economy",
    action: "spend_money",
    playerId: player.id,
    amount: value,
    money: economy.money,
    sourceType: context.sourceType || null,
    sourceId: context.sourceId || null
  });
  return { ok: true, amount: value, economy };
}

export function grantXp(state, player, amount, context = {}) {
  if (!player) return { ok: false, reason: "invalid_player" };
  const value = normalizeEconomyAmount(amount, 0);
  if (value <= 0) return { ok: false, reason: "invalid_amount" };
  const economy = ensurePlayerEconomy(player);
  economy.xp += value;
  economy.lifetimeXp += value;

  let levelsGained = 0;
  let needed = xpRequiredForNextLevel(economy.level);
  while (Number.isFinite(needed) && economy.xp >= needed) {
    economy.xp -= needed;
    economy.level += 1;
    levelsGained += 1;
    needed = xpRequiredForNextLevel(economy.level);
  }

  const queued = levelsGained > 0
    ? queuePendingLevelUpUpgrades(state, player, levelsGained, context)
    : { ok: false, pendingUpgradeCount: economy.pendingUpgradeCount, levelQueueSeq: economy.levelQueueSeq };

  pushEvent(state, {
    type: "economy",
    action: "grant_xp",
    playerId: player.id,
    amount: value,
    xp: economy.xp,
    lifetimeXp: economy.lifetimeXp,
    level: economy.level,
    levelsGained,
    queuedLevelUps: queued.ok ? queued.levelsGained : 0,
    pendingUpgradeCount: economy.pendingUpgradeCount,
    levelQueueSeq: economy.levelQueueSeq,
    collectorId: context.collectorId || null,
    sharedCredit: !!context.sharedCredit,
    sourceType: context.sourceType || null,
    sourceId: context.sourceId || null
  });
  return { ok: true, amount: value, levelsGained, queuedLevelUps: queued.ok ? queued.levelsGained : 0, economy };
}
