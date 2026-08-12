import assert from 'node:assert/strict';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import { ENEMIES } from '../shared/data.v2-1.js';
import {
  createRun, createPlayer, startRoom, step, handleDevCommand,
  octLaserPhaseDuration, octLaserClipPoint
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.221');
assert.equal(BUILD_ID, 'oct_laser_array_boss');
assert.equal(PROTOCOL, 15);
assert.equal(ENEMIES.boss.label, 'OCT');
assert.ok(ENEMIES.boss.armor > 0, 'OCT must be armored');
assert.deepEqual(Array.from({ length: 8 }, (_, i) => octLaserPhaseDuration(i + 1)), [4, 4, 4, 4, 4, 4, 4, 4]);

const run = createRun(22108);
run.runDepth = 3;
run.bossOrder = ['boss', 'boss_croupier', 'boss_anchor_cashier', 'boss_hunter_chorus', 'boss_q_revisor', 'boss_trinode'];
const p = createPlayer('oct-test', 'OCT-TEST', 0);
p.devGod = true;
p.invuln = 999999;
const players = new Map([[p.id, p]]);
startRoom(run, players);

assert.equal(run.plan.category, 'boss');
assert.equal(run.plan.roomArchetype, 'oct_laser_arena');
assert.equal(run.plan.w, 3100);
assert.equal(run.plan.h, 2130);
assert.ok(run.plan.w * run.plan.h >= 2200 * 1500 * 1.99, 'OCT arena must be approximately twice classic area');
assert.ok(run.plan.walls.length >= 14, 'OCT arena must provide extra wall cover');

const boss = run.enemies.find(e => e.kind === 'boss');
assert.ok(boss, 'OCT must replace the old base boss slot');
assert.equal(boss.octPhase, 1);
assert.ok(boss.shellMax > 0 && boss.shellHp === boss.shellMax, 'OCT must spawn with armor');
assert.equal(boss.x, run.plan.w / 2);
assert.equal(boss.y, run.plan.h / 2);

step(run, players, 1 / 60, 1);
assert.equal(boss.octLasers.length, 1, 'phase 1 must emit one beam');
assert.ok(run.fx.some(f => f.t === 'oct_phase' && f.phase === 1), 'phase transition must emit a sound/visual event');
assert.ok(run.fx.some(f => f.t === 'oct_laser_pulse'), 'laser must emit a pulse sound event');

const wall = { x: 400, y: 100, w: 80, h: 300 };
const clip = octLaserClipPoint({ plan: { w: 1000, h: 600, walls: [wall] } }, 100, 200, 1, 0);
assert.ok(clip.x >= 397 && clip.x <= 401, 'beam must stop at the first wall instead of crossing cover');
assert.equal(Math.round(clip.y), 200);

boss.octPhase = 7; boss.octPhaseT = 4; boss.octPhaseAnnounced = 0;
step(run, players, 1 / 60, 2);
assert.equal(boss.octLasers.length, 7, 'phase 7 must emit seven beams');
boss.octPhase = 8; boss.octPhaseT = 4; boss.octPhaseAnnounced = 0;
step(run, players, 1 / 60, 3);
assert.equal(boss.octLasers.length, 8, 'final phase must emit all eight beams');
assert.ok(boss.octLasers.every(seg => seg[4] === 1), 'final beams must use the red variant');

assert.equal(handleDevCommand(run, players, p, { action: 'spawn_pack' }), true);
const hpBefore = run.enemies.filter(e => e.kind !== 'boss').map(e => [e.id, e.hp]);
assert.ok(hpBefore.length >= 8, 'mob-immunity check requires a live enemy pack');
for (let i = 0; i < 30; i++) step(run, players, 1 / 60, 3 + i / 60);
for (const [id, hp] of hpBefore) {
  const mob = run.enemies.find(e => e.id === id);
  if (mob) assert.equal(mob.hp, hp, 'OCT lasers must never damage mobs');
}

boss.octPhase = 8; boss.octPhaseT = 0.01; boss.octPhaseAnnounced = 1;
step(run, players, 1 / 60, 4);
assert.ok(boss.octCrashT > 0, 'phase 8 must end in a short crash');
assert.equal(boss.octLasers.length, 0);
for (let i = 0; i < 100; i++) step(run, players, 1 / 60, 4.1 + i / 60);
assert.equal(boss.octPhase, 1, 'boss must restart from phase 1 after the crash');

console.log('v2.1.221 checks passed: OCT arena, armor, 1-8 beams, wall clipping, mob immunity, phase reset');
