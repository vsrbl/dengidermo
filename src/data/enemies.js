export const ENEMIES = {
  grunt: {
    name: "GRUNT",
    hp: 34,
    speed: 84,
    radius: 13,
    damage: 8,
    behavior: "chase",
    renderStyle: "grunt",
    accentColor: "white",
    score: 1
  },

  runner: {
    name: "RUNNER",
    hp: 20,
    speed: 145,
    radius: 10,
    damage: 6,
    behavior: "chase",
    renderStyle: "runner",
    accentColor: "white",
    score: 1
  },

  tank: {
    name: "TANK",
    hp: 110,
    speed: 46,
    radius: 22,
    damage: 15,
    behavior: "chase",
    renderStyle: "tank",
    accentColor: "white",
    score: 3
  },

  shooter: {
    name: "SHOOTER",
    hp: 46,
    speed: 54,
    radius: 14,
    damage: 7,
    behavior: "ranged",
    renderStyle: "shooter",
    accentColor: "green",
    score: 2,
    ranged: {
      acquireRange: 620,
      preferredRange: 360,
      retreatRange: 230,
      cooldown: 1.15,
      firstShotDelay: 0.35,
      projectileSpeed: 430,
      projectileDamage: 9,
      projectileRadius: 5,
      projectileRange: 740,
      knockback: 145,
      muzzleLife: 0.1
    }
  },

  charger: {
    name: "CHARGER",
    hp: 52,
    speed: 70,
    radius: 15,
    damage: 7,
    behavior: "charger",
    renderStyle: "charger",
    accentColor: "red",
    score: 2,
    charge: {
      acquireRange: 520,
      minRange: 70,
      windup: 0.58,
      dashTime: 0.34,
      cooldown: 0.82,
      speed: 720,
      damage: 19,
      knockback: 390,
      telegraphEvery: 0.12,
      slowChaseScale: 0.42
    }
  },

  bomber: {
    name: "BOMBER",
    hp: 36,
    speed: 54,
    radius: 15,
    damage: 6,
    behavior: "bomber",
    renderStyle: "bomber",
    accentColor: "red",
    score: 2,
    bomb: {
      triggerRange: 96,
      fuse: 0.82,
      explosionRadius: 96,
      explosionDamage: 27,
      knockback: 450,
      telegraphEvery: 0.1,
      chaseSpeedScale: 0.72
    }
  },

  boss: {
    name: "BOSS",
    hp: 520,
    speed: 30,
    radius: 42,
    damage: 22,
    behavior: "boss",
    renderStyle: "boss",
    accentColor: "green",
    score: 20
  }
};

export const ENEMY_WAVES = ["grunt", "runner", "grunt", "shooter", "tank"];
