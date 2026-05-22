import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION, BUILD_ID } from '../src/core/constants.js';
import { DAMAGE_TAGS, dealDamage } from '../src/game/effects.js';
import { createGameState, addPlayer } from '../src/game/state.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { makeProjectile, updateProjectiles } from '../src/game/projectiles.js';
import { dealProjectileDamage } from '../src/game/projectileHits.js';
import {
  DAMAGE_SOURCE_MATRIX,
  PROJECTILE_DAMAGE_SOURCES,
  canDamageSourceHitArmor,
  canDamageSourceLifesteal,
  companionDamageTags,
  hostileProjectileDamageTags,
  projectileDamageTags,
  statusDamageTags
} from '../src/game/damageSourceMatrix.js';

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

function assertNoDirectMutation(src, rel) {
  assert.ok(!/\bplayer\.hp\s*(?:[+\-*/]?=|\+\+|--)/.test(src), `${rel} must not mutate player.hp directly`);
  assert.ok(!/\benemy\.hp\s*(?:[+\-*/]?=|\+\+|--)/.test(src), `${rel} must not mutate enemy.hp directly`);
  assert.ok(!/\bstate\.effects\.push\s*\(/.test(src), `${rel} must not push visual effects directly`);
}

assert.equal(VERSION, 'v39.1.3');
assert.equal(BUILD_ID, 'v39.1.3-20260521');

const pkg = readJson('package.json');
const serverPkg = readJson('server/package.json');
const srcPkg = readJson('src/package.json');
const release = readJson('release.json');
assert.equal(pkg.version, '39.1.3');
assert.equal(serverPkg.version, '39.1.3');
assert.equal(srcPkg.version, '39.1.3');
assert.equal(release.version, 'v39.1.3');
assert.equal(release.buildId, 'v39.1.3-20260521');
assert.equal(release.entry, './src/main.v39-1-3.js?v=39.1.3');
assert.equal(release.notes, 'v39.1.3 projectile/effect source matrix hardening: centralized damage source tags for projectile, status, companion, armor, and lifesteal paths; no gameplay balance/content changes');
assert.equal(pkg.scripts['check:v39-1-3'], 'node scripts/verify-v39-1-3-projectile-effect-source-matrix.mjs');
assert.ok(pkg.scripts['check:all'].trim().endsWith('npm run check:v39-1-3'), 'check:all must end with current exact guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-1-2'), 'check:all must not keep previous exact guard');

assert.ok(exists('scripts/verify-v39-1-3-projectile-effect-source-matrix.mjs'), 'current exact guard must live in scripts root');
assert.ok(!exists('scripts/verify-v39-1-2-projectile-pipeline-split.mjs'), 'previous exact guard must not remain in scripts root');
assert.ok(exists('scripts/legacy/verify-v39-1-2-projectile-pipeline-split.mjs'), 'previous exact guard must be archived');
const rootScriptFiles = fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.endsWith('.mjs'));
assert.ok(!rootScriptFiles.some((name) => /^verify-v\d/.test(name) && name !== 'verify-v39-1-3-projectile-effect-source-matrix.mjs'), 'only current exact-version guard may live in scripts root');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-1-3.js?v=39.1.3'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.1.3 | BUILD 20260521'), 'HUD must expose current version/build');
assert.ok(exists('src/main.v39-1-3.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-1-2.js'), 'previous versioned entry must not ship');
assertByteIdentical('src/main.js', 'src/main.v39-1-3.js', 'versioned main entry must stay byte-identical with unversioned main');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-1-3.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-1-2.js`), `previous versioned app module should not ship: ${name}`);
  assertByteIdentical(`src/app/${name}.js`, `src/app/${name}.v39-1-3.js`, `versioned app module must stay byte-identical: ${name}`);
}

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.1.3"'), 'server version must match v39.1.3');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.1.3-20260521"'), 'server build must match v39.1.3 build');
assert.ok(server.includes('nncckkrr signaling v39.1.3 protocol'), 'server banner must use current version');

assert.equal(typeof projectileDamageTags, 'function', 'projectileDamageTags must be exported');
assert.equal(typeof statusDamageTags, 'function', 'statusDamageTags must be exported');
assert.equal(typeof companionDamageTags, 'function', 'companionDamageTags must be exported');
assert.equal(typeof hostileProjectileDamageTags, 'function', 'hostileProjectileDamageTags must be exported');
assert.equal(typeof canDamageSourceHitArmor, 'function', 'armor source guard must be exported');
assert.equal(typeof canDamageSourceLifesteal, 'function', 'lifesteal source guard must be exported');

assert.deepEqual(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT), [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.DIRECT], 'direct projectile source tags drifted');
assert.deepEqual(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.EXPLOSION), [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.EXPLOSION], 'explosion projectile source tags drifted');
assert.deepEqual(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.CHAIN), [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.CHAIN], 'chain projectile source tags drifted');
assert.deepEqual(statusDamageTags('burn'), [DAMAGE_TAGS.STATUS, DAMAGE_TAGS.BURN], 'burn status source tags drifted');
assert.deepEqual(statusDamageTags('poison'), [DAMAGE_TAGS.STATUS, DAMAGE_TAGS.POISON], 'poison status source tags drifted');
assert.deepEqual(statusDamageTags('freeze'), [DAMAGE_TAGS.STATUS, DAMAGE_TAGS.FREEZE], 'freeze status source tags drifted');
assert.deepEqual(companionDamageTags('drone'), [DAMAGE_TAGS.DIRECT, DAMAGE_TAGS.COMPANION, 'drone'], 'companion source tags drifted');
assert.deepEqual(hostileProjectileDamageTags(), [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.PROJECTILE], 'hostile projectile source tags drifted');

assert.equal(DAMAGE_SOURCE_MATRIX.projectileDirect.armor, true, 'direct projectile must hit armor');
assert.equal(DAMAGE_SOURCE_MATRIX.projectileExplosion.lifesteal, true, 'explosion projectile must be lifesteal-eligible');
assert.equal(DAMAGE_SOURCE_MATRIX.projectileChain.lifesteal, true, 'chain projectile must be lifesteal-eligible');
assert.equal(DAMAGE_SOURCE_MATRIX.projectileStatus.armor, false, 'status must not hit armor');
assert.equal(DAMAGE_SOURCE_MATRIX.projectileStatus.lifesteal, false, 'status must not lifesteal');
assert.equal(DAMAGE_SOURCE_MATRIX.companionDirect.armor, true, 'companion direct damage must hit armor');
assert.equal(DAMAGE_SOURCE_MATRIX.hostileProjectile.armor, false, 'enemy-owned hostile projectiles must not be part of enemy armor matrix');

assert.equal(canDamageSourceHitArmor(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT)), true, 'direct projectile should hit armor');
assert.equal(canDamageSourceHitArmor(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.EXPLOSION)), true, 'explosion projectile should hit armor');
assert.equal(canDamageSourceHitArmor(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.CHAIN)), true, 'chain projectile should hit armor');
assert.equal(canDamageSourceHitArmor(companionDamageTags('orbital')), true, 'companion should hit armor');
assert.equal(canDamageSourceHitArmor(statusDamageTags('burn')), false, 'status should bypass armor');
assert.equal(canDamageSourceHitArmor(hostileProjectileDamageTags()), false, 'enemy projectile tags should not be enemy armor source');
assert.equal(canDamageSourceLifesteal(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT)), true, 'direct projectile should lifesteal');
assert.equal(canDamageSourceLifesteal(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.EXPLOSION)), true, 'explosion projectile should lifesteal');
assert.equal(canDamageSourceLifesteal(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.CHAIN)), true, 'chain projectile should lifesteal');
assert.equal(canDamageSourceLifesteal(statusDamageTags('poison')), false, 'status should not lifesteal');
assert.equal(canDamageSourceLifesteal(companionDamageTags('drone')), false, 'companion direct damage should not be weapon lifesteal-eligible');

const matrixSrc = sourceWithoutComments('src/game/damageSourceMatrix.js');
const projectileHitsSrc = sourceWithoutComments('src/game/projectileHits.js');
const projectileExplosionsSrc = sourceWithoutComments('src/game/projectileExplosions.js');
const projectilesSrc = sourceWithoutComments('src/game/projectiles.js');
const effectsDamageSrc = sourceWithoutComments('src/game/effects/damage.js');
const enemyArmorSrc = sourceWithoutComments('src/game/enemyArmor.js');
const companionsSrc = sourceWithoutComments('src/game/companions.js');
const hostileSrc = sourceWithoutComments('src/game/hostileProjectiles.js');

assert.ok(matrixSrc.includes('DAMAGE_SOURCE_MATRIX'), 'source matrix module must own the documented matrix');
assert.ok(projectileHitsSrc.includes('projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT)'), 'direct projectile tags must come from matrix');
assert.ok(projectileExplosionsSrc.includes('projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.EXPLOSION)'), 'explosion tags must come from matrix');
assert.ok(projectileExplosionsSrc.includes('projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.CHAIN)'), 'chain tags must come from matrix');
assert.ok(projectilesSrc.includes('statusDamageTags()'), 'status fallback tags must come from matrix');
assert.ok(effectsDamageSrc.includes('canDamageSourceLifesteal(tags)'), 'lifesteal eligibility must come from matrix');
assert.ok(enemyArmorSrc.includes('canDamageSourceHitArmor(spec.tags)'), 'armor source eligibility must come from matrix');
assert.ok(companionsSrc.includes('companionDamageTags(companion.kind)'), 'companion tags must come from matrix');
assert.ok(hostileSrc.includes('hostileProjectileDamageTags()'), 'hostile projectile tags must come from matrix');

assert.ok(!projectileHitsSrc.includes('[DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.DIRECT]'), 'raw direct projectile tag tuple must not return to projectileHits.js');
assert.ok(!projectileExplosionsSrc.includes('[DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.EXPLOSION]'), 'raw explosion tag tuple must not return to projectileExplosions.js');
assert.ok(!projectileExplosionsSrc.includes('[DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.CHAIN]'), 'raw chain tag tuple must not return to projectileExplosions.js');
assert.ok(!projectilesSrc.includes('[DAMAGE_TAGS.STATUS]'), 'raw status fallback tag tuple must not return to projectiles.js');
assert.ok(!effectsDamageSrc.includes('[DAMAGE_TAGS.DIRECT, DAMAGE_TAGS.EXPLOSION, DAMAGE_TAGS.CHAIN]'), 'lifesteal source list must not be inline in effects/damage.js');
assert.ok(!enemyArmorSrc.includes('DAMAGE_TAGS.PROJECTILE') && !enemyArmorSrc.includes('DAMAGE_TAGS.COMPANION'), 'enemyArmor.js must not own source tag policy');
assert.ok(!hostileSrc.includes('[DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.PROJECTILE]'), 'hostile projectile tag tuple must not be inline');
assert.ok(!/function\s+companionDamageTags\b/.test(companionsSrc), 'companion damage tag helper must not live in companions.js');

for (const [rel, src] of [
  ['src/game/projectileHits.js', projectileHitsSrc],
  ['src/game/projectileExplosions.js', projectileExplosionsSrc],
  ['src/game/projectileWallResolution.js', sourceWithoutComments('src/game/projectileWallResolution.js')],
  ['src/game/hostileProjectiles.js', hostileSrc],
  ['src/game/companions.js', companionsSrc]
]) {
  assertNoDirectMutation(src, rel);
}
assert.ok(!/enemy\.kind\s*===\s*["'](?:tank|boss)["']/.test(`${projectileHitsSrc}\n${enemyArmorSrc}`), 'armor source path must stay generic, not tank/boss special-cased');

function disableArmor(enemy) {
  if (enemy?.armor) {
    enemy.armor.hp = 0;
    enemy.armor.broken = true;
    enemy.armor.regenCooldown = 9999;
  }
  return enemy;
}

function newMatrixState(seed = 'MATRIX') {
  const state = createGameState(seed);
  const player = addPlayer(state, 'p1', 0);
  player.x = 500;
  player.y = 500;
  player.angle = 0;
  player.hp = 50;
  player.maxHp = 100;
  state.spawnTimer = 9999;
  return { state, player };
}

{
  const { state } = newMatrixState('MATRIX-ARMOR-DIRECT');
  const tank = spawnEnemy(state, 'tank', 640, 500);
  const beforeHp = tank.hp;
  const projectile = makeProjectile({ id: 'pr-direct', ownerId: 'p1', weaponId: 'shotgun', x: 500, y: 500, angle: 0 });
  const hit = dealProjectileDamage(state, projectile, tank, 7, tank.x, tank.y, projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT));
  assert.equal(hit.damage.armorHit, true, 'direct projectile should hit armor first');
  assert.equal(tank.hp, beforeHp, 'direct projectile should not damage hp while armor is active');
}

{
  const { state } = newMatrixState('MATRIX-ARMOR-STATUS');
  const tank = spawnEnemy(state, 'tank', 640, 500);
  const beforeHp = tank.hp;
  const beforeArmor = tank.armor.hp;
  const hit = dealDamage(state, tank, { amount: 5, sourceId: 'p1', tags: statusDamageTags('burn') });
  assert.equal(hit.armorHit, undefined, 'status damage should bypass armor');
  assert.equal(tank.hp, beforeHp - 5, 'status damage should reduce hp through official dealDamage');
  assert.equal(tank.armor.hp, beforeArmor, 'status damage should not reduce armor');
}

{
  const { state } = newMatrixState('MATRIX-ARMOR-COMPANION');
  const tank = spawnEnemy(state, 'tank', 640, 500);
  const beforeHp = tank.hp;
  const hit = dealDamage(state, tank, { amount: 6, sourceId: 'p1', companionId: 'co1', tags: companionDamageTags('drone') });
  assert.equal(hit.armorHit, true, 'companion direct damage should hit armor');
  assert.equal(tank.hp, beforeHp, 'companion armor hit should not reduce hp while armor is active');
}

{
  const { state, player } = newMatrixState('MATRIX-LIFESTEAL');
  player.upgrades.taken.lifesteal = 1;
  const enemy = disableArmor(spawnEnemy(state, 'grunt', 560, 500));
  const projectile = makeProjectile({ id: 'pr-ls', ownerId: 'p1', weaponId: 'shotgun', x: 500, y: 500, angle: 0, effects: [{ type: 'lifesteal', percent: 0.25 }] });
  dealProjectileDamage(state, projectile, enemy, 12, enemy.x, enemy.y, projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT));
  assert.ok(player.hp > 50, `direct projectile lifesteal should heal owner (${player.hp})`);
}

{
  const { state, player } = newMatrixState('MATRIX-NO-STATUS-LIFESTEAL');
  player.upgrades.taken.lifesteal = 1;
  const enemy = disableArmor(spawnEnemy(state, 'grunt', 560, 500));
  const projectile = makeProjectile({ id: 'pr-dot', ownerId: 'p1', weaponId: 'shotgun', x: 500, y: 500, angle: 0, effects: [{ type: 'lifesteal', percent: 0.25 }] });
  dealProjectileDamage(state, projectile, enemy, 12, enemy.x, enemy.y, statusDamageTags('poison'));
  assert.equal(player.hp, 50, 'status-tagged damage must not lifesteal');
}

{
  const { state } = newMatrixState('MATRIX-UPDATE-SMOKE');
  spawnEnemy(state, 'grunt', 640, 500);
  state.projectiles.prSmoke = makeProjectile({ id: 'prSmoke', ownerId: 'p1', weaponId: 'shotgun', x: 500, y: 500, angle: 0 });
  updateProjectiles(state, 1 / 60);
  assert.ok(Number.isFinite(state.time || 0), 'updateProjectiles smoke check failed');
}

console.log('v39.1.3 projectile/effect source matrix checks passed');
