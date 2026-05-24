import { dist2, norm } from "../core/math.js";
import { canPlaceCircleInLocation, firstSolidWallHitInLocation } from "./roomGeometry.js";

export const ENEMY_PATHFINDING_SCHEMA_VERSION = 1;

const CELL = 72;
const MAX_CELLS = 960;
const RECALC_SECONDS = 0.32;
const TARGET_DRIFT = 56;
const NEIGHBORS = Object.freeze([
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1]
]);

function boundsFor(geometry) {
  const b = geometry?.bounds || {};
  return {
    x: Number.isFinite(b.x) ? b.x : 0,
    y: Number.isFinite(b.y) ? b.y : 0,
    w: Number.isFinite(b.w) ? b.w : 2400,
    h: Number.isFinite(b.h) ? b.h : 1600
  };
}

function gridFor(geometry) {
  const bounds = boundsFor(geometry);
  const cols = Math.max(1, Math.ceil(bounds.w / CELL));
  const rows = Math.max(1, Math.ceil(bounds.h / CELL));
  return { bounds, cols, rows, total: cols * rows };
}

function clampCell(value, max) {
  return Math.max(0, Math.min(max - 1, Math.floor(value)));
}

function cellForPoint(grid, x, y) {
  return {
    c: clampCell((x - grid.bounds.x) / CELL, grid.cols),
    r: clampCell((y - grid.bounds.y) / CELL, grid.rows)
  };
}

function cellKey(c, r) {
  return `${c},${r}`;
}

function centerForCell(grid, c, r) {
  return {
    x: grid.bounds.x + c * CELL + CELL * 0.5,
    y: grid.bounds.y + r * CELL + CELL * 0.5
  };
}

function canStand(geometry, grid, c, r, radius) {
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return false;
  const p = centerForCell(grid, c, r);
  return canPlaceCircleInLocation(geometry, p.x, p.y, radius, 8);
}

function nearestStandableCell(geometry, grid, x, y, radius) {
  const origin = cellForPoint(grid, x, y);
  if (canStand(geometry, grid, origin.c, origin.r, radius)) return origin;
  let best = null;
  let bestD = Infinity;
  const maxRing = Math.max(grid.cols, grid.rows);
  for (let ring = 1; ring <= maxRing; ring += 1) {
    for (let dr = -ring; dr <= ring; dr += 1) {
      for (let dc = -ring; dc <= ring; dc += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
        const c = origin.c + dc;
        const r = origin.r + dr;
        if (!canStand(geometry, grid, c, r, radius)) continue;
        const p = centerForCell(grid, c, r);
        const d = dist2(x, y, p.x, p.y);
        if (d < bestD) {
          bestD = d;
          best = { c, r };
        }
      }
    }
    if (best) return best;
  }
  return origin;
}

function passableSegment(geometry, grid, from, to, radius) {
  if (!canStand(geometry, grid, to.c, to.r, radius)) return false;
  const a = centerForCell(grid, from.c, from.r);
  const b = centerForCell(grid, to.c, to.r);
  return !firstSolidWallHitInLocation(geometry, a.x, a.y, b.x, b.y, radius + 3);
}

function neighborsFor(current, goal) {
  return [...NEIGHBORS].sort((a, b) => {
    const da = Math.abs(goal.c - (current.c + a[0])) + Math.abs(goal.r - (current.r + a[1]));
    const db = Math.abs(goal.c - (current.c + b[0])) + Math.abs(goal.r - (current.r + b[1]));
    return da - db;
  });
}

function reconstructFirstStep(cameFrom, startKey, goalKey) {
  let current = goalKey;
  let prev = cameFrom.get(current);
  if (!prev) return null;
  while (prev && prev !== startKey) {
    current = prev;
    prev = cameFrom.get(current);
  }
  const [c, r] = current.split(",").map((n) => Number(n));
  if (!Number.isFinite(c) || !Number.isFinite(r)) return null;
  return { c, r };
}

function computePathDirection(geometry, enemy, target, radius) {
  const grid = gridFor(geometry);
  if (grid.total > MAX_CELLS) return null;
  const start = nearestStandableCell(geometry, grid, enemy.x, enemy.y, radius);
  const goal = nearestStandableCell(geometry, grid, target.x, target.y, radius);
  const startKey = cellKey(start.c, start.r);
  const goalKey = cellKey(goal.c, goal.r);
  if (startKey === goalKey) return norm(target.x - enemy.x, target.y - enemy.y);

  const queue = [start];
  const seen = new Set([startKey]);
  const cameFrom = new Map();
  let found = false;

  for (let head = 0; head < queue.length && head < MAX_CELLS; head += 1) {
    const current = queue[head];
    const key = cellKey(current.c, current.r);
    if (key === goalKey) {
      found = true;
      break;
    }
    for (const [dc, dr] of neighborsFor(current, goal)) {
      const next = { c: current.c + dc, r: current.r + dr };
      const nextKey = cellKey(next.c, next.r);
      if (seen.has(nextKey)) continue;
      if (!passableSegment(geometry, grid, current, next, radius)) continue;
      seen.add(nextKey);
      cameFrom.set(nextKey, key);
      queue.push(next);
    }
  }

  if (!found && !cameFrom.has(goalKey)) return null;
  const first = reconstructFirstStep(cameFrom, startKey, goalKey);
  if (!first) return null;
  const wp = centerForCell(grid, first.c, first.r);
  return norm(wp.x - enemy.x, wp.y - enemy.y);
}

function directPathClear(geometry, enemy, target, radius) {
  return !firstSolidWallHitInLocation(geometry, enemy.x, enemy.y, target.x, target.y, radius + 4);
}

export function enemyPathDirection(state, geometry, enemy, target, radius = 12) {
  if (!geometry || !enemy || !target) return null;
  if (directPathClear(geometry, enemy, target, radius)) {
    enemy.pathfindDir = null;
    enemy.pathfindNextAt = 0;
    return norm(target.x - enemy.x, target.y - enemy.y);
  }

  const now = Number.isFinite(state?.time) ? state.time : 0;
  const drift = enemy.pathfindTarget
    ? Math.hypot((enemy.pathfindTarget.x || 0) - target.x, (enemy.pathfindTarget.y || 0) - target.y)
    : Infinity;
  if (enemy.pathfindDir && enemy.pathfindNextAt > now && drift < TARGET_DRIFT) return enemy.pathfindDir;

  const dir = computePathDirection(geometry, enemy, target, radius);
  enemy.pathfindTarget = { x: target.x, y: target.y };
  enemy.pathfindNextAt = now + RECALC_SECONDS;
  enemy.pathfindDir = dir || norm(target.x - enemy.x, target.y - enemy.y);
  return enemy.pathfindDir;
}
