import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { ROOM_SEQUENCE } from '../src/data/rooms.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { ENEMIES } from '../src/data/enemies.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const serverSrc = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
const mainSrc = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const sessionSrc = readFileSync(new URL('../src/app/session.js', import.meta.url), 'utf8');
const hostSrc = readFileSync(new URL('../src/app/hostRuntime.js', import.meta.url), 'utf8');
const clientSrc = readFileSync(new URL('../src/app/clientRuntime.js', import.meta.url), 'utf8');
const upgradeSrc = readFileSync(new URL('../src/app/upgradeClient.js', import.meta.url), 'utf8');
const devSrc = readFileSync(new URL('../src/app/devControls.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function lineCount(text) {
  return text.split(/\r?\n/).length;
}

test('v38.13.6 is registered as the app runtime split foundation', () => {
  assert.equal(VERSION, 'v38.13.6');
  assert.equal(pkg.version, '38.13.6');
  assert.equal(serverPkg.version, '38.13.6');
  assert.match(serverSrc, /nncckkrr signaling v38\.13\.6/);
  assert.match(pkg.scripts['check:all'], /check:v38-12/);
});

test('main.js is now boot and frame-loop glue, not a monolithic app runtime', () => {
  assert.ok(lineCount(mainSrc) < 220, `main.js should stay small after split (${lineCount(mainSrc)} lines)`);
  for (const modulePath of ['./app/session.js', './app/hostRuntime.js', './app/clientRuntime.js', './app/upgradeClient.js', './app/devControls.js']) {
    assert.match(mainSrc, new RegExp(modulePath.replace(/[./]/g, (ch) => ch === '.' ? '\\.' : '\\/')), `${modulePath} not imported by main.js`);
  }
  for (const oldName of ['function startHost', 'function startGuest', 'function handleReady', 'function updateHost', 'function updateGuest', 'function requestUpgradeChoice', 'function requestDevCommand']) {
    assert.doesNotMatch(mainSrc, new RegExp(oldName), `${oldName} drifted back into main.js`);
  }
});

test('session runtime owns create/join/leave transport lifecycle', () => {
  assert.match(sessionSrc, /connectHost\(id, \{ name \}\)/);
  assert.match(sessionSrc, /connectGuest\(id, \{ name \}\)/);
  assert.match(sessionSrc, /onPlayerReplaced: handlePlayerReplaced/);
  assert.match(sessionSrc, /function dropRemotePlayer\(id\)/);
  assert.match(sessionSrc, /app\.players = app\.players\.filter\(\(player\) => player !== id\)/);
  assert.match(sessionSrc, /app\.transport\?\.close\(true\);/);
  assert.doesNotMatch(sessionSrc, /sendLeaveNotice\?\.\(\)/);
});

test('host runtime keeps host-authoritative gameplay mutations on the host side', () => {
  assert.match(hostSrc, /updateHostWorld\(app\.hostState, app\.hostInputs, dt\)/);
  assert.match(hostSrc, /fireWeapon\(app\.hostState, from, msg\.shoot\)/);
  assert.match(hostSrc, /chooseUpgrade\(app\.hostState, id, request\.index\)/);
  assert.match(hostSrc, /performDash\(app\.hostState, id, inputState, \{ seq: request\.seq \}\)/);
  assert.match(hostSrc, /app\.transport\?\.broadcast\(\{ t: "state", snapshot: app\.snapshot \}\)/);
  assert.doesNotMatch(clientSrc, /chooseUpgrade\(/, 'guest/client runtime must not apply upgrades authoritatively');
  assert.doesNotMatch(clientSrc, /updateHostWorld\(/, 'guest/client runtime must not simulate host world');
});

test('client runtime owns prediction, snapshot validation, and guest input sends', () => {
  assert.match(clientSrc, /roomGeometryIdentityMatches\(msg\.snapshot\.location\)/);
  assert.match(clientSrc, /predictLocalDash\(app\.localPose, inputState, nowSec, app\.snapshot\?\.location\)/);
  assert.match(clientSrc, /makePredictedProjectile\(/);
  assert.match(clientSrc, /movePlayer\(app\.localPose, inputState, dt, app\.snapshot\?\.location\)/);
  assert.match(clientSrc, /app\.transport\?\.sendToHost\(\{ t: "input", input: inputState \}\)/);
  assert.match(clientSrc, /app\.transport\?\.sendToHost\(\{ t: "shoot", shoot: payload \}\)/);
});

test('upgrade and dev controls are isolated behind small app modules', () => {
  assert.match(upgradeSrc, /export function createUpgradeClient/);
  assert.match(upgradeSrc, /UPGRADE_HIDE_MS/);
  assert.match(upgradeSrc, /UPGRADE_RESEND_MS/);
  assert.match(upgradeSrc, /UPGRADE_TIMEOUT_MS/);
  assert.match(upgradeSrc, /applyUpgradeRequest\?\.\(app\.playerId, \{ index, key \}\)/);
  assert.match(devSrc, /app\.role !== "host"/);
  assert.match(devSrc, /hasDevMode\(app\.hostState\)/);
  assert.match(devSrc, /applyDevCommand\(app\.hostState, command\)/);
});

test('v38.13.6 is architecture-only: baseline content remains unchanged', () => {
  assert.deepEqual(Object.keys(ENEMIES).sort(), ['boss', 'grunt', 'runner', 'shooter', 'tank']);
  for (const room of ROOM_SEQUENCE) assert.equal(room.layout, 'open_arena', `${room.id} should keep open_arena in v38.13.6`);
  for (const modifier of Object.values(ROOM_MODIFIERS)) assert.deepEqual(modifier.hooks, {}, `${modifier.id} should remain identity-only in v38.13.6`);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.6 app runtime split checks passed`);
