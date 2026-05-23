import { PLAYER_HP } from "../core/constants.js";
import { WEAPONS } from "../data/weapons.js";
import { ABILITY_IDS } from "../data/abilities.js";
import { xpRequiredForNextLevel } from "../data/economy.js";
import { dashConfig } from "./abilities.js";
import { buildPlayerEffects, buildProjectileEffects, getEffect, getEffects } from "./effects.js";
import { ensureInventory, getActiveWeaponDef, getActiveWeaponId } from "./inventory.js";
import { ensurePlayerEconomy } from "./playerEconomy.js";

export const STAT_SNAPSHOT_SCHEMA_VERSION = 1;

const DEFAULT_MULTIPLIERS = Object.freeze({
  speedMult: 1,
  fireRateMult: 1,
  damageMult: 1,
  projectileSpeedMult: 1,
  explosionRadiusMult: 1,
  explosionDamageMult: 1,
  knockbackMult: 1
});

function finite(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function rounded(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(finite(value, 0) * scale) / scale;
}

function percentFromMultiplier(multiplier) {
  return rounded((finite(multiplier, 1) - 1) * 100, 1);
}

function percent(value) {
  return rounded(finite(value, 0) * 100, 1);
}

function statMult(player, key) {
  return Math.max(0.1, finite(player?.stats?.[key], DEFAULT_MULTIPLIERS[key] ?? 1));
}

function effectNumber(effect, key, fallback = 0) {
  return finite(effect?.[key], fallback);
}

function sumEffects(effects, type, key) {
  return effects
    .filter((effect) => effect?.type === type)
    .reduce((sum, effect) => sum + effectNumber(effect, key, 0), 0);
}

function activeWeaponSnapshot(player) {
  const inventory = ensureInventory(player);
  const weaponId = getActiveWeaponId(player);
  const weapon = getActiveWeaponDef(player);
  const damageMult = statMult(player, "damageMult");
  const fireRateMult = statMult(player, "fireRateMult");
  const projectileSpeedMult = statMult(player, "projectileSpeedMult");
  return {
    id: weaponId,
    name: weapon.name || weaponId,
    code: weapon.code || weaponId.toUpperCase().slice(0, 3),
    owned: inventory.weapons.slice(0, 9),
    base: {
      damage: finite(weapon.damage, 0),
      fireRate: finite(weapon.fireRate, 0),
      projectileSpeed: finite(weapon.bulletSpeed, 0),
      pellets: Math.max(1, Math.floor(finite(weapon.pellets, 1))),
      range: finite(weapon.range, 0),
      explosionRadius: Math.max(0, ...((weapon.effects || []).filter((effect) => effect?.type === "explode").map((effect) => finite(effect.radius, 0))))
    },
    effective: {
      damage: rounded(finite(weapon.damage, 0) * damageMult, 1),
      fireRate: rounded(finite(weapon.fireRate, 0) * fireRateMult, 2),
      projectileSpeed: Math.round(finite(weapon.bulletSpeed, 0) * projectileSpeedMult),
      explosionRadiusMult: rounded(statMult(player, "explosionRadiusMult"), 2),
      explosionDamageMult: rounded(statMult(player, "explosionDamageMult"), 2),
      knockbackMult: rounded(statMult(player, "knockbackMult"), 2)
    }
  };
}

function projectileEffectSnapshot(player, weapon) {
  const activeWeaponId = getActiveWeaponId(player);
  const projectileEffects = buildProjectileEffects(player, weapon, activeWeaponId);
  const crit = getEffect({ effects: projectileEffects }, "crit");
  const lifesteal = getEffect({ effects: projectileEffects }, "lifesteal");
  const pierce = getEffect({ effects: projectileEffects }, "pierce");
  const ricochet = getEffect({ effects: projectileEffects }, "ricochet");
  const chainLightning = getEffect({ effects: projectileEffects }, "chainLightning");
  const splitRockets = getEffect({ effects: projectileEffects }, "splitRockets");
  const clusterBomb = getEffect({ effects: projectileEffects }, "clusterBomb");
  const homing = getEffect({ effects: projectileEffects }, "homing") || getEffect({ effects: projectileEffects }, "homingCore");

  return {
    critChancePercent: percent(effectNumber(crit, "chance", 0)),
    critMultiplier: rounded(effectNumber(crit, "multiplier", 1), 2),
    lifestealPercent: percent(effectNumber(lifesteal, "percent", 0)),
    pierce: Math.max(0, Math.floor(effectNumber(pierce, "count", 0))),
    ricochet: Math.max(0, Math.floor(effectNumber(ricochet, "count", 0))),
    chainJumps: Math.max(0, Math.floor(effectNumber(chainLightning, "jumps", 0))),
    splitRockets: Math.max(0, Math.floor(effectNumber(splitRockets, "count", 0))),
    clusterBombs: Math.max(0, Math.floor(effectNumber(clusterBomb, "count", 0))),
    homingStrength: rounded(effectNumber(homing, "strength", 0), 2)
  };
}

function playerEffectSnapshot(player) {
  const effects = buildPlayerEffects(player);
  const magnet = getEffect({ effects }, "magnet");
  const luck = getEffect({ effects }, "luck");
  const shield = getEffect({ effects }, "shield");
  const teleportDash = getEffect({ effects }, "teleportDash");
  const afterimage = getEffect({ effects }, "afterimage");
  const orbital = getEffect({ effects }, "orbital");
  const drone = getEffect({ effects }, "drone");
  const companionBoost = getEffect({ effects }, "companionBoost");
  const dash = dashConfig(player);

  return {
    luckDropChancePercent: percent(effectNumber(luck, "dropChance", 0)),
    luckRareValuePercent: percent(effectNumber(luck, "rare", 0)),
    magnetRadius: Math.round(effectNumber(magnet, "radius", 0)),
    magnetForce: Math.round(effectNumber(magnet, "force", 0)),
    shieldCharges: Math.max(0, Math.floor(effectNumber(shield, "charges", 0))),
    dash: dash ? {
      source: dash.source || (teleportDash ? "upgrade" : "ability_inventory"),
      distance: Math.round(dash.distance),
      cooldown: rounded(dash.cooldown, 2),
      invulnMs: Math.round(dash.invuln * 1000),
      afterimageCount: Math.max(0, Math.floor(effectNumber(afterimage, "count", dash.afterimageCount || 0)))
    } : null,
    companions: {
      orbitalCount: Math.max(0, Math.floor(effectNumber(orbital, "count", 0))),
      orbitalDamage: rounded(effectNumber(orbital, "damage", 0), 1),
      droneCount: Math.max(0, Math.floor(effectNumber(drone, "count", 0))),
      droneDamage: rounded(effectNumber(drone, "damage", 0), 1),
      droneFireRate: rounded(effectNumber(drone, "fireRate", 0), 2),
      damageBonusPercent: percent(effectNumber(companionBoost, "damageMult", 0))
    }
  };
}

function upgradeSourceSnapshot(player) {
  const taken = player?.upgrades?.taken || {};
  return Object.entries(taken)
    .filter(([, stacks]) => Math.max(0, Math.floor(stacks || 0)) > 0)
    .map(([id, stacks]) => ({ id, stacks: Math.max(0, Math.floor(stacks || 0)) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function runtimeSnapshot(player) {
  return {
    hpPercent: percent((player?.hp || 0) / Math.max(1, player?.maxHp || PLAYER_HP)),
    dashInvulnLeft: rounded(player?.effectState?.dash?.invulnLeft || 0, 2),
    dashCooldownLeft: rounded(player?.effectState?.dash?.cooldownLeft || 0, 2),
    shieldChargesReady: Math.max(0, Math.floor(player?.effectState?.shield?.charges || 0)),
    alive: !!player && player.hp > 0
  };
}

export function buildPlayerStatSnapshot(player, state = null) {
  const economy = ensurePlayerEconomy(player);
  const weapon = getActiveWeaponDef(player);
  const activeWeapon = activeWeaponSnapshot(player);
  const playerEffects = playerEffectSnapshot(player);
  const projectileEffects = projectileEffectSnapshot(player, weapon);
  const ownedAbilities = Array.isArray(player?.abilityInventory?.ownedAbilities) ? player.abilityInventory.ownedAbilities : [];

  return {
    schemaVersion: STAT_SNAPSHOT_SCHEMA_VERSION,
    playerId: player?.id || null,
    generatedAtTick: Number.isFinite(state?.tick) ? state.tick : null,
    percent: {
      moveSpeed: percentFromMultiplier(statMult(player, "speedMult")),
      fireRate: percentFromMultiplier(statMult(player, "fireRateMult")),
      damage: percentFromMultiplier(statMult(player, "damageMult")),
      projectileSpeed: percentFromMultiplier(statMult(player, "projectileSpeedMult")),
      explosionRadius: percentFromMultiplier(statMult(player, "explosionRadiusMult")),
      explosionDamage: percentFromMultiplier(statMult(player, "explosionDamageMult")),
      knockback: percentFromMultiplier(statMult(player, "knockbackMult")),
      critChance: projectileEffects.critChancePercent,
      lifesteal: projectileEffects.lifestealPercent,
      luckDropChance: playerEffects.luckDropChancePercent,
      luckRareValue: playerEffects.luckRareValuePercent,
      companionDamage: playerEffects.companions.damageBonusPercent
    },
    multipliers: {
      speedMult: rounded(statMult(player, "speedMult"), 2),
      fireRateMult: rounded(statMult(player, "fireRateMult"), 2),
      damageMult: rounded(statMult(player, "damageMult"), 2),
      projectileSpeedMult: rounded(statMult(player, "projectileSpeedMult"), 2),
      explosionRadiusMult: rounded(statMult(player, "explosionRadiusMult"), 2),
      explosionDamageMult: rounded(statMult(player, "explosionDamageMult"), 2),
      knockbackMult: rounded(statMult(player, "knockbackMult"), 2)
    },
    weapon: activeWeapon,
    projectile: projectileEffects,
    utility: {
      magnetRadius: playerEffects.magnetRadius,
      magnetForce: playerEffects.magnetForce,
      luckDropChancePercent: playerEffects.luckDropChancePercent,
      luckRareValuePercent: playerEffects.luckRareValuePercent,
      shieldCharges: playerEffects.shieldCharges
    },
    ability: {
      activeAbility: player?.abilityInventory?.activeAbility || null,
      ownsTeleportDash: ownedAbilities.includes(ABILITY_IDS.TELEPORT_DASH),
      dash: playerEffects.dash
    },
    companions: playerEffects.companions,
    economy: {
      money: economy.money,
      level: economy.level,
      xp: economy.xp,
      nextLevelXp: xpRequiredForNextLevel(economy.level),
      pendingUpgradeCount: economy.pendingUpgradeCount
    },
    runtime: runtimeSnapshot(player),
    sources: {
      upgrades: upgradeSourceSnapshot(player),
      weapons: ensureInventory(player).weapons.filter((id) => WEAPONS[id]),
      abilities: ownedAbilities.filter(Boolean),
      playerEffects: getEffects({ effects: buildPlayerEffects(player) }).map((effect) => effect.type).sort()
    }
  };
}

export function syncPlayerStatSnapshot(state, player) {
  if (!player) return null;
  player.statSnapshot = buildPlayerStatSnapshot(player, state);
  return player.statSnapshot;
}

export function syncAllPlayerStatSnapshots(state) {
  for (const player of Object.values(state?.players || {})) syncPlayerStatSnapshot(state, player);
  return state;
}
