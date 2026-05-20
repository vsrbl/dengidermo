import assert from 'node:assert/strict';
import { createGameState, addPlayer } from '../src/game/state.js';
import { beginRoomTransition, currentLocation, initLocation } from '../src/game/roomFlow.js';
import { roomGeometryIdentityMatches } from '../src/game/roomGeometry.js';
import { makeSnapshot } from '../src/game/state.js';

const state = createGameState('ROOMFLOW-DOMAIN');
const p = addPlayer(state, 'p1', 0);
state.enemies.e1 = { id: 'e1', hp: 10 };
state.projectiles.b1 = { id: 'b1' };
state.loot.l1 = { id: 'l1' };
state.companions.c1 = { id: 'c1' };
state.events.push({ type: 'test' });
initLocation(state, 0, { clearRuntime: true });
assert.equal(Object.keys(state.enemies).length, 0, 'initLocation clearRuntime must clear enemies');
assert.equal(Object.keys(state.projectiles).length, 0, 'initLocation clearRuntime must clear projectiles');
assert.equal(Object.keys(state.loot).length, 0, 'initLocation clearRuntime must clear loot');
assert.equal(Object.keys(state.companions).length, 0, 'initLocation clearRuntime must clear companions');
assert.ok(Object.keys(state.players).includes('p1'), 'room reset must keep players');
assert.equal(currentLocation(state).id, 'grid-00');
assert.equal(state.roomPlan.resolvedRoomId, 'grid-00');

const hpBefore = p.hp;
const firstPortalCount = Object.keys(state.portals).length;
assert.ok(firstPortalCount >= 1, 'enterLocation should create an exit portal');
const next = beginRoomTransition(state, 'verify-roomflow', { offerUpgrades: false });
assert.equal(next.id, 'void-01');
assert.equal(state.runDepth, 1);
assert.equal(state.locationIndex, 1, 'locationIndex remains compatibility alias for runDepth');
assert.equal(state.roomPlan.resolvedRoomId, 'void-01');
assert.ok(p.hp >= Math.min(hpBefore, p.maxHp), 'transition should not damage players');
assert.ok(Object.keys(state.portals).length >= 1, 'transition should recreate portal');
assert.equal(Object.keys(state.enemies).length, 0, 'transition should clear old enemies');
const event = state.events.find((e) => e.type === 'location' && e.reason === 'verify-roomflow');
assert.ok(event, 'transition should emit a location event');
assert.equal(event.layoutId, state.roomPlan.layoutId);
assert.equal(event.resolvedRoomId, state.roomPlan.resolvedRoomId);

const snap = makeSnapshot(state);
assert.equal(snap.location.runDepth, state.roomPlan.runDepth);
assert.equal(snap.location.resolvedRoomId, state.roomPlan.resolvedRoomId);
assert.equal(snap.location.layoutId, state.roomPlan.layoutId);
assert.equal(roomGeometryIdentityMatches(snap.location), true, 'snapshot location geometry identity must resolve locally');

console.log('roomflow domain verification passed');
