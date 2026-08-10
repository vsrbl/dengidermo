import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildSnapshot,
  clearAllBankedStatic,
  createPlayer,
  createRun,
  startRoom,
  step
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.19[4-6]$/);
if (VERSION === 'v2.1.194') assert.equal(BUILD_ID, 'static_debt_source_audit_contract_clear');
assert.equal(PROTOCOL, 14);

function activeFixture(core, mutations = [], seed = 1940) {
  const p = createPlayer(`debt-${seed}`, 'DEBT TEST', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  startRoom(run, players);
  run.plan.walls = [];
  run.plan.category = 'boss';
  run.director.pauseT = 999;
  p.active = { core, level: 3, mutations };
  p.activeCd = 0;
  return { p, players, run };
}

// STATIC PULSE remains a damaging Q, but even the old worst-case random roll
// can no longer create banked Static debt by itself.
{
  const { p, players, run } = activeFixture('debt_pulse', [], 1941);
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    for (let i = 0; i < 20; i++) {
      p.activeCd = 0;
      p.wantActive = true;
      step(run, players, 1 / 60, i + 1);
    }
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(run.staticDebt, 0, 'STATIC PULSE generated hidden debt');
  assert.deepEqual(run.staticDebtSources, {});
}

// CASINO is the only Q path allowed to bank debt, and it must happen through
// the visible mutation roll result rather than silently during the cast.
{
  const { p, players, run } = activeFixture('black_box', ['casino'], 1942);
  const originalRandom = Math.random;
  try {
    Math.random = () => 0.12; // visible CASINO mutation outcome: DEBT
    p.wantActive = true;
    step(run, players, 1 / 60, 1);
    assert.equal(run.staticDebt, 0, 'debt applied before the visible casino roll completed');
    assert.equal(run.pendingCasinoRolls.length, 1);
    step(run, players, 1 / 60, 3);
  } finally {
    Math.random = originalRandom;
  }
  assert.equal(run.staticDebt, 1);
  assert.deepEqual(run.staticDebtSources, { active_casino: 1 });
}

// The contract prize is an all-clear, not a one-stack reduction.
{
  const run = createRun(1943);
  run.staticDebt = 4;
  run.staticDebtSources = { cursed_chest: 2, casino_bet: 1, active_casino: 1 };
  run.staticRainCarry = 3;
  run.staticRainCarrySources = { previous_room_hits: 3 };
  assert.equal(clearAllBankedStatic(run), 7);
  assert.equal(run.staticDebt, 0);
  assert.equal(run.staticRainCarry, 0);
  assert.deepEqual(run.staticDebtSources, {});
  assert.deepEqual(run.staticRainCarrySources, {});
}

// Verify the real prize activation path clears every old level before the next
// room is assembled. A newly rolled room modifier remains a separate source.
{
  const p = createPlayer('favor-clear', 'FAVOR CLEAR', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(1944);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  run.staticDebt = 5;
  run.staticDebtSources = { cursed_chest: 2, casino_bet: 2, active_casino: 1 };
  run.staticRainCarry = 2;
  run.staticRainCarrySources = { previous_room_hits: 2 };
  run.contractFavorsActive = [{ id: 'clear_debt', label: 'CLEAR STATIC STORM', tier: 'common', uses: 1, used: 0, persistent: 1 }];
  startRoom(run, players);
  assert.equal(run.staticDebt, 0);
  assert.equal(run.staticRainCarry, 0);
  assert.equal(run.staticRainStacks, 0);
  assert.deepEqual(run.staticRainSources, []);
  assert.equal(run.contractFavorsActive.find(f => f.id === 'clear_debt')?.used, 1);
  assert.equal(run.contractFavorsUsedThisRoom.find(f => f.id === 'clear_debt')?.cleared, 7);
}

// v2.1.194 suppressed recurring Core storms. v2.1.195 deliberately restores
// the room source; the new patch test covers its contract-cleansing exception.
{
  const p = createPlayer('static-core', 'STATIC CORE', 0);
  p.stats.debtEngine = 4;
  const players = new Map([[p.id, p]]);
  const run = createRun(1945);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  startRoom(run, players);
  const snap = buildSnapshot(run, players);
  if (VERSION === 'v2.1.194') {
    assert.equal(run.staticRainStacks, 0);
    assert.equal(run.staticRainSources.some(s => s.id === 'debt_engine'), false);
    assert.equal(snap.room.staticRainNext, 0);
    assert.equal(snap.room.debtEngineRainStacks, 0);
  } else {
    assert.equal(run.staticRainStacks, 4);
    assert.deepEqual(run.staticRainSources, [{ id: 'debt_engine', level: 4 }]);
    assert.equal(snap.room.staticRainNext, 4);
    assert.equal(snap.room.debtEngineRainStacks, 4);
  }
}

// A genuine room modifier is still allowed to create its own storm.
{
  const p = createPlayer('natural-static', 'NATURAL STATIC', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(1946);
  run.devNextRoomOverride = { category: 'grid', modifierIds: ['static_rain'] };
  startRoom(run, players);
  assert.equal(run.staticRainStacks, 1);
  assert.deepEqual(run.staticRainSources, [{ id: 'room_modifier', level: 1 }]);
  assert.equal(run.staticRainCanSeedNext, true);
}

// Exhaustive source audit: all banked-debt writes in the simulation must be
// one of the three explicit event paths. Room modifiers and Casino Virus run
// their storms directly and therefore do not write hidden banked debt.
const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const debtCallSources = [...sim.matchAll(/addStaticDebt\(run,\s*[^,]+,\s*'([^']+)'\)/g)].map(m => m[1]);
const allowedBankedSources = new Set(['cursed_chest', 'casino_bet', 'active_casino']);
assert.ok(debtCallSources.length >= 3);
assert.ok(debtCallSources.every(id => allowedBankedSources.has(id)), `unexpected debt sources: ${debtCallSources.join(', ')}`);
assert.deepEqual([...new Set(debtCallSources)].sort(), [...allowedBankedSources].sort());
assert.doesNotMatch(sim, /addStaticDebt\(run,[^\n]*'(?:debt_pulse|bad_tape|contract_wager|debt_engine)'/);

const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.match(data, /Сама Q не создаёт статик-долг/);
assert.match(hud, VERSION === 'v2.1.196'
  ? /навсегда глушит шторм Статик-ядра/
  : /Полностью снимает весь накопленный статик-долг/);
assert.match(i18n, /Q itself never creates Static debt/);

console.log(`v2.1.194 compatibility checks passed: explicit debt sources, Q-safe STATIC PULSE, full contract clear${VERSION === 'v2.1.194' ? ', no STATIC CORE recurrence' : ''}`);
