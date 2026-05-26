import { DAMAGE_TAGS } from "./effects/defs.js";

export const PROJECTILE_DAMAGE_SOURCES = Object.freeze({
  DIRECT: "direct",
  EXPLOSION: "explosion",
  CHAIN: "chain",
  STATUS: "status"
});

export function projectileDamageTags(source = PROJECTILE_DAMAGE_SOURCES.DIRECT) {
  if (source === PROJECTILE_DAMAGE_SOURCES.EXPLOSION) return [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.EXPLOSION];
  if (source === PROJECTILE_DAMAGE_SOURCES.CHAIN) return [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.CHAIN];
  if (source === PROJECTILE_DAMAGE_SOURCES.STATUS) return [DAMAGE_TAGS.STATUS];
  return [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.DIRECT];
}

export function statusDamageTags(type = null) {
  const tags = [DAMAGE_TAGS.STATUS];
  if (type === "burn") tags.push(DAMAGE_TAGS.BURN);
  else if (type === "poison") tags.push(DAMAGE_TAGS.POISON);
  else if (type === "freeze") tags.push(DAMAGE_TAGS.FREEZE);
  return tags;
}

export function companionDamageTags(kind) {
  return [DAMAGE_TAGS.DIRECT, DAMAGE_TAGS.COMPANION, kind].filter(Boolean);
}

export function hostileProjectileDamageTags() {
  return [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.PROJECTILE];
}

export function eliteDeathPulseDamageTags(variantId = null) {
  return [DAMAGE_TAGS.ENEMY, "elite", "pulse", variantId].filter(Boolean);
}

export function canDamageSourceHitArmor(tags = []) {
  const safeTags = Array.isArray(tags) ? tags : [];
  if (safeTags.includes(DAMAGE_TAGS.ENEMY)) return false;
  return safeTags.includes(DAMAGE_TAGS.PROJECTILE) || safeTags.includes(DAMAGE_TAGS.COMPANION);
}

export function canDamageSourceLifesteal(tags = []) {
  const safeTags = Array.isArray(tags) ? tags : [];
  if (safeTags.includes(DAMAGE_TAGS.STATUS)) return false;
  if (safeTags.includes(DAMAGE_TAGS.COMPANION)) return false;
  if (safeTags.includes(DAMAGE_TAGS.ENEMY)) return false;
  return safeTags.some((tag) => [DAMAGE_TAGS.DIRECT, DAMAGE_TAGS.EXPLOSION, DAMAGE_TAGS.CHAIN].includes(tag));
}

export const DAMAGE_SOURCE_MATRIX = Object.freeze({
  projectileDirect: Object.freeze({
    tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT),
    armor: true,
    lifesteal: true,
    projectileDamageHook: true,
    projectileHitHook: true
  }),
  projectileExplosion: Object.freeze({
    tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.EXPLOSION),
    armor: true,
    lifesteal: true,
    projectileDamageHook: true,
    projectileHitHook: true
  }),
  projectileChain: Object.freeze({
    tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.CHAIN),
    armor: true,
    lifesteal: true,
    projectileDamageHook: true,
    projectileHitHook: true
  }),
  projectileStatus: Object.freeze({
    tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.STATUS),
    armor: false,
    lifesteal: false,
    projectileDamageHook: false,
    projectileHitHook: false
  }),
  companionDirect: Object.freeze({
    tags: [DAMAGE_TAGS.DIRECT, DAMAGE_TAGS.COMPANION],
    armor: true,
    lifesteal: false,
    projectileDamageHook: false,
    projectileHitHook: false
  }),
  hostileProjectile: Object.freeze({
    tags: hostileProjectileDamageTags(),
    armor: false,
    lifesteal: false,
    projectileDamageHook: false,
    projectileHitHook: false
  }),
  eliteDeathPulse: Object.freeze({
    tags: eliteDeathPulseDamageTags(),
    armor: false,
    lifesteal: false,
    projectileDamageHook: false,
    projectileHitHook: false
  })
});
