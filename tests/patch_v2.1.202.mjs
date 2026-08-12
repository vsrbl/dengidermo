import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ACTIVE_MUTATIONS, ACTIVE_MUTATION_SLOTS } from '../shared/data.v2-1.js';
import {
  activeMutationLevel,
  createPlayer,
  createRun,
  handleAbilityPick,
  makeAbilityChestChoices,
  startRoom,
  step
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:20[2-9]|21[0-5])$/);
if (VERSION === 'v2.1.202') assert.equal(BUILD_ID, 'unlimited_mutation_levels');
assert.ok(PROTOCOL === 14 || PROTOCOL === 15);
assert.equal(ACTIVE_MUTATION_SLOTS, Number.POSITIVE_INFINITY);

const mutationIds = Object.keys(ACTIVE_MUTATIONS);
assert.ok(mutationIds.length > 3, 'mutation catalogue unexpectedly small');
assert.deepEqual(mutationIds.filter(id => ACTIVE_MUTATIONS[id].stackable === false), ['casino']);

function playerWith(mutations = [], mutationLevels = {}) {
  const p = createPlayer('mutation-test', 'MUTATION TEST', 0);
  p.active = { core: 'black_box', level: 1, mutations: [...mutations], mutationLevels: { ...mutationLevels } };
  return p;
}

// Compatibility: legacy duplicate ids become levels, every distinct mutation
// survives, and the unique CASINO mutation is normalized to level I.
{
  const p = playerWith([...mutationIds, 'static', 'static', 'echo', 'casino'], { blood: 4, casino: 99 });
  assert.equal(activeMutationLevel(p, 'static'), 3);
  assert.equal(activeMutationLevel(p, 'echo'), 2);
  assert.equal(activeMutationLevel(p, 'blood'), 4);
  assert.equal(activeMutationLevel(p, 'casino'), 1);
  assert.deepEqual(new Set(p.active.mutations), new Set(mutationIds));
  assert.equal(p.active.mutations.length, mutationIds.length);
}

// Once CASINO is owned, it never returns in ABL offers. Every mutation that
// can scale may return as an explicit level upgrade.
{
  const p = playerWith(mutationIds, Object.fromEntries(mutationIds.map(id => [id, 1])));
  let state = 0x202;
  const rng = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 0x100000000);
  let sawUpgrade = false;
  for (let i = 0; i < 80; i++) {
    const choices = makeAbilityChestChoices(p, rng, 5, 2);
    assert.equal(choices.some(opt => opt.mutation === 'casino'), false, 'unique CASINO returned after ownership');
    for (const opt of choices.filter(opt => opt.mutation)) {
      assert.equal(opt.kind, 'active_upgrade_mutation');
      assert.equal(opt.repeatable, 1);
      sawUpgrade = true;
    }
  }
  assert.equal(sawUpgrade, true, 'stackable mutation upgrades never appeared');
}

// Repeated picks raise the level without duplicating or removing ownership.
{
  const p = playerWith(['static', 'blood', 'casino'], { static: 1, blood: 2, casino: 1 });
  const players = new Map([[p.id, p]]);
  const run = createRun(2021);
  const pick = opt => {
    p.abilityChestOffer = { choices: [opt], slotCount: 1, picksTotal: 1, picksRemaining: 1 };
    assert.equal(handleAbilityPick(run, players, p, 0), true);
  };
  pick({ kind: 'active_upgrade_mutation', mutation: 'static', label: 'STATIC II' });
  pick({ kind: 'active_upgrade_mutation', mutation: 'static', label: 'STATIC III' });
  assert.equal(activeMutationLevel(p, 'static'), 3);
  assert.deepEqual(p.active.mutations, ['static', 'blood', 'casino']);

  // An offer left open by an older build is converted to add/upgrade and must
  // never overwrite the mutation at replaceIdx.
  pick({ kind: 'active_replace_mutation', mutation: 'shrapnel', replaceIdx: 0, label: 'LEGACY REPLACE' });
  assert.deepEqual(p.active.mutations, ['static', 'blood', 'casino', 'shrapnel']);
  assert.equal(activeMutationLevel(p, 'shrapnel'), 1);

  const before = [...p.active.mutations];
  p.abilityChestOffer = { choices: [{ kind: 'active_replace_mutation', mutation: 'casino', replaceIdx: 1 }], slotCount: 1 };
  assert.equal(handleAbilityPick(run, players, p, 0), false, 'unique mutation accepted a duplicate legacy offer');
  assert.deepEqual(p.active.mutations, before);
}

function castWith(mutation, mutationLevel, seed) {
  const p = playerWith([mutation], { [mutation]: mutationLevel });
  const players = new Map([[p.id, p]]);
  const run = createRun(seed);
  startRoom(run, players);
  run.plan.walls = [];
  run.plan.category = 'boss';
  run.director.pauseT = 999;
  p.activeCd = 0;
  p.wantActive = true;
  step(run, players, 1 / 60, 1);
  return { p, run };
}

// Runtime levels are independent from the Q core level and actually scale.
assert.equal(castWith('echo', 3, 2022).run.pendingActives.length, 3);
assert.equal(castWith('bad_tape', 3, 2023).run.pendingActives.length, 6);
assert.ok(castWith('void', 4, 2024).p.invuln > castWith('void', 1, 2025).p.invuln);
{
  const low = castWith('static', 1, 2026).run.activeFields.find(f => f.kind === 'static');
  const high = castWith('static', 5, 2027).run.activeFields.find(f => f.kind === 'static');
  assert.ok(high.r > low.r);
  assert.ok(high.ttl > low.ttl);
}

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const i18n = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.doesNotMatch(sim, /mutations\s*=\s*[^;\n]*slice\(0,\s*ACTIVE_MUTATION_SLOTS/);
assert.match(sim, /active_upgrade_mutation/);
assert.match(i18n, /Может выпадать повторно и усиливаться без лимита/);
assert.match(i18n, /Unique: once installed, it no longer appears/);

globalThis.localStorage = { getItem: () => 'en', setItem: () => {} };
const localization = await import('../src/i18n.v2-1.js');
assert.equal(localization.locAction('УСИЛИТЬ МУТАЦИЮ'), 'UPGRADE MUTATION');
assert.match(localization.optionDesc({ kind: 'active_add_mutation', mutation: 'casino', repeatable: 0 }), /Unique: once installed/);
assert.match(localization.optionDesc({ kind: 'active_upgrade_mutation', mutation: 'static', mutationLevel: 7 }), /Level 7/);
globalThis.localStorage.getItem = () => 'ru';
assert.equal(localization.locAction('UPGRADE MUTATION'), 'УСИЛИТЬ МУТАЦИЮ');
assert.match(localization.optionDesc({ kind: 'active_add_mutation', mutation: 'static', repeatable: 1 }), /без лимита/);

console.log('v2.1.202 checks passed: unlimited mutation ownership, unique filtering, unbounded levels and legacy safety');
