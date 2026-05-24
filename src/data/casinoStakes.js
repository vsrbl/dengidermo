import { CASINO_BALANCE } from "./economyBalance.js";

export const CASINO_STAKE_IDS = Object.freeze({
  LOW: "low",
  MID: "mid",
  HIGH: "high"
});

export const CASINO_STAKES = Object.freeze({
  [CASINO_STAKE_IDS.LOW]: Object.freeze({
    id: CASINO_STAKE_IDS.LOW,
    name: "LOW BET",
    cost: CASINO_BALANCE.low.cost,
    reels: 3,
    tags: Object.freeze(["low", "money"]),
    matchChance: CASINO_BALANCE.low.matchChance,
    symbolWeights: CASINO_BALANCE.low.symbolWeights,
    description: "SMALL SIGNAL / SMALL LOSS"
  }),
  [CASINO_STAKE_IDS.MID]: Object.freeze({
    id: CASINO_STAKE_IDS.MID,
    name: "MID BET",
    cost: CASINO_BALANCE.mid.cost,
    reels: 3,
    tags: Object.freeze(["mid", "money", "weapon", "ability"]),
    matchChance: CASINO_BALANCE.mid.matchChance,
    symbolWeights: CASINO_BALANCE.mid.symbolWeights,
    description: "BETTER SYMBOL POOL"
  }),
  [CASINO_STAKE_IDS.HIGH]: Object.freeze({
    id: CASINO_STAKE_IDS.HIGH,
    name: "HIGH BET",
    cost: CASINO_BALANCE.high.cost,
    reels: 3,
    tags: Object.freeze(["high", "money", "jackpot", "static"]),
    matchChance: CASINO_BALANCE.high.matchChance,
    symbolWeights: CASINO_BALANCE.high.symbolWeights,
    description: "RARE / STATIC RISK"
  })
});

export function getCasinoStake(stakeId) {
  return CASINO_STAKES[stakeId] || null;
}

export function casinoStakeIsKnown(stakeId) {
  return !!getCasinoStake(stakeId);
}
