import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';
import { ENEMIES, ENEMY_WAVES } from '../src/data/enemies.js';
import { EFFECT_RENDERERS } from '../src/render/effectRenderers.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { spawnEnemy, updateEnemies } from '../src/game/enemies.js';
import { updateProjectiles, makeEnemyProjectile } from '../src/game/projectiles.js';
import { resolveEnemyBehavior, unknownEnemyBehaviors } from '../src/game/enemyBehaviors.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

assert.equal(VERSION, 'v39.0.6');
assert.equal(BUILD_ID, 'v39.0.6-20260520');

const pkg = readJson('package.json');
assert.equal(pkg.version, '39.0.6');
assert.equal(readJson('server/package.json').version, '39.0.6');
assert.equal(readJson('src/package.json').version, '39.0.6');
assert.equal(readJson('release.json').version, 'v39.0.6');
assert.equal(readJson('release.json').notes, 'v39.0.6 shooter ranged attack: host-owned enemy projectiles through projectile/player damage pipeline');
assert.equal(pkg.scripts['check:v39-0-6'], 'node scripts/verify-v39-0-6-shooter-ranged-attack.mjs');
assert.ok(pkg.scripts['check:all'].includes('check:v39-0-6'), 'check:all must include current migration guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-0-5'), 'check:all must not keep previous exact guard');
assert.ok(!exists('scripts/verify-v39-0-5-enemy-readability-and-bomber-visibility.mjs'), 'previous exact guard must be archived out of root scripts');
assert.ok(exists('scripts/legacy/verify-v39-0-5-enemy-readability-and-bomber-visibility.mjs'), 'previous exact guard should be archived');

assert.deepEqual(ENEMY_WAVES, ['grunt', 'runner', 'grunt', 'shooter', 'tank'], 'baseline enemy waves may contain shooter but must not silently gain new v39 enemies');
assert.ok(ENEMIES.shooter, 'shooter enemy definition must exist');
assert.equal(ENEMIES.shooter.behavior, 'ranged');
assert.equal(ENEMIES.shooter.renderStyle, 'shooter');
assert.equal(ENEMIES.shooter.accentColor, 'green');
assert.ok(ENEMIES.shooter.ranged, 'shooter must have ranged data, not only a ranged-looking sprite');
assert.equal(ENEMIES.shooter.ranged.projectileDamage, 9, 'shooter projectile damage must come from enemy data');
assert.equal(ENEMIES.shooter.ranged.cooldown, 1.15, 'shooter cooldown must come from enemy data');
assert.equal(typeof resolveEnemyBehavior(ENEMIES.shooter), 'function', 'shooter behavior must resolve through registry');
assert.deepEqual(unknownEnemyBehaviors(ENEMIES), [], 'every enemy kind must have a registered behavior');
assert.equal(EFFECT_RENDERERS.enemyMuzzle instanceof Function, true, 'shooter muzzle effect must render through effect registry');
assert.equal(typeof makeEnemyProjectile, 'function', 'projectile module must expose enemy projectile factory');

const state = createGameState('V39-SHOOTER');
addPlayer(state, 'p1', 0);
const player = state.players.p1;
player.x = 1160;
player.y = 800;
player.hp = 100;
const shooter = spawnEnemy(state, 'shooter', 800, 800, { role: 'verify' });
assert.ok(shooter, 'shooter should spawn through normal spawnEnemy path');
assert.equal(shooter.kind, 'shooter');

updateEnemies(state, 0.4);
const hostile = Object.values(state.projectiles).find((p) => p.ownerType === 'enemy' && p.hostile && p.kind === 'enemyBullet');
assert.ok(hostile, 'shooter must fire a host-owned hostile projectile');
assert.equal(hostile.ownerId, shooter.id, 'enemy projectile should carry shooter as ownerId');
assert.equal(hostile.weaponId, 'enemy_shot', 'enemy projectile should not masquerade as a player weapon');
assert.equal(hostile.damage, ENEMIES.shooter.ranged.projectileDamage, 'enemy projectile damage should use shooter data');
assert.ok(state.effects.some((fx) => fx.type === 'enemyMuzzle'), 'shooting should emit a readable muzzle visual through pushVisualEffect');

for (let i = 0; i < 12; i += 1) updateProjectiles(state, 0.08);
assert.ok(player.hp < 100, 'enemy projectile must damage player through projectile/player damage pipeline');
assert.ok(!state.projectiles[hostile.id], 'enemy projectile should be removed after hitting player');

const snap = makeSnapshot(state);
assert.ok(snap.projectiles.every((p) => p.kind !== 'enemyBullet') || player.hp < 100, 'snapshot may carry hostile projectiles while in flight as ordinary projectiles');

const behaviorSrc = read('src/game/enemyBehaviors.js');
assert.ok(behaviorSrc.includes('function updateRangedEnemy'), 'ranged behavior must remain behavior-registry code');
assert.ok(behaviorSrc.includes('makeEnemyProjectile'), 'ranged behavior should create host-owned enemy projectiles through projectile factory');
assert.ok(behaviorSrc.includes('firstSolidWallHitInLocation'), 'shooter should respect line-of-fire walls');
assert.ok(!/player\.hp\s*[-+]?=/.test(behaviorSrc), 'enemy behavior must not mutate player hp directly');
assert.ok(!/state\.effects\.push/.test(behaviorSrc), 'enemy behavior must not push visual effects directly');
assert.ok(behaviorSrc.includes('pushVisualEffect(state'), 'shooter muzzle must use visual effect helper');

const projectileSrc = read('src/game/projectiles.js');
assert.ok(projectileSrc.includes('function updateHostileProjectile'), 'projectile system must own hostile projectile updates');
assert.ok(projectileSrc.includes('dealPlayerDamage(state, player'), 'hostile projectiles must damage players through dealPlayerDamage');
assert.ok(projectileSrc.includes('ownerType: "enemy"'), 'enemy projectile factory must mark owner type');
assert.ok(!/player\.hp\s*[-+]?=/.test(projectileSrc), 'projectile system must not mutate player hp directly');

const rendererSrc = read('src/renderer.js');
assert.ok(rendererSrc.includes('p.kind === "enemyBullet"'), 'renderer must draw enemy bullets distinctly');
assert.ok(rendererSrc.includes('p.color === "red"'), 'renderer must support hostile red projectiles');

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.0.6"'), 'server version must match v39.0.6');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.0.6-20260520"'), 'server build must match v39.0.6 build');
assert.ok(server.includes('HEARTBEAT_INTERVAL_MS'), 'v38.14.6 heartbeat hardening must remain');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-0-6.js?v=39.0.6'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.0.6 | BUILD 20260520'), 'HUD must expose v39.0.6');
assert.ok(exists('src/main.v39-0-6.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-0-5.js'), 'previous versioned entry must not ship');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-0-6.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-0-5.js`), `previous versioned app module should not ship: ${name}`);
}

for (const file of fs.readdirSync(path.join(root, 'src/game')).filter((name) => name.endsWith('.js'))) {
  const src = read(`src/game/${file}`);
  assert.ok(!/modifierId\s*===/.test(src), `game system must not special-case modifier ids: ${file}`);
  assert.ok(!/room\.id\s*===/.test(src), `game system must not special-case room ids: ${file}`);
}

console.log('v39.0.6 shooter ranged attack checks passed');
