import assert from 'node:assert/strict';
import { ROOM_SEQUENCE, RARE_ROOMS } from '../src/data/rooms.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { createGameState, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation } from '../src/game/roomFlow.js';
import { RARE_ROOM_RULES, getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';

assert.equal(ROOM_SEQUENCE.length, 4, 'base room sequence length should remain stable');
assert.deepEqual(RARE_ROOMS.map((room) => room.id), ['reward-cache-00', 'casino-floor-00', 'static-field-00'], 'controlled rare rooms should be registered outside base cadence');
assert.deepEqual(RARE_ROOM_RULES.map((rule) => rule.id), ['first_loop_reward_cache', 'first_loop_static_field', 'second_loop_casino_floor'], 'rare room rules should stay explicit after content begins');

const ids = [];
const baseIds = [];
const layouts = [];
const rules = [];
for (let depth = 0; depth < 10; depth += 1) {
  const plan = resolveRoomPlan(depth);
  const loc = getLocationFromRoomPlan(plan);
  ids.push(loc.id);
  baseIds.push(plan.baseRoomId);
  layouts.push(loc.layoutId);
  rules.push(plan.ruleId);
}
assert.deepEqual(ids, ['grid-00', 'void-01', 'core-02', 'boss-03', 'reward-cache-00', 'void-01', 'static-field-00', 'boss-03', 'casino-floor-00', 'void-01']);
assert.deepEqual(baseIds, ['grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01']);
assert.deepEqual(layouts, ['open_arena', 'open_arena', 'twin_pillars', 'open_arena', 'open_arena', 'open_arena', 'open_arena', 'open_arena', 'open_arena', 'open_arena']);
assert.deepEqual(rules, [null, null, null, null, 'first_loop_reward_cache', null, 'first_loop_static_field', null, 'second_loop_casino_floor', null]);
for (const room of [...ROOM_SEQUENCE, ...RARE_ROOMS]) assert.ok(room.layout, `${room.id} should keep explicit layout identity`);
const behaviorModifierIds = new Set(['static_field', 'live_chat_hates_you', 'algorithm_boost', 'static_god', 'casino_floor']);
for (const modifier of Object.values(ROOM_MODIFIERS)) {
  if (behaviorModifierIds.has(modifier.id)) {
    assert.ok(Object.keys(modifier.hooks || {}).length > 0, `${modifier.id} should use room modifier hooks`);
    continue;
  }
  assert.deepEqual(modifier.hooks || {}, {}, `${modifier.id} should remain identity-only unless promoted into an explicit vertical slice`);
}
assert.equal(ROOM_MODIFIERS.static_field.category, 'cursed', 'static_field remains the cursed rare-room modifier');
assert.equal(ROOM_MODIFIERS.live_chat_hates_you.category, 'pressure', 'live_chat_hates_you should be the first director-pressure stack modifier');
assert.equal(ROOM_MODIFIERS.algorithm_boost.category, 'reward-risk', 'algorithm_boost should be the first reward-risk stack modifier');
assert.equal(ROOM_MODIFIERS.static_god.category, 'projectile-rule', 'static_god should be the first projectile-rule stack modifier');
assert.equal(ROOM_MODIFIERS.casino_floor.category, 'reward-activity', 'casino_floor should be the first casino/reward activity room identity modifier');

const state = createGameState('ROOMIDENTITY-DOMAIN');
const firstPlan = state.roomPlan;
assert.equal(currentLocation(state).id, firstPlan.resolvedRoomId);
assert.equal(state.roomPlan.layoutId, 'open_arena');
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.roomPlan.resolvedRoomId, 'void-01');
assert.equal(state.roomPlan.layoutId, 'open_arena');
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.roomPlan.resolvedRoomId, 'core-02');
assert.equal(state.roomPlan.layoutId, 'twin_pillars');
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.roomPlan.resolvedRoomId, 'boss-03');
assert.equal(state.roomPlan.layoutId, 'open_arena');
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.runDepth, 4);
assert.equal(state.roomPlan.loopIndex, 1);
assert.equal(state.roomPlan.roomInLoop, 0);
assert.equal(state.roomPlan.roomSequenceIndex, 0);
assert.equal(state.roomPlan.baseRoomId, 'grid-00');
assert.equal(state.roomPlan.resolvedRoomId, 'reward-cache-00');
assert.equal(state.roomPlan.ruleId, 'first_loop_reward_cache');
assert.equal(state.roomPlan.rare, true);
assert.equal(state.roomPlan.category, 'reward');
assert.equal(state.roomPlan.layoutId, 'open_arena');
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.runDepth, 5);
assert.equal(state.roomPlan.loopIndex, 1);
assert.equal(state.roomPlan.roomInLoop, 1);
assert.equal(state.roomPlan.roomSequenceIndex, 1);
assert.equal(state.roomPlan.baseRoomId, 'void-01');
assert.equal(state.roomPlan.resolvedRoomId, 'void-01');
assert.equal(state.roomPlan.layoutId, 'open_arena');
let snap = makeSnapshot(state);
assert.equal(snap.location.baseRoomId, state.roomPlan.baseRoomId);
assert.equal(snap.location.resolvedRoomId, state.roomPlan.resolvedRoomId);
assert.equal(snap.location.layoutId, state.roomPlan.layoutId);
assert.equal(snap.location.ruleId, null);
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.runDepth, 6);
assert.equal(state.roomPlan.loopIndex, 1);
assert.equal(state.roomPlan.roomInLoop, 2);
assert.equal(state.roomPlan.roomSequenceIndex, 2);
assert.equal(state.roomPlan.baseRoomId, 'core-02');
assert.equal(state.roomPlan.resolvedRoomId, 'static-field-00');
assert.equal(state.roomPlan.ruleId, 'first_loop_static_field');
assert.equal(state.roomPlan.rare, true);
assert.equal(state.roomPlan.category, 'cursed');
assert.equal(state.roomPlan.layoutId, 'open_arena');
snap = makeSnapshot(state);
assert.equal(snap.location.baseRoomId, 'core-02');
assert.equal(snap.location.resolvedRoomId, 'static-field-00');
assert.equal(snap.location.ruleId, 'first_loop_static_field');
assert.equal(snap.location.modifiers[0]?.id, 'static_field');

beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.runDepth, 7);
assert.equal(state.roomPlan.resolvedRoomId, 'boss-03');
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.runDepth, 8);
assert.equal(state.roomPlan.loopIndex, 2);
assert.equal(state.roomPlan.roomInLoop, 0);
assert.equal(state.roomPlan.roomSequenceIndex, 0);
assert.equal(state.roomPlan.baseRoomId, 'grid-00');
assert.equal(state.roomPlan.resolvedRoomId, 'casino-floor-00');
assert.equal(state.roomPlan.ruleId, 'second_loop_casino_floor');
assert.equal(state.roomPlan.rare, true);
assert.equal(state.roomPlan.category, 'reward');
assert.equal(state.roomPlan.layoutId, 'open_arena');
snap = makeSnapshot(state);
assert.equal(snap.location.baseRoomId, 'grid-00');
assert.equal(snap.location.resolvedRoomId, 'casino-floor-00');
assert.equal(snap.location.ruleId, 'second_loop_casino_floor');
assert.equal(snap.location.modifiers[0]?.id, 'casino_floor');

console.log('room identity domain verification passed');
