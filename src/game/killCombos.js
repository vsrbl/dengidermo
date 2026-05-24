import { GREEN } from "../core/constants.js";
import { pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { grantMoney, grantXp } from "./playerEconomy.js";

export const KILL_COMBO_WINDOW = 2.85;

export const KILL_COMBO_TIERS = Object.freeze([
  { threshold: 2, label: "SIGNAL TRACE", code: "TRC", tier: "trace", reward: null },
  { threshold: 3, label: "SIGNAL CHAIN", code: "CHN", tier: "chain", reward: { xp: 2 } },
  { threshold: 5, label: "SERIAL SIGNAL", code: "SRL", tier: "serial", reward: { money: 3, xp: 3 } },
  { threshold: 8, label: "VOID CHAIN", code: "VOID", tier: "void", reward: { money: 5, xp: 6 } },
  { threshold: 12, label: "HARD DELETE", code: "DEL", tier: "delete", reward: { money: 8, xp: 9 } },
  { threshold: 18, label: "MEGA WIPE", code: "WIPE", tier: "wipe", reward: { money: 12, xp: 14 } },
  { threshold: 25, label: "ROOM ERASE", code: "ERASE", tier: "erase", reward: { money: 18, xp: 22 } },
  { threshold: 40, label: "NNCCKKRR FEVER", code: "FEVER", tier: "fever", reward: { money: 32, xp: 36 } }
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
  return KILL_COMBO_TIERS.find((entry) => entry.threshold === count) || null;
}

function repeatMilestoneFor(count) {
  if (count <= 40 || count % 10 !== 0) return null;
  const bonusSteps = Math.max(0, Math.floor((count - 40) / 10));
  return {
    ...KILL_COMBO_TIERS[KILL_COMBO_TIERS.length - 1],
    threshold: count,
    reward: {
      money: 32 + bonusSteps * 6,
      xp: 36 + bonusSteps * 8
    }
  };
}

function milestoneFor(count) {
  return exactMilestoneFor(count) || repeatMilestoneFor(count);
}

function rewardText(reward = {}) {
  const parts = [];
  if (reward.money > 0) parts.push(`+${Math.round(reward.money)} GLD`);
  if (reward.xp > 0) parts.push(`+${Math.round(reward.xp)} EXP`);
  return parts.join(" / ");
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
    r: tier?.threshold >= 12 ? 62 : 42,
    color: tier?.threshold >= 25 ? "#ffffff" : GREEN,
    mode: tier?.threshold >= 18 ? "rare" : "combo",
    life: 0.42,
    maxLife: 0.42
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
    expiresAt: Number(combo.expiresAt.toFixed(3)),
    sourceType,
    enemyKind: enemy.kind || null,
    enemyId: enemy.id || null,
    rewardMoney: reward.money || 0,
    rewardXp: reward.xp || 0,
    rewardLabel,
    x: Math.round(enemy.x),
    y: Math.round(enemy.y)
  });

  return combo;
}
