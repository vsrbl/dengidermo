import { GREEN, PLAYER_RADIUS, RED, WORLD } from "../core/constants.js";
import { clamp, dist2 } from "../core/math.js";
import { ECONOMY_PICKUP_TYPES, economyPickupTypeIsKnown, normalizeEconomyAmount } from "../data/economy.js";
import { pushVisualEffect } from "./effectCommands.js";
import { attractLootToPlayer, buildPlayerEffects, healPlayer } from "./effects.js";
import { nextId } from "./entityIds.js";
import { pushEvent } from "./events.js";
import { grantMoney, grantXp } from "./playerEconomy.js";

const DEFAULT_RADIUS_BY_TYPE = Object.freeze({
  [ECONOMY_PICKUP_TYPES.MONEY]: 7,
  [ECONOMY_PICKUP_TYPES.XP]: 6,
  [ECONOMY_PICKUP_TYPES.HEAL]: 10
});

const DEFAULT_CLAIM_DELAY = 0.18;
const DEFAULT_CLAIM_PAD = 7;

function pickupLabel(type) {
  if (type === ECONOMY_PICKUP_TYPES.MONEY) return "GLD";
  if (type === ECONOMY_PICKUP_TYPES.XP) return "EXP";
  if (type === ECONOMY_PICKUP_TYPES.HEAL) return "HEA";
  return String(type || "DROP").toUpperCase().slice(0, 3);
}

function pickupAccent(type) {
  if (type === ECONOMY_PICKUP_TYPES.HEAL) return GREEN;
  if (type === ECONOMY_PICKUP_TYPES.XP) return "#d4d4d4";
  if (type === ECONOMY_PICKUP_TYPES.MONEY) return "#8f8f8f";
  return RED;
}

export function spawnEconomyPickup(state, drop, x, y, options = {}) {
  if (!state || !drop || !economyPickupTypeIsKnown(drop.type)) return null;
  const amount = normalizeEconomyAmount(drop.amount, 0);
  if (amount <= 0) return null;
  if (!state.economyPickups) state.economyPickups = {};
  const type = drop.type;
  const jitter = Number.isFinite(options.jitter) ? Math.max(0, options.jitter) : 0;
  const radius = Math.max(3, Number.isFinite(drop.radius) ? drop.radius : (DEFAULT_RADIUS_BY_TYPE[type] || 8));
  const id = nextId("eco");
  const item = {
    id,
    type,
    amount,
    label: drop.label || pickupLabel(type),
    x: clamp(x + (jitter ? state.rng.range(-jitter, jitter) : 0), 20, WORLD.w - 20),
    y: clamp(y + (jitter ? state.rng.range(-jitter, jitter) : 0), 20, WORLD.h - 20),
    radius,
    claimRadius: Math.max(radius + DEFAULT_CLAIM_PAD, Number.isFinite(options.claimRadius) ? options.claimRadius : radius + DEFAULT_CLAIM_PAD),
    claimDelay: Number.isFinite(options.claimDelay) ? Math.max(0, options.claimDelay) : DEFAULT_CLAIM_DELAY,
    active: true,
    claimed: false,
    createdAt: state.time || 0,
    sourceType: options.sourceType || "drop",
    sourceId: options.sourceId || null,
    enemyKind: options.enemyKind || null,
    accent: options.accent || pickupAccent(type)
  };
  state.economyPickups[id] = item;
  return item;
}

export function canClaimEconomyPickup(state, pickup, player, options = {}) {
  if (!state || !pickup || !player || player.hp <= 0) return { ok: false, reason: "invalid_actor" };
  if (!pickup.active || pickup.claimed) return { ok: false, reason: "inactive" };
  if (options.ignoreDelay !== true && (pickup.claimDelay || 0) > 0) return { ok: false, reason: "warming_up" };
  if (options.validateDistance !== false) {
    const r = (pickup.claimRadius || pickup.radius || 8) + (player.radius || PLAYER_RADIUS);
    if (dist2(player.x, player.y, pickup.x, pickup.y) > r * r) return { ok: false, reason: "too_far" };
  }
  return { ok: true };
}

function applyEconomyPickup(state, pickup, player) {
  const context = { sourceType: "economy_pickup", sourceId: pickup.id };
  if (pickup.type === ECONOMY_PICKUP_TYPES.MONEY) return grantMoney(state, player, pickup.amount, context).ok;
  if (pickup.type === ECONOMY_PICKUP_TYPES.XP) return grantXp(state, player, pickup.amount, context).ok;
  if (pickup.type === ECONOMY_PICKUP_TYPES.HEAL) {
    healPlayer(state, player, {
      amount: pickup.amount,
      sourceType: "economy_pickup",
      sourceId: pickup.id,
      tags: ["drop", "pickup", "heal", "economy"]
    });
    return true;
  }
  return false;
}

export function claimEconomyPickup(state, pickup, player, options = {}) {
  const check = canClaimEconomyPickup(state, pickup, player, options);
  if (!check.ok) return false;
  if (!applyEconomyPickup(state, pickup, player)) return false;

  pickup.claimed = true;
  pickup.active = false;
  pickup.claimedBy = player.id;
  delete state.economyPickups[pickup.id];

  pushVisualEffect(state, {
    type: "damageText",
    x: Math.round(pickup.x),
    y: Math.round(pickup.y - 16),
    text: String(pickup.label || "DROP").slice(0, 16),
    color: pickup.accent || GREEN,
    life: 0.5,
    maxLife: 0.5
  });
  pushEvent(state, {
    type: "economyPickup",
    action: "claimed",
    playerId: player.id,
    pickupType: pickup.type,
    amount: pickup.amount,
    enemyKind: pickup.enemyKind || null,
    sourceType: pickup.sourceType || null,
    sourceId: pickup.sourceId || null,
    x: Math.round(pickup.x),
    y: Math.round(pickup.y)
  });
  return true;
}

export function updateEconomyPickups(state, dt = 0.016) {
  if (!state?.economyPickups) return;
  for (const player of Object.values(state.players || {})) {
    player.effects = buildPlayerEffects(player);
    if (player.hp <= 0) continue;
    for (const pickup of Object.values(state.economyPickups)) {
      if (!pickup.active || pickup.claimed || (pickup.claimDelay || 0) > 0) continue;
      attractLootToPlayer(player, pickup, dt, state);
    }
  }
  for (const pickup of Object.values(state.economyPickups)) {
    pickup.claimDelay = Math.max(0, (pickup.claimDelay || 0) - dt);
    if (!pickup.active || pickup.claimed) continue;
    for (const player of Object.values(state.players || {})) {
      if (claimEconomyPickup(state, pickup, player)) break;
    }
  }
}

export function economyPickupSnapshot(pickup) {
  return {
    id: pickup.id,
    type: pickup.type,
    amount: pickup.amount,
    label: pickup.label || pickup.type,
    x: Math.round(pickup.x),
    y: Math.round(pickup.y),
    radius: pickup.radius,
    claimRadius: pickup.claimRadius,
    claimable: (pickup.claimDelay || 0) <= 0,
    active: !!pickup.active,
    accent: pickup.accent || GREEN
  };
}
