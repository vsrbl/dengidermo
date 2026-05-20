import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';
import { ENEMIES, ENEMY_WAVES } from '../src/data/enemies.js';
import { ROOM_SEQUENCE, RARE_ROOMS } from '../src/data/rooms.js';
import { EFFECT_RENDERERS } from '../src/render/effectRenderers.js';
import { ENCOUNTER_PLANS } from '../src/data/encounters.js';
import { RARE_ROOM_RULES, getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation } from '../src/game/roomFlow.js';
import { spawnEnemy, updateEnemies } from '../src/game/enemies.js';
import { resolveEnemyBehavior, unknownEnemyBehaviors } from '../src/game/enemyBehaviors.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

assert.equal(VERSION, 'v39.0.3');
assert.equal(BUILD_ID, 'v39.0.3-20260520');

const pkg = readJson('package.json');
assert.equal(pkg.version, '39.0.3');
assert.equal(readJson('server/package.json').version, '39.0.3');
assert.equal(readJson('src/package.json').version, '39.0.3');
assert.equal(readJson('release.json').version, 'v39.0.3');
assert.equal(readJson('release.json').notes, 'v39.0.3 charger enemy: behavior-registry enemy with telegraph dash, enabled only in static field pool');
assert.equal(pkg.scripts['check:v39-0-3'], 'node scripts/verify-v39-0-3-charger-enemy.mjs');
assert.ok(pkg.scripts['check:all'].includes('check:v39-0-3'), 'check:all must include current migration guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-0-2'), 'check:all must not keep previous exact guard');
assert.ok(!exists('scripts/verify-v39-0-2-cursed-event-room.mjs'), 'previous exact guard must be archived out of root scripts');
assert.ok(exists('scripts/legacy/verify-v39-0-2-cursed-event-room.mjs'), 'previous exact guard should be archived');

assert.deepEqual(ROOM_SEQUENCE.map((room) => room.id), ['grid-00', 'void-01', 'core-02', 'boss-03'], 'base cadence must remain stable');
assert.deepEqual(RARE_ROOMS.map((room) => room.id), ['reward-cache-00', 'static-field-00'], 'v39 rare rooms must remain controlled');
assert.deepEqual(RARE_ROOM_RULES.map((rule) => rule.id), ['first_loop_reward_cache', 'first_loop_static_field'], 'v39 rare rules must remain one-shot and explicit');
assert.deepEqual(ENEMY_WAVES, ['grunt', 'runner', 'grunt', 'shooter', 'tank'], 'global baseline enemy wave must not silently gain charger');

assert.ok(ENEMIES.charger, 'charger enemy definition must exist');
assert.equal(ENEMIES.charger.behavior, 'charger');
assert.equal(ENEMIES.charger.score, 2, 'charger should fit regular budget as a controlled mid-tier enemy');
assert.equal(ENEMIES.charger.charge.windup, 0.58, 'charger must telegraph before dash');
assert.equal(ENEMIES.charger.charge.speed, 720, 'charger dash speed must come from enemy data');
assert.equal(typeof resolveEnemyBehavior(ENEMIES.charger), 'function', 'charger behavior must resolve through registry');
assert.deepEqual(unknownEnemyBehaviors(ENEMIES), [], 'every enemy kind must have a registered behavior');
assert.equal(EFFECT_RENDERERS.chargeTelegraph instanceof Function, true, 'charger telegraph must render through effect registry');

const grid = ROOM_SEQUENCE.find((room) => room.id === 'grid-00');
const core = ROOM_SEQUENCE.find((room) => room.id === 'core-02');
const staticField = RARE_ROOMS.find((room) => room.id === 'static-field-00');
assert.ok(!Array.isArray(grid.enemyPool) || !grid.enemyPool.includes('charger'), 'starter room must not get charger by default');
assert.ok(!core.enemyPool.includes('charger'), 'wall-layout core test should stay isolated from charger behavior');
assert.deepEqual(staticField.enemyPool, ['runner', 'charger', 'shooter', 'tank'], 'charger should be enabled only in the static-field controlled pool');
assert.ok(ENCOUNTER_PLANS.static_field_event.stages.some((stage) => stage.canSpawn), 'static field must remain a real combat event');

const ids = [];
const ruleIds = [];
for (let depth = 0; depth < 8; depth += 1) {
  const plan = resolveRoomPlan(depth);
  const loc = getLocationFromRoomPlan(plan);
  ids.push(loc.id);
  ruleIds.push(plan.ruleId);
}
assert.deepEqual(ids, ['grid-00', 'void-01', 'core-02', 'boss-03', 'reward-cache-00', 'void-01', 'static-field-00', 'boss-03']);
assert.deepEqual(ruleIds, [null, null, null, null, 'first_loop_reward_cache', null, 'first_loop_static_field', null]);

const state = createGameState('V39-CHARGER');
addPlayer(state, 'p1', 0);
for (let i = 0; i < 6; i += 1) beginRoomTransition(state, 'verify-v39-charger', { offerUpgrades: false });
assert.equal(currentLocation(state).id, 'static-field-00');
assert.equal(state.roomPlan.baseRoomId, 'core-02');
assert.equal(state.roomPlan.resolvedRoomId, 'static-field-00');
assert.equal(state.roomPlan.ruleId, 'first_loop_static_field');

const player = state.players.p1;
player.x = 1120;
player.y = 800;
player.hp = 100;
const charger = spawnEnemy(state, 'charger', 900, 800, { role: 'verify' });
assert.ok(charger, 'charger should spawn through normal spawnEnemy path');
assert.equal(charger.kind, 'charger');
assert.equal(charger.hp, ENEMIES.charger.hp);

updateEnemies(state, 0.016);
assert.equal(charger.charge.phase, 'windup', 'charger should enter windup before dashing');
assert.ok(state.effects.some((fx) => fx.type === 'chargeTelegraph'), 'windup should emit visual telegraph through pushVisualEffect');
assert.equal(player.hp, 100, 'windup must not damage player before dash impact');

state.time += 0.6;
updateEnemies(state, 0.6);
assert.equal(charger.charge.phase, 'dash', 'charger should transition from windup into dash');
assert.ok(state.effects.some((fx) => fx.type === 'dashBurst'), 'dash start should emit a standard dashBurst visual');

for (let i = 0; i < 5; i += 1) {
  state.time += 0.08;
  updateEnemies(state, 0.08);
}
assert.ok(player.hp < 100, 'charger dash should damage player through the player damage pipeline');
const hpAfterFirstHit = player.hp;
for (let i = 0; i < 2; i += 1) {
  state.time += 0.04;
  updateEnemies(state, 0.04);
}
assert.equal(player.hp, hpAfterFirstHit, 'charger dash should not multi-hit the same player during one dash');
assert.ok(['dash', 'cooldown', 'chase'].includes(charger.charge.phase), 'charger runtime phase should remain explicit and bounded');

const snap = makeSnapshot(state);
assert.ok(snap.enemies.some((enemy) => enemy.kind === 'charger'), 'snapshot must carry charger as ordinary enemy kind');
assert.equal(snap.location.resolvedRoomId, 'static-field-00');
assert.equal(snap.location.ruleId, 'first_loop_static_field');

const behaviorSrc = read('src/game/enemyBehaviors.js');
assert.ok(behaviorSrc.includes('charger: updateChargerEnemy'), 'charger must be registered in enemy behavior registry');
assert.ok(behaviorSrc.includes('dealPlayerDamage(state, player'), 'charger impact must use dealPlayerDamage');
assert.ok(!/player\.hp\s*[-+]?=/.test(behaviorSrc), 'enemy behavior must not mutate player hp directly');
assert.ok(!/state\.effects\.push/.test(behaviorSrc), 'enemy behavior must not push visual effects directly');
assert.ok(behaviorSrc.includes('pushVisualEffect(state'), 'charger telegraph must use visual effect helper');

const rendererSrc = read('src/render/effectRenderers.js');
assert.ok(rendererSrc.includes('chargeTelegraph: drawChargeTelegraph'), 'charge telegraph should be routed through renderer effect registry');

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.0.3"'), 'server version must match v39.0.3');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.0.3-20260520"'), 'server build must match v39.0.3 build');
assert.ok(server.includes('HEARTBEAT_INTERVAL_MS'), 'v38.14.6 heartbeat hardening must remain');
assert.ok(server.includes('notifyPlayerLeft(room, id, "stale_socket")'), 'stale socket player-left notification must remain');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-0-3.js?v=39.0.3'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.0.3 | BUILD 20260520'), 'HUD must expose v39.0.3');
assert.ok(exists('src/main.v39-0-3.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-0-2.js'), 'previous versioned entry must not ship');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-0-3.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-0-2.js`), `previous versioned app module should not ship: ${name}`);
}

for (const file of fs.readdirSync(path.join(root, 'src/game')).filter((name) => name.endsWith('.js'))) {
  const src = read(`src/game/${file}`);
  assert.ok(!/modifierId\s*===/.test(src), `game system must not special-case modifier ids: ${file}`);
  assert.ok(!/room\.id\s*===/.test(src), `game system must not special-case room ids: ${file}`);
}

console.log('v39.0.3 charger enemy checks passed');
