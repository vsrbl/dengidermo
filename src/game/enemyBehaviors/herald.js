import { norm } from "../../core/math.js";
import { pushVisualEffect } from "../effectCommands.js";
import { applyEnemyTouchDamage, moveEnemyTowardTarget, spawnBehaviorEnemy } from "./common.js";

function runtime(enemy) {
  if (!enemy.heraldState || typeof enemy.heraldState !== "object") {
    enemy.heraldState = { phase: "arming", cooldownAt: 0, tether: null, pulseAt: 0 };
  }
  if (enemy.heraldState.trail && !enemy.heraldState.tether) {
    const old = enemy.heraldState.trail;
    enemy.heraldState.tether = { ...old, headX: old.x ?? enemy.x, headY: old.y ?? enemy.y };
    delete enemy.heraldState.trail;
  }
  return enemy.heraldState;
}

function loopIndex(state) {
  return Math.max(0, Math.floor(Number(state?.roomPlan?.loopIndex ?? state?.loopIndex ?? 0) || 0));
}

function startTether(enemy, target, cfg) {
  enemy.heraldState.tether = {
    headX: enemy.x,
    headY: enemy.y,
    targetId: target.id,
    path: [{ x: target.x, y: target.y }],
    speed: cfg.tetherSpeed || cfg.trailSpeed || 245
  };
  enemy.heraldState.phase = "tether";
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

function sampleTetherPoints(enemy, target, tether) {
  const history = Array.isArray(tether?.path) ? tether.path : [];
  const points = [{ x: Math.round(enemy.x), y: Math.round(enemy.y) }];
  const maxHistoryPoints = 7;
  const start = Math.max(0, history.length - 1 - maxHistoryPoints * 4);
  for (let i = start; i < history.length; i += 4) {
    const p = history[i];
    if (!p) continue;
    points.push({ x: Math.round(p.x), y: Math.round(p.y) });
  }
  points.push({ x: Math.round(target.x), y: Math.round(target.y) });
  return points;
}

function updateTether(state, enemy, target, cfg, dt) {
  const rt = enemy.heraldState;
  const tether = rt.tether;
  if (!tether) { startTether(enemy, target, cfg); return; }
  tether.path.push({ x: target.x, y: target.y });
  while (tether.path.length > (cfg.tetherPathMax || 44)) tether.path.shift();
  const goal = tether.path[0] || { x: target.x, y: target.y };
  const toGoal = norm(goal.x - tether.headX, goal.y - tether.headY);
  tether.headX += toGoal.x * (tether.speed || cfg.tetherSpeed || cfg.trailSpeed || 245) * dt;
  tether.headY += toGoal.y * (tether.speed || cfg.tetherSpeed || cfg.trailSpeed || 245) * dt;
  if ((goal.x - tether.headX) ** 2 + (goal.y - tether.headY) ** 2 < 18 * 18 && tether.path.length > 1) tether.path.shift();
  if ((rt.pulseAt || 0) <= (state.time || 0)) {
    rt.pulseAt = (state.time || 0) + (cfg.tetherPulseEvery || 0.075);
    pushVisualEffect(state, {
      type: "heraldTether",
      x: Math.round(enemy.x),
      y: Math.round(enemy.y),
      x2: Math.round(target.x),
      y2: Math.round(target.y),
      points: sampleTetherPoints(enemy, target, tether),
      color: "#ff3048",
      life: 0.13,
      maxLife: 0.13
    });
  }
  const catchR = cfg.catchRadius || 32;
  if ((target.x - tether.headX) ** 2 + (target.y - tether.headY) ** 2 <= catchR * catchR) {
    spawnSwarm(state, enemy, target, cfg);
    rt.tether = null;
    rt.phase = "cooldown";
    rt.cooldownAt = (state.time || 0) + (cfg.cooldown || 3.2);
  }
}

export function updateHeraldEnemy(ctx) {
  const { state, enemy, data, target, dt, updateCtx } = ctx;
  const cfg = data.herald || {};
  const rt = runtime(enemy);
  if (rt.phase === "cooldown") {
    if ((state.time || 0) >= (rt.cooldownAt || 0)) startTether(enemy, target, cfg);
  } else if (rt.phase === "tether" || rt.phase === "trail") {
    updateTether(state, enemy, target, cfg, dt);
  } else {
    startTether(enemy, target, cfg);
  }
  moveEnemyTowardTarget(ctx, { speedScale: 0.34 });
  applyEnemyTouchDamage(state, enemy, data, target, dt, updateCtx);
}
