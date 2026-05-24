import { ELITE_VARIANTS } from "../data/eliteVariants.js";

function strokeRect(ctx, x, y, w, h, color = "#ff3048", lineWidth = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawRect(ctx, x, y, w, h, color = "#ff3048") {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawInnerCore(ctx, s, r, enemy, variant) {
  const color = enemy?.elite?.color || variant?.color || "#ff3048";
  const core = Math.max(4, Math.round(r * 0.42));
  strokeRect(ctx, s.x - r - 3, s.y - r - 3, r * 2 + 6, r * 2 + 6, color, 1);
  drawRect(ctx, s.x - core / 2, s.y - core / 2, core, core, color);
  const hollow = Math.max(2, Math.round(core * 0.42));
  drawRect(ctx, s.x - hollow / 2, s.y - hollow / 2, hollow, hollow, "#050505");
}

const ELITE_RENDERERS = Object.freeze({
  inner_core: drawInnerCore
});

export function drawEnemyEliteOverlay(ctx, enemy, screenPos, radius) {
  const variant = ELITE_VARIANTS[enemy?.elite?.id];
  if (!variant) return false;
  const rendererId = enemy?.elite?.visual || variant.visual?.renderer || "inner_core";
  const renderer = ELITE_RENDERERS[rendererId] || ELITE_RENDERERS.inner_core;
  renderer(ctx, screenPos, radius, enemy, variant);
  return true;
}
