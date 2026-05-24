export const PLAYER_IMPULSE_SCHEMA_VERSION = 1;

function num(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function nextSeq(player) {
  player.hostImpulseSeq = ((player.hostImpulseSeq || 0) + 1) % 1000000000;
  if (player.hostImpulseSeq <= 0) player.hostImpulseSeq = 1;
  return player.hostImpulseSeq;
}

export function applyPlayerImpulse(state, player, impulse = {}) {
  if (!player || player.hp <= 0) return null;
  const ix = num(impulse.x, num(impulse.vx, 0));
  const iy = num(impulse.y, num(impulse.vy, 0));
  if (!(Math.abs(ix) > 0.0001 || Math.abs(iy) > 0.0001)) return null;

  player.kx = num(player.kx, 0) + ix;
  player.ky = num(player.ky, 0) + iy;

  const shouldReconcile = impulse.reconcile !== false;
  if (!shouldReconcile) return null;

  const seq = nextSeq(player);
  const strength = Math.hypot(ix, iy);
  player.lastHostImpulse = {
    schemaVersion: PLAYER_IMPULSE_SCHEMA_VERSION,
    seq,
    tick: num(state?.tick, 0),
    time: Number(num(state?.time, 0).toFixed(3)),
    x: Number(num(player.x, 0).toFixed(1)),
    y: Number(num(player.y, 0).toFixed(1)),
    kx: Number(num(player.kx, 0).toFixed(1)),
    ky: Number(num(player.ky, 0).toFixed(1)),
    impulseX: Number(ix.toFixed(1)),
    impulseY: Number(iy.toFixed(1)),
    strength: Number(strength.toFixed(1)),
    sourceId: impulse.sourceId || null,
    sourceType: impulse.sourceType || "hostileImpulse",
    reason: impulse.reason || impulse.sourceType || "hostileImpulse"
  };
  return player.lastHostImpulse;
}

export function playerImpulseSnapshot(player) {
  return {
    hostImpulseSeq: player?.hostImpulseSeq || 0,
    lastHostImpulse: player?.lastHostImpulse ? { ...player.lastHostImpulse } : null
  };
}
