// Visual effect lifecycle/runtime ownership. Gameplay systems emit visual
// events through effectCommands.pushVisualEffect(); this module is the
// single place that advances and prunes those render-only events each host
// tick. Snapshot trimming lives in snapshotBudget.js.

export const VISUAL_EFFECT_LIFECYCLE_MAX_ACTIVE = 384;

const CRITICAL_VISUAL_EFFECT_TYPES = new Set([
  "playerDamageImpact",
  "portalOpen",
  "levelUp",
  "installQueued",
  "casinoJackpot",
  "rewardRevealPulse",
  "heraldTether"
]);

export function visualEffectPriority(effect) {
  if (!effect || !effect.type) return 0;
  if (CRITICAL_VISUAL_EFFECT_TYPES.has(effect.type)) return 3;
  if (/damage|hit|pulse|wave|tether|beam|field|reveal|portal|jackpot/i.test(effect.type)) return 2;
  return 1;
}

function finitePositive(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function normalizeVisualEffect(effect) {
  if (!effect || typeof effect !== "object") return null;
  if (typeof effect.type !== "string" || effect.type.length === 0) return null;
  const normalized = effect;
  normalized.life = finitePositive(normalized.life, finitePositive(normalized.maxLife, 0.16));
  normalized.maxLife = finitePositive(normalized.maxLife, normalized.life);
  return normalized;
}

export function tickVisualEffects(state, dt, options = {}) {
  if (!state || !Array.isArray(state.effects)) return { total: 0, expired: 0, pruned: 0 };
  const safeDt = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
  const maxActive = Math.max(32, options.maxActive || VISUAL_EFFECT_LIFECYCLE_MAX_ACTIVE);

  let expired = 0;
  const alive = [];
  for (const raw of state.effects) {
    const fx = normalizeVisualEffect(raw);
    if (!fx) {
      expired += 1;
      continue;
    }
    fx.life -= safeDt;
    if (fx.life > 0) alive.push(fx);
    else expired += 1;
  }

  let pruned = 0;
  if (alive.length > maxActive) {
    const indexed = alive.map((effect, index) => ({ effect, index, priority: visualEffectPriority(effect) }));
    indexed.sort((a, b) => (b.priority - a.priority) || (b.index - a.index));
    const keep = new Set(indexed.slice(0, maxActive).map((entry) => entry.index));
    const kept = [];
    for (let i = 0; i < alive.length; i += 1) {
      if (keep.has(i)) kept.push(alive[i]);
    }
    pruned = alive.length - kept.length;
    state.effects = kept;
  } else {
    state.effects = alive;
  }

  state.visualEffectStats = {
    total: state.effects.length,
    expired,
    pruned,
    maxActive
  };
  return state.visualEffectStats;
}
