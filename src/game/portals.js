import { CENTER, WORLD, GREEN } from "../core/constants.js";
import { clamp, dist2 } from "../core/math.js";
import { getLocation } from "../data/locations.js";
import { nextId, pushEvent, spawnPoint } from "./state.js";

const PORTAL_RADIUS = 58;

export function currentLocation(state) {
  return getLocation(state.locationIndex || 0);
}

export function initLocation(state, index = 0) {
  const loc = getLocation(index);
  state.locationIndex = index;
  state.locationId = loc.id;
  state.locationName = loc.name;
  state.locationTime = 0;
  state.portalReadyAt = loc.portalDelay;
  state.portalHold = loc.portalHold;
  state.spawnTimer = 0.8;
  state.wave = 0;
  state.bossSpawned = false;
  state.portals = {};
  createExitPortal(state);
  return loc;
}

export function createExitPortal(state) {
  if (!state.portals) state.portals = {};
  const id = nextId("pt");
  state.portals[id] = {
    id,
    kind: "exit",
    x: WORLD.w - 190,
    y: CENTER.y,
    radius: PORTAL_RADIUS,
    active: false,
    progress: 0,
    targetIndex: (state.locationIndex || 0) + 1
  };
  return state.portals[id];
}

function clearLocationObjects(state) {
  state.enemies = {};
  state.projectiles = {};
  state.loot = {};
  state.effects = [];
  state.events = [];
  state.portals = {};
}

export function moveTeamToNextLocation(state) {
  const nextIndex = (state.locationIndex || 0) + 1;
  clearLocationObjects(state);
  const loc = initLocation(state, nextIndex);

  const ids = Object.keys(state.players).sort();
  for (const [index, id] of ids.entries()) {
    const player = state.players[id];
    const p = spawnPoint(index);
    player.x = p.x;
    player.y = p.y;
    player.vx = 0;
    player.vy = 0;
    player.kx = 0;
    player.ky = 0;
    player.hp = clamp(player.hp + 18, 1, player.maxHp || 100);
    player.deadTimer = 0;
  }

  pushEvent(state, {
    type: "location",
    locationId: loc.id,
    locationName: loc.name,
    x: CENTER.x,
    y: CENTER.y
  });
}

export function updatePortals(state, dt) {
  if (!state.portals || !Object.keys(state.portals).length) createExitPortal(state);
  const alive = Object.values(state.players).filter((p) => p.hp > 0);
  const loc = currentLocation(state);

  for (const portal of Object.values(state.portals)) {
    portal.active = state.locationTime >= (state.portalReadyAt ?? loc.portalDelay ?? 5);
    if (!portal.active || alive.length === 0) {
      portal.progress = Math.max(0, portal.progress - dt * 1.4);
      continue;
    }

    const allInside = alive.every((p) => {
      const r = portal.radius + p.radius;
      return dist2(p.x, p.y, portal.x, portal.y) <= r * r;
    });

    if (allInside) portal.progress += dt;
    else portal.progress = Math.max(0, portal.progress - dt * 1.1);

    const need = state.portalHold ?? loc.portalHold ?? 1.15;
    if (portal.progress >= need) {
      portal.progress = need;
      state.effects.push({
        type: "portal",
        x: portal.x,
        y: portal.y,
        radius: portal.radius + 42,
        life: 0.35,
        maxLife: 0.35,
        color: GREEN
      });
      moveTeamToNextLocation(state);
      return;
    }
  }
}

export function portalSnapshot(state) {
  const hold = state.portalHold || currentLocation(state).portalHold || 1.15;
  return Object.values(state.portals || {}).map((p) => ({
    id: p.id,
    kind: p.kind,
    x: Math.round(p.x),
    y: Math.round(p.y),
    radius: p.radius,
    active: !!p.active,
    progress: Number(clamp((p.progress || 0) / hold, 0, 1).toFixed(3)),
    targetIndex: p.targetIndex
  }));
}
