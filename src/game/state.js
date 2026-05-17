import { CENTER, PLAYER_HP, PLAYER_RADIUS, SPAWN_OFFSETS, WORLD } from "../core/constants.js";
import { clamp } from "../core/math.js";
import { makeRng } from "../core/random.js";
import { getLocation } from "../data/locations.js";
import { START_WEAPON } from "../data/weapons.js";
import { createInventory, ensureInventory, inventorySnapshot } from "./inventory.js";

let entitySeq = 1;

export function nextId(prefix) {
  entitySeq += 1;
  return `${prefix}${entitySeq}`;
}

export function createGameState(roomId) {
  entitySeq = 1;
  const location = getLocation(0);
  return {
    roomId,
    tick: 0,
    time: 0,
    rng: makeRng(roomId),
    locationIndex: 0,
    locationId: location.id,
    locationName: location.name,
    locationTime: 0,
    portalReadyAt: location.portalDelay,
    portalHold: location.portalHold,
    players: {},
    enemies: {},
    projectiles: {},
    loot: {},
    portals: {},
    effects: [],
    events: [],
    spawnTimer: 0,
    wave: 0,
    bossSpawned: false
  };
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
  player.deadTimer = 0;
}

export function pushEvent(state, event) {
  state.events.push({ id: nextId("ev"), t: state.time, ...event });
  if (state.events.length > 32) state.events.splice(0, state.events.length - 32);
}

export function makeSnapshot(state) {
  const location = getLocation(state.locationIndex || 0);
  const hold = state.portalHold || location.portalHold || 1.15;
  return {
    tick: state.tick,
    time: Number(state.time.toFixed(3)),
    location: {
      id: state.locationId || location.id,
      name: state.locationName || location.name,
      index: state.locationIndex || 0,
      time: Number((state.locationTime || 0).toFixed(2)),
      accent: location.accent || "green"
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
      skin: p.skin,
      vx: Number((p.vx || 0).toFixed(1)),
      vy: Number((p.vy || 0).toFixed(1))
    })),
    enemies: Object.values(state.enemies).map((e) => ({
      id: e.id,
      kind: e.kind,
      x: Math.round(e.x),
      y: Math.round(e.y),
      hp: Math.max(0, Math.round(e.hp))
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
      targetIndex: p.targetIndex
    })),
    effects: state.effects.slice(-48).map((e) => ({ ...e })),
    events: state.events.slice(-16).map((e) => ({ ...e }))
  };
}
