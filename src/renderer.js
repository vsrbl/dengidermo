import { GREEN, RED, VIEW, WORLD } from "./core/constants.js";
import { dist2, isVisible, lerp, norm } from "./core/math.js";
import { START_WEAPON, WEAPONS } from "./data/weapons.js";
import { ENEMIES } from "./data/enemies.js";
import { LOOT } from "./data/loot.js";
import { firstSolidWallHitInLocation, roomGeometrySnapshot } from "./game/roomGeometry.js";
import { ROOM_MODIFIER_HOOKS, runRoomModifierHooksForLocation } from "./game/roomModifiers.js";
import { drawEffect } from "./render/effectRenderers.js";
import { drawEnemySprite } from "./render/enemyRenderers.js";
import { drawEnemyArmorVariantLinks } from "./render/armorVariantRenderers.js";
import { drawChestInteractable } from "./render/chestRenderers.js";
import { drawCasinoInteractable } from "./render/casinoRenderers.js";
import { INTERACTABLE_AFFORDANCE_RULES } from "./data/interactableAffordances.js";

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

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const smooth = {
    players: new Map(),
    enemies: new Map(),
    projectiles: new Map(),
    companions: new Map(),
    loot: new Map(),
    rewardPickups: new Map(),
    economyPickups: new Map(),
    interactables: new Map(),
    portals: new Map()
  };
  const shake = { power: 0, time: 0, seed: 0, seen: new Set() };
  return { canvas, ctx, smooth, shake };
}

export function resetRendererSmooth(renderer) {
  for (const map of Object.values(renderer?.smooth || {})) map.clear?.();
  if (renderer?.shake) {
    renderer.shake.power = 0;
    renderer.shake.time = 0;
    renderer.shake.seed = 0;
    renderer.shake.seen?.clear?.();
  }
}

function smoothEntity(map, obj, dt, snap = false) {
  const old = map.get(obj.id);
  if (!old || snap) {
    const copy = { ...obj, _renderAge: 0, _lastX: obj.x, _lastY: obj.y };
    map.set(obj.id, copy);
    return copy;
  }
  old._renderAge = (old._renderAge || 0) + Math.max(0, dt || 0);
  old._lastX = old.x;
  old._lastY = old.y;
  const t = Math.min(1, dt * 14);
  old.x = lerp(old.x, obj.x, t);
  old.y = lerp(old.y, obj.y, t);
  for (const k of Object.keys(obj)) {
    if (k !== "x" && k !== "y") old[k] = obj[k];
  }
  return old;
}

function prune(map, ids) {
  for (const key of map.keys()) if (!ids.has(key)) map.delete(key);
}

function smoothProjectile(map, obj, renderDt, simDt, snapshotTick) {
  const old = map.get(obj.id);
  if (!old) {
    const copy = { ...obj, _tick: snapshotTick };
    map.set(obj.id, copy);
    return copy;
  }

  if (old._tick !== snapshotTick) {
    const correction = obj.kind === "rocket" || obj.kind === "homing" ? 0.42 : 0.56;
    old.x = lerp(old.x, obj.x, correction);
    old.y = lerp(old.y, obj.y, correction);
    old._tick = snapshotTick;
    for (const k of Object.keys(obj)) {
      if (k !== "x" && k !== "y") old[k] = obj[k];
    }
  }

  old.x += (old.vx || 0) * simDt;
  old.y += (old.vy || 0) * simDt;
  return old;
}

function drawGrid(ctx, cam, location = null) {
  const background = runRoomModifierHooksForLocation(location, ROOM_MODIFIER_HOOKS.RENDER_BACKGROUND, {
    accent: location?.accent || "green",
    gridStep: location?.gridStep || 80
  });
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  const greenLoc = background.accent === "green";
  ctx.strokeStyle = greenLoc ? "rgba(0,255,102,0.055)" : "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;
  const step = background.gridStep || 80;
  const startX = -((cam.x % step + step) % step);
  const startY = -((cam.y % step + step) % step);
  for (let x = startX; x < VIEW.w; x += step) {
    ctx.beginPath(); ctx.moveTo(Math.round(x), 0); ctx.lineTo(Math.round(x), VIEW.h); ctx.stroke();
  }
  for (let y = startY; y < VIEW.h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, Math.round(y)); ctx.lineTo(VIEW.w, Math.round(y)); ctx.stroke();
  }
  ctx.strokeStyle = greenLoc ? "rgba(0,255,102,0.38)" : "rgba(255,255,255,0.35)";
  ctx.strokeRect(Math.round(-cam.x), Math.round(-cam.y), WORLD.w, WORLD.h);
  if (location?.name) drawText(ctx, location.name, 16, 112, greenLoc ? GREEN : "#aaa", "left");
}


function drawRoomGeometry(ctx, cam, location = null) {
  const geometry = location ? roomGeometrySnapshot(location) : null;
  const walls = geometry?.walls || [];
  if (!walls.length) return;

  for (const wall of walls) {
    const x = Math.round(wall.x - cam.x);
    const y = Math.round(wall.y - cam.y);
    const w = Math.round(wall.w);
    const h = Math.round(wall.h);
    if (x > VIEW.w + 80 || y > VIEW.h + 80 || x + w < -80 || y + h < -80) continue;
    ctx.fillStyle = "#050505";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = wall.tags?.includes?.("divider") ? "rgba(0,255,102,0.34)" : "rgba(255,255,255,0.44)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    if (w >= 42 && h >= 26) {
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(x + 6, y + 6);
      ctx.lineTo(x + w - 6, y + h - 6);
      ctx.moveTo(x + w - 6, y + 6);
      ctx.lineTo(x + 6, y + h - 6);
      ctx.stroke();
    }
  }
}

function screen(obj, cam) {
  return { x: obj.x - cam.x, y: obj.y - cam.y };
}

function weaponCode(weaponId) {
  return (WEAPONS[weaponId]?.code || String(weaponId || START_WEAPON).slice(0, 3)).toUpperCase();
}

function drawWeaponGlyph(ctx, s, angle, weaponId, isLocal) {
  const ax = Math.cos(angle || 0);
  const ay = Math.sin(angle || 0);
  const px = s.x + ax * 18;
  const py = s.y + ay * 18;
  const accent = isLocal ? GREEN : "#fff";
  const code = weaponCode(weaponId);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1;
  if (weaponId === "shotgun") {
    drawRect(ctx, px - 2, py - 2, 4, 4, accent);
    drawRect(ctx, px - ay * 5 - 1, py + ax * 5 - 1, 3, 3, "#fff");
    drawRect(ctx, px + ay * 5 - 1, py - ax * 5 - 1, 3, 3, "#fff");
  } else if (weaponId === "seeker") {
    ctx.strokeRect(Math.round(px - 5), Math.round(py - 5), 10, 10);
    drawRect(ctx, px - 2, py - 2, 4, 4, GREEN);
  } else if (weaponId === "rocket") {
    ctx.strokeRect(Math.round(px - 6), Math.round(py - 6), 12, 12);
    ctx.strokeRect(Math.round(px - 3), Math.round(py - 3), 6, 6);
  } else {
    drawRect(ctx, px - 2, py - 2, 4, 4, accent);
  }
  drawText(ctx, code, s.x, s.y - 31, isLocal ? GREEN : "#777", "center");
}

function drawPlayer(ctx, p, cam, isLocal, snapshotTime = 0) {
  const s = screen(p, cam);
  const r = 13;
  const impact = p.damageImpact || null;
  const impactAge = impact && Number.isFinite(impact.t) ? Math.max(0, snapshotTime - impact.t) : Infinity;
  const hitFlash = impactAge < 0.28 ? Math.max(0, 1 - impactAge / 0.28) : 0;
  const color = hitFlash > 0.05 ? "#ff3048" : (isLocal ? "#fff" : (p.skin === "green" ? GREEN : "#bbb"));
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, color);
  drawRect(ctx, s.x - r + 4, s.y - r + 4, r * 2 - 8, r * 2 - 8, "#050505");
  if (hitFlash > 0.05) {
    ctx.save();
    ctx.globalAlpha = 0.42 * hitFlash;
    ctx.strokeStyle = "#ff3048";
    ctx.lineWidth = 2;
    const pad = 6 + hitFlash * 10;
    ctx.strokeRect(Math.round(s.x - r - pad), Math.round(s.y - r - pad), Math.round(r * 2 + pad * 2), Math.round(r * 2 + pad * 2));
    ctx.restore();
  }

  drawWeaponGlyph(ctx, s, p.angle || 0, p.activeWeapon || p.inventory?.activeWeapon || START_WEAPON, isLocal);
  if (p.shield?.charges > 0) {
    ctx.strokeStyle = "rgba(0,255,102,0.62)";
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(s.x - r - 5), Math.round(s.y - r - 5), r * 2 + 10, r * 2 + 10);
  }

  const hpW = 28;
  const hp = Math.max(0, Math.min(1, p.hp / (p.maxHp || 100)));
  drawRect(ctx, s.x - hpW / 2, s.y - 24, hpW, 3, "#333");
  drawRect(ctx, s.x - hpW / 2, s.y - 24, hpW * hp, 3, hp > 0.35 ? GREEN : "#ff3048");
  drawText(ctx, String(p.name || p.id).slice(0, 12), s.x, s.y + 30, isLocal ? GREEN : "#777", "center");
}

function drawEnemy(ctx, e, cam) {
  const data = ENEMIES[e.kind] || ENEMIES.grunt;
  const s = screen(e, cam);
  const r = data.radius;
  drawEnemySprite(ctx, e, data, s);
  if (e.status?.burn || e.status?.poison || e.status?.freeze) {
    const frozen = !!e.status?.freeze;
    const poisoned = !!e.status?.poison;
    const burning = !!e.status?.burn;
    ctx.strokeStyle = frozen ? "rgba(255,255,255,0.82)" : (burning ? "rgba(255,48,72,0.58)" : "rgba(0,255,102,0.72)");
    ctx.lineWidth = 1;
    const pad = poisoned ? 6 : 4;
    ctx.strokeRect(Math.round(s.x - r - pad), Math.round(s.y - r - pad), r * 2 + pad * 2, r * 2 + pad * 2);
    if (burning) drawRect(ctx, s.x + r - 3, s.y - r - 3, 4, 4, "#ff3048");
    if (poisoned) drawRect(ctx, s.x - r - 1, s.y - r - 3, 4, 4, GREEN);
    if (frozen) drawRect(ctx, s.x - 2, s.y - r - 5, 4, 4, "#fff");
    if ((e.status?.slow || 0) > 0) {
      const w = Math.round(r * 2 * Math.min(1, e.status.slow));
      drawRect(ctx, s.x - r, s.y + r + 10, r * 2, 2, "#222");
      drawRect(ctx, s.x - r, s.y + r + 10, w, 2, frozen ? "#fff" : GREEN);
    }
  }
  const hp = Math.max(0, Math.min(1, e.hp / data.hp));
  drawRect(ctx, s.x - r, s.y + r + 5, r * 2, 3, "#333");
  drawRect(ctx, s.x - r, s.y + r + 5, r * 2 * hp, 3, GREEN);
}

function drawProjectile(ctx, p, cam) {
  const s = screen(p, cam);
  const color = p.color === "green" ? GREEN : (p.color === "red" ? RED : "#fff");
  const r = p.radius || 3;
  const vx = p.vx || 0;
  const vy = p.vy || 0;
  const speed = Math.hypot(vx, vy) || 1;
  const tx = -(vx / speed) * Math.min(22, speed * 0.026);
  const ty = -(vy / speed) * Math.min(22, speed * 0.026);

  if (p.kind === "rocket" || p.kind === "homing" || p.kind === "enemyBullet") {
    ctx.strokeStyle = p.kind === "enemyBullet" ? "rgba(255,48,72,0.42)" : "rgba(0,255,102,0.45)";
    ctx.lineWidth = p.kind === "rocket" ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(s.x + tx), Math.round(s.y + ty));
    ctx.lineTo(Math.round(s.x), Math.round(s.y));
    ctx.stroke();
  }

  if (p.kind === "homing") {
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(s.x - r - 2), Math.round(s.y - r - 2), Math.round((r + 2) * 2), Math.round((r + 2) * 2));
    drawRect(ctx, s.x - 2, s.y - 2, 4, 4, GREEN);
    return;
  }
  if (p.kind === "rocket") {
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
    drawRect(ctx, s.x - Math.max(2, r - 3), s.y - Math.max(2, r - 3), Math.max(4, r), Math.max(4, r), color);
    return;
  }
  if (p.kind === "enemyBullet") {
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
    drawRect(ctx, s.x - 2, s.y - 2, 4, 4, RED);
    return;
  }

  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, color);
}

function drawCompanion(ctx, c, cam) {
  const s = screen(c, cam);
  const r = c.kind === "orbital" ? 8 : 9;
  ctx.strokeStyle = c.kind === "orbital" ? GREEN : "#ffffff";
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), r * 2, r * 2);
  if (c.kind === "drone") {
    drawRect(ctx, s.x - 2, s.y - 2, 4, 4, GREEN);
    const ax = Math.cos(c.angle || 0);
    const ay = Math.sin(c.angle || 0);
    ctx.beginPath();
    ctx.moveTo(Math.round(s.x), Math.round(s.y));
    ctx.lineTo(Math.round(s.x + ax * 13), Math.round(s.y + ay * 13));
    ctx.stroke();
  } else {
    drawRect(ctx, s.x - 3, s.y - 3, 6, 6, GREEN);
  }
}


function drawPortal(ctx, portal, cam) {
  const s = screen(portal, cam);
  const r = portal.radius || 50;
  const active = !!portal.active;
  const progress = Math.max(0, Math.min(1, portal.progress || 0));
  ctx.strokeStyle = active ? GREEN : "rgba(255,255,255,0.36)";
  ctx.lineWidth = active ? 3 : 2;
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
  ctx.strokeRect(Math.round(s.x - r * 0.62), Math.round(s.y - r * 0.62), Math.round(r * 1.24), Math.round(r * 1.24));
  if (active) {
    const w = Math.round(r * 2 * progress);
    drawRect(ctx, s.x - r, s.y + r + 8, r * 2, 5, "#222");
    drawRect(ctx, s.x - r, s.y + r + 8, w, 5, GREEN);
    drawText(ctx, progress > 0 ? `TEAM ${Math.round(progress * 100)}%` : "EXIT", s.x, s.y - r - 9, GREEN, "center");
  } else {
    drawText(ctx, "LOCKED", s.x, s.y - r - 9, "#777", "center");
  }
}

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

function drawLoot(ctx, item, cam) {
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

function drawEconomyPickup(ctx, item, cam) {
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

function drawRewardPickup(ctx, item, cam) {
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

function interactableAccentColor(item) {
  if (item?.accent === "red" || item?.category === "casino") return RED;
  if (item?.accent === "white") return "#f3f3f3";
  return GREEN;
}

function localInteractableAffordance(item, localPose = null) {
  if (!item || !localPose) return { localInRange: false, localNear: false, localMoney: null, canAfford: true };
  const range = (item.interactRadius || (item.radius || 18) + 20) + (localPose.radius || 13) + (INTERACTABLE_AFFORDANCE_RULES.promptExtraRadius || 0);
  const dx = (localPose.x || 0) - item.x;
  const dy = (localPose.y || 0) - item.y;
  const d2 = dx * dx + dy * dy;
  const previewRange = Math.max(range, Math.min(INTERACTABLE_AFFORDANCE_RULES.localPromptMaxDistance || 112, range * (INTERACTABLE_AFFORDANCE_RULES.previewRangeMultiplier || 2.4)));
  const money = Math.max(0, Math.floor(localPose?.economy?.money || 0));
  const cost = Math.max(0, Math.floor(Number.isFinite(item.chestOpenCost) ? item.chestOpenCost : 0));
  return {
    localInRange: d2 <= range * range,
    localNear: d2 <= previewRange * previewRange,
    localMoney: money,
    canAfford: cost <= 0 || money >= cost
  };
}

function drawInteractable(ctx, item, cam, localPose = null) {
  const affordance = localInteractableAffordance(item, localPose);
  if (item.chestId || item.chestVisual === "chest") {
    drawChestInteractable(ctx, item, cam, affordance);
    return;
  }
  if (item.casinoMachineId || item.category === "casino") {
    drawCasinoInteractable(ctx, item, cam, affordance);
    return;
  }
  const s = screen(item, cam);
  const r = item.radius || 18;
  const active = !item.opened && item.active !== false;
  const color = interactableAccentColor(item);
  ctx.strokeStyle = active ? color : "rgba(255,255,255,0.42)";
  ctx.lineWidth = active ? 2 : 1;
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), r * 2, r * 2);
  ctx.strokeRect(Math.round(s.x - r * 0.58), Math.round(s.y - r * 0.58), Math.round(r * 1.16), Math.round(r * 1.16));
  if (item.category === "casino") {
    ctx.beginPath();
    ctx.moveTo(Math.round(s.x - r), Math.round(s.y));
    ctx.lineTo(Math.round(s.x + r), Math.round(s.y));
    ctx.moveTo(Math.round(s.x), Math.round(s.y - r));
    ctx.lineTo(Math.round(s.x), Math.round(s.y + r));
    ctx.stroke();
  }
  if (active) {
    drawRect(ctx, s.x - 3, s.y - 3, 6, 6, color);
    drawText(ctx, String(item.label || item.kind || "CACHE").slice(0, 6), s.x, s.y - r - 7, color, "center");
    drawText(ctx, item.autoOpen ? "TOUCH" : "E", s.x, s.y + r + 14, color, "center");
    if (item.category === "casino") drawText(ctx, "GAMBLE", s.x, s.y + r + 28, color, "center");
  } else {
    drawText(ctx, "OPEN", s.x, s.y - r - 7, "#777", "center");
  }
}


const SHAKE_RENDER_MAX = 12;
const SHAKE_DECAY = 10.5;

function ensureShakeState(renderer) {
  if (!renderer.shake) renderer.shake = { power: 0, time: 0, seed: 0, seen: new Set() };
  if (!renderer.shake.seen) renderer.shake.seen = new Set();
  return renderer.shake;
}

function ingestCameraShake(renderer, snapshot, dt) {
  const shake = ensureShakeState(renderer);
  const safeDt = Math.max(0, Math.min(0.05, Number.isFinite(dt) ? dt : 0));
  shake.time += safeDt;

  let index = 0;
  for (const fx of snapshot?.effects || []) {
    if (fx.type !== "shake") continue;
    const id = fx.id || `legacy:${snapshot?.tick || 0}:${index}`;
    index += 1;
    if (shake.seen.has(id)) continue;
    shake.seen.add(id);

    const maxLife = Math.max(0.001, fx.maxLife || fx.life || 0.12);
    const lifeFrac = Math.max(0, Math.min(1, (fx.life || 0) / maxLife));
    const impulse = Math.max(0, Math.min(SHAKE_RENDER_MAX, (fx.power || 0) * Math.max(0.45, lifeFrac)));
    if (impulse <= 0) continue;

    shake.power = Math.min(SHAKE_RENDER_MAX, Math.hypot(shake.power || 0, impulse));
    shake.seed = (shake.seed + impulse * 17.31 + (snapshot?.tick || 0) * 0.011) % 1000;
  }

  if (shake.seen.size > 160) {
    shake.seen = new Set(Array.from(shake.seen).slice(-96));
  }

  if (shake.power > 0) {
    shake.power *= Math.exp(-SHAKE_DECAY * safeDt);
    if (shake.power < 0.05) shake.power = 0;
  }
  return shake;
}

function cameraWithShake(cam, renderer, snapshot, dt) {
  const shake = ingestCameraShake(renderer, snapshot, dt);
  const power = Math.max(0, Math.min(SHAKE_RENDER_MAX, shake.power || 0));
  if (power <= 0) return cam;
  const t = shake.time;
  const seed = shake.seed || 0;
  const x = (Math.sin(t * 72.7 + seed) + Math.sin(t * 127.1 + seed * 0.37)) * 0.5 * power;
  const y = (Math.cos(t * 81.9 + seed * 0.71) + Math.sin(t * 109.3 + seed * 1.13)) * 0.5 * power;
  return {
    ...cam,
    x: cam.x + x,
    y: cam.y + y
  };
}


function effectAlpha(fx) {
  const maxLife = Math.max(0.001, fx.maxLife || fx.life || 0.2);
  return Math.max(0, Math.min(1, (fx.life || 0) / maxLife));
}

function localDamageImpactEffects(snapshot, localId) {
  return (snapshot?.effects || []).filter((fx) => fx?.type === "playerDamageImpact" && fx.targetId === localId && (fx.life || 0) > 0);
}

function drawRedEdgeImpact(ctx, power, alpha) {
  if (!(alpha > 0) || !(power > 0)) return;
  const edge = Math.round(18 + power * 28);
  const strong = Math.max(0.04, Math.min(0.62, alpha));
  ctx.save();
  ctx.fillStyle = `rgba(255,48,72,${strong})`;
  ctx.fillRect(0, 0, VIEW.w, Math.max(4, edge));
  ctx.fillRect(0, VIEW.h - Math.max(4, edge), VIEW.w, Math.max(4, edge));
  ctx.fillStyle = `rgba(255,48,72,${strong * 0.72})`;
  ctx.fillRect(0, 0, Math.max(4, edge), VIEW.h);
  ctx.fillRect(VIEW.w - Math.max(4, edge), 0, Math.max(4, edge), VIEW.h);
  ctx.strokeStyle = `rgba(255,48,72,${Math.min(0.72, strong + 0.12)})`;
  ctx.lineWidth = Math.max(1, Math.round(1 + power));
  ctx.strokeRect(Math.round(edge * 0.45), Math.round(edge * 0.45), Math.round(VIEW.w - edge * 0.9), Math.round(VIEW.h - edge * 0.9));
  ctx.restore();
}

function drawDirectionalHitMarker(ctx, dx, dy, power, alpha) {
  if (!(alpha > 0)) return;
  const d = norm(dx || 0, dy || -1);
  const cx = VIEW.w / 2;
  const cy = VIEW.h / 2;
  const dist = 58 + power * 16;
  const x = cx - d.x * dist;
  const y = cy - d.y * dist;
  ctx.save();
  ctx.globalAlpha = Math.max(0.08, Math.min(0.76, alpha));
  ctx.strokeStyle = "#ff3048";
  ctx.lineWidth = Math.max(1, Math.round(2 + power));
  ctx.beginPath();
  ctx.moveTo(Math.round(x - d.y * 14), Math.round(y + d.x * 14));
  ctx.lineTo(Math.round(x), Math.round(y));
  ctx.lineTo(Math.round(x + d.y * 14), Math.round(y - d.x * 14));
  ctx.stroke();
  ctx.restore();
}

function drawLocalDamageImpactOverlay(ctx, snapshot, localId) {
  const localPlayer = (snapshot?.players || []).find((p) => p.id === localId);
  const effects = localDamageImpactEffects(snapshot, localId);
  let power = 0;
  let alpha = 0;
  let dx = 0;
  let dy = -1;
  for (const fx of effects) {
    const a = effectAlpha(fx);
    const p = Math.max(0.35, Math.min(2.5, fx.power || 1));
    power = Math.max(power, p);
    alpha = Math.min(0.78, alpha + a * (0.16 + p * 0.13));
    if (a > 0.05) {
      dx = Number.isFinite(fx.dirX) ? fx.dirX : dx;
      dy = Number.isFinite(fx.dirY) ? fx.dirY : dy;
    }
  }
  const hpRatio = localPlayer ? Math.max(0, Math.min(1, (localPlayer.hp || 0) / Math.max(1, localPlayer.maxHp || 1))) : 1;
  if (hpRatio > 0 && hpRatio <= 0.35) {
    const pulse = (Math.sin((snapshot?.time || 0) * 8.5) + 1) * 0.5;
    const lowAlpha = (0.05 + (1 - hpRatio / 0.35) * 0.16) * (0.55 + pulse * 0.45);
    drawRedEdgeImpact(ctx, 0.7 + (1 - hpRatio) * 0.8, lowAlpha);
  }
  if (alpha > 0) {
    drawRedEdgeImpact(ctx, power, alpha);
    drawDirectionalHitMarker(ctx, dx, dy, power, Math.min(0.72, alpha + 0.08));
  }
}

function drawPredictedProjectiles(ctx, projectiles, cam) {
  for (const p of projectiles) {
    if (!isVisible(p, cam, 40)) continue;
    drawProjectile(ctx, p, cam);
  }
}

function drawCrosshair(ctx, mouse) {
  if (!mouse.inside) return;
  const x = Math.round(mouse.x);
  const y = Math.round(mouse.y);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 8, y); ctx.lineTo(x - 3, y);
  ctx.moveTo(x + 3, y); ctx.lineTo(x + 8, y);
  ctx.moveTo(x, y - 8); ctx.lineTo(x, y - 3);
  ctx.moveTo(x, y + 3); ctx.lineTo(x, y + 8);
  ctx.stroke();
}

export function render(renderer, snapshot, localPose, localId, cam, mouse, predictedProjectiles, renderDt, simDt = renderDt) {
  const { ctx, smooth } = renderer;
  const renderCam = snapshot ? cameraWithShake(cam, renderer, snapshot, renderDt) : cam;
  drawGrid(ctx, renderCam, snapshot?.location);
  drawRoomGeometry(ctx, renderCam, snapshot?.location);
  if (!snapshot) {
    drawText(ctx, "CONNECTING", VIEW.w / 2, VIEW.h / 2, GREEN, "center");
    return;
  }

  const enemyIds = new Set();
  for (const raw of snapshot.enemies || []) {
    if (isVisible(raw, renderCam, 180)) drawEnemyArmorVariantLinks(ctx, raw, renderCam);
  }
  for (const raw of snapshot.enemies || []) {
    enemyIds.add(raw.id);
    const e = smoothEntity(smooth.enemies, raw, renderDt);
    if (isVisible(e, renderCam, 80)) drawEnemy(ctx, e, renderCam);
  }
  prune(smooth.enemies, enemyIds);

  const lootIds = new Set();
  for (const raw of snapshot.loot || []) {
    lootIds.add(raw.id);
    const item = smoothEntity(smooth.loot, raw, renderDt);
    if (isVisible(item, renderCam, 60)) drawLoot(ctx, item, renderCam);
  }
  prune(smooth.loot, lootIds);

  const rewardPickupIds = new Set();
  for (const raw of snapshot.rewardPickups || []) {
    rewardPickupIds.add(raw.id);
    const item = smoothEntity(smooth.rewardPickups, raw, renderDt);
    if (isVisible(item, renderCam, 60)) drawRewardPickup(ctx, item, renderCam);
  }
  prune(smooth.rewardPickups, rewardPickupIds);


  const economyPickupIds = new Set();
  for (const raw of snapshot.economyPickups || []) {
    economyPickupIds.add(raw.id);
    const item = smoothEntity(smooth.economyPickups, raw, renderDt);
    if (isVisible(item, renderCam, 60)) drawEconomyPickup(ctx, item, renderCam);
  }
  prune(smooth.economyPickups, economyPickupIds);

  const interactableIds = new Set();
  for (const raw of snapshot.interactables || []) {
    interactableIds.add(raw.id);
    const item = smoothEntity(smooth.interactables, raw, renderDt);
    if (isVisible(item, renderCam, 80)) drawInteractable(ctx, item, renderCam, localPose);
  }
  prune(smooth.interactables, interactableIds);

  const portalIds = new Set();
  for (const raw of snapshot.portals || []) {
    portalIds.add(raw.id);
    const portal = smoothEntity(smooth.portals, raw, renderDt);
    if (isVisible(portal, renderCam, 130)) drawPortal(ctx, portal, renderCam);
  }
  prune(smooth.portals, portalIds);

  const projectileIds = new Set();
  const predictedServerIds = new Set(predictedProjectiles.map((p) => p.serverId || String(p.id).replace(/:local$/, "")));
  for (const raw of snapshot.projectiles || []) {
    projectileIds.add(raw.id);
    if (raw.ownerId === localId && predictedServerIds.has(raw.id)) continue;
    const p = smoothProjectile(smooth.projectiles, raw, renderDt, simDt, snapshot.tick);
    if (isVisible(p, renderCam, 50)) drawProjectile(ctx, p, renderCam);
  }
  prune(smooth.projectiles, projectileIds);
  drawPredictedProjectiles(ctx, predictedProjectiles, renderCam);

  const companionIds = new Set();
  for (const raw of snapshot.companions || []) {
    companionIds.add(raw.id);
    const c = smoothEntity(smooth.companions, raw, renderDt);
    if (isVisible(c, renderCam, 60)) drawCompanion(ctx, c, renderCam);
  }
  prune(smooth.companions, companionIds);

  for (const fx of snapshot.effects || []) drawEffect(ctx, fx, renderCam);

  const playerIds = new Set();
  for (const raw of snapshot.players || []) {
    playerIds.add(raw.id);
    const isLocal = raw.id === localId;
    const p = isLocal && localPose ? { ...raw, ...localPose, hp: raw.hp, maxHp: raw.maxHp, activeWeapon: raw.activeWeapon, skin: raw.skin } : smoothEntity(smooth.players, raw, renderDt);
    if (isVisible(p, renderCam, 90)) drawPlayer(ctx, p, renderCam, isLocal, snapshot.time || 0);
  }
  prune(smooth.players, playerIds);

  if (localPose && mouse.inside) {
    const sx = localPose.x - renderCam.x;
    const sy = localPose.y - renderCam.y;
    ctx.strokeStyle = "rgba(0,255,102,0.34)";
    ctx.beginPath();
    ctx.moveTo(Math.round(sx), Math.round(sy));
    ctx.lineTo(Math.round(mouse.x), Math.round(mouse.y));
    ctx.stroke();
  }
  drawLocalDamageImpactOverlay(ctx, snapshot, localId);
  drawCrosshair(ctx, mouse);
}

export function makePredictedProjectile(id, playerId, weaponId, pose, stats = null) {
  const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
  const pellets = weapon.pellets || 1;
  const out = [];
  for (let i = 0; i < pellets; i += 1) {
    const offset = pellets === 1 ? 0 : (i - (pellets - 1) / 2) * weapon.spread;
    const angle = pose.angle + offset;
    const speedMult = Math.max(0.1, stats?.projectileSpeedMult || 1);
    const vx = Math.cos(angle) * weapon.bulletSpeed * speedMult;
    const vy = Math.sin(angle) * weapon.bulletSpeed * speedMult;
    const serverId = `${id}${pellets === 1 ? "" : `-${i}`}`;
    out.push({
      id: `${serverId}:local`,
      serverId,
      ownerId: playerId,
      weaponId,
      kind: weapon.projectile,
      x: pose.x + Math.cos(angle) * (pose.radius + weapon.radius + 1),
      y: pose.y + Math.sin(angle) * (pose.radius + weapon.radius + 1),
      vx,
      vy,
      speed: weapon.bulletSpeed * Math.max(0.1, stats?.projectileSpeedMult || 1),
      radius: weapon.radius,
      color: weapon.color,
      range: weapon.range,
      distance: 0,
      targetId: null,
      life: weapon.range / (weapon.bulletSpeed * Math.max(0.1, stats?.projectileSpeedMult || 1))
    });
  }
  return out;
}

function nearestSnapshotEnemy(snapshot, projectile, maxRange) {
  const enemies = snapshot?.enemies || [];
  if (projectile.targetId) {
    const locked = enemies.find((e) => e.id === projectile.targetId);
    if (locked) return locked;
    projectile.targetId = null;
  }
  let best = null;
  let bestD = maxRange * maxRange;
  for (const e of enemies) {
    const d = dist2(projectile.x, projectile.y, e.x, e.y);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (best) projectile.targetId = best.id;
  return best;
}

function updatePredictedHoming(projectile, weapon, snapshot, dt) {
  if (projectile.kind !== "homing") return;
  const homing = weapon.effects?.find((e) => e.type === "homing");
  if (!homing) return;
  const target = nearestSnapshotEnemy(snapshot, projectile, homing.acquireRange || 620);
  if (!target) return;
  const desired = norm(target.x - projectile.x, target.y - projectile.y);
  const current = norm(projectile.vx, projectile.vy);
  const turn = Math.min(1, (homing.strength || 8) * dt);
  const next = norm(current.x + (desired.x - current.x) * turn, current.y + (desired.y - current.y) * turn);
  projectile.vx = next.x * projectile.speed;
  projectile.vy = next.y * projectile.speed;
}

export function updatePredictedProjectiles(projectiles, dt, snapshot = null) {
  for (const p of projectiles) {
    const weapon = WEAPONS[p.weaponId] || WEAPONS[START_WEAPON];
    const prevX = p.x;
    const prevY = p.y;
    updatePredictedHoming(p, weapon, snapshot, dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.distance = (p.distance || 0) + Math.hypot(p.x - prevX, p.y - prevY);
    if (snapshot?.location) {
      const wallHit = firstSolidWallHitInLocation(snapshot.location.geometry || snapshot.location, prevX, prevY, p.x, p.y, p.radius || 0);
      if (wallHit) {
        p.x = wallHit.x;
        p.y = wallHit.y;
        p.life = 0;
      }
    }
    p.life -= dt;
  }
  return projectiles.filter((p) => (
    p.life > 0 &&
    (p.distance || 0) < (p.range || Infinity) &&
    p.x >= -80 && p.x <= WORLD.w + 80 &&
    p.y >= -80 && p.y <= WORLD.h + 80
  ));
}
