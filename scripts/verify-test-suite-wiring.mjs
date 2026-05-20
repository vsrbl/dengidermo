import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(root, rel));
const readJson = (rel) => JSON.parse(read(rel));

const pkg = readJson('package.json');
const scripts = pkg.scripts || {};
const checkAll = scripts['check:all'] || '';

const mandatoryScripts = [
  'check:syntax',
  'check:modules',
  'check:release',
  'check:deploy',
  'check:network',
  'check:roomflow',
  'check:director',
  'check:effects',
  'check:geometry',
  'check:room-identity',
  'check:ui',
  'check:architecture',
  'check:legacy-critical',
  'check:content-foundation',
  'check:test-suite',
  'check:v39-0-3'
];

for (const name of mandatoryScripts) {
  assert.ok(scripts[name], `package.json must define ${name}`);
  assert.ok(checkAll.includes(`npm run ${name}`), `check:all must run ${name}`);
}

const criticalLegacy = ['check:dev', 'check:matrix', 'check:feel', 'check:shake', 'check:hooks'];
for (const name of criticalLegacy) {
  assert.ok(scripts[name], `critical legacy package script must remain: ${name}`);
  assert.ok((scripts['check:legacy-critical'] || '').includes(`npm run ${name}`), `check:legacy-critical must include ${name}`);
}

const rootScriptFiles = fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.endsWith('.mjs')).sort();
const legacyScriptFiles = fs.readdirSync(path.join(root, 'scripts', 'legacy')).filter((name) => name.endsWith('.mjs')).sort();

assert.ok(rootScriptFiles.includes('verify-test-suite-wiring.mjs'), 'wiring check must live in current scripts root');
assert.ok(rootScriptFiles.includes('verify-v39-0-3-charger-enemy.mjs'), 'current exact migration guard must live in scripts root');
assert.ok(legacyScriptFiles.length >= 30, 'historical exact-version checks must be retained in scripts/legacy');
assert.ok(legacyScriptFiles.includes('verify-v38-14-4-roomplan-geometry-source.mjs'), 'previous exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v38-14-5-scripts-suite-slimming.mjs'), 'v38.14.5 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v38-14-6-signaling-disconnect.mjs'), 'v38.14.6 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-0-1-rare-reward-room.mjs'), 'v39.0.1 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-0-2-cursed-event-room.mjs'), 'v39.0.2 exact guard must be archived, not deleted');
assert.ok(!rootScriptFiles.some((name) => /^verify-v\d/.test(name) && name !== 'verify-v39-0-3-charger-enemy.mjs'), 'old exact-version checks must not remain in current scripts root');
assert.ok(!rootScriptFiles.includes('verify-upgrade-ui-layout.mjs'), 'old standalone historical UI check must be archived');

for (const [name, command] of Object.entries(scripts)) {
  const matches = [...command.matchAll(/node\s+(scripts\/[\w./-]+\.mjs)/g)];
  for (const match of matches) {
    assert.ok(exists(match[1]), `${name} references missing script file: ${match[1]}`);
    assert.ok(!match[1].startsWith('scripts/legacy/'), `${name} must not wire historical archive scripts directly: ${match[1]}`);
  }
}

for (const name of Object.keys(scripts)) {
  if (name === 'check:v39-0-3') continue;
  assert.ok(!/^check:v/.test(name), `old exact-version package script should be retired from current scripts: ${name}`);
}

assert.ok(!checkAll.includes('scripts/legacy/'), 'check:all must not call archived exact-version scripts directly');
assert.ok(!checkAll.includes('check:v38-14-6'), 'check:all must not keep previous exact-version guard');
assert.ok(!checkAll.includes('check:pre-content'), 'check:all must not keep retired pre-content audit after v39 content starts');
assert.ok(checkAll.trim().endsWith('npm run check:v39-0-3'), 'check:all should end with the current migration guard');

console.log(`test-suite wiring verification passed (${rootScriptFiles.length} current scripts, ${legacyScriptFiles.length} archived historical scripts)`);
