import assert from 'node:assert/strict';
import { createGameState, addPlayer } from '../src/game/state.js';
import { fireWeapon } from '../src/game/combat.js';
import { makeProjectile, updateProjectiles } from '../src/game/projectiles.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { UPGRADES, UPGRADE_RARITIES, UPGRADE_TAGS, upgradeHasTag, upgradesByTag } from '../src/data/upgrades.js';
import { applyProjectileStatuses, enemyStatusSnapshot } from '../src/game/effects.js';
import { WORLD } from '../src/core/constants.js';

function fresh(seed = 'V34') {
  const state = createGameState(seed);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.angle = 0;
  state.spawnTimer = 9999;
  return { state, p };
}

function take(p, ...ids) {
  for (const id of ids) p.upgrades.taken[id] = (p.upgrades.taken[id] || 0) + 1;
}

function runProjectiles(state, seconds = 1, dt = 1 / 240) {
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i += 1) updateProjectiles(state, dt);
}

function runAndCollectEffects(state, seconds = 1, dt = 1 / 240) {
  const seen = [];
  const steps = Math.ceil(seconds / dt);
  for (let i = 0; i < steps; i += 1) {
    updateProjectiles(state, dt);
    for (const fx of state.effects) seen.push({ ...fx });
  }
  return seen;
}

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

test('upgrade metadata is ready for rarity/tag/synergy systems', () => {
  assert.ok(UPGRADE_RARITIES.includes('common'));
  assert.ok(UPGRADE_TAGS.includes('status'));
  assert.ok(UPGRADE_TAGS.includes('rocket'));
  for (const [id, upgrade] of Object.entries(UPGRADES)) {
    assert.ok(UPGRADE_RARITIES.includes(upgrade.rarity), `${id} has bad rarity ${upgrade.rarity}`);
    assert.ok(Array.isArray(upgrade.tags) && upgrade.tags.length >= 1, `${id} has no tags`);
    assert.ok(Number.isFinite(upgrade.weight) && upgrade.weight > 0, `${id} has bad weight`);
    assert.ok(Number.isFinite(upgrade.maxStacks) && upgrade.maxStacks >= 1, `${id} has bad maxStacks`);
  }
  assert.equal(upgradeHasTag('burnMark', 'status'), true);
  assert.ok(upgradesByTag('rocket').includes('splitRockets'));
});

test('re-applied statuses stack lightly and snapshot exposes slow/stacks', () => {
  const { state } = fresh();
  const enemy = spawnEnemy(state, 'boss', 620, 500);
  const projectile = { ownerId: 'p1', effects: [{ type: 'burn', dps: 5, duration: 1.2 }, { type: 'poison', dps: 3, duration: 1.3, slow: 0.2 }, { type: 'freeze', duration: 0.8, slow: 0.35 }] };
  applyProjectileStatuses(projectile, enemy);
  const firstDps = enemy.status.burn.dps;
  applyProjectileStatuses(projectile, enemy);
  assert.equal(enemy.status.burn.stacks, 2);
  assert.ok(enemy.status.burn.dps > firstDps, `burn did not stack (${firstDps} -> ${enemy.status.burn.dps})`);
  const snap = enemyStatusSnapshot(enemy);
  assert.ok(snap.slow >= 0.35, `snapshot missing slow (${snap.slow})`);
  assert.equal(snap.burnStacks, 2);
});

test('status hits create real statusBurst feedback plus ticking damage', () => {
  const { state, p } = fresh('V34-status');
  take(p, 'burnMark', 'poisonLeak', 'freezeByte');
  const enemy = spawnEnemy(state, 'boss', 640, 500);
  const before = enemy.hp;
  assert.equal(fireWeapon(state, 'p1', { angle: 0, fireSeq: 10 }), true);
  const seen = runAndCollectEffects(state, 0.45);
  assert.ok(seen.some((fx) => fx.type === 'statusBurst'), 'no statusBurst visual feedback');
  const impactHp = enemy.hp;
  runProjectiles(state, 0.6);
  assert.ok(enemy.hp < impactHp, `status did not tick damage (${impactHp} -> ${enemy.hp}, start ${before})`);
});

test('forced crit creates critFlash and damageText backed by real damage', () => {
  const { state, p } = fresh('V34-crit');
  take(p, 'critChip');
  state.rng.next = () => 0;
  const enemy = spawnEnemy(state, 'boss', 640, 500);
  const before = enemy.hp;
  assert.equal(fireWeapon(state, 'p1', { angle: 0, fireSeq: 11 }), true);
  const seen = runAndCollectEffects(state, 0.45);
  assert.ok(enemy.hp < before, 'crit shot did no real damage');
  assert.ok(seen.some((fx) => fx.type === 'critFlash'), 'critFlash missing');
  assert.ok(seen.some((fx) => fx.type === 'damageText' && String(fx.text).startsWith('!')), 'crit damageText missing');
});

test('ricochet is real wall gameplay, not just a declared effect', () => {
  const { state } = fresh('V34-ricochet');
  const enemy = spawnEnemy(state, 'boss', WORLD.w - 170, 500);
  const before = enemy.hp;
  const projectile = makeProjectile({
    id: 'manual-ricochet',
    ownerId: 'p1',
    weaponId: 'shotgun',
    x: WORLD.w - 4,
    y: 500,
    angle: 0,
    effects: [{ type: 'ricochet', count: 1 }, { type: 'hitShake', power: 0.01, life: 0.04 }]
  });
  projectile.range = 2000;
  projectile.life = 3;
  state.projectiles[projectile.id] = projectile;
  const seen = runAndCollectEffects(state, 0.6);
  assert.ok(seen.some((fx) => fx.type === 'ricochet'), 'ricochet feedback missing');
  assert.ok(enemy.hp < before, `ricochet projectile did not damage enemy (${before} -> ${enemy.hp})`);
});

test('chain lightning feedback carries amount and damages target', () => {
  const { state, p } = fresh('V34-chain');
  take(p, 'chainFork');
  spawnEnemy(state, 'boss', 640, 500);
  const e2 = spawnEnemy(state, 'boss', 725, 500);
  const before = e2.hp;
  assert.equal(fireWeapon(state, 'p1', { angle: 0, fireSeq: 12 }), true);
  const seen = runAndCollectEffects(state, 0.5);
  const chain = seen.find((fx) => fx.type === 'chain');
  assert.ok(chain?.amount > 0, 'chain effect has no amount payload');
  assert.ok(e2.hp < before, `chain did not damage second enemy (${before} -> ${e2.hp})`);
});

let failed = 0;
for (const [status, name, e] of results) {
  if (status === 'ok') console.log('PASS', name);
  else { failed += 1; console.error('FAIL', name); console.error(e?.stack || e); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v34 pack checks passed`);
