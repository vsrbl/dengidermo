import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOM_SEQUENCE, RARE_ROOMS, VARIETY_ROOMS, ALL_ROOMS } from '../src/data/rooms.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { ROOM_LAYOUTS, layoutIdentitySnapshot } from '../src/data/layouts.js';
import { ROOM_POOLS } from '../src/data/roomPools.js';
import { LOCATION_THEMES } from '../src/data/locationThemes.js';
import { ENVIRONMENT_PROP_SETS } from '../src/data/environmentProps.js';
import { ENCOUNTER_PLANS } from '../src/data/encounters.js';
import { getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation } from '../src/game/roomFlow.js';
import { canOpenPortal, readDirectorEvaluation } from '../src/game/director.js';
import { roomGeometrySnapshotForState, roomLayoutMirrorMatchesState } from '../src/game/roomGeometry.js';
import { resolveSpawnPoint } from '../src/game/spawnZones.js';
import { requestInteractableActivation, updateInteractables } from '../src/game/interactables.js';
import { INTERACTABLES } from '../src/data/interactables.js';
import { CHEST_IDS, CHEST_STATES } from '../src/data/chests.js';
import { REWARD_TABLES } from '../src/data/rewardTables.js';
import { ABILITIES, ABILITY_IDS } from '../src/data/abilities.js';
import { ECONOMY_PICKUP_TYPES } from '../src/data/economy.js';
import { REWARD_TYPES } from '../src/data/rewardTypes.js';
import { CASINO_MACHINES, CASINO_MACHINE_IDS } from '../src/data/casinoMachines.js';
import { CASINO_STAKES } from '../src/data/casinoStakes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

assert.equal(ROOM_SEQUENCE.length, 4, 'normal cadence must keep four base rooms');
assert.deepEqual(ROOM_SEQUENCE.map((room) => room.id), ['grid-00', 'void-01', 'core-02', 'boss-03'], 'normal cadence must stay grid -> void -> core -> boss');
assert.deepEqual(RARE_ROOMS.map((room) => room.id), ['reward-cache-00', 'casino-floor-00', 'static-field-00'], 'controlled rare/activity rooms must stay explicit and small');
assert.ok(VARIETY_ROOMS.length >= 4, 'v39.3.22 must add several normal variety rooms outside the base cadence');
assert.equal(ALL_ROOMS.length, ROOM_SEQUENCE.length + RARE_ROOMS.length + VARIETY_ROOMS.length, 'all room registry must include base + rare + variety rooms');

assert.ok(INTERACTABLES.basic_chest, 'basic chest interactable must exist for exploration foundation');
assert.ok(INTERACTABLES.rare_chest, 'rare chest interactable must exist for reward rooms');
assert.ok(INTERACTABLES.casino_slot, 'casino slot interactable must exist for reward activity rooms');
assert.equal(INTERACTABLES.casino_slot.casinoMachineId, CASINO_MACHINE_IDS.SIGNAL_SLOT, 'casino slot interactable must use data-driven SIGNAL SLOT machine identity');
assert.ok(CASINO_MACHINES[CASINO_MACHINE_IDS.SIGNAL_SLOT], 'SIGNAL SLOT casino machine data must exist');
assert.deepEqual(Object.keys(CASINO_STAKES), ['low', 'mid', 'high'], 'casino foundation should expose LOW/MID/HIGH stake tiers');
assert.ok(REWARD_TABLES.basic_chest, 'basic chest reward table must exist');
assert.equal(REWARD_TABLES.basic_chest.entries.every((entry) => entry.type === REWARD_TYPES.ECONOMY_PICKUP), true, 'basic chest should only drop basic economy tokens');
assert.equal(REWARD_TABLES.basic_chest.entries.some((entry) => entry.pickupType === ECONOMY_PICKUP_TYPES.MONEY), true, 'basic chest should be able to reveal GLD');
assert.equal(REWARD_TABLES.basic_chest.entries.some((entry) => entry.pickupType === ECONOMY_PICKUP_TYPES.XP), true, 'basic chest should be able to reveal EXP');
assert.ok(ABILITIES[ABILITY_IDS.TELEPORT_DASH], 'teleport dash must be a data-driven ability for active ability loot');
assert.ok(REWARD_TABLES.rare_chest.entries.some((entry) => entry.type === REWARD_TYPES.ABILITY_PICKUP && entry.abilityId === ABILITY_IDS.TELEPORT_DASH), 'rare chest should be able to drop TELEPORT DASH as active ability loot');
assert.ok(REWARD_TABLES.casino_slot.entries.some((entry) => entry.type === REWARD_TYPES.MODIFIER_INJECTION && entry.modifierId === 'live_chat_hates_you'), 'casino v2 should include a DEBT SIGNAL outcome that queues a next-room pressure modifier');

assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'core-02')?.layout, 'twin_pillars', 'core-02 is the controlled wall-layout entry point');
assert.equal((ROOM_LAYOUTS.open_arena.walls || []).length, 0, 'open_arena must remain wall-free fallback baseline');
assert.ok((ROOM_LAYOUTS.twin_pillars?.walls || []).length >= 2, 'twin_pillars must provide real solid obstacles');
assert.ok((ROOM_LAYOUTS.side_pockets?.walls || []).length >= 4, 'side_pockets must provide readable loot-pocket blockers');
assert.ok((ROOM_LAYOUTS.broken_cover?.walls || []).length >= 4, 'broken_cover must provide small cover blockers');
assert.ok((ROOM_LAYOUTS.static_strips?.walls || []).length >= 2, 'static_strips must provide strip blockers');
assert.ok((ROOM_LAYOUTS.split_lanes?.tags || []).includes('future'), 'split_lanes must remain reserved for a later pass');
for (const [id, set] of Object.entries(ENVIRONMENT_PROP_SETS)) {
  assert.equal(set.id, id, `environment prop set key/id mismatch: ${id}`);
  for (const prop of set.props || []) assert.equal(prop.kind, 'solid', `${id}/${prop.id} must be a solid rect prop for this foundation pass`);
}
for (const [id, theme] of Object.entries(LOCATION_THEMES)) {
  assert.equal(theme.id, id, `location theme key/id mismatch: ${id}`);
  assert.ok(ENVIRONMENT_PROP_SETS[theme.environmentPropSetId], `${id} references an unknown environment prop set`);
}
for (const [id, pool] of Object.entries(ROOM_POOLS)) {
  assert.equal(pool.id, id, `room pool key/id mismatch: ${id}`);
  assert.equal(pool.nodes.length, ROOM_SEQUENCE.length, `${id} must preserve four-slot loop cadence`);
}

assert.ok(ENCOUNTER_PLANS.reward_cache, 'reward cache encounter plan must exist');
assert.equal(ENCOUNTER_PLANS.reward_cache.stages.every((stage) => stage.canSpawn === false), true, 'reward encounter must not spawn enemies');
assert.ok(ENCOUNTER_PLANS.static_field_event, 'static field encounter plan must exist');
assert.equal(ENCOUNTER_PLANS.static_field_event.stages.some((stage) => stage.canSpawn), true, 'static field event should spawn through director stages');

const firstLoopIds = [];
for (let depth = 0; depth < 4; depth += 1) {
  const plan = resolveRoomPlan(depth, { seed: 'V39-CONTENT-FOUNDATION' });
  firstLoopIds.push(plan.resolvedRoomId);
  assert.equal(plan.roomPoolId, 'loop_zero_cadence', 'first loop should use onboarding route pool');
}
assert.deepEqual(firstLoopIds, ['grid-00', 'void-01', 'core-02', 'boss-03'], 'first loop must remain stable');

const seedSet = ['A', 'B', 'C', 'D', 'V39-CONTENT-FOUNDATION', 'nncckkrr'];
const variedRooms = new Set();
const variedLayouts = new Set();
for (const seed of seedSet) {
  for (const depth of [4, 5, 6, 8, 9, 10]) {
    const plan = resolveRoomPlan(depth, { seed });
    const loc = getLocationFromRoomPlan(plan);
    variedRooms.add(plan.resolvedRoomId);
    variedLayouts.add(loc.layoutId);
    assert.ok(plan.roomPoolId, 'resolved plans should carry route pool identity');
    assert.ok(plan.routeNodeId, 'resolved plans should carry route node identity');
    assert.ok(LOCATION_THEMES[plan.environmentThemeId], 'resolved plans should carry known environment theme identity');
  }
}
assert.ok(variedRooms.size >= 7, `route resolver should produce strong room variety, got ${[...variedRooms].join(', ')}`);
assert.ok(variedLayouts.has('side_pockets'), 'route resolver should expose side_pockets layout');
assert.ok(variedLayouts.has('broken_cover'), 'route resolver should expose broken_cover layout');
assert.ok(variedLayouts.has('static_strips'), 'route resolver should expose static_strips layout');

const randomPocketStates = ['RND-A', 'RND-B', 'RND-C', 'RND-D'].map((seed) => createGameState(seed));
const randomPocketPositions = randomPocketStates
  .flatMap((roomState) => Object.values(roomState.interactables || {}).map((item) => `${item.kind}:${item.x}:${item.y}`));
assert.ok(new Set(randomPocketPositions).size >= 3, 'normal room interactable placement should vary by run seed instead of fixed anchors');
assert.ok(randomPocketStates.every((roomState) => Object.values(roomState.interactables || {}).filter((item) => item.kind === CHEST_IDS.BASIC).every((item) => item.chestOpenCost === 0)), 'BSC should spawn as a free baseline exploration chest');

const state = createGameState('ROOMFLOW-DOMAIN');
const player = addPlayer(state, 'p1', 0);
assert.equal(currentLocation(state).layoutId, 'open_arena');
beginRoomTransition(state, 'verify-v39-foundation', { offerUpgrades: false });
assert.equal(currentLocation(state).id, 'void-01');
beginRoomTransition(state, 'verify-v39-foundation', { offerUpgrades: false });
assert.equal(state.roomPlan.resolvedRoomId, 'core-02');
assert.equal(state.roomPlan.layoutId, 'twin_pillars');
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
assert.equal(state.roomPlan.roomPoolId, 'loop_one_variety');
assert.equal(state.roomPlan.resolvedRoomId, 'reward-cache-00');
assert.equal(state.roomPlan.ruleId, 'first_loop_reward_cache');
assert.equal(state.roomPlan.rare, true);
assert.equal(state.roomPlan.category, 'reward');
assert.equal(state.roomPlan.environmentThemeId, 'cache_pockets');
assert.deepEqual(state.roomModifierIds, ['reward_cache']);
assert.equal(state.roomPlan.interactablePlan.length, 4, 'reward room plan should carry the priced reward spread');
assert.equal(Object.keys(state.interactables).length, 4, 'reward room should spawn its priced reward spread from the room plan');
assert.equal(Object.keys(state.enemies).length, 0, 'reward room starts with no enemies');
let evaluation = readDirectorEvaluation(state);
assert.equal(evaluation.encounterId, 'reward_cache');
assert.equal(evaluation.policy.canSpawn, false, 'reward room director must not spawn');
assert.equal(canOpenPortal(state), false, 'reward portal should wait for its short delay');
state.locationTime = state.portalReadyAt;
evaluation = readDirectorEvaluation(state);
assert.equal(evaluation.phase, 'portal');
assert.equal(evaluation.policy.canOpenPortal, true, 'reward portal should open after the delay with zero hostiles');
const snap = makeSnapshot(state);
assert.equal(snap.location.roomPoolId, 'loop_one_variety');
assert.equal(snap.location.routeNodeId, state.roomPlan.routeNodeId);
assert.equal(snap.location.environmentThemeId, 'cache_pockets');
assert.equal(snap.location.interactablePlan.length, 4, 'snapshot location should expose interactable plan metadata');
const rewardChest = Object.values(state.interactables).find((item) => item.kind === CHEST_IDS.RARE);
assert.ok(rewardChest, 'reward room should spawn a real rare chest interactable');
assert.equal(rewardChest.chestState, CHEST_STATES.CLOSED, 'reward chest should start closed');
updateInteractables(state, 0.016);
assert.equal(rewardChest.opened, false, 'reward chest must not auto-open on room entry');
player.economy.money = 0;
player.x = rewardChest.x;
player.y = rewardChest.y;
assert.equal(requestInteractableActivation(state, player.id, { targetId: rewardChest.id }), false, 'priced reward chest should reject when money is insufficient');
assert.equal(rewardChest.opened, false, 'insufficient-money rejection must not consume reward chest');
player.economy.money = 250;
assert.equal(requestInteractableActivation(state, player.id, { targetId: rewardChest.id }), true, 'E-style host interaction should open reward chest');
assert.equal(rewardChest.opened, true, 'reward chest should open through host-owned interactable request');
assert.ok(Object.keys(state.rewardPickups).length >= 1, 'reward chest should spawn reward pickups through reward table');
assert.ok(state.events.some((event) => event.type === 'economy' && event.action === 'spend_money' && event.sourceType === 'chest'), 'priced chest opening should spend money through playerEconomy');
assert.equal(Object.keys(state.loot).length, 0, 'reward chest should not bypass reward pickup contract with legacy loot');

beginRoomTransition(state, 'verify-v39-foundation', { offerUpgrades: false });
assert.equal(state.roomPlan.runDepth, 5);
assert.equal(state.roomPlan.roomPoolId, 'loop_one_variety');
beginRoomTransition(state, 'verify-v39-foundation', { offerUpgrades: false });
assert.equal(state.roomPlan.runDepth, 6);
assert.equal(state.roomPlan.baseRoomId, 'core-02');
assert.equal(state.roomPlan.resolvedRoomId, 'static-field-00');
assert.equal(state.roomPlan.ruleId, 'first_loop_static_field');
assert.equal(state.roomPlan.category, 'cursed');
assert.ok(state.roomModifierIds.includes('static_field'), 'static-field rare room must keep its base static_field modifier');
assert.ok(state.roomModifierIds.length <= 2, 'loop 1 stack should stay cautious: base modifier plus at most one extra modifier');
assert.equal(currentLocation(state).encounterId, 'static_field_event');

const verticalSliceModifiers = new Set(['static_field', 'live_chat_hates_you', 'algorithm_boost', 'static_god', 'casino_floor']);
for (const [id, modifier] of Object.entries(ROOM_MODIFIERS)) {
  if (verticalSliceModifiers.has(id)) {
    assert.ok(Object.keys(modifier.hooks || {}).length > 0, `${id} must use the runtime hook contract`);
    continue;
  }
  assert.equal(modifier.category, 'identity', `baseline room modifier must remain identity-only: ${id}`);
  assert.deepEqual(Object.keys(modifier.hooks || {}), [], `baseline room modifier hooks must stay empty: ${id}`);
}
assert.equal(ROOM_MODIFIERS.static_field.category, 'cursed', 'static_field remains the cursed rare-room modifier');
assert.equal(ROOM_MODIFIERS.live_chat_hates_you.category, 'pressure', 'live_chat_hates_you should be the pressure stack modifier');
assert.equal(ROOM_MODIFIERS.algorithm_boost.category, 'reward-risk', 'algorithm_boost should be the reward-risk stack modifier');
assert.equal(ROOM_MODIFIERS.static_god.category, 'projectile-rule', 'static_god should be the projectile-rule stack modifier');
assert.equal(ROOM_MODIFIERS.casino_floor.category, 'reward-activity', 'casino_floor should be the casino/reward activity room identity modifier');

const constants = read('src/core/constants.js');
assert.ok(!/export\s+const\s+START_WEAPON\b/.test(constants), 'START_WEAPON must not return to constants');
assert.ok(/export\s+const\s+START_WEAPON\s*=/.test(read('src/data/weapons.js')), 'START_WEAPON source of truth must remain data/weapons.js');

const gameplayFiles = fs.readdirSync(path.join(root, 'src/game')).filter((file) => file.endsWith('.js'));
for (const file of gameplayFiles) {
  const src = read(`src/game/${file}`);
  assert.ok(!/modifierId\s*===/.test(src), `game system must not special-case modifier ids: ${file}`);
  assert.ok(!/room\.id\s*===/.test(src), `game system must not special-case room ids: ${file}`);
}

console.log('v39 content foundation verification passed: route pools, environment props, room variety, and legacy reward/static slices are data-driven');
