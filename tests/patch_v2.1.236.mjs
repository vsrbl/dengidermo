import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import { createPlayer, createRun, orbitalPos, step } from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.236');
assert.equal(BUILD_ID, 'driver_air_q_chain_audit');
assert.equal(PROTOCOL, 17);

function fixture(id, hero = 'impact_driver', seed = 236001) {
  const p = createPlayer(id, id.toUpperCase(), 0, { hero });
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  run.plan = { w: 1800, h: 1000, walls: [], interactables: [], modifierIds: [], category: 'combat', quota: 99, specialRoomId: 'chill_room' };
  run.portal = { x: 1700, y: 900, open: false };
  run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999999, pauseT: 999999, used: {} };
  run.directorT = 999999;
  run.roomStats = {};
  p.x = 240; p.y = 500; p.moveX = 1; p.moveY = 0; p.aimX = 700; p.aimY = 500;
  return { p, players, run, now: 0 };
}
function tick(q, count = 1) {
  for (let i = 0; i < count; i++) {
    q.now += 1 / 60;
    step(q.run, q.players, 1 / 60, q.now);
  }
}
function threat(id, x, y, hp = 1000) {
  return { id, kind: 'root_node', x, y, hp, maxHp: hp, size: 20, spawnDelay: 0, state: 'move', st: 0, spd: 0, dmg: 0, fireCd: 999, touchCds: new Map() };
}
function chainLinks(run) { return run.fx.filter(f => f.t === 'weapon_chain_link' && f.kind !== 'qrn_chain'); }

// Driver Q fires on an airborne simulation tick. It must neither wait for the
// landing nor zero the current inertial vector.
{
  const q = fixture('air-q');
  q.p.active = { core: 'blood_ring', level: 1, mutations: [], mutationLevels: {} };
  q.p.wantJump = true;
  tick(q);
  assert.ok(q.p.jumpT > 0);
  const vx = q.p.jumpVx, vy = q.p.jumpVy, x = q.p.x, remaining = q.p.jumpT;
  q.p.wantActive = true;
  tick(q);
  assert.ok(q.run.activeFields.some(f => f.kind === 'blood_ring' && f.owner === q.p.id), 'Q was discarded while airborne');
  assert.ok(q.p.activeCd > 0, 'air Q did not consume its normal cooldown');
  assert.ok(q.p.jumpT > 0 && q.p.jumpT < remaining, 'Q forced or paused the landing clock');
  assert.equal(q.p.jumpVx, vx, 'Q changed horizontal jump inertia');
  assert.equal(q.p.jumpVy, vy, 'Q changed vertical jump inertia');
  assert.ok(q.p.x > x, 'the Driver stopped moving on the Q tick');
  assert.ok(!q.run.fx.some(f => f.t === 'player_jump_land'), 'Q forced an early landing');
  assert.equal(q.run.roomStats.qUses, 1, 'air Q was not recorded as a real Q use');
}

// The same airborne gate covers two-stage Q protocols: the first Void Cut
// press arms at the current in-flight position without disturbing the jump.
{
  const q = fixture('air-void', 'impact_driver', 236002);
  q.p.active = { core: 'void_cut', level: 1, mutations: [], mutationLevels: {} };
  q.p.wantJump = true; tick(q);
  const vx = q.p.jumpVx;
  q.p.wantActive = true; tick(q);
  assert.equal(q.p.activeTargeting?.kind, 'void');
  assert.equal(q.p.jumpVx, vx);
  assert.ok(q.p.jumpT > 0);
}

// Landing damage is a weapon source. The second enemy is outside the landing
// radius but inside WPN LINK reach, proving that the landing itself chains.
{
  const q = fixture('landing-chain', 'impact_driver', 236003);
  q.p.stats.bulletChain = 1;
  q.p.wantJump = true; tick(q);
  while (q.p.jumpT > 1 / 60 + 1e-6) tick(q);
  const landX = q.p.x + q.p.jumpVx * Math.min(1 / 60, q.p.jumpT);
  const landY = q.p.y + q.p.jumpVy * Math.min(1 / 60, q.p.jumpT);
  const first = threat('land-first', landX, landY);
  const linked = threat('land-linked', landX, landY + 130);
  q.run.enemies = [first, linked];
  const linkedHp = linked.hp;
  tick(q);
  assert.ok(q.run.fx.some(f => f.t === 'player_jump_land'));
  assert.ok(chainLinks(q.run).some(f => f.x2 === Math.round(linked.x) && f.y2 === Math.round(linked.y)), 'landing did not emit WPN LINK');
  assert.ok(linked.hp < linkedHp, 'landing link did not damage the second threat');
}

// A moving firewall block also owns the normal weapon-chain pseudo projectile.
{
  const q = fixture('wall-chain', 'impact_driver', 236004);
  q.p.stats.bulletChain = 1;
  q.p.stats.impactWallUnlocked = 1;
  q.p.stats.impactPushUnlocked = 1;
  q.p.weapons = ['impact_wall']; q.p.weaponIdx = 0;
  // Keep the freshly placed block inside the base PUSH selection reach.
  q.p.aimX = q.p.x + 180; q.p.aimY = q.p.y; q.p.fire = true;
  tick(q);
  q.p.fire = false; tick(q);
  const wall = q.run.tempWalls.find(w => w.owner === q.p.id);
  assert.ok(wall, 'firewall setup failed');
  const cx = wall.x + wall.w / 2, cy = wall.y + wall.h / 2;
  // Cursor contact on the left side launches the block right. Keep enough
  // separation from its initial body so it cannot settle around a new target.
  const first = threat('wall-first', cx + 190, cy);
  const linked = threat('wall-linked', cx + 190, cy + 130);
  q.run.enemies = [first, linked];
  const linkedHp = linked.hp;
  q.p.aimX = cx - 20; q.p.aimY = cy; q.p.wantSecondary = true;
  tick(q);
  for (let i = 0; i < 60 && !chainLinks(q.run).length; i++) tick(q);
  assert.ok(q.run.fx.some(f => f.t === 'impact_wall_hit' && f.id === q.p.id), 'moving wall did not hit');
  assert.ok(chainLinks(q.run).some(f => f.x2 === Math.round(linked.x) && f.y2 === Math.round(linked.y)), 'moving wall did not emit WPN LINK');
  assert.ok(linked.hp < linkedHp, 'moving-wall link did not damage the second threat');
}

// Drone bullets travel through the shared player-projectile collision path and
// therefore trigger WPN LINK without a separate drone-link passive.
{
  const q = fixture('drone-chain', 'impact_driver', 236005);
  q.p.stats.drones = 1;
  q.p.stats.bulletChain = 1;
  q.p.droneCd = 0;
  const dp = orbitalPos(q.p, 0, 1, q.now + 1 / 60 + 100);
  const first = threat('drone-first', dp.x + 190, dp.y);
  const linked = threat('drone-linked', dp.x + 190, dp.y + 130);
  q.run.enemies = [first, linked];
  const linkedHp = linked.hp;
  tick(q);
  assert.ok(q.run.bullets.some(b => b.kind === 'drone' && b.owner === q.p.id), 'drone did not create its test projectile');
  q.p.stats.drones = 0; // isolate the single projectile already in flight
  for (let i = 0; i < 90 && !chainLinks(q.run).length; i++) tick(q);
  assert.ok(chainLinks(q.run).some(f => f.x2 === Math.round(linked.x) && f.y2 === Math.round(linked.y)), 'drone projectile did not emit WPN LINK');
  assert.ok(linked.hp < linkedHp, 'drone link did not damage the second threat');
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /if \(!isImpactDriverPlayer\(p\)\) p\.wantActive = false/);
assert.match(sim, /\(!wasAirborne \|\| isImpactDriverPlayer\(p\)\).*p\.wantActive/);
assert.match(main, /Q доступна прямо в полёте/);
assert.match(main, /Q remains available in flight/);

console.log('v2.1.236 checks passed: airborne Driver Q plus landing, moving-wall and drone WPN LINK paths');
