import { GREEN, RED } from "../core/constants.js";
import { CASINO_STAKES } from "../data/casinoStakes.js";

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

function casinoColor(item) {
  if (item?.accent === "green") return GREEN;
  if (item?.accent === "white") return "#f3f3f3";
  return RED;
}

export function drawCasinoInteractable(ctx, item, cam, affordance = {}) {
  const s = { x: item.x - cam.x, y: item.y - cam.y };
  const r = item.radius || 28;
  const active = !item.opened && item.active !== false;
  const accent = casinoColor(item);
  const color = active ? accent : "rgba(255,255,255,0.38)";
  const result = item.casinoLastResult || {};
  const resultActive = item.casinoState === "revealing" || item.casinoState === "resolved";
  const resultColor = resultActive && result.match ? GREEN : accent;
  const age = Math.max(0, item?._renderAge || 0);

  // World casino object is intentionally plain: one square, one red signal, one label. Modal owns the reel detail.
  strokeRect(ctx, s.x - r, s.y - r, r * 2, r * 2, color, active ? 2 : 1);
  if (resultActive) {
    const pulse = r + 5 + Math.sin(age * 18) * 3;
    strokeRect(ctx, s.x - pulse, s.y - pulse, pulse * 2, pulse * 2, resultColor, 1);
  }
  drawRect(ctx, s.x - r, s.y + r - 4, r * 2, 4, active ? accent : "#777");
  drawText(ctx, String(item.casinoGlyph || "BET").slice(0, 3).toUpperCase(), s.x, s.y + 5, active ? "#f3f3f3" : "#888", "center", 13);

  if (resultActive) {
    const label = result.match ? String(result.outcomeLabel || "WIN").slice(0, 6).toUpperCase() : "LOSS";
    const symbols = Array.isArray(result.symbolLabels) && result.symbolLabels.length ? result.symbolLabels.map((v) => String(v).slice(0, 3)).join("/") : "---";
    const top = item.casinoState === "revealing" ? "ROLL" : (String(result.revealProfile || "").includes("jackpot") ? "JCK" : label);
    drawText(ctx, top, s.x, s.y - r - 11, resultColor, "center", 11);
    drawText(ctx, symbols.slice(0, 11), s.x, s.y + r + 17, resultColor, "center", 11);
    return;
  }

  if (active) {
    const allowedCosts = Array.isArray(item.casinoAllowedStakes)
      ? item.casinoAllowedStakes.map((id) => CASINO_STAKES[id]?.cost).filter(Number.isFinite)
      : [];
    const minCost = allowedCosts.length ? Math.min(...allowedCosts) : 0;
    const canAffordAny = !minCost || !Number.isFinite(affordance.localMoney) || affordance.localMoney >= minCost;
    const promptColor = affordance.localInRange && !canAffordAny ? "#ff3048" : accent;
    drawText(ctx, "BET", s.x, s.y - r - 11, promptColor, "center", 11);
    if (affordance.localInRange) {
      drawText(ctx, canAffordAny ? "E" : `NO GLD ${minCost}`, s.x, s.y + r + 17, promptColor, "center", 11);
    } else if (affordance.localNear) {
      drawText(ctx, minCost > 0 ? `MIN ${minCost}` : "E", s.x, s.y + r + 17, accent, "center", 11);
    }
  } else {
    drawText(ctx, "OFF", s.x, s.y - r - 11, "#777", "center", 11);
  }
}
