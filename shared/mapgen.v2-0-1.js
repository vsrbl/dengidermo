// nncckkrr room generation: walls, pillars, chests, BET terminals, spawns
import { CHESTS, ROOM_MODS, ROOM_SEQUENCE } from './data.v2-0-1.js';

export const WORLD_W = 2200;
export const WORLD_H = 1500;
export const WALL_T = 40; // outer wall thickness

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// layout variants per room category — pillars/cover blocks, no mazes (no pathfinding yet)
function genWalls(rng, category) {
  const walls = [
    // outer bounds
    { x: 0, y: 0, w: WORLD_W, h: WALL_T },
    { x: 0, y: WORLD_H - WALL_T, w: WORLD_W, h: WALL_T },
    { x: 0, y: 0, w: WALL_T, h: WORLD_H },
    { x: WORLD_W - WALL_T, y: 0, w: WALL_T, h: WORLD_H }
  ];
  if (category === 'boss') {
    // open arena, 4 corner blocks
    for (const [fx, fy] of [[0.18, 0.2], [0.82, 0.2], [0.18, 0.8], [0.82, 0.8]]) {
      walls.push({ x: WORLD_W * fx - 50, y: WORLD_H * fy - 50, w: 100, h: 100 });
    }
    return walls;
  }
  const variant = Math.floor(rng() * 3);
  const pillars = 5 + Math.floor(rng() * 5);
  for (let i = 0; i < pillars; i++) {
    const pw = 60 + Math.floor(rng() * 120);
    const ph = 60 + Math.floor(rng() * 120);
    let x, y;
    if (variant === 0) { // scattered
      x = WALL_T + 150 + rng() * (WORLD_W - 300 - pw - WALL_T * 2);
      y = WALL_T + 150 + rng() * (WORLD_H - 300 - ph - WALL_T * 2);
    } else if (variant === 1) { // rows
      x = WORLD_W * (0.2 + 0.3 * (i % 3)) - pw / 2;
      y = WORLD_H * (0.28 + 0.22 * (Math.floor(i / 3) % 3)) - ph / 2 + (rng() - 0.5) * 120;
    } else { // ring
      const ang = (i / pillars) * Math.PI * 2 + rng() * 0.4;
      x = WORLD_W / 2 + Math.cos(ang) * WORLD_W * 0.28 - pw / 2;
      y = WORLD_H / 2 + Math.sin(ang) * WORLD_H * 0.28 - ph / 2;
    }
    x = Math.max(WALL_T + 120, Math.min(WORLD_W - WALL_T - 120 - pw, x));
    y = Math.max(WALL_T + 120, Math.min(WORLD_H - WALL_T - 120 - ph, y));
    // keep center spawn area clear
    if (Math.abs(x + pw / 2 - WORLD_W / 2) < 220 && Math.abs(y + ph / 2 - WORLD_H / 2) < 220) continue;
    walls.push({ x: Math.round(x), y: Math.round(y), w: pw, h: ph });
  }
  return walls;
}

function freeSpot(rng, walls, margin = 70, blockers = []) {
  for (let tries = 0; tries < 80; tries++) {
    const x = WALL_T + margin + rng() * (WORLD_W - (WALL_T + margin) * 2);
    const y = WALL_T + margin + rng() * (WORLD_H - (WALL_T + margin) * 2);
    let ok = true;
    for (const w of walls) {
      if (x > w.x - margin && x < w.x + w.w + margin && y > w.y - margin && y < w.y + w.h + margin) { ok = false; break; }
    }
    if (ok) {
      for (const b of blockers) {
        const dx = x - b.x, dy = y - b.y;
        const minD = b.r || margin * 2.1;
        if (dx * dx + dy * dy < minD * minD) { ok = false; break; }
      }
    }
    if (ok) return { x: Math.round(x), y: Math.round(y) };
  }
  return { x: WORLD_W / 2, y: WORLD_H / 2 };
}

// chest/interactable budget: random, sometimes none, sometimes pockets
function genInteractables(rng, category, loopIndex, greed) {
  const objs = [];
  let id = 1;
  if (category === 'boss') {
    return objs; // boss room: reward spawns after kill
  }
  // BSC free chest: 0-2
  const bscCount = rng() < 0.25 ? 0 : (rng() < 0.7 ? 1 : 2);
  for (let i = 0; i < bscCount; i++) objs.push({ id: `c${id++}`, type: 'chest', chest: 'basic_chest' });
  // paid chests
  const paidRoll = rng() + (greed ? 0.25 : 0) + loopIndex * 0.05;
  if (paidRoll > 0.35) objs.push({ id: `c${id++}`, type: 'chest', chest: rng() < 0.5 ? 'weapon_chest' : 'ability_chest' });
  if (paidRoll > 0.8) objs.push({ id: `c${id++}`, type: 'chest', chest: 'rare_chest' });
  // cursed chest: rare
  if (rng() < 0.12 + loopIndex * 0.04) objs.push({ id: `c${id++}`, type: 'chest', chest: 'cursed_chest' });
  // BET terminal: most rooms have one
  if (rng() < 0.75) objs.push({ id: `b${id++}`, type: 'bet' });
  return objs;
}

export function generateRoom(seed, runDepth, loopIndex) {
  const rng = mulberry32(seed);
  const roomInLoop = runDepth % ROOM_SEQUENCE.length;
  const category = ROOM_SEQUENCE[roomInLoop];
  // modifiers from loop 1+
  const modifierIds = [];
  if (loopIndex >= 1 && category !== 'boss') {
    if (rng() < 0.18 + loopIndex * 0.05) {
      const keys = Object.keys(ROOM_MODS);
      modifierIds.push(keys[Math.floor(rng() * keys.length)]);
    }
  }
  const greed = modifierIds.includes('greed');
  const walls = genWalls(rng, category);
  const interactables = genInteractables(rng, category, loopIndex, greed);
  const blockers = [
    { x: WORLD_W / 2, y: WORLD_H / 2, r: 260 },
    { x: WORLD_W / 2, y: WALL_T + 110, r: 160 }
  ];
  for (const o of interactables) {
    const p = freeSpot(rng, walls, 90, blockers);
    o.x = p.x; o.y = p.y; o.opened = false;
    blockers.push({ x: o.x, y: o.y, r: 190 });
  }
  // kill quota objective
  const baseQuota = category === 'boss' ? 1 : 14 + roomInLoop * 4 + loopIndex * 6;
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
  for (let tries = 0; tries < 60; tries++) {
    const p = freeSpot(rng, walls, 60);
    let farEnough = true;
    for (const pl of players) {
      const dx = p.x - pl.x, dy = p.y - pl.y;
      if (dx * dx + dy * dy < 380 * 380) { farEnough = false; break; }
    }
    if (farEnough) return p;
  }
  return freeSpot(rng, walls, 60);
}
