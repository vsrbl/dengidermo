import assert from 'node:assert/strict';
import { createGameState, addPlayer } from '../src/game/state.js';
import { fireWeapon } from '../src/game/combat.js';
import { updateProjectiles } from '../src/game/projectiles.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { giveWeapon, switchWeapon } from '../src/game/inventory.js';
import { WEAPONS } from '../src/data/weapons.js';

function fresh(weaponId = 'shotgun', upgrades = [], seed = `MATRIX-${weaponId}-${upgrades.join('-')}`) {
  const state = createGameState(seed);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.angle = 0; p.hp = 40; p.maxHp = 100;
  state.spawnTimer = 9999;
  giveWeapon(p, weaponId, true);
  switchWeapon(p, weaponId);
  for (const id of upgrades) p.upgrades.taken[id] = (p.upgrades.taken[id] || 0) + 1;
  return { state, p };
}

function runProjectiles(state, seconds = 1, dt = 1 / 240) {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i += 1) updateProjectiles(state, dt);
}

function fireAndRun(state, weaponId, seconds = 1.1) {
  const ok = fireWeapon(state, 'p1', { angle: 0, weapon: weaponId, fireSeq: 1 });
  assert.equal(ok, true, `${weaponId} failed to fire`);
  runProjectiles(state, seconds);
}

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

for (const weaponId of Object.keys(WEAPONS)) {
  test(`${weaponId}: base projectile deals real host damage`, () => {
    const { state } = fresh(weaponId);
    const e = spawnEnemy(state, 'boss', weaponId === 'shotgun' ? 640 : 700, 500);
    const before = e.hp;
    fireAndRun(state, weaponId, 1.1);
    assert.ok(e.hp < before, `${weaponId} did not damage enemy (${before} -> ${e.hp})`);
  });

  test(`${weaponId}: burn/poison status visuals are backed by damage`, () => {
    const { state } = fresh(weaponId, ['burnMark', 'poisonLeak']);
    const e = spawnEnemy(state, 'boss', weaponId === 'shotgun' ? 640 : 700, 500);
    fireAndRun(state, weaponId, 0.5);
    assert.ok(e.status?.burn || e.status?.poison, `${weaponId} applied no status`);
    const afterImpact = e.hp;
    runProjectiles(state, 0.8);
    assert.ok(e.hp < afterImpact, `${weaponId} status was visual-only (${afterImpact} -> ${e.hp})`);
  });

  test(`${weaponId}: chain lightning damages secondary target`, () => {
    const { state } = fresh(weaponId, ['chainFork']);
    spawnEnemy(state, 'boss', weaponId === 'shotgun' ? 640 : 700, 500);
    const e2 = spawnEnemy(state, 'boss', weaponId === 'shotgun' ? 720 : 780, 500);
    const before = e2.hp;
    fireAndRun(state, weaponId, 1.1);
    const sawChain = state.effects.some((fx) => fx.type === 'chain') || state.events.some((ev) => ev.type === 'hit');
    assert.ok(sawChain, `${weaponId} produced no chain/hit runtime feedback`);
    assert.ok(e2.hp < before, `${weaponId} chain was visual-only (${before} -> ${e2.hp})`);
  });

  test(`${weaponId}: crit changes real damage, not only sparks`, () => {
    const base = fresh(weaponId);
    const crit = fresh(weaponId, ['critChip']);
    base.state.rng.next = () => 0.99;
    crit.state.rng.next = () => 0;
    const eBase = spawnEnemy(base.state, 'boss', weaponId === 'shotgun' ? 640 : 700, 500);
    const eCrit = spawnEnemy(crit.state, 'boss', weaponId === 'shotgun' ? 640 : 700, 500);
    fireAndRun(base.state, weaponId, 1.1);
    fireAndRun(crit.state, weaponId, 1.1);
    const baseDamage = eBase.maxHp - eBase.hp;
    const critDamage = eCrit.maxHp - eCrit.hp;
    assert.ok(critDamage > baseDamage, `${weaponId} crit did not increase damage (${baseDamage} vs ${critDamage})`);
  });

  test(`${weaponId}: lifesteal heals from real damage`, () => {
    const { state, p } = fresh(weaponId, ['lifesteal']);
    p.hp = 20; p.maxHp = 100;
    spawnEnemy(state, 'boss', weaponId === 'shotgun' ? 640 : 700, 500);
    fireAndRun(state, weaponId, 1.1);
    assert.ok(p.hp > 20, `${weaponId} lifesteal did not heal (${p.hp})`);
  });
}

test('seeker + pierce carries explosive damage through multiple targets', () => {
  const { state } = fresh('seeker', ['pierceCore']);
  const e1 = spawnEnemy(state, 'boss', 700, 500);
  const e2 = spawnEnemy(state, 'boss', 860, 500);
  const before1 = e1.hp;
  const before2 = e2.hp;
  fireAndRun(state, 'seeker', 1.5);
  assert.ok(e1.hp < before1, `first seeker target not damaged (${before1} -> ${e1.hp})`);
  assert.ok(e2.hp < before2, `second seeker target not damaged by pierce (${before2} -> ${e2.hp})`);
});

test('rocket + pierce carries explosive damage through multiple targets', () => {
  const { state } = fresh('rocket', ['pierceCore']);
  const e1 = spawnEnemy(state, 'boss', 700, 500);
  const e2 = spawnEnemy(state, 'boss', 900, 500);
  const before1 = e1.hp;
  const before2 = e2.hp;
  fireAndRun(state, 'rocket', 1.8);
  assert.ok(e1.hp < before1, `first rocket target not damaged (${before1} -> ${e1.hp})`);
  assert.ok(e2.hp < before2, `second rocket target not damaged by pierce (${before2} -> ${e2.hp})`);
});

let failed = 0;
for (const [status, name, e] of results) {
  if (status === 'ok') console.log('PASS', name);
  else { failed += 1; console.error('FAIL', name); console.error(e?.stack || e); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} combat matrix checks passed`);
