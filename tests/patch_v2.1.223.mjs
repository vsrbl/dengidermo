import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import { BOSS_SIGNATURE_UPGRADE_IDS } from '../shared/data.v2-1.js';
import {
  createRun, createPlayer, step, handlePick, handleContractPick,
  handleRoomWagerSeen, handleRoomWagerDecline
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.223');
assert.equal(BUILD_ID, 'boss_reward_wager_softlock_guard');
assert.equal(PROTOCOL, 15);

function makeThirdCycleQueue(id = 'lvc-third-cycle') {
  const run = createRun(223031);
  const player = createPlayer(id, 'LVC', 0, { hero: 'living_casino' });
  player.stats.roomWagerUnlocked = 1;
  player.bossSignaturePending = true;
  player.bossSignatureKind = 'boss';
  player.bossSignatureChoices = ['sig_redline_boost', 'sig_spawn_hold'];
  const players = new Map([[player.id, player]]);
  run.phase = 'install';
  run.runDepth = 11; // end of the third four-room cycle
  run.contractChoice = {
    depth: run.runDepth + 1,
    choices: [{ id: 'cycle_three_contract', label: 'CYCLE III', goal: 'Continue.' }],
    votes: {}, selected: ''
  };
  return { run, player, players };
}

function reachWager(queue) {
  const { run, player, players } = queue;
  assert.equal(handleContractPick(run, players, player, 0), true);
  step(run, players, 1 / 60, 1);
  assert.equal(player.offer?.kind, 'boss_signature');
  const offerId = player.offer.id;
  const choiceId = player.offer.choices[0];
  assert.equal(handlePick(run, players, player, 0, offerId, choiceId), true);
  step(run, players, 1 / 60, 1.02);
  assert.ok(player.roomWagerOffer, 'wager must be created after the boss reward');
  return player.roomWagerOffer.id;
}

// If the UI actually shows the card, its acknowledgement preserves the intended
// unlimited decision time. No hidden countdown was reintroduced.
{
  const queue = makeThirdCycleQueue('visible-wager');
  const wagerId = reachWager(queue);
  assert.equal(handleRoomWagerSeen(queue.run, queue.players, queue.player, wagerId), true);
  for (let i = 0; i < 600; i++) step(queue.run, queue.players, 1 / 60, 2 + i / 60);
  assert.equal(queue.run.phase, 'install');
  assert.equal(queue.player.roomWagerOffer?.id, wagerId);
  assert.equal(handleRoomWagerDecline(queue.run, queue.players, queue.player, wagerId), true);
  const oldDepth = queue.run.runDepth;
  step(queue.run, queue.players, 1 / 60, 20);
  assert.equal(queue.run.phase, 'play');
  assert.equal(queue.run.runDepth, oldDepth + 1);
}

// If no client ever confirms a visible card, the optional wager is silently
// skipped and can no longer hold a valuable run in a blank INSTALL phase.
{
  const queue = makeThirdCycleQueue('invisible-wager');
  reachWager(queue);
  const oldDepth = queue.run.runDepth;
  for (let i = 0; i < 260; i++) step(queue.run, queue.players, 1 / 60, 30 + i / 60);
  assert.equal(queue.player.roomWagerOffer, null);
  assert.equal(queue.run.phase, 'play');
  assert.equal(queue.run.runDepth, oldDepth + 1);
}

// A stale acknowledgement must not bless a newer invisible choice.
{
  const queue = makeThirdCycleQueue('stale-wager');
  const wagerId = reachWager(queue);
  assert.equal(handleRoomWagerSeen(queue.run, queue.players, queue.player, wagerId + 1), false);
  for (let i = 0; i < 260; i++) step(queue.run, queue.players, 1 / 60, 40 + i / 60);
  assert.equal(queue.run.phase, 'play');
}

// Every signature that can reach Living Casino must close cleanly and hand off
// to the wager stage. This catches reward-specific exceptions, not just one card.
for (const signatureId of BOSS_SIGNATURE_UPGRADE_IDS.filter(id => id !== 'sig_target_lock')) {
  const queue = makeThirdCycleQueue(`sig-${signatureId}`);
  const companion = signatureId === 'sig_spawn_hold' ? 'sig_aegis_process' : 'sig_spawn_hold';
  queue.player.bossSignatureChoices = [signatureId, companion];
  step(queue.run, queue.players, 1 / 60, 50);
  const idx = queue.player.offer.choices.indexOf(signatureId);
  assert.ok(idx >= 0, `${signatureId} must be present in its forced offer`);
  assert.equal(handlePick(queue.run, queue.players, queue.player, idx, queue.player.offer.id, signatureId), true);
  assert.doesNotThrow(() => step(queue.run, queue.players, 1 / 60, 50.02));
  assert.ok(queue.player.roomWagerOffer, `${signatureId} must hand off to wager without an exception`);
}

const hud = await readFile(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const net = await readFile(new URL('../src/net.v2-1.js', import.meta.url), 'utf8');
assert.match(hud, /acknowledgeVisibleRoomWager/);
assert.match(hud, /getBoundingClientRect\(\)/);
assert.match(net, /sendRoomWagerSeen/);

console.log('v2.1.223 checks passed: third-cycle boss reward queue, visible wager hold, invisible wager recovery, all LVC signatures');
