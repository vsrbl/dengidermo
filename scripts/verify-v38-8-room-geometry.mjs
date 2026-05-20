import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import { segmentCircleHitT } from '../src/core/math.js';
import { ROOM_LAYOUTS, getLayout, layoutSnapshot } from '../src/data/layouts.js';
import { ROOM_SEQUENCE } from '../src/data/rooms.js';
import { createGameState, makeSnapshot } from '../src/game/state.js';
import { updateProjectiles } from '../src/game/projectiles.js';
import {
  canPlaceCircleInLocation,
  clampCircleToLocation,
  firstSolidWallHitInLocation,
  firstSolidWallHitInState,
  moveCircleInLocation,
  resolveSpawnPointInState,
  roomGeometrySnapshot
} from '../src/game/roomGeometry.js';
import { resolveSpawnPoint } from '../src/game/spawnZones.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const simulationSrc = readFileSync(new URL('../src/game/simulation.js', import.meta.url), 'utf8');
const enemiesSrc = readFileSync(new URL('../src/game/enemies.js', import.meta.url), 'utf8');
const enemyBehaviorsSrc = readFileSync(new URL('../src/game/enemyBehaviors.js', import.meta.url), 'utf8');
const projectilesSrc = readFileSync(new URL('../src/game/projectiles.js', import.meta.url), 'utf8');
const rendererSrc = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
const spawnZonesSrc = readFileSync(new URL('../src/game/spawnZones.js', import.meta.url), 'utf8');
const roomGeometrySrc = readFileSync(new URL('../src/game/roomGeometry.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

test('v38.13.7 is registered', () => {
  assert.equal(VERSION, 'v38.13.7');
  assert.equal(pkg.version, '38.13.7');
  assert.equal(serverPkg.version, '38.13.7');
  assert.match(pkg.scripts['check:all'], /check:v38-8/);
});

test('baseline rooms still use open arena and do not change gameplay geometry', () => {
  for (const room of ROOM_SEQUENCE) {
    assert.equal(room.layout, 'open_arena', `${room.id} should not silently switch layouts in v38.13.7 foundation`);
  }
  const snap = makeSnapshot(createGameState('V38-8-BASELINE'));
  assert.equal(snap.location.layoutId, 'open_arena');
  assert.equal(snap.location.geometry, undefined, 'static geometry should not be sent in every snapshot');
  assert.equal(snap.location.layoutVersion, 2);
  assert.match(snap.location.geometryHash, /^geo:open_arena:2:/);
  const geometry = roomGeometrySnapshot(snap.location);
  assert.deepEqual(geometry.walls, []);
  assert.equal(geometry.bounds.w, 2400);
  assert.equal(geometry.bounds.h, 1600);
});

test('layout data exposes solid wall contracts without making them active content', () => {
  assert.ok(ROOM_LAYOUTS.open_arena);
  assert.ok(ROOM_LAYOUTS.twin_pillars, 'future wall layout contract missing');
  assert.ok(ROOM_LAYOUTS.split_lanes, 'future lane layout contract missing');
  assert.equal(getLayout('missing-layout').id, 'open_arena');
  assert.equal(layoutSnapshot('open_arena').walls.length, 0);
  assert.ok(layoutSnapshot('twin_pillars').walls.every((w) => w.kind === 'solid' && w.shape === 'rect'));
  assert.ok(layoutSnapshot('split_lanes').spawnAnchors.length > 0);
});

test('roomGeometry blocks circles against walls and preserves sliding movement', () => {
  const geometry = roomGeometrySnapshot({ layoutId: 'twin_pillars' });
  const wall = geometry.walls[0];
  assert.equal(canPlaceCircleInLocation(geometry, wall.x - 40, wall.y + 60, 13), true);
  assert.equal(canPlaceCircleInLocation(geometry, wall.x + 10, wall.y + 60, 13), false);

  const clamped = clampCircleToLocation(geometry, wall.x + 12, wall.y + 50, 13);
  assert.equal(clamped.hit, true);
  assert.ok(canPlaceCircleInLocation(geometry, clamped.x, clamped.y, 13));

  const moved = moveCircleInLocation(geometry, wall.x - 70, wall.y + 80, 90, 24, 13);
  assert.equal(moved.hit, true);
  assert.ok(moved.x <= wall.x - 13 || moved.x >= wall.x + wall.w + 13 || moved.y <= wall.y - 13 || moved.y >= wall.y + wall.h + 13);
});

test('segment collision reports first solid wall hit for projectile and renderer prediction', () => {
  const geometry = roomGeometrySnapshot({ layoutId: 'twin_pillars' });
  const wall = geometry.walls[0];
  const hit = firstSolidWallHitInLocation(geometry, wall.x - 120, wall.y + 90, wall.x + 180, wall.y + 90, 4);
  assert.ok(hit, 'expected projectile segment to hit first pillar');
  assert.equal(hit.wall.id, wall.id);
  assert.ok(hit.t > 0 && hit.t < 1);
  assert.equal(hit.normal.x, -1);
  assert.equal(hit.normal.y, 0);

  const miss = firstSolidWallHitInLocation(geometry, wall.x - 120, wall.y - 80, wall.x + 180, wall.y - 80, 4);
  assert.equal(miss, null);
  assert.equal(segmentCircleHitT(0, 0, 100, 0, 50, 0, 8), 0.5);
});

test('spawn zones are validated against room geometry', () => {
  const state = createGameState('V38-8-SPAWN');
  state.layoutId = 'twin_pillars';
  const geometry = roomGeometrySnapshot({ layoutId: state.layoutId });
  const wall = geometry.walls[0];
  const adjusted = resolveSpawnPointInState(state, { x: wall.x + 8, y: wall.y + 80 }, 18);
  assert.ok(canPlaceCircleInLocation(geometry, adjusted.x, adjusted.y, 18, 18));
  const edge = resolveSpawnPoint(state, 'edge_far', 18);
  assert.ok(canPlaceCircleInLocation(geometry, edge.x, edge.y, 18, 18));
});

test('projectiles expire on solid walls before damaging enemies behind them', () => {
  const state = createGameState('V38-8-PROJECTILE');
  state.layoutId = 'twin_pillars';
  const geometry = roomGeometrySnapshot({ layoutId: state.layoutId });
  const wall = geometry.walls[0];
  state.enemies.en_test = {
    id: 'en_test',
    kind: 'grunt',
    x: wall.x + wall.w + 70,
    y: wall.y + 90,
    vx: 0,
    vy: 0,
    hp: 999,
    maxHp: 999,
    radius: 14
  };
  state.projectiles.pr_test = {
    id: 'pr_test',
    ownerId: 'p1',
    weaponId: 'shotgun',
    kind: 'bullet',
    x: wall.x - 140,
    y: wall.y + 90,
    vx: 900,
    vy: 0,
    speed: 900,
    damage: 99,
    radius: 4,
    range: 1200,
    distance: 0,
    life: 2,
    color: '#fff',
    effects: [],
    hitIds: {},
    pierced: 0,
    ricocheted: 0
  };
  assert.ok(firstSolidWallHitInState(state, state.projectiles.pr_test.x, state.projectiles.pr_test.y, state.projectiles.pr_test.x + 270, state.projectiles.pr_test.y, 4));
  updateProjectiles(state, 0.3);
  assert.equal(state.enemies.en_test.hp, 999);
  assert.equal(state.projectiles.pr_test, undefined);
});

test('source boundaries route geometry through a thin contract layer', () => {
  assert.match(simulationSrc, /moveCircleInLocation/);
  assert.match(`${enemiesSrc}
${enemyBehaviorsSrc}`, /moveCircleInLocation/);
  assert.match(projectilesSrc, /firstSolidWallHitInState/);
  assert.match(rendererSrc, /drawRoomGeometry/);
  assert.match(spawnZonesSrc, /resolveSpawnPointInState/);
  assert.doesNotMatch(roomGeometrySrc, /from "\.\/simulation\.js"/);
  assert.doesNotMatch(roomGeometrySrc, /from "\.\/projectiles\.js"/);
  assert.doesNotMatch(roomGeometrySrc, /from "\.\/enemies\.js"/);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.7 room geometry checks passed`);
