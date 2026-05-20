import { WORLD } from "../core/constants.js";
import { ENEMIES, ENEMY_WAVES } from "../data/enemies.js";
import { areDevSpawnsPaused, devSpawnBatch, devSpawnInterval } from "./dev.js";
import { directorEventCommand, directorSpawnEnemyCommand, executeDirectorCommands } from "./directorCommands.js";
import { chooseSpawnZone } from "./spawnZones.js";
import { updateThreatAnalyzer } from "./threat.js";
import { ROOM_MODIFIER_HOOKS, runRoomModifierHooks } from "./roomModifiers.js";
import {
  DEFAULT_DIRECTOR,
  DIRECTOR_PHASES,
  PHASE_POLICIES,
  cleanupThreshold,
  computeCap,
  encounterPlanFor,
  eliteRatioFor,
  getDirectorConfig,
  livingPlayerCount,
  locationForState,
  objectiveFor,
  readDirectorEvaluation,
  resolveMultiplier,
  runDepthFor,
  roomSequenceIndexFor,
  stageMultiplier,
  totalBudgetFor
} from "./directorRead.js";

export { canOpenPortal, directorSnapshot, readDirectorEvaluation } from "./directorRead.js";

export function createDirectorState(state, loc = locationForState(state)) {
  const cfg = getDirectorConfig(loc);
  const plan = encounterPlanFor(loc);
  const portalAt = state.portalReadyAt ?? loc.portalDelay ?? 6;
  const spawnStartDelay = Number.isFinite(cfg.spawnStartDelay) ? cfg.spawnStartDelay : DEFAULT_DIRECTOR.spawnStartDelay;
  const budget = totalBudgetFor(state, loc, cfg);
  const eliteRatio = eliteRatioFor(loc, cfg);
  return {
    runDepth: runDepthFor(state),
    roomSequenceIndex: roomSequenceIndexFor(state, loc),
    locationIndex: state.locationIndex || 0,
    locationId: loc.id,
    encounterId: plan.id,
    objective: objectiveFor(loc),
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
    scriptedStageSpawns: {},
    lastPhase: DIRECTOR_PHASES.CALM,
    policy: PHASE_POLICIES[DIRECTOR_PHASES.CALM],
    lastSpawn: null
  };
}

export function resetDirectorState(state, loc = locationForState(state)) {
  state.director = createDirectorState(state, loc);
  state.spawnTimer = state.director.spawnTimer;
  return state.director;
}

function ensureDirectorState(state, loc = locationForState(state)) {
  const plan = encounterPlanFor(loc);
  if (!state.director || state.director.runDepth !== runDepthFor(state) || state.director.locationId !== loc.id || state.director.encounterId !== plan.id) {
    return resetDirectorState(state, loc);
  }
  return state.director;
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
  const rawBatch = devSpawnBatch(state, Math.max(1, Math.round(pressureBatch * phaseMult * threatBatchMult)));
  const ctx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.DIRECTOR_SPAWN, {
    batch: rawBatch,
    canSpawn: true,
    phase: stage?.phase || null,
    intensity,
    location: loc
  }, { location: loc });
  return ctx.canSpawn === false ? 0 : Math.max(0, Math.round(ctx.batch));
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
  const rawInterval = devSpawnInterval(state, pressureInterval * phaseMult * threatIntervalMult);
  const ctx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.DIRECTOR_SPAWN, {
    interval: rawInterval,
    canSpawn: true,
    phase: stage?.phase || null,
    intensity,
    location: loc
  }, { location: loc });
  return Math.max(0.05, ctx.interval || rawInterval);
}

function enemyCost(kind) {
  return Math.max(1, ENEMIES[kind]?.score || 1);
}

function canAfford(director, kind) {
  return director.budget >= enemyCost(kind);
}

function weightedPoolFor(loc, stage, phase) {
  const stagePool = Array.isArray(stage?.enemyPool) && stage.enemyPool.length ? stage.enemyPool : null;
  const pool = stagePool || (Array.isArray(loc.enemyPool) && loc.enemyPool.length ? loc.enemyPool : ENEMY_WAVES);
  if (phase === DIRECTOR_PHASES.CALM) return pool.filter((kind) => (ENEMIES[kind]?.score || 1) <= 2).concat("grunt");
  return pool;
}

function pickEnemyKind(state, loc, phase, director, stage = null) {
  const pool = weightedPoolFor(loc, stage, phase).filter((kind) => ENEMIES[kind] && canAfford(director, kind));
  if (pool.length) return state.rng.pick(pool);
  if (canAfford(director, "grunt")) return "grunt";
  return null;
}

function pickEliteKind(state, loc, director) {
  const pool = Array.isArray(loc.enemyPool) && loc.enemyPool.length ? loc.enemyPool : ENEMY_WAVES;
  const roomDepth = runDepthFor(state);
  const candidates = [];
  if (roomDepth >= 2 || pool.includes("tank")) candidates.push("tank");
  if (pool.includes("shooter") || roomDepth >= 1) candidates.push("shooter");
  candidates.push("runner");
  return candidates.find((kind) => ENEMIES[kind] && canAfford(director, kind)) || pickEnemyKind(state, loc, DIRECTOR_PHASES.PRESSURE, director, null);
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
    zone: options.zone || null,
    anchorId: options.anchorId || null,
    anchorTags: options.anchorTags || null
  });
}

function planBossSpawnCommand(state, loc) {
  const boss = loc.boss || {};
  const locTime = state.locationTime || 0;
  if (state.bossSpawned || !boss.enabled || locTime < (boss.spawnAt ?? 12)) return null;
  return makeBudgetedSpawnCommand(boss.kind || "boss", {
    role: "boss",
    zone: "boss_anchor",
    anchorId: boss.anchorId || null,
    anchorTags: Array.isArray(boss.anchorTags) ? boss.anchorTags : ["boss"],
    budgeted: false,
    markBossSpawned: true,
    event: { type: "boss" }
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

function planStageScriptedSpawnCommands(state, loc, director, stage, threat) {
  if (!stage || !Array.isArray(stage.scriptedSpawns) || !stage.scriptedSpawns.length) return [];
  if (!director.scriptedStageSpawns || typeof director.scriptedStageSpawns !== "object") director.scriptedStageSpawns = {};
  const locTime = state.locationTime || 0;
  const enemyCount = Object.keys(state.enemies || {}).length;
  const commands = [];
  for (const entry of stage.scriptedSpawns) {
    if (!entry || !entry.kind) continue;
    const id = entry.id || `${stage.id || "stage"}:${entry.kind}:${entry.at || 0}`;
    if (director.scriptedStageSpawns[id]) continue;
    if (locTime < (entry.at || 0)) continue;
    if (Number.isFinite(entry.maxEnemies) && enemyCount + commands.length >= entry.maxEnemies) continue;
    const kind = ENEMIES[entry.kind] ? entry.kind : null;
    if (!kind) continue;
    const budgeted = entry.budgeted !== false;
    if (budgeted && !canAfford(director, kind)) continue;
    commands.push(makeBudgetedSpawnCommand(kind, {
      role: entry.role || "scripted",
      zone: entry.zone || chooseSpawnZone(state, loc, stage, threat, entry.role || "scripted"),
      budgeted,
      event: entry.event || { type: "director", phase: stage.phase || null, enemy: kind, role: entry.role || "scripted" }
    }));
    director.scriptedStageSpawns[id] = true;
  }
  return commands;
}

function syncLegacySpawnFields(state, director) {
  // v38.6 cleanup: state.spawnTimer/state.wave are legacy mirrors kept
  // for older checks and debug tooling. Director remains the runtime source
  // of truth for pacing. New code should read state.director.spawnTimer.
  state.spawnTimer = director.spawnTimer;
  state.wave = director.wave;
}


export function forceDirectorSpawnTimer(state, value = 0) {
  const loc = locationForState(state);
  const director = ensureDirectorState(state, loc);
  director.spawnTimer = Number.isFinite(value) ? value : 0;
  syncLegacySpawnFields(state, director);
  return director;
}

function updateDirectorPhase(state, loc, cfg, director, options = {}) {
  const previousPhase = director.phase;
  const previousStageId = director.stageId;
  const evaluation = readDirectorEvaluation(state, loc, director, { cfg, threat: options.threat });

  director.encounterId = evaluation.encounterId;
  director.objective = evaluation.objective;
  director.stageId = evaluation.stageId;
  director.intensity = Number(evaluation.intensity.toFixed(3));
  director.enemyCap = evaluation.enemyCap;
  director.cleanupThreshold = cleanupThreshold(state, cfg, loc);
  director.policy = evaluation.policy;

  if (evaluation.phase !== previousPhase || evaluation.stageId !== previousStageId) {
    director.lastPhase = previousPhase;
    director.lastStageId = previousStageId;
    director.phase = evaluation.phase;
    director.phaseStartedAt = state.locationTime || 0;
    director.stageStartedAt = state.locationTime || 0;
    if (options.commands) options.commands.push(directorEventCommand({ type: "director", phase: evaluation.phase, stage: evaluation.stageId, x: WORLD.w / 2, y: 120 }));
  }
  return evaluation;
}

function executeCommands(state, director, commands, spawnEnemy) {
  if (!commands.length) return { executed: 0, failed: 0, spawned: 0, events: 0, spawnedByRole: {} };
  return executeDirectorCommands(state, director, commands, { spawnEnemy });
}

export function updateDirectorSpawner(state, dt, spawnEnemy) {
  const loc = locationForState(state);
  const cfg = getDirectorConfig(loc);
  const director = ensureDirectorState(state, loc);

  // v38.6: state.spawnTimer is a legacy mirror only. Do not let stale
  // snapshot/test/debug mirrors overwrite the director runtime timer here.

  const threat = updateThreatAnalyzer(state, dt, director, loc);
  const phaseCommands = [];
  let { phase, stage, intensity, policy } = updateDirectorPhase(state, loc, cfg, director, { commands: phaseCommands, threat });
  director.spawnTimer -= dt;

  executeCommands(state, director, phaseCommands, spawnEnemy);

  if (areDevSpawnsPaused(state)) {
    syncLegacySpawnFields(state, director);
    return;
  }

  const bossCommand = planBossSpawnCommand(state, loc);
  if (bossCommand) executeCommands(state, director, [bossCommand], spawnEnemy);

  ({ phase, stage, intensity, policy } = updateDirectorPhase(state, loc, cfg, director, { threat }));

  const scriptedCommands = planStageScriptedSpawnCommands(state, loc, director, stage, threat);
  if (scriptedCommands.length) executeCommands(state, director, scriptedCommands, spawnEnemy);

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
    const kind = pickEnemyKind(state, loc, phase, virtualDirector, stage);
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

