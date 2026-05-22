import { GREEN } from "../core/constants.js";

function strokeRect(ctx, x, y, w, h, color = "#ff3048", lineWidth = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawRect(ctx, x, y, w, h, color = "#ff3048") {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function screen(obj, cam) {
  return { x: obj.x - cam.x, y: obj.y - cam.y };
}

function drawLinkedShell(ctx, s, r, enemy, variant) {
  const color = enemy?.armor?.variant?.color || variant?.color || "#ff3048";
  const outer = r + 12;
  strokeRect(ctx, s.x - outer, s.y - outer, outer * 2, outer * 2, color, 1);
  if (enemy?.armor?.variant?.protected) {
    drawRect(ctx, s.x - 2, s.y - outer - 7, 4, 4, color);
    drawRect(ctx, s.x - outer - 7, s.y - 2, 4, 4, color);
    drawRect(ctx, s.x + outer + 3, s.y - 2, 4, 4, color);
  }
}

function drawRedTether(ctx, enemy, link, cam, variant) {
  const color = enemy?.armor?.variant?.color || variant?.color || "#ff3048";
  const a = screen(enemy, cam);
  const b = screen(link, cam);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(a.x), Math.round(a.y));
  ctx.lineTo(Math.round(b.x), Math.round(b.y));
  ctx.stroke();
  drawRect(ctx, b.x - 3, b.y - 3, 6, 6, color);
}

const ARMOR_VARIANT_RENDERERS = Object.freeze({
  linked_shell: drawLinkedShell
});

const ARMOR_LINK_RENDERERS = Object.freeze({
  red_tether: drawRedTether
});

const FALLBACK_VARIANTS = Object.freeze({
  linked: Object.freeze({ id: "linked", color: "#ff3048" })
});

export function drawEnemyArmorVariantOverlay(ctx, enemy, screenPos, radius) {
  const variant = enemy?.armor?.variant;
  if (!variant?.id) return false;
  const rendererId = variant.visual || "linked_shell";
  const renderer = ARMOR_VARIANT_RENDERERS[rendererId] || ARMOR_VARIANT_RENDERERS.linked_shell;
  renderer(ctx, screenPos, radius, enemy, variant || FALLBACK_VARIANTS[variant.id]);
  return true;
}

export function drawEnemyArmorVariantLinks(ctx, enemy, cam) {
  const variant = enemy?.armor?.variant;
  const links = Array.isArray(variant?.links) ? variant.links : [];
  if (!variant?.id || !links.length) return false;
  const rendererId = variant.linkVisual || "red_tether";
  const renderer = ARMOR_LINK_RENDERERS[rendererId] || ARMOR_LINK_RENDERERS.red_tether;
  for (const link of links) {
    renderer(ctx, enemy, link, cam, variant || FALLBACK_VARIANTS[variant.id]);
  }
  return true;
}
