import { ROOM_SEQUENCE } from "../data/rooms.js";

export function normalizeRunDepth(runDepth = 0) {
  const value = Number.isFinite(runDepth) ? Math.floor(runDepth) : 0;
  return Math.max(0, value);
}

export function normalizeSequenceIndex(index = 0, sequenceLength = ROOM_SEQUENCE.length) {
  const length = Math.max(1, sequenceLength || 1);
  const value = Number.isFinite(index) ? Math.floor(index) : 0;
  return ((value % length) + length) % length;
}

export function runProgressionFor(runDepth = 0, sequenceLength = ROOM_SEQUENCE.length) {
  const length = Math.max(1, sequenceLength || 1);
  const depth = normalizeRunDepth(runDepth);
  const roomInLoop = normalizeSequenceIndex(depth, length);
  return Object.freeze({
    runDepth: depth,
    loopIndex: Math.floor(depth / length),
    roomInLoop,
    roomSequenceIndex: roomInLoop,
    sequenceLength: length
  });
}

export function nextRunDepth(runDepth = 0, step = 1) {
  return normalizeRunDepth(runDepth) + Math.max(1, Math.floor(Number.isFinite(step) ? step : 1));
}
