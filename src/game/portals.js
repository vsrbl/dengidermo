import { CENTER, WORLD, GREEN } from "../core/constants.js";
import { clamp, dist2 } from "../core/math.js";
import { getLocation } from "../data/locations.js";
import { nextId, pushEvent, spawnPoint } from "./state.js";
import { offerUpgradesToPlayers } from "./upgrades.js";
import { healPlayer } from "./effects.js";
import { pushVisualEffect } from "./effectCommands.js";
import { devPortalDelay, devPortalHold } from "./dev.js";
import { canOpenPortal, resetDirectorState } from "./director.js";

const PORTAL_RADIUS = 58;
const PORTAL_MARGIN = 12;

export function currentLocation(state) {
  return getLocation(state.locationIndex || 0);
}

export function initLocation(state, index = 0) {
  const loc = getLocation(index);
  state.locationIndex = index;
  state.locationId = loc.id;
  state.locationName = loc.name;
  state.biomeId = loc.biomeId;
  state.biomeName = loc.biomeName;
  state.locationTime = 0;
  state.portalReadyAt = devPortalDelay(state, loc.portalDelay);
  state.portalHold = devPortalHold(state, loc.portalHold);
  state.spawnTimer = loc.director?.spawnStartDelay ?? 0.8;
  state.wave = 0;
  state.bossSpawned = false;
  resetDirectorState(state, loc);
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
    targetIndex: currentLocation(state).portalTargetIndex ?? ((state.locationIndex || 0) + 1)
  };
  return state.portals[id];
}

function clearLocationObjects(state) {
  // ARCHITECTURE GUARD: location-scoped runtime entities must be reset on
  // room transitions. Companions are player-owned, but their live entity
  // positions are location-scoped render/game state; keeping them here makes
  // renderer smoothing interpolate from the old room to the new spawn point
  // and causes drones/orbitals to visibly jump across the screen. Upgrades
  // remain on players, so companions are recreated next tick at the owner.
  state.enemies = {};
  state.projectiles = {};
  state.companions = {};
  state.loot = {};
  state.effects = [];
  state.events = [];
  state.portals = {};
}

export function moveTeamToNextLocation(state) {
  const loc = currentLocation(state);
  const nextIndex = loc.portalTargetIndex ?? ((state.locationIndex || 0) + 1);
  clearLocationObjects(state);
  const nextLoc = initLocation(state, nextIndex);

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
    healPlayer(state, player, { amount: 18, sourceType: "portal", tags: ["portal"], allowRevive: true, minHp: 1 });
    player.deadTimer = 0;
  }

  offerUpgradesToPlayers(state, 3);
  pushEvent(state, {
    type: "location",
    locationId: nextLoc.id,
    locationName: nextLoc.name,
    biomeId: nextLoc.biomeId,
    x: CENTER.x,
    y: CENTER.y
  });
}

export function updatePortals(state, dt) {
  if (!state.portals || !Object.keys(state.portals).length) createExitPortal(state);
  const alive = Object.values(state.players).filter((p) => p.hp > 0);
  const loc = currentLocation(state);

  for (const portal of Object.values(state.portals)) {
    // v38.3: portal activation is gated by the director phase contract,
    // not raw room time. This keeps cleanup/boss objectives authoritative.
    portal.active = canOpenPortal(state);
    if (!portal.active || alive.length === 0) {
      portal.progress = Math.max(0, portal.progress - dt * 0.9);
      continue;
    }

    const allInside = alive.every((p) => {
      const r = portal.radius + p.radius + PORTAL_MARGIN;
      return dist2(p.x, p.y, portal.x, portal.y) <= r * r;
    });

    if (allInside) portal.progress += dt;
    else portal.progress = Math.max(0, portal.progress - dt * 0.7);

    const need = state.portalHold ?? loc.portalHold ?? 1.15;
    if (portal.progress >= need) {
      portal.progress = need;
      pushVisualEffect(state, {
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
