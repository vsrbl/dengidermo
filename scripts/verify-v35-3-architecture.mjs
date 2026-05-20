import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer } from '../src/game/state.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { updateEnemies } from '../src/game/enemies.js';
import { giveWeapon } from '../src/game/inventory.js';
import {
  DAMAGE_TAGS,
  EFFECT_DEFS,
  EFFECT_HOOKS,
  attractLootToPlayer,
  dealPlayerDamage,
  resolveLootRoll,
  resolvePlayerDamage,
  tickPlayerEffects
} from '../src/game/effects.js';

const effectsSrc = ['effects.js', 'effects/defs.js', 'effects/core.js', 'effects/damage.js', 'effects/status.js', 'effects/loot.js']
  .map((name) => `${name}\n${readFileSync(new URL(`../src/game/${name}`, import.meta.url), 'utf8')}`)
  .join('\n---\n');
const enemiesSrc = readFileSync(new URL('../src/game/enemies.js', import.meta.url), 'utf8');
const enemyBehaviorsSrc = readFileSync(new URL('../src/game/enemyBehaviors.js', import.meta.url), 'utf8');
const enemyRuntimeSrc = `${enemiesSrc}
${enemyBehaviorsSrc}`;
const lootSrc = readFileSync(new URL('../src/game/loot.js', import.meta.url), 'utf8');
const simulationSrc = readFileSync(new URL('../src/game/simulation.js', import.meta.url), 'utf8');
const runtimeGameSrc = ['enemies.js', 'enemyBehaviors.js', 'loot.js', 'simulation.js', 'projectiles.js', 'abilities.js', 'portals.js', 'upgrades.js']
  .map((name) => `${name}\n${readFileSync(new URL(`../src/game/${name}`, import.meta.url), 'utf8')}`)
  .join('\n---\n');

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function baseState(seed = 'V35-3') {
  const state = createGameState(seed);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.hp = 100; p.maxHp = 100;
  state.spawnTimer = 9999;
  giveWeapon(p, 'shotgun', true);
  return { state, p };
}

test('player damage is routed through the unified player damage pipeline', () => {
  assert.match(effectsSrc, /export function dealPlayerDamage/, 'dealPlayerDamage() missing');
  assert.match(effectsSrc, /EFFECT_HOOKS\.PLAYER_DAMAGE/, 'PLAYER_DAMAGE hook is not used by effects.js');
  assert.ok(EFFECT_DEFS.shield.hooks.includes(EFFECT_HOOKS.PLAYER_DAMAGE), 'shield must listen to PLAYER_DAMAGE');
  assert.ok(EFFECT_DEFS.teleportDash.hooks.includes(EFFECT_HOOKS.PLAYER_DAMAGE), 'dash invuln must listen to PLAYER_DAMAGE');
  assert.match(enemyRuntimeSrc, /dealPlayerDamage\(state, target, \{/, 'enemy touch damage does not call dealPlayerDamage()');
  assert.doesNotMatch(enemyRuntimeSrc, /target\.hp\s*[-+]?=/, 'enemy runtime directly mutates player hp');
  assert.match(enemyRuntimeSrc, /ARCHITECTURE GUARD: player damage must flow through dealPlayerDamage/, 'enemy damage guard comment missing');
});

test('shield and dash mitigation resolve through PLAYER_DAMAGE hooks', () => {
  const { state, p } = baseState('PLAYER-DAMAGE-HOOK');
  p.upgrades.taken.shield = 1;
  tickPlayerEffects(p, 0.016, state);
  const shieldHit = dealPlayerDamage(state, p, { amount: 30, sourceId: 'en-test', tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH] });
  assert.equal(shieldHit.blocked, true, 'shield did not mark damage as blocked');
  assert.equal(p.hp, 100, 'shielded player damage changed hp');

  const plainHit = dealPlayerDamage(state, p, { amount: 12, sourceId: 'en-test', tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH] });
  assert.equal(plainHit.done, 0, 'shield grace should still absorb immediate follow-up hit');

  const { state: dashState, p: dashPlayer } = baseState('DASH-DAMAGE-HOOK');
  dashPlayer.upgrades.taken.teleportDash = 1;
  tickPlayerEffects(dashPlayer, 0.016, dashState);
  dashPlayer.effectState.dash = { invulnLeft: 0.1, cooldownLeft: 0, seqSeen: 0 };
  const dashResolved = resolvePlayerDamage(dashState, dashPlayer, { amount: 50, tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH] });
  assert.equal(dashResolved.blocked, true, 'dash invuln did not block through player damage hook');
  assert.equal(dashResolved.blockedBy, 'dash-invuln');
});

test('enemy update uses player damage pipeline in live contact scenario', () => {
  const { state, p } = baseState('CONTACT-DAMAGE-PIPELINE');
  p.upgrades.taken.shield = 1;
  tickPlayerEffects(p, 0.016, state);
  const enemy = spawnEnemy(state, 'grunt', p.x, p.y);
  enemy.vx = 0; enemy.vy = 0;
  updateEnemies(state, 0.05);
  assert.equal(p.hp, 100, 'contact damage bypassed shield/player damage pipeline');
  assert.ok(p.effectState.shield.charges < 1, 'shield charge was not consumed by contact damage');
});

test('loot roll and attraction use loot hooks instead of manual effect reads', () => {
  assert.match(lootSrc, /resolveLootRoll\(state, source, \{ chance \}\)/, 'dropLoot does not use resolveLootRoll()');
  assert.match(lootSrc, /attractLootToPlayer\(player, item, dt, state\)/, 'updateLoot does not pass state through loot attraction hook');
  assert.doesNotMatch(lootSrc, /playerEffectValue\(|getEffect\(.*luck|luckBonus/, 'loot economy is manually reading luck values');
  assert.ok(EFFECT_DEFS.luck.hooks.includes(EFFECT_HOOKS.LOOT_ROLL), 'luck must listen to LOOT_ROLL');
  assert.ok(EFFECT_DEFS.magnet.hooks.includes(EFFECT_HOOKS.LOOT_ATTRACT), 'magnet must listen to LOOT_ATTRACT');

  const { state, p } = baseState('LOOT-HOOKS');
  p.upgrades.taken.luck = 2;
  const roll = resolveLootRoll(state, p, { chance: 0.1 });
  assert.ok(roll.chance > 0.1, 'luck did not modify loot roll through hook');
  assert.ok(roll.rareBonus > 0, 'reserved rare bonus should be tracked for future economy work');
});

test('magnet movement is resolved through LOOT_ATTRACT hook', () => {
  const { state, p } = baseState('MAGNET-HOOK');
  p.upgrades.taken.magnet = 1;
  tickPlayerEffects(p, 0.016, state);
  const item = { id: 'loot-test', x: p.x + 70, y: p.y, radius: 9 };
  const before = item.x;
  const ctx = attractLootToPlayer(p, item, 0.1, state);
  assert.ok(ctx?.moved, 'magnet hook did not report movement');
  assert.ok(item.x < before, 'loot did not move toward player');
  assert.match(effectsSrc, /runLootHook\(state, player, item, EFFECT_HOOKS\.LOOT_ATTRACT/, 'attractLootToPlayer does not route through LOOT_ATTRACT');
});

test('runtime code documents and avoids old damage/loot bypasses', () => {
  assert.match(effectsSrc, /ARCHITECTURE GUARD: every damage source that targets a player must go/, 'player damage architecture guard missing');
  assert.match(lootSrc, /ARCHITECTURE GUARD: loot economy modifiers must flow through LOOT_ROLL/, 'loot architecture guard missing');
  assert.doesNotMatch(runtimeGameSrc, /import \{[^}]*applyShieldDamage/, 'runtime still imports legacy applyShieldDamage');
  assert.doesNotMatch(runtimeGameSrc.replace(/dealDamage\(state, enemy/g, ''), /\.hp\s*-=/, 'runtime has direct hp -= outside central damage pipeline');
  assert.match(simulationSrc, /tickPlayerEffects\(p, safeDt, state\)/, 'player tick hook does not receive world state');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} v36 architecture checks passed`);
