import { LEVEL_CURVE_BALANCE } from "./economyBalance.js";

export const ECONOMY_PICKUP_TYPES = Object.freeze({
  MONEY: "money",
  XP: "xp",
  HEAL: "heal"
});


export const LEVEL_UP_QUEUE_SOURCE = "queued_level_up";

export const ECONOMY_PICKUP_DELIVERY = Object.freeze({
  SHARED_ALIVE_PLAYERS: "shared_alive_players"
});

export const ECONOMY_PICKUP_RECIPIENT_RULES = Object.freeze({
  ALIVE_PLAYERS_AT_CLAIM: "alive_players_at_claim"
});


export const UPGRADE_OFFER_SOURCES = Object.freeze({
  QUEUED_LEVEL_UP: LEVEL_UP_QUEUE_SOURCE,
  MANUAL: "manual_offer",
  SYSTEM: "system_offer"
});

export const PLAYER_ECONOMY_DEFAULTS = Object.freeze({
  money: 0,
  xp: 0,
  lifetimeXp: 0,
  level: 1,
  pendingUpgradeCount: 0,
  levelQueueSeq: 0
});

export const ECONOMY_LEVELS = Object.freeze({
  baseXp: LEVEL_CURVE_BALANCE.baseXp,
  growth: LEVEL_CURVE_BALANCE.growth,
  maxLevel: LEVEL_CURVE_BALANCE.maxLevel
});

export function economyPickupTypeIsKnown(type) {
  return Object.values(ECONOMY_PICKUP_TYPES).includes(type);
}

export function normalizeEconomyAmount(amount, fallback = 0) {
  const value = Number.isFinite(amount) ? amount : fallback;
  return Math.max(0, Math.floor(value));
}

export function xpRequiredForNextLevel(level = 1) {
  const safeLevel = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
  if (safeLevel >= ECONOMY_LEVELS.maxLevel) return Infinity;
  return Math.max(1, Math.round(ECONOMY_LEVELS.baseXp * Math.pow(ECONOMY_LEVELS.growth, safeLevel - 1)));
}
