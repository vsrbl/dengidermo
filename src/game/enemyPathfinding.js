import { norm } from "../core/math.js";
import { canPlaceCircleInLocation, firstSolidWallHitInLocation } from "./roomGeometry.js";

export const ENEMY_PATHFINDING_SCHEMA_VERSION = 2;

const CELL = 72;
const MAX_CELLS = 960;
const TARGET_DRIFT = 56;
const FLOW_FIELD_REFRESH_SECONDS = 0.18;
const FLOW_FIELD_CACHE_LIMIT = 6;
const BLOCKED = 1;
const INF = 65535;

const CARDINALS = Object.freeze([
  [1, 0], [-1, 0], [0, 1], [0, -1]
]);

const DIAGONALS = Object.freeze([
  [1, 1], [1, -1], [-1, 1], [-1, -1]
]);

const NEIGHBORS = Object.freeze([...CARDINALS, ...DIAGONALS]);

function boundsFor(geometry) {
  const b = geometry?.bounds || {};
  return {
    x: Number.isFinite(b.x) ? b.x : 0,
    y: Number.isFinite(b.y) ? b.y : 0,
    w: Number.isFinite(b.w) ? b.w : 2400,
    h: Number.isFinite(b.h) ? b.h : 1600
  };
}

function gridShapeFor(geometry) {
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

function indexFor(grid, c, r) {
  return r * grid.cols + c;
}

function centerForCell(grid, c, r) {
  return {
    x: grid.bounds.x + c * CELL + CELL * 0.5,
    y: grid.bounds.y + r * CELL + CELL * 0.5
  };
}

function radiusBucket(radius) {
  return Math.max(8, Math.ceil((Number.isFinite(radius) ? radius : 12) / 4) * 4);
}

function geometryKey(geometry, grid, radius) {
  return [
    geometry?.geometryHash || geometry?.layoutVersion || geometry?.layoutId || "geometry",
    grid.bounds.x,
    grid.bounds.y,
    grid.bounds.w,
    grid.bounds.h,
    grid.cols,
    grid.rows,
    radiusBucket(radius)
  ].join(":");
}

function canStandAtCell(geometry, grid, c, r, radius) {
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return false;
  const p = centerForCell(grid, c, r);
  return canPlaceCircleInLocation(geometry, p.x, p.y, radius, 8);
}

function buildNavGrid(geometry, radius) {
  const grid = gridShapeFor(geometry);
  const blocked = new Uint8Array(grid.total);
  if (grid.total > MAX_CELLS) return { ...grid, blocked, oversized: true, key: geometryKey(geometry, grid, radius) };

  for (let r = 0; r < grid.rows; r += 1) {
    for (let c = 0; c < grid.cols; c += 1) {
      const idx = indexFor(grid, c, r);
      blocked[idx] = canStandAtCell(geometry, grid, c, r, radius) ? 0 : BLOCKED;
    }
  }
  return { ...grid, blocked, oversized: false, key: geometryKey(geometry, grid, radius) };
}

function cellOpen(nav, c, r) {
  if (c < 0 || r < 0 || c >= nav.cols || r >= nav.rows) return false;
  return nav.blocked[indexFor(nav, c, r)] !== BLOCKED;
}

function diagonalOpen(nav, c, r, dc, dr) {
  if (dc === 0 || dr === 0) return true;
  return cellOpen(nav, c + dc, r) && cellOpen(nav, c, r + dr);
}

function nearestOpenCell(nav, x, y) {
  const origin = cellForPoint(nav, x, y);
  if (cellOpen(nav, origin.c, origin.r)) return origin;

  let best = null;
  let bestD = Infinity;
  const maxRing = Math.max(nav.cols, nav.rows);
  for (let ring = 1; ring <= maxRing; ring += 1) {
    for (let dr = -ring; dr <= ring; dr += 1) {
      for (let dc = -ring; dc <= ring; dc += 1) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
        const c = origin.c + dc;
        const r = origin.r + dr;
        if (!cellOpen(nav, c, r)) continue;
        const p = centerForCell(nav, c, r);
        const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
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

function directPathClear(geometry, enemy, target, radius) {
  return !firstSolidWallHitInLocation(geometry, enemy.x, enemy.y, target.x, target.y, radius + 4);
}

function createPathService() {
  return {
    navByKey: new Map(),
    flowByKey: new Map(),
    order: []
  };
}

function pathServiceFor(state) {
  if (!state.__enemyPathService) state.__enemyPathService = createPathService();
  return state.__enemyPathService;
}

function navFor(service, geometry, radius) {
  const shape = gridShapeFor(geometry);
  const key = geometryKey(geometry, shape, radius);
  const cached = service.navByKey.get(key);
  if (cached) return cached;

  const nav = buildNavGrid(geometry, radius);
  service.navByKey.set(nav.key, nav);
  while (service.navByKey.size > 4) {
    const oldest = service.navByKey.keys().next().value;
    service.navByKey.delete(oldest);
    for (const flowKey of [...service.flowByKey.keys()]) {
      if (String(flowKey).startsWith(`${oldest}:to:`)) service.flowByKey.delete(flowKey);
    }
    service.order = service.order.filter((flowKey) => !String(flowKey).startsWith(`${oldest}:to:`));
  }
  return nav;
}

function pruneFlowCache(service) {
  while (service.order.length > FLOW_FIELD_CACHE_LIMIT) {
    const old = service.order.shift();
    if (old) service.flowByKey.delete(old);
  }
}

function flowFieldKey(nav, targetCell) {
  return `${nav.key}:to:${targetCell.c},${targetCell.r}`;
}

function buildFlowField(nav, targetCell, now) {
  const cost = new Uint16Array(nav.total);
  cost.fill(INF);
  const dirX = new Int8Array(nav.total);
  const dirY = new Int8Array(nav.total);
  const queue = [];
  const goalIdx = indexFor(nav, targetCell.c, targetCell.r);
  cost[goalIdx] = 0;
  queue.push(targetCell);

  for (let head = 0; head < queue.length && head < nav.total; head += 1) {
    const current = queue[head];
    const currentIdx = indexFor(nav, current.c, current.r);
    const nextCost = cost[currentIdx] + 1;
    for (const [dc, dr] of NEIGHBORS) {
      const c = current.c + dc;
      const r = current.r + dr;
      if (!cellOpen(nav, c, r)) continue;
      if (!diagonalOpen(nav, current.c, current.r, dc, dr)) continue;
      const idx = indexFor(nav, c, r);
      if (cost[idx] <= nextCost) continue;
      cost[idx] = nextCost;
      dirX[idx] = -dc;
      dirY[idx] = -dr;
      queue.push({ c, r });
    }
  }

  return { cost, dirX, dirY, targetCell, createdAt: now };
}

function flowFor(state, service, nav, target) {
  const now = Number.isFinite(state?.time) ? state.time : 0;
  const targetCell = nearestOpenCell(nav, target.x, target.y);
  const key = flowFieldKey(nav, targetCell);
  const cached = service.flowByKey.get(key);
  if (cached && now - cached.createdAt <= FLOW_FIELD_REFRESH_SECONDS) return cached;

  const flow = buildFlowField(nav, targetCell, now);
  service.flowByKey.set(key, flow);
  service.order.push(key);
  pruneFlowCache(service);
  return flow;
}

function directionFromFlow(nav, flow, enemy, target) {
  const current = nearestOpenCell(nav, enemy.x, enemy.y);
  const idx = indexFor(nav, current.c, current.r);
  if (flow.cost[idx] === INF) return null;

  const dx = flow.dirX[idx];
  const dy = flow.dirY[idx];
  if (!dx && !dy) return norm(target.x - enemy.x, target.y - enemy.y);

  const next = centerForCell(nav, current.c + dx, current.r + dy);
  return norm(next.x - enemy.x, next.y - enemy.y);
}

export function enemyPathDirection(state, geometry, enemy, target, radius = 12) {
  if (!geometry || !enemy || !target) return null;
  if (directPathClear(geometry, enemy, target, radius)) {
    enemy.pathfindDir = null;
    enemy.pathfindTarget = null;
    return norm(target.x - enemy.x, target.y - enemy.y);
  }

  const service = pathServiceFor(state);
  const nav = navFor(service, geometry, radius);
  if (nav.oversized) return norm(target.x - enemy.x, target.y - enemy.y);

  const drift = enemy.pathfindTarget
    ? Math.hypot((enemy.pathfindTarget.x || 0) - target.x, (enemy.pathfindTarget.y || 0) - target.y)
    : Infinity;
  if (enemy.pathfindDir && drift < TARGET_DRIFT) return enemy.pathfindDir;

  const flow = flowFor(state, service, nav, target);
  enemy.pathfindTarget = { x: target.x, y: target.y };
  enemy.pathfindDir = directionFromFlow(nav, flow, enemy, target) || norm(target.x - enemy.x, target.y - enemy.y);
  return enemy.pathfindDir;
}
