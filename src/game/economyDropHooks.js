import { ECONOMY_PICKUP_TYPES, normalizeEconomyAmount } from "../data/economy.js";
import { RULE_MODIFIER_IDS } from "../data/ruleModifiers.js";
import { hasRoomModifier } from "./roomModifiers.js";
import { resolveLootRoll } from "./effects.js";

export const ECONOMY_DROP_HOOK_SCHEMA_VERSION = 1;
export const ECONOMY_DROP_PROC_TYPES = Object.freeze({
  LUCK_VALUE: "luck_value",
  MODIFIER_VALUE: "modifier_value"
});

const RARE_VALUE_BOOST_BASE = 1.2;
const RARE_VALUE_BOOST_SCALE = 1.0;

function clamp01(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function hasLuck(player) {
  return (player?.upgrades?.taken?.luck || 0) > 0;
}

function hasAlgorithmBoost(state) {
  return hasRoomModifier(state, RULE_MODIFIER_IDS.ALGORITHM_BOOST);
}

function rollAmount(rng, amount) {
  if (Array.isArray(amount) && amount.length === 2) {
    const min = Math.floor(Math.min(amount[0], amount[1]));
    const max = Math.floor(Math.max(amount[0], amount[1]));
    if (max <= min) return normalizeEconomyAmount(min, 0);
    return normalizeEconomyAmount(Math.floor(rng.range(min, max + 1)), min);
  }
  return normalizeEconomyAmount(amount, 0);
}

function eliteMultiplier(enemy) {
  return enemy?.elite ? 1.65 : 1;
}

function procTextFor(entry, hook) {
  if (!hook?.luckProc) return null;
  if (entry.type === ECONOMY_PICKUP_TYPES.MONEY) return "LUCK GLD";
  if (entry.type === ECONOMY_PICKUP_TYPES.XP) return "LUCK EXP";
  if (entry.type === ECONOMY_PICKUP_TYPES.HEAL) return "LUCK HEA";
  return "LUCK PROC";
}

export function resolveEconomyDropHook(state, enemy, entry, context = {}) {
  const sourcePlayer = context.playerId ? state?.players?.[context.playerId] : null;
  const sourceContractId = context.sourceContractId || null;
  const baseChance = clamp01(entry.chance);
  const tags = ["economy", "enemy_drop", entry.type, sourceContractId].filter(Boolean);
  const hookRoll = sourcePlayer
    ? resolveLootRoll(state, sourcePlayer, { chance: baseChance, tags })
    : { chance: baseChance, baseChance, rareBonus: 0, tags };
  const chance = clamp01(hookRoll.chance);
  const rareBonus = clamp01(hookRoll.rareBonus || 0);
  const chanceRoll = state.rng.next();

  if (chanceRoll > chance) {
    return {
      hit: false,
      chance,
      baseChance,
      chanceRoll,
      rareBonus,
      sourcePlayerId: sourcePlayer?.id || null,
      sourceContractId,
      tags: hookRoll.tags || tags
    };
  }

  const rareRollValue = state.rng.next();
  const rareRoll = rareBonus > 0 && rareRollValue < rareBonus;
  const rolledAmount = rollAmount(state.rng, entry.amount);
  const valueMult = rareRoll ? (RARE_VALUE_BOOST_BASE + rareBonus * RARE_VALUE_BOOST_SCALE) : 1;
  const amount = Math.max(1, Math.round(rolledAmount * eliteMultiplier(enemy) * valueMult));
  const luckProc = rareRoll && hasLuck(sourcePlayer);
  const modifierProc = rareRoll && !luckProc && hasAlgorithmBoost(state);

  return {
    hit: true,
    chance,
    baseChance,
    chanceRoll,
    rareBonus,
    rareRollValue,
    rareRoll,
    valueMult,
    amount,
    sourcePlayerId: sourcePlayer?.id || null,
    sourceContractId,
    tags: hookRoll.tags || tags,
    luckProc,
    modifierProc,
    procType: luckProc ? ECONOMY_DROP_PROC_TYPES.LUCK_VALUE : modifierProc ? ECONOMY_DROP_PROC_TYPES.MODIFIER_VALUE : null,
    procText: procTextFor(entry, { luckProc, modifierProc })
  };
}
