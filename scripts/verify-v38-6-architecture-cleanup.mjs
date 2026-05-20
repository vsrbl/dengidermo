import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { resetDirectorState } from '../src/game/director.js';
import { performDash } from '../src/game/abilities.js';
import { applyUpgrade, chooseUpgrade } from '../src/game/upgrades.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const htmlSrc = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const serverSrc = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
const stateSrc = readFileSync(new URL('../src/game/state.js', import.meta.url), 'utf8');
const directorSrc = readFileSync(new URL('../src/game/director.js', import.meta.url), 'utf8');
const directorReadSrc = readFileSync(new URL('../src/game/directorRead.js', import.meta.url), 'utf8');
const eventsSrc = readFileSync(new URL('../src/game/events.js', import.meta.url), 'utf8');
const upgradesSrc = readFileSync(new URL('../src/game/upgrades.js', import.meta.url), 'utf8');
const abilitiesSrc = readFileSync(new URL('../src/game/abilities.js', import.meta.url), 'utf8');
const gameFiles = [
  'abilities.js',
  'combat.js',
  'companions.js',
  'directorCommands.js',
  'effectCommands.js',
  'enemies.js',
  'enemyDeath.js',
  'loot.js',
  'projectiles.js',
  'roomFlow.js',
  'state.js'
].map((name) => [name, readFileSync(new URL(`../src/game/${name}`, import.meta.url), 'utf8')]);

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function fresh(seed = 'V38-6') {
  const state = createGameState(seed, { dev: { enabled: true, calm: false } });
  addPlayer(state, 'p1', 0);
  return state;
}

test('v38.6 architecture cleanup is registered', () => {
  assert.equal(VERSION, 'v38.13.6');
  assert.equal(pkg.version, '38.13.6');
  assert.equal(serverPkg.version, '38.13.6');
  assert.match(htmlSrc, /V38\.13\.6/);
  assert.match(serverSrc, /v38\.13\.6/);
  assert.match(pkg.scripts['check:all'], /check:v38-6/);
});

test('makeSnapshot uses fresh read-only director snapshot boundary', () => {
  assert.match(stateSrc, /import \{ directorSnapshot \} from "\.\/directorRead\.js"/);
  assert.match(stateSrc, /director: directorSnapshot\(state\)/);
  assert.doesNotMatch(stateSrc, /state\.director\.policy/);
  assert.doesNotMatch(stateSrc, /threatSnapshot\(state\)/);
  assert.match(directorSrc, /export \{ canOpenPortal, directorSnapshot, readDirectorEvaluation \} from "\.\/directorRead\.js"/);
  assert.match(directorReadSrc, /export function readDirectorEvaluation/);
});

test('snapshot director debug reads current objective gate without mutating director runtime', () => {
  const state = fresh('V38-6-FRESH-DIRECTOR-SNAPSHOT');
  state.locationTime = (state.portalReadyAt || 6) + 1;
  spawnEnemy(state, 'grunt', 260, 260);
  resetDirectorState(state);
  state.director.policy = { canSpawn: false, canOpenPortal: false }; // simulate stale policy mirror from previous tick
  state.enemies = {};

  const snap = makeSnapshot(state);

  assert.equal(snap.director.objective, 'clear');
  assert.equal(snap.director.phase, 'portal');
  assert.equal(snap.director.canOpenPortal, true, 'snapshot should recompute the current portal gate');
  assert.equal(state.director.policy.canOpenPortal, false, 'read snapshot must not mutate the runtime policy mirror');
});

test('director snapshot can be read before runtime director exists', () => {
  const state = fresh('V38-6-READ-ONLY-BEFORE-RUNTIME');
  assert.equal(state.director, null);
  const snap = makeSnapshot(state);
  assert.ok(snap.director);
  assert.equal(snap.director.runDepth, 0);
  assert.equal(state.director, null, 'makeSnapshot should not initialize director runtime state');
});

test('event queue owns upgrade and dash events', () => {
  assert.match(eventsSrc, /export function pushEvent/);
  assert.match(upgradesSrc, /pushEvent\(state, \{ type: "upgrade"/);
  assert.match(abilitiesSrc, /pushEvent\(state, \{ type: "dash"/);
  assert.doesNotMatch(upgradesSrc, /state\.events\.push/);
  assert.doesNotMatch(abilitiesSrc, /state\.events\.push/);

  const state = fresh('V38-6-EVENT-QUEUE');
  const player = state.players.p1;
  state.events = [];
  player.upgrades.choices = ['heavyPayload'];
  player.upgrades.offers = { heavyPayload: { rarity: 'common' } };
  assert.equal(chooseUpgrade(state, 'p1', 0), true);
  assert.equal(state.events.at(-1).type, 'upgrade');
  assert.match(state.events.at(-1).id, /^ev/);

  applyUpgrade(player, 'teleportDash', state);
  assert.equal(performDash(state, 'p1', { dx: 1, dy: 0 }, { seq: 1 }).ok, true);
  assert.equal(state.events.at(-1).type, 'dash');
  assert.match(state.events.at(-1).id, /^ev/);
});

test('state import pressure is reduced for ids and events', () => {
  for (const [name, src] of gameFiles) {
    if (name === 'state.js') continue;
    assert.doesNotMatch(src, /import \{[^}]*\b(nextId|pushEvent)\b[^}]*\} from "\.\/state\.js"/, `${name} should not import ids/events from state.js`);
  }
  assert.match(stateSrc, /export \{ nextId \} from "\.\/entityIds\.js"/);
  assert.match(stateSrc, /export \{ pushEvent \} from "\.\/events\.js"/);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.6 architecture cleanup checks passed`);
