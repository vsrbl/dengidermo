import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION, WORLD } from '../src/core/constants.js';
import { ENEMIES, ENEMY_WAVES } from '../src/data/enemies.js';
import { ENEMY_RENDERERS } from '../src/render/enemyRenderers.js';
import { EFFECT_RENDERERS } from '../src/render/effectRenderers.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { spawnEnemy, updateEnemies } from '../src/game/enemies.js';
import { updateProjectiles, makeProjectile, makeEnemyProjectile } from '../src/game/projectiles.js';
import { dealDamage, DAMAGE_TAGS } from '../src/game/effects.js';
import { ROOM_MODIFIER_HOOKS } from '../src/game/roomModifiers.js';
import { directorSpawnEnemyCommand, executeDirectorCommands } from '../src/game/directorCommands.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

assert.equal(VERSION, 'v39.1.0');
assert.equal(BUILD_ID, 'v39.1.0-20260520');

const pkg = readJson('package.json');
assert.equal(pkg.version, '39.1.0');
assert.equal(readJson('server/package.json').version, '39.1.0');
assert.equal(readJson('src/package.json').version, '39.1.0');
assert.equal(readJson('release.json').version, 'v39.1.0');
assert.equal(readJson('release.json').notes, 'v39.1.0 architecture split: projectile factories/hostile projectile runtime and enemy behavior registry modules, no gameplay balance/content changes');
assert.equal(pkg.scripts['check:v39-1-0'], 'node scripts/verify-v39-1-0-architecture-split.mjs');
assert.ok(pkg.scripts['check:all'].includes('check:v39-1-0'), 'check:all must include current migration guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-0-8'), 'check:all must not keep previous exact guard');
assert.ok(!exists('scripts/verify-v39-0-8-architecture-hardening.mjs'), 'previous exact guard must be archived out of root scripts');
assert.ok(exists('scripts/legacy/verify-v39-0-8-architecture-hardening.mjs'), 'previous exact guard should be archived');

assert.deepEqual(ENEMY_WAVES, ['grunt', 'runner', 'grunt', 'shooter', 'tank'], 'baseline enemy waves stay stable');
assert.equal(ENEMIES.runner.radius, 16, 'runner should remain a larger simple square');
assert.equal(ENEMIES.shooter.accentColor, 'white', 'shooter should not rely on an extra color accent');
assert.ok(ENEMIES.tank.armor, 'tank must own armor through enemy data');
assert.ok(ENEMIES.boss.armor, 'boss must own stronger armor through enemy data');
assert.equal(ENEMY_RENDERERS.tank instanceof Function, true, 'tank sprite must render through enemy renderer registry');
assert.equal(ENEMY_RENDERERS.boss instanceof Function, true, 'boss sprite must render through enemy renderer registry');
assert.equal(EFFECT_RENDERERS.armorHit instanceof Function, true, 'armor hit visual must render through effect registry');
assert.equal(EFFECT_RENDERERS.armorBreak instanceof Function, true, 'armor break visual must render through effect registry');
assert.equal(EFFECT_RENDERERS.armorRegen instanceof Function, true, 'armor regen visual must render through effect registry');
assert.equal(ROOM_MODIFIER_HOOKS.PROJECTILE_WALL, 'projectile:wall', 'room modifier hook contract must include projectile:wall');

function freshArmoredTank(label = 'ARMOR-MATRIX') {
  const state = createGameState(label);
  addPlayer(state, 'p1', 0);
  const tank = spawnEnemy(state, 'tank', 900, 800, { role: 'verify' });
  assert.ok(tank.armor, 'spawnEnemy should initialize armor runtime from enemy data');
  return { state, tank, hp: tank.hp, armor: tank.armor.hp };
}

for (const item of [
  { name: 'direct projectile', tags: [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.DIRECT] },
  { name: 'explosion projectile', tags: [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.EXPLOSION] },
  { name: 'chain projectile', tags: [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.CHAIN] },
  { name: 'companion direct', tags: [DAMAGE_TAGS.COMPANION, DAMAGE_TAGS.DIRECT] }
]) {
  const { state, tank, hp, armor } = freshArmoredTank(`ARMOR-MATRIX-${item.name}`);
  const hit = dealDamage(state, tank, { amount: 9, sourceId: 'p1', tags: item.tags });
  assert.equal(hit.armorHit, true, `${item.name} should hit armor before hp`);
  assert.equal(hit.done, 0, `${item.name} should not damage hp while armor is alive`);
  assert.equal(tank.hp, hp, `${item.name} must preserve hp while armor is alive`);
  assert.equal(tank.armor.hp, armor - 9, `${item.name} should reduce armor`);
}

for (const item of [
  { name: 'status tick', tags: [DAMAGE_TAGS.STATUS, DAMAGE_TAGS.BURN] },
  { name: 'enemy explosion', tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.EXPLOSION] },
  { name: 'enemy touch', tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH] }
]) {
  const { state, tank, hp, armor } = freshArmoredTank(`ARMOR-BYPASS-${item.name}`);
  const hit = dealDamage(state, tank, { amount: 7, sourceId: 'verify', tags: item.tags });
  assert.equal(hit.armorHit, undefined, `${item.name} should not be absorbed by enemy armor`);
  assert.equal(hit.done, 7, `${item.name} should damage hp directly`);
  assert.equal(tank.hp, hp - 7, `${item.name} should reduce hp`);
  assert.equal(tank.armor.hp, armor, `${item.name} should not reduce armor`);
}

const state = createGameState('V39-ARMOR');
const player = addPlayer(state, 'p1', 0);
player.x = 500;
player.y = 800;
player.angle = 0;
const tank = spawnEnemy(state, 'tank', 900, 800, { role: 'verify' });
const tankHpBefore = tank.hp;
const first = dealDamage(state, tank, { amount: 10, sourceId: 'p1', tags: [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.DIRECT] });
assert.equal(first.armorHit, true, 'projectile damage should hit armor before hp');
assert.equal(first.done, 0, 'armor absorption must not damage hp');
assert.equal(tank.hp, tankHpBefore, 'tank hp should stay unchanged while armor is alive');
assert.ok(tank.armor.regenCooldown > 0, 'armor hit should delay regeneration');
for (let i = 0; i < 8; i += 1) updateEnemies(state, 0.5);
assert.ok(tank.armor.hp > ENEMIES.tank.armor.hp - 10, 'armor should regenerate after not being hit for long enough');
const breaker = dealDamage(state, tank, { amount: 999, sourceId: 'p1', tags: [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.DIRECT] });
assert.equal(breaker.armorHit, true, 'breaking shot still resolves through armor');
assert.equal(breaker.armorBroken, true, 'large hit should break armor');
assert.equal(tank.hp, tankHpBefore, 'armor-breaking hit should not overflow into hp');
const hpHit = dealDamage(state, tank, { amount: 7, sourceId: 'p1', tags: [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.DIRECT] });
assert.equal(hpHit.armorHit, undefined, 'after armor is broken, projectile damage should reach hp');
assert.equal(tank.hp, tankHpBefore - 7);
for (let i = 0; i < 9; i += 1) updateEnemies(state, 0.5);
assert.ok(tank.armor.hp > 0, 'broken armor should regenerate if ignored');

const ricochetState = createGameState('V39-ARMOR-RICOCHET');
const ricochetPlayer = addPlayer(ricochetState, 'p1', 0);
ricochetPlayer.x = 500;
ricochetPlayer.y = 800;
ricochetPlayer.angle = 0;
const ricochetTank = spawnEnemy(ricochetState, 'tank', 760, 800, { role: 'verify' });
const projectile = makeProjectile({ id: 'armor-shot', ownerId: 'p1', weaponId: 'shotgun', x: 700, y: 800, angle: 0 });
projectile.damage = 9;
ricochetState.projectiles[projectile.id] = projectile;
updateProjectiles(ricochetState, 0.12);
assert.ok(ricochetTank.armor.hp < ricochetTank.armor.maxHp, 'projectile should damage armor');
assert.ok(ricochetState.projectiles[projectile.id], 'projectile should ricochet instead of being deleted while armor lives');
assert.ok(ricochetState.projectiles[projectile.id].vx < 0, 'armor ricochet should reverse projectile away from tank');
assert.equal(ricochetTank.hp, ENEMIES.tank.hp, 'ricochet hit should not damage hp');

const hostileState = createGameState('V39-HOSTILE-PROJECTILE-WALL');
const hostilePlayer = addPlayer(hostileState, 'p1', 0);
hostilePlayer.x = 120;
hostilePlayer.y = 120;
const hostile = makeEnemyProjectile({ id: 'enemy-ricochet', enemyId: 'en-test', x: WORLD.w - 4, y: 800, angle: 0, speed: 260, range: 900, damage: 1 });
hostile.effects = [{ type: 'ricochet', count: 1 }];
hostile.ricocheted = 0;
hostileState.projectiles[hostile.id] = hostile;
updateProjectiles(hostileState, 0.05);
assert.ok(hostileState.projectiles[hostile.id], 'hostile projectile should be able to use projectile wall hook ricochet parity');
assert.ok(hostileState.projectiles[hostile.id].vx < 0, 'hostile projectile wall ricochet should reverse velocity');

const failedSpawnState = createGameState('V39-SCRIPTED-SPAWN-RETRY');
const failedDirector = { policy: { canSpawn: true }, enemyCap: 0, budget: 10, spawnedByRole: {}, scriptedStageSpawns: {} };
const scripted = directorSpawnEnemyCommand({ kind: 'bomber', role: 'scripted', cost: 1, scriptedSpawnId: 'retry-bomber' });
const failedSummary = executeDirectorCommands(failedSpawnState, failedDirector, [scripted], { spawnEnemy });
assert.equal(failedSummary.spawned, 0, 'scripted spawn should fail when cap is full');
assert.deepEqual(failedSummary.scriptedSpawnIds, [], 'failed scripted spawn must not be marked completed');
failedDirector.enemyCap = 4;
const successSummary = executeDirectorCommands(failedSpawnState, failedDirector, [scripted], { spawnEnemy });
assert.equal(successSummary.spawned, 1, 'scripted spawn should succeed after cap becomes available');
assert.deepEqual(successSummary.scriptedSpawnIds, ['retry-bomber'], 'successful scripted spawn should report completion id');

const snap = makeSnapshot(ricochetState);
const tankSnap = snap.enemies.find((enemy) => enemy.id === ricochetTank.id);
assert.ok(tankSnap.armor, 'enemy snapshot should expose armor for renderer');
assert.ok(tankSnap.armor.ratio < 1, 'armor snapshot should include current ratio');

const armorSrc = read('src/game/enemyArmor.js');
assert.ok(armorSrc.includes('regenCooldown'), 'enemyArmor must own regen cooldown state');
assert.ok(armorSrc.includes('ricochetProjectileFromArmor'), 'enemyArmor must expose projectile ricochet helper');
assert.ok(armorSrc.includes('applyArmorDamage'), 'enemyArmor must centralize armor damage');

const damageSrc = read('src/game/effects/damage.js');
assert.ok(damageSrc.includes('shouldArmorAbsorb'), 'central damage pipeline must consult armor before hp');
assert.ok(damageSrc.includes('applyArmorDamage'), 'central damage pipeline must apply armor damage');
const projectileSrc = read('src/game/projectiles.js');
const projectileFactorySrc = read('src/game/projectileFactories.js');
const hostileProjectileSrc = read('src/game/hostileProjectiles.js');
assert.ok(projectileSrc.includes('moveProjectileWithRoomHooks'), 'player projectiles should keep shared room projectile update modifier path');
assert.ok(projectileSrc.includes('ROOM_MODIFIER_HOOKS.PROJECTILE_WALL'), 'projectile wall path should run room modifier projectile:wall hook');
assert.ok(projectileSrc.includes('updateHostileProjectile(state, p, dt, { moveProjectileWithRoomHooks, handleWallOrEnd })'), 'projectiles coordinator should delegate hostile runtime with shared hooks');
assert.ok(projectileSrc.includes('export { makeProjectile, makeEnemyProjectile } from "./projectileFactories.js"'), 'public projectile factory API must remain stable through barrel re-export');
assert.ok(!projectileSrc.includes('function makeProjectile'), 'projectile factory should not live in coordinator');
assert.ok(!projectileSrc.includes('function makeEnemyProjectile'), 'enemy projectile factory should not live in coordinator');
assert.ok(!projectileSrc.includes('function updateHostileProjectile'), 'hostile projectile runtime should not live in coordinator');
assert.ok(projectileFactorySrc.includes('export function makeProjectile'), 'player projectile factory should live in projectileFactories.js');
assert.ok(projectileFactorySrc.includes('export function makeEnemyProjectile'), 'enemy projectile factory should live in projectileFactories.js');
assert.ok(projectileFactorySrc.includes('ownerType: "enemy"'), 'enemy projectile factory must mark hostile owner type');
assert.ok(hostileProjectileSrc.includes('export function updateHostileProjectile'), 'hostile projectile runtime must be explicit and host-owned');
assert.ok(hostileProjectileSrc.includes('dealPlayerDamage(state, player'), 'hostile projectile runtime must damage players through dealPlayerDamage');
assert.ok(hostileProjectileSrc.includes('handleWallOrEnd'), 'hostile projectile runtime must reuse shared wall/end path');
assert.ok(projectileSrc.includes('ricochetProjectileFromArmor'), 'projectile hit path must ricochet from live armor');
assert.ok(!/enemy\.kind\s*===\s*["']tank/.test(projectileSrc), 'projectile armor behavior must not special-case tank');
assert.ok(!/enemy\.kind\s*===\s*["']boss/.test(projectileSrc), 'projectile armor behavior must not special-case boss');

const directorSrc = read('src/game/director.js');
assert.ok(directorSrc.includes('markCompletedScriptedSpawns'), 'director must mark scripted spawns only after execute summary');
assert.ok(directorSrc.includes('scriptedSpawnId: id'), 'scripted spawn id must travel through spawn command');
assert.ok(!directorSrc.includes('director.scriptedStageSpawns[id] = true;\n  }\n  return commands;'), 'planning stage must not mark scripted spawn complete before execution');
const directorCommandSrc = read('src/game/directorCommands.js');
assert.ok(directorCommandSrc.includes('scriptedSpawnIds'), 'director command summary must report successful scripted spawn ids');

const rendererSrc = read('src/render/enemyRenderers.js');
assert.ok(rendererSrc.includes('function drawArmorSquare'), 'armor visual should be data/snapshot-driven');
assert.ok(rendererSrc.includes('function drawBoss'), 'boss visual contract should live in enemy renderer registry');
assert.ok(rendererSrc.includes('drawText(ctx, "BOSS"'), 'boss label should be owned by enemy renderer');
const mainRendererSrc = read('src/renderer.js');
assert.ok(!mainRendererSrc.includes('e.kind === "boss"'), 'main renderer should not special-case boss label');
assert.ok(rendererSrc.includes('function drawShooter'), 'shooter visual contract should remain explicit');
assert.ok(rendererSrc.includes('s.x - r - 4, s.y - r - 4'), 'shooter should be diagonal crosshair');
assert.ok(rendererSrc.includes('function drawCharger'), 'charger visual contract should remain explicit');
assert.ok(!rendererSrc.includes('s.x - r - 6, s.y - 5'), 'runner should not regain decorative speed ticks');

const behaviorBarrelSrc = read('src/game/enemyBehaviors.js');
assert.ok(behaviorBarrelSrc.includes('./enemyBehaviors/ranged.js'), 'enemy behavior barrel should import ranged module');
assert.ok(behaviorBarrelSrc.includes('./enemyBehaviors/charger.js'), 'enemy behavior barrel should import charger module');
assert.ok(behaviorBarrelSrc.includes('./enemyBehaviors/bomber.js'), 'enemy behavior barrel should import bomber module');
assert.ok(!behaviorBarrelSrc.includes('function updateRangedEnemy'), 'ranged implementation should not live in registry barrel');
assert.ok(!behaviorBarrelSrc.includes('function updateChargerEnemy'), 'charger implementation should not live in registry barrel');
assert.ok(!behaviorBarrelSrc.includes('function updateBomberEnemy'), 'bomber implementation should not live in registry barrel');
for (const file of ['common', 'chase', 'ranged', 'charger', 'bomber', 'boss']) {
  assert.ok(exists(`src/game/enemyBehaviors/${file}.js`), `enemy behavior module missing: ${file}`);
}
const rangedBehaviorSrc = read('src/game/enemyBehaviors/ranged.js');
assert.ok(rangedBehaviorSrc.includes('makeEnemyProjectile'), 'ranged behavior should create host-owned enemy projectiles through projectile factory');
assert.ok(rangedBehaviorSrc.includes('firstSolidWallHitInLocation'), 'ranged behavior should respect line-of-fire walls');
assert.ok(rangedBehaviorSrc.includes('pushVisualEffect(state'), 'ranged behavior should use visual effect helper');
const commonBehaviorSrc = read('src/game/enemyBehaviors/common.js');
assert.ok(commonBehaviorSrc.includes('dealPlayerDamage(state, target'), 'shared enemy touch damage must use dealPlayerDamage');
for (const file of ['common', 'chase', 'ranged', 'charger', 'bomber', 'boss']) {
  const src = read(`src/game/enemyBehaviors/${file}.js`);
  assert.ok(!/player\.hp\s*[-+]?=/.test(src), `enemy behavior module must not mutate player hp directly: ${file}`);
  assert.ok(!/state\.effects\.push/.test(src), `enemy behavior module must not push visual effects directly: ${file}`);
}

const roomModifierSrc = read('src/game/roomModifiers.js');
assert.ok(roomModifierSrc.includes('PROJECTILE_WALL: "projectile:wall"'), 'room modifier hook enum must expose projectile wall hook');
assert.ok(roomModifierSrc.includes('[ROOM_MODIFIER_HOOKS.PROJECTILE_WALL]'), 'projectile wall hook fields must be validated');

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.1.0"'), 'server version must match v39.1.0');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.1.0-20260520"'), 'server build must match v39.1.0 build');
assert.ok(server.includes('HEARTBEAT_INTERVAL_MS'), 'v38.14.6 heartbeat hardening must remain');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-1-0.js?v=39.1.0'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.1.0 | BUILD 20260520'), 'HUD must expose v39.1.0');
assert.ok(exists('src/main.v39-1-0.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-0-8.js'), 'previous versioned entry must not ship');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-1-0.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-0-8.js`), `previous versioned app module should not ship: ${name}`);
}

function walkGameJs(dirRel, out = []) {
  for (const name of fs.readdirSync(path.join(root, dirRel))) {
    const rel = `${dirRel}/${name}`;
    const stat = fs.statSync(path.join(root, rel));
    if (stat.isDirectory()) walkGameJs(rel, out);
    else if (name.endsWith('.js')) out.push(rel);
  }
  return out;
}

for (const file of walkGameJs('src/game')) {
  const src = read(file);
  assert.ok(!/modifierId\s*===/.test(src), `game system must not special-case modifier ids: ${file}`);
  assert.ok(!/room\.id\s*===/.test(src), `game system must not special-case room ids: ${file}`);
}

console.log('v39.1.0 architecture split checks passed');
