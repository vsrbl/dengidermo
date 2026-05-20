import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { VERSION, START_WEAPON } from '../src/core/constants.js';
import { START_WEAPON as DATA_START_WEAPON } from '../src/data/weapons.js';

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const exists = (rel) => fs.existsSync(new URL(`../${rel}`, import.meta.url));
const pkg = JSON.parse(read('package.json'));
const serverPkg = JSON.parse(read('server/package.json'));
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('v38.13.7 is registered across frontend package server and cache queries', () => {
  assert.equal(VERSION, 'v38.13.7');
  assert.equal(pkg.version, '38.13.7');
  assert.equal(serverPkg.version, '38.13.7');
  assert.match(read('server/server.js'), /SERVER_VERSION = "v38\.13\.7"/);
  assert.match(read('server/server.js'), /nncckkrr signaling v38\.13\.7/);
  assert.match(read('index.html'), /V38\.13\.7/);
  assert.match(read('index.html'), /style\.css\?v=38\.13\.7/);
  assert.match(read('index.html'), /config\.js\?v=38\.13\.7/);
  assert.match(read('index.html'), /src\/main\.v38-13-7\.js\?v=38\.13\.7/);
});

test('entry graph uses versioned app module URLs to bypass cached v38.12-v38.13.6 modules', () => {
  const entry = read('src/main.v38-13-7.js');
  for (const name of ['session', 'hostRuntime', 'clientRuntime', 'upgradeClient', 'devControls']) {
    assert.ok(exists(`src/app/${name}.v38-13-7.js`), `${name}.v38-13-7.js missing`);
    assert.match(entry, new RegExp(`\\./app/${name}\\.v38-13-7\\.js`), `versioned entry must import ${name}.v38-13-7.js`);
    assert.doesNotMatch(entry, new RegExp(`\\./app/${name}\\.js["']`), `versioned entry must not import unversioned ${name}.js`);
  }
});

test('START_WEAPON boundary is correct and cache compatibility alias exists', () => {
  assert.equal(DATA_START_WEAPON, 'shotgun');
  assert.equal(START_WEAPON, DATA_START_WEAPON, 'temporary constants alias must match data/weapons START_WEAPON');
  const files = [
    'src/main.js',
    'src/main.v38-13-7.js',
    'src/app/session.js',
    'src/app/session.v38-13-7.js',
    'src/app/clientRuntime.js',
    'src/app/clientRuntime.v38-13-7.js'
  ];
  for (const rel of files) {
    const src = read(rel);
    assert.doesNotMatch(src, /START_WEAPON[^\n]*core\/constants\.js/, `${rel} must not import START_WEAPON from core/constants.js`);
  }
  assert.match(read('src/app/session.v38-13-7.js'), /import \{ START_WEAPON \} from "\.\.\/data\/weapons\.js";/);
  assert.match(read('src/app/clientRuntime.v38-13-7.js'), /import \{ START_WEAPON, WEAPONS \} from "\.\.\/data\/weapons\.js";/);
});

test('legacy unversioned app modules remain corrected for old main.js fallbacks', () => {
  assert.match(read('src/app/session.js'), /import \{ START_WEAPON \} from "\.\.\/data\/weapons\.js";/);
  assert.match(read('src/app/clientRuntime.js'), /import \{ START_WEAPON, WEAPONS \} from "\.\.\/data\/weapons\.js";/);
  assert.match(read('src/main.js'), /import \{ START_WEAPON \} from "\.\/data\/weapons\.js";/);
});

test('module export verifier covers both legacy and versioned entry graphs', () => {
  const out = execFileSync(process.execPath, ['scripts/verify-module-exports.mjs'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.match(out, /module export verification passed/);
});

test('boot error overlay remains before module entry', () => {
  const html = read('index.html');
  assert.match(html, /id="bootError"/);
  assert(html.indexOf('NN_SHOW_BOOT_ERROR') < html.indexOf('type="module"'), 'boot error listener must be installed before module entry');
});

let passed = 0;
for (const t of tests) {
  try {
    t.fn();
    passed += 1;
    console.log(`PASS ${t.name}`);
  } catch (err) {
    console.error(`FAIL ${t.name}`);
    console.error(err?.stack || err);
    process.exit(1);
  }
}
console.log(`All ${passed} v38.13.7 nested module cache-bust checks passed`);
