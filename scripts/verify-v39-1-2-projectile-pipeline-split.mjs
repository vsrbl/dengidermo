import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION, BUILD_ID } from '../src/core/constants.js';
import { ENEMIES } from '../src/data/enemies.js';
import { ENEMY_BEHAVIORS, resolveEnemyBehavior, unknownEnemyBehaviors } from '../src/game/enemyBehaviors.js';
import { makeEnemyProjectile, makeProjectile, updateProjectiles } from '../src/game/projectiles.js';
import { updateHostileProjectile } from '../src/game/hostileProjectiles.js';
import { applyProjectileHit, dealProjectileDamage, runProjectileHitEffects } from '../src/game/projectileHits.js';
import { explode, fireExpireEffects, projectileCommandHandlers } from '../src/game/projectileExplosions.js';
import { handleWallOrEnd } from '../src/game/projectileWallResolution.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

function walk(dirRel, out = []) {
  for (const name of fs.readdirSync(path.join(root, dirRel))) {
    const rel = `${dirRel}/${name}`;
    const stat = fs.statSync(path.join(root, rel));
    if (stat.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

function assertNoDirectMutation(src, rel) {
  assert.ok(!/\bplayer\.hp\s*(?:[+\-*/]?=|\+\+|--)/.test(src), `${rel} must not mutate player.hp directly`);
  assert.ok(!/\benemy\.hp\s*(?:[+\-*/]?=|\+\+|--)/.test(src), `${rel} must not mutate enemy.hp directly`);
  assert.ok(!/\bstate\.effects\.push\s*\(/.test(src), `${rel} must not push visual effects directly`);
}

function assertNoGameplaySpecialCases(src, rel) {
  assert.ok(!/\bmodifierId\s*===/.test(src), `${rel} must not special-case modifier ids`);
  assert.ok(!/\broom\.id\s*===/.test(src), `${rel} must not special-case room ids`);
}

function assertByteIdentical(a, b, message) {
  assert.equal(read(a), read(b), message || `${a} and ${b} must stay byte-identical`);
}

assert.equal(VERSION, 'v39.1.2');
assert.equal(BUILD_ID, 'v39.1.2-20260521');

const pkg = readJson('package.json');
const serverPkg = readJson('server/package.json');
const srcPkg = readJson('src/package.json');
const release = readJson('release.json');
assert.equal(pkg.version, '39.1.2');
assert.equal(serverPkg.version, '39.1.2');
assert.equal(srcPkg.version, '39.1.2');
assert.equal(release.version, 'v39.1.2');
assert.equal(release.buildId, 'v39.1.2-20260521');
assert.equal(release.entry, './src/main.v39-1-2.js?v=39.1.2');
assert.equal(release.notes, 'v39.1.2 projectile pipeline split: hit, explosion, and wall resolution modules; no gameplay balance/content changes');
assert.equal(pkg.scripts['check:v39-1-2'], 'node scripts/verify-v39-1-2-projectile-pipeline-split.mjs');
assert.ok(pkg.scripts['check:all'].trim().endsWith('npm run check:v39-1-2'), 'check:all must end with the current exact guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-1-1'), 'check:all must not keep previous exact guard');

assert.ok(exists('scripts/verify-v39-1-2-projectile-pipeline-split.mjs'), 'current exact guard must live in scripts root');
assert.ok(!exists('scripts/verify-v39-1-1-architecture-hardening-after-split.mjs'), 'previous exact guard must not remain in scripts root');
assert.ok(exists('scripts/legacy/verify-v39-1-1-architecture-hardening-after-split.mjs'), 'previous exact guard must be archived');

const rootScriptFiles = fs.readdirSync(path.join(root, 'scripts')).filter((name) => name.endsWith('.mjs'));
assert.ok(!rootScriptFiles.some((name) => /^verify-v\d/.test(name) && name !== 'verify-v39-1-2-projectile-pipeline-split.mjs'), 'only the current exact-version guard may live in scripts root');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-1-2.js?v=39.1.2'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.1.2 | BUILD 20260521'), 'HUD must expose current version/build');
assert.ok(exists('src/main.v39-1-2.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-1-1.js'), 'previous versioned entry must not ship');
assertByteIdentical('src/main.js', 'src/main.v39-1-2.js', 'versioned main entry must stay byte-identical with unversioned main');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-1-2.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-1-1.js`), `previous versioned app module should not ship: ${name}`);
  assertByteIdentical(`src/app/${name}.js`, `src/app/${name}.v39-1-2.js`, `versioned app module must stay byte-identical: ${name}`);
}

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.1.2"'), 'server version must match v39.1.2');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.1.2-20260521"'), 'server build must match v39.1.2 build');
assert.ok(server.includes('nncckkrr signaling v39.1.2 protocol'), 'server banner must use current version');

assert.equal(typeof makeProjectile, 'function', 'projectiles barrel must keep makeProjectile public API');
assert.equal(typeof makeEnemyProjectile, 'function', 'projectiles barrel must keep makeEnemyProjectile public API');
assert.equal(typeof updateProjectiles, 'function', 'projectiles coordinator must keep updateProjectiles public API');
assert.equal(typeof updateHostileProjectile, 'function', 'hostile projectile runtime must export updateHostileProjectile');
assert.equal(typeof applyProjectileHit, 'function', 'projectile hit resolver must export applyProjectileHit');
assert.equal(typeof dealProjectileDamage, 'function', 'projectile damage dispatcher must export dealProjectileDamage');
assert.equal(typeof runProjectileHitEffects, 'function', 'projectile hit effect dispatcher must export runProjectileHitEffects');
assert.equal(typeof explode, 'function', 'projectile explosion resolver must export explode');
assert.equal(typeof fireExpireEffects, 'function', 'projectile expire dispatcher must export fireExpireEffects');
assert.equal(typeof projectileCommandHandlers, 'function', 'projectile command handlers must stay exported');
assert.equal(typeof handleWallOrEnd, 'function', 'projectile wall/end resolver must export handleWallOrEnd');

for (const rel of [
  'src/game/projectileHits.js',
  'src/game/projectileExplosions.js',
  'src/game/projectileWallResolution.js',
  'src/game/projectileFactories.js',
  'src/game/hostileProjectiles.js'
]) {
  assert.ok(exists(rel), `${rel} must exist after projectile pipeline split`);
}

const projectileSrc = read('src/game/projectiles.js');
const projectileHitsSrc = read('src/game/projectileHits.js');
const projectileExplosionsSrc = read('src/game/projectileExplosions.js');
const projectileWallsSrc = read('src/game/projectileWallResolution.js');
const projectileFactorySrc = read('src/game/projectileFactories.js');
const hostileProjectileSrc = read('src/game/hostileProjectiles.js');

assert.ok(projectileSrc.includes('export { makeProjectile, makeEnemyProjectile } from "./projectileFactories.js"'), 'projectile factories must remain re-exported through projectiles.js');
assert.ok(projectileSrc.includes('updateHostileProjectile'), 'projectiles coordinator must delegate hostile runtime');
assert.ok(projectileSrc.includes('applyProjectileHit'), 'projectiles coordinator must delegate hit resolution');
assert.ok(projectileSrc.includes('handleWallOrEnd'), 'projectiles coordinator must delegate wall/end resolution');
assert.ok(projectileSrc.includes('projectilePipelineContext'), 'projectiles coordinator must pass an explicit pipeline context');
assert.ok(!/function\s+makeProjectile\b/.test(projectileSrc), 'player projectile factory must not drift back into projectiles.js');
assert.ok(!/function\s+makeEnemyProjectile\b/.test(projectileSrc), 'enemy projectile factory must not drift back into projectiles.js');
assert.ok(!/function\s+updateHostileProjectile\b/.test(projectileSrc), 'hostile projectile runtime must not drift back into projectiles.js');
assert.ok(!/function\s+applyProjectileHit\b/.test(projectileSrc), 'enemy hit resolver must not drift back into projectiles.js');
assert.ok(!/function\s+explode\b/.test(projectileSrc), 'explosion implementation must not drift back into projectiles.js');
assert.ok(!/function\s+handleWallOrEnd\b/.test(projectileSrc), 'wall/end resolver must not drift back into projectiles.js');
assert.ok(!/resolveExplosionBehavior/.test(projectileSrc), 'explosion behavior resolution belongs in projectileExplosions.js');
assert.ok(!/resolveProjectileWallEnd/.test(projectileSrc), 'wall/end resolution belongs in projectileWallResolution.js');
assert.ok(!/ricochetProjectileFromArmor/.test(projectileSrc), 'armor hit ricochet belongs in projectileHits.js');
assert.ok(!/kind:\s*["']enemyBullet["']/.test(projectileSrc), 'projectiles.js must not construct enemy bullets directly');
assert.ok(!/ownerType:\s*["']enemy["']/.test(projectileSrc), 'projectiles.js must not construct enemy-owned projectiles directly');

assert.ok(projectileHitsSrc.includes('export function applyProjectileHit'), 'applyProjectileHit must live in projectileHits.js');
assert.ok(projectileHitsSrc.includes('export function dealProjectileDamage'), 'projectile damage dispatch must live in projectileHits.js');
assert.ok(projectileHitsSrc.includes('dealDamage(state, enemy'), 'projectileHits.js must use official enemy damage pipeline');
assert.ok(projectileHitsSrc.includes('healProjectileOwner'), 'projectileHits.js must preserve lifesteal/source healing path');
assert.ok(projectileHitsSrc.includes('ricochetProjectileFromArmor'), 'projectileHits.js must own armor ricochet path');
assert.ok(projectileHitsSrc.includes('finishEnemyKill'), 'projectileHits.js must use shared enemy finalizer');
assert.ok(!/enemy\.kind\s*===\s*["'](?:tank|boss)["']/.test(projectileHitsSrc), 'armor path must not special-case tank/boss');

assert.ok(projectileExplosionsSrc.includes('export function explode'), 'explode must live in projectileExplosions.js');
assert.ok(projectileExplosionsSrc.includes('resolveExplosionBehavior'), 'explosion behavior resolution must live in projectileExplosions.js');
assert.ok(projectileExplosionsSrc.includes('createClusterExplosionRequests'), 'cluster explosion orchestration must live in projectileExplosions.js');
assert.ok(projectileExplosionsSrc.includes('createSplitProjectileChildren'), 'split projectile orchestration must live in projectileExplosions.js');
assert.ok(projectileExplosionsSrc.includes('dealProjectileDamage'), 'explosions must use projectile damage dispatcher');
assert.ok(!/enemy\.kind\s*===\s*["'](?:tank|boss)["']/.test(projectileExplosionsSrc), 'explosion armor path must stay generic');

assert.ok(projectileWallsSrc.includes('export function handleWallOrEnd'), 'handleWallOrEnd must live in projectileWallResolution.js');
assert.ok(projectileWallsSrc.includes('resolveProjectileWallEnd'), 'wall/end behavior must live in projectileWallResolution.js');
assert.ok(projectileWallsSrc.includes('runRoomModifierHooks'), 'wall/end resolver must preserve projectile:wall modifier hooks');
assert.ok(projectileWallsSrc.includes('resolveRicochetCommands'), 'wall/end resolver must preserve ricochet hook commands');
assert.ok(!/dealDamage\s*\(/.test(projectileWallsSrc), 'wall/end resolver must not own enemy damage');

assert.ok(projectileFactorySrc.includes('export function makeProjectile'), 'player projectile factory must live in projectileFactories.js');
assert.ok(projectileFactorySrc.includes('export function makeEnemyProjectile'), 'enemy projectile factory must live in projectileFactories.js');
assert.ok(projectileFactorySrc.includes('kind: "enemyBullet"'), 'enemy projectile kind belongs in projectileFactories.js');
assert.ok(projectileFactorySrc.includes('ownerType: "enemy"'), 'enemy projectile ownership belongs in projectileFactories.js');
assert.ok(hostileProjectileSrc.includes('dealPlayerDamage(state, player'), 'hostile projectile damage must flow through dealPlayerDamage');
assert.ok(!/dealDamage\s*\(/.test(hostileProjectileSrc), 'hostile projectiles must not use enemy damage pipeline');
assert.ok(!/finishEnemyKill\s*\(/.test(hostileProjectileSrc), 'hostile projectiles must not own enemy kill cleanup');

for (const rel of [
  'src/game/projectiles.js',
  'src/game/projectileHits.js',
  'src/game/projectileExplosions.js',
  'src/game/projectileWallResolution.js',
  'src/game/hostileProjectiles.js'
]) {
  const src = read(rel);
  assertNoDirectMutation(src, rel);
  assertNoGameplaySpecialCases(src, rel);
}

const projectile = makeEnemyProjectile({ id: 'verify-ep', enemyId: 'en-verify', x: 10, y: 20, angle: 0 });
assert.equal(projectile.hostile, true, 'enemy projectile factory must mark hostile projectiles');
assert.equal(projectile.ownerType, 'enemy', 'enemy projectile factory must mark owner type');
assert.equal(projectile.kind, 'enemyBullet', 'enemy projectile factory must use enemyBullet kind');
assert.equal(projectile.ownerId, 'en-verify', 'enemy projectile owner must remain enemy id');

const behaviorBarrelSrc = read('src/game/enemyBehaviors.js');
assert.ok(behaviorBarrelSrc.includes('export const ENEMY_BEHAVIORS'), 'enemy behavior registry must be explicit');
assert.ok(behaviorBarrelSrc.includes('Object.freeze'), 'enemy behavior registry must be immutable');
assert.ok(!/function\s+update(?:Boss|Bomber|Charger|Chase|Ranged)Enemy\b/.test(behaviorBarrelSrc), 'enemy behavior implementations must not drift back into registry barrel');
for (const name of ['common', 'chase', 'ranged', 'charger', 'bomber', 'boss']) {
  assert.ok(exists(`src/game/enemyBehaviors/${name}.js`), `enemy behavior module missing: ${name}`);
}

const expectedBehaviors = ['bomber', 'boss', 'charger', 'chase', 'ranged'];
assert.deepEqual(Object.keys(ENEMY_BEHAVIORS).sort(), expectedBehaviors, 'behavior registry changed unexpectedly');
assert.deepEqual(unknownEnemyBehaviors(ENEMIES), [], 'every enemy behavior id in data/enemies.js must be registered');
for (const [kind, data] of Object.entries(ENEMIES)) {
  assert.equal(typeof resolveEnemyBehavior(data), 'function', `${kind} behavior must resolve to a function`);
}

for (const file of walk('src/game/enemyBehaviors').filter((rel) => rel.endsWith('.js'))) {
  const src = read(file);
  assertNoDirectMutation(src, file);
  assertNoGameplaySpecialCases(src, file);
  assert.ok(!/from\s+["']\.\.\/\.\.\/data\/enemies\.js["']/.test(src), `${file} must not import enemy data directly`);
  if (file !== 'src/game/enemyBehaviors/ranged.js') {
    assert.ok(!/makeEnemyProjectile/.test(src), `${file} must not create hostile projectiles directly`);
    assert.ok(!/state\.projectiles\s*\[/.test(src), `${file} must not mutate projectile collections directly`);
  }
}
const rangedBehaviorSrc = read('src/game/enemyBehaviors/ranged.js');
assert.ok(rangedBehaviorSrc.includes('makeEnemyProjectile'), 'ranged behavior must create enemy bullets through projectile factory');
assert.ok(rangedBehaviorSrc.includes('firstSolidWallHitInLocation'), 'ranged behavior must keep line-of-fire wall validation');
assert.ok(!/kind:\s*["']enemyBullet["']/.test(rangedBehaviorSrc), 'ranged behavior must not inline enemy bullet shape');

for (const file of walk('src/game').filter((rel) => rel.endsWith('.js'))) {
  const src = read(file);
  assertNoGameplaySpecialCases(src, file);
}

console.log('v39.1.2 projectile pipeline split checks passed');
