import { getBiome } from "./biomes.js";
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

export function buildLocation(room, sequenceIndex = 0, runDepth = sequenceIndex) {
  const biome = getBiome(room.biome);
  const spawn = mergeSpawn(biome, room);
  const boss = mergeBoss(biome, room);
  const director = mergeDirector(biome, room);
  const portalDelay = room.portal?.delay ?? room.portalDelay ?? biome.portalDelay ?? 6;
  const portalHold = room.portal?.hold ?? room.portalHold ?? biome.portalHold ?? 1.15;
  const boost = (biome.spawnBoost ?? 1) * (spawn.boost ?? room.spawnBoost ?? 1);
  const encounterId = room.encounter || room.encounterId || biome.encounter || biome.encounterId || "grid_intro_pressure";
  const spawnZones = mergeSpawnZones(biome, room);

  return {
    id: room.id,
    name: room.name,
    index: sequenceIndex,
    sequenceIndex,
    runDepth,
    biomeId: biome.id,
    biomeName: biome.name,
    accent: room.accent || biome.accent || "green",
    gridStep: room.gridStep || biome.gridStep || 80,
    enemyPool: room.enemyPool || biome.enemyPool || ["grunt"],
    lootPool: room.lootPool || biome.lootPool || ["heal"],
    encounterId,
    portalDelay,
    portalHold,
    portalTargetIndex: room.portal?.targetIndex ?? runDepth + 1,
    portalTargetDepth: room.portal?.targetDepth ?? room.portal?.targetIndex ?? runDepth + 1,
    spawnBoost: boost,
    spawnZones,
    spawn,
    boss,
    director
  };
}

export function getLocation(runDepth = 0) {
  const safeDepth = Number.isFinite(runDepth) ? runDepth : 0;
  const safeIndex = ((safeDepth % ROOM_SEQUENCE.length) + ROOM_SEQUENCE.length) % ROOM_SEQUENCE.length;
  return buildLocation(getRoom(safeIndex), safeIndex, safeDepth);
}

export { ROOM_SEQUENCE as LOCATIONS };
