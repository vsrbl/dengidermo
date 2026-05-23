import { PLAYER_RADIUS } from "../core/constants.js";
import { dist2 } from "../core/math.js";
import { INTERACTABLE_CATEGORIES, getInteractable } from "../data/interactables.js";
import { CASINO_MACHINE_STATES, getCasinoMachine } from "../data/casinoMachines.js";
import { CASINO_STAKES, getCasinoStake } from "../data/casinoStakes.js";
import { CASINO_SYMBOLS, getCasinoSymbol } from "../data/casinoSymbols.js";
import { addSpark, pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { ensurePlayerEconomy, spendMoney } from "./playerEconomy.js";

const SPIN_COOLDOWN = 0.35;

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

function weightedSymbol(state, machine) {
  const pool = (machine?.symbolPool || []).map((id) => getCasinoSymbol(id)).filter(Boolean);
  const total = pool.reduce((sum, symbol) => sum + Math.max(0, symbol.weight || 0), 0);
  if (!pool.length || total <= 0) return "coin";
  let roll = (state.rng?.next?.() ?? 0.5) * total;
  for (const symbol of pool) {
    roll -= Math.max(0, symbol.weight || 0);
    if (roll <= 0) return symbol.id;
  }
  return pool[pool.length - 1].id;
}

function resolveSymbols(state, machine, stake) {
  const count = Math.max(3, Math.floor(stake?.reels || 3));
  const symbols = [];
  for (let i = 0; i < count; i += 1) symbols.push(weightedSymbol(state, machine));
  return symbols;
}

function symbolLabels(symbols) {
  return symbols.map((id) => CASINO_SYMBOLS[id]?.label || String(id).toUpperCase());
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
  const match = symbols.length > 0 && symbols.every((symbol) => symbol === symbols[0]);
  const outcome = match ? "foundation_match" : "foundation_no_match";
  const result = {
    ok: true,
    machineId: machine.id,
    interactableId: interactable.id,
    stakeId: stake.id,
    stakeName: stake.name,
    cost: stake.cost,
    symbols,
    symbolLabels: symbolLabels(symbols),
    outcome,
    match,
    payoutApplied: false,
    money: ensurePlayerEconomy(player).money,
    seq: Number.isFinite(request.seq) ? request.seq : 0
  };

  interactable.casinoState = CASINO_MACHINE_STATES.REVEALING;
  interactable.casinoSpinCooldown = SPIN_COOLDOWN;
  interactable.casinoLastResult = result;
  interactable.lastSpunBy = player.id;

  addSpark(state, interactable.x, interactable.y, match ? 18 : 10, match ? 185 : 145, match ? "#00ff66" : "#ff3048");
  pushVisualEffect(state, {
    type: "damageText",
    x: Math.round(interactable.x),
    y: Math.round(interactable.y - (interactable.radius || 28) - 18),
    text: match ? "MATCH" : "SPIN",
    color: match ? "#00ff66" : "#ff3048",
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
    outcome,
    match,
    payoutApplied: false,
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
    match: !!result.match,
    payoutApplied: !!result.payoutApplied,
    money: Number.isFinite(result.money) ? result.money : null,
    seq: Number.isFinite(result.seq) ? result.seq : 0
  };
}
