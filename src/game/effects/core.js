import { getUpgrade } from "../../data/upgrades.js";
import { synergyEffectsForPlayer } from "../../data/synergies.js";
import { EFFECT_DEFS, numberOr, clamp } from "./defs.js";

const NON_STACK_FIELDS = new Set(["type", "scope", "hooks", "hook", "trigger", "target", "visual", "color", "id", "source", "status", "weaponIds", "projectileKinds", "tags", "reservedFields", "reservedFor", "implemented", "rareReservedFor"]);

function defFor(effect) {
  return EFFECT_DEFS[effect?.type] || { scope: effect?.scope || "projectile", hooks: effect?.hooks || [] };
}

export function effectScope(effect) {
  const explicit = effect?.scope;
  if (explicit) return explicit;
  return defFor(effect).scope || "projectile";
}

export function effectHooks(effect) {
  const raw = effect?.hooks || effect?.hook || defFor(effect).hooks || [];
  return Array.isArray(raw) ? raw : [raw];
}

export function cloneEffect(effect, extra = {}) {
  return { ...effect, ...extra };
}

function mergeMode(type, key) {
  const def = EFFECT_DEFS[type];
  return def?.merge?.[key] || "sum";
}

function clampFor(type, key, value) {
  const bounds = EFFECT_DEFS[type]?.clamp?.[key];
  if (!bounds) return value;
  return clamp(value, bounds[0], bounds[1]);
}

function betterNonNumeric(mode, current, value) {
  if (value === undefined) return current;
  if (current === undefined) return value;
  if (mode === "replace") return value;
  return current;
}

function mergeEffectInto(map, rawEffect) {
  if (!rawEffect || typeof rawEffect.type !== "string") return;
  const type = rawEffect.type;
  const def = EFFECT_DEFS[type] || {};
  const current = map.get(type) || { type, scope: effectScope(rawEffect), hooks: effectHooks(rawEffect) };

  for (const [key, value] of Object.entries(rawEffect)) {
    if (NON_STACK_FIELDS.has(key)) {
      current[key] = betterNonNumeric("first", current[key], value);
      continue;
    }

    const mode = mergeMode(type, key);
    if (!Number.isFinite(value)) {
      current[key] = betterNonNumeric(mode, current[key], value);
      continue;
    }

    const prev = numberOr(current[key], mode === "min" ? Infinity : 0);
    if (mode === "max") current[key] = Math.max(numberOr(current[key], -Infinity), value);
    else if (mode === "min") current[key] = Math.min(prev, value);
    else if (mode === "mul") current[key] = numberOr(current[key], 1) * value;
    else if (mode === "replace") current[key] = value;
    else current[key] = prev + value;
    current[key] = clampFor(type, key, current[key]);
  }

  if (!current.scope) current.scope = def.scope || "projectile";
  if (!current.hooks || !current.hooks.length) current.hooks = def.hooks || [];
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

function stackEffect(rawEffect, stacks, source) {
  const effect = cloneEffect(rawEffect, { source });
  const type = effect.type;
  const def = EFFECT_DEFS[type] || {};
  for (const [key, value] of Object.entries(effect)) {
    if (NON_STACK_FIELDS.has(key) || !Number.isFinite(value)) continue;
    const mode = def.merge?.[key] || "sum";
    if (mode === "sum" || mode === "sumClamp") effect[key] = value * stacks;
  }
  return effect;
}

export function playerUpgradeEffects(player, scope = null) {
  const taken = player?.upgrades?.taken || {};
  const out = [];

  for (const [upgradeId, rawStacks] of Object.entries(taken)) {
    const stacks = Math.max(0, Math.floor(rawStacks || 0));
    if (!stacks) continue;

    const upgrade = getUpgrade(upgradeId);
    if (!upgrade || !Array.isArray(upgrade.effects)) continue;

    for (const effect of upgrade.effects) {
      if (scope && effectScope(effect) !== scope) continue;
      out.push(stackEffect(effect, stacks, upgradeId));
    }
  }

  // v37 synergy effects are derived data. They merge through the same effect
  // pipeline as normal upgrades, so future weird builds do not need direct
  // combat/companion conditionals.
  out.push(...synergyEffectsForPlayer(player, scope));
  return out;
}

function effectAppliesToWeapon(effect, weapon, weaponId = null) {
  if (!effect) return false;
  if (Array.isArray(effect.weaponIds) && effect.weaponIds.length && !effect.weaponIds.includes(weaponId)) return false;
  if (Array.isArray(effect.projectileKinds) && effect.projectileKinds.length && !effect.projectileKinds.includes(weapon?.projectile)) return false;
  return true;
}

export function buildProjectileEffects(player, weapon, weaponId = null) {
  const upgradeEffects = playerUpgradeEffects(player, "projectile")
    .filter((effect) => effectAppliesToWeapon(effect, weapon, weaponId));
  return mergeEffects(weapon?.effects || [], upgradeEffects);
}

export function buildPlayerEffects(player) {
  return mergeEffects(playerUpgradeEffects(player, "player"));
}

export function attachRuntimeEffects(entity, effects = []) {
  entity.effects = mergeEffects(effects);
  return entity;
}

export function getEffects(entity, type = null) {
  if (!entity || !Array.isArray(entity.effects)) return [];
  return type ? entity.effects.filter((effect) => effect.type === type) : entity.effects;
}

export function getEffect(entity, type) {
  return getEffects(entity, type)[0] || null;
}

export function hasEffect(entity, type) {
  return !!getEffect(entity, type);
}

export function effectsForHook(entity, hook) {
  return getEffects(entity).filter((effect) => effectHooks(effect).includes(hook));
}

export function createEffectContext(base = {}) {
  const ctx = {
    state: null,
    sourcePlayer: null,
    sourceId: null,
    weaponId: null,
    projectile: null,
    enemy: null,
    target: null,
    damage: 0,
    critical: false,
    hit: null,
    position: null,
    normal: null,
    tags: [],
    rng: null,
    commands: [],
    ...base
  };
  if (!Array.isArray(ctx.tags)) ctx.tags = ctx.tags ? [ctx.tags] : [];
  if (!Array.isArray(ctx.commands)) ctx.commands = [];
  ctx.queue = (command) => queueEffectCommand(ctx, command);
  return ctx;
}

export function queueEffectCommand(ctx, command) {
  if (!ctx || !command || typeof command.type !== "string") return null;
  const queued = { ...command };
  ctx.commands.push(queued);
  return queued;
}

export function runEffectHook(entity, hook, context = {}, handlers = {}) {
  const ctx = context.commands ? context : createEffectContext(context);
  for (const effect of effectsForHook(entity, hook)) {
    const handler = handlers[effect.type] || handlers["*"];
    if (!handler) continue;
    const result = handler(effect, ctx);
    if (Array.isArray(result)) {
      for (const command of result) queueEffectCommand(ctx, command);
    } else if (result && typeof result.type === "string") {
      queueEffectCommand(ctx, result);
    }
  }
  return ctx;
}

export function effectCommand(type, data = {}) {
  return { type, ...data };
}
