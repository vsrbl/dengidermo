import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UPGRADES, WEAPONS, WEAPON_CHEST_REWARDS } from '../shared/data.v2-1.js';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import {
  controlledProjectileReach,
  controllerWeaponRange,
  createPlayer,
  createRun,
  droneWeaponRange,
  impactDriverProfile,
  impactPushReach,
  impactPushTravel,
  impactWallPlacementRange,
  livingCasinoBaseRange,
  livingCasinoSparkRange,
  makeWeaponChestChoices,
  maxHp,
  orbitalPos,
  startRoom,
  step,
  weaponChainRange,
  weaponRangeMultiplier
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.234');
assert.equal(BUILD_ID, 'universal_weapon_range_driver_radius');
assert.equal(PROTOCOL, 17);

const rangeUpgrade = UPGRADES.find(x => x.id === 'bullet_range');
const overload = UPGRADES.find(x => x.id === 'overload');
const radiusUpgrade = UPGRADES.find(x => x.id === 'impact_radius');
assert.ok(rangeUpgrade && overload && radiusUpgrade);

// The range stat lives on the player, so taking it before a weapon unlock must
// affect that later weapon immediately. Verify it through an actual SEK shot.
{
  const p = createPlayer('future-range', 'RANGE', 0);
  rangeUpgrade.apply(p.stats);
  assert.ok(Math.abs(weaponRangeMultiplier(p) - 1.22) < 1e-9);
  p.weapons.push('seeker');
  p.weaponIdx = p.weapons.indexOf('seeker');
  p.fire = true;
  p.aimX = p.x + 800;
  p.aimY = p.y;
  const run = createRun(234001);
  const players = new Map([[p.id, p]]);
  run.plan = { w: 1600, h: 900, walls: [], interactables: [], modifierIds: [], category: 'combat', quota: 99 };
  run.portal = { x: 1500, y: 800, open: false };
  run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999999, pauseT: 999999, used: {} };
  run.directorT = 999;
  step(run, players, 1 / 60, 0);
  const shot = run.bullets.find(b => b.kind === 'seeker' && b.owner === p.id);
  assert.ok(shot, 'a later-unlocked SEK did not fire');
  assert.equal(shot.maxDist, Math.round(WEAPONS.seeker.maxDist * 1.22));
  assert.ok(Math.abs(shot.rangeMul - 1.22) < 1e-9);
  assert.ok(shot.life > WEAPONS.seeker.life, 'the upgraded projectile lifetime was not extended');
}

// Every current ranged family reads the same authoritative stat.
{
  const p = createPlayer('controller-range', 'CTRL', 0, { hero: 'process_controller' });
  rangeUpgrade.apply(p.stats);
  assert.ok(Math.abs(controllerWeaponRange(p, 'command_pulse') - 520 * 1.22) < 1e-9);
  assert.ok(Math.abs(controllerWeaponRange(p, 'quarantine_anchor') - 680 * 1.22) < 1e-9);
  assert.ok(Math.abs(controllerWeaponRange(p, 'process_saw') - 560 * 1.22) < 1e-9);
  assert.ok(Math.abs(droneWeaponRange(p) - 480 * 1.22) < 1e-9);
  assert.ok(Math.abs(controlledProjectileReach(p, 310, 1.8) - 310 * 1.8 * 0.74 * 1.22) < 1e-9);
  assert.ok(Math.abs(weaponChainRange(p, 2) - (145 + 28) * 1.22) < 1e-9);
}

// Behavioral drone check: a target outside the old 480 range but inside the
// upgraded acquisition radius must produce a real drone projectile.
{
  const makeDroneCase = (id, upgraded) => {
    const p = createPlayer(id, 'DRONE', 0);
    p.x = 400; p.y = 400; p.stats.drones = 1; p.droneCd = 0;
    if (upgraded) rangeUpgrade.apply(p.stats);
    const run = createRun(234010 + Number(upgraded));
    const players = new Map([[p.id, p]]);
    run.plan = { w: 1500, h: 900, walls: [], interactables: [], modifierIds: [], category: 'combat', quota: 99 };
    run.portal = { x: 1400, y: 820, open: false };
    run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999999, pauseT: 999999, used: {} };
    run.directorT = 999;
    const dp = orbitalPos(p, 0, 1, 101);
    run.enemies = [{ id: `target-${id}`, kind: 'tank', x: dp.x + 530, y: dp.y, hp: 500, maxHp: 500, size: 42, spawnDelay: 0, state: 'move', st: 0, fireCd: 999, touchCds: new Map() }];
    step(run, players, 1 / 60, 1);
    return run.bullets.some(b => b.kind === 'drone' && b.owner === p.id);
  };
  assert.equal(makeDroneCase('drone-base', false), false);
  assert.equal(makeDroneCase('drone-upgraded', true), true);
}

{
  const p = createPlayer('casino-range', 'LVC', 0, { hero: 'living_casino' });
  rangeUpgrade.apply(p.stats);
  assert.ok(Math.abs(livingCasinoBaseRange(p) - 368 * 1.22) < 1e-9);
  p.livingCasino.upgrades.sparksUnlocked = true;
  assert.ok(Math.abs(livingCasinoSparkRange(p, p.livingCasino) - 250 * 1.22) < 1e-9);
}

{
  const p = createPlayer('driver-range', 'DRIVER', 0, { hero: 'impact_driver' });
  rangeUpgrade.apply(p.stats);
  assert.ok(Math.abs(impactWallPlacementRange(p) - 560 * 1.22) < 1e-9);
  assert.ok(Math.abs(impactPushReach(p) - 215 * 1.22) < 1e-9);
  assert.ok(Math.abs(impactPushTravel(p) - 390 * 1.22) < 1e-9);

  // The generic range card remains in the Driver pool even before its wall and
  // PUSH modules are unlocked, so those future modules inherit stored stacks.
  let state = 0x23423423;
  const rng = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
  let seen = false;
  for (let i = 0; i < 100 && !seen; i++) seen = makeWeaponChestChoices(p, rng, 5, 2).some(x => (x.upgrade || x.id) === 'bullet_range');
  assert.equal(seen, true, 'Weapon Range disappeared from the Driver pool before module unlocks');

  // The stored stack also changes real placement, not just a HUD number.
  p.stats.impactWallUnlocked = 1;
  p.weapons = ['impact_wall']; p.weaponIdx = 0; p.fire = true;
  p.x = 300; p.y = 400; p.aimX = 940; p.aimY = 400;
  const run = createRun(234020);
  const players = new Map([[p.id, p]]);
  run.plan = { w: 1500, h: 900, walls: [], interactables: [], modifierIds: [], category: 'combat', quota: 99 };
  run.portal = { x: 1400, y: 820, open: false };
  run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999999, pauseT: 999999, used: {} };
  run.directorT = 999;
  step(run, players, 1 / 60, 0);
  const wall = run.tempWalls.find(w => w.owner === p.id);
  assert.ok(wall, 'the later-unlocked Driver firewall was not placed');
  assert.ok(wall.x + wall.w / 2 > p.x + 620, 'firewall placement remained clamped to the old 560 range');
}

// Landing footprint: exactly 1.5x smaller than the previous 15%-boosted base,
// then a true multiplicative +10% to collision and visuals per stack.
{
  const p = createPlayer('driver-radius', 'DRIVER', 0, { hero: 'impact_driver' });
  assert.equal(impactDriverProfile(p).landingRadius, 83);
  radiusUpgrade.apply(p.stats);
  assert.equal(impactDriverProfile(p).landingRadius, 91);
  radiusUpgrade.apply(p.stats);
  assert.equal(impactDriverProfile(p).landingRadius, 99);
  assert.match(radiusUpgrade.label, /\+10%/);
  assert.match(WEAPON_CHEST_REWARDS.find(x => x.id === 'impact_radius')?.label || '', /\+10%/);
}

// OVERLOAD is an HP tradeoff for the Driver: never a movement or jump-speed
// penalty. The Driver also starts without a free AEGIS layer.
{
  const p = createPlayer('driver-tradeoff', 'DRIVER', 0, { hero: 'impact_driver' });
  const speedBefore = p.stats.spdMul;
  const distanceBefore = p.stats.jumpDistance;
  overload.apply(p.stats);
  assert.ok(Math.abs(p.stats.dmgMul - 1.5) < 1e-9);
  assert.equal(p.stats.maxHpAdd, -15);
  assert.equal(maxHp(p), 85);
  assert.equal(p.stats.spdMul, speedBefore);
  assert.equal(p.stats.jumpDistance, distanceBefore);

  const run = createRun(234002);
  const players = new Map([[p.id, p]]);
  startRoom(run, players);
  assert.equal(p.aegisShieldMax, 0);
  assert.equal(p.aegisShield, 0);
  p.stats.aegisStacks = 1;
  startRoom(run, players);
  assert.equal(p.aegisShieldMax, 45);
  assert.equal(p.aegisShield, 45);
}

const main = fs.readFileSync(new URL('../src/main.v2-1.js', import.meta.url), 'utf8');
const locale = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
assert.doesNotMatch(main, /Начинает с Эгидой 45|starts with a 45-point AEGIS/);
assert.match(locale, /Урон \+50%, максимум HP -15/);
assert.match(locale, /Damage \+50%, maximum HP -15/);
assert.match(locale, /'DMG \+50% \/ MAX HP -15': 'УРОН \+50% \/ МАКС\. HP -15'/);
assert.match(locale, /открытого позже оружия/);
assert.match(locale, /later-unlocked weapon range/);
assert.doesNotMatch(sim, /baseStacks = isImpactDriverPlayer/);

console.log('v2.1.234 checks passed: universal stored weapon range, Driver radius -1.5x/+10%, HP tradeoff and no starting AEGIS');
