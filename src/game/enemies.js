import { ENEMIES } from "../data/enemies.js";
import { nextId } from "./entityIds.js";
import { updateDirectorSpawner } from "./director.js";
import { resolveSpawnPoint } from "./spawnZones.js";
import { resolveSpawnPointInState, roomGeometrySnapshotForState } from "./roomGeometry.js";
import { ROOM_MODIFIER_HOOKS, runRoomModifierHooks } from "./roomModifiers.js";
import { nearestAlivePlayer, resolveEnemyBehavior } from "./enemyBehaviors.js";
import { initEnemyArmor, updateEnemyArmor } from "./enemyArmor.js";

export function spawnEnemy(state, kind, x = null, y = null, options = {}) {
  const data = ENEMIES[kind];
  if (!data) return null;
  const id = nextId("en");
  let spawnZone = options.zone || null;
  let spawnAdjusted = false;
  if (x === null || y === null) {
    const point = resolveSpawnPoint(state, spawnZone || "edge_random", data.radius, {
      role: options.role || "wave",
      anchorId: options.anchorId || null,
      anchorTags: options.anchorTags || null
    });
    x = point.x;
    y = point.y;
    spawnAdjusted = !!point.adjusted;
    spawnZone = spawnZone || "edge_random";
    options.anchorId = point.anchorId || options.anchorId || null;
    options.anchorTags = point.anchorTags || options.anchorTags || null;
    options.fromAnchor = !!point.fromAnchor;
  } else {
    const point = resolveSpawnPointInState(state, { x, y }, data.radius, { avoidPlayers: false });
    x = point.x;
    y = point.y;
    spawnAdjusted = !!point.adjusted;
    spawnZone = spawnZone || "explicit";
  }
  const enemy = {
    id,
    kind,
    x,
    y,
    spawnZone,
    spawnAdjusted,
    spawnAnchorId: options.anchorId || null,
    spawnAnchorTags: Array.isArray(options.anchorTags) ? [...options.anchorTags] : null,
    spawnFromAnchor: !!options.fromAnchor,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    hp: data.hp,
    maxHp: data.hp,
    radius: data.radius,
    shootAt: 0
  };
  initEnemyArmor(enemy, data);
  const spawnCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.ENEMY_SPAWN, {
    enemy,
    kind,
    role: options.role || "wave",
    hp: enemy.hp,
    maxHp: enemy.maxHp,
    speedMult: 1,
    damageMult: 1,
    tags: ["enemy", "spawn"]
  });
  enemy.hp = Math.max(1, Math.round(spawnCtx.hp));
  enemy.maxHp = Math.max(enemy.hp, Math.round(spawnCtx.maxHp || enemy.maxHp));
  enemy.speedMult = Math.max(0.05, spawnCtx.speedMult || 1);
  enemy.damageMult = Math.max(0, spawnCtx.damageMult || 1);
  state.enemies[id] = enemy;
  return enemy;
}

export function updateSpawner(state, dt) {
  // v38: enemies.js owns enemy entities and movement; room pacing decisions live in director.js.
  updateDirectorSpawner(state, dt, spawnEnemy);
}

export function updateEnemies(state, dt) {
  const geometry = roomGeometrySnapshotForState(state);
  for (const enemy of Object.values(state.enemies)) {
    const data = ENEMIES[enemy.kind];
    updateEnemyArmor(state, enemy, dt);
    const target = nearestAlivePlayer(state, enemy.x, enemy.y);
    if (!target) continue;

    const updateCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.ENEMY_UPDATE, {
      enemy,
      kind: enemy.kind,
      dt,
      speedMult: enemy.speedMult || 1,
      damageMult: enemy.damageMult || 1,
      tags: ["enemy", "update"]
    });
    const behavior = resolveEnemyBehavior(data);
    if (!behavior) continue;
    behavior({ state, enemy, data, target, dt, geometry, updateCtx });
  }
}
