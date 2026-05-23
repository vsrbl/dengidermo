import { CASINO_STAKE_IDS } from "./casinoStakes.js";
import { CASINO_SYMBOL_IDS } from "./casinoSymbols.js";

export const CASINO_MACHINE_IDS = Object.freeze({
  SIGNAL_SLOT: "signal_slot"
});

export const CASINO_MACHINE_STATES = Object.freeze({
  IDLE: "idle",
  OPEN: "open",
  STAKE_SELECTED: "stake_selected",
  SPINNING: "spinning",
  REVEALING: "revealing",
  RESOLVED: "resolved",
  CLOSING: "closing"
});

export const CASINO_MACHINES = Object.freeze({
  [CASINO_MACHINE_IDS.SIGNAL_SLOT]: Object.freeze({
    id: CASINO_MACHINE_IDS.SIGNAL_SLOT,
    name: "SIGNAL SLOT",
    radius: 28,
    interactRadius: 62,
    minSpawnDistance: 175,
    allowedStakes: Object.freeze([CASINO_STAKE_IDS.LOW, CASINO_STAKE_IDS.MID, CASINO_STAKE_IDS.HIGH]),
    symbolPool: Object.freeze([
      CASINO_SYMBOL_IDS.COIN,
      CASINO_SYMBOL_IDS.HEART,
      CASINO_SYMBOL_IDS.XP,
      CASINO_SYMBOL_IDS.WEAPON,
      CASINO_SYMBOL_IDS.ABILITY,
      CASINO_SYMBOL_IDS.STATIC,
      CASINO_SYMBOL_IDS.JACKPOT
    ]),
    visual: Object.freeze({ renderer: "slot_machine", label: "SLOT", accent: "red", glyph: "777" }),
    tags: Object.freeze(["casino", "slot", "money", "risk", "reward"])
  })
});

export function getCasinoMachine(machineId) {
  return CASINO_MACHINES[machineId] || null;
}

export function casinoMachineStateIsKnown(state) {
  return Object.values(CASINO_MACHINE_STATES).includes(state);
}
