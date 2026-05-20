import { WORLD } from "../core/constants.js";
import { clamp, dist2 } from "../core/math.js";
import { canPlaceSpawnPointInState, resolveSpawnPointInState, roomGeometrySnapshot, roomLayoutForState } from "./roomGeometry.js";

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
const DIRECTION_TAGS = Object.freeze([SPAWN_ZONE_IDS.NORTH, SPAWN_ZONE_IDS.SOUTH, SPAWN_ZONE_IDS.EAST, SPAWN_ZONE_IDS.WEST]);

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

function rawSpawnPoint(state, zoneId = SPAWN_ZONE_IDS.EDGE_RANDOM) {
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

function tagsFor(anchor) {
  return new Set([anchor.id, ...(anchor.tags || [])].filter(Boolean).map((tag) => String(tag).toLowerCase()));
}

function hasAnyTag(anchor, tags = []) {
  const set = tagsFor(anchor);
  return tags.some((tag) => set.has(String(tag).toLowerCase()));
}

function hasAllTags(anchor, tags = []) {
  if (!tags.length) return true;
  const set = tagsFor(anchor);
  return tags.every((tag) => set.has(String(tag).toLowerCase()));
}

function anchorMatchesZone(anchor, zoneId, role = "wave", options = {}) {
  if (options.anchorId && anchor.id === options.anchorId) return true;
  if (Array.isArray(options.anchorTags) && options.anchorTags.length && hasAllTags(anchor, options.anchorTags)) return true;

  const zone = zoneId || SPAWN_ZONE_IDS.EDGE_RANDOM;
  if (role === "boss" || zone === SPAWN_ZONE_IDS.BOSS_ANCHOR) return hasAnyTag(anchor, ["boss", "boss_anchor"]);
  if (DIRECTION_TAGS.includes(zone)) return hasAnyTag(anchor, [zone]);
  if (zone === SPAWN_ZONE_IDS.CORNER_RANDOM) return hasAnyTag(anchor, ["corner"]);
  if (zone === SPAWN_ZONE_IDS.EDGE_FLANK) return hasAnyTag(anchor, ["flank", "side", "lane", "edge"]);
  if (zone === SPAWN_ZONE_IDS.EDGE_FAR || zone === SPAWN_ZONE_IDS.NEAR_TEAM_EDGE || zone === SPAWN_ZONE_IDS.EDGE_RANDOM) return hasAnyTag(anchor, ["edge"]);
  return false;
}

function anchorDistanceFromTeam(state, anchor) {
  const center = teamCenter(state);
  return dist2(anchor.x, anchor.y, center.x, center.y);
}

function chooseAnchor(state, anchors, zoneId, role = "wave", options = {}) {
  if (!anchors.length) return null;
  if (options.anchorId) return anchors.find((anchor) => anchor.id === options.anchorId) || null;

  const zone = zoneId || SPAWN_ZONE_IDS.EDGE_RANDOM;
  if (role === "boss" || zone === SPAWN_ZONE_IDS.BOSS_ANCHOR) return anchors[0];

  if (zone === SPAWN_ZONE_IDS.EDGE_FAR) {
    return anchors.slice().sort((a, b) => anchorDistanceFromTeam(state, b) - anchorDistanceFromTeam(state, a))[0] || null;
  }

  if (zone === SPAWN_ZONE_IDS.NEAR_TEAM_EDGE) {
    return anchors.slice().sort((a, b) => anchorDistanceFromTeam(state, a) - anchorDistanceFromTeam(state, b))[0] || null;
  }

  if (zone === SPAWN_ZONE_IDS.EDGE_FLANK) {
    const sorted = anchors.slice().sort((a, b) => anchorDistanceFromTeam(state, b) - anchorDistanceFromTeam(state, a));
    const middle = sorted.slice(1, Math.max(2, sorted.length - 1));
    return state.rng.pick(middle.length ? middle : sorted) || sorted[0] || null;
  }

  return state.rng.pick(anchors) || anchors[0] || null;
}

function resolveAnchorSpawnPoint(state, zoneId, radius = 12, options = {}) {
  const geometry = options.geometry || roomGeometrySnapshot({ layout: roomLayoutForState(state) });
  const role = options.role || "wave";
  const anchors = (geometry.spawnAnchors || [])
    .filter((anchor) => anchorMatchesZone(anchor, zoneId, role, options))
    .filter((anchor) => canPlaceSpawnPointInState(state, geometry, anchor.x, anchor.y, radius, options));
  const anchor = chooseAnchor(state, anchors, zoneId, role, options);
  if (!anchor) return null;
  return {
    x: anchor.x,
    y: anchor.y,
    adjusted: false,
    fromAnchor: true,
    anchorId: anchor.id,
    anchorTags: [...(anchor.tags || [])]
  };
}

export function resolveSpawnPoint(state, zoneId = SPAWN_ZONE_IDS.EDGE_RANDOM, radius = 12, options = {}) {
  const geometry = options.geometry || roomGeometrySnapshot({ layout: roomLayoutForState(state) });
  const anchorPoint = resolveAnchorSpawnPoint(state, zoneId, radius, { ...options, geometry });
  if (anchorPoint) return anchorPoint;

  return resolveSpawnPointInState(state, rawSpawnPoint(state, zoneId), radius, { ...options, geometry });
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
