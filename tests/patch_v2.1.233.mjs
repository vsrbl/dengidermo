import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES } from '../shared/data.v2-1.js';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import { buildSnapshot, createPlayer, createRun, damagePlayer, handleAbilityPick, handlePick, handleRarePick, handleWeaponPick, startRoom, step } from '../shared/sim.v2-1.js';
import { P } from '../src/state.v2-1.js';

assert.equal(VERSION, 'v2.1.233');
assert.equal(BUILD_ID, 'impact_driver_afterfield_contour');
assert.equal(PROTOCOL, 17);

function driverArena(seed = 232001) {
  const p = createPlayer('driver', 'DRIVER', 0, { hero: 'impact_driver' });
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  run.plan = {
    w: 1200, h: 800,
    walls: [{ x: 255, y: 220, w: 30, h: 170 }],
    interactables: [], modifierIds: [], category: 'combat', quota: 99, specialRoomId: 'chill_room'
  };
  run.enemies = []; run.bullets = []; run.pickups = []; run.activeFields = []; run.decoys = [];
  run.portal = { x: 1100, y: 700, open: false };
  run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999999, pauseT: 999999, used: {} };
  run.directorT = 999; run.roomStats = {};
  p.x = 200; p.y = 300; p.moveX = 1; p.moveY = 0; p.aimX = 500; p.aimY = 300;
  return { p, players, run };
}
function tick(q, count) {
  for (let i = 0; i < count; i++) step(q.run, q.players, 1 / 60, i / 60);
}

// Wall reflection is innate, but an unupgraded reflection carries no counter,
// floating x2/x3 marker, or landing damage multiplier.
{
  const q = driverArena();
  q.p.wantJump = true;
  tick(q, 20);
  assert.ok(q.p.jumpVx < 0, 'base Driver did not reflect from the wall');
  assert.equal(q.p.jumpBounces, 0, 'base reflection created a combo counter');
  const hit = q.run.fx.find(f => f.t === 'player_jump_wall');
  assert.ok(hit, 'base reflection has no impact cue');
  assert.equal(hit.mul, 1, 'base reflection emitted a damage multiplier');
  assert.equal(hit.hardLand, 0, 'base reflection was tagged as a hard landing');
}

// The existing WPN circuit still unlocks the optional bounce combo.
{
  const q = driverArena(232002);
  q.p.stats.jumpRebound = 1;
  q.p.wantJump = true;
  tick(q, 20);
  assert.ok(q.p.jumpVx < 0);
  assert.ok(q.p.jumpBounces >= 1, 'rebound circuit did not unlock its combo');
  assert.ok(q.run.fx.some(f => f.t === 'player_jump_wall' && f.mul >= 2));
}

// The Driver owns one standard AEGIS stack; earned stacks remain additive.
{
  const p = createPlayer('shield-driver', 'DRIVER', 0, { hero: 'impact_driver' });
  const players = new Map([[p.id, p]]);
  const run = createRun(232003);
  startRoom(run, players);
  assert.equal(p.aegisShieldMax, 45);
  assert.equal(p.aegisShield, 45);
  p.stats.aegisStacks = 1;
  startRoom(run, players);
  assert.equal(p.aegisShieldMax, 90);
  assert.equal(p.aegisShield, 90);
}

assert.equal(ENEMIES.boss.armor, 0);
const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
const landingVisual = effects.slice(effects.indexOf("e.kind === 'jumpLand'"), effects.indexOf("e.kind === 'impact'"));
assert.match(landingVisual, /ctx\.arc\(e\.x, e\.y, r/);
assert.doesNotMatch(landingVisual, /strokeRect|fillRect/);
const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
assert.match(render, /bossHpBar\(ex, ey, size, hp01, COL\.red, true\)/);
assert.match(render, /ctx\.font = 'bold 18px monospace'/);
assert.match(effects, /Compact white buckshot-like fan/);
assert.match(effects, /f\.kind === 'impact_field'\) this\.add\(\{ kind: 'impactAfterfield'/);
const afterfieldVisual = effects.slice(effects.indexOf("e.kind === 'impactAfterfield'"), effects.indexOf("e.kind === 'impact'"));
assert.match(afterfieldVisual, /ctx\.arc\(e\.x, e\.y, r/);
assert.match(afterfieldVisual, /Exact, unbroken outer boundary/);
assert.doesNotMatch(afterfieldVisual, /strokeRect|fillRect/);
const audio = fs.readFileSync(new URL('../src/audio.v2-1.js', import.meta.url), 'utf8');
assert.match(audio, /playJumpReboundCombo\(mult = 2\)/);
assert.match(audio, /if \(\(f\.mul \|\| 1\) > 1\) this\.playJumpReboundCombo\(f\.mul\)/);

// DAMAGE10 is a live, recoverable ten-second HP-safe streak. It must not use
// total room age, become a duplicate of NO_DAMAGE, or be revoked after success.
{
  const q = driverArena(232010);
  q.run.phase = 'play';
  q.p.invuln = 0;
  q.p.aegisShield = 0;
  q.p.wagerStats = { damage: 0, damage10Hold: 0, damage10Complete: 0, lowHpHold: 0 };
  q.p.roomWagerActive = { condition: 'damage10', prize: 'aegis', prizeTextRu: 'AEGIS', prizeTextEn: 'AEGIS' };
  tick(q, 5 * 60);
  assert.ok(q.p.wagerStats.damage10Hold >= 4.9 && q.p.wagerStats.damage10Hold < 5.1, 'ten-second wager used the wrong clock');
  damagePlayer(q.run, q.p, 7, q.p.x, q.p.y);
  assert.equal(q.p.wagerStats.damage10Hold, 0, 'real HP loss did not restart the safe streak');
  tick(q, 9 * 60);
  assert.ok(!q.p.roomWagerActive.completed, 'wager completed before a fresh ten-second streak');
  tick(q, 61);
  assert.equal(q.p.roomWagerActive.completed, 1, 'wager did not lock immediately after ten safe seconds');
  q.p.invuln = 0;
  damagePlayer(q.run, q.p, 7, q.p.x, q.p.y);
  assert.equal(q.p.roomWagerActive.completed, 1, 'late HP loss revoked an already completed wager');
}

// Shield-only damage is not HP loss and must not reset the ten-second streak.
{
  const q = driverArena(232011);
  q.run.phase = 'play';
  q.p.invuln = 0;
  q.p.aegisShield = 30;
  q.p.aegisShieldMax = 30;
  q.p.wagerStats = { damage: 0, damage10Hold: 4.25, damage10Complete: 0, lowHpHold: 0 };
  q.p.roomWagerActive = { condition: 'damage10', prize: 'aegis' };
  damagePlayer(q.run, q.p, 10, q.p.x, q.p.y);
  assert.equal(q.p.wagerStats.damage10Hold, 4.25, 'shield absorption reset the HP-safe streak');
  assert.equal(q.p.wagerStats.damage, 0, 'shield absorption was recorded as HP damage');
}

// All ready MIRROR levels reflect the same next compatible choice. Three
// collected mirrors make KILL SWITCH x4 (original + three copies), spend 3/3,
// and the authoritative snapshot reports 0/3 rather than the old 2/3 desync.
{
  const p = createPlayer('mirror-stack', 'MIRROR', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(232012);
  run.plan = { w: 1200, h: 800, walls: [], interactables: [], modifierIds: [], category: 'boss', quota: 1 };
  run.portal = { x: 1100, y: 700, open: false };
  p.stats.mirrorCapacity = 3;
  run.phase = 'install';
  p.bossSignaturePending = true;
  p.offer = { id: 12, kind: 'boss_signature', choices: ['sig_kill_switch'], expires: 30, total: 30 };
  assert.equal(handlePick(run, players, p, 0, 12, 'sig_kill_switch'), true);
  assert.equal(p.stats.killSwitchCharge, 4, 'three mirrors produced fewer than three KILL SWITCH copies');
  assert.equal(p.mirrorUsedLoop, 3, 'three ready mirrors did not all discharge together');
  const mirrorFx = run.fx.find(f => f.t === 'mirror_copy' && f.ok);
  assert.equal(mirrorFx?.copies, 3);
  assert.equal(mirrorFx?.multiplier, 4);
  const snapPlayer = buildSnapshot(run, players).players.find(row => row[P.ID] === p.id);
  assert.equal(snapPlayer[P.MIRROR], 0);
  assert.equal(snapPlayer[P.MIRRORMAX], 3);
}

// Every stackable boss prize uses all ready mirrors together. Verify the full
// boss reward table, not only KILL SWITCH.
{
  const cases = [
    ['sig_target_lock', p => [p.stats.rActiveId, p.stats.rActiveStacks], ['target_lock', 4]],
    ['sig_redline_boost', p => [p.stats.rActiveId, p.stats.rActiveStacks], ['redline_boost', 4]],
    ['sig_ghost_decoy', p => [p.stats.rActiveId, p.stats.rActiveStacks], ['ghost_decoy', 4]],
    ['sig_rewind_mark', p => [p.stats.rActiveId, p.stats.rActiveStacks], ['rewind_mark', 4]],
    ['sig_kill_switch', p => [p.stats.rActiveId, p.stats.rActiveStacks, p.stats.killSwitchCharge], ['kill_switch', 4, 4]],
    ['sig_spawn_hold', p => p.stats.spawnHoldStacks, 4],
    ['sig_aegis_process', p => p.stats.aegisStacks, 4],
    ['sig_null_revival', p => p.stats.nullRevives, 4],
    ['sig_boss_key', p => [p.stats.bossKeys, p.bossKeyCharges], [4, 4]]
  ];
  for (const [id, read, expected] of cases) {
    const p = createPlayer(`mirror-${id}`, 'MIRROR', 0);
    const players = new Map([[p.id, p]]);
    const run = createRun(232100 + cases.findIndex(x => x[0] === id));
    p.stats.mirrorCapacity = 3;
    run.phase = 'install';
    p.bossSignaturePending = true;
    p.offer = { id: 31, kind: 'boss_signature', choices: [id], expires: 30, total: 30 };
    assert.equal(handlePick(run, players, p, 0, 31, id), true, `${id} was not accepted`);
    assert.deepEqual(read(p), expected, `${id} did not receive original + three mirror copies`);
    assert.equal(p.mirrorUsedLoop, 3, `${id} did not spend all three mirrors`);
    assert.equal(run.fx.find(f => f.t === 'mirror_copy' && f.ok)?.copies, 3, `${id} mirror receipt is wrong`);
  }
}

// MIRROR PAYOUT is itself a boss prize, but it cannot copy itself. Existing
// charges stay ready while the capacity increases by one.
{
  const p = createPlayer('mirror-self', 'MIRROR', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(232120);
  p.stats.mirrorCapacity = 3;
  run.phase = 'install';
  p.bossSignaturePending = true;
  p.offer = { id: 32, kind: 'boss_signature', choices: ['sig_mirror_payout'], expires: 30, total: 30 };
  assert.equal(handlePick(run, players, p, 0, 32, 'sig_mirror_payout'), true);
  assert.equal(p.stats.mirrorCapacity, 4);
  assert.equal(p.mirrorUsedLoop || 0, 0);
  assert.ok(!run.fx.some(f => f.t === 'mirror_copy'));
}

// MIRROR is boss-reward-only. A WPN, ABL, RAR or normal INSTALL choice must
// apply exactly once and leave every mirror ready.
{
  const p = createPlayer('mirror-nonboss', 'MIRROR', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(232013);
  p.stats.mirrorCapacity = 3;
  p.weaponChestOffer = { choices: [{ id: 'wpn_damage', kind: 'stat', stat: 'dmg', label: 'WPN DAMAGE' }] };
  assert.equal(handleWeaponPick(run, players, p, 0), true);
  assert.ok(Math.abs(p.stats.weaponDmgMul - 1.18) < 1e-9, 'WPN was mirrored');

  p.abilityChestOffer = { choices: [{ id: 'abl_active_recovery', kind: 'stat', stat: 'active_recovery', label: 'Q RECOVERY' }] };
  assert.equal(handleAbilityPick(run, players, p, 0), true);
  assert.ok(Math.abs(p.stats.activeRegenMul - 1.2) < 1e-9, 'ABL was mirrored');

  p.rareChestOffer = { choices: [{ id: 'maxhp', upgrade: 'maxhp', kind: 'rare_upgrade', label: 'HP +20' }] };
  assert.equal(handleRarePick(run, players, p, 0), true);
  assert.equal(p.stats.maxHpAdd, 20, 'RAR was mirrored');

  run.phase = 'install';
  p.offer = { id: 33, choices: ['maxhp'], expires: 45, total: 45 };
  p.economy.pending = 1;
  assert.equal(handlePick(run, players, p, 0, 33, 'maxhp'), true);
  assert.equal(p.stats.maxHpAdd, 40, 'normal INSTALL was mirrored');
  assert.equal(p.mirrorUsedLoop || 0, 0, 'a non-boss reward burned MIRROR charges');
  assert.ok(!run.fx.some(f => f.t === 'mirror_copy'), 'a non-boss reward emitted MIRROR copy feedback');
}

const simSource = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
assert.equal((simSource.match(/useMirrorIfPossible\(/g) || []).length, 2, 'MIRROR has an application path outside its helper and boss reward handler');

console.log('v2.1.233 checks passed: Driver contour afterfield, recoverable wager, boss-only MIRROR matrix');
