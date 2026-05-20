import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { ENEMIES } from '../src/data/enemies.js';
import { createGameState, addPlayer } from '../src/game/state.js';
import { spawnEnemy, updateEnemies } from '../src/game/enemies.js';
import { ENEMY_BEHAVIORS, resolveEnemyBehavior, unknownEnemyBehaviors } from '../src/game/enemyBehaviors.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const serverSrc = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
const enemiesSrc = readFileSync(new URL('../src/game/enemies.js', import.meta.url), 'utf8');
const behaviorSrc = readFileSync(new URL('../src/game/enemyBehaviors.js', import.meta.url), 'utf8');
const dataEnemiesSrc = readFileSync(new URL('../src/data/enemies.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function freshState(label) {
  const state = createGameState(`ENEMY-BEHAVIOR-${label}`);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500;
  p.y = 500;
  p.vx = 0;
  p.vy = 0;
  p.kx = 0;
  p.ky = 0;
  p.hp = 100;
  p.maxHp = 100;
  state.spawnTimer = 9999;
  return { state, p };
}

test('v38.13.5 is registered as enemy behavior registry foundation', () => {
  assert.equal(VERSION, 'v38.13.5');
  assert.equal(pkg.version, '38.13.5');
  assert.equal(serverPkg.version, '38.13.5');
  assert.match(serverSrc, /nncckkrr signaling v38\.13\.5/);
  assert.match(pkg.scripts['check:all'], /check:v38-11/);
});

test('enemy behavior registry declares the current behavior contracts', () => {
  assert.deepEqual(Object.keys(ENEMY_BEHAVIORS).sort(), ['boss', 'chase', 'ranged']);
  assert.equal(typeof ENEMY_BEHAVIORS.chase, 'function');
  assert.equal(typeof ENEMY_BEHAVIORS.ranged, 'function');
  assert.equal(typeof ENEMY_BEHAVIORS.boss, 'function');
});

test('every enemy kind is data-driven by a known behavior', () => {
  assert.deepEqual(unknownEnemyBehaviors(ENEMIES), []);
  for (const [kind, data] of Object.entries(ENEMIES)) {
    assert.ok(data.behavior, `${kind} is missing behavior`);
    assert.equal(typeof resolveEnemyBehavior(data), 'function', `${kind} has unknown behavior ${data.behavior}`);
  }
});

test('updateEnemies delegates to registry instead of kind-specific or behavior-specific if chains', () => {
  assert.match(enemiesSrc, /resolveEnemyBehavior\(data\)/, 'updateEnemies should resolve behavior through the registry');
  assert.match(enemiesSrc, /behavior\(\{ state, enemy, data, target, dt, geometry, updateCtx \}\)/, 'updateEnemies should dispatch to behavior function');
  assert.doesNotMatch(enemiesSrc, /data\.behavior\s*={2,3}/, 'behavior checks should not live in enemies.js');
  assert.doesNotMatch(enemiesSrc, /enemy\.kind\s*={2,3}|kind\s*={2,3}\s*["']/, 'kind-specific logic should not live in updateEnemies');
  assert.doesNotMatch(enemiesSrc, /dealPlayerDamage\(/, 'touch damage implementation should live behind behavior helpers');
});

test('behavior helpers preserve the official damage and movement pipelines', () => {
  assert.match(behaviorSrc, /moveCircleInLocation\(/, 'enemy behavior movement must still use room geometry movement');
  assert.match(behaviorSrc, /dealPlayerDamage\(state, target, \{/, 'enemy touch damage must use dealPlayerDamage');
  assert.match(behaviorSrc, /DAMAGE_TAGS\.ENEMY/);
  assert.match(behaviorSrc, /DAMAGE_TAGS\.TOUCH/);
  assert.doesNotMatch(behaviorSrc, /target\.hp\s*[-+*/]?=/, 'behavior must not mutate player hp directly');
});

test('chase behavior still moves enemies toward the nearest alive player', () => {
  const { state, p } = freshState('CHASE');
  const grunt = spawnEnemy(state, 'grunt', p.x - 220, p.y);
  const before = grunt.x;
  updateEnemies(state, 0.2);
  assert.ok(grunt.x > before, `chase enemy should move right toward player (${before} -> ${grunt.x})`);
});

test('ranged behavior still backs away when too close', () => {
  const { state, p } = freshState('RANGED');
  const shooter = spawnEnemy(state, 'shooter', p.x + 200, p.y);
  const before = shooter.x;
  updateEnemies(state, 0.2);
  assert.ok(shooter.x > before, `ranged enemy should back away when close (${before} -> ${shooter.x})`);
});

test('boss behavior remains a registry-driven chase behavior', () => {
  const { state, p } = freshState('BOSS');
  const boss = spawnEnemy(state, 'boss', p.x + 300, p.y, { role: 'boss', zone: 'boss_anchor' });
  const before = boss.x;
  updateEnemies(state, 0.3);
  assert.ok(boss.x < before, `boss should move left toward player (${before} -> ${boss.x})`);
});

test('touch damage still works through behavior dispatch', () => {
  const { state, p } = freshState('TOUCH');
  spawnEnemy(state, 'runner', p.x + 5, p.y);
  const before = p.hp;
  updateEnemies(state, 0.01);
  assert.ok(p.hp < before, `touch damage did not apply (${before} -> ${p.hp})`);
});

test('future enemy data can be validated against the registry without editing updateEnemies', () => {
  const synthetic = {
    ...ENEMIES,
    testFutureChaser: { name: 'TEST', hp: 1, speed: 1, radius: 1, damage: 1, behavior: 'chase' },
    testFutureUnknown: { name: 'BAD', hp: 1, speed: 1, radius: 1, damage: 1, behavior: 'teleport' }
  };
  assert.deepEqual(unknownEnemyBehaviors(synthetic), [{ kind: 'testFutureUnknown', behavior: 'teleport' }]);
});

test('enemy data remains content-only and no new enemy kinds were added in v38.13.5', () => {
  assert.deepEqual(Object.keys(ENEMIES).sort(), ['boss', 'grunt', 'runner', 'shooter', 'tank']);
  assert.match(dataEnemiesSrc, /behavior:\s*"chase"/);
  assert.match(dataEnemiesSrc, /behavior:\s*"ranged"/);
  assert.match(dataEnemiesSrc, /behavior:\s*"boss"/);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.5 enemy behavior registry checks passed`);
