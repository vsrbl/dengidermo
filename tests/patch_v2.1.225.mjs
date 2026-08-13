import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import { BOSS_SIGNATURE_UPGRADE_IDS } from '../shared/data.v2-1.js';
import {
  createRun, createPlayer, step, handlePick, handleDevCommand
} from '../shared/sim.v2-1.js';
import { LocalRoom } from '../src/local.v2-1.js';

assert.equal(VERSION, 'v2.1.225');
assert.equal(BUILD_ID, 'boss_reward_transition_recovery');
assert.equal(PROTOCOL, 15);

function bossOnlyQueue(id = 'boss-only', hero = '') {
  const run = createRun(225001);
  const p = createPlayer(id, id.toUpperCase(), 0, hero ? { hero } : null);
  const players = new Map([[p.id, p]]);
  run.phase = 'install';
  run.phaseT = 0;
  run.runDepth = 7;
  run.contractChoice = null;
  run.pendingRoomObjective = null;
  p.stats.roomWagerUnlocked = 0;
  p.roomWagerOffer = null;
  p.roomWagerActive = null;
  p.roomWagerDecisionDone = false;
  p.economy.pending = 0;
  p.bossSignaturePending = true;
  p.bossSignatureKind = 'boss';
  p.bossSignatureChoices = ['sig_redline_boost', 'sig_spawn_hold'];
  p.offer = null;
  return { run, p, players };
}

function tick(run, players, count = 1, start = 0) {
  for (let i = 0; i < count; i++) step(run, players, 1 / 60, start + i / 60);
}

// Exact reported case: no contract, no wager, no level-up; only boss reward.
// Every eligible signature must close and advance to the next room.
for (const hero of ['', 'living_casino', 'process_controller']) {
  const blocked = hero ? new Set(['sig_target_lock']) : new Set();
  for (const sig of BOSS_SIGNATURE_UPGRADE_IDS.filter(id => !blocked.has(id))) {
    const q = bossOnlyQueue(`${hero || 'base'}-${sig}`, hero);
    q.p.bossSignatureChoices = [sig, sig === 'sig_spawn_hold' ? 'sig_aegis_process' : 'sig_spawn_hold'];
    tick(q.run, q.players, 1, 1);
    assert.equal(q.p.offer?.kind, 'boss_signature', `${hero || 'base'} ${sig}: boss reward did not open`);
    const idx = q.p.offer.choices.indexOf(sig);
    assert.ok(idx >= 0, `${hero || 'base'} ${sig}: forced signature missing`);
    const oldDepth = q.run.runDepth;
    assert.equal(handlePick(q.run, q.players, q.p, idx, q.p.offer.id, sig), true, `${hero || 'base'} ${sig}: pick rejected`);
    tick(q.run, q.players, 1, 2);
    assert.equal(q.run.phase, 'play', `${hero || 'base'} ${sig}: boss-only transition stuck`);
    assert.equal(q.run.runDepth, oldDepth + 1, `${hero || 'base'} ${sig}: depth did not advance`);
    assert.equal(q.p.bossSignaturePending, false);
  }
}

// A pending marker with a lost or malformed offer self-heals during INSTALL.
for (const malformed of [
  null,
  { id: 99, kind: 'boss_signature', choices: [], expires: 50, total: 64 },
  { id: 100, kind: 'boss_signature', choices: ['missing_upgrade'], expires: 50, total: 64 },
  { id: 101, choices: ['hp'], expires: 50, total: 96 }
]) {
  const q = bossOnlyQueue(`self-heal-${malformed?.id || 0}`);
  q.p.offer = malformed;
  tick(q.run, q.players, 1, 3);
  assert.equal(q.p.offer?.kind, 'boss_signature');
  assert.equal(q.p.offer.choices.length, 2);
  assert.ok(q.p.offer.choices.every(id => BOSS_SIGNATURE_UPGRADE_IDS.includes(id)));
}

// Even if the player never clicks, the boss-only queue must eventually use its
// existing safe auto-pick and advance. There is no global INSTALL dead end.
{
  const q = bossOnlyQueue('boss-only-timeout');
  const oldDepth = q.run.runDepth;
  for (let i = 0; i < 3900 && q.run.phase === 'install'; i++) step(q.run, q.players, 1 / 60, 10 + i / 60);
  assert.equal(q.run.phase, 'play');
  assert.equal(q.run.runDepth, oldDepth + 1);
  assert.equal(q.p.bossSignaturePending, false);
}

// Manual recovery restores a lost mandatory reward; it never skips it.
{
  const q = bossOnlyQueue('manual-boss-repair');
  q.p.offer = { id: 888, kind: 'boss_signature', choices: [], expires: 50, total: 64 };
  assert.equal(handleDevCommand(q.run, q.players, q.p, { action: 'repair_transition' }), true);
  assert.equal(q.run.phase, 'install');
  assert.equal(q.p.bossSignaturePending, true);
  assert.equal(q.p.offer?.kind, 'boss_signature');
  assert.equal(q.p.offer.choices.length, 2);
}

// If no mandatory choice remains, recovery continues instead of leaving a
// blank INSTALL state. An optional invisible wager may be skipped.
{
  const q = bossOnlyQueue('manual-continue');
  q.p.bossSignaturePending = false;
  q.p.bossSignatureChoices = null;
  q.p.offer = null;
  q.p.roomWagerOffer = { id: 77 };
  const oldDepth = q.run.runDepth;
  assert.equal(handleDevCommand(q.run, q.players, q.p, { action: 'repair_transition' }), true);
  assert.equal(q.run.phase, 'play');
  assert.equal(q.run.runDepth, oldDepth + 1);
}

// Contract prize queue is restored, not erased.
{
  const q = bossOnlyQueue('contract-repair');
  q.p.bossSignaturePending = false;
  q.p.bossSignatureChoices = null;
  q.p.contractPrizeOffer = {
    id: 'contract_repair', index: 0, expires: 30, total: 30, kind: 'contract_weapon',
    offers: [{ kind: 'weapon', choices: [{ id: 'controller_range', kind: 'stat', label: 'RANGE' }] }]
  };
  q.p.weaponChestOffer = null;
  assert.equal(handleDevCommand(q.run, q.players, q.p, { action: 'repair_transition' }), true);
  assert.equal(q.run.phase, 'install');
  assert.equal(q.p.weaponChestOffer?.contractPrize, 1);
}

// Local delivery cache must be reset so the same repaired offer is resent even
// when its authoritative object had previously been considered delivered.
{
  const messages = [];
  const room = new LocalRoom('RECOVER', m => messages.push(m), '225-local');
  clearInterval(room.timer);
  room.addHost('host225', 'HOST');
  const p = room.players.get('host225');
  room.run.phase = 'install';
  p.bossSignaturePending = true;
  p.bossSignatureKind = 'boss';
  p.bossSignatureChoices = ['sig_redline_boost', 'sig_spawn_hold'];
  p.offer = { id: 700, kind: 'boss_signature', choices: ['sig_redline_boost', 'sig_spawn_hold'], expires: 64, total: 64 };
  room.offersSent.set(p.id, p.offer);
  room.offerSentAt.set(p.id, performance.now());
  room.handleMsg(p.id, { t: 'dev', cmd: { action: 'repair_transition' } });
  room.tick();
  assert.ok(messages.some(m => m.t === 'offer' && m.kind === 'boss_signature'), 'repaired boss reward was not resent to the client');
  room.close();
}

const main = fs.readFileSync(new URL('../src/main.v2-1.js', import.meta.url), 'utf8');
assert.match(main, /id="dev-repair-transition"/);
assert.match(main, /cmd\('repair_transition'\)/);

console.log('v2.1.225 checks passed: boss-only rewards, self-heal, recovery button, resend, clean continuation');
