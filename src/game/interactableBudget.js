import { CENTER, SPAWN_OFFSETS } from "../core/constants.js";
import { dist2 } from "../core/math.js";

export const INTERACTABLE_BUDGET_SCHEMA_VERSION = 1;

export const INTERACTABLE_BUDGET_DEFAULTS = Object.freeze({
  maxNormal: 3,
  maxReward: 5,
  minSpacing: 138,
  minRewardSpacing: 112,
  portalClearance: 150,
  bossAnchorClearance: 220,
  spawnClearance: 165,
  wallClearance: 18
});

export function spawnClearancePoints() {
  return SPAWN_OFFSETS.map((offset) => ({ x: CENTER.x + offset.x, y: CENTER.y + offset.y }));
}

export function interactableBudgetForLocation(loc = {}) {
  const tags = new Set([...(loc.tags || []), loc.category].filter(Boolean));
  const rewardLike = tags.has("reward") || tags.has("no-combat");
  return Object.freeze({
    maxInteractables: rewardLike ? INTERACTABLE_BUDGET_DEFAULTS.maxReward : INTERACTABLE_BUDGET_DEFAULTS.maxNormal,
    minSpacing: rewardLike ? INTERACTABLE_BUDGET_DEFAULTS.minRewardSpacing : INTERACTABLE_BUDGET_DEFAULTS.minSpacing,
    portalClearance: INTERACTABLE_BUDGET_DEFAULTS.portalClearance,
    bossAnchorClearance: INTERACTABLE_BUDGET_DEFAULTS.bossAnchorClearance,
    spawnClearance: INTERACTABLE_BUDGET_DEFAULTS.spawnClearance,
    wallClearance: INTERACTABLE_BUDGET_DEFAULTS.wallClearance
  });
}

export function pointKeepsDistance(point, blockers = [], minDistance = 0) {
  const min = Math.max(0, Number(minDistance) || 0);
  if (!min) return true;
  const min2 = min * min;
  return blockers.every((blocker) => dist2(point.x, point.y, blocker.x, blocker.y) >= min2);
}

export function bossAnchorPoints(geometry = {}) {
  return (geometry.spawnAnchors || [])
    .filter((anchor) => (anchor.tags || []).includes("boss") || String(anchor.id || "").includes("boss"))
    .map((anchor) => ({ x: anchor.x, y: anchor.y }));
}
