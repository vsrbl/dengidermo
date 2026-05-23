import { MODIFIER_BUDGET_FIELDS } from "../data/modifierDomains.js";

export const DEFAULT_MODIFIER_BUDGET = Object.freeze(Object.fromEntries(MODIFIER_BUDGET_FIELDS.map((field) => [field, 0])));

export const DEFAULT_MODIFIER_BUDGET_LIMITS = Object.freeze({
  readability: 99,
  danger: 99,
  performance: 99,
  chaos: 99
});

export const ROOM_MODIFIER_BUDGET_LIMITS_BY_MAX_STACK = Object.freeze({
  1: Object.freeze({ readability: 3, danger: 4, performance: 2, chaos: 4 }),
  2: Object.freeze({ readability: 5, danger: 6, performance: 3, chaos: 6 }),
  3: Object.freeze({ readability: 7, danger: 8, performance: 4, chaos: 9 }),
  4: Object.freeze({ readability: 9, danger: 10, performance: 5, chaos: 12 }),
  5: Object.freeze({ readability: 10, danger: 12, performance: 6, chaos: 15 })
});

function finiteNonNegative(value, fallback = 0) {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function normalizeModifierBudget(budget = {}) {
  const normalized = {};
  for (const field of MODIFIER_BUDGET_FIELDS) normalized[field] = finiteNonNegative(budget?.[field], 0);
  return normalized;
}

export function normalizeModifierBudgetLimits(limits = DEFAULT_MODIFIER_BUDGET_LIMITS) {
  const normalized = {};
  for (const field of MODIFIER_BUDGET_FIELDS) normalized[field] = finiteNonNegative(limits?.[field], DEFAULT_MODIFIER_BUDGET_LIMITS[field]);
  return normalized;
}

export function addModifierBudget(total = DEFAULT_MODIFIER_BUDGET, budget = DEFAULT_MODIFIER_BUDGET) {
  const normalizedTotal = normalizeModifierBudget(total);
  const normalizedBudget = normalizeModifierBudget(budget);
  const next = {};
  for (const field of MODIFIER_BUDGET_FIELDS) next[field] = normalizedTotal[field] + normalizedBudget[field];
  return next;
}

export function isModifierBudgetWithinLimits(total = DEFAULT_MODIFIER_BUDGET, limits = DEFAULT_MODIFIER_BUDGET_LIMITS) {
  const normalizedTotal = normalizeModifierBudget(total);
  const normalizedLimits = normalizeModifierBudgetLimits(limits);
  return MODIFIER_BUDGET_FIELDS.every((field) => normalizedTotal[field] <= normalizedLimits[field]);
}

export function roomModifierBudgetLimitsForMaxStack(maxModifiers = 1, overrides = null) {
  const safeMax = Math.max(1, Math.min(5, Number.isFinite(maxModifiers) ? Math.floor(maxModifiers) : 1));
  return normalizeModifierBudgetLimits({
    ...(ROOM_MODIFIER_BUDGET_LIMITS_BY_MAX_STACK[safeMax] || ROOM_MODIFIER_BUDGET_LIMITS_BY_MAX_STACK[1]),
    ...(overrides || {})
  });
}
