import { VIEW } from "../core/constants.js";
import { norm } from "../core/math.js";

function effectAlpha(fx) {
  const maxLife = Math.max(0.001, fx.maxLife || fx.life || 0.2);
  return Math.max(0, Math.min(1, (fx.life || 0) / maxLife));
}

function localDamageImpactEffects(snapshot, localId) {
  return (snapshot?.effects || []).filter((fx) => fx?.type === "playerDamageImpact" && fx.targetId === localId && (fx.life || 0) > 0);
}

function drawRedEdgeImpact(ctx, power, alpha) {
  if (!(alpha > 0) || !(power > 0)) return;
  const edge = Math.round(18 + power * 28);
  const strong = Math.max(0.04, Math.min(0.62, alpha));
  ctx.save();
  ctx.fillStyle = `rgba(255,48,72,${strong})`;
  ctx.fillRect(0, 0, VIEW.w, Math.max(4, edge));
  ctx.fillRect(0, VIEW.h - Math.max(4, edge), VIEW.w, Math.max(4, edge));
  ctx.fillStyle = `rgba(255,48,72,${strong * 0.72})`;
  ctx.fillRect(0, 0, Math.max(4, edge), VIEW.h);
  ctx.fillRect(VIEW.w - Math.max(4, edge), 0, Math.max(4, edge), VIEW.h);
  ctx.strokeStyle = `rgba(255,48,72,${Math.min(0.72, strong + 0.12)})`;
  ctx.lineWidth = Math.max(1, Math.round(1 + power));
  ctx.strokeRect(Math.round(edge * 0.45), Math.round(edge * 0.45), Math.round(VIEW.w - edge * 0.9), Math.round(VIEW.h - edge * 0.9));
  ctx.restore();
}

function drawDirectionalHitMarker(ctx, dx, dy, power, alpha) {
  if (!(alpha > 0)) return;
  const d = norm(dx || 0, dy || -1);
  const cx = VIEW.w / 2;
  const cy = VIEW.h / 2;
  const dist = 58 + power * 16;
  const x = cx - d.x * dist;
  const y = cy - d.y * dist;
  ctx.save();
  ctx.globalAlpha = Math.max(0.08, Math.min(0.76, alpha));
  ctx.strokeStyle = "#ff3048";
  ctx.lineWidth = Math.max(1, Math.round(2 + power));
  ctx.beginPath();
  ctx.moveTo(Math.round(x - d.y * 14), Math.round(y + d.x * 14));
  ctx.lineTo(Math.round(x), Math.round(y));
  ctx.lineTo(Math.round(x + d.y * 14), Math.round(y - d.x * 14));
  ctx.stroke();
  ctx.restore();
}

export function drawLocalDamageImpactOverlay(ctx, snapshot, localId) {
  const localPlayer = (snapshot?.players || []).find((p) => p.id === localId);
  const effects = localDamageImpactEffects(snapshot, localId);
  let power = 0;
  let alpha = 0;
  let dx = 0;
  let dy = -1;
  for (const fx of effects) {
    const a = effectAlpha(fx);
    const p = Math.max(0.35, Math.min(2.5, fx.power || 1));
    power = Math.max(power, p);
    alpha = Math.min(0.78, alpha + a * (0.16 + p * 0.13));
    if (a > 0.05) {
      dx = Number.isFinite(fx.dirX) ? fx.dirX : dx;
      dy = Number.isFinite(fx.dirY) ? fx.dirY : dy;
    }
  }
  const hpRatio = localPlayer ? Math.max(0, Math.min(1, (localPlayer.hp || 0) / Math.max(1, localPlayer.maxHp || 1))) : 1;
  if (hpRatio > 0 && hpRatio <= 0.35) {
    const pulse = (Math.sin((snapshot?.time || 0) * 8.5) + 1) * 0.5;
    const lowAlpha = (0.05 + (1 - hpRatio / 0.35) * 0.16) * (0.55 + pulse * 0.45);
    drawRedEdgeImpact(ctx, 0.7 + (1 - hpRatio) * 0.8, lowAlpha);
  }
  if (alpha > 0) {
    drawRedEdgeImpact(ctx, power, alpha);
    drawDirectionalHitMarker(ctx, dx, dy, power, Math.min(0.72, alpha + 0.08));
  }
}

