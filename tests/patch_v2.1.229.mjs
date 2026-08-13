import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  bossLoopHpMultiplier, buildSnapshot, createPlayer, createRun, startRoom
} from '../shared/sim.v2-1.js';
import { BUILD_ID, VERSION } from '../shared/protocol.v2-1.js';

assert.equal(VERSION, 'v2.1.229');
assert.equal(BUILD_ID, 'triple_static_core_boss_hp_contract_trim');

function coreRoom(stacks = 1, secondPlayerStacks = 0, seed = 22901) {
  const p1 = createPlayer(`core-a-${seed}`, 'CORE A', 0);
  p1.stats.debtEngine = stacks;
  const players = new Map([[p1.id, p1]]);
  if (secondPlayerStacks > 0) {
    const p2 = createPlayer(`core-b-${seed}`, 'CORE B', 1);
    p2.stats.debtEngine = secondPlayerStacks;
    players.set(p2.id, p2);
  }
  const run = createRun(seed);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  startRoom(run, players);
  return { run, players };
}

// Every actual STATIC CORE upgrade stack contributes exactly three room-storm levels.
{
  const one = coreRoom(1, 0, 22911);
  assert.equal(one.run.staticRainStacks, 3);
  assert.deepEqual(one.run.staticRainSources, [{ id: 'debt_engine', level: 3 }]);
  const snap = buildSnapshot(one.run, one.players);
  assert.equal(snap.room.debtEngineStacks, 1, 'HUD must retain the real upgrade count');
  assert.equal(snap.room.debtEngineRainStacks, 3, 'HUD must expose the tripled storm count');
  startRoom(one.run, one.players);
  assert.equal(one.run.staticRainStacks, 3, 'STATIC CORE multiplied again between rooms');

  const team = coreRoom(2, 1, 22912);
  assert.equal(team.run.staticRainStacks, 9);
  assert.deepEqual(team.run.staticRainSources, [{ id: 'debt_engine', level: 9 }]);
  assert.equal(buildSnapshot(team.run, team.players).room.debtEngineStacks, 3);
}

// Other storm sources remain one-for-one and never inherit the core multiplier.
{
  const p = createPlayer('plain-debt-229', 'PLAIN DEBT', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(22914);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  run.staticDebt = 2;
  run.staticDebtSources = { cursed_chest: 2 };
  startRoom(run, players);
  assert.equal(run.staticRainStacks, 2);
  assert.deepEqual(run.staticRainSources, [{ id: 'cursed_chest', level: 2 }]);
}

// Contract cleansing still permanently disables the entire core source.
{
  const p = createPlayer('cleansed-core-229', 'CLEANSED', 0);
  p.stats.debtEngine = 2;
  const players = new Map([[p.id, p]]);
  const run = createRun(22913);
  run.devNextRoomOverride = { category: 'grid', modifierIds: [] };
  run.contractFavorsActive = [{ id: 'clear_debt', label: 'CLEAR STATIC STORM', uses: 1, used: 0, persistent: 1 }];
  startRoom(run, players);
  assert.equal(run.staticCoreStormDisabled, true);
  assert.equal(run.staticRainStacks, 0);
  startRoom(run, players);
  assert.equal(run.staticRainStacks, 0);
}

// Boss base HP is unchanged on loop one; every later-loop growth term is doubled.
assert.equal(bossLoopHpMultiplier({ runDepth: 3 }), 1);
assert.equal(bossLoopHpMultiplier({ runDepth: 7 }), 1.5);
assert.equal(bossLoopHpMultiplier({ runDepth: 11 }), 2);
assert.ok(Math.abs(bossLoopHpMultiplier({ runDepth: 15 }) - 2.74) < 1e-9);

// The long-distance kill contract is gone from generated contract choices and code paths.
{
  let offersSeen = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const p = createPlayer(`contract-${seed}`, 'CONTRACT', 0);
    const players = new Map([[p.id, p]]);
    const run = createRun(seed);
    run.runDepth = 4 + (seed % 5) * 4;
    startRoom(run, players);
    const choices = run.contractChoice?.choices || [];
    offersSeen += choices.length;
    assert.equal(choices.some(x => x.id === 'long_account'), false);
  }
  assert.ok(offersSeen > 0, 'contract generation was not exercised');
  const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
  const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
  assert.doesNotMatch(sim, /long_account|longRangeKills|RANGE KILLS MISSING/);
  assert.doesNotMatch(i18n, /LONG ACCOUNT|long-range kills|дальних убийств/);
}

console.log('v2.1.229 checks passed: STATIC CORE x3, contract trim, doubled boss loop HP growth');
