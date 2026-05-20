import { buildLocation } from "../data/locations.js";
import { getRoom, getRoomById, ROOM_SEQUENCE } from "../data/rooms.js";
import { runProgressionFor } from "./runProgression.js";

export const ROOM_CATEGORIES = Object.freeze({
  NORMAL: "normal",
  BOSS: "boss",
  RARE: "rare",
  REWARD: "reward",
  CURSED: "cursed",
  EVENT: "event"
});

// v38.9 foundation: rare-room planning is persistent-state ready, but the
// active rule list is intentionally empty so current runs stay deterministic
// and identical to the current baseline until content is added deliberately.
export const RARE_ROOM_RULES = Object.freeze([]);

function categoryForRoom(room) {
  if (room.category) return room.category;
  if (room.boss?.enabled || room.objective === "boss") return ROOM_CATEGORIES.BOSS;
  return ROOM_CATEGORIES.NORMAL;
}

function uniqueList(values = []) {
  return [...new Set(values.filter(Boolean))];
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
  const baseRoom = getRoom(progression.roomSequenceIndex);
  const resolvedRoom = baseRoom;
  const category = categoryForRoom(resolvedRoom);
  const modifierIds = uniqueList([...(resolvedRoom.modifiers || [])]);

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
    rare: false,
    ruleId: normalizeRuleId(options.ruleId),
    seed: options.seed || null,
    createdAt: Number.isFinite(options.createdAt) ? options.createdAt : 0,
    rulesVersion: 1
  });
}

export function normalizeRoomPlan(plan, fallbackRunDepth = 0, options = {}) {
  if (!plan || typeof plan !== "object") return resolveRoomPlan(fallbackRunDepth, options);

  const progression = runProgressionFor(
    Number.isFinite(plan.runDepth) ? plan.runDepth : fallbackRunDepth,
    Number.isFinite(plan.sequenceLength) ? plan.sequenceLength : ROOM_SEQUENCE.length
  );
  const baseRoom = getRoomById(plan.baseRoomId) || getRoom(progression.roomSequenceIndex);
  const resolvedRoom = roomForPlan({ ...plan, baseRoomId: baseRoom.id, roomSequenceIndex: progression.roomSequenceIndex });
  const category = plan.category || categoryForRoom(resolvedRoom);
  const modifierIds = Array.isArray(plan.modifierIds)
    ? uniqueList(plan.modifierIds)
    : uniqueList([...(resolvedRoom.modifiers || [])]);

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
    rare: !!plan.rare,
    ruleId: normalizeRuleId(plan.ruleId),
    seed: plan.seed || options.seed || null,
    createdAt: Number.isFinite(plan.createdAt) ? plan.createdAt : (Number.isFinite(options.createdAt) ? options.createdAt : 0),
    rulesVersion: Number.isFinite(plan.rulesVersion) ? plan.rulesVersion : 1
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
