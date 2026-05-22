import { ENEMIES } from "../data/enemies.js";
import { pushEvent } from "./events.js";

export const DIRECTOR_COMMAND_TYPES = Object.freeze({
  SPAWN_ENEMY: "spawnEnemy",
  EMIT_EVENT: "emitEvent"
});

export function directorSpawnEnemyCommand({
  kind,
  x = null,
  y = null,
  cost = 1,
  role = "wave",
  budgeted = true,
  markBossSpawned = false,
  markEliteSpawned = false,
  event = null,
  zone = null,
  anchorId = null,
  anchorTags = null,
  scriptedSpawnId = null,
  eliteVariantId = null,
  armorVariantId = null
}) {
  return {
    type: DIRECTOR_COMMAND_TYPES.SPAWN_ENEMY,
    kind,
    x,
    y,
    cost,
    role,
    budgeted,
    markBossSpawned,
    markEliteSpawned,
    event,
    zone,
    anchorId,
    anchorTags: Array.isArray(anchorTags) ? [...anchorTags] : null,
    scriptedSpawnId: scriptedSpawnId || null,
    eliteVariantId: eliteVariantId || null,
    armorVariantId: armorVariantId || null
  };
}

export function directorEventCommand(event) {
  return {
    type: DIRECTOR_COMMAND_TYPES.EMIT_EVENT,
    event
  };
}

function count(summary, bucket, key) {
  summary[bucket][key] = (summary[bucket][key] || 0) + 1;
}

function enemyCount(state) {
  return Object.keys(state.enemies || {}).length;
}

function commandCost(command) {
  return Math.max(0, Number(command.cost) || 0);
}

function canExecuteSpawnCommand(state, director, command, handlers) {
  if (!command.kind || !ENEMIES[command.kind]) return false;
  if (typeof handlers.spawnEnemy !== "function") return false;
  if (director?.policy && director.policy.canSpawn === false) return false;

  if (Number.isFinite(director?.enemyCap) && enemyCount(state) >= director.enemyCap) return false;

  if (command.budgeted !== false) {
    const budget = Number.isFinite(director?.budget) ? director.budget : Infinity;
    if (budget < commandCost(command)) return false;
  }

  return true;
}

function spawnEnemyFromCommand(state, director, command, handlers, summary) {
  if (!canExecuteSpawnCommand(state, director, command, handlers)) {
    summary.failed += 1;
    return null;
  }

  const enemy = handlers.spawnEnemy(
    state,
    command.kind,
    Number.isFinite(command.x) ? command.x : null,
    Number.isFinite(command.y) ? command.y : null,
    {
      zone: command.zone || null,
      role: command.role || "wave",
      anchorId: command.anchorId || null,
      anchorTags: command.anchorTags || null,
      eliteVariantId: command.eliteVariantId || null,
      armorVariantId: command.armorVariantId || null
    }
  );
  if (!enemy) {
    summary.failed += 1;
    return null;
  }

  const cost = commandCost(command);
  if (director && command.budgeted !== false) {
    director.budget = Math.max(0, (director.budget || 0) - cost);
    director.spentBudget = (director.spentBudget || 0) + cost;
  }
  if (command.markBossSpawned) state.bossSpawned = true;
  if (director) {
    if (command.markEliteSpawned) director.eliteSpawned = true;
    director.lastSpawn = {
      kind: command.kind,
      role: command.role || "wave",
      zone: command.zone || enemy.spawnZone || null,
      at: Number((state.locationTime || 0).toFixed(3))
    };
  }

  summary.executed += 1;
  summary.spawned += 1;
  count(summary, "spawnedByRole", command.role || "wave");
  if (command.scriptedSpawnId) summary.scriptedSpawnIds.push(command.scriptedSpawnId);

  if (command.event) {
    pushEvent(state, {
      ...command.event,
      x: Number.isFinite(command.event.x) ? command.event.x : enemy.x,
      y: Number.isFinite(command.event.y) ? command.event.y : enemy.y
    });
    summary.events += 1;
  }
  return enemy;
}

export function executeDirectorCommands(state, director, commands = [], handlers = {}) {
  const summary = {
    executed: 0,
    failed: 0,
    spawned: 0,
    events: 0,
    spawnedByRole: {},
    scriptedSpawnIds: []
  };

  for (const command of commands) {
    if (!command || !command.type) continue;

    if (command.type === DIRECTOR_COMMAND_TYPES.SPAWN_ENEMY) {
      spawnEnemyFromCommand(state, director, command, handlers, summary);
      continue;
    }

    if (command.type === DIRECTOR_COMMAND_TYPES.EMIT_EVENT) {
      if (!command.event) {
        summary.failed += 1;
        continue;
      }
      pushEvent(state, command.event);
      summary.executed += 1;
      summary.events += 1;
      continue;
    }

    summary.failed += 1;
  }

  return summary;
}
