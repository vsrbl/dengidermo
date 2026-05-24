export const ARMOR_VARIANT_SCHEMA_VERSION = 1;

export const ARMOR_VARIANTS = Object.freeze({
  linked: Object.freeze({
    id: "linked",
    name: "LINKED ARMOR",
    color: "#ff3048",
    requiresArmor: false,
    grantsArmor: Object.freeze({ hpRatio: 0.72, minHp: 18, maxHp: 88, regenDelay: 3.5, regenPerSecondRatio: 0.22, visual: "square" }),
    allowedKinds: Object.freeze(["grunt", "runner", "shooter", "charger", "bomber", "tank", "echo", "orbiter", "splitter", "splitter_medium", "splitter_small", "prism", "pulse", "leech", "glitch", "herald"]),
    excludedKinds: Object.freeze(["boss"]),
    visual: Object.freeze({
      renderer: "linked_shell",
      linkRenderer: "red_tether"
    }),
    link: Object.freeze({
      radius: 430,
      maxLinks: 3,
      refreshEvery: 0.3,
      guardedFloorRatio: 0.24,
      candidateKinds: Object.freeze(["grunt", "runner", "shooter", "charger", "bomber", "echo", "orbiter", "splitter", "splitter_medium", "splitter_small", "prism", "pulse", "leech", "glitch", "bouncer", "herald", "mini_splitter"]),
      excludedKinds: Object.freeze(["boss"])
    })
  })
});

export const DEFAULT_ARMOR_VARIANT_ID = "linked";
