import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ABILITY_CHEST_REWARDS, CURSED_UPGRADE_IDS, defaultStats } from '../shared/data.v2-1.js';
import { generateRoom } from '../shared/mapgen.v2-1.js';
import {
  continueMultiPickChestOffer,
  makeAbilityChestChoices,
  rareTierTwoChance,
  rollSafeRareUpgrade,
  spendBossKey
} from '../shared/sim.v2-1.js';
import { BUILD_ID, PROTOCOL, VERSION } from '../shared/protocol.v2-1.js';

assert.match(VERSION, /^v2\.1\.(?:18[2-9]|19[0-5])$/);
if (VERSION === 'v2.1.183') assert.equal(BUILD_ID, 'projectile_link_status_r_compat');
assert.ok(PROTOCOL >= 9);

const player = {
  id: 'qa', x: 100, y: 100, hp: 100, baseHp: 100, alive: true,
  stats: defaultStats(), active: { core: 'field_snap', level: 1, mutations: [] },
  weapons: ['pistol'], dashCharges: 1, economy: { money: 999 }
};

// RAR never rolls a cursed upgrade at any quality or loop.
for (let loop = 0; loop < 6; loop++) {
  for (let quality = 0; quality <= 3; quality++) {
    for (let i = 0; i < 200; i++) {
      let state = (i + 1) * 1103515245 + loop * 97 + quality * 17;
      const rng = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 4294967296);
      const reward = rollSafeRareUpgrade(player, rng, quality, loop);
      assert.ok(reward, 'RAR should have a valid reward');
      assert.equal(CURSED_UPGRADE_IDS.includes(reward.id), false, `cursed RAR reward: ${reward.id}`);
    }
  }
}
assert.ok(rareTierTwoChance(3, 5) > rareTierTwoChance(2, 0), 'RAR tier-2 chance must scale upward');

// ABL has no duplicated dash/INSTALL rewards; recovery appears only with 2+ choices.
assert.deepEqual(ABILITY_CHEST_REWARDS.map(x => x.id), ['abl_active_recovery']);
const fixedRng = () => 0;
assert.equal(makeAbilityChestChoices(player, fixedRng, 1, 0).some(x => x.id === 'abl_active_recovery'), false);
assert.equal(makeAbilityChestChoices(player, fixedRng, 2, 0).some(x => x.id === 'abl_active_recovery'), true);

// Boss key skips direct-loot, cursed, Trojan, and Greed chests, then consumes on a real choice chest.
const run = { runDepth: 0, fx: [], plan: { modifierIds: [] } };
player.stats.bossKeys = 1;
player.bossKeyCharges = 1;
player.bossKeyChargeLoop = 0;
for (const chest of ['basic_chest', 'rare_chest', 'cursed_chest']) {
  assert.equal(spendBossKey(run, player, { chest, x: 0, y: 0 }), false);
  assert.equal(player.bossKeyCharges, 1);
}
assert.equal(spendBossKey(run, player, { chest: 'weapon_chest', trojan: 1, x: 0, y: 0 }), false);
assert.equal(player.bossKeyCharges, 1);
run.plan.modifierIds = ['greed'];
assert.equal(spendBossKey(run, player, { chest: 'ability_chest', x: 0, y: 0 }), false);
assert.equal(player.bossKeyCharges, 1);
run.plan.modifierIds = [];
const choiceChest = { chest: 'ability_chest', x: 0, y: 0 };
assert.equal(spendBossKey(run, player, choiceChest), true);
assert.equal(player.bossKeyCharges, 0);
assert.equal(choiceChest.slotCount, 5);
assert.equal(choiceChest.costMul, 0);

// Every chill room contains one clearly boosted BSC.
for (let loop = 0; loop < 6; loop++) {
  for (let seed = 1; seed <= 120; seed++) {
    const room = generateRoom(seed * 7919 + loop, loop * 4, loop, { category: 'chill', specialRoomId: 'chill_room' });
    const boosted = room.interactables.filter(x => x.type === 'chest' && x.chest === 'basic_chest' && x.bscBoost >= 2);
    assert.ok(boosted.length >= 1, `missing boosted BSC: loop=${loop} seed=${seed}`);
  }
}

// Existing one-pick good chest flow remains closed after apply; five-slot offers keep the second pick.
assert.equal(continueMultiPickChestOffer({ slotCount: 3, choices: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] }, 0, 'A'), null);
const twoPick = continueMultiPickChestOffer({ slotCount: 5, choices: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], picksTotal: 2, picksRemaining: 2 }, 0, 'A');
assert.equal(twoPick.picksRemaining, 1);
assert.equal(twoPick.choices.length, 2);

const sim = fs.readFileSync(new URL('../shared/sim.v2-1.js', import.meta.url), 'utf8');
const data = fs.readFileSync(new URL('../shared/data.v2-1.js', import.meta.url), 'utf8');
const en = fs.readFileSync(new URL('../src/i18n.v2-1.js', import.meta.url), 'utf8');
assert.match(sim, /!u\.cursed/);
assert.doesNotMatch(data, /id: 'abl_dash'/);
assert.match(en, /without dealing damage/);
assert.match(en, /без урона/);

console.log('v2.1.182 checks passed: RAR safety/scaling, choice-only boss key, ABL recovery, boosted chill BSC, chest flow, RU/EN');
