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


  echo: {
    name: "ECHO",
    dropTable: "runner",
    hp: 72,
    speed: 156,
    radius: 15,
    damage: 8,
    behavior: "echo",
    renderStyle: "echo",
    accentColor: "purple",
    score: 4,
    echo: { fireRateScale: 0.72, damageScale: 0.62, projectileSpeedScale: 0.86, preferredRange: 260, strafe: 0.64, blurEvery: 0.08 }
  },

  orbiter: {
    name: "ORBITER",
    dropTable: "runner",
    hp: 42,
    speed: 168,
    radius: 13,
    damage: 6,
    behavior: "orbiter",
    renderStyle: "orbiter",
    accentColor: "white",
    score: 3,
    orbit: { radius: 176, minRadius: 50, shrinkPerSecond: 14, angularSpeed: 3.2, turnRate: 18 },
    projectileDefense: { type: "front_deflect", arcDot: -0.18, cooldown: 0.055 }
  },

  anchor: {
    name: "ANCHOR",
    dropTable: "tank",
    hp: 92,
    speed: 30,
    radius: 22,
    damage: 5,
    behavior: "anchor",
    renderStyle: "anchor",
    accentColor: "white",
    score: 4,
    anchor: { fieldRadius: 188, projectileSlow: 0.18, pickupPull: 340, pickupDestroyRadius: 20, playerDrag: 0.35, pulseEvery: 0.42 }
  },

  splitter: {
    name: "SPLITTER",
    dropTable: "charger",
    hp: 138,
    speed: 58,
    radius: 48,
    damage: 12,
    behavior: "splitter",
    renderStyle: "splitter",
    accentColor: "white",
    score: 5,
    splitStage: 0,
    deathSpawn: { kind: "splitter_medium", count: 2, countPerLoop: 1, minLoop: 1, maxCount: 4, radius: 58, maxChildren: 6, impulse: 145 }
  },

  splitter_medium: {
    name: "SPLITTER",
    dropTable: "anomaly_child",
    hp: 54,
    speed: 90,
    radius: 25,
    damage: 8,
    behavior: "splitter",
    renderStyle: "splitter_medium",
    accentColor: "white",
    score: 0,
    splitStage: 1,
    deathSpawn: { kind: "splitter_small", count: 2, countPerLoop: 1, minLoop: 2, maxCount: 4, radius: 34, maxChildren: 8, impulse: 185 }
  },

  splitter_small: {
    name: "SPLITTER",
    dropTable: "anomaly_child",
    hp: 22,
    speed: 132,
    radius: 13,
    damage: 5,
    behavior: "splitter",
    renderStyle: "splitter_small",
    accentColor: "white",
    score: 0,
    splitStage: 2,
    deathSpawn: { kind: "splitter_tiny", count: 3, countPerLoop: 1, minLoop: 3, maxCount: 6, radius: 22, maxChildren: 12, impulse: 245 }
  },

  splitter_tiny: {
    name: "SPLINTER",
    dropTable: "anomaly_child",
    hp: 8,
    speed: 224,
    radius: 7,
    damage: 4,
    behavior: "chase",
    renderStyle: "splitter_tiny",
    accentColor: "white",
    score: 0
  },

  prism: {
    name: "PRISM",
    dropTable: "shooter",
    hp: 64,
    speed: 42,
    radius: 17,
    damage: 6,
    behavior: "prism",
    renderStyle: "prism",
    accentColor: "white",
    score: 3,
    prism: { charge: 0.8, cooldown: 1.7, beamLength: 520, beamWidth: 18, damage: 13, knockback: 240, splitAngle: 0.42, telegraphEvery: 0.13 }
  },

  pulse: {
    name: "PULSE",
    dropTable: "bomber",
    hp: 48,
    speed: 40,
    radius: 15,
    damage: 5,
    behavior: "pulse",
    renderStyle: "pulse",
    accentColor: "red",
    score: 3,
    pulse: { charge: 0.86, cooldown: 1.42, length: 360, width: 92, damage: 17, knockback: 330, telegraphEvery: 0.13 }
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

  glitch: {
    name: "GLITCH",
    dropTable: "tank",
    hp: 58,
    speed: 114,
    radius: 16,
    damage: 11,
    behavior: "glitch",
    renderStyle: "glitch",
    accentColor: "purple",
    score: 3,
    glitch: { cooldown: 1.45, windup: 0.34, dashTime: 0.28, blinkRange: 170, dashSpeed: 620, knockback: 260, blurEvery: 0.045 }
  },

  bouncer: {
    name: "BOUNCER",
    dropTable: "charger",
    hp: 42,
    speed: 210,
    radius: 14,
    damage: 10,
    behavior: "bouncer",
    renderStyle: "bouncer",
    accentColor: "red",
    score: 2,
    bounce: { speed: 235, speedGain: 1.08, maxSpeed: 520, playerKnockback: 460, playerBounceGain: 1.04, hitCooldown: 0.22 }
  },

  herald: {
    name: "HERALD",
    dropTable: "shooter",
    hp: 92,
    speed: 28,
    radius: 21,
    damage: 5,
    behavior: "herald",
    renderStyle: "herald",
    accentColor: "red",
    score: 4,
    herald: { cooldown: 3.2, tetherSpeed: 245, tetherPulseEvery: 0.075, tetherPathMax: 44, catchRadius: 32, swarmBase: 3, swarmPerLoop: 2, swarmMax: 12, summonKinds: ["runner", "splitter_tiny", "runner", "mini_splitter"] }
  },

  mini_splitter: {
    name: "SPLINTER",
    dropTable: "anomaly_child",
    hp: 9,
    speed: 196,
    radius: 8,
    damage: 4,
    behavior: "chase",
    renderStyle: "splitter_tiny",
    accentColor: "white",
    score: 0
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
  "echo",
  "orbiter",
  "anchor",
  "splitter",
  "prism",
  "pulse",
  "leech",
  "glitch",
  "bouncer",
  "herald"
]);

export const ENEMY_WAVES = ["grunt", "runner", "grunt", "shooter", "tank"];
