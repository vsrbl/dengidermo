import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createPlayer,
  createRun,
  quarantineAnchorCapacity,
  quarantineAnchorDuration,
  resolveProcessControllerAnchorPlacement,
  startRoom,
  step
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:19[0-9]|20[0-8])$/);
if (VERSION === 'v2.1.190') assert.equal(BUILD_ID, 'controller_anchor_floor_capacity_duration');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);

const controller = createPlayer('anchor190', 'ANCHOR', 0, { hero: 'process_controller' });
assert.equal(quarantineAnchorCapacity(controller), 5);
controller.stats.qrLinks = 1;
assert.equal(quarantineAnchorCapacity(controller), 8);
controller.stats.qrLinks = 5;
assert.equal(quarantineAnchorCapacity(controller), 20);
controller.stats.qrLinks = 99;
assert.equal(quarantineAnchorCapacity(controller), 20);

controller.stats.qrHold = 0;
assert.equal(quarantineAnchorDuration(controller), 6, 'base duration was not increased by 25%');
controller.stats.qrHold = 1;
assert.equal(quarantineAnchorDuration(controller), 8.25, 'duration upgrade did not use the stronger curve');
controller.stats.qrHold = 2;
assert.ok(quarantineAnchorDuration(controller) > 11, 'stacked duration upgrade is too weak');

const placementRun = createRun(190);
placementRun.plan = { w: 1200, h: 800, walls: [] };
controller.x = 200;
controller.y = 200;
controller.aimX = 430;
controller.aimY = 310;
assert.deepEqual(resolveProcessControllerAnchorPlacement(placementRun, controller), {
  x: 430, y: 310, nx: 0, ny: 0, surface: 'floor'
});

placementRun.plan.walls = [{ x: 360, y: 80, w: 40, h: 300 }];
controller.aimX = 380;
controller.aimY = 200;
const wallPoint = resolveProcessControllerAnchorPlacement(placementRun, controller);
assert.equal(wallPoint.surface, 'wall');
assert.equal(wallPoint.nx, -1);
assert.ok(wallPoint.x < 360 && wallPoint.x > 340);

function anchorCaptureFixture(qrLinks, count, seed) {
  const p = createPlayer(`anchor-${seed}`, 'ANCHOR', 0, { hero: 'process_controller' });
  p.weapons = ['command_pulse', 'quarantine_anchor'];
  p.weaponIdx = 1;
  p.stats.qrLinks = qrLinks;
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  startRoom(run, players);
  run.plan.walls = [];
  run.enemies = Array.from({ length: count }, (_, i) => ({
    id: `target-${seed}-${i}`,
    kind: 'grunt',
    x: p.x + 60 + (i % 5) * 18,
    y: p.y + (Math.floor(i / 5) - 2) * 18,
    hp: 100,
    maxHp: 100,
    size: 20,
    spawnDelay: 0
  }));
  p.aimX = p.x + 30;
  p.aimY = p.y + 20;
  p.fire = true;
  step(run, players, 1 / 60, 1);
  return run.activeFields.find(f => f.kind === 'quarantine_anchor');
}

const baseAnchor = anchorCaptureFixture(0, 9, 191);
assert.ok(baseAnchor, 'floor anchor was not created');
assert.equal(baseAnchor.surface, 'floor');
assert.equal(baseAnchor.targetCap, 5);
assert.equal(baseAnchor.leashes.length, 5, 'base anchor must hold exactly five simultaneous targets');

const maxAnchor = anchorCaptureFixture(5, 24, 192);
assert.equal(maxAnchor.targetCap, 20);
assert.equal(maxAnchor.leashes.length, 20, 'upgraded anchor must stop at twenty simultaneous targets');

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /quarantineAnchorCapacity\(p\) >= 20/);
assert.match(data, /Базово|Предел одного якоря — 20|удерживает до 5/);
assert.match(hud, /Базово — 5, максимум — 20/);
assert.match(i18n, /floor or wall anchor|полу или стене/);

console.log('v2.1.190 checks passed: QRN floor placement, five-target base, twenty-target cap, stronger duration');
