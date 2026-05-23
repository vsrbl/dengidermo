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
    description: "SMALL SIGNAL / SMALL LOSS"
  }),
  [CASINO_STAKE_IDS.MID]: Object.freeze({
    id: CASINO_STAKE_IDS.MID,
    name: "MID STAKE",
    cost: 35,
    reels: 3,
    tags: Object.freeze(["mid", "money", "weapon", "ability"]),
    description: "BETTER SYMBOL POOL"
  }),
  [CASINO_STAKE_IDS.HIGH]: Object.freeze({
    id: CASINO_STAKE_IDS.HIGH,
    name: "HIGH STAKE",
    cost: 75,
    reels: 3,
    tags: Object.freeze(["high", "money", "jackpot", "static"]),
    description: "RARE / STATIC RISK"
  })
});

export function getCasinoStake(stakeId) {
  return CASINO_STAKES[stakeId] || null;
}

export function casinoStakeIsKnown(stakeId) {
  return !!getCasinoStake(stakeId);
}
