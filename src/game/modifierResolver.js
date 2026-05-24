import { MODIFIER_DOMAINS, MODIFIER_ORDER_PHASES, MODIFIER_STACK_SCHEMA_VERSION, isKnownModifierDomain } from "../data/modifierDomains.js";
import { RULE_MODIFIERS_BY_DOMAIN, getRuleModifierInDomain } from "../data/ruleModifiers.js";
import {
  DEFAULT_MODIFIER_BUDGET,
  DEFAULT_MODIFIER_BUDGET_LIMITS,
  addModifierBudget,
  isModifierBudgetWithinLimits,
  normalizeModifierBudget,
  normalizeModifierBudgetLimits
} from "./modifierBudget.js";


const ORDER_RANK = Object.freeze(Object.fromEntries(Object.values(MODIFIER_ORDER_PHASES).map((phase, index) => [phase, index])));

function orderRank(modifier) {
  return Number.isFinite(ORDER_RANK[modifier?.order]) ? ORDER_RANK[modifier.order] : 999;
}

function sortModifierIdsForRuntime(modifierIds = [], domain = MODIFIER_DOMAINS.ROOM) {
  return modifierIds
    .map((id, index) => ({ id, index, modifier: getRuleModifierInDomain(id, domain) }))
    .sort((a, b) => {
      const rankDelta = orderRank(a.modifier) - orderRank(b.modifier);
      return rankDelta || a.index - b.index;
    })
    .map((entry) => entry.id);
}

function uniqueList(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function safeDomain(domain) {
  return isKnownModifierDomain(domain) ? domain : MODIFIER_DOMAINS.ROOM;
}

function hashString(input = "") {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function weightedCandidateOrder(candidateIds = [], seed = "") {
  return [...candidateIds].sort((a, b) => {
    const ah = hashString(`${seed}:${a}`);
    const bh = hashString(`${seed}:${b}`);
    return ah - bh;
  });
}

function chancePass(chance = 1, seed = "") {
  if (!Number.isFinite(chance)) return true;
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return (hashString(seed) % 1000000) / 1000000 < chance;
}

function modifierStackCount(modifierIds = [], modifierId) {
  return modifierIds.filter((id) => id === modifierId).length;
}

function acceptedTagSet(accepted = [], context = {}) {
  const tags = new Set(Array.isArray(context.tags) ? context.tags : []);
  for (const modifier of accepted) for (const tag of modifier.tags || []) tags.add(tag);
  return tags;
}

function featureSet(context = {}) {
  return new Set([...(Array.isArray(context.features) ? context.features : []), ...(Array.isArray(context.tags) ? context.tags : [])]);
}

function hasConflict(modifier, accepted = []) {
  const conflicts = new Set(modifier.conflictsWith || []);
  if (accepted.some((active) => conflicts.has(active.id))) return true;
  return accepted.some((active) => (active.conflictsWith || []).includes(modifier.id));
}

function hasRequirements(modifier, accepted = [], context = {}) {
  const required = modifier.requires || [];
  if (!required.length) return true;
  const tags = acceptedTagSet(accepted, context);
  const features = featureSet(context);
  return required.every((requirement) => tags.has(requirement) || features.has(requirement));
}

function canAddModifier(modifier, accepted = [], acceptedIds = [], totalBudget = DEFAULT_MODIFIER_BUDGET, budgetLimits = DEFAULT_MODIFIER_BUDGET_LIMITS, context = {}) {
  if (!modifier) return { ok: false, reason: "unknown" };
  if (modifierStackCount(acceptedIds, modifier.id) >= (modifier.maxStacks || 1)) return { ok: false, reason: "max-stacks" };
  if (hasConflict(modifier, accepted)) return { ok: false, reason: "conflict" };
  if (!hasRequirements(modifier, accepted, context)) return { ok: false, reason: "requires" };
  const nextBudget = addModifierBudget(totalBudget, modifier.budget);
  if (!isModifierBudgetWithinLimits(nextBudget, budgetLimits)) return { ok: false, reason: "budget" };
  return { ok: true, budget: nextBudget };
}

export function resolveModifierStack(options = {}) {
  const domain = safeDomain(options.domain);
  const byDomain = RULE_MODIFIERS_BY_DOMAIN[domain] || {};
  const baseIds = uniqueList(options.baseIds || options.modifierIds || []);
  const candidateIds = uniqueList(options.candidateIds || []).filter((id) => byDomain[id]);
  const seed = String(options.seed || "modifier-stack");
  const context = options.context || {};
  const preserveBase = options.preserveBase !== false;
  const maxModifiers = Math.max(0, Math.floor(options.maxModifiers ?? Math.max(1, baseIds.length)));
  const stackChance = Number.isFinite(options.stackChance) ? options.stackChance : 1;
  const budgetLimits = normalizeModifierBudgetLimits(options.budgetLimits || DEFAULT_MODIFIER_BUDGET_LIMITS);
  const accepted = [];
  const modifierIds = [];
  const rejected = [];
  let budget = normalizeModifierBudget(options.initialBudget || DEFAULT_MODIFIER_BUDGET);

  for (const id of baseIds) {
    const modifier = getRuleModifierInDomain(id, domain);
    if (!modifier) {
      rejected.push({ id, reason: "unknown-base" });
      continue;
    }

    if (preserveBase) {
      accepted.push(modifier);
      modifierIds.push(modifier.id);
      budget = addModifierBudget(budget, modifier.budget);
      continue;
    }

    const result = canAddModifier(modifier, accepted, modifierIds, budget, budgetLimits, context);
    if (result.ok) {
      accepted.push(modifier);
      modifierIds.push(modifier.id);
      budget = result.budget;
    } else {
      rejected.push({ id, reason: result.reason });
    }
  }

  const remainingSlots = Math.max(0, maxModifiers - modifierIds.length);
  const shouldResolveCandidates = remainingSlots > 0 && candidateIds.length > 0 && chancePass(stackChance, `${seed}:chance`);
  if (shouldResolveCandidates) {
    for (const id of weightedCandidateOrder(candidateIds, seed)) {
      if (modifierIds.length >= maxModifiers) break;
      const modifier = getRuleModifierInDomain(id, domain);
      const result = canAddModifier(modifier, accepted, modifierIds, budget, budgetLimits, context);
      if (result.ok) {
        accepted.push(modifier);
        modifierIds.push(modifier.id);
        budget = result.budget;
      } else {
        rejected.push({ id, reason: result.reason });
      }
    }
  }

  const runtimeModifierIds = sortModifierIdsForRuntime(modifierIds, domain);

  return Object.freeze({
    schemaVersion: MODIFIER_STACK_SCHEMA_VERSION,
    domain,
    modifierIds: Object.freeze([...runtimeModifierIds]),
    baseIds: Object.freeze([...baseIds]),
    candidateIds: Object.freeze([...candidateIds]),
    rejected: Object.freeze(rejected.map((item) => Object.freeze({ ...item }))),
    budget: Object.freeze(normalizeModifierBudget(budget)),
    budgetLimits: Object.freeze(budgetLimits),
    maxModifiers,
    stackChance,
    resolvedAt: Number.isFinite(options.resolvedAt) ? options.resolvedAt : 0
  });
}
