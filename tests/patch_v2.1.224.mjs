import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import { ENEMIES } from '../shared/data.v2-1.js';
import {
  createRun, createPlayer, startRoom, step,
  octLaserPhaseDuration, octLaserClipPoint
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.224');
assert.equal(BUILD_ID, 'oct_ricochet_boss_repair');
assert.equal(PROTOCOL, 15);
assert.equal(ENEMIES.boss.size, 92, 'OCT size must remain unchanged after the user retracted the size increase');
assert.equal(ENEMIES.boss.spd, 205, 'OCT must use the fast ricochet movement speed');
assert.deepEqual(Array.from({ length: 8 }, (_, i) => octLaserPhaseDuration(i + 1)), [4, 4, 4, 4, 4, 4, 4, 4]);

function makeOct(seed = 22401) {
  const run = createRun(seed);
  run.runDepth = 3;
  run.bossOrder = ['boss', 'boss_croupier', 'boss_anchor_cashier', 'boss_hunter_chorus', 'boss_q_revisor', 'boss_trinode'];
  const p = createPlayer(`oct-${seed}`, 'OCT TEST', 0);
  p.devGod = true;
  p.invuln = 999999;
  const players = new Map([[p.id, p]]);
  startRoom(run, players);
  const boss = run.enemies.find(e => e.kind === 'boss');
  assert.ok(boss, 'OCT boss must spawn');
  boss.spawnDelay = 0;
  return { run, players, boss };
}

function frames(run, players, count, start = 0) {
  for (let i = 0; i < count; i++) step(run, players, 1 / 60, start + i / 60);
}

{
  const { run, players, boss } = makeOct(22401);
  const ox = boss.x, oy = boss.y;
  frames(run, players, 45);
  assert.ok(Math.hypot(boss.x - ox, boss.y - oy) > 90, 'OCT remained stationary after materialization');
  assert.ok(Math.hypot(boss.vx, boss.vy) > 190, 'OCT lost its fast persistent velocity');
  assert.match(boss.state, /^oct_phase:\d+:-?\d+$/, 'OCT state must not serialize a visible countdown');
  assert.equal(boss.octLasers.length, 1, 'phase 1 must still emit one beam while moving');

  const wall = { x: 400, y: 100, w: 80, h: 300 };
  const clip = octLaserClipPoint({ plan: { w: 1000, h: 600, walls: [wall] } }, 100, 200, 1, 0);
  assert.ok(clip.x >= 397 && clip.x <= 401, 'laser must still stop at wall cover');

  boss.octPhase = 8;
  boss.octPhaseT = 4;
  boss.octPhaseAnnounced = 0;
  frames(run, players, 1, 2);
  assert.equal(boss.octLasers.length, 8, 'final phase must still emit all eight beams');
  assert.ok(boss.octLasers.every(seg => seg[4] === 1), 'final phase lasers must remain red');

  boss.octPhaseT = 0.001;
  frames(run, players, 1, 3);
  assert.ok(boss.octCrashT > 0 && boss.octLasers.length === 0, 'final phase must still enter its crash');
  const crashX = boss.x, crashY = boss.y;
  frames(run, players, 12, 3.1);
  assert.ok(Math.hypot(boss.x - crashX, boss.y - crashY) > 20, 'OCT must keep moving during crash');
}

{
  const { run, players, boss } = makeOct(22402);
  boss.stunT = 0.30;
  const sx = boss.x, sy = boss.y;
  frames(run, players, 10);
  assert.ok(Math.hypot(boss.x - sx, boss.y - sy) < 0.05, 'stun must genuinely pause OCT movement');
  frames(run, players, 32, 1);
  assert.ok(Math.hypot(boss.x - sx, boss.y - sy) > 35, 'OCT did not resume after stun ended');

  boss.vx = 0; boss.vy = 0;
  const rx = boss.x, ry = boss.y;
  frames(run, players, 5, 2);
  assert.ok(Math.hypot(boss.x - rx, boss.y - ry) > 5, 'zero-velocity OCT did not self-recover');
}

// Stress several complete phase cycles in the wall-rich OCT arena. The boss
// must remain finite, inside the arena and outside cover while continuously moving.
for (let seed = 22410; seed < 22416; seed++) {
  const { run, players, boss } = makeOct(seed);
  let distance = 0;
  for (let i = 0; i < 1800; i++) {
    const ox = boss.x, oy = boss.y;
    step(run, players, 1 / 60, i / 60);
    distance += Math.hypot(boss.x - ox, boss.y - oy);
    assert.ok(Number.isFinite(boss.x) && Number.isFinite(boss.y), `OCT coordinates broke for seed ${seed}`);
    assert.ok(!run.plan.walls.some(w => boss.x + boss.size / 2 > w.x && boss.x - boss.size / 2 < w.x + w.w && boss.y + boss.size / 2 > w.y && boss.y - boss.size / 2 < w.y + w.h), `OCT entered cover for seed ${seed}`);
  }
  assert.ok(distance > 3500, `OCT did not sustain movement for seed ${seed}`);
}

{
  const { run, players, boss } = makeOct(22403);
  boss.x = 73;
  boss.y = run.plan.h / 2;
  boss.vx = -boss.spd;
  boss.vy = 0;
  frames(run, players, 1);
  assert.ok(boss.vx > 0, 'OCT did not ricochet from the arena edge');
  assert.ok(boss.x >= 72, 'OCT crossed the safe boss arena boundary');
}

{
  const { run, players, boss } = makeOct(22404);
  boss.abilityLockT = 3;
  boss.octLasers = [[1, 1, 2, 2, 0]];
  const ox = boss.x, oy = boss.y;
  frames(run, players, 8);
  assert.equal(boss.octLasers.length, 0, 'SHELL RIPPER must disable OCT lasers');
  assert.ok(Math.hypot(boss.x - ox, boss.y - oy) > 10, 'ability lock must not permanently stop OCT body movement');
}

{
  const { run, players, boss } = makeOct(22405);
  run.enemies = [boss];
  boss.backgroundAddCd = 0;
  frames(run, players, 1);
  assert.ok(run.enemies.some(e => e !== boss && e.packRole === 'boss_background'), 'OCT must retain the shared boss summon pressure');
}

const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
assert.doesNotMatch(render, /PHASE \$\{phase\}\/8/, 'OCT must not draw phase/timer text');
assert.doesNotMatch(render, /phaseLeft/, 'removed OCT countdown must not remain in renderer');
assert.match(render, /this\.label\('OCT', ex, ey \+ 4/);
assert.match(render, /this\.bossHpBar\(ex, ey, size, hp01, COL\.red\)/, 'OCT HP must use the shared boss red bar');

console.log('v2.1.224 checks passed: OCT movement, bounce, stun recovery, lock behavior, summons, UI alignment');
