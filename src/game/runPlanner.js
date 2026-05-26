import { buildLocation } from "../data/locations.js";
import { MODIFIER_FEATURES } from "../data/modifierDomains.js";
import { getRoom, getRoomById, ROOM_SEQUENCE } from "../data/rooms.js";
import { resolveLoopRouteNode } from "./loopRouteResolver.js";
import { getInteractable } from "../data/interactables.js";
import { interactableDistributionForRoom, maxDistributionSlots } from "../data/interactableDistribution.js";
import { loopEscalationProfileForLoop } from "./loopScaling.js";
import { modifierStackPlanSnapshot, resolveRoomModifierStack } from "./modifierStack.js";
import { runProgressionFor } from "./runProgression.js";

export const ROOM_CATEGORIES = Object.freeze({
  NORMAL: "normal",
  BOSS: "boss",
  RARE: "rare",
  REWARD: "reward",
  CURSED: "cursed",
  EVENT: "event"
});

export const RARE_ROOM_RULES = Object.freeze([
  Object.freeze({
    id: "first_loop_reward_cache",
    kind: "replace",
    resolvedRoomId: "reward-cache-00",
    rare: true,
    when: Object.freeze({ loopIndex: 1, roomInLoop: 0 })
  }),
  Object.freeze({
    id: "first_loop_static_field",
    kind: "replace",
    resolvedRoomId: "static-field-00",
    rare: true,
    when: Object.freeze({ loopIndex: 1, roomInLoop: 2 })
  }),
  Object.freeze({
    id: "second_loop_casino_floor",
    kind: "replace",
    resolvedRoomId: "casino-floor-00",
    rare: true,
    when: Object.freeze({ loopIndex: 2, roomInLoop: 0 })
  })
]);

function matchesRuleValue(actual, expected) {
  if (Array.isArray(expected)) return expected.includes(actual);
  return actual === expected;
}

function matchesRareRule(rule, progression, baseRoom) {
  const when = rule?.when || {};
  const checks = {
    runDepth: progression.runDepth,
    loopIndex: progression.loopIndex,
    roomInLoop: progression.roomInLoop,
    roomSequenceIndex: progression.roomSequenceIndex,
    baseRoomId: baseRoom?.id,
    category: baseRoom?.category || null
  };

  return Object.entries(when).every(([field, expected]) => matchesRuleValue(checks[field], expected));
}

function resolveRareRule(progression, baseRoom) {
  return RARE_ROOM_RULES.find((rule) => matchesRareRule(rule, progression, baseRoom)) || null;
}

function categoryForRoom(room) {
  if (room.category) return room.category;
  if (room.boss?.enabled || room.objective === "boss") return ROOM_CATEGORIES.BOSS;
  return ROOM_CATEGORIES.NORMAL;
}

function uniqueList(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function hashString(input = "") {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededChance(seed, chance = 0) {
  if (!Number.isFinite(chance)) return false;
  if (chance <= 0) return false;
  if (chance >= 1) return true;
  return (hashString(seed) % 1000000) / 1000000 < chance;
}

function normalizeInteractableSlot(slot, fallbackId = "slot") {
  if (!slot || typeof slot !== "object" || !getInteractable(slot.interactableId)) return null;
  return Object.freeze({
    id: slot.id || fallbackId,
    interactableId: slot.interactableId,
    placement: slot.placement || "field_cache",
    rewardTable: slot.rewardTable || null,
    x: Number.isFinite(slot.x) ? slot.x : null,
    y: Number.isFinite(slot.y) ? slot.y : null,
    placementSeed: typeof slot.placementSeed === "string" ? slot.placementSeed : `${fallbackId}:${slot.interactableId}`,
    tags: Object.freeze([...(slot.tags || [])])
  });
}

function ruleAllowsLoop(rule, progression) {
  if (Number.isFinite(rule.minLoop) && progression.loopIndex < rule.minLoop) return false;
  if (Number.isFinite(rule.maxLoop) && progression.loopIndex > rule.maxLoop) return false;
  return true;
}

function resolveDistributionSlots(resolvedRoom, progression, seed, currentCount = 0) {
  const profile = interactableDistributionForRoom(resolvedRoom);
  if (!profile) return [];
  const maxSlots = maxDistributionSlots(profile, { ...progression, seed, roomId: resolvedRoom.id });
  const slots = [];
  if (currentCount >= maxSlots) return slots;
  for (const entry of profile.entries || []) {
    if (currentCount + slots.length >= maxSlots) break;
    if (!entry || !getInteractable(entry.interactableId)) continue;
    if (!ruleAllowsLoop(entry, progression)) continue;
    const ruleSeed = `${seed}:${progression.runDepth}:${resolvedRoom.id}:dist:${entry.id || entry.interactableId}`;
    if (!seededChance(ruleSeed, entry.chance ?? 1)) continue;
    const normalized = normalizeInteractableSlot({
      id: `${entry.id || entry.interactableId}_${slots.length}`,
      interactableId: entry.interactableId,
      placement: entry.placement || "distributed",
      rewardTable: entry.rewardTable || null,
      placementSeed: ruleSeed,
      tags: ["distribution", ...(entry.tags || [])]
    }, `${resolvedRoom.id}:dist:${slots.length}`);
    if (normalized) slots.push(normalized);
  }
  return slots;
}

function resolveInteractablePlan(resolvedRoom, progression, options = {}) {
  const seed = String(options.seed || "room");
  const slots = [];
  for (const [index, slot] of (resolvedRoom.interactables || []).entries()) {
    const normalized = normalizeInteractableSlot({ ...slot, placementSeed: `${seed}:${progression.runDepth}:${resolvedRoom.id}:base:${index}:${slot.interactableId}` }, `${resolvedRoom.id}:base:${index}`);
    if (normalized) slots.push(normalized);
  }

  for (const rule of resolvedRoom.interactableRules || []) {
    if (!rule || !getInteractable(rule.interactableId)) continue;
    if (!ruleAllowsLoop(rule, progression)) continue;
    const ruleSeed = `${seed}:${progression.runDepth}:${resolvedRoom.id}:${rule.id || rule.interactableId}`;
    if (!seededChance(ruleSeed, rule.chance ?? 1)) continue;
    const normalized = normalizeInteractableSlot({
      id: rule.id || `${rule.interactableId}_${slots.length}`,
      interactableId: rule.interactableId,
      placement: rule.placement || "field_cache",
      rewardTable: rule.rewardTable || null,
      placementSeed: ruleSeed,
      tags: rule.tags || []
    }, `${resolvedRoom.id}:rule:${slots.length}`);
    if (normalized) slots.push(normalized);
  }

  slots.push(...resolveDistributionSlots(resolvedRoom, progression, seed, slots.length));

  return Object.freeze(slots);
}

function featureListForRoom(room, progression) {
  const features = new Set();
  const enemyPool = Array.isArray(room?.enemyPool) ? room.enemyPool : [];
  const lootPool = Array.isArray(room?.lootPool) ? room.lootPool : [];
  const tags = new Set([...(room?.tags || []), room?.category].filter(Boolean));

  if (enemyPool.includes("shooter") || tags.has("boss")) features.add(MODIFIER_FEATURES.HOSTILE_PROJECTILES);
  if ((room?.layout || "open_arena") !== "open_arena") features.add(MODIFIER_FEATURES.WALLS);
  if (lootPool.length || !tags.has("no-combat")) features.add(MODIFIER_FEATURES.LOOT);
  if (enemyPool.includes("tank") || tags.has("boss")) features.add(MODIFIER_FEATURES.ARMOR);
  if ((progression?.loopIndex || 0) >= 2) features.add(MODIFIER_FEATURES.ELITES);
  if ((resolvedRoomHasInteractables(room) || interactableDistributionForRoom(room) || (progression?.loopIndex || 0) >= 1) && !tags.has("boss")) features.add(MODIFIER_FEATURES.INTERACTABLES);
  return [...features];
}

function resolvedRoomHasInteractables(room) {
  return (Array.isArray(room?.interactables) && room.interactables.length > 0)
    || (Array.isArray(room?.interactableRules) && room.interactableRules.length > 0);
}

function resolveRoomStackForPlan(resolvedRoom, progression, options = {}) {
  const injectedModifierIds = uniqueList(options.injectedModifierIds || []);
  const baseModifierIds = uniqueList([...(resolvedRoom.modifiers || []), ...injectedModifierIds]);
  const profile = loopEscalationProfileForLoop(progression.loopIndex);
  return resolveRoomModifierStack({
    baseModifierIds,
    loopIndex: progression.loopIndex,
    profile,
    seed: `${options.seed || "room"}:${progression.runDepth}:${resolvedRoom.id}`,
    resolvedAt: Number.isFinite(options.createdAt) ? options.createdAt : 0,
    context: {
      tags: [...(resolvedRoom.tags || []), resolvedRoom.category || null, injectedModifierIds.length ? "injected_modifier" : null].filter(Boolean),
      features: featureListForRoom(resolvedRoom, progression),
      roomId: resolvedRoom.id,
      category: resolvedRoom.category || null
    }
  });
}

function normalizeRuleId(ruleId) {
  return typeof ruleId === "string" && ruleId ? ruleId : null;
}

function roomForPlan(plan) {
  return getRoomById(plan?.resolvedRoomId)
    || getRoomById(plan?.roomId)
    || getRoomById(plan?.baseRoomId)
    || getRoom(plan?.roomSequenceIndex || 0);
}

export function resolveRoomPlan(runDepth = 0, options = {}) {
  const progression = runProgressionFor(runDepth, ROOM_SEQUENCE.length);
  const route = resolveLoopRouteNode(progression, options);
  const baseRoom = route.baseRoom || getRoom(progression.roomSequenceIndex);
  const resolvedRoom = route.resolvedRoom || baseRoom;
  const category = categoryForRoom(resolvedRoom);
  const modifierStack = resolveRoomStackForPlan(resolvedRoom, progression, options);
  const modifierIds = [...modifierStack.modifierIds];
  const interactablePlan = resolveInteractablePlan(resolvedRoom, progression, options);

  return Object.freeze({
    runDepth: progression.runDepth,
    loopIndex: progression.loopIndex,
    roomInLoop: progression.roomInLoop,
    roomSequenceIndex: progression.roomSequenceIndex,
    sequenceLength: progression.sequenceLength,
    baseRoomId: baseRoom.id,
    resolvedRoomId: resolvedRoom.id,
    roomId: resolvedRoom.id,
    category,
    layoutId: resolvedRoom.layout || "open_arena",
    modifierIds,
    modifierStack: modifierStackPlanSnapshot(modifierStack),
    interactablePlan,
    rare: !!route.rare,
    ruleId: normalizeRuleId(options.ruleId || route.ruleId),
    roomPoolId: route.roomPoolId,
    routeNodeId: route.routeNodeId,
    routeNodeType: route.routeNodeType,
    activityId: route.activityId,
    environmentThemeId: route.environmentThemeId,
    environmentPropSetId: route.environmentPropSetId,
    seed: options.seed || null,
    routeSeed: route.routeSeed || null,
    createdAt: Number.isFinite(options.createdAt) ? options.createdAt : 0,
    rulesVersion: 3
  });
}

export function normalizeRoomPlan(plan, fallbackRunDepth = 0, options = {}) {
  if (!plan || typeof plan !== "object") return resolveRoomPlan(fallbackRunDepth, options);

  const progression = runProgressionFor(
    Number.isFinite(plan.runDepth) ? plan.runDepth : fallbackRunDepth,
    Number.isFinite(plan.sequenceLength) ? plan.sequenceLength : ROOM_SEQUENCE.length
  );
  const route = resolveLoopRouteNode(progression, options);
  const baseRoom = getRoomById(plan.baseRoomId) || route.baseRoom || getRoom(progression.roomSequenceIndex);
  const resolvedRoom = roomForPlan({ ...plan, baseRoomId: baseRoom.id, roomSequenceIndex: progression.roomSequenceIndex }) || route.resolvedRoom || baseRoom;
  const category = plan.category || categoryForRoom(resolvedRoom);
  const fallbackStack = resolveRoomStackForPlan(resolvedRoom, progression, options);
  const modifierIds = Array.isArray(plan.modifierIds)
    ? uniqueList(plan.modifierIds)
    : [...fallbackStack.modifierIds];
  const modifierStack = plan.modifierStack && typeof plan.modifierStack === "object"
    ? modifierStackPlanSnapshot({ ...plan.modifierStack, modifierIds })
    : modifierStackPlanSnapshot(fallbackStack);
  const interactablePlan = Array.isArray(plan.interactablePlan)
    ? Object.freeze(plan.interactablePlan.map((slot, index) => normalizeInteractableSlot(slot, `normalized:${index}`)).filter(Boolean))
    : resolveInteractablePlan(resolvedRoom, progression, options);

  return Object.freeze({
    runDepth: progression.runDepth,
    loopIndex: Number.isFinite(plan.loopIndex) ? plan.loopIndex : progression.loopIndex,
    roomInLoop: Number.isFinite(plan.roomInLoop) ? plan.roomInLoop : progression.roomInLoop,
    roomSequenceIndex: Number.isFinite(plan.roomSequenceIndex) ? plan.roomSequenceIndex : progression.roomSequenceIndex,
    sequenceLength: progression.sequenceLength,
    baseRoomId: baseRoom.id,
    resolvedRoomId: resolvedRoom.id,
    roomId: resolvedRoom.id,
    category,
    layoutId: plan.layoutId || resolvedRoom.layout || "open_arena",
    modifierIds,
    modifierStack,
    interactablePlan,
    rare: !!plan.rare,
    ruleId: normalizeRuleId(plan.ruleId),
    roomPoolId: plan.roomPoolId || route.roomPoolId,
    routeNodeId: plan.routeNodeId || route.routeNodeId,
    routeNodeType: plan.routeNodeType || route.routeNodeType,
    activityId: plan.activityId || route.activityId || resolvedRoom.activityId || null,
    environmentThemeId: plan.environmentThemeId || route.environmentThemeId || resolvedRoom.environmentThemeId || null,
    environmentPropSetId: plan.environmentPropSetId || route.environmentPropSetId || null,
    seed: plan.seed || options.seed || null,
    routeSeed: plan.routeSeed || route.routeSeed || null,
    createdAt: Number.isFinite(plan.createdAt) ? plan.createdAt : (Number.isFinite(options.createdAt) ? options.createdAt : 0),
    rulesVersion: Number.isFinite(plan.rulesVersion) ? plan.rulesVersion : 3
  });
}

export function getLocationFromRoomPlan(plan, options = {}) {
  const normalized = normalizeRoomPlan(plan, plan?.runDepth || 0, options);
  const room = roomForPlan(normalized);
  return buildLocation(room, normalized.roomSequenceIndex, normalized.runDepth, { plan: normalized });
}

export function getPlannedLocation(runDepth = 0, options = {}) {
  const plan = resolveRoomPlan(runDepth, options);
  return getLocationFromRoomPlan(plan);
}

export function getPlannedLocationForState(state, fallbackRunDepth = 0) {
  if (state?.roomPlan) {
    return getLocationFromRoomPlan(state.roomPlan, { seed: state?.roomId || null });
  }

  const runDepth = Number.isFinite(state?.runDepth)
    ? state.runDepth
    : Number.isFinite(state?.locationIndex)
      ? state.locationIndex
      : fallbackRunDepth;
  return getPlannedLocation(runDepth, { seed: state?.roomId || null });
}
