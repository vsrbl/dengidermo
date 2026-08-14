import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UPGRADES, WEAPON_CHEST_REWARDS } from '../shared/data.v2-1.js';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import {
  ROOM_WAGER_CONDITIONS, ROOM_WAGER_PRIZES, ROOM_WAGER_STAKES,
  createPlayer, createRun, handleAbilityPick, handlePick, handleRerollOffer,
  handleDevCommand, handleWeaponPick, impactDriverProfile, makeAbilityChestChoices,
  makeRoomWagerOffer, makeWeaponChestChoices, queueContractChoicePrizes,
  startRoom, step, voidPreviewEnd, weaponChoiceEligible
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.237');
assert.equal(BUILD_ID, 'driver_base_modules_reward_isolation');
assert.equal(PROTOCOL, 17);

function seeded(seed) {
  let state = seed >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; };
}
function collectWeaponChoices(p, seed, rolls = 400) {
  const rng = seeded(seed), choices = [];
  for (let i = 0; i < rolls; i++) choices.push(...makeWeaponChestChoices(p, rng, 5, i % 3));
  return choices;
}
function arena(hero = 'impact_driver', seed = 237000) {
  const p = createPlayer(`arena-${hero}-${seed}`, hero, 0, { hero });
  const run = createRun(seed), players = new Map([[p.id, p]]);
  run.plan = { w: 1400, h: 900, walls: [], interactables: [], modifierIds: [], category: 'combat', quota: 99, specialRoomId: 'chill_room' };
  run.portal = { x: 1300, y: 800, open: false };
  run.director = { mode: 'calm', budget: 0, cap: 0, wave: 0, next: 999999, pauseT: 999999, used: {} };
  run.directorT = 999999; run.roomStats = {};
  p.x = 240; p.y = 450; p.aimX = 420; p.aimY = 450;
  return { p, run, players, now: 0 };
}
function tick(q, count = 1) { for (let i = 0; i < count; i++) { q.now += 1 / 60; step(q.run, q.players, 1 / 60, q.now); } }

const driverIds = new Set(WEAPON_CHEST_REWARDS.filter(x => x.heroOnly === 'impact_driver').map(x => x.id));
assert.ok(driverIds.size >= 13, 'not all Driver cards are marked hero-only');
for (const id of ['impact_damage','impact_wall_count','impact_push_damage']) assert.ok(driverIds.has(id));
assert.equal(WEAPON_CHEST_REWARDS.some(x => x.id === 'impact_wall_unlock' || x.id === 'impact_push_unlock'), false);

// Both signature modules are immediately available, including migration of an
// old player object whose unlock flags were still zero.
{
  const p = createPlayer('driver-start', 'DRV', 0, { hero: 'impact_driver' });
  assert.deepEqual(p.weapons, ['impact_wall']);
  assert.equal(p.stats.impactWallUnlocked, 1);
  assert.equal(p.stats.impactPushUnlocked, 1);
  const run = createRun(237001), players = new Map([[p.id, p]]);
  p.stats.impactWallUnlocked = 0; p.stats.impactPushUnlocked = 0; p.weapons = ['impact_driver'];
  startRoom(run, players);
  assert.deepEqual(p.weapons, ['impact_wall']);
  assert.equal(p.stats.impactWallUnlocked, 1);
  assert.equal(p.stats.impactPushUnlocked, 1);
}

// The starting buttons are not only flags/UI: LMB places a block immediately
// and RMB can launch that exact owned block immediately.
{
  const q = arena('impact_driver', 237005);
  q.p.fire = true; tick(q); q.p.fire = false; tick(q);
  const wall = q.run.tempWalls.find(w => w.owner === q.p.id);
  assert.ok(wall, 'starting LMB Firewall did not place a block');
  const cx = wall.x + wall.w / 2, cy = wall.y + wall.h / 2;
  q.p.aimX = cx - 10; q.p.aimY = cy; q.p.wantSecondary = true; tick(q);
  assert.ok(wall.moving, 'starting RMB Shift Impulse did not launch the block');
}

// Keep the previous patch's airborne-Q behavior alive after base-kit migration.
{
  const q = arena('impact_driver', 237006);
  q.p.active = { core: 'blood_ring', level: 1, mutations: [], mutationLevels: {} };
  q.p.wantJump = true; tick(q);
  const before = q.p.jumpT;
  q.p.wantActive = true; tick(q);
  assert.ok(q.run.activeFields.some(f => f.kind === 'blood_ring'));
  assert.ok(q.p.jumpT > 0 && q.p.jumpT < before);
  assert.equal(impactDriverProfile(q.p).recovery, 0);
}

// Driver WPN now contains upgrades only; the two obsolete discovery cards can
// never reappear through a chest or a contract/casino call to the same factory.
{
  const p = createPlayer('driver-pool', 'DRV', 0, { hero: 'impact_driver' });
  const choices = collectWeaponChoices(p, 237010);
  const ids = new Set(choices.map(x => x.upgrade || x.id));
  assert.ok(ids.has('impact_wall_count'));
  assert.ok(ids.has('impact_push_damage'));
  assert.ok(!ids.has('impact_wall_unlock'));
  assert.ok(!ids.has('impact_push_unlock'));
  assert.ok(choices.every(x => x.impactOnly === 1));
}

// No Driver card may leak into any other hero's WPN pool, even across many
// five-slot rolls. The authoritative eligibility guard rejects stale cards too.
for (const hero of ['base', 'living_casino', 'process_controller']) {
  const p = createPlayer(`pool-${hero}`, hero, 0, { hero });
  const choices = collectWeaponChoices(p, 237100 + hero.length);
  assert.ok(choices.length > 0);
  assert.ok(choices.every(x => !driverIds.has(x.id) && !driverIds.has(x.upgrade)), `${hero} received a Driver card`);
  for (const opt of WEAPON_CHEST_REWARDS.filter(x => driverIds.has(x.id))) assert.equal(weaponChoiceEligible(p, opt), false);
}

// All requested WPN layouts stay full for every hero after filtering; isolation
// must never leave a blank or undersized chest window.
for (const hero of ['base','living_casino','process_controller','impact_driver']) {
  const p = createPlayer(`full-wpn-${hero}`, hero, 0, { hero });
  const rng = seeded(237300 + hero.length);
  for (let count = 1; count <= 5; count++) for (let i = 0; i < 80; i++) {
    assert.equal(makeWeaponChestChoices(p, rng, count, i % 3).length, count, `${hero} WPN ${count} slots`);
  }
}

// ABL is a separate Q-only factory and never contains WPN/DRV cards.
for (const hero of ['base','living_casino','process_controller','impact_driver']) {
  const p = createPlayer(`abl-${hero}`, hero, 0, { hero });
  for (let i = 0; i < 200; i++) {
    const choices = makeAbilityChestChoices(p, seeded(237500 + i), 5, 2);
    assert.equal(choices.length, 5, `${hero} ABL window lost slots`);
    assert.ok(choices.every(x => !driverIds.has(x.id) && !driverIds.has(x.upgrade)));
  }
}

// Real WPN picks and contract rerolls preserve the same boundary, not just the
// initial generated arrays.
for (const hero of ['base','living_casino','process_controller','impact_driver']) {
  const p = createPlayer(`pick-path-${hero}`, hero, 0, { hero });
  const run = createRun(237620 + hero.length), players = new Map([[p.id, p]]);
  p.weaponChestOffer = { choices: makeWeaponChestChoices(p, seeded(237621 + hero.length), 5, 2), slotCount: 5, valueTier: 2, picksTotal: 2, picksRemaining: 2, pickedLabels: [] };
  assert.equal(handleWeaponPick(run, players, p, 0), true, `${hero} could not use a valid WPN choice`);
  assert.equal(p.weaponChestOffer?.choices.length, 4, `${hero} second WPN pick did not remain open`);
  run.contractFavorsActive = [{ id: 'free_reroll', uses: 1 }];
  assert.equal(handleRerollOffer(run, players, p, 'weapon'), true, `${hero} WPN reroll failed`);
  assert.equal(p.weaponChestOffer.choices.length, 4, `${hero} WPN reroll lost slots`);
  assert.ok(p.weaponChestOffer.choices.every(x => hero === 'impact_driver' ? x.impactOnly === 1 : !driverIds.has(x.id)), `${hero} WPN reroll crossed hero pools`);

  p.abilityChestOffer = { choices: makeAbilityChestChoices(p, seeded(237622 + hero.length), 5, 2), slotCount: 5, valueTier: 2, picksTotal: 2, picksRemaining: 2, pickedLabels: [] };
  assert.equal(handleAbilityPick(run, players, p, 0), true, `${hero} could not use a valid ABL choice`);
  assert.equal(p.abilityChestOffer?.choices.length, 4, `${hero} second ABL pick did not remain open`);
  assert.ok(p.abilityChestOffer.choices.every(x => !driverIds.has(x.id)), `${hero} ABL pick exposed a Driver card`);
  run.contractFavorsActive = [{ id: 'free_reroll', uses: 1 }];
  assert.equal(handleRerollOffer(run, players, p, 'ability'), true, `${hero} ABL reroll failed`);
  assert.equal(p.abilityChestOffer.choices.length, 4, `${hero} ABL reroll lost slots`);
  assert.ok(p.abilityChestOffer.choices.every(x => !driverIds.has(x.id)), `${hero} ABL reroll exposed a Driver card`);
}

// Contract WPN and ABL rewards are built through the same isolated factories.
for (const hero of ['base','living_casino','process_controller','impact_driver']) {
  const p = createPlayer(`contract-prize-${hero}`, hero, 0, { hero });
  const run = createRun(237650 + hero.length), players = new Map([[p.id, p]]);
  queueContractChoicePrizes(run, players, [{ id: 'wpn_clearance' }, { id: 'abl_clearance' }]);
  const offers = p.contractPrizeOffer?.offers || [];
  assert.equal(offers.length, 2);
  assert.ok(offers.every(o => o.choices.length === 4));
  assert.ok(offers.flatMap(o => o.choices).every(x => !driverIds.has(x.id) || hero === 'impact_driver'));
}

// INSTALL cannot execute a forged/stale Driver weapon upgrade for another
// hero. A legitimate general INSTALL choice still applies normally.
{
  const p = createPlayer('install-guard', 'BASE', 0, { hero: 'base' });
  const run = createRun(237700), players = new Map([[p.id, p]]);
  run.phase = 'install'; p.economy.pending = 1;
  p.offer = { id: 1, choices: ['impact_damage'], expires: 99, total: 99 };
  assert.equal(handlePick(run, players, p, 0, 1, 'impact_damage'), false);
  assert.equal(p.stats.jumpImpactDamage, 0);
  step(run, players, 1 / 60, 0);
  assert.ok(p.offer && p.offer.choices.length === 3, 'INSTALL did not repair the stale offer');
  assert.ok(!p.offer.choices.includes('impact_damage'));
  p.offer = { id: 2, choices: ['dmg'], expires: 99, total: 99 };
  assert.equal(handlePick(run, players, p, 0, 2, 'dmg'), true);
  assert.ok(p.stats.dmgMul > 1);
}

// Contracts are team-aware: Driver objectives appear only if the team contains
// the Driver, and an all-Driver team cannot receive the trivial no-dash task.
{
  const seenBase = new Set(), seenDriver = new Set();
  for (let seed = 1; seed <= 600; seed++) {
    for (const hero of ['base','impact_driver']) {
      const p = createPlayer(`${hero}-${seed}`, hero, 0, { hero });
      const run = createRun(seed); run.runDepth = 4 + seed % 19;
      startRoom(run, new Map([[p.id, p]]));
      const target = hero === 'base' ? seenBase : seenDriver;
      for (const c of run.nextRoomPreview?.objectiveChoices || []) target.add(c.id);
    }
  }
  assert.ok(![...seenBase].some(id => id.startsWith('impact_')));
  assert.ok([...seenDriver].some(id => id.startsWith('impact_')));
  assert.ok(!seenDriver.has('no_escape'));
  assert.ok(!seenDriver.has('impact_rebound'), 'rebound contract appeared before its counter upgrade');

  const seenReboundDriver = new Set();
  for (let seed = 601; seed <= 1200; seed++) {
    const p = createPlayer(`impact-rebound-${seed}`, 'DRV', 0, { hero: 'impact_driver' });
    p.stats.jumpRebound = 1;
    const run = createRun(seed); run.runDepth = 4 + seed % 19;
    startRoom(run, new Map([[p.id, p]]));
    for (const c of run.nextRoomPreview?.objectiveChoices || []) seenReboundDriver.add(c.id);
  }
  assert.ok(seenReboundDriver.has('impact_rebound'), 'rebound contract stayed unavailable after its counter upgrade');
}

// Wager tables keep hero-only content isolated, and Q-use is not eligible when
// no Q exists. Repeated offer rolls exercise the actual offer builder.
{
  const q3 = ROOM_WAGER_CONDITIONS.find(x => x.id === 'q3');
  const rebound2 = ROOM_WAGER_CONDITIONS.find(x => x.id === 'impact_bounce2');
  const base = createPlayer('wager-base', 'BASE', 0, { hero: 'base' });
  assert.equal(q3.needs(base), false);
  const driver = createPlayer('wager-driver', 'DRV', 0, { hero: 'impact_driver' });
  assert.equal(rebound2.needs(driver), false);
  driver.stats.jumpRebound = 1;
  assert.equal(rebound2.needs(driver), true);
  base.stats.roomWagerUnlocked = 1;
  const run = createRun(237900);
  for (let i = 0; i < 500; i++) {
    base.roomWagerDecisionDone = false; base.roomWagerActive = null;
    const offer = makeRoomWagerOffer(run, base);
    assert.ok(offer);
    assert.ok(!String(offer.stake).startsWith('impact_'));
    assert.ok(!String(offer.condition).startsWith('impact_'));
    assert.ok(!String(offer.prize).startsWith('impact_'));
    assert.notEqual(offer.condition, 'q3');
  }
  for (const table of [ROOM_WAGER_STAKES, ROOM_WAGER_CONDITIONS, ROOM_WAGER_PRIZES]) {
    for (const row of table.filter(x => String(x.id).startsWith('impact_'))) assert.deepEqual(row.heroes, ['impact_driver']);
  }
}

// VOID CUT keeps its maximum range and chain behavior, but no longer forces an
// 80px link when the cursor is almost on the previous node.
{
  const q = arena('base', 237950);
  q.p.active = { core: 'void_cut', level: 1, mutations: [], mutationLevels: {} };
  const sx = 400, sy = 400;
  q.p.aimX = sx + 5; q.p.aimY = sy;
  const end = voidPreviewEnd(q.run, q.p, sx, sy);
  const len = Math.hypot(end.x - sx, end.y - sy);
  assert.ok(len >= 8 && len <= 12, `VOID CUT minimum link is ${len}px instead of near-zero`);
}

// Developer grants also stay hero-scoped; they are often used to diagnose a
// real run and must not silently corrupt its WPN state.
for (const hero of ['base','living_casino','process_controller','impact_driver']) {
  const p = createPlayer(`dev-${hero}`, hero, 0, { hero });
  const run = createRun(237960 + hero.length), players = new Map([[p.id, p]]);
  assert.equal(handleDevCommand(run, players, p, { action: 'give_all_weapons' }), true);
  const legal = hero === 'base'
    ? new Set(['shotgun','seeker','rocketgun'])
    : hero === 'living_casino'
      ? new Set(['living_casino','control_sparks'])
      : hero === 'process_controller'
        ? new Set(['command_pulse','quarantine_anchor','process_saw'])
        : new Set(['impact_wall']);
  assert.ok(p.weapons.every(w => legal.has(w)), `${hero} debug grant crossed hero weapon pools`);
  assert.equal(handleDevCommand(run, players, p, { action: 'give_all_weapon_mods' }), true);
  if (hero !== 'impact_driver') assert.equal(p.stats.jumpImpactDamage, 0, `${hero} debug mods received Driver power`);
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /HERO_UPGRADES\.find\(x => x\.id === id && installUpgradeEligible\(p, id\)\)/);
assert.match(sim, /Both signature modules are part of the Driver's base kit/);
assert.match(sim, /r\.heroOnly && r\.heroOnly !== roomWagerHeroId\(p\)/);

console.log('v2.1.237 checks passed: base Driver modules, isolated WPN/ABL/INSTALL, contracts, wagers and short Void Cut links');
