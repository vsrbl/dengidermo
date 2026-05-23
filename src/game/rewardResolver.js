import { GREEN, RED, WORLD } from "../core/constants.js";
import { clamp } from "../core/math.js";
import { getRewardTable } from "../data/rewardTables.js";
import { pushVisualEffect } from "./effectCommands.js";
import { pushEvent } from "./events.js";
import { spawnLoot } from "./loot.js";

function weightedEntry(rng, entries = []) {
  const safeEntries = entries.filter((entry) => Number.isFinite(entry?.weight) && entry.weight > 0);
  if (!safeEntries.length) return null;
  const total = safeEntries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.range(0, total);
  for (const entry of safeEntries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return safeEntries.at(-1) || null;
}

function scatterPosition(state, position, scatter = 0, index = 0, count = 1) {
  const spread = Math.max(0, Number(scatter) || 0);
  if (!spread) return { x: position.x, y: position.y };
  const base = count > 1 ? (Math.PI * 2 * index) / count : state.rng.range(0, Math.PI * 2);
  const angle = base + state.rng.range(-0.35, 0.35);
  const distance = state.rng.range(spread * 0.35, spread);
  return {
    x: clamp(position.x + Math.cos(angle) * distance, 24, WORLD.w - 24),
    y: clamp(position.y + Math.sin(angle) * distance, 24, WORLD.h - 24)
  };
}

function rewardText(state, reward, position, fallback = null) {
  const text = reward?.text || fallback;
  if (!state || !text) return;
  pushVisualEffect(state, {
    type: "damageText",
    x: Math.round(position.x),
    y: Math.round(position.y - 18),
    text: String(text).slice(0, 16),
    color: reward?.type === "nothing" ? RED : GREEN,
    life: 0.72,
    maxLife: 0.72
  });
}

export function resolveRewardTable(state, tableId, context = {}) {
  const table = getRewardTable(tableId);
  if (!state?.rng || !table) return [];
  const rolls = Math.max(1, Math.min(8, Math.floor(context.rolls ?? table.rolls ?? 1)));
  const rewards = [];
  for (let i = 0; i < rolls; i += 1) {
    const entry = weightedEntry(state.rng, table.entries || []);
    if (entry) rewards.push({ ...entry, tableId: table.id, rollIndex: i });
  }
  return rewards;
}

export function executeReward(state, reward, position, context = {}) {
  if (!reward) return null;

  if (reward.type === "nothing") {
    rewardText(state, reward, position, "BUST");
    pushEvent(state, {
      type: "reward",
      action: "nothing",
      tableId: reward.tableId || context.tableId || null,
      sourceType: context.sourceType || "reward",
      sourceId: context.sourceId || null,
      playerId: context.playerId || null,
      x: Math.round(position.x),
      y: Math.round(position.y)
    });
    return null;
  }

  if (reward.type !== "loot") return null;
  const item = spawnLoot(state, reward.kind, position.x, position.y, {
    sourceType: context.sourceType || "reward",
    sourceId: context.sourceId || null
  });
  if (item) rewardText(state, reward, position, null);
  return item;
}

export function executeRewardTable(state, tableId, position, context = {}) {
  const table = getRewardTable(tableId);
  if (!table) return [];
  const rewards = resolveRewardTable(state, tableId, context);
  const spawned = [];
  for (let i = 0; i < rewards.length; i += 1) {
    const p = scatterPosition(state, position, table.scatter, i, rewards.length);
    const item = executeReward(state, rewards[i], p, { ...context, tableId });
    if (item) spawned.push(item);
  }
  return spawned;
}
