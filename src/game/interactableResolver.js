import { CENTER, WORLD } from "../core/constants.js";
import { canPlaceCircleInLocation, portalPointForLocation, roomGeometrySnapshot } from "./roomGeometry.js";
import { bossAnchorPoints, interactableBudgetForLocation, pointKeepsDistance, spawnClearancePoints } from "./interactableBudget.js";

const PLACEMENT_POINTS = Object.freeze({
  field_cache: Object.freeze([
    Object.freeze({ x: CENTER.x - 390, y: CENTER.y - 190 }),
    Object.freeze({ x: CENTER.x + 390, y: CENTER.y + 190 }),
    Object.freeze({ x: CENTER.x - 450, y: CENTER.y + 205 }),
    Object.freeze({ x: CENTER.x + 450, y: CENTER.y - 205 })
  ]),
  reward_center: Object.freeze([
    Object.freeze({ x: CENTER.x, y: CENTER.y - 260 }),
    Object.freeze({ x: CENTER.x - 300, y: CENTER.y + 145 }),
    Object.freeze({ x: CENTER.x + 300, y: CENTER.y + 145 }),
    Object.freeze({ x: CENTER.x - 120, y: CENTER.y + 280 }),
    Object.freeze({ x: CENTER.x + 120, y: CENTER.y + 280 })
  ]),
  casino_center: Object.freeze([
    Object.freeze({ x: CENTER.x, y: CENTER.y - 280 }),
    Object.freeze({ x: CENTER.x - 320, y: CENTER.y + 120 }),
    Object.freeze({ x: CENTER.x + 320, y: CENTER.y + 120 }),
    Object.freeze({ x: CENTER.x, y: CENTER.y + 300 })
  ]),
  distributed: Object.freeze([
    Object.freeze({ x: CENTER.x - 430, y: CENTER.y - 215 }),
    Object.freeze({ x: CENTER.x + 410, y: CENTER.y - 205 }),
    Object.freeze({ x: CENTER.x - 470, y: CENTER.y + 190 }),
    Object.freeze({ x: CENTER.x + 450, y: CENTER.y + 200 }),
    Object.freeze({ x: CENTER.x - 160, y: CENTER.y - 285 }),
    Object.freeze({ x: CENTER.x + 170, y: CENTER.y + 300 }),
    Object.freeze({ x: CENTER.x - 620, y: CENTER.y }),
    Object.freeze({ x: CENTER.x + 600, y: CENTER.y })
  ])
});

function normalizedPoint(point) {
  return {
    x: Math.max(40, Math.min(WORLD.w - 40, Math.round(point.x))),
    y: Math.max(40, Math.min(WORLD.h - 40, Math.round(point.y)))
  };
}

function placementCandidates(slot = {}, index = 0) {
  if (Number.isFinite(slot.x) && Number.isFinite(slot.y)) return [normalizedPoint({ x: slot.x, y: slot.y })];
  const points = PLACEMENT_POINTS[slot.placement] || PLACEMENT_POINTS.distributed;
  const offset = Math.max(0, index % points.length);
  return [...points.slice(offset), ...points.slice(0, offset)].map(normalizedPoint);
}

function keepsSpawnClearance(point, data, slot, budget) {
  const clearance = Math.max(
    0,
    Number(slot?.minSpawnDistance ?? data?.minSpawnDistance ?? budget.spawnClearance) || 0
  );
  return pointKeepsDistance(point, spawnClearancePoints(), clearance);
}

function keepsPortalClearance(point, loc, budget) {
  return pointKeepsDistance(point, [portalPointForLocation(loc)], budget.portalClearance);
}

function keepsBossClearance(point, geometry, budget) {
  return pointKeepsDistance(point, bossAnchorPoints(geometry), budget.bossAnchorClearance);
}

function keepsInteractableSpacing(point, placed, budget) {
  return pointKeepsDistance(point, placed || [], budget.minSpacing);
}

function candidateIsValid(loc, geometry, point, data, slot, placed, budget) {
  const radius = data.radius || 18;
  if (!keepsSpawnClearance(point, data, slot, budget)) return false;
  if (!keepsPortalClearance(point, loc, budget)) return false;
  if (!keepsBossClearance(point, geometry, budget)) return false;
  if (!keepsInteractableSpacing(point, placed, budget)) return false;
  return canPlaceCircleInLocation(geometry, point.x, point.y, radius, budget.wallClearance);
}

export function resolveInteractablePoint(loc, slot, data, placed = [], index = 0) {
  const geometry = roomGeometrySnapshot(loc);
  const budget = interactableBudgetForLocation(loc);
  for (const point of placementCandidates(slot, index)) {
    if (candidateIsValid(loc, geometry, point, data, slot, placed, budget)) return point;
  }
  // Safe deterministic fallback: reuse wider distributed points with relaxed spacing before giving up.
  const relaxed = { ...budget, minSpacing: Math.max(72, budget.minSpacing * 0.62) };
  for (const point of PLACEMENT_POINTS.distributed.map(normalizedPoint)) {
    if (candidateIsValid(loc, geometry, point, data, slot, placed, relaxed)) return point;
  }
  return null;
}

export function interactablePlacementBudgetAllows(loc, placed = []) {
  const budget = interactableBudgetForLocation(loc);
  return placed.length < budget.maxInteractables;
}
