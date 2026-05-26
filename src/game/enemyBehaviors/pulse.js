import { angleToVec, norm } from "../../core/math.js";
import { DAMAGE_TAGS, dealPlayerDamage } from "../effects.js";
import { devEnemyDamageMult } from "../dev.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyPlayerImpulse } from "../playerImpulse.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget, moveEnemyWithVelocity } from "./common.js";

function runtime(enemy, cfg) {
  if (!enemy.pulseState || typeof enemy.pulseState !== "object") enemy.pulseState = { phase: "cooldown", timer: (cfg.cooldown || 1.42) * 0.6, telegraphAt: 0, facingX: 1, facingY: 0 };
  return enemy.pulseState;
}

function emitFrontWave(state, enemy, cfg, color = "#ff3048", life = 0.18, telegraph = false) {
  pushVisualEffect(state, {
    type: "frontWave",
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    dx: enemy.pulseState?.facingX || 1,
    dy: enemy.pulseState?.facingY || 0,
    length: cfg.length || 360,
    width: cfg.width || 92,
    color,
    telegraph,
    life,
    maxLife: life
  });
}

function hitPlayers(state, enemy, cfg, updateCtx) {
  const dir = norm(enemy.pulseState?.facingX || 1, enemy.pulseState?.facingY || 0);
  const length = cfg.length || 360;
  const halfWidth = (cfg.width || 92) * 0.5;
  for (const player of Object.values(state.players || {})) {
    if (!player || player.hp <= 0) continue;
    const rx = player.x - enemy.x;
    const ry = player.y - enemy.y;
    const along = rx * dir.x + ry * dir.y;
    if (along < -player.radius || along > length + player.radius) continue;
    const side = Math.abs(rx * -dir.y + ry * dir.x);
    if (side > halfWidth + player.radius) continue;
    dealPlayerDamage(state, player, {
      amount: (cfg.damage || 17) * Math.max(0, updateCtx.damageMult || 1) * devEnemyDamageMult(state),
      sourceId: enemy.id,
      sourceType: "enemyPulseWave",
      enemyId: enemy.id,
      tags: [DAMAGE_TAGS.ENEMY, "pulse", "front_wave"]
    });
    applyPlayerImpulse(state, player, {
      x: dir.x * (cfg.knockback || 330),
      y: dir.y * (cfg.knockback || 330),
      sourceId: enemy.id,
      sourceType: "enemyPulseWave",
      reason: "pulse_front_wave"
    });
  }
}

export function updatePulseEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = data.pulse || {};
  const rt = runtime(enemy, cfg);
  const facing = norm(target.x - enemy.x, target.y - enemy.y);
  rt.facingX = facing.x;
  rt.facingY = facing.y;
  rt.timer -= dt;
  if (rt.phase === "charge") {
    enemy.vx *= Math.exp(-10 * dt);
    enemy.vy *= Math.exp(-10 * dt);
    moveEnemyWithVelocity(enemy, geometry, dt);
    if ((rt.telegraphAt || 0) <= (state.time || 0)) {
      rt.telegraphAt = (state.time || 0) + (cfg.telegraphEvery || 0.13);
      emitFrontWave(state, enemy, cfg, "#ff3048", 0.11, true);
    }
    if (rt.timer <= 0) {
      hitPlayers(state, enemy, cfg, updateCtx);
      emitFrontWave(state, enemy, cfg, "#ff3048", 0.3, false);
      rt.phase = "cooldown";
      rt.timer = cfg.cooldown || 1.42;
    }
    return;
  }
  if (rt.timer <= 0) {
    rt.phase = "charge";
    rt.timer = cfg.charge || 0.86;
    rt.telegraphAt = 0;
    return;
  }
  moveEnemyTowardTarget(ctx, { speedScale: 0.48 });
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
