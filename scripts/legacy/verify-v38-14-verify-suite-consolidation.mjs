import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BUILD_ID, VERSION } from '../../src/core/constants.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
assert.ok(/^v38\.14(?:\.\d+)?$/.test(VERSION), 'VERSION must remain in v38.14 consolidation family');
assert.ok(BUILD_ID.startsWith(`${VERSION}-`), 'BUILD_ID must be tied to VERSION');
assert.equal(pkg.version, VERSION.replace(/^v/, ''), 'package version must match VERSION');

const scripts = pkg.scripts || {};
for (const name of [
  'check:syntax',
  'check:modules',
  'check:release',
  'check:network',
  'check:roomflow',
  'check:director',
  'check:effects',
  'check:geometry',
  'check:room-identity',
  'check:ui',
  'check:architecture',
  'check:legacy-critical',
  'check:v38-14'
]) {
  assert.ok(scripts[name], `missing ${name}`);
}
const checkAll = scripts['check:all'] || '';
assert.ok(checkAll.includes('check:syntax'), 'check:all must start with syntax/module integrity tier');
assert.ok(checkAll.includes('check:v38-14'), 'check:all must include a v38.14-family suite guard');
assert.ok(checkAll.includes('check:legacy-critical'), 'check:all should keep critical legacy regression coverage');
assert.ok(!checkAll.includes('check:v38-13-8'), 'check:all should no longer be a full version-specific chain');
assert.ok(!checkAll.includes('check:v38-8-1'), 'check:all should not run old version regex checks directly');

const release = readFileSync(new URL('../verify-release-integrity.mjs', import.meta.url), 'utf8');
assert.ok(release.includes('src/app/releaseIntegrity.v${entrySuffix}.js'), 'release check should resolve current version dynamically');
const moduleCheck = readFileSync(new URL('../verify-module-exports.mjs', import.meta.url), 'utf8');
assert.ok(moduleCheck.includes('export'), 'module export verifier must remain present');

console.log('v38.14 verify suite consolidation checks passed');
