import { REWARD_TYPES } from "../data/rewardTypes.js";
import { grantAbility, grantAbilityShard } from "./abilityInventory.js";

export function applyAbilityReward(player, reward = {}) {
  if (!player || !reward) return { ok: false, reason: "invalid_actor" };
  if (reward.rewardType === REWARD_TYPES.ABILITY_PICKUP || reward.type === REWARD_TYPES.ABILITY_PICKUP) {
    return grantAbility(player, reward.abilityId || reward.kind, { autoEquip: true });
  }
  if (reward.rewardType === REWARD_TYPES.ABILITY_SHARD || reward.type === REWARD_TYPES.ABILITY_SHARD) {
    return grantAbilityShard(player, reward.abilityId || reward.kind, reward.shardAmount || reward.amount || 1);
  }
  return { ok: false, reason: "not_ability_reward" };
}
