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
  // Diagonal crosshair, no extra color: shape says ranged.
  hollowSquare(ctx, s, r, 3);
  line(ctx, s.x - r - 4, s.y - r - 4, s.x + r + 4, s.y + r + 4, "#fff", 1);
  line(ctx, s.x + r + 4, s.y - r - 4, s.x - r - 4, s.y + r + 4, "#fff", 1);
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
  renderer(ctx, screenPos, data?.radius || enemy?.radius || 12, data || {}, enemy || {});
}
