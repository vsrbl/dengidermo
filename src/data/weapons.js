export const WEAPONS = {
  shotgun: {
    name: "SHOTGUN",
    projectile: "bullet",
    fireRate: 2.7,
    damage: 9,
    bulletSpeed: 820,
    range: 470,
    pellets: 7,
    spread: 0.115,
    radius: 4,
    color: "white",
    recoil: 48,
    knockback: 170,
    hitPadding: 4,
    effects: [
      { type: "spark", count: 2 },
      { type: "hitShake", power: 0.18, life: 0.08 }
    ]
  },

  seeker: {
    name: "SEEKER",
    projectile: "homing",
    fireRate: 1.7,
    damage: 18,
    bulletSpeed: 560,
    range: 980,
    pellets: 1,
    spread: 0,
    radius: 5,
    color: "green",
    recoil: 36,
    knockback: 160,
    hitPadding: 7,
    effects: [
      { type: "homing", strength: 11, acquireRange: 760, target: "nearestEnemy" },
      { type: "explode", radius: 42, damage: 16, force: 190, visual: "small" },
      { type: "hitShake", power: 0.35, life: 0.09 }
    ]
  },

  rocket: {
    name: "ROCKETGUN",
    projectile: "rocket",
    fireRate: 0.82,
    damage: 28,
    bulletSpeed: 540,
    range: 900,
    pellets: 1,
    spread: 0,
    radius: 7,
    color: "green",
    recoil: 112,
    knockback: 320,
    hitPadding: 8,
    effects: [
      { type: "explode", radius: 128, damage: 56, force: 460, visual: "large" },
      { type: "hitShake", power: 0.5, life: 0.1 },
      { type: "screenShake", power: 7 }
    ]
  }
};

export const START_WEAPON = "shotgun";
export const WEAPON_IDS = Object.keys(WEAPONS);
