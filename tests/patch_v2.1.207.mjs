import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UPGRADES } from '../shared/data.v2-1.js';
import { LocalRoom } from '../src/local.v2-1.js';
import { choosePack, createPlayer, createRun, handlePick, startRoom, step, wallJumperSpawnViable } from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:20[7-9]|21[0-4])$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.207' ? 'install_choice_identity_sync' : VERSION === 'v2.1.208' ? 'boss_bag_trinode_q_silence_casino_wpn' : VERSION === 'v2.1.209' ? 'contract_choice_root_lock_mirror_static_sync' : VERSION === 'v2.1.210' ? 'trinode_parts_radial_break_sync' : VERSION === 'v2.1.211' ? 'trinode_chase_loop_hp_splitter_audio' : VERSION === 'v2.1.212' ? 'boss_q_silence_fullscreen_signal' : 'solo_offline_hard_fallback');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);

const upgradeById = new Map(UPGRADES.map(u => [u.id, u]));

function installFixture(id = 'install-207') {
  const p = createPlayer(id, id, 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(20701);
  run.phase = 'install';
  run.fx = [];
  run.installOfferSeq = 700;
  run.installComboPrizeOfferSeen = {};
  p.economy.pending = 1;
  p.offer = { id: 700, choices: ['dmg', 'fire', 'maxhp'], expires: 48, total: 48 };
  return { p, players, run };
}

// WALL JUMPER is a real director encounter from the third cycle onward. The
// cycle pity chooses it only when the room has a valid attachable surface.
{
  let fixture = null;
  for (let seed = 20710; seed < 20780 && !fixture; seed++) {
    const p = createPlayer(`wall-${seed}`, 'WALL QA', 0);
    const players = new Map([[p.id, p]]);
    const run = createRun(seed);
    run.runDepth = 8;
    startRoom(run, players);
    if (run.plan.category !== 'boss' && wallJumperSpawnViable(run)) fixture = { p, players, run };
  }
  assert.ok(fixture, 'no generated third-cycle room supports WALL JUMPER');
  const { players, run } = fixture;
  run.director.waveIndex = 1;
  run.director.pauseT = 0;
  run.wallJumperSeenLoop = -1;
  assert.equal(choosePack(run).id, 'wall_jumper_ambush', 'director pity did not select WALL AMBUSH');
  run.enemies = [];
  run.spawned = 0;
  step(run, players, 1 / 60, 1);
  const jumper = run.enemies.find(e => e.kind === 'wall_jumper');
  assert.ok(jumper, 'WALL AMBUSH did not spawn WALL JUMPER');
  assert.match(jumper.state, /^wall_(?:top|bottom|left|right)$/);
  assert.ok(Number.isInteger(jumper.wallIndex) && jumper.wallIndex >= 0, 'WALL JUMPER spawned without a wall anchor');
  assert.equal(run.wallJumperSeenLoop, 2, 'wall-jumper cycle appearance was not recorded');
}

// The red moving danger walls are gameplay hazards, not decoration: touching
// an active wall must damage and slow the hero, while the same geometry is
// harmless when the room modifier is not active.
{
  const p = createPlayer('fire-wall-207', 'FIRE WALL QA', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(20777);
  startRoom(run, players);
  run.phase = 'play';
  run.enemies = [];
  run.bullets = [];
  run.director.pauseT = 999;
  p.x = 500; p.y = 500; p.hp = 100; p.invuln = 0; p.hurtCd = 0; p.zoneHitCd = 0;
  run.movingWalls = [{ id: 'fire-wall', x: 470, y: 470, w: 60, h: 60, axis: 'x', min: 470, max: 470, dir: 1, speed: 0, dmgCd: 0 }];
  run.plan.modifierIds = [];
  step(run, players, 1 / 60, 1);
  assert.equal(p.hp, 100, 'inactive fire wall damaged the hero');
  run.plan.modifierIds = ['moving_room'];
  p.invuln = 0; p.hurtCd = 0; p.zoneHitCd = 0;
  step(run, players, 1 / 60, 2);
  assert.equal(p.hp, 93, 'active fire wall did not deal its base 7 HP damage');
  assert.ok(p.slowT > 0, 'active fire wall did not slow the hero');
  assert.ok(run.fx.some(f => f.t === 'moving_zone_hit'), 'active fire wall produced no hit feedback');
}

// Each visible index applies that exact card and reports the same label.
for (let idx = 0; idx < 3; idx++) {
  const { p, players, run } = installFixture(`index-${idx}`);
  const chosenId = p.offer.choices[idx];
  assert.equal(handlePick(run, players, p, idx, 700, chosenId), true);
  const fx = run.fx.findLast(f => f.t === 'install' && f.id === p.id);
  assert.equal(fx?.label, upgradeById.get(chosenId)?.label, `index ${idx} applied another card`);
  assert.equal(p.economy.pending, 0);
  assert.equal(p.offer, null);
}

// A delayed card identity can no longer be interpreted at the same index of a
// newer offer. Nothing is applied and the current offer remains intact.
{
  const { p, players, run } = installFixture('identity-guard');
  const before = { dmg: p.stats.dmgMul, fire: p.stats.fireMul, hp: p.stats.maxHpAdd, pending: p.economy.pending };
  assert.equal(handlePick(run, players, p, 1, 700, 'dmg'), false);
  assert.deepEqual({ dmg: p.stats.dmgMul, fire: p.stats.fireMul, hp: p.stats.maxHpAdd, pending: p.economy.pending }, before);
  assert.equal(p.offer.id, 700);
  assert.equal(run.fx.some(f => f.t === 'install'), false);
}

// Stress a late-run queue: every generated offer has a newer identity, three
// unique cards, and the selected card is exactly the one applied.
{
  const { p, players, run } = installFixture('late-queue');
  p.economy.pending = 80;
  let priorOfferId = 699;
  for (let pickNo = 0; pickNo < 80; pickNo++) {
    const offer = p.offer;
    assert.ok(offer, `late queue lost offer ${pickNo + 1}`);
    assert.ok(offer.id > priorOfferId, 'offer identity did not advance');
    assert.equal(new Set(offer.choices).size, offer.choices.length, 'offer contains duplicate cards');
    assert.equal(offer.choices.length, 3, 'late offer is incomplete');
    const idx = pickNo % offer.choices.length;
    const chosenId = offer.choices[idx];
    const fxBefore = run.fx.length;
    assert.equal(handlePick(run, players, p, idx, offer.id, chosenId), true);
    const applied = run.fx.slice(fxBefore).find(f => f.t === 'install' && f.id === p.id);
    assert.equal(applied?.label, upgradeById.get(chosenId)?.label, `late pick ${pickNo + 1} applied another upgrade`);
    priorOfferId = offer.id;
  }
  assert.equal(p.economy.pending, 0);
  assert.equal(p.offer, null);
}

// Finishing the last INSTALL closes that exact offer immediately even when a
// separate late-game room wager still needs a decision.
{
  const messages = [];
  const room = new LocalRoom('INSTALL207', m => messages.push(m), 'install-sync-207');
  try {
    room.addHost('host-207', 'HOST');
    const p = room.players.get('host-207');
    room.run.phase = 'install';
    p.economy.pending = 1;
    p.offer = { id: 907, choices: ['dmg', 'fire', 'maxhp'], expires: 48, total: 48 };
    p.roomWagerOffer = { id: 9907, expires: 30, total: 30 };
    room.offersSent.set(p.id, p.offer);
    messages.length = 0;
    room.handleMsg(p.id, { t: 'pick', choice: 1, offerId: 907, choiceId: 'fire' });
    const close = messages.find(m => m.t === 'offer_close');
    assert.equal(close?.offerId, 907, 'completed INSTALL did not close its exact offer');
    assert.equal(p.offer, null);
    assert.ok(p.roomWagerOffer, 'INSTALL incorrectly consumed the separate room wager');
  } finally {
    room.close();
  }
}

const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const local = fs.readFileSync(new URL('../src/local.v2-1.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.v2-1.js', import.meta.url), 'utf8');
const net = fs.readFileSync(new URL('../src/net.v2-1.js', import.meta.url), 'utf8');
assert.match(hud, /nextOfferId < this\.installLatestOfferId/);
assert.match(hud, /closedOfferId < this\.installLatestOfferId/);
assert.match(hud, /const offer = me\[P\.ROOMWAGER\]/);
assert.doesNotMatch(hud, /P\.SECTORWAGER/);
assert.match(hud, /import \{[^\n]*\bgetLang\b[^\n]*\} from '\.\/i18n\.v2-1\.js'/);
assert.match(hud, /d\.dataset\.choiceId = String\(id \|\| ''\)/);
assert.match(hud, /this\.net\.sendPick\(i, liveOfferId, liveChoiceId\)/);
assert.match(local, /const requestedChoiceId = String\(m\.choiceId \|\| ''\)/);
assert.match(local, /offer_close', offerId: handledOfferId/);
assert.match(main, /hud\.closeInstallOffer\(m\?\.offerId \|\| 0\)/);
assert.match(net, /choiceId: String\(choiceId \|\| ''\)/);

console.log('v2.1.207 checks passed: exact INSTALL sync, visible wager handoff, fire-wall damage, live WALL JUMPER director encounter');
