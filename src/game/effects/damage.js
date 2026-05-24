import { dist2, norm } from "../../core/math.js";
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
import { addShake, pushVisualEffect } from "../effectCommands.js";
import { ownerPlayer, sourceId } from "../sourceIds.js";

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

function playerDamageImpactPower(resolved, hit, player) {
  const maxHp = Math.max(1, player?.maxHp || player?.hp || 1);
  const done = Math.max(0, hit?.done || 0);
  const original = Math.max(0, resolved?.originalAmount || resolved?.amount || done);
  const hpRatioLoss = done / maxHp;
  const raw = Math.max(done, original) / Math.max(1, maxHp * 0.18);
  return clamp(Math.max(hpRatioLoss * 2.6, raw), 0.35, 2.35);
}

function emitPlayerDamageImpact(state, player, resolved, hit, spec = {}) {
  if (!state || !player || !hit || !(hit.done > 0)) return null;
  const power = playerDamageImpactPower(resolved, hit, player);
  const maxHp = Math.max(1, player.maxHp || 1);
  const hpAfter = Math.max(0, player.hp || 0);
  const hpRatio = hpAfter / maxHp;
  const sourceX = Number.isFinite(spec.sourceX) ? spec.sourceX : (Number.isFinite(spec.x) ? spec.x : null);
  const sourceY = Number.isFinite(spec.sourceY) ? spec.sourceY : (Number.isFinite(spec.y) ? spec.y : null);
  const dir = Number.isFinite(sourceX) && Number.isFinite(sourceY)
    ? norm(player.x - sourceX, player.y - sourceY)
    : { x: 0, y: -1 };
  const seq = (player.damageImpactSeq || 0) + 1;
  player.damageImpactSeq = seq;
  player.lastDamageImpact = {
    seq,
    t: Number((state.time || 0).toFixed(3)),
    amount: Math.round(hit.done),
    originalAmount: Math.round(resolved.originalAmount || resolved.amount || hit.done),
    hpAfter: Math.round(hpAfter),
    maxHp,
    sourceType: resolved.sourceType || spec.sourceType || null,
    enemyId: resolved.enemyId || spec.enemyId || null,
    power: Number(power.toFixed(3)),
    lowHp: hpRatio <= 0.35,
    dirX: Number((dir.x || 0).toFixed(3)),
    dirY: Number((dir.y || -1).toFixed(3))
  };

  const life = Math.max(0.14, Math.min(0.32, 0.13 + power * 0.065));
  pushVisualEffect(state, {
    type: "playerHit",
    targetId: player.id,
    x: Math.round(player.x),
    y: Math.round(player.y),
    r: Math.round((player.radius || 13) + 15 + power * 8),
    power,
    amount: Math.round(hit.done),
    dirX: player.lastDamageImpact.dirX,
    dirY: player.lastDamageImpact.dirY,
    color: "#ff3048",
    life,
    maxLife: life
  });
  pushVisualEffect(state, {
    type: "playerDamageImpact",
    targetId: player.id,
    power,
    amount: Math.round(hit.done),
    hpRatio: Number(hpRatio.toFixed(3)),
    dirX: player.lastDamageImpact.dirX,
    dirY: player.lastDamageImpact.dirY,
    sourceType: player.lastDamageImpact.sourceType,
    life: Math.max(0.16, Math.min(0.42, 0.18 + power * 0.08)),
    maxLife: Math.max(0.16, Math.min(0.42, 0.18 + power * 0.08))
  });
  addShake(state, 1.6 + power * 2.25, Math.max(0.08, Math.min(0.18, 0.08 + power * 0.04)), `player-hit:${player.id}`);
  return player.lastDamageImpact;
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
  if (!resolved.blocked && hit.done > 0) emitPlayerDamageImpact(state, player, resolved, hit, spec);
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


export function resolveEnemyHeal(_state, enemy, spec = {}) {
  const baseAmount = Math.max(0, numberOr(spec.amount, 0));
  const maxHp = Math.max(1, enemy?.maxHp || enemy?.hp || 1);
  const before = Math.max(0, enemy?.hp || 0);
  return {
    amount: baseAmount,
    originalAmount: baseAmount,
    maxHp,
    before,
    sourceId: spec.sourceId || null,
    sourceType: spec.sourceType || null,
    tags: Array.isArray(spec.tags) ? spec.tags : []
  };
}

export function healEnemy(state, enemy, spec = {}) {
  // ARCHITECTURE GUARD: enemy recovery must go through this function.
  // Support enemies such as LCH should not write `ally.hp = ...` directly;
  // future anti-heal, overheal, reward/proc hooks and heal events attach here.
  if (!enemy || enemy.hp <= 0 || !(spec.amount > 0)) {
    return { amount: 0, done: 0, sourceId: spec.sourceId || null, tags: spec.tags || [] };
  }
  const resolved = resolveEnemyHeal(state, enemy, spec);
  const after = clamp(resolved.before + resolved.amount, 0, resolved.maxHp);
  enemy.hp = after;
  const done = Math.max(0, after - resolved.before);
  if (done > 0 && spec.emitEffect !== false) {
    pushVisualEffect(state, {
      type: "statusTick",
      x: Math.round(enemy.x || 0),
      y: Math.round(enemy.y || 0),
      r: Math.max(14, Math.round((enemy.radius || 12) + 8)),
      color: spec.color || "#00ff66",
      life: 0.08,
      maxLife: 0.08
    });
  }
  return {
    ...resolved,
    done,
    hp: after
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
