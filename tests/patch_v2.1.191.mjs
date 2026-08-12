import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createPlayer,
  createRun,
  ghostDecoyDuration,
  rActiveCooldown,
  startRoom,
  step
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:19[1-9]|(?:20[0-9]|21[0-5]))$/);
if (VERSION === 'v2.1.191') assert.equal(BUILD_ID, 'r_cooldown_ghost_duration_balance');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);

assert.deepEqual({
  target_lock: rActiveCooldown('target_lock'),
  redline_boost: rActiveCooldown('redline_boost'),
  ghost_decoy: rActiveCooldown('ghost_decoy'),
  rewind_mark: rActiveCooldown('rewind_mark'),
  kill_switch: rActiveCooldown('kill_switch')
}, {
  target_lock: 8,
  redline_boost: 10,
  ghost_decoy: 15,
  rewind_mark: 14,
  kill_switch: 0
});

const durationProbe = createPlayer('ghost-duration', 'GHOST', 0);
durationProbe.stats.rActiveStacks = 1;
assert.equal(ghostDecoyDuration(durationProbe), 8.4);
durationProbe.stats.rActiveStacks = 2;
assert.equal(ghostDecoyDuration(durationProbe), 11.2);
durationProbe.stats.rActiveStacks = 3;
assert.equal(ghostDecoyDuration(durationProbe), 14);

function rFixture(id, seed) {
  const p = createPlayer(`r-${id}-${seed}`, 'R TEST', 0);
  p.stats.rActiveId = id;
  p.stats.rActiveStacks = 1;
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  startRoom(run, players);
  run.plan.walls = [];
  run.enemies = [{ id: `enemy-${seed}`, kind: 'grunt', x: p.x + 120, y: p.y, hp: 999, maxHp: 999, size: 24, spawnDelay: 0 }];
  p.aimX = run.enemies[0].x;
  p.aimY = run.enemies[0].y;
  return { p, players, run };
}

const lock = rFixture('target_lock', 1911);
lock.p.wantRActive = true;
step(lock.run, lock.players, 1 / 60, 1);
assert.equal(lock.p.rActiveCd, 8);

const redline = rFixture('redline_boost', 1912);
redline.p.wantRActive = true;
step(redline.run, redline.players, 1 / 60, 1);
assert.equal(redline.p.rActiveCd, 10);

const ghost = rFixture('ghost_decoy', 1913);
ghost.p.wantRActive = true;
step(ghost.run, ghost.players, 1 / 60, 1);
assert.equal(ghost.p.rActiveCd, 15);
assert.equal(ghost.p.ghostT, 8.4);
assert.equal(ghost.run.decoys.length, 1);
assert.equal(ghost.run.decoys[0].t, 8.4);

const rewind = rFixture('rewind_mark', 1914);
rewind.p.wantRActive = true;
step(rewind.run, rewind.players, 1 / 60, 1);
assert.ok(rewind.p.rewindMark);
assert.equal(rewind.p.rActiveCd, 0);
rewind.p.wantRActive = true;
step(rewind.run, rewind.players, 1 / 60, 2);
assert.equal(rewind.p.rewindMark, null);
assert.equal(rewind.p.rActiveCd, 14);

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.doesNotMatch(sim, /p\.rActiveCd = (12|14|20|22);/);
assert.match(data, /антивирус надолго скрывается/);
assert.match(hud, /долгий обманный сигнал/);
assert.match(i18n, /long-lasting false signal/);

console.log('v2.1.191 checks passed: shorter R cooldowns and doubled Ghost Decoy duration');
