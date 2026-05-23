export const ECONOMY_BALANCE_SCHEMA_VERSION = 1;

export const LEVEL_CURVE_BALANCE = Object.freeze({
  baseXp: 30,
  growth: 1.39,
  maxLevel: 99
});

export const ENEMY_DROP_BALANCE = Object.freeze({
  grunt: Object.freeze({ xp: [2, 3], money: [1, 2], moneyChance: 0.48, eliteHealAmount: 12, eliteHealChance: 0.018 }),
  runner: Object.freeze({ xp: [2, 4], money: [1, 2], moneyChance: 0.42, eliteHealAmount: 12, eliteHealChance: 0.016 }),
  tank: Object.freeze({ xp: [7, 9], money: [4, 7], moneyChance: 0.82, eliteHealAmount: 18, eliteHealChance: 0.04 }),
  shooter: Object.freeze({ xp: [4, 6], money: [2, 4], moneyChance: 0.62, eliteHealAmount: 14, eliteHealChance: 0.024 }),
  charger: Object.freeze({ xp: [5, 7], money: [2, 5], moneyChance: 0.68, eliteHealAmount: 16, eliteHealChance: 0.03 }),
  bomber: Object.freeze({ xp: [4, 6], money: [2, 4], moneyChance: 0.54, eliteHealAmount: 18, eliteHealChance: 0.032 }),
  boss: Object.freeze({ xp: [42, 54], money: [40, 58], healAmount: 38 })
});

export const CHEST_PRICE_BALANCE = Object.freeze({
  basic_chest: Object.freeze({ base: 6, perLoop: 2, min: 5, max: 18 }),
  weapon_chest: Object.freeze({ base: 40, perLoop: 8, min: 34, max: 96 }),
  ability_chest: Object.freeze({ base: 56, perLoop: 10, min: 46, max: 120 }),
  rare_chest: Object.freeze({ base: 90, perLoop: 16, min: 74, max: 180 }),
  cursed_chest: Object.freeze({ base: 108, perLoop: 18, min: 88, max: 220 })
});

export const CHEST_REWARD_BALANCE = Object.freeze({
  basic: Object.freeze({ moneyAmount: [6, 11], moneyWeight: 8, xpAmount: [5, 8], xpWeight: 5, healAmount: 14, healWeight: 1 }),
  rare: Object.freeze({ guaranteedMoney: [32, 48], healWeight: 3, seekerWeight: 4, rocketWeight: 4, shardWeight: 4, activeWeight: 2 }),
  cursed: Object.freeze({ guaranteedMoney: [48, 74], rocketWeight: 5, seekerWeight: 4, shardWeight: 4, activeWeight: 3 })
});

export const CASINO_BALANCE = Object.freeze({
  low: Object.freeze({
    cost: 12,
    matchChance: 0.26,
    symbolWeights: Object.freeze({ coin: 24, heart: 10, xp: 22, weapon: 4, ability: 3, static: 5, jackpot: 1 }),
    payouts: Object.freeze({ coin: 30, xp: 24, staticMoney: 18, jackpotMoney: 85 })
  }),
  mid: Object.freeze({
    cost: 40,
    matchChance: 0.28,
    symbolWeights: Object.freeze({ coin: 20, heart: 8, xp: 17, weapon: 10, ability: 7, static: 8, jackpot: 2 }),
    payouts: Object.freeze({ coin: 105, xp: 90, staticMoney: 120, jackpotMoney: 190 })
  }),
  high: Object.freeze({
    cost: 85,
    matchChance: 0.31,
    symbolWeights: Object.freeze({ coin: 16, heart: 6, xp: 13, weapon: 12, ability: 10, static: 12, jackpot: 4 }),
    payouts: Object.freeze({ coin: 240, xp: 220, staticMoney: 300, jackpotMoney: 430 })
  })
});

export const INTERACTABLE_DENSITY_BALANCE = Object.freeze({
  normal: Object.freeze({
    maxSlotsByLoop: Object.freeze([
      Object.freeze({ minLoop: 0, maxSlots: 2 }),
      Object.freeze({ minLoop: 2, maxSlots: 3 })
    ]),
    chances: Object.freeze({
      basicPrimary: 0.86,
      weapon: 0.18,
      ability: 0.09,
      rare: 0.07,
      cursed: 0.04,
      basicSecondary: 0.50
    })
  })
});
