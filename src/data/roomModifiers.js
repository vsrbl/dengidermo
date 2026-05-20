export const ROOM_MODIFIER_IDS = Object.freeze({
  GRID_STATIC: "grid_static",
  VOID_DRIFT: "void_drift",
  CORE_PRESSURE: "core_pressure",
  BOSS_LOCK: "boss_lock",
  REWARD_CACHE: "reward_cache",
  STATIC_FIELD: "static_field"
});

export const ROOM_MODIFIERS = Object.freeze({
  [ROOM_MODIFIER_IDS.GRID_STATIC]: Object.freeze({
    id: ROOM_MODIFIER_IDS.GRID_STATIC,
    name: "GRID STATIC",
    description: "baseline signal noise",
    category: "identity",
    tags: Object.freeze(["grid", "identity"]),
    hooks: Object.freeze({})
  }),
  [ROOM_MODIFIER_IDS.VOID_DRIFT]: Object.freeze({
    id: ROOM_MODIFIER_IDS.VOID_DRIFT,
    name: "VOID DRIFT",
    description: "void room identity contract",
    category: "identity",
    tags: Object.freeze(["void", "identity"]),
    hooks: Object.freeze({})
  }),
  [ROOM_MODIFIER_IDS.CORE_PRESSURE]: Object.freeze({
    id: ROOM_MODIFIER_IDS.CORE_PRESSURE,
    name: "CORE PRESSURE",
    description: "core room identity contract",
    category: "identity",
    tags: Object.freeze(["core", "identity"]),
    hooks: Object.freeze({})
  }),
  [ROOM_MODIFIER_IDS.BOSS_LOCK]: Object.freeze({
    id: ROOM_MODIFIER_IDS.BOSS_LOCK,
    name: "BOSS LOCK",
    description: "boss objective identity contract",
    category: "identity",
    tags: Object.freeze(["boss", "identity"]),
    hooks: Object.freeze({})
  }),
  [ROOM_MODIFIER_IDS.REWARD_CACHE]: Object.freeze({
    id: ROOM_MODIFIER_IDS.REWARD_CACHE,
    name: "REWARD CACHE",
    description: "rare reward room identity contract",
    category: "identity",
    tags: Object.freeze(["rare", "reward", "identity"]),
    hooks: Object.freeze({})
  }),
  [ROOM_MODIFIER_IDS.STATIC_FIELD]: Object.freeze({
    id: ROOM_MODIFIER_IDS.STATIC_FIELD,
    name: "STATIC FIELD",
    description: "cursed event field: enemies move faster, healing is reduced, background signal shifts",
    category: "cursed",
    tags: Object.freeze(["rare", "event", "cursed", "static"]),
    hooks: Object.freeze({
      "room:enter": Object.freeze([
        Object.freeze({ type: "emitEvent", event: Object.freeze({ type: "room_modifier", text: "STATIC FIELD ONLINE" }) })
      ]),
      "enemy:update": Object.freeze([
        Object.freeze({ type: "scale", field: "speedMult", factor: 1.1, max: 1.6 })
      ]),
      "player:heal": Object.freeze([
        Object.freeze({ type: "scale", field: "amount", factor: 0.55, min: 0 })
      ]),
      "render:background": Object.freeze([
        Object.freeze({ type: "set", field: "accent", value: "white" }),
        Object.freeze({ type: "set", field: "gridStep", value: 52 })
      ])
    })
  })
});

export function getRoomModifier(modifierId) {
  return ROOM_MODIFIERS[modifierId] || null;
}

export function resolveRoomModifiers(modifierIds = []) {
  return [...new Set(modifierIds)].map(getRoomModifier).filter(Boolean);
}

export function modifierSnapshot(modifier) {
  return {
    id: modifier.id,
    name: modifier.name,
    description: modifier.description,
    category: modifier.category,
    tags: [...(modifier.tags || [])]
  };
}
