export const ENEMIES = {
  grunt: {
    name: "GRUNT",
    hp: 34,
    speed: 84,
    radius: 13,
    damage: 8,
    behavior: "chase",
    score: 1
  },

  runner: {
    name: "RUNNER",
    hp: 20,
    speed: 145,
    radius: 10,
    damage: 6,
    behavior: "chase",
    score: 1
  },

  tank: {
    name: "TANK",
    hp: 110,
    speed: 46,
    radius: 22,
    damage: 15,
    behavior: "chase",
    score: 3
  },

  shooter: {
    name: "SHOOTER",
    hp: 46,
    speed: 58,
    radius: 14,
    damage: 7,
    behavior: "ranged",
    score: 2
  },

  boss: {
    name: "BOSS",
    hp: 520,
    speed: 30,
    radius: 42,
    damage: 22,
    behavior: "boss",
    score: 20
  }
};

export const ENEMY_WAVES = ["grunt", "runner", "grunt", "shooter", "tank"];
