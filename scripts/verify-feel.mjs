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

function runProjectiles(state, seconds = 1, dt = 1 / 240) {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i += 1) updateProjectiles(state, dt);
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

test('hitShake is a registered projectile hit effect', () => {
  assert.ok(EFFECT_DEFS.hitShake, 'missing hitShake effect definition');
  assert.ok(EFFECT_DEFS.hitShake.hooks.includes('projectile:hit'), 'hitShake is not attached to projectile hit hook');
  for (const [weaponId, weapon] of Object.entries(WEAPONS)) {
    const shake = weapon.effects?.find((effect) => effect.type === 'hitShake');
    assert.ok(shake, `${weaponId} has no hitShake effect`);
    assert.ok(shake.power > 0 && shake.power <= 0.8, `${weaponId} hitShake power out of small-impact range`);
  }
});

test('shotgun hit creates small runtime camera shake and still deals damage', () => {
  const { state } = fresh('shotgun');
  const e = spawnEnemy(state, 'boss', 640, 500);
  const before = e.hp;
  const ok = fireWeapon(state, 'p1', { angle: 0, weapon: 'shotgun', fireSeq: 1 });
  assert.equal(ok, true, 'shotgun failed to fire');
  const watched = runAndWatchShake(state, 0.45);
  assert.ok(e.hp < before, `shotgun did not damage boss (${before} -> ${e.hp})`);
  assert.ok(watched.saw, 'shotgun hit did not create runtime shake');
  assert.ok(watched.maxPower > 0 && watched.maxPower < 3, `shotgun shake is not subtle: ${watched.maxPower}`);
});

test('seeker and rocket hits also keep small impact shake without replacing explosion shake', () => {
  for (const weaponId of ['seeker', 'rocket']) {
    const { state } = fresh(weaponId);
    spawnEnemy(state, 'boss', weaponId === 'seeker' ? 700 : 700, 500);
    const ok = fireWeapon(state, 'p1', { angle: 0, weapon: weaponId, fireSeq: 2 });
    assert.equal(ok, true, `${weaponId} failed to fire`);
    const watched = runAndWatchShake(state, weaponId === 'rocket' ? 1.8 : 1.2);
    assert.ok(watched.saw, `${weaponId} hit did not create shake`);
  }
});

let failed = 0;
for (const [status, name, e] of results) {
  if (status === 'ok') console.log('PASS', name);
  else { failed += 1; console.error('FAIL', name); console.error(e?.stack || e); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} feel checks passed`);
