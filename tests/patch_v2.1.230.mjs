import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import {
  ROOM_WAGER_CONDITIONS, ROOM_WAGER_STAKES, buildSnapshot, createPlayer, createRun,
  dashMax, impactDriverProfile, makeWeaponChestChoices, startRoom, step
} from '../shared/sim.v2-1.js';
import { P } from '../src/state.v2-1.js';

assert.equal(VERSION, 'v2.1.230');
assert.equal(BUILD_ID, 'impact_driver_jump_combat');
assert.equal(PROTOCOL, 16);

function arena(hero = 'impact_driver', walls = []) {
  const run = createRun(230001);
  const p = createPlayer(`driver-${hero}`, 'DRIVER', 0, { hero });
  const players = new Map([[p.id, p]]);
  run.plan = { w: 1200, h: 800, walls, interactables: [], modifierIds: [], category: 'combat', quota: 99 };
  run.portal = { x: 1100, y: 700, open: false };
  run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999, pauseT: 999 };
  run.directorT = 999;
  run.roomStats = {};
  p.x = 200; p.y = 300; p.moveX = 1; p.moveY = 0; p.aimX = 500; p.aimY = 300;
  return { run, p, players };
}
function tick(q, count = 1, start = 0) {
  for (let i = 0; i < count; i++) step(q.run, q.players, 1 / 60, start + i / 60);
}

// The legacy three heroes no longer receive Space-jump; the new body has no dash or gun.
{
  const base = arena('base');
  base.p.wantJump = true;
  tick(base);
  assert.equal(base.p.jumpT, 0);
  assert.equal(dashMax(base.p), 1);

  const driver = arena('impact_driver');
  assert.deepEqual(driver.p.weapons, ['impact_driver']);
  assert.equal(dashMax(driver.p), 0);
  driver.p.wantDash = true;
  driver.p.wantJump = true;
  tick(driver);
  assert.ok(driver.p.jumpT > 0);
  assert.equal(driver.p.dashCharges, 0);
}

// Landing is authoritative weapon damage: global/weapon multipliers, statuses,
// projectile link, blast chance and lifesteal all share the established systems.
{
  const q = arena('impact_driver');
  q.p.hp = 40;
  q.p.stats.dmgMul = 1.5;
  q.p.stats.weaponDmgMul = 1.4;
  q.p.stats.lifesteal = 0.10;
  q.p.stats.bulletFire = 1;
  q.p.stats.bulletFreeze = 1;
  q.p.stats.bulletPoison = 1;
  q.p.stats.bulletChain = 1;
  q.p.stats.bulletChainStatuses = 1;
  q.p.stats.procBlast = 1;
  q.run.enemies.push(
    { id:'land-a', kind:'grunt', x:500, y:300, hp:700, maxHp:700, size:28, spawnDelay:0, state:'move', st:0, fireCd:999, elite:false, touchCds:new Map() },
    { id:'land-b', kind:'grunt', x:590, y:300, hp:700, maxHp:700, size:28, spawnDelay:0, state:'move', st:0, fireCd:999, elite:false, touchCds:new Map() }
  );
  q.p.wantJump = true;
  tick(q, 70);
  const a = q.run.enemies.find(e => e.id === 'land-a');
  const b = q.run.enemies.find(e => e.id === 'land-b');
  assert.ok(a.hp < 700, 'landing damaged its target');
  assert.ok((a.burnT || 0) > 0 && (a.poisonT || 0) > 0 && ((a.chillT || 0) > 0 || (a.frozenT || 0) > 0), 'landing inherited all statuses');
  assert.ok(b.hp < 700, 'projectile link propagated landing damage');
  assert.ok(q.p.hp > 40, 'landing damage triggered lifesteal');
  assert.ok(q.run.fx.some(f => f.t === 'blast'), 'landing blast chance used the normal explosion path');
  assert.ok((q.run.roomStats.impactLandings || 0) >= 1);
  const row = buildSnapshot(q.run, q.players).players[0];
  assert.equal(row[P.BUILD].hero, 'impact_driver');
  assert.equal(row[P.DASHMAX], 0);
  assert.ok(row.length >= 65);
}

// WPN offers are a dedicated landing branch and never leak classic guns.
{
  const q = arena('impact_driver');
  const ids = new Set();
  for (let i = 0; i < 40; i++) for (const c of makeWeaponChestChoices(q.p, Math.random, 5, 2)) {
    ids.add(c.id);
    assert.equal(c.kind === 'weapon', false);
    assert.equal(c.impactOnly, 1);
  }
  assert.ok(ids.has('impact_damage'));
  assert.ok(ids.has('impact_radius'));
  assert.ok(ids.has('impact_stun'));
  assert.ok(ids.has('impact_afterfield'));
}

// Driver-only wagers exist; dash wagers cannot be rolled for this hero.
{
  const dash = ROOM_WAGER_CONDITIONS.find(x => x.id === 'dash15');
  assert.ok(dash && !dash.heroes.includes('impact_driver'));
  for (const id of ['impact_land6','impact_multi4','impact_bounce2','impact_clean3']) {
    const c = ROOM_WAGER_CONDITIONS.find(x => x.id === id);
    assert.deepEqual(c?.heroes, ['impact_driver']);
  }
  for (const id of ['impact_power_loss','impact_radius_loss']) assert.deepEqual(ROOM_WAGER_STAKES.find(x => x.id === id)?.heroes, ['impact_driver']);
}

// An all-driver team never sees the trivial no-dash contract and can roll the new landing contracts.
{
  const seen = new Set();
  for (let seed = 1; seed <= 220; seed++) {
    const p = createPlayer(`contract-driver-${seed}`, 'DRIVER', 0, { hero:'impact_driver' });
    const players = new Map([[p.id, p]]);
    const run = createRun(seed);
    run.runDepth = 4 + (seed % 19);
    startRoom(run, players);
    for (const c of run.nextRoomPreview?.objectiveChoices || []) {
      seen.add(c.id);
      assert.notEqual(c.id, 'no_escape');
    }
  }
  assert.ok(seen.has('impact_cycles') || seen.has('impact_cluster') || seen.has('impact_rebound'));
}

const simText = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
assert.match(simText, /impact_power_plus/);
assert.match(simText, /impact_radius_plus/);
assert.match(simText, /impact_rebound_plus/);

console.log('v2.1.230 checks passed: separate driver, combat landings, WPN branch, contracts and wagers');
