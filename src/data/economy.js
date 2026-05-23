export const ECONOMY_PICKUP_TYPES = Object.freeze({
  MONEY: "money",
  XP: "xp",
  HEAL: "heal"
});

export const PLAYER_ECONOMY_DEFAULTS = Object.freeze({
  money: 0,
  xp: 0,
  lifetimeXp: 0,
  level: 1
});

export const ECONOMY_LEVELS = Object.freeze({
  baseXp: 24,
  growth: 1.38,
  maxLevel: 99
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
