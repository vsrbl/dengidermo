import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer } from '../src/game/state.js';
import { updateProjectiles, makeProjectile } from '../src/game/projectiles.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { WORLD } from '../src/core/constants.js';
import { DAMAGE_TAGS, EFFECT_HOOKS, createEffectContext, effectCommand, tickEnemyStatuses } from '../src/game/effects.js';
import { executeEffectCommands } from '../src/game/effectCommands.js';

const projectilesSrc = readFileSync(new URL('../src/game/projectiles.js', import.meta.url), 'utf8');
const commandsSrc = readFileSync(new URL('../src/game/effectCommands.js', import.meta.url), 'utf8');

function disableArmor(enemy) {
  if (enemy?.armor) {
    enemy.armor.hp = 0;
    enemy.armor.broken = true;
    enemy.armor.regenCooldown = 9999;
  }
  return enemy;
}

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function run(state, seconds = 0.5, dt = 1 / 240) {
  for (let i = 0; i < Math.ceil(seconds / dt); i += 1) updateProjectiles(state, dt);
}

function baseState(seed = 'HOOKS') {
  const state = createGameState(seed);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.angle = 0; p.hp = 100; p.maxHp = 100;
  state.spawnTimer = 9999;
  return { state, p };
}

test('effect command executor is shared outside projectiles.js', () => {
  assert.match(commandsSrc, /export function executeEffectCommands/, 'shared command executor missing');
  assert.doesNotMatch(projectilesSrc, /function executeEffectCommands/, 'projectiles.js owns the executor again');
  assert.match(projectilesSrc, /executeEffectCommands\(state, ctx\.commands, ctx, commandHandlers\)/, 'projectile hook wrapper does not use shared executor');
});

test('generic status commands apply status and record appliedStatuses', () => {
  const { state } = baseState('HOOK-STATUS');
  const enemy = spawnEnemy(state, 'boss', 600, 500);
  const projectile = { id: 'pr-test', ownerId: 'p1', weaponId: 'shotgun' };
  const ctx = createEffectContext({ state, projectile, enemy, target: enemy });
  executeEffectCommands(state, [effectCommand('status', { status: 'burn', target: enemy, effect: { dps: 5, duration: 1 }, source: projectile })], ctx);
  assert.ok(enemy.status?.burn, 'burn status command did not apply');
  assert.equal(ctx.appliedStatuses?.[0]?.type, 'burn', 'applied status was not tracked on context');
});

test('status tick damage carries concrete status tags', () => {
  const enemy = { hp: 100, status: {
    burn: { t: 1, dps: 10, sourceId: 'p1', stacks: 1 },
    poison: { t: 1, dps: 5, slow: 0.2, sourceId: 'p1', stacks: 1 }
  }};
  const tick = tickEnemyStatuses(enemy, 0.25);
  assert.ok(tick.damage > 0, 'status damage did not tick');
  const tagSets = tick.ticks.map((item) => item.tags.join(','));
  assert.ok(tagSets.some((tags) => tags.includes(DAMAGE_TAGS.BURN)), `burn tag missing: ${tagSets}`);
  assert.ok(tagSets.some((tags) => tags.includes(DAMAGE_TAGS.POISON)), `poison tag missing: ${tagSets}`);
  assert.ok(tick.ticks.every((item) => item.tags.includes(DAMAGE_TAGS.STATUS)), 'status base tag missing');
});

test('projectile:kill commands execute before enemy removal', () => {
  const { state } = baseState('HOOK-KILL');
  const enemy = spawnEnemy(state, 'grunt', 560, 500);
  enemy.hp = 1;
  state.projectiles.prKill = makeProjectile({
    id: 'prKill', ownerId: 'p1', weaponId: 'shotgun', x: 500, y: 500, angle: 0,
    effects: [{ type: 'spark', hooks: [EFFECT_HOOKS.PROJECTILE_KILL], count: 2 }]
  });
  run(state, 0.12);
  assert.equal(state.enemies[enemy.id], undefined, 'enemy was not killed by test projectile');
  assert.ok(state.effects.some((fx) => fx.type === 'spark'), 'kill hook spark command was not executed');
});

test('projectile:wall hook owns ricochet behavior and keeps wall shake intentional', () => {
  const { state } = baseState('HOOK-WALL');
  state.projectiles.prWall = makeProjectile({
    id: 'prWall', ownerId: 'p1', weaponId: 'shotgun', x: WORLD.w - 2, y: 500, angle: 0,
    effects: [{ type: 'ricochet', count: 1 }]
  });
  run(state, 0.05);
  const p = state.projectiles.prWall;
  assert.ok(p, 'ricochet projectile was incorrectly removed at wall');
  assert.ok(p.vx < 0, 'ricochet did not flip velocity');
  assert.ok(state.effects.some((fx) => fx.type === 'ricochet'), 'ricochet visual event missing');
  assert.ok(state.effects.some((fx) => fx.type === 'shake' && (fx.source === 'ricochet' || fx.sources?.includes('ricochet'))), 'ricochet wall shake missing or not sourced');
});

test('projectile hit pipeline is centralized after damage resolution', () => {
  const dealBody = projectilesSrc.slice(projectilesSrc.indexOf('function dealProjectileDamage'), projectilesSrc.indexOf('function runProjectileHitEffects'));
  assert.doesNotMatch(dealBody, /EFFECT_HOOKS\.PROJECTILE_HIT/, 'dealProjectileDamage should not fire hit hooks directly');
  assert.match(projectilesSrc, /function runProjectileHitEffects/, 'central projectile hit effect pipeline missing');
  assert.doesNotMatch(projectilesSrc, /applyProjectileStatuses\(projectile, e\)|applyProjectileStatuses\(projectile, enemy\)/, 'projectiles.js still applies statuses through separate hit hook path');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} hook pipeline checks passed`);
