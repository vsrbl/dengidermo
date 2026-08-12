import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPlayer, createRun, handleContractPick } from '../shared/sim.v2-1.js';
import { BUILD_ID, VERSION } from '../shared/protocol.v2-1.js';

assert.equal(VERSION, 'v2.1.218');
assert.equal(BUILD_ID, 'contract_choice_confirmation_ui');

// A player gets one final contract vote. Delayed/repeated input cannot replace it.
{
  const p = createPlayer('contract-lock', 'LOCK', 0);
  const players = new Map([[p.id, p]]);
  const run = createRun(21801);
  run.contractChoice = {
    depth: 5,
    selected: '',
    votes: {},
    choices: [
      { id: 'one', label: 'ONE', goal: 'First', prizePreview: [{ id: 'a' }] },
      { id: 'two', label: 'TWO', goal: 'Second', prizePreview: [{ id: 'b' }] },
      { id: 'three', label: 'THREE', goal: 'Third', prizePreview: [{ id: 'c' }] }
    ]
  };
  assert.equal(handleContractPick(run, players, p, 1), true);
  assert.equal(run.contractChoice.votes[p.id], 'two');
  assert.equal(run.contractChoice.selected, 'two');
  assert.equal(run.pendingRoomObjective.objective.id, 'two');
  assert.equal(handleContractPick(run, players, p, 2), false);
  assert.equal(run.contractChoice.votes[p.id], 'two');
  assert.equal(run.pendingRoomObjective.objective.id, 'two');
}

const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
assert.match(hud, /CONTRACT SELECTED/);
assert.match(hud, /contract-selected-card/);
assert.match(hud, /pendingContractPick/);
assert.match(hud, /if \(this\.pendingContractPick \|\| authoritativeVote\) return/);
assert.match(css, /\.contract-selected-card/);

console.log('v2.1.218 checks passed: contract choice locks once and collapses to one highlighted card');
