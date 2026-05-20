import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOM_SEQUENCE, RARE_ROOMS, ALL_ROOMS } from '../src/data/rooms.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { ROOM_LAYOUTS, layoutIdentitySnapshot } from '../src/data/layouts.js';
import { ENCOUNTER_PLANS } from '../src/data/encounters.js';
import { RARE_ROOM_RULES, getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation } from '../src/game/roomFlow.js';
import { canOpenPortal, readDirectorEvaluation } from '../src/game/director.js';
import { roomGeometrySnapshotForState, roomLayoutMirrorMatchesState } from '../src/game/roomGeometry.js';
import { resolveSpawnPoint } from '../src/game/spawnZones.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

assert.equal(ROOM_SEQUENCE.length, 4, 'normal cadence must keep four base rooms');
assert.deepEqual(ROOM_SEQUENCE.map((room) => room.id), ['grid-00', 'void-01', 'core-02', 'boss-03'], 'normal cadence must stay grid -> void -> core -> boss');
assert.deepEqual(RARE_ROOMS.map((room) => room.id), ['reward-cache-00', 'static-field-00'], 'controlled v39 rare rooms must stay explicit and small');
assert.equal(RARE_ROOMS.find((room) => room.id === 'reward-cache-00')?.category, 'reward', 'reward cache must remain a reward room');
assert.equal(RARE_ROOMS.find((room) => room.id === 'static-field-00')?.category, 'cursed', 'static field must be the first cursed/event room');
assert.equal(ALL_ROOMS.length, ROOM_SEQUENCE.length + RARE_ROOMS.length, 'all room registry must include base and rare rooms');

assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'grid-00')?.layout, 'open_arena', 'starter room must stay open_arena');
assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'void-01')?.layout, 'open_arena', 'survive room must stay open_arena');
assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'core-02')?.layout, 'twin_pillars', 'core-02 is the controlled wall-layout entry point');
assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'boss-03')?.layout, 'open_arena', 'boss room must not inherit wall-layout test');
assert.equal(RARE_ROOMS.find((room) => room.id === 'reward-cache-00')?.layout, 'open_arena', 'first reward room should remain simple and wall-free');
assert.equal(RARE_ROOMS.find((room) => room.id === 'static-field-00')?.layout, 'open_arena', 'first cursed event should isolate modifier behavior from wall-layout behavior');

assert.deepEqual(RARE_ROOM_RULES.map((rule) => rule.id), ['first_loop_reward_cache', 'first_loop_static_field'], 'rare room rules should stay small and explicit');
assert.deepEqual(RARE_ROOM_RULES.find((rule) => rule.id === 'first_loop_reward_cache')?.when, { loopIndex: 1, roomInLoop: 0 }, 'reward cache should replace the first room after the first boss only');
assert.equal(RARE_ROOM_RULES.find((rule) => rule.id === 'first_loop_reward_cache')?.resolvedRoomId, 'reward-cache-00', 'reward rule must resolve through data');
assert.deepEqual(RARE_ROOM_RULES.find((rule) => rule.id === 'first_loop_static_field')?.when, { loopIndex: 1, roomInLoop: 2 }, 'static field should replace the first-loop core slot only');
assert.equal(RARE_ROOM_RULES.find((rule) => rule.id === 'first_loop_static_field')?.resolvedRoomId, 'static-field-00', 'static field rule must resolve through data');

assert.equal((ROOM_LAYOUTS.open_arena.walls || []).length, 0, 'open_arena must remain wall-free fallback baseline');
assert.equal((ROOM_LAYOUTS.open_arena.spawnAnchors || []).length, 0, 'open_arena must keep fallback spawn path');
assert.ok((ROOM_LAYOUTS.twin_pillars?.walls || []).length >= 2, 'twin_pillars must provide real solid obstacles');
assert.ok((ROOM_LAYOUTS.twin_pillars?.spawnAnchors || []).length >= 4, 'twin_pillars must provide spawn anchors');
assert.ok((ROOM_LAYOUTS.twin_pillars?.tags || []).includes('controlled'), 'active wall layout must be tagged controlled');
assert.ok(!(ROOM_LAYOUTS.twin_pillars?.tags || []).includes('future'), 'active wall layout must not remain future-tagged');
assert.ok((ROOM_LAYOUTS.split_lanes?.tags || []).includes('future'), 'split_lanes must remain reserved for a later pass');

assert.ok(ENCOUNTER_PLANS.reward_cache, 'reward cache encounter plan must exist');
assert.equal(ENCOUNTER_PLANS.reward_cache.director.minPressureBudget, 0, 'reward encounter must not force pressure budget');
assert.equal(ENCOUNTER_PLANS.reward_cache.stages.every((stage) => stage.canSpawn === false), true, 'reward encounter must not spawn enemies');
assert.equal(ENCOUNTER_PLANS.reward_cache.stages.at(-1).canOpenPortal, true, 'reward encounter must expose a portal stage');
assert.ok(ENCOUNTER_PLANS.static_field_event, 'static field encounter plan must exist');
assert.equal(ENCOUNTER_PLANS.static_field_event.stages.some((stage) => stage.canSpawn), true, 'static field event should spawn through director stages');
assert.equal(ENCOUNTER_PLANS.static_field_event.stages.at(-1).canOpenPortal, true, 'static field event must expose a portal stage');

const ids = [];
const baseIds = [];
const ruleIds = [];
const categories = [];
const layouts = [];
for (let depth = 0; depth < 10; depth += 1) {
  const plan = resolveRoomPlan(depth);
  const loc = getLocationFromRoomPlan(plan);
  ids.push(loc.id);
  baseIds.push(plan.baseRoomId);
  ruleIds.push(plan.ruleId);
  categories.push(loc.category);
  layouts.push(loc.layoutId);
}
assert.deepEqual(ids, ['grid-00', 'void-01', 'core-02', 'boss-03', 'reward-cache-00', 'void-01', 'static-field-00', 'boss-03', 'grid-00', 'void-01']);
assert.deepEqual(baseIds, ['grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01'], 'rare room must preserve base room identity');
assert.deepEqual(ruleIds, [null, null, null, null, 'first_loop_reward_cache', null, 'first_loop_static_field', null, null, null], 'rare room rules should be one-shot in first loop');
assert.equal(categories[4], 'reward', 'rare reward room must expose reward category');
assert.equal(categories[6], 'cursed', 'static field room must expose cursed category');
assert.deepEqual(layouts, ['open_arena', 'open_arena', 'twin_pillars', 'open_arena', 'open_arena', 'open_arena', 'open_arena', 'open_arena', 'open_arena', 'open_arena'], 'rare replacement layout activation must be roomPlan/data driven');

const state = createGameState('V39-CONTENT-FOUNDATION');
addPlayer(state, 'p1', 0);
assert.equal(currentLocation(state).layoutId, 'open_arena');
beginRoomTransition(state, 'verify-v39-foundation', { offerUpgrades: false });
assert.equal(currentLocation(state).id, 'void-01');
beginRoomTransition(state, 'verify-v39-foundation', { offerUpgrades: false });
assert.equal(state.roomPlan.resolvedRoomId, 'core-02');
assert.equal(state.roomPlan.layoutId, 'twin_pillars');
assert.equal(state.layoutId, 'twin_pillars', 'compatibility mirror must follow roomPlan after transition');
assert.equal(roomLayoutMirrorMatchesState(state), true, 'layout mirror must match roomPlan');

const geometry = roomGeometrySnapshotForState(state);
const identity = layoutIdentitySnapshot('twin_pillars');
assert.equal(geometry.layoutId, 'twin_pillars', 'state geometry must resolve through roomPlan layout');
assert.equal(geometry.layoutVersion, identity.layoutVersion);
assert.equal(geometry.geometryHash, identity.geometryHash);
assert.ok(geometry.walls.length >= 2, 'core room geometry snapshot must expose walls');
assert.ok(geometry.spawnAnchors.length >= 4, 'core room geometry snapshot must expose anchors');
const spawn = resolveSpawnPoint(state, 'edge_far', 13, { geometry });
assert.equal(spawn.fromAnchor, true, 'twin_pillars spawns should use layout anchors before fallback edge placement');

beginRoomTransition(state, 'verify-v39-foundation', { offerUpgrades: false });
assert.equal(currentLocation(state).id, 'boss-03');
beginRoomTransition(state, 'verify-v39-foundation', { offerUpgrades: false });
assert.equal(state.roomPlan.runDepth, 4);
assert.equal(state.roomPlan.baseRoomId, 'grid-00');
assert.equal(state.roomPlan.resolvedRoomId, 'reward-cache-00');
assert.equal(state.roomPlan.ruleId, 'first_loop_reward_cache');
assert.equal(state.roomPlan.rare, true);
assert.equal(state.roomPlan.category, 'reward');
assert.equal(state.roomPlan.layoutId, 'open_arena');
assert.deepEqual(state.roomModifierIds, ['reward_cache']);
assert.equal(Object.keys(state.enemies).length, 0, 'reward room starts with no enemies');
let evaluation = readDirectorEvaluation(state);
assert.equal(evaluation.encounterId, 'reward_cache');
assert.equal(evaluation.policy.canSpawn, false, 'reward room director must not spawn');
assert.equal(canOpenPortal(state), false, 'reward portal should wait for its short delay');
state.locationTime = state.portalReadyAt;
evaluation = readDirectorEvaluation(state);
assert.equal(evaluation.phase, 'portal');
assert.equal(evaluation.policy.canOpenPortal, true, 'reward portal should open after the delay with zero hostiles');
assert.equal(canOpenPortal(state), true);
const snap = makeSnapshot(state);
assert.equal(snap.location.baseRoomId, 'grid-00');
assert.equal(snap.location.resolvedRoomId, 'reward-cache-00');
assert.equal(snap.location.ruleId, 'first_loop_reward_cache');
assert.equal(snap.location.category, 'reward');
assert.equal(snap.location.layoutId, 'open_arena');
assert.equal(snap.location.modifiers[0]?.id, 'reward_cache');

beginRoomTransition(state, 'verify-v39-foundation', { offerUpgrades: false });
assert.equal(currentLocation(state).id, 'void-01');
beginRoomTransition(state, 'verify-v39-foundation', { offerUpgrades: false });
assert.equal(state.roomPlan.runDepth, 6);
assert.equal(state.roomPlan.baseRoomId, 'core-02');
assert.equal(state.roomPlan.resolvedRoomId, 'static-field-00');
assert.equal(state.roomPlan.ruleId, 'first_loop_static_field');
assert.equal(state.roomPlan.category, 'cursed');
assert.deepEqual(state.roomModifierIds, ['static_field']);
assert.equal(currentLocation(state).encounterId, 'static_field_event');

for (const [id, modifier] of Object.entries(ROOM_MODIFIERS)) {
  if (id === 'static_field') {
    assert.equal(modifier.category, 'cursed', 'static_field is the first real room modifier');
    assert.deepEqual(Object.keys(modifier.hooks || {}).sort(), ['enemy:update', 'player:heal', 'render:background', 'room:enter'].sort(), 'static_field must use the runtime hook contract');
    continue;
  }
  assert.equal(modifier.category, 'identity', `baseline room modifier must remain identity-only: ${id}`);
  assert.deepEqual(Object.keys(modifier.hooks || {}), [], `baseline room modifier hooks must stay empty: ${id}`);
}

const constants = read('src/core/constants.js');
assert.ok(!/export\s+const\s+START_WEAPON\b/.test(constants), 'START_WEAPON must not return to constants');
assert.ok(/export\s+const\s+START_WEAPON\s*=/.test(read('src/data/weapons.js')), 'START_WEAPON source of truth must remain data/weapons.js');

const gameplayFiles = fs.readdirSync(path.join(root, 'src/game')).filter((file) => file.endsWith('.js'));
for (const file of gameplayFiles) {
  const src = read(`src/game/${file}`);
  assert.ok(!/modifierId\s*===/.test(src), `game system must not special-case modifier ids: ${file}`);
  assert.ok(!/room\.id\s*===/.test(src), `game system must not special-case room ids: ${file}`);
}

console.log('v39 content foundation verification passed: twin_pillars, reward cache, and static field are data-driven through roomPlan');
