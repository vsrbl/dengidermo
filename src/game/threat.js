import { dist2 } from "../core/math.js";

const NEAR_ENEMY_RADIUS = 260;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smooth(prev, next, dt, speed = 4) {
  const t = 1 - Math.exp(-speed * Math.max(0, dt || 0));
  return prev + (next - prev) * t;
}

function alivePlayers(state) {
  return Object.values(state.players || {}).filter((p) => p.hp > 0);
}

function playerHealthPressure(state) {
  const players = Object.values(state.players || {});
  if (!players.length) return 0;
  const alive = alivePlayers(state);
  const deadRatio = (players.length - alive.length) / Math.max(1, players.length);
  const avgHpRatio = alive.length
    ? alive.reduce((sum, p) => sum + Math.max(0, p.hp) / Math.max(1, p.maxHp || 1), 0) / alive.length
    : 0;
  const lowRatio = alive.length
    ? alive.filter((p) => Math.max(0, p.hp) / Math.max(1, p.maxHp || 1) <= 0.35).length / alive.length
    : 1;
  return clamp01((1 - avgHpRatio) * 0.72 + lowRatio * 0.16 + deadRatio * 0.35);
}

function proximityPressure(state) {
  const players = alivePlayers(state);
  const enemies = Object.values(state.enemies || {});
  if (!players.length || !enemies.length) return 0;
  const nearR2 = NEAR_ENEMY_RADIUS * NEAR_ENEMY_RADIUS;
  let near = 0;
  for (const enemy of enemies) {
    if (players.some((p) => dist2(enemy.x, enemy.y, p.x, p.y) <= nearR2)) near += 1;
  }
  return clamp01(near / Math.max(4, players.length * 3));
}

function goneEnemyCount(prevIds = [], currentIds = []) {
  if (!prevIds.length) return 0;
  const current = new Set(currentIds);
  return prevIds.filter((id) => !current.has(id)).length;
}

export function updateThreatAnalyzer(state, dt = 0, director = null, loc = null) {
  const prev = state.threat || {};
  const enemyIds = Object.keys(state.enemies || {});
  const players = Math.max(1, alivePlayers(state).length || Object.keys(state.players || {}).length || 1);
  const capReference = Math.max(players + 2, director?.enemyCap || loc?.spawn?.capBase || 12);
  const enemyPressure = clamp01(enemyIds.length / capReference);
  const healthPressure = playerHealthPressure(state);
  const nearPressure = proximityPressure(state);
  const gone = goneEnemyCount(prev.enemyIds || [], enemyIds);
  const rawKillRate = gone / Math.max(0.1, dt || 0.1);
  const killRate = smooth(prev.killRate || 0, rawKillRate, dt, 2.4);
  const rawPressure = clamp01(enemyPressure * 0.42 + healthPressure * 0.38 + nearPressure * 0.2);
  const pressure = smooth(prev.pressure || rawPressure, rawPressure, dt, 3.2);
  const relief = clamp01((healthPressure - 0.42) * 1.25 + (enemyPressure - 0.8) * 0.45 + nearPressure * 0.22);
  const dominance = clamp01((killRate - 2.2) / 5.5 + (1 - healthPressure) * 0.22 - enemyPressure * 0.18);

  state.threat = {
    pressure: Number(pressure.toFixed(3)),
    enemyPressure: Number(enemyPressure.toFixed(3)),
    healthPressure: Number(healthPressure.toFixed(3)),
    proximityPressure: Number(nearPressure.toFixed(3)),
    killRate: Number(killRate.toFixed(3)),
    relief: Number(relief.toFixed(3)),
    dominance: Number(dominance.toFixed(3)),
    intensityMult: Number(clamp(1 + dominance * 0.22 - relief * 0.28, 0.72, 1.25).toFixed(3)),
    capMult: Number(clamp(1 + dominance * 0.14 - relief * 0.25, 0.7, 1.18).toFixed(3)),
    batchMult: Number(clamp(1 + dominance * 0.18 - relief * 0.35, 0.65, 1.2).toFixed(3)),
    intervalMult: Number(clamp(1 - dominance * 0.12 + relief * 0.45, 0.75, 1.55).toFixed(3)),
    enemyIds,
    updatedAt: Number((state.time || 0).toFixed(3))
  };
  return state.threat;
}

export function threatSnapshot(state) {
  const threat = state.threat;
  if (!threat) return null;
  return {
    pressure: threat.pressure || 0,
    enemyPressure: threat.enemyPressure || 0,
    healthPressure: threat.healthPressure || 0,
    proximityPressure: threat.proximityPressure || 0,
    killRate: threat.killRate || 0,
    relief: threat.relief || 0,
    dominance: threat.dominance || 0,
    intensityMult: threat.intensityMult || 1,
    capMult: threat.capMult || 1,
    batchMult: threat.batchMult || 1,
    intervalMult: threat.intervalMult || 1
  };
}
