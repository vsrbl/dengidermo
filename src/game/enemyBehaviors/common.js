import { dist2, norm } from "../../core/math.js";
import { ENEMIES } from "../../data/enemies.js";
import { DAMAGE_TAGS, dealPlayerDamage, enemySlowMult } from "../effects.js";
import { devEnemyDamageMult, devEnemySpeedMult } from "../dev.js";
import { moveCircleInLocation, resolveSpawnPointInState } from "../roomGeometry.js";
import { enemyPathDirection } from "../enemyPathfinding.js";
import { nextId } from "../entityIds.js";
import { initEnemyArmor } from "../enemyArmor.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyPlayerImpulse } from "../playerImpulse.js";

export function nearestAlivePlayer(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const p of Object.values(state.players || {})) {
    if (p.hp <= 0) continue;
    const d = dist2(x, y, p.x, p.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function enemySpeed(state, enemy, data, updateCtx, speedScale = 1) {
  return data.speed
    * enemySlowMult(enemy)
    * devEnemySpeedMult(state)
    * Math.max(0.05, updateCtx.speedMult || 1)
    * speedScale;
}

export function moveEnemyWithVelocity(enemy, geometry, dt) {
  enemy.kx = (enemy.kx || 0) * Math.exp(-6.8 * dt);
  enemy.ky = (enemy.ky || 0) * Math.exp(-6.8 * dt);

  const moved = moveCircleInLocation(
    geometry,
    enemy.x,
    enemy.y,
    (enemy.vx + (enemy.kx || 0)) * dt,
    (enemy.vy + (enemy.ky || 0)) * dt,
    enemy.radius
  );
  enemy.x = moved.x;
  enemy.y = moved.y;
  if (moved?.hit) {
    enemy.vx *= moved.hitX ? 0.12 : 0.9;
    enemy.vy *= moved.hitY ? 0.12 : 0.9;
  }
  return moved;
}

export function moveEnemyTowardTarget({ state, enemy, data, target, dt, geometry, updateCtx }, options = {}) {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const pathDir = enemyPathDirection(state, geometry, enemy, target, enemy.radius || data.radius || 12);
  const dir = pathDir || norm(dx, dy);
  const speed = enemySpeed(state, enemy, data, updateCtx, options.speedScale ?? 1);

  const targetVx = dir.x * speed;
  const targetVy = dir.y * speed;
  const t = 1 - Math.exp(-8 * dt);
  enemy.vx += (targetVx - enemy.vx) * t;
  enemy.vy += (targetVy - enemy.vy) * t;
  moveEnemyWithVelocity(enemy, geometry, dt);
}

export function applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx) {
  const touchR = enemy.radius + target.radius;
  if (dist2(enemy.x, enemy.y, target.x, target.y) > touchR * touchR) return;

  // ARCHITECTURE GUARD: player damage must flow through dealPlayerDamage().
  // Never mutate player.hp directly here; future armor/thorns/aura hooks depend on this contract.
  dealPlayerDamage(state, target, {
    amount: data.damage * Math.max(0, updateCtx.damageMult || 1) * devEnemyDamageMult(state) * dt,
    sourceId: enemy.id,
    sourceType: "enemyTouch",
    enemyId: enemy.id,
    tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH]
  });
  const push = norm(target.x - enemy.x, target.y - enemy.y);
  applyPlayerImpulse(state, target, {
    x: push.x * 70,
    y: push.y * 70,
    sourceId: enemy.id,
    sourceType: "enemyTouch",
    reason: "enemy_touch",
    reconcile: false
  });
}


export function spawnBehaviorEnemy(state, kind, x, y, options = {}) {
  const data = ENEMIES[kind];
  if (!state || !data) return null;
  const point = resolveSpawnPointInState(state, { x, y }, data.radius, { avoidPlayers: true });
  const enemy = {
    id: nextId("en"),
    kind,
    x: point.x,
    y: point.y,
    spawnZone: options.zone || "behavior",
    spawnAdjusted: !!point.adjusted,
    spawnAnchorId: null,
    spawnAnchorTags: null,
    spawnFromAnchor: false,
    parentEnemyId: options.parentEnemyId || null,
    role: options.role || "behavior",
    vx: options.vx || 0,
    vy: options.vy || 0,
    kx: 0,
    ky: 0,
    hp: data.hp,
    maxHp: data.hp,
    radius: data.radius,
    shootAt: 0
  };
  initEnemyArmor(enemy, data);
  state.enemies[enemy.id] = enemy;
  pushVisualEffect(state, {
    type: "anomalyField",
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    r: Math.max(18, data.radius + 12),
    color: options.color || "#ffffff",
    text: options.text || data.name || kind,
    life: 0.18,
    maxLife: 0.18
  });
  return enemy;
}

export function emitAnomalyLink(state, from, to, color = "#ffffff", life = 0.1) {
  if (!state || !from || !to) return;
  pushVisualEffect(state, {
    type: "anomalyLine",
    x: Math.round(from.x),
    y: Math.round(from.y),
    x2: Math.round(to.x),
    y2: Math.round(to.y),
    color,
    life,
    maxLife: life
  });
}
