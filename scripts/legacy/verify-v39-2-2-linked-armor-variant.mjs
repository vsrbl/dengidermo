import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION, BUILD_ID } from '../src/core/constants.js';
import { ARMOR_VARIANT_SCHEMA_VERSION, ARMOR_VARIANTS } from '../src/data/armorVariants.js';
import { ELITE_VARIANTS } from '../src/data/eliteVariants.js';
import { LOOP_ESCALATION_PROFILES } from '../src/data/loopScaling.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition } from '../src/game/roomFlow.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { finishEnemyKill } from '../src/game/enemyDeath.js';
import { dealDamage } from '../src/game/effects.js';
import { projectileDamageTags, PROJECTILE_DAMAGE_SOURCES } from '../src/game/damageSourceMatrix.js';
import { loopEscalationProfileForState } from '../src/game/loopScaling.js';
import {
  armorVariantById,
  canApplyArmorVariantToEnemy,
  eligibleArmorVariantsForEnemy,
  updateEnemyArmorVariantRuntime
} from '../src/game/enemyArmorVariants.js';

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

assert.equal(VERSION, 'v39.2.2');
assert.equal(BUILD_ID, 'v39.2.2-20260523');

const pkg = readJson('package.json');
const serverPkg = readJson('server/package.json');
const srcPkg = readJson('src/package.json');
const release = readJson('release.json');
assert.equal(pkg.version, '39.2.2');
assert.equal(serverPkg.version, '39.2.2');
assert.equal(srcPkg.version, '39.2.2');
assert.equal(release.version, 'v39.2.2');
assert.equal(release.buildId, 'v39.2.2-20260523');
assert.equal(release.entry, './src/main.v39-2-2.js?v=39.2.2');
assert.ok(release.notes.includes('linked armor'), 'release notes should describe linked armor vertical slice');
assert.equal(pkg.scripts['check:v39-2-2'], 'node scripts/verify-v39-2-2-linked-armor-variant.mjs');
assert.ok(pkg.scripts['check:all'].trim().endsWith('npm run check:v39-2-2'), 'check:all must end with current exact guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-2-1'), 'check:all must not keep previous exact guard');

assert.ok(exists('scripts/verify-v39-2-2-linked-armor-variant.mjs'), 'current exact guard must live in scripts root');
assert.ok(!exists('scripts/verify-v39-2-1-first-elite-variant.mjs'), 'previous exact guard must not remain in scripts root');
assert.ok(exists('scripts/legacy/verify-v39-2-1-first-elite-variant.mjs'), 'previous exact guard must be archived');
const rootScriptFiles = fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.endsWith('.mjs'));
assert.ok(!rootScriptFiles.some((name) => /^verify-v\d/.test(name) && name !== 'verify-v39-2-2-linked-armor-variant.mjs'), 'only current exact-version guard may live in scripts root');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-2-2.js?v=39.2.2'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.2.2 | BUILD 20260523'), 'HUD must expose current version/build');
assert.ok(exists('src/main.v39-2-2.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-2-1.js'), 'previous versioned entry must not ship');
assertByteIdentical('src/main.js', 'src/main.v39-2-2.js', 'versioned main entry must stay byte-identical with unversioned main');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-2-2.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-2-1.js`), `previous versioned app module should not ship: ${name}`);
  assertByteIdentical(`src/app/${name}.js`, `src/app/${name}.v39-2-2.js`, `versioned app module must stay byte-identical: ${name}`);
}

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.2.2"'), 'server version must match v39.2.2');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.2.2-20260523"'), 'server build must match v39.2.2 build');
assert.ok(server.includes('nncckkrr signaling v39.2.2 protocol'), 'server banner must use current version');

assert.equal(ARMOR_VARIANT_SCHEMA_VERSION, 1, 'armor variant schema should be explicit');
assert.deepEqual(Object.keys(ARMOR_VARIANTS), ['linked'], 'v39.2.2 should ship exactly one armor variant');
assert.deepEqual(Object.keys(ELITE_VARIANTS), ['overcharged'], 'v39.2.2 should preserve exactly one elite variant');
const linked = ARMOR_VARIANTS.linked;
assert.equal(linked.id, 'linked');
assert.equal(linked.requiresArmor, true, 'linked armor must require existing armor');
assert.ok(linked.allowedKinds.includes('tank'), 'linked armor should be allowed on tank for first slice');
assert.ok(linked.excludedKinds.includes('boss'), 'boss exclusion should be data-driven');
assert.ok(linked.link.radius > 0, 'linked armor needs acquisition radius');
assert.ok(linked.link.maxLinks > 0, 'linked armor needs at least one link');
assert.ok(linked.link.guardedFloorRatio > 0 && linked.link.guardedFloorRatio < 1, 'linked armor should guard a break floor, not add hp');
assert.equal(armorVariantById('linked').id, 'linked', 'armor variant lookup should resolve linked');
assert.equal(canApplyArmorVariantToEnemy(linked, 'tank'), true, 'linked should apply to tank');
assert.equal(canApplyArmorVariantToEnemy(linked, 'boss'), false, 'linked should not apply to boss');
assert.equal(canApplyArmorVariantToEnemy(linked, 'grunt'), false, 'linked should not apply to unarmored enemies');

const loop0 = LOOP_ESCALATION_PROFILES.find((profile) => profile.id === 'loop0_baseline');
const loop1 = LOOP_ESCALATION_PROFILES.find((profile) => profile.id === 'loop1_foundation');
const loop2 = LOOP_ESCALATION_PROFILES.find((profile) => profile.id === 'loop2_plus_foundation');
const reserved = LOOP_ESCALATION_PROFILES.find((profile) => profile.id === 'high_loop_escalation_reserved');
assert.equal(loop0.armor.variantChance, 0, 'loop 0 must remain armor-variant-free');
assert.equal(loop1.armor.variantChance, 0, 'loop 1 must remain armor-variant-free for first slice');
assert.equal(loop2.armor.variantChance, 0.04, 'loop 2+ should activate a low linked armor chance');
assert.deepEqual(loop2.armor.variantIds, ['linked'], 'loop 2+ should expose linked armor variant');
assert.ok(reserved.armor.variantIds.includes('linked'), 'reserved high loop profile should document future linked armor reuse');
assert.deepEqual(eligibleArmorVariantsForEnemy('tank', loop2).map((variant) => variant.id), ['linked'], 'loop 2 should resolve linked for tank');
assert.deepEqual(eligibleArmorVariantsForEnemy('boss', loop2), [], 'boss should not resolve linked armor');
assert.deepEqual(eligibleArmorVariantsForEnemy('grunt', loop2), [], 'unarmored grunt should not resolve armor variants');

const armorDataSrc = sourceWithoutComments('src/data/armorVariants.js');
const armorGameSrc = sourceWithoutComments('src/game/enemyArmorVariants.js');
const enemyArmorSrc = sourceWithoutComments('src/game/enemyArmor.js');
const enemiesSrc = sourceWithoutComments('src/game/enemies.js');
const stateSrc = sourceWithoutComments('src/game/state.js');
const rendererSrc = sourceWithoutComments('src/render/enemyRenderers.js');
const armorRendererSrc = sourceWithoutComments('src/render/armorVariantRenderers.js');
assert.ok(armorDataSrc.includes('ARMOR_VARIANTS'), 'armor variant definitions must live in data');
assert.ok(armorGameSrc.includes('selectArmorVariantIdForEnemy'), 'game armor variant module must own selection');
assert.ok(armorGameSrc.includes('updateEnemyArmorVariantRuntime'), 'game armor variant module must own link runtime');
assert.ok(armorGameSrc.includes('pushVisualEffect'), 'armor link block visuals must use visual effect pipeline');
assert.ok(!/player\.hp\s*[-+]?=/.test(armorGameSrc), 'enemyArmorVariants must not mutate player hp directly');
assert.ok(!/enemy\.hp\s*[-+]?=/.test(armorGameSrc), 'enemyArmorVariants must not mutate enemy hp directly');
assert.ok(!/state\.effects\.push/.test(armorGameSrc), 'enemyArmorVariants must not push effects directly');
assert.ok(enemyArmorSrc.includes('applyArmorVariantDamageRules'), 'armor damage pipeline must call armor variant rules');
assert.ok(enemiesSrc.includes('maybeApplyArmorVariantToEnemy'), 'spawnEnemy must apply armor variants through enemyArmorVariants boundary');
assert.ok(enemiesSrc.includes('updateEnemyArmorVariantRuntime'), 'enemy update must tick armor variant runtime');
assert.ok(stateSrc.includes('armorSnapshot'), 'enemy snapshot should continue exposing armor identity');
assert.ok(rendererSrc.includes('drawEnemyArmorVariantOverlay'), 'enemy renderer should render armor variant overlay');
assert.ok(armorRendererSrc.includes('ARMOR_VARIANT_RENDERERS'), 'armor variant renderer should be registry-based');
assert.ok(armorRendererSrc.includes('drawEnemyArmorVariantLinks'), 'renderer should expose linked armor tethers');
assert.ok(!/kind\s*===\s*["']tank["']/.test(armorGameSrc), 'enemyArmorVariants should use data, not tank special-cases');
assert.ok(!/kind\s*===\s*["']boss["']/.test(armorGameSrc), 'enemyArmorVariants should use data, not boss special-cases');

const state = createGameState('LINKED-ARMOR-VERTICAL-SLICE');
addPlayer(state, 'p1', 0);
for (let i = 0; i < 8; i += 1) beginRoomTransition(state, 'verify-linked-armor', { offerUpgrades: false });
assert.equal(state.runDepth, 8, 'test should reach loop 2 start');
assert.equal(loopEscalationProfileForState(state).id, 'loop2_plus_foundation', 'loop 2 should use loop2 foundation profile');
assert.equal(makeSnapshot(state).director.loop.armor.variantChance, 0.04, 'snapshot should expose active low armor variant chance');
assert.deepEqual(makeSnapshot(state).director.loop.armor.variantIds, ['linked'], 'snapshot should expose active armor variant ids');

const player = state.players.p1;
const linkA = spawnEnemy(state, 'grunt', player.x + 100, player.y, { eliteVariantId: null });
const linkB = spawnEnemy(state, 'runner', player.x + 135, player.y + 20, { eliteVariantId: null });
const tank = spawnEnemy(state, 'tank', player.x + 130, player.y, { armorVariantId: 'linked' });
assert.ok(tank?.armor?.variant, 'forced linked tank should create armor variant metadata');
assert.equal(tank.armor.variant.id, 'linked');
updateEnemyArmorVariantRuntime(state, tank, 999);
assert.equal(tank.armor.variant.protected, true, 'linked tank should become protected when link targets are alive nearby');
assert.equal(tank.armor.variant.links.length, 2, 'linked tank should acquire two nearby link targets');
assert.ok(tank.armor.variant.links.some((link) => link.id === linkA.id), 'linked tank should tether to first nearby target');
assert.ok(tank.armor.variant.links.some((link) => link.id === linkB.id), 'linked tank should tether to second nearby target');

let snap = makeSnapshot(state);
const snapTank = snap.enemies.find((enemy) => enemy.id === tank.id);
assert.equal(snapTank.armor.variant.id, 'linked', 'network snapshot should carry armor variant id');
assert.equal(snapTank.armor.variant.protected, true, 'network snapshot should carry protected state');
assert.equal(snapTank.armor.variant.links.length, 2, 'network snapshot should carry link target positions');
assert.equal(snap.director.loop.armor.variantIds[0], 'linked', 'director snapshot should retain linked armor profile');

const armorBefore = tank.armor.hp;
const guardedHit = dealDamage(state, tank, {
  amount: 999,
  sourceId: 'p1',
  weaponId: 'test',
  tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT)
});
assert.equal(guardedHit.armorHit, true, 'projectile damage should still hit armor');
assert.equal(guardedHit.armorVariantBlocked, true, 'linked armor should block full break while links are alive');
assert.equal(tank.armor.broken, false, 'linked armor should not break while protected by links');
assert.ok(tank.armor.hp > 0 && tank.armor.hp < armorBefore, 'linked armor should still take partial armor damage down to a floor');
assert.ok(state.effects.some((fx) => fx.type === 'armorLinkBlock' && fx.armorVariantId === 'linked'), 'linked armor block should emit visual feedback');

finishEnemyKill(state, linkA, { ownerId: 'p1', weaponId: 'test' }, { sourceId: 'p1' });
finishEnemyKill(state, linkB, { ownerId: 'p1', weaponId: 'test' }, { sourceId: 'p1' });
updateEnemyArmorVariantRuntime(state, tank, 999);
assert.equal(tank.armor.variant.protected, false, 'linked armor should lose protection after linked targets die');
assert.equal(tank.armor.variant.links.length, 0, 'dead link targets should be cleared');
const breakHit = dealDamage(state, tank, {
  amount: 999,
  sourceId: 'p1',
  weaponId: 'test',
  tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT)
});
assert.equal(breakHit.armorHit, true, 'second projectile damage should still go through armor pipeline');
assert.equal(breakHit.armorBroken, true, 'linked armor should break normally after links are gone');
assert.equal(tank.armor.broken, true, 'tank armor should be marked broken after unprotected break');

const boss = spawnEnemy(state, 'boss', player.x + 260, player.y, { armorVariantId: 'linked' });
assert.equal(boss.armor?.variant, undefined, 'boss must reject linked armor through data eligibility');
const grunt = spawnEnemy(state, 'grunt', player.x + 300, player.y, { armorVariantId: 'linked' });
assert.equal(grunt.armor?.variant, undefined, 'unarmored enemies must reject armor variants');

console.log('v39.2.2 linked armor variant vertical slice checks passed');
