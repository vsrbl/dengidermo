import { GREEN, RED } from "../core/constants.js";
import { lerp } from "../core/math.js";
import { LOOT } from "../data/loot.js";
import { drawRect, screen } from "./primitives.js";

const PICKUP_TOKEN_RADIUS = 10;
const PICKUP_TOKEN_POP_TIME = 0.2;

function sourcePulseLevel(item) {
  const profile = String(item?.revealProfile || "");
  const source = String(item?.revealSource || item?.sourceType || "");
  if (profile === "rare" || profile === "cursed" || profile === "casino_jackpot" || profile === "casino_static") return 1;
  if (source === "chest" || source === "casino") return 0.62;
  if (item?.lucky || item?.boosted) return 0.45;
  return 0;
}

function drawPickupSourcePulse(ctx, s, r, color, level = 0, age = 0) {
  if (level <= 0) return;
  const strong = level >= 0.9;
  const phase = (Math.sin(age * (strong ? 5.6 : 4.2)) + 1) * 0.5;
  const base = r + 8 + phase * (strong ? 16 : 10);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = strong ? 2 : 1;
  ctx.globalAlpha = strong ? 0.36 - phase * 0.16 : 0.28 - phase * 0.12;
  ctx.strokeRect(Math.round(s.x - base), Math.round(s.y - base), Math.round(base * 2), Math.round(base * 2));
  if (strong) {
    const outer = base + 10 + phase * 8;
    ctx.globalAlpha = 0.18 - phase * 0.08;
    ctx.strokeRect(Math.round(s.x - outer), Math.round(s.y - outer), Math.round(outer * 2), Math.round(outer * 2));
  }
  ctx.restore();
}

function drawPickupToken(ctx, s, { label, color, scale = 1, claimable = true, burst = 0, strongBurst = false, sourcePulse = 0, age = 0 } = {}) {
  const r = Math.max(8, Math.round(PICKUP_TOKEN_RADIUS * scale));
  const code = String(label || "DRP").toUpperCase().slice(0, 3);
  ctx.save();
  if (!claimable) ctx.globalAlpha = 0.58;
  drawPickupSourcePulse(ctx, s, r, color, sourcePulse, age);
  if (burst > 0) {
    const burstR = r + 5 + burst * (strongBurst ? 14 : 9);
    ctx.strokeStyle = color;
    ctx.lineWidth = strongBurst ? 2 : 1;
    ctx.globalAlpha = strongBurst ? 0.42 : 0.32;
    ctx.strokeRect(Math.round(s.x - burstR), Math.round(s.y - burstR), Math.round(burstR * 2), Math.round(burstR * 2));
    ctx.globalAlpha = claimable ? 1 : 0.58;
  }
  ctx.fillStyle = color;
  ctx.font = "11px Courier New, monospace";
  ctx.textAlign = "center";
  ctx.fillText(code, Math.round(s.x), Math.round(s.y - r - 5));
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, "#050505");
  ctx.strokeStyle = color;
  ctx.lineWidth = claimable ? 2 : 1;
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
  ctx.restore();
}

export function drawLoot(ctx, item, cam) {
  const data = LOOT[item.kind] || LOOT.heal;
  const s = screen(item, cam);
  drawPickupToken(ctx, s, {
    label: data.pickup?.label || data.name.slice(0, 3),
    color: data.color === "green" ? GREEN : "#f3f3f3"
  });
}

function economyPickupLabel(item) {
  if (item.type === "money") return "GLD";
  if (item.type === "xp") return "EXP";
  if (item.type === "heal") return "HEA";
  return String(item.label || item.type || "DRP").slice(0, 3).toUpperCase();
}

function economyPickupColor(item, claimable) {
  if (!claimable) return "rgba(255,255,255,0.46)";
  if (item.accent && item.revealProfile && item.revealProfile !== "basic") return item.accent;
  if (item.type === "heal") return GREEN;
  if (item.type === "xp") return "#d4d4d4";
  if (item.type === "money") return "#8f8f8f";
  return item.accent || "#f3f3f3";
}

function pickupVisualPosition(item) {
  const age = Math.max(0, item._renderAge || 0);
  const hasSpawn = Number.isFinite(item.spawnX) && Number.isFinite(item.spawnY);
  if (!hasSpawn || age >= PICKUP_TOKEN_POP_TIME) return { x: item.x, y: item.y, popT: 1, scale: 1 };
  const t = Math.min(1, age / PICKUP_TOKEN_POP_TIME);
  const easeOut = 1 - Math.pow(1 - t, 3);
  const overshoot = Math.sin(t * Math.PI) * 0.12;
  return {
    x: lerp(item.spawnX, item.x, Math.min(1, easeOut + overshoot)),
    y: lerp(item.spawnY, item.y, Math.min(1, easeOut + overshoot)),
    popT: t,
    scale: 0.62 + 0.38 * easeOut + overshoot
  };
}

function drawPickupTrail(ctx, item, s, color) {
  if (!Number.isFinite(item._lastX) || !Number.isFinite(item._lastY)) return;
  const dx = item.x - item._lastX;
  const dy = item.y - item._lastY;
  if (dx * dx + dy * dy < 2.4) return;
  ctx.save();
  ctx.globalAlpha = 0.46;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(s.x - dx * 1.8), Math.round(s.y - dy * 1.8));
  ctx.lineTo(Math.round(s.x), Math.round(s.y));
  ctx.stroke();
  ctx.restore();
}

function pickupBurstAmount(item, popT) {
  const specialReveal = item.lucky || item.boosted || item.revealProfile === "rare" || item.revealProfile === "cursed" || item.revealProfile === "casino_jackpot" || item.revealProfile === "casino_static";
  if (popT < 1) return Math.max(0, 1 - popT) * (specialReveal ? 1.25 : 1);
  return 0;
}

export function drawEconomyPickup(ctx, item, cam) {
  const visual = pickupVisualPosition(item);
  const s = screen(visual, cam);
  const claimable = item.claimable !== false;
  const color = economyPickupColor(item, claimable);
  const label = economyPickupLabel(item);
  const rarePulse = item.type === "heal" || item.lucky || item.boosted ? 0.05 : 0;
  const pulse = 1 + Math.sin((item._renderAge || 0) * 10) * 0.035 + rarePulse;
  drawPickupTrail(ctx, item, s, color);
  drawPickupToken(ctx, s, {
    label,
    color,
    scale: visual.scale * pulse,
    claimable,
    burst: pickupBurstAmount(item, visual.popT),
    strongBurst: item.revealProfile === "rare" || item.revealProfile === "cursed",
    sourcePulse: sourcePulseLevel(item),
    age: item._renderAge || 0
  });
}

function rewardPickupColor(item, claimable, data = null) {
  if (!claimable) return "rgba(255,255,255,0.48)";
  if (item.rewardType === "ability_pickup" || item.rewardType === "ability_shard") return "#66f6ff";
  if (data?.type === "heal") return GREEN;
  if (data?.type === "weapon") return GREEN;
  if (item.accent && String(item.accent).startsWith("#")) return item.accent;
  if (item.accent === "red") return RED;
  if (item.accent === "purple") return "#b45cff";
  if (item.accent === "cyan") return "#66f6ff";
  if (item.accent === "white") return "#f3f3f3";
  return GREEN;
}

function rewardPickupDisplayLabel(item, data = null) {
  if (item.rewardType === "ability_pickup" || item.rewardType === "ability_shard") return "ABL";
  if (data?.pickup?.label) return String(data.pickup.label).toUpperCase().slice(0, 3);
  if (data?.type === "heal") return "HEA";
  return String(item.label || item.kind || item.abilityId || "RWD").toUpperCase().slice(0, 3);
}

export function drawRewardPickup(ctx, item, cam) {
  const data = item.rewardType === "loot" ? (LOOT[item.kind] || LOOT.heal) : null;
  const visual = pickupVisualPosition(item);
  const s = screen(visual, cam);
  const active = item.active !== false;
  const claimable = item.claimable !== false;
  const color = rewardPickupColor(item, active && claimable, data);
  const pulse = 1 + Math.sin((item._renderAge || 0) * 9) * 0.03;
  const highValue = item.revealProfile === "rare" || item.revealProfile === "cursed" || item.revealProfile === "casino_jackpot";
  drawPickupTrail(ctx, item, s, color);
  drawPickupToken(ctx, s, {
    label: rewardPickupDisplayLabel(item, data),
    color,
    scale: visual.scale * pulse,
    claimable: active && claimable,
    burst: pickupBurstAmount(item, visual.popT),
    strongBurst: highValue,
    sourcePulse: sourcePulseLevel(item),
    age: item._renderAge || 0
  });
}

