import { GREEN, RED } from "../core/constants.js";
import { CHEST_STATES, getChest } from "../data/chests.js";
import { addSpark, pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { executeRewardTable } from "./rewardResolver.js";

const OPENING_TIME = 0.48;
const DEFAULT_DESPAWN_TIMER = 4.2;

function chestColor(chest) {
  if (chest?.visual?.accent === "red") return RED;
  if (chest?.visual?.accent === "white") return "#f3f3f3";
  return GREEN;
}

function chestRevealSummary(spawned = []) {
  const labels = spawned
    .map((item) => String(item?.label || item?.kind || item?.type || "").toUpperCase().slice(0, 8))
    .filter(Boolean);
  if (!labels.length) return "EMPTY";
  const unique = [...new Set(labels)];
  return unique.slice(0, 3).join("+").slice(0, 16);
}

export function isChestInteractableData(data) {
  return !!data?.chestId && !!getChest(data.chestId);
}

export function createChestRuntimeFields(data) {
  const chest = getChest(data?.chestId);
  if (!chest) return {};
  return {
    chestId: chest.id,
    chestTier: chest.tier,
    chestState: CHEST_STATES.CLOSED,
    chestOpenTimer: 0,
    chestRevealLabel: null,
    chestRewardCount: 0,
    chestVisual: chest.visual?.renderer || "chest",
    chestGlyph: chest.visual?.glyph || "B"
  };
}

export function updateChestInteractable(interactable, dt = 0.016) {
  if (!interactable?.chestId) return;
  if (interactable.chestState === CHEST_STATES.OPENING) {
    interactable.chestOpenTimer = Math.max(0, (interactable.chestOpenTimer || 0) - dt);
    if (interactable.chestOpenTimer <= 0) interactable.chestState = CHEST_STATES.OPENED;
  }
  if ((interactable.despawnTimer || 0) <= 0 && interactable.chestState !== CHEST_STATES.CLAIMED) {
    interactable.chestState = CHEST_STATES.CLAIMED;
  }
}

export function activateChest(state, interactable, player, options = {}) {
  const chest = getChest(interactable?.chestId);
  if (!state || !interactable || !player || !chest) return false;

  interactable.uses += 1;
  interactable.opened = true;
  interactable.active = false;
  interactable.openedBy = player.id;
  interactable.chestState = CHEST_STATES.OPENING;
  interactable.chestOpenTimer = OPENING_TIME;
  interactable.chestRevealLabel = "DECRYPT";
  interactable.chestRewardCount = 0;
  interactable.despawnTimer = Number.isFinite(options.despawnTimer) ? options.despawnTimer : DEFAULT_DESPAWN_TIMER;

  const spawned = interactable.rewardTable
    ? executeRewardTable(state, interactable.rewardTable, interactable, {
      sourceType: "chest",
      sourceId: interactable.id,
      playerId: player.id,
      chestId: chest.id,
      chestTier: chest.tier,
      claimDelay: 0.42,
      popDistance: chest.tier === "rare" || chest.tier === "cursed" ? 22 : 16
    })
    : [];
  interactable.chestRewardCount = spawned.length;
  interactable.chestRevealLabel = chestRevealSummary(spawned);

  const color = chestColor(chest);
  addSpark(state, interactable.x, interactable.y, 14, 165, color);
  pushVisualEffect(state, {
    type: "interactableOpen",
    x: interactable.x,
    y: interactable.y,
    r: (interactable.radius || chest.radius || 24) + 18,
    life: 0.38,
    maxLife: 0.38,
    color
  });
  pushVisualEffect(state, {
    type: "damageText",
    x: Math.round(interactable.x),
    y: Math.round(interactable.y - (interactable.radius || 24) - 14),
    text: String(interactable.chestRevealLabel || chest.visual?.label || chest.name || "CHEST").slice(0, 16),
    color,
    life: 0.86,
    maxLife: 0.86
  });
  pushEvent(state, {
    type: "interactable",
    action: "opened",
    playerId: player.id,
    interactableId: interactable.id,
    kind: interactable.kind,
    rewardTable: interactable.rewardTable || null,
    rewards: spawned.length,
    revealLabel: interactable.chestRevealLabel || null,
    x: interactable.x,
    y: interactable.y
  });
  pushEvent(state, {
    type: "chest",
    action: "opened",
    playerId: player.id,
    interactableId: interactable.id,
    chestId: chest.id,
    chestTier: chest.tier,
    rewardTable: interactable.rewardTable || null,
    rewards: spawned.length,
    revealLabel: interactable.chestRevealLabel || null,
    x: interactable.x,
    y: interactable.y
  });
  return true;
}
