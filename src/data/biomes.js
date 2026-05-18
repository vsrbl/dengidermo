export const BIOMES = {
  grid: {
    id: "grid",
    name: "BLACK GRID",
    accent: "green",
    gridStep: 80,
    enemyPool: ["grunt", "runner"],
    lootPool: ["heal", "seeker", "shotgun"],
    portalDelay: 5,
    portalHold: 1.1,
    spawnBoost: 1,
    spawn: {
      capBase: 24,
      capPerPlayer: 8,
      capGrowthTime: 18,
      capGrowthMax: 18,
      batchBase: 2,
      batchGrowthTime: 35,
      intervalBase: 2.2,
      intervalMin: 0.45,
      intervalScale: 0.006
    },
    boss: { enabled: false },
    director: { spawnStartDelay: 0.8 }
  },

  void: {
    id: "void",
    name: "GREEN VOID",
    accent: "green",
    gridStep: 96,
    enemyPool: ["runner", "shooter", "grunt"],
    lootPool: ["heal", "seeker", "rocket"],
    portalDelay: 7,
    portalHold: 1.15,
    spawnBoost: 1.18,
    spawn: {
      capBase: 26,
      capPerPlayer: 8,
      capGrowthTime: 16,
      capGrowthMax: 20,
      batchBase: 2,
      batchGrowthTime: 32,
      intervalBase: 2.05,
      intervalMin: 0.42,
      intervalScale: 0.0065
    },
    boss: { enabled: false },
    director: { spawnStartDelay: 0.8, cleanupCapMult: 0.25 }
  },

  core: {
    id: "core",
    name: "CORE",
    accent: "white",
    gridStep: 72,
    enemyPool: ["runner", "tank", "shooter"],
    lootPool: ["heal", "seeker", "rocket"],
    portalDelay: 8,
    portalHold: 1.2,
    spawnBoost: 1.42,
    spawn: {
      capBase: 28,
      capPerPlayer: 9,
      capGrowthTime: 15,
      capGrowthMax: 22,
      batchBase: 3,
      batchGrowthTime: 30,
      intervalBase: 1.95,
      intervalMin: 0.4,
      intervalScale: 0.007
    },
    boss: { enabled: false },
    director: { spawnStartDelay: 0.8, cleanupCapMult: 0.22 }
  },

  boss: {
    id: "boss",
    name: "BOSS ROOM",
    accent: "green",
    gridStep: 64,
    enemyPool: ["tank", "shooter"],
    lootPool: ["heal", "rocket", "seeker"],
    portalDelay: 10,
    portalHold: 1.25,
    spawnBoost: 1.7,
    spawn: {
      capBase: 30,
      capPerPlayer: 10,
      capGrowthTime: 14,
      capGrowthMax: 24,
      batchBase: 3,
      batchGrowthTime: 28,
      intervalBase: 1.85,
      intervalMin: 0.38,
      intervalScale: 0.0075
    },
    boss: { enabled: true, kind: "boss", spawnAt: 4, x: 1200, y: 180 },
    director: { spawnStartDelay: 0.8, bossCapMult: 0.44, cleanupEnemyBase: 0, cleanupEnemyPerPlayer: 0 }
  }
};

export function getBiome(id = "grid") {
  return BIOMES[id] || BIOMES.grid;
}
