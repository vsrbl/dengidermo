export const LOOT = {
  heal: {
    name: "HEAL",
    type: "heal",
    amount: 30,
    radius: 10,
    color: "green",
    weight: 6
  },

  shotgun: {
    name: "SHOTGUN",
    type: "weapon",
    weaponId: "shotgun",
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
    weight: 3
  },

  rocket: {
    name: "ROCKETGUN",
    type: "weapon",
    weaponId: "rocket",
    radius: 11,
    color: "green",
    weight: 2
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
