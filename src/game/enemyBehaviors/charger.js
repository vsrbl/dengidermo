import { dist2, norm } from "../../core/math.js";
import { DAMAGE_TAGS, dealPlayerDamage, enemySlowMult } from "../effects.js";
import { devEnemyDamageMult, devEnemySpeedMult } from "../dev.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyPlayerImpulse } from "../playerImpulse.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget, moveEnemyWithVelocity } from "./common.js";

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

function chargeHitPlayers(state, enemy, charge, cfg, updateCtx) {
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
    applyPlayerImpulse(state, player, {
      x: push.x * cfg.knockback,
      y: push.y * cfg.knockback,
      sourceId: enemy.id,
      sourceType: "enemyCharge",
      reason: "charger_dash_hit"
    });
    hit.add(player.id);
  }
  charge.hitPlayers = [...hit];
}

export function updateChargerEnemy(ctx) {
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
    chargeHitPlayers(state, enemy, charge, cfg, updateCtx);
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
