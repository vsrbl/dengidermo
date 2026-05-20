import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer, makeSnapshot } from '../../src/game/state.js';
import { moveTeamToNextLocation } from '../../src/game/portals.js';
import { spawnEnemy } from '../../src/game/enemies.js';
import { updateCompanions } from '../../src/game/companions.js';
import { updateHostWorld } from '../../src/game/simulation.js';
import { UPGRADES } from '../../src/data/upgrades.js';
import { DAMAGE_TAGS, EFFECT_DEFS, EFFECT_HOOKS } from '../../src/game/effects.js';

const companionsSrc = readFileSync(new URL('../src/game/companions.js', import.meta.url), 'utf8');
const projectilesSrc = readFileSync(new URL('../src/game/projectiles.js', import.meta.url), 'utf8');
const stateSrc = readFileSync(new URL('../src/game/state.js', import.meta.url), 'utf8');
const enemyDeathSrc = readFileSync(new URL('../src/game/enemyDeath.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function base(seed = 'V36-COMP') {
  const state = createGameState(seed);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.hp = 100; p.maxHp = 100;
  state.spawnTimer = 9999;
  return { state, p };
}

function tick(state, seconds = 1, dt = 1 / 120) {
  for (let i = 0; i < Math.ceil(seconds / dt); i += 1) updateHostWorld(state, { p1: { aimAngle: 0 } }, dt);
}

test('companion upgrades are data-driven and effect defs are implemented', () => {
  assert.ok(UPGRADES.orbital, 'ORBITAL upgrade missing');
  assert.ok(UPGRADES.drone, 'DRONE upgrade missing');
  assert.ok(UPGRADES.orbital.tags.includes('companion'), 'orbital upgrade lacks companion tag');
  assert.ok(UPGRADES.drone.tags.includes('companion'), 'drone upgrade lacks companion tag');
  assert.ok(EFFECT_DEFS.orbital.hooks.includes(EFFECT_HOOKS.PLAYER_TICK), 'orbital must run from player tick hook');
  assert.ok(EFFECT_DEFS.drone.hooks.includes(EFFECT_HOOKS.PLAYER_TICK), 'drone must run from player tick hook');
  assert.notEqual(EFFECT_DEFS.orbital.implemented, false, 'orbital is still marked reserved');
  assert.notEqual(EFFECT_DEFS.drone.implemented, false, 'drone is still marked reserved');
});

test('companion system is separate from projectiles and has guard comments', () => {
  assert.match(companionsSrc, /ARCHITECTURE GUARD: companions are owner-based entities/, 'companions guard missing');
  assert.doesNotMatch(projectilesSrc, /orbital|drone/, 'companion logic leaked into projectiles.js');
  assert.match(stateSrc, /companions: \{\}/, 'state must own companions collection');
  assert.match(stateSrc, /companionSnapshot/, 'snapshot must expose companions explicitly');
});

test('orbital spawns as host-owned companion and damages enemies', () => {
  const { state, p } = base('ORBITAL-DAMAGE');
  p.upgrades.taken.orbital = 1;
  const enemy = spawnEnemy(state, 'grunt', p.x + 78, p.y);
  const before = enemy.hp;
  tick(state, 0.8);
  const companions = Object.values(state.companions || {}).filter((c) => c.kind === 'orbital');
  assert.ok(companions.length >= 1, 'orbital companion did not spawn');
  assert.ok(!state.enemies[enemy.id] || state.enemies[enemy.id].hp < before, 'orbital did not damage enemy');
  const snap = makeSnapshot(state);
  assert.ok(snap.companions.some((c) => c.kind === 'orbital'), 'orbital missing from snapshot');
});

test('drone spawns as auto-shooter and produces beam feedback', () => {
  const { state, p } = base('DRONE-DAMAGE');
  p.upgrades.taken.drone = 1;
  const enemy = spawnEnemy(state, 'boss', p.x + 260, p.y);
  const before = enemy.hp;
  tick(state, 1.4);
  assert.ok(Object.values(state.companions || {}).some((c) => c.kind === 'drone'), 'drone companion did not spawn');
  assert.ok(state.enemies[enemy.id].hp < before, 'drone did not damage target');
  assert.ok(state.events.some((ev) => ev.type === 'companionHit' && ev.kind === 'drone'), 'drone hit event was not created');
});

test('companion kills use shared enemy finalizer for loot/events', () => {
  const { state, p } = base('COMPANION-KILL');
  p.upgrades.taken.drone = 1;
  const enemy = spawnEnemy(state, 'grunt', p.x + 180, p.y);
  enemy.hp = 1;
  tick(state, 1.4);
  assert.ok(!state.enemies[enemy.id], 'dead enemy was not removed');
  assert.ok(state.events.some((ev) => ev.type === 'kill' && ev.sourceId === 'p1'), 'companion kill did not push shared kill event');
  assert.match(enemyDeathSrc, /finishEnemyKill/, 'shared enemy finalizer missing');
});


test('portal transition resets live companion entities to prevent cross-room jumps', () => {
  const { state, p } = base('COMPANION-PORTAL-RESET');
  p.upgrades.taken.drone = 1;
  p.upgrades.taken.orbital = 1;
  tick(state, 0.4);
  const before = Object.values(state.companions || {});
  assert.ok(before.length >= 2, 'companions did not exist before portal transition');
  const previousIds = new Set(before.map((c) => c.id));
  moveTeamToNextLocation(state);
  assert.deepEqual(Object.keys(state.companions || {}), [], 'live companions must be cleared during room transition');
  tick(state, 0.05);
  const after = Object.values(state.companions || {});
  assert.ok(after.length >= 2, 'companions should be recreated after transition from player upgrades');
  assert.ok(after.every((c) => !previousIds.has(c.id)), 'recreated companions need fresh ids so renderer smoothing cannot interpolate from old room');
  assert.ok(after.every((c) => Math.hypot(c.x - p.x, c.y - p.y) < 170), 'recreated companions should start near owner/orbit after transition');
});

test('companion damage is tagged and does not use player damage tag', () => {
  assert.equal(DAMAGE_TAGS.COMPANION, 'companion');
  assert.match(companionsSrc, /DAMAGE_TAGS\.COMPANION/, 'companion damage tags missing');
  assert.doesNotMatch(companionsSrc, /DAMAGE_TAGS\.PLAYER, DAMAGE_TAGS\.DIRECT/, 'enemy-facing companion damage should not be tagged as player damage target');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v36 companion checks passed`);
