import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { spawnEnemy, updateSpawner } from '../src/game/enemies.js';
import { directorSnapshot } from '../src/game/director.js';
import { initLocation } from '../src/game/portals.js';
import { readDevConfig } from '../src/dev/mode.js';

const directorSrc = readFileSync(new URL('../src/game/director.js', import.meta.url), 'utf8');
const enemiesSrc = readFileSync(new URL('../src/game/enemies.js', import.meta.url), 'utf8');
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

test('v38 version and director module are registered', () => {
  assert.equal(pkg.version, '38.0.0');
  assert.match(enemiesSrc, /updateDirectorSpawner\(state, dt, spawnEnemy\)/, 'enemies.js should delegate pacing to director.js');
  assert.match(simulationSrc, /updateSpawner\(state, safeDt\)/, 'host simulation should still tick the spawner path');
  assert.match(directorSrc, /phaseFor/, 'director phase calculation missing');
  assert.match(directorSrc, /totalBudgetFor/, 'director spawn budget calculation missing');
  assert.match(directorSrc, /maybeSpawnElite/, 'director elite moment missing');
});

test('director creates pressure waves under budget and cap', () => {
  const state = fresh('V38-PRESSURE');
  state.locationTime = 2.0;
  state.spawnTimer = 0;
  for (let i = 0; i < 12; i += 1) {
    state.spawnTimer = 0;
    updateSpawner(state, 0.25);
    state.locationTime += 0.25;
  }
  const snap = directorSnapshot(state);
  const count = Object.keys(state.enemies).length;
  assert.equal(snap.phase, 'pressure');
  assert.ok(count > 0, 'pressure phase did not spawn enemies');
  assert.ok(count <= snap.enemyCap, `enemy cap exceeded (${count} > ${snap.enemyCap})`);
  assert.ok(snap.budget < snap.totalBudget, 'budget was not spent by waves');
});

test('director stops new waves when portal flow begins', () => {
  const state = fresh('V38-PORTAL');
  state.locationTime = (state.portalReadyAt || 5) + 1;
  state.spawnTimer = 0;
  updateSpawner(state, 1);
  const snap = directorSnapshot(state);
  assert.equal(snap.phase, 'portal');
  assert.equal(Object.keys(state.enemies).length, 0, 'portal phase should not create fresh enemies');
});

test('elite moment is one-shot and location-scaled', () => {
  const state = fresh('V38-ELITE');
  initLocation(state, 2);
  state.locationTime = 5.0;
  state.spawnTimer = 0;
  updateSpawner(state, 0.25);
  const snap = directorSnapshot(state);
  assert.equal(snap.eliteSpawned, true, 'elite moment did not trigger in pressure phase');
  assert.ok(Object.values(state.enemies).some((enemy) => ['tank', 'shooter', 'runner'].includes(enemy.kind)), 'elite enemy was not spawned');
});

test('dev calm profile modifies director cap instead of bypassing it', () => {
  const config = readDevConfig('https://nncckkrr.space/#dev=void-v33-test&calm=1');
  const state = createGameState('V38-DEV-CALM', { dev: config });
  addPlayer(state, 'p1', 0);
  state.locationTime = 1.0;
  for (let i = 0; i < 18; i += 1) {
    state.spawnTimer = 0;
    updateSpawner(state, 0.2);
  }
  const snap = directorSnapshot(state);
  assert.equal(snap.phase, 'pressure');
  assert.ok(snap.enemyCap <= 10, `dev calm cap did not flow through director (${snap.enemyCap})`);
  assert.ok(Object.keys(state.enemies).length <= 10, 'dev calm spawned beyond cap');
});

test('snapshot exposes lightweight director debug state', () => {
  const state = fresh('V38-SNAPSHOT');
  state.locationTime = 2.0;
  state.spawnTimer = 0;
  updateSpawner(state, 0.25);
  const snap = makeSnapshot(state);
  assert.ok(snap.director, 'snapshot missing director state');
  assert.ok(['calm', 'pressure', 'reward', 'portal'].includes(snap.director.phase), 'invalid director phase in snapshot');
  assert.equal(typeof snap.director.budget, 'number');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38 director checks passed`);
