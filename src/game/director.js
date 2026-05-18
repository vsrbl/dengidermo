import { WORLD } from "../core/constants.js";
import { ENEMIES, ENEMY_WAVES } from "../data/enemies.js";
import { getLocation } from "../data/locations.js";
import { areDevSpawnsPaused, devSpawnBatch, devSpawnCap, devSpawnInterval } from "./dev.js";
import { pushEvent } from "./state.js";

const DEFAULT_DIRECTOR = Object.freeze({
  calmRatio: 0.22,
  eliteRatio: 0.58,
  rewardCapMult: 0.32,
  portalCapMult: 0.16,
  budgetBase: 18,
  budgetPerPlayer: 7,
  budgetPerRoom: 5,
  minPressureBudget: 12
});

function livingPlayerCount(state) {
  const players = Object.values(state.players || {});
  const alive = players.filter((p) => p.hp > 0).length;
  return Math.max(1, alive || players.length || 1);
}

function locationForState(state) {
  return getLocation(state.locationIndex || 0);
}

function getDirectorConfig(loc) {
  return { ...DEFAULT_DIRECTOR, ...(loc.director || {}) };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function phaseFor(state, loc, cfg) {
  const t = state.locationTime || 0;
  const portalAt = state.portalReadyAt ?? loc.portalDelay ?? 6;
  const calmEnd = Math.max(0.8, Math.min(portalAt * cfg.calmRatio, portalAt - 1.1));
  const enemyCount = Object.keys(state.enemies || {}).length;
  const players = livingPlayerCount(state);

  if (t < calmEnd) return "calm";
  if (t < portalAt) return "pressure";
  if (enemyCount > Math.max(2, players)) return "reward";
  return "portal";
}

function intensityFor(state, loc, cfg, phase) {
  const t = state.locationTime || 0;
  const portalAt = state.portalReadyAt ?? loc.portalDelay ?? 6;
  const calmEnd = Math.max(0.8, Math.min(portalAt * cfg.calmRatio, portalAt - 1.1));
  const roomScale = 1 + Math.min(0.55, (state.locationIndex || 0) * 0.075);

  if (phase === "calm") return 0.28 * roomScale;
  if (phase === "pressure") {
    const pressureT = clamp01((t - calmEnd) / Math.max(0.1, portalAt - calmEnd));
    return (0.55 + pressureT * 0.72) * roomScale;
  }
  if (phase === "reward") return 0.38 * roomScale;
  return 0.12 * roomScale;
}

function totalBudgetFor(state, loc, cfg) {
  const players = livingPlayerCount(state);
  const roomIndex = state.locationIndex || 0;
  const base = cfg.budgetBase + players * cfg.budgetPerPlayer + roomIndex * cfg.budgetPerRoom;
  const boosted = Math.round(base * (loc.spawnBoost || 1));
  return Math.max(cfg.minPressureBudget, boosted);
}

export function createDirectorState(state, loc = locationForState(state)) {
  const cfg = getDirectorConfig(loc);
  const portalAt = state.portalReadyAt ?? loc.portalDelay ?? 6;
  return {
    locationIndex: state.locationIndex || 0,
    locationId: loc.id,
    phase: "calm",
    phaseStartedAt: state.locationTime || 0,
    intensity: 0,
    enemyCap: 0,
    spawnTimer: Number.isFinite(state.spawnTimer) ? state.spawnTimer : 0.8,
    budget: totalBudgetFor(state, loc, cfg),
    totalBudget: totalBudgetFor(state, loc, cfg),
    spentBudget: 0,
    wave: state.wave || 0,
    eliteMomentAt: Math.max(1.2, portalAt * cfg.eliteRatio),
    eliteSpawned: false,
    lastPhase: "calm"
  };
}

export function resetDirectorState(state, loc = locationForState(state)) {
  state.director = createDirectorState(state, loc);
  state.spawnTimer = state.director.spawnTimer;
  return state.director;
}

function ensureDirectorState(state, loc = locationForState(state)) {
  if (!state.director || state.director.locationIndex !== (state.locationIndex || 0) || state.director.locationId !== loc.id) {
    return resetDirectorState(state, loc);
  }
  return state.director;
}

function computeCap(state, loc, director, phase, intensity) {
  const spawn = loc.spawn || {};
  const players = livingPlayerCount(state);
  const locTime = state.locationTime || 0;
  const capBase = spawn.capBase ?? 24;
  const capPerPlayer = spawn.capPerPlayer ?? 8;
  const capGrowthTime = spawn.capGrowthTime ?? 18;
  const capGrowthMax = spawn.capGrowthMax ?? 18;
  const capGrowth = Math.min(capGrowthMax, Math.floor(locTime / Math.max(1, capGrowthTime)));
  const phaseMult = phase === "calm" ? 0.42 : phase === "pressure" ? intensity : phase === "reward" ? DEFAULT_DIRECTOR.rewardCapMult : DEFAULT_DIRECTOR.portalCapMult;
  const normalCap = Math.floor((capBase + players * capPerPlayer + capGrowth) * (loc.spawnBoost || 1) * phaseMult);
  return devSpawnCap(state, Math.max(players + 2, normalCap));
}

function computeBatch(state, loc, phase, intensity) {
  const spawn = loc.spawn || {};
  const players = livingPlayerCount(state);
  const locTime = state.locationTime || 0;
  const batchBase = spawn.batchBase ?? 2;
  const batchGrowthTime = spawn.batchGrowthTime ?? 35;
  const pressureBatch = batchBase + Math.floor(locTime / Math.max(1, batchGrowthTime)) + Math.max(0, players - 1);
  const phaseMult = phase === "calm" ? 0.55 : phase === "pressure" ? Math.max(0.75, intensity) : 0.45;
  return devSpawnBatch(state, Math.max(1, Math.round(pressureBatch * phaseMult)));
}

function computeInterval(state, loc, phase, intensity) {
  const spawn = loc.spawn || {};
  const locTime = state.locationTime || 0;
  const intervalBase = spawn.intervalBase ?? 2.2;
  const intervalMin = spawn.intervalMin ?? 0.45;
  const intervalScale = spawn.intervalScale ?? 0.006;
  const pressureInterval = Math.max(intervalMin, intervalBase - locTime * intervalScale);
  const phaseMult = phase === "calm" ? 1.35 : phase === "pressure" ? Math.max(0.58, 1.08 - intensity * 0.28) : 1.65;
  return devSpawnInterval(state, pressureInterval * phaseMult);
}

function enemyCost(kind) {
  return Math.max(1, ENEMIES[kind]?.score || 1);
}

function canAfford(director, kind) {
  return director.budget >= enemyCost(kind);
}

function weightedPoolFor(loc, phase) {
  const pool = Array.isArray(loc.enemyPool) && loc.enemyPool.length ? loc.enemyPool : ENEMY_WAVES;
  if (phase === "calm") return pool.filter((kind) => (ENEMIES[kind]?.score || 1) <= 2).concat("grunt");
  return pool;
}

function pickEnemyKind(state, loc, phase, director) {
  const pool = weightedPoolFor(loc, phase).filter((kind) => ENEMIES[kind] && canAfford(director, kind));
  if (pool.length) return state.rng.pick(pool);
  if (canAfford(director, "grunt")) return "grunt";
  return null;
}

function pickEliteKind(state, loc, director) {
  const pool = Array.isArray(loc.enemyPool) && loc.enemyPool.length ? loc.enemyPool : ENEMY_WAVES;
  const roomIndex = state.locationIndex || 0;
  const candidates = [];
  if (roomIndex >= 2 || pool.includes("tank")) candidates.push("tank");
  if (pool.includes("shooter") || roomIndex >= 1) candidates.push("shooter");
  candidates.push("runner");
  return candidates.find((kind) => ENEMIES[kind] && canAfford(director, kind)) || pickEnemyKind(state, loc, "pressure", director);
}

function spawnBudgetedEnemy(state, spawnEnemy, director, kind, x = null, y = null) {
  if (!kind || !canAfford(director, kind)) return null;
  const enemy = spawnEnemy(state, kind, x, y);
  if (!enemy) return null;
  const cost = enemyCost(kind);
  director.budget = Math.max(0, director.budget - cost);
  director.spentBudget += cost;
  return enemy;
}

function spawnBossIfNeeded(state, loc, spawnEnemy) {
  const boss = loc.boss || {};
  const locTime = state.locationTime || 0;
  if (state.bossSpawned || !boss.enabled || locTime < (boss.spawnAt ?? 12)) return false;
  state.bossSpawned = true;
  const x = Number.isFinite(boss.x) ? boss.x : WORLD.w / 2;
  const y = Number.isFinite(boss.y) ? boss.y : 180;
  spawnEnemy(state, boss.kind || "boss", x, y);
  pushEvent(state, { type: "boss", x, y });
  return true;
}

function maybeSpawnElite(state, loc, spawnEnemy, director, phase, enemyCount) {
  const locTime = state.locationTime || 0;
  if (director.eliteSpawned || phase !== "pressure" || locTime < director.eliteMomentAt) return false;
  if (enemyCount >= Math.max(1, director.enemyCap - 1)) return false;

  const kind = pickEliteKind(state, loc, director);
  const enemy = spawnBudgetedEnemy(state, spawnEnemy, director, kind);
  if (!enemy) return false;
  director.eliteSpawned = true;
  pushEvent(state, { type: "director", phase: "elite", enemy: kind, x: enemy.x, y: enemy.y });
  return true;
}

function syncLegacySpawnFields(state, director) {
  state.spawnTimer = director.spawnTimer;
  state.wave = director.wave;
}

export function updateDirectorSpawner(state, dt, spawnEnemy) {
  const loc = locationForState(state);
  const cfg = getDirectorConfig(loc);
  const director = ensureDirectorState(state, loc);

  if (Number.isFinite(state.spawnTimer) && state.spawnTimer !== director.spawnTimer) {
    director.spawnTimer = state.spawnTimer;
  }

  const phase = phaseFor(state, loc, cfg);
  const intensity = intensityFor(state, loc, cfg, phase);
  director.intensity = Number(intensity.toFixed(3));
  director.enemyCap = computeCap(state, loc, director, phase, intensity);

  if (phase !== director.phase) {
    director.lastPhase = director.phase;
    director.phase = phase;
    director.phaseStartedAt = state.locationTime || 0;
    pushEvent(state, { type: "director", phase, x: WORLD.w / 2, y: 120 });
  }

  director.spawnTimer -= dt;
  spawnBossIfNeeded(state, loc, spawnEnemy);

  if (areDevSpawnsPaused(state)) {
    syncLegacySpawnFields(state, director);
    return;
  }

  const enemyCount = Object.keys(state.enemies || {}).length;
  if (phase === "portal" || director.budget <= 0) {
    director.spawnTimer = Math.max(director.spawnTimer, 0.25);
    syncLegacySpawnFields(state, director);
    return;
  }

  if (maybeSpawnElite(state, loc, spawnEnemy, director, phase, enemyCount)) {
    director.wave += 1;
    director.spawnTimer = computeInterval(state, loc, phase, intensity) * 1.15;
    syncLegacySpawnFields(state, director);
    return;
  }

  if (enemyCount >= director.enemyCap || director.spawnTimer > 0) {
    syncLegacySpawnFields(state, director);
    return;
  }

  const batch = computeBatch(state, loc, phase, intensity);
  let spawned = 0;
  const availableSlots = Math.max(0, director.enemyCap - enemyCount);
  const want = Math.min(batch, availableSlots);
  for (let i = 0; i < want; i += 1) {
    const kind = pickEnemyKind(state, loc, phase, director);
    if (!spawnBudgetedEnemy(state, spawnEnemy, director, kind)) break;
    spawned += 1;
  }

  if (spawned > 0) director.wave += 1;
  director.spawnTimer = computeInterval(state, loc, phase, intensity);
  syncLegacySpawnFields(state, director);
}

export function directorSnapshot(state) {
  const loc = locationForState(state);
  const director = ensureDirectorState(state, loc);
  return {
    phase: director.phase,
    intensity: director.intensity,
    enemyCap: director.enemyCap,
    budget: Math.round(director.budget),
    totalBudget: Math.round(director.totalBudget),
    wave: director.wave,
    eliteSpawned: !!director.eliteSpawned
  };
}
