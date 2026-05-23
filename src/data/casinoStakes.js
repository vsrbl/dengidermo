export const CASINO_STAKE_IDS = Object.freeze({
  LOW: "low",
  MID: "mid",
  HIGH: "high"
});

export const CASINO_STAKES = Object.freeze({
  [CASINO_STAKE_IDS.LOW]: Object.freeze({
    id: CASINO_STAKE_IDS.LOW,
    name: "LOW STAKE",
    cost: 10,
    reels: 3,
    tags: Object.freeze(["low", "money"]),
    matchChance: 0.22,
    symbolWeights: Object.freeze({ coin: 22, heart: 18, xp: 20, weapon: 5, ability: 4, static: 5, jackpot: 1 }),
    description: "SMALL SIGNAL / SMALL LOSS"
  }),
  [CASINO_STAKE_IDS.MID]: Object.freeze({
    id: CASINO_STAKE_IDS.MID,
    name: "MID STAKE",
    cost: 35,
    reels: 3,
    tags: Object.freeze(["mid", "money", "weapon", "ability"]),
    matchChance: 0.26,
    symbolWeights: Object.freeze({ coin: 18, heart: 12, xp: 16, weapon: 10, ability: 8, static: 7, jackpot: 2 }),
    description: "BETTER SYMBOL POOL"
  }),
  [CASINO_STAKE_IDS.HIGH]: Object.freeze({
    id: CASINO_STAKE_IDS.HIGH,
    name: "HIGH STAKE",
    cost: 75,
    reels: 3,
    tags: Object.freeze(["high", "money", "jackpot", "static"]),
    matchChance: 0.3,
    symbolWeights: Object.freeze({ coin: 14, heart: 9, xp: 12, weapon: 12, ability: 10, static: 10, jackpot: 4 }),
    description: "RARE / STATIC RISK"
  })
});

export function getCasinoStake(stakeId) {
  return CASINO_STAKES[stakeId] || null;
}

export function casinoStakeIsKnown(stakeId) {
  return !!getCasinoStake(stakeId);
}
