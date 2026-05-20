import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';
import { ROOM_SEQUENCE, RARE_ROOMS, ALL_ROOMS } from '../src/data/rooms.js';
import { ENCOUNTER_PLANS } from '../src/data/encounters.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { RARE_ROOM_RULES, getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation } from '../src/game/roomFlow.js';
import { readDirectorEvaluation } from '../src/game/director.js';
import { runRoomModifierHooks, runRoomModifierHooksForLocation, ROOM_MODIFIER_HOOKS } from '../src/game/roomModifiers.js';
import { healPlayer } from '../src/game/effects.js';
import { spawnEnemy } from '../src/game/enemies.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

assert.equal(VERSION, 'v39.0.2');
assert.equal(BUILD_ID, 'v39.0.2-20260520');

const pkg = readJson('package.json');
assert.equal(pkg.version, '39.0.2');
assert.equal(readJson('server/package.json').version, '39.0.2');
assert.equal(readJson('src/package.json').version, '39.0.2');
assert.equal(readJson('release.json').version, 'v39.0.2');
assert.equal(readJson('release.json').notes, 'v39.0.2 cursed event room: first-loop static field via runPlanner rare rule and real room modifier hooks');

assert.equal(pkg.scripts['check:content-foundation'], 'node scripts/verify-content-foundation.mjs');
assert.equal(pkg.scripts['check:v39-0-2'], 'node scripts/verify-v39-0-2-cursed-event-room.mjs');
assert.ok(pkg.scripts['check:all'].includes('check:content-foundation'), 'check:all must include content foundation verification');
assert.ok(pkg.scripts['check:all'].includes('check:v39-0-2'), 'check:all must include current migration guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-0-1'), 'check:all must not keep previous exact guard');
assert.ok(!exists('scripts/verify-v39-0-1-rare-reward-room.mjs'), 'previous exact guard must be archived out of root scripts');
assert.ok(exists('scripts/legacy/verify-v39-0-1-rare-reward-room.mjs'), 'previous exact guard should be archived');

assert.deepEqual(ROOM_SEQUENCE.map((room) => room.id), ['grid-00', 'void-01', 'core-02', 'boss-03'], 'base cadence must remain stable');
assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'core-02')?.layout, 'twin_pillars', 'v39.0.0 controlled layout must remain active');
assert.deepEqual(RARE_ROOMS.map((room) => room.id), ['reward-cache-00', 'static-field-00']);
assert.equal(RARE_ROOMS.find((room) => room.id === 'reward-cache-00')?.category, 'reward');
assert.equal(RARE_ROOMS.find((room) => room.id === 'static-field-00')?.category, 'cursed');
assert.equal(RARE_ROOMS.find((room) => room.id === 'static-field-00')?.encounter, 'static_field_event');
assert.deepEqual(RARE_ROOMS.find((room) => room.id === 'static-field-00')?.modifiers, ['static_field']);
assert.equal(ALL_ROOMS.some((room) => room.id === 'static-field-00'), true, 'all-room registry must resolve cursed event room');

assert.deepEqual(RARE_ROOM_RULES.map((rule) => rule.id), ['first_loop_reward_cache', 'first_loop_static_field']);
assert.deepEqual(RARE_ROOM_RULES.find((rule) => rule.id === 'first_loop_reward_cache')?.when, { loopIndex: 1, roomInLoop: 0 });
assert.deepEqual(RARE_ROOM_RULES.find((rule) => rule.id === 'first_loop_static_field')?.when, { loopIndex: 1, roomInLoop: 2 });
assert.equal(RARE_ROOM_RULES.find((rule) => rule.id === 'first_loop_static_field')?.resolvedRoomId, 'static-field-00');

const expectedIds = [];
const expectedBaseIds = [];
const expectedRuleIds = [];
const expectedCategories = [];
for (let depth = 0; depth < 12; depth += 1) {
  const plan = resolveRoomPlan(depth);
  const loc = getLocationFromRoomPlan(plan);
  expectedIds.push(loc.id);
  expectedBaseIds.push(plan.baseRoomId);
  expectedRuleIds.push(plan.ruleId);
  expectedCategories.push(loc.category);
}
assert.deepEqual(expectedIds, ['grid-00', 'void-01', 'core-02', 'boss-03', 'reward-cache-00', 'void-01', 'static-field-00', 'boss-03', 'grid-00', 'void-01', 'core-02', 'boss-03']);
assert.deepEqual(expectedBaseIds, ['grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01', 'core-02', 'boss-03'], 'rare replacements must preserve base room identity');
assert.deepEqual(expectedRuleIds, [null, null, null, null, 'first_loop_reward_cache', null, 'first_loop_static_field', null, null, null, null, null], 'rare rules should be one-shot in first loop');
assert.equal(expectedCategories[6], 'cursed');

assert.ok(ENCOUNTER_PLANS.reward_cache, 'reward encounter must remain registered');
assert.ok(ENCOUNTER_PLANS.static_field_event, 'static field encounter must be registered');
assert.equal(ENCOUNTER_PLANS.static_field_event.objective, 'clear');
assert.equal(ENCOUNTER_PLANS.static_field_event.stages.at(-1).canOpenPortal, true, 'static field must expose a portal stage');
assert.equal(ENCOUNTER_PLANS.static_field_event.stages.some((stage) => stage.canSpawn), true, 'static field should be a real combat event, not another reward room');

assert.equal(ROOM_MODIFIERS.reward_cache.category, 'identity', 'reward modifier remains identity-only');
assert.deepEqual(ROOM_MODIFIERS.reward_cache.hooks, {}, 'reward modifier should not gain gameplay hooks');
assert.equal(ROOM_MODIFIERS.static_field.category, 'cursed');
assert.ok(Array.isArray(ROOM_MODIFIERS.static_field.hooks['enemy:update']), 'static field must use enemy:update hook');
assert.ok(Array.isArray(ROOM_MODIFIERS.static_field.hooks['player:heal']), 'static field must use player:heal hook');
assert.ok(Array.isArray(ROOM_MODIFIERS.static_field.hooks['render:background']), 'static field must use render background hook');

const staticPlan = resolveRoomPlan(6);
const staticLoc = getLocationFromRoomPlan(staticPlan);
assert.equal(staticPlan.baseRoomId, 'core-02');
assert.equal(staticPlan.resolvedRoomId, 'static-field-00');
assert.equal(staticPlan.ruleId, 'first_loop_static_field');
assert.equal(staticPlan.rare, true);
assert.equal(staticLoc.category, 'cursed');
assert.equal(staticLoc.encounterId, 'static_field_event');
assert.equal(staticLoc.layoutId, 'open_arena');
assert.deepEqual(staticLoc.modifierIds, ['static_field']);
assert.deepEqual(staticLoc.modifiers.map((modifier) => modifier.id), ['static_field']);

const renderCtx = runRoomModifierHooksForLocation(staticLoc, ROOM_MODIFIER_HOOKS.RENDER_BACKGROUND, { accent: 'green', gridStep: 80 });
assert.equal(renderCtx.accent, 'white', 'static field should visibly shift room background through render hook');
assert.equal(renderCtx.gridStep, 52, 'static field should alter background grid through render hook');

const state = createGameState('V39-STATIC-FIELD');
addPlayer(state, 'p1', 0);
for (let i = 0; i < 6; i += 1) beginRoomTransition(state, 'verify-v39-static-field', { offerUpgrades: false });
assert.equal(state.roomPlan.runDepth, 6);
assert.equal(currentLocation(state).id, 'static-field-00');
assert.equal(state.roomPlan.baseRoomId, 'core-02');
assert.equal(state.roomPlan.resolvedRoomId, 'static-field-00');
assert.equal(state.roomPlan.ruleId, 'first_loop_static_field');
assert.deepEqual(state.roomModifierIds, ['static_field']);

let evaluation = readDirectorEvaluation(state);
assert.equal(evaluation.encounterId, 'static_field_event');
assert.equal(evaluation.objective, 'clear');
assert.equal(evaluation.policy.canSpawn, true, 'static field event should spawn during early phase');
assert.equal(evaluation.policy.canOpenPortal, false);

const player = state.players.p1;
player.hp = 50;
const heal = healPlayer(state, player, { amount: 20, sourceType: 'verify-static-field' });
assert.equal(heal.done, 11, 'static field healing reduction must go through player:heal modifier hook');

const enemy = spawnEnemy(state, 'runner', null, null, { role: 'verify' });
assert.ok(enemy, 'static field should still allow enemy spawning');
assert.ok(enemy.speedMult >= 1, 'spawned enemy keeps speed multiplier field');
const enemyCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.ENEMY_UPDATE, { enemy, kind: enemy.kind, dt: 0.016, speedMult: 1, damageMult: 1, tags: [] });
assert.equal(Number(enemyCtx.speedMult.toFixed(3)), 1.1, 'static field enemy speed boost must go through enemy:update hook');

const snap = makeSnapshot(state);
assert.equal(snap.location.baseRoomId, 'core-02');
assert.equal(snap.location.resolvedRoomId, 'static-field-00');
assert.equal(snap.location.ruleId, 'first_loop_static_field');
assert.equal(snap.location.category, 'cursed');
assert.equal(snap.location.modifiers[0]?.id, 'static_field');
assert.equal(snap.location.modifiers[0]?.category, 'cursed');

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.0.2"'), 'server version must match v39.0.2');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.0.2-20260520"'), 'server build must match v39.0.2 build');
assert.ok(server.includes('HEARTBEAT_INTERVAL_MS'), 'v38.14.6 heartbeat hardening must remain');
assert.ok(server.includes('notifyPlayerLeft(room, id, "stale_socket")'), 'stale socket player-left notification must remain');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-0-2.js?v=39.0.2'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.0.2 | BUILD 20260520'), 'HUD must expose v39.0.2');
assert.ok(exists('src/main.v39-0-2.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-0-1.js'), 'previous versioned entry must not ship');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-0-2.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-0-1.js`), `previous versioned app module should not ship: ${name}`);
}

for (const file of fs.readdirSync(path.join(root, 'src/game')).filter((name) => name.endsWith('.js'))) {
  const src = read(`src/game/${file}`);
  assert.ok(!/modifierId\s*===/.test(src), `game system must not special-case modifier ids: ${file}`);
  assert.ok(!/room\.id\s*===/.test(src), `game system must not special-case room ids: ${file}`);
}

console.log('v39.0.2 cursed event room checks passed');
