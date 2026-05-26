import { getRoomById, getRoom } from "../data/rooms.js";
import { getLocationTheme } from "../data/locationThemes.js";
import { roomPoolForLoop, routeNodeForRoomInLoop } from "../data/roomPools.js";

function hashString(input = "") {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed = "") {
  return (hashString(seed) % 1000000) / 1000000;
}

function optionAllowsLoop(option, loopIndex) {
  if (!option) return false;
  if (Number.isFinite(option.minLoop) && loopIndex < option.minLoop) return false;
  if (Number.isFinite(option.maxLoop) && loopIndex > option.maxLoop) return false;
  return !!getRoomById(option.roomId);
}

function weightedPick(options, seed) {
  const total = options.reduce((sum, option) => sum + Math.max(0, Number(option.weight) || 0), 0);
  if (total <= 0) return options[0] || null;
  let pick = seededUnit(seed) * total;
  for (const option of options) {
    pick -= Math.max(0, Number(option.weight) || 0);
    if (pick <= 0) return option;
  }
  return options.at(-1) || null;
}

function themeForOption(option, room) {
  const themeId = option?.environmentThemeId || room?.environmentThemeId || "black_grid";
  return getLocationTheme(themeId);
}

export function resolveLoopRouteNode(progression, options = {}) {
  const loopIndex = Math.max(0, Math.floor(Number.isFinite(progression?.loopIndex) ? progression.loopIndex : 0));
  const roomInLoop = Math.max(0, Math.floor(Number.isFinite(progression?.roomInLoop) ? progression.roomInLoop : 0));
  const roomSequenceIndex = Math.max(0, Math.floor(Number.isFinite(progression?.roomSequenceIndex) ? progression.roomSequenceIndex : roomInLoop));
  const pool = roomPoolForLoop(loopIndex);
  const node = routeNodeForRoomInLoop(pool, roomInLoop);
  const allowed = (node?.options || []).filter((entry) => optionAllowsLoop(entry, loopIndex));
  const seed = `${options.seed || "route"}:${progression?.runDepth || 0}:${pool?.id || "pool"}:${node?.id || roomInLoop}`;
  const picked = weightedPick(allowed, seed);
  const fallbackRoom = getRoom(roomSequenceIndex);
  const room = getRoomById(picked?.roomId) || fallbackRoom;
  const baseRoom = fallbackRoom;
  const theme = themeForOption(picked, room);

  return Object.freeze({
    roomPoolId: pool?.id || "loop_zero_cadence",
    routeNodeId: node?.id || `node_${roomInLoop}`,
    routeNodeType: node?.type || room.category || "combat",
    baseRoom,
    resolvedRoom: room,
    option: picked || null,
    activityId: picked?.activityId || room.activityId || null,
    environmentThemeId: theme.id,
    environmentPropSetId: theme.environmentPropSetId,
    rare: !!picked?.rare || !!room.rare,
    ruleId: picked?.ruleId || null,
    routeSeed: seed
  });
}
