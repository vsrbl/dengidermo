import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pushRemoteInterpolationFrame,
  sampleRemoteInterpolation
} from '../src/net/colyseusRuntime.js';
import { VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

const pkg = readJson('package.json');
assert.equal(pkg.scripts?.['check:colyseus-interpolation'], 'node scripts/verify-colyseus-interpolation.mjs', 'root package must expose interpolation verifier');
assert.ok((pkg.scripts?.['check:all'] || '').includes('npm run check:colyseus-interpolation'), 'check:all must include the interpolation verifier');

const runtime = read('src/net/colyseusRuntime.js');
assert.ok(runtime.includes('REMOTE_INTERPOLATION_DELAY_MS'), 'runtime must define a fixed remote interpolation delay');
assert.ok(runtime.includes('REMOTE_INTERPOLATION_BUFFER_LIMIT'), 'runtime must cap interpolation buffer growth');
assert.ok(runtime.includes('pushRemoteInterpolationFrame'), 'runtime must buffer server snapshots for remote interpolation');
assert.ok(runtime.includes('sampleRemoteInterpolation'), 'runtime must sample interpolated remote state instead of rendering raw patches');
assert.ok(runtime.includes('predicted-local/interpolated-remote'), 'runtime diagnostics must distinguish predicted local from interpolated remote rendering');
assert.ok(runtime.includes('remoteInterpolationMode: "remote-interpolation-buffer"'), 'HUD reconcile stats must expose remote interpolation mode');

const ui = read('src/ui.js');
assert.ok(ui.includes('INT${reconcile.remoteInterpolationDelayMs'), 'HUD must show remote interpolation delay/buffer diagnostics');

function snapshot({ tick, p1x, p2x, enemyX, projectileX }) {
  return {
    authority: 'server',
    netMode: 'colyseus',
    tick,
    time: tick / 60,
    players: [
      { id: 'p1', name: 'LOCAL', x: p1x, y: 10, vx: 0, vy: 0, angle: 0, hp: 100, maxHp: 100 },
      { id: 'p2', name: 'REMOTE', x: p2x, y: 20, vx: 0, vy: 0, angle: 0, hp: 100, maxHp: 100 }
    ],
    enemies: [{ id: 'e1', kind: 'grunt', x: enemyX, y: 30, vx: 0, vy: 0, hp: 40, maxHp: 40, radius: 18 }],
    projectiles: [{ id: 'b1', kind: 'bullet', x: projectileX, y: 40, vx: 100, vy: 0, ownerId: 'p1', radius: 5 }]
  };
}

let buffer = [];
buffer = pushRemoteInterpolationFrame(buffer, snapshot({ tick: 1, p1x: 0, p2x: 0, enemyX: 20, projectileX: 100 }), 1000);
buffer = pushRemoteInterpolationFrame(buffer, snapshot({ tick: 2, p1x: 100, p2x: 100, enemyX: 60, projectileX: 140 }), 1100);

const sampled = sampleRemoteInterpolation(buffer, 1050, 'p1', { x: 999, y: 888, vx: 7, vy: 8, angle: 1 });
assert.ok(sampled, 'interpolation sample must produce a renderer snapshot');
assert.equal(sampled.interpolation.mode, 'remote-interpolation-buffer', 'snapshot must expose interpolation metadata');
assert.equal(sampled.interpolation.delayMs, 110, 'interpolation sample must report the expected delay');
assert.equal(sampled.interpolation.frames, 2, 'interpolation sample must report buffered frame count');

const local = sampled.players.find((p) => p.id === 'p1');
const remote = sampled.players.find((p) => p.id === 'p2');
assert.equal(local.x, 999, 'local player must keep prediction override, not remote interpolation');
assert.equal(local.y, 888, 'local player prediction override should preserve local y');
assert.equal(Math.round(remote.x), 50, 'remote player should render halfway between two server frames');
assert.equal(Math.round(remote.y), 20, 'unchanged remote coordinates should stay stable');
assert.equal(Math.round(sampled.enemies[0].x), 40, 'enemies should render through the interpolation buffer');
assert.equal(Math.round(sampled.projectiles[0].x), 120, 'projectiles should render through the interpolation buffer');

for (let i = 3; i <= 60; i += 1) {
  buffer = pushRemoteInterpolationFrame(buffer, snapshot({ tick: i, p1x: i, p2x: i, enemyX: i, projectileX: i }), 1100 + i * 16);
}
assert.ok(buffer.length <= 36, 'remote interpolation buffer must stay bounded');

console.log(`Colyseus remote interpolation verification passed for ${VERSION}`);
