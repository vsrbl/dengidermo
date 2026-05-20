import assert from 'node:assert/strict';
import { createGameState, addPlayer, makeSnapshot } from '../../src/game/state.js';
import { emptyInput, updateHostWorld } from '../../src/game/simulation.js';
import { applyUpgrade } from '../../src/game/upgrades.js';
import { UPGRADES } from '../../src/data/upgrades.js';
import { DAMAGE_TAGS, EFFECT_DEFS, dealPlayerDamage } from '../../src/game/effects.js';
import { canPredictDash, dashConfig, performDash, predictLocalDash } from '../../src/game/abilities.js';

function fresh() {
  const state = createGameState('DASH35');
  const p = addPlayer(state, 'p1', 0);
  p.x = 500;
  p.y = 500;
  p.angle = 0;
  state.spawnTimer = 9999;
  return { state, p };
}

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

run('teleport dash upgrade is data-driven and registered', () => {
  const up = UPGRADES.teleportDash;
  assert.ok(up, 'missing teleportDash upgrade');
  assert.equal(up.maxStacks, 1, 'dash should be a single active unlock for now');
  assert.ok(up.tags.includes('active'));
  assert.ok(up.effects.some((effect) => effect.type === 'teleportDash' && effect.scope === 'player'));
  assert.ok(up.effects.some((effect) => effect.type === 'afterimage' && effect.scope === 'player'));
  assert.ok(EFFECT_DEFS.teleportDash.merge.invuln, 'teleportDash invuln merge is missing');
});

run('players cannot dash without the upgrade', () => {
  const { state, p } = fresh();
  const before = { x: p.x, y: p.y };
  const result = performDash(state, 'p1', { right: true, aimAngle: 0 }, { seq: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'no-upgrade');
  assert.deepEqual({ x: p.x, y: p.y }, before);
  assert.equal(makeSnapshot(state).players[0].ability, null);
});

run('dash moves the player, starts cooldown and creates afterimage effects', () => {
  const { state, p } = fresh();
  assert.equal(applyUpgrade(p, 'teleportDash'), true);
  const cfg = dashConfig(p);
  assert.ok(cfg && cfg.distance >= 180 && cfg.cooldown >= 3);
  const result = performDash(state, 'p1', { right: true, aimAngle: 0 }, { seq: 1 });
  assert.equal(result.ok, true);
  assert.ok(p.x > 690 && p.x < 730, `unexpected dash x ${p.x}`);
  assert.ok(p.effectState.dash.cooldownLeft > 0);
  assert.ok(p.effectState.dash.invulnLeft > 0);
  assert.ok(state.effects.some((fx) => fx.type === 'afterimage'), 'no afterimage visuals');
  assert.ok(state.effects.some((fx) => fx.type === 'dashBurst'), 'no dashBurst visual');
  const snapDash = makeSnapshot(state).players[0].ability.dash;
  assert.equal(snapDash.available, true);
  assert.equal(snapDash.ready, false);
});

run('dash cooldown and duplicate sequence are host-authoritative', () => {
  const { state, p } = fresh();
  applyUpgrade(p, 'teleportDash');
  assert.equal(performDash(state, 'p1', { right: true }, { seq: 5 }).ok, true);
  const xAfter = p.x;
  assert.equal(performDash(state, 'p1', { right: true }, { seq: 5 }).ok, false, 'duplicate seq should be rejected');
  assert.equal(performDash(state, 'p1', { right: true }, { seq: 6 }).ok, false, 'cooldown should reject second dash');
  assert.equal(p.x, xAfter);
  for (let i = 0; i < 260; i += 1) updateHostWorld(state, { p1: emptyInput() }, 1 / 60);
  assert.equal(performDash(state, 'p1', { left: true }, { seq: 6 }).ok, true, 'dash should work after cooldown');
});

run('dash invulnerability blocks touch damage briefly', () => {
  const { state, p } = fresh();
  applyUpgrade(p, 'teleportDash');
  performDash(state, 'p1', { right: true }, { seq: 1 });
  assert.equal(dealPlayerDamage(state, p, { amount: 25, tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH] }).done, 0);
  for (let i = 0; i < 30; i += 1) updateHostWorld(state, { p1: emptyInput() }, 1 / 60);
  assert.equal(dealPlayerDamage(state, p, { amount: 25, tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH] }).done, 25);
});

run('guest prediction only works from ability snapshot', () => {
  const pose = { id: 'p2', x: 100, y: 100, angle: 0, radius: 13, hp: 100, ability: null };
  assert.equal(canPredictDash(pose, 1), false);
  pose.ability = { dash: { available: true, ready: true, cooldown: 3.6, cooldownLeft: 0, distance: 210 } };
  assert.equal(canPredictDash(pose, 1), true);
  assert.equal(predictLocalDash(pose, { down: true }, 1), true);
  assert.ok(pose.y > 290 && pose.y < 330, `unexpected predicted y ${pose.y}`);
  assert.equal(canPredictDash(pose, 1.1), false);
});

console.log('All 6 v35 ability checks passed');
