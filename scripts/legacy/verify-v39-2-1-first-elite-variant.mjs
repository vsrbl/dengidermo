import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION, BUILD_ID } from '../src/core/constants.js';
import { ELITE_VARIANT_SCHEMA_VERSION, ELITE_VARIANTS } from '../src/data/eliteVariants.js';
import { LOOP_ESCALATION_PROFILES } from '../src/data/loopScaling.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition } from '../src/game/roomFlow.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { finishEnemyKill } from '../src/game/enemyDeath.js';
import { loopEscalationProfileForState } from '../src/game/loopScaling.js';
import {
  canApplyEliteVariantToEnemy,
  eligibleEliteVariantsForEnemy,
  enemyEliteSnapshot,
  selectEliteVariantIdForEnemy
} from '../src/game/enemyElites.js';
import { DAMAGE_SOURCE_MATRIX, eliteDeathPulseDamageTags } from '../src/game/damageSourceMatrix.js';

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

assert.equal(VERSION, 'v39.2.1');
assert.equal(BUILD_ID, 'v39.2.1-20260523');

const pkg = readJson('package.json');
const serverPkg = readJson('server/package.json');
const srcPkg = readJson('src/package.json');
const release = readJson('release.json');
assert.equal(pkg.version, '39.2.1');
assert.equal(serverPkg.version, '39.2.1');
assert.equal(srcPkg.version, '39.2.1');
assert.equal(release.version, 'v39.2.1');
assert.equal(release.buildId, 'v39.2.1-20260523');
assert.equal(release.entry, './src/main.v39-2-1.js?v=39.2.1');
assert.ok(release.notes.includes('first elite variant vertical slice'), 'release notes should describe elite vertical slice');
assert.equal(pkg.scripts['check:v39-2-1'], 'node scripts/verify-v39-2-1-first-elite-variant.mjs');
assert.ok(pkg.scripts['check:all'].trim().endsWith('npm run check:v39-2-1'), 'check:all must end with current exact guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-2-0'), 'check:all must not keep previous exact guard');

assert.ok(exists('scripts/verify-v39-2-1-first-elite-variant.mjs'), 'current exact guard must live in scripts root');
assert.ok(!exists('scripts/verify-v39-2-0-loop-escalation-foundation.mjs'), 'previous exact guard must not remain in scripts root');
assert.ok(exists('scripts/legacy/verify-v39-2-0-loop-escalation-foundation.mjs'), 'previous exact guard must be archived');
const rootScriptFiles = fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.endsWith('.mjs'));
assert.ok(!rootScriptFiles.some((name) => /^verify-v\d/.test(name) && name !== 'verify-v39-2-1-first-elite-variant.mjs'), 'only current exact-version guard may live in scripts root');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-2-1.js?v=39.2.1'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.2.1 | BUILD 20260523'), 'HUD must expose current version/build');
assert.ok(exists('src/main.v39-2-1.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-2-0.js'), 'previous versioned entry must not ship');
assertByteIdentical('src/main.js', 'src/main.v39-2-1.js', 'versioned main entry must stay byte-identical with unversioned main');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-2-1.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-2-0.js`), `previous versioned app module should not ship: ${name}`);
  assertByteIdentical(`src/app/${name}.js`, `src/app/${name}.v39-2-1.js`, `versioned app module must stay byte-identical: ${name}`);
}

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.2.1"'), 'server version must match v39.2.1');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.2.1-20260523"'), 'server build must match v39.2.1 build');
assert.ok(server.includes('nncckkrr signaling v39.2.1 protocol'), 'server banner must use current version');

assert.equal(ELITE_VARIANT_SCHEMA_VERSION, 1, 'elite variant schema should be explicit');
assert.deepEqual(Object.keys(ELITE_VARIANTS), ['overcharged'], 'v39.2.1 should ship exactly one elite variant');
const overcharged = ELITE_VARIANTS.overcharged;
assert.equal(overcharged.id, 'overcharged');
assert.ok(overcharged.allowedKinds.includes('grunt'), 'overcharged should be allowed on normal enemies');
assert.ok(overcharged.excludedKinds.includes('boss'), 'boss elite exclusion should be data-driven');
assert.equal(overcharged.stats.speedMult, 1.12, 'first elite should be a small speed pressure slice');
assert.ok(overcharged.deathPulse.damage > 0, 'overcharged must have a real death pulse');
assert.ok(overcharged.deathPulse.radius > 0, 'overcharged death pulse needs a readable radius');
assert.equal(canApplyEliteVariantToEnemy(overcharged, 'grunt'), true, 'overcharged should apply to grunt');
assert.equal(canApplyEliteVariantToEnemy(overcharged, 'boss'), false, 'overcharged should not apply to boss');

const loop0 = LOOP_ESCALATION_PROFILES.find((profile) => profile.id === 'loop0_baseline');
const loop1 = LOOP_ESCALATION_PROFILES.find((profile) => profile.id === 'loop1_foundation');
const loop2 = LOOP_ESCALATION_PROFILES.find((profile) => profile.id === 'loop2_plus_foundation');
const reserved = LOOP_ESCALATION_PROFILES.find((profile) => profile.id === 'high_loop_escalation_reserved');
assert.equal(loop0.elite.chance, 0, 'loop 0 must remain elite-free');
assert.equal(loop1.elite.chance, 0, 'loop 1 must remain elite-free for the first vertical slice');
assert.equal(loop2.elite.chance, 0.06, 'loop 2+ should activate a low elite chance');
assert.deepEqual(loop2.elite.variantIds, ['overcharged'], 'loop 2+ should expose the first elite variant');
assert.equal(reserved.enabled, false, 'reserved high loop profile must remain disabled');
assert.ok(reserved.elite.variantIds.includes('overcharged'), 'reserved profile should document future elite reuse');
assert.deepEqual(eligibleEliteVariantsForEnemy('grunt', loop2).map((variant) => variant.id), ['overcharged'], 'loop 2 should resolve overcharged as eligible');
assert.deepEqual(eligibleEliteVariantsForEnemy('boss', loop2), [], 'boss should not resolve overcharged');

assert.deepEqual(eliteDeathPulseDamageTags('overcharged'), ['enemy', 'elite', 'pulse', 'overcharged'], 'elite pulse damage tags should be centralized');
assert.deepEqual(DAMAGE_SOURCE_MATRIX.eliteDeathPulse.tags, ['enemy', 'elite', 'pulse'], 'source matrix should document elite pulse damage');
assert.equal(DAMAGE_SOURCE_MATRIX.eliteDeathPulse.armor, false, 'elite pulse should never hit enemy armor');
assert.equal(DAMAGE_SOURCE_MATRIX.eliteDeathPulse.lifesteal, false, 'elite pulse should never lifesteal');

const eliteDataSrc = sourceWithoutComments('src/data/eliteVariants.js');
const eliteGameSrc = sourceWithoutComments('src/game/enemyElites.js');
const enemiesSrc = sourceWithoutComments('src/game/enemies.js');
const enemyDeathSrc = sourceWithoutComments('src/game/enemyDeath.js');
const stateSrc = sourceWithoutComments('src/game/state.js');
const rendererSrc = sourceWithoutComments('src/render/enemyRenderers.js');
const eliteRendererSrc = sourceWithoutComments('src/render/eliteRenderers.js');
assert.ok(eliteDataSrc.includes('ELITE_VARIANTS'), 'elite definitions must live in data');
assert.ok(eliteGameSrc.includes('selectEliteVariantIdForEnemy'), 'game elite module must own selection');
assert.ok(eliteGameSrc.includes('dealPlayerDamage'), 'elite death pulse must damage players through dealPlayerDamage');
assert.ok(eliteGameSrc.includes('pushVisualEffect'), 'elite visuals must use visual effect pipeline');
assert.ok(!/player\.hp\s*[-+]?=/.test(eliteGameSrc), 'enemyElites must not mutate player hp directly');
assert.ok(!/state\.effects\.push/.test(eliteGameSrc), 'enemyElites must not push effects directly');
assert.ok(enemiesSrc.includes('maybeApplyEliteVariantToEnemy'), 'spawnEnemy must apply elite variants through enemyElites boundary');
assert.ok(enemyDeathSrc.includes('runEnemyEliteDeath'), 'enemy kill finalizer must invoke elite death hook');
assert.ok(stateSrc.includes('enemyEliteSnapshot'), 'enemy snapshot should expose elite identity');
assert.ok(rendererSrc.includes('drawEnemyEliteOverlay'), 'enemy renderer registry should render elite overlay');
assert.ok(eliteRendererSrc.includes('ELITE_RENDERERS'), 'elite renderer should be registry-based');
assert.ok(!/kind\s*===\s*["']boss["']/.test(eliteGameSrc), 'enemyElites should use variant data, not boss special-cases');

const state = createGameState('ELITE-VERTICAL-SLICE');
addPlayer(state, 'p1', 0);
assert.equal(loopEscalationProfileForState(state).id, 'loop0_baseline', 'new run should start in loop 0');
assert.equal(selectEliteVariantIdForEnemy(state, 'grunt', loop0), null, 'loop 0 should not select elites');

for (let i = 0; i < 8; i += 1) beginRoomTransition(state, 'verify-elite-variant', { offerUpgrades: false });
assert.equal(state.runDepth, 8, 'test should reach loop 2 start');
assert.equal(loopEscalationProfileForState(state).id, 'loop2_plus_foundation', 'loop 2 should use loop2 foundation profile');
assert.equal(makeSnapshot(state).director.loop.elite.chance, 0.06, 'snapshot should expose active low elite chance');
assert.deepEqual(makeSnapshot(state).director.loop.elite.variantIds, ['overcharged'], 'snapshot should expose active elite variant ids');

const player = state.players.p1;
const elite = spawnEnemy(state, 'grunt', player.x + 8, player.y, { eliteVariantId: 'overcharged' });
assert.ok(elite?.elite, 'forced overcharged spawn should create elite metadata');
assert.equal(elite.elite.id, 'overcharged');
assert.equal(elite.speedMult, 1.12, 'elite speed multiplier should be applied at spawn');
assert.equal(enemyEliteSnapshot(elite).id, 'overcharged', 'elite snapshot helper should expose variant id');
let snap = makeSnapshot(state);
const snapEnemy = snap.enemies.find((enemy) => enemy.id === elite.id);
assert.equal(snapEnemy.elite.id, 'overcharged', 'network snapshot should carry elite id');
assert.equal(snapEnemy.elite.visual, 'inner_core', 'network snapshot should carry elite visual identity');

const hpBefore = player.hp;
finishEnemyKill(state, elite, { ownerId: 'p1', weaponId: 'test' }, { sourceId: 'p1' });
assert.ok(!state.enemies[elite.id], 'finishEnemyKill should remove elite enemy through finalizer');
assert.ok(player.hp < hpBefore, 'overcharged death pulse should damage nearby player');
assert.ok(state.effects.some((fx) => fx.type === 'elitePulse' && fx.eliteId === 'overcharged'), 'overcharged death should emit elitePulse visual effect');
assert.ok(state.events.some((event) => event.type === 'kill' && event.kind === 'grunt'), 'elite kill should preserve normal kill event');

const boss = spawnEnemy(state, 'boss', player.x + 260, player.y, { eliteVariantId: 'overcharged' });
assert.equal(boss.elite, undefined, 'boss must reject overcharged through data eligibility');

console.log('v39.2.1 first elite variant vertical slice checks passed');
