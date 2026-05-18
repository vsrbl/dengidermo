import { pushEvent } from "./state.js";

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
  event = null
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
    event
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

function spawnEnemyFromCommand(state, director, command, handlers, summary) {
  if (!command.kind || typeof handlers.spawnEnemy !== "function") {
    summary.failed += 1;
    return null;
  }

  const enemy = handlers.spawnEnemy(
    state,
    command.kind,
    Number.isFinite(command.x) ? command.x : null,
    Number.isFinite(command.y) ? command.y : null
  );
  if (!enemy) {
    summary.failed += 1;
    return null;
  }

  const cost = Math.max(0, Number(command.cost) || 0);
  if (director && command.budgeted !== false) {
    director.budget = Math.max(0, (director.budget || 0) - cost);
    director.spentBudget = (director.spentBudget || 0) + cost;
  }
  if (command.markBossSpawned) state.bossSpawned = true;
  if (command.markEliteSpawned && director) director.eliteSpawned = true;

  summary.executed += 1;
  summary.spawned += 1;
  count(summary, "spawnedByRole", command.role || "wave");

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
    spawnedByRole: {}
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
