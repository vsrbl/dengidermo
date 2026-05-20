import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { getLocation } from '../src/data/locations.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { updateSpawner, spawnEnemy } from '../src/game/enemies.js';
import { updateCompanions } from '../src/game/companions.js';
import { canOpenPortal } from '../src/game/director.js';
import { createExitPortal, updatePortals } from '../src/game/portals.js';
import { beginRoomTransition, clearLocationRuntime, currentLocation, initLocation } from '../src/game/roomFlow.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const roomFlowSrc = readFileSync(new URL('../src/game/roomFlow.js', import.meta.url), 'utf8');
const portalsSrc = readFileSync(new URL('../src/game/portals.js', import.meta.url), 'utf8');
const locationsSrc = readFileSync(new URL('../src/data/locations.js', import.meta.url), 'utf8');
const stateSrc = readFileSync(new URL('../src/game/state.js', import.meta.url), 'utf8');
const directorSrc = readFileSync(new URL('../src/game/director.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function fresh(seed = 'V38-5') {
  const state = createGameState(seed);
  addPlayer(state, 'p1', 0);
  return state;
}

function forcePortalTransition(state) {
  const portal = createExitPortal(state);
  const player = state.players.p1;
  player.x = portal.x;
  player.y = portal.y;
  state.locationTime = Math.max(state.portalReadyAt || 0, 99);
  state.portalHold = 0.01;
  // Make the director gate deterministic for this integration check.
  state.enemies = {};
  updatePortals(state, 0.02);
}

test('v38.6 room flow module is registered', () => {
  assert.equal(VERSION, 'v38.13.2');
  assert.equal(pkg.version, '38.13.2');
  assert.match(roomFlowSrc, /beginRoomTransition/, 'room flow transition entrypoint missing');
  assert.match(roomFlowSrc, /clearLocationRuntime/, 'official runtime reset pipeline missing');
  assert.match(portalsSrc, /beginRoomTransition/, 'portals should delegate transition orchestration to roomFlow');
  assert.doesNotMatch(portalsSrc, /offerUpgradesToPlayers|healPlayer|resetThreatAnalyzer|getLocation/, 'portals.js should no longer own room lifecycle details');
  assert.match(locationsSrc, /sequenceIndex/, 'locations should expose sequence index');
  assert.match(locationsSrc, /runDepth/, 'locations should expose run depth');
  assert.match(stateSrc, /runDepth/, 'state should persist run depth');
  assert.match(stateSrc, /roomSequenceIndex/, 'state should persist room sequence index');
});

test('getLocation separates monotonic run depth from cyclic room sequence', () => {
  const ids = [];
  const sequence = [];
  for (let depth = 0; depth < 8; depth += 1) {
    const loc = getLocation(depth);
    ids.push(loc.id);
    sequence.push(loc.sequenceIndex);
    assert.equal(loc.runDepth, depth);
    assert.equal(loc.portalTargetDepth, depth + 1);
  }
  assert.deepEqual(ids, ['grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01', 'core-02', 'boss-03']);
  assert.deepEqual(sequence, [0, 1, 2, 3, 0, 1, 2, 3]);
});

test('beginRoomTransition advances runDepth monotonically while room data cycles', () => {
  const state = fresh('V38-5-RUNDEPTH');
  const ids = [currentLocation(state).id];
  const depths = [state.runDepth];
  const sequence = [state.roomSequenceIndex];

  for (let i = 0; i < 6; i += 1) {
    beginRoomTransition(state, 'test', { offerUpgrades: false });
    ids.push(currentLocation(state).id);
    depths.push(state.runDepth);
    sequence.push(state.roomSequenceIndex);
  }

  assert.deepEqual(depths, [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(ids, ['grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01', 'core-02']);
  assert.deepEqual(sequence, [0, 1, 2, 3, 0, 1, 2]);
  assert.equal(state.locationIndex, state.runDepth, 'legacy locationIndex should stay aligned with run depth');
});

test('director scaling uses runDepth instead of resetting with room sequence index', () => {
  const early = fresh('V38-5-SCALE-EARLY');
  initLocation(early, 0);
  updateSpawner(early, 0.01);

  const later = fresh('V38-5-SCALE-LATE');
  initLocation(later, 4);
  updateSpawner(later, 0.01);

  assert.equal(currentLocation(early).id, currentLocation(later).id, 'depth 0 and 4 should both use grid room data');
  assert.equal(later.roomSequenceIndex, 0);
  assert.ok(later.director.totalBudget > early.director.totalBudget, 'later run depth should increase director budget');
  assert.ok(later.director.intensity >= early.director.intensity, 'later run depth should not scale down intensity');
});

test('clearLocationRuntime resets location-scoped runtime but preserves player build', () => {
  const state = fresh('V38-5-CLEAR-RUNTIME');
  const player = state.players.p1;
  player.inventory.weapons.push('rocket');
  player.inventory.activeWeapon = 'rocket';
  player.upgrades.taken.drone = 1;
  state.enemies.e1 = { id: 'e1', kind: 'grunt' };
  state.projectiles.pr1 = { id: 'pr1' };
  state.companions.c1 = { id: 'c1', ownerId: 'p1' };
  state.loot.l1 = { id: 'l1' };
  state.effects.push({ type: 'x' });
  state.portals.pt1 = { id: 'pt1' };
  state.director = { phase: 'pressure' };
  state.threat = { killRate: 9 };

  clearLocationRuntime(state);

  assert.deepEqual(Object.keys(state.enemies), []);
  assert.deepEqual(Object.keys(state.projectiles), []);
  assert.deepEqual(Object.keys(state.companions), []);
  assert.deepEqual(Object.keys(state.loot), []);
  assert.deepEqual(state.effects, []);
  assert.deepEqual(Object.keys(state.portals), []);
  assert.equal(state.director, null);
  assert.equal(state.threat, null);
  assert.equal(state.players.p1.inventory.activeWeapon, 'rocket');
  assert.equal(state.players.p1.upgrades.taken.drone, 1);
});

test('room transition gives offers, recreates portal and lets companions respawn near owner next tick', () => {
  const state = fresh('V38-5-TRANSITION-REWARD');
  const player = state.players.p1;
  player.upgrades.taken.drone = 1;
  updateCompanions(state, 0.05);
  assert.ok(Object.keys(state.companions).length > 0, 'companion should exist before transition');

  beginRoomTransition(state, 'test');

  assert.equal(state.runDepth, 1);
  assert.ok(Object.keys(state.portals).length === 1, 'new room should have a fresh exit portal');
  assert.deepEqual(Object.keys(state.companions), [], 'live companion entities should reset at room transition');
  assert.equal(player.upgrades.choices.length, 3, 'room reward step should offer upgrades after entering next location');

  updateCompanions(state, 0.05);
  assert.ok(Object.values(state.companions).every((c) => c.ownerId === 'p1'));
});

test('portal integration calls roomFlow and snapshots expose run depth + sequence', () => {
  const state = fresh('V38-5-PORTAL-INTEGRATION');
  forcePortalTransition(state);

  const snap = makeSnapshot(state);
  assert.equal(state.runDepth, 1);
  assert.equal(state.roomSequenceIndex, 1);
  assert.equal(snap.location.runDepth, 1);
  assert.equal(snap.location.roomSequenceIndex, 1);
  assert.ok(state.effects.some((fx) => fx.type === 'portal'), 'portal transition visual should survive roomFlow clear');
  assert.ok(state.events.some((event) => event.type === 'location' && event.reason === 'portal'));
});

test('boss room portal remains objective-gated through roomFlow architecture', () => {
  const state = fresh('V38-5-BOSS-GATE');
  initLocation(state, 3);
  state.locationTime = 20;
  spawnEnemy(state, 'boss', 1000, 200);
  state.bossSpawned = true;

  assert.equal(canOpenPortal(state), false, 'live boss must block portal');
  state.enemies = {};
  assert.equal(canOpenPortal(state), true, 'dead boss after portal time should allow portal');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.6 room flow checks passed`);
