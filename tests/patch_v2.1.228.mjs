import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import { createRun, createPlayer, step, buildSnapshot } from '../shared/sim.v2-1.js';
import { P } from '../src/state.v2-1.js';

assert.equal(VERSION, 'v2.1.228');
assert.equal(BUILD_ID, 'inertial_cube_jump');
assert.equal(PROTOCOL, 15);

function setup(walls = []) {
  const run = createRun(228001);
  const p = createPlayer('jump-qa', 'JUMP QA', 0);
  const players = new Map([[p.id, p]]);
  run.plan = { w: 1000, h: 800, walls, interactables: [], modifierIds: [], category: 'combat' };
  run.portal = { x: 900, y: 700, open: false };
  run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999, pauseT: 999 };
  run.directorT = 999;
  run.roomStats = {};
  p.x = 200; p.y = 300; p.invuln = 0; p.moveX = 1; p.moveY = 0;
  return { run, p, players };
}
function tick(q, count = 1, start = 0) {
  for (let i = 0; i < count; i++) step(q.run, q.players, 1 / 60, start + i / 60);
}

{
  const q = setup();
  q.p.wantJump = true;
  tick(q);
  assert.ok(q.p.jumpT > 0, 'Space starts an airborne state');
  assert.ok(q.p.jumpVx > 300 && Math.abs(q.p.jumpVy) < 0.01, 'launch vector is inertial and follows takeoff direction');
  const lockedVy = q.p.jumpVy;
  q.p.moveX = 0; q.p.moveY = -1;
  q.p.wantDash = q.p.wantActive = q.p.wantRActive = q.p.wantInteract = q.p.wantSecondary = true;
  q.p.wantWeapon = 1; q.p.weapons.push('seeker'); q.p.fire = true;
  tick(q, 8, 1);
  assert.equal(q.p.jumpVy, lockedVy, 'air input does not steer the jump');
  assert.equal(q.p.weaponIdx, 0, 'weapon switch is ignored in the air');
  assert.equal(q.p.dashCharges, 1, 'dash is not consumed in the air');
  assert.equal(q.p.wantActive, false, 'air action queue is cleared');
  tick(q, 70, 2);
  assert.equal(q.p.jumpT, 0, 'jump lands automatically');
  assert.ok(q.run.fx.some(f => f.t === 'player_jump_start'));
  assert.ok(q.run.fx.some(f => f.t === 'player_jump_land'));
  const row = buildSnapshot(q.run, q.players).players[0];
  assert.equal(row[P.JUMP], 0);
  assert.ok(row[P.JUMPMAX] > 0.9);
}

{
  const q = setup([{ x: 255, y: 220, w: 30, h: 170 }]);
  q.p.wantJump = true;
  tick(q, 20);
  assert.ok(q.p.jumpVx < 0, 'wall reflects the inertial vector');
  assert.ok(q.run.fx.some(f => f.t === 'player_jump_wall'), 'wall impact has an authoritative cue');
}

{
  const q = setup();
  q.p.wantJump = true;
  tick(q);
  q.run.enemies.push({ id:'touch', kind:'grunt', x:q.p.x, y:q.p.y, hp:40, maxHp:40, size:28, spawnDelay:0, state:'move', st:0, fireCd:999, elite:false, touchCds:new Map(), dmg:30, spd:0 });
  const hp = q.p.hp;
  tick(q, 12, 4);
  assert.equal(q.p.hp, hp, 'airborne player passes through enemy bodies without contact damage');
}

const input = fs.readFileSync(new URL('../src/input.v2-1.js', import.meta.url), 'utf8');
const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
const local = fs.readFileSync(new URL('../src/local.v2-1.js', import.meta.url), 'utf8');
assert.match(input, /c === 'Space'/);
assert.match(local, /m\.jump/);
assert.match(render, /drawJumpCube/);
assert.match(render, /Math\.PI \* 2 \* ease/);

console.log('v2.1.228 checks passed: inertial jump, input lock, wall rebound, mob vault, snapshot and 3-axis cube');
