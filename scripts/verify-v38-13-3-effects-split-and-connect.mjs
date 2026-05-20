import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import { SIGNALING_PROTOCOL_VERSION, VERSION } from '../src/core/constants.js';
import * as effects from '../src/game/effects.js';
import { Transport } from '../src/net/transport.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const serverSrc = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
const barrelSrc = readFileSync(new URL('../src/game/effects.js', import.meta.url), 'utf8');
const splitFiles = [
  'defs.js',
  'core.js',
  'damage.js',
  'status.js',
  'loot.js'
];

const results = [];
async function test(name, fn) {
  try { await fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function makeSignalingServer() {
  const wss = new WebSocketServer({ port: 0 });
  const rooms = new Map();
  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'hello', version: VERSION, protocol: SIGNALING_PROTOCOL_VERSION }));
    ws.on('message', (raw) => {
      let msg = null;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === 'create') {
        const roomId = String(msg.roomId || '').toUpperCase();
        rooms.set(roomId, { players: ['p1'], names: { p1: msg.name || 'HOST' } });
        ws.send(JSON.stringify({ type: 'created', roomId, playerId: 'p1', players: ['p1'], names: rooms.get(roomId).names }));
      }
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: msg.t }));
      if (msg.type === 'leave') ws.close();
    });
  });
  return wss;
}

await test('v38.13.7 versions are aligned across frontend package server and cache query strings', () => {
  assert.equal(VERSION, 'v38.13.7');
  assert.equal(pkg.version, '38.13.7');
  assert.equal(serverPkg.version, '38.13.7');
  assert.match(serverSrc, /nncckkrr signaling v38\.13\.7/);
  assert.match(indexHtml, /main(?:\.v38-13-7)?\.js\?v=38\.13\.7/);
  assert.match(indexHtml, /config\.js\?v=38\.13\.7/);
  assert.match(indexHtml, /style\.css\?v=38\.13\.7/);
});

await test('effects.js is now a small public barrel and implementation is split by responsibility', () => {
  assert.ok(barrelSrc.length < 900, 'effects.js should stay a tiny compatibility barrel');
  assert.match(barrelSrc, /export \* from "\.\/effects\/defs\.js"/);
  assert.match(barrelSrc, /export \* from "\.\/effects\/core\.js"/);
  assert.match(barrelSrc, /export \* from "\.\/effects\/damage\.js"/);
  assert.match(barrelSrc, /export \* from "\.\/effects\/status\.js"/);
  assert.match(barrelSrc, /export \* from "\.\/effects\/loot\.js"/);
  for (const file of splitFiles) {
    assert.ok(existsSync(new URL(`../src/game/effects/${file}`, import.meta.url)), `${file} split module missing`);
  }
});

await test('public effects API remains backward compatible after split', () => {
  for (const name of [
    'EFFECT_HOOKS',
    'EFFECT_DEFS',
    'DAMAGE_TAGS',
    'buildProjectileEffects',
    'buildPlayerEffects',
    'runEffectHook',
    'effectCommand',
    'dealDamage',
    'resolveProjectileDamage',
    'healProjectileOwner',
    'dealPlayerDamage',
    'healPlayer',
    'applyStatusToEnemy',
    'runEnemyStatusTickPipeline',
    'enemyStatusSnapshot',
    'resolveLootRoll',
    'attractLootToPlayer'
  ]) {
    assert.ok(effects[name], `${name} missing from public effects barrel`);
  }
});

await test('damage status and loot responsibilities are no longer mixed into one god file', () => {
  const defs = readFileSync(new URL('../src/game/effects/defs.js', import.meta.url), 'utf8');
  const core = readFileSync(new URL('../src/game/effects/core.js', import.meta.url), 'utf8');
  const damage = readFileSync(new URL('../src/game/effects/damage.js', import.meta.url), 'utf8');
  const status = readFileSync(new URL('../src/game/effects/status.js', import.meta.url), 'utf8');
  const loot = readFileSync(new URL('../src/game/effects/loot.js', import.meta.url), 'utf8');
  assert.match(defs, /export const EFFECT_HOOKS/);
  assert.match(core, /export function buildProjectileEffects/);
  assert.match(damage, /export function dealPlayerDamage/);
  assert.match(damage, /ARCHITECTURE GUARD: every gameplay heal must go/);
  assert.match(status, /export function runEnemyStatusTickPipeline/);
  assert.match(status, /status ticking must remain visible to ENEMY_STATUS_TICK/);
  assert.match(loot, /export function resolveLootRoll/);
  assert.match(loot, /export function attractLootToPlayer/);
});

await test('CREATE room transport handshake still reaches onReady after protocol hello', async () => {
  const wss = makeSignalingServer();
  await new Promise((resolve) => wss.once('listening', resolve));
  const { port } = wss.address();
  let ready = null;
  const transport = new Transport(`http://127.0.0.1:${port}`, {
    onReady(info) { ready = info; },
    onError(message) { throw new Error(`transport error: ${message}`); }
  });
  transport.connectHost('FIX133', { name: 'HOST' });
  const start = Date.now();
  while (!ready && Date.now() - start < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  transport.close(true);
  await new Promise((resolve) => wss.close(resolve));
  assert.ok(ready, 'create room did not produce onReady');
  assert.equal(ready.role, 'host');
  assert.equal(ready.roomId, 'FIX133');
  assert.equal(ready.playerId, 'p1');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.7 effects split and create-room checks passed`);
