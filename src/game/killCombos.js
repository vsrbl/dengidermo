import { GREEN } from "../core/constants.js";
import { pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { grantMoney, grantXp } from "./playerEconomy.js";

export const KILL_COMBO_WINDOW = 4.25;
export const KILL_COMBO_VISIBLE_THRESHOLD = 1;

export const KILL_COMBO_TIERS = Object.freeze([
  { threshold: 1, label: "KILL TRACE", code: "KILL", tier: "trace", reward: { money: 0, xp: 0 } },
  { threshold: 10, label: "KILL SIGNAL RISE", code: "RISE", tier: "rise", reward: { money: 4, xp: 6 } },
  { threshold: 25, label: "SIGNAL KILL CHAIN", code: "CHN", tier: "chain", reward: { money: 10, xp: 14 } },
  { threshold: 50, label: "SERIAL KILL WIPE", code: "WIPE", tier: "serial", reward: { money: 18, xp: 26 } },
  { threshold: 75, label: "VOID KILL OVERFLOW", code: "VOID", tier: "void", reward: { money: 30, xp: 42 } },
  { threshold: 100, label: "ROOM KILL DELETE", code: "DEL", tier: "delete", reward: { money: 46, xp: 62 } },
  { threshold: 150, label: "SYSTEM KILL FEVER", code: "FEVER", tier: "fever", reward: { money: 70, xp: 96 } },
  { threshold: 200, label: "NNCCKKRR KILL BREACH", code: "BRCH", tier: "breach", reward: { money: 100, xp: 136 } }
]);

function ensureComboState(state) {
  if (!state.killCombos || typeof state.killCombos !== "object") state.killCombos = {};
  return state.killCombos;
}

function comboTierFor(count) {
  let tier = KILL_COMBO_TIERS[0];
  for (const entry of KILL_COMBO_TIERS) {
    if (count >= entry.threshold) tier = entry;
  }
  return tier;
}

function exactMilestoneFor(count) {
  return KILL_COMBO_TIERS.find((entry) => entry.threshold === count && entry.threshold >= 10) || null;
}

function repeatMilestoneFor(count) {
  if (count <= 200 || count % 50 !== 0) return null;
  const bonusSteps = Math.max(0, Math.floor((count - 200) / 50));
  return {
    ...KILL_COMBO_TIERS[KILL_COMBO_TIERS.length - 1],
    threshold: count,
    label: "NNCCKKRR KILL BREACH",
    reward: {
      money: 90 + bonusSteps * 24,
      xp: 120 + bonusSteps * 34
    }
  };
}

function milestoneFor(count) {
  return exactMilestoneFor(count) || repeatMilestoneFor(count);
}

function nextMilestoneFor(count) {
  return KILL_COMBO_TIERS.find((entry) => entry.threshold > count && entry.reward && ((entry.reward.money || 0) > 0 || (entry.reward.xp || 0) > 0)) || null;
}

function rewardText(reward = {}) {
  const parts = [];
  if (reward.money > 0) parts.push(`+${Math.round(reward.money)} GLD`);
  if (reward.xp > 0) parts.push(`+${Math.round(reward.xp)} EXP`);
  return parts.join(" / ");
}

function nextRewardText(count) {
  const next = nextMilestoneFor(count);
  const reward = rewardText(next?.reward || {});
  return next && reward ? `x${next.threshold} ${reward}` : "";
}

function applyComboReward(state, player, reward, context = {}) {
  const money = Math.max(0, Math.floor(Number(reward?.money) || 0));
  const xp = Math.max(0, Math.floor(Number(reward?.xp) || 0));
  const baseContext = {
    sourceType: "kill_combo",
    sourceId: context.comboId || null,
    comboCount: context.count || null,
    comboTier: context.tier || null
  };
  if (money > 0) grantMoney(state, player, money, baseContext);
  if (xp > 0) grantXp(state, player, xp, baseContext);
  return { money, xp };
}

function emitComboRewardFx(state, enemy, tier, reward) {
  if (!state || !enemy || !reward || (!(reward.money > 0) && !(reward.xp > 0))) return;
  pushVisualEffect(state, {
    type: "damageText",
    x: Math.round(enemy.x),
    y: Math.round(enemy.y - 30),
    text: rewardText(reward).slice(0, 18),
    color: GREEN,
    jitter: true,
    life: 0.74,
    maxLife: 0.74
  });
  pushVisualEffect(state, {
    type: "rewardRevealPulse",
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    r: tier?.threshold >= 100 ? 76 : 54,
    color: tier?.threshold >= 150 ? "#ffffff" : GREEN,
    mode: tier?.threshold >= 100 ? "rare" : "combo",
    life: 0.46,
    maxLife: 0.46
  });
}

export function registerKillCombo(state, enemy, { playerId = null, sourceType = null } = {}) {
  if (!state || !enemy || !playerId || !state.players?.[playerId]) return null;
  const player = state.players[playerId];
  if (!player || player.hp <= 0) return null;

  const now = Number.isFinite(state.time) ? state.time : 0;
  const store = ensureComboState(state);
  const prev = store[playerId] || { count: 0, seq: 0, best: 0, lastKillAt: -Infinity, lastRewardThreshold: 0 };
  const expired = now - (prev.lastKillAt ?? -Infinity) > KILL_COMBO_WINDOW;
  const combo = expired
    ? { count: 0, seq: prev.seq || 0, best: prev.best || 0, lastRewardThreshold: 0 }
    : { ...prev };

  combo.count = Math.max(1, Math.floor(combo.count || 0) + 1);
  combo.seq = Math.max(0, Math.floor(combo.seq || 0) + 1);
  combo.best = Math.max(combo.best || 0, combo.count);
  combo.lastKillAt = now;
  combo.expiresAt = now + KILL_COMBO_WINDOW;

  const visible = combo.count >= KILL_COMBO_VISIBLE_THRESHOLD;
  const tier = comboTierFor(combo.count);
  const milestone = milestoneFor(combo.count);
  let reward = { money: 0, xp: 0 };
  let rewardLabel = "";
  const comboId = `${playerId}:${combo.seq}:${combo.count}`;
  if (milestone?.reward && milestone.threshold > (combo.lastRewardThreshold || 0)) {
    reward = applyComboReward(state, player, milestone.reward, { comboId, count: combo.count, tier: milestone.tier });
    rewardLabel = rewardText(reward);
    combo.lastRewardThreshold = milestone.threshold;
    emitComboRewardFx(state, enemy, milestone, reward);
  }

  store[playerId] = combo;
  if (!visible && !milestone) return combo;

  pushEvent(state, {
    type: "kill_combo",
    action: "stack",
    playerId,
    count: combo.count,
    best: combo.best,
    seq: combo.seq,
    label: milestone?.label || tier.label,
    code: milestone?.code || tier.code,
    tier: milestone?.tier || tier.tier,
    milestone: !!milestone,
    threshold: milestone?.threshold || tier.threshold,
    comboWindow: KILL_COMBO_WINDOW,
    visibleThreshold: KILL_COMBO_VISIBLE_THRESHOLD,
    expiresAt: Number(combo.expiresAt.toFixed(3)),
    sourceType,
    enemyKind: enemy.kind || null,
    enemyId: enemy.id || null,
    rewardMoney: reward.money || 0,
    rewardXp: reward.xp || 0,
    rewardLabel,
    nextRewardLabel: nextRewardText(combo.count),
    x: Math.round(enemy.x),
    y: Math.round(enemy.y)
  });

  return combo;
}

export function resetPlayerKillCombo(state, playerId, { reason = "reset" } = {}) {
  if (!state || !playerId || !state.killCombos?.[playerId]) return false;
  const prev = state.killCombos[playerId];
  delete state.killCombos[playerId];
  pushEvent(state, {
    type: "kill_combo",
    action: "reset",
    playerId,
    reason,
    count: Math.max(0, Math.floor(prev.count || 0)),
    seq: Math.max(0, Math.floor(prev.seq || 0))
  });
  return true;
}

export function resetKillCombos(state, { reason = "room_end" } = {}) {
  if (!state) return;
  const ids = Object.keys(state.killCombos || {});
  for (const playerId of ids) resetPlayerKillCombo(state, playerId, { reason });
  state.killCombos = {};
}
