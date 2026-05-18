import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer } from '../src/game/state.js';
import { spawnEnemy, updateSpawner } from '../src/game/enemies.js';
import { directorSnapshot } from '../src/game/director.js';
import {
  DIRECTOR_COMMAND_TYPES,
  directorEventCommand,
  directorSpawnEnemyCommand,
  executeDirectorCommands
} from '../src/game/directorCommands.js';
import { initLocation } from '../src/game/portals.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const directorSrc = readFileSync(new URL('../src/game/director.js', import.meta.url), 'utf8');
const commandSrc = readFileSync(new URL('../src/game/directorCommands.js', import.meta.url), 'utf8');
const enemiesSrc = readFileSync(new URL('../src/game/enemies.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function fresh(seed = 'V38-2-COMMANDS') {
  const state = createGameState(seed);
  addPlayer(state, 'p1', 0);
  return state;
}

test('v38.4 command layer is registered', () => {
  assert.equal(pkg.version, '38.4.0');
  assert.match(commandSrc, /DIRECTOR_COMMAND_TYPES/, 'director command type registry missing');
  assert.match(commandSrc, /executeDirectorCommands/, 'director command executor missing');
  assert.match(directorSrc, /directorSpawnEnemyCommand/, 'director should plan spawn commands');
  assert.match(directorSrc, /executeDirectorCommands/, 'director should apply commands via executor');
  assert.doesNotMatch(directorSrc, /pushEvent\(/, 'director should not push events directly after command layer');
  assert.match(enemiesSrc, /updateDirectorSpawner\(state, dt, spawnEnemy\)/, 'enemy entity system should remain executor handler');
});

test('command executor spawns enemies through handler and spends budget', () => {
  const state = fresh('V38-2-EXEC-SPAWN');
  const director = { budget: 5, spentBudget: 0, eliteSpawned: false };
  const summary = executeDirectorCommands(state, director, [
    directorSpawnEnemyCommand({ kind: 'grunt', cost: 1, role: 'wave' }),
    directorSpawnEnemyCommand({ kind: 'tank', cost: 3, role: 'elite', markEliteSpawned: true })
  ], { spawnEnemy });

  assert.equal(summary.spawned, 2);
  assert.equal(summary.spawnedByRole.wave, 1);
  assert.equal(summary.spawnedByRole.elite, 1);
  assert.equal(Object.keys(state.enemies).length, 2);
  assert.equal(director.budget, 1);
  assert.equal(director.spentBudget, 4);
  assert.equal(director.eliteSpawned, true);
});

test('command executor emits events without direct director mutation', () => {
  const state = fresh('V38-2-EXEC-EVENT');
  const summary = executeDirectorCommands(state, {}, [
    directorEventCommand({ type: 'director', phase: 'pressure', x: 100, y: 120 })
  ], { spawnEnemy });

  assert.equal(summary.events, 1);
  assert.equal(state.events.at(-1).type, 'director');
  assert.equal(state.events.at(-1).phase, 'pressure');
});

test('command executor marks boss spawned only after successful boss command', () => {
  const state = fresh('V38-2-BOSS-COMMAND');
  const director = { budget: 0, spentBudget: 0 };
  const summary = executeDirectorCommands(state, director, [
    directorSpawnEnemyCommand({
      kind: 'boss',
      x: 1200,
      y: 180,
      role: 'boss',
      budgeted: false,
      markBossSpawned: true,
      event: { type: 'boss', x: 1200, y: 180 }
    })
  ], { spawnEnemy });

  assert.equal(summary.spawnedByRole.boss, 1);
  assert.equal(state.bossSpawned, true);
  assert.ok(Object.values(state.enemies).some((enemy) => enemy.kind === 'boss'));
  assert.equal(state.events.at(-1).type, 'boss');
  assert.equal(director.budget, 0, 'boss command should not consume pressure budget');
});

test('director pressure waves flow through command executor', () => {
  const state = fresh('V38-2-PRESSURE-COMMANDS');
  state.locationTime = 2.0;
  for (let i = 0; i < 4; i += 1) {
    state.spawnTimer = 0;
    updateSpawner(state, 0.25);
    state.locationTime += 0.25;
  }
  const snap = directorSnapshot(state);

  assert.equal(snap.phase, 'pressure');
  assert.ok(Object.keys(state.enemies).length > 0, 'pressure command did not create enemies');
  assert.ok(snap.budget < snap.totalBudget, 'command executor did not spend director budget');
  assert.ok(snap.wave >= 1, 'successful wave commands should advance wave counter');
});

test('boss room objective uses boss spawn command and portal gate survives command split', () => {
  const state = fresh('V38-2-BOSS-FLOW');
  initLocation(state, 3);
  state.locationTime = 4.2;
  state.spawnTimer = 0;
  updateSpawner(state, 0.25);
  let snap = directorSnapshot(state);

  assert.equal(snap.phase, 'boss');
  assert.equal(state.bossSpawned, true);
  assert.ok(Object.values(state.enemies).some((enemy) => enemy.kind === 'boss'));
  assert.equal(snap.canOpenPortal, false);

  state.enemies = {};
  state.locationTime = 20;
  updateSpawner(state, 0.25);
  snap = directorSnapshot(state);
  assert.equal(snap.phase, 'portal');
  assert.equal(snap.canOpenPortal, true);
});

test('cleanup remains non-spawning after command extraction', () => {
  const state = fresh('V38-2-CLEANUP-COMMANDS');
  for (let i = 0; i < 5; i += 1) spawnEnemy(state, 'grunt', 100 + i * 30, 120);
  const before = Object.keys(state.enemies).length;
  state.locationTime = (state.portalReadyAt || 5) + 1;
  state.spawnTimer = 0;
  updateSpawner(state, 1);
  const snap = directorSnapshot(state);

  assert.equal(snap.phase, 'cleanup');
  assert.equal(snap.canSpawn, false);
  assert.equal(Object.keys(state.enemies).length, before, 'cleanup should not issue spawn commands');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.4 director command checks passed`);
