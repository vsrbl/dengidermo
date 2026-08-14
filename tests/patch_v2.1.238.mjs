import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEAPONS, UPGRADES, WEAPON_CHEST_REWARDS } from '../shared/data.v2-1.js';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import {
  createPlayer, createRun, handleDevCommand, impactDriverProfile,
  impactPushReach, impactPushTravel, step
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.238');
assert.equal(BUILD_ID, 'driver_firewall_phase_push_feedback');
assert.equal(PROTOCOL, 17);
assert.equal(WEAPONS.impact_push.dmg, 40, 'PUSH base damage is not doubled');

function arena(seed = 238000) {
  const p = createPlayer(`driver-${seed}`, 'DRV', 0, { hero: 'impact_driver' });
  const run = createRun(seed), players = new Map([[p.id, p]]);
  run.plan = { w: 1400, h: 900, walls: [], interactables: [], modifierIds: [], category: 'combat', quota: 99, specialRoomId: 'chill_room' };
  run.portal = { x: 1300, y: 800, open: false };
  run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999999, pauseT: 999999, used: {} };
  run.directorT = 999999; run.roomStats = {};
  p.x = 240; p.y = 450; p.aimX = 420; p.aimY = 450;
  return { p, run, players, now: 0 };
}
function tick(q, count = 1) {
  for (let i = 0; i < count; i++) { q.now += 1 / 60; step(q.run, q.players, 1 / 60, q.now); }
}
function place(q, x, y) {
  q.p.aimX = x; q.p.aimY = y; q.p.fire = true; tick(q); q.p.fire = false; tick(q);
  return q.run.tempWalls.at(-1);
}

// A near-zero cursor distance clamps the square to a flush tangent instead of
// the old coarse 90px minimum, while never overlapping the 28px hero body.
{
  const q = arena(238001);
  const wall = place(q, q.p.x + 1, q.p.y);
  assert.ok(wall, 'flush wall placement failed');
  const cx = wall.x + wall.w / 2, cy = wall.y + wall.h / 2;
  assert.ok(Math.hypot(cx - q.p.x, cy - q.p.y) < 60, 'wall still uses the old 90px placement gap');
  const nearestX = Math.max(wall.x, Math.min(q.p.x, wall.x + wall.w));
  const nearestY = Math.max(wall.y, Math.min(q.p.y, wall.y + wall.h));
  assert.ok(Math.hypot(nearestX - q.p.x, nearestY - q.p.y) >= 17, 'wall overlaps the hero clearance');

  const qDiagonal = arena(238011);
  const diagonal = place(qDiagonal, qDiagonal.p.x + 1, qDiagonal.p.y + 1);
  assert.ok(diagonal, 'flush diagonal wall placement failed');
  const dx = diagonal.x + diagonal.w / 2 - qDiagonal.p.x;
  const dy = diagonal.y + diagonal.h / 2 - qDiagonal.p.y;
  assert.ok(Math.hypot(dx, dy) < 70, 'diagonal flush placement retained an excessive gap');
}

// Mouse motion cannot launch or rotate state. RMB on the left edge launches
// right, and changing aim afterwards cannot reverse the fixed direction.
{
  const q = arena(238002);
  const wall = place(q, 390, 450);
  assert.ok(wall);
  const cx = wall.x + wall.w / 2, cy = wall.y + wall.h / 2;
  q.p.aimX = wall.x; q.p.aimY = cy; tick(q, 4);
  assert.equal(wall.moving || 0, 0, 'mouse movement alone launched the wall');
  q.p.wantSecondary = true; tick(q);
  assert.ok(wall.moving && wall.vx > 0 && Math.abs(wall.vy) < 1, 'left-edge click did not launch strictly right');
  assert.ok(wall.pushDamage >= 40, 'authoritative wall damage did not use doubled base');
  const vx = wall.vx;
  q.p.aimX = wall.x + wall.w; q.p.aimY = cy; tick(q, 3);
  assert.equal(wall.vx, vx, 'post-click mouse motion changed launch direction');
}

// Diagonal contact is preserved and both wall modules remain usable in flight.
{
  const q = arena(238003);
  const wall = place(q, 390, 450);
  assert.ok(wall);
  q.p.cd = 0; q.p.fireWasDown = false;
  q.p.moveX = 1; q.p.moveY = 0; q.p.wantJump = true;
  q.p.aimX = wall.x; q.p.aimY = wall.y; q.p.wantSecondary = true; tick(q);
  assert.ok(q.p.jumpT > 0, 'jump did not start');
  assert.ok(wall.moving && wall.vx > 0 && wall.vy > 0, 'airborne diagonal PUSH failed');

  q.p.stats.impactWallCount = 1;
  q.p.aimX = q.p.x; q.p.aimY = q.p.y + 160; q.p.fire = true; tick(q); q.p.fire = false; tick(q);
  assert.ok(q.p.jumpT > 0, 'airborne LMB interrupted the jump');
  assert.ok(q.run.tempWalls.length >= 2, 'airborne LMB did not place a block');
}

// An enemy may occupy a new wall. The square stays non-solid, ticks damage,
// then becomes solid only after the hostile has left its volume.
{
  const q = arena(238004);
  assert.equal(handleDevCommand(q.run, q.players, q.p, { action: 'spawn_pack' }), true);
  const enemy = q.run.enemies.find(e => e.kind === 'grunt') || q.run.enemies[0];
  q.run.enemies = [enemy];
  enemy.x = 420; enemy.y = 450; enemy.spawnDelay = 0; enemy.stunT = 10; enemy.spd = 0;
  const hp = enemy.hp;
  const wall = place(q, enemy.x, enemy.y);
  assert.ok(wall?.settling, 'wall placed on enemy was not phased');
  assert.ok(!q.run.plan.walls.includes(wall), 'phased wall became solid around enemy');
  tick(q, 8);
  assert.ok(enemy.hp < hp || enemy.shellHp < (enemy.maxShellHp || 0), 'phased wall dealt no periodic contact damage');
  assert.ok(q.run.fx.some(f => f.t === 'impact_wall_phase_hit'), 'phased hit has no visual event');
  enemy.x = 650; enemy.y = 650; tick(q, 3);
  assert.equal(wall.settling || 0, 0, 'empty phased wall did not settle');
  assert.ok(q.run.plan.walls.includes(wall), 'empty phased wall did not become solid');
}

// A staged spawn warning also keeps the square phased. It cannot become solid
// first and materialize a trapped enemy one frame later.
{
  const q = arena(238014);
  assert.equal(handleDevCommand(q.run, q.players, q.p, { action: 'spawn_pack' }), true);
  const enemy = q.run.enemies[0]; q.run.enemies = [enemy];
  enemy.x = 420; enemy.y = 450; enemy.spawnDelay = 1.2;
  const wall = place(q, enemy.x, enemy.y);
  assert.ok(wall?.settling, 'spawn-warning occupant did not phase the wall');
  assert.ok(!q.run.plan.walls.includes(wall), 'wall became solid before enemy materialization');
}

// PUSH keeps its old +20% curve. The 25% request belongs specifically to the
// hero's post-bounce travel and stacks without changing base jump distance.
{
  const p = createPlayer('range-check', 'DRV', 0, { hero: 'impact_driver' });
  const baseReach = impactPushReach(p), baseTravel = impactPushTravel(p);
  p.stats.impactPushRange = 1;
  assert.ok(Math.abs(impactPushReach(p) / baseReach - 1.20) < 0.001);
  assert.ok(Math.abs(impactPushTravel(p) / baseTravel - 1.20) < 0.001);
  p.stats.jumpRebound = 2;
  assert.equal(impactDriverProfile(p).reboundDistanceBonus, 0.50);
}

// The first physical reflection applies +25% post-bounce travel as velocity,
// without extending or restarting the fake-3D cube animation timer.
{
  const q = arena(238005);
  q.p.stats.jumpRebound = 1;
  q.run.plan.walls.push({ x: 340, y: 80, w: 20, h: 740 });
  q.p.moveX = 1; q.p.moveY = 0; q.p.wantJump = true; tick(q);
  const launchSpeed = Math.abs(q.p.jumpVx), duration = q.p.jumpDuration;
  for (let i = 0; i < 60 && !q.p.jumpReboundRangeApplied; i++) tick(q);
  assert.equal(q.p.jumpReboundRangeApplied, 1, 'first physical wall rebound was not registered');
  assert.ok(Math.abs(q.p.jumpVx) > launchSpeed, 'the +25% rebound range did not increase post-bounce travel');
  assert.equal(q.p.jumpDuration, duration, 'rebound range restarted or extended the cube animation');
}

const rebound = UPGRADES.find(x => x.id === 'impact_rebound');
const reboundCard = WEAPON_CHEST_REWARDS.find(x => x.id === 'impact_rebound');
const pushRange = WEAPON_CHEST_REWARDS.find(x => x.id === 'impact_push_range');
assert.match(rebound?.label || '', /25%/);
assert.match(reboundCard?.desc || '', /25%/);
assert.match(pushRange?.label || '', /20%/);

const renderSource = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
const effectsSource = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
const audioSource = fs.readFileSync(new URL('../src/audio.v2-1.js', import.meta.url), 'utf8');
assert.match(renderSource, /PUSH · ДАЛЕКО/);
assert.match(renderSource, /ПКМ · PUSH ГОТОВ/);
assert.doesNotMatch(renderSource, /const x1 = cx \+ dx \* \(wall\.w \* 0\.46\)/, 'old live-rotating hover arrow survived');
assert.match(effectsSource, /impactWallDamage/);
assert.match(audioSource, /case 'impact_wall_phase_hit'/);
const stateSource = fs.readFileSync(new URL('../src/state.v2-1.js', import.meta.url), 'utf8');
assert.match(stateSource, /airborneDriver/);
assert.match(stateSource, /airborne && !airborneDriver \? false : fire/);

console.log('v2.1.238 checks passed: flush/phased walls, exact fixed PUSH, airborne modules, x2 damage, selection feedback and +25% rebound travel');
