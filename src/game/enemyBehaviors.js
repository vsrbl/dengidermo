import { dist2, norm } from "../core/math.js";
import { DAMAGE_TAGS, dealPlayerDamage, enemySlowMult } from "./effects.js";
import { devEnemyDamageMult, devEnemySpeedMult } from "./dev.js";
import { moveCircleInLocation } from "./roomGeometry.js";

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

function enemySpeed(state, enemy, data, updateCtx, speedScale = 1) {
  return data.speed
    * enemySlowMult(enemy)
    * devEnemySpeedMult(state)
    * Math.max(0.05, updateCtx.speedMult || 1)
    * speedScale;
}

function moveEnemyTowardTarget({ state, enemy, data, target, dt, geometry, updateCtx }, options = {}) {
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const dir = norm(dx, dy);
  const speed = enemySpeed(state, enemy, data, updateCtx, options.speedScale ?? 1);

  const targetVx = dir.x * speed;
  const targetVy = dir.y * speed;
  const t = 1 - Math.exp(-8 * dt);
  enemy.vx += (targetVx - enemy.vx) * t;
  enemy.vy += (targetVy - enemy.vy) * t;
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
  if (moved.hitX) enemy.vx = 0;
  if (moved.hitY) enemy.vy = 0;
}

function applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx) {
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
  target.kx = (target.kx || 0) + push.x * 70;
  target.ky = (target.ky || 0) + push.y * 70;
}

function updateChaseEnemy(ctx) {
  moveEnemyTowardTarget(ctx);
  applyEnemyTouchDamage(ctx.state, ctx.enemy, ctx.data, ctx.target, ctx.dt, ctx.updateCtx);
}

function updateRangedEnemy(ctx) {
  const dx = ctx.target.x - ctx.enemy.x;
  const dy = ctx.target.y - ctx.enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  moveEnemyTowardTarget(ctx, { speedScale: distance < 300 ? -0.45 : 1 });
  applyEnemyTouchDamage(ctx.state, ctx.enemy, ctx.data, ctx.target, ctx.dt, ctx.updateCtx);
}

function updateBossEnemy(ctx) {
  updateChaseEnemy(ctx);
}

export const ENEMY_BEHAVIORS = Object.freeze({
  chase: updateChaseEnemy,
  ranged: updateRangedEnemy,
  boss: updateBossEnemy
});

export function resolveEnemyBehavior(data) {
  if (!data?.behavior) return null;
  return ENEMY_BEHAVIORS[data.behavior] || null;
}

export function unknownEnemyBehaviors(enemyDefs) {
  return Object.entries(enemyDefs || {})
    .filter(([, data]) => !resolveEnemyBehavior(data))
    .map(([kind, data]) => ({ kind, behavior: data?.behavior || null }));
}
