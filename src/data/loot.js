export const LOOT = {
  heal: {
    name: "HEAL",
    type: "heal",
    amount: 30,
    radius: 10,
    color: "green",
    weight: 6,
    pickup: { label: "HEA" }
  },

  shotgun: {
    name: "SHOTGUN",
    type: "weapon",
    weaponId: "shotgun",
    radius: 11,
    color: "green",
    weight: 1,
    pickup: { label: "SHG" }
  },

  seeker: {
    name: "SEEKER",
    type: "weapon",
    weaponId: "seeker",
    radius: 11,
    color: "green",
    weight: 3,
    pickup: { label: "SEK" }
  },

  rocket: {
    name: "ROCKETGUN",
    type: "weapon",
    weaponId: "rocket",
    radius: 11,
    color: "green",
    weight: 2,
    pickup: { label: "RKT" }
  }
};

export function weightedLoot(rng, pool = null) {
  const allowed = Array.isArray(pool) && pool.length ? new Set(pool) : null;
  const entries = Object.entries(LOOT).filter(([id]) => !allowed || allowed.has(id));
  const safeEntries = entries.length ? entries : Object.entries(LOOT);
  const total = safeEntries.reduce((sum, [, item]) => sum + item.weight, 0);
  let roll = rng.range(0, total);
  for (const [id, item] of safeEntries) {
    roll -= item.weight;
    if (roll <= 0) return id;
  }
  return "heal";
}
