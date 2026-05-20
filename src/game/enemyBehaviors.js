import { dist2, norm } from "../core/math.js";
import { DAMAGE_TAGS, dealPlayerDamage, enemySlowMult } from "./effects.js";
import { devEnemyDamageMult, devEnemySpeedMult } from "./dev.js";
import { moveCircleInLocation } from "./roomGeometry.js";
import { pushVisualEffect } from "./effectCommands.js";

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

function moveEnemyWithVelocity(enemy, geometry, dt) {
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
  return moved;
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
  moveEnemyWithVelocity(enemy, geometry, dt);
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


function chargerRuntime(enemy) {
  if (!enemy.charge || typeof enemy.charge !== "object") {
    enemy.charge = { phase: "chase", timer: 0, dx: 0, dy: 0, telegraphAt: 0, hitPlayers: [] };
  }
  if (!Array.isArray(enemy.charge.hitPlayers)) enemy.charge.hitPlayers = [];
  return enemy.charge;
}

function chargeConfig(data) {
  const cfg = data.charge || {};
  return {
    acquireRange: cfg.acquireRange || 520,
    minRange: cfg.minRange || 70,
    windup: cfg.windup || 0.58,
    dashTime: cfg.dashTime || 0.34,
    cooldown: cfg.cooldown || 0.82,
    speed: cfg.speed || 720,
    damage: cfg.damage || data.damage * 2.1,
    knockback: cfg.knockback || 360,
    telegraphEvery: cfg.telegraphEvery || 0.12,
    slowChaseScale: cfg.slowChaseScale || 0.42
  };
}

function emitChargeTelegraph(state, enemy, charge, cfg) {
  const now = state.time || 0;
  if ((charge.telegraphAt || 0) > now) return;
  charge.telegraphAt = now + cfg.telegraphEvery;
  pushVisualEffect(state, {
    type: "chargeTelegraph",
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    x2: Math.round(enemy.x + charge.dx * cfg.speed * cfg.dashTime),
    y2: Math.round(enemy.y + charge.dy * cfg.speed * cfg.dashTime),
    life: Math.min(0.18, cfg.windup),
    maxLife: Math.min(0.18, cfg.windup),
    color: "#ff3048"
  });
}

function chargeHitPlayers(state, enemy, data, charge, cfg, updateCtx) {
  const hit = new Set(charge.hitPlayers || []);
  for (const player of Object.values(state.players || {})) {
    if (!player || player.hp <= 0 || hit.has(player.id)) continue;
    const r = enemy.radius + player.radius + 4;
    if (dist2(enemy.x, enemy.y, player.x, player.y) > r * r) continue;

    dealPlayerDamage(state, player, {
      amount: cfg.damage * Math.max(0, updateCtx.damageMult || 1) * devEnemyDamageMult(state),
      sourceId: enemy.id,
      sourceType: "enemyCharge",
      enemyId: enemy.id,
      tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH, "charge"]
    });
    const push = norm(player.x - enemy.x, player.y - enemy.y);
    player.kx = (player.kx || 0) + push.x * cfg.knockback;
    player.ky = (player.ky || 0) + push.y * cfg.knockback;
    hit.add(player.id);
  }
  charge.hitPlayers = [...hit];
}

function updateChargerEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = chargeConfig(data);
  const charge = chargerRuntime(enemy);
  const dx = target.x - enemy.x;
  const dy = target.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;

  if (charge.phase === "windup") {
    charge.timer -= dt;
    enemy.vx *= Math.exp(-12 * dt);
    enemy.vy *= Math.exp(-12 * dt);
    emitChargeTelegraph(state, enemy, charge, cfg);
    moveEnemyWithVelocity(enemy, geometry, dt);
    if (charge.timer <= 0) {
      charge.phase = "dash";
      charge.timer = cfg.dashTime;
      charge.hitPlayers = [];
      enemy.vx = charge.dx * cfg.speed * Math.max(0.05, updateCtx.speedMult || 1) * devEnemySpeedMult(state) * enemySlowMult(enemy);
      enemy.vy = charge.dy * cfg.speed * Math.max(0.05, updateCtx.speedMult || 1) * devEnemySpeedMult(state) * enemySlowMult(enemy);
      pushVisualEffect(state, {
        type: "dashBurst",
        x: Math.round(enemy.x),
        y: Math.round(enemy.y),
        vx: Math.round(enemy.vx),
        vy: Math.round(enemy.vy),
        life: 0.12,
        maxLife: 0.12
      });
    }
    return;
  }

  if (charge.phase === "dash") {
    charge.timer -= dt;
    const moved = moveEnemyWithVelocity(enemy, geometry, dt);
    chargeHitPlayers(state, enemy, data, charge, cfg, updateCtx);
    if (moved.hitX || moved.hitY || charge.timer <= 0) {
      charge.phase = "cooldown";
      charge.timer = cfg.cooldown;
      enemy.vx *= 0.16;
      enemy.vy *= 0.16;
    }
    return;
  }

  if (charge.phase === "cooldown") {
    charge.timer -= dt;
    moveEnemyTowardTarget(ctx, { speedScale: cfg.slowChaseScale });
    applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
    if (charge.timer <= 0) charge.phase = "chase";
    return;
  }

  if (distance <= cfg.acquireRange && distance >= cfg.minRange) {
    const dir = norm(dx, dy);
    charge.phase = "windup";
    charge.timer = cfg.windup;
    charge.dx = dir.x;
    charge.dy = dir.y;
    charge.telegraphAt = 0;
    emitChargeTelegraph(state, enemy, charge, cfg);
    enemy.vx *= 0.25;
    enemy.vy *= 0.25;
    return;
  }

  moveEnemyTowardTarget(ctx);
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}

function updateBossEnemy(ctx) {
  updateChaseEnemy(ctx);
}

export const ENEMY_BEHAVIORS = Object.freeze({
  chase: updateChaseEnemy,
  ranged: updateRangedEnemy,
  charger: updateChargerEnemy,
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
