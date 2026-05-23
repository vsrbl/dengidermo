import { GREEN, RED } from "../core/constants.js";

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

function casinoColor(item) {
  if (item?.accent === "green") return GREEN;
  if (item?.accent === "white") return "#f3f3f3";
  return RED;
}

export function drawCasinoInteractable(ctx, item, cam) {
  const s = { x: item.x - cam.x, y: item.y - cam.y };
  const r = item.radius || 28;
  const active = !item.opened && item.active !== false;
  const color = active ? casinoColor(item) : "rgba(255,255,255,0.42)";

  ctx.strokeStyle = color;
  ctx.lineWidth = active ? 2 : 1;

  ctx.strokeRect(Math.round(s.x - r * 0.82), Math.round(s.y - r * 1.12), Math.round(r * 1.64), Math.round(r * 2.18));
  ctx.strokeRect(Math.round(s.x - r * 0.58), Math.round(s.y - r * 0.82), Math.round(r * 1.16), Math.round(r * 0.56));
  ctx.strokeRect(Math.round(s.x - r * 0.58), Math.round(s.y - r * 0.05), Math.round(r * 1.16), Math.round(r * 0.48));
  drawRect(ctx, s.x - r * 0.42, s.y - r * 0.66, r * 0.2, r * 0.28, active ? GREEN : "#777");
  drawRect(ctx, s.x - r * 0.1, s.y - r * 0.66, r * 0.2, r * 0.28, active ? "#f3f3f3" : "#777");
  drawRect(ctx, s.x + r * 0.22, s.y - r * 0.66, r * 0.2, r * 0.28, active ? RED : "#777");

  ctx.beginPath();
  ctx.moveTo(Math.round(s.x + r * 0.82), Math.round(s.y - r * 0.32));
  ctx.lineTo(Math.round(s.x + r * 1.18), Math.round(s.y - r * 0.62));
  ctx.lineTo(Math.round(s.x + r * 1.18), Math.round(s.y - r * 0.92));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(Math.round(s.x + r * 1.18), Math.round(s.y - r * 0.95), 4, 0, Math.PI * 2);
  ctx.stroke();

  drawText(ctx, String(item.casinoGlyph || "777"), s.x, s.y + r * 0.3, active ? "#f3f3f3" : "#777", "center");
  if (item.casinoState === "revealing" || item.casinoState === "resolved") {
    drawText(ctx, "SPIN", s.x, s.y - r - 11, GREEN, "center");
  } else if (active) {
    drawText(ctx, String(item.label || item.casinoLabel || "SLOT").slice(0, 8), s.x, s.y - r - 11, color, "center");
    drawText(ctx, "E", s.x, s.y + r + 17, color, "center");
    drawText(ctx, "STAKE", s.x, s.y + r + 31, color, "center");
  } else {
    drawText(ctx, "OFFLINE", s.x, s.y - r - 11, "#777", "center");
  }
}
