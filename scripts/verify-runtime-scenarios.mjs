import assert from 'node:assert/strict';
import { createGameState, addPlayer } from '../src/game/state.js';
import { spawnEnemy, updateEnemies } from '../src/game/enemies.js';
import { beginRoomTransition } from '../src/game/roomFlow.js';
import { getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';
import { finishEnemyKill } from '../src/game/enemyDeath.js';
import { updateProjectiles, makeProjectile } from '../src/game/projectiles.js';
import { dealDamage, dealPlayerDamage, healProjectileOwner } from '../src/game/effects.js';
import { updateEnemyArmorVariantRuntime } from '../src/game/enemyArmorVariants.js';
import { runEnemyEliteDeath } from '../src/game/enemyElites.js';
import { runRoomModifierHooksForLocation, ROOM_MODIFIER_HOOKS } from '../src/game/roomModifiers.js';
import { ROOM_MODIFIERS, ROOM_MODIFIER_IDS } from '../src/data/roomModifiers.js';
import { requestInteractableActivation, updateInteractables } from '../src/game/interactables.js';
import { applyCasinoOutcome, requestCasinoSpin } from '../src/game/casino.js';
import { spawnRewardPickup, updateRewardPickups } from '../src/game/rewardPickups.js';
import { spawnEconomyPickup, updateEconomyPickups } from '../src/game/economyPickups.js';
import { resolveEconomyDropHook, ECONOMY_DROP_PROC_TYPES } from '../src/game/economyDropHooks.js';
import { economySnapshot, grantXp } from '../src/game/playerEconomy.js';
import { executeReward } from '../src/game/rewardResolver.js';
import { applyUpgrade, chooseUpgrade, offerUpgradeChoices, offerQueuedUpgradeChoice } from '../src/game/upgrades.js';
import { resolveRoomModifierStack } from '../src/game/modifierStack.js';
import { ABILITY_IDS } from '../src/data/abilities.js';
import { ANOMALY_ENEMY_KINDS } from '../src/data/enemies.js';
import { REWARD_TYPES } from '../src/data/rewardTypes.js';
import { ECONOMY_PICKUP_DELIVERY, ECONOMY_PICKUP_RECIPIENT_RULES, ECONOMY_PICKUP_TYPES, UPGRADE_OFFER_SOURCES } from '../src/data/economy.js';
import { getCasinoMachine } from '../src/data/casinoMachines.js';
import { REWARD_SOURCE_IDS } from '../src/data/rewardSources.js';
import { CASINO_STAKE_IDS, getCasinoStake } from '../src/data/casinoStakes.js';
import { CASINO_SYMBOL_IDS } from '../src/data/casinoSymbols.js';
import { CHEST_IDS, CHEST_STATES } from '../src/data/chests.js';
import { dashConfig, performDash, tickActiveAbilities } from '../src/game/abilities.js';
import { updateCompanions } from '../src/game/companions.js';
import { grantAbility, hasAbility, ensureAbilityInventory } from '../src/game/abilityInventory.js';
import { buildPlayerStatSnapshot, STAT_SNAPSHOT_SCHEMA_VERSION } from '../src/game/statSnapshots.js';
import { makeSnapshot } from '../src/game/state.js';
import { buildRewardEventFeedItem } from '../src/rewardEventFeed.js';
import {
  PROJECTILE_DAMAGE_SOURCES,
  projectileDamageTags,
  statusDamageTags,
  companionDamageTags,
  hostileProjectileDamageTags,
  eliteDeathPulseDamageTags,
  canDamageSourceHitArmor,
  canDamageSourceLifesteal
} from '../src/game/damageSourceMatrix.js';

function fresh(seed = 'UNIVERSAL-RUNTIME') {
  const state = createGameState(seed);
  const player = addPlayer(state, 'p1', 0);
  player.x = 500;
  player.y = 500;
  player.hp = 50;
  player.maxHp = 100;
  state.spawnTimer = 9999;
  return { state, player };
}

function assertDamagePolicy() {
  assert.equal(canDamageSourceHitArmor(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT)), true, 'direct projectile should hit armor');
  assert.equal(canDamageSourceHitArmor(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.EXPLOSION)), true, 'explosion projectile should hit armor');
  assert.equal(canDamageSourceHitArmor(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.CHAIN)), true, 'chain projectile should hit armor');
  assert.equal(canDamageSourceHitArmor(statusDamageTags('burn')), false, 'status should bypass armor');
  assert.equal(canDamageSourceHitArmor(companionDamageTags('drone')), true, 'companion direct should hit armor');
  assert.equal(canDamageSourceHitArmor(hostileProjectileDamageTags()), false, 'hostile projectile should not hit enemy armor');
  assert.equal(canDamageSourceLifesteal(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT)), true, 'direct projectile can lifesteal');
  assert.equal(canDamageSourceLifesteal(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.EXPLOSION)), true, 'explosion can lifesteal');
  assert.equal(canDamageSourceLifesteal(projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.CHAIN)), true, 'chain can lifesteal');
  assert.equal(canDamageSourceLifesteal(statusDamageTags('poison')), false, 'status cannot lifesteal');
  assert.equal(canDamageSourceLifesteal(companionDamageTags('orbital')), false, 'companion cannot lifesteal');
}

function assertDamageScenarios() {
  const { state, player } = fresh('DAMAGE-SCENARIOS');
  const target = { hp: 30 };
  let hit = dealDamage(state, target, { amount: 7, sourceId: player.id, tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT) });
  assert.equal(hit.done, 7, 'direct damage should reduce hp');
  assert.equal(target.hp, 23);

  hit = dealDamage(state, target, { amount: 5, sourceId: player.id, tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.EXPLOSION) });
  assert.equal(hit.done, 5, 'explosion damage should reduce hp');
  hit = dealDamage(state, target, { amount: 4, sourceId: player.id, tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.CHAIN) });
  assert.equal(hit.done, 4, 'chain damage should reduce hp');

  const tank = spawnEnemy(state, 'tank', player.x + 140, player.y, { eliteVariantId: null, armorVariantId: null });
  const armorBefore = tank.armor.hp;
  hit = dealDamage(state, tank, { amount: 9, sourceId: player.id, tags: statusDamageTags('burn') });
  assert.equal(hit.armorHit, undefined, 'status damage should bypass armor pipeline');
  assert.equal(tank.armor.hp, armorBefore, 'status damage should not reduce armor');
  assert.ok(tank.hp < tank.maxHp, 'status damage should reduce hp under armor');

  hit = dealDamage(state, tank, { amount: 999, sourceId: player.id, tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT) });
  assert.equal(hit.armorHit, true, 'projectile damage should hit armor');
  assert.equal(hit.armorBroken, true, 'large projectile hit should break armor');
}

function assertLinkedArmorScenario() {
  const { state, player } = fresh('LINKED-ARMOR-SCENARIO');
  for (let i = 0; i < 8; i += 1) beginRoomTransition(state, 'verify-runtime', { offerUpgrades: false });
  const linkA = spawnEnemy(state, 'grunt', player.x + 100, player.y, { eliteVariantId: null });
  const linkB = spawnEnemy(state, 'runner', player.x + 140, player.y + 10, { eliteVariantId: null });
  const tank = spawnEnemy(state, 'tank', player.x + 130, player.y, { eliteVariantId: null, armorVariantId: 'linked' });
  updateEnemyArmorVariantRuntime(state, tank, 999);
  assert.equal(tank.armor.variant?.protected, true, 'linked armor should become protected around live links');
  const guarded = dealDamage(state, tank, { amount: 999, sourceId: player.id, tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT) });
  assert.equal(guarded.armorVariantBlocked, true, 'linked armor should block full armor break while links live');
  assert.equal(tank.armor.broken, false, 'protected linked armor should not fully break');
  finishEnemyKill(state, linkA, { ownerId: player.id, weaponId: 'test' }, { sourceId: player.id });
  finishEnemyKill(state, linkB, { ownerId: player.id, weaponId: 'test' }, { sourceId: player.id });
  updateEnemyArmorVariantRuntime(state, tank, 999);
  assert.equal(tank.armor.variant.protected, false, 'linked armor protection should clear after links die');
  const broken = dealDamage(state, tank, { amount: 999, sourceId: player.id, tags: projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT) });
  assert.equal(broken.armorBroken, true, 'linked armor should break after links are gone');
}

function assertEliteScenario() {
  const { state, player } = fresh('ELITE-SCENARIO');
  const elite = spawnEnemy(state, 'grunt', player.x + 20, player.y, { eliteVariantId: 'overcharged' });
  assert.equal(elite.elite?.id, 'overcharged', 'forced elite should apply overcharged variant');
  const before = player.hp;
  const result = runEnemyEliteDeath(state, elite, { sourceId: player.id }, null);
  assert.equal(result.variantId, 'overcharged');
  assert.ok(player.hp < before, 'elite death pulse should damage nearby player through player damage pipeline');
  assert.ok(state.effects.some((fx) => fx.type === 'elitePulse'), 'elite death pulse should emit visual effect');
  assert.deepEqual(eliteDeathPulseDamageTags('overcharged'), ['enemy', 'elite', 'pulse', 'overcharged']);
}

function assertLifestealScenario() {
  const { state, player } = fresh('LIFESTEAL-SCENARIO');
  player.hp = 20;
  const projectile = { ownerId: player.id, effects: [{ type: 'lifesteal', percent: 0.25 }] };
  const healed = healProjectileOwner(state, projectile, 40, projectileDamageTags(PROJECTILE_DAMAGE_SOURCES.DIRECT));
  assert.equal(healed, 10, 'eligible direct projectile lifesteal should heal owner');
  const afterDirect = player.hp;
  const statusHeal = healProjectileOwner(state, projectile, 40, statusDamageTags('burn'));
  assert.equal(statusHeal, 0, 'status damage should not trigger lifesteal');
  assert.equal(player.hp, afterDirect, 'status lifesteal denial should not change hp');
}

function assertPlayerDamageScenario() {
  const { state, player } = fresh('PLAYER-DAMAGE-SCENARIO');
  const hit = dealPlayerDamage(state, player, { amount: 12, sourceId: 'enemy-test', sourceType: 'touch', tags: hostileProjectileDamageTags() });
  assert.equal(hit.done, 12, 'player damage should go through dealPlayerDamage/dealDamage pipeline');
  assert.equal(player.hp, 38);
}

function assertTransitionCleanupScenario() {
  const { state, player } = fresh('TRANSITION-CLEANUP-SCENARIO');
  spawnEnemy(state, 'grunt', player.x + 100, player.y, { eliteVariantId: null });
  state.projectiles.test = { id: 'test', ownerId: player.id, weaponId: 'shotgun', kind: 'bullet', x: player.x, y: player.y, vx: 1, vy: 0, radius: 4 };
  state.loot.test = { id: 'test', kind: 'heal', x: player.x, y: player.y };
  state.rewardPickups.test = { id: 'test', rewardType: 'loot', kind: 'heal', x: player.x, y: player.y, radius: 10, claimRadius: 15, active: true };
  state.economyPickups.test = { id: 'test', type: 'money', amount: 1, x: player.x, y: player.y, radius: 7, claimRadius: 14, active: true };
  state.interactables.test = { id: 'test', kind: 'field_cache', x: player.x, y: player.y, radius: 18, interactRadius: 38 };
  state.effects.push({ type: 'spark', x: player.x, y: player.y, life: 1, maxLife: 1 });
  state.companions.test = { id: 'test', ownerId: player.id, kind: 'drone' };
  const beforeDepth = state.runDepth;
  beginRoomTransition(state, 'verify-cleanup', { offerUpgrades: false });
  assert.equal(state.runDepth, beforeDepth + 1, 'room transition should advance runDepth');
  assert.equal(Object.keys(state.enemies).length, 0, 'transition should clear enemies');
  assert.equal(Object.keys(state.projectiles).length, 0, 'transition should clear projectiles');
  assert.equal(Object.keys(state.loot).length, 0, 'transition should clear loot');
  assert.equal(Object.keys(state.rewardPickups).length, 0, 'transition should clear reward pickups');
  assert.equal(Object.keys(state.economyPickups).length, 0, 'transition should clear economy pickups');
  assert.equal(Object.values(state.interactables).some((item) => item.id === 'test'), false, 'transition should clear old interactables');
  assert.equal(Object.keys(state.companions).length, 0, 'transition should clear live companions before recreation');
  assert.ok(Object.keys(state.portals).length > 0, 'transition should create the next portal');
  assert.equal(player.hp > 0, true, 'transition should keep/revive player through official heal path');
}

function assertInteractableScenario() {
  const state = createGameState('INTERACTABLE-SCENARIO');
  const player = addPlayer(state, 'p1', 0);
  for (let i = 0; i < 4; i += 1) beginRoomTransition(state, 'verify-interactable', { offerUpgrades: false });
  assert.equal(state.roomPlan.resolvedRoomId, 'reward-cache-00', 'first reward room should still resolve through roomPlan');
  assert.equal(state.roomPlan.interactablePlan.length, 4, 'reward cache room should carry the priced reward spread');
  assert.equal(Object.keys(state.interactables).length, 4, 'entering reward cache should spawn its priced interactables from the plan');
  const chest = Object.values(state.interactables).find((item) => item.kind === CHEST_IDS.RARE);
  assert.ok(chest, 'reward room interactable should include a rare chest');
  assert.equal(chest.kind, CHEST_IDS.RARE, 'reward room interactable should use real rare chest data');
  assert.equal(chest.chestId, CHEST_IDS.RARE, 'reward room chest should carry chest identity');
  assert.equal(chest.chestState, CHEST_STATES.CLOSED, 'reward room chest should start closed');
  updateInteractables(state, 0.016);
  assert.equal(chest.opened, false, 'reward chest must not open without explicit E interaction');
  player.economy.money = 0;
  player.x = chest.x;
  player.y = chest.y;
  assert.equal(requestInteractableActivation(state, player.id, { targetId: chest.id }), false, 'priced chest should reject open when player cannot pay');
  assert.equal(chest.opened, false, 'denied chest open must not consume or open the chest');
  assert.ok(state.events.some((event) => event.type === 'chest' && event.action === 'open_denied' && event.reason === 'not_enough_money'), 'priced chest rejection should emit a local affordance event');
  player.economy.money = 250;
  assert.equal(requestInteractableActivation(state, player.id, { targetId: chest.id }), true, 'host-validated interact request should activate reward chest');
  assert.equal(requestInteractableActivation(state, player.id, { targetId: chest.id }), false, 'opened/opening chest should reject duplicate activation');
  assert.ok(state.events.some((event) => event.type === 'interactable' && event.action === 'activation_denied' && event.reason === 'inactive'), 'duplicate chest activation should emit a denial affordance instead of spending twice');
  assert.equal(chest.chestState, CHEST_STATES.OPENING, 'activated chest should enter opening state');
  assert.ok(Object.keys(state.rewardPickups).length >= 1, 'opening reward cache should spawn reward pickups through reward resolver');
  assert.equal(Object.keys(state.loot).length, 0, 'room rewards should not bypass the reward pickup contract by spawning legacy loot directly');
  const rewardPickup = Object.values(state.rewardPickups)[0];
  player.x = rewardPickup.x;
  player.y = rewardPickup.y;
  updateRewardPickups(state, 0.9);
  assert.ok(state.events.some((event) => event.type === 'rewardPickup' && event.action === 'claimed'), 'reward pickup should be claimable through the official pickup pipeline after its reveal delay');
  assert.ok(state.events.some((event) => event.type === 'interactable' && event.action === 'opened'), 'interactable activation should emit an event');
  assert.ok(state.events.some((event) => event.type === 'chest' && event.action === 'opened' && event.chestId === CHEST_IDS.RARE), 'chest activation should emit a chest-specific event');
  assert.ok(state.events.some((event) => event.type === 'economy' && event.action === 'spend_money' && event.sourceType === 'chest'), 'priced chest opening should spend money through playerEconomy');

  const casinoPlan = resolveRoomPlan(8, { seed: 'INTERACTABLE-SCENARIO' });
  const casinoLoc = getLocationFromRoomPlan(casinoPlan);
  assert.equal(casinoPlan.resolvedRoomId, 'casino-floor-00', 'second loop grid replacement should resolve to casino floor through roomPlan');
  assert.equal(casinoPlan.ruleId, 'second_loop_casino_floor', 'casino floor should be a rare-rule replacement, not a ROOM_SEQUENCE entry');
  assert.ok(Array.isArray(casinoLoc.interactablePlan), 'locations should expose interactablePlan snapshots');
  assert.equal(casinoLoc.interactablePlan[0]?.interactableId, 'casino_slot', 'casino floor should carry a SIGNAL SLOT interactable');

  for (let i = 0; i < 4; i += 1) beginRoomTransition(state, 'verify-casino', { offerUpgrades: false });
  assert.equal(state.roomPlan.resolvedRoomId, 'casino-floor-00', 'runtime should enter the casino floor at runDepth 8');
  const slot = Object.values(state.interactables).find((item) => item.kind === 'casino_slot');
  assert.ok(slot, 'casino floor should spawn the casino_slot interactable from the plan');
  updateInteractables(state, 0.016);
  assert.equal(slot.opened, false, 'SIGNAL SLOT must not auto-open on touch/entry');
  player.x = slot.x;
  player.y = slot.y;
  assert.equal(requestInteractableActivation(state, player.id, { targetId: slot.id }), true, 'E-style host interaction should request/open the SIGNAL SLOT without resolving rewards');
  assert.equal(slot.opened, false, 'opening casino modal must not consume the casino machine interactable');
  assert.ok(state.events.some((event) => event.type === 'casino' && event.action === 'open_requested'), 'casino modal open should emit casino open_requested event');
  player.economy.money = 0;
  const deniedSpin = requestCasinoSpin(state, player.id, { interactableId: slot.id, stakeId: 'low', seq: 1 });
  assert.equal(deniedSpin.ok, false, 'casino spin should reject when player cannot pay the stake');
  assert.equal(deniedSpin.reason, 'not_enough_money', 'casino spin rejection should explain missing money');
  player.economy.money = 100;
  const lowStakeCost = getCasinoStake(CASINO_STAKE_IDS.LOW).cost;
  const spin = requestCasinoSpin(state, player.id, { interactableId: slot.id, stakeId: 'low', seq: 2 });
  assert.equal(spin.ok, true, 'casino spin should resolve only through host-owned spin request');
  assert.ok(player.economy.money >= 100 - lowStakeCost, 'casino stake should be spent before any host-side payout is applied');
  assert.equal(spin.symbols.length, 3, 'casino spin result should include three reel symbols');
  if (spin.match) {
    assert.equal(spin.payoutApplied, true, 'three matching casino symbols should apply a real payout in v39.3.11');
    assert.ok(spin.rewardCount >= 1, 'matching casino outcome should report applied reward actions');
  } else {
    assert.equal(spin.payoutApplied, false, 'non-matching casino spin should lose only the stake');
    assert.equal(player.economy.money, 100 - lowStakeCost, 'non-matching casino spin should leave player with money minus stake');
  }
  assert.ok(state.events.some((event) => event.type === 'casino' && event.action === 'spin_resolved'), 'casino spin should emit a host-resolved casino event');

  const pendingBefore = (state.pendingRoomModifiers || []).length;
  const moneyBeforeStatic = player.economy.money;
  const staticPayout = applyCasinoOutcome(
    state,
    player,
    slot,
    getCasinoMachine(slot.casinoMachineId),
    getCasinoStake(CASINO_STAKE_IDS.HIGH),
    [CASINO_SYMBOL_IDS.STATIC, CASINO_SYMBOL_IDS.STATIC, CASINO_SYMBOL_IDS.STATIC],
    { seq: 3 }
  );
  assert.equal(staticPayout.payoutApplied, true, 'STATIC three-match should apply a payout rather than being UI-only');
  assert.ok(player.economy.money > moneyBeforeStatic, 'STATIC outcome should grant money through the playerEconomy pipeline');
  assert.equal((state.pendingRoomModifiers || []).length, pendingBefore + 1, 'STATIC outcome should queue next-room danger through pendingRoomModifiers');
}



function assertEconomyDropScenario() {
  const { state, player } = fresh('ECONOMY-DROP-SCENARIO');
  const ally = addPlayer(state, 'p2', 1);
  const dead = addPlayer(state, 'p3', 2);
  player.hp = 40;
  ally.hp = 35;
  dead.hp = 0;

  const rejectedRegularHeal = spawnEconomyPickup(
    state,
    { type: ECONOMY_PICKUP_TYPES.HEAL, amount: 5, sourceContractId: REWARD_SOURCE_IDS.ENEMY_REGULAR },
    player.x,
    player.y,
    { claimDelay: 0 }
  );
  assert.equal(rejectedRegularHeal, null, 'economy pickup spawn must reject regular-enemy HEA even if a caller bypasses dropResolver filtering');
  assert.ok(state.events.some((event) => event.type === 'economyPickup' && event.action === 'source_contract_rejected' && event.sourceContractId === REWARD_SOURCE_IDS.ENEMY_REGULAR), 'forbidden source/type rejection should emit an integration-hardening event');

  const regular = spawnEnemy(state, 'grunt', player.x + 60, player.y, { eliteVariantId: null, armorVariantId: null });
  assert.equal(finishEnemyKill(state, regular, { kind: 'verify', sourceId: player.id }), true, 'regular kill should pass through kill finalizer');
  const regularPickups = Object.values(state.economyPickups || {});
  assert.ok(regularPickups.some((item) => item.type === ECONOMY_PICKUP_TYPES.XP), 'regular enemies should still drop XP through economy contract');
  assert.equal(regularPickups.some((item) => item.type === ECONOMY_PICKUP_TYPES.HEAL), false, 'regular enemies must not drop HEA');
  assert.equal(regularPickups.every((item) => item.sourceContractId === REWARD_SOURCE_IDS.ENEMY_REGULAR), true, 'regular enemy pickups should carry the regular source contract id');
  assert.equal(regularPickups.every((item) => item.delivery === ECONOMY_PICKUP_DELIVERY.SHARED_ALIVE_PLAYERS), true, 'enemy pickups should declare shared alive-player delivery');
  assert.equal(regularPickups.every((item) => item.recipientRule === ECONOMY_PICKUP_RECIPIENT_RULES.ALIVE_PLAYERS_AT_CLAIM), true, 'enemy pickups should declare alive-at-claim recipient rule');
  assert.equal(Object.keys(state.loot || {}).length, 0, 'enemy kills must not spawn legacy weapon/heal loot');

  state.economyPickups = {};
  const boss = spawnEnemy(state, 'boss', player.x + 80, player.y, { eliteVariantId: null, armorVariantId: null });
  assert.equal(finishEnemyKill(state, boss, { kind: 'verify', sourceId: player.id }), true, 'boss kill should pass through kill finalizer');
  const pickups = Object.values(state.economyPickups || {});
  assert.ok(pickups.some((item) => item.type === ECONOMY_PICKUP_TYPES.XP), 'enemy drop resolver should spawn XP pickups');
  assert.ok(pickups.some((item) => item.type === ECONOMY_PICKUP_TYPES.MONEY), 'enemy drop resolver should spawn money pickups');
  assert.ok(pickups.some((item) => item.type === ECONOMY_PICKUP_TYPES.HEAL), 'boss source contract should allow HEA pickups');

  const allyMoneyBefore = economySnapshot(ally).money;
  const allyXpBefore = economySnapshot(ally).lifetimeXp;
  const deadBefore = economySnapshot(dead);
  for (const pickup of Object.values(state.economyPickups || {})) {
    pickup.x = player.x;
    pickup.y = player.y;
    pickup.claimDelay = 0;
  }
  updateEconomyPickups(state, 0.016);
  const economy = economySnapshot(player);
  const allyEconomy = economySnapshot(ally);
  const deadEconomy = economySnapshot(dead);
  assert.ok(economy.money > 0, 'claiming money pickup should update collector economy money');
  assert.ok(allyEconomy.money > allyMoneyBefore, 'shared pickup credit should update alive ally economy money');
  assert.equal(deadEconomy.money, deadBefore.money, 'dead players must not receive shared money credit');
  assert.ok(economy.lifetimeXp > 0, 'claiming XP pickup should update collector lifetime XP');
  assert.ok(allyEconomy.lifetimeXp > allyXpBefore, 'shared pickup credit should update alive ally lifetime XP');
  assert.equal(deadEconomy.lifetimeXp, deadBefore.lifetimeXp, 'dead players must not receive shared XP credit or level-up queues');
  assert.equal(deadEconomy.pendingUpgradeCount, deadBefore.pendingUpgradeCount, 'dead players must not queue level-ups from missed shared XP');
  assert.ok(player.hp > 40 && ally.hp > 35, 'claiming HEA pickup should heal alive eligible players through official health pipeline');
  assert.equal(dead.hp, 0, 'shared HEA pickup must not revive dead players');
  assert.ok(state.events.some((event) => event.type === 'economyPickup' && event.pickupType === ECONOMY_PICKUP_TYPES.MONEY && event.recipientCount >= 2), 'money pickup claim should emit shared economyPickup event');
  assert.ok(state.events.some((event) => event.type === 'economyPickup' && event.action === 'shared_credit_applied' && event.recipientRule === 'alive_players_at_claim'), 'shared pickup claim should emit explicit shared-credit recipient rule event');
  assert.ok(state.events.some((event) => event.type === 'economy' && event.action === 'grant_xp' && event.sharedCredit), 'XP claim should emit shared economy grant event');

  const late = addPlayer(state, 'p4', 3);
  assert.equal(economySnapshot(late).money, 0, 'late join player should start with zero money');
  assert.equal(economySnapshot(late).lifetimeXp, 0, 'late join player should start with zero XP');
  const direct = spawnEconomyPickup(state, { type: ECONOMY_PICKUP_TYPES.MONEY, amount: 7 }, player.x, player.y, { claimDelay: 0 });
  assert.equal(direct.delivery, ECONOMY_PICKUP_DELIVERY.SHARED_ALIVE_PLAYERS, 'economy pickup should declare shared alive-player delivery');
  assert.equal(direct.recipientRule, ECONOMY_PICKUP_RECIPIENT_RULES.ALIVE_PLAYERS_AT_CLAIM, 'economy pickup should declare alive-at-claim recipient rule');
  updateEconomyPickups(state, 0.016);
  assert.equal(economySnapshot(late).money, 7, 'late join player should receive only future shared pickup credit while alive');

  const luckyState = createGameState('LUCKY-ECONOMY-DROP-HOOK-SCENARIO');
  const luckyPlayer = addPlayer(luckyState, 'p1', 0);
  luckyPlayer.upgrades.taken.luck = 1;
  luckyState.rng = { next: () => 0, range: (a, _b) => a, int: (a) => a, pick: (arr) => arr[0] };
  const luckyHook = resolveEconomyDropHook(
    luckyState,
    { id: 'enemy_luck_verify', kind: 'grunt' },
    { type: ECONOMY_PICKUP_TYPES.MONEY, amount: 10, chance: 1 },
    { playerId: luckyPlayer.id, sourceContractId: 'enemy_regular' }
  );
  assert.equal(luckyHook.hit, true, 'economy drop hook should resolve a hit through the official hook foundation');
  assert.equal(luckyHook.luckProc, true, 'successful rare value roll from LUCK should mark a lucky proc');
  assert.equal(luckyHook.procType, ECONOMY_DROP_PROC_TYPES.LUCK_VALUE, 'lucky economy value roll should carry an explicit proc type');
  assert.ok(luckyHook.amount > 10, 'successful lucky economy roll should improve pickup value rather than spawning junk');

  const modifierState = createGameState('ALGORITHM-ECONOMY-DROP-HOOK-SCENARIO');
  const modifierPlayer = addPlayer(modifierState, 'p1', 0);
  modifierState.roomModifierIds = [ROOM_MODIFIER_IDS.ALGORITHM_BOOST];
  modifierState.rng = { next: () => 0, range: (a, _b) => a, int: (a) => a, pick: (arr) => arr[0] };
  const modifierHook = resolveEconomyDropHook(
    modifierState,
    { id: 'enemy_algo_verify', kind: 'grunt' },
    { type: ECONOMY_PICKUP_TYPES.XP, amount: 10, chance: 0.5 },
    { playerId: modifierPlayer.id, sourceContractId: 'enemy_regular' }
  );
  assert.equal(modifierHook.hit, true, 'algorithm boost economy roll should still resolve through the hook foundation');
  assert.ok(modifierHook.chance > modifierHook.baseChance, 'algorithm_boost should improve economy drop chance through loot:roll hook');
  assert.equal(modifierHook.modifierProc, true, 'successful algorithm_boost rare value roll should be marked as a modifier proc');
  assert.ok(modifierHook.amount > 10, 'algorithm_boost rare value roll should improve pickup value');
}

function assertQueuedLevelUpScenario() {
  const { state, player } = fresh('QUEUED-LEVEL-UP-SCENARIO');
  const dead = addPlayer(state, 'dead_queue', 1);
  const noPending = addPlayer(state, 'no_pending_queue', 2);
  dead.hp = 0;
  assert.equal(offerQueuedUpgradeChoice(state, player), false, 'queued offer should not open without pending XP level-ups');
  assert.equal(offerQueuedUpgradeChoice(state, dead), false, 'dead players must not open queued offers even if called directly');
  grantXp(state, player, 999, { sourceType: 'verify' });
  const beforeTransition = economySnapshot(player);
  assert.ok(beforeTransition.pendingUpgradeCount >= 2, 'large XP grant should queue multiple pending upgrades');
  assert.ok(beforeTransition.levelQueueSeq > 0, 'queued level-ups should advance a durable queue sequence');
  assert.equal(player.upgrades.choices.length, 0, 'XP gain should not open upgrade offers during combat');
  assert.ok(state.events.some((event) => event.type === 'economy' && event.action === 'queue_level_up' && event.source === UPGRADE_OFFER_SOURCES.QUEUED_LEVEL_UP), 'level-up queue should emit an explicit queued-level-up event');
  beginRoomTransition(state, 'verify-level-queue');
  assert.equal(player.upgrades.choices.length, 3, 'portal transition should open the first queued upgrade offer');
  assert.equal(noPending.upgrades.choices.length, 0, 'portal transition must not offer queued upgrades to players without pending queue credit');
  assert.equal(player.upgrades.offerSource, UPGRADE_OFFER_SOURCES.QUEUED_LEVEL_UP, 'queued offer should carry queued_level_up source metadata');
  assert.equal(player.upgrades.requiresPendingUpgrade, true, 'queued offer should require a pending level-up before it can be chosen');
  assert.equal(player.upgrades.queueRemainingAtOffer, beforeTransition.pendingUpgradeCount, 'queued offer should snapshot queue depth at offer time');
  const firstSeq = player.upgrades.offerSeq;
  assert.equal(chooseUpgrade(state, player.id, 0), true, 'first queued upgrade choice should apply');
  const afterFirst = economySnapshot(player);
  assert.equal(afterFirst.pendingUpgradeCount, beforeTransition.pendingUpgradeCount - 1, 'choosing an upgrade should consume one queued level-up');
  assert.ok(state.events.some((event) => event.type === 'economy' && event.action === 'consume_pending_upgrade' && event.offerSeq === firstSeq), 'choosing a queued offer should emit a queue consumption event tied to the offer sequence');
  if (afterFirst.pendingUpgradeCount > 0) {
    assert.equal(player.upgrades.choices.length, 3, 'remaining queued level-ups should open the next offer screen');
    assert.ok(player.upgrades.offerSeq > firstSeq, 'sequential queued offers should carry a fresh offer sequence');
    assert.equal(player.upgrades.queueRemainingAtOffer, afterFirst.pendingUpgradeCount, 'next sequential offer should snapshot the reduced queue depth');
  }

  const staleState = createGameState('STALE-QUEUED-OFFER-SCENARIO');
  const stalePlayer = addPlayer(staleState, 'p1', 0);
  offerUpgradeChoices(staleState, stalePlayer, 3, { offerSource: UPGRADE_OFFER_SOURCES.QUEUED_LEVEL_UP, requiresPendingUpgrade: true });
  assert.equal(stalePlayer.upgrades.choices.length, 3, 'test setup should create a queued offer');
  assert.equal(chooseUpgrade(staleState, stalePlayer.id, 0), false, 'queued offers must not apply if the pending queue is missing or stale');
  assert.equal(stalePlayer.upgrades.choices.length, 0, 'stale queued offer should clear instead of lingering');
}

function assertAbilityRewardScenario() {
  const { state, player } = fresh('ABILITY-REWARD-SCENARIO');
  assert.equal(hasAbility(player, ABILITY_IDS.TELEPORT_DASH), false, 'fresh player should not own TELEPORT DASH ability inventory item');
  assert.equal(dashConfig(player), null, 'fresh player without legacy upgrade or ability loot should not have dash config');

  const pickup = spawnRewardPickup(state, { type: REWARD_TYPES.ABILITY_PICKUP, abilityId: ABILITY_IDS.TELEPORT_DASH }, player.x, player.y, { claimDelay: 0 });
  assert.ok(pickup, 'ability pickup reward should spawn through reward pickup pipeline');
  updateRewardPickups(state, 0.016);
  assert.equal(hasAbility(player, ABILITY_IDS.TELEPORT_DASH), true, 'claiming an ability pickup should grant the ability through abilityInventory');
  assert.equal(ensureAbilityInventory(player).stacks[ABILITY_IDS.TELEPORT_DASH], 1, 'first ABL pickup should create dash stack x1');
  assert.equal(dashConfig(player)?.source, 'ability_inventory', 'TELEPORT DASH ability pickup should unlock dash while preserving old upgrade compatibility');
  assert.equal(dashConfig(player)?.maxCharges, 1, 'first dash stack should provide one dash charge');

  const shard = spawnRewardPickup(state, { type: REWARD_TYPES.ABILITY_SHARD, abilityId: ABILITY_IDS.TELEPORT_DASH, amount: 1 }, player.x, player.y, { claimDelay: 0 });
  assert.ok(shard, 'ability shard reward should spawn through reward pickup pipeline');
  updateRewardPickups(state, 0.016);
  assert.equal(ensureAbilityInventory(player).shards[ABILITY_IDS.TELEPORT_DASH], 1, 'claiming an ability shard should update abilityInventory shards');
  assert.equal(ensureAbilityInventory(player).stacks[ABILITY_IDS.TELEPORT_DASH], 2, 'ABL shard should convert into a real dash stack instead of doing nothing');
  assert.equal(dashConfig(player)?.maxCharges, 2, 'stacked dash rewards should increase usable dash charges');
  assert.equal(performDash(state, player.id, { right: true }, { seq: 1 }).ok, true, 'first stacked dash charge should be usable');
  assert.equal(performDash(state, player.id, { right: true }, { seq: 2 }).ok, true, 'second stacked dash charge should be usable immediately');
  assert.equal(performDash(state, player.id, { right: true }, { seq: 3 }).ok, false, 'dash should reject when all stacked charges are spent');
  tickActiveAbilities(player, dashConfig(player).cooldown);
  assert.equal(performDash(state, player.id, { right: true }, { seq: 4 }).ok, true, 'spent dash charges should recharge through the ability runtime');
  assert.ok(state.events.some((event) => event.type === 'rewardPickup' && event.rewardType === REWARD_TYPES.ABILITY_PICKUP && event.abilityStack === 1), 'ability pickup claim should emit rewardPickup event with stack x1');
  assert.ok(state.events.some((event) => event.type === 'rewardPickup' && event.rewardType === REWARD_TYPES.ABILITY_SHARD && event.abilityStack === 2), 'ability shard claim should emit rewardPickup event with stack x2');
}


function assertUnlimitedCompanionStackScenario() {
  const { state, player } = fresh('UNLIMITED-COMPANION-STACKS');
  for (let i = 0; i < 20; i += 1) assert.equal(applyUpgrade(player, 'drone', state), true, `DRONE stack ${i + 1} should be accepted`);
  for (let i = 0; i < 10; i += 1) assert.equal(applyUpgrade(player, 'orbital', state), true, `ORBITAL stack ${i + 1} should be accepted`);
  updateCompanions(state, 0.016);
  const drones = Object.values(state.companions).filter((c) => c.ownerId === player.id && c.kind === 'drone');
  const orbitals = Object.values(state.companions).filter((c) => c.ownerId === player.id && c.kind === 'orbital');
  assert.equal(drones.length, 20, 'DRONE should support Balatro-style large stacks instead of stopping at 3/8');
  assert.equal(orbitals.length, 10, 'ORBITAL should support Balatro-style large stacks instead of stopping at 3/8');
}


function assertRewardEventFeedScenario() {
  const install = buildRewardEventFeedItem({
    id: 'ev_install_verify',
    type: 'economy',
    action: 'queue_level_up',
    playerId: 'p1',
    levelsGained: 2,
    pendingUpgradeCount: 3
  }, { playerId: 'p1' });
  assert.equal(install.text, 'INSTALL +2', 'reward feed should expose local queued level-up installs');
  assert.equal(install.detail, 'QUEUE x3', 'reward feed should show queued install depth');

  const otherInstall = buildRewardEventFeedItem({
    id: 'ev_install_other',
    type: 'economy',
    action: 'queue_level_up',
    playerId: 'p2',
    levelsGained: 1,
    pendingUpgradeCount: 1
  }, { playerId: 'p1' });
  assert.equal(otherInstall, null, "reward feed must not show another player\'s personal INSTALL event");

  const luck = buildRewardEventFeedItem({
    id: 'ev_luck_verify',
    type: 'drop',
    action: 'economy_drop_hook_roll',
    pickupType: ECONOMY_PICKUP_TYPES.MONEY,
    luckProc: true,
    rareRoll: true,
    sourcePlayerId: 'p1'
  }, { playerId: 'p1' });
  assert.equal(luck.text, 'LUCK PROC', 'reward feed should expose successful LUCK procs');
  assert.equal(luck.detail, 'BONUS GLD', 'reward feed should describe the boosted economy pickup code');

  const otherLuck = buildRewardEventFeedItem({
    id: 'ev_luck_other',
    type: 'drop',
    action: 'economy_drop_hook_roll',
    pickupType: ECONOMY_PICKUP_TYPES.XP,
    luckProc: true,
    rareRoll: true,
    sourcePlayerId: 'p2'
  }, { playerId: 'p1' });
  assert.equal(otherLuck, null, "reward feed must not show another player\'s local luck proc");

  const rareHea = buildRewardEventFeedItem({
    id: 'ev_hea_verify',
    type: 'drop',
    action: 'economy_drop_hook_roll',
    pickupType: ECONOMY_PICKUP_TYPES.HEAL,
    rareRoll: true,
    sourcePlayerId: 'p2'
  }, { playerId: 'p1' });
  assert.equal(rareHea.text, 'RARE HEA', 'reward feed should expose rare HEA as a team-critical event');


  const abilityClaim = buildRewardEventFeedItem({
    id: 'ev_ability_claim',
    type: 'rewardPickup',
    action: 'claimed',
    playerId: 'p1',
    rewardType: REWARD_TYPES.ABILITY_SHARD,
    abilityId: ABILITY_IDS.TELEPORT_DASH,
    abilityStack: 4,
    abilityIsNew: false
  }, { playerId: 'p1' });
  assert.equal(abilityClaim.text, 'DASH x4', 'reward feed should expose stacked ABL rewards as real dash stacks');
  assert.equal(abilityClaim.detail, 'CHARGE STACK', 'stacked ABL reward feed should communicate added charge value');

  const plainClaim = buildRewardEventFeedItem({
    id: 'ev_plain_claim',
    type: 'economyPickup',
    action: 'claimed',
    pickupType: ECONOMY_PICKUP_TYPES.MONEY,
    amount: 5,
    recipients: ['p1'],
    recipientCount: 1
  }, { playerId: 'p1' });
  assert.equal(plainClaim, null, 'reward feed should not spam ordinary GLD/EXP pickup claims');
}

function assertStatSnapshotScenario() {
  const { state, player } = fresh('STAT-SNAPSHOT-SCENARIO');
  applyUpgrade(player, 'heavyPayload', state);
  applyUpgrade(player, 'overclock', state);
  applyUpgrade(player, 'critChip', state);
  applyUpgrade(player, 'luck', state);
  applyUpgrade(player, 'magnet', state);
  applyUpgrade(player, 'teleportDash', state);
  grantAbility(player, ABILITY_IDS.TELEPORT_DASH, { autoEquip: true });

  const stat = buildPlayerStatSnapshot(player, state);
  assert.equal(stat.schemaVersion, STAT_SNAPSHOT_SCHEMA_VERSION, 'stat snapshot should carry the foundation schema version');
  assert.equal(stat.playerId, player.id, 'stat snapshot should identify the player it describes');
  assert.equal(stat.percent.damage, 15, 'stat snapshot should expose final damage percent from upgrades');
  assert.equal(stat.percent.fireRate, 14, 'stat snapshot should expose final fire-rate percent from upgrades');
  assert.equal(stat.percent.critChance, 10, 'stat snapshot should expose projectile crit percent from effect pipeline');
  assert.equal(stat.percent.luckDropChance, 4.5, 'stat snapshot should expose LUCK drop chance from player effect pipeline');
  assert.equal(stat.percent.luckRareValue, 8, 'stat snapshot should expose LUCK rare/value bonus from player effect pipeline');
  assert.equal(stat.utility.magnetRadius, 90, 'stat snapshot should expose magnet radius from player effect pipeline');
  assert.equal(stat.weapon.code, 'SHG', 'stat snapshot should expose active weapon code');
  assert.equal(stat.weapon.effective.damage, 10.4, 'stat snapshot should expose active weapon effective damage after damage multiplier');
  assert.equal(stat.weapon.effective.fireRate, 3.08, 'stat snapshot should expose active weapon effective fire-rate after multiplier');
  assert.equal(stat.ability.dash.distance, 210, 'stat snapshot should expose dash stats through the ability/legacy pipeline');
  assert.equal(stat.ability.dash.maxCharges, 2, 'stat snapshot should expose combined legacy + ABL dash charge stacks');
  assert.ok(stat.sources.upgrades.some((entry) => entry.id === 'heavyPayload' && entry.stacks === 1), 'stat snapshot should expose upgrade source stacks for future TAB source drilldown');
  assert.ok(stat.sources.abilities.includes(ABILITY_IDS.TELEPORT_DASH), 'stat snapshot should expose owned abilities for future TAB source drilldown');

  const snap = makeSnapshot(state);
  const snapPlayer = snap.players.find((entry) => entry.id === player.id);
  assert.equal(snapPlayer.statSnapshot.schemaVersion, STAT_SNAPSHOT_SCHEMA_VERSION, 'network snapshot should include the computed stat snapshot');
  assert.equal(snapPlayer.statSnapshot.percent.damage, 15, 'network stat snapshot should mirror computed damage percentage');
}


function assertAnomalyEnemyStressScenario() {
  const { state, player } = fresh('ANOMALY-STRESS-SCENARIO');
  state.spawnTimer = 9999;
  const spacing = 72;
  ANOMALY_ENEMY_KINDS.forEach((kind, index) => {
    const x = player.x + 160 + (index % 5) * spacing;
    const y = player.y - 140 + Math.floor(index / 5) * spacing;
    const enemy = spawnEnemy(state, kind, x, y, { eliteVariantId: null, armorVariantId: null });
    assert.ok(enemy, `${kind} should spawn through the normal enemy pipeline`);
  });
  assert.equal(ANOMALY_ENEMY_KINDS.length, 10, 'stress pack should expose exactly ten primary anomaly enemy kinds');
  for (let i = 0; i < 80; i += 1) updateEnemies(state, 1 / 30);
  assert.ok(Object.values(state.enemies).some((enemy) => enemy.kind === 'mirror' && enemy.mirrorState), 'MIRROR should keep delayed target history state');
  assert.ok(Object.values(state.enemies).some((enemy) => enemy.kind === 'orbiter' && enemy.orbitState), 'ORBITER should keep orbit runtime state');
  assert.ok(Object.values(state.enemies).some((enemy) => enemy.kind === 'herald' && enemy.heraldState), 'HERALD should keep summon runtime state');
  assert.ok(state.effects.some((fx) => ['anomalyField', 'anomalyLine', 'pulseWave'].includes(fx.type)), 'anomaly enemies should emit registered visual effects');

  const split = Object.values(state.enemies).find((enemy) => enemy.kind === 'splitter');
  assert.ok(split, 'splitter should be present before death-spawn test');
  finishEnemyKill(state, split, { sourceId: player.id, type: 'verify' }, { sourceId: player.id });
  assert.ok(Object.values(state.enemies).some((enemy) => enemy.kind === 'mini_splitter' && enemy.parentEnemyId === split.id), 'SPLITTER should spawn controlled child splinters on death');

  const prism = Object.values(state.enemies).find((enemy) => enemy.kind === 'prism');
  assert.ok(prism, 'prism should be present for deflect test');
  prism.prismState = { facingX: -1, facingY: 0 };
  const projectile = makeProjectile({ id: 'verify-prism-shot', ownerId: player.id, weaponId: 'shotgun', x: prism.x - 26, y: prism.y, angle: 0 });
  state.projectiles[projectile.id] = projectile;
  updateProjectiles(state, 1 / 60);
  assert.ok(projectile.hitIds?.[prism.id], 'PRISM front defense should register/deflect the projectile without damaging through the front face');
}

function assertModifierScenario() {
  const stack = resolveRoomModifierStack({
    baseModifierIds: ['static_field'],
    loopIndex: 1,
    profile: { modifiers: { stackChance: 1, maxExtraModifiers: 0, modifierIds: [] } },
    seed: 'runtime-modifier-stack'
  });
  assert.deepEqual(stack.modifierIds, ['static_field'], 'room modifier stack should preserve static_field as data-driven room-domain rule');
  const staticPlan = resolveRoomPlan(6, { seed: 'runtime-static-plan' });
  assert.equal(staticPlan.resolvedRoomId, 'static-field-00', 'run planner should still resolve the first static field rare room');
  assert.ok(staticPlan.modifierIds.includes('static_field'), 'run planner should source room modifier ids from modifier stack');
  assert.equal(staticPlan.modifierStack?.domain, 'room', 'room plan should carry room-domain modifier stack metadata');
  assert.deepEqual(staticPlan.modifierStack?.baseIds, ['static_field'], 'room plan stack should preserve base modifier ids');
  const loc = { modifiers: [ROOM_MODIFIERS.static_field] };
  const enemyCtx = runRoomModifierHooksForLocation(loc, ROOM_MODIFIER_HOOKS.ENEMY_UPDATE, { speedMult: 1, damageMult: 1, tags: [] });
  assert.equal(Number(enemyCtx.speedMult.toFixed(2)), 1.1, 'room modifier stack should scale enemy speed through hook commands');
  const healCtx = runRoomModifierHooksForLocation(loc, ROOM_MODIFIER_HOOKS.PLAYER_HEAL, { amount: 20, allowRevive: false, minHp: 0, tags: [] });
  assert.equal(Number(healCtx.amount.toFixed(2)), 11, 'room modifier stack should scale healing through hook commands');
  const renderCtx = runRoomModifierHooksForLocation(loc, ROOM_MODIFIER_HOOKS.RENDER_BACKGROUND, { accent: 'green', gridStep: 80, tags: [] });
  assert.equal(renderCtx.accent, 'white', 'room modifier render hook should set background accent');
  assert.equal(renderCtx.gridStep, 52, 'room modifier render hook should set grid step');

  const stacked = resolveRoomModifierStack({
    baseModifierIds: ['core_pressure'],
    loopIndex: 3,
    profile: { modifiers: { stackChance: 1, maxExtraModifiers: 4, modifierIds: ['live_chat_hates_you', 'algorithm_boost', 'static_god'] } },
    context: { features: ['loot', 'hostileProjectiles'], tags: ['core', 'clear'] },
    seed: 'runtime-vertical-stack'
  });
  assert.ok(stacked.modifierIds.includes('live_chat_hates_you'), 'stack vertical slice should include live_chat_hates_you when budget allows');
  assert.ok(stacked.modifierIds.includes('algorithm_boost'), 'stack vertical slice should include algorithm_boost when loot feature exists');
  assert.ok(stacked.modifierIds.includes('static_god'), 'stack vertical slice should include static_god when hostileProjectile feature exists');
  assert.equal(stacked.modifierIds[0], 'core_pressure', 'identity modifier should stay first in runtime modifier order');

  const stackedLoc = { modifiers: stacked.modifierIds.map((id) => ROOM_MODIFIERS[id]).filter(Boolean) };
  const batchCtx = runRoomModifierHooksForLocation(stackedLoc, ROOM_MODIFIER_HOOKS.DIRECTOR_SPAWN, { batch: 2, canSpawn: true, tags: ['director', 'spawn', 'batch'] });
  assert.equal(batchCtx.batch, 3, 'live_chat_hates_you should increase director batch through tag-gated hook command');
  const intervalCtx = runRoomModifierHooksForLocation(stackedLoc, ROOM_MODIFIER_HOOKS.DIRECTOR_SPAWN, { interval: 1, canSpawn: true, tags: ['director', 'spawn', 'interval'] });
  assert.equal(Number(intervalCtx.interval.toFixed(2)), 0.92, 'live_chat_hates_you should reduce spawn interval through tag-gated hook command');
  const lootCtx = runRoomModifierHooksForLocation(stackedLoc, ROOM_MODIFIER_HOOKS.LOOT_ROLL, { chance: 0.2, rareBonus: 0, tags: ['loot', 'roll'] });
  assert.equal(Number(lootCtx.chance.toFixed(2)), 0.25, 'algorithm_boost should improve loot chance in stacked rooms');
  assert.equal(Number(lootCtx.rareBonus.toFixed(2)), 0.08, 'algorithm_boost should improve rare bonus in stacked rooms');
  const hostileCtx = runRoomModifierHooksForLocation(stackedLoc, ROOM_MODIFIER_HOOKS.PROJECTILE_UPDATE, { speedMult: 1, tags: ['projectile', 'update', 'hostile'] });
  assert.equal(Number(hostileCtx.speedMult.toFixed(2)), 0.78, 'static_god should slow hostile projectiles in stacked rooms');
  const playerCtx = runRoomModifierHooksForLocation(stackedLoc, ROOM_MODIFIER_HOOKS.PROJECTILE_UPDATE, { speedMult: 1, tags: ['projectile', 'update', 'player'] });
  assert.equal(playerCtx.speedMult, 1, 'static_god should not slow player projectiles in stacked rooms');

  const debtState = createGameState('CASINO-DEBT-SCENARIO');
  const debtPlayer = addPlayer(debtState, 'p1', 0);
  debtState.roomPlan = { ...debtState.roomPlan, runDepth: 8 };
  debtState.runDepth = 8;
  debtState.locationIndex = 8;
  const queued = executeReward(
    debtState,
    { type: REWARD_TYPES.MODIFIER_INJECTION, modifierId: 'live_chat_hates_you', text: 'DEBT SIGNAL' },
    { x: debtPlayer.x, y: debtPlayer.y },
    { sourceType: 'interactable', sourceId: 'verify-casino-slot', tableId: 'casino_slot', playerId: debtPlayer.id }
  );
  assert.equal(queued?.modifierId, 'live_chat_hates_you', 'casino debt reward should queue a room-domain modifier debt');
  assert.equal(queued?.applyRunDepth, 9, 'casino debt should target the next room, not mutate the current casino room');
  beginRoomTransition(debtState, 'verify-casino-debt', { offerUpgrades: false });
  assert.equal(debtState.roomPlan.runDepth, 9, 'casino debt scenario should transition to the queued target room');
  assert.ok(debtState.roomPlan.modifierIds.includes('live_chat_hates_you'), 'queued casino debt should enter the next room through roomPlan modifier stack');
  assert.equal(debtState.pendingRoomModifiers.length, 0, 'queued casino debt should be consumed after the next room plan applies it');
  assert.ok(debtState.events.some((event) => event.type === 'room_modifier_debt' && event.action === 'applied'), 'applying casino debt should emit a room_modifier_debt event');

}
assertDamagePolicy();
assertDamageScenarios();
assertLinkedArmorScenario();
assertEliteScenario();
assertLifestealScenario();
assertPlayerDamageScenario();
assertTransitionCleanupScenario();
assertInteractableScenario();
assertEconomyDropScenario();
assertQueuedLevelUpScenario();
assertAbilityRewardScenario();
assertUnlimitedCompanionStackScenario();
assertStatSnapshotScenario();
assertRewardEventFeedScenario();
assertAnomalyEnemyStressScenario();
assertModifierScenario();

console.log('universal runtime scenario verification passed: damage matrix, armor, linked armor, elite pulse, lifesteal, transition cleanup, loot economy drops, queued level-up offers, modifier stack/hooks, interactable reward pickups, active ability loot, unlimited companion stacks, casino activity, stat snapshot foundation, reward event feed foundation, anomaly enemy stress pack plus next-room casino debt');
