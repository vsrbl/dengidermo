export const LOOT = {
  heal: {
    name: "HEAL",
    type: "heal",
    amount: 30,
    radius: 10,
    color: "green",
    weight: 5
  },

  smg: {
    name: "SMG",
    type: "weapon",
    weaponId: "smg",
    radius: 11,
    color: "green",
    weight: 2
  },

  shotgun: {
    name: "SHOTGUN",
    type: "weapon",
    weaponId: "shotgun",
    radius: 11,
    color: "green",
    weight: 2
  },

  rail: {
    name: "RAIL",
    type: "weapon",
    weaponId: "rail",
    radius: 11,
    color: "green",
    weight: 1
  },

  seeker: {
    name: "SEEKER",
    type: "weapon",
    weaponId: "seeker",
    radius: 11,
    color: "green",
    weight: 1
  },

  rocket: {
    name: "ROCKET",
    type: "weapon",
    weaponId: "rocket",
    radius: 11,
    color: "green",
    weight: 1
  }
};

export function weightedLoot(rng) {
  const entries = Object.entries(LOOT);
  const total = entries.reduce((sum, [, item]) => sum + item.weight, 0);
  let roll = rng.range(0, total);
  for (const [id, item] of entries) {
    roll -= item.weight;
    if (roll <= 0) return id;
  }
  return "heal";
}
