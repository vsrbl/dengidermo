import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES, UPGRADES } from '../shared/data.v2-1.js';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import {
  createRun, createPlayer, startRoom, step, handlePick, handleDevCommand,
  handleContractPick, handleWeaponPick, handleAbilityPick,
  makeWeaponChestChoices, fireProcessControllerProtocol,
  processSawFallbackDamageValue
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.226');
assert.equal(BUILD_ID, 'late_boss_transition_saw_failsafe_audit');
assert.equal(PROTOCOL, 15);

function tick(run, players, count = 1, start = 0) {
  for (let i = 0; i < count; i++) step(run, players, 1 / 60, start + i / 60);
}
function setupBossExit(bossNumber, { contract = false, prize = '', normalInstall = 0 } = {}) {
  const run = createRun(226000 + bossNumber * 10 + (contract ? 1 : 0));
  const p = createPlayer(`boss-${bossNumber}-${contract ? 'contract' : 'plain'}`, 'LATE BOSS QA', 0, { hero: 'process_controller' });
  const players = new Map([[p.id, p]]);
  const depth = bossNumber * 4 - 1;
  run.runDepth = depth;
  run.runMemory.bossesDefeated = bossNumber;
  startRoom(run, players);
  run.runDepth = depth;
  run.plan = { ...run.plan, category: 'boss', finalBoss: bossNumber === 6 ? 1 : 0, modifierIds: [], walls: [], interactables: [] };
  run.portal = { open: true, x: p.x, y: p.y };
  run.enemies = [];
  run.roomObjective = contract ? {
    id: 'boss_cut', label: 'BOSS CUT', goal: 'Kill the boss.',
    prizePreview: [{ id: prize || 'wpn_clearance', uses: 1 }]
  } : null;
  run.roomObjectiveSettlement = contract ? { id: 'boss_cut', label: 'BOSS CUT', done: 1, status: 'done', statusLabel: 'DONE', progress: 'DONE' } : null;
  p.stats.roomWagerUnlocked = bossNumber >= 4 ? 1 : 0;
  p.roomWagerDecisionDone = false;
  p.economy.pending = normalInstall;
  p.bossSignaturePending = true;
  p.bossSignatureKind = 'boss_anchor_cashier';
  p.bossSignatureChoices = ['sig_spawn_hold', 'sig_aegis_process'];
  p.offer = null;
  return { run, p, players };
}
function enterPortal(q, now = 1) {
  q.p.wantInteract = true;
  step(q.run, q.players, 1 / 60, now);
}
function pickBossReward(q) {
  assert.equal(q.p.offer?.kind, 'boss_signature');
  assert.equal(handlePick(q.run, q.players, q.p, 0, q.p.offer.id, q.p.offer.choices[0]), true);
}

// Bosses four and five have permanent room wagers unlocked. Their boss reward
// must still complete both with and without a contract prize in front of it.
for (const bossNumber of [4, 5]) {
  {
    const q = setupBossExit(bossNumber);
    enterPortal(q, bossNumber);
    assert.equal(q.run.phase, 'install');
    assert.equal(q.p.offer?.kind, 'boss_signature');
    assert.equal(q.p.roomWagerOffer, null, `boss ${bossNumber}: wager covered the mandatory boss reward`);
    assert.equal(handleDevCommand(q.run, q.players, q.p, { action: 'repair_transition' }), true);
    assert.equal(q.p.offer?.kind, 'boss_signature');
    pickBossReward(q);
    tick(q.run, q.players, 1, bossNumber + 0.1);
    assert.ok(q.p.roomWagerOffer, `boss ${bossNumber}: wager did not follow the boss reward`);
    assert.equal(handleDevCommand(q.run, q.players, q.p, { action: 'repair_transition' }), true);
    tick(q.run, q.players, 1, bossNumber + 0.11);
    assert.equal(q.run.phase, 'play', `boss ${bossNumber}: boss-only late transition stuck`);
    assert.equal(q.run.runDepth, bossNumber * 4);
  }
  for (const prize of ['wpn_clearance', 'abl_clearance']) {
    const q = setupBossExit(bossNumber, { contract: true, prize, normalInstall: 1 });
    enterPortal(q, bossNumber + 0.2);
    assert.equal(q.run.phase, 'install');
    tick(q.run, q.players, 1, bossNumber + 0.21);
    assert.ok(q.p.contractPrizeOffer, `boss ${bossNumber} ${prize}: contract prize missing`);
    assert.equal(q.p.offer, null, `boss ${bossNumber} ${prize}: boss reward opened before contract prize`);
    const child = prize === 'wpn_clearance' ? q.p.weaponChestOffer : q.p.abilityChestOffer;
    assert.ok(child?.contractPrize);
    assert.equal(prize === 'wpn_clearance'
      ? handleWeaponPick(q.run, q.players, q.p, 0)
      : handleAbilityPick(q.run, q.players, q.p, 0), true);
    tick(q.run, q.players, 1, bossNumber + 0.3);
    assert.equal(q.p.offer?.kind, 'boss_signature');
    pickBossReward(q);
    assert.equal(q.p.economy.pending, 1);
    assert.notEqual(q.p.offer?.kind, 'boss_signature');
    assert.ok(q.p.offer?.choices?.length || q.p.economy.pending > 0);
    tick(q.run, q.players, 1, bossNumber + 0.4);
    assert.ok(q.p.offer?.choices?.length, `boss ${bossNumber} ${prize}: normal INSTALL did not follow boss reward`);
    assert.equal(handlePick(q.run, q.players, q.p, 0, q.p.offer.id, q.p.offer.choices[0]), true);
    assert.ok(q.p.roomWagerOffer);
    assert.equal(handleDevCommand(q.run, q.players, q.p, { action: 'repair_transition' }), true);
    tick(q.run, q.players, 2, bossNumber + 0.5);
    assert.equal(q.run.phase, 'play', `boss ${bossNumber} ${prize}: full queue stuck`);
    assert.equal(q.run.runDepth, bossNumber * 4);
  }
}

// The sixth boss has no next INSTALL. Victory must discard the technical
// signature/wager/contract queue instead of hiding it behind the final screen.
for (const contract of [false, true]) {
  const q = setupBossExit(6, { contract, prize: 'wpn_clearance', normalInstall: 2 });
  q.p.contractPrizeOffer = contract ? { id: 'stale-final', offers: [], index: 0 } : null;
  q.p.weaponChestOffer = contract ? { contractPrize: 1, choices: [] } : null;
  q.p.roomWagerOffer = { id: 606 };
  enterPortal(q, 6);
  assert.equal(q.run.phase, 'won');
  assert.equal(q.p.offer, null);
  assert.equal(q.p.bossSignaturePending, false);
  assert.equal(q.p.bossSignatureChoices, null);
  assert.equal(q.p.contractPrizeOffer, null);
  assert.equal(q.p.weaponChestOffer, null);
  assert.equal(q.p.roomWagerOffer, null);
}

function enemy(kind, id, x, y, hp = null) {
  const def = ENEMIES[kind] || ENEMIES.grunt;
  const health = hp ?? def.hp;
  return { id, kind, x, y, hp: health, maxHp: health, size: def.size, spawnDelay: 0, shellHp: 0, shellMax: 0, dirX: 1, dirY: 0 };
}
function sawFixture(seed) {
  const p = createPlayer(`saw-${seed}`, 'SAW QA', 0, { hero: 'process_controller' });
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  startRoom(run, players);
  run.plan = { ...run.plan, category: 'boss', w: 1600, h: 1000, walls: [], modifierIds: [] };
  run.director.pauseT = 999;
  p.x = 500; p.y = 500; p.aimX = 700; p.aimY = 500;
  p.weapons = ['command_pulse', 'process_saw']; p.weaponIdx = 1;
  p.fire = true; p.fireWasDown = false;
  return { run, p, players };
}

// The exact requested WPN card: it requires SAW, enters the real WPN pool,
// applies once, and disappears after ownership.
{
  const upgrade = UPGRADES.find(x => x.id === 'saw_fallback_damage');
  assert.ok(upgrade);
  const noSaw = createPlayer('no-saw', 'NO SAW', 0, { hero: 'process_controller' });
  for (let i = 0; i < 100; i++) assert.equal(makeWeaponChestChoices(noSaw, Math.random, 5, 2).some(x => x.upgrade === 'saw_fallback_damage'), false);
  const p = createPlayer('has-saw', 'HAS SAW', 0, { hero: 'process_controller' });
  p.weapons = ['command_pulse', 'process_saw'];
  let state = 226099; const rng = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  let option = null;
  for (let i = 0; i < 300 && !option; i++) option = makeWeaponChestChoices(p, rng, 5, 2).find(x => x.upgrade === 'saw_fallback_damage') || null;
  assert.ok(option, 'SAW failsafe never entered a real WPN offer');
  upgrade.apply(p.stats);
  assert.equal(p.stats.sawFallbackDamage, 1);
  for (let i = 0; i < 100; i++) assert.equal(makeWeaponChestChoices(p, rng, 5, 2).some(x => x.upgrade === 'saw_fallback_damage'), false);
}

// Without the card a failed scan is free and causes no damage. With it, every
// materialized target in the SAW area that could not be captured takes damage:
// full slots, insufficient assimilation, armor and bosses included.
{
  const q = sawFixture(226201);
  const blocked = enemy('warden', 'no-card', 700, 500, 400);
  q.run.enemies = [blocked];
  fireProcessControllerProtocol(q.run, q.players, q.p, 1 / 60);
  assert.equal(blocked.hp, 400);
  assert.equal(q.p.processController.weaponCooldowns.process_saw || 0, 0);
}
for (const scenario of ['full_slots', 'tier', 'armor', 'boss']) {
  const q = sawFixture(226300 + scenario.length);
  q.p.stats.sawFallbackDamage = 1;
  let target;
  if (scenario === 'full_slots') {
    q.p.processController.controlled = [
      { id: 'a', kind: 'grunt', hp: 10, maxHp: 10, ttl: 10 },
      { id: 'b', kind: 'runner', hp: 10, maxHp: 10, ttl: 10 }
    ];
    target = enemy('grunt', 'full', 700, 500, 400);
  } else if (scenario === 'tier') target = enemy('warden', 'tier', 700, 500, 400);
  else if (scenario === 'armor') {
    target = enemy('tank', 'armor', 700, 500, 400);
    target.shellHp = 140; target.shellMax = 140; target.shellType = 'plain';
  } else target = enemy('boss_anchor_cashier', 'boss', 700, 500, 5000);
  q.run.enemies = [target];
  const hpBefore = target.hp, shellBefore = target.shellHp;
  const expected = processSawFallbackDamageValue(q.p);
  fireProcessControllerProtocol(q.run, q.players, q.p, 1 / 60);
  if (scenario === 'armor') {
    assert.ok(target.shellHp < shellBefore);
    assert.equal(target.hp, hpBefore);
  } else assert.ok(target.hp <= hpBefore - expected + 0.001, `${scenario}: fallback damage missing`);
  assert.ok((q.p.processController.weaponCooldowns.process_saw || 0) > 0);
  assert.ok(q.run.fx.some(f => f.t === 'ctrl_saw' && f.damaged >= 1));
}

// General damage and WPN damage still scale this fallback because SAW is a
// weapon; this is verification, not a replacement for the failsafe card.
{
  const q = sawFixture(226401); q.p.stats.sawFallbackDamage = 1;
  const base = processSawFallbackDamageValue(q.p);
  q.p.stats.dmgMul *= 1.5;
  q.p.stats.weaponDmgMul *= 1.18;
  assert.ok(processSawFallbackDamageValue(q.p) > base * 1.76);
}

const simText = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
assert.match(simText, /The sixth boss ends the run directly/);
console.log('v2.1.226 checks passed: bosses 4-6 queues and SAW failsafe WPN module');
