import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION, CONNECT_TIMEOUT_MS, DASH_DENIAL_RECONCILE_MS, UPGRADE_HIDE_MS, UPGRADE_RESEND_MS, UPGRADE_TIMEOUT_MS } from '../src/core/constants.js';
import { displayPlayerName, normalizePlayerName } from '../src/core/names.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const mainSrc = [
  readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/app/session.js', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/app/clientRuntime.js', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/app/upgradeClient.js', import.meta.url), 'utf8')
].join('\n');
const transportSrc = readFileSync(new URL('../src/net/transport.js', import.meta.url), 'utf8');
const stateSrc = readFileSync(new URL('../src/game/state.js', import.meta.url), 'utf8');
const uiSrc = readFileSync(new URL('../src/ui.js', import.meta.url), 'utf8');
const constantsSrc = readFileSync(new URL('../src/core/constants.js', import.meta.url), 'utf8');
const namesSrc = readFileSync(new URL('../src/core/names.js', import.meta.url), 'utf8');
const serverSrc = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

test('v38.13.3 is registered', () => {
  assert.equal(VERSION, 'v38.13.3');
  assert.equal(pkg.version, '38.13.3');
  assert.equal(serverPkg.version, '38.13.3');
  assert.match(serverSrc, /nncckkrr signaling v38\.13\.3/);
  assert.match(pkg.scripts['check:all'], /check:v38-6-3/);
});

test('leave path has one owner and no timer workaround', () => {
  assert.match(mainSrc, /transport\?\.close\(true\);/);
  assert.doesNotMatch(mainSrc, /sendLeaveNotice\?\.\(\)/);
  assert.doesNotMatch(mainSrc, /const leavingRole = role/);
  assert.match(transportSrc, /if \(sendLeave && this\.connected\) this\.sendLeaveNotice\(\);/);
  assert.doesNotMatch(transportSrc, /setTimeout\(/);
  assert.doesNotMatch(transportSrc, /doClose/);
});

test('slot replacement has explicit semantics', () => {
  assert.match(transportSrc, /replacedExistingSlot/);
  assert.match(transportSrc, /callbacks\.onPlayerReplaced/);
  assert.match(mainSrc, /onPlayerReplaced: handlePlayerReplaced/);
  assert.match(mainSrc, /function handlePlayerReplaced\(id\)/);
  assert.doesNotMatch(transportSrc, /onPlayerLeft\?\.\(joinedId\)/);
  assert.doesNotMatch(transportSrc, /wasKnown/);
});

test('name normalization is shared on the browser side', () => {
  assert.match(uiSrc, /import \{ normalizePlayerName \} from "\.\/core\/names\.js"/);
  assert.match(stateSrc, /import \{ displayPlayerName \} from "\.\.\/core\/names\.js"/);
  assert.doesNotMatch(uiSrc, /export function normalizePlayerName/);
  assert.doesNotMatch(stateSrc, /function displayName/);
  assert.match(namesSrc, /export function normalizePlayerName/);
  assert.equal(normalizePlayerName(' guest two! '), 'GUEST-TWO');
  assert.equal(displayPlayerName('###', 'P2'), 'P2');
});

test('client timing literals are named constants', () => {
  assert.equal(CONNECT_TIMEOUT_MS, 9000);
  assert.equal(DASH_DENIAL_RECONCILE_MS, 700);
  assert.equal(UPGRADE_HIDE_MS, 170);
  assert.equal(UPGRADE_RESEND_MS, 900);
  assert.equal(UPGRADE_TIMEOUT_MS, 8000);
  assert.match(mainSrc, /CONNECT_TIMEOUT_MS/);
  assert.match(mainSrc, /DASH_DENIAL_RECONCILE_MS/);
  assert.match(mainSrc, /UPGRADE_HIDE_MS/);
  assert.match(mainSrc, /UPGRADE_RESEND_MS/);
  assert.match(mainSrc, /UPGRADE_TIMEOUT_MS/);
  assert.doesNotMatch(mainSrc, /}, 9000\)/);
  assert.doesNotMatch(mainSrc, /}, 170\)/);
  assert.match(constantsSrc, /CONNECT_TIMEOUT_MS/);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.3 cleanup-only checks passed`);
