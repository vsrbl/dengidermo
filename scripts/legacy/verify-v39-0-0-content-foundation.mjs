import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';
import { ROOM_SEQUENCE } from '../src/data/rooms.js';
import { ROOM_LAYOUTS } from '../src/data/layouts.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

assert.equal(VERSION, 'v39.0.0');
assert.equal(BUILD_ID, 'v39.0.0-20260520');

const pkg = readJson('package.json');
assert.equal(pkg.version, '39.0.0');
assert.equal(readJson('server/package.json').version, '39.0.0');
assert.equal(readJson('src/package.json').version, '39.0.0');
assert.equal(readJson('release.json').version, 'v39.0.0');
assert.equal(readJson('release.json').notes, 'v39.0.0 controlled content foundation: core-02 twin_pillars layout via roomPlan geometry contract');

assert.equal(pkg.scripts['check:content-foundation'], 'node scripts/verify-content-foundation.mjs');
assert.equal(pkg.scripts['check:v39-0-0'], 'node scripts/verify-v39-0-0-content-foundation.mjs');
assert.ok(pkg.scripts['check:all'].includes('check:content-foundation'), 'check:all must include content foundation verification');
assert.ok(pkg.scripts['check:all'].includes('check:v39-0-0'), 'check:all must include current migration guard');
assert.ok(!pkg.scripts['check:all'].includes('check:pre-content'), 'check:all must not keep pre-content audit after content starts');
assert.ok(!pkg.scripts['check:all'].includes('check:v38-14-6'), 'check:all must not keep previous exact-version guard');

assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'core-02')?.layout, 'twin_pillars', 'core-02 must activate the controlled layout through data');
assert.equal(ROOM_SEQUENCE.filter((room) => room.layout === 'twin_pillars').length, 1, 'only one room may use twin_pillars in this first content step');
assert.ok((ROOM_LAYOUTS.twin_pillars.tags || []).includes('controlled'), 'active layout must be explicitly controlled');
assert.ok(!(ROOM_LAYOUTS.twin_pillars.tags || []).includes('future'), 'active layout must not be future-tagged');
assert.ok((ROOM_LAYOUTS.split_lanes.tags || []).includes('future'), 'split_lanes must stay future-tagged');

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.0.0"'), 'server version must match v39.0.0');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.0.0-20260520"'), 'server build must match v39.0.0 build');
assert.ok(server.includes('HEARTBEAT_INTERVAL_MS'), 'v38.14.6 heartbeat hardening must remain');
assert.ok(server.includes('notifyPlayerLeft(room, id, "stale_socket")'), 'stale socket player-left notification must remain');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-0-0.js?v=39.0.0'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.0.0 | BUILD 20260520'), 'HUD must expose v39.0.0');
assert.ok(exists('src/main.v39-0-0.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v38-14-6.js'), 'previous versioned entry must not ship');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-0-0.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v38-14-6.js`), `previous versioned app module should not ship: ${name}`);
}

console.log('v39.0.0 content foundation checks passed');
