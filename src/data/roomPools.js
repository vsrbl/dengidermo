export const ROOM_POOL_SCHEMA_VERSION = 1;

export const ROUTE_NODE_TYPES = Object.freeze({
  COMBAT: "combat",
  REWARD: "reward",
  CURSED: "cursed",
  BOSS: "boss"
});

function option(roomId, weight = 1, overrides = {}) {
  return Object.freeze({
    roomId,
    weight,
    minLoop: Number.isFinite(overrides.minLoop) ? overrides.minLoop : 0,
    maxLoop: Number.isFinite(overrides.maxLoop) ? overrides.maxLoop : null,
    ruleId: overrides.ruleId || null,
    rare: !!overrides.rare,
    activityId: overrides.activityId || null,
    environmentThemeId: overrides.environmentThemeId || null,
    tags: Object.freeze([...(overrides.tags || [])])
  });
}

function node(id, roomInLoop, type, options, overrides = {}) {
  return Object.freeze({
    id,
    roomInLoop,
    type,
    options: Object.freeze(options),
    tags: Object.freeze([...(overrides.tags || [])])
  });
}

export const ROOM_POOLS = Object.freeze({
  loop_zero_cadence: Object.freeze({
    id: "loop_zero_cadence",
    label: "LOOP ZERO CADENCE",
    minLoop: 0,
    maxLoop: 0,
    nodes: Object.freeze([
      node("l0_grid_intro", 0, ROUTE_NODE_TYPES.COMBAT, [option("grid-00", 1, { environmentThemeId: "black_grid" })]),
      node("l0_void_pressure", 1, ROUTE_NODE_TYPES.COMBAT, [option("void-01", 1, { environmentThemeId: "black_grid" })]),
      node("l0_core_pillars", 2, ROUTE_NODE_TYPES.COMBAT, [option("core-02", 1, { environmentThemeId: "twin_signal" })]),
      node("l0_boss_lock", 3, ROUTE_NODE_TYPES.BOSS, [option("boss-03", 1, { environmentThemeId: "black_grid" })])
    ])
  }),

  loop_one_variety: Object.freeze({
    id: "loop_one_variety",
    label: "LOOP ONE VARIETY",
    minLoop: 1,
    maxLoop: 1,
    nodes: Object.freeze([
      node("l1_opening_cache_or_grid", 0, ROUTE_NODE_TYPES.COMBAT, [
        option("reward-cache-00", 1.25, { rare: true, ruleId: "first_loop_reward_cache", activityId: "reward_cache", environmentThemeId: "cache_pockets", tags: ["reward"] }),
        option("grid-pockets-01", 1, { environmentThemeId: "cache_pockets", activityId: "loot_pocket" }),
        option("grid-cover-01", 0.8, { environmentThemeId: "broken_cover" })
      ]),
      node("l1_void_branch", 1, ROUTE_NODE_TYPES.COMBAT, [
        option("void-01", 1, { environmentThemeId: "black_grid" }),
        option("void-strips-01", 1, { environmentThemeId: "static_strips" })
      ]),
      node("l1_core_or_static", 2, ROUTE_NODE_TYPES.COMBAT, [
        option("static-field-00", 1, { rare: true, ruleId: "first_loop_static_field", activityId: "static_event", environmentThemeId: "static_strips", tags: ["event"] }),
        option("core-cover-01", 1.15, { environmentThemeId: "broken_cover" }),
        option("core-02", 0.75, { environmentThemeId: "twin_signal" })
      ]),
      node("l1_boss_lock", 3, ROUTE_NODE_TYPES.BOSS, [option("boss-03", 1, { environmentThemeId: "black_grid" })])
    ])
  }),

  loop_deep_shuffle: Object.freeze({
    id: "loop_deep_shuffle",
    label: "DEEP LOOP SHUFFLE",
    minLoop: 2,
    maxLoop: null,
    nodes: Object.freeze([
      node("deep_reward_or_grid", 0, ROUTE_NODE_TYPES.COMBAT, [
        option("casino-floor-00", 0.72, { rare: true, ruleId: "second_loop_casino_floor", activityId: "casino_floor", environmentThemeId: "cache_pockets", tags: ["casino"] }),
        option("grid-pockets-01", 1.1, { environmentThemeId: "cache_pockets", activityId: "loot_pocket" }),
        option("grid-cover-01", 1, { environmentThemeId: "broken_cover" }),
        option("void-strips-01", 0.65, { environmentThemeId: "static_strips" })
      ]),
      node("deep_pressure_branch", 1, ROUTE_NODE_TYPES.COMBAT, [
        option("void-01", 0.9, { environmentThemeId: "black_grid" }),
        option("void-strips-01", 1.25, { environmentThemeId: "static_strips" }),
        option("core-cover-01", 0.7, { environmentThemeId: "broken_cover" })
      ]),
      node("deep_core_branch", 2, ROUTE_NODE_TYPES.COMBAT, [
        option("core-02", 0.9, { environmentThemeId: "twin_signal" }),
        option("core-cover-01", 1.2, { environmentThemeId: "broken_cover" }),
        option("static-field-00", 0.55, { rare: true, ruleId: "deep_static_field", activityId: "static_event", environmentThemeId: "static_strips" })
      ]),
      node("deep_boss_lock", 3, ROUTE_NODE_TYPES.BOSS, [option("boss-03", 1, { environmentThemeId: "black_grid" })])
    ])
  })
});

export function roomPoolForLoop(loopIndex = 0) {
  const loop = Math.max(0, Math.floor(Number.isFinite(loopIndex) ? loopIndex : 0));
  return Object.values(ROOM_POOLS).find((pool) => {
    if (Number.isFinite(pool.minLoop) && loop < pool.minLoop) return false;
    if (Number.isFinite(pool.maxLoop) && loop > pool.maxLoop) return false;
    return true;
  }) || ROOM_POOLS.loop_deep_shuffle;
}

export function routeNodeForRoomInLoop(pool, roomInLoop = 0) {
  const index = Math.max(0, Math.floor(Number.isFinite(roomInLoop) ? roomInLoop : 0));
  return (pool?.nodes || []).find((entry) => entry.roomInLoop === index) || pool?.nodes?.[0] || null;
}
