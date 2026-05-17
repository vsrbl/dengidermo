export const WEAPONS = {
  pistol: {
    name: "PISTOL",
    projectile: "bullet",
    fireRate: 5.5,
    damage: 14,
    bulletSpeed: 760,
    range: 760,
    pellets: 1,
    spread: 0,
    radius: 4,
    color: "white",
    effects: []
  },

  smg: {
    name: "SMG",
    projectile: "bullet",
    fireRate: 13,
    damage: 7,
    bulletSpeed: 720,
    range: 650,
    pellets: 1,
    spread: 0.04,
    radius: 3,
    color: "white",
    effects: []
  },

  shotgun: {
    name: "SHOTGUN",
    projectile: "bullet",
    fireRate: 2.2,
    damage: 9,
    bulletSpeed: 690,
    range: 430,
    pellets: 6,
    spread: 0.34,
    radius: 4,
    color: "white",
    effects: []
  },

  rail: {
    name: "RAIL",
    projectile: "bullet",
    fireRate: 1.5,
    damage: 42,
    bulletSpeed: 1120,
    range: 980,
    pellets: 1,
    spread: 0,
    radius: 5,
    color: "white",
    effects: [{ type: "pierce", count: 2 }]
  },

  seeker: {
    name: "SEEKER",
    projectile: "homing",
    fireRate: 1.8,
    damage: 20,
    bulletSpeed: 470,
    range: 860,
    pellets: 1,
    spread: 0,
    radius: 5,
    color: "green",
    effects: [
      { type: "homing", strength: 7.5, target: "nearestEnemy" }
    ]
  },

  rocket: {
    name: "ROCKET",
    projectile: "rocket",
    fireRate: 0.95,
    damage: 18,
    bulletSpeed: 430,
    range: 720,
    pellets: 1,
    spread: 0,
    radius: 6,
    color: "green",
    effects: [
      { type: "explode", radius: 90, damage: 36 },
      { type: "screenShake", power: 5 }
    ]
  }
};

export const START_WEAPON = "pistol";
export const WEAPON_IDS = Object.keys(WEAPONS);
