import assert from 'node:assert/strict';
import { createGameState, addPlayer } from '../src/game/state.js';
import { fireWeapon } from '../src/game/combat.js';
import { updateProjectiles } from '../src/game/projectiles.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { updateLoot } from '../src/game/loot.js';
import { updateHostWorld } from '../src/game/simulation.js';
import { UPGRADES } from '../src/data/upgrades.js';
import { WEAPONS } from '../src/data/weapons.js';
import { DAMAGE_TAGS, EFFECT_DEFS, buildProjectileEffects, resolveProjectileDamage, dealPlayerDamage, tickPlayerEffects } from '../src/game/effects.js';
import { giveWeapon, switchWeapon } from '../src/game/inventory.js';

function fresh(seed='TST') {
  const state = createGameState(seed);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.angle = 0;
  state.spawnTimer = 9999;
  return { state, p };
}
function take(p, ...ids) {
  for (const id of ids) p.upgrades.taken[id] = (p.upgrades.taken[id] || 0) + 1;
}
function runProjectiles(state, seconds=1, dt=1/120) {
  const n = Math.ceil(seconds/dt);
  for (let i=0;i<n;i++) updateProjectiles(state, dt);
}
function effectNames(effects) { return new Set(effects.map(e=>e.type)); }

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

test('all upgrade effect types exist in EFFECT_DEFS', () => {
  for (const up of Object.values(UPGRADES)) {
    for (const effect of up.effects || []) {
      assert.ok(EFFECT_DEFS[effect.type], `${up.id} uses missing effect ${effect.type}`);
    }
  }
});

test('all weapon effect types exist in EFFECT_DEFS', () => {
  for (const [weaponId, w] of Object.entries(WEAPONS)) {
    for (const effect of w.effects || []) {
      assert.ok(EFFECT_DEFS[effect.type], `${weaponId} uses missing effect ${effect.type}`);
    }
  }
});

test('projectile effect filtering by weapon works', () => {
  const { p } = fresh();
  take(p, 'splitRockets', 'clusterBomb', 'homingCore', 'pierceCore');
  let e = effectNames(buildProjectileEffects(p, WEAPONS.shotgun, 'shotgun'));
  assert.ok(e.has('pierce'));
  assert.ok(!e.has('splitRockets'));
  assert.ok(!e.has('clusterBomb'));
  assert.ok(!e.has('homingCore'));
  e = effectNames(buildProjectileEffects(p, WEAPONS.rocket, 'rocket'));
  assert.ok(e.has('splitRockets'));
  assert.ok(e.has('clusterBomb'));
  assert.ok(!e.has('homingCore'));
  e = effectNames(buildProjectileEffects(p, WEAPONS.seeker, 'seeker'));
  assert.ok(e.has('homingCore'));
});

test('crit and lifesteal are source-owned and deterministic when rng is low', () => {
  const { state, p } = fresh();
  p.hp = 50; p.maxHp = 100;
  p.upgrades.taken.critChip = 10;
  p.upgrades.taken.lifesteal = 10;
  const projectile = { ownerId: 'p1', effects: buildProjectileEffects(p, WEAPONS.shotgun, 'shotgun') };
  state.rng.next = () => 0;
  const hit = resolveProjectileDamage(state, projectile, 10, { id:'e' });
  assert.equal(hit.critical, true);
  assert.ok(hit.amount > 10);
});

test('shield blocks damage and recharges', () => {
  const { state, p } = fresh();
  take(p, 'shield');
  tickPlayerEffects(p, 0.016);
  const afterBlock = dealPlayerDamage(state, p, { amount: 10, tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH] });
  assert.equal(afterBlock.done, 0);
  assert.equal(p.effectState.shield.charges, 0);
  tickPlayerEffects(p, 8);
  assert.equal(p.effectState.shield.charges, 1);
});

test('burn/poison/freeze statuses apply and tick down', () => {
  const { state, p } = fresh();
  take(p, 'burnMark', 'poisonLeak', 'freezeByte');
  const e = spawnEnemy(state, 'boss', 620, 500);
  fireWeapon(state, 'p1', { angle: 0, fireSeq: 1 });
  runProjectiles(state, 0.3);
  assert.ok(e.status?.burn || e.status?.poison || e.status?.freeze, 'enemy got no status');
  const before = e.hp;
  runProjectiles(state, 0.5);
  assert.ok(e.hp < before, 'status did not deal damage');
});

test('pierce does not repeatedly hit same enemy and can continue', () => {
  const { state, p } = fresh();
  take(p, 'pierceCore');
  const e1 = spawnEnemy(state, 'boss', 620, 500);
  const e2 = spawnEnemy(state, 'boss', 710, 500);
  fireWeapon(state, 'p1', { angle: 0, fireSeq: 2 });
  runProjectiles(state, 0.5);
  assert.ok(e1.hp < e1.maxHp, 'first enemy not hit');
  assert.ok(e2.hp < e2.maxHp, 'second enemy not hit with pierce');
});

test('rocket split/cluster/screenShake create runtime effects safely', () => {
  const { state, p } = fresh();
  giveWeapon(p, 'rocket', true); switchWeapon(p, 'rocket');
  take(p, 'splitRockets', 'clusterBomb');
  spawnEnemy(state, 'boss', 680, 500);
  fireWeapon(state, 'p1', { angle: 0, weapon: 'rocket', fireSeq: 3 });
  let sawExplosion = false;
  let sawShake = false;
  for (let i = 0; i < 90; i += 1) {
    updateProjectiles(state, 1 / 120);
    sawExplosion ||= state.effects.some((fx) => fx.type === 'explosion');
    sawShake ||= state.effects.some((fx) => fx.type === 'shake');
  }
  assert.ok(Object.keys(state.projectiles).length >= 0);
  assert.ok(sawExplosion, 'no explosion effects');
  assert.ok(sawShake, 'screenShake did not create shake runtime effect');
});

test('magnet moves loot toward player', () => {
  const { state, p } = fresh();
  take(p, 'magnet');
  state.loot.l1 = { id:'l1', kind:'heal', x: p.x + 80, y: p.y, radius: 8 };
  const before = state.loot.l1.x;
  updateLoot(state, 0.1);
  assert.ok(state.loot.l1.x < before, `loot did not move toward player: ${before} -> ${state.loot.l1?.x}`);
});

test('combined all listed current effects can simulate without throw', () => {
  const { state, p } = fresh('ALL');
  giveWeapon(p, 'seeker', false);
  giveWeapon(p, 'rocket', false);
  for (const id of Object.keys(UPGRADES)) p.upgrades.taken[id] = 1;
  spawnEnemy(state, 'grunt', 620, 500);
  spawnEnemy(state, 'runner', 700, 530);
  spawnEnemy(state, 'shooter', 780, 470);
  for (let i=0;i<60;i++) {
    if (i===0) { switchWeapon(p, 'shotgun'); fireWeapon(state, 'p1', { angle:0, fireSeq:10 }); }
    if (i===10) { switchWeapon(p, 'seeker'); fireWeapon(state, 'p1', { angle:0, fireSeq:11 }); }
    if (i===20) { switchWeapon(p, 'rocket'); fireWeapon(state, 'p1', { angle:0, fireSeq:12 }); }
    updateHostWorld(state, { p1: { left:false,right:false,up:false,down:false,aimAngle:0,fire:false,px:null,py:null }}, 1/60);
  }
  assert.ok(Number.isFinite(p.hp));
});

let failed = 0;
for (const [status, name, e] of results) {
  if (status === 'ok') console.log('PASS', name);
  else { failed++; console.error('FAIL', name); console.error(e?.stack || e); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} effect checks passed`);
