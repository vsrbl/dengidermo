import { dist2, norm } from "../../core/math.js";
import { DAMAGE_TAGS, dealPlayerDamage } from "../effects.js";
import { devEnemyDamageMult } from "../dev.js";
import { pushVisualEffect } from "../effectCommands.js";
import { moveCircleInLocation } from "../roomGeometry.js";

function runtime(enemy, target, cfg) {
  if (!enemy.bounceState || typeof enemy.bounceState !== "object") {
    const d = norm(target.x - enemy.x, target.y - enemy.y);
    enemy.bounceState = { bounces: 0, playerHitAt: {} };
    enemy.vx = d.x * (cfg.speed || 235);
    enemy.vy = d.y * (cfg.speed || 235);
  }
  if (!enemy.bounceState.playerHitAt) enemy.bounceState.playerHitAt = {};
  return enemy.bounceState;
}

function normalizeSpeed(enemy, speed) {
  const d = norm(enemy.vx || 1, enemy.vy || 0);
  enemy.vx = d.x * speed;
  enemy.vy = d.y * speed;
}

function hitPlayers(state, enemy, data, cfg, rt, updateCtx) {
  const now = state.time || 0;
  for (const player of Object.values(state.players || {})) {
    if (!player || player.hp <= 0) continue;
    const r = enemy.radius + player.radius + 2;
    if (dist2(enemy.x, enemy.y, player.x, player.y) > r * r) continue;
    if ((rt.playerHitAt[player.id] || 0) > now) continue;
    rt.playerHitAt[player.id] = now + (cfg.hitCooldown || 0.22);
    dealPlayerDamage(state, player, {
      amount: data.damage * Math.max(0, updateCtx.damageMult || 1) * devEnemyDamageMult(state),
      sourceId: enemy.id,
      sourceType: "enemyBounce",
      enemyId: enemy.id,
      tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH, "bounce"]
    });
    const awayFromPlayer = norm(enemy.x - player.x, enemy.y - player.y);
    const pushPlayer = norm(player.x - enemy.x, player.y - enemy.y);
    player.kx = (player.kx || 0) + pushPlayer.x * (cfg.playerKnockback || 460);
    player.ky = (player.ky || 0) + pushPlayer.y * (cfg.playerKnockback || 460);
    const speed = Math.min(cfg.maxSpeed || 520, Math.max(cfg.speed || 235, Math.hypot(enemy.vx, enemy.vy) * (cfg.playerBounceGain || 1.04)));
    enemy.vx = awayFromPlayer.x * speed;
    enemy.vy = awayFromPlayer.y * speed;
    rt.bounces = (rt.bounces || 0) + 1;
    pushVisualEffect(state, { type: "ricochet", x: Math.round(enemy.x), y: Math.round(enemy.y), vx: Math.round(enemy.vx), vy: Math.round(enemy.vy), color: "#ff3048", life: 0.14, maxLife: 0.14 });
  }
}

export function updateBouncerEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = data.bounce || {};
  const rt = runtime(enemy, target, cfg);
  const moved = moveCircleInLocation(geometry, enemy.x, enemy.y, enemy.vx * dt, enemy.vy * dt, enemy.radius);
  enemy.x = moved.x;
  enemy.y = moved.y;
  if (moved.hitX || moved.hitY) {
    if (moved.hitX) enemy.vx *= -1;
    if (moved.hitY) enemy.vy *= -1;
    const speed = Math.min(cfg.maxSpeed || 520, Math.hypot(enemy.vx, enemy.vy) * (cfg.speedGain || 1.08));
    normalizeSpeed(enemy, speed);
    rt.bounces = (rt.bounces || 0) + 1;
    pushVisualEffect(state, { type: "ricochet", x: Math.round(enemy.x), y: Math.round(enemy.y), vx: Math.round(enemy.vx), vy: Math.round(enemy.vy), color: "#ff3048", life: 0.12, maxLife: 0.12 });
  }
  hitPlayers(state, enemy, data, cfg, rt, updateCtx);
}
