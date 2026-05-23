import { norm } from "../../core/math.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget, moveEnemyWithVelocity, spawnBehaviorEnemy } from "./common.js";

function runtime(enemy, cfg) {
  if (!enemy.heraldState || typeof enemy.heraldState !== "object") enemy.heraldState = { phase: "cooldown", timer: (cfg.cooldown || 3.6) * 0.6, summons: 0, telegraphAt: 0 };
  return enemy.heraldState;
}

function spawnWavelet(state, enemy, target, cfg, rt) {
  const kinds = Array.isArray(cfg.summonKinds) && cfg.summonKinds.length ? cfg.summonKinds : ["runner"];
  const count = Math.min(2, Math.max(0, (cfg.maxSummons || 10) - (rt.summons || 0)));
  for (let i = 0; i < count; i += 1) {
    const kind = kinds[(rt.summons + i) % kinds.length];
    const a = Math.atan2(target.y - enemy.y, target.x - enemy.x) + (i - 0.5) * 0.72;
    const d = { x: Math.cos(a), y: Math.sin(a) };
    const child = spawnBehaviorEnemy(state, kind, enemy.x + d.x * 38, enemy.y + d.y * 38, { parentEnemyId: enemy.id, role: "herald_summon", color: "#ff3048", text: "HRD" });
    if (child) { child.vx = d.x * 90; child.vy = d.y * 90; rt.summons += 1; }
  }
  pushVisualEffect(state, { type: "pulseWave", x: Math.round(enemy.x), y: Math.round(enemy.y), r: 86, color: "#ff3048", text: "CALL", life: 0.22, maxLife: 0.22 });
}

export function updateHeraldEnemy(ctx) {
  const { state, enemy, data, target, dt, geometry, updateCtx } = ctx;
  const cfg = data.herald || {};
  const rt = runtime(enemy, cfg);
  rt.timer -= dt;
  if (rt.phase === "windup") {
    enemy.vx *= Math.exp(-10 * dt); enemy.vy *= Math.exp(-10 * dt); moveEnemyWithVelocity(enemy, geometry, dt);
    if ((rt.telegraphAt || 0) <= (state.time || 0)) {
      rt.telegraphAt = (state.time || 0) + 0.14;
      pushVisualEffect(state, { type: "anomalyLine", x: Math.round(enemy.x), y: Math.round(enemy.y), x2: Math.round(target.x), y2: Math.round(target.y), color: "#ff3048", life: 0.09, maxLife: 0.09 });
    }
    if (rt.timer <= 0) { spawnWavelet(state, enemy, target, cfg, rt); rt.phase = "cooldown"; rt.timer = cfg.cooldown || 3.6; }
    return;
  }
  if (rt.timer <= 0 && (rt.summons || 0) < (cfg.maxSummons || 10)) { rt.phase = "windup"; rt.timer = cfg.windup || 0.72; rt.telegraphAt = 0; return; }
  moveEnemyTowardTarget(ctx, { speedScale: 0.44 });
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
