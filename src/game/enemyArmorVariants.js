import { dist2 } from "../core/math.js";
import { ENEMIES } from "../data/enemies.js";
import { ARMOR_VARIANTS } from "../data/armorVariants.js";
import { pushVisualEffect } from "./effectCommands.js";
import { loopEscalationProfileForState } from "./loopScaling.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function armorVariantById(id) {
  return id && ARMOR_VARIANTS[id] ? ARMOR_VARIANTS[id] : null;
}

function enemyHasArmor(kind, enemy = null) {
  return !!enemy?.armor || !!ENEMIES[kind]?.armor;
}

function variantCanGrantArmor(variant) {
  return !!variant?.grantsArmor;
}

function ensureVariantArmor(enemy, variant) {
  if (enemy?.armor || !variantCanGrantArmor(variant)) return enemy?.armor || null;
  const grant = variant.grantsArmor || {};
  const maxHp = Math.max(1, enemy?.maxHp || ENEMIES[enemy?.kind]?.hp || 1);
  const armorHp = Math.max(grant.minHp || 1, Math.min(grant.maxHp || 999, Math.round(maxHp * (grant.hpRatio || 0.65))));
  enemy.armor = {
    hp: armorHp,
    maxHp: armorHp,
    regenDelay: grant.regenDelay ?? 3.5,
    regenPerSecond: Math.max(1, Math.round(armorHp * (grant.regenPerSecondRatio || 0.2))),
    regenCooldown: 0,
    ricochet: grant.ricochet !== false,
    visual: grant.visual || "square",
    broken: false
  };
  return enemy.armor;
}

export function canApplyArmorVariantToEnemy(variant, kind, enemy = null) {
  if (!variant || !kind) return false;
  if (variant.requiresArmor && !enemyHasArmor(kind, enemy)) return false;
  if (!variant.requiresArmor && !enemyHasArmor(kind, enemy) && !variantCanGrantArmor(variant)) return false;
  const allowed = asArray(variant.allowedKinds);
  const excluded = new Set(asArray(variant.excludedKinds));
  if (excluded.has(kind)) return false;
  return allowed.length === 0 || allowed.includes(kind);
}

export function eligibleArmorVariantsForEnemy(kind, profile = null, enemy = null) {
  const ids = asArray(profile?.armor?.variantIds);
  return ids
    .map((id) => armorVariantById(id))
    .filter((variant) => canApplyArmorVariantToEnemy(variant, kind, enemy));
}

export function selectArmorVariantIdForEnemy(state, enemy, profile = loopEscalationProfileForState(state), options = {}) {
  if (options.armorVariantId && armorVariantById(options.armorVariantId)) return options.armorVariantId;
  const chance = clamp01(numberOr(profile?.armor?.variantChance, 0));
  if (!(chance > 0)) return null;
  const candidates = eligibleArmorVariantsForEnemy(enemy?.kind, profile, enemy);
  if (!candidates.length) return null;
  if ((state?.rng?.next?.() ?? 1) >= chance) return null;
  return (state.rng?.pick?.(candidates) || candidates[0])?.id || null;
}

export function applyArmorVariantToEnemy(enemy, variantId) {
  const variant = armorVariantById(variantId);
  if (!enemy || !canApplyArmorVariantToEnemy(variant, enemy.kind, enemy)) return null;
  ensureVariantArmor(enemy, variant);
  if (!enemy.armor) return null;
  enemy.armor.variant = {
    id: variant.id,
    name: variant.name,
    color: variant.color,
    visual: variant.visual?.renderer || null,
    linkVisual: variant.visual?.linkRenderer || null,
    links: [],
    protected: false,
    nextRefreshAt: 0,
    blockedFxAt: 0
  };
  return enemy.armor.variant;
}

export function maybeApplyArmorVariantToEnemy(state, enemy, options = {}) {
  const profile = loopEscalationProfileForState(state);
  const variantId = selectArmorVariantIdForEnemy(state, enemy, profile, options);
  return applyArmorVariantToEnemy(enemy, variantId);
}

function linkedVariantForEnemy(enemy) {
  const variant = armorVariantById(enemy?.armor?.variant?.id);
  return variant?.id === "linked" ? variant : null;
}

function isValidLinkTarget(target, variant, source) {
  if (!target || target.id === source?.id || target.hp <= 0) return false;
  const config = variant?.link || {};
  const candidates = asArray(config.candidateKinds);
  const excluded = new Set(asArray(config.excludedKinds));
  if (excluded.has(target.kind)) return false;
  if (candidates.length && !candidates.includes(target.kind)) return false;
  return true;
}

function activeLinkTargets(state, enemy, variant) {
  const linkState = enemy?.armor?.variant;
  const radius = Math.max(0, numberOr(variant?.link?.radius, 0));
  const r2 = radius * radius;
  const seen = new Set();
  const live = [];
  for (const item of asArray(linkState?.links)) {
    const target = state?.enemies?.[item.id];
    if (!isValidLinkTarget(target, variant, enemy)) continue;
    if (dist2(enemy.x, enemy.y, target.x, target.y) > r2) continue;
    if (seen.has(target.id)) continue;
    seen.add(target.id);
    live.push(target);
  }
  return live;
}

function selectNewLinkTargets(state, enemy, variant, live = []) {
  const config = variant?.link || {};
  const radius = Math.max(0, numberOr(config.radius, 0));
  const maxLinks = Math.max(0, Math.floor(numberOr(config.maxLinks, 0)));
  const need = Math.max(0, maxLinks - live.length);
  if (!need || !radius) return live;
  const linked = new Set(live.map((target) => target.id));
  const r2 = radius * radius;
  const candidates = Object.values(state?.enemies || {})
    .filter((target) => !linked.has(target.id) && isValidLinkTarget(target, variant, enemy))
    .map((target) => ({ target, d2: dist2(enemy.x, enemy.y, target.x, target.y) }))
    .filter((item) => item.d2 <= r2)
    .sort((a, b) => a.d2 - b.d2)
    .slice(0, need)
    .map((item) => item.target);
  return [...live, ...candidates];
}

export function updateEnemyArmorVariantRuntime(state, enemy, dt = 0) {
  const variant = linkedVariantForEnemy(enemy);
  const linkState = enemy?.armor?.variant;
  if (!variant || !linkState) return null;

  linkState.nextRefreshAt = Math.max(0, numberOr(linkState.nextRefreshAt, 0) - dt);
  linkState.blockedFxAt = Math.max(0, numberOr(linkState.blockedFxAt, 0) - dt);
  if (linkState.nextRefreshAt > 0) return linkState;

  const live = activeLinkTargets(state, enemy, variant);
  const targets = selectNewLinkTargets(state, enemy, variant, live);
  linkState.links = targets.map((target) => ({
    id: target.id,
    kind: target.kind,
    x: Math.round(target.x),
    y: Math.round(target.y)
  }));
  linkState.protected = linkState.links.length > 0;
  linkState.nextRefreshAt = Math.max(0.08, numberOr(variant.link?.refreshEvery, 0.3));
  return linkState;
}

export function applyArmorVariantDamageRules(state, enemy, nextHp, context = {}) {
  const variant = linkedVariantForEnemy(enemy);
  const linkState = enemy?.armor?.variant;
  if (!variant || !linkState?.protected || !linkState.links?.length) {
    return { hp: nextHp, blocked: false };
  }

  const armor = enemy.armor;
  const floorRatio = clamp01(numberOr(variant.link?.guardedFloorRatio, 0));
  const floor = Math.max(1, Math.round((armor.maxHp || 1) * floorRatio));
  if (nextHp > floor) return { hp: nextHp, blocked: false };

  if (!(linkState.blockedFxAt > 0)) {
    pushVisualEffect(state, {
      type: "armorLinkBlock",
      armorVariantId: variant.id,
      x: Math.round(enemy.x),
      y: Math.round(enemy.y),
      r: (enemy.radius || 12) + 18,
      color: variant.color || "#ff3048",
      life: 0.2,
      maxLife: 0.2
    });
    linkState.blockedFxAt = 0.18;
  }

  return {
    hp: Math.max(floor, nextHp),
    blocked: true,
    floor,
    links: linkState.links.length,
    sourceId: context?.spec?.sourceId || null
  };
}

export function armorVariantSnapshot(enemy) {
  const variant = armorVariantById(enemy?.armor?.variant?.id);
  if (!variant) return null;
  const state = enemy.armor.variant;
  return {
    id: variant.id,
    name: variant.name,
    color: variant.color,
    visual: variant.visual?.renderer || state.visual || null,
    linkVisual: variant.visual?.linkRenderer || state.linkVisual || null,
    protected: !!state.protected,
    links: asArray(state.links).map((link) => ({
      id: link.id,
      kind: link.kind,
      x: Math.round(link.x),
      y: Math.round(link.y)
    }))
  };
}
