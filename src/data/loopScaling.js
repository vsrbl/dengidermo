export const LOOP_ESCALATION_SCHEMA_VERSION = 1;

export const LOOP_ESCALATION_FEATURES = Object.freeze({
  ENEMY_POOL_BIAS: "enemy_pool_bias",
  ELITE_VARIANTS: "elite_variants",
  ARMOR_VARIANTS: "armor_variants",
  MODIFIER_STACKING: "modifier_stacking",
  DIRECTOR_PRESSURE: "director_pressure"
});

const IDENTITY_DIRECTOR = Object.freeze({
  budgetMultiplier: 1,
  capMultiplier: 1,
  batchMultiplier: 1,
  intervalMultiplier: 1,
  intensityMultiplier: 1
});

const EMPTY_ENEMY_POOL = Object.freeze({
  tierBias: 0,
  add: Object.freeze([]),
  prefer: Object.freeze([]),
  exclude: Object.freeze([])
});

const EMPTY_ELITE = Object.freeze({
  chance: 0,
  variantIds: Object.freeze([])
});

const EMPTY_ARMOR = Object.freeze({
  variantChance: 0,
  variantIds: Object.freeze([])
});

const EMPTY_MODIFIERS = Object.freeze({
  stackChance: 0,
  maxExtraModifiers: 0,
  modifierIds: Object.freeze([])
});

function loopProfile({
  id,
  name,
  minLoop,
  maxLoop = null,
  enabled = true,
  phase = "foundation",
  director = IDENTITY_DIRECTOR,
  enemyPool = EMPTY_ENEMY_POOL,
  elite = EMPTY_ELITE,
  armor = EMPTY_ARMOR,
  modifiers = EMPTY_MODIFIERS,
  features = Object.freeze([]),
  reservedFor = null
}) {
  return Object.freeze({
    id,
    name,
    minLoop,
    maxLoop,
    enabled,
    phase,
    director: Object.freeze({ ...IDENTITY_DIRECTOR, ...director }),
    enemyPool: Object.freeze({
      ...EMPTY_ENEMY_POOL,
      ...enemyPool,
      add: Object.freeze([...(enemyPool.add || [])]),
      prefer: Object.freeze([...(enemyPool.prefer || [])]),
      exclude: Object.freeze([...(enemyPool.exclude || [])])
    }),
    elite: Object.freeze({
      ...EMPTY_ELITE,
      ...elite,
      variantIds: Object.freeze([...(elite.variantIds || [])])
    }),
    armor: Object.freeze({
      ...EMPTY_ARMOR,
      ...armor,
      variantIds: Object.freeze([...(armor.variantIds || [])])
    }),
    modifiers: Object.freeze({
      ...EMPTY_MODIFIERS,
      ...modifiers,
      modifierIds: Object.freeze([...(modifiers.modifierIds || [])])
    }),
    features: Object.freeze([...features]),
    reservedFor
  });
}

export const LOOP_ESCALATION_PROFILES = Object.freeze([
  loopProfile({
    id: "loop0_baseline",
    name: "LOOP 0 BASELINE",
    minLoop: 0,
    maxLoop: 0,
    phase: "baseline"
  }),

  loopProfile({
    id: "loop1_foundation",
    name: "LOOP 1 FOUNDATION",
    minLoop: 1,
    maxLoop: 1,
    features: Object.freeze([
      LOOP_ESCALATION_FEATURES.ENEMY_POOL_BIAS,
      LOOP_ESCALATION_FEATURES.MODIFIER_STACKING,
      LOOP_ESCALATION_FEATURES.DIRECTOR_PRESSURE
    ]),
    modifiers: Object.freeze({
      stackChance: 0.08,
      maxExtraModifiers: 1,
      modifierIds: Object.freeze(["algorithm_boost"])
    }),
    reservedFor: "first cautious room modifier stack vertical slice; low chance, reward-risk only from v39.3.x"
  }),

  loopProfile({
    id: "loop2_plus_foundation",
    name: "LOOP 2+ FOUNDATION",
    minLoop: 2,
    maxLoop: null,
    features: Object.freeze([
      LOOP_ESCALATION_FEATURES.ENEMY_POOL_BIAS,
      LOOP_ESCALATION_FEATURES.ELITE_VARIANTS,
      LOOP_ESCALATION_FEATURES.ARMOR_VARIANTS,
      LOOP_ESCALATION_FEATURES.MODIFIER_STACKING,
      LOOP_ESCALATION_FEATURES.DIRECTOR_PRESSURE
    ]),
    elite: Object.freeze({
      chance: 0.06,
      variantIds: Object.freeze(["overcharged"])
    }),
    armor: Object.freeze({
      variantChance: 0.04,
      variantIds: Object.freeze(["linked"])
    }),
    modifiers: Object.freeze({
      stackChance: 0.14,
      maxExtraModifiers: 4,
      modifierIds: Object.freeze(["live_chat_hates_you", "algorithm_boost", "static_god"])
    }),
    reservedFor: "first elite + linked armor slices plus cautious room modifier stack vertical slice from v39.3.x"
  }),

  loopProfile({
    id: "high_loop_escalation_reserved",
    name: "HIGH LOOP ESCALATION RESERVED",
    minLoop: 6,
    maxLoop: null,
    enabled: false,
    phase: "reserved",
    director: Object.freeze({
      budgetMultiplier: 1.06,
      capMultiplier: 1,
      batchMultiplier: 1,
      intervalMultiplier: 0.98,
      intensityMultiplier: 1.04
    }),
    enemyPool: Object.freeze({
      tierBias: 0.18,
      add: Object.freeze([]),
      prefer: Object.freeze(["shooter", "tank"]),
      exclude: Object.freeze([])
    }),
    elite: Object.freeze({
      chance: 0.08,
      variantIds: Object.freeze(["overcharged"])
    }),
    armor: Object.freeze({
      variantChance: 0.05,
      variantIds: Object.freeze(["linked"])
    }),
    modifiers: Object.freeze({
      stackChance: 0.04,
      maxExtraModifiers: 1,
      modifierIds: Object.freeze([])
    }),
    features: Object.freeze([
      LOOP_ESCALATION_FEATURES.ENEMY_POOL_BIAS,
      LOOP_ESCALATION_FEATURES.ELITE_VARIANTS,
      LOOP_ESCALATION_FEATURES.ARMOR_VARIANTS,
      LOOP_ESCALATION_FEATURES.MODIFIER_STACKING,
      LOOP_ESCALATION_FEATURES.DIRECTOR_PRESSURE
    ]),
    reservedFor: "future high-loop pressure after browser feel/QA"
  })
]);

export const DEFAULT_LOOP_ESCALATION_PROFILE = LOOP_ESCALATION_PROFILES[0];
