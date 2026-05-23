import { dist2, norm } from "../../core/math.js";
import { DAMAGE_TAGS, dealPlayerDamage } from "../effects.js";
import { devEnemyDamageMult } from "../dev.js";
import { pushVisualEffect } from "../effectCommands.js";
import { moveCircleInLocation } from "../roomGeometry.js";
import { applyEnemyTouchDamage } from "./common.js";

function runtime(enemy, target, cfg) {
  if (!enemy.bounceState || typeof enemy.bounceState !== "object") {
    const d = norm(target.x - enemy.x, target.y - enemy.y);
    enemy.bounceState = { bounces: 0, stun: 0 };
    enemy.vx = d.x * (cfg.speed || 220);
    enemy.vy = d.y * (cfg.speed || 220);
  }
  return enemy.bounceState;
}

function hitPlayers(state, enemy, data, updateCtx) {
  for (const player of Object.values(state.players || {})) {
    if (!player || player.hp <= 0) continue;
    const r = enemy.radius + player.radius + 2;
    if (dist2(enemy.x, enemy.y, player.x, player.y) > r * r) continue;
    dealPlayerDamage(state, player, { amount: data.damage * Math.max(0, updateCtx.damageMult || 1) * devEnemyDamageMult(state), sourceId: enemy.id, sourceType: "enemyBounce", enemyId: enemy.id, tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH, "bounce"] });
  }
}

export function updateBouncerEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = data.bounce || {};
  const rt = runtime(enemy, target, cfg);
  if ((rt.stun || 0) > 0) {
    rt.stun -= dt;
    enemy.vx *= Math.exp(-8 * dt);
    enemy.vy *= Math.exp(-8 * dt);
    const d = norm(target.x - enemy.x, target.y - enemy.y);
    if (rt.stun <= 0) { enemy.vx = d.x * (cfg.speed || 220); enemy.vy = d.y * (cfg.speed || 220); rt.bounces = 0; }
    return;
  }
  const moved = moveCircleInLocation(geometry, enemy.x, enemy.y, enemy.vx * dt, enemy.vy * dt, enemy.radius);
  enemy.x = moved.x; enemy.y = moved.y;
  if (moved.hitX || moved.hitY) {
    if (moved.hitX) enemy.vx *= -1;
    if (moved.hitY) enemy.vy *= -1;
    const speed = Math.min(cfg.maxSpeed || 380, Math.hypot(enemy.vx, enemy.vy) * (cfg.speedGain || 1.08));
    const d = norm(enemy.vx, enemy.vy);
    enemy.vx = d.x * speed; enemy.vy = d.y * speed;
    rt.bounces = (rt.bounces || 0) + 1;
    pushVisualEffect(state, { type: "ricochet", x: Math.round(enemy.x), y: Math.round(enemy.y), vx: Math.round(enemy.vx), vy: Math.round(enemy.vy), color: "#ff3048", life: 0.12, maxLife: 0.12 });
    if (rt.bounces >= (cfg.stunAfter || 5)) rt.stun = cfg.stunTime || 0.55;
  }
  hitPlayers(state, enemy, data, updateCtx);
}
