export const ELITE_VARIANT_SCHEMA_VERSION = 1;

export const ELITE_VARIANTS = Object.freeze({
  overcharged: Object.freeze({
    id: "overcharged",
    name: "OVERCHARGED",
    color: "#ff3048",
    allowedKinds: Object.freeze(["grunt", "runner", "shooter", "charger", "bomber"]),
    excludedKinds: Object.freeze(["boss"]),
    stats: Object.freeze({
      speedMult: 1.12,
      damageMult: 1
    }),
    visual: Object.freeze({
      renderer: "inner_core",
      pulseEvery: 0
    }),
    deathPulse: Object.freeze({
      radius: 92,
      damage: 8,
      life: 0.34,
      warning: false
    })
  })
});

export const DEFAULT_ELITE_VARIANT_ID = "overcharged";
