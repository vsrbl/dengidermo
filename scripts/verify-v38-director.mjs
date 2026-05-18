import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { spawnEnemy, updateSpawner } from '../src/game/enemies.js';
import { canOpenPortal, directorSnapshot, forceDirectorSpawnTimer } from '../src/game/director.js';
import { initLocation, updatePortals } from '../src/game/portals.js';
import { getLocation } from '../src/data/locations.js';
import { readDevConfig } from '../src/dev/mode.js';

const directorSrc = readFileSync(new URL('../src/game/director.js', import.meta.url), 'utf8');
const directorReadSrc = readFileSync(new URL('../src/game/directorRead.js', import.meta.url), 'utf8');
const enemiesSrc = readFileSync(new URL('../src/game/enemies.js', import.meta.url), 'utf8');
const portalsSrc = readFileSync(new URL('../src/game/portals.js', import.meta.url), 'utf8');
const locationsSrc = readFileSync(new URL('../src/data/locations.js', import.meta.url), 'utf8');
const simulationSrc = readFileSync(new URL('../src/game/simulation.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function fresh(seed = 'V38-DIRECTOR') {
  const state = createGameState(seed);
  addPlayer(state, 'p1', 0);
  return state;
}

function tickSpawnerAt(state, time, dt = 0.25) {
  state.locationTime = time;
  forceDirectorSpawnTimer(state, 0);
  updateSpawner(state, dt);
  return directorSnapshot(state);
}

test('v38.6 version and director module are registered', () => {
  assert.equal(pkg.version, '38.6');
  assert.match(enemiesSrc, /updateDirectorSpawner\(state, dt, spawnEnemy\)/, 'enemies.js should delegate pacing to director.js');
  assert.match(simulationSrc, /updateSpawner\(state, safeDt\)/, 'host simulation should still tick the spawner path');
  assert.match(`${directorSrc}
${directorReadSrc}`, /PHASE_POLICIES/, 'director phase contracts missing');
  assert.match(directorSrc, /canOpenPortal/, 'director portal gate missing');
  assert.match(directorReadSrc, /bossObjectiveComplete/, 'boss objective gate missing');
  assert.match(portalsSrc, /portal\.active = canOpenPortal\(state\)/, 'portals should be director-gated');
  assert.match(locationsSrc, /mergeDirector/, 'location builder should merge director config from data');
});

test('director config is data-driven through biome and room', () => {
  const grid = getLocation(0);
  const boss = getLocation(3);
  assert.equal(grid.director.spawnStartDelay, 0.8);
  assert.equal(boss.director.bossCapMult, 0.44);
  assert.equal(boss.director.cleanupEnemyBase, 0);
  assert.ok(boss.boss.spawnAt < boss.portalDelay, 'boss must spawn before portal gate time');
});

test('initial room uses the same spawn start delay as transitioned rooms', () => {
  const state = fresh('V38-START-DELAY');
  assert.equal(state.spawnTimer, 0.8);
  initLocation(state, 1);
  assert.equal(state.spawnTimer, 0.8);
});

test('director creates pressure waves under budget and cap', () => {
  const state = fresh('V38-PRESSURE');
  state.locationTime = 2.0;
  forceDirectorSpawnTimer(state, 0);
  for (let i = 0; i < 6; i += 1) {
    forceDirectorSpawnTimer(state, 0);
    updateSpawner(state, 0.25);
    state.locationTime += 0.25;
  }
  const snap = directorSnapshot(state);
  const count = Object.keys(state.enemies).length;
  assert.equal(snap.phase, 'pressure');
  assert.equal(snap.canSpawn, true);
  assert.equal(snap.canOpenPortal, false);
  assert.ok(count > 0, 'pressure phase did not spawn enemies');
  assert.ok(count <= snap.enemyCap, `enemy cap exceeded (${count} > ${snap.enemyCap})`);
  assert.ok(snap.budget < snap.totalBudget, 'budget was not spent by waves');
});

test('cleanup phase is non-spawning and blocks portal while too many enemies remain', () => {
  const state = fresh('V38-CLEANUP-GATE');
  const portalAt = state.portalReadyAt || 5;
  for (let i = 0; i < 4; i += 1) spawnEnemy(state, 'grunt', 100 + i * 30, 120);
  const before = Object.keys(state.enemies).length;
  const snap = tickSpawnerAt(state, portalAt + 0.5, 1);
  assert.equal(snap.phase, 'cleanup');
  assert.equal(snap.canSpawn, false);
  assert.equal(snap.canOpenPortal, false);
  assert.equal(Object.keys(state.enemies).length, before, 'cleanup should not create fresh enemies');
  updatePortals(state, 0.2);
  assert.equal(Object.values(state.portals)[0].active, false, 'portal opened during cleanup');
});

test('portal opens only after director gate allows it', () => {
  const state = fresh('V38-PORTAL-GATE');
  const portalAt = state.portalReadyAt || 5;
  const snap = tickSpawnerAt(state, portalAt + 0.5, 1);
  assert.equal(snap.phase, 'portal');
  assert.equal(canOpenPortal(state), true);
  updatePortals(state, 0.2);
  assert.equal(Object.values(state.portals)[0].active, true, 'portal did not follow director gate');
  assert.equal(Object.keys(state.enemies).length, 0, 'portal phase should not create fresh enemies');
});

test('elite moment is one-shot and location-scaled', () => {
  const state = fresh('V38-ELITE');
  initLocation(state, 2);
  state.locationTime = 5.0;
  forceDirectorSpawnTimer(state, 0);
  updateSpawner(state, 0.25);
  const snap = directorSnapshot(state);
  assert.equal(snap.eliteSpawned, true, 'elite moment did not trigger in pressure phase');
  assert.ok(Object.values(state.enemies).some((enemy) => ['tank', 'shooter', 'runner'].includes(enemy.kind)), 'elite enemy was not spawned');
});

test('boss objective blocks portal until boss is gone', () => {
  const state = fresh('V38-BOSS-GATE');
  initLocation(state, 3);
  const bossLoc = getLocation(3);

  let snap = tickSpawnerAt(state, bossLoc.boss.spawnAt + 0.1, 0.25);
  assert.equal(snap.phase, 'boss');
  assert.ok(Object.values(state.enemies).some((enemy) => enemy.kind === 'boss'), 'boss did not spawn');

  snap = tickSpawnerAt(state, bossLoc.portalDelay + 1, 0.25);
  assert.equal(snap.phase, 'boss');
  assert.equal(snap.canOpenPortal, false);
  updatePortals(state, 0.2);
  assert.equal(Object.values(state.portals)[0].active, false, 'portal opened while boss was alive');

  state.enemies = {};
  snap = tickSpawnerAt(state, bossLoc.portalDelay + 1.5, 0.25);
  assert.equal(snap.phase, 'portal');
  assert.equal(snap.canOpenPortal, true);
  updatePortals(state, 0.2);
  assert.equal(Object.values(state.portals)[0].active, true, 'portal stayed closed after boss clear');
});

test('dev calm profile modifies director cap instead of bypassing it', () => {
  const config = readDevConfig('https://nncckkrr.space/#dev=void-v33-test&calm=1');
  const state = createGameState('V38-DEV-CALM', { dev: config });
  addPlayer(state, 'p1', 0);
  state.locationTime = 1.0;
  for (let i = 0; i < 18; i += 1) {
    forceDirectorSpawnTimer(state, 0);
    updateSpawner(state, 0.2);
  }
  const snap = directorSnapshot(state);
  assert.equal(snap.phase, 'pressure');
  assert.ok(snap.enemyCap <= 10, `dev calm cap did not flow through director (${snap.enemyCap})`);
  assert.ok(Object.keys(state.enemies).length <= 10, 'dev calm spawned beyond cap');
});

test('snapshot exposes lightweight director debug state and phase contracts', () => {
  const state = fresh('V38-SNAPSHOT');
  state.locationTime = 2.0;
  forceDirectorSpawnTimer(state, 0);
  updateSpawner(state, 0.25);
  const snap = makeSnapshot(state);
  assert.ok(snap.director, 'snapshot missing director state');
  assert.ok(['calm', 'pressure', 'boss', 'cleanup', 'portal'].includes(snap.director.phase), 'invalid director phase in snapshot');
  assert.equal(typeof snap.director.budget, 'number');
  assert.equal(typeof snap.director.canSpawn, 'boolean');
  assert.equal(typeof snap.director.canOpenPortal, 'boolean');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.6 director hardening checks passed`);
