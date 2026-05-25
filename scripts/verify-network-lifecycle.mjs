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
assert.match(serverSrc, /function notifyPlayerLeft/, 'server explicit player-left notification missing');
assert.match(serverSrc, /function heartbeatClients/, 'server heartbeat stale-disconnect detection missing');
assert.match(serverSrc, /HEARTBEAT_TIMEOUT_MS/, 'server heartbeat timeout missing');
assert.match(serverSrc, /SOFT_DISCONNECT_GRACE_MS/, 'server must retain transiently disconnected guest slots');
assert.match(serverSrc, /HOST_RECONNECT_GRACE_MS/, 'server must retain transiently disconnected host rooms for reconnect');
assert.match(serverSrc, /function touchRoomForSocket/, 'active websocket ping/pong must touch room liveness');
assert.match(serverSrc, /msg\.type === "ping"[\s\S]*touchRoomForSocket\(ws\)/, 'client ping must keep P2P-active rooms alive on signaling server');
assert.match(serverSrc, /markPlayerOffline\(room, id, "stale_socket"\)/, 'stale prune must mark guest slots offline instead of deleting gameplay identity');
assert.match(serverSrc, /notifyPlayerLeft\(room, id, "stale_socket"\)/, 'stale prune must notify host immediately after detection');
assert.doesNotMatch(serverSrc, /closeRoom\(room, "host_missing"\)/, 'transient host socket loss must not immediately delete the room');

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
function nextJson(ws, label, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${label}`)), timeoutMs);
    ws.once('message', (data) => {
      clearTimeout(timer);
      try { resolve(JSON.parse(String(data))); }
      catch (err) { reject(err); }
    });
  });
}
function noJson(ws, label, timeoutMs = 250) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMessage);
      resolve();
    }, timeoutMs);
    function onMessage(data) {
      clearTimeout(timer);
      reject(new Error(`unexpected ${label}: ${String(data)}`));
    }
    ws.once('message', onMessage);
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

  guest.send(JSON.stringify({ type: 'join', roomId: 'NOPE404', name: 'GUEST' }));
  const badJoin = await nextJson(guest, 'room_not_found after already joined');
  assert.equal(badJoin.type, 'error');
  assert.equal(badJoin.message, 'room_not_found');
  await noJson(host, 'player_left after failed join');
  guest.send(JSON.stringify({ type: 'relay', to: 'host', data: { t: 'still_here_after_failed_join' } }));
  const stillHere = await nextJson(host, 'relay after failed join');
  assert.equal(stillHere.type, 'relay');
  assert.equal(stillHere.from, 'p2');
  assert.equal(stillHere.data?.t, 'still_here_after_failed_join');

  guest.send(JSON.stringify({ type: 'leave', roomId: 'NET140' }));
  const left = await nextJson(host, 'player_left on explicit leave');
  assert.equal(left.type, 'player_left');
  assert.equal(left.playerId, 'p2');
  assert.ok(!left.players.includes('p2'), 'left player must be removed from authoritative player list');
  await noJson(host, 'duplicate player_left after explicit leave');

  const guest2 = await openWs();
  await nextJson(guest2, 'guest2 hello');
  guest2.send(JSON.stringify({ type: 'join', roomId: 'NET140', name: 'GUEST2' }));
  const joined2 = await nextJson(guest2, 'guest2 joined');
  assert.equal(joined2.playerId, 'p2', 'freed slot must be reused safely');
  const hostNotice2 = await nextJson(host, 'guest2 player_joined');
  assert.equal(hostNotice2.playerId, 'p2');
  guest2.close();
  const offline2 = await nextJson(host, 'soft player_left on websocket close');
  assert.equal(offline2.type, 'player_left');
  assert.equal(offline2.playerId, 'p2');
  assert.equal(offline2.reason, 'socket_closed');
  assert.ok(offline2.players.includes('p2'), 'transient socket close must retain the player slot for host gameplay state');

  const guest3 = await openWs();
  await nextJson(guest3, 'guest3 hello');
  guest3.send(JSON.stringify({ type: 'join', roomId: 'NET140', name: 'GUEST3' }));
  const joined3 = await nextJson(guest3, 'guest3 joined');
  assert.equal(joined3.playerId, 'p2', 'offline slot must be reused for reconnect');
  assert.equal(joined3.reconnect, true, 'rejoin of an offline slot must be marked as reconnect');
  const reconnectNotice = await nextJson(host, 'guest3 reconnect player_joined');
  assert.equal(reconnectNotice.playerId, 'p2');
  assert.equal(reconnectNotice.reconnect, true, 'host must receive reconnect metadata instead of a destructive replace');

  guest3.send(JSON.stringify({ type: 'leave', roomId: 'NET140' }));
  const left2 = await nextJson(host, 'player_left on explicit leave after reconnect');
  assert.equal(left2.type, 'player_left');
  assert.equal(left2.playerId, 'p2');
  assert.equal(left2.reason, 'left');
  assert.ok(!left2.players.includes('p2'), 'explicit leave must remove the slot from authoritative player list');

  const guest4 = await openWs();
  await nextJson(guest4, 'guest4 hello');
  guest4.send(JSON.stringify({ type: 'join', roomId: 'NET140', name: 'GUEST4' }));
  const joined4 = await nextJson(guest4, 'guest4 joined');
  assert.equal(joined4.playerId, 'p2');
  await nextJson(host, 'guest4 player_joined');

  host.close();
  const hostSoftLost = await nextJson(guest4, 'soft host socket loss');
  assert.equal(hostSoftLost.type, 'player_left');
  assert.equal(hostSoftLost.playerId, 'p1');
  assert.equal(hostSoftLost.reason, 'host_socket_lost');
  assert.ok(hostSoftLost.players.includes('p1'), 'transient host socket loss must retain host slot for reconnect');

  const hostReconnect = await openWs();
  await nextJson(hostReconnect, 'host reconnect hello');
  hostReconnect.send(JSON.stringify({ type: 'create', roomId: 'NET140', name: 'HOST' }));
  const recreated = await nextJson(hostReconnect, 'host reconnect created');
  assert.equal(recreated.type, 'created');
  assert.equal(recreated.playerId, 'p1');
  assert.equal(recreated.reconnect, true, 'host create on offline p1 slot must reconnect instead of room_exists');
  const hostBackNotice = await nextJson(guest4, 'host reconnect player_joined');
  assert.equal(hostBackNotice.type, 'player_joined');
  assert.equal(hostBackNotice.playerId, 'p1');
  assert.equal(hostBackNotice.reconnect, true);

  hostReconnect.send(JSON.stringify({ type: 'ping', t: 12345 }));
  const pong = await nextJson(hostReconnect, 'pong with room identity');
  assert.equal(pong.type, 'pong');
  assert.equal(pong.roomId, 'NET140');
  assert.equal(pong.playerId, 'p1');

  guest4.send(JSON.stringify({ type: 'relay', to: 'host', data: { t: 'relay_after_host_reconnect' } }));
  const relayAfterHostReconnect = await nextJson(hostReconnect, 'relay after host reconnect');
  assert.equal(relayAfterHostReconnect.type, 'relay');
  assert.equal(relayAfterHostReconnect.from, 'p2');
  assert.equal(relayAfterHostReconnect.data?.t, 'relay_after_host_reconnect');

  guest4.close();
  hostReconnect.close();
} finally {
  child.kill('SIGTERM');
  await sleep(100);
}

console.log(`network lifecycle verification passed for ${VERSION} protocol ${SIGNALING_PROTOCOL_VERSION}`);
