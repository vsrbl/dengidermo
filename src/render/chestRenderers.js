function drawRect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function strokeRect(ctx, x, y, w, h, color = "#fff", lineWidth = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawText(ctx, text, x, y, color = "#fff", align = "left", size = 12) {
  ctx.fillStyle = color;
  ctx.font = `${size}px Courier New, monospace`;
  ctx.textAlign = align;
  ctx.fillText(String(text || ""), Math.round(x), Math.round(y));
}

function colorForChest(item) {
  if (item?.visualColor) return item.visualColor;
  if (item?.accent === "purple" || item?.chestTier === "cursed") return "#b45cff";
  if (item?.accent === "cyan" || item?.chestTier === "ability") return "#66f6ff";
  if (item?.accent === "green" || item?.chestTier === "weapon") return "#00ff66";
  if (item?.accent === "bright_green" || item?.chestTier === "rare") return "#baffd2";
  return "#f3f3f3";
}

function tierCode(item) {
  const tier = String(item?.chestTier || "basic");
  if (tier === "weapon") return "WPN";
  if (tier === "ability") return "ABL";
  if (tier === "rare") return "RAR";
  if (tier === "cursed") return "CRS";
  return "BSC";
}

function chestOpeningProgress(item) {
  const duration = Math.max(0.001, Number.isFinite(item?.chestOpenDuration) ? item.chestOpenDuration : 0.5);
  const left = Math.max(0, Number.isFinite(item?.chestOpenTimer) ? item.chestOpenTimer : 0);
  return Math.max(0, Math.min(1, 1 - left / duration));
}

function drawOpening(ctx, s, r, item, color) {
  const t = Math.max(0, item?._renderAge || 0);
  const p = chestOpeningProgress(item);
  const scan = (t * 15) % 1;
  const shake = item?.chestRevealProfile === "cursed" ? Math.round(Math.sin(t * 38) * 1.2) : 0;
  const flicker = Math.floor(t * 24) % 2 === 0 ? color : "#f3f3f3";
  const burst = r + 3 + Math.sin(Math.min(1, p) * Math.PI) * 6;
  const sweepX = s.x - r + r * 2 * scan;

  // Opening keeps the same minimal chest shape. No PAY/SCAN/REVEAL text in-world.
  strokeRect(ctx, s.x - burst + shake, s.y - burst, burst * 2, burst * 2, flicker, 2);
  drawRect(ctx, sweepX + shake, s.y - r + 3, 2, r * 2 - 6, color);
  drawRect(ctx, s.x - r, s.y + r + 4, r * 2 * p, 2, color);
}

function compactPrompt(cost, canAfford) {
  if (!canAfford && cost > 0) return "NO GLD";
  if (cost > 0) return `E/${cost}`;
  return "E";
}

export function drawChestInteractable(ctx, item, cam, affordance = {}) {
  const s = { x: item.x - cam.x, y: item.y - cam.y };
  const r = item.radius || 24;
  const state = item.chestState || (item.opened ? "opened" : "closed");
  const active = state === "closed" && item.active !== false;
  const accent = colorForChest(item);
  const color = active || state === "opening" ? accent : "rgba(255,255,255,0.30)";
  const labelColor = active || state === "opening" ? "#f3f3f3" : "#777";
  const code = String(item?.chestGlyph || tierCode(item)).slice(0, 3).toUpperCase();

  // Current chest visual contract: one simple terminal object: one square, one code, compact nearby affordance.
  strokeRect(ctx, s.x - r, s.y - r, r * 2, r * 2, color, active || state === "opening" ? 2 : 1);
  drawText(ctx, code, s.x, s.y + 5, labelColor, "center", 13);

  if (state === "opening") {
    drawOpening(ctx, s, r, item, accent);
    return;
  }

  if (!active) return;

  const cost = Math.max(0, Math.floor(Number.isFinite(item.chestOpenCost) ? item.chestOpenCost : 0));
  const inRange = !!affordance.localInRange;
  const near = !!affordance.localNear;
  const canAfford = affordance.canAfford !== false;
  const promptColor = inRange && !canAfford ? "#ff3048" : accent;

  if (inRange) {
    drawText(ctx, compactPrompt(cost, canAfford), s.x, s.y + r + 16, promptColor, "center", 11);
    return;
  }

  if (near && cost > 0) {
    drawText(ctx, `${cost}`, s.x, s.y + r + 14, accent, "center", 10);
  }
}
