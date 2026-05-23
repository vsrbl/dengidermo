import { ECONOMY_PICKUP_TYPES, economyPickupTypeIsKnown } from "./economy.js";

export const DROP_TABLES = Object.freeze({
  grunt: {
    id: "grunt",
    entries: [
      { type: ECONOMY_PICKUP_TYPES.XP, amount: [2, 3], chance: 1 },
      { type: ECONOMY_PICKUP_TYPES.MONEY, amount: [1, 2], chance: 0.34 },
      { type: ECONOMY_PICKUP_TYPES.HEAL, amount: 14, chance: 0.035 }
    ]
  },
  runner: {
    id: "runner",
    entries: [
      { type: ECONOMY_PICKUP_TYPES.XP, amount: [2, 4], chance: 1 },
      { type: ECONOMY_PICKUP_TYPES.MONEY, amount: [1, 2], chance: 0.28 },
      { type: ECONOMY_PICKUP_TYPES.HEAL, amount: 12, chance: 0.025 }
    ]
  },
  tank: {
    id: "tank",
    entries: [
      { type: ECONOMY_PICKUP_TYPES.XP, amount: [6, 8], chance: 1 },
      { type: ECONOMY_PICKUP_TYPES.MONEY, amount: [3, 6], chance: 0.74 },
      { type: ECONOMY_PICKUP_TYPES.HEAL, amount: 18, chance: 0.07 }
    ]
  },
  shooter: {
    id: "shooter",
    entries: [
      { type: ECONOMY_PICKUP_TYPES.XP, amount: [4, 5], chance: 1 },
      { type: ECONOMY_PICKUP_TYPES.MONEY, amount: [2, 4], chance: 0.54 },
      { type: ECONOMY_PICKUP_TYPES.HEAL, amount: 14, chance: 0.04 }
    ]
  },
  charger: {
    id: "charger",
    entries: [
      { type: ECONOMY_PICKUP_TYPES.XP, amount: [4, 6], chance: 1 },
      { type: ECONOMY_PICKUP_TYPES.MONEY, amount: [2, 5], chance: 0.62 },
      { type: ECONOMY_PICKUP_TYPES.HEAL, amount: 16, chance: 0.045 }
    ]
  },
  bomber: {
    id: "bomber",
    entries: [
      { type: ECONOMY_PICKUP_TYPES.XP, amount: [3, 5], chance: 1 },
      { type: ECONOMY_PICKUP_TYPES.MONEY, amount: [1, 4], chance: 0.46 },
      { type: ECONOMY_PICKUP_TYPES.HEAL, amount: 18, chance: 0.065 }
    ]
  },
  boss: {
    id: "boss",
    entries: [
      { type: ECONOMY_PICKUP_TYPES.XP, amount: [34, 42], chance: 1 },
      { type: ECONOMY_PICKUP_TYPES.MONEY, amount: [28, 38], chance: 1 },
      { type: ECONOMY_PICKUP_TYPES.HEAL, amount: 34, chance: 1 }
    ]
  }
});

export function dropTableEntryIsKnown(entry = {}) {
  return economyPickupTypeIsKnown(entry.type)
    && (Number.isFinite(entry.amount) || (Array.isArray(entry.amount) && entry.amount.length === 2 && entry.amount.every(Number.isFinite)))
    && Number.isFinite(entry.chance)
    && entry.chance >= 0
    && entry.chance <= 1;
}
