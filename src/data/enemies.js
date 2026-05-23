export const ENEMIES = {
  grunt: {
    name: "GRUNT",
    dropTable: "grunt",
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
    dropTable: "runner",
    hp: 30,
    speed: 126,
    radius: 16,
    damage: 6,
    behavior: "chase",
    renderStyle: "runner",
    accentColor: "white",
    score: 1
  },

  tank: {
    name: "TANK",
    dropTable: "tank",
    hp: 92,
    speed: 42,
    radius: 24,
    damage: 15,
    behavior: "chase",
    renderStyle: "tank",
    accentColor: "white",
    armor: {
      hp: 46,
      regenDelay: 3.2,
      regenPerSecond: 12,
      ricochet: true,
      visual: "square"
    },
    score: 3
  },

  shooter: {
    name: "SHOOTER",
    dropTable: "shooter",
    hp: 46,
    speed: 54,
    radius: 14,
    damage: 7,
    behavior: "ranged",
    renderStyle: "shooter",
    accentColor: "white",
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
    dropTable: "charger",
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
    dropTable: "bomber",
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


  mirror: {
    name: "MIRROR",
    dropTable: "runner",
    hp: 38,
    speed: 118,
    radius: 15,
    damage: 7,
    behavior: "mirror",
    renderStyle: "mirror",
    accentColor: "white",
    score: 2,
    mirror: { delay: 0.72, memory: 1.35, turnRate: 9 }
  },

  orbiter: {
    name: "ORBITER",
    dropTable: "runner",
    hp: 34,
    speed: 136,
    radius: 13,
    damage: 6,
    behavior: "orbiter",
    renderStyle: "orbiter",
    accentColor: "white",
    score: 2,
    orbit: { radius: 164, minRadius: 58, shrinkPerSecond: 10, angularSpeed: 2.75 }
  },

  anchor: {
    name: "ANCHOR",
    dropTable: "tank",
    hp: 74,
    speed: 34,
    radius: 22,
    damage: 5,
    behavior: "anchor",
    renderStyle: "anchor",
    accentColor: "white",
    score: 3,
    anchor: { fieldRadius: 150, projectileSlow: 0.72, pickupPull: 42, pulseEvery: 0.32 }
  },

  splitter: {
    name: "SPLITTER",
    dropTable: "charger",
    hp: 44,
    speed: 88,
    radius: 16,
    damage: 7,
    behavior: "splitter",
    renderStyle: "splitter",
    accentColor: "white",
    score: 2,
    deathSpawn: { kind: "mini_splitter", count: 4, radius: 32, maxChildren: 6 }
  },

  mini_splitter: {
    name: "SPLINTER",
    dropTable: "anomaly_child",
    hp: 9,
    speed: 176,
    radius: 8,
    damage: 4,
    behavior: "chase",
    renderStyle: "mini_splitter",
    accentColor: "white",
    score: 0
  },

  prism: {
    name: "PRISM",
    dropTable: "shooter",
    hp: 56,
    speed: 48,
    radius: 17,
    damage: 6,
    behavior: "prism",
    renderStyle: "prism",
    accentColor: "white",
    score: 3,
    projectileDefense: { type: "front_deflect", arcDot: -0.25, cooldown: 0.08 }
  },

  pulse: {
    name: "PULSE",
    dropTable: "bomber",
    hp: 42,
    speed: 42,
    radius: 15,
    damage: 5,
    behavior: "pulse",
    renderStyle: "pulse",
    accentColor: "red",
    score: 3,
    pulse: { charge: 1.05, cooldown: 1.55, radius: 138, damage: 16, knockback: 280, telegraphEvery: 0.18 }
  },

  leech: {
    name: "LEECH",
    dropTable: "runner",
    hp: 24,
    speed: 104,
    radius: 12,
    damage: 4,
    behavior: "leech",
    renderStyle: "leech",
    accentColor: "green",
    score: 2,
    leech: { range: 260, healPerSecond: 10, retreatSpeedScale: 0.72 }
  },

  nullifier: {
    name: "NULL",
    dropTable: "tank",
    hp: 68,
    speed: 38,
    radius: 19,
    damage: 4,
    behavior: "nullifier",
    renderStyle: "nullifier",
    accentColor: "purple",
    score: 3,
    nullifier: { fieldRadius: 132, drag: 0.72, pulseEvery: 0.28 }
  },

  bouncer: {
    name: "BOUNCER",
    dropTable: "charger",
    hp: 36,
    speed: 190,
    radius: 14,
    damage: 9,
    behavior: "bouncer",
    renderStyle: "bouncer",
    accentColor: "red",
    score: 2,
    bounce: { speed: 220, speedGain: 1.08, maxSpeed: 380, stunAfter: 5, stunTime: 0.55 }
  },

  herald: {
    name: "HERALD",
    dropTable: "shooter",
    hp: 82,
    speed: 32,
    radius: 21,
    damage: 5,
    behavior: "herald",
    renderStyle: "herald",
    accentColor: "red",
    score: 4,
    herald: { cooldown: 3.6, windup: 0.72, maxSummons: 10, summonKinds: ["runner", "mini_splitter", "shooter"] }
  },

  boss: {
    name: "BOSS",
    dropTable: "boss",
    hp: 460,
    speed: 30,
    radius: 42,
    damage: 22,
    behavior: "boss",
    renderStyle: "boss",
    accentColor: "white",
    armor: {
      hp: 180,
      regenDelay: 4.4,
      regenPerSecond: 22,
      ricochet: true,
      visual: "heavy_square"
    },
    score: 20
  }
};

export const ANOMALY_ENEMY_KINDS = Object.freeze([
  "mirror",
  "orbiter",
  "anchor",
  "splitter",
  "prism",
  "pulse",
  "leech",
  "nullifier",
  "bouncer",
  "herald"
]);

export const ENEMY_WAVES = ["grunt", "runner", "grunt", "shooter", "tank"];
