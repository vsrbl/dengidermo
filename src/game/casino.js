import { PLAYER_RADIUS } from "../core/constants.js";
import { dist2 } from "../core/math.js";
import { INTERACTABLE_CATEGORIES, getInteractable } from "../data/interactables.js";
import { CASINO_MACHINE_STATES, getCasinoMachine } from "../data/casinoMachines.js";
import { CASINO_STAKES, getCasinoStake } from "../data/casinoStakes.js";
import { CASINO_SYMBOLS, getCasinoSymbol } from "../data/casinoSymbols.js";
import { CASINO_OUTCOME_ACTION_TYPES, getCasinoOutcome } from "../data/casinoOutcomes.js";
import { REWARD_TYPES } from "../data/rewardTypes.js";
import { addSpark, pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { ensurePlayerEconomy, grantMoney, grantXp, spendMoney } from "./playerEconomy.js";
import { executeReward } from "./rewardResolver.js";

const SPIN_COOLDOWN = 0.62;

export function isCasinoInteractableData(data) {
  return data?.category === INTERACTABLE_CATEGORIES.CASINO && !!getCasinoMachine(data.casinoMachineId);
}

export function createCasinoRuntimeFields(data) {
  const machine = getCasinoMachine(data?.casinoMachineId);
  if (!machine) return {};
  return {
    casinoMachineId: machine.id,
    casinoState: CASINO_MACHINE_STATES.IDLE,
    casinoLabel: machine.visual?.label || machine.name,
    casinoGlyph: machine.visual?.glyph || "777",
    casinoAllowedStakes: [...(machine.allowedStakes || [])],
    casinoLastResult: null,
    casinoSpinCooldown: 0
  };
}

export function updateCasinoInteractable(interactable, dt = 0.016) {
  if (!interactable?.casinoMachineId) return;
  interactable.casinoSpinCooldown = Math.max(0, (interactable.casinoSpinCooldown || 0) - dt);
  if (interactable.casinoState === CASINO_MACHINE_STATES.REVEALING && interactable.casinoSpinCooldown <= SPIN_COOLDOWN * 0.45) {
    interactable.casinoState = CASINO_MACHINE_STATES.RESOLVED;
  }
  if (interactable.casinoState === CASINO_MACHINE_STATES.RESOLVED && interactable.casinoSpinCooldown <= 0) {
    interactable.casinoState = CASINO_MACHINE_STATES.IDLE;
  }
}

function allowedStake(machine, stakeId) {
  return !!machine && machine.allowedStakes.includes(stakeId) && !!getCasinoStake(stakeId);
}

function symbolWeight(stake, symbol) {
  const override = stake?.symbolWeights?.[symbol.id];
  return Math.max(0, Number.isFinite(override) ? override : (symbol.weight || 0));
}

function weightedSymbol(state, machine, stake, excluded = new Set()) {
  const pool = (machine?.symbolPool || [])
    .map((id) => getCasinoSymbol(id))
    .filter((symbol) => symbol && !excluded.has(symbol.id));
  const total = pool.reduce((sum, symbol) => sum + symbolWeight(stake, symbol), 0);
  if (!pool.length || total <= 0) return "coin";
  let roll = (state.rng?.next?.() ?? 0.5) * total;
  for (const symbol of pool) {
    roll -= symbolWeight(stake, symbol);
    if (roll <= 0) return symbol.id;
  }
  return pool[pool.length - 1].id;
}

function resolveSymbols(state, machine, stake) {
  const count = Math.max(3, Math.floor(stake?.reels || 3));
  const shouldMatch = (state.rng?.next?.() ?? 0.5) < Math.max(0, Math.min(1, stake?.matchChance || 0));
  if (shouldMatch) {
    const matched = weightedSymbol(state, machine, stake);
    return Array.from({ length: count }, () => matched);
  }

  const symbols = [];
  for (let i = 0; i < count; i += 1) symbols.push(weightedSymbol(state, machine, stake));
  const accidentalMatch = symbols.length > 0 && symbols.every((symbol) => symbol === symbols[0]);
  if (accidentalMatch && (machine?.symbolPool || []).length > 1) {
    symbols[symbols.length - 1] = weightedSymbol(state, machine, stake, new Set([symbols[0]]));
  }
  return symbols;
}

function symbolLabels(symbols) {
  return symbols.map((id) => CASINO_SYMBOLS[id]?.label || String(id).toUpperCase());
}

function scatterCasinoRewardPosition(state, interactable, index = 0, count = 1) {
  const angle = count > 1 ? (Math.PI * 2 * index) / count : (state.rng?.range?.(0, Math.PI * 2) ?? 0);
  const distance = 30 + (index % 3) * 10;
  return {
    x: interactable.x + Math.cos(angle) * distance,
    y: interactable.y + Math.sin(angle) * distance
  };
}

function casinoRewardFromModifierAction(action) {
  return {
    type: REWARD_TYPES.MODIFIER_INJECTION,
    modifierId: action.modifierId,
    text: action.text || "DEBT SIGNAL",
    apply: "next_room"
  };
}

function actionSummary(action, result) {
  if (!action) return null;
  if (action.type === CASINO_OUTCOME_ACTION_TYPES.MONEY && result?.ok) return { type: "money", amount: result.amount };
  if (action.type === CASINO_OUTCOME_ACTION_TYPES.XP && result?.ok) return { type: "xp", amount: result.amount, levelsGained: result.levelsGained || 0 };
  if (action.type === CASINO_OUTCOME_ACTION_TYPES.REWARD && result) return { type: "reward", rewardType: action.reward?.type || null, kind: action.reward?.kind || null, abilityId: action.reward?.abilityId || null };
  if (action.type === CASINO_OUTCOME_ACTION_TYPES.MODIFIER_INJECTION && result) return { type: "modifier_injection", modifierId: action.modifierId, applyRunDepth: result.applyRunDepth || null };
  return null;
}

export function applyCasinoOutcome(state, player, interactable, machine, stake, symbols, context = {}) {
  const match = symbols.length > 0 && symbols.every((symbol) => symbol === symbols[0]);
  if (!match) {
    return {
      match: false,
      matchedSymbol: null,
      outcomeId: "loss",
      outcomeLabel: "BUST",
      payoutText: `LOST $${stake.cost}`,
      payoutApplied: false,
      rewards: []
    };
  }

  const matchedSymbol = symbols[0];
  const outcome = getCasinoOutcome(stake.id, matchedSymbol);
  if (!outcome) {
    return {
      match: true,
      matchedSymbol,
      outcomeId: "unknown_match",
      outcomeLabel: "NO TABLE",
      payoutText: "NO PAYOUT",
      payoutApplied: false,
      rewards: []
    };
  }

  const actions = outcome.actions || [];
  const rewards = [];
  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i];
    const rewardPosition = scatterCasinoRewardPosition(state, interactable, i, actions.length);
    const actionContext = {
      sourceType: "casino",
      sourceId: interactable.id,
      playerId: player.id,
      machineId: machine.id,
      stakeId: stake.id,
      symbolId: matchedSymbol,
      outcomeId: outcome.id,
      claimScope: "team"
    };
    let applied = null;
    if (action.type === CASINO_OUTCOME_ACTION_TYPES.MONEY) {
      applied = grantMoney(state, player, action.amount, actionContext);
    } else if (action.type === CASINO_OUTCOME_ACTION_TYPES.XP) {
      applied = grantXp(state, player, action.amount, actionContext);
    } else if (action.type === CASINO_OUTCOME_ACTION_TYPES.REWARD && action.reward) {
      applied = executeReward(state, action.reward, rewardPosition, actionContext);
    } else if (action.type === CASINO_OUTCOME_ACTION_TYPES.MODIFIER_INJECTION) {
      applied = executeReward(state, casinoRewardFromModifierAction(action), rewardPosition, actionContext);
    }
    const summary = actionSummary(action, applied);
    if (summary) rewards.push(summary);
  }

  return {
    match: true,
    matchedSymbol,
    outcomeId: outcome.id,
    outcomeLabel: outcome.label,
    payoutText: outcome.payoutText,
    payoutApplied: rewards.length > 0,
    rewards
  };
}

export function validateCasinoSpin(state, playerId, request = {}) {
  const player = state?.players?.[playerId];
  if (!state || !player || player.hp <= 0) return { ok: false, reason: "invalid_actor" };
  const interactableId = typeof request.interactableId === "string" ? request.interactableId : null;
  const interactable = interactableId ? state.interactables?.[interactableId] : null;
  if (!interactable) return { ok: false, reason: "unknown_machine" };
  const data = getInteractable(interactable.kind);
  const machine = getCasinoMachine(interactable.casinoMachineId || data?.casinoMachineId);
  if (!data || !machine || data.category !== INTERACTABLE_CATEGORIES.CASINO) return { ok: false, reason: "not_casino" };
  if (interactable.opened || interactable.active === false) return { ok: false, reason: "inactive" };
  if ((interactable.casinoSpinCooldown || 0) > 0) return { ok: false, reason: "spinning" };
  const stakeId = typeof request.stakeId === "string" ? request.stakeId : "";
  const stake = getCasinoStake(stakeId);
  if (!stake || !allowedStake(machine, stakeId)) return { ok: false, reason: "bad_stake" };
  const radius = interactable.interactRadius || data.interactRadius || machine.interactRadius || 62;
  const r = radius + (player.radius || PLAYER_RADIUS);
  if (dist2(player.x, player.y, interactable.x, interactable.y) > r * r) return { ok: false, reason: "too_far" };
  const economy = ensurePlayerEconomy(player);
  if (economy.money < stake.cost) return { ok: false, reason: "not_enough_money", money: economy.money, cost: stake.cost };
  return { ok: true, player, interactable, data, machine, stake };
}

export function requestCasinoSpin(state, playerId, request = {}) {
  const check = validateCasinoSpin(state, playerId, request);
  if (!check.ok) {
    pushEvent(state, {
      type: "casino",
      action: "spin_denied",
      playerId,
      interactableId: typeof request.interactableId === "string" ? request.interactableId : null,
      stakeId: typeof request.stakeId === "string" ? request.stakeId : null,
      reason: check.reason,
      money: check.money ?? null,
      cost: check.cost ?? null
    });
    return { ok: false, reason: check.reason, money: check.money ?? null, cost: check.cost ?? null };
  }

  const { player, interactable, machine, stake } = check;
  const spent = spendMoney(state, player, stake.cost, {
    sourceType: "casino",
    sourceId: interactable.id,
    stakeId: stake.id
  });
  if (!spent.ok) return { ok: false, reason: spent.reason || "spend_failed", money: spent.economy?.money ?? null, cost: stake.cost };

  const symbols = resolveSymbols(state, machine, stake);
  const payout = applyCasinoOutcome(state, player, interactable, machine, stake, symbols, { seq: request.seq });
  const result = {
    ok: true,
    machineId: machine.id,
    interactableId: interactable.id,
    stakeId: stake.id,
    stakeName: stake.name,
    cost: stake.cost,
    symbols,
    symbolLabels: symbolLabels(symbols),
    outcome: payout.match ? payout.outcomeId : "loss",
    outcomeId: payout.outcomeId,
    outcomeLabel: payout.outcomeLabel,
    payoutText: payout.payoutText,
    matchedSymbol: payout.matchedSymbol,
    match: payout.match,
    payoutApplied: payout.payoutApplied,
    rewards: payout.rewards,
    rewardCount: payout.rewards.length,
    money: ensurePlayerEconomy(player).money,
    seq: Number.isFinite(request.seq) ? request.seq : 0
  };

  interactable.casinoState = CASINO_MACHINE_STATES.REVEALING;
  interactable.casinoSpinCooldown = SPIN_COOLDOWN;
  interactable.casinoLastResult = result;
  interactable.lastSpunBy = player.id;

  addSpark(state, interactable.x, interactable.y, result.match ? 22 : 10, result.match ? 190 : 145, result.match ? "#00ff66" : "#ff3048");
  pushVisualEffect(state, {
    type: "damageText",
    x: Math.round(interactable.x),
    y: Math.round(interactable.y - (interactable.radius || 28) - 18),
    text: result.match ? String(result.outcomeLabel || "PAYOUT").slice(0, 16) : "BUST",
    color: result.match ? "#00ff66" : "#ff3048",
    life: 0.72,
    maxLife: 0.72
  });
  pushEvent(state, {
    type: "casino",
    action: "spin_resolved",
    playerId: player.id,
    interactableId: interactable.id,
    machineId: machine.id,
    stakeId: stake.id,
    cost: stake.cost,
    symbols: [...symbols],
    outcome: result.outcome,
    outcomeLabel: result.outcomeLabel,
    payoutText: result.payoutText,
    matchedSymbol: result.matchedSymbol,
    match: result.match,
    payoutApplied: result.payoutApplied,
    rewardCount: result.rewardCount,
    money: result.money
  });
  return result;
}

export function casinoSpinResultSnapshot(result) {
  if (!result || typeof result !== "object") return null;
  return {
    ok: !!result.ok,
    reason: result.reason || null,
    machineId: result.machineId || null,
    interactableId: result.interactableId || null,
    stakeId: result.stakeId || null,
    stakeName: result.stakeName || null,
    cost: Number.isFinite(result.cost) ? result.cost : null,
    symbols: Array.isArray(result.symbols) ? [...result.symbols] : [],
    symbolLabels: Array.isArray(result.symbolLabels) ? [...result.symbolLabels] : [],
    outcome: result.outcome || null,
    outcomeId: result.outcomeId || null,
    outcomeLabel: result.outcomeLabel || null,
    payoutText: result.payoutText || null,
    matchedSymbol: result.matchedSymbol || null,
    match: !!result.match,
    payoutApplied: !!result.payoutApplied,
    rewards: Array.isArray(result.rewards) ? result.rewards.map((reward) => ({ ...reward })) : [],
    rewardCount: Number.isFinite(result.rewardCount) ? result.rewardCount : 0,
    money: Number.isFinite(result.money) ? result.money : null,
    seq: Number.isFinite(result.seq) ? result.seq : 0
  };
}
