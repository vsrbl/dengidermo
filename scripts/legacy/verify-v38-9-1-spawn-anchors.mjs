import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CENTER, VERSION, WORLD } from '../../src/core/constants.js';
import { LAYOUT_VERSION } from '../../src/data/layouts.js';
import { ROOM_SEQUENCE } from '../../src/data/rooms.js';
import { createGameState, addPlayer } from '../../src/game/state.js';
import { spawnEnemy } from '../../src/game/enemies.js';
import { directorSpawnEnemyCommand, executeDirectorCommands } from '../../src/game/directorCommands.js';
import { canPlaceCircleInLocation, roomGeometrySnapshot } from '../../src/game/roomGeometry.js';
import { resolveSpawnPoint, SPAWN_ZONE_IDS } from '../../src/game/spawnZones.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const spawnZonesSrc = readFileSync(new URL('../src/game/spawnZones.js', import.meta.url), 'utf8');
const directorCommandsSrc = readFileSync(new URL('../src/game/directorCommands.js', import.meta.url), 'utf8');
const enemiesSrc = readFileSync(new URL('../src/game/enemies.js', import.meta.url), 'utf8');
const layoutsSrc = readFileSync(new URL('../src/data/layouts.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function anchorState(seed = 'V38-9-1-ANCHORS', layoutId = 'twin_pillars') {
  const state = createGameState(seed);
  state.layoutId = layoutId;
  return state;
}

function customGeometry() {
  return {
    layoutId: 'test_geometry',
    layoutVersion: 999,
    geometryHash: 'test',
    bounds: { x: 0, y: 0, w: WORLD.w, h: WORLD.h },
    walls: [
      { id: 'bad_spawn_wall', kind: 'solid', shape: 'rect', x: 120, y: CENTER.y - 80, w: 180, h: 160, tags: [] }
    ],
    hazards: [],
    spawnAnchors: [
      { id: 'bad_west_edge', x: 190, y: CENTER.y, tags: ['edge', 'far', 'west'] },
      { id: 'safe_east_edge', x: WORLD.w - 190, y: CENTER.y, tags: ['edge', 'far', 'east'] },
      { id: 'boss_anchor', x: CENTER.x, y: 180, tags: ['boss'] }
    ],
    portal: { x: WORLD.w - 190, y: CENTER.y }
  };
}

test('v38.13.8 is registered as spawn-anchor placement authority foundation', () => {
  assert.equal(VERSION, 'v38.13.8');
  assert.equal(pkg.version, '38.13.8');
  assert.equal(serverPkg.version, '38.13.8');
  assert.equal(LAYOUT_VERSION, 2);
  assert.match(pkg.scripts['check:all'], /check:v38-9-1/);
});

test('baseline production room sequence still uses open_arena without active anchors', () => {
  for (const room of ROOM_SEQUENCE) assert.equal(room.layout, 'open_arena');
  const geometry = roomGeometrySnapshot({ layoutId: 'open_arena' });
  assert.deepEqual(geometry.spawnAnchors, []);
  const state = createGameState('NO-ACTIVE-ANCHORS');
  const point = resolveSpawnPoint(state, SPAWN_ZONE_IDS.EDGE_FAR, 12);
  assert.equal(point.fromAnchor, undefined);
  assert.ok(canPlaceCircleInLocation(roomGeometrySnapshot({ layoutId: state.layoutId }), point.x, point.y, 12, 18));
});

test('layout spawn anchors are preferred before fallback edge logic when valid', () => {
  const state = anchorState('ANCHOR-PREFERRED');
  addPlayer(state, 'p1', 0);
  const point = resolveSpawnPoint(state, SPAWN_ZONE_IDS.EDGE_FAR, 12);
  assert.equal(point.fromAnchor, true);
  assert.ok(['north_gate', 'south_gate', 'west_flank', 'east_flank'].includes(point.anchorId));
  assert.ok(point.anchorTags.includes('edge'));
  assert.ok(canPlaceCircleInLocation(roomGeometrySnapshot({ layoutId: state.layoutId }), point.x, point.y, 12, 18));
});

test('boss role resolves boss_anchor when the current layout provides one', () => {
  const state = anchorState('BOSS-ANCHOR');
  const boss = spawnEnemy(state, 'boss', null, null, { zone: SPAWN_ZONE_IDS.BOSS_ANCHOR, role: 'boss', anchorTags: ['boss'] });
  assert.equal(boss.spawnFromAnchor, true);
  assert.equal(boss.spawnAnchorId, 'boss_anchor');
  assert.equal(boss.spawnZone, SPAWN_ZONE_IDS.BOSS_ANCHOR);
  assert.equal(boss.x, CENTER.x);
  assert.equal(boss.y, 190);
});

test('anchors inside walls are rejected instead of adjusted into hidden one-off spawns', () => {
  const state = anchorState('BAD-ANCHOR-REJECTED');
  addPlayer(state, 'p1', 0).x = CENTER.x;
  const geometry = customGeometry();
  const point = resolveSpawnPoint(state, SPAWN_ZONE_IDS.EDGE_FAR, 12, { geometry });
  assert.notEqual(point.anchorId, 'bad_west_edge');
  assert.ok(point.fromAnchor ? point.anchorId === 'safe_east_edge' : true);
  assert.ok(canPlaceCircleInLocation(geometry, point.x, point.y, 12, 18));
});

test('near_team_edge uses the nearest valid anchor and still respects walls', () => {
  const state = anchorState('NEAR-TEAM-RESPECTS-WALLS');
  const player = addPlayer(state, 'p1', 0);
  player.x = 170;
  player.y = CENTER.y;
  const geometry = customGeometry();
  const point = resolveSpawnPoint(state, SPAWN_ZONE_IDS.NEAR_TEAM_EDGE, 12, { geometry });
  assert.equal(point.fromAnchor, true);
  assert.equal(point.anchorId, 'safe_east_edge');
  assert.ok(canPlaceCircleInLocation(geometry, point.x, point.y, 12, 18));
});

test('explicit spawns remain geometry-validated and keep their command zone', () => {
  const state = anchorState('EXPLICIT-STILL-VALIDATED');
  const geometry = roomGeometrySnapshot({ layoutId: 'twin_pillars' });
  const wall = geometry.walls.find((w) => w.id === 'pillar_west');
  const enemy = spawnEnemy(state, 'grunt', wall.x + wall.w / 2, wall.y + wall.h / 2, { zone: 'scripted_explicit' });
  assert.equal(enemy.spawnZone, 'scripted_explicit');
  assert.equal(enemy.spawnAdjusted, true);
  assert.ok(canPlaceCircleInLocation(geometry, enemy.x, enemy.y, enemy.radius, 18));
});

test('director spawn commands pass role and anchor metadata through the command boundary', () => {
  const state = anchorState('DIRECTOR-ANCHOR-COMMAND');
  const director = { policy: { canSpawn: true }, enemyCap: 8, budget: 20, spentBudget: 0 };
  const command = directorSpawnEnemyCommand({ kind: 'grunt', role: 'wave', zone: SPAWN_ZONE_IDS.EDGE_FAR, cost: 1 });
  const summary = executeDirectorCommands(state, director, [command], { spawnEnemy });
  const enemy = Object.values(state.enemies)[0];
  assert.equal(summary.spawned, 1);
  assert.equal(enemy.spawnFromAnchor, true);
  assert.ok(enemy.spawnAnchorId);
  assert.equal(director.lastSpawn.zone, SPAWN_ZONE_IDS.EDGE_FAR);
});

test('spawn-anchor implementation stays generic and avoids room-specific hacks', () => {
  assert.match(layoutsSrc, /spawnAnchors/);
  assert.match(spawnZonesSrc, /resolveAnchorSpawnPoint/);
  assert.match(spawnZonesSrc, /canPlaceSpawnPointInState/);
  assert.match(directorCommandsSrc, /anchorTags/);
  assert.match(enemiesSrc, /spawnAnchorId/);
  assert.doesNotMatch(spawnZonesSrc, /grid-00|void-01|core-02|boss-03/);
  assert.doesNotMatch(enemiesSrc, /twin_pillars|split_lanes|boss_anchor/);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.8 spawn anchor checks passed`);
