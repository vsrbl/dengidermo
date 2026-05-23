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

function openingStage(progress, item) {
  if (progress < 0.28) return item?.chestOpenCost > 0 ? "PAY" : "LOCK";
  if (progress < 0.68) return "SCAN";
  return "REVEAL";
}

function drawOpening(ctx, s, r, item, color) {
  const t = Math.max(0, item?._renderAge || 0);
  const p = chestOpeningProgress(item);
  const scan = (t * 18) % 1;
  const stage = openingStage(p, item);
  const flicker = Math.floor(t * 22) % 2 === 0 ? color : "#f3f3f3";
  const shake = item?.chestRevealProfile === "cursed" ? Math.round(Math.sin(t * 42) * 1.5) : 0;
  const burst = r + 3 + Math.sin(Math.min(1, p) * Math.PI) * 7;
  strokeRect(ctx, s.x - burst + shake, s.y - burst, burst * 2, burst * 2, flicker, 2);
  drawRect(ctx, s.x - r * 0.76, s.y + r * 0.48, r * 1.52 * Math.max(scan, p), 2, color);
  if (stage === "SCAN") drawRect(ctx, s.x - r * 0.72, s.y - r * 0.58 + r * 1.16 * scan, r * 1.44, 1, color);
  drawText(ctx, stage, s.x + shake, s.y - r - 12, color, "center", 11);
  const reward = String(item?.chestRevealLabel || "...").slice(0, 12).toUpperCase();
  if (stage === "REVEAL" && reward && !reward.startsWith("PAY")) drawText(ctx, reward, s.x, s.y + r + 17, color, "center", 11);
}

export function drawChestInteractable(ctx, item, cam, affordance = {}) {
  const s = { x: item.x - cam.x, y: item.y - cam.y };
  const r = item.radius || 24;
  const state = item.chestState || (item.opened ? "opened" : "closed");
  const active = state === "closed" && item.active !== false;
  const accent = colorForChest(item);
  const color = active || state === "opening" ? accent : "rgba(255,255,255,0.38)";
  const code = String(item?.chestGlyph || tierCode(item)).slice(0, 3).toUpperCase();

  // One simple world form: square + color + short label. Rarity comes from color/cost/frequency, not decorative geometry.
  strokeRect(ctx, s.x - r, s.y - r, r * 2, r * 2, color, active ? 2 : 1);
  drawRect(ctx, s.x - r, s.y + r - 4, r * 2, 4, active ? accent : "#777");
  drawText(ctx, code, s.x, s.y + 5, active ? "#f3f3f3" : "#888", "center", 13);

  if (state === "opening") {
    drawOpening(ctx, s, r, item, accent);
    return;
  }

  if (active) {
    const cost = Math.max(0, Math.floor(Number.isFinite(item.chestOpenCost) ? item.chestOpenCost : 0));
    const inRange = !!affordance.localInRange;
    const canAfford = affordance.canAfford !== false;
    const promptColor = inRange && !canAfford ? "#ff3048" : accent;
    drawText(ctx, code, s.x, s.y - r - 10, promptColor, "center", 11);
    if (inRange) {
      drawText(ctx, cost > 0 && !canAfford ? `NO GLD ${cost}` : cost > 0 ? `OPEN ${cost}` : "OPEN", s.x, s.y + r + 16, promptColor, "center", 11);
      drawText(ctx, canAfford ? "E" : "---", s.x, s.y + r + 30, promptColor, "center", 11);
    } else if (affordance.localNear) {
      drawText(ctx, cost > 0 ? `${cost} GLD` : "OPEN", s.x, s.y + r + 16, accent, "center", 11);
    }
    return;
  }

  drawText(ctx, "---", s.x, s.y - r - 10, "#777", "center", 11);
  if (item?.chestRevealLabel) drawText(ctx, String(item.chestRevealLabel).slice(0, 12).toUpperCase(), s.x, s.y + r + 16, "#777", "center", 11);
}
