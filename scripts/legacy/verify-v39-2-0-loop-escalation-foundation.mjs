import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION, BUILD_ID } from '../src/core/constants.js';
import {
  LOOP_ESCALATION_FEATURES,
  LOOP_ESCALATION_PROFILES,
  LOOP_ESCALATION_SCHEMA_VERSION,
  DEFAULT_LOOP_ESCALATION_PROFILE
} from '../src/data/loopScaling.js';
import {
  applyLoopProfileToBatch,
  applyLoopProfileToBudget,
  applyLoopProfileToCap,
  applyLoopProfileToDirectorConfig,
  applyLoopProfileToIntensity,
  applyLoopProfileToInterval,
  loopEscalationProfileForLoop,
  loopEscalationProfileForState,
  loopEscalationSnapshot,
  loopEscalationSnapshotForState,
  resolveLoopEnemyPool
} from '../src/game/loopScaling.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation } from '../src/game/roomFlow.js';
import { resetDirectorState } from '../src/game/director.js';
import { directorSnapshot, getDirectorConfig, readDirectorEvaluation } from '../src/game/directorRead.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

function assertByteIdentical(a, b, message) {
  assert.equal(read(a), read(b), message || `${a} and ${b} must stay byte-identical`);
}

function sourceWithoutComments(rel) {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function assertIdentityDirector(profile) {
  assert.equal(profile.director.budgetMultiplier, 1, `${profile.id} budget multiplier must stay neutral in v39.2.0`);
  assert.equal(profile.director.capMultiplier, 1, `${profile.id} cap multiplier must stay neutral in v39.2.0`);
  assert.equal(profile.director.batchMultiplier, 1, `${profile.id} batch multiplier must stay neutral in v39.2.0`);
  assert.equal(profile.director.intervalMultiplier, 1, `${profile.id} interval multiplier must stay neutral in v39.2.0`);
  assert.equal(profile.director.intensityMultiplier, 1, `${profile.id} intensity multiplier must stay neutral in v39.2.0`);
  assert.equal(profile.enemyPool.tierBias, 0, `${profile.id} enemy tier bias must stay neutral in v39.2.0`);
  assert.deepEqual(profile.enemyPool.add, [], `${profile.id} must not add enemies in v39.2.0`);
  assert.deepEqual(profile.enemyPool.prefer, [], `${profile.id} must not prefer enemies in v39.2.0`);
  assert.deepEqual(profile.enemyPool.exclude, [], `${profile.id} must not exclude enemies in v39.2.0`);
  assert.equal(profile.elite.chance, 0, `${profile.id} elite chance must stay neutral in v39.2.0`);
  assert.equal(profile.armor.variantChance, 0, `${profile.id} armor variant chance must stay neutral in v39.2.0`);
  assert.equal(profile.modifiers.stackChance, 0, `${profile.id} modifier stacking must stay neutral in v39.2.0`);
}

assert.equal(VERSION, 'v39.2.0');
assert.equal(BUILD_ID, 'v39.2.0-20260523');

const pkg = readJson('package.json');
const serverPkg = readJson('server/package.json');
const srcPkg = readJson('src/package.json');
const release = readJson('release.json');
assert.equal(pkg.version, '39.2.0');
assert.equal(serverPkg.version, '39.2.0');
assert.equal(srcPkg.version, '39.2.0');
assert.equal(release.version, 'v39.2.0');
assert.equal(release.buildId, 'v39.2.0-20260523');
assert.equal(release.entry, './src/main.v39-2-0.js?v=39.2.0');
assert.equal(release.notes, 'v39.2.0 loop escalation foundation: data-driven loop profiles, neutral runtime multipliers, director/snapshot integration, and guards for future elite/armor/modifier escalation; no balance/content changes');
assert.equal(pkg.scripts['check:v39-2-0'], 'node scripts/verify-v39-2-0-loop-escalation-foundation.mjs');
assert.ok(pkg.scripts['check:all'].trim().endsWith('npm run check:v39-2-0'), 'check:all must end with current exact guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-1-3'), 'check:all must not keep previous exact guard');

assert.ok(exists('scripts/verify-v39-2-0-loop-escalation-foundation.mjs'), 'current exact guard must live in scripts root');
assert.ok(!exists('scripts/verify-v39-1-3-projectile-effect-source-matrix.mjs'), 'previous exact guard must not remain in scripts root');
assert.ok(exists('scripts/legacy/verify-v39-1-3-projectile-effect-source-matrix.mjs'), 'previous exact guard must be archived');
const rootScriptFiles = fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.endsWith('.mjs'));
assert.ok(!rootScriptFiles.some((name) => /^verify-v\d/.test(name) && name !== 'verify-v39-2-0-loop-escalation-foundation.mjs'), 'only current exact-version guard may live in scripts root');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-2-0.js?v=39.2.0'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.2.0 | BUILD 20260523'), 'HUD must expose current version/build');
assert.ok(exists('src/main.v39-2-0.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-1-3.js'), 'previous versioned entry must not ship');
assertByteIdentical('src/main.js', 'src/main.v39-2-0.js', 'versioned main entry must stay byte-identical with unversioned main');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-2-0.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-1-3.js`), `previous versioned app module should not ship: ${name}`);
  assertByteIdentical(`src/app/${name}.js`, `src/app/${name}.v39-2-0.js`, `versioned app module must stay byte-identical: ${name}`);
}

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.2.0"'), 'server version must match v39.2.0');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.2.0-20260523"'), 'server build must match v39.2.0 build');
assert.ok(server.includes('nncckkrr signaling v39.2.0 protocol'), 'server banner must use current version');

assert.equal(LOOP_ESCALATION_SCHEMA_VERSION, 1, 'loop escalation schema should be explicit');
assert.equal(DEFAULT_LOOP_ESCALATION_PROFILE.id, 'loop0_baseline', 'loop 0 baseline must be default');
assert.deepEqual(Object.keys(LOOP_ESCALATION_FEATURES).sort(), ['ARMOR_VARIANTS', 'DIRECTOR_PRESSURE', 'ELITE_VARIANTS', 'ENEMY_POOL_BIAS', 'MODIFIER_STACKING'].sort(), 'loop feature registry drifted');
assert.deepEqual(LOOP_ESCALATION_PROFILES.map((profile) => profile.id), ['loop0_baseline', 'loop1_foundation', 'loop2_plus_foundation', 'high_loop_escalation_reserved'], 'loop profiles should stay small and explicit in v39.2.0');
assert.equal(loopEscalationProfileForLoop(0).id, 'loop0_baseline', 'loop 0 should resolve baseline profile');
assert.equal(loopEscalationProfileForLoop(1).id, 'loop1_foundation', 'loop 1 should resolve foundation profile');
assert.equal(loopEscalationProfileForLoop(2).id, 'loop2_plus_foundation', 'loop 2+ should resolve neutral foundation profile');
assert.equal(loopEscalationProfileForLoop(9).id, 'loop2_plus_foundation', 'disabled high-loop reserved profile must not activate');
assert.equal(LOOP_ESCALATION_PROFILES.find((profile) => profile.id === 'high_loop_escalation_reserved')?.enabled, false, 'high-loop reserved profile must stay disabled until tuning/content pass');

for (const profile of LOOP_ESCALATION_PROFILES.filter((candidate) => candidate.enabled !== false)) {
  assertIdentityDirector(profile);
}

const reserved = LOOP_ESCALATION_PROFILES.find((profile) => profile.id === 'high_loop_escalation_reserved');
assert.ok(reserved.director.budgetMultiplier > 1, 'reserved profile should document future director pressure');
assert.ok(reserved.features.includes(LOOP_ESCALATION_FEATURES.ELITE_VARIANTS), 'reserved profile should document future elite variant slot');
assert.ok(reserved.features.includes(LOOP_ESCALATION_FEATURES.ARMOR_VARIANTS), 'reserved profile should document future armor variant slot');
assert.ok(reserved.features.includes(LOOP_ESCALATION_FEATURES.MODIFIER_STACKING), 'reserved profile should document future modifier stacking slot');

const loop1 = loopEscalationProfileForLoop(1);
const cfg = applyLoopProfileToDirectorConfig({ budgetBase: 10 }, loop1);
assert.equal(cfg.loopProfileId, 'loop1_foundation', 'director config should carry loop profile id');
assert.equal(applyLoopProfileToBudget(10, loop1), 10, 'active loop profile must not change budget in v39.2.0');
assert.equal(applyLoopProfileToCap(10, loop1), 10, 'active loop profile must not change cap in v39.2.0');
assert.equal(applyLoopProfileToBatch(2, loop1), 2, 'active loop profile must not change batch in v39.2.0');
assert.equal(applyLoopProfileToInterval(1.4, loop1), 1.4, 'active loop profile must not change interval in v39.2.0');
assert.equal(applyLoopProfileToIntensity(0.7, loop1), 0.7, 'active loop profile must not change intensity in v39.2.0');
assert.deepEqual(resolveLoopEnemyPool(['grunt', 'runner', 'tank'], loop1), ['grunt', 'runner', 'tank'], 'active loop profile must not alter enemy pool in v39.2.0');
assert.equal(loopEscalationSnapshot(loop1).id, 'loop1_foundation', 'snapshot should expose loop profile id');

const dataSrc = sourceWithoutComments('src/data/loopScaling.js');
const gameSrc = sourceWithoutComments('src/game/loopScaling.js');
const directorSrc = sourceWithoutComments('src/game/director.js');
const directorReadSrc = sourceWithoutComments('src/game/directorRead.js');
const stateSrc = sourceWithoutComments('src/game/state.js');
assert.ok(dataSrc.includes('LOOP_ESCALATION_PROFILES'), 'loop escalation profiles must live in data');
assert.ok(gameSrc.includes('applyLoopProfileToDirectorConfig'), 'game loop scaling module must expose director config application');
assert.ok(gameSrc.includes('resolveLoopEnemyPool'), 'game loop scaling module must expose enemy pool resolver');
assert.ok(directorSrc.includes('applyLoopProfileToBatch'), 'director batch path must pass through loop profile boundary');
assert.ok(directorSrc.includes('applyLoopProfileToInterval'), 'director interval path must pass through loop profile boundary');
assert.ok(directorSrc.includes('resolveLoopEnemyPool'), 'director enemy pool path must pass through loop profile boundary');
assert.ok(directorReadSrc.includes('applyLoopProfileToBudget'), 'budget path must pass through loop profile boundary');
assert.ok(directorReadSrc.includes('applyLoopProfileToCap'), 'cap path must pass through loop profile boundary');
assert.ok(directorReadSrc.includes('applyLoopProfileToIntensity'), 'intensity path must pass through loop profile boundary');
assert.ok(directorReadSrc.includes('loopEscalationSnapshotForState'), 'director snapshot must expose loop profile');
assert.ok(!/room\.id\s*===/.test(gameSrc), 'loop scaling must not special-case room ids');
assert.ok(!/modifierId\s*===/.test(gameSrc), 'loop scaling must not special-case modifier ids');
assert.ok(!/kind\s*===\s*["']tank["']|kind\s*===\s*["']boss["']/.test(gameSrc), 'loop scaling must not special-case tank/boss');
assert.ok(!stateSrc.includes('high_loop_escalation_reserved'), 'state should not hardcode loop profile ids');

const state = createGameState('LOOP-FOUNDATION');
addPlayer(state, 'p1', 0);
assert.equal(loopEscalationProfileForState(state).id, 'loop0_baseline', 'new run should start on loop baseline');
let snap = makeSnapshot(state);
assert.equal(snap.director.loop.id, 'loop0_baseline', 'snapshot should expose baseline loop profile');
assert.equal(snap.director.loop.director.budgetMultiplier, 1, 'baseline snapshot must be neutral');

for (let i = 0; i < 4; i += 1) beginRoomTransition(state, 'verify-loop-foundation', { offerUpgrades: false });
assert.equal(state.runDepth, 4, 'test should reach first room after first boss');
assert.equal(currentLocation(state).id, 'reward-cache-00', 'rare reward route should remain unchanged');
assert.equal(loopEscalationProfileForState(state).id, 'loop1_foundation', 'loop 1 should resolve foundation profile');
const loc = currentLocation(state);
const locCfg = getDirectorConfig(loc);
assert.equal(locCfg.loopProfileId, 'loop1_foundation', 'location director config should carry loop profile id');
const director = resetDirectorState(state, loc);
assert.equal(director.loopProfileId, 'loop1_foundation', 'director runtime should store loop profile id');
const evaluation = readDirectorEvaluation(state, loc, director);
assert.equal(evaluation.policy.canSpawn, false, 'reward room spawn policy should remain unchanged by loop foundation');
snap = makeSnapshot(state);
assert.equal(snap.location.resolvedRoomId, 'reward-cache-00', 'loop foundation must not disturb rare room identity');
assert.equal(snap.director.loop.id, 'loop1_foundation', 'director snapshot should expose loop 1 foundation profile');
assert.equal(snap.director.loop.elite.chance, 0, 'foundation profile must not activate elite variants');

for (let i = 0; i < 4; i += 1) beginRoomTransition(state, 'verify-loop-foundation', { offerUpgrades: false });
assert.equal(state.runDepth, 8, 'test should reach loop 2 start');
assert.equal(currentLocation(state).id, 'grid-00', 'loop 2 route should return to grid');
assert.equal(loopEscalationProfileForState(state).id, 'loop2_plus_foundation', 'loop 2 should expose foundation profile');
assert.equal(directorSnapshot(state).loop.id, 'loop2_plus_foundation', 'director snapshot should expose loop 2 profile');
assert.equal(directorSnapshot(state).loop.modifiers.stackChance, 0, 'loop 2 foundation must not stack modifiers yet');

console.log('v39.2.0 loop escalation foundation checks passed');
