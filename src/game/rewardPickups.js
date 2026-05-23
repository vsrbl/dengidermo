import { GREEN, PLAYER_RADIUS, WORLD } from "../core/constants.js";
import { clamp, dist2 } from "../core/math.js";
import { LOOT } from "../data/loot.js";
import { getAbility, abilityIsRewardable } from "../data/abilities.js";
import { REWARD_TYPES, rewardTypeUsesPickup } from "../data/rewardTypes.js";
import { pushVisualEffect } from "./effectCommands.js";
import { attractLootToPlayer, buildPlayerEffects, healPlayer } from "./effects.js";
import { nextId } from "./entityIds.js";
import { pushEvent } from "./events.js";
import { giveWeapon } from "./inventory.js";
import { applyAbilityReward } from "./abilityRewards.js";

const DEFAULT_REWARD_PICKUP_RADIUS = 11;
const DEFAULT_CLAIM_DELAY = 0.42;
const DEFAULT_CLAIM_PAD = 5;
const DEFAULT_REWARD_POP_DISTANCE = 14;

function randomPopVector(state, distance = DEFAULT_REWARD_POP_DISTANCE) {
  const rng = state?.rng || null;
  const angle = rng?.range ? rng.range(0, Math.PI * 2) : Math.random() * Math.PI * 2;
  const dist = Number.isFinite(distance) ? Math.max(0, distance) : DEFAULT_REWARD_POP_DISTANCE;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
}

function rewardAbilityId(reward = {}) {
  return reward.abilityId || reward.kind || null;
}

function rewardPickupData(reward = {}) {
  if (reward.type === REWARD_TYPES.LOOT) return LOOT[reward.kind] || null;
  if (reward.type === REWARD_TYPES.ABILITY_PICKUP || reward.type === REWARD_TYPES.ABILITY_SHARD) return getAbility(rewardAbilityId(reward));
  return null;
}

function rewardPickupLabel(reward = {}) {
  const data = rewardPickupData(reward);
  if (reward.type === REWARD_TYPES.ABILITY_SHARD && data?.pickup?.label) return `${data.pickup.label} SHARD`;
  if (data?.pickup?.label) return data.pickup.label;
  if (data?.name) return data.name;
  if (reward.kind) return String(reward.kind).toUpperCase();
  if (reward.abilityId) return String(reward.abilityId).toUpperCase();
  return String(reward.type || "REWARD").toUpperCase();
}

function rewardPickupRadius(reward = {}) {
  const data = rewardPickupData(reward);
  return Math.max(DEFAULT_REWARD_PICKUP_RADIUS, data?.radius || data?.pickup?.radius || DEFAULT_REWARD_PICKUP_RADIUS);
}

export function spawnRewardPickup(state, reward, x, y, options = {}) {
  if (!state || !reward || !rewardTypeUsesPickup(reward.type)) return null;
  if (reward.type === REWARD_TYPES.LOOT && !LOOT[reward.kind]) return null;
  if ((reward.type === REWARD_TYPES.ABILITY_PICKUP || reward.type === REWARD_TYPES.ABILITY_SHARD) && !abilityIsRewardable(rewardAbilityId(reward))) return null;
  if (!state.rewardPickups) state.rewardPickups = {};

  const radius = rewardPickupRadius(reward);
  const id = nextId("reward");
  const popDistance = Number.isFinite(options.popDistance) ? Math.max(0, options.popDistance) : DEFAULT_REWARD_POP_DISTANCE;
  const pop = randomPopVector(state, popDistance);
  const finalX = clamp(x + pop.x, 20, WORLD.w - 20);
  const finalY = clamp(y + pop.y, 20, WORLD.h - 20);
  const pickup = {
    id,
    rewardType: reward.type,
    kind: reward.kind || rewardAbilityId(reward) || null,
    abilityId: rewardAbilityId(reward),
    shardAmount: reward.type === REWARD_TYPES.ABILITY_SHARD ? Math.max(1, Math.floor(Number(reward.amount) || 1)) : 0,
    label: rewardPickupLabel(reward),
    x: finalX,
    y: finalY,
    spawnX: clamp(x, 20, WORLD.w - 20),
    spawnY: clamp(y, 20, WORLD.h - 20),
    popDistance: Math.hypot(finalX - x, finalY - y),
    radius,
    claimRadius: Number.isFinite(options.claimRadius) ? Math.max(radius, options.claimRadius) : radius + DEFAULT_CLAIM_PAD,
    claimDelay: Number.isFinite(options.claimDelay) ? Math.max(0, options.claimDelay) : DEFAULT_CLAIM_DELAY,
    claimMode: options.claimMode || "proximity",
    claimScope: options.claimScope || "team",
    playerId: options.playerId || null,
    sourceType: options.sourceType || "reward",
    sourceId: options.sourceId || null,
    tableId: options.tableId || reward.tableId || null,
    revealSource: options.revealSource || options.sourceType || "reward",
    revealProfile: options.revealProfile || null,
    rollIndex: Number.isFinite(reward.rollIndex) ? reward.rollIndex : null,
    active: true,
    claimed: false,
    createdAt: state.time || 0,
    accent: options.accent || (reward.type === REWARD_TYPES.ABILITY_PICKUP || reward.type === REWARD_TYPES.ABILITY_SHARD ? "white" : "green")
  };
  state.rewardPickups[id] = pickup;
  return pickup;
}

export function canClaimRewardPickup(state, pickup, player, options = {}) {
  if (!state || !pickup || !player || player.hp <= 0) return { ok: false, reason: "invalid_actor" };
  if (!pickup.active || pickup.claimed) return { ok: false, reason: "inactive" };
  if (options.ignoreDelay !== true && (pickup.claimDelay || 0) > 0) return { ok: false, reason: "warming_up" };
  if (pickup.claimScope === "personal" && pickup.playerId && pickup.playerId !== player.id) return { ok: false, reason: "wrong_player" };
  if (options.validateDistance !== false) {
    const r = (pickup.claimRadius || pickup.radius || DEFAULT_REWARD_PICKUP_RADIUS) + (player.radius || PLAYER_RADIUS);
    if (dist2(player.x, player.y, pickup.x, pickup.y) > r * r) return { ok: false, reason: "too_far" };
  }
  return { ok: true };
}

function applyLootRewardPickup(state, pickup, player) {
  const data = LOOT[pickup.kind];
  if (!data) return false;
  if (data.type === "heal") {
    healPlayer(state, player, {
      amount: data.amount,
      sourceType: "reward_pickup",
      sourceId: pickup.id,
      tags: ["reward", "pickup", "loot", pickup.kind]
    });
    return true;
  }
  if (data.type === "weapon") {
    giveWeapon(player, data.weaponId, true);
    return true;
  }
  return false;
}

function applyAbilityRewardPickup(pickup, player) {
  return applyAbilityReward(player, pickup);
}

function claimedRewardText(pickup, result = null) {
  if (pickup.rewardType === REWARD_TYPES.ABILITY_PICKUP || pickup.rewardType === REWARD_TYPES.ABILITY_SHARD) {
    const stack = Math.max(0, Math.floor(Number(result?.stack) || 0));
    return stack > 1 ? `DASH x${stack}` : "DASH ONLINE";
  }
  return String(pickup.label || "REWARD").slice(0, 16);
}

export function claimRewardPickup(state, pickup, player, options = {}) {
  const check = canClaimRewardPickup(state, pickup, player, options);
  if (!check.ok) return false;

  let applied = false;
  let rewardResult = null;
  if (pickup.rewardType === REWARD_TYPES.LOOT) applied = applyLootRewardPickup(state, pickup, player);
  if (pickup.rewardType === REWARD_TYPES.ABILITY_PICKUP || pickup.rewardType === REWARD_TYPES.ABILITY_SHARD) {
    rewardResult = applyAbilityRewardPickup(pickup, player);
    applied = !!rewardResult?.ok;
  }
  if (!applied) return false;

  pickup.claimed = true;
  pickup.active = false;
  pickup.claimedBy = player.id;
  delete state.rewardPickups[pickup.id];

  pushVisualEffect(state, {
    type: "damageText",
    x: Math.round(pickup.x),
    y: Math.round(pickup.y - 18),
    text: claimedRewardText(pickup, rewardResult),
    color: GREEN,
    life: 0.56,
    maxLife: 0.56
  });
  pushEvent(state, {
    type: "rewardPickup",
    action: "claimed",
    playerId: player.id,
    rewardType: pickup.rewardType,
    kind: pickup.kind || null,
    abilityId: pickup.abilityId || null,
    abilityStack: rewardResult?.stack || null,
    abilityIsNew: rewardResult?.isNew ?? null,
    sourceType: pickup.sourceType || null,
    sourceId: pickup.sourceId || null,
    tableId: pickup.tableId || null,
    x: Math.round(pickup.x),
    y: Math.round(pickup.y)
  });
  return true;
}

export function updateRewardPickups(state, dt = 0.016) {
  if (!state?.rewardPickups) return;
  for (const player of Object.values(state.players || {})) {
    player.effects = buildPlayerEffects(player);
    if (player.hp <= 0) continue;
    for (const pickup of Object.values(state.rewardPickups)) {
      if (!pickup.active || pickup.claimed || (pickup.claimDelay || 0) > 0) continue;
      if (pickup.claimScope === "personal" && pickup.playerId && pickup.playerId !== player.id) continue;
      attractLootToPlayer(player, pickup, dt, state);
    }
  }
  for (const pickup of Object.values(state.rewardPickups)) {
    pickup.claimDelay = Math.max(0, (pickup.claimDelay || 0) - dt);
    if (!pickup.active || pickup.claimed) continue;
    for (const player of Object.values(state.players || {})) {
      if (claimRewardPickup(state, pickup, player)) break;
    }
  }
}

export function rewardPickupSnapshot(pickup) {
  return {
    id: pickup.id,
    rewardType: pickup.rewardType,
    kind: pickup.kind || null,
    abilityId: pickup.abilityId || null,
    playerId: pickup.playerId || null,
    claimScope: pickup.claimScope || "team",
    label: pickup.label || pickup.kind || pickup.abilityId || pickup.rewardType,
    x: Math.round(pickup.x),
    y: Math.round(pickup.y),
    spawnX: Math.round(Number.isFinite(pickup.spawnX) ? pickup.spawnX : pickup.x),
    spawnY: Math.round(Number.isFinite(pickup.spawnY) ? pickup.spawnY : pickup.y),
    popDistance: Math.round(Number.isFinite(pickup.popDistance) ? pickup.popDistance : 0),
    radius: pickup.radius,
    claimRadius: pickup.claimRadius,
    claimable: (pickup.claimDelay || 0) <= 0,
    active: !!pickup.active,
    sourceType: pickup.sourceType || null,
    sourceId: pickup.sourceId || null,
    tableId: pickup.tableId || null,
    revealSource: pickup.revealSource || pickup.sourceType || null,
    revealProfile: pickup.revealProfile || null,
    accent: pickup.accent || "green"
  };
}
