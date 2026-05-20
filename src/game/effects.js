import { WORLD } from "../core/constants.js";
import { dist2, norm } from "../core/math.js";
import { getUpgrade } from "../data/upgrades.js";
import { synergyEffectsForPlayer } from "../data/synergies.js";
import { ROOM_MODIFIER_HOOKS, runRoomModifierHooks } from "./roomModifiers.js";

export const EFFECT_HOOKS = Object.freeze({
  PROJECTILE_UPDATE: "projectile:update",
  PROJECTILE_DAMAGE: "projectile:damage",
  PROJECTILE_HIT: "projectile:hit",
  PROJECTILE_KILL: "projectile:kill",
  PROJECTILE_EXPIRE: "projectile:expire",
  PROJECTILE_WALL: "projectile:wall",
  ENEMY_STATUS_TICK: "enemy:statusTick",
  PLAYER_TICK: "player:tick",
  PLAYER_DAMAGE: "player:damage",
  PLAYER_HEAL: "player:heal",
  PLAYER_HIT: "player:hit",
  LOOT_ROLL: "loot:roll",
  LOOT_ATTRACT: "loot:attract"
});

export const EFFECT_DEFS = Object.freeze({
  // Weapon / projectile movement.
  homing: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_UPDATE], merge: { strength: "sum", acquireRange: "max" } },

  // Hit resolution.
  crit: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_DAMAGE], merge: { chance: "sumClamp", multiplier: "max" }, clamp: { chance: [0, 0.85] }, tags: ["damage", "hit"] },
  pierce: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT], merge: { count: "sum" }, tags: ["projectile", "hit"] },
  ricochet: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_WALL], merge: { count: "sum" }, tags: ["projectile", "wall"] },
  lifesteal: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_DAMAGE], merge: { percent: "sumClamp" }, clamp: { percent: [0, 0.5] } },
  berserk: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_DAMAGE], merge: { damage: "sum", threshold: "min" } },
  teamAura: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_DAMAGE], merge: { damage: "sum", radius: "max" } },

  // Status effects. Statuses are host-authoritative: hit applies a timed status,
  // ENEMY_STATUS_TICK resolves real damage/slow, snapshot only mirrors state.
  burn: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT, EFFECT_HOOKS.ENEMY_STATUS_TICK], status: true, merge: { dps: "sum", duration: "max" }, tags: ["status", "damage", "fire"] },
  poison: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT, EFFECT_HOOKS.ENEMY_STATUS_TICK], status: true, merge: { dps: "sum", duration: "max", slow: "max" }, tags: ["status", "damage", "slow"] },
  freeze: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT, EFFECT_HOOKS.ENEMY_STATUS_TICK], status: true, merge: { slow: "max", duration: "max" }, tags: ["status", "slow", "control"] },

  // Projectile fan-out / area mechanics.
  explode: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT, EFFECT_HOOKS.PROJECTILE_EXPIRE], merge: { radius: "max", damage: "sum", force: "sum" } },
  chainLightning: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT], merge: { jumps: "sum", damage: "sum", range: "max", falloff: "max" }, tags: ["projectile", "chain", "damage"] },
  chainStatus: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT], merge: { statusScale: "max" }, tags: ["synergy", "chain", "status"] },
  splitRockets: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_EXPIRE], merge: { count: "sum", damage: "sum", speed: "max" } },
  clusterBomb: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_EXPIRE], merge: { count: "sum", radius: "max", damage: "sum" } },

  // Player/world systems. These run through the same hook dispatcher as projectile effects.
  // ARCHITECTURE GUARD: do not add direct player/loot gameplay mutations in callers;
  // add a hook + handler here, then route through runPlayerHook()/runLootHook().
  shield: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK, EFFECT_HOOKS.PLAYER_DAMAGE], merge: { charges: "sum", cooldown: "min" } },
  magnet: { scope: "player", hooks: [EFFECT_HOOKS.LOOT_ATTRACT], merge: { radius: "sum", force: "sum" } },
  luck: { scope: "player", hooks: [EFFECT_HOOKS.LOOT_ROLL], merge: { dropChance: "sumClamp", rare: "sumClamp" }, clamp: { dropChance: [0, 0.85], rare: [0, 1] }, reservedFields: { rare: "future loot value / rarity weighting" } },
  teleportDash: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK, EFFECT_HOOKS.PLAYER_DAMAGE], merge: { distance: "max", cooldown: "min", invuln: "max" } },
  afterimage: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { duration: "max", count: "sum" } },
  orbital: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { count: "sum", damage: "sum", radius: "max", orbitSpeed: "max", hitCooldown: "min" }, tags: ["companion", "contact"] },
  drone: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { count: "sum", damage: "sum", radius: "max", range: "max", fireRate: "sum", orbitSpeed: "max" }, tags: ["companion", "auto-shooter"] },
  companionBoost: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { damageMult: "sum", hitCooldownMult: "sum", rangeMult: "sum" }, tags: ["synergy", "companion"] },
  homingCore: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_UPDATE], merge: { strength: "sum", acquireRange: "max" } },

  // Visual-only data hooks are intentionally harmless.
  spark: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT], merge: { count: "sum" } },
  hitShake: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT], merge: { power: "max", life: "max" } },
  screenShake: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_EXPIRE], merge: { power: "max" } }
});

const NON_STACK_FIELDS = new Set(["type", "scope", "hooks", "hook", "trigger", "target", "visual", "color", "id", "source", "status", "weaponIds", "projectileKinds", "tags", "reservedFields", "reservedFor", "implemented", "rareReservedFor"]);

function numberOr(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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

export const DAMAGE_TAGS = Object.freeze({
  DIRECT: "direct",
  PROJECTILE: "projectile",
  EXPLOSION: "explosion",
  CHAIN: "chain",
  STATUS: "status",
  PLAYER: "player",
  ENEMY: "enemy",
  TOUCH: "touch",
  BURN: "burn",
  POISON: "poison",
  FREEZE: "freeze",
  COMPANION: "companion",
  HEAL: "heal"
});

export function dealDamage(_state, target, spec = {}) {
  if (!target || !Number.isFinite(spec.amount)) {
    return { amount: 0, done: 0, killed: false, sourceId: spec.sourceId || null, tags: spec.tags || [] };
  }
  const amount = Math.max(0, spec.amount);
  const before = Math.max(0, target.hp || 0);
  target.hp -= amount;
  const done = Math.min(before, amount);
  return {
    amount,
    done,
    killed: target.hp <= 0,
    sourceId: spec.sourceId || null,
    weaponId: spec.weaponId || null,
    projectileId: spec.projectileId || null,
    tags: Array.isArray(spec.tags) ? spec.tags : []
  };
}

export function ownerPlayer(state, source) {
  const id = typeof source === "string" ? source : source?.ownerId;
  return id ? state?.players?.[id] || null : null;
}

export function sourceId(source) {
  return typeof source === "string" ? source : source?.ownerId || source?.id || null;
}

export function resolveProjectileDamage(state, projectile, baseDamage, enemy = null, tags = []) {
  const owner = ownerPlayer(state, projectile);
  const ctx = createEffectContext({
    state,
    sourcePlayer: owner,
    sourceId: sourceId(projectile),
    weaponId: projectile?.weaponId || null,
    projectile,
    enemy,
    target: enemy,
    damage: Math.max(0, numberOr(baseDamage, 0)),
    critical: false,
    tags,
    rng: state?.rng || null
  });

  runEffectHook(projectile, EFFECT_HOOKS.PROJECTILE_DAMAGE, ctx, {
    berserk(effect, c) {
      if (!c.sourcePlayer) return;
      const hpRatio = c.sourcePlayer.hp / Math.max(1, c.sourcePlayer.maxHp || c.sourcePlayer.hp || 1);
      if (hpRatio <= numberOr(effect.threshold, 0.35)) c.damage *= 1 + numberOr(effect.damage, 0);
    },
    teamAura(effect, c) {
      if (!c.sourcePlayer) return;
      const radius = numberOr(effect.radius, 180);
      let nearby = 0;
      for (const player of Object.values(c.state?.players || {})) {
        if (player.id === c.sourcePlayer.id || player.hp <= 0) continue;
        if (dist2(c.sourcePlayer.x, c.sourcePlayer.y, player.x, player.y) <= radius * radius) nearby += 1;
      }
      if (nearby > 0) c.damage *= 1 + numberOr(effect.damage, 0) * nearby;
    },
    crit(effect, c) {
      const chance = clamp(numberOr(effect.chance, 0), 0, 0.85);
      const multiplier = Math.max(1, numberOr(effect.multiplier, 2));
      if (chance > 0 && c.rng?.next && c.rng.next() < chance) {
        c.damage *= multiplier;
        c.critical = true;
      }
    }
  });

  const roomCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.PROJECTILE_DAMAGE, ctx);

  return {
    amount: Math.max(1, Math.round(roomCtx.damage)),
    critical: !!roomCtx.critical,
    enemyId: enemy?.id || null,
    tags: roomCtx.tags
  };
}

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

export function healProjectileOwner(state, projectile, damageDone, tags = []) {
  const lifesteal = getEffect(projectile, "lifesteal");
  if (!lifesteal || damageDone <= 0) return 0;
  const safeTags = Array.isArray(tags) ? tags : [];
  const canSteal = safeTags.some((tag) => [DAMAGE_TAGS.DIRECT, DAMAGE_TAGS.EXPLOSION, DAMAGE_TAGS.CHAIN].includes(tag)) && !safeTags.includes(DAMAGE_TAGS.STATUS);
  if (!canSteal) return 0;
  const owner = ownerPlayer(state, projectile);
  if (!owner || owner.hp <= 0) return 0;
  const heal = damageDone * clamp(numberOr(lifesteal.percent, 0), 0, 0.5);
  return healPlayer(state, owner, {
    amount: heal,
    sourceId: projectile.ownerId,
    sourceType: "lifesteal",
    tags: [DAMAGE_TAGS.HEAL, "lifesteal"]
  }).done;
}

export function ensurePlayerEffects(player) {
  if (!player) return [];
  player.effects = buildPlayerEffects(player);
  if (!player.effectState) player.effectState = {};
  return player.effects;
}

export function runPlayerHook(state, player, hook, context = {}, handlers = {}) {
  ensurePlayerEffects(player);
  const ctx = createEffectContext({
    state,
    player,
    sourcePlayer: player,
    sourceId: player?.id || null,
    target: player,
    rng: state?.rng || null,
    ...context
  });
  runEffectHook(player, hook, ctx, handlers);
  return ctx;
}

export function runLootHook(state, player, item, hook, context = {}, handlers = {}) {
  ensurePlayerEffects(player);
  const ctx = createEffectContext({
    state,
    player,
    item,
    sourcePlayer: player,
    sourceId: player?.id || null,
    target: item,
    rng: state?.rng || null,
    ...context
  });
  runEffectHook(player, hook, ctx, handlers);
  return ctx;
}

export function playerEffectValue(player, type, key, fallback = 0) {
  // Read-only helper for UI/tests/introspection. Runtime gameplay should prefer
  // hook resolvers such as resolveLootRoll(), resolvePlayerDamage(), etc.
  const effect = getEffect({ effects: buildPlayerEffects(player) }, type);
  return effect ? numberOr(effect[key], fallback) : fallback;
}

function blockPlayerDamage(ctx, reason) {
  ctx.blocked = true;
  ctx.blockedBy = reason;
  ctx.damage = 0;
  return ctx;
}

function tickShieldState(player, shield, dt) {
  const max = Math.max(0, Math.floor(numberOr(shield.charges, 0)));
  const state = player.effectState.shield || { charges: max, cooldownLeft: 0 };
  state.charges = Math.min(max, state.charges ?? max);
  state.grace = Math.max(0, (state.grace || 0) - dt);
  if (state.charges < max) {
    state.cooldownLeft = Math.max(0, (state.cooldownLeft || 0) - dt);
    if (state.cooldownLeft <= 0) {
      state.charges += 1;
      state.cooldownLeft = state.charges < max ? numberOr(shield.cooldown, 8) : 0;
    }
  }
  player.effectState.shield = state;
}

function absorbWithShield(ctx, effect) {
  if (!ctx.player || !(ctx.damage > 0)) return;
  const chargesMax = Math.max(0, Math.floor(numberOr(effect.charges, 0)));
  const state = ctx.player.effectState.shield || { charges: chargesMax, cooldownLeft: 0 };
  state.charges = Math.min(chargesMax, state.charges ?? chargesMax);
  if (state.grace > 0) {
    ctx.player.effectState.shield = state;
    blockPlayerDamage(ctx, "shield-grace");
    return;
  }
  if (state.charges > 0) {
    state.charges -= 1;
    state.cooldownLeft = numberOr(effect.cooldown, 8);
    state.grace = 0.35;
    ctx.player.effectState.shield = state;
    blockPlayerDamage(ctx, "shield");
    return;
  }
  ctx.player.effectState.shield = state;
}

export function resolvePlayerDamage(state, player, spec = {}) {
  const baseAmount = Math.max(0, numberOr(spec.amount, 0));
  const tags = Array.isArray(spec.tags) ? [...spec.tags] : [];
  if (!tags.includes(DAMAGE_TAGS.PLAYER)) tags.push(DAMAGE_TAGS.PLAYER);

  const ctx = runPlayerHook(state, player, EFFECT_HOOKS.PLAYER_DAMAGE, {
    damage: baseAmount,
    originalDamage: baseAmount,
    tags,
    sourceId: spec.sourceId || null,
    sourceType: spec.sourceType || null,
    enemyId: spec.enemyId || null,
    blocked: false,
    blockedBy: null
  }, {
    teleportDash(_effect, c) {
      if ((c.player?.effectState?.dash?.invulnLeft || 0) > 0) blockPlayerDamage(c, "dash-invuln");
    },
    shield(effect, c) {
      absorbWithShield(c, effect);
    }
  });

  const roomCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.PLAYER_DAMAGE, ctx);

  return {
    amount: Math.max(0, roomCtx.damage || 0),
    originalAmount: baseAmount,
    blocked: !!roomCtx.blocked,
    blockedBy: roomCtx.blockedBy || null,
    reducedBy: Math.max(0, baseAmount - Math.max(0, roomCtx.damage || 0)),
    sourceId: spec.sourceId || null,
    sourceType: spec.sourceType || null,
    enemyId: spec.enemyId || null,
    tags: roomCtx.tags
  };
}

export function dealPlayerDamage(state, player, spec = {}) {
  // ARCHITECTURE GUARD: every damage source that targets a player must go
  // through this function. Do not write `player.hp -= ...` in gameplay systems.
  // Add/modify player mitigation through PLAYER_DAMAGE hook handlers instead.
  const resolved = resolvePlayerDamage(state, player, spec);
  const hit = dealDamage(state, player, {
    amount: resolved.amount,
    sourceId: resolved.sourceId,
    tags: resolved.tags
  });
  return { ...hit, ...resolved, done: hit.done, killed: hit.killed };
}

export function resolvePlayerHeal(state, player, spec = {}) {
  const baseAmount = Math.max(0, numberOr(spec.amount, 0));
  const tags = Array.isArray(spec.tags) ? [...spec.tags] : [];
  if (!tags.includes(DAMAGE_TAGS.HEAL)) tags.push(DAMAGE_TAGS.HEAL);

  const ctx = runPlayerHook(state, player, EFFECT_HOOKS.PLAYER_HEAL, {
    amount: baseAmount,
    originalAmount: baseAmount,
    tags,
    sourceId: spec.sourceId || null,
    sourceType: spec.sourceType || null,
    allowRevive: !!spec.allowRevive,
    minHp: Number.isFinite(spec.minHp) ? spec.minHp : 0
  }, spec.handlers || {});

  const roomCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.PLAYER_HEAL, ctx);

  return {
    amount: Math.max(0, roomCtx.amount || 0),
    originalAmount: baseAmount,
    sourceId: spec.sourceId || null,
    sourceType: spec.sourceType || null,
    allowRevive: !!roomCtx.allowRevive,
    minHp: Math.max(0, roomCtx.minHp || 0),
    tags: roomCtx.tags
  };
}

export function healPlayer(state, player, spec = {}) {
  // ARCHITECTURE GUARD: every gameplay heal must go through this function.
  // Do not write `player.hp += ...` / `Math.min(maxHp, hp + ...)` in systems.
  // Future overheal, anti-heal, team-heal and healing aura rules attach to PLAYER_HEAL.
  if (!player || !(spec.amount > 0)) return { amount: 0, done: 0, sourceId: spec.sourceId || null, tags: spec.tags || [] };
  const resolved = resolvePlayerHeal(state, player, spec);
  const maxHp = Math.max(1, player.maxHp || player.hp || 1);
  const before = Math.max(0, player.hp || 0);
  if (before <= 0 && !resolved.allowRevive) {
    return { ...resolved, done: 0, amount: resolved.amount, blocked: true, blockedBy: "dead" };
  }
  const base = Math.max(before, resolved.minHp || 0);
  const after = clamp(base + resolved.amount, 0, maxHp);
  player.hp = after;
  return {
    ...resolved,
    done: Math.max(0, after - before),
    hp: after,
    maxHp
  };
}

export function applyShieldDamage(player, damage) {
  // Deprecated compatibility wrapper for older tests/imports. Runtime code must
  // call dealPlayerDamage() so source/tags/hooks stay visible and extensible.
  return resolvePlayerDamage(null, player, {
    amount: damage,
    sourceType: "legacy-shield-wrapper",
    tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH]
  }).amount;
}

export function tickPlayerEffects(player, dt, state = null) {
  runPlayerHook(state, player, EFFECT_HOOKS.PLAYER_TICK, { dt }, {
    shield(effect, c) {
      tickShieldState(c.player, effect, c.dt || 0);
    }
  });
}

export function resolveLootRoll(state, player, spec = {}) {
  const baseChance = Math.max(0, numberOr(spec.chance, 0));
  const ctx = runLootHook(state, player, null, EFFECT_HOOKS.LOOT_ROLL, {
    chance: baseChance,
    baseChance,
    rareBonus: 0,
    tags: ["loot", "roll"]
  }, {
    luck(effect, c) {
      c.chance += numberOr(effect.dropChance, 0);
      // Reserved by design: tracked for future loot value / rarity weighting,
      // but v36 still uses the existing weightedLoot table unchanged.
      c.rareBonus += numberOr(effect.rare, 0);
    }
  });

  const roomCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.LOOT_ROLL, ctx);

  return {
    chance: clamp(roomCtx.chance, 0, 1),
    baseChance,
    rareBonus: clamp(roomCtx.rareBonus || 0, 0, 1),
    tags: roomCtx.tags
  };
}

export function attractLootToPlayer(player, item, dt, state = null) {
  if (!player || !item || player.hp <= 0) return null;

  const ctx = runLootHook(state, player, item, EFFECT_HOOKS.LOOT_ATTRACT, {
    dt,
    radius: 0,
    force: 0
  }, {
    magnet(effect, c) {
      c.radius += numberOr(effect.radius, 0);
      c.force += numberOr(effect.force, 0);
    }
  });

  const radius = Math.max(0, ctx.radius || 0);
  if (!radius) return ctx;
  const d2 = dist2(player.x, player.y, item.x, item.y);
  if (d2 > radius * radius) return ctx;
  const d = norm(player.x - item.x, player.y - item.y);
  const force = Math.max(40, ctx.force || 420);
  const proximity = 1 - Math.min(1, Math.sqrt(d2) / radius);
  item.x = clamp(item.x + d.x * force * (0.25 + proximity) * dt, 8, WORLD.w - 8);
  item.y = clamp(item.y + d.y * force * (0.25 + proximity) * dt, 8, WORLD.h - 8);
  ctx.moved = true;
  return ctx;
}
