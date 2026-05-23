import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANOMALY_ENEMY_KINDS, ENEMIES, ENEMY_WAVES } from '../src/data/enemies.js';
import { WEAPONS, START_WEAPON, WEAPON_IDS } from '../src/data/weapons.js';
import { ROOM_SEQUENCE, RARE_ROOMS, ALL_ROOMS } from '../src/data/rooms.js';
import { ENCOUNTER_PLANS } from '../src/data/encounters.js';
import { ROOM_LAYOUTS, layoutIdentitySnapshot } from '../src/data/layouts.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { INTERACTABLES } from '../src/data/interactables.js';
import { CASINO_MACHINES, CASINO_MACHINE_STATES, casinoMachineStateIsKnown, getCasinoMachine } from '../src/data/casinoMachines.js';
import { CASINO_STAKES } from '../src/data/casinoStakes.js';
import { CASINO_SYMBOLS, casinoSymbolIsKnown } from '../src/data/casinoSymbols.js';
import { CASINO_OUTCOMES, casinoOutcomeActionTypeIsKnown, CASINO_OUTCOME_ACTION_TYPES } from '../src/data/casinoOutcomes.js';
import { CHESTS, CHEST_STATES, chestStateIsKnown, getChest } from '../src/data/chests.js';
import { CHEST_REWARD_TABLES } from '../src/data/chestRewardTables.js';
import { CHEST_OPEN_PRICES, CHEST_VISUALS } from '../src/data/chestEconomy.js';
import { CASINO_REVEAL_PROFILES, CASINO_REVEAL_TIMING, CHEST_REVEAL_PROFILES, chestRevealProfileForTier } from '../src/data/revealAnimations.js';
import { INTERACTABLE_AFFORDANCE_LABELS, INTERACTABLE_AFFORDANCE_RULES, INTERACTABLE_DENIAL_REASONS } from '../src/data/interactableAffordances.js';
import { REWARD_TABLES, rewardEntryIsKnown } from '../src/data/rewardTables.js';
import { REWARD_TYPES, ACTIVE_REWARD_TYPES, RESERVED_REWARD_TYPES, rewardTypeIsKnown } from '../src/data/rewardTypes.js';
import { LOOT } from '../src/data/loot.js';
import { DROP_TABLES, dropTableEntryIsKnown } from '../src/data/dropTables.js';
import { ECONOMY_PICKUP_TYPES, economyPickupTypeIsKnown, xpRequiredForNextLevel } from '../src/data/economy.js';
import { CASINO_BALANCE, CHEST_PRICE_BALANCE, CHEST_REWARD_BALANCE, ECONOMY_BALANCE_SCHEMA_VERSION, ENEMY_DROP_BALANCE, INTERACTABLE_DENSITY_BALANCE, LEVEL_CURVE_BALANCE } from '../src/data/economyBalance.js';
import { ABILITIES, ABILITY_IDS, abilityIsRewardable } from '../src/data/abilities.js';
import { ABILITY_LOOT_TABLES } from '../src/data/abilityLootTables.js';
import { ELITE_VARIANTS } from '../src/data/eliteVariants.js';
import { ARMOR_VARIANTS } from '../src/data/armorVariants.js';
import { EFFECT_DEFS, EFFECT_HOOKS } from '../src/game/effects.js';
import { ENEMY_BEHAVIORS, unknownEnemyBehaviors } from '../src/game/enemyBehaviors.js';
import { ROOM_MODIFIER_HOOKS, ROOM_MODIFIER_COMMAND_TYPES } from '../src/game/roomModifiers.js';
import { DAMAGE_SOURCE_MATRIX } from '../src/game/damageSourceMatrix.js';
import { ENEMY_RENDERERS } from '../src/render/enemyRenderers.js';
import { EFFECT_RENDERERS } from '../src/render/effectRenderers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function assertUnique(ids, label) {
  assert.equal(new Set(ids).size, ids.length, `${label} ids must be unique`);
}

assertUnique(Object.keys(ENEMIES), 'enemy');
assert.deepEqual(unknownEnemyBehaviors(ENEMIES), [], 'all enemy behavior ids must be registered');
for (const [kind, data] of Object.entries(ENEMIES)) {
  assert.ok(ENEMY_BEHAVIORS[data.behavior], `${kind} behavior is not registered: ${data.behavior}`);
  assert.ok(ENEMY_RENDERERS[data.renderStyle || kind], `${kind} renderStyle is not registered: ${data.renderStyle || kind}`);
  assert.ok(Number.isFinite(data.hp) && data.hp > 0, `${kind} needs positive hp`);
  assert.ok(Number.isFinite(data.radius) && data.radius > 0, `${kind} needs positive radius`);
  if (data.armor) assert.ok(Number.isFinite(data.armor.hp) && data.armor.hp > 0, `${kind} armor needs positive hp`);
  assert.ok(DROP_TABLES[data.dropTable], `${kind} references unknown drop table: ${data.dropTable}`);
}
assertUnique(Object.keys(DROP_TABLES), 'drop table');
assert.ok(economyPickupTypeIsKnown(ECONOMY_PICKUP_TYPES.MONEY), 'money pickup type must be registered');
assert.ok(economyPickupTypeIsKnown(ECONOMY_PICKUP_TYPES.XP), 'xp pickup type must be registered');
assert.ok(economyPickupTypeIsKnown(ECONOMY_PICKUP_TYPES.HEAL), 'heal pickup type must be registered');
assert.ok(Number.isFinite(xpRequiredForNextLevel(1)) && xpRequiredForNextLevel(1) > 0, 'economy level curve needs a positive first threshold');
assert.equal(ECONOMY_BALANCE_SCHEMA_VERSION, 1, 'economy balance schema should be explicit for future tuning migrations');
assert.equal(xpRequiredForNextLevel(1), LEVEL_CURVE_BALANCE.baseXp, 'level curve should be data-driven by economyBalance');
assert.ok(LEVEL_CURVE_BALANCE.baseXp >= 28, 'early INSTALL queue pacing should avoid over-fast leveling after chest density increased');
assert.ok(ENEMY_DROP_BALANCE.grunt.moneyChance > 0.4, 'early GLD reliability should support priced BSC exploration chests');
for (const [id, table] of Object.entries(DROP_TABLES)) {
  assert.equal(table.id, id, `drop table key/id mismatch: ${id}`);
  assert.ok(Array.isArray(table.entries) && table.entries.length > 0, `${id} drop table needs entries`);
  for (const entry of table.entries) assert.ok(dropTableEntryIsKnown(entry), `${id} has invalid economy drop entry: ${JSON.stringify(entry)}`);
  assert.ok(table.entries.some((entry) => entry.type === ECONOMY_PICKUP_TYPES.XP), `${id} should include baseline XP drops`);
}

for (const kind of ENEMY_WAVES) assert.ok(ENEMIES[kind], `ENEMY_WAVES references unknown enemy: ${kind}`);
assert.equal(ANOMALY_ENEMY_KINDS.length, 10, 'v39.3.18 anomaly stress pack should expose ten primary enemy kinds');
for (const kind of ANOMALY_ENEMY_KINDS) assert.ok(ENEMIES[kind], `ANOMALY_ENEMY_KINDS references unknown enemy: ${kind}`);

assertUnique(Object.keys(WEAPONS), 'weapon');
assert.ok(WEAPONS[START_WEAPON], 'START_WEAPON must reference a real weapon');
assert.deepEqual(WEAPON_IDS, Object.keys(WEAPONS), 'WEAPON_IDS must mirror WEAPONS keys');
for (const [id, weapon] of Object.entries(WEAPONS)) {
  assert.ok(weapon.name && weapon.projectile, `${id} needs name/projectile`);
  assert.ok(Number.isFinite(weapon.damage) && weapon.damage > 0, `${id} needs positive damage`);
  assert.ok(Number.isFinite(weapon.fireRate) && weapon.fireRate > 0, `${id} needs positive fireRate`);
}

assertUnique(ALL_ROOMS.map((room) => room.id), 'room');
assert.equal(ALL_ROOMS.length, ROOM_SEQUENCE.length + RARE_ROOMS.length, 'ALL_ROOMS must be base + rare rooms');
for (const room of ALL_ROOMS) {
  assert.ok(ROOM_LAYOUTS[room.layout], `${room.id} references unknown layout: ${room.layout}`);
  assert.ok(ENCOUNTER_PLANS[room.encounter], `${room.id} references unknown encounter: ${room.encounter}`);
  for (const modifierId of room.modifiers || []) assert.ok(ROOM_MODIFIERS[modifierId], `${room.id} references unknown modifier: ${modifierId}`);
  for (const slot of room.interactables || []) assert.ok(INTERACTABLES[slot.interactableId], `${room.id} references unknown interactable: ${slot.interactableId}`);
  for (const rule of room.interactableRules || []) assert.ok(INTERACTABLES[rule.interactableId], `${room.id} interactable rule references unknown interactable: ${rule.interactableId}`);
  for (const kind of room.enemyPool || []) assert.ok(ENEMIES[kind], `${room.id} enemyPool references unknown enemy: ${kind}`);
  if (room.boss?.kind) assert.ok(ENEMIES[room.boss.kind], `${room.id} boss references unknown enemy: ${room.boss.kind}`);
}
for (const [id, layout] of Object.entries(ROOM_LAYOUTS)) {
  assert.equal(layout.id, id, `layout key/id mismatch: ${id}`);
  const ident = layoutIdentitySnapshot(id);
  assert.equal(ident.layoutId, id, `${id} identity snapshot mismatch`);
  assert.ok(/^geo:/.test(ident.geometryHash), `${id} needs stable geometry hash`);
  for (const wall of layout.walls || []) assert.equal(wall.shape, 'rect', `${id}/${wall.id} only rect walls are currently supported`);
}

for (const [id, plan] of Object.entries(ENCOUNTER_PLANS)) {
  assert.equal(plan.id, id, `encounter key/id mismatch: ${id}`);
  assert.ok(Array.isArray(plan.stages) && plan.stages.length > 0, `${id} needs stages`);
  for (const stage of plan.stages) {
    for (const kind of stage.enemyPool || []) assert.ok(ENEMIES[kind], `${id}/${stage.id} stage enemyPool references unknown enemy: ${kind}`);
    for (const entry of stage.scriptedSpawns || []) assert.ok(ENEMIES[entry.kind], `${id}/${stage.id} scripted spawn references unknown enemy: ${entry.kind}`);
  }
}

const knownHooks = new Set(Object.values(ROOM_MODIFIER_HOOKS));
const knownCommands = new Set(Object.values(ROOM_MODIFIER_COMMAND_TYPES));
for (const [id, modifier] of Object.entries(ROOM_MODIFIERS)) {
  assert.equal(modifier.id, id, `room modifier key/id mismatch: ${id}`);
  assert.ok(Array.isArray(modifier.tags), `${id} modifier tags must be an array`);
  for (const [hookName, commands] of Object.entries(modifier.hooks || {})) {
    assert.ok(knownHooks.has(hookName), `${id} uses unknown room modifier hook: ${hookName}`);
    assert.ok(Array.isArray(commands), `${id}/${hookName} hook must be a command array`);
    for (const command of commands) assert.ok(knownCommands.has(command.type), `${id}/${hookName} uses unknown command type: ${command.type}`);
  }
}


assertUnique(Object.keys(LOOT), 'loot');
for (const [id, data] of Object.entries(LOOT)) {
  assert.equal(data.name && typeof data.name === 'string', true, `${id} loot needs a name`);
  assert.equal(data.radius > 0, true, `${id} loot needs positive radius`);
}
assert.ok(rewardTypeIsKnown(REWARD_TYPES.LOOT), 'loot reward type must be registered');
assert.ok(ACTIVE_REWARD_TYPES.includes(REWARD_TYPES.LOOT), 'loot reward type must be active');
assert.ok(ACTIVE_REWARD_TYPES.includes(REWARD_TYPES.ABILITY_PICKUP), 'ability pickup reward type must be active');
assert.ok(ACTIVE_REWARD_TYPES.includes(REWARD_TYPES.ABILITY_SHARD), 'ability shard reward type must be active');
assert.ok(ACTIVE_REWARD_TYPES.includes(REWARD_TYPES.NOTHING), 'nothing reward type must be active');
assert.ok(ACTIVE_REWARD_TYPES.includes(REWARD_TYPES.MODIFIER_INJECTION), 'modifier injection reward type must be active for casino risk/debt outcomes');
assert.ok(!RESERVED_REWARD_TYPES.includes(REWARD_TYPES.MODIFIER_INJECTION), 'modifier injection must not be treated as a reserved physical pickup type');
for (const reserved of RESERVED_REWARD_TYPES) assert.ok(rewardTypeIsKnown(reserved), `reserved reward type must stay known: ${reserved}`);


assertUnique(Object.keys(ABILITIES), 'ability');
assert.ok(ABILITIES[ABILITY_IDS.TELEPORT_DASH], 'teleport dash ability must exist for active ability loot foundation');
for (const [id, ability] of Object.entries(ABILITIES)) {
  assert.equal(ability.id, id, `ability key/id mismatch: ${id}`);
  assert.ok(ability.name && ability.slot, `${id} ability needs name/slot`);
  assert.ok(Array.isArray(ability.tags), `${id} ability tags must be an array`);
  assert.equal(typeof ability.rewardable, 'boolean', `${id} ability must declare rewardable contract`);
  if (ability.rewardable) assert.ok(abilityIsRewardable(id), `${id} rewardable ability should be discoverable`);
}
assertUnique(Object.keys(ABILITY_LOOT_TABLES), 'ability loot table');
for (const [id, table] of Object.entries(ABILITY_LOOT_TABLES)) {
  assert.equal(table.id, id, `ability loot table key/id mismatch: ${id}`);
  assert.ok(Array.isArray(table.entries) && table.entries.length > 0, `${id} ability loot table needs entries`);
  for (const entry of table.entries) {
    assert.ok(entry.type === REWARD_TYPES.ABILITY_PICKUP || entry.type === REWARD_TYPES.ABILITY_SHARD, `${id} ability loot table must only contain ability reward entries`);
    assert.ok(abilityIsRewardable(entry.abilityId), `${id} references unknown/unrewardable ability: ${entry.abilityId}`);
    assert.ok(Number.isFinite(entry.weight) && entry.weight > 0, `${id} ability loot entry needs positive weight`);
  }
}


assertUnique(Object.keys(CHESTS), 'chest');
assert.ok(chestStateIsKnown(CHEST_STATES.CLOSED), 'closed chest state must be registered');
assert.ok(chestStateIsKnown(CHEST_STATES.OPENING), 'opening chest state must be registered');
assert.ok(chestStateIsKnown(CHEST_STATES.OPENED), 'opened chest state must be registered');
assert.ok(chestStateIsKnown(CHEST_STATES.CLAIMED), 'claimed chest state must be registered');
for (const [id, chest] of Object.entries(CHESTS)) {
  assert.equal(chest.id, id, `chest key/id mismatch: ${id}`);
  assert.ok(chest.name && chest.tier, `${id} chest needs name/tier`);
  assert.ok(Number.isFinite(chest.radius) && chest.radius > 0, `${id} chest needs positive radius`);
  assert.ok(Number.isFinite(chest.interactRadius) && chest.interactRadius >= chest.radius, `${id} chest needs valid interact radius`);
  assert.ok(CHEST_REWARD_TABLES[chest.rewardTable], `${id} chest references unknown chest reward table: ${chest.rewardTable}`);
  assert.ok(chest.visual?.renderer === 'chest', `${id} chest must use the chest renderer identity`);
  assert.ok(CHEST_VISUALS[id]?.code && chest.visual?.glyph === CHEST_VISUALS[id].code, `${id} must use simple rarity code visual identity`);
  assert.ok(CHEST_OPEN_PRICES[id]?.base > 0, `${id} must have a priced opening contract`);
  assert.deepEqual(CHEST_OPEN_PRICES[id], CHEST_PRICE_BALANCE[id], `${id} price should be sourced from economyBalance`);
  const revealProfile = chestRevealProfileForTier(chest.tier);
  assert.ok(revealProfile && Number.isFinite(revealProfile.openingTime) && revealProfile.openingTime > 0, `${id} must have a data-driven dopamine reveal profile`);
  assert.ok(Number.isFinite(revealProfile.popDistance) && revealProfile.popDistance >= 16, `${id} reveal profile must own reward pop distance`);
  assert.ok(Array.isArray(chest.tags) && chest.tags.includes('chest'), `${id} chest needs chest tag`);
  assert.ok(INTERACTABLES[id], `${id} chest must be exposed as an interactable`);
}
assertUnique(Object.keys(CHEST_REWARD_TABLES), 'chest reward table');
assert.ok(CHEST_OPEN_PRICES.basic_chest.base < CHEST_OPEN_PRICES.weapon_chest.base, 'BSC should stay cheaper than WPN');
assert.ok(CHEST_OPEN_PRICES.weapon_chest.base < CHEST_OPEN_PRICES.ability_chest.base, 'WPN should stay cheaper than ABL');
assert.ok(CHEST_OPEN_PRICES.ability_chest.base < CHEST_OPEN_PRICES.rare_chest.base, 'ABL should stay cheaper than RAR');
assert.ok(CHEST_OPEN_PRICES.rare_chest.base < CHEST_OPEN_PRICES.cursed_chest.base, 'RAR should stay cheaper than CRS risk chest');
assert.ok(CHEST_REWARD_BALANCE.rare.guaranteedMoney[0] > CHEST_REWARD_BALANCE.basic.moneyAmount[1], 'RAR should keep a stronger guaranteed GLD floor than BSC');
assert.ok(CHEST_REWARD_BALANCE.cursed.guaranteedMoney[0] > CHEST_REWARD_BALANCE.rare.guaranteedMoney[0], 'CRS should keep strong compensation for its guaranteed debt');

assertUnique(Object.keys(CASINO_SYMBOLS), 'casino symbol');
for (const [id, symbol] of Object.entries(CASINO_SYMBOLS)) {
  assert.equal(symbol.id, id, `casino symbol key/id mismatch: ${id}`);
  assert.ok(symbol.label && symbol.glyph && symbol.accent, `${id} casino symbol needs label/glyph/accent`);
  assert.ok(Number.isFinite(symbol.weight) && symbol.weight > 0, `${id} casino symbol needs positive weight`);
}
assertUnique(Object.keys(CHEST_REVEAL_PROFILES), 'chest reveal profile');
assertUnique(Object.keys(CASINO_REVEAL_PROFILES), 'casino reveal profile');
assert.ok(CASINO_REVEAL_TIMING.reelStepMs >= 180, 'casino reveal timing should keep sequential reel suspense readable');
assert.ok(EFFECT_RENDERERS.rewardRevealPulse, 'dopamine reveal pulse effect renderer must be registered');
assert.equal(INTERACTABLE_AFFORDANCE_LABELS.noMoney, 'NO GLD', 'interactable affordance labels must keep the missing-money prompt readable');
assert.equal(INTERACTABLE_DENIAL_REASONS.NOT_ENOUGH_MONEY, 'not_enough_money', 'interactable denial reasons must match host economy rejection reason');
assert.ok(INTERACTABLE_AFFORDANCE_RULES.previewRangeMultiplier >= 2, 'interactable affordance preview range must support readable local prompts before exact E range');

assertUnique(Object.keys(CASINO_STAKES), 'casino stake');
assert.ok(CASINO_STAKES.low.cost === CASINO_BALANCE.low.cost && CASINO_STAKES.mid.cost === CASINO_BALANCE.mid.cost && CASINO_STAKES.high.cost === CASINO_BALANCE.high.cost, 'casino stake costs should be sourced from economyBalance');
assert.ok(CASINO_STAKES.low.cost < CASINO_STAKES.mid.cost && CASINO_STAKES.mid.cost < CASINO_STAKES.high.cost, 'casino stake costs should scale by risk tier');
assert.ok(CASINO_BALANCE.high.payouts.jackpotMoney > CASINO_BALANCE.mid.payouts.jackpotMoney && CASINO_BALANCE.mid.payouts.jackpotMoney > CASINO_BALANCE.low.payouts.jackpotMoney, 'casino jackpot payouts should scale by stake tier');
assert.ok(INTERACTABLE_DENSITY_BALANCE.normal.chances.basicPrimary >= 0.8, 'normal rooms should remain exploration-heavy with frequent BSC opportunities');
assert.ok(INTERACTABLE_DENSITY_BALANCE.normal.chances.cursed < INTERACTABLE_DENSITY_BALANCE.normal.chances.basicPrimary, 'CRS should stay rarer than BSC in normal rooms');
for (const [id, stake] of Object.entries(CASINO_STAKES)) {
  assert.equal(stake.id, id, `casino stake key/id mismatch: ${id}`);
  assert.ok(stake.name && Number.isFinite(stake.cost) && stake.cost > 0, `${id} casino stake needs name and positive money cost`);
  assert.ok(Number.isFinite(stake.reels) && stake.reels === 3, `${id} casino stake foundation should use three reels`);
  assert.ok(Number.isFinite(stake.matchChance) && stake.matchChance > 0 && stake.matchChance < 1, `${id} casino stake needs a bounded matchChance for outcome pacing`);
  assert.ok(stake.symbolWeights && typeof stake.symbolWeights === 'object', `${id} casino stake needs symbolWeights for stake identity`);
}
assertUnique(Object.keys(CASINO_OUTCOMES), 'casino outcome stake group');
for (const [stakeId, outcomes] of Object.entries(CASINO_OUTCOMES)) {
  assert.ok(CASINO_STAKES[stakeId], `casino outcomes reference unknown stake: ${stakeId}`);
  for (const symbolId of Object.keys(CASINO_SYMBOLS)) {
    const outcome = outcomes[symbolId];
    assert.ok(outcome, `${stakeId} casino outcomes must define result for symbol ${symbolId}`);
    assert.ok(outcome.id && outcome.label && outcome.payoutText, `${stakeId}/${symbolId} casino outcome needs id/label/payoutText`);
    assert.ok(Array.isArray(outcome.actions) && outcome.actions.length >= 1, `${stakeId}/${symbolId} casino outcome must have reward actions`);
    for (const action of outcome.actions) {
      assert.ok(casinoOutcomeActionTypeIsKnown(action.type), `${stakeId}/${symbolId} has unknown casino outcome action: ${JSON.stringify(action)}`);
      if (action.type === CASINO_OUTCOME_ACTION_TYPES.MONEY || action.type === CASINO_OUTCOME_ACTION_TYPES.XP) {
        assert.ok(Number.isFinite(action.amount) && action.amount > 0, `${stakeId}/${symbolId} economy action needs positive amount`);
      }
      if (action.type === CASINO_OUTCOME_ACTION_TYPES.REWARD) {
        assert.ok(rewardEntryIsKnown(action.reward), `${stakeId}/${symbolId} reward action has invalid reward: ${JSON.stringify(action.reward)}`);
      }
      if (action.type === CASINO_OUTCOME_ACTION_TYPES.MODIFIER_INJECTION) {
        assert.ok(action.modifierId && rewardEntryIsKnown({ type: REWARD_TYPES.MODIFIER_INJECTION, modifierId: action.modifierId }), `${stakeId}/${symbolId} modifier action has invalid modifier`);
      }
    }
  }
}
assertUnique(Object.keys(CASINO_MACHINES), 'casino machine');
assert.ok(casinoMachineStateIsKnown(CASINO_MACHINE_STATES.IDLE), 'casino idle state must be registered');
assert.ok(casinoMachineStateIsKnown(CASINO_MACHINE_STATES.SPINNING), 'casino spinning state must be registered');
assert.ok(casinoMachineStateIsKnown(CASINO_MACHINE_STATES.RESOLVED), 'casino resolved state must be registered');
for (const [id, machine] of Object.entries(CASINO_MACHINES)) {
  assert.equal(machine.id, id, `casino machine key/id mismatch: ${id}`);
  assert.ok(machine.name && machine.visual?.renderer === 'slot_machine', `${id} casino machine needs slot-machine visual identity`);
  assert.ok(Array.isArray(machine.allowedStakes) && machine.allowedStakes.length >= 3, `${id} casino machine needs stake tiers`);
  for (const stakeId of machine.allowedStakes) assert.ok(CASINO_STAKES[stakeId], `${id} references unknown casino stake: ${stakeId}`);
  assert.ok(Array.isArray(machine.symbolPool) && machine.symbolPool.length >= 3, `${id} casino machine needs reel symbol pool`);
  for (const symbolId of machine.symbolPool) assert.ok(casinoSymbolIsKnown(symbolId), `${id} references unknown casino symbol: ${symbolId}`);
}

assertUnique(Object.keys(REWARD_TABLES), 'reward table');
for (const [id, table] of Object.entries(REWARD_TABLES)) {
  assert.equal(table.id, id, `reward table key/id mismatch: ${id}`);
  assert.ok(Array.isArray(table.entries) && table.entries.length > 0, `${id} reward table needs entries`);
  assert.ok(Number.isFinite(table.rolls) && table.rolls >= 1, `${id} reward table needs positive rolls`);
  for (const entry of table.guaranteedEntries || []) {
    assert.ok(rewardEntryIsKnown(entry), `${id} guaranteed reward table entry is unknown: ${JSON.stringify(entry)}`);
    if (Number.isFinite(entry.weight)) assert.ok(entry.weight > 0, `${id} guaranteed reward weight must be positive when present`);
  }
  for (const entry of table.entries) {
    assert.ok(rewardEntryIsKnown(entry), `${id} reward table has unknown reward entry: ${JSON.stringify(entry)}`);
    assert.ok(Number.isFinite(entry.weight) && entry.weight > 0, `${id} reward entry needs positive weight`);
  }
}
assertUnique(Object.keys(INTERACTABLES), 'interactable');
for (const [id, data] of Object.entries(INTERACTABLES)) {
  assert.equal(data.id, id, `interactable key/id mismatch: ${id}`);
  assert.ok(data.name && data.category, `${id} interactable needs name/category`);
  assert.ok(Number.isFinite(data.radius) && data.radius > 0, `${id} interactable needs positive radius`);
  assert.ok(Number.isFinite(data.interactRadius) && data.interactRadius >= data.radius, `${id} interactable needs valid interact radius`);
  assert.equal(typeof data.autoOpen, 'boolean', `${id} interactable must declare explicit autoOpen contract`);
  assert.ok(Number.isFinite(data.minSpawnDistance) && data.minSpawnDistance >= 0, `${id} interactable needs non-negative spawn clearance`);
  assert.ok(REWARD_TABLES[data.rewardTable], `${id} interactable references unknown reward table: ${data.rewardTable}`);
  if (data.chestId) {
    assert.ok(getChest(data.chestId), `${id} references unknown chestId: ${data.chestId}`);
    assert.equal(data.category, 'chest', `${id} chest interactable must use chest category`);
    assert.equal(data.autoOpen, false, `${id} chest interactable must not auto-open`);
  }
  if (data.casinoMachineId) {
    assert.ok(getCasinoMachine(data.casinoMachineId), `${id} references unknown casinoMachineId: ${data.casinoMachineId}`);
    assert.equal(data.category, 'casino', `${id} casino interactable must use casino category`);
    assert.equal(data.autoOpen, false, `${id} casino interactable must not auto-open`);
  }
}

const chestRendererSrc = read('src/render/chestRenderers.js');
assert.match(chestRendererSrc, /drawChestInteractable/, 'chest renderer registry must export drawChestInteractable');
assert.match(chestRendererSrc, /compactPrompt/, 'v39.3.17a chest renderer should use a compact one-line affordance prompt');
assert.match(chestRendererSrc, /`E \/ \${cost}`/, 'v39.3.19 visual clarity chest prompt should render close-range E / price text');
assert.match(chestRendererSrc, /s\.y - r - 8/, 'v39.3.19 visual clarity chest label should live above the square, not inside it');
assert.match(chestRendererSrc, /deniedPromptJitter/, 'v39.3.19 visual clarity unaffordable chest prompt should shake/redline locally');
for (const noisyChestLabel of ['"PAY"', '"SCAN"', '"REVEAL"', '"OPEN"', '"---"']) {
  assert.ok(!chestRendererSrc.includes(noisyChestLabel), `v39.3.17a chest renderer should not draw noisy world label ${noisyChestLabel}`);
}
const rendererSrc = read('src/renderer.js');
assert.match(rendererSrc, /drawChestInteractable\(ctx, item, cam, affordance\)/, 'main renderer must route chest interactables through chest renderer with local affordance context');
assert.match(rendererSrc, /drawCasinoInteractable\(ctx, item, cam, affordance\)/, 'main renderer must route casino interactables through casino renderer with local affordance context');
assert.match(read('src/game/interactables.js'), /if \(interactable\.chestId\) continue;/, 'opened chests should remain as inactive room objects instead of despawning');
const chestGameSrc = read('src/game/chests.js');
assert.ok(!chestGameSrc.includes('DEFAULT_DESPAWN_TIMER'), 'v39.3.19b opened chests should not use a despawn timer');
assert.ok(!/chestState\s*=\s*CHEST_STATES\.CLAIMED/.test(chestGameSrc), 'v39.3.19b opened chests should stay as inactive opened objects, not transition to claimed/despawn state');

const pickupRendererSrc = rendererSrc;
assert.match(pickupRendererSrc, /function drawPickupToken/, 'shared pickup token renderer must keep one unified pickup token shape');
assert.match(pickupRendererSrc, /function drawPickupSourcePulse/, 'v39.3.19b chest/casino source drops should use extra radius pulse around simple pickup tokens');
assert.match(pickupRendererSrc, /function sourcePulseLevel/, 'v39.3.19b pickup source pulses should be data-driven by revealSource/revealProfile');
assert.match(pickupRendererSrc, /s\.y - r - 5/, 'v39.3.19 visual clarity pickup token labels should render above squares, not inside them');
assert.ok(!/fillText\(String\(label \|\| "DRP"\)[\s\S]*s\.y \+ 4/.test(pickupRendererSrc), 'pickup token labels must not return inside the square');
assert.match(pickupRendererSrc, /function drawEconomyPickup[\s\S]*drawPickupToken/, 'economy pickups must use the shared pickup token renderer');
assert.match(pickupRendererSrc, /function drawRewardPickup[\s\S]*drawPickupToken/, 'reward pickups must use the shared pickup token renderer');
assert.match(pickupRendererSrc, /rewardType === "ability_pickup"[\s\S]*return "ABL"/, 'ability reward pickups should render as compact ABL tokens, not verbose ability names');
assert.ok(!pickupRendererSrc.includes('const sourceLabel ='), 'reward pickup renderer must not add separate WIN/RAR/CRS source captions under pickups');
assert.ok(!pickupRendererSrc.includes('replace(" SHARD"'), 'reward pickup renderer must not render verbose DASH SHARD labels in-world');
const effectRendererSrc = read('src/render/effectRenderers.js');
const revealPulseBlock = effectRendererSrc.slice(effectRendererSrc.indexOf('function drawRewardRevealPulse'), effectRendererSrc.indexOf('function drawArmorPulse'));
assert.ok(!revealPulseBlock.includes('drawText'), 'v39.3.19b reveal pulses should be ring-only and should not draw extra world text');
assert.ok(effectRendererSrc.includes('frontWave: drawFrontWave'), 'v39.3.19c PLS forward-wave effect renderer must be registered');
assert.match(read('src/game/rewardCommands.js'), /suppressSpawnRewardText[\s\S]*sourceType === "chest"[\s\S]*sourceType === "casino"/, 'v39.3.19b chest/casino reward spawns should not add extra damageText captions over simple tokens');


const enemyRendererSrc = read('src/render/enemyRenderers.js');
assert.match(enemyRendererSrc, /drawCodeSquare[\s\S]*s\.y - r - 7[\s\S]*hollowSquare/, 'anomaly enemy labels should render above simple square bodies');
assert.ok(!enemyRendererSrc.includes('drawText(ctx, "NUL"'), 'NUL world label should be retired in favor of GLT');
assert.ok(enemyRendererSrc.includes('drawText(ctx, "GLT"'), 'GLT world label should be active for the glitch retune');
assert.ok(enemyRendererSrc.includes('drawText(ctx, "ECH"'), 'echo visual label should render ECH above the negative clone square');
assert.ok(ENEMIES.echo && !ANOMALY_ENEMY_KINDS.includes('mirror'), 'MRR/mirror should be retired from the primary anomaly list in favor of ECH/echo');
assert.ok(ENEMIES.glitch && !ANOMALY_ENEMY_KINDS.includes('nullifier'), 'NUL/nullifier should be retired from the primary anomaly list in favor of GLT/glitch');

const eliteRendererSrc = read('src/render/eliteRenderers.js');
for (const [id, variant] of Object.entries(ELITE_VARIANTS)) {
  assert.equal(variant.id, id, `elite variant key/id mismatch: ${id}`);
  assert.ok(Array.isArray(variant.allowedKinds), `${id} elite allowedKinds must be an array`);
  for (const kind of [...(variant.allowedKinds || []), ...(variant.excludedKinds || [])]) assert.ok(ENEMIES[kind], `${id} elite references unknown enemy: ${kind}`);
  const renderer = variant.visual?.renderer;
  if (renderer) assert.ok(eliteRendererSrc.includes(`${renderer}:`) || eliteRendererSrc.includes(`${renderer}`), `${id} elite renderer is not registered: ${renderer}`);
}

const armorRendererSrc = read('src/render/armorVariantRenderers.js');
for (const [id, variant] of Object.entries(ARMOR_VARIANTS)) {
  assert.equal(variant.id, id, `armor variant key/id mismatch: ${id}`);
  for (const kind of [...(variant.allowedKinds || []), ...(variant.excludedKinds || []), ...(variant.link?.candidateKinds || []), ...(variant.link?.excludedKinds || [])]) assert.ok(ENEMIES[kind], `${id} armor variant references unknown enemy: ${kind}`);
  const renderer = variant.visual?.renderer;
  const linkRenderer = variant.visual?.linkRenderer;
  if (renderer) assert.ok(armorRendererSrc.includes(`${renderer}:`) || armorRendererSrc.includes(`${renderer}`), `${id} armor renderer is not registered: ${renderer}`);
  if (linkRenderer) assert.ok(armorRendererSrc.includes(`${linkRenderer}:`) || armorRendererSrc.includes(`${linkRenderer}`), `${id} armor link renderer is not registered: ${linkRenderer}`);
}

const effectHooks = new Set(Object.values(EFFECT_HOOKS));
for (const [type, def] of Object.entries(EFFECT_DEFS)) {
  assert.ok(Array.isArray(def.hooks) && def.hooks.length > 0, `${type} effect needs hooks`);
  for (const hook of def.hooks) assert.ok(effectHooks.has(hook), `${type} effect uses unknown hook: ${hook}`);
}
for (const requiredVisual of ['spark', 'portal', 'damageText', 'armorHit', 'armorBreak', 'armorLinkBlock', 'elitePulse', 'explosion']) {
  assert.ok(EFFECT_RENDERERS[requiredVisual], `required effect renderer missing: ${requiredVisual}`);
}
for (const [id, policy] of Object.entries(DAMAGE_SOURCE_MATRIX)) {
  assert.ok(Array.isArray(policy.tags), `${id} damage source policy needs tags`);
  assert.equal(typeof policy.armor, 'boolean', `${id} damage source armor policy must be boolean`);
  assert.equal(typeof policy.lifesteal, 'boolean', `${id} damage source lifesteal policy must be boolean`);
}

console.log(`universal content registry verification passed (${Object.keys(ENEMIES).length} enemies, ${Object.keys(ROOM_MODIFIERS).length} modifiers, ${Object.keys(ROOM_LAYOUTS).length} layouts)`);
