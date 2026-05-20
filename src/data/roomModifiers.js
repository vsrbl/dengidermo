export const ROOM_MODIFIER_IDS = Object.freeze({
  GRID_STATIC: "grid_static",
  VOID_DRIFT: "void_drift",
  CORE_PRESSURE: "core_pressure",
  BOSS_LOCK: "boss_lock"
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
