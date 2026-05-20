import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { ENCOUNTER_OBJECTIVES, getEncounterPlan } from '../src/data/encounters.js';
import { getLocation } from '../src/data/locations.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { spawnEnemy, updateSpawner } from '../src/game/enemies.js';
import { canOpenPortal, directorSnapshot, forceDirectorSpawnTimer, resetDirectorState } from '../src/game/director.js';
import { initLocation } from '../src/game/portals.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const htmlSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const styleSrc = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const uiSrc = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
const directorSrc = readFileSync(new URL('../src/game/director.js', import.meta.url), 'utf8');
const directorReadSrc = readFileSync(new URL('../src/game/directorRead.js', import.meta.url), 'utf8');
const encounterSrc = readFileSync(new URL('../src/data/encounters.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function fresh(seed = 'V38-5-2') {
  const state = createGameState(seed, { dev: { enabled: true, calm: false } });
  addPlayer(state, 'p1', 0);
  return state;
}

test('v38.6 director clarity patch is registered', () => {
  assert.equal(VERSION, 'v38.13.2');
  assert.equal(pkg.version, '38.13.2');
  assert.equal(serverPkg.version, '38.13.2');
  assert.match(pkg.scripts['check:all'], /check:v38-5-2/, 'check:v38-5-2 should be part of check:all');
  assert.match(encounterSrc, /ENCOUNTER_OBJECTIVES/, 'encounter objective registry missing');
  assert.match(directorReadSrc, /objectiveFor/, 'director objective resolver missing');
  assert.match(directorReadSrc, /cleanupThreshold\(state, cfg, loc\)/, 'cleanup threshold should be objective-aware');
});

test('encounter and location data expose explicit objectives', () => {
  assert.equal(ENCOUNTER_OBJECTIVES.CLEAR, 'clear');
  assert.equal(getEncounterPlan('grid_intro_pressure').objective, ENCOUNTER_OBJECTIVES.CLEAR);
  assert.equal(getEncounterPlan('void_pressure').objective, ENCOUNTER_OBJECTIVES.SURVIVE);
  assert.equal(getEncounterPlan('core_elite_pressure').objective, ENCOUNTER_OBJECTIVES.CLEAR);
  assert.equal(getEncounterPlan('boss_objective').objective, ENCOUNTER_OBJECTIVES.BOSS);
  assert.equal(getLocation(0).objective, 'clear');
  assert.equal(getLocation(1).objective, 'survive');
  assert.equal(getLocation(2).objective, 'clear');
  assert.equal(getLocation(3).objective, 'boss');
});

test('CLEAR objective keeps portal locked until enemies are fully cleared', () => {
  const state = fresh('V38-5-2-CLEAR-OBJECTIVE');
  state.locationTime = (state.portalReadyAt || 5) + 1;
  spawnEnemy(state, 'grunt', 240, 240);

  let snap = directorSnapshot(state);
  assert.equal(snap.objective, 'clear');
  assert.equal(snap.cleanupThreshold, 0);
  assert.equal(snap.phase, 'cleanup');
  assert.equal(canOpenPortal(state), false, 'clear objective should not open portal with any live enemy');

  state.enemies = {};
  snap = directorSnapshot(state);
  assert.equal(snap.phase, 'portal');
  assert.equal(canOpenPortal(state), true, 'clear objective should open portal after full clear');
});

test('SURVIVE objective can open portal with low remaining enemy pressure', () => {
  const state = fresh('V38-5-2-SURVIVE-OBJECTIVE');
  initLocation(state, 1);
  state.locationTime = (state.portalReadyAt || 7) + 1;
  spawnEnemy(state, 'grunt', 250, 250);
  spawnEnemy(state, 'grunt', 300, 250);

  const snap = directorSnapshot(state);
  assert.equal(snap.objective, 'survive');
  assert.ok(snap.cleanupThreshold >= 3, `expected survive threshold for 1p, got ${snap.cleanupThreshold}`);
  assert.equal(snap.phase, 'portal');
  assert.equal(canOpenPortal(state), true, 'survive objective should allow escape with low remaining pressure');
});

test('BOSS objective requires boss done and zero cleanup enemies', () => {
  const state = fresh('V38-5-2-BOSS-OBJECTIVE');
  initLocation(state, 3);
  state.locationTime = (state.portalReadyAt || 18) + 1;
  state.bossSpawned = true;
  spawnEnemy(state, 'grunt', 280, 280);

  let snap = directorSnapshot(state);
  assert.equal(snap.objective, 'boss');
  assert.equal(snap.cleanupThreshold, 0);
  assert.equal(canOpenPortal(state), false, 'boss objective should not open with cleanup enemies alive');

  state.enemies = {};
  snap = directorSnapshot(state);
  assert.equal(snap.phase, 'portal');
  assert.equal(canOpenPortal(state), true, 'boss objective should open after boss done and cleanup clear');
});

test('director snapshot exposes gameplay debug fields for HUD', () => {
  const state = fresh('V38-5-2-DIRECTOR-HUD-SNAPSHOT');
  state.locationTime = 2;
  forceDirectorSpawnTimer(state, 0);
  updateSpawner(state, 0.25);
  const snap = makeSnapshot(state);

  assert.ok(snap.director, 'snapshot should include director');
  assert.equal(snap.director.objective, 'clear');
  assert.equal(typeof snap.director.cleanupThreshold, 'number');
  assert.ok(snap.director.lastSpawn, 'spawned wave should expose lastSpawn debug info');
  assert.equal(typeof snap.director.lastSpawn.zone, 'string');
  assert.ok(snap.director.threat, 'snapshot should include threat debug data');
});

test('dev director HUD is present but hidden outside dev snapshots', () => {
  assert.match(htmlSrc, /id="directorDebug"/, 'index.html should include director debug HUD node');
  assert.match(styleSrc, /\.director-debug/, 'style.css should style director debug HUD');
  assert.match(uiSrc, /setDirectorDebug/, 'ui should update director debug HUD');
  assert.match(uiSrc, /snapshot\?\.dev/, 'director debug HUD should be dev-gated');
  assert.match(uiSrc, /lastSpawn/, 'director HUD should display last spawn zone/role/kind');
});

test('legacy state.spawnTimer no longer overwrites initialized director timer', () => {
  const state = fresh('V38-5-2-SPAWN-TIMER-SOURCE');
  state.locationTime = 2;
  resetDirectorState(state);
  state.director.spawnTimer = 5;
  state.spawnTimer = 0; // stale legacy mirror should not force a spawn anymore

  updateSpawner(state, 0.1);

  assert.equal(Object.keys(state.enemies).length, 0, 'stale legacy mirror should not trigger spawn');
  assert.ok(state.director.spawnTimer > 4.5, `director timer should remain runtime source, got ${state.director.spawnTimer}`);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.6 director clarity checks passed`);
