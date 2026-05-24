import {
  MODIFIER_BUDGET_FIELDS,
  MODIFIER_DOMAINS,
  MODIFIER_FEATURES,
  MODIFIER_ORDER_PHASES,
  MODIFIER_POLARITIES,
  MODIFIER_RARITIES,
  MODIFIER_STACK_SCHEMA_VERSION,
  ROOM_MODIFIER_COMMAND_TYPES,
  ROOM_MODIFIER_HOOKS
} from "./modifierDomains.js";

export const RULE_MODIFIER_IDS = Object.freeze({
  GRID_STATIC: "grid_static",
  VOID_DRIFT: "void_drift",
  CORE_PRESSURE: "core_pressure",
  BOSS_LOCK: "boss_lock",
  REWARD_CACHE: "reward_cache",
  CASINO_FLOOR: "casino_floor",
  STATIC_FIELD: "static_field",
  LIVE_CHAT_HATES_YOU: "live_chat_hates_you",
  ALGORITHM_BOOST: "algorithm_boost",
  STATIC_GOD: "static_god"
});

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function normalizeArray(value = []) {
  return Object.freeze([...new Set((Array.isArray(value) ? value : []).filter(Boolean))]);
}

function normalizeBudget(budget = {}) {
  const normalized = {};
  for (const field of MODIFIER_BUDGET_FIELDS) {
    const value = budget[field];
    normalized[field] = Number.isFinite(value) && value >= 0 ? value : 0;
  }
  return Object.freeze(normalized);
}

function normalizeHooks(hooks = {}) {
  const normalized = {};
  for (const [hookName, commands] of Object.entries(hooks || {})) {
    normalized[hookName] = Object.freeze((Array.isArray(commands) ? commands : []).map((command) => deepFreeze({ ...command })));
  }
  return Object.freeze(normalized);
}

function ruleModifier(config) {
  const modifier = {
    schemaVersion: MODIFIER_STACK_SCHEMA_VERSION,
    id: config.id,
    domain: config.domain || MODIFIER_DOMAINS.ROOM,
    name: config.name,
    description: config.description,
    category: config.category || "identity",
    polarity: config.polarity || MODIFIER_POLARITIES.NEUTRAL,
    rarity: config.rarity || MODIFIER_RARITIES.SPECIAL,
    order: config.order || MODIFIER_ORDER_PHASES.IDENTITY,
    tags: normalizeArray(config.tags),
    conflictsWith: normalizeArray(config.conflictsWith),
    requires: normalizeArray(config.requires),
    weight: Number.isFinite(config.weight) && config.weight >= 0 ? config.weight : 1,
    maxStacks: Number.isInteger(config.maxStacks) && config.maxStacks >= 1 ? config.maxStacks : 1,
    budget: normalizeBudget(config.budget),
    hooks: normalizeHooks(config.hooks)
  };
  return deepFreeze(modifier);
}

export const RULE_MODIFIERS = deepFreeze({
  [RULE_MODIFIER_IDS.GRID_STATIC]: ruleModifier({
    id: RULE_MODIFIER_IDS.GRID_STATIC,
    domain: MODIFIER_DOMAINS.ROOM,
    name: "GRID STATIC",
    description: "baseline signal noise",
    category: "identity",
    polarity: MODIFIER_POLARITIES.NEUTRAL,
    rarity: MODIFIER_RARITIES.SPECIAL,
    order: MODIFIER_ORDER_PHASES.IDENTITY,
    tags: ["grid", "identity"],
    weight: 0,
    budget: { readability: 0, danger: 0, performance: 0, chaos: 0 },
    hooks: {}
  }),

  [RULE_MODIFIER_IDS.VOID_DRIFT]: ruleModifier({
    id: RULE_MODIFIER_IDS.VOID_DRIFT,
    domain: MODIFIER_DOMAINS.ROOM,
    name: "VOID DRIFT",
    description: "void room identity contract",
    category: "identity",
    polarity: MODIFIER_POLARITIES.NEUTRAL,
    rarity: MODIFIER_RARITIES.SPECIAL,
    order: MODIFIER_ORDER_PHASES.IDENTITY,
    tags: ["void", "identity"],
    weight: 0,
    budget: { readability: 0, danger: 0, performance: 0, chaos: 0 },
    hooks: {}
  }),

  [RULE_MODIFIER_IDS.CORE_PRESSURE]: ruleModifier({
    id: RULE_MODIFIER_IDS.CORE_PRESSURE,
    domain: MODIFIER_DOMAINS.ROOM,
    name: "CORE PRESSURE",
    description: "core room identity contract",
    category: "identity",
    polarity: MODIFIER_POLARITIES.NEUTRAL,
    rarity: MODIFIER_RARITIES.SPECIAL,
    order: MODIFIER_ORDER_PHASES.IDENTITY,
    tags: ["core", "identity"],
    weight: 0,
    budget: { readability: 0, danger: 0, performance: 0, chaos: 0 },
    hooks: {}
  }),

  [RULE_MODIFIER_IDS.BOSS_LOCK]: ruleModifier({
    id: RULE_MODIFIER_IDS.BOSS_LOCK,
    domain: MODIFIER_DOMAINS.ROOM,
    name: "BOSS LOCK",
    description: "boss objective identity contract",
    category: "identity",
    polarity: MODIFIER_POLARITIES.NEUTRAL,
    rarity: MODIFIER_RARITIES.SPECIAL,
    order: MODIFIER_ORDER_PHASES.IDENTITY,
    tags: ["boss", "identity"],
    weight: 0,
    budget: { readability: 0, danger: 0, performance: 0, chaos: 0 },
    hooks: {}
  }),

  [RULE_MODIFIER_IDS.REWARD_CACHE]: ruleModifier({
    id: RULE_MODIFIER_IDS.REWARD_CACHE,
    domain: MODIFIER_DOMAINS.ROOM,
    name: "REWARD CACHE",
    description: "rare reward room identity contract",
    category: "identity",
    polarity: MODIFIER_POLARITIES.POSITIVE,
    rarity: MODIFIER_RARITIES.SPECIAL,
    order: MODIFIER_ORDER_PHASES.REWARD,
    tags: ["rare", "reward", "identity"],
    weight: 0,
    budget: { readability: 0, danger: 0, performance: 0, chaos: 0 },
    hooks: {}
  }),

  [RULE_MODIFIER_IDS.CASINO_FLOOR]: ruleModifier({
    id: RULE_MODIFIER_IDS.CASINO_FLOOR,
    domain: MODIFIER_DOMAINS.ROOM,
    name: "CASINO FLOOR",
    description: "rare reward activity room: one data-driven gamble terminal, no economy system yet",
    category: "reward-activity",
    polarity: MODIFIER_POLARITIES.MIXED,
    rarity: MODIFIER_RARITIES.SPECIAL,
    order: MODIFIER_ORDER_PHASES.REWARD,
    tags: ["rare", "reward", "casino", "activity", "identity"],
    requires: [MODIFIER_FEATURES.INTERACTABLES],
    weight: 0,
    budget: { readability: 0, danger: 0, performance: 0, chaos: 1 },
    hooks: {
      [ROOM_MODIFIER_HOOKS.ROOM_ENTER]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.EMIT_EVENT, event: { type: "room_modifier", text: "CASINO FLOOR: SIGNAL SLOT ONLINE" } }
      ],
      [ROOM_MODIFIER_HOOKS.RENDER_BACKGROUND]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.SET, field: "accent", value: "white" },
        { type: ROOM_MODIFIER_COMMAND_TYPES.SET, field: "gridStep", value: 68 }
      ]
    }
  }),


  [RULE_MODIFIER_IDS.STATIC_FIELD]: ruleModifier({
    id: RULE_MODIFIER_IDS.STATIC_FIELD,
    domain: MODIFIER_DOMAINS.ROOM,
    name: "STATIC FIELD",
    description: "cursed event field: enemies move faster, healing is reduced, background signal shifts",
    category: "cursed",
    polarity: MODIFIER_POLARITIES.NEGATIVE,
    rarity: MODIFIER_RARITIES.RARE,
    order: MODIFIER_ORDER_PHASES.PRESSURE,
    tags: ["rare", "event", "cursed", "static"],
    weight: 1,
    budget: { readability: 1, danger: 2, performance: 0, chaos: 1 },
    hooks: {
      [ROOM_MODIFIER_HOOKS.ROOM_ENTER]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.EMIT_EVENT, event: { type: "room_modifier", text: "STATIC FIELD ONLINE" } }
      ],
      [ROOM_MODIFIER_HOOKS.ENEMY_UPDATE]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.SCALE, field: "speedMult", factor: 1.1, max: 1.6 }
      ],
      [ROOM_MODIFIER_HOOKS.PLAYER_HEAL]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.SCALE, field: "amount", factor: 0.55, min: 0 }
      ],
      [ROOM_MODIFIER_HOOKS.RENDER_BACKGROUND]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.SET, field: "accent", value: "white" },
        { type: ROOM_MODIFIER_COMMAND_TYPES.SET, field: "gridStep", value: 52 }
      ]
    }
  }),

  [RULE_MODIFIER_IDS.LIVE_CHAT_HATES_YOU]: ruleModifier({
    id: RULE_MODIFIER_IDS.LIVE_CHAT_HATES_YOU,
    domain: MODIFIER_DOMAINS.ROOM,
    name: "LIVE CHAT HATES YOU",
    description: "negative broadcast pressure: the room feeds extra spawn tempo and enemy cap into the director",
    category: "pressure",
    polarity: MODIFIER_POLARITIES.NEGATIVE,
    rarity: MODIFIER_RARITIES.UNCOMMON,
    order: MODIFIER_ORDER_PHASES.PRESSURE,
    tags: ["broadcast", "pressure", "director", "viral"],
    weight: 1,
    budget: { readability: 1, danger: 2, performance: 1, chaos: 2 },
    hooks: {
      [ROOM_MODIFIER_HOOKS.ROOM_ENTER]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.EMIT_EVENT, event: { type: "room_modifier", text: "LIVE CHAT HATES YOU" } }
      ],
      [ROOM_MODIFIER_HOOKS.DIRECTOR_CAP]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.ADD, field: "enemyCap", value: 2, max: 36 }
      ],
      [ROOM_MODIFIER_HOOKS.DIRECTOR_SPAWN]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.ADD, field: "batch", value: 1, max: 6, requiresTags: ["batch"] },
        { type: ROOM_MODIFIER_COMMAND_TYPES.SCALE, field: "interval", factor: 0.92, min: 0.35, requiresTags: ["interval"] }
      ],
      [ROOM_MODIFIER_HOOKS.RENDER_BACKGROUND]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.SET, field: "gridStep", value: 64 }
      ]
    }
  }),

  [RULE_MODIFIER_IDS.ALGORITHM_BOOST]: ruleModifier({
    id: RULE_MODIFIER_IDS.ALGORITHM_BOOST,
    domain: MODIFIER_DOMAINS.ROOM,
    name: "ALGORITHM BOOST",
    description: "mixed reward tradeoff: better loot rolls, but the director and enemy bodies get a small pressure bump",
    category: "reward-risk",
    polarity: MODIFIER_POLARITIES.MIXED,
    rarity: MODIFIER_RARITIES.UNCOMMON,
    order: MODIFIER_ORDER_PHASES.REWARD,
    tags: ["reward", "risk", "loot", "director"],
    requires: [MODIFIER_FEATURES.LOOT],
    weight: 1,
    budget: { readability: 0, danger: 1, performance: 0, chaos: 1 },
    hooks: {
      [ROOM_MODIFIER_HOOKS.ROOM_ENTER]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.EMIT_EVENT, event: { type: "room_modifier", text: "ALGORITHM BOOST: REWARD SIGNAL UP" } }
      ],
      [ROOM_MODIFIER_HOOKS.DIRECTOR_BUDGET]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.ADD, field: "budget", value: 2 }
      ],
      [ROOM_MODIFIER_HOOKS.ENEMY_SPAWN]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.SCALE, field: "hp", factor: 1.08 },
        { type: ROOM_MODIFIER_COMMAND_TYPES.SCALE, field: "maxHp", factor: 1.08 }
      ],
      [ROOM_MODIFIER_HOOKS.LOOT_ROLL]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.SCALE, field: "chance", factor: 1.25, max: 1 },
        { type: ROOM_MODIFIER_COMMAND_TYPES.ADD, field: "rareBonus", value: 0.08, max: 1 }
      ]
    }
  }),

  [RULE_MODIFIER_IDS.STATIC_GOD]: ruleModifier({
    id: RULE_MODIFIER_IDS.STATIC_GOD,
    domain: MODIFIER_DOMAINS.ROOM,
    name: "STATIC GOD",
    description: "mixed projectile rule: hostile bullets drift slower while the room gains harsher static identity",
    category: "projectile-rule",
    polarity: MODIFIER_POLARITIES.MIXED,
    rarity: MODIFIER_RARITIES.RARE,
    order: MODIFIER_ORDER_PHASES.STRUCTURAL,
    tags: ["projectile", "hostile", "static", "chaos"],
    requires: [MODIFIER_FEATURES.HOSTILE_PROJECTILES],
    weight: 1,
    budget: { readability: 1, danger: 1, performance: 1, chaos: 3 },
    hooks: {
      [ROOM_MODIFIER_HOOKS.ROOM_ENTER]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.EMIT_EVENT, event: { type: "room_modifier", text: "STATIC GOD ENTERED THE ROOM" } }
      ],
      [ROOM_MODIFIER_HOOKS.PROJECTILE_UPDATE]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.SCALE, field: "speedMult", factor: 0.78, min: 0.25, requiresTags: ["hostile"] }
      ],
      [ROOM_MODIFIER_HOOKS.PROJECTILE_WALL]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.TAG, tag: "static_wall_hit", requiresTags: ["hostile"] }
      ],
      [ROOM_MODIFIER_HOOKS.RENDER_BACKGROUND]: [
        { type: ROOM_MODIFIER_COMMAND_TYPES.SET, field: "accent", value: "white" },
        { type: ROOM_MODIFIER_COMMAND_TYPES.SET, field: "gridStep", value: 44 }
      ]
    }
  })
});

function modifiersForDomain(domain) {
  return Object.freeze(Object.fromEntries(
    Object.entries(RULE_MODIFIERS).filter(([, modifier]) => modifier.domain === domain)
  ));
}

export const RULE_MODIFIERS_BY_DOMAIN = deepFreeze({
  [MODIFIER_DOMAINS.ROOM]: modifiersForDomain(MODIFIER_DOMAINS.ROOM),
  [MODIFIER_DOMAINS.WEAPON]: modifiersForDomain(MODIFIER_DOMAINS.WEAPON),
  [MODIFIER_DOMAINS.ABILITY]: modifiersForDomain(MODIFIER_DOMAINS.ABILITY),
  [MODIFIER_DOMAINS.HERO]: modifiersForDomain(MODIFIER_DOMAINS.HERO),
  [MODIFIER_DOMAINS.ENEMY]: modifiersForDomain(MODIFIER_DOMAINS.ENEMY),
  [MODIFIER_DOMAINS.BOSS]: modifiersForDomain(MODIFIER_DOMAINS.BOSS),
  [MODIFIER_DOMAINS.LOOP]: modifiersForDomain(MODIFIER_DOMAINS.LOOP),
  [MODIFIER_DOMAINS.VIRAL]: modifiersForDomain(MODIFIER_DOMAINS.VIRAL)
});

export function getRuleModifier(modifierId) {
  return RULE_MODIFIERS[modifierId] || null;
}

export function getRuleModifierInDomain(modifierId, domain) {
  const modifier = getRuleModifier(modifierId);
  return modifier?.domain === domain ? modifier : null;
}

export function resolveRuleModifiers(modifierIds = [], domain = null) {
  return [...new Set(modifierIds)]
    .map((modifierId) => domain ? getRuleModifierInDomain(modifierId, domain) : getRuleModifier(modifierId))
    .filter(Boolean);
}

export function ruleModifierSnapshot(modifier) {
  return {
    id: modifier.id,
    name: modifier.name,
    description: modifier.description,
    domain: modifier.domain,
    category: modifier.category,
    polarity: modifier.polarity,
    rarity: modifier.rarity,
    order: modifier.order,
    tags: [...(modifier.tags || [])],
    budget: { ...(modifier.budget || {}) }
  };
}
