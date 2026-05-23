export const REWARD_TYPES = Object.freeze({
  LOOT: "loot",
  HEAL: "heal",
  WEAPON_PICKUP: "weapon_pickup",
  ABILITY_PICKUP: "ability_pickup",
  ABILITY_SHARD: "ability_shard",
  UPGRADE_OFFER: "upgrade_offer",
  CURSE: "curse",
  MODIFIER_INJECTION: "modifier_injection",
  NOTHING: "nothing"
});

export const REWARD_PICKUP_TYPES = Object.freeze([
  REWARD_TYPES.LOOT,
  REWARD_TYPES.HEAL,
  REWARD_TYPES.WEAPON_PICKUP,
  REWARD_TYPES.ABILITY_PICKUP,
  REWARD_TYPES.ABILITY_SHARD,
  REWARD_TYPES.UPGRADE_OFFER
]);

export const ACTIVE_REWARD_TYPES = Object.freeze([
  REWARD_TYPES.LOOT,
  REWARD_TYPES.ABILITY_PICKUP,
  REWARD_TYPES.ABILITY_SHARD,
  REWARD_TYPES.CURSE,
  REWARD_TYPES.MODIFIER_INJECTION,
  REWARD_TYPES.NOTHING
]);

export const RESERVED_REWARD_TYPES = Object.freeze(
  REWARD_PICKUP_TYPES.filter((type) => !ACTIVE_REWARD_TYPES.includes(type))
);

export function rewardTypeIsKnown(type) {
  return Object.values(REWARD_TYPES).includes(type);
}

export function rewardTypeIsActive(type) {
  return ACTIVE_REWARD_TYPES.includes(type);
}

export function rewardTypeUsesPickup(type) {
  return REWARD_PICKUP_TYPES.includes(type);
}
