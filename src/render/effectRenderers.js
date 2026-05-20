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
  ctx.strokeStyle = GREEN;
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
  ctx.strokeStyle = fx.skin === "green" ? GREEN : "#ffffff";
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
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = Math.max(1, Math.round(4 * (life / maxLife)));
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
  ctx.beginPath();
  ctx.moveTo(Math.round(s.x - r * 1.2), Math.round(s.y));
  ctx.lineTo(Math.round(s.x + r * 1.2), Math.round(s.y));
  ctx.moveTo(Math.round(s.x), Math.round(s.y - r * 1.2));
  ctx.lineTo(Math.round(s.x), Math.round(s.y + r * 1.2));
  ctx.stroke();
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
  droneBeam: drawDroneBeam,
  orbitalHit: drawOrbitalHit,
  explosion: drawExplosion,
  shake: ignoreEffect
});

export function drawEffect(ctx, fx, cam) {
  const renderer = EFFECT_RENDERERS[fx?.type];
  if (!renderer) return false;
  renderer(ctx, fx, cam);
  return true;
}
