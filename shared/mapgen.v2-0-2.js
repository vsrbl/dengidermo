// nncckkrr room generation: walls, pillars, chests, BET terminals, spawns
import { ROOM_MODS, ROOM_SEQUENCE } from './data.v2-0-2.js';

export const WORLD_W = 2200;
export const WORLD_H = 1500;
export const WALL_T = 40;       // gameplay safe border / portal offset
const EDGE_T = 420;             // rendered outer walls extend far outside the camera
const SAFE = 95;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function pushWall(walls, x, y, w, h) {
  walls.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
}

function clearOfCenter(x, y, w, h, rx = 260, ry = 230) {
  return !(Math.abs(x + w / 2 - WORLD_W / 2) < rx && Math.abs(y + h / 2 - WORLD_H / 2) < ry);
}

function addRandomBlock(rng, walls, x, y, w, h) {
  x = clamp(x, SAFE, WORLD_W - SAFE - w);
  y = clamp(y, SAFE, WORLD_H - SAFE - h);
  if (!clearOfCenter(x, y, w, h)) return;
  pushWall(walls, x, y, w, h);
}

// Layout variants: cover and identity, still no true mazes before pathfinding.
function genWalls(rng, category, loopIndex) {
  const walls = [
    // huge outer walls: no visible empty field behind borders when camera reaches edge
    { x: -EDGE_T, y: -EDGE_T, w: WORLD_W + EDGE_T * 2, h: EDGE_T },
    { x: -EDGE_T, y: WORLD_H, w: WORLD_W + EDGE_T * 2, h: EDGE_T },
    { x: -EDGE_T, y: -EDGE_T, w: EDGE_T, h: WORLD_H + EDGE_T * 2 },
    { x: WORLD_W, y: -EDGE_T, w: EDGE_T, h: WORLD_H + EDGE_T * 2 }
  ];

  if (category === 'boss') {
    const cornerSize = 90 + Math.floor(rng() * 80);
    for (const [fx, fy] of [[0.18, 0.2], [0.82, 0.2], [0.18, 0.8], [0.82, 0.8]]) {
      addRandomBlock(rng, walls, WORLD_W * fx - cornerSize / 2, WORLD_H * fy - cornerSize / 2, cornerSize, cornerSize);
    }
    if (loopIndex >= 2) {
      for (let i = 0; i < 2 + Math.min(3, loopIndex - 1); i++) {
        const w = 70 + rng() * 80, h = 70 + rng() * 80;
        const a = rng() * Math.PI * 2;
        addRandomBlock(rng, walls, WORLD_W / 2 + Math.cos(a) * 430 - w / 2, WORLD_H / 2 + Math.sin(a) * 260 - h / 2, w, h);
      }
    }
    return walls;
  }

  const variant = Math.floor(rng() * 7);
  const extra = Math.min(7, loopIndex * 2);
  const blocks = 4 + Math.floor(rng() * 6) + Math.floor(extra * rng());

  if (variant === 0) { // scattered chunky cover
    for (let i = 0; i < blocks; i++) {
      const w = 55 + rng() * 160, h = 55 + rng() * 150;
      addRandomBlock(rng, walls, SAFE + rng() * (WORLD_W - SAFE * 2 - w), SAFE + rng() * (WORLD_H - SAFE * 2 - h), w, h);
    }
  } else if (variant === 1) { // staggered rows
    const rows = 2 + Math.floor(rng() * 3);
    for (let r = 0; r < rows; r++) {
      const count = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < count; i++) {
        const w = 80 + rng() * 130, h = 45 + rng() * 90;
        const x = WORLD_W * ((i + 1) / (count + 1)) - w / 2 + (rng() - 0.5) * 150;
        const y = WORLD_H * ((r + 1) / (rows + 1)) - h / 2 + (rng() - 0.5) * 130;
        addRandomBlock(rng, walls, x, y, w, h);
      }
    }
  } else if (variant === 2) { // broken ring around center
    const count = blocks + 2;
    for (let i = 0; i < count; i++) {
      if (rng() < 0.18) continue;
      const w = 60 + rng() * 110, h = 60 + rng() * 110;
      const a = (i / count) * Math.PI * 2 + rng() * 0.45;
      addRandomBlock(rng, walls, WORLD_W / 2 + Math.cos(a) * (420 + rng() * 170) - w / 2, WORLD_H / 2 + Math.sin(a) * (250 + rng() * 130) - h / 2, w, h);
    }
  } else if (variant === 3) { // long broken signal lanes
    const horizontal = rng() < 0.5;
    const lanes = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < lanes; i++) {
      const len = 230 + rng() * 380;
      const thick = 38 + rng() * 58;
      const x = SAFE + rng() * (WORLD_W - SAFE * 2 - (horizontal ? len : thick));
      const y = SAFE + rng() * (WORLD_H - SAFE * 2 - (horizontal ? thick : len));
      addRandomBlock(rng, walls, x, y, horizontal ? len : thick, horizontal ? thick : len);
    }
    for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) {
      const w = 55 + rng() * 90, h = 55 + rng() * 90;
      addRandomBlock(rng, walls, SAFE + rng() * (WORLD_W - SAFE * 2 - w), SAFE + rng() * (WORLD_H - SAFE * 2 - h), w, h);
    }
  } else if (variant === 4) { // two cover clusters / loot pockets
    const centers = [
      { x: WORLD_W * (0.25 + rng() * 0.18), y: WORLD_H * (0.25 + rng() * 0.5) },
      { x: WORLD_W * (0.57 + rng() * 0.18), y: WORLD_H * (0.25 + rng() * 0.5) }
    ];
    for (const c of centers) {
      const n = 3 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const w = 50 + rng() * 110, h = 50 + rng() * 110;
        addRandomBlock(rng, walls, c.x + (rng() - 0.5) * 300 - w / 2, c.y + (rng() - 0.5) * 250 - h / 2, w, h);
      }
    }
  } else if (variant === 5) { // asymmetric cross, with holes
    const cx = WORLD_W / 2 + (rng() - 0.5) * 420;
    const cy = WORLD_H / 2 + (rng() - 0.5) * 260;
    addRandomBlock(rng, walls, cx - 280, cy - 30, 180, 60);
    addRandomBlock(rng, walls, cx + 100, cy - 30, 180, 60);
    addRandomBlock(rng, walls, cx - 35, cy - 230, 70, 140);
    addRandomBlock(rng, walls, cx - 35, cy + 90, 70, 140);
    for (let i = 0; i < Math.max(2, blocks - 4); i++) {
      const w = 45 + rng() * 120, h = 45 + rng() * 120;
      addRandomBlock(rng, walls, SAFE + rng() * (WORLD_W - SAFE * 2 - w), SAFE + rng() * (WORLD_H - SAFE * 2 - h), w, h);
    }
  } else { // edge-bite blocks: arena feels more enclosed, still playable
    for (let i = 0; i < blocks; i++) {
      const side = Math.floor(rng() * 4);
      const w = 70 + rng() * 180, h = 70 + rng() * 180;
      let x = SAFE + rng() * (WORLD_W - SAFE * 2 - w), y = SAFE + rng() * (WORLD_H - SAFE * 2 - h);
      if (side === 0) y = SAFE + rng() * 90;
      if (side === 1) y = WORLD_H - SAFE - h - rng() * 90;
      if (side === 2) x = SAFE + rng() * 90;
      if (side === 3) x = WORLD_W - SAFE - w - rng() * 90;
      addRandomBlock(rng, walls, x, y, w, h);
    }
  }
  return walls;
}

function blockedByWalls(x, y, walls, margin) {
  for (const w of walls) {
    if (x > w.x - margin && x < w.x + w.w + margin && y > w.y - margin && y < w.y + w.h + margin) return true;
  }
  return false;
}

function blockedByObjects(x, y, blockers) {
  for (const b of blockers) {
    const dx = x - b.x, dy = y - b.y;
    const minD = b.r || 160;
    if (dx * dx + dy * dy < minD * minD) return true;
  }
  return false;
}

function freeSpot(rng, walls, margin = 70, blockers = []) {
  for (let tries = 0; tries < 110; tries++) {
    const x = SAFE + margin + rng() * (WORLD_W - (SAFE + margin) * 2);
    const y = SAFE + margin + rng() * (WORLD_H - (SAFE + margin) * 2);
    if (!blockedByWalls(x, y, walls, margin) && !blockedByObjects(x, y, blockers)) return { x: Math.round(x), y: Math.round(y) };
  }
  return { x: WORLD_W / 2 + Math.round((rng() - 0.5) * 360), y: WORLD_H / 2 + Math.round((rng() - 0.5) * 260) };
}

function pocketSpot(rng, walls, center, margin, blockers) {
  for (let tries = 0; tries < 50; tries++) {
    const a = rng() * Math.PI * 2;
    const r = 95 + rng() * 220;
    const x = clamp(center.x + Math.cos(a) * r, SAFE + margin, WORLD_W - SAFE - margin);
    const y = clamp(center.y + Math.sin(a) * r, SAFE + margin, WORLD_H - SAFE - margin);
    if (!blockedByWalls(x, y, walls, margin) && !blockedByObjects(x, y, blockers)) return { x: Math.round(x), y: Math.round(y) };
  }
  return freeSpot(rng, walls, margin, blockers);
}

// chest/interactable budget: more texture — empty rooms, pockets, strange clusters, late greed.
function genInteractables(rng, category, loopIndex, greed) {
  const objs = [];
  let id = 1;
  if (category === 'boss') return objs; // boss room: reward spawns after kill

  const density = rng() + loopIndex * 0.035 + (greed ? 0.2 : 0);
  const bscCount = density < 0.18 ? 0 : density < 0.72 ? 1 : density < 1.08 ? 2 : 3;
  for (let i = 0; i < bscCount; i++) objs.push({ id: `c${id++}`, type: 'chest', chest: 'basic_chest' });

  const paidCount = density < 0.35 ? 0 : density < 0.85 ? 1 : density < 1.2 ? 2 : 3;
  for (let i = 0; i < paidCount; i++) {
    const roll = rng();
    const chest = roll < 0.42 ? 'weapon_chest' : roll < 0.78 ? 'ability_chest' : 'rare_chest';
    objs.push({ id: `c${id++}`, type: 'chest', chest });
  }
  if (rng() < 0.10 + loopIndex * 0.035 + (greed ? 0.05 : 0)) objs.push({ id: `c${id++}`, type: 'chest', chest: 'cursed_chest' });
  if (rng() < 0.56 + loopIndex * 0.035) objs.push({ id: `b${id++}`, type: 'bet' });
  return objs;
}

export function generateRoom(seed, runDepth, loopIndex) {
  const rng = mulberry32(seed);
  const roomInLoop = runDepth % ROOM_SEQUENCE.length;
  const category = ROOM_SEQUENCE[roomInLoop];
  const modifierIds = [];
  if (loopIndex >= 1 && category !== 'boss') {
    const modChance = Math.min(0.70, 0.16 + loopIndex * 0.08);
    if (rng() < modChance) {
      const keys = Object.keys(ROOM_MODS);
      modifierIds.push(keys[Math.floor(rng() * keys.length)]);
      if (loopIndex >= 4 && rng() < 0.22) {
        const extra = keys[Math.floor(rng() * keys.length)];
        if (!modifierIds.includes(extra)) modifierIds.push(extra);
      }
    }
  }
  const greed = modifierIds.includes('greed');
  const walls = genWalls(rng, category, loopIndex);
  const interactables = genInteractables(rng, category, loopIndex, greed);
  const blockers = [
    { x: WORLD_W / 2, y: WORLD_H / 2, r: 290 },
    { x: WORLD_W / 2, y: WALL_T + 110, r: 180 }
  ];
  const usePocket = rng() < 0.42 && interactables.length >= 2;
  const pockets = [freeSpot(rng, walls, 110, blockers), freeSpot(rng, walls, 110, blockers)];
  for (let i = 0; i < interactables.length; i++) {
    const o = interactables[i];
    const clustered = usePocket && rng() < 0.65;
    const p = clustered ? pocketSpot(rng, walls, pockets[i % pockets.length], 82, blockers) : freeSpot(rng, walls, 86, blockers);
    o.x = p.x; o.y = p.y; o.opened = false;
    // not too close, but allow visible reward pockets instead of perfectly even spacing
    blockers.push({ x: o.x, y: o.y, r: clustered ? 128 : 178 });
  }
  // softer opening, harsh late-loop ramp
  const late = Math.max(0, loopIndex - 2);
  const baseQuota = category === 'boss' ? 1 : 8 + roomInLoop * 2 + loopIndex * 5 + Math.floor(Math.pow(late, 1.65) * 7);
  return {
    seed, runDepth, loopIndex, roomInLoop,
    roomId: `${category}-${String(runDepth).padStart(2, '0')}`,
    category, modifierIds,
    walls, interactables,
    quota: baseQuota,
    w: WORLD_W, h: WORLD_H
  };
}

export function spawnPoint(idx) {
  const pts = [
    { x: WORLD_W / 2 - 60, y: WORLD_H / 2 - 60 },
    { x: WORLD_W / 2 + 60, y: WORLD_H / 2 - 60 },
    { x: WORLD_W / 2 - 60, y: WORLD_H / 2 + 60 },
    { x: WORLD_W / 2 + 60, y: WORLD_H / 2 + 60 }
  ];
  return pts[idx % 4];
}

export function enemySpawnPoint(rng, walls, players) {
  for (let tries = 0; tries < 80; tries++) {
    const p = freeSpot(rng, walls, 65);
    let farEnough = true;
    for (const pl of players) {
      const dx = p.x - pl.x, dy = p.y - pl.y;
      if (dx * dx + dy * dy < 440 * 440) { farEnough = false; break; }
    }
    if (farEnough) return p;
  }
  return freeSpot(rng, walls, 65);
}
