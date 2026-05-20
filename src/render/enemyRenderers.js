import { GREEN } from "../core/constants.js";

function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function strokeRect(ctx, x, y, w, h, color = "#fff", lineWidth = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function accentColor(data) {
  if (data?.accentColor === 'red') return '#ff3048';
  if (data?.accentColor === 'green') return GREEN;
  return '#fff';
}

function drawCore(ctx, x, y, size, color) {
  drawRect(ctx, x - size / 2, y - size / 2, size, size, color);
}

function drawGrunt(ctx, s, r, data) {
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, '#fff');
  drawRect(ctx, s.x - r + 3, s.y - r + 3, r * 2 - 6, r * 2 - 6, '#050505');
  drawCore(ctx, s.x, s.y, 4, accentColor(data));
}

function drawRunner(ctx, s, r, data) {
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, '#fff');
  drawRect(ctx, s.x - r + 2, s.y - r + 2, r * 2 - 4, r * 2 - 4, '#050505');
  drawRect(ctx, s.x - r, s.y - r, 4, 4, '#050505');
  drawRect(ctx, s.x + r - 4, s.y - r, 4, 4, '#050505');
  drawRect(ctx, s.x - r, s.y + r - 4, 4, 4, '#050505');
  drawRect(ctx, s.x + r - 4, s.y + r - 4, 4, 4, '#050505');
  drawRect(ctx, s.x - 1, s.y - r - 2, 2, 5, accentColor(data));
  drawRect(ctx, s.x - 1, s.y + r - 3, 2, 5, accentColor(data));
}

function drawTank(ctx, s, r, data) {
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, '#fff');
  drawRect(ctx, s.x - r + 4, s.y - r + 4, r * 2 - 8, r * 2 - 8, '#050505');
  strokeRect(ctx, s.x - r - 3, s.y - r - 3, r * 2 + 6, r * 2 + 6, '#fff', 1);
  drawRect(ctx, s.x - 5, s.y - 5, 10, 10, accentColor(data));
}

function drawShooter(ctx, s, r, data) {
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, '#fff');
  drawRect(ctx, s.x - r + 3, s.y - r + 3, r * 2 - 6, r * 2 - 6, '#050505');
  strokeRect(ctx, s.x - r - 4, s.y - 4, 4, 8, '#fff', 1);
  strokeRect(ctx, s.x + r, s.y - 4, 4, 8, '#fff', 1);
  drawRect(ctx, s.x - 1, s.y - 7, 2, 14, accentColor(data));
  drawRect(ctx, s.x - 7, s.y - 1, 14, 2, accentColor(data));
}

function drawCharger(ctx, s, r, data) {
  const accent = accentColor(data);
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, '#fff');
  drawRect(ctx, s.x - r + 3, s.y - r + 3, r * 2 - 6, r * 2 - 6, '#050505');
  drawRect(ctx, s.x - r + 1, s.y - r + 1, 5, 5, '#050505');
  drawRect(ctx, s.x + r - 6, s.y - r + 1, 5, 5, '#050505');
  drawRect(ctx, s.x - r + 1, s.y + r - 6, 5, 5, '#050505');
  drawRect(ctx, s.x + r - 6, s.y + r - 6, 5, 5, '#050505');
  drawRect(ctx, s.x - 6, s.y - 6, 12, 12, accent);
  drawRect(ctx, s.x - 10, s.y - 1, 4, 2, accent);
  drawRect(ctx, s.x + 6, s.y - 1, 4, 2, accent);
}

function drawBomber(ctx, s, r, data) {
  const accent = accentColor(data);
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, '#fff');
  drawRect(ctx, s.x - r + 2, s.y - r + 2, r * 2 - 4, r * 2 - 4, '#050505');
  drawRect(ctx, s.x - 2, s.y - r - 4, 4, 4, accent);
  drawRect(ctx, s.x - 1, s.y - r - 8, 2, 4, '#fff');
  drawRect(ctx, s.x - 7, s.y - 1, 14, 2, accent);
  drawRect(ctx, s.x - 1, s.y - 7, 2, 14, accent);
  drawRect(ctx, s.x - 4, s.y - 4, 8, 8, '#fff');
  drawRect(ctx, s.x - 2, s.y - 2, 4, 4, '#050505');
}

function drawBoss(ctx, s, r, data) {
  const accent = accentColor(data);
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, '#fff');
  drawRect(ctx, s.x - r + 5, s.y - r + 5, r * 2 - 10, r * 2 - 10, '#050505');
  strokeRect(ctx, s.x - r - 4, s.y - r - 4, r * 2 + 8, r * 2 + 8, accent, 1);
  drawRect(ctx, s.x - 2, s.y - r + 8, 4, r * 2 - 16, accent);
  drawRect(ctx, s.x - r + 8, s.y - 2, r * 2 - 16, 4, accent);
}

export const ENEMY_RENDERERS = Object.freeze({
  grunt: drawGrunt,
  runner: drawRunner,
  tank: drawTank,
  shooter: drawShooter,
  charger: drawCharger,
  bomber: drawBomber,
  boss: drawBoss
});

export function drawEnemySprite(ctx, enemy, data, screenPos) {
  const renderer = ENEMY_RENDERERS[data?.renderStyle || enemy?.kind] || ENEMY_RENDERERS.grunt;
  renderer(ctx, screenPos, data?.radius || enemy?.radius || 12, data || {});
}
