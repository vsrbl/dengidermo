import { GREEN } from "../core/constants.js";
import { norm } from "../core/math.js";
import { START_WEAPON, WEAPONS } from "../data/weapons.js";
import { ENEMIES } from "../data/enemies.js";
import {
  EFFECT_HOOKS,
  effectCommand,
  getEffect,
  healProjectileOwner,
  resolveProjectileDamage,
  dealDamage
} from "./effects.js";
import { PROJECTILE_DAMAGE_SOURCES, projectileDamageTags } from "./damageSourceMatrix.js";
import { addSpark, pushVisualEffect } from "./effectCommands.js";
import { finishEnemyKill } from "./enemyDeath.js";
import { pushEvent } from "./events.js";
import { ricochetProjectileFromArmor } from "./enemyArmor.js";

function tryEnemyProjectileDefense(state, projectile, enemy) {
  const data = ENEMIES[enemy?.kind] || null;
  const defense = data?.projectileDefense;
  if (!defense || defense.type !== "front_deflect") return false;
  const now = state.time || 0;
  if ((enemy.projectileDefenseCooldownUntil || 0) > now) return false;
  const facing = enemy.prismState || {};
  const fx = Number.isFinite(facing.facingX) ? facing.facingX : 1;
  const fy = Number.isFinite(facing.facingY) ? facing.facingY : 0;
  const v = norm(projectile.vx || 1, projectile.vy || 0);
  const dot = v.x * fx + v.y * fy;
  if (dot > (defense.arcDot ?? -0.25)) return false;
  if (!projectile.hitIds) projectile.hitIds = {};
  projectile.hitIds[enemy.id] = true;
  const reflectedVx = projectile.vx - 2 * (projectile.vx * fx + projectile.vy * fy) * fx;
  const reflectedVy = projectile.vy - 2 * (projectile.vx * fx + projectile.vy * fy) * fy;
  projectile.vx = reflectedVx * 0.92;
  projectile.vy = reflectedVy * 0.92;
  projectile.targetId = null;
  enemy.projectileDefenseCooldownUntil = now + (defense.cooldown || 0.08);
  pushVisualEffect(state, {
    type: "ricochet",
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    vx: Math.round(projectile.vx),
    vy: Math.round(projectile.vy),
    color: "#ffffff",
    life: 0.14,
    maxLife: 0.14
  });
  pushEvent(state, { type: "enemy", action: "projectile_deflect", enemyId: enemy.id, enemyKind: enemy.kind, projectileId: projectile.id, x: enemy.x, y: enemy.y });
  return true;
}

function statusColor(type) {
  if (type === "freeze") return "#ffffff";
  if (type === "poison") return GREEN;
  return "#ff3048";
}

function addDamageText(state, x, y, amount, critical = false) {
  pushVisualEffect(state, {
    type: "damageText",
    x: Math.round(x),
    y: Math.round(y - (critical ? 18 : 12)),
    vy: critical ? -34 : -24,
    text: `${critical ? "!" : ""}${Math.max(1, Math.round(amount))}`,
    color: critical ? GREEN : "#ffffff",
    life: critical ? 0.42 : 0.3,
    maxLife: critical ? 0.42 : 0.3
  });
}

function addStatusBurst(state, x, y, applied) {
  for (const item of applied || []) {
    const color = statusColor(item.type);
    pushVisualEffect(state, {
      type: "statusBurst",
      status: item.type,
      x: Math.round(x),
      y: Math.round(y),
      r: item.type === "freeze" ? 34 : 26,
      color,
      life: 0.22,
      maxLife: 0.22
    });
    addSpark(state, x, y, item.type === "freeze" ? 3 : 2, item.type === "burn" ? 150 : 115, color);
  }
}

export function addImpulse(enemy, fromX, fromY, force) {
  const d = norm(enemy.x - fromX, enemy.y - fromY);
  enemy.kx = (enemy.kx || 0) + d.x * force;
  enemy.ky = (enemy.ky || 0) + d.y * force;
}

export function finishProjectileEnemyKill(state, enemy, source = null, hit = null, context = {}) {
  if (!state.enemies[enemy.id]) return;

  // v36: projectile on-kill hooks run before the shared enemy finalizer.
  // ARCHITECTURE GUARD: do not delete enemies directly here; finishEnemyKill()
  // owns drop/score/event cleanup so companions and future systems stay aligned.
  if (source && typeof source === "object" && context.runProjectileHook) {
    context.runProjectileHook(state, source, EFFECT_HOOKS.PROJECTILE_KILL, {
      enemy,
      target: enemy,
      hit,
      position: { x: enemy.x, y: enemy.y },
      tags: hit?.tags || []
    }, {
      spark(effect, c) {
        return effectCommand("spark", { x: c.position.x, y: c.position.y, amount: effect.count ?? 4, power: 145 });
      },
      hitShake(effect, c) {
        return effectCommand("shake", { power: effect.power || 2.5, life: effect.life || 0.12 });
      }
    });
  }

  finishEnemyKill(state, enemy, source, hit);
}

export function dealProjectileDamage(state, projectile, enemy, baseDamage, eventX = enemy.x, eventY = enemy.y, tags = projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT)) {
  const hit = resolveProjectileDamage(state, projectile, baseDamage, enemy, tags);
  const damage = dealDamage(state, enemy, {
    amount: hit.amount,
    sourceId: projectile.ownerId,
    weaponId: projectile.weaponId,
    projectileId: projectile.id,
    tags: hit.tags
  });
  healProjectileOwner(state, projectile, damage.done, hit.tags);
  pushEvent(state, {
    type: damage.armorHit ? "armorHit" : "hit",
    x: eventX,
    y: eventY,
    amount: damage.armorHit ? damage.armorDamage : hit.amount,
    crit: hit.critical,
    sourceId: projectile.ownerId,
    tags: hit.tags
  });
  addDamageText(state, eventX, eventY, damage.armorHit ? damage.armorDamage : hit.amount, hit.critical);
  if (hit.critical && !damage.armorHit) {
    addSpark(state, eventX, eventY, 5, 190);
    pushVisualEffect(state, { type: "critFlash", x: Math.round(eventX), y: Math.round(eventY), r: 30, life: 0.18, maxLife: 0.18, color: GREEN });
  }
  hit.damage = damage;
  return hit;
}

export function hitArmor(hit) {
  return !!hit?.damage?.armorHit;
}

export function runProjectileHitEffects(state, projectile, enemy, hit, position, options = {}, context = {}) {
  const handlers = {};

  if (options.hitShake !== false) {
    handlers.hitShake = (effect, c) => effectCommand("shake", {
      power: (effect.power || 2.5) * (c.hit?.critical ? 1.25 : 1),
      life: effect.life || 0.12
    });
  }

  if (options.spark !== false) {
    handlers.spark = (effect, c) => {
      const fallback = c.projectile.kind === "bullet" ? 2 : 4;
      const amount = c.hit?.critical ? Math.max(6, (effect.count ?? fallback) + 3) : (effect.count ?? fallback);
      return effectCommand("spark", { x: c.position.x, y: c.position.y, amount, power: c.hit?.critical ? 210 : 120 });
    };
  }

  if (options.chain !== false) {
    handlers.chainLightning = (effect) => effectCommand("chainLightning", { effect });
  }

  if (options.status !== false) {
    handlers.burn = (effect, c) => effectCommand("status", { status: "burn", target: c.enemy, effect, source: c.projectile });
    handlers.poison = (effect, c) => effectCommand("status", { status: "poison", target: c.enemy, effect, source: c.projectile });
    handlers.freeze = (effect, c) => effectCommand("status", { status: "freeze", target: c.enemy, effect, source: c.projectile });
  }

  const ctx = context.runProjectileHook(state, projectile, EFFECT_HOOKS.PROJECTILE_HIT, {
    enemy,
    target: enemy,
    hit,
    damage: hit.damage,
    position,
    tags: hit.tags || []
  }, handlers);

  if (ctx.appliedStatuses?.length) addStatusBurst(state, position.x, position.y, ctx.appliedStatuses);
  hit.commands = [...(hit.commands || []), ...ctx.commands];
  return ctx;
}

function registerHit(projectile, enemy) {
  if (!projectile.hitIds) projectile.hitIds = {};
  projectile.hitIds[enemy.id] = true;
}

export function canHit(projectile, enemy) {
  return !projectile.hitIds?.[enemy.id];
}

export function applyProjectileHit(state, projectile, enemy, context = {}) {
  const weapon = WEAPONS[projectile.weaponId] || WEAPONS[START_WEAPON];
  if (tryEnemyProjectileDefense(state, projectile, enemy)) return false;
  registerHit(projectile, enemy);
  const hit = dealProjectileDamage(state, projectile, enemy, projectile.damage, enemy.x, enemy.y);
  addImpulse(enemy, projectile.x, projectile.y, (weapon.knockback || 120) * (projectile.knockbackMult || 1));

  if (hit.damage?.armorHit) {
    if (hit.damage.armorRicochet) {
      ricochetProjectileFromArmor(projectile, enemy);
      pushVisualEffect(state, {
        type: "ricochet",
        x: Math.round(projectile.x),
        y: Math.round(projectile.y),
        vx: Math.round(projectile.vx),
        vy: Math.round(projectile.vy),
        color: GREEN,
        life: 0.14,
        maxLife: 0.14
      });
      return false;
    }
    return true;
  }

  runProjectileHitEffects(state, projectile, enemy, hit, { x: enemy.x, y: enemy.y }, { spark: true, chain: true, status: true, hitShake: true }, context);

  if (enemy.hp <= 0) finishProjectileEnemyKill(state, enemy, projectile, hit.damage || hit, context);

  const pierce = getEffect(projectile, "pierce");
  const canPierce = pierce && projectile.pierced < (pierce.count || 0);
  const explodeEffect = getEffect(projectile, "explode");

  // Explosive projectiles used to terminate before pierce could do real work.
  // That made combinations like SEEKER + PIERCE feel visual-only: the first
  // impact drew the green explosion, but the projectile never carried damage
  // through to the next target. Impact explosions now resolve immediately,
  // while the projectile may continue if pierce still has charges. Split/cluster
  // stay reserved for the final expire path, so rocket upgrades do not fan out
  // on every pierced enemy.
  if (explodeEffect && canPierce) {
    context.explode(state, projectile, explodeEffect);
    projectile.pierced += 1;
    projectile.targetId = null;
    return false;
  }

  if (explodeEffect) {
    context.fireExpireEffects(state, projectile);
    return true;
  }

  if (canPierce) {
    projectile.pierced += 1;
    projectile.targetId = null;
    return false;
  }
  return true;
}
