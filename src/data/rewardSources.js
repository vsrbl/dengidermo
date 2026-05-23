import { ECONOMY_PICKUP_TYPES } from "./economy.js";

export const REWARD_SOURCE_IDS = Object.freeze({
  ENEMY_REGULAR: "enemy_regular",
  ENEMY_ELITE: "enemy_elite",
  ENEMY_BOSS: "enemy_boss",
  CHEST: "chest",
  CASINO: "casino",
  LEVEL_UP: "level_up",
  ROOM_REWARD: "room_reward"
});

export const REWARD_SOURCE_CONTRACTS = Object.freeze({
  [REWARD_SOURCE_IDS.ENEMY_REGULAR]: Object.freeze({
    id: REWARD_SOURCE_IDS.ENEMY_REGULAR,
    economyTypes: Object.freeze([ECONOMY_PICKUP_TYPES.MONEY, ECONOMY_PICKUP_TYPES.XP]),
    rewardTypes: Object.freeze([])
  }),
  [REWARD_SOURCE_IDS.ENEMY_ELITE]: Object.freeze({
    id: REWARD_SOURCE_IDS.ENEMY_ELITE,
    economyTypes: Object.freeze([ECONOMY_PICKUP_TYPES.MONEY, ECONOMY_PICKUP_TYPES.XP, ECONOMY_PICKUP_TYPES.HEAL]),
    rewardTypes: Object.freeze([])
  }),
  [REWARD_SOURCE_IDS.ENEMY_BOSS]: Object.freeze({
    id: REWARD_SOURCE_IDS.ENEMY_BOSS,
    economyTypes: Object.freeze([ECONOMY_PICKUP_TYPES.MONEY, ECONOMY_PICKUP_TYPES.XP, ECONOMY_PICKUP_TYPES.HEAL]),
    rewardTypes: Object.freeze([])
  }),
  [REWARD_SOURCE_IDS.CHEST]: Object.freeze({
    id: REWARD_SOURCE_IDS.CHEST,
    economyTypes: Object.freeze([ECONOMY_PICKUP_TYPES.MONEY, ECONOMY_PICKUP_TYPES.XP, ECONOMY_PICKUP_TYPES.HEAL]),
    rewardTypes: Object.freeze(["weapon", "ability", "upgrade", "special"])
  }),
  [REWARD_SOURCE_IDS.CASINO]: Object.freeze({
    id: REWARD_SOURCE_IDS.CASINO,
    economyTypes: Object.freeze([ECONOMY_PICKUP_TYPES.MONEY, ECONOMY_PICKUP_TYPES.XP, ECONOMY_PICKUP_TYPES.HEAL]),
    rewardTypes: Object.freeze(["weapon", "ability", "modifier", "special"])
  }),
  [REWARD_SOURCE_IDS.LEVEL_UP]: Object.freeze({
    id: REWARD_SOURCE_IDS.LEVEL_UP,
    economyTypes: Object.freeze([]),
    rewardTypes: Object.freeze(["upgrade_offer"])
  }),
  [REWARD_SOURCE_IDS.ROOM_REWARD]: Object.freeze({
    id: REWARD_SOURCE_IDS.ROOM_REWARD,
    economyTypes: Object.freeze([ECONOMY_PICKUP_TYPES.MONEY, ECONOMY_PICKUP_TYPES.XP, ECONOMY_PICKUP_TYPES.HEAL]),
    rewardTypes: Object.freeze(["weapon", "ability", "upgrade", "special"])
  })
});

export function rewardSourceContract(sourceId) {
  return REWARD_SOURCE_CONTRACTS[sourceId] || null;
}

export function rewardSourceAllowsEconomyType(sourceId, type) {
  const contract = rewardSourceContract(sourceId);
  return !!contract && contract.economyTypes.includes(type);
}

export function enemyRewardSourceId(enemy) {
  if (enemy?.kind === "boss") return REWARD_SOURCE_IDS.ENEMY_BOSS;
  if (enemy?.elite) return REWARD_SOURCE_IDS.ENEMY_ELITE;
  return REWARD_SOURCE_IDS.ENEMY_REGULAR;
}
