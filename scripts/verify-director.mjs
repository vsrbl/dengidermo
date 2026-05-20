import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { createGameState, addPlayer } from '../src/game/state.js';
import { currentLocation, initLocation } from '../src/game/roomFlow.js';
import { canOpenPortal, resetDirectorState, updateDirectorSpawner } from '../src/game/director.js';
import { DIRECTOR_COMMAND_TYPES, directorEventCommand, directorSpawnEnemyCommand, executeDirectorCommands } from '../src/game/directorCommands.js';
import { objectiveFor } from '../src/game/directorRead.js';

for (const [kind, data] of Object.entries(ENEMIES)) {
  assert.ok(data.behavior, `${kind} must declare an enemy behavior`);
}

const state = createGameState('DIRECTOR-DOMAIN');
addPlayer(state, 'p1', 0);
initLocation(state, 0, { clearRuntime: true });
const loc = currentLocation(state);
assert.equal(objectiveFor(loc).toUpperCase(), 'CLEAR');
state.locationTime = 999;
state.portalReadyAt = 0;
assert.equal(canOpenPortal(state), true, 'empty CLEAR room can open portal after readiness window');
const director = resetDirectorState(state, loc);
director.enemyCap = 1;
director.budget = 2;
const summary = executeDirectorCommands(state, director, [
  directorSpawnEnemyCommand({ kind: 'grunt', cost: 1, role: 'verify' }),
  directorSpawnEnemyCommand({ kind: 'missing_kind', cost: 1, role: 'bad' }),
  directorEventCommand({ type: 'verify_event' }),
  { type: 'unknown' }
], { spawnEnemy: (...args) => ({ id: 'mock', x: args[2] || 0, y: args[3] || 0, spawnZone: 'mock' }) });
assert.equal(summary.spawned, 1, 'director should execute one valid spawn');
assert.equal(summary.events, 1, 'director should execute one valid event');
assert.ok(summary.failed >= 1, 'director should reject invalid commands');
assert.ok(director.spentBudget >= 1, 'budgeted spawn should spend budget');

state.locationTime = 1;
updateDirectorSpawner(state, 1 / 60, () => null);
assert.ok(state.director, 'updateDirectorSpawner should keep a director runtime');

console.log('director domain verification passed');
