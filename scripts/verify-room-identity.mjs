import assert from 'node:assert/strict';
import { ROOM_SEQUENCE } from '../src/data/rooms.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { createGameState, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation } from '../src/game/roomFlow.js';
import { RARE_ROOM_RULES, getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';

assert.equal(RARE_ROOM_RULES.length, 0, 'rare room rules must remain disabled until content pass');
const ids = [];
for (let depth = 0; depth < 8; depth += 1) ids.push(getLocationFromRoomPlan(resolveRoomPlan(depth)).id);
assert.deepEqual(ids, ['grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01', 'core-02', 'boss-03']);
for (const room of ROOM_SEQUENCE) assert.equal(room.layout, 'open_arena', `${room.id} should keep open_arena baseline layout`);
for (const modifier of Object.values(ROOM_MODIFIERS)) assert.deepEqual(modifier.hooks || {}, {}, `${modifier.id} should stay identity-only`);

const state = createGameState('ROOMIDENTITY-DOMAIN');
const firstPlan = state.roomPlan;
assert.equal(currentLocation(state).id, firstPlan.resolvedRoomId);
for (let i = 0; i < 5; i += 1) beginRoomTransition(state, 'verify-room-identity', { offerUpgrades: false });
assert.equal(state.runDepth, 5);
assert.equal(state.roomPlan.loopIndex, 1);
assert.equal(state.roomPlan.roomInLoop, 1);
assert.equal(state.roomPlan.roomSequenceIndex, 1);
assert.equal(state.roomPlan.baseRoomId, 'void-01');
assert.equal(state.roomPlan.resolvedRoomId, 'void-01');
const snap = makeSnapshot(state);
assert.equal(snap.location.baseRoomId, state.roomPlan.baseRoomId);
assert.equal(snap.location.resolvedRoomId, state.roomPlan.resolvedRoomId);
assert.equal(snap.location.ruleId, null);

console.log('room identity domain verification passed');
