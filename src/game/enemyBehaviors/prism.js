import { angleToVec, norm, segmentCircleHitT } from "../../core/math.js";
import { DAMAGE_TAGS, dealPlayerDamage } from "../effects.js";
import { devEnemyDamageMult } from "../dev.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyPlayerImpulse } from "../playerImpulse.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget, moveEnemyWithVelocity } from "./common.js";

function runtime(enemy, cfg) {
  if (!enemy.prismState || typeof enemy.prismState !== "object") enemy.prismState = { phase: "cooldown", timer: (cfg.cooldown || 1.7) * 0.6, facingX: 1, facingY: 0, telegraphAt: 0 };
  return enemy.prismState;
}

function beamAngles(base, split) {
  return [base - split, base, base + split];
}

function drawBeam(state, enemy, angle, length, color, life = 0.12) {
  pushVisualEffect(state, {
    type: "anomalyLine",
    x: Math.round(enemy.x),
    y: Math.round(enemy.y),
    x2: Math.round(enemy.x + Math.cos(angle) * length),
    y2: Math.round(enemy.y + Math.sin(angle) * length),
    color,
    life,
    maxLife: life
  });
}

function firePrismBeams(state, enemy, cfg, updateCtx) {
  const length = cfg.beamLength || 520;
  const width = cfg.beamWidth || 18;
  const base = Math.atan2(enemy.prismState?.facingY || 0, enemy.prismState?.facingX || 1);
  for (const angle of beamAngles(base, cfg.splitAngle || 0.42)) {
    const d = angleToVec(angle);
    drawBeam(state, enemy, angle, length, "#ffffff", 0.18);
    const x2 = enemy.x + d.x * length;
    const y2 = enemy.y + d.y * length;
    for (const player of Object.values(state.players || {})) {
      if (!player || player.hp <= 0) continue;
      const hitT = segmentCircleHitT(enemy.x, enemy.y, x2, y2, player.x, player.y, (player.radius || 13) + width);
      if (hitT === null) continue;
      dealPlayerDamage(state, player, {
        amount: (cfg.damage || 13) * Math.max(0, updateCtx.damageMult || 1) * devEnemyDamageMult(state),
        sourceId: enemy.id,
        sourceType: "enemyPrismBeam",
        enemyId: enemy.id,
        tags: [DAMAGE_TAGS.ENEMY, "beam", "prism"]
      });
      applyPlayerImpulse(state, player, {
        x: d.x * (cfg.knockback || 240),
        y: d.y * (cfg.knockback || 240),
        sourceId: enemy.id,
        sourceType: "enemyPrismBeam",
        reason: "prism_beam_hit"
      });
    }
  }
}

export function updatePrismEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = data.prism || {};
  const rt = runtime(enemy, cfg);
  const d = norm(target.x - enemy.x, target.y - enemy.y);
  rt.facingX = d.x;
  rt.facingY = d.y;
  rt.timer -= dt;
  if (rt.phase === "charge") {
    enemy.vx *= Math.exp(-10 * dt);
    enemy.vy *= Math.exp(-10 * dt);
    moveEnemyWithVelocity(enemy, geometry, dt);
    if ((rt.telegraphAt || 0) <= (state.time || 0)) {
      rt.telegraphAt = (state.time || 0) + (cfg.telegraphEvery || 0.13);
      const base = Math.atan2(rt.facingY, rt.facingX);
      for (const a of beamAngles(base, cfg.splitAngle || 0.42)) drawBeam(state, enemy, a, cfg.beamLength || 520, "#777777", 0.08);
    }
    if (rt.timer <= 0) {
      firePrismBeams(state, enemy, cfg, updateCtx);
      rt.phase = "cooldown";
      rt.timer = cfg.cooldown || 1.7;
    }
    return;
  }
  if (rt.timer <= 0) {
    rt.phase = "charge";
    rt.timer = cfg.charge || 0.8;
    rt.telegraphAt = 0;
    return;
  }
  moveEnemyTowardTarget(ctx, { speedScale: 0.32 });
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
