import { getRoomModifier, modifierSnapshot, resolveRoomModifiers } from "../data/roomModifiers.js";
import { pushEvent } from "./events.js";

export const ROOM_MODIFIER_HOOKS = Object.freeze({
  ROOM_ENTER: "room:enter",
  ROOM_EXIT: "room:exit",
  DIRECTOR_BUDGET: "director:budget",
  DIRECTOR_SPAWN: "director:spawn",
  DIRECTOR_CAP: "director:cap",
  ENEMY_SPAWN: "enemy:spawn",
  ENEMY_UPDATE: "enemy:update",
  PROJECTILE_UPDATE: "projectile:update",
  PROJECTILE_WALL: "projectile:wall",
  PROJECTILE_DAMAGE: "projectile:damage",
  PLAYER_DAMAGE: "player:damage",
  PLAYER_HEAL: "player:heal",
  LOOT_ROLL: "loot:roll",
  PORTAL_OPEN: "portal:open",
  RENDER_BACKGROUND: "render:background"
});

export const ROOM_MODIFIER_COMMAND_TYPES = Object.freeze({
  ADD: "add",
  SCALE: "scale",
  SET: "set",
  TAG: "tag",
  EMIT_EVENT: "emitEvent"
});

const HOOK_FIELD_RULES = Object.freeze({
  [ROOM_MODIFIER_HOOKS.DIRECTOR_BUDGET]: Object.freeze({ budget: "number", totalBudget: "number" }),
  [ROOM_MODIFIER_HOOKS.DIRECTOR_SPAWN]: Object.freeze({ batch: "number", interval: "number", canSpawn: "boolean" }),
  [ROOM_MODIFIER_HOOKS.DIRECTOR_CAP]: Object.freeze({ enemyCap: "number" }),
  [ROOM_MODIFIER_HOOKS.ENEMY_SPAWN]: Object.freeze({ hp: "number", maxHp: "number", speedMult: "number", damageMult: "number" }),
  [ROOM_MODIFIER_HOOKS.ENEMY_UPDATE]: Object.freeze({ speedMult: "number", damageMult: "number" }),
  [ROOM_MODIFIER_HOOKS.PROJECTILE_UPDATE]: Object.freeze({ speedMult: "number" }),
  [ROOM_MODIFIER_HOOKS.PROJECTILE_WALL]: Object.freeze({ didRicochet: "boolean" }),
  [ROOM_MODIFIER_HOOKS.PROJECTILE_DAMAGE]: Object.freeze({ damage: "number", critical: "boolean" }),
  [ROOM_MODIFIER_HOOKS.PLAYER_DAMAGE]: Object.freeze({ damage: "number", blocked: "boolean", blockedBy: "string" }),
  [ROOM_MODIFIER_HOOKS.PLAYER_HEAL]: Object.freeze({ amount: "number", allowRevive: "boolean", minHp: "number" }),
  [ROOM_MODIFIER_HOOKS.LOOT_ROLL]: Object.freeze({ chance: "number", rareBonus: "number" }),
  [ROOM_MODIFIER_HOOKS.PORTAL_OPEN]: Object.freeze({ canOpen: "boolean" }),
  [ROOM_MODIFIER_HOOKS.RENDER_BACKGROUND]: Object.freeze({ accent: "string", gridStep: "number" })
});

const KNOWN_HOOKS = new Set(Object.values(ROOM_MODIFIER_HOOKS));
const clampNumber = (value, min = -Infinity, max = Infinity) => Math.max(min, Math.min(max, value));

function uniqueList(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function modifierIdsFromSource(source) {
  if (!source || typeof source !== "object") return [];
  if (Array.isArray(source.roomModifierIds)) return uniqueList(source.roomModifierIds);
  if (Array.isArray(source.modifierIds)) return uniqueList(source.modifierIds);
  if (Array.isArray(source.roomPlan?.modifierIds)) return uniqueList(source.roomPlan.modifierIds);
  if (Array.isArray(source.plan?.modifierIds)) return uniqueList(source.plan.modifierIds);
  if (Array.isArray(source.modifiers)) {
    return uniqueList(source.modifiers.map((modifier) => typeof modifier === "string" ? modifier : modifier?.id));
  }
  return [];
}

export function roomModifiersForLocation(loc) {
  if (Array.isArray(loc?.modifiers) && loc.modifiers.some((modifier) => modifier?.hooks)) {
    return loc.modifiers.filter((modifier) => modifier?.id);
  }
  return resolveRoomModifiers(modifierIdsFromSource(loc));
}

function roomModifiersForState(state, loc = null) {
  const fromLocation = roomModifiersForLocation(loc);
  if (fromLocation.length) return fromLocation;
  return resolveRoomModifiers(modifierIdsFromSource(state));
}

export function roomModifierSnapshots(loc) {
  return roomModifiersForLocation(loc).map(modifierSnapshot);
}

export function hasRoomModifier(loc, modifierId) {
  return roomModifiersForLocation(loc).some((modifier) => modifier.id === modifierId);
}

export function roomModifierHookCommands(loc, hookName, context = {}) {
  if (!KNOWN_HOOKS.has(hookName)) return [];
  const commands = [];
  for (const modifier of roomModifiersForLocation(loc)) {
    const hook = modifier.hooks?.[hookName];
    if (Array.isArray(hook)) commands.push(...hook.map((command) => ({ ...command, modifierId: modifier.id, context })));
  }
  return commands;
}

function ensureRuntime(state) {
  if (!state) return null;
  if (!state.roomModifierRuntime) {
    state.roomModifierRuntime = {
      activeIds: [],
      enteredAt: 0,
      hookCounts: {},
      commandCounts: {},
      rejectedCommands: 0,
      lastHook: null
    };
  }
  return state.roomModifierRuntime;
}

function noteHook(state, hookName, modifierId, commandResult = null) {
  const runtime = ensureRuntime(state);
  if (!runtime) return;
  runtime.lastHook = hookName;
  runtime.hookCounts[hookName] = (runtime.hookCounts[hookName] || 0) + 1;
  if (modifierId) runtime.lastModifierId = modifierId;
  if (commandResult?.executed) runtime.commandCounts[hookName] = (runtime.commandCounts[hookName] || 0) + 1;
  if (commandResult?.rejected) runtime.rejectedCommands += 1;
}

function fieldRulesFor(hookName) {
  return HOOK_FIELD_RULES[hookName] || Object.freeze({});
}

function valueMatchesRule(value, rule) {
  if (rule === "number") return Number.isFinite(value);
  if (rule === "boolean") return typeof value === "boolean";
  if (rule === "string") return typeof value === "string";
  return false;
}

function normalizeCommand(command, modifierId) {
  if (!command || typeof command !== "object" || typeof command.type !== "string") return null;
  return { ...command, modifierId };
}

function executeFieldCommand(ctx, command, hookName) {
  const field = command.field;
  const rules = fieldRulesFor(hookName);
  const rule = rules[field];
  if (!rule) return { rejected: true, reason: "field-not-allowed" };

  if (command.type === ROOM_MODIFIER_COMMAND_TYPES.ADD) {
    if (rule !== "number" || !Number.isFinite(command.value) || !Number.isFinite(ctx[field])) return { rejected: true, reason: "bad-add" };
    ctx[field] = clampNumber(ctx[field] + command.value, command.min ?? -Infinity, command.max ?? Infinity);
    return { executed: true };
  }

  if (command.type === ROOM_MODIFIER_COMMAND_TYPES.SCALE) {
    const factor = Number.isFinite(command.factor) ? command.factor : command.value;
    if (rule !== "number" || !Number.isFinite(factor) || !Number.isFinite(ctx[field])) return { rejected: true, reason: "bad-scale" };
    ctx[field] = clampNumber(ctx[field] * factor, command.min ?? -Infinity, command.max ?? Infinity);
    return { executed: true };
  }

  if (command.type === ROOM_MODIFIER_COMMAND_TYPES.SET) {
    if (!valueMatchesRule(command.value, rule)) return { rejected: true, reason: "bad-set" };
    ctx[field] = command.value;
    return { executed: true };
  }

  return { rejected: true, reason: "unknown-field-command" };
}

function executeTagCommand(ctx, command) {
  const tag = typeof command.tag === "string" ? command.tag : command.value;
  if (typeof tag !== "string" || !tag) return { rejected: true, reason: "bad-tag" };
  if (!Array.isArray(ctx.tags)) ctx.tags = [];
  if (!ctx.tags.includes(tag)) ctx.tags.push(tag);
  return { executed: true };
}

function executeEmitEventCommand(state, command, ctx) {
  const event = command.event;
  if (!state || !event || typeof event.type !== "string") return { rejected: true, reason: "bad-event" };
  pushEvent(state, {
    ...event,
    modifierId: command.modifierId || event.modifierId || null,
    hook: ctx.hookName || event.hook || null
  });
  return { executed: true };
}

export function executeRoomModifierCommand(state, hookName, ctx, rawCommand, modifierId = null) {
  const command = normalizeCommand(rawCommand, modifierId);
  if (!command || !KNOWN_HOOKS.has(hookName)) return { rejected: true, reason: "bad-command" };

  if (
    command.type === ROOM_MODIFIER_COMMAND_TYPES.ADD
    || command.type === ROOM_MODIFIER_COMMAND_TYPES.SCALE
    || command.type === ROOM_MODIFIER_COMMAND_TYPES.SET
  ) {
    return executeFieldCommand(ctx, command, hookName);
  }

  if (command.type === ROOM_MODIFIER_COMMAND_TYPES.TAG) return executeTagCommand(ctx, command);
  if (command.type === ROOM_MODIFIER_COMMAND_TYPES.EMIT_EVENT) return executeEmitEventCommand(state, command, ctx);
  return { rejected: true, reason: "unknown-command" };
}

export function runRoomModifierHooksForLocation(loc, hookName, context = {}, options = {}) {
  if (!KNOWN_HOOKS.has(hookName)) return context;
  const ctx = { ...context, hookName };
  const modifiers = options.modifiers || roomModifiersForLocation(loc);

  for (const modifier of modifiers) {
    const hook = modifier?.hooks?.[hookName];
    if (!Array.isArray(hook) || hook.length === 0) continue;
    for (const command of hook) {
      executeRoomModifierCommand(options.state || null, hookName, ctx, command, modifier.id);
    }
  }

  return ctx;
}

export function runRoomModifierHooks(state, hookName, context = {}, options = {}) {
  if (!KNOWN_HOOKS.has(hookName)) return context;
  const loc = options.location || context.location || null;
  const modifiers = options.modifiers || roomModifiersForState(state, loc);
  const ctx = { ...context, hookName };

  for (const modifier of modifiers) {
    const hook = modifier?.hooks?.[hookName];
    if (!Array.isArray(hook) || hook.length === 0) continue;
    noteHook(state, hookName, modifier.id);
    for (const command of hook) {
      const result = executeRoomModifierCommand(state, hookName, ctx, command, modifier.id);
      noteHook(state, hookName, modifier.id, result);
    }
  }

  return ctx;
}

export function enterRoomModifierRuntime(state, loc, context = {}) {
  const runtime = ensureRuntime(state);
  if (!runtime) return null;
  runtime.activeIds = roomModifiersForLocation(loc).map((modifier) => modifier.id);
  runtime.enteredAt = Number.isFinite(state?.time) ? state.time : 0;
  runtime.hookCounts = {};
  runtime.commandCounts = {};
  runtime.rejectedCommands = 0;
  runtime.lastHook = null;
  runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.ROOM_ENTER, { ...context, location: loc }, { location: loc });
  return runtime;
}

export function exitRoomModifierRuntime(state, loc, context = {}) {
  const runtime = ensureRuntime(state);
  if (!runtime) return null;
  runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.ROOM_EXIT, { ...context, location: loc }, { location: loc });
  runtime.activeIds = [];
  runtime.exitedAt = Number.isFinite(state?.time) ? state.time : 0;
  runtime.lastHook = ROOM_MODIFIER_HOOKS.ROOM_EXIT;
  return runtime;
}

export function clearRoomModifierRuntime(state) {
  if (state) state.roomModifierRuntime = null;
}
