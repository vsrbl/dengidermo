import assert from 'node:assert/strict';
import { createGameState, addPlayer } from '../src/game/state.js';
import { spawnEnemy } from '../src/game/enemies.js';
import { beginRoomTransition } from '../src/game/roomFlow.js';
import { getLocationFromRoomPlan, resolveRoomPlan } from '../src/game/runPlanner.js';
import { finishEnemyKill } from '../src/game/enemyDeath.js';
import { dealDamage, dealPlayerDamage, healProjectileOwner } from '../src/game/effects.js';
import { updateEnemyArmorVariantRuntime } from '../src/game/enemyArmorVariants.js';
import { runEnemyEliteDeath } from '../src/game/enemyElites.js';
import { runRoomModifierHooksForLocation, ROOM_MODIFIER_HOOKS } from '../src/game/roomModifiers.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { requestInteractableActivation, updateInteractables } from '../src/game/interactables.js';
import { resolveRoomModifierStack } from '../src/game/modifierStack.js';
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
  state.interactables.test = { id: 'test', kind: 'field_cache', x: player.x, y: player.y, radius: 18, interactRadius: 38 };
  state.effects.push({ type: 'spark', x: player.x, y: player.y, life: 1, maxLife: 1 });
  state.companions.test = { id: 'test', ownerId: player.id, kind: 'drone' };
  const beforeDepth = state.runDepth;
  beginRoomTransition(state, 'verify-cleanup', { offerUpgrades: false });
  assert.equal(state.runDepth, beforeDepth + 1, 'room transition should advance runDepth');
  assert.equal(Object.keys(state.enemies).length, 0, 'transition should clear enemies');
  assert.equal(Object.keys(state.projectiles).length, 0, 'transition should clear projectiles');
  assert.equal(Object.keys(state.loot).length, 0, 'transition should clear loot');
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
  assert.equal(state.roomPlan.interactablePlan.length, 1, 'reward cache room should carry one data-driven interactable slot');
  assert.equal(Object.keys(state.interactables).length, 1, 'entering reward cache should spawn its interactable from the plan');
  const chest = Object.values(state.interactables)[0];
  assert.equal(chest.kind, 'reward_cache', 'reward room interactable should use reward_cache data');
  updateInteractables(state, 0.016);
  assert.equal(chest.opened, false, 'reward chest must not open without explicit E interaction');
  player.x = chest.x;
  player.y = chest.y;
  assert.equal(requestInteractableActivation(state, player.id, { targetId: chest.id }), true, 'host-validated interact request should activate reward chest');
  assert.ok(Object.keys(state.loot).length >= 1, 'opening reward cache should spawn loot through reward resolver');
  assert.ok(state.events.some((event) => event.type === 'interactable' && event.action === 'opened'), 'interactable activation should emit an event');

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
  assert.equal(requestInteractableActivation(state, player.id, { targetId: slot.id }), true, 'E-style host interaction should activate SIGNAL SLOT');
  assert.ok(state.events.some((event) => event.type === 'interactable' && event.kind === 'casino_slot'), 'casino activity should emit an interactable event');
  assert.ok(
    state.events.some((event) => event.type === 'reward' && event.action === 'nothing') || Object.values(state.loot).some((item) => item.sourceId === slot.id),
    'casino activity should resolve either a bust event or loot through rewardResolver'
  );
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
}
assertDamagePolicy();
assertDamageScenarios();
assertLinkedArmorScenario();
assertEliteScenario();
assertLifestealScenario();
assertPlayerDamageScenario();
assertTransitionCleanupScenario();
assertInteractableScenario();
assertModifierScenario();

console.log('universal runtime scenario verification passed: damage matrix, armor, linked armor, elite pulse, lifesteal, transition cleanup, modifier stack/hooks, interactable rewards, casino activity');
