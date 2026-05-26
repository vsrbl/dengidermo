import { GREEN, RED } from "../core/constants.js";
import { CHEST_STATES, getChest } from "../data/chests.js";
import { chestOpenCostFor } from "../data/chestEconomy.js";
import { INTERACTABLE_DENIAL_REASONS, affordanceReasonLabel } from "../data/interactableAffordances.js";
import { chestRevealProfileForTier } from "../data/revealAnimations.js";
import { addShake, addSpark, pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { executeRewardTable } from "./rewardResolver.js";
import { spendMoney } from "./playerEconomy.js";


function chestColor(chest) {
  if (chest?.visual?.color) return chest.visual.color;
  if (chest?.visual?.accent === "red") return RED;
  if (chest?.visual?.accent === "purple") return "#b45cff";
  if (chest?.visual?.accent === "cyan") return "#66f6ff";
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

function chestRevealEffects(state, interactable, chest, profile, revealLabel, player = null) {
  const color = chestColor(chest);
  const radius = (interactable.radius || chest.radius || 24) + 18;
  addShake(state, profile.shakePower || 1.4, profile.shakeLife || 0.08, `chest:${chest.id}`, player?.id ? { audience: "target", targetId: player.id } : {});
  addSpark(state, interactable.x, interactable.y, profile.sparkCount || 16, profile.sparkPower || 155, color);
  pushVisualEffect(state, {
    type: "rewardRevealPulse",
    mode: profile.id || chest.tier || "basic",
    x: interactable.x,
    y: interactable.y,
    r: radius,
    color,
    life: profile.pulseLife || 0.34,
    maxLife: profile.pulseLife || 0.34
  });
  if ((profile.secondPulseDelay || 0) > 0) {
    pushVisualEffect(state, {
      type: "rewardRevealPulse",
      mode: profile.id || chest.tier || "basic",
      x: interactable.x,
      y: interactable.y,
      r: radius + 12,
      color,
      delay: profile.secondPulseDelay,
      life: (profile.pulseLife || 0.34) + profile.secondPulseDelay,
      maxLife: (profile.pulseLife || 0.34) + profile.secondPulseDelay
    });
  }
}

export function isChestInteractableData(data) {
  return !!data?.chestId && !!getChest(data.chestId);
}

export function createChestRuntimeFields(data, context = {}) {
  const chest = getChest(data?.chestId);
  if (!chest) return {};
  return {
    chestId: chest.id,
    chestTier: chest.tier,
    chestState: CHEST_STATES.CLOSED,
    chestOpenTimer: 0,
    chestOpenDuration: chestRevealProfileForTier(chest.tier).openingTime,
    chestRevealLabel: null,
    chestRevealProfile: chestRevealProfileForTier(chest.tier).id,
    chestRewardCount: 0,
    chestVisual: chest.visual?.renderer || "chest",
    chestGlyph: chest.visual?.glyph || chest.visual?.code || "BSC",
    chestOpenCost: chestOpenCostFor(chest.id, context),
    visualColor: chest.visual?.color || null
  };
}

export function updateChestInteractable(interactable, dt = 0.016) {
  if (!interactable?.chestId) return;
  if (interactable.chestState === CHEST_STATES.OPENING) {
    interactable.chestOpenTimer = Math.max(0, (interactable.chestOpenTimer || 0) - dt);
    if (interactable.chestOpenTimer <= 0) interactable.chestState = CHEST_STATES.OPENED;
  }
}

function denyChestOpenForCost(state, interactable, player, chest, cost, reason) {
  const color = reason === INTERACTABLE_DENIAL_REASONS.NOT_ENOUGH_MONEY ? RED : chestColor(chest);
  const label = affordanceReasonLabel(reason);
  pushVisualEffect(state, {
    type: "damageText",
    x: Math.round(interactable.x),
    y: Math.round(interactable.y - (interactable.radius || 24) - 14),
    text: label,
    color,
    jitter: reason === INTERACTABLE_DENIAL_REASONS.NOT_ENOUGH_MONEY,
    life: 0.48,
    maxLife: 0.48
  });
  if (reason === INTERACTABLE_DENIAL_REASONS.NOT_ENOUGH_MONEY) addShake(state, 1.4, 0.06, `chest-denied:${interactable.id}`, { audience: "target", targetId: player.id });
  pushEvent(state, {
    type: "chest",
    action: "open_denied",
    playerId: player.id,
    interactableId: interactable.id,
    chestId: chest.id,
    chestTier: chest.tier,
    cost,
    reason,
    x: interactable.x,
    y: interactable.y
  });
}

export function activateChest(state, interactable, player, options = {}) {
  const chest = getChest(interactable?.chestId);
  if (!state || !interactable || !player || !chest) return false;
  if (interactable.opened || interactable.active === false || interactable.chestState !== CHEST_STATES.CLOSED) {
    denyChestOpenForCost(state, interactable, player, chest, interactable.chestOpenCost || 0, INTERACTABLE_DENIAL_REASONS.INACTIVE);
    return false;
  }

  const cost = chestOpenCostFor(chest.id, { state, roomPlan: state.roomPlan });
  const profile = chestRevealProfileForTier(chest.tier);
  interactable.chestOpenCost = cost;
  if (cost > 0 && options.skipCost !== true) {
    const spent = spendMoney(state, player, cost, {
      sourceType: "chest",
      sourceId: interactable.id,
      chestId: chest.id,
      chestTier: chest.tier
    });
    if (!spent.ok) {
      denyChestOpenForCost(state, interactable, player, chest, cost, spent.reason || "not_enough_money");
      return false;
    }
  }

  interactable.uses += 1;
  interactable.opened = true;
  interactable.active = false;
  interactable.openedBy = player.id;
  interactable.chestState = CHEST_STATES.OPENING;
  interactable.chestOpenTimer = profile.openingTime;
  interactable.chestOpenDuration = profile.openingTime;
  interactable.chestRevealProfile = profile.id;
  interactable.chestRevealLabel = null;
  interactable.chestRewardCount = 0;
  interactable.despawnTimer = null;
  const color = chestColor(chest);

  const spawned = interactable.rewardTable
    ? executeRewardTable(state, interactable.rewardTable, interactable, {
      sourceType: "chest",
      sourceId: interactable.id,
      playerId: player.id,
      chestId: chest.id,
      chestTier: chest.tier,
      revealProfile: profile.id,
      rewardAccent: color,
      claimDelay: profile.claimDelay,
      popDistance: profile.popDistance
    })
    : [];
  interactable.chestRewardCount = spawned.length;
  interactable.chestRevealLabel = chestRevealSummary(spawned);

  chestRevealEffects(state, interactable, chest, profile, interactable.chestRevealLabel, player);
  pushEvent(state, {
    type: "interactable",
    action: "opened",
    playerId: player.id,
    interactableId: interactable.id,
    kind: interactable.kind,
    rewardTable: interactable.rewardTable || null,
    rewards: spawned.length,
    revealLabel: interactable.chestRevealLabel || null,
    cost,
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
    cost,
    x: interactable.x,
    y: interactable.y
  });
  return true;
}
