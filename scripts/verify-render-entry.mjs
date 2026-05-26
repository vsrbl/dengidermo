import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { BUILD_ID, SIGNALING_PROTOCOL_VERSION, VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const pkg = readJson('package.json');
const renderYaml = read('render.yaml');
const mainServer = read('server/mainServer.js');
const expectedVersion = VERSION.replace(/^v/, '');
const entrySuffix = expectedVersion.replaceAll('.', '-');
const port = 39241;
const baseUrl = `http://127.0.0.1:${port}`;

assert.equal(pkg.scripts.start, 'node server/mainServer.js', 'npm start must boot unified Render server');
assert.equal(pkg.scripts['start:legacy-signaling'], 'node server/server.js', 'legacy signaling must remain explicit, not default');
assert.ok(renderYaml.includes('startCommand: npm start'), 'Render must call npm start');
assert.ok(mainServer.includes('WebSocketTransport'), 'unified server must attach Colyseus WebSocket transport');
assert.ok(mainServer.includes("gameServer.define('nn_arena'"), 'unified server must register nn_arena');
assert.ok(mainServer.includes("app.get('/health'"), 'unified server must provide release health');
assert.ok(mainServer.includes("app.get('/net2'"), 'unified server must provide net2 diagnostics');
assert.ok(mainServer.includes("app.use('/src'"), 'unified server must serve browser modules');
assert.ok(mainServer.includes("app.get('/vendor/colyseus.js'"), 'unified server must serve Colyseus browser SDK vendor route');
assert.ok(mainServer.includes('legacySignaling: true'), 'unified server must expose legacy P2P signaling compatibility until net2 client is playable');

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
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${baseUrl}/health?verify=${Date.now()}`);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(100);
  }
  throw new Error(`unified server did not start. stdout=${stdout} stderr=${stderr}`);
}

try {
  const health = await waitForHealth();
  assert.equal(health.ok, true, 'health should be ok');
  assert.equal(health.mode, 'unified-colyseus-authoritative', 'Render entry must expose unified Colyseus mode');
  assert.equal(health.authority, 'server', 'Render entry must declare server authority');
  assert.equal(health.version, VERSION, 'health version must match release');
  assert.equal(health.buildId, BUILD_ID, 'health build must match release');
  assert.equal(health.channel, 'prod', 'health channel must match prod release');
  assert.equal(health.protocol, SIGNALING_PROTOCOL_VERSION, 'health protocol must match frontend release integrity');
  assert.equal(health.legacySignaling, true, 'legacy signaling compatibility must stay available until net2 client is playable');
  assert.ok(health.rooms.includes('nn_arena'), 'health must expose nn_arena room');

  const net2 = await (await fetch(`${baseUrl}/net2?verify=${Date.now()}`)).json();
  assert.equal(net2.room, 'nn_arena', '/net2 must identify the Colyseus arena room');
  assert.equal(net2.authority, 'server', '/net2 must identify server authority');

  const legacy = await (await fetch(`${baseUrl}/legacy?verify=${Date.now()}`)).json();
  assert.equal(legacy.ok, true, '/legacy should expose legacy signaling compatibility status');
  assert.equal(legacy.mode, 'legacy-signaling-compat', '/legacy must identify compatibility mode');

  const favicon = await fetch(`${baseUrl}/favicon.ico?verify=${Date.now()}`);
  assert.equal(favicon.status, 204, 'favicon should not produce a browser-visible 404');

  await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/`);
    const timer = setTimeout(() => reject(new Error('legacy root websocket did not answer')), 1200);
    ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === 'hello') {
        assert.equal(msg.version, VERSION, 'legacy root websocket hello must match release');
        ws.send(JSON.stringify({ type: 'create', roomId: 'T42', name: 'HOST' }));
        return;
      }
      if (msg.type === 'created') {
        assert.equal(msg.playerId, 'p1', 'legacy root websocket must still support create for old client compatibility');
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    });
    ws.on('error', reject);
  });

  const vendor = await fetch(`${baseUrl}/vendor/colyseus.js?verify=${Date.now()}`);
  assert.equal(vendor.status, 200, 'unified server must serve Colyseus browser SDK vendor bundle');
  assert.ok((await vendor.text()).includes('Colyseus'), 'vendor bundle should contain Colyseus SDK text');

  const index = await (await fetch(`${baseUrl}/?verify=${Date.now()}`)).text();
  assert.ok(index.includes(`name="nncckkrr-version" content="${VERSION}"`), 'unified server must serve current index');
  assert.ok(index.includes(`src="./src/main.v${entrySuffix}.js?v=${expectedVersion}"`), 'served index must point at current versioned entry');

  const release = await (await fetch(`${baseUrl}/release.json?verify=${Date.now()}`)).json();
  assert.equal(release.version, VERSION, 'served release manifest must match version');
  assert.equal(release.buildId, BUILD_ID, 'served release manifest must match build');

  const entry = await (await fetch(`${baseUrl}/src/main.v${entrySuffix}.js?verify=${Date.now()}`)).text();
  assert.ok(entry.includes('createAppState'), 'unified server must serve browser source modules under /src');

  assert.ok(stdout.includes('nncckkrr unified Colyseus'), 'server stdout must identify unified Colyseus entry');
} finally {
  child.kill('SIGTERM');
  await sleep(150);
  if (!child.killed) child.kill('SIGKILL');
}

console.log(`render entry verification passed for ${VERSION} ${BUILD_ID}`);
