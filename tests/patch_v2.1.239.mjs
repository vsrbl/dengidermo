import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPlayer, createRun, handleDevCommand, impactPushReach, staticStrikeProfile, step } from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.equal(VERSION, 'v2.1.239');
assert.equal(BUILD_ID, 'casino_summons_driver_push_strike_trail_x2');
assert.equal(PROTOCOL, 17);
assert.equal(staticStrikeProfile(1).damage, 144, 'STATIC STRIKE base damage was not doubled');
assert.equal(staticStrikeProfile(2).damage, 174, 'STATIC STRIKE level growth changed instead of only its base');
assert.equal(impactPushReach(null), Number.POSITIVE_INFINITY, 'PUSH selection reach is not unlimited');

function quietArena(seed, hero = 'base') {
  const p = createPlayer(`qa-${seed}`, 'QA', 0, { hero });
  const run = createRun(seed), players = new Map([[p.id, p]]);
  run.phase = 'play';
  run.plan = { w: 1600, h: 1000, walls: [], interactables: [], modifierIds: [], category: 'combat', quota: 999, specialRoomId: 'chill_room' };
  run.portal = { x: 1500, y: 900, open: false };
  run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999999, pauseT: 999999, used: {} };
  run.directorT = 999999;
  run.roomStats = {};
  p.x = 180; p.y = 180; p.aimX = 400; p.aimY = 180;
  p.devGod = true; p.invuln = 999999;
  return { p, run, players, now: 0 };
}
function tick(q, count = 1, dt = 1 / 60) {
  for (let i = 0; i < count; i++) { q.now += dt; step(q.run, q.players, dt, q.now); }
}

// Casino Mob joins the exact regular-boss pressure stream after assembly/roll.
{
  const q = quietArena(239001);
  assert.equal(handleDevCommand(q.run, q.players, q.p, { action: 'spawn_hidden_casino_virus' }), true);
  tick(q, 1500);
  const slot = q.run.enemies.find(e => e.kind === 'slot_mob');
  assert.ok(slot, 'Casino Mob did not complete its authoritative assembly');
  const adds = q.run.enemies.filter(e => e.packRole === 'boss_background');
  assert.ok(adds.length >= 1, 'Casino Mob never summoned regular boss pressure');
  assert.ok(adds.every(e => e.kind === 'grunt' || e.kind === 'runner'), 'Casino Mob pressure used a non-boss add pool');
  assert.ok(q.run.fx.some(f => f.t === 'director_wave' && f.label === 'CASINO PRESSURE'), 'Casino Mob summon has no pressure telegraph');

  // SHELL RIPPER/freeze gates suspend the cooldown itself, matching boss casts.
  q.run.enemies = [slot]; slot.backgroundAddCd = 0; slot.abilityLockT = 2;
  tick(q, 1, 0.25);
  assert.equal(q.run.enemies.filter(e => e.packRole === 'boss_background').length, 0, 'ability-locked Casino Mob summoned adds');
  assert.equal(slot.backgroundAddCd, 0, 'ability lock consumed the Casino Mob summon cooldown');
  slot.abilityLockT = 0; slot.frozenT = 2;
  tick(q, 1, 0.25);
  assert.equal(q.run.enemies.filter(e => e.packRole === 'boss_background').length, 0, 'frozen Casino Mob summoned adds');
  assert.equal(slot.backgroundAddCd, 0, 'freeze consumed the Casino Mob summon cooldown');
  slot.frozenT = 0;
  tick(q, 1, 0.05);
  assert.equal(q.run.enemies.filter(e => e.packRole === 'boss_background').length, 1, 'Casino Mob did not resume summoning after control ended');
}

// RMB chooses a far owned block through intervening geometry. The launch vector
// is copied from hero -> cursor, even when the cursor is slightly outside the
// physical square but still inside its enlarged selection halo.
{
  const q = quietArena(239002, 'impact_driver');
  const blocker = { id: 'solid-between', x: 650, y: 0, w: 70, h: 650 };
  const wall = { id: 'far-owned', owner: q.p.id, temp: 1, kind: 'impact_wall', x: 1120, y: 700, w: 56, h: 56, ttl: 30, maxT: 30, moving: 0, settling: 0 };
  q.run.plan.walls = [blocker, wall]; q.run.tempWalls = [wall];
  q.p.x = 120; q.p.y = 120;
  q.p.aimX = wall.x - 12; q.p.aimY = wall.y + 6;
  const ax = q.p.aimX - q.p.x, ay = q.p.aimY - q.p.y;
  const al = Math.hypot(ax, ay), ex = ax / al, ey = ay / al;
  q.p.wantSecondary = true;
  tick(q);
  assert.equal(wall.moving, 1, 'far/occluded block was not selectable');
  const vl = Math.hypot(wall.vx, wall.vy);
  assert.ok(vl > 0, 'selected block received no launch velocity');
  assert.ok(Math.abs(wall.vx / vl - ex) < 1e-6 && Math.abs(wall.vy / vl - ey) < 1e-6, 'PUSH did not copy the hero-to-cursor aim ray');
  assert.ok(!q.run.fx.some(f => f.reason === 'PUSH OUT OF RANGE'), 'legacy finite selection range still denied PUSH');
}

// First-level landing trace uses the doubled raw formula in real simulation.
{
  const q = quietArena(239003, 'impact_driver');
  q.p.stats.jumpAfterfield = 1;
  q.p.moveX = 1; q.p.moveY = 0; q.p.wantJump = true;
  tick(q);
  q.p.moveX = 0;
  for (let i = 0; i < 120 && q.p.jumpT > 0; i++) tick(q);
  const field = q.run.activeFields.find(f => f.kind === 'impact_field' && f.owner === q.p.id);
  assert.ok(field, 'Impact Driver landing did not create its trace');
  assert.equal(field.dmg, 11.4, 'first-level impact trace did not receive exact x2 raw damage');
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');

assert.doesNotMatch(sim, /reason: 'PUSH OUT OF RANGE'/);
assert.match(sim, /let dx = ax - p\.x, dy = ay - p\.y/);
assert.match(render, /ctx\.setLineDash\(\[5, 5\]\)/);
assert.doesNotMatch(render, /PUSH · OUT OF RANGE/);
assert.doesNotMatch(render, /RMB · PUSH READY/);
assert.doesNotMatch(effects, /const pulseR = r \* \(0\.18 \+ 0\.70 \* p\)/);
assert.match(sim, /dmg: weaponDamageValue\(p, \(7 \+ profile\.fieldLevel \* 4\.4\)/);
assert.match(data, /PUSH: ПУТЬ \+20%/);
assert.doesNotMatch(i18n, /PUSH selection reach|дальности захвата PUSH/);

console.log('v2.1.239 checks passed: Casino Mob boss summons, aim-ray/global PUSH selection, larger hit halo, quiet outline and stable impact trail');
