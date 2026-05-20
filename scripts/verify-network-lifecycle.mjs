import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { BUILD_ID, SIGNALING_PROTOCOL_VERSION, VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverSrc = readFileSync(path.join(root, 'server/server.js'), 'utf8');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const port = 39140;
const url = `http://127.0.0.1:${port}`;
const wsUrl = `ws://127.0.0.1:${port}`;

assert.equal(pkg.version, VERSION.replace(/^v/, ''), 'root package version must match constants VERSION');
assert.match(serverSrc, /type: "hello", version: SERVER_VERSION, buildId: SERVER_BUILD_ID, channel: SERVER_RELEASE_CHANNEL, protocol: SIGNALING_PROTOCOL_VERSION/, 'server must send versioned hello');
assert.match(serverSrc, /function handleCreate/, 'server create handler missing');
assert.match(serverSrc, /function handleJoin/, 'server join handler missing');
assert.match(serverSrc, /function leave/, 'server leave handler missing');

const child = spawn(process.execPath, ['server/server.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe']
});
let stdout = '';
let stderr = '';
child.stdout.on('data', (d) => { stdout += String(d); });
child.stderr.on('data', (d) => { stderr += String(d); });

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitForServer() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${url}/health?verify=${Date.now()}`);
      if (res.ok) return;
    } catch {}
    await sleep(80);
  }
  throw new Error(`server did not start. stdout=${stdout} stderr=${stderr}`);
}
function openWs() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => reject(new Error('websocket open timeout')), 2000);
    ws.once('open', () => { clearTimeout(timer); resolve(ws); });
    ws.once('error', reject);
  });
}
function nextJson(ws, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), 2500);
    ws.once('message', (data) => {
      clearTimeout(timer);
      try { resolve(JSON.parse(String(data))); }
      catch (err) { reject(err); }
    });
  });
}

try {
  await waitForServer();
  const rootText = await (await fetch(`${url}/?verify=${Date.now()}`)).text();
  assert.ok(rootText.includes(`nncckkrr signaling ${VERSION} protocol ${SIGNALING_PROTOCOL_VERSION} build ${BUILD_ID}`), 'server root banner must expose version/protocol/build');
  const health = await (await fetch(`${url}/health?verify=${Date.now()}`)).json();
  assert.equal(health.version, VERSION);
  assert.equal(health.buildId, BUILD_ID);
  assert.equal(health.protocol, SIGNALING_PROTOCOL_VERSION);
  assert.equal(health.channel, 'prod');

  const host = await openWs();
  const hostHello = await nextJson(host, 'host hello');
  assert.deepEqual({ type: hostHello.type, version: hostHello.version, buildId: hostHello.buildId, channel: hostHello.channel, protocol: hostHello.protocol }, {
    type: 'hello', version: VERSION, buildId: BUILD_ID, channel: 'prod', protocol: SIGNALING_PROTOCOL_VERSION
  });
  host.send(JSON.stringify({ type: 'create', roomId: 'NET140', name: 'HOST' }));
  const created = await nextJson(host, 'created');
  assert.equal(created.type, 'created');
  assert.equal(created.playerId, 'p1');

  const guest = await openWs();
  const guestHello = await nextJson(guest, 'guest hello');
  assert.equal(guestHello.type, 'hello');
  guest.send(JSON.stringify({ type: 'join', roomId: 'NET140', name: 'GUEST' }));
  const joined = await nextJson(guest, 'joined');
  assert.equal(joined.type, 'joined');
  assert.equal(joined.playerId, 'p2');
  const hostNotice = await nextJson(host, 'player_joined');
  assert.equal(hostNotice.type, 'player_joined');
  assert.equal(hostNotice.playerId, 'p2');

  guest.close();
  host.close();
} finally {
  child.kill('SIGTERM');
  await sleep(100);
}

console.log(`network lifecycle verification passed for ${VERSION} protocol ${SIGNALING_PROTOCOL_VERSION}`);
