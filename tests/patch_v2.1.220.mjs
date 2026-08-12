import assert from 'node:assert/strict';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import {
  createPlayer, livingCasinoBaseRange, livingCasinoSparkMax, livingCasinoChoicePool,
  applyLivingCasinoWeaponOption, livingCasinoAttachSpark,
  livingCasinoSparkLinks, livingCasinoSparkBlocksContact,
  constrainLivingCasinoSparkTarget, rootNodeMaxHp
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.220');
assert.equal(BUILD_ID, 'lvc_gun_range_universal_spark_tether');
assert.equal(PROTOCOL, 15);
assert.equal(rootNodeMaxHp(0, 1), 1720, 'base root-node HP must be four times 430');
assert.equal(rootNodeMaxHp(2, 2), (430 + 2 * 95) * 2 * 4, 'loop and team scaling must remain under the x4 multiplier');

const p = createPlayer('lvc-test', 'LVC', 0, { hero: 'living_casino' });
p.connected = true;
p.alive = true;
p.x = 100;
p.y = 100;
assert.equal(livingCasinoBaseRange(p), 368, 'LVC base range must be +15%');
assert.ok(livingCasinoChoicePool(p).some(x => x.kind === 'lc_gun_range'), 'WPN pool must contain LVC gun range');

const run = { now: 1, fx: [], plan: { w: 1400, h: 900, walls: [] } };
const players = new Map([[p.id, p]]);
assert.equal(applyLivingCasinoWeaponOption(run, players, p, { kind: 'lc_gun_range', label: 'GUN RANGE' }), true);
assert.equal(livingCasinoBaseRange(p), 423.2, 'one WPN stack must add another 15%');

assert.equal(applyLivingCasinoWeaponOption(run, players, p, { kind: 'lc_spark_unlock', label: 'SPARKS' }), true);
assert.equal(livingCasinoSparkMax(p.livingCasino), 3, 'spark module must start with three sparks');
assert.equal(p.livingCasino.sparks.charges, 3, 'all three base sparks must be immediately charged');
const sparkUpgrade = livingCasinoChoicePool(p).find(x => x.kind === 'lc_spark_count');
assert.ok(sparkUpgrade && /\+2/.test(sparkUpgrade.label), 'WPN spark upgrade must advertise +2');
assert.equal(applyLivingCasinoWeaponOption(run, players, p, sparkUpgrade), true);
assert.equal(livingCasinoSparkMax(p.livingCasino), 5, 'one WPN spark upgrade must add two sparks');
assert.equal(p.livingCasino.sparks.charges, 5, 'two new WPN sparks must be charged immediately');
const secondSparkUpgrade = livingCasinoChoicePool(p).find(x => x.kind === 'lc_spark_count');
assert.equal(applyLivingCasinoWeaponOption(run, players, p, secondSparkUpgrade), true);
assert.equal(livingCasinoSparkMax(p.livingCasino), 7, 'second WPN spark upgrade must add two more sparks');
for (let expected = 9; expected <= 23; expected += 2) {
  const endlessSparkUpgrade = livingCasinoChoicePool(p).find(x => x.kind === 'lc_spark_count');
  assert.ok(endlessSparkUpgrade, 'spark upgrade must remain in the WPN pool without a cap');
  assert.equal(applyLivingCasinoWeaponOption(run, players, p, endlessSparkUpgrade), true);
  assert.equal(livingCasinoSparkMax(p.livingCasino), expected, 'every repeated WPN upgrade must add two sparks');
}
for (const [kind, id] of [['runner', 'runner-link'], ['charger', 'dash-link'], ['glitch', 'blink-link']]) {
  const target = { id, kind, x: 360, y: 100, size: 24, hp: 100, maxHp: 100, state: kind === 'charger' ? 'charge' : 'move', vx: -500, vy: 0 };
  assert.equal(livingCasinoAttachSpark(run, p, p.livingCasino, target), true);
  const link = livingCasinoSparkLinks(players, target)[0];
  assert.ok(link && link.minRange >= 260, `${kind} must receive a distance tether`);
  assert.equal(livingCasinoSparkBlocksContact(players, target, p), true);
  target.x = 130;
  assert.equal(constrainLivingCasinoSparkTarget(run, players, target, 360, 100), true);
  assert.ok(Math.hypot(target.x - p.x, target.y - p.y) >= link.minRange - 3, `${kind} movement must not cross its spark range`);
  if (kind === 'charger') assert.equal(target.state, 'cool', 'blocked dash must leave charge state');
}

const boss = { id: 'boss-link', kind: 'q_revisor', x: 500, y: 100, size: 80, hp: 1000, maxHp: 1000, state: 'charge', vx: -700, vy: 0 };
p.livingCasino.sparks.charges = 1;
assert.equal(livingCasinoAttachSpark(run, p, p.livingCasino, boss), true);
const bossLink = livingCasinoSparkLinks(players, boss)[0];
boss.x = 150;
assert.equal(constrainLivingCasinoSparkTarget(run, players, boss, 500, 100), true);
assert.ok(Math.hypot(boss.x - p.x, boss.y - p.y) >= bossLink.minRange - 3);
assert.equal(boss.state, 'cool');

console.log('v2.1.220 checks passed: LVC gun range + universal spark tether');
