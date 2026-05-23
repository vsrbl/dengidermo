import { MODIFIER_DOMAINS } from "../data/modifierDomains.js";
import { getRuleModifierInDomain } from "../data/ruleModifiers.js";
import { nextId } from "./entityIds.js";
import { pushEvent } from "./events.js";

function normalizeRunDepth(value, fallback = 0) {
  const n = Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(0, n);
}

function currentRunDepthForState(state) {
  return normalizeRunDepth(state?.roomPlan?.runDepth ?? state?.runDepth ?? state?.locationIndex ?? 0, 0);
}

export function ensurePendingRoomModifiers(state) {
  if (!state.pendingRoomModifiers) state.pendingRoomModifiers = [];
  return state.pendingRoomModifiers;
}

export function queueRoomModifierInjection(state, modifierId, options = {}) {
  if (!state || !modifierId) return null;
  const modifier = getRuleModifierInDomain(modifierId, MODIFIER_DOMAINS.ROOM);
  if (!modifier) return null;

  const pending = ensurePendingRoomModifiers(state);
  const applyRunDepth = normalizeRunDepth(options.applyRunDepth, currentRunDepthForState(state) + 1);
  const entry = {
    id: nextId("debt"),
    modifierId,
    applyRunDepth,
    sourceType: options.sourceType || "reward",
    sourceId: options.sourceId || null,
    tableId: options.tableId || null,
    playerId: options.playerId || null,
    text: options.text || modifier.name || modifierId,
    createdAt: state.time || 0
  };
  pending.push(entry);


  pushEvent(state, {
    type: "room_modifier_debt",
    action: "queued",
    modifierId,
    applyRunDepth,
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    tableId: entry.tableId,
    playerId: entry.playerId,
    x: Math.round(options.position?.x || 0),
    y: Math.round(options.position?.y || 0)
  });
  return entry;
}

export function pendingRoomModifierIdsForDepth(state, runDepth = 0) {
  const depth = normalizeRunDepth(runDepth, 0);
  return [...new Set(ensurePendingRoomModifiers(state)
    .filter((entry) => normalizeRunDepth(entry.applyRunDepth, -1) === depth)
    .map((entry) => entry.modifierId)
    .filter((modifierId) => getRuleModifierInDomain(modifierId, MODIFIER_DOMAINS.ROOM)))];
}

export function consumePendingRoomModifiersForDepth(state, runDepth = 0) {
  const depth = normalizeRunDepth(runDepth, 0);
  const pending = ensurePendingRoomModifiers(state);
  const consumed = pending.filter((entry) => normalizeRunDepth(entry.applyRunDepth, -1) === depth);
  state.pendingRoomModifiers = pending.filter((entry) => normalizeRunDepth(entry.applyRunDepth, -1) !== depth);
  if (consumed.length) {
    pushEvent(state, {
      type: "room_modifier_debt",
      action: "applied",
      modifierIds: [...new Set(consumed.map((entry) => entry.modifierId))],
      runDepth: depth
    });
  }
  return consumed;
}

export function pendingRoomModifierSnapshot(entry) {
  return {
    id: entry.id,
    modifierId: entry.modifierId,
    applyRunDepth: entry.applyRunDepth,
    sourceType: entry.sourceType || null,
    sourceId: entry.sourceId || null,
    tableId: entry.tableId || null,
    playerId: entry.playerId || null,
    text: entry.text || entry.modifierId
  };
}
