import { CENTER, PLAYER_HP, PLAYER_RADIUS, SPAWN_OFFSETS, WORLD } from "../core/constants.js";
import { clamp } from "../core/math.js";
import { makeRng } from "../core/random.js";
import { getLocation } from "../data/locations.js";
import { START_WEAPON } from "../data/weapons.js";
import { createInventory, ensureInventory, inventorySnapshot } from "./inventory.js";
import { ensureUpgradeState, upgradeSnapshot } from "./upgrades.js";
import { enemyStatusSnapshot } from "./effects.js";
import { abilitySnapshot } from "./abilities.js";
import { companionSnapshot, companionSummary } from "./companions.js";
import { devPortalDelay, devPortalHold, devSnapshot, installDevMode } from "./dev.js";
import { threatSnapshot } from "./threat.js";

let entitySeq = 1;

export function nextId(prefix) {
  entitySeq += 1;
  return `${prefix}${entitySeq}`;
}

export function createGameState(roomId, options = {}) {
  entitySeq = 1;
  const location = getLocation(0);
  const state = {
    roomId,
    tick: 0,
    time: 0,
    rng: makeRng(roomId),
    runDepth: 0,
    roomSequenceIndex: location.sequenceIndex || 0,
    locationIndex: 0,
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
    portals: {},
    effects: [],
    events: [],
    spawnTimer: location.director?.spawnStartDelay ?? 0.8,
    wave: 0,
    bossSpawned: false,
    director: null
  };
  installDevMode(state, options.dev);
  state.portalReadyAt = devPortalDelay(state, location.portalDelay);
  state.portalHold = devPortalHold(state, location.portalHold);
  return state;
}

export function spawnPoint(index = 0) {
  const off = SPAWN_OFFSETS[index % SPAWN_OFFSETS.length];
  return {
    x: clamp(CENTER.x + off.x, 24, WORLD.w - 24),
    y: clamp(CENTER.y + off.y, 24, WORLD.h - 24)
  };
}

export function addPlayer(state, playerId, index = 0) {
  const p = spawnPoint(index);
  state.players[playerId] = {
    id: playerId,
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
    stats: {
      speedMult: 1,
      fireRateMult: 1,
      damageMult: 1,
      projectileSpeedMult: 1,
      explosionRadiusMult: 1,
      explosionDamageMult: 1,
      knockbackMult: 1
    },
    upgrades: { choices: [], taken: {}, offered: {}, offers: {}, pending: false },
    skin: index % 2 ? "green" : "default",
    cooldowns: {},
    lastInputAt: 0,
    fireSeqSeen: 0,
    deadTimer: 0
  };
  return state.players[playerId];
}

export function removePlayer(state, playerId) {
  delete state.players[playerId];
}

export function respawnPlayer(player, index = 0) {
  const p = spawnPoint(index);
  player.x = p.x;
  player.y = p.y;
  player.vx = 0;
  player.vy = 0;
  player.kx = 0;
  player.ky = 0;
  player.hp = player.maxHp;
  ensureInventory(player);
  ensureUpgradeState(player);
  player.deadTimer = 0;
}

export function pushEvent(state, event) {
  state.events.push({ id: nextId("ev"), t: state.time, ...event });
  if (state.events.length > 32) state.events.splice(0, state.events.length - 32);
}

export function makeSnapshot(state) {
  const depth = Number.isFinite(state.runDepth) ? state.runDepth : (state.locationIndex || 0);
  const location = getLocation(depth);
  const hold = state.portalHold || location.portalHold || 1.15;
  return {
    tick: state.tick,
    time: Number(state.time.toFixed(3)),
    location: {
      id: state.locationId || location.id,
      name: state.locationName || location.name,
      index: depth,
      runDepth: depth,
      roomSequenceIndex: Number.isFinite(state.roomSequenceIndex) ? state.roomSequenceIndex : (location.sequenceIndex || location.index || 0),
      time: Number((state.locationTime || 0).toFixed(2)),
      accent: location.accent || "green",
      biomeId: location.biomeId || "grid",
      biomeName: location.biomeName || "BLACK GRID",
      gridStep: location.gridStep || 80
    },
    players: Object.values(state.players).map((p) => ({
      id: p.id,
      x: Number(p.x.toFixed(1)),
      y: Number(p.y.toFixed(1)),
      angle: Number(p.angle.toFixed(3)),
      hp: Math.max(0, Math.round(p.hp)),
      maxHp: p.maxHp,
      activeWeapon: ensureInventory(p).activeWeapon,
      inventory: inventorySnapshot(p),
      upgrades: upgradeSnapshot(p),
      stats: { ...(p.stats || {}) },
      shield: p.effectState?.shield ? { charges: p.effectState.shield.charges || 0, cooldownLeft: Number((p.effectState.shield.cooldownLeft || 0).toFixed(2)) } : null,
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
      status: enemyStatusSnapshot(e)
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
    companions: Object.values(state.companions || {}).map((c) => companionSnapshot(c)),
    loot: Object.values(state.loot).map((l) => ({
      id: l.id,
      kind: l.kind,
      x: Math.round(l.x),
      y: Math.round(l.y)
    })),
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
    effects: state.effects.slice(-48).map((e) => ({ ...e })),
    events: state.events.slice(-16).map((e) => ({ ...e })),
    director: state.director ? {
      runDepth: state.director.runDepth,
      roomSequenceIndex: state.director.roomSequenceIndex,
      encounterId: state.director.encounterId,
      objective: state.director.objective || null,
      stageId: state.director.stageId,
      phase: state.director.phase,
      intensity: state.director.intensity,
      enemyCap: state.director.enemyCap,
      cleanupThreshold: Number.isFinite(state.director.cleanupThreshold) ? state.director.cleanupThreshold : undefined,
      budget: Math.round(state.director.budget || 0),
      totalBudget: Math.round(state.director.totalBudget || 0),
      wave: state.director.wave || 0,
      eliteSpawned: !!state.director.eliteSpawned,
      canSpawn: !!state.director.policy?.canSpawn,
      canOpenPortal: !!state.director.policy?.canOpenPortal,
      lastSpawn: state.director.lastSpawn || null,
      threat: threatSnapshot(state)
    } : null,
    dev: devSnapshot(state)
  };
}
