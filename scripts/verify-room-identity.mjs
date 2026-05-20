import assert from 'node:assert/strict';
import { ROOM_SEQUENCE } from '../src/data/rooms.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { createGameState, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation } from '../src/game/roomFlow.js';
import { RARE_ROOM_RULES, getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';

assert.equal(RARE_ROOM_RULES.length, 0, 'rare room rules remain disabled during the first layout-only v39 step');
const ids = [];
const layouts = [];
for (let depth = 0; depth < 8; depth += 1) {
  const loc = getLocationFromRoomPlan(resolveRoomPlan(depth));
  ids.push(loc.id);
  layouts.push(loc.layoutId);
}
assert.deepEqual(ids, ['grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01', 'core-02', 'boss-03']);
assert.deepEqual(layouts, ['open_arena', 'open_arena', 'twin_pillars', 'open_arena', 'open_arena', 'open_arena', 'twin_pillars', 'open_arena']);
for (const room of ROOM_SEQUENCE) assert.ok(room.layout, `${room.id} should keep explicit layout identity`);
for (const modifier of Object.values(ROOM_MODIFIERS)) assert.deepEqual(modifier.hooks || {}, {}, `${modifier.id} should stay identity-only until modifier content pass`);

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
beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.runDepth, 5);
assert.equal(state.roomPlan.loopIndex, 1);
assert.equal(state.roomPlan.roomInLoop, 1);
assert.equal(state.roomPlan.roomSequenceIndex, 1);
assert.equal(state.roomPlan.baseRoomId, 'void-01');
assert.equal(state.roomPlan.resolvedRoomId, 'void-01');
assert.equal(state.roomPlan.layoutId, 'open_arena');
const snap = makeSnapshot(state);
assert.equal(snap.location.baseRoomId, state.roomPlan.baseRoomId);
assert.equal(snap.location.resolvedRoomId, state.roomPlan.resolvedRoomId);
assert.equal(snap.location.layoutId, state.roomPlan.layoutId);
assert.equal(snap.location.ruleId, null);

console.log('room identity domain verification passed');
