import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createRun, compactContractFavors, activeFavorUses, consumeContractFavor,
  activatePendingContractFavors, creditPassAppliesToChest
} from '../shared/sim.v2-1.js';
import { BUILD_ID, VERSION } from '../shared/protocol.v2-1.js';

assert.equal(VERSION, 'v2.1.219');
assert.equal(BUILD_ID, 'contract_favor_stacking_credit_ui_ru');

// Identical prizes merge into charges and each trigger spends exactly one.
{
  const stacked = compactContractFavors([
    { id: 'credit_pass', uses: 1, used: 0 },
    { id: 'credit_pass', uses: 2, used: 0 }
  ]);
  assert.equal(stacked.length, 1);
  assert.equal(stacked[0].uses, 3);
  const run = createRun(21901);
  run.contractFavorsActive = stacked;
  assert.equal(activeFavorUses(run, ['credit_pass']), 3);
  consumeContractFavor(run, ['credit_pass']);
  assert.equal(activeFavorUses(run, ['credit_pass']), 2);
  consumeContractFavor(run, ['credit_pass']);
  assert.equal(activeFavorUses(run, ['credit_pass']), 1);
}

// CREDIT PASS is reserved for a genuinely paid, safe WPN/ABL choice chest.
{
  const run = createRun(21902);
  run.plan = { modifierIds: [], specialRoomId: '' };
  run.contractFavorsActive = [{ id: 'credit_pass', uses: 2, used: 0 }];
  assert.equal(creditPassAppliesToChest(run, { chest: 'weapon_chest' }), true);
  assert.equal(creditPassAppliesToChest(run, { chest: 'ability_chest' }), true);
  assert.equal(creditPassAppliesToChest(run, { chest: 'basic_chest' }), false);
  assert.equal(creditPassAppliesToChest(run, { chest: 'weapon_chest', devFree: true }), false);
  assert.equal(creditPassAppliesToChest(run, { chest: 'weapon_chest', trojan: true }), false);
  run.plan.modifierIds = ['greed'];
  assert.equal(creditPassAppliesToChest(run, { chest: 'weapon_chest' }), false);
  assert.equal(activeFavorUses(run, ['credit_pass']), 2);
}

// Automatic stacked rewards use one charge per eligible room, never all copies.
{
  const run = createRun(21903);
  run.runDepth = 5;
  run.fx = [];
  run.plan = { category: 'combat', modifierIds: ['blood_tax', 'blackout'] };
  run.contractFavorsActive = [
    { id: 'mod_veto', uses: 2, used: 0, activeDepth: 3 },
    { id: 'salvage_protocol', uses: 2, used: 0, activeDepth: 3 }
  ];
  activatePendingContractFavors(run, new Map());
  assert.equal(run.plan.modifierIds.length, 1);
  assert.equal(activeFavorUses(run, ['mod_veto']), 1);
  assert.equal(run.salvageKillsLeft, 10);
  assert.equal(activeFavorUses(run, ['salvage_protocol']), 1);
}

// Stacked cleansing uses only one charge when a real Static source exists.
{
  const run = createRun(21904);
  run.runDepth = 4;
  run.fx = [];
  run.plan = { category: 'combat', modifierIds: [] };
  run.staticDebt = 3;
  run.contractFavorsActive = [{ id: 'clear_debt', uses: 2, used: 0, activeDepth: 2 }];
  activatePendingContractFavors(run, new Map());
  assert.equal(run.staticDebt, 0);
  assert.equal(activeFavorUses(run, ['clear_debt']), 1);
}

const hud = fs.readFileSync(new URL('../src/hud.v2-1.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../style.css', import.meta.url), 'utf8');
const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
for (const id of ['wpn_clearance','abl_clearance','rar_clearance','mod_veto','credit_pass','salvage_protocol']) {
  assert.match(hud, new RegExp(`${id}: '[^']*[А-Яа-яЁё]`), `${id} needs a Russian UI string`);
}
assert.match(css, /\.contract-free-price s/);
assert.match(hud, /<s>\$\{near\.cost\} \$\{unit\}<\/s>/);
assert.match(hud, /case 'contract_paid'[\s\S]*?compactFavorItems\(f\.favors/);
assert.match(sim, /descRu: 'Следующий платный сундук/);
assert.doesNotMatch(sim, /hasActiveContractFavor\(run, 'double_favor'\)\) pool = pool\.filter/);
assert.match(sim, /i === 0 \|\| f\.id !== 'double_favor'/);

console.log('v2.1.219 checks passed: all contract favors stack by charge, CREDIT PASS is safe, price UI and RU copy are present');
