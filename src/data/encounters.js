export const ENCOUNTER_STAGE_WHEN = Object.freeze({
  BEFORE_CALM_END: "beforeCalmEnd",
  BEFORE_BOSS_SPAWN: "beforeBossSpawn",
  BOSS_ACTIVE: "bossActive",
  BEFORE_PORTAL: "beforePortal",
  CLEANUP_REQUIRED: "cleanupRequired",
  PORTAL_READY: "portalReady"
});

export const ENCOUNTER_PLANS = Object.freeze({
  grid_intro_pressure: Object.freeze({
    id: "grid_intro_pressure",
    name: "GRID INTRO PRESSURE",
    director: Object.freeze({
      calmRatio: 0.24,
      eliteRatio: 0.6,
      cleanupCapMult: 0.32,
      portalCapMult: 0.16,
      budgetBase: 18
    }),
    elite: Object.freeze({ ratio: 0.6 }),
    stages: Object.freeze([
      Object.freeze({
        id: "boot-calm",
        phase: "calm",
        when: ENCOUNTER_STAGE_WHEN.BEFORE_CALM_END,
        canSpawn: true,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.26, ramp: 0 }),
        capMult: 0.4,
        batchMult: 0.5,
        interval: Object.freeze({ mult: 1.42 })
      }),
      Object.freeze({
        id: "grid-pressure",
        phase: "pressure",
        when: ENCOUNTER_STAGE_WHEN.BEFORE_PORTAL,
        canSpawn: true,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.52, ramp: 0.68 }),
        capMult: "intensity",
        batchMult: "intensity",
        interval: Object.freeze({ base: 1.1, intensityScale: -0.28, min: 0.6 })
      }),
      Object.freeze({
        id: "grid-cleanup",
        phase: "cleanup",
        when: ENCOUNTER_STAGE_WHEN.CLEANUP_REQUIRED,
        canSpawn: false,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.16, ramp: 0 }),
        capMult: 0.32,
        batchMult: 0,
        interval: Object.freeze({ mult: 9 })
      }),
      Object.freeze({
        id: "grid-portal",
        phase: "portal",
        when: ENCOUNTER_STAGE_WHEN.PORTAL_READY,
        canSpawn: false,
        canOpenPortal: true,
        intensity: Object.freeze({ base: 0.06, ramp: 0 }),
        capMult: 0.16,
        batchMult: 0,
        interval: Object.freeze({ mult: 9 })
      })
    ])
  }),

  void_pressure: Object.freeze({
    id: "void_pressure",
    name: "VOID PRESSURE",
    director: Object.freeze({
      calmRatio: 0.18,
      eliteRatio: 0.54,
      cleanupCapMult: 0.25,
      budgetBase: 20,
      budgetPerRoom: 6
    }),
    elite: Object.freeze({ ratio: 0.54 }),
    stages: Object.freeze([
      Object.freeze({
        id: "void-breath",
        phase: "calm",
        when: ENCOUNTER_STAGE_WHEN.BEFORE_CALM_END,
        canSpawn: true,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.3, ramp: 0 }),
        capMult: 0.44,
        batchMult: 0.58,
        interval: Object.freeze({ mult: 1.28 })
      }),
      Object.freeze({
        id: "void-surge",
        phase: "pressure",
        when: ENCOUNTER_STAGE_WHEN.BEFORE_PORTAL,
        canSpawn: true,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.62, ramp: 0.82 }),
        capMult: "intensity",
        batchMult: "intensity",
        interval: Object.freeze({ base: 1.02, intensityScale: -0.31, min: 0.55 })
      }),
      Object.freeze({
        id: "void-cleanup",
        phase: "cleanup",
        when: ENCOUNTER_STAGE_WHEN.CLEANUP_REQUIRED,
        canSpawn: false,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.16, ramp: 0 }),
        capMult: 0.25,
        batchMult: 0,
        interval: Object.freeze({ mult: 9 })
      }),
      Object.freeze({
        id: "void-portal",
        phase: "portal",
        when: ENCOUNTER_STAGE_WHEN.PORTAL_READY,
        canSpawn: false,
        canOpenPortal: true,
        intensity: Object.freeze({ base: 0.06, ramp: 0 }),
        capMult: 0.16,
        batchMult: 0,
        interval: Object.freeze({ mult: 9 })
      })
    ])
  }),

  core_elite_pressure: Object.freeze({
    id: "core_elite_pressure",
    name: "CORE ELITE PRESSURE",
    director: Object.freeze({
      calmRatio: 0.16,
      eliteRatio: 0.48,
      cleanupCapMult: 0.22,
      budgetBase: 22,
      budgetPerPlayer: 8,
      budgetPerRoom: 7
    }),
    elite: Object.freeze({ ratio: 0.48 }),
    stages: Object.freeze([
      Object.freeze({
        id: "core-scan",
        phase: "calm",
        when: ENCOUNTER_STAGE_WHEN.BEFORE_CALM_END,
        canSpawn: true,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.32, ramp: 0 }),
        capMult: 0.45,
        batchMult: 0.62,
        interval: Object.freeze({ mult: 1.24 })
      }),
      Object.freeze({
        id: "core-crush",
        phase: "pressure",
        when: ENCOUNTER_STAGE_WHEN.BEFORE_PORTAL,
        canSpawn: true,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.68, ramp: 0.9 }),
        capMult: "intensity",
        batchMult: "intensity",
        interval: Object.freeze({ base: 0.98, intensityScale: -0.34, min: 0.52 })
      }),
      Object.freeze({
        id: "core-cleanup",
        phase: "cleanup",
        when: ENCOUNTER_STAGE_WHEN.CLEANUP_REQUIRED,
        canSpawn: false,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.16, ramp: 0 }),
        capMult: 0.22,
        batchMult: 0,
        interval: Object.freeze({ mult: 9 })
      }),
      Object.freeze({
        id: "core-portal",
        phase: "portal",
        when: ENCOUNTER_STAGE_WHEN.PORTAL_READY,
        canSpawn: false,
        canOpenPortal: true,
        intensity: Object.freeze({ base: 0.06, ramp: 0 }),
        capMult: 0.16,
        batchMult: 0,
        interval: Object.freeze({ mult: 9 })
      })
    ])
  }),

  boss_objective: Object.freeze({
    id: "boss_objective",
    name: "BOSS OBJECTIVE",
    director: Object.freeze({
      calmRatio: 0.2,
      eliteRatio: 0.5,
      bossCapMult: 0.44,
      cleanupEnemyBase: 0,
      cleanupEnemyPerPlayer: 0,
      budgetBase: 16,
      budgetPerRoom: 5
    }),
    elite: Object.freeze({ enabled: false }),
    stages: Object.freeze([
      Object.freeze({
        id: "boss-arrival",
        phase: "calm",
        when: ENCOUNTER_STAGE_WHEN.BEFORE_BOSS_SPAWN,
        canSpawn: true,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.24, ramp: 0.1 }),
        capMult: 0.34,
        batchMult: 0.45,
        interval: Object.freeze({ mult: 1.5 })
      }),
      Object.freeze({
        id: "boss-fight",
        phase: "boss",
        when: ENCOUNTER_STAGE_WHEN.BOSS_ACTIVE,
        canSpawn: true,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.48, ramp: 0.12 }),
        capMult: 0.44,
        batchMult: 0.48,
        interval: Object.freeze({ mult: 1.55 })
      }),
      Object.freeze({
        id: "boss-aftershock",
        phase: "pressure",
        when: ENCOUNTER_STAGE_WHEN.BEFORE_PORTAL,
        canSpawn: true,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.52, ramp: 0.28 }),
        capMult: 0.42,
        batchMult: 0.5,
        interval: Object.freeze({ mult: 1.35 })
      }),
      Object.freeze({
        id: "boss-cleanup",
        phase: "cleanup",
        when: ENCOUNTER_STAGE_WHEN.CLEANUP_REQUIRED,
        canSpawn: false,
        canOpenPortal: false,
        intensity: Object.freeze({ base: 0.12, ramp: 0 }),
        capMult: 0.12,
        batchMult: 0,
        interval: Object.freeze({ mult: 9 })
      }),
      Object.freeze({
        id: "boss-portal",
        phase: "portal",
        when: ENCOUNTER_STAGE_WHEN.PORTAL_READY,
        canSpawn: false,
        canOpenPortal: true,
        intensity: Object.freeze({ base: 0.04, ramp: 0 }),
        capMult: 0.08,
        batchMult: 0,
        interval: Object.freeze({ mult: 9 })
      })
    ])
  })
});

export function getEncounterPlan(id = "grid_intro_pressure") {
  return ENCOUNTER_PLANS[id] || ENCOUNTER_PLANS.grid_intro_pressure;
}
