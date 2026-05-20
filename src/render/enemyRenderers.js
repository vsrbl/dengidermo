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

function line(ctx, x1, y1, x2, y2, color = "#fff", width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(Math.round(x1), Math.round(y1));
  ctx.lineTo(Math.round(x2), Math.round(y2));
  ctx.stroke();
}

function accentColor(data) {
  if (data?.accentColor === "red") return "#ff3048";
  if (data?.accentColor === "green") return GREEN;
  return "#fff";
}

function hollowSquare(ctx, s, r, pad = 3) {
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, "#fff");
  drawRect(ctx, s.x - r + pad, s.y - r + pad, r * 2 - pad * 2, r * 2 - pad * 2, "#050505");
}

function drawGrunt(ctx, s, r) {
  // baseline: plain square, nothing fancy
  hollowSquare(ctx, s, r, 3);
}

function drawRunner(ctx, s, r) {
  // fast: small core + trailing speed ticks
  hollowSquare(ctx, s, r, 2);
  drawRect(ctx, s.x - r - 6, s.y - 5, 4, 2, "#fff");
  drawRect(ctx, s.x - r - 9, s.y + 3, 3, 2, "#777");
}

function drawTank(ctx, s, r) {
  // durable: thick outer armor, slow readable block
  hollowSquare(ctx, s, r, 5);
  strokeRect(ctx, s.x - r - 4, s.y - r - 4, r * 2 + 8, r * 2 + 8, "#fff", 1);
}

function drawShooter(ctx, s, r, data) {
  // ranged: crosshair body
  const accent = accentColor(data);
  hollowSquare(ctx, s, r, 3);
  line(ctx, s.x - r - 4, s.y, s.x + r + 4, s.y, accent, 1);
  line(ctx, s.x, s.y - r - 4, s.x, s.y + r + 4, accent, 1);
}

function drawCharger(ctx, s, r, data) {
  // charge: red wedge/arrow silhouette, supported by telegraph line for direction
  const accent = accentColor(data);
  hollowSquare(ctx, s, r, 3);
  drawRect(ctx, s.x - 7, s.y - 7, 14, 14, accent);
  drawRect(ctx, s.x - 3, s.y - 3, 6, 6, "#050505");
  line(ctx, s.x - r - 2, s.y - r - 2, s.x, s.y - r - 8, accent, 1);
  line(ctx, s.x + r + 2, s.y - r - 2, s.x, s.y - r - 8, accent, 1);
}

function drawBomber(ctx, s, r, data) {
  // explosion: fuse + danger radius marker, minimal and instantly recognizable
  const accent = accentColor(data);
  hollowSquare(ctx, s, r, 3);
  strokeRect(ctx, s.x - r - 5, s.y - r - 5, r * 2 + 10, r * 2 + 10, accent, 1);
  drawRect(ctx, s.x - 2, s.y - r - 8, 4, 6, accent);
  drawRect(ctx, s.x - 1, s.y - r - 12, 2, 4, "#fff");
  drawRect(ctx, s.x - 4, s.y - 4, 8, 8, accent);
  drawRect(ctx, s.x - 2, s.y - 2, 4, 4, "#050505");
}

function drawBoss(ctx, s, r, data) {
  const accent = accentColor(data);
  hollowSquare(ctx, s, r, 5);
  strokeRect(ctx, s.x - r - 5, s.y - r - 5, r * 2 + 10, r * 2 + 10, accent, 1);
  line(ctx, s.x - r + 9, s.y, s.x + r - 9, s.y, accent, 3);
  line(ctx, s.x, s.y - r + 9, s.x, s.y + r - 9, accent, 3);
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
