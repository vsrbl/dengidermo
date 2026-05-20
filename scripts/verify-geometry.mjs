import assert from 'node:assert/strict';
import { LAYOUT_VERSION, layoutIdentitySnapshot, layoutSnapshot } from '../src/data/layouts.js';
import { createGameState } from '../src/game/state.js';
import { roomGeometryIdentity, roomGeometryIdentityMatches, roomGeometrySnapshot, roomGeometrySnapshotForState, sweepCircleInLocation, moveCircleInLocation, resolveSpawnPointInState } from '../src/game/roomGeometry.js';
import { spawnEnemy } from '../src/game/enemies.js';

assert.ok(Number.isFinite(LAYOUT_VERSION) && LAYOUT_VERSION >= 2, 'layout version must include spawn-anchor geometry contract');
const pillars = layoutSnapshot('twin_pillars');
const identity = layoutIdentitySnapshot('twin_pillars');
assert.equal(identity.layoutId, 'twin_pillars');
assert.equal(roomGeometryIdentity({ layoutId: 'twin_pillars' }).geometryHash, identity.geometryHash);
assert.equal(roomGeometryIdentityMatches({ layoutId: 'twin_pillars', layoutVersion: identity.layoutVersion, geometryHash: identity.geometryHash }), true);

const geometry = roomGeometrySnapshot({ layoutId: 'twin_pillars' });
assert.ok(geometry.walls.length >= 1, 'test layout should expose solid walls');
const wall = geometry.walls[0];
const y = wall.y + wall.h / 2;
const startX = wall.x - 120;
const sweep = sweepCircleInLocation(geometry, startX, y, 300, 0, 13);
assert.equal(sweep.hitWall, true, 'swept movement should detect crossing through a wall');
assert.ok(sweep.x <= wall.x - 13 + 1, 'sweep result should stop at wall edge');
const moved = moveCircleInLocation(geometry, startX, y, 300, 80, 13);
assert.equal(moved.hit, true, 'substep movement should report wall hit');
assert.ok(moved.x <= wall.x - 13 + 2, 'substep movement should not tunnel through wall');

const state = createGameState('GEOMETRY-DOMAIN');
state.roomPlan = { ...state.roomPlan, layoutId: 'twin_pillars' };
state.layoutId = 'open_arena';
assert.equal(roomGeometrySnapshotForState(state).layoutId, 'twin_pillars', 'state geometry must prefer roomPlan layout over stale mirror');
const corrected = resolveSpawnPointInState(state, { x: wall.x + wall.w / 2, y }, 18, { avoidPlayers: false });
assert.equal(corrected.adjusted, true, 'invalid spawn point inside wall should be corrected');
const boss = spawnEnemy(state, 'boss', wall.x + wall.w / 2, y, { role: 'boss', zone: 'boss_anchor' });
assert.ok(boss, 'boss spawn should be corrected rather than crash');
assert.ok(!(boss.x > wall.x && boss.x < wall.x + wall.w && boss.y > wall.y && boss.y < wall.y + wall.h), 'boss must not remain inside wall');

console.log('geometry domain verification passed');
