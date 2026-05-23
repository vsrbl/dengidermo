import { CENTER, GREEN } from "../core/constants.js";
import { getLocationFromRoomPlan, getPlannedLocationForState, normalizeRoomPlan, resolveRoomPlan } from "./runPlanner.js";
import { portalPointForLocation, roomGeometryIdentity } from "./roomGeometry.js";
import { devPortalDelay, devPortalHold } from "./dev.js";
import { resetDirectorState } from "./director.js";
import { healPlayer } from "./effects.js";
import { pushVisualEffect } from "./effectCommands.js";
import { nextId } from "./entityIds.js";
import { pushEvent } from "./events.js";
import { spawnPoint } from "./state.js";
import { clearLocationRuntimeObjects } from "./runtimeReset.js";
import { offerUpgradesToPlayers } from "./upgrades.js";
import { enterRoomModifierRuntime, exitRoomModifierRuntime } from "./roomModifiers.js";
import { spawnLocationInteractables } from "./interactables.js";
import { consumePendingRoomModifiersForDepth, pendingRoomModifierIdsForDepth } from "./pendingRoomModifiers.js";

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
  return getPlannedLocationForState(state, currentRunDepth(state));
}

function applyLocationFields(state, loc, plan = loc?.plan || null) {
  const normalizedPlan = normalizeRoomPlan(plan, Number.isFinite(loc?.runDepth) ? loc.runDepth : currentRunDepth(state), { seed: state?.roomId || null });
  // v38.5: locationIndex remains a legacy alias for run depth so older tests
  // and snapshots keep working. roomSequenceIndex is the data-room index.
  // v38.9: roomPlan is now the persistent source of room identity; these
  // scalar fields are compatibility mirrors for older systems and HUD/debug.
  state.roomPlan = normalizedPlan;
  state.runDepth = normalizedPlan.runDepth;
  state.locationIndex = state.runDepth;
  state.roomSequenceIndex = normalizedPlan.roomSequenceIndex;
  state.loopIndex = normalizedPlan.loopIndex;
  state.roomInLoop = normalizedPlan.roomInLoop;
  state.roomCategory = normalizedPlan.category || loc.category || "normal";
  state.layoutId = normalizedPlan.layoutId || loc.layoutId || "open_arena";
  state.roomModifierIds = [...(normalizedPlan.modifierIds || loc.modifierIds || [])];
  state.locationId = loc.id;
  state.locationName = loc.name;
  state.biomeId = loc.biomeId;
  state.biomeName = loc.biomeName;
}

export function createExitPortal(state) {
  if (!state.portals) state.portals = {};
  const loc = currentLocation(state);
  const id = nextId("pt");
  const portalPoint = portalPointForLocation(loc);
  state.portals[id] = {
    id,
    kind: "exit",
    x: portalPoint.x,
    y: portalPoint.y,
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
  const injectedModifierIds = pendingRoomModifierIdsForDepth(state, runDepth);
  const planOptions = { seed: state?.roomId || null, createdAt: state?.tick || 0, injectedModifierIds };
  const plan = normalizeRoomPlan(
    options.roomPlan || resolveRoomPlan(runDepth, planOptions),
    runDepth,
    planOptions
  );
  const loc = getLocationFromRoomPlan(plan);
  applyLocationFields(state, loc, plan);
  consumePendingRoomModifiersForDepth(state, plan.runDepth);
  state.locationTime = 0;
  state.portalReadyAt = devPortalDelay(state, loc.portalDelay);
  state.portalHold = devPortalHold(state, loc.portalHold);
  state.spawnTimer = loc.director?.spawnStartDelay ?? 0.8;
  state.wave = 0;
  state.bossSpawned = false;
  resetDirectorState(state, loc);
  enterRoomModifierRuntime(state, loc, { reason: options.reason || "enter", runDepth: plan.runDepth });
  spawnLocationInteractables(state, loc);
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
    const p = spawnPoint(index, currentLocation(state), player.radius || 13);
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

  const fromLoc = currentLocation(state);
  exitRoomModifierRuntime(state, fromLoc, { reason, nextRunDepth: nextDepth });
  clearLocationRuntime(state);
  const nextLoc = enterLocation(state, nextDepth, { createPortal: true, reason });
  repositionAndReviveTeam(state);

  if (options.offerUpgrades !== false) offerUpgradesToPlayers(state, options.offerCount || 3);

  const geometry = roomGeometryIdentity(nextLoc);
  pushEvent(state, {
    type: "location",
    reason,
    runDepth: nextDepth,
    roomSequenceIndex: nextLoc.sequenceIndex,
    baseRoomId: state.roomPlan?.baseRoomId || nextLoc.baseRoomId || nextLoc.id,
    resolvedRoomId: state.roomPlan?.resolvedRoomId || nextLoc.id,
    ruleId: state.roomPlan?.ruleId || null,
    locationId: nextLoc.id,
    locationName: nextLoc.name,
    biomeId: nextLoc.biomeId,
    category: nextLoc.category || "normal",
    layoutId: geometry.layoutId,
    layoutVersion: geometry.layoutVersion,
    geometryHash: geometry.geometryHash,
    modifiers: [...(nextLoc.modifierIds || [])],
    modifierStack: state.roomPlan?.modifierStack || nextLoc.modifierStack || null,
    interactablePlan: [...(state.roomPlan?.interactablePlan || nextLoc.interactablePlan || [])],
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
