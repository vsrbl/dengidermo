import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { VERSION } from '../../src/core/constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const pkg = readJson('package.json');
const serverPkg = readJson('server/package.json');
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('v38.13.8 is registered everywhere', () => {
  assert.equal(VERSION, 'v38.13.8');
  assert.equal(pkg.version, '38.13.8');
  assert.equal(serverPkg.version, '38.13.8');
  assert.match(read('server/server.js'), /SERVER_VERSION = "v38\.13\.8"/);
  assert.match(read('index.html'), /V38\.13\.8/);
  assert.match(read('index.html'), /src\/main(?:\.v38-13-8)?\.js\?v=38\.13\.8/);
});

test('START_WEAPON imports stay in data/weapons boundary', () => {
  assert.match(read('src/data/weapons.js'), /export const START_WEAPON = "shotgun"/);
  assert.match(read('src/core/constants.js'), /export const START_WEAPON = "shotgun"/, 'core constants should keep a temporary cache-compat START_WEAPON alias');
  assert.match(read('src/main.js'), /import \{ START_WEAPON \} from "\.\/data\/weapons\.js";/);
  assert.match(read('src/app/session.js'), /import \{ START_WEAPON \} from "\.\.\/data\/weapons\.js";/);
  assert.match(read('src/app/clientRuntime.js'), /import \{ START_WEAPON, WEAPONS \} from "\.\.\/data\/weapons\.js";/);
  assert.doesNotMatch(read('src/main.js'), /START_WEAPON[^\n]*core\/constants\.js/);
  assert.doesNotMatch(read('src/app/session.js'), /START_WEAPON[^\n]*core\/constants\.js/);
  assert.doesNotMatch(read('src/app/clientRuntime.js'), /START_WEAPON[^\n]*core\/constants\.js/);
});

test('static module export verifier catches browser named-import crashes', () => {
  const out = execFileSync(process.execPath, ['scripts/verify-module-exports.mjs'], { cwd: root, encoding: 'utf8' });
  assert.match(out, /module export verification passed/);
});

test('index has fatal boot error overlay before module entry', () => {
  const html = read('index.html');
  assert.match(html, /id="bootError"/);
  assert.match(html, /window\.NN_SHOW_BOOT_ERROR/);
  assert.match(html, /addEventListener\("error"/);
  assert.match(html, /addEventListener\("unhandledrejection"/);
  assert(html.indexOf('NN_SHOW_BOOT_ERROR') < html.indexOf('type="module"'), 'boot error listener must be installed before module entry');
  assert.match(read('style.css'), /\.boot-error\s*\{/);
});

let passed = 0;
for (const t of tests) {
  try {
    t.fn();
    passed += 1;
  } catch (err) {
    console.error(`FAIL ${t.name}`);
    console.error(err);
    process.exit(1);
  }
}
console.log(`All ${passed} v38.13.8 browser module integrity checks passed`);
