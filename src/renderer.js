import { GREEN, VIEW, WORLD } from "./core/constants.js";
import { isVisible, lerp } from "./core/math.js";
import { START_WEAPON, WEAPONS } from "./data/weapons.js";
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

function smoothProjectile(map, obj, dt, snapshotTick) {
  const old = map.get(obj.id);
  if (!old) {
    const copy = { ...obj, _tick: snapshotTick };
    map.set(obj.id, copy);
    return copy;
  }

  if (old._tick !== snapshotTick) {
    old.x = lerp(old.x, obj.x, 0.82);
    old.y = lerp(old.y, obj.y, 0.82);
    old._tick = snapshotTick;
    for (const k of Object.keys(obj)) {
      if (k !== "x" && k !== "y") old[k] = obj[k];
    }
    return old;
  }

  old.x += (old.vx || 0) * dt;
  old.y += (old.vy || 0) * dt;
  return old;
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
  const vx = p.vx || 0;
  const vy = p.vy || 0;
  const speed = Math.hypot(vx, vy) || 1;
  const tx = -(vx / speed) * Math.min(22, speed * 0.026);
  const ty = -(vy / speed) * Math.min(22, speed * 0.026);

  if (p.kind === "rocket" || p.kind === "homing") {
    ctx.strokeStyle = "rgba(0,255,102,0.45)";
    ctx.lineWidth = p.kind === "rocket" ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(Math.round(s.x + tx), Math.round(s.y + ty));
    ctx.lineTo(Math.round(s.x), Math.round(s.y));
    ctx.stroke();
  }

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
  const life = Math.max(0, fx.life || 0);
  const maxLife = Math.max(0.001, fx.maxLife || fx.life || 0.2);
  const age = maxLife - life;

  if (fx.type === "spark") {
    const x = fx.x + (fx.vx || 0) * age;
    const y = fx.y + (fx.vy || 0) * age;
    const s = screen({ x, y }, cam);
    const size = Math.max(2, Math.round(5 * (life / maxLife)));
    drawRect(ctx, s.x - size / 2, s.y - size / 2, size, size, fx.color || GREEN);
    return;
  }

  if (fx.type !== "explosion") return;
  const s = screen(fx, cam);
  const t = 1 - life / maxLife;
  const r = fx.r * (0.35 + t * 0.85);
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = Math.max(1, Math.round(4 * (life / maxLife)));
  ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
  ctx.beginPath();
  ctx.moveTo(Math.round(s.x - r * 1.2), Math.round(s.y));
  ctx.lineTo(Math.round(s.x + r * 1.2), Math.round(s.y));
  ctx.moveTo(Math.round(s.x), Math.round(s.y - r * 1.2));
  ctx.lineTo(Math.round(s.x), Math.round(s.y + r * 1.2));
  ctx.stroke();
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
  const predictedIds = new Set(predictedProjectiles.map((p) => p.id));
  for (const raw of snapshot.projectiles || []) {
    projectileIds.add(raw.id);
    if (raw.ownerId === localId && predictedIds.has(raw.id)) continue;
    const p = smoothProjectile(smooth.projectiles, raw, dt, snapshot.tick);
    if (isVisible(p, cam, 50)) drawProjectile(ctx, p, cam);
  }
  prune(smooth.projectiles, projectileIds);
  drawPredictedProjectiles(ctx, predictedProjectiles, cam);

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
  const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
  const pellets = weapon.pellets || 1;
  const out = [];
  for (let i = 0; i < pellets; i += 1) {
    const offset = pellets === 1 ? 0 : (i - (pellets - 1) / 2) * weapon.spread;
    const angle = pose.angle + offset;
    const vx = Math.cos(angle) * weapon.bulletSpeed;
    const vy = Math.sin(angle) * weapon.bulletSpeed;
    out.push({
      id: `${id}${pellets === 1 ? "" : `-${i}`}:local`,
      ownerId: playerId,
      weaponId,
      kind: weapon.projectile,
      x: pose.x + Math.cos(angle) * (pose.radius + weapon.radius + 1),
      y: pose.y + Math.sin(angle) * (pose.radius + weapon.radius + 1),
      vx,
      vy,
      speed: weapon.bulletSpeed,
      radius: weapon.radius,
      color: weapon.color,
      life: weapon.projectile === "bullet" ? 0.11 : 0.16
    });
  }
  return out;
}

export function updatePredictedProjectiles(projectiles, dt) {
  for (const p of projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  return projectiles.filter((p) => p.life > 0);
}
