import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES, UPGRADES, WEAPONS, WEAPON_CHEST_REWARDS } from '../shared/data.v2-1.js';
import { isEnemySpawnReachable } from '../shared/mapgen.v2-1.js';
import {
  createPlayer,
  createRun,
  controlledProcessDeathHealPercent,
  fieldSnapStunDuration,
  handleDevCommand,
  processControllerWeaponCooldown,
  resolveProcessControllerAnchorPlacement,
  shellRipperLockDuration,
  startRoom,
  step,
  weaponClockMultiplier,
  weaponCycleSeconds
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.19[2-5]$/);
if (VERSION === 'v2.1.192') assert.equal(BUILD_ID, 'weapon_clock_anchor_floor_control_q');
assert.equal(PROTOCOL, 14);

const close = (actual, expected, eps = 1e-6, message = '') => {
  assert.ok(Math.abs(actual - expected) <= eps, `${message} expected ${expected}, got ${actual}`);
};
const enemy = (kind, id, x, y, hp = null) => {
  const def = ENEMIES[kind];
  return {
    id, kind, x, y, hp: hp ?? def.hp, maxHp: def.hp, size: def.size,
    spd: def.spd, dmg: def.dmg, armor: def.armor || 0, fireCd: def.fireCd || 0,
    bulletSpd: def.bulletSpd || 0, spawnDelay: 0, state: 'move', st: 0
  };
};

// QRN floor placement is validated against real generated room walls. Every
// reachable floor tile under the cursor must remain a floor anchor even when a
// direct ray crosses an internal wall.
let checkedFloorTiles = 0;
let liveAnchorFixture = null;
for (let seed = 1920; seed < 1932; seed++) {
  const p = createPlayer(`floor-${seed}`, 'QRN FLOOR', 0, { hero: 'process_controller' });
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  startRoom(run, players);
  const range = WEAPONS.quarantine_anchor.maxDist;
  for (let y = 90; y < run.plan.h - 90; y += 84) for (let x = 90; x < run.plan.w - 90; x += 84) {
    if (Math.hypot(x - p.x, y - p.y) > range - 8) continue;
    if (!isEnemySpawnReachable({ x, y }, run.plan.walls, [p], 12)) continue;
    p.aimX = x; p.aimY = y;
    const point = resolveProcessControllerAnchorPlacement(run, p);
    assert.equal(point?.surface, 'floor', `reachable tile became a wall/dead anchor at seed ${seed}: ${x},${y}`);
    checkedFloorTiles++;
    if (!liveAnchorFixture && Math.hypot(x - p.x, y - p.y) > 120) liveAnchorFixture = { run, players, p, point };
  }
}
assert.ok(checkedFloorTiles > 120, `too few generated-room floor samples: ${checkedFloorTiles}`);
assert.ok(liveAnchorFixture, 'no generated-room QRN fixture found');
{
  const { run, players, p, point } = liveAnchorFixture;
  p.weapons = ['command_pulse', 'quarantine_anchor', 'process_saw'];
  p.weaponIdx = 1;
  p.aimX = point.x; p.aimY = point.y; p.fire = true;
  run.enemies = Array.from({ length: 7 }, (_, i) => enemy('grunt', `qrn-live-${i}`, point.x, point.y));
  step(run, players, 1 / 60, 1);
  const field = run.activeFields.find(f => f.kind === 'quarantine_anchor');
  assert.ok(field, 'QRN did not create a field in a generated room');
  assert.equal(field.surface, 'floor');
  assert.equal(field.leashes.length, 5, 'generated-room floor QRN did not capture its base five targets');
}

// The old fireMul is the one and only global Weapon Clock; no parallel stat was added.
const clockProbe = createPlayer('clock', 'CLOCK', 0);
clockProbe.stats.fireMul = 1.4;
assert.equal(weaponClockMultiplier(clockProbe), 1.4);
close(weaponCycleSeconds(clockProbe, 12), 12 / 1.4, 1e-9, 'shared weapon cycle');
assert.equal(Object.hasOwn(clockProbe.stats, 'weaponSpeed'), false);
assert.equal(UPGRADES.find(x => x.id === 'fire')?.label, 'WEAPON CLOCK +12%');
assert.equal(WEAPON_CHEST_REWARDS.find(x => x.id === 'wpn_fire')?.label, 'ОРУЖЕЙНЫЙ ТАКТ +14%');

// Base weapon cooldown.
{
  const p = createPlayer('base-clock', 'BASE CLOCK', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(1940); startRoom(run, players); run.plan.walls = [];
  p.stats.fireMul = 1.4; p.weapons = ['seeker']; p.weaponIdx = 0; p.fire = true;
  p.aimX = p.x + 200; p.aimY = p.y;
  run.enemies = [enemy('grunt', 'base-clock-target', p.x + 180, p.y)];
  step(run, players, 1 / 60, 1);
  close(p.cd, WEAPONS.seeker.cooldown / 1.4, 1e-9, 'base weapon did not use Weapon Clock');
}

// Living Casino gun cycle.
{
  const p = createPlayer('lvc-clock', 'LVC CLOCK', 0, { hero: 'living_casino' });
  const players = new Map([[p.id, p]]);
  const run = createRun(1941); startRoom(run, players); run.plan.walls = [];
  p.stats.fireMul = 1.4;
  run.enemies = [enemy('grunt', 'lvc-clock-target', p.x + 180, p.y)];
  step(run, players, 1 / 60, 1);
  close(p.livingCasino.base.cd, 0.95 / 1.4, 1e-9, 'Living Casino did not use Weapon Clock');
}

// Controller SAW cycle.
{
  const p = createPlayer('saw-clock', 'SAW CLOCK', 0, { hero: 'process_controller' });
  const players = new Map([[p.id, p]]);
  const run = createRun(1942); startRoom(run, players); run.plan.walls = [];
  p.stats.fireMul = 1.4; p.weapons = ['command_pulse', 'quarantine_anchor', 'process_saw']; p.weaponIdx = 2;
  p.aimX = p.x + 120; p.aimY = p.y; p.fire = true;
  run.enemies = [enemy('grunt', 'saw-clock-target', p.x + 120, p.y)];
  step(run, players, 1 / 60, 1);
  close(processControllerWeaponCooldown(p, 'process_saw'), 12 / 1.4, 1e-9, 'Controller SAW did not use Weapon Clock');
}

// SHG shell reload, weapon secondaries, and drone fire all use the same clock.
{
  const p = createPlayer('systems-clock', 'SYSTEM CLOCK', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(1943); startRoom(run, players); run.plan.walls = [];
  p.stats.fireMul = 1.4; p.stats.drones = 1; p.shgCharges = 0; p.shgReload = 0;
  p.sekSwarmCd = 1; p.shgLongshotCd = 1;
  run.enemies = [enemy('grunt', 'systems-clock-target', p.x + 180, p.y)];
  step(run, players, 0.1, 1);
  close(p.shgReload, 0.14, 1e-9, 'SHG reload did not use Weapon Clock');
  close(p.sekSwarmCd, 0.86, 1e-9, 'SEK secondary did not use Weapon Clock');
  close(p.shgLongshotCd, 0.86, 1e-9, 'SHG secondary did not use Weapon Clock');
  close(p.droneCd, 0.8 / 1.4, 1e-9, 'drone fire did not use Weapon Clock');
}

// Doubled controller death-heal progression.
assert.deepEqual([1, 2, 3, 4].map(rank => {
  const p = createPlayer(`heal-${rank}`, 'HEAL', 0, { hero: 'process_controller' });
  p.stats.ctrlDeathHeal = rank;
  return controlledProcessDeathHealPercent(p);
}), [2, 5, 9, 14]);

// Anchor Cashier: only its opening background wave is tripled; later waves stay at one.
{
  const p = createPlayer('boss-opening', 'BOSS OPENING', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(1950); startRoom(run, players); run.plan.category = 'boss'; run.enemies = []; run.director.pauseT = 999;
  assert.equal(handleDevCommand(run, players, p, { action: 'spawn_boss', kind: 'boss_anchor_cashier' }), true);
  const boss = run.enemies.find(e => e.kind === 'boss_anchor_cashier');
  boss.backgroundAddCd = 0;
  step(run, players, 1 / 60, 1);
  assert.equal(run.enemies.filter(e => e.packRole === 'boss_background').length, 3, 'Anchor Cashier opening wave was not tripled');
  run.enemies = run.enemies.filter(e => e === boss);
  boss.backgroundAddCd = 0;
  step(run, players, 1 / 60, 2);
  assert.equal(run.enemies.filter(e => e.packRole === 'boss_background').length, 1, 'later Anchor Cashier wave changed from one add');
}

// FIELD SNAP is damage-free but strongly stuns every pulled threat.
{
  const p = createPlayer('snap192', 'SNAP', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(1960); startRoom(run, players); run.plan.walls = []; run.plan.category = 'boss'; run.director.pauseT = 999;
  p.active = { core: 'field_snap', level: 3, mutations: [] }; p.activeCd = 0;
  const target = enemy('boss_anchor_cashier', 'snap-boss', p.x + 140, p.y, 900);
  target.maxHp = 900; run.enemies = [target];
  const beforeHp = target.hp;
  p.wantActive = true; step(run, players, 1 / 60, 1);
  assert.equal(target.hp, beforeHp, 'FIELD SNAP dealt direct damage');
  assert.ok(target.stunT > fieldSnapStunDuration(3) - 0.05, 'FIELD SNAP stun was not strong/long');
}

// SHELL RIPPER ability-lock applies to bosses and blocks their unique pressure.
{
  const p = createPlayer('ripper192', 'RIPPER', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(1961); startRoom(run, players); run.plan.walls = []; run.plan.category = 'boss'; run.director.pauseT = 999;
  p.active = { core: 'shell_ripper', level: 3, mutations: [] }; p.activeCd = 0;
  const boss = enemy('boss_anchor_cashier', 'locked-boss', p.x + 140, p.y, 900);
  boss.maxHp = 900; boss.backgroundAddCd = 0; run.enemies = [boss];
  p.wantActive = true; step(run, players, 1 / 60, 1);
  assert.ok(boss.abilityLockT > shellRipperLockDuration(3) - 0.05, 'SHELL RIPPER did not lock a boss');
  run.bullets = []; run.enemies = [boss]; boss.backgroundAddCd = 0;
  step(run, players, 1, 2);
  assert.equal(run.bullets.filter(b => b.from === 'e').length, 0, 'locked boss fired');
  assert.equal(run.enemies.filter(e => e.packRole === 'boss_background').length, 0, 'locked boss summoned adds');
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /weaponClockMultiplier\(p\)/);
assert.match(sim, /abilityLockT/);
assert.match(data, /ОРУЖЕЙНЫЙ ТАКТ \+14%/);
assert.match(i18n, /WEAPON CLOCK/);
assert.match(i18n, /включая боссов/);

console.log(`v2.1.192 checks passed: ${checkedFloorTiles} real-room QRN tiles, Weapon Clock, doubled sustain, opening adds, SNAP stun, SHELL lock`);
