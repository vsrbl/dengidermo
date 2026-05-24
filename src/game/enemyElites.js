import { dist2 } from "../core/math.js";
import { ELITE_VARIANTS } from "../data/eliteVariants.js";
import { dealPlayerDamage } from "./effects.js";
import { pushVisualEffect } from "./effectCommands.js";
import { eliteDeathPulseDamageTags } from "./damageSourceMatrix.js";
import { loopEscalationProfileForState } from "./loopScaling.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function eliteVariantById(id) {
  return id && ELITE_VARIANTS[id] ? ELITE_VARIANTS[id] : null;
}

export function canApplyEliteVariantToEnemy(variant, kind) {
  if (!variant || !kind) return false;
  const allowed = asArray(variant.allowedKinds);
  const excluded = new Set(asArray(variant.excludedKinds));
  if (excluded.has(kind)) return false;
  return allowed.length === 0 || allowed.includes(kind);
}

export function eligibleEliteVariantsForEnemy(kind, profile = null) {
  const ids = asArray(profile?.elite?.variantIds);
  return ids
    .map((id) => eliteVariantById(id))
    .filter((variant) => canApplyEliteVariantToEnemy(variant, kind));
}

export function selectEliteVariantIdForEnemy(state, kind, profile = loopEscalationProfileForState(state), options = {}) {
  if (options.eliteVariantId && eliteVariantById(options.eliteVariantId)) return options.eliteVariantId;
  const chance = Math.max(0, Math.min(1, numberOr(profile?.elite?.chance, 0)));
  if (!(chance > 0)) return null;
  const candidates = eligibleEliteVariantsForEnemy(kind, profile);
  if (!candidates.length) return null;
  if ((state?.rng?.next?.() ?? 1) >= chance) return null;
  return (state.rng?.pick?.(candidates) || candidates[0])?.id || null;
}

export function applyEliteVariantToEnemy(enemy, variantId) {
  const variant = eliteVariantById(variantId);
  if (!enemy || !canApplyEliteVariantToEnemy(variant, enemy.kind)) return null;
  const stats = variant.stats || {};
  if (Number.isFinite(stats.hpMult) && stats.hpMult > 0 && stats.hpMult !== 1) {
    enemy.maxHp = Math.max(1, Math.round((enemy.maxHp || enemy.hp || 1) * stats.hpMult));
    enemy.hp = Math.max(1, Math.round((enemy.hp || enemy.maxHp || 1) * stats.hpMult));
  }
  if (Number.isFinite(stats.speedMult) && stats.speedMult > 0) {
    enemy.speedMult = Math.max(0.05, (enemy.speedMult || 1) * stats.speedMult);
  }
  if (Number.isFinite(stats.damageMult) && stats.damageMult > 0) {
    enemy.damageMult = Math.max(0, (enemy.damageMult || 1) * stats.damageMult);
  }
  enemy.elite = {
    id: variant.id,
    name: variant.name,
    color: variant.color,
    visual: variant.visual?.renderer || null
  };
  return enemy.elite;
}

export function maybeApplyEliteVariantToEnemy(state, enemy, options = {}) {
  const profile = loopEscalationProfileForState(state);
  const variantId = selectEliteVariantIdForEnemy(state, enemy?.kind, profile, options);
  return applyEliteVariantToEnemy(enemy, variantId);
}

function applyPulseKnockback(player, x, y, force = 0) {
  if (!(force > 0)) return;
  const dx = player.x - x;
  const dy = player.y - y;
  const len = Math.hypot(dx, dy) || 1;
  player.kx = (player.kx || 0) + (dx / len) * force;
  player.ky = (player.ky || 0) + (dy / len) * force;
}

export function runEnemyEliteDeath(state, enemy, source = null, hit = null) {
  const variant = eliteVariantById(enemy?.elite?.id);
  const pulse = variant?.deathPulse;
  if (!state || !enemy || !pulse) return null;

  const radius = Math.max(0, numberOr(pulse.radius, 0));
  const damage = Math.max(0, numberOr(pulse.damage, 0));
  const life = Math.max(0.08, numberOr(pulse.life, 0.28));
  const color = variant.color || "#ff3048";

  pushVisualEffect(state, {
    type: "elitePulse",
    eliteId: variant.id,
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    r: radius,
    color,
    life,
    maxLife: life
  });

  if (!(radius > 0) || !(damage > 0)) return { variantId: variant.id, hits: 0 };

  let hits = 0;
  const r2 = radius * radius;
  for (const player of Object.values(state.players || {})) {
    if (!player || player.hp <= 0) continue;
    if (dist2(enemy.x, enemy.y, player.x, player.y) > r2) continue;
    dealPlayerDamage(state, player, {
      amount: damage,
      sourceId: enemy.id,
      sourceType: "eliteDeathPulse",
      enemyId: enemy.id,
      tags: eliteDeathPulseDamageTags(variant.id)
    });
    applyPulseKnockback(player, enemy.x, enemy.y, pulse.knockback || 0);
    hits += 1;
  }
  return { variantId: variant.id, hits };
}

export function enemyEliteSnapshot(enemy) {
  const variant = eliteVariantById(enemy?.elite?.id);
  if (!variant) return null;
  return {
    id: variant.id,
    name: variant.name,
    color: variant.color,
    visual: variant.visual?.renderer || enemy.elite?.visual || null
  };
}
