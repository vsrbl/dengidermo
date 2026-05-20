import { CENTER, WORLD } from "../core/constants.js";
import { clamp } from "../core/math.js";
import { DEFAULT_LAYOUT_ID, layoutIdentitySnapshot, layoutSnapshot } from "../data/layouts.js";

const DEFAULT_BOUNDS = Object.freeze({ x: 0, y: 0, w: WORLD.w, h: WORLD.h });
const SPAWN_CLEARANCE = 18;
const SPAWN_PLAYER_CLEARANCE = 96;
const MOVE_SUBSTEP_DISTANCE = 9;
const WALL_EPSILON = 0.02;

function rectSnapshot(rect) {
  return {
    id: rect.id || "wall",
    kind: rect.kind || "solid",
    shape: rect.shape || "rect",
    x: Number(rect.x) || 0,
    y: Number(rect.y) || 0,
    w: Math.max(0, Number(rect.w) || 0),
    h: Math.max(0, Number(rect.h) || 0),
    tags: [...(rect.tags || [])]
  };
}

export function roomLayoutForLocation(loc) {
  if (loc?.layout && typeof loc.layout === "object") return loc.layout;
  return layoutSnapshot(loc?.layoutId || loc?.layout || DEFAULT_LAYOUT_ID);
}

export function roomLayoutForState(state) {
  return layoutSnapshot(state?.layoutId || DEFAULT_LAYOUT_ID);
}

export function roomBoundsForLocation(loc) {
  const bounds = roomLayoutForLocation(loc).bounds || DEFAULT_BOUNDS;
  return {
    x: Number.isFinite(bounds.x) ? bounds.x : 0,
    y: Number.isFinite(bounds.y) ? bounds.y : 0,
    w: Number.isFinite(bounds.w) ? bounds.w : WORLD.w,
    h: Number.isFinite(bounds.h) ? bounds.h : WORLD.h
  };
}

export function roomBoundsForState(state) {
  const bounds = roomLayoutForState(state).bounds || DEFAULT_BOUNDS;
  return {
    x: Number.isFinite(bounds.x) ? bounds.x : 0,
    y: Number.isFinite(bounds.y) ? bounds.y : 0,
    w: Number.isFinite(bounds.w) ? bounds.w : WORLD.w,
    h: Number.isFinite(bounds.h) ? bounds.h : WORLD.h
  };
}

export function solidWallsForLocation(loc) {
  return (roomLayoutForLocation(loc).walls || [])
    .map(rectSnapshot)
    .filter((wall) => wall.kind === "solid" && wall.shape === "rect" && wall.w > 0 && wall.h > 0);
}

export function solidWallsForState(state) {
  return (roomLayoutForState(state).walls || [])
    .map(rectSnapshot)
    .filter((wall) => wall.kind === "solid" && wall.shape === "rect" && wall.w > 0 && wall.h > 0);
}

export function portalPointForLocation(loc) {
  const portal = roomLayoutForLocation(loc).portal || {};
  return {
    x: Number.isFinite(portal.x) ? portal.x : WORLD.w - 190,
    y: Number.isFinite(portal.y) ? portal.y : CENTER.y
  };
}

export function roomGeometryIdentity(loc) {
  const layout = roomLayoutForLocation(loc);
  return layoutIdentitySnapshot(layout.id || loc?.layoutId || DEFAULT_LAYOUT_ID);
}


export function roomGeometryIdentityMatches(loc) {
  if (!loc?.layoutId || !Number.isFinite(loc.layoutVersion) || typeof loc.geometryHash !== "string") return false;
  const expected = roomGeometryIdentity(loc);
  return loc.layoutVersion === expected.layoutVersion && loc.geometryHash === expected.geometryHash;
}

export function roomGeometrySnapshot(loc) {
  const layout = roomLayoutForLocation(loc);
  return {
    ...roomGeometryIdentity(loc),
    bounds: { ...(layout.bounds || DEFAULT_BOUNDS) },
    walls: solidWallsForLocation(loc),
    hazards: [...(layout.hazards || [])],
    spawnAnchors: [...(layout.spawnAnchors || [])].map((a) => ({ ...a, tags: [...(a.tags || [])] })),
    portal: { ...(layout.portal || portalPointForLocation(loc)) }
  };
}

function pointInsideExpandedRect(x, y, rect, radius = 0) {
  return x > rect.x - radius && x < rect.x + rect.w + radius && y > rect.y - radius && y < rect.y + rect.h + radius;
}

export function isCircleBlockedByWalls(locOrGeometry, x, y, radius = 0, clearance = 0) {
  const walls = Array.isArray(locOrGeometry?.walls) ? locOrGeometry.walls : solidWallsForLocation(locOrGeometry);
  const r = Math.max(0, radius + clearance);
  return walls.some((wall) => pointInsideExpandedRect(x, y, wall, r));
}

export function canPlaceCircleInLocation(locOrGeometry, x, y, radius = 0, clearance = 0) {
  const bounds = locOrGeometry?.bounds || roomBoundsForLocation(locOrGeometry);
  const r = Math.max(0, radius + clearance);
  if (x < bounds.x + r || x > bounds.x + bounds.w - r || y < bounds.y + r || y > bounds.y + bounds.h - r) return false;
  return !isCircleBlockedByWalls(locOrGeometry, x, y, radius, clearance);
}

function resolveAgainstWalls(locOrGeometry, x, y, radius = 0) {
  const walls = Array.isArray(locOrGeometry?.walls) ? locOrGeometry.walls : solidWallsForLocation(locOrGeometry);
  let nx = x;
  let ny = y;
  let hit = false;

  for (const wall of walls) {
    if (!pointInsideExpandedRect(nx, ny, wall, radius)) continue;
    const left = Math.abs(nx - (wall.x - radius));
    const right = Math.abs((wall.x + wall.w + radius) - nx);
    const top = Math.abs(ny - (wall.y - radius));
    const bottom = Math.abs((wall.y + wall.h + radius) - ny);
    const min = Math.min(left, right, top, bottom);
    if (min === left) nx = wall.x - radius;
    else if (min === right) nx = wall.x + wall.w + radius;
    else if (min === top) ny = wall.y - radius;
    else ny = wall.y + wall.h + radius;
    hit = true;
  }

  return { x: nx, y: ny, hit };
}

export function clampCircleToLocation(locOrGeometry, x, y, radius = 0) {
  const bounds = locOrGeometry?.bounds || roomBoundsForLocation(locOrGeometry);
  const r = Math.max(0, radius);
  let nx = clamp(x, bounds.x + r, bounds.x + bounds.w - r);
  let ny = clamp(y, bounds.y + r, bounds.y + bounds.h - r);
  const resolved = resolveAgainstWalls(locOrGeometry, nx, ny, r);
  nx = clamp(resolved.x, bounds.x + r, bounds.x + bounds.w - r);
  ny = clamp(resolved.y, bounds.y + r, bounds.y + bounds.h - r);
  return { x: nx, y: ny, hit: resolved.hit || nx !== x || ny !== y };
}

function sweptAxisStep(locOrGeometry, x, y, delta, radius = 0, axis = "x") {
  const bounds = locOrGeometry?.bounds || roomBoundsForLocation(locOrGeometry);
  const r = Math.max(0, radius);
  if (!delta) return { x, y, hit: false };

  if (axis === "x") {
    const minX = bounds.x + r;
    const maxX = bounds.x + bounds.w - r;
    const unclampedTargetX = x + delta;
    const targetX = clamp(unclampedTargetX, minX, maxX);
    const boundaryHit = targetX !== unclampedTargetX;
    const wallHit = firstSolidWallHitInLocation(locOrGeometry, x, y, targetX, y, r);
    if (wallHit) {
      return {
        x: clamp(wallHit.x + wallHit.normal.x * WALL_EPSILON, minX, maxX),
        y,
        hit: true,
        wall: wallHit.wall
      };
    }
    return { x: targetX, y, hit: boundaryHit };
  }

  const minY = bounds.y + r;
  const maxY = bounds.y + bounds.h - r;
  const unclampedTargetY = y + delta;
  const targetY = clamp(unclampedTargetY, minY, maxY);
  const boundaryHit = targetY !== unclampedTargetY;
  const wallHit = firstSolidWallHitInLocation(locOrGeometry, x, y, x, targetY, r);
  if (wallHit) {
    return {
      x,
      y: clamp(wallHit.y + wallHit.normal.y * WALL_EPSILON, minY, maxY),
      hit: true,
      wall: wallHit.wall
    };
  }
  return { x, y: targetY, hit: boundaryHit };
}

export function moveCircleInLocation(locOrGeometry, x, y, dx, dy, radius = 0, options = {}) {
  const maxStep = Math.max(1, Number(options.maxStep) || MOVE_SUBSTEP_DISTANCE);
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / maxStep));
  const sx = dx / steps;
  const sy = dy / steps;
  let nx = x;
  let ny = y;
  let hitX = false;
  let hitY = false;

  const start = clampCircleToLocation(locOrGeometry, nx, ny, radius);
  nx = start.x;
  ny = start.y;
  hitX = hitX || start.hit;
  hitY = hitY || start.hit;

  for (let i = 0; i < steps; i += 1) {
    const afterX = sweptAxisStep(locOrGeometry, nx, ny, sx, radius, "x");
    nx = afterX.x;
    ny = afterX.y;
    hitX = hitX || afterX.hit;

    const afterY = sweptAxisStep(locOrGeometry, nx, ny, sy, radius, "y");
    nx = afterY.x;
    ny = afterY.y;
    hitY = hitY || afterY.hit;

    if ((afterX.hit && sx) || (afterY.hit && sy)) {
      // Keep remaining substeps running so the free axis can still slide.
      // The blocked axis will repeatedly report a hit and stay at the wall edge.
    }
  }

  return {
    x: nx,
    y: ny,
    hitX,
    hitY,
    hit: hitX || hitY
  };
}

export function sweepCircleInLocation(locOrGeometry, x, y, dx, dy, radius = 0) {
  const bounds = locOrGeometry?.bounds || roomBoundsForLocation(locOrGeometry);
  const r = Math.max(0, radius);
  const start = clampCircleToLocation(locOrGeometry, x, y, r);
  const sx = start.x;
  const sy = start.y;
  const targetX = clamp(sx + dx, bounds.x + r, bounds.x + bounds.w - r);
  const targetY = clamp(sy + dy, bounds.y + r, bounds.y + bounds.h - r);
  const boundaryHit = targetX !== sx + dx || targetY !== sy + dy;
  const wallHit = firstSolidWallHitInLocation(locOrGeometry, sx, sy, targetX, targetY, r);

  if (wallHit) {
    return {
      x: clamp(wallHit.x + wallHit.normal.x * WALL_EPSILON, bounds.x + r, bounds.x + bounds.w - r),
      y: clamp(wallHit.y + wallHit.normal.y * WALL_EPSILON, bounds.y + r, bounds.y + bounds.h - r),
      hit: true,
      hitWall: true,
      wall: wallHit.wall,
      t: wallHit.t,
      normal: wallHit.normal
    };
  }

  return {
    x: targetX,
    y: targetY,
    hit: start.hit || boundaryHit,
    hitWall: false,
    t: 1,
    normal: { x: 0, y: 0 }
  };
}

export function moveCircleInState(state, x, y, dx, dy, radius = 0, options = {}) {
  return moveCircleInLocation(roomGeometrySnapshot({ layout: roomLayoutForState(state) }), x, y, dx, dy, radius, options);
}

export function sweepCircleInState(state, x, y, dx, dy, radius = 0) {
  return sweepCircleInLocation(roomGeometrySnapshot({ layout: roomLayoutForState(state) }), x, y, dx, dy, radius);
}

function segmentExpandedRectHit(ax, ay, bx, by, rect, radius = 0) {
  const minX = rect.x - radius;
  const maxX = rect.x + rect.w + radius;
  const minY = rect.y - radius;
  const maxY = rect.y + rect.h + radius;
  const dx = bx - ax;
  const dy = by - ay;
  let tMin = 0;
  let tMax = 1;
  let normal = { x: 0, y: 0 };

  function axis(start, delta, min, max, nx, ny) {
    if (Math.abs(delta) < 0.000001) return start >= min && start <= max;
    let t1 = (min - start) / delta;
    let t2 = (max - start) / delta;
    let n = { x: nx, y: ny };
    if (t1 > t2) {
      const tmp = t1; t1 = t2; t2 = tmp;
      n = { x: -nx, y: -ny };
    }
    if (t1 > tMin) {
      tMin = t1;
      normal = n;
    }
    tMax = Math.min(tMax, t2);
    return tMin <= tMax;
  }

  if (!axis(ax, dx, minX, maxX, -1, 0)) return null;
  if (!axis(ay, dy, minY, maxY, 0, -1)) return null;
  if (tMin < 0 || tMin > 1) return null;
  return {
    t: tMin,
    x: ax + dx * tMin,
    y: ay + dy * tMin,
    normal,
    wall: rect
  };
}

export function firstSolidWallHitInLocation(locOrGeometry, ax, ay, bx, by, radius = 0) {
  const walls = Array.isArray(locOrGeometry?.walls) ? locOrGeometry.walls : solidWallsForLocation(locOrGeometry);
  let best = null;
  for (const wall of walls) {
    const hit = segmentExpandedRectHit(ax, ay, bx, by, wall, radius);
    if (!hit) continue;
    if (!best || hit.t < best.t) best = hit;
  }
  return best;
}

export function firstSolidWallHitInState(state, ax, ay, bx, by, radius = 0) {
  return firstSolidWallHitInLocation(roomGeometrySnapshot({ layout: roomLayoutForState(state) }), ax, ay, bx, by, radius);
}


function spawnTooCloseToPlayers(state, x, y, radius = 0, clearance = SPAWN_PLAYER_CLEARANCE) {
  const players = Object.values(state?.players || {});
  const extra = Math.max(0, Number(clearance) || 0);
  for (const player of players) {
    if (!player || player.hp <= 0) continue;
    const pr = Math.max(0, Number(player.radius) || 0);
    const min = Math.max(0, radius) + pr + extra;
    const dx = x - player.x;
    const dy = y - player.y;
    if (dx * dx + dy * dy < min * min) return true;
  }
  return false;
}

export function canPlaceSpawnPointInState(state, geometry, x, y, radius = 12, options = {}) {
  const clearance = Number.isFinite(options.clearance) ? options.clearance : SPAWN_CLEARANCE;
  if (!canPlaceCircleInLocation(geometry, x, y, radius, clearance)) return false;
  if (options.avoidPlayers === false) return true;
  const playerClearance = Number.isFinite(options.playerClearance) ? options.playerClearance : SPAWN_PLAYER_CLEARANCE;
  return !spawnTooCloseToPlayers(state, x, y, radius, playerClearance);
}

export function resolveSpawnPointInState(state, point, radius = 12, options = {}) {
  const geometry = options.geometry || roomGeometrySnapshot({ layout: roomLayoutForState(state) });
  const clearance = Number.isFinite(options.clearance) ? options.clearance : SPAWN_CLEARANCE;
  if (canPlaceSpawnPointInState(state, geometry, point.x, point.y, radius, options)) return { x: point.x, y: point.y, adjusted: false };

  const rng = state?.rng;
  const steps = options.steps || 18;
  for (let i = 0; i < steps; i += 1) {
    const angle = rng?.range ? rng.range(0, Math.PI * 2) : (i / steps) * Math.PI * 2;
    const distance = 42 + Math.floor(i / 4) * 42;
    const candidate = {
      x: point.x + Math.cos(angle) * distance,
      y: point.y + Math.sin(angle) * distance
    };
    const clamped = clampCircleToLocation(geometry, candidate.x, candidate.y, radius + clearance);
    if (canPlaceSpawnPointInState(state, geometry, clamped.x, clamped.y, radius, options)) {
      return { x: clamped.x, y: clamped.y, adjusted: true };
    }
  }

  const bounds = geometry.bounds || DEFAULT_BOUNDS;
  const fallback = clampCircleToLocation(geometry, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2, radius + clearance);
  if (canPlaceSpawnPointInState(state, geometry, fallback.x, fallback.y, radius, { ...options, avoidPlayers: false })) {
    return { x: fallback.x, y: fallback.y, adjusted: true, fallback: true };
  }
  return { x: fallback.x, y: fallback.y, adjusted: true, fallback: true, forced: true };
}
