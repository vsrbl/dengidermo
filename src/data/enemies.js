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
    speed: 58,
    radius: 14,
    damage: 7,
    behavior: "ranged",
    renderStyle: "shooter",
    accentColor: "green",
    score: 2
  },

  charger: {
    name: "CHARGER",
    hp: 58,
    speed: 76,
    radius: 15,
    damage: 8,
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
      damage: 18,
      knockback: 360,
      telegraphEvery: 0.12,
      slowChaseScale: 0.42
    }
  },

  bomber: {
    name: "BOMBER",
    hp: 42,
    speed: 68,
    radius: 14,
    damage: 8,
    behavior: "bomber",
    renderStyle: "bomber",
    accentColor: "red",
    score: 2,
    bomb: {
      triggerRange: 88,
      fuse: 0.72,
      explosionRadius: 88,
      explosionDamage: 24,
      knockback: 420,
      telegraphEvery: 0.12,
      chaseSpeedScale: 0.92
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
