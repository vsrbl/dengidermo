import { CENTER, GREEN, PLAYER_RADIUS, RED, SPAWN_OFFSETS, WORLD } from "../core/constants.js";
import { dist2 } from "../core/math.js";
import { INTERACTABLE_CATEGORIES, getInteractable } from "../data/interactables.js";
import { canPlaceCircleInLocation, roomGeometrySnapshot } from "./roomGeometry.js";
import { addSpark, pushVisualEffect } from "./effectCommands.js";
import { nextId } from "./entityIds.js";
import { pushEvent } from "./events.js";
import { executeRewardTable } from "./rewardResolver.js";
import { activateChest, createChestRuntimeFields, isChestInteractableData, updateChestInteractable } from "./chests.js";
import { createCasinoRuntimeFields, isCasinoInteractableData, updateCasinoInteractable } from "./casino.js";

const PLACEMENT_POINTS = Object.freeze({
  field_cache: Object.freeze([
    Object.freeze({ x: CENTER.x - 360, y: CENTER.y - 180 }),
    Object.freeze({ x: CENTER.x + 360, y: CENTER.y + 180 }),
    Object.freeze({ x: CENTER.x - 420, y: CENTER.y + 190 }),
    Object.freeze({ x: CENTER.x + 420, y: CENTER.y - 190 })
  ]),
  reward_center: Object.freeze([
    Object.freeze({ x: CENTER.x, y: CENTER.y - 240 }),
    Object.freeze({ x: CENTER.x - 260, y: CENTER.y + 150 }),
    Object.freeze({ x: CENTER.x + 260, y: CENTER.y + 150 }),
    Object.freeze({ x: CENTER.x, y: CENTER.y + 260 })
  ]),
  casino_center: Object.freeze([
    Object.freeze({ x: CENTER.x, y: CENTER.y - 260 }),
    Object.freeze({ x: CENTER.x - 290, y: CENTER.y + 120 }),
    Object.freeze({ x: CENTER.x + 290, y: CENTER.y + 120 }),
    Object.freeze({ x: CENTER.x, y: CENTER.y + 280 })
  ])
});

function colorForAccent(accent = "green") {
  if (accent === "red") return RED;
  if (accent === "white") return "#f3f3f3";
  return GREEN;
}

function placementCandidates(slot = {}, index = 0) {
  if (Number.isFinite(slot.x) && Number.isFinite(slot.y)) return [{ x: slot.x, y: slot.y }];
  const points = PLACEMENT_POINTS[slot.placement] || PLACEMENT_POINTS.field_cache;
  const offset = Math.max(0, index % points.length);
  return [...points.slice(offset), ...points.slice(0, offset)];
}

function spawnPoints() {
  return SPAWN_OFFSETS.map((offset) => ({ x: CENTER.x + offset.x, y: CENTER.y + offset.y }));
}

function respectsSpawnClearance(point, data, slot = {}) {
  const minDistance = Math.max(0, Number(slot.minSpawnDistance ?? data.minSpawnDistance ?? 0) || 0);
  if (!minDistance) return true;
  const min2 = minDistance * minDistance;
  return spawnPoints().every((spawn) => dist2(point.x, point.y, spawn.x, spawn.y) >= min2);
}

function resolveInteractablePoint(loc, slot, data, index = 0) {
  const geometry = roomGeometrySnapshot(loc);
  const radius = data.radius || 18;
  for (const point of placementCandidates(slot, index)) {
    if (!respectsSpawnClearance(point, data, slot)) continue;
    if (canPlaceCircleInLocation(geometry, point.x, point.y, radius, 18)) return point;
  }
  const fallback = { x: CENTER.x, y: CENTER.y - 300 };
  if (respectsSpawnClearance(fallback, data, slot) && canPlaceCircleInLocation(geometry, fallback.x, fallback.y, radius, 18)) return fallback;
  return { x: Math.max(40, Math.min(WORLD.w - 40, fallback.x)), y: Math.max(40, Math.min(WORLD.h - 40, fallback.y)) };
}

function planSlots(loc) {
  return Array.isArray(loc?.interactablePlan) ? loc.interactablePlan : [];
}

export function spawnLocationInteractables(state, loc) {
  if (!state) return [];
  if (!state.interactables) state.interactables = {};
  const spawned = [];
  for (const [index, slot] of planSlots(loc).entries()) {
    const data = getInteractable(slot.interactableId);
    if (!data) continue;
    const point = resolveInteractablePoint(loc, slot, data, index);
    const id = nextId("ia");
    const interactable = {
      id,
      slotId: slot.id || id,
      kind: data.id,
      name: data.name,
      category: data.category,
      x: Math.round(point.x),
      y: Math.round(point.y),
      radius: data.radius || 18,
      interactRadius: data.interactRadius || (data.radius || 18) + 20,
      maxUses: data.maxUses || 1,
      uses: 0,
      opened: false,
      active: true,
      autoOpen: slot.autoOpen ?? data.autoOpen ?? false,
      rewardTable: slot.rewardTable || data.rewardTable || null,
      tags: [...(data.tags || []), ...(slot.tags || [])],
      label: data.visual?.label || data.name,
      accent: data.visual?.accent || "green",
      ...createChestRuntimeFields(data),
      ...createCasinoRuntimeFields(data)
    };
    state.interactables[id] = interactable;
    spawned.push(interactable);
  }
  return spawned;
}

export function canActivateInteractable(state, interactable, player, options = {}) {
  if (!state || !interactable || !player || player.hp <= 0) return { ok: false, reason: "invalid_actor" };
  const data = getInteractable(interactable.kind);
  if (!data) return { ok: false, reason: "unknown_interactable" };
  if (!interactable.active || interactable.opened) return { ok: false, reason: "inactive" };
  if ((interactable.uses || 0) >= (interactable.maxUses || data.maxUses || 1)) return { ok: false, reason: "used" };
  if (options.validateDistance !== false) {
    const radius = interactable.interactRadius || data.interactRadius || (interactable.radius || data.radius || 18) + 20;
    const r = radius + (player.radius || PLAYER_RADIUS);
    if (dist2(player.x, player.y, interactable.x, interactable.y) > r * r) return { ok: false, reason: "too_far" };
  }
  return { ok: true, data };
}

export function activateInteractable(state, interactable, player, options = {}) {
  const check = canActivateInteractable(state, interactable, player, options);
  if (!check.ok) return false;
  if (isChestInteractableData(check.data) || interactable.category === INTERACTABLE_CATEGORIES.CHEST) {
    return activateChest(state, interactable, player, options);
  }

  if (isCasinoInteractableData(check.data) || interactable.category === INTERACTABLE_CATEGORIES.CASINO) {
    pushEvent(state, {
      type: "casino",
      action: "open_requested",
      playerId: player.id,
      interactableId: interactable.id,
      machineId: interactable.casinoMachineId || check.data.casinoMachineId || null,
      x: interactable.x,
      y: interactable.y
    });
    return true;
  }

  interactable.uses += 1;
  interactable.opened = true;
  interactable.active = false;
  interactable.openedBy = player.id;
  interactable.despawnTimer = Number.isFinite(options.despawnTimer) ? options.despawnTimer : 1.8;

  const spawned = interactable.rewardTable
    ? executeRewardTable(state, interactable.rewardTable, interactable, {
      sourceType: "interactable",
      sourceId: interactable.id,
      playerId: player.id
    })
    : [];

  const color = colorForAccent(interactable.accent);
  addSpark(state, interactable.x, interactable.y, 8, 135, color);
  pushVisualEffect(state, {
    type: "interactableOpen",
    x: interactable.x,
    y: interactable.y,
    r: (interactable.radius || 18) + 14,
    life: 0.32,
    maxLife: 0.32,
    color
  });
  pushEvent(state, {
    type: "interactable",
    action: "opened",
    playerId: player.id,
    interactableId: interactable.id,
    kind: interactable.kind,
    rewardTable: interactable.rewardTable || null,
    rewards: spawned.length,
    x: interactable.x,
    y: interactable.y
  });
  return true;
}

function nearestInteractable(state, player, targetId = null) {
  let best = null;
  let bestD2 = Infinity;
  for (const interactable of Object.values(state?.interactables || {})) {
    if (targetId && interactable.id !== targetId) continue;
    const check = canActivateInteractable(state, interactable, player);
    if (!check.ok) continue;
    const d = dist2(player.x, player.y, interactable.x, interactable.y);
    if (d < bestD2) {
      best = interactable;
      bestD2 = d;
    }
  }
  return best;
}

export function requestInteractableActivation(state, playerId, request = {}) {
  const player = state?.players?.[playerId];
  if (!player) return false;
  const targetId = typeof request.targetId === "string" ? request.targetId : null;
  const interactable = nearestInteractable(state, player, targetId);
  if (!interactable) return false;
  return activateInteractable(state, interactable, player);
}

export function updateInteractables(state, dt = 0.016) {
  if (!state?.interactables) return;
  for (const interactable of Object.values(state.interactables)) {
    if (interactable.opened) {
      interactable.despawnTimer = Math.max(0, (interactable.despawnTimer || 0) - dt);
      updateChestInteractable(interactable, dt);
      updateCasinoInteractable(interactable, dt);
      if (interactable.despawnTimer <= 0) delete state.interactables[interactable.id];
      continue;
    }
    updateCasinoInteractable(interactable, dt);
    if (!interactable.active || !interactable.autoOpen) continue;
    for (const player of Object.values(state.players || {})) {
      const check = canActivateInteractable(state, interactable, player);
      if (check.ok) {
        activateInteractable(state, interactable, player);
        break;
      }
    }
  }
}

export function interactableSnapshot(interactable) {
  return {
    id: interactable.id,
    kind: interactable.kind,
    category: interactable.category,
    x: Math.round(interactable.x),
    y: Math.round(interactable.y),
    radius: interactable.radius,
    interactRadius: interactable.interactRadius,
    opened: !!interactable.opened,
    active: !!interactable.active,
    autoOpen: !!interactable.autoOpen,
    label: interactable.label,
    accent: interactable.accent || "green",
    chestId: interactable.chestId || null,
    chestTier: interactable.chestTier || null,
    chestState: interactable.chestState || null,
    chestVisual: interactable.chestVisual || null,
    chestGlyph: interactable.chestGlyph || null,
    casinoMachineId: interactable.casinoMachineId || null,
    casinoState: interactable.casinoState || null,
    casinoLabel: interactable.casinoLabel || null,
    casinoGlyph: interactable.casinoGlyph || null,
    casinoAllowedStakes: [...(interactable.casinoAllowedStakes || [])],
    casinoLastResult: interactable.casinoLastResult || null,
    tags: [...(interactable.tags || [])]
  };
}
