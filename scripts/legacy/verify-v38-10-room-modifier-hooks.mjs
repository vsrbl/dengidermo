import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../../src/core/constants.js';
import { ROOM_MODIFIERS } from '../../src/data/roomModifiers.js';
import { ROOM_SEQUENCE } from '../../src/data/rooms.js';
import { createGameState } from '../../src/game/state.js';
import { currentLocation, beginRoomTransition } from '../../src/game/roomFlow.js';
import {
  ROOM_MODIFIER_COMMAND_TYPES,
  ROOM_MODIFIER_HOOKS,
  enterRoomModifierRuntime,
  executeRoomModifierCommand,
  exitRoomModifierRuntime,
  runRoomModifierHooks,
  runRoomModifierHooksForLocation
} from '../../src/game/roomModifiers.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const roomModifiersSrc = readFileSync(new URL('../src/game/roomModifiers.js', import.meta.url), 'utf8');
const dataModifiersSrc = readFileSync(new URL('../src/data/roomModifiers.js', import.meta.url), 'utf8');
const effectsSrc = ['effects.js', 'effects/defs.js', 'effects/core.js', 'effects/damage.js', 'effects/status.js', 'effects/loot.js']
  .map((name) => `${name}\n${readFileSync(new URL(`../src/game/${name}`, import.meta.url), 'utf8')}`)
  .join('\n---\n');
const directorSrc = readFileSync(new URL('../src/game/director.js', import.meta.url), 'utf8');
const directorReadSrc = readFileSync(new URL('../src/game/directorRead.js', import.meta.url), 'utf8');
const enemiesSrc = readFileSync(new URL('../src/game/enemies.js', import.meta.url), 'utf8');
const projectilesSrc = readFileSync(new URL('../src/game/projectiles.js', import.meta.url), 'utf8');
const roomFlowSrc = readFileSync(new URL('../src/game/roomFlow.js', import.meta.url), 'utf8');
const rendererSrc = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
const allGameplaySrc = [effectsSrc, directorSrc, directorReadSrc, enemiesSrc, projectilesSrc, roomFlowSrc].join('\n');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function customModifier(hookName, commands) {
  return {
    id: 'test_runtime_modifier',
    name: 'TEST RUNTIME MODIFIER',
    description: 'test-only modifier hook contract',
    category: 'test',
    tags: ['test'],
    hooks: { [hookName]: commands }
  };
}

test('v38.13.8 is registered as room modifier runtime hook foundation', () => {
  assert.equal(VERSION, 'v38.13.8');
  assert.equal(pkg.version, '38.13.8');
  assert.equal(serverPkg.version, '38.13.8');
  assert.match(pkg.scripts['check:all'], /check:v38-10/);
});

test('all initial room modifier hooks are declared explicitly', () => {
  const expected = [
    'room:enter',
    'room:exit',
    'director:budget',
    'director:spawn',
    'director:cap',
    'enemy:spawn',
    'enemy:update',
    'projectile:update',
    'projectile:damage',
    'player:damage',
    'player:heal',
    'loot:roll',
    'portal:open',
    'render:background'
  ];
  assert.deepEqual(Object.values(ROOM_MODIFIER_HOOKS).sort(), expected.sort());
});

test('current room modifiers remain identity-only and do not change gameplay yet', () => {
  for (const modifier of Object.values(ROOM_MODIFIERS)) {
    assert.ok(modifier.id);
    assert.deepEqual(modifier.hooks, {}, `${modifier.id} should keep empty hooks in v38.13.8`);
  }
  for (const room of ROOM_SEQUENCE) {
    assert.ok(room.modifiers?.length, `${room.id} should keep identity modifier metadata`);
    assert.equal(room.layout, 'open_arena', `${room.id} should not switch layouts in v38.13.8`);
  }
});

test('validated command executor mutates only allowlisted fields', () => {
  const state = createGameState('ROOM-MODIFIER-COMMANDS');
  const ctx = { damage: 10, tags: ['projectile'], hookName: ROOM_MODIFIER_HOOKS.PROJECTILE_DAMAGE };

  let result = executeRoomModifierCommand(state, ROOM_MODIFIER_HOOKS.PROJECTILE_DAMAGE, ctx, {
    type: ROOM_MODIFIER_COMMAND_TYPES.SCALE,
    field: 'damage',
    factor: 1.5
  }, 'test_mod');
  assert.equal(result.executed, true);
  assert.equal(ctx.damage, 15);

  result = executeRoomModifierCommand(state, ROOM_MODIFIER_HOOKS.PROJECTILE_DAMAGE, ctx, {
    type: ROOM_MODIFIER_COMMAND_TYPES.ADD,
    field: 'hp',
    value: 999
  }, 'test_mod');
  assert.equal(result.rejected, true);
  assert.equal(ctx.hp, undefined);

  result = executeRoomModifierCommand(state, ROOM_MODIFIER_HOOKS.PROJECTILE_DAMAGE, ctx, {
    type: ROOM_MODIFIER_COMMAND_TYPES.TAG,
    tag: 'room-test'
  }, 'test_mod');
  assert.equal(result.executed, true);
  assert.ok(ctx.tags.includes('room-test'));
});

test('runRoomModifierHooks executes declarative commands and rejects arbitrary mutation', () => {
  const state = createGameState('ROOM-MODIFIER-HOOKS');
  const modifier = customModifier(ROOM_MODIFIER_HOOKS.PLAYER_DAMAGE, [
    { type: ROOM_MODIFIER_COMMAND_TYPES.SCALE, field: 'damage', factor: 0.5 },
    { type: ROOM_MODIFIER_COMMAND_TYPES.SET, field: 'blockedBy', value: 'test-room-modifier' },
    { type: ROOM_MODIFIER_COMMAND_TYPES.ADD, field: 'maxHp', value: 999 },
    { type: ROOM_MODIFIER_COMMAND_TYPES.EMIT_EVENT, event: { type: 'roomModifierTest' } }
  ]);
  const ctx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.PLAYER_DAMAGE, {
    damage: 20,
    blocked: false,
    blockedBy: null,
    tags: ['player', 'damage']
  }, { modifiers: [modifier] });

  assert.equal(ctx.damage, 10);
  assert.equal(ctx.blockedBy, 'test-room-modifier');
  assert.equal(ctx.maxHp, undefined);
  assert.equal(state.events.at(-1).type, 'roomModifierTest');
  assert.ok(state.roomModifierRuntime.rejectedCommands >= 1);
});

test('room enter and exit hooks initialize and clear modifier runtime state', () => {
  const state = createGameState('ROOM-MODIFIER-RUNTIME');
  const loc = {
    id: 'test-room',
    modifierIds: ['test_runtime_modifier'],
    modifiers: [customModifier(ROOM_MODIFIER_HOOKS.ROOM_ENTER, [
      { type: ROOM_MODIFIER_COMMAND_TYPES.EMIT_EVENT, event: { type: 'enteredTestRoom' } }
    ])]
  };
  enterRoomModifierRuntime(state, loc, { reason: 'test-enter' });
  assert.deepEqual(state.roomModifierRuntime.activeIds, ['test_runtime_modifier']);
  assert.equal(state.events.at(-1).type, 'enteredTestRoom');

  const exitLoc = {
    ...loc,
    modifiers: [customModifier(ROOM_MODIFIER_HOOKS.ROOM_EXIT, [
      { type: ROOM_MODIFIER_COMMAND_TYPES.EMIT_EVENT, event: { type: 'exitedTestRoom' } }
    ])]
  };
  exitRoomModifierRuntime(state, exitLoc, { reason: 'test-exit' });
  assert.deepEqual(state.roomModifierRuntime.activeIds, []);
  assert.equal(state.roomModifierRuntime.lastHook, ROOM_MODIFIER_HOOKS.ROOM_EXIT);
});

test('render background hook resolves client-side from modifier IDs without needing snapshot geometry', () => {
  const modifier = customModifier(ROOM_MODIFIER_HOOKS.RENDER_BACKGROUND, [
    { type: ROOM_MODIFIER_COMMAND_TYPES.SET, field: 'accent', value: 'white' },
    { type: ROOM_MODIFIER_COMMAND_TYPES.SET, field: 'gridStep', value: 96 }
  ]);
  const ctx = runRoomModifierHooksForLocation({ modifiers: [modifier] }, ROOM_MODIFIER_HOOKS.RENDER_BACKGROUND, {
    accent: 'green',
    gridStep: 80
  });
  assert.equal(ctx.accent, 'white');
  assert.equal(ctx.gridStep, 96);
});

test('createGameState and room transition keep runtime tied to persisted roomPlan modifiers', () => {
  const state = createGameState('ROOM-MODIFIER-TRANSITION');
  assert.deepEqual(state.roomModifierRuntime.activeIds, ['grid_static']);
  assert.equal(currentLocation(state).id, 'grid-00');
  beginRoomTransition(state, 'test', { nextRunDepth: 1, offerUpgrades: false });
  assert.equal(currentLocation(state).id, 'void-01');
  assert.deepEqual(state.roomModifierRuntime.activeIds, ['void_drift']);
});

test('gameplay systems route through room modifier hooks instead of modifier id if-chains', () => {
  for (const hook of Object.values(ROOM_MODIFIER_HOOKS)) {
    assert.match(roomModifiersSrc, new RegExp(hook.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(effectsSrc, /ROOM_MODIFIER_HOOKS\.PROJECTILE_DAMAGE/);
  assert.match(effectsSrc, /ROOM_MODIFIER_HOOKS\.PLAYER_DAMAGE/);
  assert.match(effectsSrc, /ROOM_MODIFIER_HOOKS\.PLAYER_HEAL/);
  assert.match(effectsSrc, /ROOM_MODIFIER_HOOKS\.LOOT_ROLL/);
  assert.match(directorSrc, /ROOM_MODIFIER_HOOKS\.DIRECTOR_SPAWN/);
  assert.match(directorReadSrc, /ROOM_MODIFIER_HOOKS\.DIRECTOR_BUDGET/);
  assert.match(directorReadSrc, /ROOM_MODIFIER_HOOKS\.DIRECTOR_CAP/);
  assert.match(directorReadSrc, /ROOM_MODIFIER_HOOKS\.PORTAL_OPEN/);
  assert.match(enemiesSrc, /ROOM_MODIFIER_HOOKS\.ENEMY_SPAWN/);
  assert.match(enemiesSrc, /ROOM_MODIFIER_HOOKS\.ENEMY_UPDATE/);
  assert.match(projectilesSrc, /ROOM_MODIFIER_HOOKS\.PROJECTILE_UPDATE/);
  assert.match(roomFlowSrc, /enterRoomModifierRuntime/);
  assert.match(roomFlowSrc, /exitRoomModifierRuntime/);
  assert.match(rendererSrc, /ROOM_MODIFIER_HOOKS\.RENDER_BACKGROUND/);
  assert.doesNotMatch(allGameplaySrc, /modifierId\s*===|modifierId\s*!==|hasRoomModifier\(/);
  assert.doesNotMatch(dataModifiersSrc, /damage|budget|cap|heal|loot|portal/i, 'data modifiers should stay identity-only in v38.13.8');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.8 room modifier runtime hook checks passed`);
