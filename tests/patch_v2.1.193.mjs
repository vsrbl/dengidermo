import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES } from '../shared/data.v2-1.js';
import {
  createPlayer,
  createRun,
  hungerMutationProfile,
  startRoom,
  staticPulseDamageForLevel,
  step
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:19[3-9]|(?:20[0-9]|21[0-5]))$/);
if (VERSION === 'v2.1.193') assert.equal(BUILD_ID, 'static_pulse_hunger_low_hp_rework');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);

const close = (actual, expected, eps = 1e-6, message = '') => {
  assert.ok(Math.abs(actual - expected) <= eps, `${message} expected ${expected}, got ${actual}`);
};
const enemy = (id, x, y, hp = 10000) => {
  const def = ENEMIES.grunt;
  return {
    id, kind: 'grunt', x, y, hp, maxHp: hp, size: def.size,
    spd: 0, dmg: 0, armor: 0, fireCd: 999, bulletSpd: 0,
    spawnDelay: 0, state: 'move', st: 0
  };
};
function activeFixture(core, level, mutations, hp, seed) {
  const p = createPlayer(`active-${seed}`, 'ACTIVE TEST', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  startRoom(run, players);
  run.plan.walls = [];
  run.plan.category = 'boss';
  run.director.pauseT = 999;
  p.active = { core, level, mutations };
  p.activeCd = 0;
  p.hp = hp;
  return { p, players, run };
}

// STATIC PULSE level damage is a geometric +25% step, not a flat addition.
const pulse = [1, 2, 3].map(staticPulseDamageForLevel);
assert.deepEqual(pulse, [42, 52.5, 65.625]);
close(pulse[1] / pulse[0], 1.25, 1e-12, 'STATIC PULSE II/I');
close(pulse[2] / pulse[1], 1.25, 1e-12, 'STATIC PULSE III/II');

// The pulse applies its vulnerability after its own hit. Therefore that same
// hit keeps the promised exact progression while later attacks still benefit.
const dealt = [];
for (let level = 1; level <= 3; level++) {
  const { p, players, run } = activeFixture('debt_pulse', level, [], 100, 1930 + level);
  const target = enemy(`pulse-${level}`, p.x + 90, p.y);
  run.enemies = [target];
  const before = target.hp;
  p.wantActive = true;
  step(run, players, 1 / 60, 1);
  dealt.push(before - target.hp);
  assert.ok((target.exposedT || 0) > 0, 'STATIC PULSE stopped applying vulnerability');
}
// Combat HP is integer-rounded: the exact scaled values 28 / 35 / 43.75 land
// as 28 / 35 / 44 in the live simulation.
assert.deepEqual(dealt, [28, 35, 44]);

// HUNGER is modest at full health, ramps smoothly with missing health and is
// capped at x4 near zero HP. Upgrades add base damage and area, not a new cap.
const hungerFull = hungerMutationProfile(1, 1);
const hungerHalf = hungerMutationProfile(1, 0.5);
const hungerLow = hungerMutationProfile(1, 0.1);
const hungerZero = hungerMutationProfile(1, 0);
assert.equal(hungerFull.damage, 18);
assert.equal(hungerFull.multiplier, 1);
assert.ok(hungerHalf.damage > hungerFull.damage * 2);
assert.ok(hungerLow.damage > hungerHalf.damage);
assert.equal(hungerZero.multiplier, 4);
assert.equal(hungerZero.damage, 72);
assert.ok(hungerMutationProfile(2, 1).damage > hungerFull.damage);
assert.ok(hungerMutationProfile(2, 1).radius > hungerFull.radius);

// The mutation bursts around the hero immediately, even when the selected
// core is placed elsewhere at the cursor.
{
  const { p, players, run } = activeFixture('signal_spike', 1, ['hunger'], 100, 1940);
  const nearHero = enemy('near-hero', p.x + 70, p.y);
  p.aimX = p.x + 360;
  p.aimY = p.y;
  run.enemies = [nearHero];
  const before = nearHero.hp;
  p.wantActive = true;
  step(run, players, 1 / 60, 1);
  assert.ok(nearHero.hp < before, 'HUNGER did not hit around the hero');
  assert.ok(run.fx.some(f => String(f.label || '').startsWith('HUNGER PULSE')));
  assert.equal(run.activeFields.some(f => f.kind === 'hunger_charge'), false);
}

// Lower activation HP produces substantially more live damage.
function hungerDamageAt(hp, seed) {
  const { p, players, run } = activeFixture('black_box', 1, ['hunger'], hp, seed);
  const target = enemy(`hunger-${seed}`, p.x + 70, p.y);
  run.enemies = [target];
  const before = target.hp;
  p.wantActive = true;
  step(run, players, 1 / 60, 1);
  return before - target.hp;
}
const hungerHighDamage = hungerDamageAt(100, 1941);
const hungerLowDamage = hungerDamageAt(10, 1942);
assert.ok(hungerLowDamage > hungerHighDamage * 3, 'low-HP HUNGER scaling is too weak');

// HP is captured at the instant Q is pressed. A Blood mutation processed
// earlier in the mutation list cannot artificially amplify HUNGER afterward.
{
  const { p, players, run } = activeFixture('black_box', 1, ['blood', 'hunger'], 100, 1943);
  run.enemies = [];
  p.wantActive = true;
  step(run, players, 1 / 60, 1);
  const pulseFx = run.fx.find(f => String(f.label || '').startsWith('HUNGER PULSE'));
  assert.equal(pulseFx?.label, 'HUNGER PULSE 100%');
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.doesNotMatch(sim, /kind:\s*['\"]hunger_charge['\"]/);
assert.doesNotMatch(sim, /DIGITAL BITE/);
assert.match(data, /25%/);
assert.match(i18n, /Each level deals 25% more damage than the previous level/);
assert.match(i18n, /Lower HP at activation makes it much stronger/);

console.log('v2.1.193 checks passed: exact STATIC PULSE scaling and capped low-HP HUNGER burst');
