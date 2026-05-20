import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { BUILD_ID, VERSION } from '../../src/core/constants.js';

assert.equal(VERSION, 'v38.14.3');
assert.equal(BUILD_ID, 'v38.14.3-20260520');

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const scripts = pkg.scripts || {};
assert.ok(scripts['check:deploy'], 'package scripts must expose check:deploy');
assert.ok(scripts['check:pre-content'], 'package scripts must expose check:pre-content');
assert.ok(scripts['check:v38-14-3'], 'package scripts must expose exact v38.14.3 guard');
const checkAll = scripts['check:all'] || '';
for (const name of ['check:release', 'check:deploy', 'check:pre-content', 'check:v38-14', 'check:v38-14-3']) {
  assert.ok(checkAll.includes(name), `check:all must include ${name}`);
}
assert.ok(!checkAll.includes('check:v38-14-2'), 'check:all must not keep stale exact v38.14.2 guard');
assert.ok(!scripts['check:v38-14-2'], 'package scripts should not expose stale exact v38.14.2 guard');
assert.ok(!fs.existsSync(new URL('./verify-v38-14-2-architecture-hardening-cleanup.mjs', import.meta.url)), 'stale exact v38.14.2 verify script should not ship');

execFileSync(process.execPath, ['scripts/verify-deploy-sanity.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/verify-pre-content-audit.mjs'], { stdio: 'inherit' });

console.log('v38.14.3 release/deploy sanity + pre-content audit checks passed');
