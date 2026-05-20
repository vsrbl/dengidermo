import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { spawnEnemy, updateSpawner } from '../src/game/enemies.js';
import { directorSnapshot, forceDirectorSpawnTimer } from '../src/game/director.js';
import { getEncounterPlan, ENCOUNTER_PLANS } from '../src/data/encounters.js';
import { getLocation } from '../src/data/locations.js';
import { initLocation } from '../src/game/portals.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const architectureSrc = readFileSync(new URL('../src/game/director.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/game/directorRead.js', import.meta.url), 'utf8');
const locationsSrc = readFileSync(new URL('../src/data/locations.js', import.meta.url), 'utf8');
const packageSrc = readFileSync(new URL('../package.json', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function fresh(seed = 'V38-4-ENCOUNTERS') {
  const state = createGameState(seed);
  addPlayer(state, 'p1', 0);
  return state;
}

function snapAt(state, time, dt = 0.25) {
  state.locationTime = time;
  forceDirectorSpawnTimer(state, 0);
  updateSpawner(state, dt);
  return directorSnapshot(state);
}

test('v38.6 encounter plans are registered and checked', () => {
  assert.equal(pkg.version, '38.13.3');
  assert.match(packageSrc, /check:v38-3/, 'check:v38-3 should be part of package scripts');
  assert.ok(ENCOUNTER_PLANS.grid_intro_pressure, 'grid encounter plan missing');
  assert.ok(ENCOUNTER_PLANS.void_pressure, 'void encounter plan missing');
  assert.ok(ENCOUNTER_PLANS.core_elite_pressure, 'core encounter plan missing');
  assert.ok(ENCOUNTER_PLANS.boss_objective, 'boss encounter plan missing');
});

test('locations resolve room/biome encounter ids into runtime locations', () => {
  assert.match(locationsSrc, /encounterId/, 'buildLocation should expose encounterId');
  assert.equal(getLocation(0).encounterId, 'grid_intro_pressure');
  assert.equal(getLocation(1).encounterId, 'void_pressure');
  assert.equal(getLocation(2).encounterId, 'core_elite_pressure');
  assert.equal(getLocation(3).encounterId, 'boss_objective');
});

test('director selects stage from encounter plan data instead of hardcoded phase-only rules', () => {
  assert.match(architectureSrc, /getEncounterPlan/, 'director should load encounter plans');
  assert.match(architectureSrc, /selectEncounterStage/, 'director should resolve current stage from plan data');
  assert.match(architectureSrc, /stage\.capMult|stageMultiplier/, 'director should use stage multipliers');
  assert.doesNotMatch(architectureSrc, /pushEvent\(/, 'director should still emit events via command layer only');
});

test('grid encounter flows calm -> pressure -> cleanup -> portal through stage ids', () => {
  const state = fresh('V38-4-GRID-FLOW');
  let snap = snapAt(state, 0.2);
  assert.equal(snap.encounterId, 'grid_intro_pressure');
  assert.equal(snap.phase, 'calm');
  assert.equal(snap.stageId, 'boot-calm');

  snap = snapAt(state, 2.2);
  assert.equal(snap.phase, 'pressure');
  assert.equal(snap.stageId, 'grid-pressure');
  assert.equal(snap.canSpawn, true);

  for (let i = 0; i < 4; i += 1) spawnEnemy(state, 'grunt', 100 + i * 40, 140);
  snap = snapAt(state, (state.portalReadyAt || 5) + 0.5);
  assert.equal(snap.phase, 'cleanup');
  assert.equal(snap.stageId, 'grid-cleanup');
  assert.equal(snap.canOpenPortal, false);

  state.enemies = {};
  snap = snapAt(state, (state.portalReadyAt || 5) + 1);
  assert.equal(snap.phase, 'portal');
  assert.equal(snap.stageId, 'grid-portal');
  assert.equal(snap.canOpenPortal, true);
});

test('non-grid rooms use distinct encounter plans and tuning', () => {
  const voidPlan = getEncounterPlan('void_pressure');
  const corePlan = getEncounterPlan('core_elite_pressure');
  assert.notEqual(voidPlan.stages[1].id, corePlan.stages[1].id);
  assert.ok(corePlan.director.budgetBase > voidPlan.director.budgetBase, 'core plan should be tuned heavier than void');

  const state = fresh('V38-4-CORE-FLOW');
  initLocation(state, 2);
  const snap = snapAt(state, 2.0);
  assert.equal(snap.encounterId, 'core_elite_pressure');
  assert.equal(snap.stageId, 'core-crush');
  assert.equal(snap.phase, 'pressure');
});

test('boss objective is an encounter plan with arrival, fight, aftershock and portal stages', () => {
  const state = fresh('V38-4-BOSS-FLOW');
  initLocation(state, 3);
  const loc = getLocation(3);

  let snap = snapAt(state, Math.max(0.2, loc.boss.spawnAt - 0.2));
  assert.equal(snap.encounterId, 'boss_objective');
  assert.equal(snap.stageId, 'boss-arrival');
  assert.equal(snap.phase, 'calm');

  snap = snapAt(state, loc.boss.spawnAt + 0.25);
  assert.equal(snap.stageId, 'boss-fight');
  assert.equal(snap.phase, 'boss');
  assert.equal(state.bossSpawned, true);
  assert.ok(Object.values(state.enemies).some((enemy) => enemy.kind === 'boss'));

  state.enemies = {};
  snap = snapAt(state, loc.boss.spawnAt + 1.5);
  assert.equal(snap.stageId, 'boss-aftershock');
  assert.equal(snap.phase, 'pressure');
  assert.equal(snap.canOpenPortal, false);

  state.enemies = {};
  snap = snapAt(state, loc.portalDelay + 1);
  assert.equal(snap.stageId, 'boss-portal');
  assert.equal(snap.phase, 'portal');
  assert.equal(snap.canOpenPortal, true);
});

test('snapshot exposes encounter and stage for lightweight debug UI', () => {
  const state = fresh('V38-4-SNAPSHOT');
  state.locationTime = 2;
  forceDirectorSpawnTimer(state, 0);
  updateSpawner(state, 0.25);
  const snap = makeSnapshot(state);
  assert.equal(snap.director.encounterId, 'grid_intro_pressure');
  assert.equal(typeof snap.director.stageId, 'string');
  assert.equal(typeof snap.director.canSpawn, 'boolean');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.6 encounter plan checks passed`);
