export const EFFECT_HOOKS = Object.freeze({
  PROJECTILE_UPDATE: "projectile:update",
  PROJECTILE_DAMAGE: "projectile:damage",
  PROJECTILE_HIT: "projectile:hit",
  PROJECTILE_KILL: "projectile:kill",
  PROJECTILE_EXPIRE: "projectile:expire",
  PROJECTILE_WALL: "projectile:wall",
  ENEMY_STATUS_TICK: "enemy:statusTick",
  PLAYER_TICK: "player:tick",
  PLAYER_DAMAGE: "player:damage",
  PLAYER_HEAL: "player:heal",
  PLAYER_HIT: "player:hit",
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
  chainStatus: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT], merge: { statusScale: "max" }, tags: ["synergy", "chain", "status"] },
  splitRockets: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_EXPIRE], merge: { count: "sum", damage: "sum", speed: "max" } },
  clusterBomb: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_EXPIRE], merge: { count: "sum", radius: "max", damage: "sum" } },

  // Player/world systems. These run through the same hook dispatcher as projectile effects.
  // ARCHITECTURE GUARD: do not add direct player/loot gameplay mutations in callers;
  // add a hook + handler here, then route through runPlayerHook()/runLootHook().
  shield: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK, EFFECT_HOOKS.PLAYER_DAMAGE], merge: { charges: "sum", cooldown: "min" } },
  magnet: { scope: "player", hooks: [EFFECT_HOOKS.LOOT_ATTRACT], merge: { radius: "sum", force: "sum" } },
  luck: { scope: "player", hooks: [EFFECT_HOOKS.LOOT_ROLL], merge: { dropChance: "sumClamp", rare: "sumClamp" }, clamp: { dropChance: [0, 0.85], rare: [0, 1] }, reservedFields: { rare: "future loot value / rarity weighting" } },
  teleportDash: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK, EFFECT_HOOKS.PLAYER_DAMAGE], merge: { distance: "max", cooldown: "min", invuln: "max" } },
  afterimage: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { duration: "max", count: "sum" } },
  orbital: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { count: "sum", damage: "sum", radius: "max", orbitSpeed: "max", hitCooldown: "min" }, tags: ["companion", "contact"] },
  drone: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { count: "sum", damage: "sum", radius: "max", range: "max", fireRate: "sum", orbitSpeed: "max" }, tags: ["companion", "auto-shooter"] },
  companionBoost: { scope: "player", hooks: [EFFECT_HOOKS.PLAYER_TICK], merge: { damageMult: "sum", hitCooldownMult: "sum", rangeMult: "sum" }, tags: ["synergy", "companion"] },
  homingCore: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_UPDATE], merge: { strength: "sum", acquireRange: "max" } },

  // Visual-only data hooks are intentionally harmless.
  spark: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT], merge: { count: "sum" } },
  hitShake: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_HIT], merge: { power: "max", life: "max" } },
  screenShake: { scope: "projectile", hooks: [EFFECT_HOOKS.PROJECTILE_EXPIRE], merge: { power: "max" } }
});

export const DAMAGE_TAGS = Object.freeze({
  DIRECT: "direct",
  PROJECTILE: "projectile",
  EXPLOSION: "explosion",
  CHAIN: "chain",
  STATUS: "status",
  PLAYER: "player",
  ENEMY: "enemy",
  TOUCH: "touch",
  BURN: "burn",
  POISON: "poison",
  FREEZE: "freeze",
  COMPANION: "companion",
  HEAL: "heal"
});

export function numberOr(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
