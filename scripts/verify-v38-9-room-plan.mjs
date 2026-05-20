import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { ROOM_SEQUENCE } from '../src/data/rooms.js';
import { createGameState, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation, initLocation } from '../src/game/roomFlow.js';
import { getLocationFromRoomPlan, getPlannedLocationForState, normalizeRoomPlan, RARE_ROOM_RULES, resolveRoomPlan } from '../src/game/runPlanner.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const stateSrc = readFileSync(new URL('../src/game/state.js', import.meta.url), 'utf8');
const plannerSrc = readFileSync(new URL('../src/game/runPlanner.js', import.meta.url), 'utf8');
const roomFlowSrc = readFileSync(new URL('../src/game/roomFlow.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

test('v38.13.6 is registered as persistent roomPlan foundation', () => {
  assert.equal(VERSION, 'v38.13.6');
  assert.equal(pkg.version, '38.13.6');
  assert.equal(serverPkg.version, '38.13.6');
  assert.match(pkg.scripts['check:all'], /check:v38-9/);
});

test('roomPlan stores resolved room identity and progression fields', () => {
  const plan = resolveRoomPlan(6, { seed: 'PLAN-SEED', createdAt: 42 });
  assert.deepEqual({ runDepth: plan.runDepth, loopIndex: plan.loopIndex, roomInLoop: plan.roomInLoop, roomSequenceIndex: plan.roomSequenceIndex }, {
    runDepth: 6,
    loopIndex: 1,
    roomInLoop: 2,
    roomSequenceIndex: 2
  });
  assert.equal(plan.baseRoomId, 'core-02');
  assert.equal(plan.resolvedRoomId, 'core-02');
  assert.equal(plan.roomId, 'core-02');
  assert.equal(plan.category, 'normal');
  assert.equal(plan.layoutId, 'open_arena');
  assert.deepEqual(plan.modifierIds, ['core_pressure']);
  assert.equal(plan.ruleId, null);
  assert.equal(plan.seed, 'PLAN-SEED');
  assert.equal(plan.createdAt, 42);
});

test('currentLocation and snapshot read persisted state.roomPlan instead of rerolling from runDepth', () => {
  const state = createGameState('ROOMPLAN-PERSIST');
  const baselineDepthOne = resolveRoomPlan(1, { seed: state.roomId });
  assert.equal(getLocationFromRoomPlan(baselineDepthOne).id, 'void-01');

  state.runDepth = 1;
  state.locationIndex = 1;
  state.roomPlan = normalizeRoomPlan({
    ...baselineDepthOne,
    baseRoomId: 'void-01',
    resolvedRoomId: 'boss-03',
    roomId: 'boss-03',
    category: 'boss',
    layoutId: 'open_arena',
    modifierIds: ['boss_lock'],
    rare: true,
    ruleId: 'test_rare_boss_like_room',
    createdAt: 99
  });

  const locA = currentLocation(state);
  const locB = getPlannedLocationForState(state);
  const snap = makeSnapshot(state);
  assert.equal(locA.id, 'boss-03');
  assert.equal(locB.id, 'boss-03');
  assert.equal(snap.location.id, 'boss-03');
  assert.equal(snap.location.runDepth, 1);
  assert.equal(snap.location.baseRoomId, 'void-01');
  assert.equal(snap.location.resolvedRoomId, 'boss-03');
  assert.equal(snap.location.ruleId, 'test_rare_boss_like_room');
  assert.equal(snap.location.category, 'boss');
});

test('createGameState initializes roomPlan as source of truth and mirrors compatibility fields', () => {
  const state = createGameState('ROOMPLAN-INIT');
  assert.ok(state.roomPlan);
  assert.equal(state.roomPlan.runDepth, 0);
  assert.equal(state.roomPlan.baseRoomId, 'grid-00');
  assert.equal(state.roomPlan.resolvedRoomId, 'grid-00');
  assert.equal(state.runDepth, state.roomPlan.runDepth);
  assert.equal(state.roomSequenceIndex, state.roomPlan.roomSequenceIndex);
  assert.equal(state.layoutId, state.roomPlan.layoutId);
  assert.equal(currentLocation(state).id, 'grid-00');
});

test('transitions create and persist exactly one next roomPlan for the entered room', () => {
  const state = createGameState('ROOMPLAN-FLOW');
  const firstPlan = state.roomPlan;
  initLocation(state, 3, { createPortal: false });
  assert.notEqual(state.roomPlan, firstPlan);
  assert.equal(state.roomPlan.runDepth, 3);
  assert.equal(state.roomPlan.resolvedRoomId, 'boss-03');
  assert.equal(currentLocation(state).id, 'boss-03');

  beginRoomTransition(state, 'test', { offerUpgrades: false });
  assert.equal(state.roomPlan.runDepth, 4);
  assert.equal(state.roomPlan.loopIndex, 1);
  assert.equal(state.roomPlan.roomInLoop, 0);
  assert.equal(state.roomPlan.roomSequenceIndex, 0);
  assert.equal(state.roomPlan.baseRoomId, 'grid-00');
  assert.equal(state.roomPlan.resolvedRoomId, 'grid-00');
  assert.equal(currentLocation(state).id, 'grid-00');
  assert.equal(state.events.at(-1).baseRoomId, 'grid-00');
  assert.equal(state.events.at(-1).resolvedRoomId, 'grid-00');
});

test('baseline cadence remains deterministic and rare room chance stays disabled', () => {
  assert.equal(RARE_ROOM_RULES.length, 0);
  const ids = [];
  for (let depth = 0; depth < 8; depth += 1) ids.push(getLocationFromRoomPlan(resolveRoomPlan(depth)).id);
  assert.deepEqual(ids, ['grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01', 'core-02', 'boss-03']);
  for (const room of ROOM_SEQUENCE) assert.equal(room.layout, 'open_arena', `${room.id} should keep open_arena in v38.13.6`);
});

test('source boundaries reflect persistent roomPlan contract', () => {
  assert.match(plannerSrc, /normalizeRoomPlan/);
  assert.match(plannerSrc, /getLocationFromRoomPlan/);
  assert.match(stateSrc, /roomPlan/);
  assert.match(stateSrc, /resolvedRoomId/);
  assert.match(roomFlowSrc, /state\.roomPlan = normalizedPlan/);
  assert.doesNotMatch(roomFlowSrc, /getPlannedLocation\(runDepth/);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.6 persistent roomPlan checks passed`);
