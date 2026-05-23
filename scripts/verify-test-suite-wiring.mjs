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
  'check:game-architecture',
  'check:content-foundation',
  'check:content-registries',
  'check:modifier-contracts',
  'check:runtime-scenarios',
  'check:legacy-critical',
  'check:test-suite'
];

for (const name of mandatoryScripts) {
  assert.ok(scripts[name], `package.json must define ${name}`);
  assert.ok(checkAll.includes(`npm run ${name}`), `check:all must run ${name}`);
}

const universalVerifierFiles = [
  'scripts/verify-game-architecture.mjs',
  'scripts/verify-content-registries.mjs',
  'scripts/verify-modifier-contracts.mjs',
  'scripts/verify-runtime-scenarios.mjs'
];
for (const rel of universalVerifierFiles) assert.ok(exists(rel), `universal verifier missing: ${rel}`);

const criticalLegacy = ['check:dev', 'check:matrix', 'check:feel', 'check:shake', 'check:hooks'];
for (const name of criticalLegacy) {
  assert.ok(scripts[name], `critical legacy package script must remain: ${name}`);
  assert.ok((scripts['check:legacy-critical'] || '').includes(`npm run ${name}`), `check:legacy-critical must include ${name}`);
}

const rootScriptFiles = fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.endsWith('.mjs')).sort();
const legacyScriptFiles = fs.readdirSync(path.join(root, 'scripts', 'legacy')).filter((name) => name.endsWith('.mjs')).sort();

assert.ok(rootScriptFiles.includes('verify-test-suite-wiring.mjs'), 'wiring check must live in current scripts root');
for (const file of universalVerifierFiles.map((rel) => path.basename(rel))) {
  assert.ok(rootScriptFiles.includes(file), `universal verifier must live in current scripts root: ${file}`);
}
assert.ok(legacyScriptFiles.length >= 31, 'historical exact-version checks must be retained in scripts/legacy');
assert.ok(legacyScriptFiles.includes('verify-v38-14-4-roomplan-geometry-source.mjs'), 'previous exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v38-14-5-scripts-suite-slimming.mjs'), 'v38.14.5 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v38-14-6-signaling-disconnect.mjs'), 'v38.14.6 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-0-1-rare-reward-room.mjs'), 'v39.0.1 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-0-2-cursed-event-room.mjs'), 'v39.0.2 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-0-4-bomber-enemy-and-visual-pass.mjs'), 'v39.0.4 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-0-5-enemy-readability-and-bomber-visibility.mjs'), 'v39.0.5 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-0-6-shooter-ranged-attack.mjs'), 'v39.0.6 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-0-7-enemy-armor-system.mjs'), 'v39.0.7 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-0-8-architecture-hardening.mjs'), 'v39.0.8 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-1-0-architecture-split.mjs'), 'v39.1.0 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-1-1-architecture-hardening-after-split.mjs'), 'v39.1.1 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-1-2-projectile-pipeline-split.mjs'), 'v39.1.2 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-1-3-projectile-effect-source-matrix.mjs'), 'v39.1.3 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-2-0-loop-escalation-foundation.mjs'), 'v39.2.0 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-2-1-first-elite-variant.mjs'), 'v39.2.1 exact guard must be archived, not deleted');
assert.ok(legacyScriptFiles.includes('verify-v39-2-2-linked-armor-variant.mjs'), 'v39.2.2 exact guard must be archived after v39.2.3 universal verifier migration');
assert.ok(!rootScriptFiles.some((name) => /^verify-v\d/.test(name)), 'current scripts root must not contain exact-version guards after v39.2.3');
assert.ok(!rootScriptFiles.includes('verify-upgrade-ui-layout.mjs'), 'old standalone historical UI check must be archived');

for (const [name, command] of Object.entries(scripts)) {
  const matches = [...command.matchAll(/node\s+(scripts\/[\w./-]+\.mjs)/g)];
  for (const match of matches) {
    assert.ok(exists(match[1]), `${name} references missing script file: ${match[1]}`);
    assert.ok(!match[1].startsWith('scripts/legacy/'), `${name} must not wire historical archive scripts directly: ${match[1]}`);
  }
}

for (const name of Object.keys(scripts)) {
  assert.ok(!/^check:v/.test(name), `exact-version package script should be retired from current scripts: ${name}`);
}

assert.ok(!checkAll.includes('scripts/legacy/'), 'check:all must not call archived exact-version scripts directly');
assert.ok(!checkAll.includes('check:v39-2-2'), 'check:all must not keep previous exact-version guard');
assert.ok(!checkAll.includes('check:v39-2-3'), 'check:all must not introduce a new exact-version guard');
assert.ok(!checkAll.includes('check:pre-content'), 'check:all must not keep retired pre-content audit after v39 content starts');
assert.ok(checkAll.trim().endsWith('npm run check:test-suite'), 'check:all should end with the universal wiring guard');

console.log(`test-suite wiring verification passed (${rootScriptFiles.length} current scripts, ${legacyScriptFiles.length} archived historical scripts, exact guards retired)`);
