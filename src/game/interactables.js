import { GREEN, PLAYER_RADIUS, RED } from "../core/constants.js";
import { dist2 } from "../core/math.js";
import { INTERACTABLE_CATEGORIES, getInteractable } from "../data/interactables.js";
import { INTERACTABLE_DENIAL_REASONS, affordanceReasonLabel } from "../data/interactableAffordances.js";
import { addSpark, pushVisualEffect } from "./effectCommands.js";
import { nextId } from "./entityIds.js";
import { pushEvent } from "./events.js";
import { executeRewardTable } from "./rewardResolver.js";
import { activateChest, createChestRuntimeFields, isChestInteractableData, updateChestInteractable } from "./chests.js";
import { createCasinoRuntimeFields, isCasinoInteractableData, updateCasinoInteractable } from "./casino.js";
import { interactablePlacementBudgetAllows, resolveInteractablePoint } from "./interactableResolver.js";

function colorForAccent(accent = "green") {
  if (accent === "red") return RED;
  if (accent === "purple") return "#b45cff";
  if (accent === "cyan") return "#66f6ff";
  if (accent === "white") return "#f3f3f3";
  return GREEN;
}


function denyInteractableActivation(state, interactable, player, reason = INTERACTABLE_DENIAL_REASONS.INACTIVE, data = null) {
  if (!state || !interactable || !player) return;
  const color = colorForAccent(interactable.accent || data?.visual?.accent || 'green');
  pushVisualEffect(state, {
    type: 'damageText',
    x: Math.round(interactable.x),
    y: Math.round(interactable.y - (interactable.radius || 18) - 12),
    text: affordanceReasonLabel(reason),
    color,
    life: 0.62,
    maxLife: 0.62
  });
  pushEvent(state, {
    type: 'interactable',
    action: 'activation_denied',
    playerId: player.id,
    interactableId: interactable.id,
    kind: interactable.kind,
    reason,
    x: interactable.x,
    y: interactable.y
  });
}

function planSlots(loc) {
  return Array.isArray(loc?.interactablePlan) ? loc.interactablePlan : [];
}

export function spawnLocationInteractables(state, loc) {
  if (!state) return [];
  if (!state.interactables) state.interactables = {};
  const spawned = [];
  const placed = [];
  for (const [index, slot] of planSlots(loc).entries()) {
    const data = getInteractable(slot.interactableId);
    if (!data) continue;
    if (!interactablePlacementBudgetAllows(loc, placed)) break;
    const point = resolveInteractablePoint(loc, slot, data, placed, index);
    if (!point) continue;
    const id = nextId("ia");
    const chestRuntime = createChestRuntimeFields(data, { state, roomPlan: state.roomPlan });
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
      visualColor: data.visual?.color || null,
      ...chestRuntime,
      ...createCasinoRuntimeFields(data)
    };
    state.interactables[id] = interactable;
    spawned.push(interactable);
    placed.push({ x: interactable.x, y: interactable.y, radius: interactable.radius, kind: interactable.kind });
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
  if (!check.ok) {
    denyInteractableActivation(state, interactable, player, check.reason, check.data || null);
    return false;
  }
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
  if (targetId) {
    const requested = state?.interactables?.[targetId] || null;
    if (!requested) return false;
    return activateInteractable(state, requested, player);
  }
  const interactable = nearestInteractable(state, player, null);
  if (!interactable) return false;
  return activateInteractable(state, interactable, player);
}

export function updateInteractables(state, dt = 0.016) {
  if (!state?.interactables) return;
  for (const interactable of Object.values(state.interactables)) {
    if (interactable.opened) {
      updateChestInteractable(interactable, dt);
      updateCasinoInteractable(interactable, dt);
      if (interactable.chestId) continue;
      interactable.despawnTimer = Math.max(0, (interactable.despawnTimer || 0) - dt);
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
    chestOpenTimer: Number.isFinite(interactable.chestOpenTimer) ? Number(interactable.chestOpenTimer.toFixed(3)) : 0,
    chestOpenDuration: Number.isFinite(interactable.chestOpenDuration) ? Number(interactable.chestOpenDuration.toFixed(3)) : 0,
    chestRevealLabel: interactable.chestRevealLabel || null,
    chestRevealProfile: interactable.chestRevealProfile || null,
    chestRewardCount: Number.isFinite(interactable.chestRewardCount) ? interactable.chestRewardCount : 0,
    chestVisual: interactable.chestVisual || null,
    chestGlyph: interactable.chestGlyph || null,
    chestOpenCost: Number.isFinite(interactable.chestOpenCost) ? interactable.chestOpenCost : 0,
    visualColor: interactable.visualColor || null,
    casinoMachineId: interactable.casinoMachineId || null,
    casinoState: interactable.casinoState || null,
    casinoLabel: interactable.casinoLabel || null,
    casinoGlyph: interactable.casinoGlyph || null,
    casinoAllowedStakes: [...(interactable.casinoAllowedStakes || [])],
    casinoLastResult: interactable.casinoLastResult || null,
    tags: [...(interactable.tags || [])]
  };
}
