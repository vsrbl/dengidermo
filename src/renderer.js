import { GREEN, VIEW, WORLD } from "./core/constants.js";
import { isVisible, lerp } from "./core/math.js";
import { WEAPONS } from "./data/weapons.js";
import { ENEMIES } from "./data/enemies.js";
import { LOOT } from "./data/loot.js";

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
    loot: new Map()
  };
  return { canvas, ctx, smooth };
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

function drawGrid(ctx, cam) {
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  ctx.strokeStyle = "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;
  const step = 80;
  const startX = -((cam.x % step + step) % step);
  const startY = -((cam.y % step + step) % step);
  for (let x = startX; x < VIEW.w; x += step) {
    ctx.beginPath(); ctx.moveTo(Math.round(x), 0); ctx.lineTo(Math.round(x), VIEW.h); ctx.stroke();
  }
  for (let y = startY; y < VIEW.h; y += step) {
    ctx.beginPath(); ctx.moveTo(0, Math.round(y)); ctx.lineTo(VIEW.w, Math.round(y)); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.strokeRect(Math.round(-cam.x), Math.round(-cam.y), WORLD.w, WORLD.h);
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

  const hpW = 28;
  const hp = Math.max(0, Math.min(1, p.hp / (p.maxHp || 100)));
  drawRect(ctx, s.x - hpW / 2, s.y - 24, hpW, 3, "#333");
  drawRect(ctx, s.x - hpW / 2, s.y - 24, hpW * hp, 3, hp > 0.35 ? GREEN : "#ff3048");
  drawText(ctx, p.id, s.x, s.y + 30, isLocal ? GREEN : "#777", "center");
}

function drawEnemy(ctx, e, cam) {
  const data = ENEMIES[e.kind] || ENEMIES.grunt;
  const s = screen(e, cam);
  const r = data.radius;
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, "#fff");
  drawRect(ctx, s.x - r + 3, s.y - r + 3, r * 2 - 6, r * 2 - 6, "#050505");
  if (e.kind === "boss") drawText(ctx, "BOSS", s.x, s.y - r - 8, GREEN, "center");
  const hp = Math.max(0, Math.min(1, e.hp / data.hp));
  drawRect(ctx, s.x - r, s.y + r + 5, r * 2, 3, "#333");
  drawRect(ctx, s.x - r, s.y + r + 5, r * 2 * hp, 3, GREEN);
}

function drawProjectile(ctx, p, cam) {
  const s = screen(p, cam);
  const color = p.color === "green" ? GREEN : "#fff";
  const r = p.radius || 3;
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, color);
}

function drawLoot(ctx, item, cam) {
  const data = LOOT[item.kind] || LOOT.heal;
  const s = screen(item, cam);
  const r = data.radius;
  drawRect(ctx, s.x - r, s.y - r, r * 2, r * 2, GREEN);
  drawRect(ctx, s.x - r + 4, s.y - r + 4, r * 2 - 8, r * 2 - 8, "#050505");
  drawText(ctx, data.name.slice(0, 3), s.x, s.y - r - 5, GREEN, "center");
}

function drawEffect(ctx, fx, cam) {
  if (fx.type !== "explosion") return;
  const s = screen(fx, cam);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = 2;
  ctx.strokeRect(Math.round(s.x - fx.r), Math.round(s.y - fx.r), Math.round(fx.r * 2), Math.round(fx.r * 2));
}

function drawPredictedProjectiles(ctx, projectiles, authIds, cam) {
  for (const p of projectiles) {
    if (authIds.has(p.id)) continue;
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

export function render(renderer, snapshot, localPose, localId, cam, mouse, predictedProjectiles, dt) {
  const { ctx, smooth } = renderer;
  drawGrid(ctx, cam);
  if (!snapshot) {
    drawText(ctx, "CONNECTING", VIEW.w / 2, VIEW.h / 2, GREEN, "center");
    return;
  }

  const enemyIds = new Set();
  for (const raw of snapshot.enemies || []) {
    enemyIds.add(raw.id);
    const e = smoothEntity(smooth.enemies, raw, dt);
    if (isVisible(e, cam, 80)) drawEnemy(ctx, e, cam);
  }
  prune(smooth.enemies, enemyIds);

  const lootIds = new Set();
  for (const raw of snapshot.loot || []) {
    lootIds.add(raw.id);
    const item = smoothEntity(smooth.loot, raw, dt);
    if (isVisible(item, cam, 60)) drawLoot(ctx, item, cam);
  }
  prune(smooth.loot, lootIds);

  const projectileIds = new Set();
  for (const raw of snapshot.projectiles || []) {
    projectileIds.add(raw.id);
    const p = smoothEntity(smooth.projectiles, raw, dt, raw.ownerId === localId);
    if (isVisible(p, cam, 50)) drawProjectile(ctx, p, cam);
  }
  prune(smooth.projectiles, projectileIds);
  drawPredictedProjectiles(ctx, predictedProjectiles, projectileIds, cam);

  for (const fx of snapshot.effects || []) drawEffect(ctx, fx, cam);

  const playerIds = new Set();
  for (const raw of snapshot.players || []) {
    playerIds.add(raw.id);
    const isLocal = raw.id === localId;
    const p = isLocal && localPose ? { ...raw, ...localPose, hp: raw.hp, maxHp: raw.maxHp, weapon: raw.weapon, skin: raw.skin } : smoothEntity(smooth.players, raw, dt);
    if (isVisible(p, cam, 90)) drawPlayer(ctx, p, cam, isLocal);
  }
  prune(smooth.players, playerIds);

  if (localPose && mouse.inside) {
    const sx = localPose.x - cam.x;
    const sy = localPose.y - cam.y;
    ctx.strokeStyle = "rgba(0,255,102,0.34)";
    ctx.beginPath();
    ctx.moveTo(Math.round(sx), Math.round(sy));
    ctx.lineTo(Math.round(mouse.x), Math.round(mouse.y));
    ctx.stroke();
  }
  drawCrosshair(ctx, mouse);
}

export function makePredictedProjectile(id, playerId, weaponId, pose) {
  const weapon = WEAPONS[weaponId] || WEAPONS.pistol;
  return {
    id,
    ownerId: playerId,
    weaponId,
    kind: weapon.projectile,
    x: pose.x + Math.cos(pose.angle) * 17,
    y: pose.y + Math.sin(pose.angle) * 17,
    vx: Math.cos(pose.angle) * weapon.bulletSpeed,
    vy: Math.sin(pose.angle) * weapon.bulletSpeed,
    speed: weapon.bulletSpeed,
    radius: weapon.radius,
    color: weapon.color,
    life: Math.min(0.35, weapon.range / weapon.bulletSpeed)
  };
}

export function updatePredictedProjectiles(projectiles, dt) {
  for (const p of projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  return projectiles.filter((p) => p.life > 0);
}
