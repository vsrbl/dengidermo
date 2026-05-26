import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';
import {
  applyPredictionFrame,
  createPredictionFrame,
  frameToServerInput,
  prunePredictionFrames,
  reconcileLocalPrediction,
  replayPredictionFrames
} from '../src/net/colyseusRuntime.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const port = 39247;
const baseUrl = `http://127.0.0.1:${port}`;

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

const pkg = readJson('package.json');
assert.equal(pkg.scripts?.['check:colyseus-reconcile'], 'node scripts/verify-colyseus-reconciliation.mjs', 'root package must expose reconciliation verifier');

const arenaCore = require(path.join(root, 'server/authoritative/arenaCore.js'));
const state = arenaCore.createArenaState({ seed: 47, enemyCount: 0 });
arenaCore.addPlayer(state, 'p1', { sessionId: 's1', name: 'ACK' });
const player = state.players.p1;
const startX = player.x;

const accepted = arenaCore.applyInput(state, 'p1', { seq: 1, right: true, aimX: 1, aimY: 0 });
assert.deepEqual(accepted, { accepted: true, seq: 1 }, 'input seq 1 should be accepted into server queue');
assert.equal(player.lastInputSeq, 1, 'server should remember latest accepted input for stale rejection immediately');
assert.equal(player.lastProcessedInputSeq, 0, 'server must not ack input as processed before the fixed tick applies it');
assert.equal(player.x, startX, 'queued input must not move the player until stepArena runs');

arenaCore.stepArena(state, arenaCore.FIXED_DT_MS);
assert.equal(player.lastProcessedInputSeq, 1, 'fixed server tick must promote queued input to lastProcessedInputSeq');
assert.ok(player.x > startX, 'fixed server tick must move authoritative player from processed input');
assert.equal(arenaCore.applyInput(state, 'p1', { seq: 1, left: true }).accepted, false, 'stale duplicate input must be rejected');

arenaCore.applyInput(state, 'p1', { seq: 2, right: true, shoot: true, aimX: 1, aimY: 0 });
arenaCore.stepArena(state, arenaCore.FIXED_DT_MS);
assert.equal(player.lastProcessedInputSeq, 2, 'second input must become the processed ack after the next tick');
assert.ok(Object.keys(state.projectiles).length >= 1, 'processed shoot input must create server-owned projectile');
const compact = arenaCore.compactSnapshot(state);
assert.equal(compact.players.p1.lastProcessedInputSeq, 2, 'compact snapshot must expose processed ack seq');
assert.ok(compact.players.p1.serverTick >= 1, 'compact snapshot must expose ack server tick');

const serverPose = { id: 'p1', x: 100, y: 100, vx: 0, vy: 0, hp: 100, maxHp: 100, angle: 0, radius: 13, lastProcessedInputSeq: 2 };
const pending = [
  { seq: 1, dt: 1 / 60, right: true, aimX: 1, aimY: 0 },
  { seq: 2, dt: 1 / 60, right: true, aimX: 1, aimY: 0 },
  { seq: 3, dt: 1 / 60, down: true, aimX: 1, aimY: 0 }
];
const reconciled = reconcileLocalPrediction({ ...serverPose, x: 75, y: 100 }, serverPose, pending, 2);
assert.equal(reconciled.pendingInputs.length, 1, 'reconciliation must discard inputs <= server ack');
assert.equal(reconciled.pendingInputs[0].seq, 3, 'reconciliation must keep only unacked input frames');
assert.equal(reconciled.replayed, 1, 'reconciliation must replay remaining unacked frames');
assert.ok(reconciled.pose.y > serverPose.y, 'replayed down input must advance predicted pose from authoritative base');
assert.equal(prunePredictionFrames(pending, 2).length, 1, 'prune helper must remove acked frames');
assert.ok(replayPredictionFrames(serverPose, [{ seq: 4, dt: 1 / 60, right: true, aimX: 1, aimY: 0 }]).x > serverPose.x, 'replay helper must apply unacked movement');

const browserFrame = createPredictionFrame(9, { right: true, firePressed: true, aimX: 200, aimY: 100 }, serverPose, 1 / 60);
assert.equal(browserFrame.seq, 9, 'client prediction frame must preserve seq');
assert.ok(applyPredictionFrame(serverPose, browserFrame).x > serverPose.x, 'client prediction frame must move local pose immediately');
assert.deepEqual(frameToServerInput(browserFrame), {
  seq: 9,
  inputSeq: 9,
  left: false,
  right: true,
  up: false,
  down: false,
  shoot: true,
  dash: false,
  interact: false,
  aimX: 1,
  aimY: 0
}, 'server input payload must be sanitized from the prediction frame');

const schema = read('server/colyseus/schema.js');
assert.ok(schema.includes("lastProcessedInputSeq: 'number'"), 'schema must expose lastProcessedInputSeq');
assert.ok(schema.includes("serverTick: 'number'"), 'schema must expose serverTick for ack diagnostics');
const runtime = read('src/net/colyseusRuntime.js');
assert.ok(runtime.includes('serverMe?.inputStream?.lastProcessedInputSeq'), 'runtime must use schema processed ack, not only immediate inputAck message');
assert.ok(runtime.includes('reconcileLocalPrediction(runtime.predictedLocalPose, serverPose, app.predictionFrames, serverAckSeq)'), 'runtime must reconcile from authoritative pose plus pending frames');
assert.ok(runtime.includes('input-seq-replay-reconciliation'), 'runtime HUD must identify input-seq replay reconciliation');

async function runLiveColyseusCheck() {
  let Client;
  try {
    ({ Client } = await import('@colyseus/sdk'));
  } catch (err) {
    throw new Error(`@colyseus/sdk is required for live reconciliation verification: ${err.message}`);
  }

  const child = spawn(process.execPath, ['server/mainServer.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => { stdout += String(d); });
  child.stderr.on('data', (d) => { stderr += String(d); });

  async function waitForHealth() {
    for (let i = 0; i < 80; i += 1) {
      try {
        const res = await fetch(`${baseUrl}/health?verify=${Date.now()}`);
        if (res.ok) return await res.json();
      } catch {}
      await sleep(100);
    }
    throw new Error(`server did not start. stdout=${stdout} stderr=${stderr}`);
  }

  try {
    const health = await waitForHealth();
    assert.equal(health.version, VERSION, 'live health version must match frontend version');
    assert.equal(health.buildId, BUILD_ID, 'live health build must match frontend build');
    assert.equal(health.colyseusProtocol, 'colyseus-authoritative-combat-damage-v4', 'live health must advertise reconciliation protocol');

    const client = new Client(baseUrl);
    const room = await client.joinOrCreate('nn_arena', { name: 'REC' });
    await sleep(250);
    const local = Array.from(room.state.players.entries()).find(([, p]) => p.sessionId === room.sessionId);
    assert.ok(local, 'live room must replicate local player sessionId');
    const [playerId, livePlayer] = local;
    const liveStartX = Number(livePlayer.x);
    room.send('input', { seq: 1, right: true, aimX: 1, aimY: 0 });
    await sleep(8);
    assert.ok(Number(room.state.players.get(playerId).lastProcessedInputSeq) <= 1, 'processed ack should be schema-owned');
    for (let seq = 2; seq <= 10; seq += 1) {
      room.send('input', { seq, right: true, aimX: 1, aimY: 0 });
      await sleep(18);
    }
    room.send('input', { seq: 5, left: true, aimX: -1, aimY: 0 });
    await sleep(250);
    const after = room.state.players.get(playerId);
    assert.ok(Number(after.x) > liveStartX, 'live server must apply sequenced movement input');
    assert.ok(Number(after.lastProcessedInputSeq) >= 10, 'live schema must ack latest processed input seq');

    const debugSnapshot = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('debugSnapshot timed out')), 1200);
      room.onMessage('debugSnapshot', (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
      room.send('debugSnapshot');
    });
    assert.ok(debugSnapshot.metrics.staleInputs >= 1, 'live server must reject/record stale input seq');
    await room.leave();
  } finally {
    child.kill('SIGTERM');
    await sleep(150);
    if (!child.killed) child.kill('SIGKILL');
  }
}

await runLiveColyseusCheck();

console.log(`Colyseus input ack + reconciliation verification passed for ${VERSION}`);
