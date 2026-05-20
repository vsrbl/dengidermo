import assert from 'node:assert/strict';
import { createGameState, addPlayer } from '../src/game/state.js';
import { fireWeapon } from '../src/game/combat.js';
import { updateProjectiles } from '../src/game/projectiles.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { giveWeapon, switchWeapon } from '../src/game/inventory.js';
import { WEAPONS } from '../src/data/weapons.js';
import { EFFECT_DEFS } from '../src/game/effects.js';

function fresh(weaponId = 'shotgun') {
  const state = createGameState(`FEEL-${weaponId}`);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.angle = 0; p.hp = 100; p.maxHp = 100;
  state.spawnTimer = 9999;
  giveWeapon(p, weaponId, true);
  switchWeapon(p, weaponId);
  return { state, p };
}

function runAndWatchShake(state, seconds = 1, dt = 1 / 240) {
  const steps = Math.ceil(seconds / dt);
  let saw = false;
  let maxPower = 0;
  for (let i = 0; i < steps; i += 1) {
    updateProjectiles(state, dt);
    const total = state.effects
      .filter((fx) => fx.type === 'shake')
      .reduce((sum, fx) => sum + fx.power, 0);
    if (total > 0) saw = true;
    maxPower = Math.max(maxPower, total);
  }
  return { saw, maxPower };
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

test('shotgun spread is tight enough for a compact cone', () => {
  const spread = WEAPONS.shotgun.spread;
  const pellets = WEAPONS.shotgun.pellets;
  const totalCone = spread * Math.max(0, pellets - 1);
  assert.ok(spread <= 0.14, `per-pellet spread too wide: ${spread}`);
  assert.ok(totalCone <= 0.75, `total cone too wide: ${totalCone}`);
  assert.ok(totalCone >= 0.45, `total cone too narrow / loses shotgun identity: ${totalCone}`);
});

test('camera shake is intentionally rocket-only for now', () => {
  assert.ok(EFFECT_DEFS.hitShake, 'missing hitShake effect definition');
  assert.ok(EFFECT_DEFS.hitShake.hooks.includes('projectile:hit'), 'hitShake is not attached to projectile hit hook');
  assert.equal(WEAPONS.shotgun.effects?.some((effect) => effect.type === 'hitShake'), false, 'shotgun should not have hitShake right now');
  assert.equal(WEAPONS.seeker.effects?.some((effect) => effect.type === 'hitShake'), false, 'seeker should not have hitShake right now');
  const rocketHitShake = WEAPONS.rocket.effects?.find((effect) => effect.type === 'hitShake');
  const rocketScreenShake = WEAPONS.rocket.effects?.find((effect) => effect.type === 'screenShake');
  assert.ok(rocketHitShake, 'rocket has no hitShake effect');
  assert.ok(rocketHitShake.power >= 5 && rocketHitShake.power <= 7, `rocket hitShake power out of range: ${rocketHitShake.power}`);
  assert.ok(rocketScreenShake, 'rocket has no screenShake effect');
  assert.ok(rocketScreenShake.power >= 9 && rocketScreenShake.power <= 12, `rocket screenShake power out of range: ${rocketScreenShake.power}`);
});

test('shotgun and seeker hits deal damage without camera shake', () => {
  for (const weaponId of ['shotgun', 'seeker']) {
    const { state } = fresh(weaponId);
    const e = disableArmor(spawnEnemy(state, 'boss', weaponId === 'shotgun' ? 640 : 700, 500));
    const before = e.hp;
    const ok = fireWeapon(state, 'p1', { angle: 0, weapon: weaponId, fireSeq: 1 });
    assert.equal(ok, true, `${weaponId} failed to fire`);
    const watched = runAndWatchShake(state, weaponId === 'shotgun' ? 0.45 : 1.2);
    assert.ok(e.hp < before, `${weaponId} did not damage boss (${before} -> ${e.hp})`);
    assert.equal(watched.saw, false, `${weaponId} should not create camera shake right now`);
    assert.equal(watched.maxPower, 0, `${weaponId} created unexpected shake power: ${watched.maxPower}`);
  }
});

test('rocket hit/explosion creates visible controlled runtime camera shake', () => {
  const { state } = fresh('rocket');
  disableArmor(spawnEnemy(state, 'boss', 700, 500));
  const ok = fireWeapon(state, 'p1', { angle: 0, weapon: 'rocket', fireSeq: 2 });
  assert.equal(ok, true, 'rocket failed to fire');
  const watched = runAndWatchShake(state, 1.8);
  assert.ok(watched.saw, 'rocket hit/explosion did not create shake');
  assert.ok(watched.maxPower >= 6 && watched.maxPower <= 12.1, `rocket shake is not visible/controlled: ${watched.maxPower}`);
});

let failed = 0;
for (const [status, name, e] of results) {
  if (status === 'ok') console.log('PASS', name);
  else { failed += 1; console.error('FAIL', name); console.error(e?.stack || e); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} feel checks passed`);
