import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UPGRADES, WEAPONS, WEAPON_CHEST_REWARDS } from '../shared/data.v2-1.js';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import {
  buildSnapshot, createPlayer, createRun, droneWeaponRange, handleWeaponPick,
  impactPushTravel, orbitalPos, step, weaponClockMultiplier, weaponRangeMultiplier
} from '../shared/sim.v2-1.js';
import { P } from '../src/state.v2-1.js';

assert.equal(VERSION, 'v2.1.241');
assert.equal(BUILD_ID, 'driver_status_block_clock_range_visual');
assert.equal(PROTOCOL, 17);

const close = (actual, expected, eps = 1e-7, message = '') => {
  assert.ok(Math.abs(actual - expected) <= eps, `${message}: expected ${expected}, got ${actual}`);
};
function fixture(hero = 'impact_driver', seed = 241001) {
  const p = createPlayer(`${hero}-${seed}`, hero.toUpperCase(), 0, { hero });
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  run.phase = 'play';
  run.plan = { w: 1800, h: 1100, walls: [], interactables: [], modifierIds: [], category: 'combat', quota: 999, specialRoomId: 'chill_room' };
  run.portal = { x: 1650, y: 950, open: false };
  run.pickups = []; run.roomSockets = []; run.movingWalls = [];
  run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999999, pauseT: 999999, used: {} };
  run.directorT = 999999; run.roomStats = {};
  p.x = 240; p.y = 500; p.aimX = 700; p.aimY = 500;
  p.devGod = true; p.invuln = 999999;
  return { p, players, run, now: 0 };
}
function tick(q, count = 1) {
  for (let i = 0; i < count; i++) {
    q.now += 1 / 60;
    step(q.run, q.players, 1 / 60, q.now);
  }
}
function wall(q, id, x, y, size = 66) {
  const w = { id, owner: q.p.id, temp: 1, kind: 'impact_wall', x, y, w: size, h: size, ttl: 30, maxT: 30, moving: 0, settling: 0, placedAt: q.now };
  q.run.tempWalls.push(w); q.run.plan.walls.push(w);
  return w;
}
function threat(id, x, y, hp = 5000) {
  return { id, kind: 'grunt', x, y, hp, maxHp: hp, size: 24, spawnDelay: 0, state: 'move', st: 0, spd: 0, dmg: 0, fireCd: 999, touchCds: new Map() };
}
function takeWeaponOption(q, option) {
  q.p.weaponChestOffer = { choices: [option], slotCount: 1, picksTotal: 1, picksRemaining: 1, pickedLabels: [] };
  assert.equal(handleWeaponPick(q.run, q.players, q.p, 0), true, `WPN option failed for ${q.p.hero}: ${option.id}`);
}

// SPACE has no timer. Capacity, not an invisible replacement/cooldown, gates
// placement. Three available slots can therefore be filled on consecutive ticks.
{
  const q = fixture('impact_driver', 241010);
  q.p.stats.impactWallCount = 2;
  q.p.cd = 100; // unrelated/shared cooldown must not block SPACE placement
  for (const x of [520, 760, 1000]) {
    q.p.aimX = x; q.p.aimY = 330; q.p.wantWall = true; tick(q);
  }
  assert.equal(q.run.tempWalls.length, 3, 'SPACE could not fill unlocked wall slots back-to-back');
  const ids = q.run.tempWalls.map(w => w.id);
  q.p.aimX = 1240; q.p.wantWall = true; tick(q);
  assert.equal(q.run.tempWalls.length, 3, 'placement exceeded the owned wall limit');
  assert.deepEqual(q.run.tempWalls.map(w => w.id), ids, 'full capacity silently replaced the oldest wall');
  assert.ok(q.run.fx.some(f => f.t === 'denied' && f.reason === 'FWL LIMIT'));
  const build = buildSnapshot(q.run, q.players).players[0][P.BUILD].impactWall;
  assert.equal(build.cd, 0); assert.equal(build.cdMax, 0);
  assert.equal(build.count, 3); assert.equal(build.max, 3);
}
assert.equal(WEAPONS.impact_wall.cooldown, 0);
assert.equal(WEAPON_CHEST_REWARDS.some(x => /impact.*wall.*cooldown|impact.*place.*cooldown/i.test(`${x.id} ${x.upgrade || ''}`)), false, 'obsolete SPACE cooldown upgrade is still in WPN');

// The Driver's WPN Weapon Clock card accelerates the shared LMB/RMB Block
// Vector, while the zero-cooldown SPACE placement and jump remain untouched.
{
  const q = fixture('impact_driver', 241020);
  takeWeaponOption(q, { id: 'impact_clock_stat', kind: 'stat', stat: 'fire', label: 'DRV: ОРУЖЕЙНЫЙ ТАКТ +14%', impactOnly: 1 });
  close(weaponClockMultiplier(q.p), 1.14, 1e-9, 'Driver Weapon Clock multiplier');
  const w = wall(q, 'clock-wall', 560, 467);
  q.p.aimX = w.x + w.w / 2; q.p.aimY = w.y + w.h / 2; q.p.fire = true; tick(q);
  close(q.p.impactPushCd, WEAPONS.impact_push.cooldown / 1.14, 1e-9, 'Block Vector did not use Weapon Clock');
  assert.equal(q.p.jumpCooldownMax, 0, 'Weapon Clock introduced a jump cooldown');
}

// General WPN range and the Driver-specific travel card multiply together.
// The authoritative launch event reports the same real distance for push/pull.
for (const mode of ['push', 'pull']) {
  const q = fixture('impact_driver', mode === 'push' ? 241030 : 241031);
  const rangeOpt = { ...WEAPON_CHEST_REWARDS.find(x => x.id === 'bullet_range'), impactOnly: 1 };
  takeWeaponOption(q, rangeOpt);
  q.p.stats.impactPushRange = 1;
  close(weaponRangeMultiplier(q.p), 1.22, 1e-9, `${mode} shared range multiplier`);
  close(impactPushTravel(q.p), 390 * 1.22 * 1.20, 1e-7, `${mode} travel`);
  const w = wall(q, `${mode}-wall`, 560, 467);
  q.p.aimX = w.x + w.w / 2; q.p.aimY = w.y + w.h / 2;
  if (mode === 'push') q.p.fire = true; else q.p.wantSecondary = true;
  tick(q);
  const fx = q.run.fx.find(f => f.t === 'impact_wall_push' && f.mode === mode);
  assert.equal(fx?.range, Math.round(390 * 1.22 * 1.20), `${mode} launch ignored WPN range`);
}

// A moving block is a real weapon-status carrier. It applies all three status
// families on contact and publishes the current combination for its visual aura.
{
  const q = fixture('impact_driver', 241040);
  q.p.stats.bulletFire = 1; q.p.stats.bulletFreeze = 1; q.p.stats.bulletPoison = 1;
  const w = wall(q, 'status-wall', 500, 467);
  const e = threat('status-target', 690, 500);
  q.run.enemies = [e];
  q.p.aimX = w.x + w.w / 2; q.p.aimY = w.y + w.h / 2; q.p.fire = true; tick(q);
  for (let i = 0; i < 45 && !(e.burnT > 0 && e.chillT > 0 && e.poisonT > 0); i++) tick(q);
  assert.ok(e.burnT > 0, 'moving block did not apply fire');
  assert.ok(e.chillT > 0, 'moving block did not apply freeze/chill');
  assert.ok(e.poisonT > 0, 'moving block did not apply poison');
  assert.ok(q.run.fx.some(f => f.t === 'impact_wall_hit'));
  const sw = buildSnapshot(q.run, q.players).room.tempWalls.find(x => x.id === w.id);
  assert.equal(sw?.elem, 'fire+freeze+poison', 'moving block snapshot lost its status aura');
}

// Status ownership is live: statuses acquired after launch appear on the same
// block and will be used by its later contacts.
{
  const q = fixture('impact_driver', 241041);
  q.p.stats.bulletFire = 1;
  const w = wall(q, 'future-status-wall', 600, 467);
  q.p.aimX = w.x + w.w / 2; q.p.aimY = w.y + w.h / 2; q.p.fire = true; tick(q);
  q.p.stats.bulletFreeze = 1; q.p.stats.bulletPoison = 1; tick(q);
  const sw = buildSnapshot(q.run, q.players).room.tempWalls.find(x => x.id === w.id);
  assert.equal(sw?.elem, 'fire+freeze+poison', 'in-flight block did not inherit later status stacks');
}

// The same WPN Range card extends drone acquisition and projectile lifetime for
// every hero-specific WPN handler, including Living Casino, Controller and Driver.
for (const [hero, flag] of [['base', null], ['living_casino', 'lcGeneral'], ['process_controller', 'pcOnly'], ['impact_driver', 'impactOnly']]) {
  const q = fixture(hero, 241050 + hero.length);
  const option = { ...WEAPON_CHEST_REWARDS.find(x => x.id === 'bullet_range') };
  if (flag) option[flag] = 1;
  takeWeaponOption(q, option);
  close(droneWeaponRange(q.p), 480 * 1.22, 1e-7, `${hero} drone acquisition range`);
  q.p.stats.drones = 1; q.p.droneCd = 0;
  const dp = orbitalPos(q.p, 0, 1, q.now + 1 / 60 + 100);
  q.run.enemies = [threat(`${hero}-drone-target`, dp.x + 180, dp.y)];
  tick(q);
  const b = q.run.bullets.find(x => x.kind === 'drone' && x.owner === q.p.id);
  assert.ok(b, `${hero} did not fire its drone test projectile`);
  assert.equal(b.maxDist, Math.round(570 * 1.22), `${hero} drone projectile max distance ignored WPN Range`);
  close(b.life, 1.1 * 1.22, 1e-9, `${hero} drone projectile lifetime ignored WPN Range`);
}

// Guard the intentionally compact rendering: one short dashed trail, a brief
// impulse and all three status colors on the moving square.
{
  const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
  const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
  assert.match(render, /w\.moving && w\.elem/);
  for (const id of ['fire', 'freeze', 'poison']) assert.match(render, new RegExp(`es\\.includes\\('${id}'\\)`));
  assert.match(render, /edge \+ 18/);
  assert.doesNotMatch(render, /edge \+ 80/);
  assert.match(effects, /kind: 'impactWallImpulse'[\s\S]*ttl: 0\.22/);
  assert.doesNotMatch(effects, /p \* 94/);
}

const dataText = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const i18nText = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.match(dataText, /У Драйвера увеличивает путь толчка и притягивания блока/);
assert.match(i18nText, /For the Driver it increases both push and pull block travel/);

console.log('v2.1.241 checks passed: compact block vectors, live block statuses, shared Weapon Clock/Range, drone range, and cooldown-free wall slots');
