import { GREEN, RED } from "../core/constants.js";
import { norm } from "../core/math.js";
import { pushVisualEffect } from "./effectCommands.js";
import { DAMAGE_TAGS } from "./effects/defs.js";

export function armorConfig(data = {}) {
  const armor = data.armor || null;
  if (!armor) return null;
  const maxHp = Math.max(0, Math.round(armor.hp || armor.maxHp || 0));
  if (!maxHp) return null;
  return {
    maxHp,
    regenDelay: Math.max(0, armor.regenDelay ?? 3.4),
    regenPerSecond: Math.max(0, armor.regenPerSecond ?? maxHp * 0.16),
    ricochet: armor.ricochet !== false,
    visual: armor.visual || "square"
  };
}

export function initEnemyArmor(enemy, data) {
  const cfg = armorConfig(data);
  if (!cfg) return null;
  enemy.armor = {
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    regenDelay: cfg.regenDelay,
    regenPerSecond: cfg.regenPerSecond,
    regenCooldown: 0,
    ricochet: cfg.ricochet,
    visual: cfg.visual,
    broken: false
  };
  return enemy.armor;
}

export function armorSnapshot(enemy) {
  const armor = enemy?.armor;
  if (!armor || !(armor.maxHp > 0)) return null;
  return {
    hp: Math.max(0, Math.round(armor.hp || 0)),
    maxHp: Math.max(1, Math.round(armor.maxHp || 1)),
    ratio: Number(Math.max(0, Math.min(1, (armor.hp || 0) / Math.max(1, armor.maxHp || 1))).toFixed(3)),
    broken: !(armor.hp > 0),
    regenCooldown: Number(Math.max(0, armor.regenCooldown || 0).toFixed(2)),
    visual: armor.visual || "square"
  };
}

export function shouldArmorAbsorb(target, spec = {}) {
  const armor = target?.armor;
  if (!armor || !(armor.maxHp > 0) || !(armor.hp > 0)) return false;
  if (spec.bypassArmor) return false;
  const tags = Array.isArray(spec.tags) ? spec.tags : [];
  return tags.includes(DAMAGE_TAGS.PROJECTILE) || tags.includes(DAMAGE_TAGS.COMPANION);
}

export function applyArmorDamage(state, target, amount, spec = {}) {
  const armor = target.armor;
  const before = Math.max(0, armor.hp || 0);
  const damage = Math.max(0, amount || 0);
  const absorbed = Math.min(before, damage);
  armor.hp = Math.max(0, before - damage);
  armor.regenCooldown = Math.max(0, armor.regenDelay || 0);
  const wasBroken = !!armor.broken;
  armor.broken = !(armor.hp > 0);
  const broke = !wasBroken && armor.broken;

  pushVisualEffect(state, {
    type: broke ? "armorBreak" : "armorHit",
    x: Math.round(target.x),
    y: Math.round(target.y),
    r: (target.radius || 12) + (broke ? 10 : 6),
    color: broke ? RED : GREEN,
    life: broke ? 0.22 : 0.12,
    maxLife: broke ? 0.22 : 0.12
  });

  return {
    armorHit: true,
    armorDamage: absorbed,
    armorBroken: broke,
    armorRemaining: Math.max(0, armor.hp || 0),
    armorMax: Math.max(1, armor.maxHp || 1),
    armorRicochet: armor.ricochet !== false && !broke,
    done: 0,
    killed: false,
    sourceId: spec.sourceId || null,
    weaponId: spec.weaponId || null,
    projectileId: spec.projectileId || null,
    tags: Array.isArray(spec.tags) ? spec.tags : []
  };
}

export function updateEnemyArmor(state, enemy, dt) {
  const armor = enemy?.armor;
  if (!armor || !(armor.maxHp > 0)) return;
  if (armor.regenCooldown > 0) {
    armor.regenCooldown = Math.max(0, armor.regenCooldown - dt);
    return;
  }
  if (armor.hp >= armor.maxHp) return;
  const before = Math.max(0, armor.hp || 0);
  armor.hp = Math.min(armor.maxHp, before + Math.max(0, armor.regenPerSecond || 0) * dt);
  armor.broken = !(armor.hp > 0);
  if (before <= 0 && armor.hp > 0) {
    pushVisualEffect(state, {
      type: "armorRegen",
      x: Math.round(enemy.x),
      y: Math.round(enemy.y),
      r: (enemy.radius || 12) + 7,
      color: GREEN,
      life: 0.18,
      maxLife: 0.18
    });
  }
}

export function ricochetProjectileFromArmor(projectile, enemy) {
  const speed = Math.hypot(projectile.vx || 0, projectile.vy || 0) || projectile.speed || 1;
  // Bounce against incoming travel direction, not the post-sweep position;
  // after a large dt the projectile may already be visually past the target.
  const d = norm(-(projectile.vx || 1), -(projectile.vy || 0));
  projectile.vx = d.x * speed;
  projectile.vy = d.y * speed;
  projectile.targetId = null;
  projectile.armorRicocheted = (projectile.armorRicocheted || 0) + 1;
  projectile.x = enemy.x + d.x * (enemy.radius + (projectile.radius || 0) + 3);
  projectile.y = enemy.y + d.y * (enemy.radius + (projectile.radius || 0) + 3);
  return projectile;
}
