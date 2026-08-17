import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEAPON_CHEST_REWARDS } from '../shared/data.v2-1.js';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import {
  createPlayer, createRun, impactPushReach, impactWallInteractionPad,
  impactWallPlacementRange, makeWeaponChestChoices, step
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.240');
assert.equal(BUILD_ID, 'driver_shift_space_push_pull_wpn_audit');
assert.equal(PROTOCOL, 17);
assert.equal(impactPushReach(null), Number.POSITIVE_INFINITY);
assert.equal(impactWallPlacementRange(null), Number.POSITIVE_INFINITY);
assert.ok(impactWallInteractionPad({ w: 66, h: 66 }) >= 50, 'block interaction halo is still too small');

function seeded(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function arena(seed = 240001) {
  const p = createPlayer(`driver-${seed}`, 'DRV', 0, { hero: 'impact_driver' });
  const run = createRun(seed), players = new Map([[p.id, p]]);
  run.phase = 'play';
  run.plan = { w: 1800, h: 1100, walls: [], interactables: [], modifierIds: [], category: 'combat', quota: 999, specialRoomId: 'chill_room' };
  run.portal = { x: 1550, y: 850, open: true };
  run.pickups = [];
  run.roomSockets = [];
  run.movingWalls = [];
  run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999999, pauseT: 999999, used: {} };
  run.directorT = 999999; run.roomStats = {};
  p.x = 170; p.y = 170; p.aimX = 600; p.aimY = 300;
  p.devGod = true; p.invuln = 999999;
  return { p, run, players, now: 0 };
}
function tick(q, count = 1, dt = 1 / 60) {
  for (let i = 0; i < count; i++) { q.now += dt; step(q.run, q.players, dt, q.now); }
}
function solidOwnedWall(q, id, x, y, size = 66) {
  const wall = { id, owner: q.p.id, temp: 1, kind: 'impact_wall', x, y, w: size, h: size, ttl: 30, maxT: 30, moving: 0, settling: 0 };
  q.run.tempWalls.push(wall); q.run.plan.walls.push(wall);
  return wall;
}

// Client mapping: Shift is the Driver jump, Space is its separate placement
// edge, and the packet preserves both for host and guest simulation.
{
  const main = fs.readFileSync(new URL('../src/main.v2-1.js', import.meta.url), 'utf8');
  const state = fs.readFileSync(new URL('../src/state.v2-1.js', import.meta.url), 'utf8');
  const local = fs.readFileSync(new URL('../src/local.v2-1.js', import.meta.url), 'utf8');
  const input = fs.readFileSync(new URL('../src/input.v2-1.js', import.meta.url), 'utf8');
  assert.match(input, /takeSpace\(\)/);
  assert.match(main, /const jump = impactDriverActive \? shiftAction : false/);
  assert.match(main, /const wall = impactDriverActive \? spaceAction : false/);
  assert.match(state, /wall: \(\(!airborne \|\| airborneDriver\) && wall\)/);
  assert.match(local, /m\.wall[\s\S]*p\.wantWall = true/);
}

// The authoritative actions are independent: Shift-jump, Space-placement,
// LMB away and RMB inward. All remain usable while airborne.
{
  const q = arena(240010);
  q.p.wantJump = true; tick(q);
  assert.ok(q.p.jumpT > 0, 'Shift jump edge did not start the Driver jump');
  q.p.aimX = 900; q.p.aimY = 520; q.p.wantWall = true; tick(q);
  const wall = q.run.tempWalls.find(w => w.owner === q.p.id);
  assert.ok(wall, 'Space did not place a block while airborne');
  assert.ok(Math.abs((wall.x + wall.w / 2) - 900) <= 1 && Math.abs((wall.y + wall.h / 2) - 520) <= 1, 'unlimited placement did not use the cursor point');
}
{
  const q = arena(240011);
  const wall = solidOwnedWall(q, 'away', 920, 620);
  q.p.aimX = wall.x - 48; q.p.aimY = wall.y + wall.h / 2;
  q.p.fire = true; tick(q);
  assert.equal(wall.moving, 1, 'LMB did not select through the enlarged halo');
  assert.ok(wall.vx > 0 && wall.vy > 0, 'LMB did not push radially away from the Driver');
}
{
  const q = arena(240012);
  const wall = solidOwnedWall(q, 'inward', 920, 620);
  q.p.aimX = wall.x + wall.w + 48; q.p.aimY = wall.y + wall.h / 2;
  q.p.wantSecondary = true; tick(q);
  assert.equal(wall.moving, 1, 'RMB did not select through the enlarged halo');
  assert.ok(wall.vx < 0 && wall.vy < 0, 'RMB did not pull radially toward the Driver');
  assert.equal(q.run.fx.find(f => f.t === 'impact_wall_push')?.mode, 'pull');
}
{
  const q = arena(240014);
  q.run.plan.walls.push({ id: 'los-blocker', x: 500, y: 0, w: 90, h: 650 });
  const wall = solidOwnedWall(q, 'occluded', 1120, 760);
  q.p.aimX = wall.x - 45; q.p.aimY = wall.y + wall.h / 2;
  q.p.fire = true; tick(q);
  assert.ok(q.p.impactPushCd > 0 && q.run.fx.some(f => f.t === 'impact_wall_push' && f.wallId === wall.id), 'room wall incorrectly blocked remote block selection');
}

// When two enlarged halos overlap, distance to the cursor decides. Creation
// order cannot steal the click from the visibly nearer block.
{
  const q = arena(240013);
  const farther = solidOwnedWall(q, 'farther', 700, 400);
  const nearer = solidOwnedWall(q, 'nearer', 775, 400);
  q.p.aimX = 785; q.p.aimY = 433;
  q.p.fire = true; tick(q);
  assert.equal(nearer.moving, 1, 'nearest overlapping block halo was not selected');
  assert.equal(farther.moving, 0, 'creation order overrode nearest-cursor selection');
}

// Loot, chest, portal, enemies and even the Driver body are legal surfaces.
// Body overlap starts phased; only a real wall rejects placement.
for (const surface of ['loot', 'chest', 'portal', 'enemy', 'player']) {
  const q = arena(240020 + surface.length);
  const x = surface === 'player' ? q.p.x : 720, y = surface === 'player' ? q.p.y : 520;
  q.run.portal = surface === 'portal' ? { x, y, open: true } : q.run.portal;
  if (surface === 'loot') q.run.pickups = [{ id: 'loot', x, y, kind: 'gld' }];
  if (surface === 'chest') q.run.plan.interactables = [{ id: 'chest', x, y, kind: 'weapon_chest', opened: false }];
  if (surface === 'enemy') q.run.enemies = [{ id: 'enemy', kind: 'grunt', x, y, size: 24, hp: 50, maxHp: 50, spawnT: 0 }];
  q.p.aimX = x; q.p.aimY = y; q.p.wantWall = true; tick(q);
  const wall = q.run.tempWalls.find(w => w.owner === q.p.id);
  assert.ok(wall, `placement on ${surface} was rejected`);
  if (surface === 'enemy' || surface === 'player') assert.equal(wall.settling, 1, `${surface} overlap did not phase the new block`);
}
{
  const q = arena(240030);
  q.run.plan.walls = [{ id: 'solid', x: 680, y: 480, w: 100, h: 100 }];
  q.p.aimX = 730; q.p.aimY = 530; q.p.wantWall = true; tick(q);
  assert.equal(q.run.tempWalls.length, 0, 'placement overlapping another wall was allowed');
  assert.ok(q.run.fx.some(f => f.reason === 'FWL BLOCKED'));
}

// WPN audit: obsolete ability-unlock cards carry zero probability because they
// are absent from the reward table. Removing them leaves no blank slots or
// probability holes; every currently eligible Driver reward is observed.
assert.equal(WEAPON_CHEST_REWARDS.some(x => x.id === 'impact_wall_unlock' || x.id === 'impact_push_unlock'), false);
const seen = new Set();
for (const bounce of [0, 1]) {
  const p = createPlayer(`wpn-${bounce}`, 'DRV', 0, { hero: 'impact_driver' });
  p.stats.bulletFire = 1; p.stats.bulletChain = 1; p.stats.impactPushBounce = bounce;
  const rng = seeded(240100 + bounce);
  for (let i = 0; i < 2500; i++) {
    const choices = makeWeaponChestChoices(p, rng, 5, i % 3);
    assert.equal(choices.length, 5, 'Driver WPN chest lost a slot after pool filtering');
    assert.ok(choices.every(x => x.impactOnly === 1), 'foreign loot leaked into Driver WPN');
    for (const choice of choices) seen.add(choice.upgrade || choice.id);
  }
}
for (const id of [
  'impact_damage', 'impact_radius', 'impact_distance', 'impact_stun', 'impact_afterfield', 'impact_rebound',
  'impact_wall_count', 'impact_wall_duration', 'impact_push_range', 'impact_push_damage', 'impact_push_cooldown',
  'impact_push_bounce', 'impact_push_multiplier', 'bullet_range', 'bullet_fire', 'bullet_freeze', 'bullet_poison',
  'element_amp', 'element_spread', 'bullet_chain', 'bullet_chain_status_link', 'impact_power_stat', 'impact_clock_stat'
]) assert.ok(seen.has(id), `eligible Driver WPN reward never appeared: ${id}`);

console.log('v2.1.240 checks passed: Shift/Space controls, push/pull selection, permissive wall placement and WPN probability audit');
