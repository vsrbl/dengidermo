import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ENEMIES, ROOM_MODS, casinoSymbolAllowedForStake, spinCasino } from '../shared/data.v2-1.js';
import { VERSION, BUILD_ID, PROTOCOL } from '../shared/protocol.v2-1.js';
import {
  ROOM_WAGER_PRIZES, ROOM_WAGER_STAKES, activateQueuedRoomWagerPrize,
  activeCanManipulateProjectile, buildSnapshot, casinoStakeCost,
  createPlayer, createRun, handleDevCommand, handleRoomWagerAccept, octLaserPhaseDuration,
  settleRoomWager, spendBossKey, startRoom, step
} from '../shared/sim.v2-1.js';

assert.equal(VERSION, 'v2.1.231');
assert.equal(BUILD_ID, 'impact_driver_wall_boss_audit');
assert.equal(PROTOCOL, 17);

function playerRun(hero = 'base', seed = 231001) {
  const p = createPlayer(`p-${hero}`, hero, 0, { hero });
  p.connected = true;
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  return { run, p, players };
}

// BOSS KEY is neither granted on completion nor destroyed permanently on loss.
{
  const { run, p, players } = playerRun();
  run.runDepth = 4;
  p.stats.bossKeys = 1;
  p.bossKeyChargeLoop = 1;
  p.bossKeyCharges = 1;
  p.roomWagerActive = { condition: 'kills10', stake: 'hp_50', prize: 'boss_key', completed: 1 };
  settleRoomWager(run, players, p);
  assert.equal(p.stats.bossKeys, 1, 'completion must not grant the key in the cleared room');
  assert.equal(p.bossKeyCharges, 1, 'completion must not grant an early charge');
  assert.equal(p.roomWagerPrizePending, 'boss_key');
  assert.equal(activateQueuedRoomWagerPrize(run, p), true);
  assert.equal(p.stats.bossKeys, 2);
  assert.equal(p.bossKeyCharges, 2);

  p.roomWagerActive = { condition: 'no_damage', stake: 'boss_key', prize: 'aegis', completed: 0 };
  p.wagerStats = { damage: 1 };
  settleRoomWager(run, players, p);
  assert.equal(p.stats.bossKeys, 2, 'losing a key stake must preserve permanent capacity');
  assert.equal(p.bossKeyCharges, 1, 'losing a key stake removes one current charge');
}

// An accepted key stake reserves one charge: it cannot be spent before the
// result, returns on success, and is consumed on failure.
{
  const { run, p, players } = playerRun();
  run.runDepth = 4; p.stats.bossKeys = 1; p.bossKeyChargeLoop = 1; p.bossKeyCharges = 1;
  p.roomWagerOffer = { id:7, condition:'kills10', stake:'boss_key', prize:'aegis' };
  assert.equal(handleRoomWagerAccept(run, players, p, 7), true);
  assert.equal(p.roomWagerBossKeyHeld, 1);
  const chest = { chest:'weapon_chest', x:p.x, y:p.y };
  assert.equal(spendBossKey(run, p, chest), false, 'reserved wager key was spendable');
  const keyStake = ROOM_WAGER_STAKES.find(x => x.id === 'boss_key');
  assert.equal(keyStake.needs(p, run), true, 'held key still exists for wager settlement');
  p.roomWagerActive.completed = 1;
  settleRoomWager(run, players, p);
  assert.equal(p.roomWagerBossKeyHeld, 0);
  assert.equal(p.bossKeyCharges, 1);
}

// Every wager reward is deferred; settle only queues its id. Also ensure all
// reward handlers remain callable after the transition.
for (const prize of ROOM_WAGER_PRIZES) {
  const hero = prize.heroes?.[0] || 'base';
  const { run, p, players } = playerRun(hero, 231100 + ROOM_WAGER_PRIZES.indexOf(prize));
  run.runDepth = 5;
  if (prize.id === 'r_stack') { p.stats.rActiveId = 'target_lock'; p.stats.rActiveStacks = 1; }
  p.roomWagerActive = { condition: 'kills10', stake: 'hp_50', prize: prize.id, completed: 1 };
  const before = JSON.stringify(p.stats);
  settleRoomWager(run, players, p);
  assert.equal(JSON.stringify(p.stats), before, `${prize.id} activated before the next sector`);
  assert.equal(p.roomWagerPrizePending, prize.id);
  assert.doesNotThrow(() => activateQueuedRoomWagerPrize(run, p), prize.id);
}

// AEGIS must be usable in the sector where its queued reward activates, not a
// sector later because shield setup happened before prize activation.
{
  const { run, p } = playerRun();
  p.aegisShield = 0; p.aegisShieldMax = 0; p.roomWagerPrizePending = 'aegis';
  activateQueuedRoomWagerPrize(run, p);
  assert.equal(p.aegisShieldMax, 45);
  assert.equal(p.aegisShield, 45);
}

// Casino price growth: same opening price, exactly three times the old added
// growth (allowing the shared 5-GLD rounding).
function oldLoopCostMul(depth, speedDiv = 1.85) {
  const d = Math.max(0, depth / speedDiv);
  const loop = Math.floor(d / 4), within = d % 4, late = Math.max(0, loop - 2);
  return Math.max(1, Math.min(340, Math.pow(3.52, loop) * (1 + within * 0.27) + late * late * 1.72));
}
function round5(v) { return Math.max(1, Math.round(v / 5) * 5); }
for (const depth of [0, 4, 8, 12, 20]) {
  const run = createRun(1); run.runDepth = depth;
  for (const [key, base] of Object.entries({ low:20, mid:55, high:135 })) {
    assert.equal(casinoStakeCost(run, key), round5(base * (1 + (oldLoopCostMul(depth) - 1) * 3)));
  }
}

// RAR may exist or stay fixed on HIGH only, including old-save lock residue.
assert.equal(casinoSymbolAllowedForStake('RAR', 'low'), false);
assert.equal(casinoSymbolAllowedForStake('RAR', 'mid'), false);
assert.equal(casinoSymbolAllowedForStake('RAR', 'high'), true);
for (const stakeKey of ['low', 'mid']) {
  for (let i = 0; i < 5000; i++) {
    const res = spinCasino(Math.random, stakeKey, 100, [], { slotLocks: ['RAR','RAR','RAR'] });
    assert.ok(!res.symbols.includes('RAR'), `${stakeKey} emitted RAR`);
    assert.ok(!(res.lockSlots || []).includes('RAR'), `${stakeKey} retained a RAR lock`);
  }
}

// Two JCK pay cash only; three add full WPN + ABL + RAR rewards.
{
  const pair = spinCasino(() => 0.99, 'high', 0, [], { slotLocks: ['JCK','JCK',''] });
  assert.equal(pair.payload.gld, 135 * 4);
  assert.equal(pair.payload.weaponUpgradeCount || 0, 0);
  assert.equal(pair.payload.abilityCount || 0, 0);
  assert.equal(pair.payload.rareCount || 0, 0);
  const triple = spinCasino(() => 0.5, 'high', 0, [], { slotLocks: ['JCK','JCK','JCK'] });
  assert.equal(triple.payload.gld, 135 * 5);
  assert.equal(triple.payload.weaponUpgradeCount, 1);
  assert.equal(triple.payload.abilityCount, 1);
  assert.equal(triple.payload.rareCount, 1);
}

// A GLD pair always returns a little more than the paid/scaled stake.
{
  const pair = spinCasino(() => 0, 'high', 0, [], { slotLocks: ['GLD','GLD','BAD'] });
  assert.ok(pair.payload.gld >= 135 * 1.10 && pair.payload.gld <= 135 * 1.30);
}

// MOD VETO consumes itself in the next sector, clears every forced modifier,
// dismantles their subsystems, and restores a finite clean quota.
for (const hero of ['base','living_casino','process_controller','impact_driver']) {
  const { run, p, players } = playerRun(hero, 231500 + hero.length);
  run.runDepth = 8;
  run.devNextRoomOverride = { category:'grid', modifierIds:['hunter_contract','casino_virus','moving_room','prism_grid'] };
  run.contractFavorsPending = [{ id:'mod_veto', label:'MOD VETO', uses:1, used:0 }];
  startRoom(run, players);
  assert.deepEqual(run.plan.modifierIds, [], `${hero}: modifiers remained after VETO`);
  assert.ok(run.plan.quota > 0 && run.plan.quota < 1000, `${hero}: infinite quota remained`);
  assert.equal(run.hunterWave, null);
  assert.equal(run.casinoVirus, null);
  assert.deepEqual(run.movingWalls, []);
  assert.deepEqual(run.prismZones, []);
  assert.ok(run.contractFavorsUsedThisRoom.some(x => x.id === 'mod_veto'));
}

// Every current modifier is covered in combinations, not just the known
// infinite-spawn repro. VETO must leave no modifier tag or subsystem behind.
{
  const ids = Object.keys(ROOM_MODS);
  for (let i = 0; i < ids.length; i += 4) {
    const { run, players } = playerRun('base', 231700 + i);
    run.runDepth = 12;
    run.devNextRoomOverride = { category:'grid', modifierIds:ids.slice(i, i + 4) };
    run.contractFavorsPending = [{ id:'mod_veto', label:'MOD VETO', uses:1, used:0 }];
    startRoom(run, players);
    assert.deepEqual(run.plan.modifierIds, [], `VETO left modifiers from ${ids.slice(i, i + 4).join(',')}`);
    assert.equal(run.spawnRelockActive, false);
    assert.deepEqual(run.pendingPrismLanes, []);
    assert.deepEqual(run.pendingBloodTax, []);
    assert.ok((run.plan.interactables || []).every(o => !o.trojan && !o.trojanTriggered));
  }
}

// OCT has no generic shell, moves at doubled speed, has eight-second phases,
// and its snapshot beams are attached to the interpolated body.
{
  assert.equal(ENEMIES.boss.spd, 410);
  assert.equal(ENEMIES.boss.armor, 0);
  for (let phase = 1; phase <= 8; phase++) assert.equal(octLaserPhaseDuration(phase), 8);
  const { run, p, players } = playerRun();
  run.plan = { w:2200, h:1500, walls:[], interactables:[], modifierIds:[], category:'combat', quota:99 };
  run.portal = { x:2100, y:1400, open:false }; run.directorT = 999; run.director = { budget:0, cap:0, next:999, waveIndex:0, used:{}, bag:[], recent:[] };
  assert.equal(handleDevCommand(run, players, p, { action:'spawn_boss', kind:'boss' }), true);
  const boss = run.enemies.find(e => e.kind === 'boss');
  assert.equal(boss.shellMax || 0, 0);
  step(run, players, 1 / 60, 1);
  const snap = buildSnapshot(run, players);
  const row = snap.enemies.find(e => e[0] === boss.id);
  for (const seg of row?.[28] || []) assert.ok(Math.abs(seg[0]) < 100 && Math.abs(seg[1]) < 100, 'OCT beam origin is not body-relative');
  boss.stunT = 1; boss.octLasers = [[boss.x,boss.y,boss.x+500,boss.y,0]];
  step(run, players, 1 / 60, 2);
  assert.deepEqual(boss.octLasers, []);
}

// Player actives/mutations never manipulate any allied projectile class.
for (const bullet of [
  { from:'p', kind:'shotgun' }, { from:'p', kind:'drone', drone:1 },
  { from:'p', kind:'controlled', controlled:1 }, { from:'p', kind:'roulette' },
  { from:'p', kind:'modifier_friendly', roomModifier:1 }
]) assert.equal(activeCanManipulateProjectile(bullet), false);
assert.equal(activeCanManipulateProjectile({ from:'e', kind:'enemy' }), true);

// DRV firewall is authoritative but also present in every snapshot, expires on
// time, and no legacy hero can enter the jump state.
{
  const { run, p, players } = playerRun('impact_driver', 231900);
  startRoom(run, players);
  run.directorT = 999;
  p.stats.impactWallUnlocked = 1;
  p.weapons = ['impact_wall']; p.weaponIdx = 0;
  p.aimX = Math.min(run.plan.w - 300, p.x + 260); p.aimY = p.y;
  p.fire = true;
  step(run, players, 1 / 60, 1);
  assert.equal(run.tempWalls.length, 1, 'firewall was not placed');
  assert.equal(buildSnapshot(run, players).room.tempWalls.length, 1, 'firewall was not synchronized');
  p.fire = false;
  for (let i = 0; i < 340; i++) step(run, players, 1 / 60, 1 + i / 60);
  assert.equal(run.tempWalls.length, 0, 'firewall did not expire');
  assert.ok(!(run.plan.walls || []).some(w => w?.temp), 'expired firewall left invisible collision');

  const base = playerRun('base', 231901);
  startRoom(base.run, base.players);
  base.p.wantJump = true;
  step(base.run, base.players, 1 / 60, 1);
  assert.equal(base.p.jumpT, 0);
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /activeCanManipulateProjectile\(b\)/);
assert.match(sim, /stepImpactTempWalls\(run, dt\)/);
assert.doesNotMatch(data, /\['RAR','WPN','ABL','GLD','EXP','HEA','STC'\]/);

console.log('v2.1.231 checks passed: wagers, casino, VETO, OCT and allied projectile safety');
