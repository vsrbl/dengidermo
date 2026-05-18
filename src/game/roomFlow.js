import { CENTER, GREEN, WORLD } from "../core/constants.js";
import { getLocation } from "../data/locations.js";
import { devPortalDelay, devPortalHold } from "./dev.js";
import { resetDirectorState } from "./director.js";
import { healPlayer } from "./effects.js";
import { pushVisualEffect } from "./effectCommands.js";
import { nextId } from "./entityIds.js";
import { pushEvent } from "./events.js";
import { spawnPoint } from "./state.js";
import { clearLocationRuntimeObjects } from "./runtimeReset.js";
import { offerUpgradesToPlayers } from "./upgrades.js";

export const PORTAL_RADIUS = 58;
export const PORTAL_MARGIN = 12;

function runDepthFor(state, fallback = 0) {
  if (Number.isFinite(state?.runDepth)) return state.runDepth;
  if (Number.isFinite(state?.locationIndex)) return state.locationIndex;
  return fallback;
}

export function currentRunDepth(state) {
  return runDepthFor(state, 0);
}

export function currentLocation(state) {
  return getLocation(currentRunDepth(state));
}

function applyLocationFields(state, loc) {
  // v38.5: locationIndex remains a legacy alias for run depth so older tests
  // and snapshots keep working. roomSequenceIndex is the data-room index.
  state.runDepth = Number.isFinite(loc.runDepth) ? loc.runDepth : currentRunDepth(state);
  state.locationIndex = state.runDepth;
  state.roomSequenceIndex = Number.isFinite(loc.sequenceIndex) ? loc.sequenceIndex : loc.index || 0;
  state.locationId = loc.id;
  state.locationName = loc.name;
  state.biomeId = loc.biomeId;
  state.biomeName = loc.biomeName;
}

export function createExitPortal(state) {
  if (!state.portals) state.portals = {};
  const loc = currentLocation(state);
  const id = nextId("pt");
  state.portals[id] = {
    id,
    kind: "exit",
    x: WORLD.w - 190,
    y: CENTER.y,
    radius: PORTAL_RADIUS,
    active: false,
    progress: 0,
    targetIndex: loc.portalTargetDepth ?? loc.portalTargetIndex ?? (currentRunDepth(state) + 1),
    targetDepth: loc.portalTargetDepth ?? (currentRunDepth(state) + 1)
  };
  return state.portals[id];
}

export function clearLocationRuntime(state, options = {}) {
  // ARCHITECTURE GUARD: this is the official location-scoped runtime reset
  // pipeline. Do not hand-clear enemies/projectiles/companions/portals in
  // portals.js or director code. Players, inventory, upgrades and run progress
  // intentionally survive room transitions.
  clearLocationRuntimeObjects(state, options);
}

export function enterLocation(state, runDepth = 0, options = {}) {
  const loc = getLocation(runDepth);
  applyLocationFields(state, loc);
  state.locationTime = 0;
  state.portalReadyAt = devPortalDelay(state, loc.portalDelay);
  state.portalHold = devPortalHold(state, loc.portalHold);
  state.spawnTimer = loc.director?.spawnStartDelay ?? 0.8;
  state.wave = 0;
  state.bossSpawned = false;
  resetDirectorState(state, loc);
  if (options.createPortal !== false) createExitPortal(state);
  return loc;
}

export function initLocation(state, runDepth = 0, options = {}) {
  if (options.clearRuntime) clearLocationRuntime(state, { keepEvents: !!options.keepEvents, keepEffects: !!options.keepEffects });
  else state.portals = {};
  return enterLocation(state, runDepth, { createPortal: options.createPortal !== false });
}

function repositionAndReviveTeam(state) {
  const ids = Object.keys(state.players || {}).sort();
  for (const [index, id] of ids.entries()) {
    const player = state.players[id];
    const p = spawnPoint(index);
    player.x = p.x;
    player.y = p.y;
    player.vx = 0;
    player.vy = 0;
    player.kx = 0;
    player.ky = 0;
    healPlayer(state, player, { amount: 18, sourceType: "portal", tags: ["portal"], allowRevive: true, minHp: 1 });
    player.deadTimer = 0;
  }
}

export function beginRoomTransition(state, reason = "portal", options = {}) {
  const fromDepth = currentRunDepth(state);
  const nextDepth = Number.isFinite(options.nextRunDepth) ? options.nextRunDepth : fromDepth + 1;
  const transitionFx = options.fx || null;

  clearLocationRuntime(state);
  const nextLoc = enterLocation(state, nextDepth, { createPortal: true });
  repositionAndReviveTeam(state);

  if (options.offerUpgrades !== false) offerUpgradesToPlayers(state, options.offerCount || 3);

  pushEvent(state, {
    type: "location",
    reason,
    runDepth: nextDepth,
    roomSequenceIndex: nextLoc.sequenceIndex,
    locationId: nextLoc.id,
    locationName: nextLoc.name,
    biomeId: nextLoc.biomeId,
    x: CENTER.x,
    y: CENTER.y
  });

  if (transitionFx) pushVisualEffect(state, transitionFx);
  return nextLoc;
}

export function moveTeamToNextLocation(state) {
  const loc = currentLocation(state);
  return beginRoomTransition(state, "portal", { nextRunDepth: loc.portalTargetDepth ?? loc.portalTargetIndex ?? (currentRunDepth(state) + 1) });
}

export function makePortalTransitionEffect(portal) {
  return {
    type: "portal",
    x: portal.x,
    y: portal.y,
    radius: portal.radius + 42,
    life: 0.35,
    maxLife: 0.35,
    color: GREEN
  };
}
