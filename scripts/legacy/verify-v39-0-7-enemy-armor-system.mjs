import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';
import { ENEMIES, ENEMY_WAVES } from '../src/data/enemies.js';
import { ENEMY_RENDERERS } from '../src/render/enemyRenderers.js';
import { EFFECT_RENDERERS } from '../src/render/effectRenderers.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { spawnEnemy, updateEnemies } from '../src/game/enemies.js';
import { updateProjectiles, makeProjectile } from '../src/game/projectiles.js';
import { dealDamage, DAMAGE_TAGS } from '../src/game/effects.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

assert.equal(VERSION, 'v39.0.7');
assert.equal(BUILD_ID, 'v39.0.7-20260520');

const pkg = readJson('package.json');
assert.equal(pkg.version, '39.0.7');
assert.equal(readJson('server/package.json').version, '39.0.7');
assert.equal(readJson('src/package.json').version, '39.0.7');
assert.equal(readJson('release.json').version, 'v39.0.7');
assert.equal(readJson('release.json').notes, 'v39.0.7 enemy armor system: regenerating armor, projectile ricochet, and simplified role-readable enemy silhouettes');
assert.equal(pkg.scripts['check:v39-0-7'], 'node scripts/verify-v39-0-7-enemy-armor-system.mjs');
assert.ok(pkg.scripts['check:all'].includes('check:v39-0-7'), 'check:all must include current migration guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-0-6'), 'check:all must not keep previous exact guard');
assert.ok(!exists('scripts/verify-v39-0-6-shooter-ranged-attack.mjs'), 'previous exact guard must be archived out of root scripts');
assert.ok(exists('scripts/legacy/verify-v39-0-6-shooter-ranged-attack.mjs'), 'previous exact guard should be archived');

assert.deepEqual(ENEMY_WAVES, ['grunt', 'runner', 'grunt', 'shooter', 'tank'], 'baseline enemy waves stay stable');
assert.equal(ENEMIES.runner.radius, 16, 'runner should now read as a larger simple square');
assert.equal(ENEMIES.shooter.accentColor, 'white', 'shooter should not rely on an extra color accent');
assert.ok(ENEMIES.tank.armor, 'tank must own armor through enemy data');
assert.ok(ENEMIES.boss.armor, 'boss must own stronger armor through enemy data');
assert.equal(ENEMIES.tank.armor.regenDelay, 3.2, 'tank armor regen delay must be data-driven');
assert.equal(ENEMIES.boss.armor.regenDelay, 4.4, 'boss armor regen delay must be data-driven');
assert.equal(ENEMIES.tank.armor.ricochet, true, 'tank armor should ricochet bullets while alive');
assert.equal(ENEMY_RENDERERS.tank instanceof Function, true, 'tank sprite must render through enemy renderer registry');
assert.equal(ENEMY_RENDERERS.boss instanceof Function, true, 'boss sprite must render through enemy renderer registry');
assert.equal(EFFECT_RENDERERS.armorHit instanceof Function, true, 'armor hit visual must render through effect registry');
assert.equal(EFFECT_RENDERERS.armorBreak instanceof Function, true, 'armor break visual must render through effect registry');
assert.equal(EFFECT_RENDERERS.armorRegen instanceof Function, true, 'armor regen visual must render through effect registry');

const state = createGameState('V39-ARMOR');
const player = addPlayer(state, 'p1', 0);
player.x = 500;
player.y = 800;
player.angle = 0;
const tank = spawnEnemy(state, 'tank', 900, 800, { role: 'verify' });
assert.ok(tank.armor, 'spawnEnemy should initialize armor runtime from enemy data');
assert.equal(tank.armor.hp, ENEMIES.tank.armor.hp);
const tankHpBefore = tank.hp;

const first = dealDamage(state, tank, { amount: 10, sourceId: 'p1', tags: [DAMAGE_TAGS.PROJECTILE, DAMAGE_TAGS.DIRECT] });
assert.equal(first.armorHit, true, 'projectile damage should hit armor before hp');
assert.equal(first.done, 0, 'armor absorption must not damage hp');
assert.equal(tank.hp, tankHpBefore, 'tank hp should stay unchanged while armor is alive');
assert.equal(tank.armor.hp, ENEMIES.tank.armor.hp - 10);
assert.ok(tank.armor.regenCooldown > 0, 'armor hit should delay regeneration');

for (let i = 0; i < 8; i += 1) updateEnemies(state, 0.5);
assert.ok(tank.armor.hp > ENEMIES.tank.armor.hp - 10, 'armor should regenerate after not being hit for long enough');
assert.ok(tank.armor.hp <= tank.armor.maxHp, 'armor regen must not exceed max');

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
assert.ok(projectileSrc.includes('ricochetProjectileFromArmor'), 'projectile hit path must ricochet from live armor');
assert.ok(!/enemy\.kind\s*===\s*["']tank/.test(projectileSrc), 'projectile armor behavior must not special-case tank');
assert.ok(!/enemy\.kind\s*===\s*["']boss/.test(projectileSrc), 'projectile armor behavior must not special-case boss');

const rendererSrc = read('src/render/enemyRenderers.js');
assert.ok(rendererSrc.includes('function drawArmorSquare'), 'armor visual should be data/snapshot-driven');
assert.ok(rendererSrc.includes('function drawShooter'), 'shooter visual contract should remain explicit');
assert.ok(rendererSrc.includes('s.x - r - 4, s.y - r - 4'), 'shooter should be diagonal crosshair');
assert.ok(rendererSrc.includes('function drawCharger'), 'charger visual contract should remain explicit');
assert.ok(!rendererSrc.includes('s.x - r - 6, s.y - 5'), 'runner should no longer have decorative speed ticks');

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.0.7"'), 'server version must match v39.0.7');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.0.7-20260520"'), 'server build must match v39.0.7 build');
assert.ok(server.includes('HEARTBEAT_INTERVAL_MS'), 'v38.14.6 heartbeat hardening must remain');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-0-7.js?v=39.0.7'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.0.7 | BUILD 20260520'), 'HUD must expose v39.0.7');
assert.ok(exists('src/main.v39-0-7.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-0-6.js'), 'previous versioned entry must not ship');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-0-7.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-0-6.js`), `previous versioned app module should not ship: ${name}`);
}

for (const file of fs.readdirSync(path.join(root, 'src/game')).filter((name) => name.endsWith('.js'))) {
  const src = read(`src/game/${file}`);
  assert.ok(!/modifierId\s*===/.test(src), `game system must not special-case modifier ids: ${file}`);
  assert.ok(!/room\.id\s*===/.test(src), `game system must not special-case room ids: ${file}`);
}

console.log('v39.0.7 enemy armor system checks passed');
