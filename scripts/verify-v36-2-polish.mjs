import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer, removePlayer } from '../src/game/state.js';
import { moveTeamToNextLocation } from '../src/game/portals.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { updateHostWorld } from '../src/game/simulation.js';
import { updateCompanions } from '../src/game/companions.js';
import { updateLoot } from '../src/game/loot.js';
import {
  DAMAGE_TAGS,
  EFFECT_HOOKS,
  applyStatusToEnemy,
  healPlayer,
  runEnemyStatusTickPipeline,
  runLootHook,
  runPlayerHook,
  tickPlayerEffects
} from '../src/game/effects.js';
import { pushVisualEffect } from '../src/game/effectCommands.js';
import { applyUpgrade } from '../src/game/upgrades.js';

const effectsSrc = readFileSync(new URL('../src/game/effects.js', import.meta.url), 'utf8');
const commandsSrc = readFileSync(new URL('../src/game/effectCommands.js', import.meta.url), 'utf8');
const lootSrc = readFileSync(new URL('../src/game/loot.js', import.meta.url), 'utf8');
const portalsSrc = readFileSync(new URL('../src/game/portals.js', import.meta.url), 'utf8');
const roomFlowSrc = readFileSync(new URL('../src/game/roomFlow.js', import.meta.url), 'utf8');
const upgradesSrc = readFileSync(new URL('../src/game/upgrades.js', import.meta.url), 'utf8');
const projectilesSrc = readFileSync(new URL('../src/game/projectiles.js', import.meta.url), 'utf8');
const companionsSrc = readFileSync(new URL('../src/game/companions.js', import.meta.url), 'utf8');
const abilitiesSrc = readFileSync(new URL('../src/game/abilities.js', import.meta.url), 'utf8');
const runtimeSrc = ['loot.js', 'portals.js', 'upgrades.js', 'projectiles.js', 'companions.js', 'abilities.js']
  .map((name) => `${name}\n${readFileSync(new URL(`../src/game/${name}`, import.meta.url), 'utf8')}`)
  .join('\n---\n');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function base(seed = 'V36-2') {
  const state = createGameState(seed);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.hp = 50; p.maxHp = 100;
  state.spawnTimer = 9999;
  return { state, p };
}

function tick(state, seconds = 0.5, dt = 1 / 120) {
  for (let i = 0; i < Math.ceil(seconds / dt); i += 1) updateHostWorld(state, { p1: { aimAngle: 0 } }, dt);
}

test('healPlayer is the single gameplay healing path for loot, portals, upgrades and lifesteal', () => {
  assert.match(effectsSrc, /export function healPlayer/, 'healPlayer() missing');
  assert.match(effectsSrc, /EFFECT_HOOKS\.PLAYER_HEAL/, 'PLAYER_HEAL hook missing from healing pipeline');
  assert.match(lootSrc, /healPlayer\(state, player/, 'loot healing bypasses healPlayer()');
  assert.match(roomFlowSrc, /healPlayer\(state, player/, 'portal healing bypasses healPlayer()');
  assert.match(upgradesSrc, /healPlayer\(state, player/, 'upgrade healing bypasses healPlayer()');
  assert.match(effectsSrc, /sourceType: "lifesteal"/, 'lifesteal healing bypasses healPlayer()');
  assert.doesNotMatch(runtimeSrc, /\.hp\s*=\s*Math\.min\([^\n]*(\.hp|hp \+)/, 'runtime still has direct capped healing');
  assert.doesNotMatch(runtimeSrc, /\.hp\s*\+=/, 'runtime still has direct hp += healing');
});

test('healPlayer preserves behavior for loot, upgrades and portal revive-style room heal', () => {
  const { state, p } = base('HEAL-PIPELINE');
  const direct = healPlayer(state, p, { amount: 12, sourceType: 'test', tags: ['test'] });
  assert.equal(direct.done, 12);
  assert.equal(p.hp, 62);

  p.hp = 90;
  applyUpgrade(p, 'extraHeart', state);
  assert.ok(p.maxHp > 100, 'extraHeart should still raise max hp');
  assert.ok(p.hp > 90, 'extraHeart should still heal through healPlayer()');

  p.hp = 0;
  const blocked = healPlayer(state, p, { amount: 20, sourceType: 'loot' });
  assert.equal(blocked.done, 0, 'normal heals should not revive dead players by accident');
  const revived = healPlayer(state, p, { amount: 18, sourceType: 'portal', allowRevive: true, minHp: 1 });
  assert.ok(revived.hp >= 1, 'portal-style heal should preserve old transition revive behavior');
});

test('visual feedback goes through pushVisualEffect or effect commands, not ad-hoc runtime pushes', () => {
  assert.match(commandsSrc, /export function pushVisualEffect/, 'pushVisualEffect() missing');
  assert.doesNotMatch(projectilesSrc, /state\.effects\.push/, 'projectiles.js pushes visuals directly');
  assert.doesNotMatch(companionsSrc, /state\.effects\.push/, 'companions.js pushes visuals directly');
  assert.doesNotMatch(abilitiesSrc, /state\.effects\.push/, 'abilities.js pushes visuals directly');
  assert.doesNotMatch(portalsSrc, /state\.effects\.push/, 'portals.js pushes visuals directly');
  const { state } = base('VISUAL-HELPER');
  const fx = pushVisualEffect(state, { type: 'testFx', life: 0.1 });
  assert.equal(fx.type, 'testFx');
  assert.equal(state.effects.at(-1).type, 'testFx');
});

test('enemy status tick is now routed through the status hook pipeline', () => {
  assert.match(effectsSrc, /runEnemyStatusTickPipeline/, 'status tick pipeline helper missing');
  assert.match(projectilesSrc, /runEnemyStatusTickPipeline\(state, enemy, dt\)/, 'projectiles status ticking bypasses status hook pipeline');
  const { state } = base('STATUS-HOOK-PIPELINE');
  const enemy = spawnEnemy(state, 'grunt', 540, 500);
  applyStatusToEnemy(enemy, 'burn', { dps: 12, duration: 1 }, 'p1');
  const tick = runEnemyStatusTickPipeline(state, enemy, 0.25);
  assert.ok(tick.damage > 0, 'status pipeline did not preserve status damage');
  assert.ok(tick.ticks.some((t) => t.tags.includes(DAMAGE_TAGS.BURN)), 'burn tick lacks concrete burn tag');
  assert.ok(tick.ctx.hasBurn, 'ENEMY_STATUS_TICK hook was not observable');
});

test('join/remove/death lifecycle keeps companions scoped to alive owners', () => {
  const { state, p } = base('COMPANION-LIFECYCLE');
  p.upgrades.taken.drone = 1;
  updateCompanions(state, 0.016);
  assert.ok(Object.values(state.companions).some((c) => c.ownerId === 'p1'), 'owner companion did not spawn');

  const p2 = addPlayer(state, 'p2', 1);
  p2.upgrades.taken.orbital = 1;
  updateCompanions(state, 0.016);
  assert.ok(Object.values(state.companions).some((c) => c.ownerId === 'p2'), 'join-in-progress player companion did not spawn');

  removePlayer(state, 'p2');
  updateCompanions(state, 0.016);
  assert.ok(Object.values(state.companions).every((c) => c.ownerId !== 'p2'), 'removed player companions leaked');

  p.hp = 0;
  updateCompanions(state, 0.016);
  assert.ok(Object.values(state.companions).every((c) => c.ownerId !== 'p1'), 'dead player companions leaked');
});

test('portal transitions can happen repeatedly without companion cross-room state', () => {
  const { state, p } = base('PORTAL-MULTI-COMPANION');
  p.upgrades.taken.drone = 1;
  p.upgrades.taken.orbital = 1;
  tick(state, 0.1);
  assert.ok(Object.keys(state.companions).length >= 2, 'companions missing before transition');
  moveTeamToNextLocation(state);
  assert.deepEqual(Object.keys(state.companions), [], 'companions must clear on first transition');
  tick(state, 0.1);
  const ids1 = new Set(Object.keys(state.companions));
  assert.ok(ids1.size >= 2, 'companions did not respawn after first transition');
  moveTeamToNextLocation(state);
  assert.deepEqual(Object.keys(state.companions), [], 'companions must clear on second transition');
  tick(state, 0.1);
  const ids2 = new Set(Object.keys(state.companions));
  assert.ok(ids2.size >= 2, 'companions did not respawn after second transition');
  assert.ok([...ids2].every((id) => !ids1.has(id)), 'second transition reused stale companion ids');
});

test('player and loot hooks remain official extension points', () => {
  const { state, p } = base('HOOK-EXTENSION-POINTS');
  const playerCtx = runPlayerHook(state, p, EFFECT_HOOKS.PLAYER_HEAL, { amount: 5 }, {
    '*': (_effect, ctx) => { ctx.touched = true; }
  });
  assert.equal(playerCtx.amount, 5, 'player hook context did not round trip');
  const lootCtx = runLootHook(state, p, { id: 'loot1' }, EFFECT_HOOKS.LOOT_ATTRACT, { radius: 0, force: 0 }, {
    '*': (_effect, ctx) => { ctx.touched = true; }
  });
  assert.equal(lootCtx.radius, 0, 'loot hook context did not round trip');
  assert.match(effectsSrc, /ARCHITECTURE GUARD: every gameplay heal must go/, 'heal architecture guard missing');
  assert.match(effectsSrc, /status ticking must remain visible to ENEMY_STATUS_TICK/, 'status architecture guard missing');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v36.2 polish checks passed`);
