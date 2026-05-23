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

function colorForChest(item) {
  if (item?.accent === "red" || item?.chestTier === "cursed") return RED;
  if (item?.accent === "white" || item?.chestTier === "weapon") return "#f3f3f3";
  return GREEN;
}

function tierMarks(ctx, s, r, item, color) {
  const tier = item.chestTier || "basic";
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  if (tier === "rare" || tier === "cursed") {
    ctx.strokeRect(Math.round(s.x - r - 5), Math.round(s.y - r - 5), Math.round(r * 2 + 10), Math.round(r * 2 + 10));
  }
  if (tier === "weapon") {
    ctx.beginPath();
    ctx.moveTo(Math.round(s.x - r * 0.52), Math.round(s.y));
    ctx.lineTo(Math.round(s.x + r * 0.52), Math.round(s.y));
    ctx.moveTo(Math.round(s.x), Math.round(s.y - r * 0.32));
    ctx.lineTo(Math.round(s.x), Math.round(s.y + r * 0.52));
    ctx.stroke();
  }
  if (tier === "ability") {
    ctx.beginPath();
    ctx.arc(Math.round(s.x), Math.round(s.y), Math.max(4, r * 0.28), 0, Math.PI * 2);
    ctx.stroke();
  }
  if (tier === "cursed") {
    drawText(ctx, "!", s.x, s.y + 4, color, "center");
  }
}

export function drawChestInteractable(ctx, item, cam) {
  const s = { x: item.x - cam.x, y: item.y - cam.y };
  const r = item.radius || 24;
  const state = item.chestState || (item.opened ? "opened" : "closed");
  const active = state === "closed" && item.active !== false;
  const color = active || state === "opening" ? colorForChest(item) : "rgba(255,255,255,0.44)";

  ctx.strokeStyle = color;
  ctx.lineWidth = active ? 2 : 1;

  const bodyX = Math.round(s.x - r);
  const bodyY = Math.round(s.y - r * 0.3);
  const bodyW = Math.round(r * 2);
  const bodyH = Math.round(r * 1.15);
  ctx.strokeRect(bodyX, bodyY, bodyW, bodyH);

  const lidY = state === "closed" ? s.y - r : s.y - r * 1.15;
  const lidH = state === "closed" ? r * 0.72 : r * 0.42;
  ctx.strokeRect(Math.round(s.x - r * 0.92), Math.round(lidY), Math.round(r * 1.84), Math.round(lidH));
  ctx.beginPath();
  ctx.moveTo(Math.round(s.x - r * 0.9), Math.round(s.y - r * 0.3));
  ctx.lineTo(Math.round(s.x + r * 0.9), Math.round(s.y - r * 0.3));
  ctx.stroke();

  drawRect(ctx, s.x - 4, s.y + r * 0.04, 8, 7, active ? colorForChest(item) : "#777");
  tierMarks(ctx, s, r, item, color);

  if (state === "opening") {
    ctx.strokeStyle = colorForChest(item);
    ctx.strokeRect(Math.round(s.x - r * 1.22), Math.round(s.y - r * 1.22), Math.round(r * 2.44), Math.round(r * 2.44));
    drawText(ctx, "OPENING", s.x, s.y - r - 13, colorForChest(item), "center");
    return;
  }

  if (active) {
    drawText(ctx, String(item.label || "CHEST").slice(0, 7), s.x, s.y - r - 9, colorForChest(item), "center");
    drawText(ctx, "E", s.x, s.y + r + 17, colorForChest(item), "center");
  } else {
    drawText(ctx, state === "claimed" ? "CLAIMED" : "OPEN", s.x, s.y - r - 9, "#777", "center");
  }
}
