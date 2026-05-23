import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENEMIES, ENEMY_WAVES } from '../src/data/enemies.js';
import { WEAPONS, START_WEAPON, WEAPON_IDS } from '../src/data/weapons.js';
import { ROOM_SEQUENCE, RARE_ROOMS, ALL_ROOMS } from '../src/data/rooms.js';
import { ENCOUNTER_PLANS } from '../src/data/encounters.js';
import { ROOM_LAYOUTS, layoutIdentitySnapshot } from '../src/data/layouts.js';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import { INTERACTABLES } from '../src/data/interactables.js';
import { REWARD_TABLES, rewardEntryIsKnown } from '../src/data/rewardTables.js';
import { REWARD_TYPES, ACTIVE_REWARD_TYPES, RESERVED_REWARD_TYPES, rewardTypeIsKnown } from '../src/data/rewardTypes.js';
import { LOOT } from '../src/data/loot.js';
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
}
for (const kind of ENEMY_WAVES) assert.ok(ENEMIES[kind], `ENEMY_WAVES references unknown enemy: ${kind}`);

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

assertUnique(Object.keys(REWARD_TABLES), 'reward table');
for (const [id, table] of Object.entries(REWARD_TABLES)) {
  assert.equal(table.id, id, `reward table key/id mismatch: ${id}`);
  assert.ok(Array.isArray(table.entries) && table.entries.length > 0, `${id} reward table needs entries`);
  assert.ok(Number.isFinite(table.rolls) && table.rolls >= 1, `${id} reward table needs positive rolls`);
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
}

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
