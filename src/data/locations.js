export const LOCATIONS = [
  {
    id: "grid-00",
    name: "GRID 00",
    accent: "green",
    enemyPool: ["grunt", "runner"],
    portalDelay: 5,
    portalHold: 1.1,
    spawnBoost: 1
  },
  {
    id: "void-01",
    name: "VOID 01",
    accent: "white",
    enemyPool: ["runner", "shooter", "grunt"],
    portalDelay: 7,
    portalHold: 1.15,
    spawnBoost: 1.2
  },
  {
    id: "core-02",
    name: "CORE 02",
    accent: "green",
    enemyPool: ["runner", "tank", "shooter"],
    portalDelay: 8,
    portalHold: 1.2,
    spawnBoost: 1.45
  },
  {
    id: "boss-03",
    name: "BOSS 03",
    accent: "green",
    enemyPool: ["tank", "shooter", "boss"],
    portalDelay: 10,
    portalHold: 1.25,
    spawnBoost: 1.8
  }
];

export function getLocation(index = 0) {
  return LOCATIONS[((index % LOCATIONS.length) + LOCATIONS.length) % LOCATIONS.length];
}
