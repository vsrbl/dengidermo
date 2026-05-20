import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../../src/core/constants.js';
import { ENEMIES } from '../../src/data/enemies.js';
import { ROOM_SEQUENCE } from '../../src/data/rooms.js';
import { addPlayer, createGameState } from '../../src/game/state.js';
import { applyDashMovement } from '../../src/game/abilities.js';
import { movePlayer, acceptClientPose } from '../../src/game/simulation.js';
import { spawnEnemy, updateEnemies } from '../../src/game/enemies.js';
import {
  canPlaceCircleInLocation,
  firstSolidWallHitInLocation,
  moveCircleInLocation,
  roomGeometrySnapshot,
  sweepCircleInLocation
} from '../../src/game/roomGeometry.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const roomGeometrySrc = readFileSync(new URL('../src/game/roomGeometry.js', import.meta.url), 'utf8');
const abilitiesSrc = readFileSync(new URL('../src/game/abilities.js', import.meta.url), 'utf8');
const simulationSrc = readFileSync(new URL('../src/game/simulation.js', import.meta.url), 'utf8');
const enemiesSrc = readFileSync(new URL('../src/game/enemies.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function testState(seed = 'V38-8-1-GEOMETRY') {
  const state = createGameState(seed);
  state.layoutId = 'twin_pillars';
  return state;
}

function westPillarGeometry() {
  const geometry = roomGeometrySnapshot({ layoutId: 'twin_pillars' });
  return { geometry, wall: geometry.walls.find((w) => w.id === 'pillar_west') || geometry.walls[0] };
}

test('v38.13.8 is registered and baseline rooms still keep open_arena', () => {
  assert.equal(VERSION, 'v38.13.8');
  assert.equal(pkg.version, '38.13.8');
  assert.equal(serverPkg.version, '38.13.8');
  assert.match(pkg.scripts['check:all'], /check:v38-8-1/);
  for (const room of ROOM_SEQUENCE) assert.equal(room.layout, 'open_arena');
});

test('straight swept dash cannot cross a solid wall', () => {
  const { geometry, wall } = westPillarGeometry();
  const player = {
    id: 'p1',
    x: wall.x - 86,
    y: wall.y + 120,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    radius: 13,
    angle: 0,
    hp: 100
  };
  const movement = applyDashMovement(player, { aimAngle: 0 }, { distance: 280 }, { layoutId: 'twin_pillars' });
  assert.ok(movement.after.x <= wall.x - player.radius, 'dash should stop before the wall, not land beyond it');
  assert.ok(canPlaceCircleInLocation(geometry, player.x, player.y, player.radius));
  assert.ok(firstSolidWallHitInLocation(geometry, movement.before.x, movement.before.y, movement.before.x + 280, movement.before.y, player.radius));
});

test('swept circle stops before wall even when endpoint would be valid behind it', () => {
  const { geometry, wall } = westPillarGeometry();
  const radius = 13;
  const startX = wall.x - 130;
  const startY = wall.y + 70;
  const swept = sweepCircleInLocation(geometry, startX, startY, 360, 0, radius);
  assert.equal(swept.hitWall, true);
  assert.ok(swept.x <= wall.x - radius, 'swept movement must not tunnel to the far side');
  assert.ok(canPlaceCircleInLocation(geometry, swept.x, swept.y, radius));
});

test('normal player movement uses substeps and cannot tunnel through walls', () => {
  const { geometry, wall } = westPillarGeometry();
  const moved = moveCircleInLocation(geometry, wall.x - 140, wall.y + 95, 380, 0, 13);
  assert.equal(moved.hit, true);
  assert.ok(moved.x <= wall.x - 13, `expected blocked before wall, got x=${moved.x}`);
  assert.ok(canPlaceCircleInLocation(geometry, moved.x, moved.y, 13));
});

test('player knockback movement is blocked by the same movement contract', () => {
  const state = testState('V38-8-1-KNOCKBACK');
  const { geometry, wall } = westPillarGeometry();
  const player = {
    id: 'p1',
    x: wall.x - 64,
    y: wall.y + 120,
    vx: 0,
    vy: 0,
    kx: 2200,
    ky: 0,
    radius: 13,
    stats: {},
    angle: 0
  };
  movePlayer(player, {}, 0.12, { layoutId: state.layoutId });
  assert.ok(player.x <= wall.x - player.radius, 'knockback should not push player through wall');
  assert.ok(canPlaceCircleInLocation(geometry, player.x, player.y, player.radius));
});

test('host client-pose acceptance cannot reconcile a guest through a wall', () => {
  const { geometry, wall } = westPillarGeometry();
  const player = {
    id: 'p2',
    x: wall.x - 46,
    y: wall.y + 130,
    vx: 0,
    vy: 0,
    radius: 13,
    stats: { speedMult: 1 }
  };
  acceptClientPose(player, { px: wall.x + wall.w + 22, py: wall.y + 130 }, 0.05, { layoutId: 'twin_pillars' });
  assert.ok(player.x <= wall.x - player.radius, 'accepted client pose should sweep and stop before wall');
  assert.ok(canPlaceCircleInLocation(geometry, player.x, player.y, player.radius));
});

test('enemy movement and knockback are blocked by wall geometry', () => {
  const state = testState('V38-8-1-ENEMY-MOVE');
  const { geometry, wall } = westPillarGeometry();
  const target = addPlayer(state, 'p1', 0);
  target.x = wall.x + wall.w + 210;
  target.y = wall.y + 120;
  target.hp = 100;
  const enemy = spawnEnemy(state, 'grunt', wall.x - 56, wall.y + 120);
  enemy.kx = 2000;
  updateEnemies(state, 0.16);
  assert.ok(enemy.x <= wall.x - enemy.radius, 'enemy should not pass through wall while moving/knocked');
  assert.ok(canPlaceCircleInLocation(geometry, enemy.x, enemy.y, enemy.radius));
});

test('explicit enemy and boss spawns are validated through geometry', () => {
  const state = testState('V38-8-1-SPAWN-VALIDATION');
  const { geometry, wall } = westPillarGeometry();
  const badX = wall.x + wall.w / 2;
  const badY = wall.y + wall.h / 2;

  const grunt = spawnEnemy(state, 'grunt', badX, badY, { zone: 'scripted_test' });
  assert.ok(grunt.spawnAdjusted, 'invalid explicit grunt spawn should be corrected');
  assert.equal(grunt.spawnZone, 'scripted_test');
  assert.ok(canPlaceCircleInLocation(geometry, grunt.x, grunt.y, ENEMIES.grunt.radius, 18));

  const boss = spawnEnemy(state, 'boss', badX, badY, { zone: 'boss_anchor' });
  assert.ok(boss.spawnAdjusted, 'invalid explicit boss spawn should be corrected');
  assert.equal(boss.spawnZone, 'boss_anchor');
  assert.ok(canPlaceCircleInLocation(geometry, boss.x, boss.y, ENEMIES.boss.radius, 18));
});

test('geometry hardening stays in contract layers instead of content hacks', () => {
  assert.match(roomGeometrySrc, /sweepCircleInLocation/);
  assert.match(roomGeometrySrc, /MOVE_SUBSTEP_DISTANCE/);
  assert.match(abilitiesSrc, /sweepCircleInLocation/);
  assert.match(simulationSrc, /acceptClientPose[\s\S]*sweepCircleInLocation/);
  assert.match(enemiesSrc, /resolveSpawnPointInState/);
  assert.doesNotMatch(abilitiesSrc, /twin_pillars|split_lanes|pillar_west/);
  assert.doesNotMatch(simulationSrc, /twin_pillars|split_lanes|pillar_west/);
  assert.doesNotMatch(enemiesSrc, /twin_pillars|split_lanes|pillar_west/);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.8 geometry hardening checks passed`);
