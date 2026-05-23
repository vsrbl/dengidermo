import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOM_MODIFIERS } from '../src/data/roomModifiers.js';
import {
  MODIFIER_BUDGET_FIELDS,
  MODIFIER_DOMAINS,
  MODIFIER_DOMAIN_IDS,
  MODIFIER_FEATURES,
  MODIFIER_POLARITIES,
  MODIFIER_RARITIES,
  ROOM_MODIFIER_COMMAND_TYPES,
  ROOM_MODIFIER_HOOKS
} from '../src/data/modifierDomains.js';
import { RULE_MODIFIERS, RULE_MODIFIERS_BY_DOMAIN } from '../src/data/ruleModifiers.js';
import {
  executeRoomModifierCommand,
  runRoomModifierHooksForLocation
} from '../src/game/roomModifiers.js';
import { normalizeModifierBudget, roomModifierBudgetLimitsForMaxStack } from '../src/game/modifierBudget.js';
import { resolveModifierStack } from '../src/game/modifierResolver.js';
import { maxRoomModifiersForLoop, resolveRoomModifierStack } from '../src/game/modifierStack.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exists = (rel) => fs.existsSync(path.join(root, rel));

const VALID_DOMAINS = new Set(MODIFIER_DOMAIN_IDS);
const VALID_POLARITIES = new Set(Object.values(MODIFIER_POLARITIES));
const VALID_RARITIES = new Set(Object.values(MODIFIER_RARITIES));
const VALID_REQUIREMENTS = new Set(Object.values(MODIFIER_FEATURES));
const knownHooks = new Set(Object.values(ROOM_MODIFIER_HOOKS));
const knownCommands = new Set(Object.values(ROOM_MODIFIER_COMMAND_TYPES));

const sampleContexts = Object.freeze({
  [ROOM_MODIFIER_HOOKS.ROOM_ENTER]: Object.freeze({ tags: [] }),
  [ROOM_MODIFIER_HOOKS.ROOM_EXIT]: Object.freeze({ tags: [] }),
  [ROOM_MODIFIER_HOOKS.DIRECTOR_BUDGET]: Object.freeze({ budget: 10, totalBudget: 10, tags: ['director', 'budget'] }),
  [ROOM_MODIFIER_HOOKS.DIRECTOR_SPAWN]: Object.freeze({ batch: 2, interval: 1, canSpawn: true, tags: ['director', 'spawn', 'batch', 'interval'] }),
  [ROOM_MODIFIER_HOOKS.DIRECTOR_CAP]: Object.freeze({ enemyCap: 8, tags: ['director', 'cap'] }),
  [ROOM_MODIFIER_HOOKS.ENEMY_SPAWN]: Object.freeze({ hp: 10, maxHp: 10, speedMult: 1, damageMult: 1, tags: [] }),
  [ROOM_MODIFIER_HOOKS.ENEMY_UPDATE]: Object.freeze({ speedMult: 1, damageMult: 1, tags: [] }),
  [ROOM_MODIFIER_HOOKS.PROJECTILE_UPDATE]: Object.freeze({ speedMult: 1, tags: ['projectile', 'update', 'hostile'] }),
  [ROOM_MODIFIER_HOOKS.PROJECTILE_WALL]: Object.freeze({ didRicochet: false, tags: ['projectile', 'wall', 'hostile'] }),
  [ROOM_MODIFIER_HOOKS.PROJECTILE_DAMAGE]: Object.freeze({ damage: 10, critical: false, tags: [] }),
  [ROOM_MODIFIER_HOOKS.PLAYER_DAMAGE]: Object.freeze({ damage: 10, blocked: false, blockedBy: '', tags: [] }),
  [ROOM_MODIFIER_HOOKS.PLAYER_HEAL]: Object.freeze({ amount: 10, allowRevive: false, minHp: 0, tags: [] }),
  [ROOM_MODIFIER_HOOKS.LOOT_ROLL]: Object.freeze({ chance: 0.2, rareBonus: 0, tags: ['loot', 'roll'] }),
  [ROOM_MODIFIER_HOOKS.PORTAL_OPEN]: Object.freeze({ canOpen: true, tags: [] }),
  [ROOM_MODIFIER_HOOKS.RENDER_BACKGROUND]: Object.freeze({ accent: 'green', gridStep: 80, tags: [] })
});

function assertUnique(ids, label) {
  assert.equal(new Set(ids).size, ids.length, `${label} ids must be unique`);
}

function assertStringArray(value, label) {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  for (const item of value) assert.equal(typeof item, 'string', `${label} entries must be strings`);
}

function verifyBudget(budget, label) {
  if (budget == null) return;
  for (const field of MODIFIER_BUDGET_FIELDS) {
    assert.ok(Number.isFinite(budget[field]) && budget[field] >= 0, `${label}.budget.${field} must be a non-negative number`);
  }
}

function verifyHookCommands(modifier, domain = 'room') {
  for (const [hookName, commands] of Object.entries(modifier.hooks || {})) {
    if (domain === 'room') assert.ok(knownHooks.has(hookName), `${modifier.id} uses unknown hook: ${hookName}`);
    assert.ok(Array.isArray(commands), `${modifier.id}/${hookName} must be a command array`);
    for (const command of commands) {
      assert.ok(command && typeof command.type === 'string', `${modifier.id}/${hookName} has command without type`);
      if (domain === 'room') assert.ok(knownCommands.has(command.type), `${modifier.id}/${hookName} uses unknown command type: ${command.type}`);
      if ([ROOM_MODIFIER_COMMAND_TYPES.ADD, ROOM_MODIFIER_COMMAND_TYPES.SCALE, ROOM_MODIFIER_COMMAND_TYPES.SET].includes(command.type)) {
        assert.equal(typeof command.field, 'string', `${modifier.id}/${hookName}/${command.type} needs field`);
      }
      if (command.type === ROOM_MODIFIER_COMMAND_TYPES.ADD) assert.ok(Number.isFinite(command.value), `${modifier.id}/${hookName}/add needs numeric value`);
      if (command.type === ROOM_MODIFIER_COMMAND_TYPES.SCALE) assert.ok(Number.isFinite(command.factor ?? command.value), `${modifier.id}/${hookName}/scale needs numeric factor/value`);
      if (command.type === ROOM_MODIFIER_COMMAND_TYPES.TAG) assert.ok(typeof (command.tag ?? command.value) === 'string', `${modifier.id}/${hookName}/tag needs tag/value`);
      if (command.type === ROOM_MODIFIER_COMMAND_TYPES.EMIT_EVENT) assert.equal(typeof command.event?.type, 'string', `${modifier.id}/${hookName}/emitEvent needs event.type`);
      for (const conditionField of ['requiresTags', 'requiresAnyTag', 'excludesTags', 'requiresFields', 'excludesFields']) {
        if (command[conditionField] !== undefined) assertStringArray(command[conditionField], `${modifier.id}/${hookName}/${conditionField}`);
      }
      if (command.requiresField !== undefined) assert.equal(typeof command.requiresField, 'string', `${modifier.id}/${hookName}/requiresField must be a string`);
      if (command.excludesField !== undefined) assert.equal(typeof command.excludesField, 'string', `${modifier.id}/${hookName}/excludesField must be a string`);

      if (domain === 'room') {
        const state = { events: [] };
        const ctx = { ...(sampleContexts[hookName] || { tags: [] }) };
        if (Array.isArray(ctx.tags)) ctx.tags = [...ctx.tags];
        const result = executeRoomModifierCommand(state, hookName, ctx, command, modifier.id);
        assert.notEqual(result.reason, 'unknown-command', `${modifier.id}/${hookName} command is unknown`);
        assert.notEqual(result.reason, 'field-not-allowed', `${modifier.id}/${hookName} command writes disallowed field: ${command.field}`);
        assert.notEqual(result.reason, 'bad-command', `${modifier.id}/${hookName} command is malformed`);
      }
    }
  }
}

const roomModifierIds = Object.keys(ROOM_MODIFIERS);
assertUnique(roomModifierIds, 'room modifier');
for (const [id, modifier] of Object.entries(ROOM_MODIFIERS)) {
  assert.equal(modifier.id, id, `room modifier key/id mismatch: ${id}`);
  assert.equal(typeof modifier.name, 'string', `${id} needs name`);
  assert.equal(typeof modifier.description, 'string', `${id} needs description`);
  assert.equal(typeof modifier.category, 'string', `${id} needs category`);
  assertStringArray(modifier.tags || [], `${id}.tags`);
  verifyHookCommands(modifier, 'room');
}

const staticLoc = { modifiers: [ROOM_MODIFIERS.static_field] };
const enemyCtx = runRoomModifierHooksForLocation(staticLoc, ROOM_MODIFIER_HOOKS.ENEMY_UPDATE, { speedMult: 1, damageMult: 1, tags: [] });
assert.equal(Number(enemyCtx.speedMult.toFixed(2)), 1.1, 'static_field enemy:update scale contract should execute through generic hook runner');
const healCtx = runRoomModifierHooksForLocation(staticLoc, ROOM_MODIFIER_HOOKS.PLAYER_HEAL, { amount: 20, allowRevive: false, minHp: 0, tags: [] });
assert.equal(Number(healCtx.amount.toFixed(2)), 11, 'static_field player:heal scale contract should execute through generic hook runner');

const chatLoc = { modifiers: [ROOM_MODIFIERS.live_chat_hates_you] };
const chatBatchCtx = runRoomModifierHooksForLocation(chatLoc, ROOM_MODIFIER_HOOKS.DIRECTOR_SPAWN, { batch: 2, canSpawn: true, tags: ['director', 'spawn', 'batch'] });
assert.equal(chatBatchCtx.batch, 3, 'live_chat_hates_you should add batch only on batch-tagged spawn context');
const chatIntervalCtx = runRoomModifierHooksForLocation(chatLoc, ROOM_MODIFIER_HOOKS.DIRECTOR_SPAWN, { interval: 1, canSpawn: true, tags: ['director', 'spawn', 'interval'] });
assert.equal(Number(chatIntervalCtx.interval.toFixed(2)), 0.92, 'live_chat_hates_you should scale interval only on interval-tagged spawn context');
const boostLoc = { modifiers: [ROOM_MODIFIERS.algorithm_boost] };
const lootCtx = runRoomModifierHooksForLocation(boostLoc, ROOM_MODIFIER_HOOKS.LOOT_ROLL, { chance: 0.2, rareBonus: 0, tags: ['loot', 'roll'] });
assert.equal(Number(lootCtx.chance.toFixed(2)), 0.25, 'algorithm_boost should improve loot chance through loot hook');
assert.equal(Number(lootCtx.rareBonus.toFixed(2)), 0.08, 'algorithm_boost should add rare bonus through loot hook');
const godLoc = { modifiers: [ROOM_MODIFIERS.static_god] };
const hostileProjectileCtx = runRoomModifierHooksForLocation(godLoc, ROOM_MODIFIER_HOOKS.PROJECTILE_UPDATE, { speedMult: 1, tags: ['projectile', 'update', 'hostile'] });
assert.equal(Number(hostileProjectileCtx.speedMult.toFixed(2)), 0.78, 'static_god should slow hostile projectiles through tag-gated command');
const playerProjectileCtx = runRoomModifierHooksForLocation(godLoc, ROOM_MODIFIER_HOOKS.PROJECTILE_UPDATE, { speedMult: 1, tags: ['projectile', 'update', 'player'] });
assert.equal(playerProjectileCtx.speedMult, 1, 'static_god should not slow player projectiles');

const requiredStackFiles = [
  'src/data/modifierDomains.js',
  'src/data/ruleModifiers.js',
  'src/game/modifierBudget.js',
  'src/game/modifierResolver.js',
  'src/game/modifierStack.js'
];
for (const rel of requiredStackFiles) assert.ok(exists(rel), `rule modifier stack foundation file missing: ${rel}`);

const ruleModifiers = RULE_MODIFIERS || {};
assertUnique(Object.keys(ruleModifiers), 'rule modifier');
for (const domain of VALID_DOMAINS) {
  assert.ok(RULE_MODIFIERS_BY_DOMAIN[domain], `RULE_MODIFIERS_BY_DOMAIN must expose domain bucket: ${domain}`);
}

for (const [id, modifier] of Object.entries(ruleModifiers)) {
  assert.equal(modifier.id, id, `rule modifier key/id mismatch: ${id}`);
  assert.ok(VALID_DOMAINS.has(modifier.domain), `${id} invalid domain: ${modifier.domain}`);
  assert.ok(VALID_POLARITIES.has(modifier.polarity), `${id} invalid polarity: ${modifier.polarity}`);
  assert.ok(VALID_RARITIES.has(modifier.rarity), `${id} invalid rarity: ${modifier.rarity}`);
  assertStringArray(modifier.tags || [], `${id}.tags`);
  assertStringArray(modifier.conflictsWith || [], `${id}.conflictsWith`);
  assertStringArray(modifier.requires || [], `${id}.requires`);
  for (const requirement of modifier.requires || []) {
    assert.ok(VALID_REQUIREMENTS.has(requirement) || (modifier.tags || []).includes(requirement), `${id} has unknown required feature/tag: ${requirement}`);
  }
  for (const conflict of modifier.conflictsWith || []) {
    assert.ok(ruleModifiers[conflict], `${id} conflictsWith unknown modifier: ${conflict}`);
  }
  assert.ok(Number.isFinite(modifier.weight) && modifier.weight >= 0, `${id}.weight must be non-negative`);
  assert.ok(Number.isInteger(modifier.maxStacks || 1) && (modifier.maxStacks || 1) >= 1, `${id}.maxStacks must be >= 1`);
  verifyBudget(modifier.budget, id);
  verifyHookCommands(modifier, modifier.domain);
}

assert.deepEqual(Object.keys(ROOM_MODIFIERS).sort(), Object.keys(RULE_MODIFIERS_BY_DOMAIN[MODIFIER_DOMAINS.ROOM]).sort(), 'room modifier compatibility wrapper must mirror room-domain rule modifiers');
assert.deepEqual(normalizeModifierBudget({ danger: 2, chaos: 1 }), { readability: 0, danger: 2, performance: 0, chaos: 1 }, 'modifier budget normalization must fill all fields');
assert.equal(maxRoomModifiersForLoop(0), 1, 'loop 0 should allow at most 1 room modifier');
assert.equal(maxRoomModifiersForLoop(1), 2, 'loop 1 should allow at most 2 room modifiers');
assert.equal(maxRoomModifiersForLoop(2), 3, 'loop 2 should allow at most 3 room modifiers');
assert.equal(maxRoomModifiersForLoop(3), 5, 'loop 3+ should allow up to 5 room modifiers');

const genericStack = resolveModifierStack({
  domain: MODIFIER_DOMAINS.ROOM,
  baseIds: ['grid_static'],
  candidateIds: ['static_field'],
  maxModifiers: 2,
  budgetLimits: roomModifierBudgetLimitsForMaxStack(2),
  seed: 'verify-stack'
});
assert.deepEqual(genericStack.modifierIds, ['grid_static', 'static_field'], 'generic resolver should add a valid candidate inside budget/conflict limits');
assert.equal(genericStack.domain, MODIFIER_DOMAINS.ROOM, 'generic resolver should preserve domain');

const verticalSliceStack = resolveModifierStack({
  domain: MODIFIER_DOMAINS.ROOM,
  baseIds: ['grid_static'],
  candidateIds: ['live_chat_hates_you', 'algorithm_boost', 'static_god'],
  maxModifiers: 4,
  budgetLimits: roomModifierBudgetLimitsForMaxStack(4),
  context: { features: ['loot', 'hostileProjectiles'] },
  seed: 'verify-vertical-slice-stack'
});
assert.ok(verticalSliceStack.modifierIds.includes('live_chat_hates_you'), 'vertical slice stack should be able to resolve live_chat_hates_you');
assert.ok(verticalSliceStack.modifierIds.includes('algorithm_boost'), 'vertical slice stack should be able to resolve algorithm_boost when loot exists');
assert.ok(verticalSliceStack.modifierIds.includes('static_god'), 'vertical slice stack should be able to resolve static_god when hostile projectiles exist');
assert.equal(verticalSliceStack.modifierIds[0], 'grid_static', 'identity modifiers should stay first after order sorting');

const roomStack = resolveRoomModifierStack({
  baseModifierIds: ['static_field'],
  loopIndex: 1,
  profile: { modifiers: { stackChance: 1, maxExtraModifiers: 0, modifierIds: [] } },
  seed: 'verify-room-stack'
});
assert.deepEqual(roomStack.modifierIds, ['static_field'], 'room stack should preserve existing room modifiers without adding content by default');
assert.equal(roomStack.maxModifiers, 1, 'room stack should keep behavior-neutral max when loop profile exposes no extra modifier slots');

console.log(`universal modifier contract verification passed (${roomModifierIds.length} room modifiers; ${Object.keys(ruleModifiers).length} rule modifiers; rule stack foundation present)`);
