import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer } from '../src/game/state.js';
import { fireWeapon } from '../src/game/combat.js';
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

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

test('shotgun pellet hits aggregate into one subtle shake impulse', () => {
  const { state } = fresh('shotgun');
  const boss = spawnEnemy(state, 'boss', 640, 500);
  const before = boss.hp;
  assert.equal(fireWeapon(state, 'p1', { angle: 0, weapon: 'shotgun', fireSeq: 1 }), true);
  const watched = runProjectiles(state, 0.35);
  assert.ok(boss.hp < before, 'shotgun did not hit the boss');
  assert.ok(watched.maxShakeCount <= 1, `pellet hits spawned too many simultaneous shake effects: ${watched.maxShakeCount}`);
  assert.ok(watched.maxShake > 0 && watched.maxShake < 0.85, `shotgun aggregate shake is crooked/too strong: ${watched.maxShake}`);
});

test('shake runtime effects carry stable ids for renderer de-duplication', () => {
  const { state } = fresh('seeker');
  spawnEnemy(state, 'boss', 700, 500);
  assert.equal(fireWeapon(state, 'p1', { angle: 0, weapon: 'seeker', fireSeq: 1 }), true);
  const watched = runProjectiles(state, 0.6);
  assert.ok(watched.shakeIds.size > 0, 'no shake effects were produced');
  assert.equal(watched.shakeIds.size, new Set(watched.shakeIds).size, 'shake ids were not stable/unique');
});

test('rocket explosion shake is clamped and not linearly stacked', () => {
  const { state } = fresh('rocket');
  spawnEnemy(state, 'boss', 700, 500);
  assert.equal(fireWeapon(state, 'p1', { angle: 0, weapon: 'rocket', fireSeq: 1 }), true);
  const watched = runProjectiles(state, 0.8);
  assert.ok(watched.maxShake > 0, 'rocket did not produce shake');
  assert.ok(watched.maxShake <= 3.45, `rocket shake exceeded clamp: ${watched.maxShake}`);
});

test('renderer consumes shake locally instead of summing snapshot power every frame', () => {
  const rendererSrc = readFileSync(new URL('../src/renderer.js', import.meta.url), 'utf8');
  assert.match(rendererSrc, /seen:\s*new Set\(\)/, 'renderer shake de-duplication set missing');
  assert.match(rendererSrc, /function ingestCameraShake/, 'renderer local shake ingest missing');
  assert.match(rendererSrc, /Math\.hypot\(shake\.power/, 'renderer does not combine shake as energy');
  assert.match(rendererSrc, /cameraWithShake\(cam, renderer, snapshot, renderDt\)/, 'render path is not using renderer-local shake state');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} shake checks passed`);
