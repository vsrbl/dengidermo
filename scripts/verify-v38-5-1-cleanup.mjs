import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { createGameState, addPlayer } from '../src/game/state.js';
import { applyDevCommand } from '../src/game/dev.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { canOpenPortal, directorSnapshot, resetDirectorState } from '../src/game/director.js';
import { directorSpawnEnemyCommand, executeDirectorCommands } from '../src/game/directorCommands.js';
import { clearLocationRuntime } from '../src/game/roomFlow.js';
import { scoreUpgradeCandidate } from '../src/data/upgrades.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const devSrc = readFileSync(new URL('../src/game/dev.js', import.meta.url), 'utf8');
const runtimeResetSrc = readFileSync(new URL('../src/game/runtimeReset.js', import.meta.url), 'utf8');
const directorSrc = readFileSync(new URL('../src/game/director.js', import.meta.url), 'utf8');
const commandSrc = readFileSync(new URL('../src/game/directorCommands.js', import.meta.url), 'utf8');
const upgradesSrc = readFileSync(new URL('../src/data/upgrades.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function fresh(seed = 'V38-5-1') {
  const state = createGameState(seed);
  addPlayer(state, 'p1', 0);
  return state;
}

test('v38.5.1 cleanup patch is registered', () => {
  assert.equal(VERSION, 'v38.5.1');
  assert.equal(pkg.version, '38.5.1');
  assert.equal(serverPkg.version, '38.5.1');
  assert.match(runtimeResetSrc, /clearHostileRuntime/, 'hostile runtime reset helper missing');
  assert.match(runtimeResetSrc, /clearLocationRuntimeObjects/, 'location runtime reset helper missing');
  assert.match(devSrc, /clearHostileRuntime\(state\)/, 'dev clear-hostiles should use official hostile reset helper');
  assert.doesNotMatch(devSrc, /state\.enemies\s*=\s*\{\}/, 'dev.js should not hand-clear enemies after runtime reset helper');
  assert.match(directorSrc, /readDirectorEvaluation/, 'director read evaluation boundary missing');
  assert.match(commandSrc, /commandCost/, 'command executor budget accounting helper missing');
  assert.match(upgradesSrc, /state\?\.runDepth/, 'upgrade scoring should prefer runDepth over legacy locationIndex');
});

test('director command executor spends budget exactly once per successful budgeted spawn', () => {
  const state = fresh('V38-5-1-BUDGET-ACCOUNTING');
  const director = { budget: 10, spentBudget: 0, policy: { canSpawn: true }, enemyCap: 10 };
  const summary = executeDirectorCommands(state, director, [
    directorSpawnEnemyCommand({ kind: 'grunt', cost: 2, role: 'wave' })
  ], { spawnEnemy });

  assert.equal(summary.spawned, 1);
  assert.equal(summary.failed, 0);
  assert.equal(director.budget, 8, 'budget should decrease by exactly command cost');
  assert.equal(director.spentBudget, 2, 'spent budget should increase by exactly command cost');
});

test('director snapshot and portal query do not mutate director state', () => {
  const state = fresh('V38-5-1-READ-SAFE-DIRECTOR');
  resetDirectorState(state);
  const before = JSON.stringify(state.director);

  state.locationTime = (state.portalReadyAt || 5) + 10;
  state.enemies = {};

  const snap = directorSnapshot(state);
  assert.equal(snap.phase, 'portal', 'read snapshot should compute current phase');
  assert.equal(canOpenPortal(state), true, 'read portal query should compute current gate');
  assert.equal(JSON.stringify(state.director), before, 'read helpers must not mutate state.director');
});

test('portal query can evaluate fresh state without creating director state', () => {
  const state = fresh('V38-5-1-READ-SAFE-FRESH');
  assert.equal(state.director, null);
  state.locationTime = (state.portalReadyAt || 5) + 10;
  state.enemies = {};

  assert.equal(canOpenPortal(state), true);
  assert.equal(state.director, null, 'canOpenPortal should not initialize/mutate director state as a read query');
});

test('dev clear-hostiles and room runtime clear share reset semantics', () => {
  const state = createGameState('V38-5-1-DEV-CLEAR', { dev: { enabled: true, calm: false } });
  addPlayer(state, 'p1', 0);
  spawnEnemy(state, 'grunt', 200, 200);
  state.projectiles.pr1 = { id: 'pr1' };
  state.effects.push({ type: 'debug' });
  state.threat = { killRate: 99, enemyIds: ['old'] };

  assert.equal(applyDevCommand(state, 'clear-hostiles'), true);
  assert.deepEqual(Object.keys(state.enemies), []);
  assert.deepEqual(Object.keys(state.projectiles), []);
  assert.deepEqual(state.effects, []);
  assert.equal(state.threat, null);

  state.enemies.e1 = { id: 'e1', kind: 'grunt' };
  state.projectiles.pr2 = { id: 'pr2' };
  state.companions.c1 = { id: 'c1' };
  state.loot.l1 = { id: 'l1' };
  state.portals.pt1 = { id: 'pt1' };
  state.threat = { killRate: 42 };
  state.director = { phase: 'pressure' };
  clearLocationRuntime(state);

  assert.deepEqual(Object.keys(state.enemies), []);
  assert.deepEqual(Object.keys(state.projectiles), []);
  assert.deepEqual(Object.keys(state.companions), []);
  assert.deepEqual(Object.keys(state.loot), []);
  assert.deepEqual(Object.keys(state.portals), []);
  assert.equal(state.threat, null);
  assert.equal(state.director, null);
});

test('upgrade economy reads runDepth instead of stale legacy locationIndex', () => {
  const low = fresh('V38-5-1-UPGRADE-LOW');
  const high = fresh('V38-5-1-UPGRADE-HIGH');
  low.runDepth = 0;
  low.locationIndex = 0;
  high.runDepth = 10;
  high.locationIndex = 0;

  const lowScore = scoreUpgradeCandidate(low.players.p1, 'clusterBomb', low).score;
  const highScore = scoreUpgradeCandidate(high.players.p1, 'clusterBomb', high).score;
  assert.ok(highScore > lowScore, `legendary score should scale with runDepth (${highScore} <= ${lowScore})`);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.5.1 cleanup checks passed`);
