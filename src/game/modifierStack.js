import { MODIFIER_DOMAINS, MODIFIER_STACK_SCHEMA_VERSION } from "../data/modifierDomains.js";
import { resolveRuleModifiers } from "../data/ruleModifiers.js";
import { roomModifierBudgetLimitsForMaxStack } from "./modifierBudget.js";
import { resolveModifierStack } from "./modifierResolver.js";

function clampStackMax(value, fallback = 1) {
  const n = Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(1, Math.min(5, n));
}

export function maxRoomModifiersForLoop(loopIndex = 0) {
  const loop = Number.isFinite(loopIndex) ? Math.max(0, Math.floor(loopIndex)) : 0;
  if (loop <= 0) return 1;
  if (loop === 1) return 2;
  if (loop === 2) return 3;
  return 5;
}

export function resolveRoomModifierStack(options = {}) {
  const baseModifierIds = [...new Set((options.baseModifierIds || options.baseIds || []).filter(Boolean))];
  const loopMax = maxRoomModifiersForLoop(options.loopIndex || 0);
  const profileConfig = options.profile?.modifiers || {};
  const maxExtraModifiers = Number.isFinite(profileConfig.maxExtraModifiers) ? Math.max(0, Math.floor(profileConfig.maxExtraModifiers)) : 0;
  const profileCandidateIds = Array.isArray(profileConfig.modifierIds) ? profileConfig.modifierIds : [];
  const candidateIds = [...new Set([...(options.candidateIds || []), ...profileCandidateIds].filter(Boolean))];
  const maxModifiers = clampStackMax(
    options.maxModifiers ?? Math.min(loopMax, Math.max(baseModifierIds.length, baseModifierIds.length + maxExtraModifiers)),
    Math.max(1, baseModifierIds.length)
  );
  const budgetLimits = options.budgetLimits || roomModifierBudgetLimitsForMaxStack(maxModifiers);

  return resolveModifierStack({
    domain: MODIFIER_DOMAINS.ROOM,
    baseIds: baseModifierIds,
    candidateIds,
    maxModifiers,
    stackChance: Number.isFinite(options.stackChance) ? options.stackChance : (Number.isFinite(profileConfig.stackChance) ? profileConfig.stackChance : 1),
    budgetLimits,
    seed: options.seed || "room-modifier-stack",
    context: options.context || {},
    preserveBase: options.preserveBase !== false,
    resolvedAt: options.resolvedAt
  });
}

export function modifierStackPlanSnapshot(stack) {
  return Object.freeze({
    schemaVersion: stack?.schemaVersion || MODIFIER_STACK_SCHEMA_VERSION,
    domain: stack?.domain || MODIFIER_DOMAINS.ROOM,
    modifierIds: Object.freeze([...(stack?.modifierIds || [])]),
    baseIds: Object.freeze([...(stack?.baseIds || [])]),
    candidateIds: Object.freeze([...(stack?.candidateIds || [])]),
    rejected: Object.freeze((stack?.rejected || []).map((item) => Object.freeze({ ...item }))),
    budget: Object.freeze({ ...(stack?.budget || {}) }),
    budgetLimits: Object.freeze({ ...(stack?.budgetLimits || {}) }),
    maxModifiers: stack?.maxModifiers || 1,
    stackChance: Number.isFinite(stack?.stackChance) ? stack.stackChance : 1
  });
}

export function modifierStackRuntimeSnapshot(stack) {
  const modifierIds = [...(stack?.modifierIds || [])];
  return {
    ...modifierStackPlanSnapshot(stack),
    modifiers: resolveRuleModifiers(modifierIds, stack?.domain || MODIFIER_DOMAINS.ROOM).map((modifier) => ({
      id: modifier.id,
      domain: modifier.domain,
      polarity: modifier.polarity,
      rarity: modifier.rarity,
      category: modifier.category,
      tags: [...(modifier.tags || [])]
    }))
  };
}
