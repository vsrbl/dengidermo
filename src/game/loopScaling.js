import {
  DEFAULT_LOOP_ESCALATION_PROFILE,
  LOOP_ESCALATION_PROFILES
} from "../data/loopScaling.js";
import { ENEMIES } from "../data/enemies.js";

function normalizeLoopIndex(loopIndex = 0) {
  const value = Number.isFinite(loopIndex) ? Math.floor(loopIndex) : 0;
  return Math.max(0, value);
}

function profileMatchesLoop(profile, loopIndex) {
  if (!profile || profile.enabled === false) return false;
  const loop = normalizeLoopIndex(loopIndex);
  const min = normalizeLoopIndex(profile.minLoop || 0);
  const max = Number.isFinite(profile.maxLoop) ? Math.floor(profile.maxLoop) : Infinity;
  return loop >= min && loop <= max;
}

export function loopEscalationProfileForLoop(loopIndex = 0) {
  const loop = normalizeLoopIndex(loopIndex);
  return LOOP_ESCALATION_PROFILES.find((profile) => profileMatchesLoop(profile, loop)) || DEFAULT_LOOP_ESCALATION_PROFILE;
}

export function loopIndexForState(state, loc = null) {
  if (Number.isFinite(loc?.loopIndex)) return normalizeLoopIndex(loc.loopIndex);
  if (Number.isFinite(state?.roomPlan?.loopIndex)) return normalizeLoopIndex(state.roomPlan.loopIndex);
  if (Number.isFinite(state?.loopIndex)) return normalizeLoopIndex(state.loopIndex);
  return 0;
}

export function loopEscalationProfileForState(state, loc = null) {
  return loopEscalationProfileForLoop(loopIndexForState(state, loc));
}

export function loopEscalationProfileForLocation(loc = null) {
  return loopEscalationProfileForLoop(Number.isFinite(loc?.loopIndex) ? loc.loopIndex : 0);
}

function directorMultipliers(profile = DEFAULT_LOOP_ESCALATION_PROFILE) {
  return profile?.director || DEFAULT_LOOP_ESCALATION_PROFILE.director;
}

function multiplier(profile, field) {
  const value = directorMultipliers(profile)[field];
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function applyLoopProfileToDirectorConfig(config = {}, profile = DEFAULT_LOOP_ESCALATION_PROFILE) {
  return {
    ...config,
    loopProfileId: profile.id,
    loopBudgetMultiplier: multiplier(profile, "budgetMultiplier"),
    loopCapMultiplier: multiplier(profile, "capMultiplier"),
    loopBatchMultiplier: multiplier(profile, "batchMultiplier"),
    loopIntervalMultiplier: multiplier(profile, "intervalMultiplier"),
    loopIntensityMultiplier: multiplier(profile, "intensityMultiplier")
  };
}

export function applyLoopProfileToBudget(value, profile = DEFAULT_LOOP_ESCALATION_PROFILE) {
  return value * multiplier(profile, "budgetMultiplier");
}

export function applyLoopProfileToCap(value, profile = DEFAULT_LOOP_ESCALATION_PROFILE) {
  return value * multiplier(profile, "capMultiplier");
}

export function applyLoopProfileToBatch(value, profile = DEFAULT_LOOP_ESCALATION_PROFILE) {
  return value * multiplier(profile, "batchMultiplier");
}

export function applyLoopProfileToInterval(value, profile = DEFAULT_LOOP_ESCALATION_PROFILE) {
  return value * multiplier(profile, "intervalMultiplier");
}

export function applyLoopProfileToIntensity(value, profile = DEFAULT_LOOP_ESCALATION_PROFILE) {
  return value * multiplier(profile, "intensityMultiplier");
}

function uniqueValidEnemyKinds(values = []) {
  return [...new Set(values.filter((kind) => ENEMIES[kind]))];
}

export function resolveLoopEnemyPool(basePool = [], profile = DEFAULT_LOOP_ESCALATION_PROFILE) {
  const pool = uniqueValidEnemyKinds(basePool);
  const config = profile?.enemyPool || {};
  const excluded = new Set(config.exclude || []);
  const preferred = uniqueValidEnemyKinds(config.prefer || []).filter((kind) => pool.includes(kind) && !excluded.has(kind));
  const added = uniqueValidEnemyKinds(config.add || []).filter((kind) => !excluded.has(kind));
  const resolved = [...preferred, ...pool, ...added].filter((kind) => !excluded.has(kind));
  return uniqueValidEnemyKinds(resolved.length ? resolved : pool);
}

export function loopEscalationSnapshot(profile = DEFAULT_LOOP_ESCALATION_PROFILE) {
  const runtime = profile?.enabled !== false;
  return {
    id: profile?.id || DEFAULT_LOOP_ESCALATION_PROFILE.id,
    phase: profile?.phase || "foundation",
    enabled: runtime,
    features: [...(profile?.features || [])],
    director: { ...(profile?.director || DEFAULT_LOOP_ESCALATION_PROFILE.director) },
    enemyPool: {
      tierBias: profile?.enemyPool?.tierBias || 0,
      add: [...(profile?.enemyPool?.add || [])],
      prefer: [...(profile?.enemyPool?.prefer || [])],
      exclude: [...(profile?.enemyPool?.exclude || [])]
    },
    elite: {
      chance: profile?.elite?.chance || 0,
      variantIds: [...(profile?.elite?.variantIds || [])]
    },
    armor: {
      variantChance: profile?.armor?.variantChance || 0,
      variantIds: [...(profile?.armor?.variantIds || [])]
    },
    modifiers: {
      stackChance: profile?.modifiers?.stackChance || 0,
      maxExtraModifiers: profile?.modifiers?.maxExtraModifiers || 0,
      modifierIds: [...(profile?.modifiers?.modifierIds || [])]
    }
  };
}

export function loopEscalationSnapshotForState(state, loc = null) {
  return loopEscalationSnapshot(loopEscalationProfileForState(state, loc));
}
