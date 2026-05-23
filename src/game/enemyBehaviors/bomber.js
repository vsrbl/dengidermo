import { dist2, norm } from "../../core/math.js";
import { DAMAGE_TAGS, dealPlayerDamage } from "../effects.js";
import { devEnemyDamageMult } from "../dev.js";
import { pushVisualEffect } from "../effectCommands.js";
import { finishEnemyKill } from "../enemyDeath.js";
import { moveEnemyTowardTarget, moveEnemyWithVelocity } from "./common.js";

function bomberRuntime(enemy) {
  if (!enemy.bombState || typeof enemy.bombState !== "object") {
    enemy.bombState = { phase: "chase", timer: 0, telegraphAt: 0 };
  }
  return enemy.bombState;
}

function bombConfig(data) {
  const cfg = data.bomb || {};
  return {
    triggerRange: cfg.triggerRange || 88,
    fuse: cfg.fuse || 0.72,
    explosionRadius: cfg.explosionRadius || 88,
    explosionDamage: cfg.explosionDamage || data.damage * 3,
    knockback: cfg.knockback || 420,
    telegraphEvery: cfg.telegraphEvery || 0.12,
    chaseSpeedScale: cfg.chaseSpeedScale || 0.92
  };
}

function emitBomberFuse(state, enemy, cfg, bomb) {
  const now = state.time || 0;
  if ((bomb.telegraphAt || 0) > now) return;
  bomb.telegraphAt = now + cfg.telegraphEvery;
  pushVisualEffect(state, {
    type: "bomberFuse",
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    r: cfg.explosionRadius,
    color: "#ff3048",
    life: Math.min(0.16, cfg.fuse),
    maxLife: Math.min(0.16, cfg.fuse)
  });
}

function explodeBomber(state, enemy, cfg, updateCtx) {
  for (const player of Object.values(state.players || {})) {
    if (!player || player.hp <= 0) continue;
    const reach = cfg.explosionRadius + (player.radius || 0);
    if (dist2(enemy.x, enemy.y, player.x, player.y) > reach * reach) continue;
    dealPlayerDamage(state, player, {
      amount: cfg.explosionDamage * Math.max(0, updateCtx.damageMult || 1) * devEnemyDamageMult(state),
      sourceId: enemy.id,
      sourceType: "enemyExplosion",
      enemyId: enemy.id,
      tags: [DAMAGE_TAGS.ENEMY, DAMAGE_TAGS.EXPLOSION]
    });
    const push = norm(player.x - enemy.x, player.y - enemy.y);
    player.kx = (player.kx || 0) + push.x * cfg.knockback;
    player.ky = (player.ky || 0) + push.y * cfg.knockback;
  }
  pushVisualEffect(state, {
    type: "explosion",
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    r: cfg.explosionRadius,
    color: "#ff3048",
    life: 0.18,
    maxLife: 0.18
  });
  finishEnemyKill(state, enemy, { id: enemy.id, kind: "bomber", type: "enemySelfDestruct" }, { sourceId: enemy.id });
}

export function updateBomberEnemy(ctx) {
  const { state, enemy, target, dt, updateCtx } = ctx;
  const cfg = bombConfig(ctx.data);
  const bomb = bomberRuntime(enemy);
  const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y);

  if (bomb.phase === "fuse") {
    bomb.timer -= dt;
    enemy.vx *= Math.exp(-12 * dt);
    enemy.vy *= Math.exp(-12 * dt);
    emitBomberFuse(state, enemy, cfg, bomb);
    moveEnemyWithVelocity(enemy, ctx.geometry, dt);
    if (bomb.timer <= 0) explodeBomber(state, enemy, cfg, updateCtx);
    return;
  }

  if (distance <= cfg.triggerRange) {
    bomb.phase = "fuse";
    bomb.timer = cfg.fuse;
    bomb.telegraphAt = 0;
    emitBomberFuse(state, enemy, cfg, bomb);
    enemy.vx *= 0.18;
    enemy.vy *= 0.18;
    return;
  }

  moveEnemyTowardTarget(ctx, { speedScale: cfg.chaseSpeedScale });
}
