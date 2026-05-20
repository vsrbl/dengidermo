import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../src/core/constants.js';
import {
  PROJECTILE_BEHAVIOR_HELPERS,
  applyProjectileHomingBehavior,
  applyProjectileWallPosition,
  createClusterExplosionRequests,
  createSplitProjectileChildren,
  resolveExplosionBehavior,
  resolveProjectileWallEnd,
  resolveRicochetCommands
} from '../src/game/projectileBehaviors.js';
import { ROOM_SEQUENCE } from '../src/data/rooms.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { ENEMIES } from '../src/data/enemies.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));
const serverSrc = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
const projectilesSrc = readFileSync(new URL('../src/game/projectiles.js', import.meta.url), 'utf8');
const helpersSrc = readFileSync(new URL('../src/game/projectileBehaviors.js', import.meta.url), 'utf8');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function baseProjectile(overrides = {}) {
  return {
    id: 'pr_test',
    ownerId: 'p1',
    weaponId: 'rocketgun',
    kind: 'rocket',
    x: 100,
    y: 120,
    vx: 100,
    vy: 0,
    speed: 100,
    damage: 20,
    radius: 8,
    range: 520,
    distance: 0,
    life: 1,
    effects: [{ type: 'splitRockets' }, { type: 'burn', duration: 1 }],
    hitIds: { old: true },
    pierced: 1,
    ricocheted: 0,
    exploded: true,
    expiredEffectsFired: true,
    childDepth: 0,
    targetId: 'old',
    ...overrides
  };
}

test('v38.13.6 is registered as projectile behavior helper cleanup', () => {
  assert.equal(VERSION, 'v38.13.6');
  assert.equal(pkg.version, '38.13.6');
  assert.equal(serverPkg.version, '38.13.6');
  assert.match(serverSrc, /nncckkrr signaling v38\.13\.6/);
  assert.match(pkg.scripts['check:all'], /check:v38-13-2/);
  assert.equal(pkg.scripts['check:v38-13-2'], 'node scripts/verify-v38-13-2-projectile-behavior-helpers.mjs');
});

test('projectile behavior helper registry exposes the intended helper surface', () => {
  assert.ok(Object.isFrozen(PROJECTILE_BEHAVIOR_HELPERS), 'PROJECTILE_BEHAVIOR_HELPERS should be immutable');
  assert.equal(PROJECTILE_BEHAVIOR_HELPERS.homing, applyProjectileHomingBehavior);
  assert.equal(PROJECTILE_BEHAVIOR_HELPERS.wall, resolveProjectileWallEnd);
  assert.equal(PROJECTILE_BEHAVIOR_HELPERS.explosion, resolveExplosionBehavior);
  assert.equal(PROJECTILE_BEHAVIOR_HELPERS.split, createSplitProjectileChildren);
  assert.equal(PROJECTILE_BEHAVIOR_HELPERS.cluster, createClusterExplosionRequests);
  assert.equal(PROJECTILE_BEHAVIOR_HELPERS.ricochet, resolveRicochetCommands);
});

test('projectiles.js delegates reusable behavior logic to helper functions', () => {
  assert.match(projectilesSrc, /from "\.\/projectileBehaviors\.js";/);
  for (const name of [
    'applyProjectileHomingBehavior',
    'resolveExplosionBehavior',
    'createSplitProjectileChildren',
    'createClusterExplosionRequests',
    'resolveProjectileWallEnd',
    'resolveRicochetCommands'
  ]) {
    assert.match(projectilesSrc, new RegExp(`${name}\\(`), `${name} should be used from projectiles.js`);
  }
  assert.doesNotMatch(projectilesSrc, /function applyProjectileHomingBehavior\(/, 'homing helper should not drift back into projectiles.js');
  assert.doesNotMatch(projectilesSrc, /function createSplitProjectileChildren\(/, 'split helper should not drift back into projectiles.js');
  assert.doesNotMatch(projectilesSrc, /function createClusterExplosionRequests\(/, 'cluster helper should not drift back into projectiles.js');
});

test('helper module stays behavior-only and does not own damage or kill pipelines', () => {
  assert.doesNotMatch(helpersSrc, /dealDamage|dealPlayerDamage|finishEnemyKill|resolveProjectileDamage|healProjectileOwner/);
  assert.doesNotMatch(helpersSrc, /pushVisualEffect|state\.effects\.push/);
  assert.doesNotMatch(helpersSrc, /enemy\.hp\s*[-+]?=/);
  assert.match(helpersSrc, /export const PROJECTILE_BEHAVIOR_HELPERS = Object\.freeze\(\{/);
});

test('explosion helper preserves radius damage force and visual life math', () => {
  const p = baseProjectile({ damage: 20, explosionRadiusMult: 1.5, explosionDamageMult: 2, knockbackMult: 0.5 });
  const large = resolveExplosionBehavior(p, { radius: 80, damage: 7, force: 220, visual: 'large' });
  assert.deepEqual(large, { radius: 120, damage: 14, force: 110, life: 0.36 });
  const fallback = resolveExplosionBehavior(baseProjectile({ damage: 30 }), {});
  assert.equal(fallback.radius, 80);
  assert.equal(fallback.damage, 30);
  assert.equal(fallback.force, 220);
  assert.equal(fallback.life, 0.24);
});

test('split helper creates bounded child projectiles with reset runtime fields', () => {
  const children = createSplitProjectileChildren(baseProjectile({ vx: 100, vy: 0, speed: 100, damage: 20, radius: 10, range: 700, life: 2 }), {
    count: 3,
    spread: Math.PI,
    speed: 80,
    damage: 9,
    range: 400
  });
  assert.equal(children.length, 3);
  assert.equal(new Set(children.map((c) => c.id)).size, 3, 'child projectile ids should be unique');
  for (const child of children) {
    assert.equal(child.speed, 80);
    assert.equal(child.damage, 9);
    assert.ok(Math.abs(child.radius - 6.8) < 0.000001);
    assert.equal(child.distance, 0);
    assert.equal(child.range, 400);
    assert.equal(child.life, 0.75);
    assert.deepEqual(child.hitIds, {});
    assert.equal(child.pierced, 0);
    assert.equal(child.ricocheted, 0);
    assert.equal(child.exploded, false);
    assert.equal(child.expiredEffectsFired, false);
    assert.equal(child.childDepth, 1);
    assert.equal(child.targetId, null);
    assert.ok(!child.effects.some((effect) => effect.type === 'splitRockets'), 'children must not keep splitRockets effect');
  }
  assert.equal(createSplitProjectileChildren(baseProjectile(), { count: 30 }).length, 12, 'split count should be clamped');
});

test('cluster helper creates bounded explosion requests without executing explosion damage', () => {
  const values = [0, 0.25, 0.5, 0.75];
  const state = { rng: { range(min, max) { return min + (max - min) * values.shift(); } } };
  const requests = createClusterExplosionRequests(state, baseProjectile({ x: 100, y: 100, damage: 50 }), { count: 2, spread: 100, radius: 40 });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map((r) => r.effect), [
    { type: 'explode', radius: 40, damage: 21, force: 110, visual: 'small' },
    { type: 'explode', radius: 40, damage: 21, force: 110, visual: 'small' }
  ]);
  assert.equal(createClusterExplosionRequests(state, baseProjectile(), { count: 99 }).length, 16, 'cluster count should be clamped');
});

test('wall helper resolves world bounds, solid wall hits, and ricochet mutation cleanly', () => {
  const outProjectile = baseProjectile({ x: 2500, y: 100, vx: 100, vy: 0, life: 1, distance: 1, range: 1000 });
  const out = resolveProjectileWallEnd(outProjectile, null, { w: 2400, h: 1400 });
  assert.equal(out.shouldEnd, true);
  assert.equal(out.outX, true);
  assert.deepEqual(out.normal, { x: -1, y: 0 });
  assert.deepEqual(out.position, { x: 2400, y: 100 });

  const wallProjectile = baseProjectile({ x: 100, y: 100, vx: -100, vy: 0 });
  const wall = resolveProjectileWallEnd(wallProjectile, { x: 80, y: 100, normal: { x: 1, y: 0 }, wall: { id: 'w1' } }, { w: 2400, h: 1400 });
  assert.equal(wall.hitWall, true);
  assert.equal(applyProjectileWallPosition(wallProjectile, wall), true);
  assert.equal(wallProjectile.x, 80);
  assert.equal(wallProjectile.y, 100);

  const c = { projectile: wallProjectile, position: wall.position, normal: wall.normal, outX: true, outY: false, didRicochet: false };
  const commands = resolveRicochetCommands({ count: 1 }, c);
  assert.equal(c.didRicochet, true);
  assert.equal(wallProjectile.ricocheted, 1);
  assert.equal(wallProjectile.vx, 100);
  assert.deepEqual(wallProjectile.hitIds, {});
  assert.equal(wallProjectile.targetId, null);
  assert.equal(commands.length, 3);
  assert.equal(resolveRicochetCommands({ count: 1 }, c), null, 'ricochet count should cap repeated bounces');
});

test('homing helper runs through projectile update hook and steers toward acquired target', () => {
  const projectile = baseProjectile({ x: 0, y: 0, vx: 100, vy: 0, speed: 100 });
  const didHome = applyProjectileHomingBehavior({
    state: {},
    projectile,
    dt: 1,
    nearestEnemy(_state, _projectile, range) {
      assert.equal(range, 900);
      return { id: 'e1', x: 0, y: 100 };
    },
    runProjectileHook(_state, p, _hook, context, handlers) {
      const c = { ...context, projectile: p };
      handlers.homing({ strength: 1, acquireRange: 900 }, c);
      return c;
    }
  });
  assert.equal(didHome, true);
  assert.ok(Math.abs(projectile.vx) < 0.000001);
  assert.ok(Math.abs(projectile.vy - 100) < 0.000001);
});

test('v38.13.6 is architecture-only: baseline content remains unchanged', () => {
  assert.deepEqual(Object.keys(ENEMIES).sort(), ['boss', 'grunt', 'runner', 'shooter', 'tank']);
  for (const room of ROOM_SEQUENCE) assert.equal(room.layout, 'open_arena', `${room.id} should keep open_arena in v38.13.6`);
  for (const modifier of Object.values(ROOM_MODIFIERS)) assert.deepEqual(modifier.hooks, {}, `${modifier.id} should remain identity-only in v38.13.6`);
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v38.13.6 projectile behavior helper checks passed`);
