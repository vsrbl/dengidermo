import { WORLD } from "../core/constants.js";
import { clamp, dist2 } from "../core/math.js";

export const SPAWN_ZONE_IDS = Object.freeze({
  EDGE_RANDOM: "edge_random",
  EDGE_FAR: "edge_far",
  EDGE_FLANK: "edge_flank",
  CORNER_RANDOM: "corner_random",
  NORTH: "north",
  SOUTH: "south",
  EAST: "east",
  WEST: "west",
  NEAR_TEAM_EDGE: "near_team_edge",
  BOSS_ANCHOR: "boss_anchor"
});

const EDGE_MARGIN = 80;
const CORNER_MARGIN = 120;

function alivePlayers(state) {
  return Object.values(state.players || {}).filter((p) => p.hp > 0);
}

function teamCenter(state) {
  const players = alivePlayers(state);
  if (!players.length) return { x: WORLD.w / 2, y: WORLD.h / 2 };
  let x = 0;
  let y = 0;
  for (const player of players) {
    x += player.x;
    y += player.y;
  }
  return { x: x / players.length, y: y / players.length };
}

function edgePoint(state, side) {
  if (side === SPAWN_ZONE_IDS.NORTH) return { x: state.rng.range(EDGE_MARGIN, WORLD.w - EDGE_MARGIN), y: EDGE_MARGIN };
  if (side === SPAWN_ZONE_IDS.SOUTH) return { x: state.rng.range(EDGE_MARGIN, WORLD.w - EDGE_MARGIN), y: WORLD.h - EDGE_MARGIN };
  if (side === SPAWN_ZONE_IDS.EAST) return { x: WORLD.w - EDGE_MARGIN, y: state.rng.range(EDGE_MARGIN, WORLD.h - EDGE_MARGIN) };
  return { x: EDGE_MARGIN, y: state.rng.range(EDGE_MARGIN, WORLD.h - EDGE_MARGIN) };
}

function sideAnchor(side) {
  if (side === SPAWN_ZONE_IDS.NORTH) return { x: WORLD.w / 2, y: EDGE_MARGIN };
  if (side === SPAWN_ZONE_IDS.SOUTH) return { x: WORLD.w / 2, y: WORLD.h - EDGE_MARGIN };
  if (side === SPAWN_ZONE_IDS.EAST) return { x: WORLD.w - EDGE_MARGIN, y: WORLD.h / 2 };
  return { x: EDGE_MARGIN, y: WORLD.h / 2 };
}

function sortedSidesByDistanceFrom(point) {
  return [SPAWN_ZONE_IDS.NORTH, SPAWN_ZONE_IDS.SOUTH, SPAWN_ZONE_IDS.EAST, SPAWN_ZONE_IDS.WEST]
    .map((side) => ({ side, d: dist2(point.x, point.y, sideAnchor(side).x, sideAnchor(side).y) }))
    .sort((a, b) => b.d - a.d)
    .map((entry) => entry.side);
}

function cornerPoint(state) {
  const corners = [
    { x: CORNER_MARGIN, y: CORNER_MARGIN },
    { x: WORLD.w - CORNER_MARGIN, y: CORNER_MARGIN },
    { x: WORLD.w - CORNER_MARGIN, y: WORLD.h - CORNER_MARGIN },
    { x: CORNER_MARGIN, y: WORLD.h - CORNER_MARGIN }
  ];
  const corner = state.rng.pick(corners);
  return {
    x: clamp(corner.x + state.rng.range(-32, 32), EDGE_MARGIN, WORLD.w - EDGE_MARGIN),
    y: clamp(corner.y + state.rng.range(-32, 32), EDGE_MARGIN, WORLD.h - EDGE_MARGIN)
  };
}

export function resolveSpawnPoint(state, zoneId = SPAWN_ZONE_IDS.EDGE_RANDOM) {
  const zone = zoneId || SPAWN_ZONE_IDS.EDGE_RANDOM;
  if (zone === SPAWN_ZONE_IDS.NORTH || zone === SPAWN_ZONE_IDS.SOUTH || zone === SPAWN_ZONE_IDS.EAST || zone === SPAWN_ZONE_IDS.WEST) {
    return edgePoint(state, zone);
  }
  if (zone === SPAWN_ZONE_IDS.CORNER_RANDOM) return cornerPoint(state);
  if (zone === SPAWN_ZONE_IDS.BOSS_ANCHOR) return { x: WORLD.w / 2, y: 180 };

  const center = teamCenter(state);
  const sides = sortedSidesByDistanceFrom(center);
  if (zone === SPAWN_ZONE_IDS.EDGE_FAR) return edgePoint(state, sides[0]);
  if (zone === SPAWN_ZONE_IDS.EDGE_FLANK) return edgePoint(state, state.rng.pick(sides.slice(1, 3)) || sides[0]);
  if (zone === SPAWN_ZONE_IDS.NEAR_TEAM_EDGE) return edgePoint(state, sides.at(-1) || SPAWN_ZONE_IDS.NORTH);
  return edgePoint(state, state.rng.pick([SPAWN_ZONE_IDS.NORTH, SPAWN_ZONE_IDS.SOUTH, SPAWN_ZONE_IDS.EAST, SPAWN_ZONE_IDS.WEST]));
}

function stageZones(stage, loc) {
  if (Array.isArray(stage?.spawnZones) && stage.spawnZones.length) return stage.spawnZones;
  if (Array.isArray(loc?.spawnZones) && loc.spawnZones.length) return loc.spawnZones;
  return [SPAWN_ZONE_IDS.EDGE_FAR, SPAWN_ZONE_IDS.EDGE_FLANK, SPAWN_ZONE_IDS.EDGE_RANDOM];
}

export function chooseSpawnZone(state, loc = {}, stage = {}, threat = {}, role = "wave") {
  if (role === "boss") return SPAWN_ZONE_IDS.BOSS_ANCHOR;
  const zones = stageZones(stage, loc).filter(Boolean);
  if (!zones.length) return SPAWN_ZONE_IDS.EDGE_RANDOM;

  const relief = Number(threat.relief) || 0;
  const dominance = Number(threat.dominance) || 0;
  let pool = zones.slice();

  if (role === "elite") {
    pool = pool.filter((zone) => zone !== SPAWN_ZONE_IDS.NEAR_TEAM_EDGE);
    if (!pool.length) pool = [SPAWN_ZONE_IDS.EDGE_FAR, SPAWN_ZONE_IDS.EDGE_FLANK];
  }

  if (relief > 0.35) {
    const softPool = pool.filter((zone) => zone === SPAWN_ZONE_IDS.EDGE_FAR || zone === SPAWN_ZONE_IDS.CORNER_RANDOM || zone === SPAWN_ZONE_IDS.EDGE_RANDOM);
    if (softPool.length) pool = softPool;
  } else if (dominance > 0.35 && role === "wave") {
    const pressurePool = pool.concat([SPAWN_ZONE_IDS.EDGE_FLANK, SPAWN_ZONE_IDS.NEAR_TEAM_EDGE]);
    pool = pressurePool;
  }

  return state.rng.pick(pool) || SPAWN_ZONE_IDS.EDGE_RANDOM;
}
