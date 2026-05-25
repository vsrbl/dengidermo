import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer } from '../src/game/state.js';
import { fireWeapon } from '../src/game/combat.js';
import { dealPlayerDamage } from '../src/game/effects.js';
import { updateProjectiles } from '../src/game/projectiles.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { giveWeapon, switchWeapon } from '../src/game/inventory.js';

function fresh(weaponId = 'shotgun') {
  const state = createGameState(`SHAKE-${weaponId}`);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.angle = 0; p.hp = 100; p.maxHp = 100;
  state.spawnTimer = 9999;
  giveWeapon(p, weaponId, true);
  switchWeapon(p, weaponId);
  return { state, p };
}

function runProjectiles(state, seconds = 1, dt = 1 / 240) {
  const steps = Math.ceil(seconds / dt);
  let maxShake = 0;
  let maxShakeCount = 0;
  const shakeIds = new Set();
  for (let i = 0; i < steps; i += 1) {
    updateProjectiles(state, dt);
    const shakes = state.effects.filter((fx) => fx.type === 'shake');
    for (const fx of shakes) if (fx.id) shakeIds.add(fx.id);
    maxShakeCount = Math.max(maxShakeCount, shakes.length);
    maxShake = Math.max(maxShake, shakes.reduce((sum, fx) => sum + (fx.power || 0), 0));
  }
  return { maxShake, maxShakeCount, shakeIds };
}

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

test('shotgun pellet hits do damage but do not create camera shake', () => {
  const { state } = fresh('shotgun');
  const boss = disableArmor(spawnEnemy(state, 'boss', 640, 500));
  const before = boss.hp;
  assert.equal(fireWeapon(state, 'p1', { angle: 0, weapon: 'shotgun', fireSeq: 1 }), true);
  const watched = runProjectiles(state, 0.35);
  assert.ok(boss.hp < before, 'shotgun did not hit the boss');
  assert.equal(watched.maxShakeCount, 0, `shotgun spawned shake effects: ${watched.maxShakeCount}`);
  assert.equal(watched.maxShake, 0, `shotgun created unexpected shake power: ${watched.maxShake}`);
});

test('seeker impact/explosion does damage but does not create camera shake', () => {
  const { state } = fresh('seeker');
  const boss = disableArmor(spawnEnemy(state, 'boss', 700, 500));
  const before = boss.hp;
  assert.equal(fireWeapon(state, 'p1', { angle: 0, weapon: 'seeker', fireSeq: 1 }), true);
  const watched = runProjectiles(state, 0.8);
  assert.ok(boss.hp < before, 'seeker did not damage the boss');
  assert.equal(watched.maxShakeCount, 0, `seeker spawned shake effects: ${watched.maxShakeCount}`);
  assert.equal(watched.maxShake, 0, `seeker created unexpected shake power: ${watched.maxShake}`);
});

test('rocket explosion shake is clamped, owner-scoped, and not linearly stacked', () => {
  const { state } = fresh('rocket');
  disableArmor(spawnEnemy(state, 'boss', 700, 500));
  assert.equal(fireWeapon(state, 'p1', { angle: 0, weapon: 'rocket', fireSeq: 1 }), true);
  const watched = runProjectiles(state, 0.8);
  assert.ok(watched.maxShake > 0, 'rocket did not produce shake');
  assert.ok(watched.maxShake >= 6, `rocket shake is too weak to be visible: ${watched.maxShake}`);
  assert.ok(watched.maxShake <= 12.1, `rocket shake exceeded clamp: ${watched.maxShake}`);
  assert.ok(watched.shakeIds.size > 0, 'rocket shake effects had no stable ids');
  const shakes = state.effects.filter((fx) => fx.type === 'shake');
  assert.ok(shakes.length > 0, 'rocket shake effects expired before scope could be inspected');
  for (const fx of shakes) {
    assert.equal(fx.audience, 'owner', 'projectile camera shake must be owner-local');
    assert.equal(fx.ownerId, 'p1', 'projectile camera shake must target the shooter only');
  }
});


test('player damage camera shake is target-local, not broadcast to allies', () => {
  const { state, p } = fresh('shotgun');
  const ally = addPlayer(state, 'p2', 1);
  ally.x = 560; ally.y = 500; ally.hp = 100; ally.maxHp = 100;
  const hit = dealPlayerDamage(state, p, { amount: 18, sourceType: 'enemy', tags: ['enemy'] });
  assert.ok(hit.done > 0, 'player damage did not apply');
  const shakes = state.effects.filter((fx) => fx.type === 'shake');
  assert.ok(shakes.length > 0, 'player damage did not create local feedback shake');
  for (const fx of shakes) {
    assert.equal(fx.audience, 'target', 'player-hit camera shake must be target-local');
    assert.equal(fx.targetId, 'p1', 'player-hit camera shake must target the damaged player only');
    assert.notEqual(fx.targetId, 'p2', 'ally should not receive damaged-player camera shake');
  }
});

test('renderer consumes shake locally instead of summing snapshot power every frame', () => {
  const rendererSrc = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
  assert.match(rendererSrc, /seen:\s*new Set\(\)/, 'renderer shake de-duplication set missing');
  assert.match(rendererSrc, /function ingestCameraShake/, 'renderer local shake ingest missing');
  assert.match(rendererSrc, /function shakeVisibleToLocal/, 'renderer is missing local shake audience filter');
  assert.match(rendererSrc, /fx\.targetId === localId/, 'renderer does not keep target-local shake private');
  assert.match(rendererSrc, /fx\.ownerId === localId/, 'renderer does not keep owner-local projectile shake private');
  assert.match(rendererSrc, /Math\.hypot\(shake\.power/, 'renderer does not combine shake as energy');
  assert.match(rendererSrc, /cameraWithShake\(cam, renderer, snapshot, renderDt, localId\)/, 'render path is not using localId-filtered shake state');
  assert.match(rendererSrc, /const SHAKE_RENDER_MAX = 12/, 'renderer shake cap is too low / not visible enough');
  assert.match(rendererSrc, /const SHAKE_DECAY = 10\.5/, 'renderer shake decay is not the tuned visible value');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} shake checks passed`);
