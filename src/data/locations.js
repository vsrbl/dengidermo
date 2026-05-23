import { getBiome } from "./biomes.js";
import { layoutSnapshot } from "./layouts.js";
import { resolveRoomModifiers } from "./roomModifiers.js";
import { getRoom, ROOM_SEQUENCE } from "./rooms.js";

function mergeSpawn(biome, room) {
  return {
    ...(biome.spawn || {}),
    ...(room.spawn || {})
  };
}

function mergeBoss(biome, room) {
  return {
    ...(biome.boss || {}),
    ...(room.boss || {})
  };
}

function mergeDirector(biome, room) {
  return {
    ...(biome.director || {}),
    ...(room.director || {})
  };
}

function mergeSpawnZones(biome, room) {
  return room.spawnZones || biome.spawnZones || ["edge_far", "edge_flank", "edge_random"];
}

function uniqueList(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function resolveObjective(biome, room, boss) {
  const raw = room.objective || biome.objective || (boss?.enabled ? "boss" : "clear");
  return ["clear", "survive", "boss"].includes(raw) ? raw : "clear";
}

function fallbackProgression(sequenceIndex = 0, runDepth = sequenceIndex) {
  const length = Math.max(1, ROOM_SEQUENCE.length);
  const depth = Number.isFinite(runDepth) ? Math.max(0, Math.floor(runDepth)) : 0;
  const roomInLoop = ((sequenceIndex % length) + length) % length;
  return {
    runDepth: depth,
    loopIndex: Math.floor(depth / length),
    roomInLoop,
    roomSequenceIndex: roomInLoop,
    sequenceLength: length
  };
}

export function buildLocation(room, sequenceIndex = 0, runDepth = sequenceIndex, options = {}) {
  const plan = options.plan || null;
  const progression = plan || fallbackProgression(sequenceIndex, runDepth);
  const biome = getBiome(room.biome);
  const spawn = mergeSpawn(biome, room);
  const boss = mergeBoss(biome, room);
  const director = mergeDirector(biome, room);
  const portalDelay = room.portal?.delay ?? room.portalDelay ?? biome.portalDelay ?? 6;
  const portalHold = room.portal?.hold ?? room.portalHold ?? biome.portalHold ?? 1.15;
  const boost = (biome.spawnBoost ?? 1) * (spawn.boost ?? room.spawnBoost ?? 1);
  const encounterId = room.encounter || room.encounterId || biome.encounter || biome.encounterId || "grid_intro_pressure";
  const spawnZones = mergeSpawnZones(biome, room);
  const objective = resolveObjective(biome, room, boss);
  const layoutId = plan?.layoutId || room.layout || biome.layout || "open_arena";
  const layout = layoutSnapshot(layoutId);
  const modifierIds = Array.isArray(plan?.modifierIds)
    ? uniqueList(plan.modifierIds)
    : uniqueList([...(biome.modifiers || []), ...(room.modifiers || [])]);
  const modifiers = resolveRoomModifiers(modifierIds);
  const modifierStack = plan?.modifierStack || null;
  const interactablePlan = Array.isArray(plan?.interactablePlan) ? [...plan.interactablePlan] : [...(room.interactables || [])];
  const category = plan?.category || room.category || (boss?.enabled ? "boss" : "normal");
  const tags = uniqueList([...(biome.tags || []), ...(room.tags || []), category]);

  return {
    id: room.id,
    baseRoomId: plan?.baseRoomId || room.id,
    name: room.name,
    category,
    tags,
    rare: !!plan?.rare,
    index: progression.roomSequenceIndex ?? sequenceIndex,
    sequenceIndex: progression.roomSequenceIndex ?? sequenceIndex,
    roomSequenceIndex: progression.roomSequenceIndex ?? sequenceIndex,
    roomInLoop: progression.roomInLoop ?? sequenceIndex,
    sequenceLength: progression.sequenceLength ?? ROOM_SEQUENCE.length,
    loopIndex: progression.loopIndex ?? 0,
    runDepth: progression.runDepth ?? runDepth,
    biomeId: biome.id,
    biomeName: biome.name,
    accent: room.accent || biome.accent || "green",
    gridStep: room.gridStep || biome.gridStep || 80,
    layoutId,
    layout,
    modifierIds,
    modifierStack,
    modifiers,
    interactablePlan,
    enemyPool: room.enemyPool || biome.enemyPool || ["grunt"],
    lootPool: room.lootPool || biome.lootPool || ["heal"],
    encounterId,
    objective,
    portalDelay,
    portalHold,
    portalTargetIndex: room.portal?.targetIndex ?? (progression.runDepth ?? runDepth) + 1,
    portalTargetDepth: room.portal?.targetDepth ?? room.portal?.targetIndex ?? (progression.runDepth ?? runDepth) + 1,
    spawnBoost: boost,
    spawnZones,
    spawn,
    boss,
    director,
    plan: plan ? {
      runDepth: plan.runDepth,
      loopIndex: plan.loopIndex,
      roomInLoop: plan.roomInLoop,
      roomSequenceIndex: plan.roomSequenceIndex,
      sequenceLength: plan.sequenceLength,
      roomId: plan.roomId || plan.resolvedRoomId,
      baseRoomId: plan.baseRoomId,
      resolvedRoomId: plan.resolvedRoomId || plan.roomId,
      category: plan.category,
      layoutId: plan.layoutId || layoutId,
      modifierIds: [...(plan.modifierIds || modifierIds)],
      modifierStack: plan.modifierStack || null,
      interactablePlan: [...(plan.interactablePlan || interactablePlan)],
      rare: !!plan.rare,
      ruleId: plan.ruleId,
      seed: plan.seed || null,
      createdAt: plan.createdAt ?? 0,
      rulesVersion: plan.rulesVersion
    } : null
  };
}

export function getLocation(runDepth = 0) {
  const safeDepth = Number.isFinite(runDepth) ? Math.max(0, Math.floor(runDepth)) : 0;
  const safeIndex = ((safeDepth % ROOM_SEQUENCE.length) + ROOM_SEQUENCE.length) % ROOM_SEQUENCE.length;
  return buildLocation(getRoom(safeIndex), safeIndex, safeDepth);
}

export { ROOM_SEQUENCE as LOCATIONS };
