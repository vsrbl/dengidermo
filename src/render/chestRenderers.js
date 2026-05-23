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

function colorForChest(item) {
  if (item?.accent === "red" || item?.chestTier === "cursed") return RED;
  if (item?.accent === "white" || item?.chestTier === "weapon") return "#f3f3f3";
  return GREEN;
}

function tierCode(item) {
  const tier = String(item?.chestTier || "basic");
  if (tier === "weapon") return "WPN";
  if (tier === "ability") return "ABL";
  if (tier === "rare") return "RAR";
  if (tier === "cursed") return "CUR";
  return "BSC";
}

function drawDecryptScan(ctx, s, r, item, color) {
  const t = Math.max(0, item?._renderAge || 0);
  const phase = (t * 2.8) % 1;
  const y = s.y - r * 0.82 + phase * r * 1.64;
  strokeRect(ctx, s.x - r * 1.22, s.y - r * 1.22, r * 2.44, r * 2.44, color, 1);
  strokeRect(ctx, s.x - r * 0.42, s.y - r * 0.42, r * 0.84, r * 0.84, color, 1);
  drawRect(ctx, s.x - r * 0.78, y, r * 1.56, 2, color);
  drawText(ctx, "DECRYPT", s.x, s.y - r - 12, color, "center");
  const reward = String(item?.chestRevealLabel || "...").slice(0, 12).toUpperCase();
  if (reward && reward !== "DECRYPT") drawText(ctx, reward, s.x, s.y + r + 17, color, "center");
}

function tierMarks(ctx, s, r, item, color) {
  const tier = item?.chestTier || "basic";
  if (tier === "rare" || tier === "cursed") {
    strokeRect(ctx, s.x - r - 6, s.y - r - 6, r * 2 + 12, r * 2 + 12, color, 1);
  }
  if (tier === "weapon") {
    drawRect(ctx, s.x - 1, s.y - r * 0.32, 2, r * 0.64, color);
    drawRect(ctx, s.x - r * 0.32, s.y - 1, r * 0.64, 2, color);
  }
  if (tier === "ability") {
    strokeRect(ctx, s.x - r * 0.18, s.y - r * 0.18, r * 0.36, r * 0.36, color, 1);
  }
  if (tier === "cursed") {
    drawText(ctx, "!", s.x + r * 0.42, s.y - r * 0.38, color, "center");
  }
}

export function drawChestInteractable(ctx, item, cam) {
  const s = { x: item.x - cam.x, y: item.y - cam.y };
  const r = item.radius || 24;
  const state = item.chestState || (item.opened ? "opened" : "closed");
  const active = state === "closed" && item.active !== false;
  const accent = colorForChest(item);
  const color = active || state === "opening" ? accent : "rgba(255,255,255,0.44)";

  ctx.strokeStyle = color;
  ctx.lineWidth = active ? 2 : 1;

  // Abstract terminal-object design: nested squares and small status blocks, no literal chest lid.
  strokeRect(ctx, s.x - r, s.y - r, r * 2, r * 2, color, active ? 2 : 1);
  strokeRect(ctx, s.x - r * 0.62, s.y - r * 0.62, r * 1.24, r * 1.24, color, 1);
  drawRect(ctx, s.x - r * 0.28, s.y - r * 0.74, r * 0.56, 3, color);
  drawRect(ctx, s.x - 3, s.y - 3, 6, 6, active ? accent : "#777");
  tierMarks(ctx, s, r, item, color);

  const code = String(item?.glyph || tierCode(item)).slice(0, 3).toUpperCase();
  drawText(ctx, code, s.x, s.y + 4, active ? "#f3f3f3" : "#999", "center");

  if (state === "opening") {
    drawDecryptScan(ctx, s, r, item, accent);
    return;
  }

  if (active) {
    drawText(ctx, tierCode(item), s.x, s.y - r - 10, accent, "center");
    drawText(ctx, "E", s.x, s.y + r + 16, accent, "center");
  } else {
    const doneText = state === "claimed" ? "DONE" : "EMPTY";
    drawText(ctx, doneText, s.x, s.y - r - 10, "#777", "center");
    if (item?.chestRevealLabel) drawText(ctx, String(item.chestRevealLabel).slice(0, 12).toUpperCase(), s.x, s.y + r + 16, "#777", "center");
  }
}
