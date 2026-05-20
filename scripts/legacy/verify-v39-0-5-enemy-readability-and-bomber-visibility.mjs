import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';
import { ENEMIES, ENEMY_WAVES } from '../src/data/enemies.js';
import { ROOM_SEQUENCE, RARE_ROOMS } from '../src/data/rooms.js';
import { ENCOUNTER_PLANS } from '../src/data/encounters.js';
import { EFFECT_RENDERERS } from '../src/render/effectRenderers.js';
import { ENEMY_RENDERERS } from '../src/render/enemyRenderers.js';
import { RARE_ROOM_RULES, getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation } from '../src/game/roomFlow.js';
import { spawnEnemy, updateEnemies, updateSpawner } from '../src/game/enemies.js';
import { resolveEnemyBehavior, unknownEnemyBehaviors } from '../src/game/enemyBehaviors.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

assert.equal(VERSION, 'v39.0.5');
assert.equal(BUILD_ID, 'v39.0.5-20260520');

const pkg = readJson('package.json');
assert.equal(pkg.version, '39.0.5');
assert.equal(readJson('server/package.json').version, '39.0.5');
assert.equal(readJson('src/package.json').version, '39.0.5');
assert.equal(readJson('release.json').version, 'v39.0.5');
assert.equal(readJson('release.json').notes, 'v39.0.5 enemy readability and bomber visibility: simpler behavior-first silhouettes, stage pools, and data-driven scripted bomber opener');
assert.equal(pkg.scripts['check:v39-0-5'], 'node scripts/verify-v39-0-5-enemy-readability-and-bomber-visibility.mjs');
assert.ok(pkg.scripts['check:all'].includes('check:v39-0-5'), 'check:all must include current migration guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-0-4'), 'check:all must not keep previous exact guard');
assert.ok(!exists('scripts/verify-v39-0-4-bomber-enemy-and-visual-pass.mjs'), 'previous exact guard must be archived out of root scripts');
assert.ok(exists('scripts/legacy/verify-v39-0-4-bomber-enemy-and-visual-pass.mjs'), 'previous exact guard should be archived');

assert.deepEqual(ROOM_SEQUENCE.map((room) => room.id), ['grid-00', 'void-01', 'core-02', 'boss-03'], 'base cadence must remain stable');
assert.deepEqual(RARE_ROOMS.map((room) => room.id), ['reward-cache-00', 'static-field-00'], 'v39 rare rooms must remain controlled');
assert.deepEqual(RARE_ROOM_RULES.map((rule) => rule.id), ['first_loop_reward_cache', 'first_loop_static_field'], 'v39 rare rules must remain one-shot and explicit');
assert.deepEqual(ENEMY_WAVES, ['grunt', 'runner', 'grunt', 'shooter', 'tank'], 'global baseline enemy wave must not silently gain bomber or charger');

assert.ok(ENEMIES.charger && ENEMIES.bomber, 'charger and bomber definitions must exist');
assert.equal(ENEMIES.charger.behavior, 'charger');
assert.equal(ENEMIES.bomber.behavior, 'bomber');
assert.equal(ENEMIES.charger.renderStyle, 'charger');
assert.equal(ENEMIES.bomber.renderStyle, 'bomber');
assert.equal(ENEMIES.charger.accentColor, 'red');
assert.equal(ENEMIES.bomber.accentColor, 'red');
assert.equal(ENEMIES.charger.hp, 52, 'charger should be a lighter dash threat, not a tank');
assert.equal(ENEMIES.charger.charge.damage, 19, 'charger danger should live in the charge, matching its wedge design');
assert.equal(ENEMIES.bomber.hp, 36, 'bomber should be fragile because its design says volatile bomb');
assert.equal(ENEMIES.bomber.speed, 54, 'bomber should be slower than runner/charger');
assert.equal(ENEMIES.bomber.bomb.fuse, 0.82, 'bomber fuse must come from enemy data');
assert.equal(ENEMIES.bomber.bomb.explosionRadius, 96, 'bomber explosion radius must come from enemy data');
assert.equal(typeof resolveEnemyBehavior(ENEMIES.charger), 'function', 'charger behavior must resolve through registry');
assert.equal(typeof resolveEnemyBehavior(ENEMIES.bomber), 'function', 'bomber behavior must resolve through registry');
assert.deepEqual(unknownEnemyBehaviors(ENEMIES), [], 'every enemy kind must have a registered behavior');

assert.equal(EFFECT_RENDERERS.chargeTelegraph instanceof Function, true, 'charger telegraph must render through effect registry');
assert.equal(EFFECT_RENDERERS.bomberFuse instanceof Function, true, 'bomber fuse must render through effect registry');
assert.equal(ENEMY_RENDERERS.charger instanceof Function, true, 'charger sprite must render through enemy renderer registry');
assert.equal(ENEMY_RENDERERS.bomber instanceof Function, true, 'bomber sprite must render through enemy renderer registry');

const staticField = RARE_ROOMS.find((room) => room.id === 'static-field-00');
assert.deepEqual(staticField.enemyPool, ['runner', 'charger', 'bomber', 'shooter', 'tank'], 'static-field room pool should list both new enemies once');
const staticPlan = ENCOUNTER_PLANS.static_field_event;
const warmup = staticPlan.stages.find((stage) => stage.id === 'static-field-warmup');
const pressure = staticPlan.stages.find((stage) => stage.id === 'static-field-pressure');
assert.deepEqual(warmup.enemyPool, ['bomber', 'runner', 'bomber'], 'warmup stage should visibly bias bomber without changing global room pool');
assert.ok(warmup.scriptedSpawns.some((spawn) => spawn.kind === 'bomber' && spawn.id === 'static-field-first-bomber'), 'static field must have a data-driven scripted bomber opener');
assert.deepEqual(pressure.enemyPool, ['charger', 'bomber', 'bomber', 'runner', 'shooter', 'tank'], 'pressure stage should weight charger/bomber as event identity');

const ids = [];
for (let depth = 0; depth < 8; depth += 1) {
  const plan = resolveRoomPlan(depth);
  const loc = getLocationFromRoomPlan(plan);
  ids.push(loc.id);
}
assert.deepEqual(ids, ['grid-00', 'void-01', 'core-02', 'boss-03', 'reward-cache-00', 'void-01', 'static-field-00', 'boss-03']);

const state = createGameState('V39-BOMBER-VISIBLE');
addPlayer(state, 'p1', 0);
for (let i = 0; i < 6; i += 1) beginRoomTransition(state, 'verify-v39-bomber-visible', { offerUpgrades: false });
assert.equal(currentLocation(state).id, 'static-field-00');
assert.equal(state.roomPlan.baseRoomId, 'core-02');
assert.equal(state.roomPlan.resolvedRoomId, 'static-field-00');
assert.equal(state.roomPlan.ruleId, 'first_loop_static_field');

state.players.p1.x = 900;
state.players.p1.y = 760;
state.locationTime = 0.5;
state.director.spawnTimer = 99;
updateSpawner(state, 0.016);
assert.ok(Object.values(state.enemies).some((enemy) => enemy.kind === 'bomber'), 'static field should spawn a visible scripted bomber opener before random selection can hide it');

const manualState = createGameState('V39-BOMBER-PIPELINE');
addPlayer(manualState, 'p1', 0);
manualState.players.p1.x = 1000;
manualState.players.p1.y = 800;
manualState.players.p1.hp = 100;
const bomber = spawnEnemy(manualState, 'bomber', 1070, 800, { role: 'verify' });
assert.ok(bomber, 'bomber should spawn through normal spawnEnemy path');
assert.equal(bomber.kind, 'bomber');
assert.equal(bomber.hp, ENEMIES.bomber.hp);

updateEnemies(manualState, 0.016);
assert.equal(bomber.bombState.phase, 'fuse', 'bomber should enter fuse when close to player');
assert.ok(manualState.effects.some((fx) => fx.type === 'bomberFuse'), 'fuse should emit visual warning through pushVisualEffect');
assert.equal(manualState.players.p1.hp, 100, 'fuse must not damage player immediately');

manualState.time += 0.9;
updateEnemies(manualState, 0.9);
assert.ok(manualState.players.p1.hp < 100, 'bomber explosion should damage player through the player damage pipeline');
assert.ok(!manualState.enemies[bomber.id], 'bomber should remove itself through enemy kill finalizer after exploding');
assert.ok(manualState.effects.some((fx) => fx.type === 'explosion' && fx.color === '#ff3048'), 'bomber explosion should emit red explosion visual');

const snap = makeSnapshot(state);
assert.equal(snap.location.resolvedRoomId, 'static-field-00');
assert.equal(snap.location.ruleId, 'first_loop_static_field');

const directorSrc = read('src/game/director.js');
assert.ok(directorSrc.includes('stage?.enemyPool'), 'director should support stage-level enemy pools, not only room-level pools');
assert.ok(directorSrc.includes('planStageScriptedSpawnCommands'), 'director should support data-driven scripted stage spawns');
assert.ok(!/static-field/.test(directorSrc), 'director must not special-case static-field by id');

const behaviorSrc = read('src/game/enemyBehaviors.js');
assert.ok(behaviorSrc.includes('bomber: updateBomberEnemy'), 'bomber must be registered in enemy behavior registry');
assert.ok(behaviorSrc.includes('finishEnemyKill(state, enemy'), 'bomber self-destruction must use enemy kill finalizer');
assert.ok(behaviorSrc.includes('dealPlayerDamage(state, player'), 'bomber explosion must use dealPlayerDamage');
assert.ok(!/player\.hp\s*[-+]?=/.test(behaviorSrc), 'enemy behaviors must not mutate player hp directly');
assert.ok(!/state\.effects\.push/.test(behaviorSrc), 'enemy behaviors must not push visual effects directly');
assert.ok(behaviorSrc.includes('pushVisualEffect(state'), 'enemy visuals must use visual effect helper');

const renderSrc = read('src/renderer.js');
assert.ok(renderSrc.includes('drawEnemySprite'), 'renderer should delegate enemy silhouettes to render helper');
const enemyRenderSrc = read('src/render/enemyRenderers.js');
assert.ok(enemyRenderSrc.includes('baseline: plain square'), 'grunt design should stay simple baseline');
assert.ok(enemyRenderSrc.includes('charge: red wedge/arrow silhouette'), 'charger design should communicate dash behavior');
assert.ok(enemyRenderSrc.includes('explosion: fuse + danger radius marker'), 'bomber design should communicate explosion behavior');
assert.ok(!enemyRenderSrc.includes('corner_random'), 'renderer must not know spawn/content rules');

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.0.5"'), 'server version must match v39.0.5');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.0.5-20260520"'), 'server build must match v39.0.5 build');
assert.ok(server.includes('HEARTBEAT_INTERVAL_MS'), 'v38.14.6 heartbeat hardening must remain');
assert.ok(server.includes('notifyPlayerLeft(room, id, "stale_socket")'), 'stale socket player-left notification must remain');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-0-5.js?v=39.0.5'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.0.5 | BUILD 20260520'), 'HUD must expose v39.0.5');
assert.ok(exists('src/main.v39-0-5.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-0-4.js'), 'previous versioned entry must not ship');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-0-5.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-0-4.js`), `previous versioned app module should not ship: ${name}`);
}

for (const file of fs.readdirSync(path.join(root, 'src/game')).filter((name) => name.endsWith('.js'))) {
  const src = read(`src/game/${file}`);
  assert.ok(!/modifierId\s*===/.test(src), `game system must not special-case modifier ids: ${file}`);
  assert.ok(!/room\.id\s*===/.test(src), `game system must not special-case room ids: ${file}`);
}

console.log('v39.0.5 enemy readability + bomber visibility checks passed');
