import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { layoutGeometryHash } from '../src/data/layouts.js';
import { createGameState, makeSnapshot } from '../src/game/state.js';
import { normalizeRoomPlan } from '../src/game/runPlanner.js';
import { beginRoomTransition } from '../src/game/roomFlow.js';
import {
  canPlaceCircleInLocation,
  roomGeometryIdentity,
  roomGeometryIdentityMatches,
  roomGeometrySnapshot
} from '../src/game/roomGeometry.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const stateSrc = readFileSync(new URL('../src/game/state.js', import.meta.url), 'utf8');
const mainSrc = [
  readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/app/clientRuntime.js', import.meta.url), 'utf8')
].join('\n');
const rendererSrc = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
const roomFlowSrc = readFileSync(new URL('../src/game/roomFlow.js', import.meta.url), 'utf8');
const layoutsSrc = readFileSync(new URL('../src/data/layouts.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

test('v38.13.5 is registered as the geometry snapshot cleanup version', () => {
  assert.equal(VERSION, 'v38.13.5');
  assert.equal(pkg.version, '38.13.5');
  assert.equal(serverPkg.version, '38.13.5');
  assert.match(pkg.scripts['check:all'], /check:v38-8-2/);
});

test('per-tick location snapshot carries static layout identity instead of full geometry', () => {
  const state = createGameState('V38-8-2-SNAPSHOT');
  state.roomPlan = normalizeRoomPlan({ ...state.roomPlan, layoutId: 'twin_pillars' });
  const snap = makeSnapshot(state);

  assert.equal(snap.location.layoutId, 'twin_pillars');
  assert.equal(snap.location.layoutVersion, 2);
  assert.equal(snap.location.geometryHash, layoutGeometryHash('twin_pillars'));
  assert.equal(snap.location.geometry, undefined, 'full static geometry must not be embedded in every snapshot');
  assert.equal(Object.hasOwn(snap.location, 'walls'), false, 'walls must not leak onto location snapshot');
  assert.equal(JSON.stringify(snap.location).includes('pillar_west'), false, 'static wall data should resolve locally, not ride the tick packet');
});

test('clients can resolve static geometry locally from snapshot layout identity', () => {
  const state = createGameState('V38-8-2-RESOLVE');
  state.roomPlan = normalizeRoomPlan({ ...state.roomPlan, layoutId: 'twin_pillars' });
  const snap = makeSnapshot(state);
  const geometry = roomGeometrySnapshot(snap.location);
  const wall = geometry.walls.find((w) => w.id === 'pillar_west');

  assert.equal(geometry.layoutId, 'twin_pillars');
  assert.equal(geometry.layoutVersion, snap.location.layoutVersion);
  assert.equal(geometry.geometryHash, snap.location.geometryHash);
  assert.ok(wall, 'client-side layout resolver should expose the static wall list');
  assert.equal(canPlaceCircleInLocation(geometry, wall.x + 10, wall.y + 10, 13), false);
});

test('host and client geometry hash contracts match for every static snapshot layout', () => {
  for (const layoutId of ['open_arena', 'twin_pillars', 'split_lanes']) {
    const identity = roomGeometryIdentity({ layoutId });
    assert.equal(identity.geometryHash, layoutGeometryHash(layoutId));
    assert.equal(roomGeometryIdentityMatches(identity), true, `${layoutId} identity should validate locally`);
    assert.equal(roomGeometryIdentityMatches({ ...identity, geometryHash: 'geo:bad' }), false, `${layoutId} bad hash should be rejected`);
  }
});

test('transition location events carry enough layout identity metadata', () => {
  const state = createGameState('V38-8-2-TRANSITION');
  beginRoomTransition(state, 'test', { offerUpgrades: false });
  const event = state.events.find((e) => e.type === 'location');

  assert.ok(event, 'location transition event missing');
  assert.equal(event.layoutId, 'open_arena');
  assert.equal(event.layoutVersion, 2);
  assert.equal(event.geometryHash, layoutGeometryHash('open_arena'));
  assert.equal(event.category, 'normal');
  assert.ok(Array.isArray(event.modifiers));
});

test('source boundaries enforce identity snapshots and local geometry resolution', () => {
  assert.doesNotMatch(stateSrc, /geometry:\s*roomGeometrySnapshot/, 'makeSnapshot must not include full roomGeometrySnapshot');
  assert.match(stateSrc, /roomGeometryIdentity/);
  assert.match(layoutsSrc, /layoutGeometryHash/);
  assert.match(mainSrc, /roomGeometryIdentityMatches/);
  assert.match(rendererSrc, /roomGeometrySnapshot\(location\)/, 'renderer should resolve static geometry locally');
  assert.match(roomFlowSrc, /layoutVersion/);
  assert.match(roomFlowSrc, /geometryHash/);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.5 geometry snapshot checks passed`);
