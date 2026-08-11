import assert from 'node:assert/strict';
import fs from 'node:fs';
import { casinoSymbolAllowedForStake, spinCasino } from '../shared/data.v2-1.js';
import { createPlayer, createRun, handleCasino, startRoom } from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.20[6-8]$/);
assert.equal(BUILD_ID, VERSION === 'v2.1.206' ? 'low_stake_lock_overload_guard' : VERSION === 'v2.1.207' ? 'install_choice_identity_sync' : 'boss_bag_trinode_q_silence_casino_wpn');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);

assert.equal(casinoSymbolAllowedForStake('WPN', 'low'), false);
assert.equal(casinoSymbolAllowedForStake('ABL', 'low'), false);
assert.equal(casinoSymbolAllowedForStake('WPN', 'mid'), true);
assert.equal(casinoSymbolAllowedForStake('ABL', 'high'), true);

// Low-stake rolls may not produce WPN/ABL as a symbol, reward, or automatic lock,
// including with high luck and a large deterministic sample.
{
  let state = 20601;
  const rng = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 12000; i++) {
    const res = spinCasino(rng, 'low', i % 25, []);
    assert.equal(res.symbols.some(x => x === 'WPN' || x === 'ABL'), false, 'low stake rolled WPN/ABL');
    assert.equal(res.lockSlots.some(x => x === 'WPN' || x === 'ABL'), false, 'low stake locked WPN/ABL');
    assert.equal(!!res.payload.weapon || !!res.payload.ability, false, 'low stake paid a WPN/ABL reward');
  }
}

// A stale WPN/ABL lock from a prior build or another stake is stripped before a
// low roll, while the same locks remain valid on mid stake.
{
  const low = spinCasino(() => 0.999, 'low', 0, [], { slotLocks: ['WPN', 'ABL', 'GLD'] });
  assert.deepEqual(low.symbols, ['BAD', 'BAD', 'GLD']);
  assert.deepEqual(low.lockSlots, ['', '', 'GLD']);
  const mid = spinCasino(() => 0.999, 'mid', 0, [], { slotLocks: ['WPN', 'ABL', 'GLD'] });
  assert.deepEqual(mid.symbols, ['WPN', 'ABL', 'GLD']);
  assert.deepEqual(mid.lockSlots, ['WPN', 'ABL', 'GLD']);
}

function casinoFixture(id, locks) {
  const p = createPlayer(id, id, 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(20602);
  startRoom(run, players);
  run.phase = 'play';
  run.fx = [];
  run.pendingSlotMobs = [];
  run.plan = {
    ...run.plan,
    category: 'grid', w: 1600, h: 1000, walls: [], modifierIds: [],
    interactables: [{ id: `bet-${id}`, type: 'bet', x: p.x, y: p.y }]
  };
  p.economy.money = 10000;
  p.casinoSlotLocks = locks.slice(0, 3);
  p.casinoFullLockSpins = 0;
  return { p, players, run };
}

const originalRandom = Math.random;
try {
  Math.random = () => 0.999;

  // Two held cells now overload on the tenth qualifying spin.
  {
    const { p, players, run } = casinoFixture('two-locks', ['GLD', 'EXP', '']);
    for (let i = 1; i <= 9; i++) {
      const res = handleCasino(run, players, p, 'low', []);
      assert.notEqual(res.outcome, 'OVERLOAD', `two locks overloaded early on spin ${i}`);
      assert.equal(p.casinoFullLockSpins, i);
    }
    const tenth = handleCasino(run, players, p, 'low', []);
    assert.equal(tenth.outcome, 'OVERLOAD');
    assert.equal(run.plan.interactables.some(x => x.type === 'bet'), false, 'overloaded terminal was not removed');
    assert.equal(run.pendingSlotMobs.length, 1, 'overload did not schedule SLOT MOB assembly');
  }

  // Three locks keep the same ten-spin break rule.
  {
    const { p, players, run } = casinoFixture('three-locks', ['GLD', 'EXP', 'HEA']);
    for (let i = 1; i <= 9; i++) assert.notEqual(handleCasino(run, players, p, 'low', []).outcome, 'OVERLOAD');
    assert.equal(handleCasino(run, players, p, 'low', []).outcome, 'OVERLOAD');
  }

  // A single held cell never advances the overload counter.
  {
    const { p, players, run } = casinoFixture('one-lock', ['GLD', '', '']);
    for (let i = 1; i <= 12; i++) assert.notEqual(handleCasino(run, players, p, 'low', []).outcome, 'OVERLOAD');
    assert.equal(p.casinoFullLockSpins, 0);
    assert.equal(run.plan.interactables.some(x => x.type === 'bet'), true);
  }
} finally {
  Math.random = originalRandom;
}

const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
assert.match(hud, /Два и больше ФИКСА ломают терминал на 10-й прокрутке/);
assert.match(hud, /Two or more LOCKS break the terminal on the 10th spin/);

console.log('v2.1.206 checks passed: low-stake WPN/ABL exclusion and ten-spin overload for two or three locks');
