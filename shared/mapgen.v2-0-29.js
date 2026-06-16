// nncckkrr room generation: walls, pillars, chests, BET terminals, spawns
import { ROOM_MODS, ROOM_SEQUENCE, SPECIAL_ROOMS } from './data.v2-0-29.js';

export const WORLD_W = 2200;
export const WORLD_H = 1500;
export const WALL_T = 40;       // gameplay safe border / portal offset
const EDGE_T = 900;             // huge outer walls: no visible field behind borders
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

  const variant = Math.floor(rng() * 12);
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
  } else if (variant === 6) { // edge-bite blocks: arena feels more enclosed, still playable
    for (let i = 0; i < blocks; i++) {
      const side = Math.floor(rng() * 4);
      const w = 70 + rng() * 220, h = 70 + rng() * 220;
      let x = SAFE + rng() * (WORLD_W - SAFE * 2 - w), y = SAFE + rng() * (WORLD_H - SAFE * 2 - h);
      if (side === 0) y = SAFE + rng() * 100;
      if (side === 1) y = WORLD_H - SAFE - h - rng() * 100;
      if (side === 2) x = SAFE + rng() * 100;
      if (side === 3) x = WORLD_W - SAFE - w - rng() * 100;
      addRandomBlock(rng, walls, x, y, w, h);
    }
  } else if (variant === 7) { // broken diagonal signal barricades
    const diag = rng() < 0.5 ? 1 : -1;
    const count = 4 + Math.floor(rng() * 4) + Math.min(4, loopIndex);
    for (let i = 0; i < count; i++) {
      const w = 90 + rng() * 210, h = 42 + rng() * 74;
      const t = (i + 0.5) / count;
      const x = WORLD_W * (0.14 + t * 0.72) + (rng() - 0.5) * 250 - w / 2;
      const y = WORLD_H * (diag > 0 ? 0.16 + t * 0.68 : 0.84 - t * 0.68) + (rng() - 0.5) * 180 - h / 2;
      addRandomBlock(rng, walls, x, y, w, h);
    }
  } else if (variant === 8) { // micro-arena debris cloud; high randomness, no maze
    const centers = 1 + Math.floor(rng() * 4);
    for (let c = 0; c < centers; c++) {
      const cx = SAFE + 220 + rng() * (WORLD_W - SAFE * 2 - 440);
      const cy = SAFE + 170 + rng() * (WORLD_H - SAFE * 2 - 340);
      const n = 2 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const w = 38 + rng() * 120, h = 38 + rng() * 120;
        addRandomBlock(rng, walls, cx + (rng() - 0.5) * 360 - w / 2, cy + (rng() - 0.5) * 280 - h / 2, w, h);
      }
    }
  } else if (variant === 9) { // terminal teeth: side jaws with central lanes
    const side = rng() < 0.5;
    for (let i = 0; i < 4 + Math.floor(rng() * 3); i++) {
      const w = side ? 70 + rng() * 90 : 180 + rng() * 300;
      const h = side ? 160 + rng() * 300 : 70 + rng() * 90;
      const x = side ? (rng() < 0.5 ? SAFE + rng() * 170 : WORLD_W - SAFE - w - rng() * 170) : SAFE + rng() * (WORLD_W - SAFE * 2 - w);
      const y = side ? SAFE + rng() * (WORLD_H - SAFE * 2 - h) : (rng() < 0.5 ? SAFE + rng() * 160 : WORLD_H - SAFE - h - rng() * 160);
      addRandomBlock(rng, walls, x, y, w, h);
    }
  } else if (variant === 10) { // casino pockets: small hazard islands and reward corners
    for (let i = 0; i < 5 + Math.floor(rng() * 5); i++) {
      const w = 36 + rng() * 84, h = 36 + rng() * 84;
      const x = WORLD_W * (0.15 + rng() * 0.7) - w / 2;
      const y = WORLD_H * (0.15 + rng() * 0.7) - h / 2;
      addRandomBlock(rng, walls, x, y, w, h);
    }
  } else { // broken spokes; cover points point toward center but leave readable gaps
    const spokes = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + rng() * 0.35;
      const d = 300 + rng() * 430;
      const w = 55 + rng() * 120, h = 40 + rng() * 110;
      addRandomBlock(rng, walls, WORLD_W / 2 + Math.cos(a) * d - w / 2, WORLD_H / 2 + Math.sin(a) * d - h / 2, w, h);
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
function genInteractables(rng, category, loopIndex, greed, modIds = [], specialRoomId = '') {
  const objs = [];
  let id = 1;
  if (category === 'boss') return objs; // boss room: reward spawns after kill

  const mood = rng(); // each room gets a loot personality, not just smooth density
  const debtFloor = modIds.includes('debt_floor');
  const contract = specialRoomId === 'signal_contract';
  const rewardPocket = specialRoomId === 'reward_pocket';
  const density = rng() * 1.35 + loopIndex * 0.055 + (greed ? 0.28 : 0) + (debtFloor ? 0.45 : 0) + (rewardPocket ? 0.6 : 0);
  let bscCount = density < 0.16 ? 0 : density < 0.62 ? 1 : density < 1.04 ? 2 : 3 + Math.floor(rng() * 2);
  let paidCount = density < 0.28 ? 0 : density < 0.75 ? 1 : density < 1.14 ? 2 : 3 + Math.floor(rng() * 2);
  if (mood < 0.12) { bscCount = 0; paidCount = rng() < 0.55 ? 0 : 1; }           // dead/quiet room
  else if (mood > 0.86) { bscCount += 1 + Math.floor(rng() * 2); paidCount += 1; } // greedy pocket
  for (let i = 0; i < bscCount; i++) objs.push({ id: `c${id++}`, type: 'chest', chest: 'basic_chest' });

  for (let i = 0; i < paidCount; i++) {
    const roll = rng();
    const chest = roll < 0.34 ? 'weapon_chest' : roll < 0.68 ? 'ability_chest' : 'rare_chest';
    objs.push({ id: `c${id++}`, type: 'chest', chest });
  }
  if (rng() < 0.13 + loopIndex * 0.045 + (greed ? 0.08 : 0) + (debtFloor ? 0.14 : 0)) objs.push({ id: `c${id++}`, type: 'chest', chest: 'cursed_chest' });
  if (rng() < 0.48 + loopIndex * 0.05 + (mood > 0.75 ? 0.18 : 0) + (contract ? 0.28 : 0)) objs.push({ id: `b${id++}`, type: 'bet' });
  if (contract) objs.push({ id: `c${id++}`, type: 'chest', chest: rng() < 0.5 ? 'rare_chest' : 'ability_chest' });
  return objs;
}

export function generateRoom(seed, runDepth, loopIndex) {
  const rng = mulberry32(seed);
  const roomInLoop = runDepth % ROOM_SEQUENCE.length;
  const baseCategory = ROOM_SEQUENCE[roomInLoop];
  let category = baseCategory;
  let specialRoomId = '';
  let activityId = '';

  // Route replacement rules: non-boss rooms can become special/directive rooms.
  if (category !== 'boss' && loopIndex >= 1) {
    const specialChance = Math.min(0.34, 0.10 + loopIndex * 0.035);
    if (rng() < specialChance) {
      const specials = Object.keys(SPECIAL_ROOMS);
      specialRoomId = specials[Math.floor(rng() * specials.length)];
      activityId = specialRoomId;
    }
  }

  const modifierIds = [];
  if (loopIndex >= 1 && category !== 'boss') {
    const modChance = Math.min(0.82, 0.20 + loopIndex * 0.085 + (specialRoomId ? 0.18 : 0));
    if (rng() < modChance) {
      const keys = Object.keys(ROOM_MODS).filter(k => k !== 'skin_cache');
      modifierIds.push(keys[Math.floor(rng() * keys.length)]);
      if (loopIndex >= 2 && rng() < 0.20 + loopIndex * 0.035) {
        const extra = keys[Math.floor(rng() * keys.length)];
        if (!modifierIds.includes(extra)) modifierIds.push(extra);
      }
      if (loopIndex >= 5 && rng() < 0.18) {
        const extra = keys[Math.floor(rng() * keys.length)];
        if (!modifierIds.includes(extra)) modifierIds.push(extra);
      }
    }
  }
  if (specialRoomId === 'signal_contract') {
    const contractMods = ['greed', 'static_rain', 'debt_floor', 'hunter_contract', 'casino_virus', 'mirror_room'];
    const picked = contractMods[Math.floor(rng() * contractMods.length)];
    if (!modifierIds.includes(picked)) modifierIds.push(picked);
  } else if (specialRoomId === 'debt_node') {
    if (!modifierIds.includes('debt_floor')) modifierIds.push('debt_floor');
  } else if (specialRoomId === 'reward_pocket') {
    if (!modifierIds.includes('greed') && rng() < 0.55) modifierIds.push('greed');
  }

  const greed = modifierIds.includes('greed');
  const walls = genWalls(rng, category, loopIndex);
  const interactables = genInteractables(rng, category, loopIndex, greed, modifierIds, specialRoomId);
  const blockers = [
    { x: WORLD_W / 2, y: WORLD_H / 2, r: 290 }
  ];
  const usePocket = rng() < (specialRoomId === 'reward_pocket' ? 0.88 : 0.42) && interactables.length >= 2;
  const pockets = [freeSpot(rng, walls, 110, blockers), freeSpot(rng, walls, 110, blockers), freeSpot(rng, walls, 110, blockers)];
  for (let i = 0; i < interactables.length; i++) {
    const o = interactables[i];
    const clustered = usePocket && rng() < (specialRoomId === 'reward_pocket' ? 0.85 : 0.65);
    const p = clustered ? pocketSpot(rng, walls, pockets[i % pockets.length], 82, blockers) : freeSpot(rng, walls, 86, blockers);
    o.x = p.x; o.y = p.y; o.opened = false;
    blockers.push({ x: o.x, y: o.y, r: clustered ? 128 : 178 });
  }
  const late = Math.max(0, loopIndex - 2);
  let baseQuota = category === 'boss' ? 1 : Math.round((8 + roomInLoop * 2 + loopIndex * 5 + Math.floor(Math.pow(late, 1.65) * 7)) * 2);
  if (specialRoomId === 'signal_contract') baseQuota = Math.max(8, Math.round(baseQuota * 0.72));
  if (modifierIds.includes('hunter_contract')) baseQuota = Math.max(6, Math.round(baseQuota * 0.82));
  return {
    seed, runDepth, loopIndex, roomInLoop,
    roomId: `${specialRoomId ? specialRoomId : category}-${String(runDepth).padStart(2, '0')}`,
    category, baseCategory, specialRoomId, activityId, modifierIds,
    walls, interactables,
    quota: baseQuota,
    w: WORLD_W, h: WORLD_H
  };
}

export function portalSpot(seed, walls, interactables = []) {
  const rng = mulberry32((seed ^ 0x9E3779B9) >>> 0);
  const blockers = [
    { x: WORLD_W / 2, y: WORLD_H / 2, r: 360 },
    ...interactables.map(o => ({ x: o.x, y: o.y, r: 210 }))
  ];
  // favor any quadrant, but keep it readable and clear of walls/chests/player spawn.
  for (let tries = 0; tries < 140; tries++) {
    const p = freeSpot(rng, walls, 125, blockers);
    if (dist2ish(p.x, p.y, WORLD_W / 2, WORLD_H / 2) > 420 * 420) return p;
  }
  return freeSpot(rng, walls, 125, blockers);
}
function dist2ish(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }

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
