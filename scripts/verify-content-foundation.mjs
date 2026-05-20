import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOM_SEQUENCE } from '../src/data/rooms.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { ROOM_LAYOUTS, layoutIdentitySnapshot } from '../src/data/layouts.js';
import { RARE_ROOM_RULES, getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';
import { createGameState, addPlayer, makeSnapshot } from '../src/game/state.js';
import { beginRoomTransition, currentLocation } from '../src/game/roomFlow.js';
import { roomGeometrySnapshotForState, roomLayoutMirrorMatchesState } from '../src/game/roomGeometry.js';
import { resolveSpawnPoint } from '../src/game/spawnZones.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

assert.equal(ROOM_SEQUENCE.length, 4, 'v39.0.0 foundation should keep the four-room cadence');
assert.deepEqual(ROOM_SEQUENCE.map((room) => room.id), ['grid-00', 'void-01', 'core-02', 'boss-03'], 'normal cadence must stay grid -> void -> core -> boss');
assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'grid-00')?.layout, 'open_arena', 'starter room must stay open_arena');
assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'void-01')?.layout, 'open_arena', 'survive room must stay open_arena in first v39 step');
assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'core-02')?.layout, 'twin_pillars', 'core-02 is the single controlled wall-layout entry point');
assert.equal(ROOM_SEQUENCE.find((room) => room.id === 'boss-03')?.layout, 'open_arena', 'boss room must not inherit the first wall-layout test');
assert.equal(RARE_ROOM_RULES.length, 0, 'rare rooms remain disabled until the next explicit v39 content step');

assert.equal((ROOM_LAYOUTS.open_arena.walls || []).length, 0, 'open_arena must remain wall-free fallback baseline');
assert.equal((ROOM_LAYOUTS.open_arena.spawnAnchors || []).length, 0, 'open_arena must keep fallback spawn path');
assert.ok((ROOM_LAYOUTS.twin_pillars?.walls || []).length >= 2, 'twin_pillars must provide real solid obstacles');
assert.ok((ROOM_LAYOUTS.twin_pillars?.spawnAnchors || []).length >= 4, 'twin_pillars must provide spawn anchors');
assert.ok((ROOM_LAYOUTS.twin_pillars?.tags || []).includes('controlled'), 'active wall layout must be tagged controlled');
assert.ok(!(ROOM_LAYOUTS.twin_pillars?.tags || []).includes('future'), 'active wall layout must not remain future-tagged');
assert.ok((ROOM_LAYOUTS.split_lanes?.tags || []).includes('future'), 'split_lanes must remain reserved for a later pass');

const ids = [];
const layouts = [];
for (let depth = 0; depth < 8; depth += 1) {
  const loc = getLocationFromRoomPlan(resolveRoomPlan(depth));
  ids.push(loc.id);
  layouts.push(loc.layoutId);
}
assert.deepEqual(ids, ['grid-00', 'void-01', 'core-02', 'boss-03', 'grid-00', 'void-01', 'core-02', 'boss-03']);
assert.deepEqual(layouts, ['open_arena', 'open_arena', 'twin_pillars', 'open_arena', 'open_arena', 'open_arena', 'twin_pillars', 'open_arena'], 'layout activation must be room data driven and repeat by roomPlan');

const state = createGameState('V39-CONTENT-FOUNDATION');
addPlayer(state, 'p1', 0);
assert.equal(currentLocation(state).layoutId, 'open_arena');
beginRoomTransition(state, 'verify-v39-foundation', { offerUpgrades: false });
assert.equal(currentLocation(state).layoutId, 'open_arena');
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

const snap = makeSnapshot(state);
assert.equal(snap.location.resolvedRoomId, 'core-02');
assert.equal(snap.location.layoutId, 'twin_pillars');
assert.equal(snap.location.geometryHash, identity.geometryHash);

for (const [id, modifier] of Object.entries(ROOM_MODIFIERS)) {
  assert.equal(modifier.category, 'identity', `room modifier must remain identity-only in layout-only v39.0.0: ${id}`);
  assert.deepEqual(Object.keys(modifier.hooks || {}), [], `room modifier hooks must stay empty until modifier content pass: ${id}`);
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

console.log('v39 content foundation verification passed: twin_pillars is data-driven through roomPlan geometry');
