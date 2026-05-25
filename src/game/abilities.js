import { WORLD } from "../core/constants.js";
import { clamp, norm } from "../core/math.js";
import { roomGeometrySnapshot, roomGeometrySnapshotForState, sweepCircleInLocation } from "./roomGeometry.js";
import { resolvePlayerActionPose } from "./playerActionHints.js";
import { buildPlayerEffects, getEffect } from "./effects.js";
import { pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { ABILITY_IDS } from "../data/abilities.js";
import { activeAbilityConfig, abilityInventorySnapshot, abilityStackCount } from "./abilityInventory.js";

const DASH_DEFAULT_DISTANCE = 210;
const DASH_DEFAULT_COOLDOWN = 3.6;
const DASH_DEFAULT_INVULN = 0.14;
const DASH_MAX_DISTANCE = 340;
const DASH_MIN_COOLDOWN = 0.75;
const DASH_VISUAL_AFTERIMAGE_LIMIT = 24;

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function playerEffect(player, type) {
  return getEffect({ effects: buildPlayerEffects(player) }, type);
}

export function dashConfig(player) {
  if (!player || player.hp <= 0) return null;
  const legacyDash = playerEffect(player, "teleportDash");
  const inventoryDash = activeAbilityConfig(player, ABILITY_IDS.TELEPORT_DASH);
  if (!legacyDash && !inventoryDash) return null;
  const afterimage = playerEffect(player, "afterimage");
  const legacyStacks = legacyDash ? Math.max(1, Math.floor(Number(player?.upgrades?.taken?.teleportDash) || 1)) : 0;
  const inventoryStacks = abilityStackCount(player, ABILITY_IDS.TELEPORT_DASH);
  const totalStacks = Math.max(1, legacyStacks + inventoryStacks);
  const dash = {
    distance: Math.max(
      legacyDash ? finiteOr(legacyDash.distance, DASH_DEFAULT_DISTANCE) : 0,
      inventoryDash ? finiteOr(inventoryDash.distance, DASH_DEFAULT_DISTANCE) : 0,
      DASH_DEFAULT_DISTANCE
    ),
    cooldown: Math.min(
      legacyDash ? finiteOr(legacyDash.cooldown, DASH_DEFAULT_COOLDOWN) : DASH_DEFAULT_COOLDOWN,
      inventoryDash ? finiteOr(inventoryDash.cooldown, DASH_DEFAULT_COOLDOWN) : DASH_DEFAULT_COOLDOWN
    ),
    invuln: Math.max(
      legacyDash ? finiteOr(legacyDash.invuln, DASH_DEFAULT_INVULN) : 0,
      inventoryDash ? finiteOr(inventoryDash.invuln, DASH_DEFAULT_INVULN) : 0,
      DASH_DEFAULT_INVULN
    )
  };
  return {
    distance: clamp(dash.distance, 40, DASH_MAX_DISTANCE),
    cooldown: Math.max(DASH_MIN_COOLDOWN, dash.cooldown),
    invuln: clamp(dash.invuln, 0, 0.35),
    source: legacyDash && inventoryDash ? "upgrade+ability_inventory" : legacyDash ? "upgrade" : "ability_inventory",
    stackCount: totalStacks,
    maxCharges: totalStacks,
    afterimageDuration: clamp(finiteOr(afterimage?.duration, 0.24), 0.05, 0.8),
    afterimageCount: clamp(Math.floor(finiteOr(afterimage?.count, 2)) + Math.max(0, totalStacks - 1), 0, DASH_VISUAL_AFTERIMAGE_LIMIT)
  };
}

function ensureAbilityState(player) {
  if (!player.effectState) player.effectState = {};
  if (!player.effectState.dash) {
    player.effectState.dash = {
      cooldownLeft: 0,
      rechargeLeft: 0,
      charges: 0,
      maxChargesSeen: 0,
      invulnLeft: 0,
      seqSeen: 0,
      flash: 0
    };
  }
  return player.effectState.dash;
}

function syncDashCharges(player, config) {
  const dash = ensureAbilityState(player);
  const maxCharges = Math.max(1, Math.floor(Number(config?.maxCharges) || 1));
  const previousMax = Math.max(0, Math.floor(Number(dash.maxChargesSeen) || 0));
  if (!Number.isFinite(dash.charges)) dash.charges = maxCharges;
  dash.charges = Math.max(0, Math.floor(Number(dash.charges) || 0));
  if (previousMax <= 0) dash.charges = maxCharges;
  else if (maxCharges > previousMax) dash.charges += maxCharges - previousMax;
  dash.charges = clamp(dash.charges, 0, maxCharges);
  dash.maxChargesSeen = maxCharges;
  if (dash.charges >= maxCharges) dash.rechargeLeft = 0;
  return dash;
}

export function dashSnapshot(player) {
  const cfg = dashConfig(player);
  if (!cfg) return null;
  const state = syncDashCharges(player, cfg);
  const charges = Math.max(0, Math.floor(Number(state.charges) || 0));
  const maxCharges = Math.max(1, Math.floor(Number(cfg.maxCharges) || 1));
  const cooldownLeft = charges > 0 ? 0 : Math.max(0, state.rechargeLeft || state.cooldownLeft || 0);
  return {
    available: true,
    ready: charges > 0,
    cooldown: Number(cfg.cooldown.toFixed(2)),
    cooldownLeft: Number(cooldownLeft.toFixed(2)),
    rechargeLeft: Number(Math.max(0, state.rechargeLeft || 0).toFixed(2)),
    charges,
    maxCharges,
    stackCount: cfg.stackCount || maxCharges,
    distance: Math.round(cfg.distance),
    invulnLeft: Number(Math.max(0, state.invulnLeft || 0).toFixed(2)),
    source: cfg.source || "upgrade"
  };
}

export function abilitySnapshot(player) {
  const dash = dashSnapshot(player);
  const inventory = abilityInventorySnapshot(player);
  if (!dash && !inventory.ownedAbilities.length && !Object.keys(inventory.shards || {}).length) return null;
  return {
    dash,
    inventory
  };
}

export function tickActiveAbilities(player, dt) {
  const cfg = dashConfig(player);
  if (!cfg) return;
  const dash = syncDashCharges(player, cfg);
  const maxCharges = Math.max(1, Math.floor(Number(cfg.maxCharges) || 1));
  dash.invulnLeft = Math.max(0, (dash.invulnLeft || 0) - dt);
  dash.flash = Math.max(0, (dash.flash || 0) - dt);
  if (dash.charges < maxCharges) {
    dash.rechargeLeft = Math.max(0, Number.isFinite(dash.rechargeLeft) ? dash.rechargeLeft : cfg.cooldown);
    dash.rechargeLeft -= dt;
    while (dash.rechargeLeft <= 0 && dash.charges < maxCharges) {
      dash.charges += 1;
      dash.rechargeLeft += cfg.cooldown;
    }
    if (dash.charges >= maxCharges) dash.rechargeLeft = 0;
  } else {
    dash.rechargeLeft = 0;
  }
  dash.cooldownLeft = dash.charges > 0 ? 0 : Math.max(0, dash.rechargeLeft || 0);
}

export function isDashInvulnerable(player) {
  return (player?.effectState?.dash?.invulnLeft || 0) > 0;
}

function dashDirection(input = {}, player = {}) {
  const xAxis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const yAxis = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (xAxis || yAxis) return norm(xAxis, yAxis);
  const angle = Number.isFinite(input.aimAngle) ? input.aimAngle : (Number.isFinite(player.angle) ? player.angle : 0);
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function applyDashMovement(player, input, config, loc = null) {
  const dir = dashDirection(input, player);
  const before = { x: player.x, y: player.y };
  const radius = player.radius || 13;
  const targetX = player.x + dir.x * config.distance;
  const targetY = player.y + dir.y * config.distance;
  if (loc) {
    const swept = sweepCircleInLocation(roomGeometrySnapshot(loc), player.x, player.y, dir.x * config.distance, dir.y * config.distance, radius);
    player.x = swept.x;
    player.y = swept.y;
  } else {
    player.x = clamp(targetX, radius, WORLD.w - radius);
    player.y = clamp(targetY, radius, WORLD.h - radius);
  }
  player.vx = 0;
  player.vy = 0;
  player.kx = dir.x * 68;
  player.ky = dir.y * 68;
  if (Number.isFinite(input?.aimAngle)) player.angle = input.aimAngle;
  return { before, after: { x: player.x, y: player.y }, dir };
}

function addDashVisuals(state, player, movement, config) {
  if (!state?.effects) return;
  const count = config.afterimageCount;
  const life = config.afterimageDuration;
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0 : i / Math.max(1, count - 1);
    const x = movement.before.x + (movement.after.x - movement.before.x) * t;
    const y = movement.before.y + (movement.after.y - movement.before.y) * t;
    pushVisualEffect(state, {
      id: `ai${state.tick}-${player.id}-${i}`,
      type: "afterimage",
      playerId: player.id,
      x: Math.round(x),
      y: Math.round(y),
      angle: Number(player.angle || 0),
      skin: player.skin || "default",
      life: life * (1 - t * 0.38),
      maxLife: life,
      localIndex: i
    });
  }
  pushVisualEffect(state, {
    id: `db${state.tick}-${player.id}`,
    type: "dashBurst",
    playerId: player.id,
    x: Math.round(movement.after.x),
    y: Math.round(movement.after.y),
    vx: Math.round(movement.dir.x * 100),
    vy: Math.round(movement.dir.y * 100),
    life: 0.18,
    maxLife: 0.18
  });
}

export function performDash(state, playerId, input = {}, request = {}) {
  const player = state?.players?.[playerId];
  if (!player || player.hp <= 0) return { ok: false, reason: "no-player" };
  const cfg = dashConfig(player);
  if (!cfg) return { ok: false, reason: "no-upgrade" };
  const dash = syncDashCharges(player, cfg);
  const seq = Math.max(0, Math.floor(request.seq || 0));
  if (seq && seq <= (dash.seqSeen || 0)) return { ok: false, reason: "old-seq" };
  if ((dash.charges || 0) <= 0) return { ok: false, reason: "cooldown" };

  const dashStart = resolvePlayerActionPose(state, player, input, {
    baseDrift: 64,
    maxDrift: 170,
    compensatedDrift: 8,
    validateGeometry: true,
    validateLineOfSight: true
  });
  if (dashStart.accepted) {
    player.x = dashStart.x;
    player.y = dashStart.y;
  }

  const movement = applyDashMovement(player, input, cfg, roomGeometrySnapshotForState(state));
  dash.charges = Math.max(0, Math.floor(dash.charges || 0) - 1);
  if (dash.charges < Math.max(1, Math.floor(cfg.maxCharges || 1)) && !(dash.rechargeLeft > 0)) dash.rechargeLeft = cfg.cooldown;
  dash.cooldownLeft = dash.charges > 0 ? 0 : Math.max(0, dash.rechargeLeft || cfg.cooldown);
  dash.invulnLeft = cfg.invuln;
  dash.flash = 0.22;
  if (seq) dash.seqSeen = seq;
  addDashVisuals(state, player, movement, cfg);
  pushEvent(state, { type: "dash", playerId, x: player.x, y: player.y, compensatedOrigin: !!dashStart.compensated });
  return { ok: true, movement, config: cfg };
}

export function canPredictDash(player, nowSec = 0) {
  const dash = player?.ability?.dash;
  if (!dash?.available) return false;
  if (Number.isFinite(dash.charges) && dash.charges <= 0) return false;
  if (!Number.isFinite(dash.charges) && (dash.cooldownLeft || 0) > 0) return false;
  if (player._localDashLockUntil && player._localDashLockUntil > nowSec) return false;
  return true;
}

export function predictLocalDash(player, input = {}, nowSec = 0, loc = null) {
  const dash = player?.ability?.dash;
  if (!dash?.available) return false;
  const cfg = {
    distance: clamp(finiteOr(dash.distance, DASH_DEFAULT_DISTANCE), 40, DASH_MAX_DISTANCE),
    cooldown: Math.max(DASH_MIN_COOLDOWN, finiteOr(dash.cooldown, DASH_DEFAULT_COOLDOWN))
  };
  applyDashMovement(player, input, cfg, loc);
  const maxCharges = Math.max(1, Math.floor(Number(dash.maxCharges) || 1));
  const currentCharges = Number.isFinite(dash.charges) ? Math.max(0, Math.floor(dash.charges)) : maxCharges;
  const nextCharges = Math.max(0, currentCharges - 1);
  player._localDashLockUntil = nowSec + 0.08;
  player._localDashPredictedAt = typeof performance !== "undefined" ? performance.now() : 0;
  if (!player.ability) player.ability = {};
  player.ability.dash = {
    ...dash,
    ready: nextCharges > 0,
    charges: nextCharges,
    maxCharges,
    cooldownLeft: nextCharges > 0 ? 0 : cfg.cooldown,
    rechargeLeft: nextCharges < maxCharges ? (dash.rechargeLeft || cfg.cooldown) : 0
  };
  return true;
}
