import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ROOM_WAGER_CONDITIONS, ROOM_WAGER_STAKES, alliedProjectileWagerKill,
  bulletCorrosionArmorDamage, createPlayer, createRun, updateRoomWagerCompletion
} from '../shared/sim.v2-1.js';
import { BUILD_ID, VERSION } from '../shared/protocol.v2-1.js';

assert.equal(VERSION, 'v2.1.217');
assert.equal(BUILD_ID, 'wager_expansion_anchor_poison_audit');

const conditionIds = new Set(ROOM_WAGER_CONDITIONS.map(x => x.id));
const stakeIds = new Set(ROOM_WAGER_STAKES.map(x => x.id));
assert.ok(conditionIds.has('six_one_attack'));
assert.ok(conditionIds.has('three_statuses'));
assert.ok(conditionIds.has('ally_projectile_kills6'));
assert.ok(!conditionIds.has('base_switch6'));
assert.ok(stakeIds.has('half_gld'));
assert.ok(stakeIds.has('next_no_heal'));
assert.ok(stakeIds.has('next_enemy_overclock'));
assert.ok(!stakeIds.has('zero_shield'));
assert.ok(!stakeIds.has('blocked_weapon'));

// Approved thresholds are authoritative.
for (const [id, stats] of [
  ['six_one_attack', { sameAttackBest: 6 }],
  ['three_statuses', { statusKinds: ['fire', 'poison', 'freeze'] }],
  ['ally_projectile_kills6', { allyProjectileKills: 6 }]
]) {
  const p = createPlayer(`w-${id}`, 'WAGER', 0);
  const run = createRun(21701);
  run.portal = { open: false };
  p.wagerStats = stats;
  p.roomWagerActive = { condition: id, completed: 0 };
  updateRoomWagerCompletion(run, new Map([[p.id, p]]));
  assert.equal(p.roomWagerActive.completed, 1, `${id} must complete at its approved threshold`);
}

// Living Casino guns are hero weapons, never allied projectiles. Drones count for every hero;
// Controller ranged process bullets and captured-boss bullets count only for Controller.
assert.equal(alliedProjectileWagerKill({ hero: 'living_casino' }, 'roulette'), false);
assert.equal(alliedProjectileWagerKill({ hero: 'living_casino' }, 'ctrl_shot'), false);
assert.equal(alliedProjectileWagerKill({ hero: 'living_casino' }, 'drone'), true);
assert.equal(alliedProjectileWagerKill({ hero: 'process_controller' }, 'ctrl_shot'), true);
assert.equal(alliedProjectileWagerKill({ hero: 'process_controller' }, 'ctrl_boss_radial'), true);
assert.equal(alliedProjectileWagerKill({ hero: 'process_controller' }, 'ctrl_biter'), false);

// Poison never reduces the ordinary HP hit. Against armor it adds the documented
// corrosion multiplier: +45% shell damage per poison stack.
{
  const p = createPlayer('poison', 'POISON', 0);
  p.stats.bulletPoison = 2;
  const players = new Map([[p.id, p]]);
  const bullet = { owner: p.id, source: 'weapon', elem: 'poison' };
  assert.equal(bulletCorrosionArmorDamage(players, { shellHp: 0 }, bullet, 10), 10);
  assert.equal(bulletCorrosionArmorDamage(players, { shellHp: 100 }, bullet, 10), 19);
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /e\.anchorPhaseT = Math\.max\(0\.05, 10 - overflow\)/);
assert.match(sim, /wagerGold: wagerDamageNumberIsGold/);
assert.match(effects, /f\.wagerGold \? '#ffd34d' : '#f3f3f3'/);
assert.match(sim, /recordWagerStatus\(p, 'poison'\)/);
assert.match(sim, /e\.poisonDps = Math\.max/);

console.log('v2.1.217 checks passed: Wager expansion, 10s boss phase, gold damage, and poison math');
