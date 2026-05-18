import { WORLD } from "../core/constants.js";
import { ENEMIES, ENEMY_WAVES } from "../data/enemies.js";
import { getEncounterPlan } from "../data/encounters.js";
import { getLocation } from "../data/locations.js";
import { areDevSpawnsPaused, devSpawnBatch, devSpawnCap, devSpawnInterval } from "./dev.js";
import { directorEventCommand, directorSpawnEnemyCommand, executeDirectorCommands } from "./directorCommands.js";
import { chooseSpawnZone } from "./spawnZones.js";
import { threatSnapshot, updateThreatAnalyzer } from "./threat.js";

export const DIRECTOR_PHASES = Object.freeze({
  CALM: "calm",
  PRESSURE: "pressure",
  BOSS: "boss",
  CLEANUP: "cleanup",
  PORTAL: "portal"
});

export const PHASE_POLICIES = Object.freeze({
  [DIRECTOR_PHASES.CALM]: Object.freeze({ canSpawn: true, canOpenPortal: false }),
  [DIRECTOR_PHASES.PRESSURE]: Object.freeze({ canSpawn: true, canOpenPortal: false }),
  [DIRECTOR_PHASES.BOSS]: Object.freeze({ canSpawn: true, canOpenPortal: false }),
  [DIRECTOR_PHASES.CLEANUP]: Object.freeze({ canSpawn: false, canOpenPortal: false }),
  [DIRECTOR_PHASES.PORTAL]: Object.freeze({ canSpawn: false, canOpenPortal: true })
});

const DEFAULT_DIRECTOR = Object.freeze({
  calmRatio: 0.22,
  eliteRatio: 0.58,
  cleanupCapMult: 0.32,
  rewardCapMult: 0.32,
  portalCapMult: 0.16,
  bossCapMult: 0.52,
  budgetBase: 18,
  budgetPerPlayer: 7,
  budgetPerRoom: 5,
  minPressureBudget: 12,
  spawnStartDelay: 0.8,
  cleanupEnemyPerPlayer: 1,
  cleanupEnemyBase: 2
});

function livingPlayerCount(state) {
  const players = Object.values(state.players || {});
  const alive = players.filter((p) => p.hp > 0).length;
  return Math.max(1, alive || players.length || 1);
}

function locationForState(state) {
  return getLocation(state.locationIndex || 0);
}

function encounterPlanFor(loc) {
  return getEncounterPlan(loc.encounterId);
}

function getDirectorConfig(loc) {
  const plan = encounterPlanFor(loc);
  const raw = { ...DEFAULT_DIRECTOR, ...(plan.director || {}), ...(loc.director || {}) };
  if (raw.cleanupCapMult === undefined && raw.rewardCapMult !== undefined) raw.cleanupCapMult = raw.rewardCapMult;
  return raw;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function bossKind(loc) {
  return loc.boss?.kind || "boss";
}

function isBossRoom(loc) {
  return !!loc.boss?.enabled;
}

function hasLiveBoss(state, loc) {
  if (!isBossRoom(loc)) return false;
  const kind = bossKind(loc);
  return Object.values(state.enemies || {}).some((enemy) => enemy.kind === kind || enemy.kind === "boss");
}

function bossObjectiveComplete(state, loc) {
  if (!isBossRoom(loc)) return true;
  return !!state.bossSpawned && !hasLiveBoss(state, loc);
}

function cleanupThreshold(state, cfg) {
  const players = livingPlayerCount(state);
  return Math.max(0, Math.floor((cfg.cleanupEnemyBase ?? 2) + players * (cfg.cleanupEnemyPerPlayer ?? 1)));
}

function bossSpawnTime(loc) {
  return loc.boss?.spawnAt ?? 12;
}

function calmEndFor(state, loc, cfg) {
  const portalAt = state.portalReadyAt ?? loc.portalDelay ?? 6;
  return Math.max(0.8, Math.min(portalAt * cfg.calmRatio, portalAt - 1.1));
}

function pressureProgress(state, loc, cfg) {
  const t = state.locationTime || 0;
  const portalAt = state.portalReadyAt ?? loc.portalDelay ?? 6;
  const calmEnd = calmEndFor(state, loc, cfg);
  return clamp01((t - calmEnd) / Math.max(0.1, portalAt - calmEnd));
}

function encounterMarkers(state, loc, cfg) {
  const t = state.locationTime || 0;
  const portalAt = state.portalReadyAt ?? loc.portalDelay ?? 6;
  const bossAt = bossSpawnTime(loc);
  const bossRoom = isBossRoom(loc);
  const enemyCount = Object.keys(state.enemies || {}).length;
  const bossDone = bossObjectiveComplete(state, loc);
  const cleanupDone = t >= portalAt && bossDone && enemyCount <= cleanupThreshold(state, cfg);
  return {
    beforeCalmEnd: t < calmEndFor(state, loc, cfg),
    beforeBossSpawn: bossRoom && t < bossAt,
    bossActive: bossRoom && t >= bossAt && !bossDone,
    beforePortal: t < portalAt,
    cleanupRequired: t >= portalAt && !cleanupDone,
    portalReady: cleanupDone
  };
}

function stageMatches(stage, markers) {
  if (!stage?.when) return false;
  return !!markers[stage.when];
}

function selectEncounterStage(state, loc, cfg) {
  const plan = encounterPlanFor(loc);
  const stages = Array.isArray(plan.stages) ? plan.stages : [];
  const markers = encounterMarkers(state, loc, cfg);
  return stages.find((stage) => stageMatches(stage, markers)) || stages.at(-1) || null;
}

function phaseFor(state, loc, cfg) {
  const stage = selectEncounterStage(state, loc, cfg);
  return stage?.phase || DIRECTOR_PHASES.CLEANUP;
}

function policyForStage(stage) {
  const fallback = PHASE_POLICIES[stage?.phase] || PHASE_POLICIES[DIRECTOR_PHASES.CLEANUP];
  return {
    canSpawn: stage?.canSpawn ?? fallback.canSpawn,
    canOpenPortal: stage?.canOpenPortal ?? fallback.canOpenPortal
  };
}

function intensityFor(state, loc, cfg, stage, threat = {}) {
  const roomScale = 1 + Math.min(0.55, (state.locationIndex || 0) * 0.075);
  const intensity = stage?.intensity || {};
  const base = Number.isFinite(intensity.base) ? intensity.base : 0.18;
  const ramp = Number.isFinite(intensity.ramp) ? intensity.ramp : 0;
  const threatMult = Number.isFinite(threat.intensityMult) ? threat.intensityMult : 1;
  return (base + pressureProgress(state, loc, cfg) * ramp) * roomScale * threatMult;
}

function totalBudgetFor(state, loc, cfg) {
  const players = livingPlayerCount(state);
  const roomIndex = state.locationIndex || 0;
  const base = cfg.budgetBase + players * cfg.budgetPerPlayer + roomIndex * cfg.budgetPerRoom;
  const boosted = Math.round(base * (loc.spawnBoost || 1));
  return Math.max(cfg.minPressureBudget, boosted);
}

function eliteRatioFor(loc, cfg) {
  const plan = encounterPlanFor(loc);
  if (plan.elite?.enabled === false) return null;
  return Number.isFinite(plan.elite?.ratio) ? plan.elite.ratio : cfg.eliteRatio;
}

export function createDirectorState(state, loc = locationForState(state)) {
  const cfg = getDirectorConfig(loc);
  const plan = encounterPlanFor(loc);
  const portalAt = state.portalReadyAt ?? loc.portalDelay ?? 6;
  const spawnStartDelay = Number.isFinite(cfg.spawnStartDelay) ? cfg.spawnStartDelay : DEFAULT_DIRECTOR.spawnStartDelay;
  const budget = totalBudgetFor(state, loc, cfg);
  const eliteRatio = eliteRatioFor(loc, cfg);
  return {
    locationIndex: state.locationIndex || 0,
    locationId: loc.id,
    encounterId: plan.id,
    stageId: null,
    phase: DIRECTOR_PHASES.CALM,
    phaseStartedAt: state.locationTime || 0,
    stageStartedAt: state.locationTime || 0,
    intensity: 0,
    enemyCap: 0,
    spawnTimer: Number.isFinite(state.spawnTimer) && state.spawnTimer > 0 ? state.spawnTimer : spawnStartDelay,
    budget,
    totalBudget: budget,
    spentBudget: 0,
    wave: state.wave || 0,
    eliteMomentAt: eliteRatio === null ? Infinity : Math.max(1.2, portalAt * eliteRatio),
    eliteSpawned: false,
    lastPhase: DIRECTOR_PHASES.CALM,
    policy: PHASE_POLICIES[DIRECTOR_PHASES.CALM]
  };
}

export function resetDirectorState(state, loc = locationForState(state)) {
  state.director = createDirectorState(state, loc);
  state.spawnTimer = state.director.spawnTimer;
  return state.director;
}

function ensureDirectorState(state, loc = locationForState(state)) {
  const plan = encounterPlanFor(loc);
  if (!state.director || state.director.locationIndex !== (state.locationIndex || 0) || state.director.locationId !== loc.id || state.director.encounterId !== plan.id) {
    return resetDirectorState(state, loc);
  }
  return state.director;
}

function stageMultiplier(stage, field, fallback) {
  const value = stage?.[field];
  if (value === "intensity") return value;
  return Number.isFinite(value) ? value : fallback;
}

function resolveMultiplier(value, intensity) {
  if (value === "intensity") return intensity;
  return Number.isFinite(value) ? value : 1;
}

function computeCap(state, loc, director, stage, intensity, cfg, threat = {}) {
  const spawn = loc.spawn || {};
  const players = livingPlayerCount(state);
  const locTime = state.locationTime || 0;
  const capBase = spawn.capBase ?? 24;
  const capPerPlayer = spawn.capPerPlayer ?? 8;
  const capGrowthTime = spawn.capGrowthTime ?? 18;
  const capGrowthMax = spawn.capGrowthMax ?? 18;
  const capGrowth = Math.min(capGrowthMax, Math.floor(locTime / Math.max(1, capGrowthTime)));
  const fallback = stage?.phase === DIRECTOR_PHASES.BOSS
    ? cfg.bossCapMult
    : stage?.phase === DIRECTOR_PHASES.CLEANUP
      ? cfg.cleanupCapMult
      : stage?.phase === DIRECTOR_PHASES.PORTAL
        ? cfg.portalCapMult
        : stage?.phase === DIRECTOR_PHASES.PRESSURE
          ? "intensity"
          : 0.42;
  const phaseMult = resolveMultiplier(stageMultiplier(stage, "capMult", fallback), intensity);
  const threatCapMult = Number.isFinite(threat.capMult) ? threat.capMult : 1;
  const normalCap = Math.floor((capBase + players * capPerPlayer + capGrowth) * (loc.spawnBoost || 1) * phaseMult * threatCapMult);
  return devSpawnCap(state, Math.max(players + 2, normalCap));
}

function computeBatch(state, loc, stage, intensity, threat = {}) {
  const spawn = loc.spawn || {};
  const players = livingPlayerCount(state);
  const locTime = state.locationTime || 0;
  const batchBase = spawn.batchBase ?? 2;
  const batchGrowthTime = spawn.batchGrowthTime ?? 35;
  const pressureBatch = batchBase + Math.floor(locTime / Math.max(1, batchGrowthTime)) + Math.max(0, players - 1);
  const fallback = stage?.phase === DIRECTOR_PHASES.CALM
    ? 0.55
    : stage?.phase === DIRECTOR_PHASES.PRESSURE
      ? "intensity"
      : stage?.phase === DIRECTOR_PHASES.BOSS
        ? 0.55
        : 0;
  const phaseMult = resolveMultiplier(stageMultiplier(stage, "batchMult", fallback), Math.max(0.75, intensity));
  const threatBatchMult = Number.isFinite(threat.batchMult) ? threat.batchMult : 1;
  return devSpawnBatch(state, Math.max(1, Math.round(pressureBatch * phaseMult * threatBatchMult)));
}

function computeInterval(state, loc, stage, intensity, threat = {}) {
  const spawn = loc.spawn || {};
  const locTime = state.locationTime || 0;
  const intervalBase = spawn.intervalBase ?? 2.2;
  const intervalMin = spawn.intervalMin ?? 0.45;
  const intervalScale = spawn.intervalScale ?? 0.006;
  const pressureInterval = Math.max(intervalMin, intervalBase - locTime * intervalScale);
  const interval = stage?.interval || {};
  let phaseMult = Number.isFinite(interval.mult) ? interval.mult : 1;
  if (Number.isFinite(interval.base)) {
    phaseMult = interval.base + intensity * (interval.intensityScale || 0);
    if (Number.isFinite(interval.min)) phaseMult = Math.max(interval.min, phaseMult);
    if (Number.isFinite(interval.max)) phaseMult = Math.min(interval.max, phaseMult);
  }
  const threatIntervalMult = Number.isFinite(threat.intervalMult) ? threat.intervalMult : 1;
  return devSpawnInterval(state, pressureInterval * phaseMult * threatIntervalMult);
}

function enemyCost(kind) {
  return Math.max(1, ENEMIES[kind]?.score || 1);
}

function canAfford(director, kind) {
  return director.budget >= enemyCost(kind);
}

function weightedPoolFor(loc, phase) {
  const pool = Array.isArray(loc.enemyPool) && loc.enemyPool.length ? loc.enemyPool : ENEMY_WAVES;
  if (phase === DIRECTOR_PHASES.CALM) return pool.filter((kind) => (ENEMIES[kind]?.score || 1) <= 2).concat("grunt");
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
  return candidates.find((kind) => ENEMIES[kind] && canAfford(director, kind)) || pickEnemyKind(state, loc, DIRECTOR_PHASES.PRESSURE, director);
}

function makeBudgetedSpawnCommand(kind, options = {}) {
  if (!kind) return null;
  return directorSpawnEnemyCommand({
    kind,
    cost: enemyCost(kind),
    role: options.role || "wave",
    x: options.x ?? null,
    y: options.y ?? null,
    budgeted: options.budgeted !== false,
    markBossSpawned: !!options.markBossSpawned,
    markEliteSpawned: !!options.markEliteSpawned,
    event: options.event || null,
    zone: options.zone || null
  });
}

function planBossSpawnCommand(state, loc) {
  const boss = loc.boss || {};
  const locTime = state.locationTime || 0;
  if (state.bossSpawned || !boss.enabled || locTime < (boss.spawnAt ?? 12)) return null;
  const x = Number.isFinite(boss.x) ? boss.x : WORLD.w / 2;
  const y = Number.isFinite(boss.y) ? boss.y : 180;
  return makeBudgetedSpawnCommand(boss.kind || "boss", {
    role: "boss",
    x,
    y,
    budgeted: false,
    markBossSpawned: true,
    event: { type: "boss", x, y }
  });
}

function planEliteCommand(state, loc, director, phase, enemyCount, stage, threat) {
  const locTime = state.locationTime || 0;
  if (director.eliteSpawned || phase !== DIRECTOR_PHASES.PRESSURE || locTime < director.eliteMomentAt) return null;
  if (enemyCount >= Math.max(1, director.enemyCap - 1)) return null;

  const kind = pickEliteKind(state, loc, director);
  if (!kind) return null;
  return makeBudgetedSpawnCommand(kind, {
    role: "elite",
    zone: chooseSpawnZone(state, loc, stage, threat, "elite"),
    markEliteSpawned: true,
    event: { type: "director", phase: "elite", enemy: kind }
  });
}

function syncLegacySpawnFields(state, director) {
  state.spawnTimer = director.spawnTimer;
  state.wave = director.wave;
}

function updateDirectorPhase(state, loc, cfg, director, options = {}) {
  const threat = options.threat || state.threat || {};
  const stage = selectEncounterStage(state, loc, cfg);
  const phase = stage?.phase || phaseFor(state, loc, cfg);
  const intensity = intensityFor(state, loc, cfg, stage, threat);
  const policy = policyForStage(stage);
  director.encounterId = encounterPlanFor(loc).id;
  director.stageId = stage?.id || null;
  director.intensity = Number(intensity.toFixed(3));
  director.enemyCap = computeCap(state, loc, director, stage, intensity, cfg, threat);
  director.policy = policy;

  if (phase !== director.phase || director.stageId !== director.lastStageId) {
    director.lastPhase = director.phase;
    director.lastStageId = director.stageId;
    director.phase = phase;
    director.phaseStartedAt = state.locationTime || 0;
    director.stageStartedAt = state.locationTime || 0;
    if (options.commands) options.commands.push(directorEventCommand({ type: "director", phase, stage: director.stageId, x: WORLD.w / 2, y: 120 }));
  }
  return { phase, stage, intensity, policy };
}

function executeCommands(state, director, commands, spawnEnemy) {
  if (!commands.length) return { executed: 0, failed: 0, spawned: 0, events: 0, spawnedByRole: {} };
  return executeDirectorCommands(state, director, commands, { spawnEnemy });
}

export function updateDirectorSpawner(state, dt, spawnEnemy) {
  const loc = locationForState(state);
  const cfg = getDirectorConfig(loc);
  const director = ensureDirectorState(state, loc);

  if (Number.isFinite(state.spawnTimer) && state.spawnTimer !== director.spawnTimer) {
    director.spawnTimer = state.spawnTimer;
  }

  const threat = updateThreatAnalyzer(state, dt, director, loc);
  const phaseCommands = [];
  let { phase, stage, intensity, policy } = updateDirectorPhase(state, loc, cfg, director, { commands: phaseCommands, threat });
  director.spawnTimer -= dt;

  const bossCommand = planBossSpawnCommand(state, loc);
  if (bossCommand) phaseCommands.push(bossCommand);
  executeCommands(state, director, phaseCommands, spawnEnemy);

  ({ phase, stage, intensity, policy } = updateDirectorPhase(state, loc, cfg, director, { threat }));

  if (areDevSpawnsPaused(state)) {
    syncLegacySpawnFields(state, director);
    return;
  }

  const enemyCount = Object.keys(state.enemies || {}).length;
  if (!policy.canSpawn || director.budget <= 0) {
    director.spawnTimer = Math.max(director.spawnTimer, 0.25);
    syncLegacySpawnFields(state, director);
    return;
  }

  const eliteCommand = planEliteCommand(state, loc, director, phase, enemyCount, stage, threat);
  if (eliteCommand) {
    const summary = executeCommands(state, director, [eliteCommand], spawnEnemy);
    if ((summary.spawnedByRole.elite || 0) > 0) {
      director.wave += 1;
      director.spawnTimer = computeInterval(state, loc, stage, intensity, threat) * 1.15;
    }
    syncLegacySpawnFields(state, director);
    return;
  }

  if (enemyCount >= director.enemyCap || director.spawnTimer > 0) {
    syncLegacySpawnFields(state, director);
    return;
  }

  const batch = computeBatch(state, loc, stage, intensity, threat);
  const commands = [];
  const availableSlots = Math.max(0, director.enemyCap - enemyCount);
  const want = Math.min(batch, availableSlots);
  let virtualBudget = director.budget;
  for (let i = 0; i < want; i += 1) {
    const virtualDirector = { ...director, budget: virtualBudget };
    const kind = pickEnemyKind(state, loc, phase, virtualDirector);
    if (!kind) break;
    const cost = enemyCost(kind);
    if (virtualBudget < cost) break;
    commands.push(makeBudgetedSpawnCommand(kind, { role: "wave", zone: chooseSpawnZone(state, loc, stage, threat, "wave") }));
    virtualBudget -= cost;
  }

  const summary = executeCommands(state, director, commands, spawnEnemy);
  if ((summary.spawnedByRole.wave || 0) > 0) director.wave += 1;
  director.spawnTimer = computeInterval(state, loc, stage, intensity, threat);
  syncLegacySpawnFields(state, director);
}

export function canOpenPortal(state) {
  const loc = locationForState(state);
  const cfg = getDirectorConfig(loc);
  const director = ensureDirectorState(state, loc);
  updateDirectorPhase(state, loc, cfg, director, { threat: state.threat || {} });
  return !!director.policy?.canOpenPortal;
}

export function directorSnapshot(state) {
  const loc = locationForState(state);
  const cfg = getDirectorConfig(loc);
  const director = ensureDirectorState(state, loc);
  updateDirectorPhase(state, loc, cfg, director, { threat: state.threat || {} });
  return {
    encounterId: director.encounterId,
    stageId: director.stageId,
    phase: director.phase,
    intensity: director.intensity,
    enemyCap: director.enemyCap,
    budget: Math.round(director.budget),
    totalBudget: Math.round(director.totalBudget),
    wave: director.wave,
    eliteSpawned: !!director.eliteSpawned,
    canSpawn: !!director.policy?.canSpawn,
    canOpenPortal: !!director.policy?.canOpenPortal,
    threat: threatSnapshot(state)
  };
}
