export const ROOM_SEQUENCE = [
  {
    id: "grid-00",
    name: "GRID 00",
    biome: "grid",
    encounter: "grid_intro_pressure",
    portal: { delay: 5, hold: 1.1 }
  },
  {
    id: "void-01",
    name: "VOID 01",
    biome: "void",
    encounter: "void_pressure",
    portal: { delay: 7, hold: 1.15 },
    spawn: { boost: 1.04 }
  },
  {
    id: "core-02",
    name: "CORE 02",
    biome: "core",
    encounter: "core_elite_pressure",
    portal: { delay: 8, hold: 1.2 },
    enemyPool: ["runner", "tank", "shooter"]
  },
  {
    id: "boss-03",
    name: "BOSS 03",
    biome: "boss",
    encounter: "boss_objective",
    portal: { delay: 18, hold: 1.25 },
    boss: { enabled: true, kind: "boss", spawnAt: 4, x: 1200, y: 180 },
    director: { bossCapMult: 0.44, cleanupEnemyBase: 0, cleanupEnemyPerPlayer: 0 }
  }
];

export function getRoom(index = 0) {
  return ROOM_SEQUENCE[((index % ROOM_SEQUENCE.length) + ROOM_SEQUENCE.length) % ROOM_SEQUENCE.length];
}

export function roomIndexById(roomId) {
  const index = ROOM_SEQUENCE.findIndex((room) => room.id === roomId);
  return index >= 0 ? index : 0;
}
