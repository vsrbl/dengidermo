import { EFFECT_HOOKS, DAMAGE_TAGS, numberOr } from "./defs.js";
import { createEffectContext, effectCommand, runEffectHook } from "./core.js";
import { sourceId } from "./damage.js";

function ensureEnemyStatus(enemy) {
  if (!enemy.status) enemy.status = {};
  return enemy.status;
}

function applyStatus(enemy, type, data, source) {
  const status = ensureEnemyStatus(enemy);
  const prev = status[type] || { t: 0, tick: 0, dps: 0, slow: 0, stacks: 0, sourceId: null };
  const duration = Math.max(0.05, numberOr(data.duration, prev.t || 1));
  const nextStacks = Math.min(9, Math.max(1, numberOr(prev.stacks, 0) + 1));

  // Re-applying a status should feel meaningful without exploding balance:
  // refresh duration, add a small overlap window, and give DoTs a light stack bonus.
  const overlap = Math.min(duration * 0.22, numberOr(prev.t, 0) * 0.35);
  const baseDps = Math.max(numberOr(prev.dps, 0), numberOr(data.dps, 0));
  const stackDps = (type === "burn" || type === "poison") ? numberOr(data.dps, 0) * 0.18 * Math.max(0, nextStacks - 1) : 0;

  status[type] = {
    t: Math.min(duration * 1.65, Math.max(numberOr(prev.t, 0), duration) + overlap),
    dps: baseDps + stackDps,
    slow: Math.max(numberOr(prev.slow, 0), numberOr(data.slow, 0)),
    tick: numberOr(prev.tick, 0),
    stacks: nextStacks,
    sourceId: sourceId(source) || prev.sourceId || null
  };
  return status[type];
}

export function applyStatusToEnemy(enemy, type, data, source) {
  return applyStatus(enemy, type, data, source);
}

export function applyProjectileStatuses(projectile, enemy) {
  const ctx = createEffectContext({ projectile, enemy, target: enemy, sourceId: sourceId(projectile) });
  runEffectHook(projectile, EFFECT_HOOKS.PROJECTILE_HIT, ctx, {
    burn(effect, c) { c.queue(effectCommand("status", { status: "burn", target: c.enemy, effect, source: c.projectile })); },
    poison(effect, c) { c.queue(effectCommand("status", { status: "poison", target: c.enemy, effect, source: c.projectile })); },
    freeze(effect, c) { c.queue(effectCommand("status", { status: "freeze", target: c.enemy, effect, source: c.projectile })); }
  });

  const applied = [];
  for (const command of ctx.commands) {
    if (command.type !== "status" || !command.target || !command.status) continue;
    const status = applyStatus(command.target, command.status, command.effect || {}, command.source || projectile);
    applied.push({ type: command.status, status, effect: command.effect });
  }
  return applied;
}

function statusDamageTag(type) {
  if (type === "burn") return DAMAGE_TAGS.BURN;
  if (type === "poison") return DAMAGE_TAGS.POISON;
  if (type === "freeze") return DAMAGE_TAGS.FREEZE;
  return type;
}

function tickStatus(enemy, type, dt, fallbackDps = 0) {
  const status = enemy.status?.[type];
  if (!status || status.t <= 0) return { type, damage: 0, active: false, sourceId: null, tags: [DAMAGE_TAGS.STATUS, statusDamageTag(type)] };
  status.t -= dt;
  status.tick = (status.tick || 0) + dt;
  const damage = Math.max(0, numberOr(status.dps, fallbackDps)) * dt;
  const sid = status.sourceId || null;
  if (status.t <= 0) delete enemy.status[type];
  return { type, damage, active: true, sourceId: sid, tags: [DAMAGE_TAGS.STATUS, statusDamageTag(type)] };
}

export function tickEnemyStatuses(enemy, dt) {
  // Deprecated low-level status timer/damage reducer. Runtime callers should use
  // runEnemyStatusTickPipeline() so ENEMY_STATUS_TICK hooks remain observable.
  if (!enemy?.status) return { damage: 0, active: false, slowMult: 1, sources: [], ticks: [] };

  let damage = 0;
  let active = false;
  const sources = [];
  const ticks = [];
  const burn = tickStatus(enemy, "burn", dt);
  const poison = tickStatus(enemy, "poison", dt);
  const freeze = enemy.status.freeze;

  for (const tick of [burn, poison]) {
    if (!tick.active && tick.damage <= 0) continue;
    damage += tick.damage;
    active = true;
    if (tick.sourceId) sources.push(tick.sourceId);
    if (tick.damage > 0) ticks.push(tick);
  }

  let slow = 0;
  if (freeze && freeze.t > 0) {
    freeze.t -= dt;
    slow = Math.max(slow, numberOr(freeze.slow, 0.45));
    active = true;
    if (freeze.sourceId) sources.push(freeze.sourceId);
    if (freeze.t <= 0) delete enemy.status.freeze;
  }
  const poisonStatus = enemy.status.poison;
  if (poisonStatus) slow = Math.max(slow, numberOr(poisonStatus.slow, 0));

  if (!Object.keys(enemy.status).length) delete enemy.status;
  return { damage, active, slowMult: Math.max(0.15, 1 - slow), sources: [...new Set(sources)], ticks };
}
export function statusEffectsForEnemy(enemy) {
  return Object.entries(enemy?.status || {}).map(([type, status]) => ({
    type,
    scope: "enemy",
    hooks: [EFFECT_HOOKS.ENEMY_STATUS_TICK],
    sourceId: status.sourceId || null,
    dps: status.dps || 0,
    slow: status.slow || 0,
    stacks: status.stacks || 0,
    t: status.t || 0
  }));
}

export function runEnemyStatusHook(state, enemy, hook, context = {}, handlers = {}) {
  const entity = { effects: statusEffectsForEnemy(enemy) };
  const ctx = createEffectContext({
    state,
    enemy,
    target: enemy,
    sourceId: context.sourceId || null,
    rng: state?.rng || null,
    ...context
  });
  runEffectHook(entity, hook, ctx, handlers);
  return ctx;
}

export function runEnemyStatusTickPipeline(state, enemy, dt) {
  // ARCHITECTURE GUARD: status ticking must remain visible to ENEMY_STATUS_TICK.
  // Future burn-spread, poison-cloud, freeze-shatter and status-kill effects
  // should hook here instead of manually walking enemy.status in projectiles.js.
  const tick = tickEnemyStatuses(enemy, dt);
  const ctx = runEnemyStatusHook(state, enemy, EFFECT_HOOKS.ENEMY_STATUS_TICK, { dt, tick }, {
    burn(_effect, c) { c.hasBurn = true; },
    poison(_effect, c) { c.hasPoison = true; },
    freeze(_effect, c) { c.hasFreeze = true; }
  });
  return { ...tick, ctx };
}


export function enemyStatusSnapshot(enemy) {
  if (!enemy?.status) return null;
  return {
    burn: enemy.status.burn ? Number(Math.max(0, enemy.status.burn.t || 0).toFixed(2)) : 0,
    poison: enemy.status.poison ? Number(Math.max(0, enemy.status.poison.t || 0).toFixed(2)) : 0,
    freeze: enemy.status.freeze ? Number(Math.max(0, enemy.status.freeze.t || 0).toFixed(2)) : 0,
    slow: Number((1 - enemySlowMult(enemy)).toFixed(2)),
    burnStacks: enemy.status.burn?.stacks || 0,
    poisonStacks: enemy.status.poison?.stacks || 0,
    freezeStacks: enemy.status.freeze?.stacks || 0
  };
}

export function enemySlowMult(enemy) {
  const freeze = enemy?.status?.freeze?.t > 0 ? numberOr(enemy.status.freeze.slow, 0.45) : 0;
  const poison = enemy?.status?.poison?.t > 0 ? numberOr(enemy.status.poison.slow, 0) : 0;
  return Math.max(0.15, 1 - Math.max(freeze, poison));
}
