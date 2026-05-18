import { WORLD } from "../core/constants.js";
import { dist2, norm } from "../core/math.js";
import { getUpgrade } from "../data/upgrades.js";

export const EFFECT_HOOKS = Object.freeze({
  PROJECTILE_UPDATE: "projectile:update",
  PROJECTILE_DAMAGE: "projectile:damage",
  PROJECTILE_HIT: "projectile:hit",
  PROJECTILE_KILL: "projectile:kill",
  PROJECTILE_EXPIRE: "projectile:expire",
  PROJECTILE_WALL: "projectile:wall",
  ENEMY_STATUS_TICK: "enemy:statusTick",
  PLAYER_TICK: "player:tick",
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
  splitRockets: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_EXPIRE], merge: { count: "sum", damage: "sum", speed: "max" } },
  clusterBomb: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_EXPIRE], merge: { count: "sum", radius: "max", damage: "sum" } },

  // Player/world systems. Some are scaffolding now; callers can ask the same API later.
  shield: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { charges: "sum", cooldown: "min" } },
  magnet: { scope: "player", hooks: [EFFECT_HOOKS.LOOT_ATTRACT], merge: { radius: "sum", force: "sum" } },
  luck: { scope: "player", hooks: [EFFECT_HOOKS.LOOT_ROLL], merge: { dropChance: "sumClamp", rare: "sumClamp" }, clamp: { dropChance: [0, 0.85], rare: [0, 1] } },
  teleportDash: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { distance: "max", cooldown: "min" } },
  afterimage: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { duration: "max", count: "sum" } },
  orbital: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { count: "sum", damage: "sum", radius: "max" } },
  drone: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { count: "sum", damage: "sum", fireRate: "sum" } },
  homingCore: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_UPDATE], merge: { strength: "sum", acquireRange: "max" } },

  // Visual-only data hooks are intentionally harmless.
  spark: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT], merge: { count: "sum" } },
  hitShake: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT], merge: { power: "max", life: "max" } },
  screenShake: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_EXPIRE], merge: { power: "max" } }
});

const NON_STACK_FIELDS = new Set(["type", "scope", "hooks", "hook", "trigger", "target", "visual", "color", "id", "source", "status", "weaponIds", "projectileKinds", "tags"]);

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

export function ownerPlayer(state, source) {
  const id = typeof source === "string" ? source : source?.ownerId;
  return id ? state?.players?.[id] || null : null;
}

export function sourceId(source) {
  return typeof source === "string" ? source : source?.ownerId || source?.id || null;
}

export function resolveProjectileDamage(state, projectile, baseDamage, enemy = null) {
  let amount = Math.max(0, numberOr(baseDamage, 0));
  const owner = ownerPlayer(state, projectile);

  const berserk = getEffect(projectile, "berserk");
  if (berserk && owner) {
    const hpRatio = owner.hp / Math.max(1, owner.maxHp || owner.hp || 1);
    if (hpRatio <= numberOr(berserk.threshold, 0.35)) amount *= 1 + numberOr(berserk.damage, 0);
  }

  const aura = getEffect(projectile, "teamAura");
  if (aura && owner) {
    const radius = numberOr(aura.radius, 180);
    let nearby = 0;
    for (const player of Object.values(state.players || {})) {
      if (player.id === owner.id || player.hp <= 0) continue;
      if (dist2(owner.x, owner.y, player.x, player.y) <= radius * radius) nearby += 1;
    }
    if (nearby > 0) amount *= 1 + numberOr(aura.damage, 0) * nearby;
  }

  const crit = getEffect(projectile, "crit");
  let critical = false;
  if (crit) {
    const chance = clamp(numberOr(crit.chance, 0), 0, 0.85);
    const multiplier = Math.max(1, numberOr(crit.multiplier, 2));
    if (chance > 0 && state?.rng?.next && state.rng.next() < chance) {
      amount *= multiplier;
      critical = true;
    }
  }

  return {
    amount: Math.max(1, Math.round(amount)),
    critical,
    enemyId: enemy?.id || null
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

export function applyProjectileStatuses(projectile, enemy) {
  const applied = [];
  for (const type of ["burn", "poison", "freeze"]) {
    const effect = getEffect(projectile, type);
    if (effect) {
      const status = applyStatus(enemy, type, effect, projectile);
      applied.push({ type, status, effect });
    }
  }
  return applied;
}

function tickStatus(enemy, type, dt, fallbackDps = 0) {
  const status = enemy.status?.[type];
  if (!status || status.t <= 0) return { damage: 0, active: false, sourceId: null };
  status.t -= dt;
  status.tick = (status.tick || 0) + dt;
  const damage = Math.max(0, numberOr(status.dps, fallbackDps)) * dt;
  const active = status.t > 0;
  const sid = status.sourceId || null;
  if (status.t <= 0) delete enemy.status[type];
  return { damage, active: true, sourceId: sid };
}

export function tickEnemyStatuses(enemy, dt) {
  if (!enemy?.status) return { damage: 0, active: false, slowMult: 1, sources: [] };

  let damage = 0;
  let active = false;
  const sources = [];
  const burn = tickStatus(enemy, "burn", dt);
  const poison = tickStatus(enemy, "poison", dt);
  const freeze = enemy.status.freeze;

  for (const tick of [burn, poison]) {
    if (!tick.active && tick.damage <= 0) continue;
    damage += tick.damage;
    active = true;
    if (tick.sourceId) sources.push(tick.sourceId);
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
  return { damage, active, slowMult: Math.max(0.15, 1 - slow), sources: [...new Set(sources)] };
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

export function healProjectileOwner(state, projectile, damageDone) {
  const lifesteal = getEffect(projectile, "lifesteal");
  if (!lifesteal || damageDone <= 0) return 0;
  const owner = ownerPlayer(state, projectile);
  if (!owner || owner.hp <= 0) return 0;
  const heal = damageDone * clamp(numberOr(lifesteal.percent, 0), 0, 0.5);
  owner.hp = Math.min(owner.maxHp || owner.hp, owner.hp + heal);
  return heal;
}

export function playerEffectValue(player, type, key, fallback = 0) {
  const effect = getEffect({ effects: buildPlayerEffects(player) }, type);
  return effect ? numberOr(effect[key], fallback) : fallback;
}

export function applyShieldDamage(player, damage) {
  const shield = getEffect({ effects: buildPlayerEffects(player) }, "shield");
  if (!shield || damage <= 0) return damage;
  const chargesMax = Math.max(0, Math.floor(numberOr(shield.charges, 0)));
  if (!player.effectState) player.effectState = {};
  const state = player.effectState.shield || { charges: chargesMax, cooldownLeft: 0 };
  if (state.grace > 0) {
    player.effectState.shield = state;
    return 0;
  }
  if (state.charges > 0) {
    state.charges -= 1;
    state.cooldownLeft = numberOr(shield.cooldown, 8);
    state.grace = 0.35;
    player.effectState.shield = state;
    return 0;
  }
  player.effectState.shield = state;
  return damage;
}

export function tickPlayerEffects(player, dt) {
  player.effects = buildPlayerEffects(player);
  if (!player.effectState) player.effectState = {};

  const shield = getEffect(player, "shield");
  if (shield) {
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
}

export function attractLootToPlayer(player, item, dt) {
  const magnet = getEffect(player, "magnet");
  if (!magnet || player.hp <= 0) return;
  const radius = Math.max(0, numberOr(magnet.radius, 0));
  if (!radius) return;
  const d2 = dist2(player.x, player.y, item.x, item.y);
  if (d2 > radius * radius) return;
  const d = norm(player.x - item.x, player.y - item.y);
  const force = Math.max(40, numberOr(magnet.force, 420));
  const proximity = 1 - Math.min(1, Math.sqrt(d2) / radius);
  item.x = clamp(item.x + d.x * force * (0.25 + proximity) * dt, 8, WORLD.w - 8);
  item.y = clamp(item.y + d.y * force * (0.25 + proximity) * dt, 8, WORLD.h - 8);
}
