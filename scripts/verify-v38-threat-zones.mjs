import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WORLD } from '../src/core/constants.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { spawnEnemy, updateSpawner } from '../src/game/enemies.js';
import { directorSnapshot, forceDirectorSpawnTimer } from '../src/game/director.js';
import { directorSpawnEnemyCommand, executeDirectorCommands } from '../src/game/directorCommands.js';
import { chooseSpawnZone, resolveSpawnPoint, SPAWN_ZONE_IDS } from '../src/game/spawnZones.js';
import { threatSnapshot, updateThreatAnalyzer } from '../src/game/threat.js';
import { getEncounterPlan } from '../src/data/encounters.js';
import { getLocation } from '../src/data/locations.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const packageSrc = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const directorSrc = readFileSync(new URL('../src/game/director.js', import.meta.url), 'utf8');
const commandSrc = readFileSync(new URL('../src/game/directorCommands.js', import.meta.url), 'utf8');
const enemiesSrc = readFileSync(new URL('../src/game/enemies.js', import.meta.url), 'utf8');
const locationsSrc = readFileSync(new URL('../src/data/locations.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function fresh(seed = 'V38-4-ZONES') {
  const state = createGameState(seed);
  addPlayer(state, 'p1', 0);
  return state;
}

test('v38.6 threat and spawn zone modules are registered', () => {
  assert.equal(pkg.version, '38.13.4');
  assert.match(packageSrc, /check:v38-4/, 'check:v38-4 should be part of package scripts');
  assert.match(directorSrc, /updateThreatAnalyzer/, 'director should read threat analyzer output');
  assert.match(directorSrc, /chooseSpawnZone/, 'director should choose spawn zones for spawn commands');
  assert.match(commandSrc, /zone/, 'director spawn commands should carry zone intent');
  assert.match(enemiesSrc, /resolveSpawnPoint/, 'enemy handler should resolve zone-based spawn points');
  assert.match(locationsSrc, /spawnZones/, 'buildLocation should expose spawn zones from data');
});

test('spawn zones resolve predictable world edge points', () => {
  const state = fresh('V38-4-RESOLVE-ZONES');
  const north = resolveSpawnPoint(state, SPAWN_ZONE_IDS.NORTH);
  const east = resolveSpawnPoint(state, SPAWN_ZONE_IDS.EAST);
  const boss = resolveSpawnPoint(state, SPAWN_ZONE_IDS.BOSS_ANCHOR);

  assert.equal(north.y, 80);
  assert.ok(north.x >= 80 && north.x <= WORLD.w - 80);
  assert.equal(east.x, WORLD.w - 80);
  assert.ok(east.y >= 80 && east.y <= WORLD.h - 80);
  assert.equal(boss.x, WORLD.w / 2);
  assert.equal(boss.y, 180);
});

test('spawnEnemy preserves zone metadata when command executor resolves position', () => {
  const state = fresh('V38-4-COMMAND-ZONE');
  const director = { budget: 3, spentBudget: 0 };
  const summary = executeDirectorCommands(state, director, [
    directorSpawnEnemyCommand({ kind: 'grunt', role: 'wave', cost: 1, zone: SPAWN_ZONE_IDS.NORTH })
  ], { spawnEnemy });

  const enemy = Object.values(state.enemies)[0];
  assert.equal(summary.spawned, 1);
  assert.equal(enemy.spawnZone, SPAWN_ZONE_IDS.NORTH);
  assert.equal(enemy.y, 80);
  assert.equal(director.budget, 2);
});

test('encounter stages and locations carry spawn zone data', () => {
  const grid = getLocation(0);
  const core = getLocation(2);
  const plan = getEncounterPlan('core_elite_pressure');
  assert.ok(grid.spawnZones.includes(SPAWN_ZONE_IDS.EDGE_FAR));
  assert.ok(core.spawnZones.includes(SPAWN_ZONE_IDS.CORNER_RANDOM));
  assert.ok(plan.stages.some((stage) => Array.isArray(stage.spawnZones) && stage.spawnZones.includes(SPAWN_ZONE_IDS.EDGE_FLANK)));
});

test('threat analyzer creates relief pressure for low HP and nearby enemies', () => {
  const state = fresh('V38-4-THREAT-RELIEF');
  const player = state.players.p1;
  player.hp = 1;
  for (let i = 0; i < 6; i += 1) spawnEnemy(state, 'grunt', player.x + 40 + i * 8, player.y + 20);

  const threat = updateThreatAnalyzer(state, 0.25, { enemyCap: 10 }, getLocation(0));
  assert.ok(threat.healthPressure > 0.5, `expected high health pressure, got ${threat.healthPressure}`);
  assert.ok(threat.proximityPressure > 0.4, `expected nearby enemy pressure, got ${threat.proximityPressure}`);
  assert.ok(threat.relief > 0.35, `expected relief mode, got ${threat.relief}`);
  assert.ok(threat.batchMult < 1, 'relief should reduce batch multiplier');
  assert.ok(threat.intervalMult > 1, 'relief should slow spawn interval');
});

test('spawn zone chooser softens placement during relief pressure', () => {
  const state = fresh('V38-4-RELIEF-ZONE');
  const zone = chooseSpawnZone(
    state,
    getLocation(0),
    { spawnZones: [SPAWN_ZONE_IDS.NEAR_TEAM_EDGE, SPAWN_ZONE_IDS.EDGE_FLANK, SPAWN_ZONE_IDS.EDGE_FAR] },
    { relief: 0.8, dominance: 0 },
    'wave'
  );
  assert.equal(zone, SPAWN_ZONE_IDS.EDGE_FAR);
});

test('director pressure waves tag enemies with zone and expose threat snapshot', () => {
  const state = fresh('V38-4-DIRECTOR-ZONE-FLOW');
  state.locationTime = 2.2;
  updateSpawner(state, 0.25);
  forceDirectorSpawnTimer(state, 0);
  updateSpawner(state, 0.25);
  const enemies = Object.values(state.enemies);
  const snap = directorSnapshot(state);
  const full = makeSnapshot(state);

  assert.equal(snap.phase, 'pressure');
  assert.ok(enemies.length > 0, 'pressure should create at least one zone-based enemy');
  assert.ok(enemies.every((enemy) => typeof enemy.spawnZone === 'string'), 'director-spawned enemies should keep spawn zone metadata');
  assert.ok(snap.threat, 'director snapshot should expose threat state');
  assert.ok(full.director.threat, 'full snapshot should expose threat state');
  assert.deepEqual(threatSnapshot(state), full.director.threat);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.6 threat + spawn zone checks passed`);
