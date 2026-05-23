import { GREEN } from "../core/constants.js";
import { norm } from "../core/math.js";

function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawText(ctx, text, x, y, color = "#fff", align = "left") {
  ctx.fillStyle = color;
  ctx.font = "12px Courier New, monospace";
  ctx.textAlign = align;
  ctx.fillText(text, Math.round(x), Math.round(y));
}

function screen(obj, cam) {
  return { x: obj.x - cam.x, y: obj.y - cam.y };
}

function effectLife(fx) {
  const life = Math.max(0, fx.life || 0);
  const maxLife = Math.max(0.001, fx.maxLife || fx.life || 0.2);
  return { life, maxLife, age: maxLife - life, t: 1 - life / maxLife };
}

function drawSpark(ctx, fx, cam) {
  const { life, maxLife, age } = effectLife(fx);
  const x = fx.x + (fx.vx || 0) * age;
  const y = fx.y + (fx.vy || 0) * age;
  const s = screen({ x, y }, cam);
  const size = Math.max(2, Math.round(5 * (life / maxLife)));
  drawRect(ctx, s.x - size / 2, s.y - size / 2, size, size, fx.color || GREEN);
}

function drawPortal(ctx, fx, cam) {
  const { life, maxLife, t } = effectLife(fx);
  const s = screen(fx, cam);
  const r = (fx.radius || 80) * (0.45 + t * 0.7);
  ctx.strokeStyle = fx.color || GREEN;
  ctx.lineWidth = Math.max(1, Math.round(5 * (life / maxLife)));
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
}

function drawChain(ctx, fx, cam) {
  const a = screen(fx, cam);
  const b = screen({ x: fx.x2, y: fx.y2 }, cam);
  ctx.strokeStyle = fx.color || GREEN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.round(a.x), Math.round(a.y));
  ctx.lineTo(Math.round(b.x), Math.round(b.y));
  ctx.stroke();
  if (fx.amount) drawText(ctx, String(fx.amount), (a.x + b.x) / 2, (a.y + b.y) / 2 - 5, GREEN, "center");
}

function drawDamageText(ctx, fx, cam) {
  const { age } = effectLife(fx);
  const y = fx.y + (fx.vy || -24) * age;
  const s = screen({ x: fx.x, y }, cam);
  drawText(ctx, fx.text || "1", s.x, s.y, fx.color || "#fff", "center");
}

function drawStatusRing(ctx, fx, cam) {
  const { life, maxLife, t } = effectLife(fx);
  const s = screen(fx, cam);
  const r = (fx.r || 26) * (0.42 + t * 0.82);
  ctx.strokeStyle = fx.color || GREEN;
  ctx.lineWidth = Math.max(1, Math.round(3 * (life / maxLife)));
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
  return { s, r };
}

function drawStatusBurst(ctx, fx, cam) {
  const { s, r } = drawStatusRing(ctx, fx, cam);
  if (fx.status) drawText(ctx, fx.status.slice(0, 3).toUpperCase(), s.x, s.y - r - 4, fx.color || GREEN, "center");
}

function drawRicochet(ctx, fx, cam) {
  const s = screen(fx, cam);
  const vx = fx.vx || 1;
  const vy = fx.vy || 0;
  const d = norm(vx, vy);
  ctx.strokeStyle = fx.color || GREEN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(Math.round(s.x - d.x * 16), Math.round(s.y - d.y * 16));
  ctx.lineTo(Math.round(s.x + d.x * 16), Math.round(s.y + d.y * 16));
  ctx.stroke();
}

function drawAfterimage(ctx, fx, cam) {
  const { life, maxLife } = effectLife(fx);
  const s = screen(fx, cam);
  const t = life / maxLife;
  const r = 13;
  ctx.globalAlpha = Math.max(0.12, Math.min(0.46, t * 0.42));
  ctx.strokeStyle = fx.color || (fx.skin === "green" ? GREEN : (fx.skin === "purple" ? "#b45cff" : "#ffffff"));
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), r * 2, r * 2);
  const ax = Math.cos(fx.angle || 0);
  const ay = Math.sin(fx.angle || 0);
  ctx.beginPath();
  ctx.moveTo(Math.round(s.x), Math.round(s.y));
  ctx.lineTo(Math.round(s.x + ax * 20), Math.round(s.y + ay * 20));
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawDashBurst(ctx, fx, cam) {
  const { life, maxLife, t } = effectLife(fx);
  const s = screen(fx, cam);
  const r = 18 + t * 30;
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = Math.max(1, Math.round(3 * (life / maxLife)));
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
  const d = norm(fx.vx || 1, fx.vy || 0);
  ctx.beginPath();
  ctx.moveTo(Math.round(s.x - d.x * 28), Math.round(s.y - d.y * 28));
  ctx.lineTo(Math.round(s.x + d.x * 12), Math.round(s.y + d.y * 12));
  ctx.stroke();
}

function drawChargeTelegraph(ctx, fx, cam) {
  const { life, maxLife } = effectLife(fx);
  const a = screen(fx, cam);
  const b = screen({ x: fx.x2, y: fx.y2 }, cam);
  const t = Math.max(0.2, Math.min(1, life / maxLife));
  ctx.strokeStyle = fx.color || "#ff3048";
  ctx.lineWidth = Math.max(1, Math.round(3 * t));
  ctx.beginPath();
  ctx.moveTo(Math.round(a.x), Math.round(a.y));
  ctx.lineTo(Math.round(b.x), Math.round(b.y));
  ctx.stroke();
  drawRect(ctx, b.x - 4, b.y - 4, 8, 8, fx.color || "#ff3048");
}




function drawEnemyMuzzle(ctx, fx, cam) {
  const { life, maxLife } = effectLife(fx);
  const a = screen(fx, cam);
  const b = screen({ x: fx.x2, y: fx.y2 }, cam);
  ctx.strokeStyle = fx.color || "#ff3048";
  ctx.lineWidth = Math.max(1, Math.round(2 * (life / maxLife)));
  ctx.beginPath();
  ctx.moveTo(Math.round(a.x), Math.round(a.y));
  ctx.lineTo(Math.round(b.x), Math.round(b.y));
  ctx.stroke();
  drawRect(ctx, b.x - 3, b.y - 3, 6, 6, fx.color || "#ff3048");
}

function drawBomberFuse(ctx, fx, cam) {
  const { life, maxLife, t } = effectLife(fx);
  const s = screen(fx, cam);
  const r = (fx.r || 26) * (0.72 + t * 0.48);
  ctx.strokeStyle = fx.color || "#ff3048";
  ctx.lineWidth = Math.max(1, Math.round(3 * (life / maxLife)));
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
  drawRect(ctx, s.x - 3, s.y - 3, 6, 6, fx.color || "#ff3048");
}

function drawDroneBeam(ctx, fx, cam) {
  const a = screen(fx, cam);
  const b = screen({ x: fx.x2, y: fx.y2 }, cam);
  ctx.strokeStyle = fx.color || GREEN;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(a.x), Math.round(a.y));
  ctx.lineTo(Math.round(b.x), Math.round(b.y));
  ctx.stroke();
  drawRect(ctx, b.x - 3, b.y - 3, 6, 6, GREEN);
}

function drawOrbitalHit(ctx, fx, cam) {
  const { t } = effectLife(fx);
  const s = screen({ x: fx.x2 || fx.x, y: fx.y2 || fx.y }, cam);
  const r = (fx.r || 14) * (0.45 + t * 0.8);
  ctx.strokeStyle = fx.color || GREEN;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
}

function drawExplosion(ctx, fx, cam) {
  const { life, maxLife, t } = effectLife(fx);
  const s = screen(fx, cam);
  const r = fx.r * (0.35 + t * 0.85);
  ctx.strokeStyle = fx.color || GREEN;
  ctx.lineWidth = Math.max(1, Math.round(4 * (life / maxLife)));
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
  ctx.beginPath();
  ctx.moveTo(Math.round(s.x - r * 1.2), Math.round(s.y));
  ctx.lineTo(Math.round(s.x + r * 1.2), Math.round(s.y));
  ctx.moveTo(Math.round(s.x), Math.round(s.y - r * 1.2));
  ctx.lineTo(Math.round(s.x), Math.round(s.y + r * 1.2));
  ctx.stroke();
}


function drawRewardRevealPulse(ctx, fx, cam) {
  const raw = effectLife(fx);
  const delay = Math.max(0, fx.delay || 0);
  if (raw.age < delay) return;
  const activeAge = raw.age - delay;
  const activeMax = Math.max(0.001, raw.maxLife - delay);
  const t = Math.max(0, Math.min(1, activeAge / activeMax));
  const s = screen(fx, cam);
  const color = fx.color || GREEN;
  const mode = String(fx.mode || "");
  const highValue = mode === "rare" || mode === "cursed" || mode === "casino_jackpot" || mode === "casino_static";
  const base = (fx.r || 36) * (0.55 + t * (highValue ? 1.25 : 0.9));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = highValue ? 3 : 2;
  ctx.globalAlpha = Math.max(0.08, 0.62 - t * 0.5);
  ctx.strokeRect(Math.round(s.x - base), Math.round(s.y - base), Math.round(base * 2), Math.round(base * 2));
  const inner = Math.max(6, base * (0.42 + Math.sin(t * Math.PI * 2) * 0.04));
  ctx.lineWidth = 1;
  ctx.globalAlpha = Math.max(0.06, 0.34 - t * 0.26);
  ctx.strokeRect(Math.round(s.x - inner), Math.round(s.y - inner), Math.round(inner * 2), Math.round(inner * 2));
  if (highValue) {
    const outer = base + 14 + Math.sin(t * Math.PI) * 10;
    ctx.globalAlpha = Math.max(0.04, 0.2 - t * 0.14);
    ctx.strokeRect(Math.round(s.x - outer), Math.round(s.y - outer), Math.round(outer * 2), Math.round(outer * 2));
  }
  ctx.restore();
}

function drawArmorPulse(ctx, fx, cam) {
  const { life, maxLife, t } = effectLife(fx);
  const s = screen(fx, cam);
  const r = (fx.r || 28) * (0.75 + t * 0.35);
  ctx.strokeStyle = fx.color || GREEN;
  ctx.lineWidth = Math.max(1, Math.round(3 * (life / maxLife)));
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
}

function drawAnomalyLine(ctx, fx, cam) {
  const a = screen(fx, cam);
  const b = screen({ x: fx.x2, y: fx.y2 }, cam);
  const { life, maxLife } = effectLife(fx);
  ctx.strokeStyle = fx.color || "#ffffff";
  ctx.lineWidth = Math.max(1, Math.round(2 * life / maxLife));
  ctx.beginPath();
  ctx.moveTo(Math.round(a.x), Math.round(a.y));
  ctx.lineTo(Math.round(b.x), Math.round(b.y));
  ctx.stroke();
}

function drawAnomalyField(ctx, fx, cam) {
  const { life, maxLife, t } = effectLife(fx);
  const s = screen(fx, cam);
  const r = (fx.r || 64) * (0.86 + t * 0.16);
  const color = fx.color || "#ffffff";
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, Math.round(2 * life / maxLife));
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
  if (fx.text) drawText(ctx, String(fx.text).slice(0, 4).toUpperCase(), s.x, s.y - r - 5, color, "center");
}

function drawPulseWave(ctx, fx, cam) {
  const { life, maxLife, t } = effectLife(fx);
  const s = screen(fx, cam);
  const r = (fx.r || 96) * (0.22 + t * 0.86);
  const color = fx.color || "#ff3048";
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, Math.round(4 * life / maxLife));
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
  ctx.beginPath();
  ctx.moveTo(Math.round(s.x - r * 1.1), Math.round(s.y));
  ctx.lineTo(Math.round(s.x + r * 1.1), Math.round(s.y));
  ctx.moveTo(Math.round(s.x), Math.round(s.y - r * 1.1));
  ctx.lineTo(Math.round(s.x), Math.round(s.y + r * 1.1));
  ctx.stroke();
  if (fx.text) drawText(ctx, String(fx.text).slice(0, 5).toUpperCase(), s.x, s.y - r - 6, color, "center");
}

function drawFrontWave(ctx, fx, cam) {
  const { life, maxLife, t } = effectLife(fx);
  const s = screen(fx, cam);
  const d = norm(fx.dx || 1, fx.dy || 0);
  const n = { x: -d.y, y: d.x };
  const length = fx.length || 320;
  const width = fx.width || 86;
  const progress = fx.telegraph ? 0.35 + t * 0.2 : 0.2 + t * 0.9;
  const front = Math.max(22, length * progress);
  const back = Math.max(0, front - Math.max(34, width * 0.9));
  const color = fx.color || "#ff3048";
  const alpha = Math.max(0.08, Math.min(0.72, life / maxLife * (fx.telegraph ? 0.38 : 0.68)));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = fx.telegraph ? 1 : Math.max(1, Math.round(4 * life / maxLife));
  const cx = s.x + d.x * front;
  const cy = s.y + d.y * front;
  ctx.beginPath();
  ctx.moveTo(Math.round(cx - n.x * width * 0.5), Math.round(cy - n.y * width * 0.5));
  ctx.lineTo(Math.round(cx + n.x * width * 0.5), Math.round(cy + n.y * width * 0.5));
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i += 1) {
    const k = back + (front - back) * (i / 2);
    const w = width * (0.35 + i * 0.22);
    const px = s.x + d.x * k;
    const py = s.y + d.y * k;
    ctx.beginPath();
    ctx.moveTo(Math.round(px - n.x * w * 0.5), Math.round(py - n.y * w * 0.5));
    ctx.lineTo(Math.round(px + n.x * w * 0.5), Math.round(py + n.y * w * 0.5));
    ctx.stroke();
  }
  ctx.restore();
}

function ignoreEffect() {}

export const EFFECT_RENDERERS = Object.freeze({
  spark: drawSpark,
  portal: drawPortal,
  chain: drawChain,
  damageText: drawDamageText,
  critFlash: drawStatusRing,
  statusBurst: drawStatusBurst,
  statusTick: drawStatusRing,
  ricochet: drawRicochet,
  afterimage: drawAfterimage,
  dashBurst: drawDashBurst,
  chargeTelegraph: drawChargeTelegraph,
  enemyMuzzle: drawEnemyMuzzle,
  armorHit: drawArmorPulse,
  armorBreak: drawArmorPulse,
  armorLinkBlock: drawArmorPulse,
  interactableOpen: drawArmorPulse,
  rewardRevealPulse: drawRewardRevealPulse,
  armorRegen: drawArmorPulse,
  elitePulse: drawArmorPulse,
  bomberFuse: drawBomberFuse,
  droneBeam: drawDroneBeam,
  orbitalHit: drawOrbitalHit,
  explosion: drawExplosion,
  anomalyLine: drawAnomalyLine,
  anomalyField: drawAnomalyField,
  pulseWave: drawPulseWave,
  frontWave: drawFrontWave,
  shake: ignoreEffect
});

export function drawEffect(ctx, fx, cam) {
  const renderer = EFFECT_RENDERERS[fx?.type];
  if (!renderer) return false;
  renderer(ctx, fx, cam);
  return true;
}
