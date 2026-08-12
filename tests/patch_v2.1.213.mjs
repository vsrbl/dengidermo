import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Net } from '../src/net.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.21[3-5]$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.215' ? 'install_preview_anchor_phase_signal' : 'solo_offline_hard_fallback');
assert.equal(PROTOCOL, 15);

// A pending or failed signaling connection must not gate SOLO. Choosing local play
// cancels the socket attempt, creates LocalRoom and delivers WELCOME synchronously.
{
  const previousWebSocket = globalThis.WebSocket;
  class DeadSocket {
    static last = null;
    constructor() { this.readyState = 0; DeadSocket.last = this; }
    send() {}
    close() { this.readyState = 3; this.onclose?.({ code: 1000 }); }
  }
  globalThis.WebSocket = DeadSocket;
  const net = new Net();
  let welcome = null;
  net.on('welcome', m => { welcome = m; });
  const pending = net.connect('ws://unavailable.invalid/ws', 'OFFLINE QA');
  assert.ok(DeadSocket.last);
  net.startSolo('OFFLINE QA', null, 'offline-seed');
  await assert.rejects(pending, /connection cancelled/);
  assert.equal(net.mode, 'solo');
  assert.equal(net.connected, false);
  assert.equal(net.roomId, 'SOLO');
  assert.equal(net.room?.playerCount, 1);
  assert.equal(welcome?.roomId, 'SOLO');
  net.room?.close();
  globalThis.WebSocket = previousWebSocket;
}

const main = fs.readFileSync(new URL('../src/main.v2-1.js', import.meta.url), 'utf8');
const netSource = fs.readFileSync(new URL('../src/net.v2-1.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(main, /function launchSolo\(\)/);
assert.match(main, /btn-solo'\)\.addEventListener\('click', launchSolo\)/);
assert.match(main, /name-input'\)\.addEventListener\('keydown',[\s\S]{0,100}launchSolo\(\)/);
assert.match(main, /seed-input'\)\?\.addEventListener\('keydown',[\s\S]{0,100}launchSolo\(\)/);
assert.match(main, /net\.mode === 'solo' \|\| inGame/);
assert.match(netSource, /_dropNetworkForSolo\(\)/);
assert.match(netSource, /_signalEpoch/);
assert.match(netSource, /connection cancelled/);
assert.match(index, /ОДИНОЧНАЯ ИГРА ГОТОВА/);

console.log('v2.1.213 checks passed: SOLO starts locally while signaling is unavailable or still pending');
