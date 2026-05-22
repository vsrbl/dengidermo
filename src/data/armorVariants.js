export const ARMOR_VARIANT_SCHEMA_VERSION = 1;

export const ARMOR_VARIANTS = Object.freeze({
  linked: Object.freeze({
    id: "linked",
    name: "LINKED ARMOR",
    color: "#ff3048",
    requiresArmor: true,
    allowedKinds: Object.freeze(["tank"]),
    excludedKinds: Object.freeze(["boss"]),
    visual: Object.freeze({
      renderer: "linked_shell",
      linkRenderer: "red_tether"
    }),
    link: Object.freeze({
      radius: 430,
      maxLinks: 2,
      refreshEvery: 0.3,
      guardedFloorRatio: 0.24,
      candidateKinds: Object.freeze(["grunt", "runner", "shooter", "charger", "bomber"]),
      excludedKinds: Object.freeze(["boss", "tank"])
    })
  })
});

export const DEFAULT_ARMOR_VARIANT_ID = "linked";
