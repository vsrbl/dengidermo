// terminal casino roguelike room generation: walls, pillars, chests, BET terminals, spawns
import { ROOM_MODS, ROOM_SEQUENCE, SPECIAL_ROOMS } from './data.v2-1.js';

export const WORLD_W = 2200;
export const WORLD_H = 1500;
export const WALL_T = 40;       // gameplay safe border / portal offset
const EDGE_T = 900;             // huge outer walls: no visible field behind borders
const SAFE = 95;

const EXTRA_ROOM_ARCHETYPES = ['ripped_table', 'cross_terminal', 'ring_track', 'clamp_room', 'cashier_maze', 'machine_core'];
const ALL_ROOM_ARCHETYPES = ['panic_box','compact','standard','wide','long_lane','lounge','boss', ...EXTRA_ROOM_ARCHETYPES];


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

function clearOfCenter(x, y, w, h, rx = 360, ry = 320) {
  return !(Math.abs(x + w / 2 - WORLD_W / 2) < rx && Math.abs(y + h / 2 - WORLD_H / 2) < ry);
}

function addRandomBlock(rng, walls, x, y, w, h) {
  x = clamp(x, SAFE, WORLD_W - SAFE - w);
  y = clamp(y, SAFE, WORLD_H - SAFE - h);
  if (!clearOfCenter(x, y, w, h)) return;
  pushWall(walls, x, y, w, h);
}
function chooseRoomArchetype(rng, category, specialRoomId, modifierIds = [], loopIndex = 0, runDepth = 0) {
  if (category === 'boss') return 'boss';
  if (specialRoomId === 'chill_room') return 'lounge';
  if (modifierIds.includes('prism_grid') && rng() < 0.45) return rng() < 0.62 ? 'long_lane' : 'wide';
  if (modifierIds.includes('hunter_contract') && rng() < 0.55) return 'wide';
  if (modifierIds.includes('moving_room') && rng() < 0.45) return rng() < 0.55 ? 'wide' : 'standard';
  if ((modifierIds.includes('blood_tax') || modifierIds.includes('casino_virus')) && rng() < 0.45) return rng() < 0.55 ? 'compact' : 'panic_box';

  // v2.1.97: new sector shapes from the design notes.
  // Removed concepts are intentionally absent: double sector, pulsing square, split grid.
  const extraChance = Math.min(0.58, 0.18 + loopIndex * 0.055);
  if (rng() < extraChance) {
    const pool = [
      { id: 'ripped_table', w: 1.05 },
      { id: 'cross_terminal', w: 1.00 },
      { id: 'ring_track', w: 0.92 },
      { id: 'clamp_room', w: 0.78 },
      { id: 'machine_core', w: 0.90 }
    ];
    if (loopIndex >= 1) pool.push({ id: 'cashier_maze', w: 0.78 + Math.min(0.55, loopIndex * 0.065) });
    // Depth-rotated bias prevents the new sectors from feeling like the same
    // two templates happen to roll over and over on a run. RNG still picks, but
    // each depth nudges a different new archetype.
    const preferred = pool[Math.abs((Number(runDepth) || 0) + loopIndex * 3) % pool.length];
    if (preferred) preferred.w += 0.62;
    let total = pool.reduce((a, b) => a + b.w, 0);
    let r = rng() * total;
    for (const it of pool) { r -= it.w; if (r <= 0) return it.id; }
    return pool[0].id;
  }

  const roll = rng() + Math.min(0.12, loopIndex * 0.018);
  if (roll < 0.12) return 'panic_box';
  if (roll < 0.31) return 'compact';
  if (roll < 0.68) return 'standard';
  if (roll < 0.86) return 'wide';
  return 'long_lane';
}

function archetypeRect(archetype) {
  // Room archetype = base silhouette. These rectangles deliberately change the playable
  // footprint before any per-run cover is added. Extra archetypes should not all inherit
  // the default full WORLD_W/WORLD_H arena.
  const defs = {
    panic_box: { w: 1120, h: 760 },
    compact: { w: 1420, h: 960 },
    standard: { w: WORLD_W, h: WORLD_H },
    wide: { w: WORLD_W, h: WORLD_H },
    long_lane: { w: WORLD_W, h: 920 },
    lounge: { w: 1500, h: 920 },
    boss: { w: WORLD_W, h: WORLD_H },
    // v2.1.109: every new room has its own base size/footprint.
    ripped_table: { w: 1860, h: 1220 },
    cross_terminal: { w: 1960, h: 1320 },
    ring_track: { w: 2040, h: 1280 },
    clamp_room: { w: 1660, h: 1360 },
    cashier_maze: { w: WORLD_W, h: WORLD_H },
    machine_core: { w: 1780, h: 1220 }
  };
  const d = defs[archetype] || defs.standard;
  const left = Math.round((WORLD_W - d.w) / 2);
  const top = Math.round((WORLD_H - d.h) / 2);
  return { x: left, y: top, w: d.w, h: d.h, right: left + d.w, bottom: top + d.h };
}

function applyRoomArchetypeWalls(walls, archetype) {
  const r = archetypeRect(archetype);
  if (r.x > 0) pushWall(walls, -EDGE_T, -EDGE_T, r.x + EDGE_T, WORLD_H + EDGE_T * 2);
  if (r.right < WORLD_W) pushWall(walls, r.right, -EDGE_T, WORLD_W - r.right + EDGE_T, WORLD_H + EDGE_T * 2);
  if (r.y > 0) pushWall(walls, -EDGE_T, -EDGE_T, WORLD_W + EDGE_T * 2, r.y + EDGE_T);
  if (r.bottom < WORLD_H) pushWall(walls, -EDGE_T, r.bottom, WORLD_W + EDGE_T * 2, WORLD_H - r.bottom + EDGE_T);
}

function roomRect(archetype) { return archetypeRect(archetype); }
function addBaseVoid(walls, x, y, w, h) { pushWall(walls, x, y, w, h); }
function addBaseGateBlock(walls, x, y, w, h) { pushWall(walls, x, y, w, h); }

function mirrorExtraWalls(walls, mirrorX = false, mirrorY = false) {
  if (!mirrorX && !mirrorY) return;
  for (const w of walls) {
    if (mirrorX) w.x = Math.round(WORLD_W - (w.x + w.w));
    if (mirrorY) w.y = Math.round(WORLD_H - (w.y + w.h));
  }
  if (walls._portalHint) {
    if (mirrorX) walls._portalHint.x = Math.round(WORLD_W - walls._portalHint.x);
    if (mirrorY) walls._portalHint.y = Math.round(WORLD_H - walls._portalHint.y);
  }
}

function addProceduralRoomVariation(walls, archetype, rng) {
  if (!EXTRA_ROOM_ARCHETYPES.includes(archetype) || !rng) return;
  const r = roomRect(archetype);
  const count = archetype === 'cashier_maze' ? 1 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 3);
  const portal = walls._portalHint || null;
  const corridorBias = ['ring_track', 'cross_terminal'].includes(archetype);
  for (let i = 0; i < count; i++) {
    for (let tries = 0; tries < 24; tries++) {
      const wide = corridorBias ? rng() < 0.62 : rng() < 0.48;
      const w = wide ? 150 + rng() * 210 : 70 + rng() * 110;
      const h = wide ? 52 + rng() * 78 : 110 + rng() * 170;
      const x = r.x + 105 + rng() * Math.max(120, r.w - 210 - w);
      const y = r.y + 95 + rng() * Math.max(120, r.h - 190 - h);
      if (!clearOfCenter(x, y, w, h, 420, 330)) continue;
      if (portal && dist2ish(x + w / 2, y + h / 2, portal.x, portal.y) < 240 * 240) continue;
      if (blockedByWalls(x + w / 2, y + h / 2, walls, Math.max(w, h) * 0.55)) continue;
      pushWall(walls, x, y, w, h);
      break;
    }
  }
  // One more shape-level mutation: some rooms get a heavy side bite, so the same
  // archetype does not read as the same template every time.
  if (archetype !== 'cashier_maze' && rng() < 0.55) {
    const side = Math.floor(rng() * 4);
    const biteW = 170 + rng() * 220;
    const biteH = 140 + rng() * 230;
    if (side === 0) pushWall(walls, r.x + 160 + rng() * (r.w - biteW - 320), r.y, biteW, biteH);
    else if (side === 1) pushWall(walls, r.x + 160 + rng() * (r.w - biteW - 320), r.bottom - biteH, biteW, biteH);
    else if (side === 2) pushWall(walls, r.x, r.y + 130 + rng() * (r.h - biteH - 260), biteW, biteH);
    else pushWall(walls, r.right - biteW, r.y + 130 + rng() * (r.h - biteH - 260), biteW, biteH);
  }
  walls._variantTag = `${archetype}-${Math.floor(rng() * 9999)}`;
}

function finishArchetypeWalls(walls, archetype, rng = null) {
  if (EXTRA_ROOM_ARCHETYPES.includes(archetype) && rng) {
    mirrorExtraWalls(walls, rng() < 0.50, rng() < 0.34);
    addProceduralRoomVariation(walls, archetype, rng);
  }
  applyRoomArchetypeWalls(walls, archetype);
  return walls;
}

function addRippedTableWalls(walls, rng) {
  const r = roomRect('ripped_table');
  const cx = WORLD_W / 2, cy = WORLD_H / 2;
  const t = 168;
  // Base shape: two torn table halves linked by an S-shaped cashier cut.
  // These are structural base cuts, not decorative random walls.
  addBaseVoid(walls, r.x, r.y, 410, 340);
  addBaseVoid(walls, r.right - 410, r.bottom - 340, 410, 340);
  addBaseVoid(walls, r.x, r.bottom - 300, 300, 300);
  addBaseVoid(walls, r.right - 300, r.y, 300, 300);
  // Main tear: two thick shifted slabs leave a readable center seam.
  addBaseGateBlock(walls, cx - 92, r.y + 70, t, 385 + rng() * 35);
  addBaseGateBlock(walls, cx - 92, cy + 245 + rng() * 30, t, r.bottom - cy - 310);
  // The table halves are part of the base footprint: large mass, committed turns.
  addBaseGateBlock(walls, r.x + 260, r.y + 275, 520, 170);
  addBaseGateBlock(walls, r.right - 780, r.bottom - 445, 520, 170);
  addBaseGateBlock(walls, r.x + 390, r.bottom - 245, 410, 150);
  addBaseGateBlock(walls, r.right - 800, r.y + 95, 410, 150);
  // Small per-run identity only near the seam; not responsible for the room shape.
  if (rng() < 0.5) addBaseGateBlock(walls, cx - 520, cy + 95, 230, 132);
  else addBaseGateBlock(walls, cx + 290, cy - 230, 230, 132);
  walls._portalHint = rng() < 0.5 ? { x: r.x + 285, y: r.bottom - 205 } : { x: r.right - 285, y: r.y + 205 };
}

function addCrossTerminalWalls(walls, rng) {
  const r = roomRect('cross_terminal');
  const cx = WORLD_W / 2, cy = WORLD_H / 2;
  // Base shape: cross-room carved from a smaller rectangle by blocking off the corners.
  const cornerW = 650, cornerH = 430;
  addBaseVoid(walls, r.x, r.y, cornerW, cornerH);
  addBaseVoid(walls, r.right - cornerW, r.y, cornerW, cornerH);
  addBaseVoid(walls, r.x, r.bottom - cornerH, cornerW, cornerH);
  addBaseVoid(walls, r.right - cornerW, r.bottom - cornerH, cornerW, cornerH);
  // Thick terminal lips define the four arms without turning the center into a field.
  addBaseGateBlock(walls, cx - 420, r.y + 480, 300, 145);
  addBaseGateBlock(walls, cx + 120, r.bottom - 625, 300, 145);
  addBaseGateBlock(walls, r.x + 650, cy + 130, 145, 310);
  addBaseGateBlock(walls, r.right - 795, cy - 440, 145, 310);
  if (rng() < 0.5) addBaseGateBlock(walls, cx - 118, r.y + 150, 236, 136);
  else addBaseGateBlock(walls, cx - 118, r.bottom - 286, 236, 136);
  walls._portalHint = rng() < 0.5 ? { x: cx, y: r.y + 190 } : { x: cx, y: r.bottom - 190 };
}

function addRingTrackWalls(walls, rng) {
  const r = roomRect('ring_track');
  const cx = WORLD_W / 2, cy = WORLD_H / 2;
  const t = 150;
  // Base shape: oval-ish track with four chunky outside bites and a center hub.
  // The center remains playable for the fixed player spawn, while the room reads as lanes.
  addBaseVoid(walls, r.x, r.y, 420, 300);
  addBaseVoid(walls, r.right - 420, r.y, 420, 300);
  addBaseVoid(walls, r.x, r.bottom - 300, 420, 300);
  addBaseVoid(walls, r.right - 420, r.bottom - 300, 420, 300);
  // Inner rails are base dividers that form the track, not random cover.
  addBaseGateBlock(walls, cx - 475, cy - 330, 330, t);
  addBaseGateBlock(walls, cx + 145, cy - 330, 330, t);
  addBaseGateBlock(walls, cx - 475, cy + 180, 330, t);
  addBaseGateBlock(walls, cx + 145, cy + 180, 330, t);
  addBaseGateBlock(walls, cx - 535, cy - 190, t, 380);
  addBaseGateBlock(walls, cx + 385, cy - 190, t, 380);
  // Procedural gate nudges change which lap feels safer, without changing the base concept.
  if (rng() < 0.55) addBaseGateBlock(walls, cx - 75, r.y + 190, 150, 130);
  if (rng() < 0.55) addBaseGateBlock(walls, cx - 75, r.bottom - 320, 150, 130);
  walls._portalHint = rng() < 0.5 ? { x: r.x + 250, y: cy } : { x: r.right - 250, y: cy };
}

function addClampRoomWalls(walls, rng) {
  const r = roomRect('clamp_room');
  const cx = WORLD_W / 2, cy = WORLD_H / 2;
  const t = 188;
  // Base shape: a narrower vertical room with closing jaws. The room footprint itself is
  // reduced, then jaws define two compressed combat bands.
  addBaseVoid(walls, r.x, r.y, 250, 285);
  addBaseVoid(walls, r.right - 250, r.bottom - 285, 250, 285);
  addBaseGateBlock(walls, r.x + 95, r.y + 130, r.w - 190, t);
  addBaseGateBlock(walls, r.x + 95, r.bottom - 130 - t, r.w - 190, t);
  addBaseGateBlock(walls, r.x + 185, r.y + 385, t, 420);
  addBaseGateBlock(walls, r.right - 185 - t, r.bottom - 385 - 420, t, 420);
  addBaseGateBlock(walls, cx - 455, cy - 82, 285, 136);
  addBaseGateBlock(walls, cx + 170, cy - 54, 285, 136);
  if (rng() < 0.5) addBaseGateBlock(walls, r.x + 360, cy + 205, 260, 136);
  else addBaseGateBlock(walls, r.right - 620, cy - 340, 260, 136);
  walls._portalHint = rng() < 0.5 ? { x: r.x + 265, y: cy } : { x: r.right - 265, y: cy };
}

function addMachineCoreWalls(walls, rng) {
  const r = roomRect('machine_core');
  const cx = WORLD_W / 2, cy = WORLD_H / 2;
  const t = 158;
  // Base shape: compact square core with four cashier modules cut out of the corners.
  // The center is a hub, each side a deliberate service corridor.
  addBaseVoid(walls, r.x, r.y, 430, 300);
  addBaseVoid(walls, r.right - 430, r.y, 430, 300);
  addBaseVoid(walls, r.x, r.bottom - 300, 430, 300);
  addBaseVoid(walls, r.right - 430, r.bottom - 300, 430, 300);
  addBaseGateBlock(walls, cx - 445, cy - 350, 330, t);
  addBaseGateBlock(walls, cx + 115, cy - 350, 330, t);
  addBaseGateBlock(walls, cx - 445, cy + 192, 330, t);
  addBaseGateBlock(walls, cx + 115, cy + 192, 330, t);
  addBaseGateBlock(walls, cx - 79, r.y + 205, 158, 285);
  addBaseGateBlock(walls, cx - 79, r.bottom - 490, 158, 285);
  if (rng() < 0.60) addBaseGateBlock(walls, r.x + 560, cy - 255, 255, 128);
  if (rng() < 0.60) addBaseGateBlock(walls, r.right - 815, cy + 127, 255, 128);
  walls._portalHint = rng() < 0.5 ? { x: r.x + 285, y: cy } : { x: r.right - 285, y: cy };
}

function farthestMazeCell(cells, startIndex, cols = 1) {
  const q = [startIndex];
  const dist = new Map([[startIndex, 0]]);
  const sc = startIndex % cols, sr = Math.floor(startIndex / cols);
  let best = startIndex, bestScore = -Infinity;
  while (q.length) {
    const i = q.shift();
    const d = dist.get(i) || 0;
    const c = i % cols, r = Math.floor(i / cols);
    const geo = Math.hypot(c - sc, r - sr);
    const rowCount = Math.floor(cells.length / cols);
    const degree = cells[i].links.length;
    const edge = (c === 0 || r === 0 || c === cols - 1 || r === rowCount - 1);
    const farEnough = geo >= Math.max(2.75, cols * 0.34);
    const deadEndBonus = degree <= 1 ? 520 : 0;
    const edgeBonus = edge ? 360 : -240;
    const score = (farEnough ? 0 : -2000) + geo * 520 + d * 140 + deadEndBonus + edgeBonus;
    if (score > bestScore) { bestScore = score; best = i; }
    for (const n of cells[i].links) {
      if (!dist.has(n)) { dist.set(n, d + 1); q.push(n); }
    }
  }
  return best;
}

function pushMergedRuns(walls, runs, vertical, thick, marginX, marginY, cellW, cellH) {
  for (const run of runs) {
    if (vertical) {
      const x = marginX + (run.c + 1) * cellW - thick / 2;
      const y = marginY + run.r0 * cellH - thick / 2;
      const h = (run.r1 - run.r0 + 1) * cellH + thick;
      pushWall(walls, x, y, thick, h);
    } else {
      const x = marginX + run.c0 * cellW - thick / 2;
      const y = marginY + (run.r + 1) * cellH - thick / 2;
      const w = (run.c1 - run.c0 + 1) * cellW + thick;
      pushWall(walls, x, y, w, thick);
    }
  }
}

function addCashierMazeWalls(walls, rng) {
  // v2.1.109: room type is the base here: a very wide, blackout cashier bunker.
  // Thick merged cell walls are the primary footprint; there is no open arena under it.
  const cols = 8, rows = 4;
  const marginX = 36, marginY = 40;
  const cellW = (WORLD_W - marginX * 2) / cols;
  const cellH = (WORLD_H - marginY * 2) / rows;
  const thick = 178; // intentionally too thick to dash-hop through.
  const idx = (c, r) => r * cols + c;
  const cells = Array.from({ length: cols * rows }, (_, i) => ({ i, links: [] }));
  const visited = new Set();
  const startC = 3, startR = 1; // center lobby spans 3/4 x 1/2, covering all player spawns.
  const stack = [idx(startC, startR)];
  visited.add(stack[0]);
  const vWalls = Array.from({ length: rows }, () => Array(cols - 1).fill(true));
  const hWalls = Array.from({ length: rows - 1 }, () => Array(cols).fill(true));
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const c = cur % cols, r = Math.floor(cur / cols);
    const options = [];
    // Strong horizontal bias: this maze should feel wide and long, not like a small grid room.
    if (c > 0 && !visited.has(idx(c - 1, r))) options.push([c - 1, r], [c - 1, r], [c - 1, r]);
    if (c < cols - 1 && !visited.has(idx(c + 1, r))) options.push([c + 1, r], [c + 1, r], [c + 1, r]);
    if (r > 0 && !visited.has(idx(c, r - 1))) options.push([c, r - 1]);
    if (r < rows - 1 && !visited.has(idx(c, r + 1))) options.push([c, r + 1]);
    if (!options.length) { stack.pop(); continue; }
    const [nc, nr] = options[Math.floor(rng() * options.length)];
    const ni = idx(nc, nr);
    if (nc !== c) vWalls[r][Math.min(c, nc)] = false;
    if (nr !== r) hWalls[Math.min(r, nr)][c] = false;
    cells[cur].links.push(ni); cells[ni].links.push(cur);
    visited.add(ni); stack.push(ni);
  }

  // Central spawn lobby is a tiny junction, not a wide field. Open only the four spawn cells.
  const lobby = [[3, 1], [4, 1], [3, 2], [4, 2]];
  for (const [c, r] of lobby) {
    if (c >= 0 && c < cols - 1 && r >= 0 && r < rows) vWalls[r][c] = false;
    if (c - 1 >= 0 && c - 1 < cols - 1 && r >= 0 && r < rows) vWalls[r][c - 1] = false;
    if (r >= 0 && r < rows - 1 && c >= 0 && c < cols) hWalls[r][c] = false;
    if (r - 1 >= 0 && r - 1 < rows - 1 && c >= 0 && c < cols) hWalls[r - 1][c] = false;
  }

  const vRuns = [];
  for (let c = 0; c < cols - 1; c++) {
    let r = 0;
    while (r < rows) {
      if (!vWalls[r][c]) { r++; continue; }
      const r0 = r;
      while (r + 1 < rows && vWalls[r + 1][c]) r++;
      vRuns.push({ c, r0, r1: r });
      r++;
    }
  }
  const hRuns = [];
  for (let r = 0; r < rows - 1; r++) {
    let c = 0;
    while (c < cols) {
      if (!hWalls[r][c]) { c++; continue; }
      const c0 = c;
      while (c + 1 < cols && hWalls[r][c + 1]) c++;
      hRuns.push({ r, c0, c1: c });
      c++;
    }
  }
  pushMergedRuns(walls, vRuns, true, thick, marginX, marginY, cellW, cellH);
  pushMergedRuns(walls, hRuns, false, thick, marginX, marginY, cellW, cellH);

  // A single seamless bunker rim: it is part of the room base, not procedural cover.
  pushWall(walls, marginX - thick / 2, marginY - thick / 2, WORLD_W - marginX * 2 + thick, thick);
  pushWall(walls, marginX - thick / 2, WORLD_H - marginY - thick / 2, WORLD_W - marginX * 2 + thick, thick);
  pushWall(walls, marginX - thick / 2, marginY - thick / 2, thick, WORLD_H - marginY * 2 + thick);
  pushWall(walls, WORLD_W - marginX - thick / 2, marginY - thick / 2, thick, WORLD_H - marginY * 2 + thick);

  const exit = farthestMazeCell(cells, idx(startC, startR), cols);
  const ec = exit % cols, er = Math.floor(exit / cols);
  const safeX = clamp(marginX + ec * cellW + cellW / 2, marginX + thick / 2 + 140, WORLD_W - marginX - thick / 2 - 140);
  const safeY = clamp(marginY + er * cellH + cellH / 2, marginY + thick / 2 + 140, WORLD_H - marginY - thick / 2 - 140);
  walls._portalHint = {
    x: Math.round(safeX),
    y: Math.round(safeY),
    cashierMaze: 1,
    darkMaze: 1
  };
}

// Layout variants: cover and identity, still no true mazes before pathfinding.
function genWalls(rng, category, loopIndex, archetype = 'standard') {
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

  if (archetype === 'ripped_table') { addRippedTableWalls(walls, rng); return finishArchetypeWalls(walls, archetype, rng); }
  if (archetype === 'cross_terminal') { addCrossTerminalWalls(walls, rng); return finishArchetypeWalls(walls, archetype, rng); }
  if (archetype === 'ring_track') { addRingTrackWalls(walls, rng); return finishArchetypeWalls(walls, archetype, rng); }
  if (archetype === 'clamp_room') { addClampRoomWalls(walls, rng); return finishArchetypeWalls(walls, archetype, rng); }
  if (archetype === 'cashier_maze') { addCashierMazeWalls(walls, rng); return finishArchetypeWalls(walls, archetype, rng); }
  if (archetype === 'machine_core') { addMachineCoreWalls(walls, rng); return finishArchetypeWalls(walls, archetype, rng); }

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
  applyRoomArchetypeWalls(walls, archetype);
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
  for (let tries = 0; tries < 190; tries++) {
    const x = SAFE + margin + rng() * (WORLD_W - (SAFE + margin) * 2);
    const y = SAFE + margin + rng() * (WORLD_H - (SAFE + margin) * 2);
    if (!blockedByWalls(x, y, walls, Math.max(80, margin)) && !blockedByObjects(x, y, blockers)) return { x: Math.round(x), y: Math.round(y) };
  }
  const cols = 11, rows = 7;
  const candidates = [];
  for (let iy = 0; iy < rows; iy++) {
    for (let ix = 0; ix < cols; ix++) {
      const x = SAFE + margin + (ix + 0.5) * ((WORLD_W - (SAFE + margin) * 2) / cols);
      const y = SAFE + margin + (iy + 0.5) * ((WORLD_H - (SAFE + margin) * 2) / rows);
      candidates.push({ x, y, d: Math.hypot(x - WORLD_W / 2, y - WORLD_H / 2) + rng() * 40 });
    }
  }
  candidates.sort((a, b) => b.d - a.d);
  for (const c of candidates) {
    if (!blockedByWalls(c.x, c.y, walls, Math.max(80, margin)) && !blockedByObjects(c.x, c.y, blockers)) return { x: Math.round(c.x), y: Math.round(c.y) };
  }
  return { x: WORLD_W / 2 + Math.round((rng() - 0.5) * 260), y: WORLD_H / 2 + Math.round((rng() - 0.5) * 200) };
}

function pocketSpot(rng, walls, center, margin, blockers) {
  for (let tries = 0; tries < 50; tries++) {
    const a = rng() * Math.PI * 2;
    const r = 95 + rng() * 220;
    const x = clamp(center.x + Math.cos(a) * r, SAFE + margin, WORLD_W - SAFE - margin);
    const y = clamp(center.y + Math.sin(a) * r, SAFE + margin, WORLD_H - SAFE - margin);
    if (!blockedByWalls(x, y, walls, Math.max(80, margin)) && !blockedByObjects(x, y, blockers)) return { x: Math.round(x), y: Math.round(y) };
  }
  return freeSpot(rng, walls, margin, blockers);
}

// chest/interactable budget: more texture — empty rooms, pockets, strange clusters, late greed.
// v2.1.69: chests now roll a real rarity and slot count at room generation time.
// This keeps cost/hover/opening stable: no re-rolling when the player inspects or opens it.
function chestRarityProfile(rng, chest, loopIndex = 0, greed = false, modIds = [], specialRoomId = '', mood = 0.5) {
  const paidChoice = chest === 'weapon_chest' || chest === 'ability_chest';
  const rareBase = chest === 'rare_chest';
  const cursed = chest === 'cursed_chest';
  if (chest === 'basic_chest') return { chestTier: 0, slotCount: 0, costMul: 1, rarityReason: 'BASIC' };

  let score = rng();
  score += Math.min(0.28, loopIndex * 0.035);
  if (rareBase) score += 0.42;
  if (cursed) score += 0.52;
  if (greed) score += 0.16;
  if (specialRoomId === 'reward_pocket') score += 0.42;
  if (specialRoomId === 'signal_contract') score += 0.14;
  if (specialRoomId === 'chill_room') score += 0.34;
  if (modIds.includes('casino_virus')) score += 0.16;
  if (modIds.includes('blood_tax')) score += 0.10;
  if (modIds.includes('static_rain')) score += 0.08;
  if (modIds.includes('hunter_contract')) score += 0.06;
  if (mood > 0.86) score += 0.10;

  let chestTier = 0;
  if (score >= 1.02) chestTier = 3;
  else if (score >= 0.76) chestTier = 2;
  else if (score >= 0.46) chestTier = 1;
  if (rareBase) chestTier = Math.max(chestTier, 2);
  if (cursed) chestTier = Math.max(chestTier, 2);

  let slotCount = 0;
  if (paidChoice) {
    if (chestTier >= 3) slotCount = 5;
    else if (chestTier === 2) slotCount = rng() < 0.70 ? 3 : 2;
    // Simple/good paid chests must stay compact: never more than two choices.
    // The big 5-slot / double-pick rule is reserved for the most valuable tier only.
    else if (chestTier === 1) slotCount = rng() < 0.72 ? 2 : 1;
    else slotCount = rng() < 0.62 ? 1 : 2;
  }

  // Cost is calculated in sim from tier + slotCount. Keep costMul as a small profile override only.
  const costMul = 1;
  const reasons = [];
  if (rareBase) reasons.push('RARE TYPE');
  if (cursed) reasons.push('CURSED');
  if (specialRoomId === 'reward_pocket') reasons.push('REWARD POCKET');
  if (specialRoomId === 'signal_contract') reasons.push('CONTRACT');
  if (specialRoomId === 'chill_room') reasons.push('CHILL ROOM');
  if (greed) reasons.push('GOLD FEVER');
  if (modIds.includes('casino_virus')) reasons.push('CASINO VIRUS');
  if (modIds.includes('blood_tax')) reasons.push('BLOOD PAYMENT');
  if (modIds.includes('static_rain')) reasons.push('STATIC STORM');
  if (loopIndex >= 3) reasons.push(`LOOP ${loopIndex + 1}`);
  return { chestTier, slotCount, costMul, rarityReason: reasons.slice(0, 3).join(' + ') || '' };
}
function makeChestObj(id, rng, chest, loopIndex, greed, modIds, specialRoomId, mood, extra = {}) {
  return { id, type: 'chest', chest, ...chestRarityProfile(rng, chest, loopIndex, greed, modIds, specialRoomId, mood), ...extra };
}
function genInteractables(rng, category, loopIndex, greed, modIds = [], specialRoomId = '') {
  const objs = [];
  let id = 1;
  if (category === 'boss') return objs; // boss room: reward spawns after kill

  const mood = rng(); // each room gets a loot personality, not just smooth density
  const debtFloor = false;
  const contract = specialRoomId === 'signal_contract';
  const rewardPocket = specialRoomId === 'reward_pocket';
  const chillRoom = specialRoomId === 'chill_room';
  if (chillRoom) {
    objs.push({ id: `b${id++}`, type: 'bet' });
    objs.push({ id: `b${id++}`, type: 'bet' });
    objs.push(makeChestObj(`c${id++}`, rng, 'weapon_chest', loopIndex, greed, modIds, specialRoomId, mood, { chestTier: 2, slotCount: 3, costMul: 1.42, rarityReason: 'CHILL ROOM' }));
    objs.push(makeChestObj(`c${id++}`, rng, 'ability_chest', loopIndex, greed, modIds, specialRoomId, mood, { chestTier: 2, slotCount: 3, costMul: 1.42, rarityReason: 'CHILL ROOM' }));
    objs.push(makeChestObj(`c${id++}`, rng, 'weapon_chest', loopIndex, greed, modIds, specialRoomId, mood, { chestTier: 3, slotCount: 5, costMul: 2.15, rarityReason: 'CHILL ROOM + RARE' }));
    objs.push(makeChestObj(`c${id++}`, rng, 'ability_chest', loopIndex, greed, modIds, specialRoomId, mood, { chestTier: 3, slotCount: 5, costMul: 2.15, rarityReason: 'CHILL ROOM + RARE' }));
    if (loopIndex >= 3) objs.push(makeChestObj(`c${id++}`, rng, 'rare_chest', loopIndex, greed, modIds, specialRoomId, mood, { chestTier: 3, costMul: 2.05, rarityReason: 'CHILL ROOM + LOOP' }));
    return objs;
  }
  const density = rng() * 1.35 + loopIndex * 0.055 + (greed ? 0.28 : 0) + (debtFloor ? 0.45 : 0) + (rewardPocket ? 0.6 : 0);
  let bscCount = density < 0.16 ? 0 : density < 0.62 ? 1 : density < 1.04 ? 2 : 3 + Math.floor(rng() * 2);
  let paidCount = density < 0.28 ? 0 : density < 0.75 ? 1 : density < 1.14 ? 2 : 3 + Math.floor(rng() * 2);
  if (mood < 0.12) { bscCount = 0; paidCount = rng() < 0.55 ? 0 : 1; }           // dead/quiet room
  else if (mood > 0.86) { bscCount += 1 + Math.floor(rng() * 2); paidCount += 1; } // greedy pocket
  for (let i = 0; i < bscCount; i++) objs.push(makeChestObj(`c${id++}`, rng, 'basic_chest', loopIndex, greed, modIds, specialRoomId, mood));

  for (let i = 0; i < paidCount; i++) {
    const roll = rng();
    const chest = roll < 0.34 ? 'weapon_chest' : roll < 0.68 ? 'ability_chest' : 'rare_chest';
    objs.push(makeChestObj(`c${id++}`, rng, chest, loopIndex, greed, modIds, specialRoomId, mood));
  }
  if (rng() < 0.13 + loopIndex * 0.045 + (greed ? 0.08 : 0) + (debtFloor ? 0.14 : 0)) objs.push(makeChestObj(`c${id++}`, rng, 'cursed_chest', loopIndex, greed, modIds, specialRoomId, mood));
  if (rng() < 0.48 + loopIndex * 0.05 + (mood > 0.75 ? 0.18 : 0) + (contract ? 0.28 : 0)) objs.push({ id: `b${id++}`, type: 'bet' });
  if (contract) objs.push(makeChestObj(`c${id++}`, rng, rng() < 0.5 ? 'rare_chest' : 'ability_chest', loopIndex, greed, modIds, specialRoomId, mood, { rarityReason: 'CONTRACT' }));
  return objs;
}

export function generateRoom(seed, runDepth, loopIndex, override = null) {
  const rng = mulberry32(seed);
  const roomInLoop = runDepth % ROOM_SEQUENCE.length;
  const forced = (override && typeof override === 'object') ? override : null;
  const forcedCategory = forced?.category && (ROOM_SEQUENCE.includes(forced.category) || forced.category === 'chill') ? String(forced.category) : '';
  const baseCategory = forcedCategory && forcedCategory !== 'chill' ? forcedCategory : ROOM_SEQUENCE[roomInLoop];
  let category = forcedCategory || baseCategory;
  let specialRoomId = forced?.specialRoomId && SPECIAL_ROOMS[forced.specialRoomId] ? String(forced.specialRoomId) : '';
  let activityId = specialRoomId;


  // Route replacement rules: non-boss rooms can become special/directive rooms.
  if (!forced && category !== 'boss' && loopIndex >= 1) {
    const specialChance = Math.min(0.34, 0.10 + loopIndex * 0.035);
    if (rng() < specialChance) {
      const specials = Object.keys(SPECIAL_ROOMS);
      specialRoomId = specials[Math.floor(rng() * specials.length)];
      activityId = specialRoomId;
    }
  }

  const forcedMods = Array.isArray(forced?.modifierIds)
    ? [...new Set(forced.modifierIds.map(String).filter(id => ROOM_MODS[id]))].slice(0, 4)
    : null;
  const modifierIds = forcedMods ? [...forcedMods] : [];
  if (!forcedMods && loopIndex >= 1 && category !== 'boss' && specialRoomId !== 'chill_room') {
    const modChance = Math.min(0.82, 0.20 + loopIndex * 0.085 + (specialRoomId ? 0.18 : 0));
    if (rng() < modChance) {
      const keys = Object.keys(ROOM_MODS).filter(k => k !== 'skin_cache' && k !== 'anchor_gravity');
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
  if (forcedCategory === 'chill' && !specialRoomId) specialRoomId = 'chill_room';
  if (specialRoomId === 'chill_room') {
    category = 'chill';
  }
  if (!forcedMods && specialRoomId === 'signal_contract') {
    const contractMods = ['greed', 'static_rain', 'hunter_contract', 'casino_virus', 'moving_room', 'prism_grid', 'blood_tax', 'echo_walls'];
    const picked = contractMods[Math.floor(rng() * contractMods.length)];
    if (!modifierIds.includes(picked)) modifierIds.push(picked);
  } else if (!forcedMods && specialRoomId === 'debt_node') {
    if (!modifierIds.includes('static_rain')) modifierIds.push('static_rain');
  } else if (!forcedMods && specialRoomId === 'reward_pocket') {
    if (!modifierIds.includes('greed') && rng() < 0.55) modifierIds.push('greed');
  }

  const greed = modifierIds.includes('greed');
  let forcedArchetype = forced?.archetype && ALL_ROOM_ARCHETYPES.includes(forced.archetype) ? String(forced.archetype) : '';
  if (!forcedArchetype && modifierIds.includes('hunter_contract')) forcedArchetype = 'wide';
  const roomArchetype = forcedArchetype || chooseRoomArchetype(rng, category, specialRoomId, modifierIds, loopIndex, runDepth);
  if (roomArchetype === 'cashier_maze') {
    const withoutBlackout = modifierIds.filter(m => m !== 'blackout');
    modifierIds.length = 0;
    modifierIds.push('blackout', ...withoutBlackout);
  }
  const walls = genWalls(rng, category, loopIndex, roomArchetype);
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
  if (specialRoomId === 'chill_room') baseQuota = 0;
  if (specialRoomId === 'signal_contract') baseQuota = Math.max(8, Math.round(baseQuota * 0.72));
  if (modifierIds.includes('hunter_contract')) baseQuota = 999999;
  // v2.1: Casino Virus still uses normal director pressure while the 3 reels are pending.
  // Keep it slightly under a clean room, but no longer starve the encounter into an empty timer.
  if (modifierIds.includes('casino_virus')) baseQuota = Math.max(10, Math.round(baseQuota * 0.95));
  if (roomArchetype === 'cashier_maze') baseQuota = Math.max(16, Math.round(baseQuota * 2));
  return {
    seed, runDepth, loopIndex, roomInLoop,
    roomId: `${forced ? 'dev_' : ''}${specialRoomId ? specialRoomId : category}-${String(runDepth).padStart(2, '0')}`,
    category, baseCategory, specialRoomId, activityId, modifierIds, roomArchetype,
    walls, interactables,
    quota: baseQuota,
    w: WORLD_W, h: WORLD_H
  };
}

export function portalSpot(seed, walls, interactables = []) {
  if (walls?._portalHint && !blockedByWalls(walls._portalHint.x, walls._portalHint.y, walls, 110)) return { x: walls._portalHint.x, y: walls._portalHint.y };
  const rng = mulberry32((seed ^ 0x9E3779B9) >>> 0);
  const blockers = [
    { x: WORLD_W / 2, y: WORLD_H / 2, r: 360 },
    ...interactables.map(o => ({ x: o.x, y: o.y, r: 210 }))
  ];
  const minD2 = 420 * 420;
  // First try random far spots with generous clearance.
  for (const margin of [125, 105, 85, 65]) {
    for (let tries = 0; tries < 180; tries++) {
      const x = SAFE + margin + rng() * (WORLD_W - (SAFE + margin) * 2);
      const y = SAFE + margin + rng() * (WORLD_H - (SAFE + margin) * 2);
      if (dist2ish(x, y, WORLD_W / 2, WORLD_H / 2) <= minD2) continue;
      if (!blockedByWalls(x, y, walls, Math.max(80, margin)) && !blockedByObjects(x, y, blockers)) return { x: Math.round(x), y: Math.round(y) };
    }
    // Then grid scan sorted from farthest to center. This prevents fallback portals inside
    // structural base walls in tight new room shapes.
    const candidates = [];
    const cols = 15, rows = 10;
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const x = SAFE + margin + (ix + 0.5) * ((WORLD_W - (SAFE + margin) * 2) / cols);
        const y = SAFE + margin + (iy + 0.5) * ((WORLD_H - (SAFE + margin) * 2) / rows);
        candidates.push({ x, y, d: dist2ish(x, y, WORLD_W / 2, WORLD_H / 2) + rng() * 20 });
      }
    }
    candidates.sort((a, b) => b.d - a.d);
    for (const c of candidates) {
      if (c.d < minD2) continue;
      if (!blockedByWalls(c.x, c.y, walls, Math.max(80, margin)) && !blockedByObjects(c.x, c.y, blockers)) return { x: Math.round(c.x), y: Math.round(c.y) };
    }
  }
  // Last resort: favor room geometry over object spacing, but still never place inside walls.
  const last = [];
  for (let iy = 0; iy < 9; iy++) {
    for (let ix = 0; ix < 13; ix++) {
      const x = SAFE + 80 + (ix + 0.5) * ((WORLD_W - (SAFE + 80) * 2) / 13);
      const y = SAFE + 80 + (iy + 0.5) * ((WORLD_H - (SAFE + 80) * 2) / 9);
      last.push({ x, y, d: dist2ish(x, y, WORLD_W / 2, WORLD_H / 2) + rng() * 30 });
    }
  }
  last.sort((a, b) => b.d - a.d);
  for (const c of last) {
    if (!blockedByWalls(c.x, c.y, walls, 80)) return { x: Math.round(c.x), y: Math.round(c.y) };
  }
  return { x: WORLD_W / 2, y: WORLD_H / 2 };
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
