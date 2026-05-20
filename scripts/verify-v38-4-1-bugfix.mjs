import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer } from '../src/game/state.js';
import { applyDevCommand } from '../src/game/dev.js';
import { spawnEnemy, updateSpawner } from '../src/game/enemies.js';
import { createExitPortal, initLocation, updatePortals } from '../src/game/portals.js';
import { directorSpawnEnemyCommand, executeDirectorCommands } from '../src/game/directorCommands.js';
import { resetThreatAnalyzer } from '../src/game/threat.js';
import { forceDirectorSpawnTimer } from '../src/game/director.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const threatSrc = readFileSync(new URL('../src/game/threat.js', import.meta.url), 'utf8');
const portalsSrc = readFileSync(new URL('../src/game/portals.js', import.meta.url), 'utf8');
const roomFlowSrc = readFileSync(new URL('../src/game/roomFlow.js', import.meta.url), 'utf8');
const runtimeResetSrc = readFileSync(new URL('../src/game/runtimeReset.js', import.meta.url), 'utf8');
const directorSrc = readFileSync(new URL('../src/game/director.js', import.meta.url), 'utf8');
const commandSrc = readFileSync(new URL('../src/game/directorCommands.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function fresh(seed = 'V38-4-1') {
  const state = createGameState(seed);
  addPlayer(state, 'p1', 0);
  return state;
}

function dev(seed = 'V38-4-1-DEV', extra = {}) {
  const state = createGameState(seed, { dev: { enabled: true, calm: false, ...extra } });
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
  updatePortals(state, 0.02);
}

test('v38.6 bugfix pass is registered', () => {
  assert.equal(pkg.version, '38.13.6');
  assert.match(threatSrc, /resetThreatAnalyzer/, 'threat reset helper should exist');
  assert.match(roomFlowSrc, /clearLocationRuntimeObjects/, 'portal transition clear should go through runtime reset helper');
  assert.match(runtimeResetSrc, /resetThreatAnalyzer/, 'runtime reset helper should reset threat');
  assert.match(directorSrc, /areDevSpawnsPaused[\s\S]*planBossSpawnCommand/, 'dev spawn pause should be checked before boss spawn planning');
  assert.match(commandSrc, /ENEMIES/, 'command executor should validate enemy kinds');
  assert.match(commandSrc, /policy\.canSpawn === false/, 'command executor should enforce phase canSpawn policy');
});

test('threat analyzer can be reset explicitly', () => {
  const state = fresh('V38-4-1-RESET-EXPLICIT');
  state.threat = { enemyIds: ['old'], killRate: 9, dominance: 1 };
  resetThreatAnalyzer(state);
  assert.equal(state.threat, null);
});

test('portal transition resets threat and keeps a visible portal effect', () => {
  const state = fresh('V38-4-1-PORTAL-THREAT');
  state.threat = { enemyIds: ['old-a', 'old-b'], killRate: 9, dominance: 1 };
  forcePortalTransition(state);

  assert.equal(state.locationIndex, 1, 'transition should enter next location');
  assert.equal(state.threat, null, 'room transition should not inherit previous threat analyzer history');
  assert.ok(state.effects.some((fx) => fx.type === 'portal'), 'portal visual effect should survive runtime clear');
});

test('dev clear-hostiles resets threat history', () => {
  const state = dev('V38-4-1-DEV-CLEAR');
  spawnEnemy(state, 'grunt', 200, 200);
  state.projectiles.p1 = { id: 'p1' };
  state.threat = { enemyIds: Object.keys(state.enemies), killRate: 5, dominance: 1 };

  assert.equal(applyDevCommand(state, 'clear-hostiles'), true);
  assert.equal(Object.keys(state.enemies).length, 0);
  assert.equal(Object.keys(state.projectiles).length, 0);
  assert.equal(state.threat, null);
});

test('dev spawn pause blocks boss spawn commands', () => {
  const state = dev('V38-4-1-PAUSE-BOSS', { spawnsPaused: true });
  initLocation(state, 3);
  state.locationTime = 5;
  forceDirectorSpawnTimer(state, 0);

  updateSpawner(state, 0.25);

  assert.equal(state.bossSpawned, false, 'paused director should not mark boss spawned');
  assert.equal(Object.values(state.enemies).some((enemy) => enemy.kind === 'boss'), false, 'paused director should not spawn boss enemy');
});

test('director command executor rejects invalid, overspend, canSpawn=false, and cap-blocked spawns', () => {
  const invalidState = fresh('V38-4-1-CMD-INVALID');
  let director = { budget: 10, spentBudget: 0, policy: { canSpawn: true }, enemyCap: 10 };
  let summary = executeDirectorCommands(invalidState, director, [
    directorSpawnEnemyCommand({ kind: 'not-real', cost: 1 })
  ], { spawnEnemy });
  assert.equal(summary.spawned, 0);
  assert.equal(summary.failed, 1);
  assert.equal(Object.keys(invalidState.enemies).length, 0);

  const overspendState = fresh('V38-4-1-CMD-BUDGET');
  director = { budget: 0, spentBudget: 0, policy: { canSpawn: true }, enemyCap: 10 };
  summary = executeDirectorCommands(overspendState, director, [
    directorSpawnEnemyCommand({ kind: 'tank', cost: 3 })
  ], { spawnEnemy });
  assert.equal(summary.spawned, 0);
  assert.equal(summary.failed, 1);
  assert.equal(director.budget, 0);

  const blockedState = fresh('V38-4-1-CMD-POLICY');
  director = { budget: 10, spentBudget: 0, policy: { canSpawn: false }, enemyCap: 10 };
  summary = executeDirectorCommands(blockedState, director, [
    directorSpawnEnemyCommand({ kind: 'grunt', cost: 1 })
  ], { spawnEnemy });
  assert.equal(summary.spawned, 0);
  assert.equal(summary.failed, 1);

  const capState = fresh('V38-4-1-CMD-CAP');
  spawnEnemy(capState, 'grunt', 100, 100);
  director = { budget: 10, spentBudget: 0, policy: { canSpawn: true }, enemyCap: 1 };
  summary = executeDirectorCommands(capState, director, [
    directorSpawnEnemyCommand({ kind: 'grunt', cost: 1 })
  ], { spawnEnemy });
  assert.equal(summary.spawned, 0);
  assert.equal(summary.failed, 1);
  assert.equal(Object.keys(capState.enemies).length, 1);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.6 bugfix checks passed`);
