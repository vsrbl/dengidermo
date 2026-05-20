export const ROOM_SEQUENCE = [
  {
    id: "grid-00",
    name: "GRID 00",
    category: "normal",
    tags: ["grid", "starter", "clear"],
    layout: "open_arena",
    modifiers: ["grid_static"],
    biome: "grid",
    encounter: "grid_intro_pressure",
    objective: "clear",
    spawnZones: ["edge_far", "edge_random"],
    portal: { delay: 5, hold: 1.1 }
  },
  {
    id: "void-01",
    name: "VOID 01",
    category: "normal",
    tags: ["void", "survive", "pressure"],
    layout: "open_arena",
    modifiers: ["void_drift"],
    biome: "void",
    encounter: "void_pressure",
    objective: "survive",
    spawnZones: ["edge_far", "edge_flank", "corner_random"],
    portal: { delay: 7, hold: 1.15 },
    spawn: { boost: 1.04 }
  },
  {
    id: "core-02",
    name: "CORE 02",
    category: "normal",
    tags: ["core", "clear", "elite"],
    layout: "twin_pillars",
    modifiers: ["core_pressure"],
    biome: "core",
    encounter: "core_elite_pressure",
    objective: "clear",
    spawnZones: ["edge_flank", "corner_random", "edge_far"],
    portal: { delay: 8, hold: 1.2 },
    enemyPool: ["runner", "tank", "shooter"]
  },
  {
    id: "boss-03",
    name: "BOSS 03",
    category: "boss",
    tags: ["boss", "lockdown", "objective"],
    layout: "open_arena",
    modifiers: ["boss_lock"],
    biome: "boss",
    encounter: "boss_objective",
    objective: "boss",
    spawnZones: ["edge_far", "corner_random"],
    portal: { delay: 18, hold: 1.25 },
    boss: { enabled: true, kind: "boss", spawnAt: 4, x: 1200, y: 180 },
    director: { bossCapMult: 0.44, cleanupEnemyBase: 0, cleanupEnemyPerPlayer: 0 }
  }
];

export const RARE_ROOMS = [
  {
    id: "reward-cache-00",
    name: "REWARD CACHE 00",
    category: "reward",
    tags: ["rare", "reward", "cache", "no-combat"],
    layout: "open_arena",
    modifiers: ["reward_cache"],
    biome: "grid",
    encounter: "reward_cache",
    objective: "clear",
    spawnZones: [],
    portal: { delay: 1.2, hold: 0.85 },
    enemyPool: [],
    lootPool: ["heal"],
    spawn: {
      capBase: 0,
      capPerPlayer: 0,
      capGrowthTime: 999,
      capGrowthMax: 0,
      batchBase: 0,
      batchGrowthTime: 999,
      intervalBase: 99,
      intervalMin: 99,
      intervalScale: 0
    },
    director: {
      budgetBase: 0,
      budgetPerPlayer: 0,
      budgetPerRoom: 0,
      minPressureBudget: 0,
      spawnStartDelay: 99,
      cleanupEnemyBase: 0,
      cleanupEnemyPerPlayer: 0,
      cleanupCapMult: 0,
      portalCapMult: 0
    }
  },
  {
    id: "static-field-00",
    name: "STATIC FIELD 00",
    category: "cursed",
    tags: ["rare", "event", "cursed", "static", "clear"],
    layout: "open_arena",
    modifiers: ["static_field"],
    biome: "void",
    encounter: "static_field_event",
    objective: "clear",
    spawnZones: ["edge_far", "edge_flank", "corner_random"],
    portal: { delay: 8, hold: 1.15 },
    enemyPool: ["runner", "shooter", "tank"],
    spawn: { boost: 0.92 }
  }
];

export const ALL_ROOMS = Object.freeze([...ROOM_SEQUENCE, ...RARE_ROOMS]);

export function getRoom(index = 0) {
  return ROOM_SEQUENCE[((index % ROOM_SEQUENCE.length) + ROOM_SEQUENCE.length) % ROOM_SEQUENCE.length];
}

export function getRoomById(roomId) {
  return ALL_ROOMS.find((room) => room.id === roomId) || null;
}

export function roomIndexById(roomId) {
  const index = ROOM_SEQUENCE.findIndex((room) => room.id === roomId);
  return index >= 0 ? index : 0;
}
