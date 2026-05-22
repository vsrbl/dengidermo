import { ENCOUNTER_OBJECTIVES, getEncounterPlan } from "../data/encounters.js";
import { getPlannedLocationForState } from "./runPlanner.js";
import { devSpawnCap } from "./dev.js";
import { threatSnapshot } from "./threat.js";
import { ROOM_MODIFIER_HOOKS, runRoomModifierHooks } from "./roomModifiers.js";
import {
  applyLoopProfileToBudget,
  applyLoopProfileToCap,
  applyLoopProfileToDirectorConfig,
  applyLoopProfileToIntensity,
  loopEscalationProfileForLocation,
  loopEscalationProfileForState,
  loopEscalationSnapshotForState
} from "./loopScaling.js";

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

export const DEFAULT_DIRECTOR = Object.freeze({
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

export function livingPlayerCount(state) {
  const players = Object.values(state.players || {});
  const alive = players.filter((p) => p.hp > 0).length;
  return Math.max(1, alive || players.length || 1);
}

export function locationForState(state) {
  return getPlannedLocationForState(state);
}

export function runDepthFor(state) {
  return Number.isFinite(state.runDepth) ? state.runDepth : (state.locationIndex || 0);
}

export function roomSequenceIndexFor(state, loc) {
  return Number.isFinite(state.roomSequenceIndex) ? state.roomSequenceIndex : (loc.sequenceIndex || loc.index || 0);
}

export function encounterPlanFor(loc) {
  return getEncounterPlan(loc.encounterId);
}

export function getDirectorConfig(loc) {
  const plan = encounterPlanFor(loc);
  const raw = { ...DEFAULT_DIRECTOR, ...(plan.director || {}), ...(loc.director || {}) };
  if (raw.cleanupCapMult === undefined && raw.rewardCapMult !== undefined) raw.cleanupCapMult = raw.rewardCapMult;
  return applyLoopProfileToDirectorConfig(raw, loopEscalationProfileForLocation(loc));
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function objectiveFor(loc) {
  const plan = encounterPlanFor(loc);
  const raw = loc.objective || plan.objective || (isBossRoom(loc) ? ENCOUNTER_OBJECTIVES.BOSS : ENCOUNTER_OBJECTIVES.CLEAR);
  return Object.values(ENCOUNTER_OBJECTIVES).includes(raw) ? raw : ENCOUNTER_OBJECTIVES.CLEAR;
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

export function cleanupThreshold(state, cfg, loc) {
  const objective = objectiveFor(loc);
  if (objective === ENCOUNTER_OBJECTIVES.CLEAR || objective === ENCOUNTER_OBJECTIVES.BOSS) return 0;

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
  const cleanupDone = t >= portalAt && bossDone && enemyCount <= cleanupThreshold(state, cfg, loc);
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

export function selectEncounterStage(state, loc, cfg) {
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
  const roomScale = 1 + Math.min(0.55, runDepthFor(state) * 0.075);
  const intensity = stage?.intensity || {};
  const base = Number.isFinite(intensity.base) ? intensity.base : 0.18;
  const ramp = Number.isFinite(intensity.ramp) ? intensity.ramp : 0;
  const threatMult = Number.isFinite(threat.intensityMult) ? threat.intensityMult : 1;
  const raw = (base + pressureProgress(state, loc, cfg) * ramp) * roomScale * threatMult;
  return applyLoopProfileToIntensity(raw, loopEscalationProfileForState(state, loc));
}

export function totalBudgetFor(state, loc, cfg) {
  const players = livingPlayerCount(state);
  const roomDepth = runDepthFor(state);
  const base = cfg.budgetBase + players * cfg.budgetPerPlayer + roomDepth * cfg.budgetPerRoom;
  const boosted = Math.round(base * (loc.spawnBoost || 1));
  const minimum = cfg.minPressureBudget;
  const loopBudget = Math.max(minimum, applyLoopProfileToBudget(boosted, loopEscalationProfileForState(state, loc)));
  const ctx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.DIRECTOR_BUDGET, {
    budget: loopBudget,
    totalBudget: loopBudget,
    baseBudget: base,
    location: loc,
    loopProfileId: cfg.loopProfileId || null
  }, { location: loc });
  return Math.max(minimum, Math.round(ctx.budget));
}

export function eliteRatioFor(loc, cfg) {
  const plan = encounterPlanFor(loc);
  if (plan.elite?.enabled === false) return null;
  return Number.isFinite(plan.elite?.ratio) ? plan.elite.ratio : cfg.eliteRatio;
}

export function stageMultiplier(stage, field, fallback) {
  const value = stage?.[field];
  if (value === "intensity") return value;
  return Number.isFinite(value) ? value : fallback;
}

export function resolveMultiplier(value, intensity) {
  if (value === "intensity") return intensity;
  return Number.isFinite(value) ? value : 1;
}

export function computeCap(state, loc, director, stage, intensity, cfg, threat = {}) {
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
  const rawCap = (capBase + players * capPerPlayer + capGrowth) * (loc.spawnBoost || 1) * phaseMult * threatCapMult;
  const normalCap = Math.floor(applyLoopProfileToCap(rawCap, loopEscalationProfileForState(state, loc)));
  const capped = devSpawnCap(state, Math.max(players + 2, normalCap));
  const ctx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.DIRECTOR_CAP, {
    enemyCap: capped,
    phase: stage?.phase || null,
    intensity,
    location: loc
  }, { location: loc });
  return Math.max(0, Math.round(ctx.enemyCap));
}

function createDirectorReadState(state, loc) {
  const cfg = getDirectorConfig(loc);
  const plan = encounterPlanFor(loc);
  const budget = totalBudgetFor(state, loc, cfg);
  return {
    runDepth: runDepthFor(state),
    roomSequenceIndex: roomSequenceIndexFor(state, loc),
    locationIndex: state.locationIndex || 0,
    locationId: loc.id,
    encounterId: plan.id,
    objective: objectiveFor(loc),
    stageId: null,
    phase: DIRECTOR_PHASES.CALM,
    intensity: 0,
    enemyCap: 0,
    budget,
    totalBudget: budget,
    spentBudget: 0,
    wave: state.wave || 0,
    eliteSpawned: false,
    policy: PHASE_POLICIES[DIRECTOR_PHASES.CALM],
    lastSpawn: null,
    loopProfileId: cfg.loopProfileId || loopEscalationProfileForLocation(loc).id
  };
}

function readDirectorForSnapshot(state, loc) {
  const plan = encounterPlanFor(loc);
  const director = state.director;
  if (director && director.runDepth === runDepthFor(state) && director.locationId === loc.id && director.encounterId === plan.id) {
    return director;
  }
  return createDirectorReadState(state, loc);
}

export function readDirectorEvaluation(state, loc = locationForState(state), director = null, options = {}) {
  const cfg = options.cfg || getDirectorConfig(loc);
  const threat = options.threat || state.threat || {};
  const readDirector = director || state.director || createDirectorReadState(state, loc);
  const stage = selectEncounterStage(state, loc, cfg);
  const phase = stage?.phase || phaseFor(state, loc, cfg);
  const intensity = intensityFor(state, loc, cfg, stage, threat);
  const basePolicy = policyForStage(stage);
  const portalCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.PORTAL_OPEN, {
    canOpen: !!basePolicy.canOpenPortal,
    phase,
    stageId: stage?.id || null,
    location: loc
  }, { location: loc });
  const policy = { ...basePolicy, canOpenPortal: !!portalCtx.canOpen };
  const enemyCap = computeCap(state, loc, readDirector, stage, intensity, cfg, threat);
  return {
    encounterId: encounterPlanFor(loc).id,
    objective: objectiveFor(loc),
    stage,
    stageId: stage?.id || null,
    phase,
    intensity,
    enemyCap,
    policy,
    threat
  };
}

export function canOpenPortal(state) {
  const loc = locationForState(state);
  const director = readDirectorForSnapshot(state, loc);
  const evaluation = readDirectorEvaluation(state, loc, director, { threat: state.threat || {} });
  return !!evaluation.policy?.canOpenPortal;
}

export function directorSnapshot(state) {
  const loc = locationForState(state);
  const director = readDirectorForSnapshot(state, loc);
  const evaluation = readDirectorEvaluation(state, loc, director, { threat: state.threat || {} });
  return {
    runDepth: director.runDepth,
    roomSequenceIndex: director.roomSequenceIndex,
    encounterId: evaluation.encounterId,
    objective: evaluation.objective,
    stageId: evaluation.stageId,
    phase: evaluation.phase,
    intensity: Number(evaluation.intensity.toFixed(3)),
    enemyCap: evaluation.enemyCap,
    cleanupThreshold: cleanupThreshold(state, getDirectorConfig(loc), loc),
    budget: Math.round(director.budget),
    totalBudget: Math.round(director.totalBudget),
    wave: director.wave,
    eliteSpawned: !!director.eliteSpawned,
    canSpawn: !!evaluation.policy?.canSpawn,
    canOpenPortal: !!evaluation.policy?.canOpenPortal,
    lastSpawn: director.lastSpawn || null,
    threat: threatSnapshot(state),
    loop: loopEscalationSnapshotForState(state, loc)
  };
}
