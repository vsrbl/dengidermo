import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILD_ID, VERSION } from '../../src/core/constants.js';
import { createGameState } from '../../src/game/state.js';
import {
  firstSolidWallHitInState,
  roomGeometrySnapshotForState,
  roomLayoutForState,
  roomLayoutIdForState,
  roomLayoutMirrorMatchesState,
  sweepCircleInState
} from '../../src/game/roomGeometry.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(read(rel));

assert.equal(VERSION, 'v38.14.4');
assert.equal(BUILD_ID, 'v38.14.4-20260520');
assert.equal(readJson('package.json').scripts['check:v38-14-4'], 'node scripts/verify-v38-14-4-roomplan-geometry-source.mjs');
assert.ok((readJson('package.json').scripts['check:all'] || '').includes('check:v38-14-4'), 'check:all must include exact v38.14.4 guard');

const roomGeometry = read('src/game/roomGeometry.js');
assert.ok(roomGeometry.includes('export function roomLayoutIdForState'), 'roomGeometry must expose roomLayoutIdForState');
assert.ok(roomGeometry.includes('state?.roomPlan?.layoutId || state?.layoutId'), 'roomLayoutIdForState must prefer roomPlan.layoutId before layoutId mirror');
assert.ok(roomGeometry.includes('export function roomGeometrySnapshotForState'), 'roomGeometry must expose state-aware geometry snapshot');
assert.ok(roomGeometry.includes('export function roomLayoutMirrorMatchesState'), 'roomGeometry must expose mirror invariant helper');
assert.ok(!roomGeometry.includes('layoutSnapshot(state?.layoutId || DEFAULT_LAYOUT_ID)'), 'roomLayoutForState must not read layoutId mirror first');

for (const rel of ['src/game/enemies.js', 'src/game/abilities.js']) {
  const src = read(rel);
  assert.ok(!src.includes('{ layoutId: state.layoutId }'), `${rel} must not build geometry from layoutId mirror directly`);
  assert.ok(src.includes('roomGeometrySnapshotForState'), `${rel} must use roomPlan-first geometry snapshot helper`);
}

const state = createGameState('ROOMPLAN-GEOMETRY-SOURCE');
state.roomPlan = { ...state.roomPlan, layoutId: 'twin_pillars' };
state.layoutId = 'open_arena'; // intentionally stale compatibility mirror
assert.equal(roomLayoutIdForState(state), 'twin_pillars', 'roomPlan.layoutId must win over stale state.layoutId mirror');
assert.equal(roomLayoutMirrorMatchesState(state), false, 'mirror helper must detect stale layoutId mirror');
assert.equal(roomLayoutForState(state).id, 'twin_pillars', 'roomLayoutForState must resolve from roomPlan');

const geometry = roomGeometrySnapshotForState(state);
assert.equal(geometry.layoutId, 'twin_pillars', 'state geometry snapshot must expose roomPlan layout identity');
assert.ok(geometry.walls.length >= 1, 'roomPlan-selected wall layout must expose walls even if state.layoutId mirror is open_arena');
const wall = geometry.walls[0];
const y = wall.y + wall.h / 2;
const startX = wall.x - 120;
const sweep = sweepCircleInState(state, startX, y, 300, 0, 13);
assert.equal(sweep.hitWall, true, 'sweepCircleInState must use roomPlan layout and block stale-mirror tunneling');
const hit = firstSolidWallHitInState(state, startX, y, startX + 300, y, 13);
assert.ok(hit, 'firstSolidWallHitInState must use roomPlan-selected walls');

state.layoutId = 'twin_pillars';
assert.equal(roomLayoutMirrorMatchesState(state), true, 'mirror helper must pass after mirror is resynced');

console.log('v38.14.4 roomPlan-first geometry source checks passed');
