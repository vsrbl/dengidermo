import { norm } from "../../core/math.js";
import { DAMAGE_TAGS, dealPlayerDamage } from "../effects.js";
import { devEnemyDamageMult, devEnemySpeedMult } from "../dev.js";
import { pushVisualEffect } from "../effectCommands.js";
import { resolveSpawnPointInState } from "../roomGeometry.js";
import { applyEnemyTouchDamage, moveEnemyWithVelocity } from "./common.js";

function runtime(enemy, cfg) {
  if (!enemy.glitchState || typeof enemy.glitchState !== "object") {
    enemy.glitchState = { phase: "cooldown", timer: (cfg.cooldown || 1.45) * 0.5, blurAt: 0, dashX: 0, dashY: 0 };
  }
  return enemy.glitchState;
}

function blinkNearTarget(state, enemy, target, cfg) {
  const oldX = enemy.x;
  const oldY = enemy.y;
  const angle = (state.rng?.range ? state.rng.range(0, Math.PI * 2) : Math.random() * Math.PI * 2);
  const range = cfg.blinkRange || 170;
  const point = resolveSpawnPointInState(state, { x: target.x + Math.cos(angle) * range, y: target.y + Math.sin(angle) * range }, enemy.radius, { avoidPlayers: true });
  enemy.x = point.x;
  enemy.y = point.y;
  enemy.vx = 0;
  enemy.vy = 0;
  pushVisualEffect(state, { type: "afterimage", x: Math.round(oldX), y: Math.round(oldY), angle, life: 0.22, maxLife: 0.22, skin: "purple" });
  pushVisualEffect(state, { type: "anomalyField", x: Math.round(enemy.x), y: Math.round(enemy.y), r: enemy.radius + 28, color: "#b45cff", life: 0.16, maxLife: 0.16 });
}

function hitDashPlayers(state, enemy, cfg, updateCtx) {
  for (const player of Object.values(state.players || {})) {
    if (!player || player.hp <= 0) continue;
    const r = enemy.radius + player.radius + 4;
    if ((player.x - enemy.x) ** 2 + (player.y - enemy.y) ** 2 > r * r) continue;
    dealPlayerDamage(state, player, {
      amount: (enemy.damage || 10) * Math.max(0, updateCtx.damageMult || 1) * devEnemyDamageMult(state),
      sourceId: enemy.id,
      sourceType: "enemyGlitchDash",
      enemyId: enemy.id,
      tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.TOUCH, "glitch"]
    });
    const d = norm(player.x - enemy.x, player.y - enemy.y);
    player.kx = (player.kx || 0) + d.x * (cfg.knockback || 260);
    player.ky = (player.ky || 0) + d.y * (cfg.knockback || 260);
  }
}

export function updateGlitchEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = data.glitch || {};
  const rt = runtime(enemy, cfg);
  const now = state.time || 0;
  rt.timer -= dt;
  if (rt.phase === "cooldown") {
    const d = norm(target.x - enemy.x, target.y - enemy.y);
    enemy.vx += (d.x * (data.speed || 110) * 0.5 - enemy.vx) * (1 - Math.exp(-6 * dt));
    enemy.vy += (d.y * (data.speed || 110) * 0.5 - enemy.vy) * (1 - Math.exp(-6 * dt));
    moveEnemyWithVelocity(enemy, geometry, dt);
    if (rt.timer <= 0) {
      blinkNearTarget(state, enemy, target, cfg);
      const dash = norm(target.x - enemy.x, target.y - enemy.y);
      rt.dashX = dash.x;
      rt.dashY = dash.y;
      rt.phase = "windup";
      rt.timer = cfg.windup || 0.34;
    }
    applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
    return;
  }
  if (rt.phase === "windup") {
    enemy.vx *= Math.exp(-12 * dt);
    enemy.vy *= Math.exp(-12 * dt);
    moveEnemyWithVelocity(enemy, geometry, dt);
    pushVisualEffect(state, { type: "anomalyLine", x: Math.round(enemy.x), y: Math.round(enemy.y), x2: Math.round(enemy.x + (rt.dashX || 1) * 86), y2: Math.round(enemy.y + (rt.dashY || 0) * 86), color: "#b45cff", life: 0.08, maxLife: 0.08 });
    if (rt.timer <= 0) { rt.phase = "dash"; rt.timer = cfg.dashTime || 0.28; }
    return;
  }
  if (rt.phase === "dash") {
    const speed = (cfg.dashSpeed || 620) * devEnemySpeedMult(state) * Math.max(0.05, updateCtx.speedMult || 1);
    enemy.vx = (rt.dashX || 1) * speed;
    enemy.vy = (rt.dashY || 0) * speed;
    moveEnemyWithVelocity(enemy, geometry, dt);
    if ((rt.blurAt || 0) <= now) {
      rt.blurAt = now + (cfg.blurEvery || 0.045);
      pushVisualEffect(state, { type: "afterimage", x: Math.round(enemy.x), y: Math.round(enemy.y), angle: Math.atan2(enemy.vy, enemy.vx), life: 0.12, maxLife: 0.12, skin: "purple" });
    }
    hitDashPlayers(state, enemy, cfg, updateCtx);
    if (rt.timer <= 0) { rt.phase = "cooldown"; rt.timer = cfg.cooldown || 1.45; }
  }
}
