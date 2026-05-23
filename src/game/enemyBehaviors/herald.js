import { norm } from "../../core/math.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget, spawnBehaviorEnemy } from "./common.js";

function runtime(enemy) {
  if (!enemy.heraldState || typeof enemy.heraldState !== "object") {
    enemy.heraldState = { phase: "arming", cooldownAt: 0, trail: null, pulseAt: 0 };
  }
  return enemy.heraldState;
}

function loopIndex(state) {
  return Math.max(0, Math.floor(Number(state?.roomPlan?.loopIndex ?? state?.loopIndex ?? 0) || 0));
}

function startTrail(enemy, target, cfg) {
  enemy.heraldState.trail = {
    x: enemy.x,
    y: enemy.y,
    targetId: target.id,
    path: [{ x: target.x, y: target.y }],
    speed: cfg.trailSpeed || 245
  };
  enemy.heraldState.phase = "trail";
}

function spawnSwarm(state, enemy, target, cfg) {
  const kinds = Array.isArray(cfg.summonKinds) && cfg.summonKinds.length ? cfg.summonKinds : ["runner"];
  const count = Math.min(cfg.swarmMax || 12, (cfg.swarmBase || 3) + loopIndex(state) * (cfg.swarmPerLoop || 2));
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / Math.max(1, count) + ((state.rng?.next?.() || 0) - 0.5) * 0.22;
    const d = { x: Math.cos(a), y: Math.sin(a) };
    const kind = kinds[i % kinds.length];
    const child = spawnBehaviorEnemy(state, kind, enemy.x + d.x * 42, enemy.y + d.y * 42, { parentEnemyId: enemy.id, role: "herald_swarm", color: "#ff3048", text: "HRD" });
    if (child) {
      child.vx = d.x * 170;
      child.vy = d.y * 170;
    }
  }
  pushVisualEffect(state, { type: "pulseWave", x: Math.round(target.x), y: Math.round(target.y), r: 92, color: "#ff3048", life: 0.32, maxLife: 0.32 });
}

function updateTrail(state, enemy, target, cfg, dt) {
  const rt = enemy.heraldState;
  const trail = rt.trail;
  if (!trail) { startTrail(enemy, target, cfg); return; }
  trail.path.push({ x: target.x, y: target.y });
  while (trail.path.length > 36) trail.path.shift();
  const goal = trail.path[0] || { x: target.x, y: target.y };
  const toGoal = norm(goal.x - trail.x, goal.y - trail.y);
  trail.x += toGoal.x * (trail.speed || cfg.trailSpeed || 245) * dt;
  trail.y += toGoal.y * (trail.speed || cfg.trailSpeed || 245) * dt;
  if ((goal.x - trail.x) ** 2 + (goal.y - trail.y) ** 2 < 18 * 18 && trail.path.length > 1) trail.path.shift();
  if ((rt.pulseAt || 0) <= (state.time || 0)) {
    rt.pulseAt = (state.time || 0) + 0.08;
    pushVisualEffect(state, { type: "anomalyLine", x: Math.round(trail.x), y: Math.round(trail.y), x2: Math.round(target.x), y2: Math.round(target.y), color: "#ff3048", life: 0.1, maxLife: 0.1 });
    pushVisualEffect(state, { type: "anomalyField", x: Math.round(trail.x), y: Math.round(trail.y), r: 22, color: "#ff3048", life: 0.12, maxLife: 0.12 });
  }
  const catchR = cfg.catchRadius || 32;
  if ((target.x - trail.x) ** 2 + (target.y - trail.y) ** 2 <= catchR * catchR) {
    spawnSwarm(state, enemy, target, cfg);
    rt.trail = null;
    rt.phase = "cooldown";
    rt.cooldownAt = (state.time || 0) + (cfg.cooldown || 3.2);
  }
}

export function updateHeraldEnemy(ctx) {
  const { state, enemy, data, target, dt, updateCtx } = ctx;
  const cfg = data.herald || {};
  const rt = runtime(enemy);
  if (rt.phase === "cooldown") {
    if ((state.time || 0) >= (rt.cooldownAt || 0)) startTrail(enemy, target, cfg);
  } else if (rt.phase === "trail") {
    updateTrail(state, enemy, target, cfg, dt);
  } else {
    startTrail(enemy, target, cfg);
  }
  moveEnemyTowardTarget(ctx, { speedScale: 0.34 });
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
