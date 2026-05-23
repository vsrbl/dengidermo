import { MODIFIER_DOMAINS } from "./modifierDomains.js";
import {
  RULE_MODIFIER_IDS,
  RULE_MODIFIERS_BY_DOMAIN,
  getRuleModifierInDomain,
  resolveRuleModifiers,
  ruleModifierSnapshot
} from "./ruleModifiers.js";

export const ROOM_MODIFIER_IDS = Object.freeze({
  GRID_STATIC: RULE_MODIFIER_IDS.GRID_STATIC,
  VOID_DRIFT: RULE_MODIFIER_IDS.VOID_DRIFT,
  CORE_PRESSURE: RULE_MODIFIER_IDS.CORE_PRESSURE,
  BOSS_LOCK: RULE_MODIFIER_IDS.BOSS_LOCK,
  REWARD_CACHE: RULE_MODIFIER_IDS.REWARD_CACHE,
  STATIC_FIELD: RULE_MODIFIER_IDS.STATIC_FIELD,
  LIVE_CHAT_HATES_YOU: RULE_MODIFIER_IDS.LIVE_CHAT_HATES_YOU,
  ALGORITHM_BOOST: RULE_MODIFIER_IDS.ALGORITHM_BOOST,
  STATIC_GOD: RULE_MODIFIER_IDS.STATIC_GOD
});

export const ROOM_MODIFIERS = RULE_MODIFIERS_BY_DOMAIN[MODIFIER_DOMAINS.ROOM];

export function getRoomModifier(modifierId) {
  return getRuleModifierInDomain(modifierId, MODIFIER_DOMAINS.ROOM);
}

export function resolveRoomModifiers(modifierIds = []) {
  return resolveRuleModifiers(modifierIds, MODIFIER_DOMAINS.ROOM);
}

export function modifierSnapshot(modifier) {
  return ruleModifierSnapshot(modifier);
}
