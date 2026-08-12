import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES, spinCasino } from '../shared/data.v2-1.js';
import {
  applyCasinoWeaponPairDamage, applyRandomCasinoWeaponUpgrade, bossOrderForRun,
  chooseBossKind, createPlayer, createRun, damageEnemy, handleDevCommand, startRoom, step
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:20[89]|21[0-5])$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.208' ? 'boss_bag_trinode_q_silence_casino_wpn' : VERSION === 'v2.1.209' ? 'contract_choice_root_lock_mirror_static_sync' : VERSION === 'v2.1.210' ? 'trinode_parts_radial_break_sync' : VERSION === 'v2.1.211' ? 'trinode_chase_loop_hp_splitter_audio' : VERSION === 'v2.1.212' ? 'boss_q_silence_fullscreen_signal' : VERSION === 'v2.1.215' ? 'install_preview_anchor_phase_signal' : 'solo_offline_hard_fallback');
assert.equal(PROTOCOL, 15);
assert.equal(ENEMIES.boss_trinode?.boss, true);

function fixture(seed = 20801) {
  const p = createPlayer(`p-${seed}`, 'QA', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  startRoom(run, players);
  run.fx = [];
  return { p, players, run };
}

// A six-boss run uses one shuffled bag: every full boss appears once, including
// the legacy BOS encounter and the new sequential TRI crawler.
{
  const orders = new Set();
  for (let seed = 20800; seed < 20812; seed++) {
    const run = createRun(seed);
    const order = bossOrderForRun(run);
    assert.equal(order.length, 6);
    assert.equal(new Set(order).size, 6, `boss repeat in seed ${seed}`);
    assert.ok(order.includes('boss_trinode'));
    assert.ok(order.includes('boss'));
    const chosen = [];
    for (let i = 0; i < 6; i++) {
      run.runMemory.bossesDefeated = i;
      chosen.push(chooseBossKind(run));
    }
    assert.deepEqual(chosen, order);
    orders.add(order.join(','));
  }
  assert.ok(orders.size > 1, 'boss bag is not seed-randomized');
}

// Boss entry silences Q only. First boss starts at 30 seconds; later boss count
// adds ten seconds each. Attempting Q during silence creates no active field.
{
  const p = createPlayer('silence-208', 'SILENCE', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(20830);
  run.runDepth = 3;
  p.active = { core: 'black_box', level: 1, mutations: [], mutationLevels: {} };
  startRoom(run, players);
  assert.equal(run.plan.category, 'boss');
  assert.equal(p.bossQSilenceT, 30);
  assert.ok(run.fx.some(f => f.t === 'boss_q_silence' && f.seconds === 30));
  const fields = run.activeFields.length;
  p.wantActive = true;
  step(run, players, 1 / 60, 1);
  assert.equal(run.activeFields.length, fields);
  assert.ok(run.fx.some(f => f.t === 'active_denied' && f.reason === 'boss_silence'));
  assert.equal(p.wantActive, false);

  run.runMemory.bossesDefeated = 2;
  run.runDepth = 11;
  startRoom(run, players);
  assert.equal(p.bossQSilenceT, 50);
}

// TRI has three physical squares. Damage is clamped to the current square and
// cannot spill into either locked square; each break unlocks exactly one next part.
{
  const { p, players, run } = fixture(20850);
  run.enemies = [];
  assert.equal(handleDevCommand(run, players, p, { action: 'spawn_boss', kind: 'boss_trinode' }), true);
  const boss = run.enemies.find(e => e.kind === 'boss_trinode');
  assert.ok(boss);
  assert.equal(boss.trinodeParts.length, 3);
  assert.equal(boss.hp, boss.trinodeParts.reduce((sum, x) => sum + x.hp, 0));
  boss.shellHp = 0; boss.shellMax = 0;
  const firstHp = boss.trinodeParts[0].hp;
  const totalBefore = boss.hp;
  damageEnemy(run, players, boss, firstHp + 9999, p.id, 0, 0, 0, 'qa');
  assert.equal(boss.trinodeParts.length, 2);
  assert.equal(boss.hp, totalBefore - firstHp, 'damage spilled into locked square');
  const lockedHp = boss.hp;
  damageEnemy(run, players, boss, 9999, p.id, 0, 0, 0, 'qa');
  assert.equal(boss.hp, lockedHp, 'unlock transition was not invulnerable');
  boss.trinodeUnlockT = 0;
  const secondHp = boss.trinodeParts[0].hp;
  damageEnemy(run, players, boss, secondHp, p.id, 0, 0, 0, 'qa');
  assert.equal(boss.trinodeParts.length, 1);
  assert.ok(run.fx.some(f => f.t === 'trinode_break'));
}

// Ten fast radial volleys from the active square are followed by a real
// five-second slow-fire phase, without the old red boss-burst circles.
{
  const { p, players, run } = fixture(20860);
  run.enemies = [];
  handleDevCommand(run, players, p, { action: 'spawn_boss', kind: 'boss_trinode' });
  const boss = run.enemies.find(e => e.kind === 'boss_trinode');
  boss.backgroundAddCd = 999;
  p.x = 310; p.y = 290;
  for (let i = 0; i < 150; i++) step(run, players, 1 / 60, i + 1);
  assert.equal(boss.trinodePhase, 'slow');
  assert.equal(boss.trinodeShots, 10);
  assert.equal(run.fx.filter(f => f.t === 'trinode_shot').length >= 10, true);
  assert.equal(run.fx.some(f => f.t === 'boss_burst' && f.trinode), false);
  assert.equal(run.bullets.some(b => b.kind === 'trinode_edge'), false);
  const slowBefore = boss.trinodePhaseT;
  for (let i = 0; i < 60; i++) step(run, players, 1 / 60, 200 + i);
  assert.ok(boss.trinodePhaseT < slowBefore && boss.trinodePhaseT > 0);
}

// Casino WPN semantics: pair = stake-scaled pure damage; triple = an instant
// upgraded WPN-chest improvement. Both write the complete receipt.
{
  const pair = spinCasino((() => { const a = [0.02, 0.02, 0.9]; let i = 0; return () => a[i++] ?? 0.9; })(), 'mid', 0, []);
  assert.equal(pair.payload.pairMatch, 1);
  assert.equal(pair.payload.weaponPairDamage, 1);
  assert.equal(pair.payload.weaponUpgradeCount || 0, 0);
  const triple = spinCasino(() => 0.03, 'high', 0, []);
  assert.equal(triple.payload.tripleMatch, 1);
  assert.equal(triple.payload.weaponUpgradeCount, 1);
  assert.equal(triple.payload.weaponPairDamage || 0, 0);

  const { p, players, run } = fixture(20870);
  const beforePair = p.stats.weaponDmgMul;
  const pairReceipt = {};
  assert.equal(applyCasinoWeaponPairDamage(p, 'mid', pairReceipt), 14);
  assert.equal(Math.round((p.stats.weaponDmgMul / beforePair) * 100), 114);
  assert.match(pairReceipt.weaponLabels[0], /\+14%/);
  const tripleReceipt = {};
  assert.equal(applyRandomCasinoWeaponUpgrade(run, players, p, tripleReceipt, 2), true);
  assert.match(tripleReceipt.weaponLabels[0], /^WPN TRIPLE:/);
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /kind: 'void_laser'[\s\S]{0,260}tickEvery: 0\.72/);
assert.match(hud, /weaponLabels\.map\(weaponDetail\)/);
assert.match(hud, /case 'boss_q_silence'/);
assert.match(render, /kind === 'boss_trinode'/);

console.log('v2.1.208 checks passed: non-repeat boss bag, TRI sequence/phases, boss Q silence, Void Cut tick nerf, casino WPN receipts');
