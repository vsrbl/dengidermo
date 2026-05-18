import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGameState, addPlayer } from '../src/game/state.js';
import { updateProjectiles } from '../src/game/projectiles.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { fireWeapon } from '../src/game/combat.js';
import { giveWeapon, switchWeapon } from '../src/game/inventory.js';
import { EFFECT_DEFS, EFFECT_HOOKS, createEffectContext, dealDamage, runEffectHook } from '../src/game/effects.js';
import { UPGRADES } from '../src/data/upgrades.js';
import { VERSION } from '../src/core/constants.js';

const projectilesSrc = readFileSync(new URL('../src/game/projectiles.js', import.meta.url), 'utf8');
const effectsSrc = readFileSync(new URL('../src/game/effects.js', import.meta.url), 'utf8');
const effectCommandsSrc = readFileSync(new URL('../src/game/effectCommands.js', import.meta.url), 'utf8');
const serverSrc = readFileSync(new URL('../server/server.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const serverPkg = JSON.parse(readFileSync(new URL('../server/package.json', import.meta.url), 'utf8'));

const results = [];
function test(name, fn) {
  try { fn(); results.push(['ok', name]); }
  catch (e) { results.push(['fail', name, e]); }
}

function fresh(weaponId = 'shotgun', upgrades = []) {
  const state = createGameState(`ARCH-${weaponId}-${upgrades.join('-')}`);
  const p = addPlayer(state, 'p1', 0);
  p.x = 500; p.y = 500; p.angle = 0; p.hp = 20; p.maxHp = 100;
  state.spawnTimer = 9999;
  giveWeapon(p, weaponId, true);
  switchWeapon(p, weaponId);
  for (const id of upgrades) p.upgrades.taken[id] = (p.upgrades.taken[id] || 0) + 1;
  return { state, p };
}

function run(state, seconds = 1, dt = 1 / 240) {
  for (let i = 0; i < Math.ceil(seconds / dt); i += 1) updateProjectiles(state, dt);
}

test('effect dispatcher API is real and returns queued commands', () => {
  const entity = { effects: [{ type: 'spark' }] };
  const ctx = createEffectContext({ damage: 3 });
  const out = runEffectHook(entity, EFFECT_HOOKS.PROJECTILE_HIT, ctx, {
    spark(effect, c) { c.queue({ type: 'visual', effectType: effect.type }); }
  });
  assert.equal(out, ctx, 'dispatcher should mutate and return the same context');
  assert.equal(ctx.commands.length, 1, 'handler command was not queued');
  assert.equal(ctx.commands[0].type, 'visual');
});

test('projectile hooks are routed through the dispatcher/command layer', () => {
  for (const hook of ['PROJECTILE_UPDATE', 'PROJECTILE_HIT', 'PROJECTILE_EXPIRE', 'PROJECTILE_KILL', 'PROJECTILE_WALL']) {
    assert.match(projectilesSrc, new RegExp(`EFFECT_HOOKS\\.${hook}`), `${hook} is not referenced by projectile code`);
  }
  assert.match(projectilesSrc, /function runProjectileHook/, 'projectile hook wrapper missing');
  assert.match(effectCommandsSrc, /export function executeEffectCommands/, 'shared effect command executor missing');
  assert.doesNotMatch(projectilesSrc, /function executeEffectCommands/, 'effect command executor drifted back into projectiles.js');
  assert.match(projectilesSrc, /runProjectileHook\(state, source, EFFECT_HOOKS\.PROJECTILE_KILL/, 'projectile kill hook is not wired through command execution');
});

test('central damage pipeline is used for projectile and status damage', () => {
  assert.match(projectilesSrc, /dealDamage\(state, enemy, \{[\s\S]*projectileId/s, 'projectile damage does not use dealDamage()');
  assert.match(projectilesSrc, /tags: statusHit\.tags \|\| \[DAMAGE_TAGS\.STATUS\]/, 'status damage is not tagged through dealDamage()');
  const target = { hp: 10 };
  const hit = dealDamage(null, target, { amount: 3, sourceId: 'p1', tags: ['test'] });
  assert.equal(target.hp, 7);
  assert.equal(hit.done, 3);
  assert.equal(hit.killed, false);
});

test('lifesteal description matches current non-status behavior', () => {
  assert.match(UPGRADES.lifesteal.desc, /weapon damage/i, 'lifesteal description must stay short and exclude DoT/status healing');
  const { state, p } = fresh('shotgun', ['lifesteal']);
  p.hp = 20;
  const e = spawnEnemy(state, 'boss', 640, 500);
  e.status = { burn: { t: 1, dps: 80, sourceId: 'p1', stacks: 1 } };
  run(state, 0.5);
  assert.equal(p.hp, 20, 'status damage should not trigger lifesteal in v36');
});

test('direct projectile lifesteal still works after damage pipeline refactor', () => {
  const { state, p } = fresh('shotgun', ['lifesteal']);
  p.hp = 20;
  spawnEnemy(state, 'boss', 640, 500);
  assert.equal(fireWeapon(state, 'p1', { angle: 0, weapon: 'shotgun', fireSeq: 1 }), true);
  run(state, 0.45);
  assert.ok(p.hp > 20, `direct projectile lifesteal regressed (${p.hp})`);
});

test('reserved fields are marked intentionally, not forgotten', () => {
  const luck = UPGRADES.luck.effects.find((effect) => effect.type === 'luck');
  assert.equal(luck.rareReservedFor, 'future loot value / rarity weighting');
  assert.equal(EFFECT_DEFS.luck.reservedFields.rare, 'future loot value / rarity weighting');
  assert.ok(!('implemented' in EFFECT_DEFS.orbital) || EFFECT_DEFS.orbital.implemented !== false, 'orbital must be implemented in v36');
  assert.ok(!('implemented' in EFFECT_DEFS.drone) || EFFECT_DEFS.drone.implemented !== false, 'drone must be implemented in v36');
});

test('effect defs have hooks and future-only defs are explicit', () => {
  for (const [type, def] of Object.entries(EFFECT_DEFS)) {
    assert.ok(Array.isArray(def.hooks) && def.hooks.length > 0, `${type} has no hooks`);
    if (def.implemented === false) assert.ok(def.reservedFor, `${type} is disabled without reservedFor`);
  }
});

test('version strings are aligned across frontend/package/server', () => {
  assert.equal(VERSION, 'v38.1');
  assert.equal(pkg.version, '38.1.0');
  assert.equal(serverPkg.version, '38.1.0');
  assert.match(serverSrc, /v38\.1/, 'server banner is stale');
  assert.doesNotMatch(serverSrc, /v33\.1/, 'old server banner leaked through');
});

test('ricochet wall shake remains intentional and command-based', () => {
  assert.match(projectilesSrc, /source: "ricochet"/, 'ricochet shake source is not explicit');
  assert.match(projectilesSrc, /effectCommand\("shake", \{ power: 2\.2, life: 0\.09, source: "ricochet" \}\)/, 'ricochet shake is not command based');
});

let failed = 0;
for (const [status, name, err] of results) {
  if (status === 'ok') console.log(`PASS ${name}`);
  else { failed += 1; console.error(`FAIL ${name}`); console.error(err?.stack || err); }
}
if (failed) process.exit(1);
console.log(`All ${results.length} architecture checks passed`);
