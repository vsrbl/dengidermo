export const ABILITY_IDS = Object.freeze({
  TELEPORT_DASH: "teleport_dash"
});

export const ABILITY_SLOTS = Object.freeze({
  MOBILITY: "mobility",
  ACTIVE: "active"
});

export const ABILITIES = Object.freeze({
  [ABILITY_IDS.TELEPORT_DASH]: Object.freeze({
    id: ABILITY_IDS.TELEPORT_DASH,
    name: "TELEPORT DASH",
    slot: ABILITY_SLOTS.MOBILITY,
    legacyEffectType: "teleportDash",
    rewardable: true,
    shardId: "teleport_dash_shard",
    unlimitedStacks: true,
    shardMode: "stack",
    tags: Object.freeze(["movement", "dash", "mobility", "active"]),
    pickup: Object.freeze({ label: "DASH", radius: 12, accent: "green" }),
    config: Object.freeze({ distance: 210, cooldown: 3.6, invuln: 0.14 })
  })
});

export function getAbility(abilityId) {
  return ABILITIES[abilityId] || null;
}

export function abilityIsKnown(abilityId) {
  return !!getAbility(abilityId);
}

export function abilityIsRewardable(abilityId) {
  return !!getAbility(abilityId)?.rewardable;
}
