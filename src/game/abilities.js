import { WORLD } from "../core/constants.js";
import { clamp, norm } from "../core/math.js";
import { buildPlayerEffects, getEffect } from "./effects.js";
import { pushVisualEffect } from "./effectCommands.js";

const DASH_DEFAULT_DISTANCE = 210;
const DASH_DEFAULT_COOLDOWN = 3.6;
const DASH_DEFAULT_INVULN = 0.14;
const DASH_MAX_DISTANCE = 340;
const DASH_MIN_COOLDOWN = 0.75;

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function playerEffect(player, type) {
  return getEffect({ effects: buildPlayerEffects(player) }, type);
}

export function dashConfig(player) {
  if (!player || player.hp <= 0) return null;
  const dash = playerEffect(player, "teleportDash");
  if (!dash) return null;
  const afterimage = playerEffect(player, "afterimage");
  return {
    distance: clamp(finiteOr(dash.distance, DASH_DEFAULT_DISTANCE), 40, DASH_MAX_DISTANCE),
    cooldown: Math.max(DASH_MIN_COOLDOWN, finiteOr(dash.cooldown, DASH_DEFAULT_COOLDOWN)),
    invuln: clamp(finiteOr(dash.invuln, DASH_DEFAULT_INVULN), 0, 0.35),
    afterimageDuration: clamp(finiteOr(afterimage?.duration, 0.24), 0.05, 0.8),
    afterimageCount: clamp(Math.floor(finiteOr(afterimage?.count, 2)), 0, 8)
  };
}

function ensureAbilityState(player) {
  if (!player.effectState) player.effectState = {};
  if (!player.effectState.dash) {
    player.effectState.dash = {
      cooldownLeft: 0,
      invulnLeft: 0,
      seqSeen: 0,
      flash: 0
    };
  }
  return player.effectState.dash;
}

export function dashSnapshot(player) {
  const cfg = dashConfig(player);
  if (!cfg) return null;
  const state = ensureAbilityState(player);
  return {
    available: true,
    ready: (state.cooldownLeft || 0) <= 0,
    cooldown: Number(cfg.cooldown.toFixed(2)),
    cooldownLeft: Number(Math.max(0, state.cooldownLeft || 0).toFixed(2)),
    distance: Math.round(cfg.distance),
    invulnLeft: Number(Math.max(0, state.invulnLeft || 0).toFixed(2))
  };
}

export function abilitySnapshot(player) {
  const dash = dashSnapshot(player);
  return dash ? { dash } : null;
}

export function tickActiveAbilities(player, dt) {
  const cfg = dashConfig(player);
  if (!cfg) return;
  const dash = ensureAbilityState(player);
  dash.cooldownLeft = Math.max(0, (dash.cooldownLeft || 0) - dt);
  dash.invulnLeft = Math.max(0, (dash.invulnLeft || 0) - dt);
  dash.flash = Math.max(0, (dash.flash || 0) - dt);
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

export function applyDashMovement(player, input, config) {
  const dir = dashDirection(input, player);
  const before = { x: player.x, y: player.y };
  const radius = player.radius || 13;
  player.x = clamp(player.x + dir.x * config.distance, radius, WORLD.w - radius);
  player.y = clamp(player.y + dir.y * config.distance, radius, WORLD.h - radius);
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
  const dash = ensureAbilityState(player);
  const seq = Math.max(0, Math.floor(request.seq || 0));
  if (seq && seq <= (dash.seqSeen || 0)) return { ok: false, reason: "old-seq" };
  if ((dash.cooldownLeft || 0) > 0) return { ok: false, reason: "cooldown" };

  const movement = applyDashMovement(player, input, cfg);
  dash.cooldownLeft = cfg.cooldown;
  dash.invulnLeft = cfg.invuln;
  dash.flash = 0.22;
  if (seq) dash.seqSeen = seq;
  addDashVisuals(state, player, movement, cfg);
  if (Array.isArray(state.events)) {
    state.events.push({ id: `dash${state.tick}-${playerId}-${seq || 0}`, t: state.time || 0, type: "dash", playerId, x: player.x, y: player.y });
    if (state.events.length > 32) state.events.splice(0, state.events.length - 32);
  }
  return { ok: true, movement, config: cfg };
}

export function canPredictDash(player, nowSec = 0) {
  const dash = player?.ability?.dash;
  if (!dash?.available) return false;
  if ((dash.cooldownLeft || 0) > 0) return false;
  if (player._localDashLockUntil && player._localDashLockUntil > nowSec) return false;
  return true;
}

export function predictLocalDash(player, input = {}, nowSec = 0) {
  const dash = player?.ability?.dash;
  if (!dash?.available) return false;
  const cfg = {
    distance: clamp(finiteOr(dash.distance, DASH_DEFAULT_DISTANCE), 40, DASH_MAX_DISTANCE),
    cooldown: Math.max(DASH_MIN_COOLDOWN, finiteOr(dash.cooldown, DASH_DEFAULT_COOLDOWN))
  };
  applyDashMovement(player, input, cfg);
  player._localDashLockUntil = nowSec + cfg.cooldown;
  player._localDashPredictedAt = typeof performance !== "undefined" ? performance.now() : 0;
  if (!player.ability) player.ability = {};
  player.ability.dash = { ...dash, ready: false, cooldownLeft: cfg.cooldown };
  return true;
}
