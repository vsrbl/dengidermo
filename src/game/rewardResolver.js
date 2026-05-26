import { WORLD } from "../core/constants.js";
import { clamp } from "../core/math.js";
import { getRewardTable } from "../data/rewardTables.js";
import { createRewardCommand, executeRewardCommand } from "./rewardCommands.js";

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

export function resolveRewardTable(state, tableId, context = {}) {
  const table = getRewardTable(tableId);
  if (!state?.rng || !table) return [];
  const rolls = Math.max(1, Math.min(8, Math.floor(context.rolls ?? table.rolls ?? 1)));
  const rewards = [];
  for (const [index, entry] of (table.guaranteedEntries || []).entries()) {
    if (entry) rewards.push({ ...entry, tableId: table.id, rollIndex: `g${index}`, guaranteed: true });
  }
  for (let i = 0; i < rolls; i += 1) {
    const entry = weightedEntry(state.rng, table.entries || []);
    if (entry) rewards.push({ ...entry, tableId: table.id, rollIndex: i });
  }
  return rewards;
}

export function createRewardCommands(state, tableId, position, context = {}) {
  const table = getRewardTable(tableId);
  if (!table) return [];
  const rewards = resolveRewardTable(state, tableId, context);
  const commands = [];
  for (let i = 0; i < rewards.length; i += 1) {
    const p = scatterPosition(state, position, table.scatter, i, rewards.length);
    const command = createRewardCommand(rewards[i], p, { ...context, tableId });
    if (command) commands.push(command);
  }
  return commands;
}

export function executeReward(state, reward, position, context = {}) {
  const command = createRewardCommand(reward, position, context);
  return executeRewardCommand(state, command);
}

export function executeRewardTable(state, tableId, position, context = {}) {
  const commands = createRewardCommands(state, tableId, position, context);
  const spawned = [];
  for (const command of commands) {
    const result = executeRewardCommand(state, command);
    if (result) spawned.push(result);
  }
  return spawned;
}
