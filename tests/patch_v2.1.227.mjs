import assert from 'node:assert/strict';
import { ENEMIES, BOSS_SIGNATURE_UPGRADE_IDS } from '../shared/data.v2-1.js';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import {
  createRun, createPlayer, startRoom, step, damageEnemy, handlePick,
  handleWeaponPick, handleAbilityPick, handleRoomWagerDecline,
  handleDevCommand, bossOrderForRun
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.227');
assert.equal(BUILD_ID, 'full_boss_rotation_transition_audit');
assert.equal(PROTOCOL, 15);

const BOSS_TYPES = ['boss_croupier', 'boss_anchor_cashier', 'boss_hunter_chorus', 'boss_q_revisor', 'boss', 'boss_trinode'];
const HEROES = ['', 'living_casino', 'process_controller'];

function tick(run, players, count = 1, now = 0) {
  for (let i = 0; i < count; i++) step(run, players, 1 / 60, now + i / 60);
}
function setup(number, kind, hero = '', contractPrize = '') {
  const seed = 227000 + number * 100 + BOSS_TYPES.indexOf(kind) * 10 + HEROES.indexOf(hero);
  const run = createRun(seed);
  const p = createPlayer(`p-${number}-${kind}-${hero || 'base'}`, 'FULL BOSS QA', 0, hero ? { hero } : null);
  const players = new Map([[p.id, p]]);
  run.runDepth = number * 4 - 1;
  run.runMemory.bossesDefeated = number - 1;
  startRoom(run, players);
  run.runDepth = number * 4 - 1;
  run.runMemory.bossesDefeated = number - 1;
  run.plan = { ...run.plan, category: 'boss', finalBoss: number === 6 ? 1 : 0, modifierIds: [], walls: [], interactables: [], w: 2200, h: 1500 };
  run.portal = { open: false, x: p.x, y: p.y };
  run.now = 10 + number;
  run.enemies = [];
  run.bullets = [];
  run.director.pauseT = 999;
  run.bossKind = kind;
  run.lastBossKind = '';
  p.devGod = true;
  p.economy.pending = contractPrize ? 1 : 0;
  if (contractPrize) {
    run.roomObjective = {
      id: 'boss_cut', label: 'BOSS CUT', goal: 'Kill the boss.',
      prizePreview: [{ id: contractPrize, uses: 1 }]
    };
  } else run.roomObjective = null;
  assert.equal(handleDevCommand(run, players, p, { action: 'spawn_boss', kind }), true);
  const boss = run.enemies.find(e => e.kind === kind);
  assert.ok(boss, `${kind}: spawn failed`);
  boss.spawnDelay = 0;
  boss.shellHp = 0;
  boss.shellMax = 0;
  return { run, p, players, boss, number, kind, contractPrize };
}
function killOne(q, e) {
  e.spawnDelay = 0; e.shellHp = 0; e.shellMax = 0;
  damageEnemy(q.run, q.players, e, Math.max(100000, (e.maxHp || e.hp || 1) * 10), q.p.id, 0, 0, 0, 'qa_boss_kill');
}
function defeatBoss(q) {
  const before = q.run.runMemory.bossesDefeated;
  if (q.kind === 'boss_trinode') {
    for (let part = 0; part < 3; part++) {
      const live = q.run.enemies.find(e => e.kind === 'boss_trinode' && e.hp > 0);
      assert.ok(live, 'TRI disappeared before all three parts were destroyed');
      live.trinodeUnlockT = 0;
      killOne(q, live);
    }
  } else if (q.kind === 'boss_hunter_chorus') {
    killOne(q, q.boss);
    const fragments = q.run.enemies.filter(e => ENEMIES[e.kind]?.bossFragment);
    assert.deepEqual(new Set(fragments.map(e => e.kind)), new Set(['boss_hunter_duelist', 'boss_hunter_marksman', 'boss_hunter_trapper']));
    assert.equal(q.run.portal.open, false, 'HNT portal opened before all fragments died');
    for (const fragment of [...fragments]) killOne(q, fragment);
  } else killOne(q, q.boss);
  assert.equal(q.run.runMemory.bossesDefeated, before + 1, `${q.kind}: boss counter changed incorrectly`);
  assert.equal(q.run.portal.open, true, `${q.kind}: portal did not open`);
  assert.equal(q.p.bossSignaturePending, true, `${q.kind}: signature was not queued`);
  assert.equal(q.p.bossSignatureKind, q.kind, `${q.kind}: wrong signature family`);
  assert.equal(q.p.bossSignatureChoices.length, 2);
  assert.ok(q.p.bossSignatureChoices.every(id => BOSS_SIGNATURE_UPGRADE_IDS.includes(id)));
  if (q.p.hero === 'living_casino' || q.p.hero === 'process_controller') {
    assert.equal(q.p.bossSignatureChoices.includes('sig_target_lock'), false, `${q.kind}: incompatible TARGET LOCK offered`);
  }
}
function enterPortal(q, now = 1) {
  q.p.x = q.run.portal.x; q.p.y = q.run.portal.y;
  q.p.wantInteract = true;
  step(q.run, q.players, 1 / 60, now);
}
function chooseBossReward(q) {
  assert.equal(q.p.offer?.kind, 'boss_signature');
  const id = q.p.offer.choices[0];
  assert.equal(handlePick(q.run, q.players, q.p, 0, q.p.offer.id, id), true);
  assert.equal(q.p.bossSignaturePending, false);
}
function drainInstall(q, now = 2) {
  let guard = 0;
  while (q.run.phase === 'install' && guard++ < 40) {
    tick(q.run, q.players, 1, now + guard / 60);
    if (q.p.contractPrizeOffer) {
      const ability = q.p.contractPrizeOffer.kind === 'contract_ability';
      assert.equal(ability ? handleAbilityPick(q.run, q.players, q.p, 0) : handleWeaponPick(q.run, q.players, q.p, 0), true);
      continue;
    }
    if (q.p.offer?.kind === 'boss_signature') { chooseBossReward(q); continue; }
    if (q.p.offer) {
      assert.equal(handlePick(q.run, q.players, q.p, 0, q.p.offer.id, q.p.offer.choices[0]), true);
      continue;
    }
    if (q.p.roomWagerOffer) {
      assert.equal(handleRoomWagerDecline(q.run, q.players, q.p, q.p.roomWagerOffer.id), true);
      continue;
    }
  }
  assert.ok(guard < 40, `transition queue did not drain: ${JSON.stringify({ offer: q.p.offer, pending: q.p.economy.pending, sig: q.p.bossSignaturePending, wager: q.p.roomWagerOffer, contract: q.p.contractPrizeOffer })}`);
}
function finishNonFinalQueue(q, now = 2) {
  // Resolve an optional contract WPN/ABL prize before the boss signature.
  if (q.p.contractPrizeOffer) {
    const child = q.p.contractPrizeOffer.kind === 'contract_ability' ? q.p.abilityChestOffer : q.p.weaponChestOffer;
    assert.ok(child?.contractPrize);
    assert.equal(q.p.contractPrizeOffer.kind === 'contract_ability'
      ? handleAbilityPick(q.run, q.players, q.p, 0)
      : handleWeaponPick(q.run, q.players, q.p, 0), true);
    tick(q.run, q.players, 1, now + 0.01);
  }
  drainInstall(q, now + 0.02);
  assert.equal(q.run.phase, 'play', `boss ${q.number} ${q.kind}: transition stuck`);
  assert.equal(q.run.runDepth, q.number * 4);
}

// Every actual boss death path at every boss number, for every hero. This is
// 108 boss encounters and includes HNT fragments and all three TRI segments.
for (let number = 1; number <= 6; number++) {
  for (const kind of BOSS_TYPES) {
    for (const hero of HEROES) {
      const q = setup(number, kind, hero);
      defeatBoss(q);
      enterPortal(q, number * 100 + BOSS_TYPES.indexOf(kind) * 10 + HEROES.indexOf(hero));
      if (number === 6) {
        assert.equal(q.run.phase, 'won', `final ${kind}/${hero || 'base'} did not finish`);
        for (const field of ['offer', 'bossSignatureChoices', 'contractPrizeOffer', 'weaponChestOffer', 'abilityChestOffer', 'rareChestOffer', 'roomWagerOffer']) assert.equal(q.p[field], null, `final ${kind}: stale ${field}`);
        assert.equal(q.p.bossSignaturePending, false);
      } else {
        assert.equal(q.run.phase, 'install');
        drainInstall(q, number + 0.1);
        assert.equal(q.run.phase, 'play', `boss ${number} ${kind}/${hero || 'base'} stuck`);
      }
    }
  }
}

// Full mixed queue for every main boss type in early and late positions:
// contract prize -> boss signature -> normal INSTALL -> wager -> next room.
for (const number of [2, 4, 5]) {
  for (let i = 0; i < BOSS_TYPES.length; i++) {
    const prize = i % 2 ? 'abl_clearance' : 'wpn_clearance';
    const q = setup(number, BOSS_TYPES[i], 'process_controller', prize);
    defeatBoss(q);
    enterPortal(q, 5000 + number * 10 + i);
    assert.equal(q.run.phase, 'install');
    tick(q.run, q.players, 1, 5100 + i);
    assert.ok(q.p.contractPrizeOffer, `${q.kind}: contract prize not queued: ${JSON.stringify({ objective: q.run.roomObjective, settlement: q.run.roomObjectiveSettlement, favors: q.run.contractFavorsActive, offer: q.p.offer, pending: q.p.economy.pending })}`);
    assert.equal(q.p.offer, null, `${q.kind}: boss signature covered contract prize`);
    finishNonFinalQueue(q, 5200 + i);
  }
}

// The seeded rotation must always contain every main boss exactly once.
for (let seed = 1; seed <= 500; seed++) {
  const run = createRun(seed);
  const order = bossOrderForRun(run);
  assert.equal(order.length, BOSS_TYPES.length);
  assert.deepEqual(new Set(order), new Set(BOSS_TYPES));
}

// Emergency recovery is checked once per boss family with its own signature
// kind and must restore, rather than consume, the mandatory reward.
for (const kind of BOSS_TYPES) {
  const q = setup(3, kind, 'process_controller');
  defeatBoss(q); enterPortal(q, 6000 + BOSS_TYPES.indexOf(kind));
  q.p.offer = { id: 999, kind: 'boss_signature', choices: [], expires: 10, total: 64 };
  assert.equal(handleDevCommand(q.run, q.players, q.p, { action: 'repair_transition' }), true);
  assert.equal(q.p.offer?.kind, 'boss_signature');
  assert.equal(q.p.offer.choices.length, 2);
  assert.equal(q.p.bossSignatureKind, kind);
}

console.log('v2.1.227 checks passed: all 6 boss types at positions 1-6, all heroes, real death paths and mixed queues');
