import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { getLocation } from '../src/data/locations.js';
import { ROOM_SEQUENCE } from '../src/data/rooms.js';
import { ROOM_MODIFIERS, resolveRoomModifiers } from '../src/data/roomModifiers.js';
import { ROOM_LAYOUTS, getLayout } from '../src/data/layouts.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, createExitPortal, currentLocation, initLocation } from '../src/game/roomFlow.js';
import { runProgressionFor } from '../src/game/runProgression.js';
import { getPlannedLocation, RARE_ROOM_RULES, resolveRoomPlan } from '../src/game/runPlanner.js';
import { roomModifierSnapshots } from '../src/game/roomModifiers.js';
import { portalPointForLocation, roomGeometrySnapshot } from '../src/game/roomGeometry.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const locationsSrc = readFileSync(new URL('../src/data/locations.js', import.meta.url), 'utf8');
const roomFlowSrc = readFileSync(new URL('../src/game/roomFlow.js', import.meta.url), 'utf8');
const stateSrc = readFileSync(new URL('../src/game/state.js', import.meta.url), 'utf8');
const plannerSrc = readFileSync(new URL('../src/game/runPlanner.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

test('v38.13.3 is registered', () => {
  assert.equal(VERSION, 'v38.13.3');
  assert.equal(pkg.version, '38.13.3');
  assert.equal(serverPkg.version, '38.13.3');
  assert.match(pkg.scripts['check:all'], /check:v38-7/);
});

test('run progression exposes loop fields without changing room cadence', () => {
  assert.equal(ROOM_SEQUENCE.length, 4);
  const p0 = runProgressionFor(0);
  const p3 = runProgressionFor(3);
  const p4 = runProgressionFor(4);
  const p10 = runProgressionFor(10);
  assert.deepEqual({ runDepth: p0.runDepth, loopIndex: p0.loopIndex, roomInLoop: p0.roomInLoop }, { runDepth: 0, loopIndex: 0, roomInLoop: 0 });
  assert.deepEqual({ runDepth: p3.runDepth, loopIndex: p3.loopIndex, roomInLoop: p3.roomInLoop }, { runDepth: 3, loopIndex: 0, roomInLoop: 3 });
  assert.deepEqual({ runDepth: p4.runDepth, loopIndex: p4.loopIndex, roomInLoop: p4.roomInLoop }, { runDepth: 4, loopIndex: 1, roomInLoop: 0 });
  assert.deepEqual({ runDepth: p10.runDepth, loopIndex: p10.loopIndex, roomInLoop: p10.roomInLoop }, { runDepth: 10, loopIndex: 2, roomInLoop: 2 });
});

test('run planner is first-class and currently preserves baseline rooms', () => {
  assert.equal(RARE_ROOM_RULES.length, 0, 'rare-room rules should be contract-only in v38.9');
  const ids = [];
  const loops = [];
  const categories = [];
  for (let depth = 0; depth < 8; depth += 1) {
    const plan = resolveRoomPlan(depth);
    const loc = getPlannedLocation(depth);
    ids.push(loc.id);
    loops.push(loc.loopIndex);
    categories.push(loc.category);
    assert.equal(plan.roomId, loc.id);
    assert.equal(loc.runDepth, depth);
    assert.equal(loc.roomInLoop, depth % 4);
    assert.equal(loc.roomSequenceIndex, depth % 4);
    assert.equal(loc.portalTargetDepth, depth + 1);
  }
  assert.deepEqual(ids, ['grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01', 'core-02', 'boss-03']);
  assert.deepEqual(loops, [0, 0, 0, 0, 1, 1, 1, 1]);
  assert.deepEqual(categories, ['normal', 'normal', 'normal', 'boss', 'normal', 'normal', 'normal', 'boss']);
});

test('legacy getLocation still cycles but now carries identity metadata', () => {
  const loc = getLocation(4);
  assert.equal(loc.id, 'grid-00');
  assert.equal(loc.runDepth, 4);
  assert.equal(loc.loopIndex, 1);
  assert.equal(loc.category, 'normal');
  assert.equal(loc.layoutId, 'open_arena');
  assert.ok(loc.tags.includes('grid'));
  assert.deepEqual(loc.modifierIds, ['grid_static']);
});

test('room data declares categories, tags, layouts and modifiers', () => {
  for (const room of ROOM_SEQUENCE) {
    assert.ok(room.category, `${room.id} missing category`);
    assert.ok(Array.isArray(room.tags) && room.tags.length, `${room.id} missing tags`);
    assert.ok(room.layout, `${room.id} missing layout`);
    assert.ok(getLayout(room.layout), `${room.id} points to unknown layout`);
    assert.ok(Array.isArray(room.modifiers) && room.modifiers.length, `${room.id} missing modifiers`);
    assert.equal(resolveRoomModifiers(room.modifiers).length, room.modifiers.length, `${room.id} has unknown modifiers`);
  }
  assert.ok(ROOM_MODIFIERS.grid_static);
  assert.ok(ROOM_LAYOUTS.open_arena);
});

test('location snapshots expose room identity without leaking gameplay logic into data', () => {
  const state = createGameState('V38-7-SNAPSHOT');
  addPlayer(state, 'p1', 0, { name: 'host' });
  const snap = makeSnapshot(state);
  assert.equal(snap.location.runDepth, 0);
  assert.equal(snap.location.loopIndex, 0);
  assert.equal(snap.location.roomInLoop, 0);
  assert.equal(snap.location.category, 'normal');
  assert.equal(snap.location.layoutId, 'open_arena');
  assert.ok(Array.isArray(snap.location.modifiers));
  assert.equal(snap.location.modifiers[0].id, 'grid_static');
  assert.equal(snap.location.geometry, undefined, 'per-tick snapshot should carry layout identity, not full static geometry');
  assert.equal(snap.location.layoutVersion, 2);
  assert.match(snap.location.geometryHash, /^geo:open_arena:2:/);
  assert.deepEqual(roomGeometrySnapshot(snap.location).walls, []);
});

test('roomFlow uses planner and geometry contracts for transitions and portals', () => {
  const state = createGameState('V38-7-FLOW');
  addPlayer(state, 'p1', 0);
  initLocation(state, 3, { createPortal: false });
  assert.equal(currentLocation(state).id, 'boss-03');
  assert.equal(state.loopIndex, 0);
  assert.equal(state.roomCategory, 'boss');
  beginRoomTransition(state, 'test', { offerUpgrades: false });
  assert.equal(state.runDepth, 4);
  assert.equal(state.loopIndex, 1);
  assert.equal(state.roomInLoop, 0);
  assert.equal(state.roomSequenceIndex, 0);
  assert.equal(currentLocation(state).id, 'grid-00');
  const portal = createExitPortal(state);
  const point = portalPointForLocation(currentLocation(state));
  assert.equal(portal.x, point.x);
  assert.equal(portal.y, point.y);
  assert.deepEqual(roomGeometrySnapshot(currentLocation(state)).walls, []);
});

test('source boundaries keep room identity as data plus thin game adapters', () => {
  assert.match(plannerSrc, /resolveRoomPlan/);
  assert.match(plannerSrc, /RARE_ROOM_RULES/);
  assert.match(roomFlowSrc, /getPlannedLocation/);
  assert.match(roomFlowSrc, /portalPointForLocation/);
  assert.match(stateSrc, /loopIndex/);
  assert.match(stateSrc, /roomModifierSnapshots/);
  assert.doesNotMatch(locationsSrc, /\.\.\/game\//, 'data/locations must not import game modules');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.3 room identity checks passed`);
