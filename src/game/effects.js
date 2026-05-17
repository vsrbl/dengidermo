import { getUpgrade } from "../data/upgrades.js";

const EFFECT_SCOPES = new Set(["projectile", "enemy", "player"]);
const NON_STACK_FIELDS = new Set(["type", "scope", "trigger", "target", "visual", "color", "id", "source"]);

function numberOr(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function effectScope(effect) {
  const scope = effect?.scope || effect?.trigger || "projectile";
  return EFFECT_SCOPES.has(scope) ? scope : "projectile";
}

export function cloneEffect(effect, extra = {}) {
  return { ...effect, ...extra };
}

function mergeEffectInto(map, effect) {
  if (!effect || typeof effect.type !== "string") return;
  const type = effect.type;
  const current = map.get(type) || { type };

  for (const [key, value] of Object.entries(effect)) {
    if (NON_STACK_FIELDS.has(key)) {
      if (value !== undefined && current[key] === undefined) current[key] = value;
      continue;
    }

    if (!Number.isFinite(value)) {
      if (value !== undefined && current[key] === undefined) current[key] = value;
      continue;
    }

    if (type === "crit" && key === "multiplier") {
      current[key] = Math.max(numberOr(current[key], 1), value);
    } else if ((type === "burn" || type === "freeze" || type === "poison") && key === "duration") {
      current[key] = Math.max(numberOr(current[key], 0), value);
    } else if ((type === "homing" || type === "chainLightning") && key === "acquireRange") {
      current[key] = Math.max(numberOr(current[key], 0), value);
    } else {
      current[key] = numberOr(current[key], 0) + value;
    }
  }

  map.set(type, current);
}

export function mergeEffects(...groups) {
  const map = new Map();
  for (const group of groups) {
    if (!Array.isArray(group)) continue;
    for (const effect of group) mergeEffectInto(map, effect);
  }
  return [...map.values()];
}

export function playerUpgradeEffects(player, scope = "projectile") {
  const taken = player?.upgrades?.taken || {};
  const out = [];

  for (const [upgradeId, rawStacks] of Object.entries(taken)) {
    const stacks = Math.max(0, Math.floor(rawStacks || 0));
    if (!stacks) continue;

    const upgrade = getUpgrade(upgradeId);
    if (!upgrade || !Array.isArray(upgrade.effects)) continue;

    for (const effect of upgrade.effects) {
      if (effectScope(effect) !== scope) continue;
      const scaled = cloneEffect(effect, { source: upgradeId });
      for (const [key, value] of Object.entries(scaled)) {
        if (NON_STACK_FIELDS.has(key)) continue;
        if (!Number.isFinite(value)) continue;
        if (scaled.type === "crit" && key === "multiplier") continue;
        if ((scaled.type === "burn" || scaled.type === "freeze" || scaled.type === "poison") && key === "duration") continue;
        scaled[key] = value * stacks;
      }
      out.push(scaled);
    }
  }

  return out;
}

export function buildProjectileEffects(player, weapon) {
  return mergeEffects(weapon?.effects || [], playerUpgradeEffects(player, "projectile"));
}

export function getEffect(entity, type) {
  if (!entity || !Array.isArray(entity.effects)) return null;
  return entity.effects.find((effect) => effect.type === type) || null;
}

export function hasEffect(entity, type) {
  return !!getEffect(entity, type);
}

export function resolveProjectileDamage(state, projectile, baseDamage) {
  let amount = Math.max(0, numberOr(baseDamage, 0));
  const crit = getEffect(projectile, "crit");
  let critical = false;

  if (crit) {
    const chance = Math.max(0, Math.min(0.8, numberOr(crit.chance, 0)));
    const multiplier = Math.max(1, numberOr(crit.multiplier, 2));
    if (chance > 0 && state?.rng?.next && state.rng.next() < chance) {
      amount *= multiplier;
      critical = true;
    }
  }

  return {
    amount: Math.max(1, Math.round(amount)),
    critical
  };
}

function ensureEnemyStatus(enemy) {
  if (!enemy.status) enemy.status = {};
  return enemy.status;
}

export function applyProjectileStatuses(projectile, enemy) {
  const burn = getEffect(projectile, "burn");
  if (burn) {
    const status = ensureEnemyStatus(enemy);
    const prev = status.burn || { t: 0, dps: 0, tick: 0 };
    status.burn = {
      t: Math.max(numberOr(prev.t, 0), numberOr(burn.duration, 2)),
      dps: Math.max(numberOr(prev.dps, 0), numberOr(burn.dps, 0)),
      tick: numberOr(prev.tick, 0)
    };
  }
}

export function tickEnemyStatuses(enemy, dt) {
  if (!enemy?.status) return { damage: 0, burned: false };

  let damage = 0;
  let burned = false;
  const burn = enemy.status.burn;
  if (burn && burn.t > 0) {
    burn.t -= dt;
    burn.tick = (burn.tick || 0) + dt;
    damage += Math.max(0, numberOr(burn.dps, 0)) * dt;
    burned = true;
    if (burn.t <= 0) delete enemy.status.burn;
  }

  if (!Object.keys(enemy.status).length) delete enemy.status;
  return { damage, burned };
}

export function enemyStatusSnapshot(enemy) {
  if (!enemy?.status) return null;
  return {
    burn: enemy.status.burn ? Number(Math.max(0, enemy.status.burn.t || 0).toFixed(2)) : 0
  };
}
