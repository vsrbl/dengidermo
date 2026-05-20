import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

assert.equal(VERSION, 'v38.14.5');
assert.equal(BUILD_ID, 'v38.14.5-20260520');

const pkg = readJson('package.json');
assert.equal(pkg.version, '38.14.5');
assert.equal(readJson('server/package.json').version, '38.14.5');
assert.equal(readJson('src/package.json').version, '38.14.5');
assert.equal(readJson('release.json').version, 'v38.14.5');
assert.equal(readJson('release.json').notes, 'scripts suite slimming and test-suite wiring hardening');

assert.equal(pkg.scripts['check:test-suite'], 'node scripts/verify-test-suite-wiring.mjs');
assert.equal(pkg.scripts['check:v38-14-5'], 'node scripts/verify-v38-14-5-scripts-suite-slimming.mjs');
assert.ok(pkg.scripts['check:all'].includes('check:test-suite'), 'check:all must include wiring verification');
assert.ok(pkg.scripts['check:all'].includes('check:v38-14-5'), 'check:all must include current migration guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v38-14-4'), 'check:all must not include previous exact-version guard');

const currentScripts = fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.endsWith('.mjs')).sort();
const legacyScripts = fs.readdirSync(path.join(root, 'scripts', 'legacy')).filter((name) => name.endsWith('.mjs')).sort();
assert.ok(currentScripts.length <= 22, `current scripts root should stay lean, found ${currentScripts.length}`);
assert.ok(legacyScripts.length >= 30, `legacy archive must retain historical checks, found ${legacyScripts.length}`);
assert.ok(legacyScripts.includes('verify-v38-13-6-browser-module-integrity.mjs'), 'browser module regression history must be retained in legacy archive');
assert.ok(legacyScripts.includes('verify-v38-14-4-roomplan-geometry-source.mjs'), 'roomPlan geometry source regression history must be retained in legacy archive');
assert.ok(currentScripts.includes('verify-module-exports.mjs'), 'current suite must retain module export verification');
assert.ok(currentScripts.includes('verify-release-integrity.mjs'), 'current suite must retain release verification');
assert.ok(currentScripts.includes('verify-pre-content-audit.mjs'), 'current suite must retain pre-content audit');

const index = read('index.html');
assert.ok(index.includes('src/main.v38-14-5.js?v=38.14.5'), 'index must use current cache-busted entry');
assert.ok(exists('src/main.v38-14-5.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v38-14-4.js'), 'previous versioned entry must not ship');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v38-14-5.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v38-14-4.js`), `previous versioned app module should not ship: ${name}`);
}

console.log('v38.14.5 scripts suite slimming checks passed');
