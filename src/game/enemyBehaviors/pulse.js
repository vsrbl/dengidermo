import { dist2, norm } from "../../core/math.js";
import { DAMAGE_TAGS, dealPlayerDamage } from "../effects.js";
import { devEnemyDamageMult } from "../dev.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget, moveEnemyWithVelocity } from "./common.js";

function runtime(enemy, cfg) {
  if (!enemy.pulseState || typeof enemy.pulseState !== "object") enemy.pulseState = { phase: "cooldown", timer: (cfg.cooldown || 1.55) * 0.6, telegraphAt: 0 };
  return enemy.pulseState;
}

function emitWave(state, enemy, cfg, color = "#ff3048", life = 0.22) {
  pushVisualEffect(state, { type: "pulseWave", x: Math.round(enemy.x), y: Math.round(enemy.y), r: cfg.radius || 138, color, text: "PLS", life, maxLife: life });
}

function hitPlayers(state, enemy, cfg, updateCtx) {
  const r = cfg.radius || 138;
  for (const player of Object.values(state.players || {})) {
    if (!player || player.hp <= 0) continue;
    if (dist2(enemy.x, enemy.y, player.x, player.y) > (r + player.radius) ** 2) continue;
    dealPlayerDamage(state, player, { amount: (cfg.damage || 16) * Math.max(0, updateCtx.damageMult || 1) * devEnemyDamageMult(state), sourceId: enemy.id, sourceType: "enemyPulse", enemyId: enemy.id, tags: [DAMAGE_TAGS.ENEMY, "pulse"] });
    const d = norm(player.x - enemy.x, player.y - enemy.y);
    player.kx = (player.kx || 0) + d.x * (cfg.knockback || 280);
    player.ky = (player.ky || 0) + d.y * (cfg.knockback || 280);
  }
}

export function updatePulseEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = data.pulse || {};
  const rt = runtime(enemy, cfg);
  rt.timer -= dt;
  if (rt.phase === "charge") {
    enemy.vx *= Math.exp(-10 * dt);
    enemy.vy *= Math.exp(-10 * dt);
    moveEnemyWithVelocity(enemy, geometry, dt);
    if ((rt.telegraphAt || 0) <= (state.time || 0)) {
      rt.telegraphAt = (state.time || 0) + (cfg.telegraphEvery || 0.18);
      emitWave(state, enemy, cfg, "#ff3048", 0.16);
    }
    if (rt.timer <= 0) {
      hitPlayers(state, enemy, cfg, updateCtx);
      emitWave(state, enemy, cfg, "#ff3048", 0.28);
      rt.phase = "cooldown";
      rt.timer = cfg.cooldown || 1.55;
    }
    return;
  }
  if (rt.timer <= 0) {
    rt.phase = "charge";
    rt.timer = cfg.charge || 1.05;
    rt.telegraphAt = 0;
    return;
  }
  moveEnemyTowardTarget(ctx, { speedScale: 0.58 });
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
