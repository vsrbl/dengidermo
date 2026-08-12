import assert from 'node:assert/strict';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import {
  createRun, createPlayer, applyLivingCasinoWeaponOption,
  livingCasinoDistributedSparkTargets, livingCasinoRebalanceActiveSparks
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.222');
assert.equal(BUILD_ID, 'spark_target_distribution');
assert.equal(PROTOCOL, 15);

const run = createRun(22201);
run.plan = { w: 1200, h: 800, walls: [] };
run.now = 1;
const p = createPlayer('spark-test', 'SPARK', 0, { hero: 'living_casino' });
p.x = 300; p.y = 300; p.aimX = 420; p.aimY = 300;
const players = new Map([[p.id, p]]);
assert.equal(applyLivingCasinoWeaponOption(run, players, p, { kind: 'lc_spark_unlock', label: 'SPARKS' }), true);

const enemies = [
  { id: 'a', kind: 'grunt', x: 400, y: 300, size: 24, hp: 100, maxHp: 100, spawnDelay: 0 },
  { id: 'b', kind: 'runner', x: 430, y: 335, size: 24, hp: 100, maxHp: 100, spawnDelay: 0 },
  { id: 'c', kind: 'shooter', x: 450, y: 260, size: 24, hp: 100, maxHp: 100, spawnDelay: 0 }
];
run.enemies = enemies;

// Repeated manual clicks on A must not reserve all three channels for A.
p.livingCasino.sparks.targetIds = ['a', 'a', 'a'];
let targets = livingCasinoDistributedSparkTargets(run, p, p.livingCasino);
assert.deepEqual(targets.map(e => e.id), ['a', 'b', 'c'], 'three available sparks must cover three available enemies');

// Existing stacked links are repaired as soon as new valid targets are available.
p.livingCasino.sparks.active = [
  { id: 's1', targetId: 'a', t: 2, maxT: 2, tickT: 0, minRange: 100 },
  { id: 's2', targetId: 'a', t: 2, maxT: 2, tickT: 0, minRange: 100 },
  { id: 's3', targetId: 'a', t: 2, maxT: 2, tickT: 0, minRange: 100 }
];
assert.equal(livingCasinoRebalanceActiveSparks(run, p, p.livingCasino, targets), 2);
assert.deepEqual(new Set(p.livingCasino.sparks.active.map(s => s.targetId)), new Set(['a', 'b', 'c']));

// With more sparks than enemies, every enemy is covered before stacking starts.
p.livingCasino.upgrades.sparkCount = 2;
targets = livingCasinoDistributedSparkTargets(run, p, p.livingCasino);
assert.deepEqual(targets.slice(0, 3).map(e => e.id), ['a', 'b', 'c']);
assert.equal(targets.length, 5);

// If only one valid enemy exists, stacking on that enemy remains correct.
run.enemies = [enemies[0]];
targets = livingCasinoDistributedSparkTargets(run, p, p.livingCasino);
assert.equal(targets.length, 5);
assert.ok(targets.every(e => e.id === 'a'));

console.log('v2.1.222 checks passed: sparks cover unique enemies before stacking and rebalance old duplicate links');
