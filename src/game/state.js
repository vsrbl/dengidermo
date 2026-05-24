import { CENTER, PLAYER_HP, PLAYER_RADIUS, SPAWN_OFFSETS, WORLD } from "../core/constants.js";
import { clamp } from "../core/math.js";
import { displayPlayerName } from "../core/names.js";
import { makeRng } from "../core/random.js";
import { getLocationFromRoomPlan, getPlannedLocationForState, resolveRoomPlan } from "./runPlanner.js";
import { clampCircleToLocation, roomGeometryIdentityForState, roomGeometrySnapshot, roomLayoutIdForState } from "./roomGeometry.js";
import { enterRoomModifierRuntime, roomModifierSnapshots } from "./roomModifiers.js";
import { START_WEAPON } from "../data/weapons.js";
import { createInventory, ensureInventory, inventorySnapshot } from "./inventory.js";
import { ensureUpgradeState, upgradeSnapshot } from "./upgrades.js";
import { enemyStatusSnapshot } from "./effects.js";
import { armorSnapshot } from "./enemyArmor.js";
import { enemyEliteSnapshot } from "./enemyElites.js";
import { abilitySnapshot } from "./abilities.js";
import { createAbilityInventory, ensureAbilityInventory, abilityInventorySnapshot } from "./abilityInventory.js";
import { companionSnapshots, companionSummary } from "./companions.js";
import { devPortalDelay, devPortalHold, devSnapshot, installDevMode } from "./dev.js";
import { directorSnapshot } from "./directorRead.js";
import { nextId, resetEntityIds } from "./entityIds.js";
import { pushEvent } from "./events.js";
import { interactableSnapshot, spawnLocationInteractables } from "./interactables.js";
import { rewardPickupSnapshot } from "./rewardPickups.js";
import { pendingRoomModifierSnapshot } from "./pendingRoomModifiers.js";
import { createPlayerEconomy, ensurePlayerEconomy, economySnapshot } from "./playerEconomy.js";
import { economyPickupSnapshot } from "./economyPickups.js";
import { buildPlayerStatSnapshot, syncPlayerStatSnapshot } from "./statSnapshots.js";
import { orbiterPressureSnapshot } from "./orbiterPressure.js";
import { budgetEffects, buildSnapshotBudgetMeta } from "./snapshotBudget.js";

export { nextId } from "./entityIds.js";
export { pushEvent } from "./events.js";

export function createGameState(roomId, options = {}) {
  resetEntityIds();
  const roomPlan = resolveRoomPlan(0, { seed: roomId, createdAt: 0 });
  const location = getLocationFromRoomPlan(roomPlan);
  const state = {
    roomId,
    tick: 0,
    time: 0,
    rng: makeRng(roomId),
    roomPlan,
    runDepth: roomPlan.runDepth,
    loopIndex: location.loopIndex || 0,
    roomInLoop: location.roomInLoop || 0,
    roomSequenceIndex: location.sequenceIndex || 0,
    locationIndex: 0,
    roomCategory: location.category || "normal",
    layoutId: location.layoutId || "open_arena",
    roomModifierIds: [...(location.modifierIds || [])],
    locationId: location.id,
    locationName: location.name,
    biomeId: location.biomeId,
    biomeName: location.biomeName,
    locationTime: 0,
    portalReadyAt: location.portalDelay,
    portalHold: location.portalHold,
    players: {},
    enemies: {},
    projectiles: {},
    companions: {},
    loot: {},
    rewardPickups: {},
    economyPickups: {},
    interactables: {},
    pendingRoomModifiers: [],
    portals: {},
    effects: [],
    events: [],
    killCombos: {},
    spawnTimer: location.director?.spawnStartDelay ?? 0.8,
    wave: 0,
    bossSpawned: false,
    director: null,
    roomModifierRuntime: null
  };
  enterRoomModifierRuntime(state, location, { reason: "create", runDepth: roomPlan.runDepth });
  spawnLocationInteractables(state, location);
  installDevMode(state, options.dev);
  state.portalReadyAt = devPortalDelay(state, location.portalDelay);
  state.portalHold = devPortalHold(state, location.portalHold);
  return state;
}

export function spawnPoint(index = 0, loc = null, radius = PLAYER_RADIUS) {
  const off = SPAWN_OFFSETS[index % SPAWN_OFFSETS.length];
  const point = {
    x: clamp(CENTER.x + off.x, 24, WORLD.w - 24),
    y: clamp(CENTER.y + off.y, 24, WORLD.h - 24)
  };
  if (!loc) return point;
  const clamped = clampCircleToLocation(roomGeometrySnapshot(loc), point.x, point.y, radius);
  return { x: clamped.x, y: clamped.y };
}

export function addPlayer(state, playerId, index = 0, options = {}) {
  const p = spawnPoint(index, { layoutId: roomLayoutIdForState(state) });
  state.players[playerId] = {
    id: playerId,
    name: displayPlayerName(options.name, playerId.toUpperCase()),
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    angle: 0,
    hp: PLAYER_HP,
    maxHp: PLAYER_HP,
    radius: PLAYER_RADIUS,
    inventory: createInventory([START_WEAPON]),
    abilityInventory: createAbilityInventory(),
    economy: createPlayerEconomy(),
    stats: {
      speedMult: 1,
      fireRateMult: 1,
      damageMult: 1,
      projectileSpeedMult: 1,
      explosionRadiusMult: 1,
      explosionDamageMult: 1,
      knockbackMult: 1
    },
    upgrades: { choices: [], taken: {}, offered: {}, offers: {}, pending: false, offerSeq: 0, offerSource: null, requiresPendingUpgrade: false, queueRemainingAtOffer: 0, levelQueueSeqAtOffer: 0 },
    skin: index % 2 ? "green" : "default",
    cooldowns: {},
    lastInputAt: 0,
    fireSeqSeen: 0,
    deadTimer: 0,
    statSnapshot: null
  };
  syncPlayerStatSnapshot(state, state.players[playerId]);
  return state.players[playerId];
}

export function removePlayer(state, playerId) {
  delete state.players[playerId];
}

export function respawnPlayer(player, index = 0, loc = null) {
  const p = spawnPoint(index, loc, player.radius || PLAYER_RADIUS);
  player.x = p.x;
  player.y = p.y;
  player.vx = 0;
  player.vy = 0;
  player.kx = 0;
  player.ky = 0;
  player.hp = player.maxHp;
  ensureInventory(player);
  ensureAbilityInventory(player);
  ensurePlayerEconomy(player);
  ensureUpgradeState(player);
  player.deadTimer = 0;
  syncPlayerStatSnapshot(null, player);
}

export function makeSnapshot(state) {
  const fallbackDepth = Number.isFinite(state.runDepth) ? state.runDepth : (state.locationIndex || 0);
  const location = getPlannedLocationForState(state, fallbackDepth);
  const plan = state.roomPlan || location.plan || null;
  const depth = Number.isFinite(plan?.runDepth) ? plan.runDepth : (Number.isFinite(location.runDepth) ? location.runDepth : fallbackDepth);
  const layoutId = roomLayoutIdForState(state) || location.layoutId || "open_arena";
  const geometry = roomGeometryIdentityForState(state);
  const hold = state.portalHold || location.portalHold || 1.15;
  const companionPacket = companionSnapshots(state);
  const effectPacket = budgetEffects(state.effects);
  const snapshot = {
    tick: state.tick,
    time: Number(state.time.toFixed(3)),
    location: {
      id: location.id || state.locationId,
      name: location.name || state.locationName,
      index: depth,
      runDepth: depth,
      loopIndex: Number.isFinite(plan?.loopIndex) ? plan.loopIndex : (Number.isFinite(state.loopIndex) ? state.loopIndex : (location.loopIndex || 0)),
      roomInLoop: Number.isFinite(plan?.roomInLoop) ? plan.roomInLoop : (Number.isFinite(state.roomInLoop) ? state.roomInLoop : (location.roomInLoop || 0)),
      roomSequenceIndex: Number.isFinite(plan?.roomSequenceIndex) ? plan.roomSequenceIndex : (Number.isFinite(state.roomSequenceIndex) ? state.roomSequenceIndex : (location.sequenceIndex || location.index || 0)),
      baseRoomId: plan?.baseRoomId || location.baseRoomId || location.id,
      resolvedRoomId: plan?.resolvedRoomId || plan?.roomId || location.id,
      ruleId: plan?.ruleId || null,
      roomPoolId: plan?.roomPoolId || location.roomPoolId || null,
      routeNodeId: plan?.routeNodeId || location.routeNodeId || null,
      routeNodeType: plan?.routeNodeType || location.routeNodeType || null,
      activityId: plan?.activityId || location.activityId || null,
      environmentThemeId: plan?.environmentThemeId || location.environmentThemeId || null,
      environmentPropSetId: plan?.environmentPropSetId || location.environmentPropSetId || null,
      seed: plan?.seed || null,
      category: plan?.category || state.roomCategory || location.category || "normal",
      tags: [...(location.tags || [])],
      layoutId: geometry.layoutId,
      layoutVersion: geometry.layoutVersion,
      geometryHash: geometry.geometryHash,
      modifiers: roomModifierSnapshots(location),
      modifierStack: plan?.modifierStack || location.modifierStack || null,
      interactablePlan: [...(plan?.interactablePlan || location.interactablePlan || [])],
      pendingRoomModifiers: (state.pendingRoomModifiers || []).map((entry) => pendingRoomModifierSnapshot(entry)),
      time: Number((state.locationTime || 0).toFixed(2)),
      accent: location.accent || "green",
      biomeId: location.biomeId || state.biomeId || "grid",
      biomeName: location.biomeName || state.biomeName || "BLACK GRID",
      environmentTheme: location.environmentTheme || null,
      gridStep: location.gridStep || 80
    },
    players: Object.values(state.players).map((p) => ({
      id: p.id,
      name: p.name || p.id.toUpperCase(),
      x: Number(p.x.toFixed(1)),
      y: Number(p.y.toFixed(1)),
      angle: Number(p.angle.toFixed(3)),
      hp: Math.max(0, Math.round(p.hp)),
      maxHp: p.maxHp,
      activeWeapon: ensureInventory(p).activeWeapon,
      inventory: inventorySnapshot(p),
      abilityInventory: abilityInventorySnapshot(p),
      economy: economySnapshot(p),
      upgrades: upgradeSnapshot(p),
      stats: { ...(p.stats || {}) },
      statSnapshot: buildPlayerStatSnapshot(p, state),
      shield: p.effectState?.shield ? { charges: p.effectState.shield.charges || 0, cooldownLeft: Number((p.effectState.shield.cooldownLeft || 0).toFixed(2)) } : null,
      damageImpact: p.lastDamageImpact ? { ...p.lastDamageImpact } : null,
      orbiterPressure: orbiterPressureSnapshot(p),
      ability: abilitySnapshot(p),
      companions: companionSummary(p, state),
      skin: p.skin,
      vx: Number((p.vx || 0).toFixed(1)),
      vy: Number((p.vy || 0).toFixed(1))
    })),
    enemies: Object.values(state.enemies).map((e) => ({
      id: e.id,
      kind: e.kind,
      x: Math.round(e.x),
      y: Math.round(e.y),
      hp: Math.max(0, Math.round(e.hp)),
      armor: armorSnapshot(e),
      elite: enemyEliteSnapshot(e),
      status: enemyStatusSnapshot(e),
      projectileDefenseFacingX: Number.isFinite(e.projectileDefenseFacingX) ? Number(e.projectileDefenseFacingX.toFixed(3)) : null,
      projectileDefenseFacingY: Number.isFinite(e.projectileDefenseFacingY) ? Number(e.projectileDefenseFacingY.toFixed(3)) : null
    })),
    projectiles: Object.values(state.projectiles).map((p) => ({
      id: p.id,
      ownerId: p.ownerId,
      weaponId: p.weaponId,
      kind: p.kind,
      x: Number(p.x.toFixed(1)),
      y: Number(p.y.toFixed(1)),
      vx: Number(p.vx.toFixed(1)),
      vy: Number(p.vy.toFixed(1)),
      radius: p.radius,
      color: p.color
    })),
    companions: companionPacket.items,
    loot: Object.values(state.loot).map((l) => ({
      id: l.id,
      kind: l.kind,
      x: Math.round(l.x),
      y: Math.round(l.y)
    })),
    rewardPickups: Object.values(state.rewardPickups || {}).map((item) => rewardPickupSnapshot(item)),
    economyPickups: Object.values(state.economyPickups || {}).map((item) => economyPickupSnapshot(item)),
    interactables: Object.values(state.interactables || {}).map((item) => interactableSnapshot(item)),
    portals: Object.values(state.portals || {}).map((p) => ({
      id: p.id,
      kind: p.kind,
      x: Math.round(p.x),
      y: Math.round(p.y),
      radius: p.radius,
      active: !!p.active,
      progress: Number(Math.max(0, Math.min(1, (p.progress || 0) / hold)).toFixed(3)),
      targetIndex: p.targetIndex,
      targetDepth: p.targetDepth ?? p.targetIndex
    })),
    effects: effectPacket.items,
    events: state.events.slice(-48).map((e) => ({ ...e })),
    director: directorSnapshot(state),
    dev: devSnapshot(state)
  };
  snapshot.budget = buildSnapshotBudgetMeta(snapshot, {
    companions: companionPacket.meta,
    effects: effectPacket.meta
  });
  return snapshot;
}
