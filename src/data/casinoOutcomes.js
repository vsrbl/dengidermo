import { ABILITY_IDS } from "./abilities.js";
import { CASINO_STAKE_IDS } from "./casinoStakes.js";
import { CASINO_BALANCE } from "./economyBalance.js";
import { CASINO_SYMBOL_IDS } from "./casinoSymbols.js";
import { REWARD_TYPES } from "./rewardTypes.js";

export const CASINO_OUTCOME_ACTION_TYPES = Object.freeze({
  MONEY: "money",
  XP: "xp",
  REWARD: "reward",
  MODIFIER_INJECTION: "modifier_injection"
});

function money(amount) {
  return Object.freeze({ type: CASINO_OUTCOME_ACTION_TYPES.MONEY, amount });
}

function xp(amount) {
  return Object.freeze({ type: CASINO_OUTCOME_ACTION_TYPES.XP, amount });
}

function reward(data) {
  return Object.freeze({ type: CASINO_OUTCOME_ACTION_TYPES.REWARD, reward: Object.freeze({ ...data }) });
}

function modifier(modifierId, text = "DEBT SIGNAL") {
  return Object.freeze({ type: CASINO_OUTCOME_ACTION_TYPES.MODIFIER_INJECTION, modifierId, text });
}

export const CASINO_OUTCOMES = Object.freeze({
  [CASINO_STAKE_IDS.LOW]: Object.freeze({
    [CASINO_SYMBOL_IDS.COIN]: Object.freeze({
      id: "low_coin",
      label: "COIN PAYOUT",
      payoutText: `+$${CASINO_BALANCE.low.payouts.coin}`,
      actions: Object.freeze([money(CASINO_BALANCE.low.payouts.coin)])
    }),
    [CASINO_SYMBOL_IDS.HEART]: Object.freeze({
      id: "low_heart",
      label: "HEART PAYOUT",
      payoutText: "HEAL PICKUP",
      actions: Object.freeze([reward({ type: REWARD_TYPES.LOOT, kind: "heal", text: "HEART" })])
    }),
    [CASINO_SYMBOL_IDS.XP]: Object.freeze({
      id: "low_xp",
      label: "XP PAYOUT",
      payoutText: `+${CASINO_BALANCE.low.payouts.xp} XP`,
      actions: Object.freeze([xp(CASINO_BALANCE.low.payouts.xp)])
    }),
    [CASINO_SYMBOL_IDS.WEAPON]: Object.freeze({
      id: "low_weapon",
      label: "WEAPON PAYOUT",
      payoutText: "SEEKER",
      actions: Object.freeze([reward({ type: REWARD_TYPES.LOOT, kind: "seeker", text: "WEAPON" })])
    }),
    [CASINO_SYMBOL_IDS.ABILITY]: Object.freeze({
      id: "low_ability",
      label: "ABILITY PAYOUT",
      payoutText: "DASH SHARD",
      actions: Object.freeze([reward({ type: REWARD_TYPES.ABILITY_SHARD, abilityId: ABILITY_IDS.TELEPORT_DASH, amount: 1, text: "SHARD" })])
    }),
    [CASINO_SYMBOL_IDS.STATIC]: Object.freeze({
      id: "low_static",
      label: "STATIC DEBT",
      payoutText: "NEXT ROOM DANGER",
      actions: Object.freeze([
        money(CASINO_BALANCE.low.payouts.staticMoney),
        modifier("live_chat_hates_you", "DEBT SIGNAL")
      ])
    }),
    [CASINO_SYMBOL_IDS.JACKPOT]: Object.freeze({
      id: "low_jackpot",
      label: "JACKPOT",
      payoutText: `+$${CASINO_BALANCE.low.payouts.jackpotMoney} / ACTIVE`,
      actions: Object.freeze([
        money(CASINO_BALANCE.low.payouts.jackpotMoney),
        reward({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, text: "JACKPOT" })
      ])
    })
  }),

  [CASINO_STAKE_IDS.MID]: Object.freeze({
    [CASINO_SYMBOL_IDS.COIN]: Object.freeze({
      id: "mid_coin",
      label: "COIN PAYOUT",
      payoutText: `+$${CASINO_BALANCE.mid.payouts.coin}`,
      actions: Object.freeze([money(CASINO_BALANCE.mid.payouts.coin)])
    }),
    [CASINO_SYMBOL_IDS.HEART]: Object.freeze({
      id: "mid_heart",
      label: "HEART PAYOUT",
      payoutText: "HEAL BURST",
      actions: Object.freeze([
        reward({ type: REWARD_TYPES.LOOT, kind: "heal", text: "HEART" }),
        reward({ type: REWARD_TYPES.LOOT, kind: "heal", text: "HEART" })
      ])
    }),
    [CASINO_SYMBOL_IDS.XP]: Object.freeze({
      id: "mid_xp",
      label: "XP PAYOUT",
      payoutText: `+${CASINO_BALANCE.mid.payouts.xp} XP`,
      actions: Object.freeze([xp(CASINO_BALANCE.mid.payouts.xp)])
    }),
    [CASINO_SYMBOL_IDS.WEAPON]: Object.freeze({
      id: "mid_weapon",
      label: "WEAPON PAYOUT",
      payoutText: "ROCKETGUN",
      actions: Object.freeze([reward({ type: REWARD_TYPES.LOOT, kind: "rocket", text: "WEAPON" })])
    }),
    [CASINO_SYMBOL_IDS.ABILITY]: Object.freeze({
      id: "mid_ability",
      label: "ABILITY PAYOUT",
      payoutText: "ACTIVE CHANCE",
      actions: Object.freeze([reward({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, text: "ACTIVE" })])
    }),
    [CASINO_SYMBOL_IDS.STATIC]: Object.freeze({
      id: "mid_static",
      label: "STATIC PAYOUT",
      payoutText: "REWARD + DEBT",
      actions: Object.freeze([
        money(CASINO_BALANCE.mid.payouts.staticMoney),
        reward({ type: REWARD_TYPES.LOOT, kind: "rocket", text: "STATIC" }),
        modifier("live_chat_hates_you", "DEBT SIGNAL")
      ])
    }),
    [CASINO_SYMBOL_IDS.JACKPOT]: Object.freeze({
      id: "mid_jackpot",
      label: "JACKPOT",
      payoutText: `+$${CASINO_BALANCE.mid.payouts.jackpotMoney} / ACTIVE`,
      actions: Object.freeze([
        money(CASINO_BALANCE.mid.payouts.jackpotMoney),
        reward({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, text: "JACKPOT" })
      ])
    })
  }),

  [CASINO_STAKE_IDS.HIGH]: Object.freeze({
    [CASINO_SYMBOL_IDS.COIN]: Object.freeze({
      id: "high_coin",
      label: "COIN PAYOUT",
      payoutText: `+$${CASINO_BALANCE.high.payouts.coin}`,
      actions: Object.freeze([money(CASINO_BALANCE.high.payouts.coin)])
    }),
    [CASINO_SYMBOL_IDS.HEART]: Object.freeze({
      id: "high_heart",
      label: "HEART PAYOUT",
      payoutText: "TRIPLE HEAL",
      actions: Object.freeze([
        reward({ type: REWARD_TYPES.LOOT, kind: "heal", text: "HEART" }),
        reward({ type: REWARD_TYPES.LOOT, kind: "heal", text: "HEART" }),
        reward({ type: REWARD_TYPES.LOOT, kind: "heal", text: "HEART" })
      ])
    }),
    [CASINO_SYMBOL_IDS.XP]: Object.freeze({
      id: "high_xp",
      label: "XP PAYOUT",
      payoutText: `+${CASINO_BALANCE.high.payouts.xp} XP`,
      actions: Object.freeze([xp(CASINO_BALANCE.high.payouts.xp)])
    }),
    [CASINO_SYMBOL_IDS.WEAPON]: Object.freeze({
      id: "high_weapon",
      label: "WEAPON PAYOUT",
      payoutText: "ROCKET + SEEKER",
      actions: Object.freeze([
        reward({ type: REWARD_TYPES.LOOT, kind: "rocket", text: "WEAPON" }),
        reward({ type: REWARD_TYPES.LOOT, kind: "seeker", text: "WEAPON" })
      ])
    }),
    [CASINO_SYMBOL_IDS.ABILITY]: Object.freeze({
      id: "high_ability",
      label: "ABILITY PAYOUT",
      payoutText: "ACTIVE + SHARD",
      actions: Object.freeze([
        reward({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, text: "ACTIVE" }),
        reward({ type: REWARD_TYPES.ABILITY_SHARD, abilityId: ABILITY_IDS.TELEPORT_DASH, amount: 1, text: "SHARD" })
      ])
    }),
    [CASINO_SYMBOL_IDS.STATIC]: Object.freeze({
      id: "high_static",
      label: "STATIC JACKPOT",
      payoutText: "BIG PAYOUT + DEBT",
      actions: Object.freeze([
        money(CASINO_BALANCE.high.payouts.staticMoney),
        reward({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, text: "STATIC" }),
        modifier("live_chat_hates_you", "DEBT SIGNAL")
      ])
    }),
    [CASINO_SYMBOL_IDS.JACKPOT]: Object.freeze({
      id: "high_jackpot",
      label: "JACKPOT",
      payoutText: `+$${CASINO_BALANCE.high.payouts.jackpotMoney} / RARE`,
      actions: Object.freeze([
        money(CASINO_BALANCE.high.payouts.jackpotMoney),
        reward({ type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH, text: "JACKPOT" }),
        reward({ type: REWARD_TYPES.LOOT, kind: "rocket", text: "JACKPOT" })
      ])
    })
  })
});

export function getCasinoOutcome(stakeId, symbolId) {
  return CASINO_OUTCOMES[stakeId]?.[symbolId] || null;
}

export function casinoOutcomeActionTypeIsKnown(type) {
  return Object.values(CASINO_OUTCOME_ACTION_TYPES).includes(type);
}
