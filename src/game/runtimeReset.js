import { resetThreatAnalyzer } from "./threat.js";
import { resetKillCombos } from "./killCombos.js";

export function clearHostileRuntime(state, options = {}) {
  state.enemies = {};
  state.projectiles = {};
  if (!options.keepEffects) state.effects = [];
  resetThreatAnalyzer(state);
}

export function clearLocationRuntimeObjects(state, options = {}) {
  // Official location-scoped runtime reset boundary. Keep players, inventory,
  // upgrades and run progression alive; clear only live room entities/state.
  clearHostileRuntime(state, { keepEffects: !!options.keepEffects });
  state.companions = {};
  state.loot = {};
  state.rewardPickups = {};
  state.economyPickups = {};
  state.interactables = {};
  state.events = options.keepEvents ? (state.events || []) : [];
  resetKillCombos(state, { reason: options.reason || "room_end" });
  state.portals = {};
  state.director = null;
  resetThreatAnalyzer(state);
}
