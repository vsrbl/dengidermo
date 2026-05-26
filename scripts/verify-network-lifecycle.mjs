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
assert.match(serverSrc, /HOST_SIGNAL_GRACE_MS/, 'server must retain transiently disconnected host signaling before closing the room');
assert.match(serverSrc, /markHostSignalLost/, 'server must mark host signaling loss as soft instead of immediately closing active P2P rooms');
assert.match(serverSrc, /createReconnectToken/, 'server must issue reconnect tokens');
assert.match(serverSrc, /findReconnectPlayerId/, 'server must select offline slots by reconnect token only');
assert.match(serverSrc, /canReclaimHost/, 'server must allow p1 host signaling reclaim by reconnect token');
assert.match(serverSrc, /reclaimHost/, 'server must restore the host websocket without destroying the room');
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
assert.match(transportSrc, /this\.reconnectToken = options\.reconnectToken[\s\S]*sendGuestJoin[\s\S]*reconnectToken: this\.reconnectToken/, 'transport must keep and send saved reconnect token on guest join');
assert.match(transportSrc, /sendHostCreate[\s\S]*reconnectToken: this\.reconnectToken/, 'transport must send the host reconnect token when reclaiming signaling');
assert.match(transportSrc, /scheduleSignalingReconnect/, 'transport must retry signaling without a gameplay-level reconnect');
assert.match(transportSrc, /preservePeers/, 'transport signaling reconnect must preserve RTCPeerConnection and DataChannels');
assert.match(transportSrc, /reconnectToken: msg\.reconnectToken/, 'transport must surface server-issued reconnect tokens');
assert.match(transportSrc, /createPeerChannels/, 'transport must create split peer data channels');
assert.match(transportSrc, /createDataChannel\(config\.label, config\.options\)/, 'transport must create data channels with explicit reliability options');
assert.match(transportSrc, /CHANNEL_KIND_STATE[\s\S]*ordered: false[\s\S]*maxRetransmits: 0/, 'state channel must be unordered/unreliable');
assert.match(transportSrc, /CHANNEL_KIND_CMD[\s\S]*ordered: true/, 'cmd channel must stay reliable ordered');
assert.match(transportSrc, /CHANNEL_KIND_INPUT[\s\S]*ordered: false[\s\S]*maxRetransmits: 0/, 'input channel must be low-latency unordered/unreliable');
assert.doesNotMatch(transportSrc, /createDataChannel\("game"\)/, 'transport must not put gameplay traffic on one legacy reliable game channel');
assert.match(transportSrc, /dc\.bufferedAmount > config\.maxBufferedAmount/, 'transport must guard p2p bufferedAmount before sending');
assert.match(transportSrc, /dropWhenBackpressured \? "dropped" : "unavailable"/, 'state packets must be droppable under p2p backpressure while commands relay fallback');
assert.match(transportSrc, /RELAY_MESSAGE_HARD_LIMIT_BYTES/, 'transport must cap relay websocket messages before send');
assert.match(transportSrc, /sendRelay\(to, data\)/, 'transport must centralize relay sending behind strict size checks');
assert.match(transportSrc, /getPeerTransportMode\(remoteId\)/, 'transport must expose per-peer transport mode');
assert.match(transportSrc, /SOFT_PLAYER_LEFT_REASONS/, 'transport must classify soft player_left reasons separately from hard leaves');
assert.match(transportSrc, /hasOpenPeerChannels\(\)/, 'transport must detect live P2P channels when signaling WebSocket closes');
assert.match(transportSrc, /softSignalLoss[\s\S]*!softSignalLoss[\s\S]*this\.closePeer/, 'transport must not close live WebRTC peers for soft signaling-loss player_left events');
assert.match(transportSrc, /signal_lost/, 'transport must surface signaling loss without forcing gameplay disconnect');
assert.match(sessionSrc, /transportModes/, 'session must keep per-peer transport modes for HUD and host policy');
assert.match(sessionSrc, /nncckkrr\.reconnect/, 'session must persist reconnect tokens per room');
assert.match(sessionSrc, /host_signal_lost/, 'session must treat host signaling loss as soft while P2P may remain alive');
assert.match(sessionSrc, /keeping P2P alive/, 'guest must warn but keep running when only host signaling is lost');
assert.match(sessionSrc, /handleSignalingReconnected/, 'session must update signaling metadata without resetting gameplay state');

const hostRuntimeSrc = readFileSync(path.join(root, 'src/app/hostRuntime.js'), 'utf8');
const constantsSrc = readFileSync(path.join(root, 'src/core/constants.js'), 'utf8');
const uiSrc = readFileSync(path.join(root, 'src/ui.js'), 'utf8');
assert.match(constantsSrc, /SNAPSHOT_RATE_P2P\s*=\s*40/, 'P2P snapshots should keep the high-rate target');
assert.match(constantsSrc, /SNAPSHOT_RATE_RELAY\s*=\s*15/, 'relay snapshots must use relay-safe 15Hz cadence');
assert.match(constantsSrc, /SNAPSHOT_RELAY_TARGET_BYTES\s*=\s*44 \* 1024/, 'relay snapshots must target well below the websocket limit');
assert.match(hostRuntimeSrc, /lastSnapshotSentByPeer/, 'host must rate-limit snapshots independently per peer');
assert.match(hostRuntimeSrc, /SNAPSHOT_RATE_P2P[\s\S]*SNAPSHOT_RATE_RELAY/, 'host must choose snapshot cadence from per-peer transport mode');
assert.match(hostRuntimeSrc, /relayFallback: mode === "relay"/, 'host must prevent high-rate P2P snapshot fallback into relay');
assert.match(uiSrc, /transportModes = null/, 'HUD setNet must accept per-peer transport modes');
assert.match(uiSrc, /peerText/, 'HUD must render per-peer transport modes instead of one global last-packet mode');


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
    ws.__verifyQueue = [];
    ws.__verifyWaiter = null;
    ws.on('message', (data) => {
      if (ws.__verifyWaiter) {
        const waiter = ws.__verifyWaiter;
        ws.__verifyWaiter = null;
        waiter(data);
        return;
      }
      ws.__verifyQueue.push(data);
    });
    const timer = setTimeout(() => reject(new Error('websocket open timeout')), 2000);
    ws.once('open', () => { clearTimeout(timer); resolve(ws); });
    ws.once('error', reject);
  });
}
function nextJson(ws, label, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    function parse(data) {
      try { resolve(JSON.parse(String(data))); }
      catch (err) { reject(err); }
    }
    const queued = ws.__verifyQueue?.shift?.();
    if (queued) return parse(queued);
    const timer = setTimeout(() => {
      ws.__verifyWaiter = null;
      reject(new Error(`timeout waiting for ${label}`));
    }, timeoutMs);
    ws.__verifyWaiter = (data) => {
      clearTimeout(timer);
      parse(data);
    };
  });
}
function noJson(ws, label, timeoutMs = 250) {
  return new Promise((resolve, reject) => {
    const queued = ws.__verifyQueue?.shift?.();
    if (queued) return reject(new Error(`unexpected ${label}: ${String(queued)}`));
    const timer = setTimeout(() => {
      ws.__verifyWaiter = null;
      resolve();
    }, timeoutMs);
    ws.__verifyWaiter = (data) => {
      clearTimeout(timer);
      ws.__verifyWaiter = null;
      reject(new Error(`unexpected ${label}: ${String(data)}`));
    };
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
  guest.close();
  observer.close();
  thief.close();
  wrongToken.close();
  guest3.close();

  const hostP2P = await openWs();
  await nextJson(hostP2P, 'hostP2P hello');
  hostP2P.send(JSON.stringify({ type: 'create', roomId: 'NET141', name: 'HOST' }));
  const createdP2P = await nextJson(hostP2P, 'created NET141');
  assert.equal(createdP2P.playerId, 'p1');

  const guestP2P = await openWs();
  await nextJson(guestP2P, 'guestP2P hello');
  guestP2P.send(JSON.stringify({ type: 'join', roomId: 'NET141', name: 'GUEST' }));
  const joinedP2P = await nextJson(guestP2P, 'joined NET141');
  assert.equal(joinedP2P.playerId, 'p2');
  const hostP2PNotice = await nextJson(hostP2P, 'NET141 player_joined');
  assert.equal(hostP2PNotice.playerId, 'p2');

  hostP2P.close();
  const hostSignalLost = await nextJson(guestP2P, 'soft host signal loss');
  assert.equal(hostSignalLost.type, 'player_left');
  assert.equal(hostSignalLost.playerId, 'p1');
  assert.equal(hostSignalLost.reason, 'host_signal_lost');
  assert.ok(hostSignalLost.players.includes('p1'), 'host signal loss must keep p1 in the room player list during grace');
  await noJson(guestP2P, 'room_closed immediately after host signaling loss');

  const lateJoin = await openWs();
  await nextJson(lateJoin, 'lateJoin hello');
  lateJoin.send(JSON.stringify({ type: 'join', roomId: 'NET141', name: 'LATE' }));
  const lateJoinError = await nextJson(lateJoin, 'late join while host signal lost');
  assert.equal(lateJoinError.type, 'error');
  assert.equal(lateJoinError.message, 'host_signal_lost', 'hostless signaling rooms must reject new joins without destroying existing P2P gameplay');
  await noJson(guestP2P, 'room_closed after late hostless join');

  const hostReclaim = await openWs();
  await nextJson(hostReclaim, 'hostReclaim hello');
  hostReclaim.send(JSON.stringify({ type: 'create', roomId: 'NET141', name: 'HOST2', reconnectToken: createdP2P.reconnectToken }));
  const reclaimed = await nextJson(hostReclaim, 'host reclaimed NET141');
  assert.equal(reclaimed.type, 'created');
  assert.equal(reclaimed.playerId, 'p1', 'host reconnect token must reclaim p1, not create a new role');
  assert.equal(reclaimed.reconnect, true, 'host reclaim must be marked as reconnect');
  assert.ok(reclaimed.reconnectToken && reclaimed.reconnectToken !== createdP2P.reconnectToken, 'host reclaim must rotate the reconnect token');
  const guestReclaimNotice = await nextJson(guestP2P, 'guest sees host reclaim');
  assert.equal(guestReclaimNotice.type, 'player_joined');
  assert.equal(guestReclaimNotice.playerId, 'p1');
  assert.equal(guestReclaimNotice.reconnect, true, 'guests must receive host reconnect metadata');
  assert.ok(guestReclaimNotice.players.includes('p1') && guestReclaimNotice.players.includes('p2'), 'host reclaim must preserve the existing room roster');

  guestP2P.send(JSON.stringify({ type: 'relay', to: 'host', data: { t: 'input', inputSeq: 7 } }));
  const relayedAfterReclaim = await nextJson(hostReclaim, 'guest relay after host reclaim');
  assert.equal(relayedAfterReclaim.type, 'relay');
  assert.equal(relayedAfterReclaim.from, 'p2');
  assert.equal(relayedAfterReclaim.data?.inputSeq, 7, 'guest traffic must route to the reclaimed host signaling socket');

  guestP2P.close();
  lateJoin.close();
  hostReclaim.close();
} finally {
  child.kill('SIGTERM');
  await sleep(100);
}

console.log(`network lifecycle verification passed for ${VERSION} protocol ${SIGNALING_PROTOCOL_VERSION}`);
