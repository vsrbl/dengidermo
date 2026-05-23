import { GREEN, RED } from "../core/constants.js";

function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function strokeRect(ctx, x, y, w, h, color = "#fff", lineWidth = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawText(ctx, text, x, y, color = "#fff", align = "left") {
  ctx.fillStyle = color;
  ctx.font = "12px Courier New, monospace";
  ctx.textAlign = align;
  ctx.fillText(String(text || ""), Math.round(x), Math.round(y));
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
  const accent = casinoColor(item);
  const color = active ? accent : "rgba(255,255,255,0.42)";

  ctx.strokeStyle = color;
  ctx.lineWidth = active ? 2 : 1;

  // Abstract terminal-slot language: stacked frames + 3 reel cells, no literal lever/machine silhouette.
  strokeRect(ctx, s.x - r, s.y - r, r * 2, r * 2, color, active ? 2 : 1);
  strokeRect(ctx, s.x - r * 0.72, s.y - r * 0.72, r * 1.44, r * 1.44, color, 1);
  strokeRect(ctx, s.x - r * 0.64, s.y - r * 0.5, r * 1.28, r * 0.44, color, 1);

  const cell = r * 0.26;
  const gap = r * 0.08;
  const startX = s.x - (cell * 1.5 + gap);
  const y = s.y - r * 0.4;
  const reelColors = [GREEN, "#f3f3f3", RED];
  for (let i = 0; i < 3; i += 1) {
    const x = startX + i * (cell + gap);
    strokeRect(ctx, x, y, cell, cell, active ? reelColors[i] : "#777", 1);
  }

  strokeRect(ctx, s.x - r * 0.46, s.y + r * 0.02, r * 0.92, r * 0.28, color, 1);
  drawRect(ctx, s.x - r * 0.12, s.y + r * 0.36, r * 0.24, 4, active ? accent : "#777");

  drawText(ctx, String(item.casinoGlyph || "777"), s.x, s.y + r * 0.22, active ? "#f3f3f3" : "#888", "center");
  if (item.casinoState === "revealing" || item.casinoState === "resolved") {
    drawText(ctx, "SPN", s.x, s.y - r - 11, GREEN, "center");
  } else if (active) {
    drawText(ctx, "SLT", s.x, s.y - r - 11, color, "center");
    drawText(ctx, "E", s.x, s.y + r + 17, color, "center");
    drawText(ctx, "BET", s.x, s.y + r + 31, color, "center");
  } else {
    drawText(ctx, "OFF", s.x, s.y - r - 11, "#777", "center");
  }
}
