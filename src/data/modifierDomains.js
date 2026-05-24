export const MODIFIER_STACK_SCHEMA_VERSION = 1;

export const MODIFIER_DOMAINS = Object.freeze({
  ROOM: "room",
  WEAPON: "weapon",
  ABILITY: "ability",
  HERO: "hero",
  ENEMY: "enemy",
  BOSS: "boss",
  LOOP: "loop",
  VIRAL: "viral"
});

export const MODIFIER_DOMAIN_IDS = Object.freeze(Object.values(MODIFIER_DOMAINS));

export const MODIFIER_POLARITIES = Object.freeze({
  NEGATIVE: "negative",
  POSITIVE: "positive",
  MIXED: "mixed",
  NEUTRAL: "neutral"
});

export const MODIFIER_RARITIES = Object.freeze({
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary",
  SPECIAL: "special"
});

export const MODIFIER_BUDGET_FIELDS = Object.freeze([
  "readability",
  "danger",
  "performance",
  "chaos"
]);

export const MODIFIER_FEATURES = Object.freeze({
  HOSTILE_PROJECTILES: "hostileProjectiles",
  WALLS: "walls",
  LOOT: "loot",
  ELITES: "elites",
  ARMOR: "armor",
  INTERACTABLES: "interactables",
  ACTIVE_ABILITIES: "activeAbilities"
});

export const ROOM_MODIFIER_HOOKS = Object.freeze({
  ROOM_ENTER: "room:enter",
  ROOM_EXIT: "room:exit",
  DIRECTOR_BUDGET: "director:budget",
  DIRECTOR_SPAWN: "director:spawn",
  DIRECTOR_CAP: "director:cap",
  ENEMY_SPAWN: "enemy:spawn",
  ENEMY_UPDATE: "enemy:update",
  PROJECTILE_UPDATE: "projectile:update",
  PROJECTILE_WALL: "projectile:wall",
  PROJECTILE_DAMAGE: "projectile:damage",
  PLAYER_DAMAGE: "player:damage",
  PLAYER_HEAL: "player:heal",
  LOOT_ROLL: "loot:roll",
  PORTAL_OPEN: "portal:open",
  RENDER_BACKGROUND: "render:background"
});

export const ROOM_MODIFIER_COMMAND_TYPES = Object.freeze({
  ADD: "add",
  SCALE: "scale",
  SET: "set",
  TAG: "tag",
  EMIT_EVENT: "emitEvent"
});

export const MODIFIER_ORDER_PHASES = Object.freeze({
  IDENTITY: "identity",
  STRUCTURAL: "structural",
  PRESSURE: "pressure",
  REWARD: "reward",
  FLAVOR: "flavor"
});

export function isKnownModifierDomain(domain) {
  return MODIFIER_DOMAIN_IDS.includes(domain);
}
