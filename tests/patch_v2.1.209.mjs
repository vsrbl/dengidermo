import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES, UPGRADES } from '../shared/data.v2-1.js';
import {
  buildSnapshot, createPlayer, createRun, damageEnemy, handleContractPick,
  handlePick, handleRoomWagerAccept, startRoom, step
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';
import { Effects } from '../src/effects.v2-1.js';
import { P } from '../src/state.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:209|21[0-4])$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.209' ? 'contract_choice_root_lock_mirror_static_sync' : VERSION === 'v2.1.210' ? 'trinode_parts_radial_break_sync' : VERSION === 'v2.1.211' ? 'trinode_chase_loop_hp_splitter_audio' : VERSION === 'v2.1.212' ? 'boss_q_silence_fullscreen_signal' : 'solo_offline_hard_fallback');
assert.ok(PROTOCOL >= 14);

const enemy = (id, kind = 'grunt', x = 700, y = 500, hp = 100) => ({
  id, kind, x, y, hp, maxHp: hp, size: ENEMIES[kind]?.size || 24,
  spd: 0, dmg: 0, armor: 0, shellHp: 0, shellMax: 0, fireCd: 999,
  bulletSpd: 0, spawnDelay: 0, state: 'move', st: 0
});

// STATIC CORE is present in boss combat and only the cleansing favor can
// permanently silence the run-long source.
{
  const p = createPlayer('core209', 'CORE', 0);
  p.stats.debtEngine = 2;
  const players = new Map([[p.id, p]]);
  const run = createRun(20901);
  run.runDepth = 3;
  run.devNextRoomOverride = { category: 'boss', modifierIds: [] };
  startRoom(run, players);
  assert.equal(run.staticRainStacks, 2);
  assert.deepEqual(run.staticRainSources, [{ id: 'debt_engine', level: 2 }]);
  run.contractFavorsActive = [{ id: 'clear_debt', label: 'CLEAR STATIC STORM', uses: 1, used: 0, persistent: 1 }];
  startRoom(run, players);
  assert.equal(run.staticCoreStormDisabled, true);
  assert.equal(run.staticRainStacks, 0);
}

// One non-first boss room becomes the large four-node ROOT LOCKDOWN. Boss
// damage is rejected until every node is destroyed.
{
  let fixture = null;
  for (const depth of [7, 11, 15, 19, 23]) {
    const p = createPlayer(`root${depth}`, 'ROOT', 0);
    const players = new Map([[p.id, p]]);
    const run = createRun(20902);
    run.runDepth = depth;
    run.runMemory.bossesDefeated = Math.max(0, Math.floor((depth - 3) / 4));
    run.devNextRoomOverride = { category: 'boss', modifierIds: [] };
    startRoom(run, players);
    if (run.rootLock) { fixture = { run, players, p }; break; }
  }
  assert.ok(fixture, 'seed did not select a ROOT LOCKDOWN boss');
  const { run, players, p } = fixture;
  assert.equal(run.plan.roomArchetype, 'root_lockdown');
  assert.equal(run.plan.w * run.plan.h, 3100 * 2150);
  assert.equal(run.rootLock.nodeIds.length, 4);
  const boss = run.enemies.find(e => e.id === run.rootLock.bossId);
  // Test the lock itself after the boss has fully materialized and without
  // mixing the independent armor-shell mechanic into this assertion.
  boss.spawnDelay = 0;
  boss.shellHp = 0;
  boss.shellMax = 0;
  const hp0 = boss.hp;
  damageEnemy(run, players, boss, 100, p.id, 0, 0, 0, 'test');
  assert.equal(boss.hp, hp0, 'ROOT LOCKDOWN boss took damage early');
  for (const id of [...run.rootLock.nodeIds]) {
    const node = run.enemies.find(e => e.id === id);
    node.spawnDelay = 0;
    damageEnemy(run, players, node, 1e9, p.id, 0, 0, 0, 'test');
  }
  assert.equal(run.rootLock.active, 0);
  damageEnemy(run, players, boss, 100, p.id, 0, 0, 0, 'test');
  assert.ok(boss.hp < hp0, 'boss stayed invulnerable after all nodes');
}

// Contract preview is a real 3-way selection with preserved prize previews.
{
  let fixture = null;
  for (let seed = 1; seed <= 80 && !fixture; seed++) {
    const p = createPlayer(`contract${seed}`, 'CONTRACT', 0);
    const players = new Map([[p.id, p]]);
    const run = createRun(seed);
    run.runDepth = 4;
    startRoom(run, players);
    if (run.contractChoice?.choices?.length === 3) fixture = { run, players, p };
  }
  assert.ok(fixture, 'no deterministic 3-contract preview found');
  const { run, players, p } = fixture;
  assert.equal(new Set(run.contractChoice.choices.map(x => x.id)).size, 3);
  assert.ok(run.contractChoice.choices.every(x => x.prizePreview?.length === 1));
  const chosen = run.contractChoice.choices[2];
  assert.equal(handleContractPick(run, players, p, 2), true);
  assert.equal(run.pendingRoomObjective.objective.id, chosen.id);
  assert.deepEqual(run.pendingRoomObjective.objective.prizePreview, chosen.prizePreview);
}

// MIRROR gives KILL SWITCH one extra use per copied reward, with no charge cap.
{
  const p = createPlayer('mirror209', 'MIRROR', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(20903);
  UPGRADES.find(x => x.id === 'sig_mirror_payout').apply(p.stats);
  run.phase = 'install';
  p.bossSignaturePending = true;
  p.offer = { id: 1, kind: 'boss_signature', choices: ['sig_kill_switch'], expires: 30, total: 30 };
  assert.equal(handlePick(run, players, p, 0, 1, 'sig_kill_switch'), true);
  assert.equal(p.stats.killSwitchCharge, 2);
  run.devNextRoomOverride = { category: 'combat', modifierIds: [] };
  startRoom(run, players);
  run.enemies = [enemy('ks1')];
  p.wantRActive = true;
  step(run, players, 1 / 60, 1);
  assert.equal(p.stats.killSwitchCharge, 1);
  assert.equal(p.stats.rActiveId, 'kill_switch');
  run.enemies = [enemy('ks2')];
  p.wantRActive = true;
  step(run, players, 1 / 60, 2);
  assert.equal(p.stats.killSwitchCharge, 0);
}

// Wager waits until boss/INSTALL choices are gone, owns a persistent decision
// window with no countdown, and remains active through the room transition.
{
  const p = createPlayer('wager209', 'WAGER', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(20904);
  p.stats.roomWagerUnlocked = 1;
  p.economy.pending = 1;
  p.offer = { id: 10, choices: ['dmg', 'fire', 'maxhp'], expires: 30, total: 30 };
  run.phase = 'install';
  step(run, players, 0.1, 1);
  assert.ok(p.roomWagerOffer == null);
  assert.equal(handlePick(run, players, p, 0, 10, 'dmg'), true);
  step(run, players, 0.1, 2);
  assert.equal(p.roomWagerOffer.total, undefined);
  assert.equal(p.roomWagerOffer.expires, undefined);
  const heldOfferId = p.roomWagerOffer.id;
  step(run, players, 90, 3);
  assert.equal(p.roomWagerOffer.id, heldOfferId, 'wager offer timed out without a choice');
  const wagerId = p.roomWagerOffer.id;
  assert.equal(handleRoomWagerAccept(run, players, p, wagerId), true);
  step(run, players, 0.1, 4);
  assert.ok(p.roomWagerActive);
  assert.ok(buildSnapshot(run, players).players[0][P.ACTIVEWAGER]);
}

// STATIC STRIKE impact removes the warning immediately, and stale packets
// cannot recreate a circular area after damage.
{
  const fx = new Effects();
  const info = { myId: 'p' };
  fx.handleFx({ t: 'rain_warn', active: 1, ally: 1, strikeId: 'strike209', x: 100, y: 120, r: 59, dur: 9 }, info);
  assert.ok(fx.list.some(x => x.kind === 'warnring'));
  fx.handleFx({ t: 'rain_hit', active: 1, ally: 1, strikeId: 'strike209', x: 100, y: 120, r: 59 }, info);
  assert.equal(fx.list.some(x => x.kind === 'warnring'), false);
  fx.handleFx({ t: 'rain_warn', active: 1, ally: 1, strikeId: 'strike209', x: 100, y: 120, r: 59, dur: 9 }, info);
  assert.equal(fx.list.some(x => x.kind === 'warnring'), false);
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const effects = fs.readFileSync(new URL('../src/effects.v2-1.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
assert.doesNotMatch(sim, /SYSTEM OVERCLOCK|CLOCK BOOST/);
assert.match(sim, /WPN CLEARANCE/);
assert.match(sim, /ABL CLEARANCE/);
assert.match(sim, /RAR CLEARANCE/);
assert.match(sim, /SALVAGE PROTOCOL/);
assert.match(hud, /Math\.max\(0, Number\(pending \|\| 0\) \| 0\) <= 0/);
assert.match(hud, /else if \(activeWager\)/);
assert.match(effects, /finishedStaticStrikes/);
assert.match(css, /\.reel\.static[\s\S]*rgba\(180,92,255/);

console.log('v2.1.209 checks passed: Static Core, wagers, contracts, ROOT LOCKDOWN, MIRROR/KILL SWITCH and zero-residue STATIC STRIKE');
