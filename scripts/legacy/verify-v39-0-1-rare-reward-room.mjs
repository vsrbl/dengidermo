import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../src/core/constants.js';
import { ROOM_SEQUENCE, RARE_ROOMS, ALL_ROOMS } from '../src/data/rooms.js';
import { ENCOUNTER_PLANS } from '../src/data/encounters.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { RARE_ROOM_RULES, getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));
const exists = (rel) => fs.existsSync(path.join(root, rel));

assert.equal(VERSION, 'v39.0.1');
assert.equal(BUILD_ID, 'v39.0.1-20260520');

const pkg = readJson('package.json');
assert.equal(pkg.version, '39.0.1');
assert.equal(readJson('server/package.json').version, '39.0.1');
assert.equal(readJson('src/package.json').version, '39.0.1');
assert.equal(readJson('release.json').version, 'v39.0.1');
assert.equal(readJson('release.json').notes, 'v39.0.1 rare reward room: first-loop reward cache via runPlanner rare rule and reward encounter contract');

assert.equal(pkg.scripts['check:content-foundation'], 'node scripts/verify-content-foundation.mjs');
assert.equal(pkg.scripts['check:v39-0-1'], 'node scripts/verify-v39-0-1-rare-reward-room.mjs');
assert.ok(pkg.scripts['check:all'].includes('check:content-foundation'), 'check:all must include content foundation verification');
assert.ok(pkg.scripts['check:all'].includes('check:v39-0-1'), 'check:all must include current migration guard');
assert.ok(!pkg.scripts['check:all'].includes('check:v39-0-0'), 'check:all must not keep previous exact guard');
assert.ok(!pkg.scripts['check:all'].includes('check:pre-content'), 'check:all must not keep pre-content audit after content starts');

assert.deepEqual(ROOM_SEQUENCE.map((room) => room.id), ['grid-00', 'void-01', 'core-02', 'boss-03'], 'base cadence must remain stable');
assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'core-02')?.layout, 'twin_pillars', 'v39.0.0 controlled layout must remain active');
assert.equal(RARE_ROOMS.length, 1, 'v39.0.1 should ship exactly one rare room');
assert.equal(RARE_ROOMS[0].id, 'reward-cache-00');
assert.equal(RARE_ROOMS[0].category, 'reward');
assert.equal(RARE_ROOMS[0].encounter, 'reward_cache');
assert.equal(ALL_ROOMS.some((room) => room.id === 'reward-cache-00'), true, 'all-room registry must resolve rare reward room');

assert.equal(RARE_ROOM_RULES.length, 1, 'one rare rule must be active');
assert.equal(RARE_ROOM_RULES[0].id, 'first_loop_reward_cache');
assert.equal(RARE_ROOM_RULES[0].kind, 'replace');
assert.equal(RARE_ROOM_RULES[0].resolvedRoomId, 'reward-cache-00');
assert.deepEqual(RARE_ROOM_RULES[0].when, { loopIndex: 1, roomInLoop: 0 });

const firstRewardPlan = resolveRoomPlan(4);
const firstRewardLoc = getLocationFromRoomPlan(firstRewardPlan);
assert.equal(firstRewardPlan.baseRoomId, 'grid-00', 'rare replacement must preserve base room identity');
assert.equal(firstRewardPlan.resolvedRoomId, 'reward-cache-00', 'rare replacement must resolve reward room');
assert.equal(firstRewardPlan.ruleId, 'first_loop_reward_cache');
assert.equal(firstRewardPlan.rare, true);
assert.equal(firstRewardPlan.loopIndex, 1);
assert.equal(firstRewardPlan.roomInLoop, 0);
assert.equal(firstRewardLoc.category, 'reward');
assert.equal(firstRewardLoc.encounterId, 'reward_cache');
assert.equal(firstRewardLoc.layoutId, 'open_arena');
assert.deepEqual(firstRewardLoc.modifierIds, ['reward_cache']);
assert.equal(firstRewardLoc.enemyPool.length, 0, 'reward cache must not have an enemy pool');
assert.equal(firstRewardLoc.portalDelay, 1.2, 'reward cache should be quick but still objective-gated');
assert.equal(firstRewardLoc.portalTargetDepth, 5, 'reward cache should continue to next run depth');

assert.equal(getLocationFromRoomPlan(resolveRoomPlan(8)).id, 'grid-00', 'rare reward rule should be one-shot, not every loop');
assert.ok(ENCOUNTER_PLANS.reward_cache, 'reward encounter must be registered');
assert.equal(ENCOUNTER_PLANS.reward_cache.stages.every((stage) => stage.canSpawn === false), true, 'reward encounter must not spawn');
assert.equal(ROOM_MODIFIERS.reward_cache.category, 'identity', 'reward modifier is identity-only in this pass');
assert.deepEqual(ROOM_MODIFIERS.reward_cache.hooks, {}, 'reward modifier must not sneak in gameplay hooks');

const server = read('server/server.js');
assert.ok(server.includes('const SERVER_VERSION = "v39.0.1"'), 'server version must match v39.0.1');
assert.ok(server.includes('const SERVER_BUILD_ID = "v39.0.1-20260520"'), 'server build must match v39.0.1 build');
assert.ok(server.includes('HEARTBEAT_INTERVAL_MS'), 'v38.14.6 heartbeat hardening must remain');
assert.ok(server.includes('notifyPlayerLeft(room, id, "stale_socket")'), 'stale socket player-left notification must remain');

const index = read('index.html');
assert.ok(index.includes('src/main.v39-0-1.js?v=39.0.1'), 'index must use current cache-busted entry');
assert.ok(index.includes('V39.0.1 | BUILD 20260520'), 'HUD must expose v39.0.1');
assert.ok(exists('src/main.v39-0-1.js'), 'current versioned entry must exist');
assert.ok(!exists('src/main.v39-0-0.js'), 'previous versioned entry must not ship');
for (const name of ['session', 'clientRuntime', 'hostRuntime', 'upgradeClient', 'devControls', 'releaseIntegrity']) {
  assert.ok(exists(`src/app/${name}.v39-0-1.js`), `current versioned app module missing: ${name}`);
  assert.ok(!exists(`src/app/${name}.v39-0-0.js`), `previous versioned app module should not ship: ${name}`);
}

console.log('v39.0.1 rare reward room checks passed');
