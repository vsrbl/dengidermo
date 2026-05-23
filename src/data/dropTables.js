import { ECONOMY_PICKUP_TYPES, economyPickupTypeIsKnown } from "./economy.js";
import { ENEMY_DROP_BALANCE } from "./economyBalance.js";

function regularEnemyEntries(id) {
  const balance = ENEMY_DROP_BALANCE[id];
  return [
    { type: ECONOMY_PICKUP_TYPES.XP, amount: balance.xp, chance: 1 },
    { type: ECONOMY_PICKUP_TYPES.MONEY, amount: balance.money, chance: balance.moneyChance },
    { type: ECONOMY_PICKUP_TYPES.HEAL, amount: balance.eliteHealAmount, chance: balance.eliteHealChance }
  ];
}

export const DROP_TABLES = Object.freeze({
  grunt: {
    id: "grunt",
    entries: regularEnemyEntries("grunt")
  },
  runner: {
    id: "runner",
    entries: regularEnemyEntries("runner")
  },
  tank: {
    id: "tank",
    entries: regularEnemyEntries("tank")
  },
  shooter: {
    id: "shooter",
    entries: regularEnemyEntries("shooter")
  },
  charger: {
    id: "charger",
    entries: regularEnemyEntries("charger")
  },
  bomber: {
    id: "bomber",
    entries: regularEnemyEntries("bomber")
  },
  anomaly_child: {
    id: "anomaly_child",
    entries: [
      { type: ECONOMY_PICKUP_TYPES.XP, amount: 0, chance: 0 }
    ]
  },
  boss: {
    id: "boss",
    entries: [
      { type: ECONOMY_PICKUP_TYPES.XP, amount: ENEMY_DROP_BALANCE.boss.xp, chance: 1 },
      { type: ECONOMY_PICKUP_TYPES.MONEY, amount: ENEMY_DROP_BALANCE.boss.money, chance: 1 },
      { type: ECONOMY_PICKUP_TYPES.HEAL, amount: ENEMY_DROP_BALANCE.boss.healAmount, chance: 1 }
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
