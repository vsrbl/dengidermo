import assert from 'node:assert/strict';
import { ROOM_SEQUENCE, RARE_ROOMS, VARIETY_ROOMS } from '../src/data/rooms.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { ROOM_POOLS } from '../src/data/roomPools.js';
import { LOCATION_THEMES } from '../src/data/locationThemes.js';
import { createGameState, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation } from '../src/game/roomFlow.js';
import { getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';

assert.equal(ROOM_SEQUENCE.length, 4, 'base room sequence length should remain stable for boss cadence');
assert.deepEqual(RARE_ROOMS.map((room) => room.id), ['reward-cache-00', 'casino-floor-00', 'static-field-00'], 'controlled rare/activity rooms should stay registered outside base cadence');
assert.ok(VARIETY_ROOMS.length >= 4, 'v39.3.22 route variety should register normal room variants outside base cadence');
assert.ok(ROOM_POOLS.loop_zero_cadence, 'loop zero route pool must exist');
assert.ok(ROOM_POOLS.loop_one_variety, 'loop one variety route pool must exist');
assert.ok(ROOM_POOLS.loop_deep_shuffle, 'deep loop shuffle route pool must exist');

const loopZeroIds = [];
const loopZeroLayouts = [];
for (let depth = 0; depth < 4; depth += 1) {
  const plan = resolveRoomPlan(depth, { seed: 'ROOMIDENTITY-DOMAIN' });
  const loc = getLocationFromRoomPlan(plan);
  loopZeroIds.push(loc.id);
  loopZeroLayouts.push(loc.layoutId);
  assert.equal(plan.roomPoolId, 'loop_zero_cadence', 'first loop should use onboarding cadence pool');
  assert.ok(plan.routeNodeId, 'roomPlan should expose route node identity');
  assert.ok(plan.environmentThemeId, 'roomPlan should expose environment theme identity');
}
assert.deepEqual(loopZeroIds, ['grid-00', 'void-01', 'core-02', 'boss-03'], 'first loop should stay readable and familiar');
assert.deepEqual(loopZeroLayouts, ['open_arena', 'open_arena', 'twin_pillars', 'open_arena'], 'first loop layout cadence should stay stable');

const variedSeeds = ['A', 'B', 'C', 'D', 'nncckkrr', 'ROOMIDENTITY-DOMAIN'];
const loopOneRooms = new Set();
const loopOneLayouts = new Set();
const deepRooms = new Set();
const deepLayouts = new Set();
for (const seed of variedSeeds) {
  for (const depth of [4, 5, 6]) {
    const plan = resolveRoomPlan(depth, { seed });
    loopOneRooms.add(plan.resolvedRoomId);
    loopOneLayouts.add(plan.layoutId);
    assert.equal(plan.roomPoolId, 'loop_one_variety', 'loop one should use the variety pool');
    assert.ok(LOCATION_THEMES[plan.environmentThemeId], `${plan.resolvedRoomId} should resolve a known environment theme`);
  }
  for (const depth of [8, 9, 10]) {
    const plan = resolveRoomPlan(depth, { seed });
    deepRooms.add(plan.resolvedRoomId);
    deepLayouts.add(plan.layoutId);
    assert.equal(plan.roomPoolId, 'loop_deep_shuffle', 'loop two+ should use the deep shuffle pool');
  }
}
assert.ok(loopOneRooms.size >= 5, `loop one should produce multiple room identities across seeds, got ${[...loopOneRooms].join(', ')}`);
assert.ok(loopOneLayouts.has('side_pockets') || loopOneLayouts.has('broken_cover') || loopOneLayouts.has('static_strips'), 'loop one should introduce non-baseline layouts');
assert.ok(deepRooms.size >= 5, `deep loops should shuffle multiple room identities across seeds, got ${[...deepRooms].join(', ')}`);
assert.ok(deepLayouts.size >= 3, 'deep loops should expose multiple layouts across seeds');

for (const room of [...ROOM_SEQUENCE, ...RARE_ROOMS, ...VARIETY_ROOMS]) assert.ok(room.layout, `${room.id} should keep explicit layout identity`);
const behaviorModifierIds = new Set(['static_field', 'live_chat_hates_you', 'algorithm_boost', 'static_god', 'casino_floor']);
for (const modifier of Object.values(ROOM_MODIFIERS)) {
  if (behaviorModifierIds.has(modifier.id)) {
    assert.ok(Object.keys(modifier.hooks || {}).length > 0, `${modifier.id} should use room modifier hooks`);
    continue;
  }
  assert.deepEqual(modifier.hooks || {}, {}, `${modifier.id} should remain identity-only unless promoted into an explicit vertical slice`);
}

const state = createGameState('ROOMIDENTITY-DOMAIN');
const firstPlan = state.roomPlan;
assert.equal(currentLocation(state).id, firstPlan.resolvedRoomId);
assert.equal(state.roomPlan.layoutId, 'open_arena');
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.roomPlan.resolvedRoomId, 'void-01');
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.roomPlan.resolvedRoomId, 'core-02');
assert.equal(state.roomPlan.layoutId, 'twin_pillars');
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.roomPlan.resolvedRoomId, 'boss-03');
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.runDepth, 4);
assert.equal(state.roomPlan.loopIndex, 1);
assert.equal(state.roomPlan.roomPoolId, 'loop_one_variety');
assert.ok(state.roomPlan.routeNodeId, 'transitioned state should preserve route node id');
assert.ok(state.roomPlan.environmentThemeId, 'transitioned state should preserve environment theme id');

let snap = makeSnapshot(state);
assert.equal(snap.location.baseRoomId, state.roomPlan.baseRoomId);
assert.equal(snap.location.resolvedRoomId, state.roomPlan.resolvedRoomId);
assert.equal(snap.location.layoutId, state.roomPlan.layoutId);
assert.equal(snap.location.roomPoolId, state.roomPlan.roomPoolId);
assert.equal(snap.location.routeNodeId, state.roomPlan.routeNodeId);
assert.equal(snap.location.environmentThemeId, state.roomPlan.environmentThemeId);

beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.runDepth, 8);
assert.equal(state.roomPlan.loopIndex, 2);
assert.equal(state.roomPlan.roomPoolId, 'loop_deep_shuffle');
snap = makeSnapshot(state);
assert.equal(snap.location.roomPoolId, 'loop_deep_shuffle');
assert.ok(snap.location.environmentThemeId, 'deep loop snapshot should expose environment theme id');

console.log('room identity domain verification passed: route pools, varied room identities, layouts, and environment themes are wired');
