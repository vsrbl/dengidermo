import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { BUILD_ID, SIGNALING_PROTOCOL_VERSION, VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverSrc = readFileSync(path.join(root, 'server/server.js'), 'utf8');
const mainSrc = readFileSync(path.join(root, 'src/main.js'), 'utf8');
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
assert.match(serverSrc, /createReconnectToken/, 'server must issue reconnect tokens');
assert.match(serverSrc, /findReconnectPlayerId/, 'server must select offline slots by reconnect token only');
assert.match(serverSrc, /nextEmptyPlayerId/, 'server must keep tokenless joins on empty slots only');
assert.match(serverSrc, /msg\.reconnectToken/, 'server join contract must accept reconnectToken');
assert.match(serverSrc, /markPlayerOffline\(room, id, "stale_socket"\)/, 'stale prune must mark guest slots offline instead of deleting gameplay identity');
assert.match(serverSrc, /notifyPlayerLeft\(room, id, "stale_socket"\)/, 'stale prune must notify host immediately after detection');
assert.match(serverSrc, /function isAllowedRelayRoute/, 'server must enforce relay trust routing');
assert.match(serverSrc, /function isAllowedSignalRoute/, 'server must enforce signal trust routing');
assert.match(serverSrc, /isAuthoritativeDownstreamPacket/, 'server must classify host-authoritative downstream packets');
assert.match(mainSrc, /isAuthoritativeHostPacket/, 'client must classify host-authoritative packets');
assert.match(mainSrc, /from !== "p1"/, 'guest client must reject host-authoritative packets not sent by p1');
const transportSrc = readFileSync(path.join(root, 'src/net/transport.js'), 'utf8');
const sessionSrc = readFileSync(path.join(root, 'src/app/session.js'), 'utf8');
assert.match(transportSrc, /reconnectToken: options\.reconnectToken/, 'transport must send saved reconnect token on guest join');
assert.match(transportSrc, /reconnectToken: msg\.reconnectToken/, 'transport must surface server-issued reconnect tokens');
assert.match(sessionSrc, /nncckkrr\.reconnect/, 'session must persist reconnect tokens per room');

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

  const observer = await openWs();
  await nextJson(observer, 'observer hello');
  observer.send(JSON.stringify({ type: 'join', roomId: 'NET140', name: 'OBS' }));
  const observerJoined = await nextJson(observer, 'observer joined');
  assert.equal(observerJoined.type, 'joined');
  assert.equal(observerJoined.playerId, 'p3');
  const hostNoticeP3 = await nextJson(host, 'observer player_joined to host');
  assert.equal(hostNoticeP3.playerId, 'p3');
  const guestNoticeP3 = await nextJson(guest, 'observer player_joined to p2');
  assert.equal(guestNoticeP3.playerId, 'p3');

  guest.send(JSON.stringify({ type: 'relay', to: 'p3', data: { t: 'state', snapshot: { tick: 9999 } } }));
  await noJson(observer, 'guest-forged state relay to another guest');
  guest.send(JSON.stringify({ type: 'relay', to: 'all', data: { t: 'casinoResult', result: { ok: true, seq: 404 } } }));
  await noJson(observer, 'guest-forged casinoResult broadcast');
  await noJson(host, 'guest-forged casinoResult broadcast to host');
  guest.send(JSON.stringify({ type: 'signal', to: 'p3', data: { description: { type: 'offer', sdp: 'fake' } } }));
  await noJson(observer, 'guest-to-guest signaling');
  host.send(JSON.stringify({ type: 'relay', to: 'p3', data: { t: 'state', snapshot: { tick: 1 } } }));
  const hostStateRelay = await nextJson(observer, 'host state relay to observer');
  assert.equal(hostStateRelay.type, 'relay');
  assert.equal(hostStateRelay.from, 'p1');
  assert.equal(hostStateRelay.data?.t, 'state');

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
  assert.ok(joined2.reconnectToken, 'joined guest must receive a reconnect token');
  const guest2ReconnectToken = joined2.reconnectToken;
  const hostNotice2 = await nextJson(host, 'guest2 player_joined');
  assert.equal(hostNotice2.playerId, 'p2');
  guest2.close();
  const offline2 = await nextJson(host, 'soft player_left on websocket close');
  assert.equal(offline2.type, 'player_left');
  assert.equal(offline2.playerId, 'p2');
  assert.equal(offline2.reason, 'socket_closed');
  assert.ok(offline2.players.includes('p2'), 'transient socket close must retain the player slot for host gameplay state');

  const thief = await openWs();
  await nextJson(thief, 'thief hello');
  thief.send(JSON.stringify({ type: 'join', roomId: 'NET140', name: 'THIEF' }));
  const thiefJoined = await nextJson(thief, 'thief joined without reconnect token');
  assert.equal(thiefJoined.type, 'joined');
  assert.equal(thiefJoined.playerId, 'p4', 'tokenless joins must not steal an offline reconnect slot');
  assert.equal(thiefJoined.reconnect, false, 'tokenless joins must not be marked as reconnects');
  const thiefNotice = await nextJson(host, 'thief player_joined');
  assert.equal(thiefNotice.playerId, 'p4');
  assert.equal(thiefNotice.reconnect, false);

  const wrongToken = await openWs();
  await nextJson(wrongToken, 'wrong-token hello');
  wrongToken.send(JSON.stringify({ type: 'join', roomId: 'NET140', name: 'WRONG', reconnectToken: 'not_the_guest2_token' }));
  const wrongTokenError = await nextJson(wrongToken, 'wrong-token room_full');
  assert.equal(wrongTokenError.type, 'error');
  assert.equal(wrongTokenError.message, 'room_full', 'wrong reconnect tokens must not claim offline slots in a full room');
  await noJson(host, 'player_joined after wrong reconnect token');

  const guest3 = await openWs();
  await nextJson(guest3, 'guest3 hello');
  guest3.send(JSON.stringify({ type: 'join', roomId: 'NET140', name: 'GUEST3', reconnectToken: guest2ReconnectToken }));
  const joined3 = await nextJson(guest3, 'guest3 joined with reconnect token');
  assert.equal(joined3.playerId, 'p2', 'offline slot must be reused only with a valid reconnect token');
  assert.equal(joined3.reconnect, true, 'valid token rejoin of an offline slot must be marked as reconnect');
  assert.ok(joined3.reconnectToken && joined3.reconnectToken !== guest2ReconnectToken, 'successful reconnect must rotate the reconnect token');
  const reconnectNotice = await nextJson(host, 'guest3 reconnect player_joined');
  assert.equal(reconnectNotice.playerId, 'p2');
  assert.equal(reconnectNotice.reconnect, true, 'host must receive reconnect metadata instead of a destructive replace');

  guest3.send(JSON.stringify({ type: 'leave', roomId: 'NET140' }));
  const left2 = await nextJson(host, 'player_left on explicit leave after reconnect');
  assert.equal(left2.type, 'player_left');
  assert.equal(left2.playerId, 'p2');
  assert.equal(left2.reason, 'left');
  assert.ok(!left2.players.includes('p2'), 'explicit leave must remove the slot from authoritative player list');

  host.close();
} finally {
  child.kill('SIGTERM');
  await sleep(100);
}

console.log(`network lifecycle verification passed for ${VERSION} protocol ${SIGNALING_PROTOCOL_VERSION}`);
