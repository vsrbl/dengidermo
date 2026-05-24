import { drawEnemyArmorVariantOverlay } from "./armorVariantRenderers.js";
import { drawEnemyEliteOverlay } from "./eliteRenderers.js";
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

function drawText(ctx, text, x, y, color = "#fff", align = "center") {
  ctx.fillStyle = color;
  ctx.font = "12px Courier New, monospace";
  ctx.textAlign = align;
  ctx.fillText(text, Math.round(x), Math.round(y));
}

function hollowSquare(ctx, s, r, pad = 3) {
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, "#fff");
  drawRect(ctx, s.x - r + pad, s.y - r + pad, r * 2 - pad * 2, r * 2 - pad * 2, "#050505");
}

function armorAlive(enemy) {
  return !!enemy?.armor && enemy.armor.hp > 0;
}

function drawArmorSquare(ctx, s, r, enemy, heavy = false) {
  if (!armorAlive(enemy)) return;
  const ratio = Math.max(0, Math.min(1, enemy.armor.ratio ?? enemy.armor.hp / Math.max(1, enemy.armor.maxHp || 1)));
  const pad = heavy ? 8 : 5;
  const outer = r + pad;
  strokeRect(ctx, s.x - outer, s.y - outer, outer * 2, outer * 2, "#fff", heavy ? 2 : 1);
  const tick = Math.max(3, Math.round((outer * 2 - 4) * ratio));
  drawRect(ctx, s.x - outer + 2, s.y - outer - 4, tick, 2, "#fff");
}

function drawGrunt(ctx, s, r) {
  hollowSquare(ctx, s, r, 3);
}

function drawRunner(ctx, s, r) {
  // Runner is intentionally only a larger plain square: size + speed are the read.
  hollowSquare(ctx, s, r, 3);
}

function drawTank(ctx, s, r, _data, enemy) {
  // Tank is a big square whose outer square is real regenerating armor.
  hollowSquare(ctx, s, r, 4);
  drawArmorSquare(ctx, s, r, enemy, false);
}

function drawShooter(ctx, s, r) {
  // Two simple diagonal lines inside the square, nothing more.
  hollowSquare(ctx, s, r, 3);
  const inset = 3;
  line(ctx, s.x - r + inset, s.y - r + inset, s.x + r - inset, s.y + r - inset, "#fff", 1);
  line(ctx, s.x + r - inset, s.y - r + inset, s.x - r + inset, s.y + r - inset, "#fff", 1);
}

function drawCharger(ctx, s, r) {
  // No protrusions; red core means dash threat, telegraph line gives direction.
  hollowSquare(ctx, s, r, 3);
  drawRect(ctx, s.x - 7, s.y - 7, 14, 14, "#ff3048");
  drawRect(ctx, s.x - 3, s.y - 3, 6, 6, "#050505");
}

function drawBomber(ctx, s, r) {
  hollowSquare(ctx, s, r, 3);
  strokeRect(ctx, s.x - r - 5, s.y - r - 5, r * 2 + 10, r * 2 + 10, "#ff3048", 1);
  drawRect(ctx, s.x - 2, s.y - r - 8, 4, 6, "#ff3048");
  drawRect(ctx, s.x - 1, s.y - r - 12, 2, 4, "#fff");
}

function drawBoss(ctx, s, r, _data, enemy) {
  hollowSquare(ctx, s, r, 5);
  drawArmorSquare(ctx, s, r, enemy, true);
  drawText(ctx, "BOSS", s.x, s.y - r - 8, "#00ff66", "center");
}

function drawCodeSquare(ctx, s, r, code, color = "#fff") {
  drawText(ctx, code, s.x, s.y - r - 7, color, "center");
  hollowSquare(ctx, s, r, 3);
}

function drawEchoEnemy(ctx, s, r) {
  drawText(ctx, "ECH", s.x, s.y - r - 7, "#b45cff", "center");
  strokeRect(ctx, s.x - r, s.y - r, r * 2, r * 2, "#b45cff", 1);
  strokeRect(ctx, s.x - r + 4, s.y - r + 4, r * 2 - 8, r * 2 - 8, "#050505", 1);
  strokeRect(ctx, s.x - r - 7, s.y - r - 4, r * 2, r * 2, "#777", 1);
  line(ctx, s.x - r - 8, s.y + r + 5, s.x + r + 4, s.y - r - 7, "#b45cff", 1);
}

function drawOrbiterEnemy(ctx, s, r, _data, enemy = {}) {
  drawCodeSquare(ctx, s, r, "ORB");
  const fx = Number.isFinite(enemy.projectileDefenseFacingX) ? enemy.projectileDefenseFacingX : 1;
  const fy = Number.isFinite(enemy.projectileDefenseFacingY) ? enemy.projectileDefenseFacingY : 0;
  const angle = Math.atan2(fy, fx);
  const arc = Math.PI * 0.86;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(Math.round(s.x), Math.round(s.y), r + 8, angle - arc * 0.5, angle + arc * 0.5);
  ctx.stroke();
  line(ctx, s.x + Math.cos(angle) * (r + 5), s.y + Math.sin(angle) * (r + 5), s.x + Math.cos(angle) * (r + 16), s.y + Math.sin(angle) * (r + 16), "#fff", 1);
}

function drawAnchorEnemy(ctx, s, r) {
  drawCodeSquare(ctx, s, r, "ANC");
  line(ctx, s.x - r - 8, s.y, s.x + r + 8, s.y, "#fff", 1);
  line(ctx, s.x, s.y - r - 8, s.x, s.y + r + 8, "#fff", 1);
}

function drawSplitter(ctx, s, r) {
  drawCodeSquare(ctx, s, r, "SPL");
  line(ctx, s.x - r + 6, s.y - r + 6, s.x + r - 6, s.y + r - 6, "#fff", 1);
  line(ctx, s.x - r + 8, s.y + r - 10, s.x, s.y, "#777", 1);
}

function drawSplitterMedium(ctx, s, r) {
  drawCodeSquare(ctx, s, r, "SPL");
  line(ctx, s.x - r + 4, s.y - r + 4, s.x + r - 4, s.y + r - 4, "#fff", 1);
}

function drawSplitterSmall(ctx, s, r) {
  drawText(ctx, "SPL", s.x, s.y - r - 6, "#fff", "center");
  hollowSquare(ctx, s, r, 2);
  line(ctx, s.x - r + 2, s.y, s.x + r - 2, s.y, "#fff", 1);
}

function drawSplitterTiny(ctx, s, r) {
  hollowSquare(ctx, s, r, 2);
  line(ctx, s.x - r + 2, s.y, s.x + r - 2, s.y, "#fff", 1);
}

function drawPrismEnemy(ctx, s, r) {
  drawText(ctx, "PRS", s.x, s.y - r - 7, "#fff", "center");
  ctx.save();
  ctx.translate(Math.round(s.x), Math.round(s.y));
  ctx.rotate(Math.PI / 4);
  strokeRect(ctx, -r, -r, r * 2, r * 2, "#fff", 1);
  ctx.restore();
}

function drawPulseEnemy(ctx, s, r) {
  drawCodeSquare(ctx, s, r, "PLS", "#ff3048");
  strokeRect(ctx, s.x - r - 8, s.y - r - 8, r * 2 + 16, r * 2 + 16, "#ff3048", 1);
}

function drawLeechEnemy(ctx, s, r) {
  drawCodeSquare(ctx, s, r, "LCH", "#00ff66");
  line(ctx, s.x - r, s.y + r, s.x + r, s.y - r, "#00ff66", 1);
}

function drawGlitchEnemy(ctx, s, r) {
  drawText(ctx, "GLT", s.x, s.y - r - 7, "#b45cff", "center");
  strokeRect(ctx, s.x - r, s.y - r, r * 2, r * 2, "#b45cff", 1);
  strokeRect(ctx, s.x - r - 4, s.y - r + 3, r * 2, r * 2, "#777", 1);
  line(ctx, s.x - r - 6, s.y, s.x + r + 6, s.y, "#b45cff", 1);
}

function drawBouncerEnemy(ctx, s, r) {
  drawCodeSquare(ctx, s, r, "BNC", "#ff3048");
  line(ctx, s.x - r - 8, s.y + r + 4, s.x - r - 2, s.y + r - 2, "#ff3048", 1);
  line(ctx, s.x + r + 8, s.y - r - 4, s.x + r + 2, s.y - r + 2, "#ff3048", 1);
}

function drawHeraldEnemy(ctx, s, r) {
  drawCodeSquare(ctx, s, r, "HRD", "#ff3048");
  line(ctx, s.x, s.y - r - 12, s.x, s.y - r - 2, "#ff3048", 1);
  line(ctx, s.x - 8, s.y - r - 12, s.x + 8, s.y - r - 12, "#ff3048", 1);
}

export const ENEMY_RENDERERS = Object.freeze({
  grunt: drawGrunt,
  runner: drawRunner,
  tank: drawTank,
  shooter: drawShooter,
  charger: drawCharger,
  bomber: drawBomber,
  boss: drawBoss,
  echo: drawEchoEnemy,
  orbiter: drawOrbiterEnemy,
  anchor: drawAnchorEnemy,
  splitter: drawSplitter,
  splitter_medium: drawSplitterMedium,
  splitter_small: drawSplitterSmall,
  splitter_tiny: drawSplitterTiny,
  prism: drawPrismEnemy,
  pulse: drawPulseEnemy,
  leech: drawLeechEnemy,
  glitch: drawGlitchEnemy,
  bouncer: drawBouncerEnemy,
  herald: drawHeraldEnemy
});

export function drawEnemySprite(ctx, enemy, data, screenPos) {
  const renderer = ENEMY_RENDERERS[data?.renderStyle || enemy?.kind] || ENEMY_RENDERERS.grunt;
  const radius = data?.radius || enemy?.radius || 12;
  renderer(ctx, screenPos, radius, data || {}, enemy || {});
  drawEnemyArmorVariantOverlay(ctx, enemy || {}, screenPos, radius);
  drawEnemyEliteOverlay(ctx, enemy || {}, screenPos, radius);
}
