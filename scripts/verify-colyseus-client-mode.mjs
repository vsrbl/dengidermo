import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Client } from '@colyseus/sdk';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const expectedVersion = VERSION.replace(/^v/, '');
const suffix = expectedVersion.replaceAll('.', '-');
const port = 39243;
const baseUrl = `http://127.0.0.1:${port}`;

const pkg = readJson('package.json');
assert.equal(pkg.scripts['check:colyseus-client'], 'node scripts/verify-colyseus-client-mode.mjs', 'root package must expose client-mode verifier');

const index = read('index.html');
assert.ok(index.includes('id="serverBtn"'), 'menu must expose a PLAY SERVER button');
assert.ok(index.includes('CREATE P2P LEGACY'), 'legacy create must be visibly labeled as P2P');
assert.ok(index.includes('JOIN P2P LEGACY'), 'legacy join must be visibly labeled as P2P');
assert.ok(index.includes(`./vendor/colyseus.js?v=${expectedVersion}`), 'index must load Colyseus browser SDK from first-party vendor route');
assert.ok(fs.existsSync(path.join(root, 'vendor', 'colyseus.js')), 'Colyseus browser SDK must ship as vendor/colyseus.js so static deploys do not 404');

const entry = read(`src/main.v${suffix}.js`);
assert.ok(entry.includes('createColyseusRuntime'), 'current entry must create the playable Colyseus runtime');
assert.ok(entry.includes('colyseusRuntime.bindMenu()'), 'current entry must bind server mode menu button');
assert.ok(entry.includes('app.role === "server"'), 'current entry must route loop/esc behavior through server mode');

const runtime = read('src/net/colyseusRuntime.js');
assert.ok(runtime.includes('PLAY SERVER') || runtime.includes('server connecting'), 'Colyseus runtime must own server connect UI flow');
assert.ok(runtime.includes('sendColyseusInput'), 'Colyseus runtime must send input frames to server');
assert.ok(runtime.includes('buildServerSnapshot'), 'Colyseus runtime must convert schema state into renderer snapshots');
assert.ok(runtime.includes('SERVER ARENA'), 'Colyseus runtime must mark the temporary authoritative arena clearly');

const clientAdapter = read('src/net/colyseusClient.js');
assert.ok(clientAdapter.includes('new globalObj.Colyseus.Client'), 'browser adapter must use injected Colyseus SDK global');
assert.ok(clientAdapter.includes('name: options.name'), 'browser adapter must pass display name to server room');

const mainServer = read('server/mainServer.js');
assert.ok(mainServer.includes("app.get('/vendor/colyseus.js'"), 'unified Render server must serve the browser Colyseus SDK bundle');
assert.ok(mainServer.includes("vendor', 'colyseus.js"), 'vendor route must prefer bundled SDK before node_modules fallback');
assert.ok(mainServer.includes("@colyseus/sdk"), 'vendor route must still keep @colyseus/sdk fallback for production dependencies');

const schema = read('server/colyseus/schema.js');
assert.ok(schema.includes("sessionId: 'string'"), 'schema player state must expose sessionId so the browser can identify its local slot');
assert.ok(schema.includes("angle: 'number'"), 'schema player state must expose aiming angle for renderer');
assert.ok(schema.includes("vx: 'number'"), 'schema projectile state must expose velocity for renderer smoothing');

const room = read('server/colyseus/rooms/AuthoritativeArenaRoom.js');
assert.ok(room.includes('name: options.name'), 'room must preserve player display name in authoritative state');

const child = spawn(process.execPath, ['server/mainServer.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});
let stdout = '';
let stderr = '';
child.stdout.on('data', (d) => { stdout += String(d); });
child.stderr.on('data', (d) => { stderr += String(d); });

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitForHealth() {
  for (let i = 0; i < 70; i += 1) {
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
  assert.equal(health.version, VERSION, 'health must match frontend version');
  assert.equal(health.buildId, BUILD_ID, 'health must match frontend build');

  const vendor = await fetch(`${baseUrl}/vendor/colyseus.js?verify=${Date.now()}`);
  assert.equal(vendor.status, 200, 'Render entry must serve Colyseus browser SDK bundle');
  const vendorText = await vendor.text();
  assert.ok(vendorText.includes('Colyseus'), 'vendor bundle must look like the Colyseus SDK');
  assert.ok(vendorText.includes('exports.Client = Client'), 'vendor bundle must expose Colyseus.Client for browser runtime');

  const browserEntry = await (await fetch(`${baseUrl}/src/main.v${suffix}.js?verify=${Date.now()}`)).text();
  assert.ok(browserEntry.includes('createColyseusRuntime'), 'served browser entry must include server mode runtime');

  const client = new Client(baseUrl);
  const roomA = await client.joinOrCreate('nn_arena', { name: 'ALPHA' });
  const roomB = await client.joinOrCreate('nn_arena', { name: 'BETA' });
  await sleep(250);
  assert.ok(roomA.state.players.size >= 2, 'Colyseus arena should replicate multiple server-mode players');
  const localA = Array.from(roomA.state.players.entries()).find(([, player]) => player.sessionId === roomA.sessionId);
  assert.ok(localA, 'schema state must let client identify its own player via sessionId');
  assert.equal(localA[1].name, 'ALPHA', 'server-mode player name should replicate through authoritative state');
  const startX = Number(localA[1].x);
  for (let seq = 1; seq <= 8; seq += 1) {
    roomA.send('input', { seq, right: true, shoot: true, aimX: 1, aimY: 0 });
    await sleep(25);
  }
  await sleep(220);
  const movedA = roomA.state.players.get(localA[0]);
  assert.ok(Number(movedA.x) > startX, 'server-mode input must move player on authoritative server');
  const debugSnapshot = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('debugSnapshot timed out')), 1200);
    roomA.onMessage('debugSnapshot', (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
    roomA.send('debugSnapshot');
  });
  assert.ok(debugSnapshot.metrics.shotsFired >= 1, 'server-mode shooting must spawn authoritative projectile events');
  await roomA.leave();
  await roomB.leave();
} finally {
  child.kill('SIGTERM');
  await sleep(150);
  if (!child.killed) child.kill('SIGKILL');
}

console.log(`playable Colyseus client mode verification passed for ${VERSION}`);
