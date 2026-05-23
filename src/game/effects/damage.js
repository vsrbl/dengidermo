import { dist2 } from "../../core/math.js";
import { ROOM_MODIFIER_HOOKS, runRoomModifierHooks } from "../roomModifiers.js";
import { applyArmorDamage, shouldArmorAbsorb } from "../enemyArmor.js";
import { canDamageSourceLifesteal } from "../damageSourceMatrix.js";
import {
  EFFECT_HOOKS,
  DAMAGE_TAGS,
  numberOr,
  clamp
} from "./defs.js";
import {
  buildPlayerEffects,
  createEffectContext,
  getEffect,
  runEffectHook
} from "./core.js";

export function dealDamage(state, target, spec = {}) {
  if (!target || !Number.isFinite(spec.amount)) {
    return { amount: 0, done: 0, killed: false, sourceId: spec.sourceId || null, tags: spec.tags || [] };
  }
  const amount = Math.max(0, spec.amount);
  if (shouldArmorAbsorb(target, spec)) {
    return { amount, ...applyArmorDamage(state, target, amount, spec) };
  }
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

export function healProjectileOwner(state, projectile, damageDone, tags = []) {
  const lifesteal = getEffect(projectile, "lifesteal");
  if (!lifesteal || damageDone <= 0) return 0;
  if (!canDamageSourceLifesteal(tags)) return 0;
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
