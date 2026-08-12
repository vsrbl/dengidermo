import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  activateQueuedRoomWagerPrize, createPlayer, createRun, handleWeaponPick,
  queueContractChoicePrizes, settleRoomWager, step, updateRoomWagerCompletion
} from '../shared/sim.v2-1.js';
import { BUILD_ID, VERSION } from '../shared/protocol.v2-1.js';

assert.equal(VERSION, 'v2.1.216');
assert.equal(BUILD_ID, 'contract_prize_wager_silence_ui');

// A contract WPN/ABL prize owns a separate 30-second stage before INSTALL.
{
  const p = createPlayer('contract-choice', 'CHOICE', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(21601);
  run.phase = 'install'; run.phaseT = 0; run.runDepth = 2;
  run.plan = { roomId: 'TEST', category: 'normal', loopIndex: 0, roomInLoop: 2, w: 1600, h: 900, modifierIds: [], walls: [], interactables: [] };
  run.portal = { x: 800, y: 450, open: true };
  p.economy.pending = 1;
  p.stats.roomWagerUnlocked = 1;
  run.contractFavorsActive = [{ id: 'wpn_clearance', label: 'WPN CLEARANCE', uses: 1, used: 0 }];
  assert.equal(queueContractChoicePrizes(run, players, run.contractFavorsActive), true);
  step(run, players, 0.1, 1);
  assert.ok(p.weaponChestOffer?.contractPrize);
  assert.equal(p.weaponChestOffer.total, 30);
  assert.equal(p.offer, null);
  assert.equal(p.roomWagerOffer, null);
  const pick = p.weaponChestOffer.choices.findIndex(x => x && !x.disabled);
  assert.equal(handleWeaponPick(run, players, p, Math.max(0, pick)), true);
  step(run, players, 0.1, 2);
  assert.ok(p.offer, 'regular INSTALL should open after the contract choice');
  assert.equal(p.offer.total, 96);
  assert.ok(p.roomWagerOffer, 'untimed wager should coexist with regular INSTALL');
}

// A Wager turns green in its current room, but the reward starts in the next one.
{
  const p = createPlayer('wager-delay', 'WAGER', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(21603);
  run.plan = { loopIndex: 2 };
  p.connected = true;
  p.roomWagerActive = {
    condition: 'kills10', prize: 'loop_dmg50', completed: false,
    prizeTextRu: 'УРОН +50%', prizeTextEn: 'DAMAGE +50%'
  };
  p.wagerStats = { kills: 10 };
  updateRoomWagerCompletion(run, players);
  assert.equal(p.roomWagerActive.completed, 1, 'Wager must turn complete in the current room');
  assert.ok(run.fx.some(f => f.t === 'room_wager_complete' && f.id === p.id), 'green/audio completion FX must be emitted immediately');
  settleRoomWager(run, players, p);
  assert.equal(p.roomWagerPrizePending, 'loop_dmg50');
  assert.notEqual(p.wagerDmgMul, 1.5, 'the reward must not affect the room where Wager completed');
  assert.equal(activateQueuedRoomWagerPrize(run, p), true);
  assert.equal(p.roomWagerPrizePending, '');
  assert.equal(p.wagerDmgMul, 1.5, 'the reward must activate at the next room start');
  assert.ok(run.fx.some(f => f.t === 'room_wager_reward_active' && f.id === p.id));
}

// Silence exit is authoritative and emitted once when Q unlocks.
{
  const p = createPlayer('silence-end', 'SILENCE', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(21602);
  run.phase = 'play'; run.now = 0; run.plan = { roomId: 'BOSS', category: 'boss', loopIndex: 0, roomInLoop: 3, w: 1600, h: 900, modifierIds: [], walls: [], interactables: [], quota: 0 };
  run.portal = { x: 800, y: 450, open: false }; run.enemies = []; run.bullets = []; run.pickups = []; run.activeFields = []; run.decoys = [];
  run.pendingActives = []; run.pendingStrikes = []; run.pendingSlotMobs = []; run.pendingCasinoRolls = [];
  p.bossQSilenceT = 0.05;
  step(run, players, 0.1, 1);
  assert.ok(run.fx.some(f => f.t === 'boss_q_silence_end' && f.id === p.id));
}

const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const audio = fs.readFileSync(new URL('../src/audio.v2-1.js', import.meta.url), 'utf8');
const render = fs.readFileSync(new URL('../src/render.v2-1.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(hud, /r\.right \+ gap/);
assert.match(hud, /translate\(-50%, -50%\)/);
assert.match(hud, /room_wager_complete/);
assert.match(hud, /contractFavorPreviewBody/);
assert.match(sim, /roomWagerPrizePending/);
assert.match(fs.readFileSync(new URL('../src/local.v2-1.js', import.meta.url), 'utf8'), /weapon_offer_close/);
assert.match(audio, /boss_silence_enter/);
assert.match(audio, /boss_silence_exit/);
assert.doesNotMatch(render, /const bannerW = Math\.min\(360/);
assert.match(html, /weapon-choice-timer/);
assert.match(html, /ability-choice-timer/);

console.log('v2.1.216 checks passed: staged contract choices, aligned wager UI, deferred rewards, and silence audio');

