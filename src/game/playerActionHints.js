import { PLAYER_SPEED, WORLD } from "../core/constants.js";
import { clamp } from "../core/math.js";
import { canPlaceCircleInLocation, firstSolidWallHitInState, roomGeometrySnapshotForState } from "./roomGeometry.js";

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function actionRadius(player) {
  return Math.max(8, Number(player?.radius) || 13);
}

export function actionPoseHintFromPose(pose = {}, input = {}) {
  return {
    originX: Number.isFinite(pose?.x) ? pose.x : null,
    originY: Number.isFinite(pose?.y) ? pose.y : null,
    vx: finite(pose?.vx, 0),
    vy: finite(pose?.vy, 0),
    kx: finite(pose?.kx, 0),
    ky: finite(pose?.ky, 0),
    aimX: Number.isFinite(input?.aimX) ? input.aimX : null,
    aimY: Number.isFinite(input?.aimY) ? input.aimY : null,
    aimAngle: Number.isFinite(input?.aimAngle) ? input.aimAngle : finite(pose?.angle, 0)
  };
}

export function attachActionPoseHint(input = {}, pose = {}) {
  if (!input || typeof input !== "object") return input;
  const hint = actionPoseHintFromPose(pose, input);
  input.originX = hint.originX;
  input.originY = hint.originY;
  input.vx = hint.vx;
  input.vy = hint.vy;
  input.kx = hint.kx;
  input.ky = hint.ky;
  return input;
}

export function resolvePlayerActionPose(state, player, payload = {}, options = {}) {
  const radius = actionRadius(player);
  const fallback = {
    x: clamp(finite(player?.x, radius), radius, WORLD.w - radius),
    y: clamp(finite(player?.y, radius), radius, WORLD.h - radius),
    compensated: false,
    accepted: false,
    drift: 0
  };
  if (!state || !player || !Number.isFinite(payload?.originX) || !Number.isFinite(payload?.originY)) return fallback;

  const ox = clamp(payload.originX, radius, WORLD.w - radius);
  const oy = clamp(payload.originY, radius, WORLD.h - radius);
  const dx = ox - fallback.x;
  const dy = oy - fallback.y;
  const drift = Math.hypot(dx, dy);

  const speedBudget = PLAYER_SPEED * Math.max(0.1, player.stats?.speedMult || 1);
  const knockBudget = Math.hypot(finite(payload.kx, 0), finite(payload.ky, 0)) * 0.16;
  const base = Number.isFinite(options.baseDrift) ? options.baseDrift : 52;
  const cap = Number.isFinite(options.maxDrift) ? options.maxDrift : 190;
  const maxDrift = Math.max(base, Math.min(cap, 34 + speedBudget * 0.22 + knockBudget));
  if (drift > maxDrift) return { ...fallback, drift };

  const geometry = roomGeometrySnapshotForState(state);
  const clearancePad = Number.isFinite(options.clearancePad) ? options.clearancePad : 1;
  if (options.validateGeometry !== false && !canPlaceCircleInLocation(geometry, ox, oy, radius, clearancePad)) return { ...fallback, drift };
  if (options.validateLineOfSight !== false) {
    const wallHit = firstSolidWallHitInState(state, fallback.x, fallback.y, ox, oy, radius * 0.65);
    if (wallHit) return { ...fallback, drift };
  }
  return {
    x: ox,
    y: oy,
    compensated: drift > (Number.isFinite(options.compensatedDrift) ? options.compensatedDrift : 6),
    accepted: true,
    drift
  };
}

export function withResolvedActionPose(state, player, payload = {}, options = {}, fn = null) {
  const pose = resolvePlayerActionPose(state, player, payload, options);
  if (!fn || !pose.accepted) return { pose, result: fn ? fn(pose) : null };
  const old = { x: player.x, y: player.y };
  player.x = pose.x;
  player.y = pose.y;
  try {
    return { pose, result: fn(pose) };
  } finally {
    // Keep the action result position if the action itself moved the player; otherwise restore.
    if (options.restoreAfter !== false) {
      player.x = old.x;
      player.y = old.y;
    }
  }
}
