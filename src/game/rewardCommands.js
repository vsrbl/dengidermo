import { GREEN, RED } from "../core/constants.js";
import { REWARD_TYPES, rewardTypeUsesPickup } from "../data/rewardTypes.js";
import { pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { queueRoomModifierInjection } from "./pendingRoomModifiers.js";
import { spawnRewardPickup } from "./rewardPickups.js";

export const REWARD_COMMAND_TYPES = Object.freeze({
  SPAWN_PICKUP: "spawnRewardPickup",
  EMIT_NOTHING: "emitRewardNothing",
  QUEUE_ROOM_MODIFIER: "queueRoomModifier"
});

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

  if (command.type === REWARD_COMMAND_TYPES.SPAWN_PICKUP) {
    const pickup = spawnRewardPickup(state, reward, position.x, position.y, {
      sourceType: context.sourceType || "reward",
      sourceId: context.sourceId || null,
      tableId: reward.tableId || context.tableId || null,
      claimScope: context.claimScope || "team",
      claimDelay: context.claimDelay
    });
    if (pickup) rewardText(state, reward, position, null);
    return pickup;
  }

  return null;
}
