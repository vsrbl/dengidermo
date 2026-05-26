import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

const pkg = readJson('package.json');
const serverPkg = readJson('server/package.json');
for (const dep of ['@colyseus/core', '@colyseus/ws-transport', '@colyseus/schema', 'express']) {
  assert.ok(pkg.dependencies?.[dep], `root package must declare ${dep}`);
  assert.ok(serverPkg.dependencies?.[dep], `server package must declare ${dep}`);
}
assert.ok(pkg.dependencies?.['@colyseus/sdk'], 'root package must declare @colyseus/sdk for browser net2 client work');
assert.equal(pkg.scripts?.start, 'node server/mainServer.js', 'root npm start must boot unified Render Colyseus server');
assert.equal(pkg.scripts?.['start:legacy-signaling'], 'node server/server.js', 'root must keep legacy P2P signaling behind explicit script');
assert.equal(pkg.scripts?.['start:colyseus'], 'node server/colyseusServer.js', 'root must expose Colyseus-only start script');
assert.equal(serverPkg.scripts?.start, 'node mainServer.js', 'server package default must boot unified Render Colyseus server');
assert.equal(serverPkg.scripts?.['start:legacy-signaling'], 'node server.js', 'server package must keep legacy P2P signaling behind explicit script');
assert.equal(serverPkg.scripts?.['start:colyseus'], 'node colyseusServer.js', 'server package must expose local Colyseus-only start script');

for (const rel of [
  'server/mainServer.js',
  'server/colyseusServer.js',
  'server/colyseus/schema.js',
  'server/colyseus/rooms/AuthoritativeArenaRoom.js',
  'server/authoritative/arenaCore.js',
  'src/net/colyseusClient.js',
  'docs/colyseus-authoritative-spike.md'
]) {
  assert.ok(exists(rel), `missing Colyseus spike file: ${rel}`);
}


const mainServer = read('server/mainServer.js');
assert.ok(mainServer.includes("gameServer.define('nn_arena'"), 'unified server must expose nn_arena room');
assert.ok(mainServer.includes('unified-colyseus-authoritative'), 'unified server health must identify authoritative Colyseus mode');
assert.ok(mainServer.includes('legacySignaling: false'), 'unified server must not present the old P2P signaling path as active');
assert.ok(mainServer.includes("app.use('/src'"), 'unified server must serve static browser modules for Render');

const server = read('server/colyseusServer.js');
assert.ok(server.includes("gameServer.define('nn_arena'"), 'Colyseus server must expose nn_arena room');
assert.ok(server.includes('WebSocketTransport'), 'Colyseus server must use ws transport explicitly');
assert.ok(server.includes("url.pathname === '/health'"), 'Colyseus server must expose /health');
assert.ok(server.includes('maxPayload: 16 * 1024'), 'Colyseus server must cap inbound payload size');

const room = read('server/colyseus/rooms/AuthoritativeArenaRoom.js');
assert.ok(room.includes('extends Room'), 'room must extend Colyseus Room');
assert.ok(room.includes("this.onMessage('input'"), 'room must receive input-only gameplay messages');
assert.ok(room.includes('this.setSimulationInterval'), 'room must own a server-side simulation interval');
assert.ok(room.includes('this.setPatchRate(PATCH_RATE_MS)'), 'room must set patch cadence separately from tick cadence');
assert.ok(room.includes('this.allowReconnection'), 'room must use Colyseus reconnection grace');
assert.ok(room.includes("client.send('inputAck'"), 'room must ack accepted input seq');

const client = read('src/net/colyseusClient.js');
assert.ok(client.includes('connectColyseusArena'), 'browser adapter must expose connectColyseusArena');
assert.ok(client.includes('sendColyseusInput'), 'browser adapter must expose sendColyseusInput');
assert.ok(client.includes('window.Colyseus.Client'), 'browser adapter must be SDK-injection safe for static builds');

const core = require(path.join(root, 'server/authoritative/arenaCore.js'));
const state = core.createArenaState({ seed: 7, enemyCount: 1 });
core.addPlayer(state, 'p1', { sessionId: 's1' });
const p1 = state.players.p1;
const startX = p1.x;
assert.deepEqual(core.applyInput(state, 'p1', { seq: 1, right: true, aimX: 1, aimY: 0 }), { accepted: true, seq: 1 });
assert.equal(core.applyInput(state, 'p1', { seq: 1, left: true }).accepted, false, 'duplicate input seq must be rejected');
core.stepArena(state, core.FIXED_DT_MS);
assert.ok(state.players.p1.x > startX, 'accepted input must move authoritative player');
core.applyInput(state, 'p1', { seq: 2, shoot: true, aimX: 1, aimY: 0 });
core.stepArena(state, core.FIXED_DT_MS);
assert.ok(Object.keys(state.projectiles).length >= 1, 'server authoritative projectile must be spawned from input');
const snapshot = core.compactSnapshot(state);
assert.equal(snapshot.authority, 'server', 'compact snapshot must declare server authority');
assert.equal(snapshot.players.p1.lastInputSeq, 2, 'compact snapshot must include ackable input sequence');
core.markPlayerOffline(state, 'p1');
assert.equal(state.players.p1.online, false, 'offline player must stay in state for reconnect grace');

console.log('colyseus authoritative spike verification passed');
