import { PLAYER_ECONOMY_DEFAULTS, normalizeEconomyAmount, xpRequiredForNextLevel } from "../data/economy.js";
import { pushEvent } from "./events.js";

export function createPlayerEconomy(overrides = {}) {
  return {
    money: normalizeEconomyAmount(overrides.money, PLAYER_ECONOMY_DEFAULTS.money),
    xp: normalizeEconomyAmount(overrides.xp, PLAYER_ECONOMY_DEFAULTS.xp),
    lifetimeXp: normalizeEconomyAmount(overrides.lifetimeXp, PLAYER_ECONOMY_DEFAULTS.lifetimeXp),
    level: Math.max(1, Math.floor(Number.isFinite(overrides.level) ? overrides.level : PLAYER_ECONOMY_DEFAULTS.level))
  };
}

export function ensurePlayerEconomy(player) {
  if (!player.economy || typeof player.economy !== "object") player.economy = createPlayerEconomy();
  const economy = player.economy;
  economy.money = normalizeEconomyAmount(economy.money, 0);
  economy.xp = normalizeEconomyAmount(economy.xp, 0);
  economy.lifetimeXp = normalizeEconomyAmount(economy.lifetimeXp, 0);
  economy.level = Math.max(1, Math.floor(Number.isFinite(economy.level) ? economy.level : 1));
  return economy;
}

export function economySnapshot(player) {
  const economy = ensurePlayerEconomy(player);
  return {
    money: economy.money,
    xp: economy.xp,
    lifetimeXp: economy.lifetimeXp,
    level: economy.level,
    nextLevelXp: xpRequiredForNextLevel(economy.level)
  };
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

  pushEvent(state, {
    type: "economy",
    action: "grant_xp",
    playerId: player.id,
    amount: value,
    xp: economy.xp,
    lifetimeXp: economy.lifetimeXp,
    level: economy.level,
    levelsGained,
    sourceType: context.sourceType || null,
    sourceId: context.sourceId || null
  });
  return { ok: true, amount: value, levelsGained, economy };
}
