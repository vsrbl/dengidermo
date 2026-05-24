import { dist2 } from "../core/math.js";

export const ORBITER_PRESSURE_SCHEMA_VERSION = 1;
export const ORBITER_SLOW_PER_ORB = 0.35;
const ORBITER_PRESSURE_RADIUS = 126;
const ORBITER_SLOW_FLOOR = 0.16;

function pressureForPlayer(state, player) {
  if (!state || !player || player.hp <= 0) return { count: 0, slowMult: 1, radius: ORBITER_PRESSURE_RADIUS };
  const r = ORBITER_PRESSURE_RADIUS + (player.radius || 13);
  const r2 = r * r;
  let count = 0;
  for (const enemy of Object.values(state.enemies || {})) {
    if (!enemy || enemy.hp <= 0 || enemy.kind !== "orbiter") continue;
    const er = (enemy.radius || 13);
    const rr = r + er;
    if (dist2(player.x, player.y, enemy.x, enemy.y) <= Math.max(r2, rr * rr)) count += 1;
  }
  const slowMult = count > 0 ? Math.max(ORBITER_SLOW_FLOOR, Math.pow(1 - ORBITER_SLOW_PER_ORB, count)) : 1;
  return { count, slowMult: Number(slowMult.toFixed(3)), radius: ORBITER_PRESSURE_RADIUS };
}

export function updateOrbiterPressure(state) {
  for (const player of Object.values(state?.players || {})) {
    const pressure = pressureForPlayer(state, player);
    player.orbiterPressure = pressure;
    player.orbiterSlowMult = pressure.slowMult;
  }
}

export function orbiterPressureSnapshot(player) {
  const pressure = player?.orbiterPressure || { count: 0, slowMult: 1, radius: ORBITER_PRESSURE_RADIUS };
  return {
    count: Math.max(0, Math.floor(pressure.count || 0)),
    slowMult: Number((Number.isFinite(pressure.slowMult) ? pressure.slowMult : 1).toFixed(3)),
    radius: Math.round(pressure.radius || ORBITER_PRESSURE_RADIUS)
  };
}
