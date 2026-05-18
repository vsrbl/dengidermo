import { synergyOfferMeta } from "./synergies.js";

export const UPGRADES = {
  overclock: {
    id: "overclock",
    name: "OVERCLOCK",
    desc: "+14% fire rate",
    rarity: "common",
    tags: ["stat", "fire-rate"],
    weight: 6,
    maxStacks: 6,
    mods: { fireRateMult: 0.14 }
  },

  lightFrame: {
    id: "lightFrame",
    name: "LIGHT FRAME",
    desc: "+12% move speed",
    rarity: "common",
    tags: ["stat", "movement"],
    weight: 6,
    maxStacks: 6,
    mods: { speedMult: 0.12 }
  },

  heavyPayload: {
    id: "heavyPayload",
    name: "HEAVY PAYLOAD",
    desc: "+15% damage",
    rarity: "common",
    tags: ["stat", "damage"],
    weight: 5,
    maxStacks: 6,
    mods: { damageMult: 0.15 }
  },

  fastRounds: {
    id: "fastRounds",
    name: "FAST ROUNDS",
    desc: "+15% projectile speed",
    rarity: "common",
    tags: ["stat", "projectile"],
    weight: 4,
    maxStacks: 5,
    mods: { projectileSpeedMult: 0.15 }
  },

  blastCore: {
    id: "blastCore",
    name: "BLAST CORE",
    desc: "+18% explosions",
    rarity: "common",
    tags: ["stat", "explosion"],
    weight: 4,
    maxStacks: 5,
    mods: { explosionRadiusMult: 0.18, explosionDamageMult: 0.12 }
  },

  extraHeart: {
    id: "extraHeart",
    name: "EXTRA HEART",
    desc: "+22 max HP, heal 22",
    rarity: "common",
    tags: ["stat", "survival"],
    weight: 5,
    maxStacks: 5,
    mods: { maxHp: 22, heal: 22 }
  },

  hardKick: {
    id: "hardKick",
    name: "HARD KICK",
    desc: "+20% knockback",
    rarity: "common",
    tags: ["stat", "knockback"],
    weight: 3,
    maxStacks: 5,
    mods: { knockbackMult: 0.2 }
  },

  pierceCore: {
    id: "pierceCore",
    name: "PIERCE CORE",
    desc: "+1 projectile pierce",
    rarity: "uncommon",
    tags: ["projectile", "hit", "bullet"],
    weight: 4,
    maxStacks: 4,
    effects: [
      { type: "pierce", count: 1 }
    ]
  },

  critChip: {
    id: "critChip",
    name: "CRIT CHIP",
    desc: "+10% crit, x2 damage",
    rarity: "uncommon",
    tags: ["projectile", "damage", "crit"],
    weight: 4,
    maxStacks: 5,
    effects: [
      { type: "crit", chance: 0.1, multiplier: 2 }
    ]
  },

  burnMark: {
    id: "burnMark",
    name: "BURN MARK",
    desc: "hits add digital burn",
    rarity: "uncommon",
    tags: ["projectile", "status", "burn"],
    weight: 3,
    maxStacks: 4,
    effects: [
      { type: "burn", dps: 7, duration: 1.8 }
    ]
  },

  ricochetCore: {
    id: "ricochetCore",
    name: "RICOCHET CORE",
    desc: "shots bounce from walls",
    rarity: "uncommon",
    tags: ["projectile", "wall", "bounce"],
    weight: 3,
    maxStacks: 3,
    effects: [
      { type: "ricochet", count: 1 }
    ]
  },

  chainFork: {
    id: "chainFork",
    name: "CHAIN FORK",
    desc: "hits arc to another enemy",
    rarity: "rare",
    tags: ["projectile", "chain", "damage"],
    weight: 2,
    maxStacks: 3,
    effects: [
      { type: "chainLightning", jumps: 1, damage: 8, range: 230, falloff: 0.72 }
    ]
  },

  poisonLeak: {
    id: "poisonLeak",
    name: "POISON LEAK",
    desc: "hits add slow poison",
    rarity: "uncommon",
    tags: ["projectile", "status", "poison", "slow"],
    weight: 2,
    maxStacks: 4,
    effects: [
      { type: "poison", dps: 4, duration: 2.4, slow: 0.08 }
    ]
  },

  freezeByte: {
    id: "freezeByte",
    name: "FREEZE BYTE",
    desc: "hits slow enemies",
    rarity: "uncommon",
    tags: ["projectile", "status", "freeze", "control"],
    weight: 2,
    maxStacks: 3,
    effects: [
      { type: "freeze", duration: 1.15, slow: 0.18 }
    ]
  },

  homingCore: {
    id: "homingCore",
    name: "HOMING CORE",
    desc: "+homing strength",
    rarity: "rare",
    tags: ["weapon", "seeker", "homing"],
    weight: 2,
    maxStacks: 4,
    effects: [
      { type: "homingCore", weaponIds: ["seeker"], strength: 2.5, acquireRange: 100 }
    ]
  },

  splitRockets: {
    id: "splitRockets",
    name: "SPLIT ROCKETS",
    desc: "rockets split on detonation",
    rarity: "rare",
    tags: ["weapon", "rocket", "explosion"],
    weight: 1,
    maxStacks: 2,
    effects: [
      { type: "splitRockets", weaponIds: ["rocket"], count: 2, damage: 10, speed: 520, range: 420 }
    ]
  },

  clusterBomb: {
    id: "clusterBomb",
    name: "CLUSTER BOMB",
    desc: "explosions spawn fragments",
    rarity: "rare",
    tags: ["weapon", "rocket", "explosion"],
    weight: 1,
    maxStacks: 2,
    effects: [
      { type: "clusterBomb", weaponIds: ["rocket"], count: 3, radius: 38, damage: 12, spread: 118 }
    ]
  },

  magnet: {
    id: "magnet",
    name: "MAGNET",
    desc: "loot drifts toward you",
    rarity: "common",
    tags: ["loot", "player", "utility"],
    weight: 3,
    maxStacks: 4,
    effects: [
      { type: "magnet", scope: "player", radius: 90, force: 260 }
    ]
  },

  luck: {
    id: "luck",
    name: "LUCK",
    desc: "+loot drop chance",
    rarity: "uncommon",
    tags: ["loot", "economy"],
    weight: 2,
    maxStacks: 4,
    effects: [
      { type: "luck", scope: "player", dropChance: 0.045, rare: 0.08, rareReservedFor: "future loot value / rarity weighting" }
    ]
  },

  shield: {
    id: "shield",
    name: "SHIELD",
    desc: "blocks one touch hit",
    rarity: "uncommon",
    tags: ["player", "defense"],
    weight: 2,
    maxStacks: 2,
    effects: [
      { type: "shield", scope: "player", charges: 1, cooldown: 7.5 }
    ]
  },

  teleportDash: {
    id: "teleportDash",
    name: "TELEPORT DASH",
    desc: "SHIFT blink + afterimage",
    rarity: "rare",
    tags: ["player", "movement", "active", "dash"],
    weight: 2,
    maxStacks: 1,
    effects: [
      { type: "teleportDash", scope: "player", distance: 210, cooldown: 3.6, invuln: 0.14 },
      { type: "afterimage", scope: "player", duration: 0.28, count: 3 }
    ]
  },
  orbital: {
    id: "orbital",
    name: "ORBITAL",
    desc: "small satellite damages nearby enemies",
    rarity: "rare",
    tags: ["player", "companion", "orbital", "damage"],
    weight: 2,
    maxStacks: 3,
    effects: [
      { type: "orbital", scope: "player", count: 1, damage: 7, radius: 78, orbitSpeed: 1.35, hitCooldown: 0.38 }
    ]
  },

  drone: {
    id: "drone",
    name: "DRONE",
    desc: "auto-shooter companion",
    rarity: "rare",
    tags: ["player", "companion", "drone", "auto-shooter"],
    weight: 2,
    maxStacks: 3,
    effects: [
      { type: "drone", scope: "player", count: 1, damage: 8, radius: 54, range: 540, fireRate: 0.82, orbitSpeed: 0.72 }
    ]
  },


  lifesteal: {
    id: "lifesteal",
    name: "LIFESTEAL",
    desc: "heal from direct/chain/explosion damage",
    rarity: "rare",
    tags: ["projectile", "sustain"],
    weight: 2,
    maxStacks: 3,
    effects: [
      { type: "lifesteal", percent: 0.035 }
    ]
  },

  berserk: {
    id: "berserk",
    name: "BERSERK",
    desc: "+damage at low HP",
    rarity: "rare",
    tags: ["player", "damage", "low-hp"],
    weight: 2,
    maxStacks: 3,
    effects: [
      { type: "berserk", damage: 0.18, threshold: 0.36 }
    ]
  },

  teamAura: {
    id: "teamAura",
    name: "TEAM AURA",
    desc: "+damage near allies",
    rarity: "rare",
    tags: ["team", "damage"],
    weight: 2,
    maxStacks: 3,
    effects: [
      { type: "teamAura", damage: 0.08, radius: 210 }
    ]
  }
};

export const UPGRADE_IDS = Object.keys(UPGRADES);
export const UPGRADE_RARITIES = ["common", "uncommon", "rare", "corrupted"];
export const RARITY_META = Object.freeze({
  common: { id: "common", label: "COMMON", weight: 1, color: "white" },
  uncommon: { id: "uncommon", label: "UNCOMMON", weight: 0.68, color: "green" },
  rare: { id: "rare", label: "RARE", weight: 0.34, color: "green" },
  corrupted: { id: "corrupted", label: "CORRUPTED", weight: 0.08, color: "red", reservedFor: "future cursed upgrades" }
});
export const UPGRADE_TAGS = Array.from(new Set(Object.values(UPGRADES).flatMap((u) => u.tags || []))).sort();

export function getUpgrade(id) {
  return UPGRADES[id] || null;
}

export function upgradeHasTag(id, tag) {
  return !!UPGRADES[id]?.tags?.includes(tag);
}

export function upgradesByTag(tag) {
  return UPGRADE_IDS.filter((id) => upgradeHasTag(id, tag));
}

export function stackCount(player, id) {
  return player?.upgrades?.taken?.[id] || 0;
}

export function canOfferUpgrade(player, id) {
  const upgrade = getUpgrade(id);
  if (!upgrade) return false;
  return stackCount(player, id) < (upgrade.maxStacks || 1);
}

function rarityWeight(upgrade, state = null) {
  const rarity = upgrade?.rarity || "common";
  const base = RARITY_META[rarity]?.weight ?? 1;
  const depth = Math.max(0, Math.min(12, state?.locationIndex || 0));
  if (rarity === "rare") return base * (1 + depth * 0.055);
  if (rarity === "uncommon") return base * (1 + depth * 0.025);
  if (rarity === "common") return base * Math.max(0.72, 1 - depth * 0.018);
  return base;
}

function repeatPenalty(player, id) {
  const offered = player?.upgrades?.offered?.[id] || 0;
  const stacks = stackCount(player, id);
  return Math.pow(0.82, offered) * Math.pow(0.74, stacks);
}

export function scoreUpgradeCandidate(player, id, state = null) {
  const upgrade = getUpgrade(id);
  if (!upgrade || !canOfferUpgrade(player, id)) return { score: 0, hints: [], synergyIds: [] };
  const synergy = synergyOfferMeta(player, id, upgrade);
  const score = Math.max(0, (upgrade.weight || 1) * rarityWeight(upgrade, state) * repeatPenalty(player, id) * synergy.multiplier);
  return {
    score,
    rarity: upgrade.rarity || "common",
    hints: synergy.hints || [],
    synergyIds: synergy.synergyIds || [],
    nextStack: stackCount(player, id) + 1,
    maxStacks: upgrade.maxStacks || 1
  };
}

function weightedPick(rng, scored) {
  const total = scored.reduce((sum, item) => sum + item.score, 0);
  if (!(total > 0)) return scored[0]?.id || null;
  let roll = rng.range(0, total);
  for (const item of scored) {
    roll -= item.score;
    if (roll <= 0) return item.id;
  }
  return scored.at(-1)?.id || null;
}

export function rollUpgradeOffer(rng, player, count = 3, state = null) {
  const pool = UPGRADE_IDS.filter((id) => canOfferUpgrade(player, id));
  const choices = [];
  const offers = {};

  while (choices.length < count && pool.length) {
    const scored = pool.map((id) => ({ id, ...scoreUpgradeCandidate(player, id, state) })).filter((item) => item.score > 0);
    if (!scored.length) break;
    const picked = weightedPick(rng, scored);
    if (!picked) break;
    const meta = scoreUpgradeCandidate(player, picked, state);
    choices.push(picked);
    offers[picked] = {
      rarity: meta.rarity,
      hints: meta.hints,
      synergyIds: meta.synergyIds,
      nextStack: meta.nextStack,
      maxStacks: meta.maxStacks
    };
    pool.splice(pool.indexOf(picked), 1);
  }

  return { choices, offers };
}

export function rollUpgradeChoices(rng, player, count = 3, state = null) {
  return rollUpgradeOffer(rng, player, count, state).choices;
}
