import { GREEN, RED } from "../core/constants.js";
import { ECONOMY_PICKUP_TYPES } from "../data/economy.js";
import { REWARD_SOURCE_IDS } from "../data/rewardSources.js";
import { REWARD_TYPES, rewardTypeUsesPickup } from "../data/rewardTypes.js";
import { pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { queueRoomModifierInjection } from "./pendingRoomModifiers.js";
import { spawnEconomyPickup } from "./economyPickups.js";
import { spawnRewardPickup } from "./rewardPickups.js";

export const REWARD_COMMAND_TYPES = Object.freeze({
  SPAWN_PICKUP: "spawnRewardPickup",
  EMIT_NOTHING: "emitRewardNothing",
  QUEUE_ROOM_MODIFIER: "queueRoomModifier",
  SPAWN_ECONOMY_PICKUP: "spawnEconomyPickup"
});


function economySourceContractId(context = {}) {
  if (context.sourceContractId) return context.sourceContractId;
  if (context.sourceType === "chest") return REWARD_SOURCE_IDS.CHEST;
  if (context.sourceType === "casino") return REWARD_SOURCE_IDS.CASINO;
  if (context.sourceType === "room_reward") return REWARD_SOURCE_IDS.ROOM_REWARD;
  return null;
}

function rewardEconomyAmount(state, amount) {
  if (Number.isFinite(amount)) return Math.max(0, Math.floor(amount));
  if (Array.isArray(amount) && amount.length === 2 && amount.every(Number.isFinite)) {
    const min = Math.floor(Math.min(amount[0], amount[1]));
    const max = Math.floor(Math.max(amount[0], amount[1]));
    if (state?.rng?.range) return Math.max(0, Math.floor(state.rng.range(min, max + 1)));
    return Math.max(0, min);
  }
  return 0;
}

function rewardRevealLabel(reward = {}, spawned = null) {
  if (spawned?.label) return String(spawned.label).toUpperCase().slice(0, 16);
  if (reward.text) return String(reward.text).toUpperCase().slice(0, 16);
  if (reward.pickupType) {
    if (reward.pickupType === ECONOMY_PICKUP_TYPES.MONEY) return "GLD";
    if (reward.pickupType === ECONOMY_PICKUP_TYPES.XP) return "EXP";
    if (reward.pickupType === ECONOMY_PICKUP_TYPES.HEAL) return "HEA";
  }
  if (reward.kind) return String(reward.kind).toUpperCase().slice(0, 16);
  if (reward.abilityId) return String(reward.abilityId).toUpperCase().slice(0, 16);
  return String(reward.type || "REWARD").toUpperCase().slice(0, 16);
}

function rewardRevealKind(reward = {}, spawned = null) {
  if (spawned?.type) return spawned.type;
  if (reward.pickupType) return reward.pickupType;
  if (reward.type === REWARD_TYPES.LOOT) return reward.kind || "loot";
  if (reward.type === REWARD_TYPES.ABILITY_PICKUP) return reward.abilityId || reward.kind || "ability";
  if (reward.type === REWARD_TYPES.ABILITY_SHARD) return reward.abilityId || reward.kind || "ability_shard";
  if (reward.type === REWARD_TYPES.MODIFIER_INJECTION || reward.type === REWARD_TYPES.CURSE) return reward.modifierId || "modifier";
  return reward.type || null;
}

function emitRewardRevealEvent(state, reward, spawned, position, context = {}) {
  const sourceType = context.sourceType || "reward";
  if (sourceType !== "chest" && sourceType !== "casino") return;
  pushEvent(state, {
    type: "reward",
    action: "revealed",
    sourceType,
    sourceId: context.sourceId || null,
    playerId: context.playerId || null,
    tableId: reward.tableId || context.tableId || null,
    chestId: context.chestId || null,
    chestTier: context.chestTier || null,
    machineId: context.machineId || null,
    stakeId: context.stakeId || null,
    outcomeId: context.outcomeId || null,
    symbolId: context.symbolId || null,
    rewardType: reward.type || null,
    rewardKind: rewardRevealKind(reward, spawned),
    label: rewardRevealLabel(reward, spawned),
    amount: Number.isFinite(spawned?.amount) ? spawned.amount : (Number.isFinite(reward.amount) ? reward.amount : null),
    x: Math.round(position.x),
    y: Math.round(position.y)
  });
}

function rewardText(state, reward, position, fallback = null) {
  const text = reward?.text || fallback;
  if (!state || !text) return;
  pushVisualEffect(state, {
    type: "damageText",
    x: Math.round(position.x),
    y: Math.round(position.y - 18),
    text: String(text).slice(0, 16),
    color: [REWARD_TYPES.NOTHING, REWARD_TYPES.CURSE, REWARD_TYPES.MODIFIER_INJECTION].includes(reward?.type) ? RED : GREEN,
    life: 0.72,
    maxLife: 0.72
  });
}

export function createRewardCommand(reward, position, context = {}) {
  if (!reward || !position) return null;
  if (reward.type === REWARD_TYPES.NOTHING) {
    return {
      type: REWARD_COMMAND_TYPES.EMIT_NOTHING,
      reward: { ...reward },
      position: { x: position.x, y: position.y },
      context: { ...context }
    };
  }
  if (reward.type === REWARD_TYPES.MODIFIER_INJECTION || reward.type === REWARD_TYPES.CURSE) {
    return {
      type: REWARD_COMMAND_TYPES.QUEUE_ROOM_MODIFIER,
      reward: { ...reward },
      position: { x: position.x, y: position.y },
      context: { ...context }
    };
  }
  if (reward.type === REWARD_TYPES.ECONOMY_PICKUP) {
    return {
      type: REWARD_COMMAND_TYPES.SPAWN_ECONOMY_PICKUP,
      reward: { ...reward },
      position: { x: position.x, y: position.y },
      context: { ...context }
    };
  }
  if (rewardTypeUsesPickup(reward.type)) {
    return {
      type: REWARD_COMMAND_TYPES.SPAWN_PICKUP,
      reward: { ...reward },
      position: { x: position.x, y: position.y },
      context: { ...context }
    };
  }
  return null;
}

export function executeRewardCommand(state, command) {
  if (!state || !command) return null;
  const reward = command.reward || {};
  const position = command.position || { x: 0, y: 0 };
  const context = command.context || {};

  if (command.type === REWARD_COMMAND_TYPES.EMIT_NOTHING) {
    rewardText(state, reward, position, "BUST");
    pushEvent(state, {
      type: "reward",
      action: "nothing",
      tableId: reward.tableId || context.tableId || null,
      sourceType: context.sourceType || "reward",
      sourceId: context.sourceId || null,
      playerId: context.playerId || null,
      x: Math.round(position.x),
      y: Math.round(position.y)
    });
    return null;
  }

  if (command.type === REWARD_COMMAND_TYPES.QUEUE_ROOM_MODIFIER) {
    const queued = queueRoomModifierInjection(state, reward.modifierId, {
      sourceType: context.sourceType || "reward",
      sourceId: context.sourceId || null,
      tableId: reward.tableId || context.tableId || null,
      playerId: context.playerId || null,
      text: reward.text || "DEBT SIGNAL",
      position
    });
    if (!queued) return null;
    rewardText(state, reward, position, reward.text || "DEBT");
    pushEvent(state, {
      type: "reward",
      action: "modifier_injection",
      rewardType: reward.type,
      modifierId: reward.modifierId,
      applyRunDepth: queued.applyRunDepth,
      tableId: reward.tableId || context.tableId || null,
      sourceType: context.sourceType || "reward",
      sourceId: context.sourceId || null,
      playerId: context.playerId || null,
      x: Math.round(position.x),
      y: Math.round(position.y)
    });
    return queued;
  }

  if (command.type === REWARD_COMMAND_TYPES.SPAWN_ECONOMY_PICKUP) {
    const pickupType = reward.pickupType || reward.economyType || null;
    const amount = rewardEconomyAmount(state, reward.amount);
    if (!Object.values(ECONOMY_PICKUP_TYPES).includes(pickupType) || amount <= 0) return null;
    const pickup = spawnEconomyPickup(state, {
      type: pickupType,
      amount,
      label: reward.text || null,
      radius: reward.radius,
      sourceContractId: economySourceContractId(context)
    }, position.x, position.y, {
      jitter: 0,
      sourceType: context.sourceType || "reward",
      sourceId: context.sourceId || null,
      sourceContractId: economySourceContractId(context),
      claimDelay: context.claimDelay,
      popDistance: Number.isFinite(context.popDistance) ? context.popDistance : 18
    });
    if (pickup) {
      rewardText(state, reward, position, reward.text || pickup.label || null);
      emitRewardRevealEvent(state, reward, pickup, position, context);
    }
    return pickup;
  }

  if (command.type === REWARD_COMMAND_TYPES.SPAWN_PICKUP) {
    const pickup = spawnRewardPickup(state, reward, position.x, position.y, {
      sourceType: context.sourceType || "reward",
      sourceId: context.sourceId || null,
      tableId: reward.tableId || context.tableId || null,
      claimScope: context.claimScope || "team",
      claimDelay: context.claimDelay,
      playerId: context.playerId || null,
      popDistance: Number.isFinite(context.popDistance) ? context.popDistance : (context.sourceType === "casino" ? 18 : 14),
      revealSource: context.sourceType || "reward"
    });
    if (pickup) {
      rewardText(state, reward, position, null);
      emitRewardRevealEvent(state, reward, pickup, position, context);
    }
    return pickup;
  }

  return null;
}
