import { GREEN, VIEW, WORLD } from "./core/constants.js";
import { dist2, isVisible, lerp, norm } from "./core/math.js";
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
    loot: new Map(),
    portals: new Map()
  };
  return { canvas, ctx, smooth };
}

export function resetRendererSmooth(renderer) {
  for (const map of Object.values(renderer?.smooth || {})) map.clear?.();
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
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  const greenLoc = location?.accent === "green";
  ctx.strokeStyle = greenLoc ? "rgba(0,255,102,0.055)" : "rgba(255,255,255,0.055)";
  ctx.lineWidth = 1;
  const step = location?.gridStep || 80;
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

  if (fx.type === "portal") {
    const s = screen(fx, cam);
    const t = 1 - life / maxLife;
    const r = (fx.radius || 80) * (0.45 + t * 0.7);
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = Math.max(1, Math.round(5 * (life / maxLife)));
    ctx.strokeRect(Math.round(s.x - r), Math.round(s.y - r), Math.round(r * 2), Math.round(r * 2));
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

export function render(renderer, snapshot, localPose, localId, cam, mouse, predictedProjectiles, renderDt, simDt = renderDt) {
  const { ctx, smooth } = renderer;
  drawGrid(ctx, cam, snapshot?.location);
  if (!snapshot) {
    drawText(ctx, "CONNECTING", VIEW.w / 2, VIEW.h / 2, GREEN, "center");
    return;
  }

  const enemyIds = new Set();
  for (const raw of snapshot.enemies || []) {
    enemyIds.add(raw.id);
    const e = smoothEntity(smooth.enemies, raw, renderDt);
    if (isVisible(e, cam, 80)) drawEnemy(ctx, e, cam);
  }
  prune(smooth.enemies, enemyIds);

  const lootIds = new Set();
  for (const raw of snapshot.loot || []) {
    lootIds.add(raw.id);
    const item = smoothEntity(smooth.loot, raw, renderDt);
    if (isVisible(item, cam, 60)) drawLoot(ctx, item, cam);
  }
  prune(smooth.loot, lootIds);

  const portalIds = new Set();
  for (const raw of snapshot.portals || []) {
    portalIds.add(raw.id);
    const portal = smoothEntity(smooth.portals, raw, renderDt);
    if (isVisible(portal, cam, 130)) drawPortal(ctx, portal, cam);
  }
  prune(smooth.portals, portalIds);

  const projectileIds = new Set();
  const predictedServerIds = new Set(predictedProjectiles.map((p) => p.serverId || String(p.id).replace(/:local$/, "")));
  for (const raw of snapshot.projectiles || []) {
    projectileIds.add(raw.id);
    if (raw.ownerId === localId && predictedServerIds.has(raw.id)) continue;
    const p = smoothProjectile(smooth.projectiles, raw, renderDt, simDt, snapshot.tick);
    if (isVisible(p, cam, 50)) drawProjectile(ctx, p, cam);
  }
  prune(smooth.projectiles, projectileIds);
  drawPredictedProjectiles(ctx, predictedProjectiles, cam);

  for (const fx of snapshot.effects || []) drawEffect(ctx, fx, cam);

  const playerIds = new Set();
  for (const raw of snapshot.players || []) {
    playerIds.add(raw.id);
    const isLocal = raw.id === localId;
    const p = isLocal && localPose ? { ...raw, ...localPose, hp: raw.hp, maxHp: raw.maxHp, activeWeapon: raw.activeWeapon, skin: raw.skin } : smoothEntity(smooth.players, raw, renderDt);
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
    p.life -= dt;
  }
  return projectiles.filter((p) => (
    p.life > 0 &&
    (p.distance || 0) < (p.range || Infinity) &&
    p.x >= -80 && p.x <= WORLD.w + 80 &&
    p.y >= -80 && p.y <= WORLD.h + 80
  ));
}
