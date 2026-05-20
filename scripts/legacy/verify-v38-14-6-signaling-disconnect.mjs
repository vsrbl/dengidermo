import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

assert.equal(VERSION, 'v38.14.6');
assert.equal(BUILD_ID, 'v38.14.6-20260520');

const pkg = readJson('package.json');
assert.equal(pkg.version, '38.14.6');
assert.equal(readJson('server/package.json').version, '38.14.6');
assert.equal(readJson('src/package.json').version, '38.14.6');
assert.equal(readJson('release.json').version, 'v38.14.6');
assert.equal(readJson('release.json').notes, 'signaling disconnect hardening and immediate host removal notification');

assert.equal(pkg.scripts['check:test-suite'], 'node scripts/verify-test-suite-wiring.mjs');
assert.equal(pkg.scripts['check:v38-14-6'], 'node scripts/verify-v38-14-6-signaling-disconnect.mjs');
assert.ok(pkg.scripts['check:all'].includes('check:test-suite'), 'check:all must include wiring verification');
assert.ok(pkg.scripts['check:all'].includes('check:v38-14-6'), 'check:all must include current migration guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v38-14-5'), 'check:all must not include previous exact-version guard');

const server = read('server/server.js');
assert.ok(server.includes('HEARTBEAT_INTERVAL_MS'), 'server must define active websocket heartbeat interval');
assert.ok(server.includes('HEARTBEAT_TIMEOUT_MS'), 'server must define active websocket heartbeat timeout');
assert.ok(server.includes('function heartbeatClients()'), 'server must actively detect half-open websocket clients');
assert.ok(server.includes('ws.terminate()'), 'heartbeat must terminate stale sockets so close lifecycle runs');
assert.ok(server.includes('notifyPlayerLeft(room, id, "stale_socket")'), 'stale socket pruning must notify remaining players');
assert.ok(server.includes('function detachPlayer(room, playerId)'), 'player detach must be centralized');
assert.ok(server.includes('function rawRoomPlayers(room)'), 'player-left notification must avoid recursive pruning');
assert.ok(server.includes('if (!ROOM_RE.test(roomId)) return send(ws, { type: "error", message: "bad_room" });\n  if (rooms.has(roomId)) return send(ws, { type: "error", message: "room_exists" });\n  if (ws.nnRoom || ws.nnPlayerId) leave(ws);'), 'create must validate target before leaving existing room');
assert.ok(server.includes('if (!room) return send(ws, { type: "error", message: "room_not_found" });'), 'join must validate target before leaving existing room');

const transport = read('src/net/transport.js');
assert.ok(transport.includes('this.sendToHost({ t: "leave" }, { preferRelay: true });'), 'guest leave must still send app-level host notice');
assert.ok(transport.includes('this.sendWs({ type: "leave", roomId: this.roomId });'), 'transport must still send signaling leave');

const session = read('src/app/session.js');
assert.ok(session.includes('window.addEventListener("pagehide", closeActiveTransport);'), 'browser pagehide must best-effort send leave');
assert.ok(session.includes('window.addEventListener("beforeunload", closeActiveTransport);'), 'browser beforeunload must best-effort send leave');
assert.ok(session.includes('dropRemotePlayer(id);'), 'session must remove left player from host state');

const index = read('index.html');
assert.ok(index.includes('src/main.v38-14-6.js?v=38.14.6'), 'index must use current cache-busted entry');
assert.ok(exists('src/main.v38-14-6.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v38-14-5.js'), 'previous versioned entry must not ship');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v38-14-6.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v38-14-5.js`), `previous versioned app module should not ship: ${name}`);
}

console.log('v38.14.6 signaling disconnect hardening checks passed');
