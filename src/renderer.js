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
    const copy = { ...obj };
    map.set(obj.id, copy);
    return copy;
  }
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

function drawPlayer(ctx, p, cam, isLocal) {
  const s = screen(p, cam);
  const r = 13;
  const color = isLocal ? "#fff" : (p.skin === "green" ? GREEN : "#bbb");
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, color);
  drawRect(ctx, s.x - r + 4, s.y - r + 4, r * 2 - 8, r * 2 - 8, "#050505");

  const ax = Math.cos(p.angle || 0);
  const ay = Math.sin(p.angle || 0);
  drawRect(ctx, s.x + ax * 16 - 2, s.y + ay * 16 - 2, 4, 4, isLocal ? GREEN : "#fff");
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
    ctx.lineWidth = p.kind === "rocket" ? 3 : (p.kind === "enemyBullet" ? 1 : 2);
    ctx.beginPath();
    ctx.moveTo(Math.round(s.x + tx), Math.round(s.y + ty));
    ctx.lineTo(Math.round(s.x), Math.round(s.y));
    ctx.stroke();
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

function drawLoot(ctx, item, cam) {
  const data = LOOT[item.kind] || LOOT.heal;
  const s = screen(item, cam);
  const r = data.radius;
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, GREEN);
  drawRect(ctx, s.x - r + 4, s.y - r + 4, r * 2 - 8, r * 2 - 8, "#050505");
  drawText(ctx, data.name.slice(0, 3), s.x, s.y - r - 5, GREEN, "center");
}


function drawRewardPickup(ctx, item, cam) {
  const data = item.rewardType === "loot" ? (LOOT[item.kind] || LOOT.heal) : null;
  const s = screen(item, cam);
  const r = item.radius || data?.radius || 11;
  const active = item.active !== false;
  const claimable = item.claimable !== false;
  const accent = item.accent === "white" ? "#f3f3f3" : GREEN;
  const color = active && claimable ? accent : "rgba(255,255,255,0.48)";
  ctx.strokeStyle = color;
  ctx.lineWidth = claimable ? 2 : 1;
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), r * 2, r * 2);
  drawRect(ctx, s.x - 3, s.y - 3, 6, 6, claimable ? GREEN : "#777");
  drawText(ctx, String(item.label || data?.name || item.kind || "RWD").slice(0, 5), s.x, s.y - r - 5, color, "center");
}

function interactableAccentColor(item) {
  if (item?.accent === "red" || item?.category === "casino") return RED;
  if (item?.accent === "white") return "#f3f3f3";
  return GREEN;
}

function drawInteractable(ctx, item, cam) {
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

  const interactableIds = new Set();
  for (const raw of snapshot.interactables || []) {
    interactableIds.add(raw.id);
    const item = smoothEntity(smooth.interactables, raw, renderDt);
    if (isVisible(item, renderCam, 80)) drawInteractable(ctx, item, renderCam);
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
    if (isVisible(p, renderCam, 90)) drawPlayer(ctx, p, renderCam, isLocal);
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
