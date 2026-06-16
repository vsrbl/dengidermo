// nncckkrr server simulation — single source of truth, no client authority
import {
  WEAPONS, WEAPON_ORDER, ENEMIES, SPAWN_POOLS, UPGRADES, CHESTS,
  WEAPON_CHEST_REWARDS, ABILITY_CHEST_REWARDS, HERO_UPGRADES, ACTIVE_CORES, ACTIVE_MUTATIONS, ACTIVE_MUTATION_SLOTS,
  rollUpgradeChoices, defaultStats, spinCasino, rollRoomSkin, UPGRADE_LABELS
} from './data.v2-0-28.js';
import { generateRoom, spawnPoint, enemySpawnPoint, portalSpot, mulberry32, WALL_T } from './mapgen.v2-0-28.js';

const PLAYER_SIZE = 28;
const PLAYER_SPEED = 260;
const PLAYER_HP = 100;
const DASH_DIST = 175;
const DASH_REGEN = 2.5;
const DASH_INVULN = 0.3;
const PICKUP_BASE_MAGNET = 95;
const PICKUP_COLLECT = 30;
const TOUCH_CD = 0.6;
const PLAYER_HIT_INVULN = 0.12;
const DIFFICULTY_MULT = 2; // requested harder pass: roughly 2x pressure versus v2.0.2
const MAX_ENEMIES = 60;
const MAX_BULLETS = 220;
const MAX_PICKUPS = 90;
const INTERACT_DIST = 95;
const OFFER_TIMEOUT = 15;

export const ENEMY_KINDS = Object.keys(ENEMIES); // index -> kind
const KIND_IDX = Object.fromEntries(ENEMY_KINDS.map((k, i) => [k, i]));

let nextId = 1;
const nid = () => (nextId++).toString(36);

// ---------------------------------------------------------------- helpers
function aabbHit(x, y, half, w) {
  return x + half > w.x && x - half < w.x + w.w && y + half > w.y && y - half < w.y + w.h;
}
function collideWalls(x, y, half, walls, ox, oy) {
  // axis-separated slide
  let nx = x, ny = y;
  for (const w of walls) {
    if (aabbHit(nx, oy, half, w)) {
      nx = nx > w.x + w.w / 2 ? w.x + w.w + half : w.x - half;
    }
  }
  for (const w of walls) {
    if (aabbHit(nx, ny, half, w)) {
      ny = ny > w.y + w.h / 2 ? w.y + w.h + half : w.y - half;
    }
  }
  return { x: nx, y: ny };
}
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function norm(dx, dy) { const d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; }

function rotateVec(v, a) {
  const c = Math.cos(a), si = Math.sin(a);
  return { x: v.x * c - v.y * si, y: v.x * si + v.y * c };
}
function wallPenalty(x, y, half, walls) {
  let penalty = 0;
  for (const w of walls) if (aabbHit(x, y, half, w)) penalty += 1;
  return penalty;
}
function enemySpeed(e) {
  let mul = 1;
  if (e.rallyT > 0) mul *= 1.24;
  if (e.anchorT > 0) mul *= 0.94;
  if (e.leechLinkT > 0) mul *= 0.96;
  if (e.activeSlowT > 0) mul *= (e.activeSlowMul || 0.55);
  return e.spd * mul;
}
function enemyDamageValue(e, mul = 1) {
  let m = mul;
  if (e.rallyT > 0) m *= 1.14;
  if (e.anchorT > 0) m *= 1.08;
  return Math.max(1, Math.round(e.dmg * m));
}
function enemyBulletSpeed(base, e) {
  let m = 1;
  if (e.rallyT > 0) m *= 1.12;
  if (e.anchorT > 0) m *= 1.08;
  return base * m;
}
function enemyFireCooldown(base, e) {
  let m = 1;
  if (e.rallyT > 0) m *= 1.16;
  if (e.anchorT > 0) m *= 1.08;
  return Math.max(0.28, base / m);
}

const PLAIN_ARMOR_KINDS = new Set(['tank','charger','bouncer','shooter','splitter','prism','pulse','anchor','leech','herald','warden','boss']);
const LINKED_ARMOR_KINDS = new Set(['tank','charger','bouncer','shooter','splitter','prism','pulse','anchor','leech','herald','warden']);
const ARMOR_CLASS_BIAS = {
  tank: 0.16, anchor: 0.14, herald: 0.17, warden: 1.0,
  charger: 0.05, bouncer: 0.05, shooter: 0.04, splitter: 0.06,
  prism: 0.07, pulse: 0.07, leech: 0.08
};
function hasShellArmor(e) {
  return !!(e && ((e.shellMax || 0) > 0 || (e.shellHp || 0) > 0 || e.shellType));
}
function shellChance(run, kind, def, elite, type) {
  const df = difficulty(run);
  if (def?.boss) return type === 'plain' ? 1 : 0;
  if (kind === 'warden' || def?.armorWarden) return type === 'linked' ? 1 : 0;
  const bias = ARMOR_CLASS_BIAS[kind] || 0;
  if (type === 'linked') {
    if (df.loop <= 0) return 0;
    return Math.min(0.34, Math.max(0, -0.09 + df.loop * 0.035 + df.late * 0.06 + run.runDepth * 0.006 + bias * 0.45 + (elite ? 0.08 : 0)));
  }
  if (run.runDepth < 2 && !elite) return 0;
  return Math.min(0.62, Math.max(0, -0.03 + df.loop * 0.055 + df.late * 0.07 + run.runDepth * 0.008 + bias + (def?.armor ? 0.10 : 0) + (elite ? 0.14 : 0)));
}
function shellMaxForArmor(run, def, e, type) {
  const df = difficulty(run);
  let mul = type === 'linked' ? 0.40 : 0.28;
  if (def?.boss) mul = 0.34;
  if (def?.armorWarden) mul = def.shellMul ?? 0.52;
  if (def?.armor && !def?.boss) mul += 0.08;
  if (e.elite) mul += 0.08;
  mul *= 1 + df.loop * 0.055 + df.late * 0.10;
  return Math.max(type === 'linked' ? 18 : 12, Math.round(e.maxHp * mul));
}
function rollShellArmor(run, kind, def, e, elite) {
  if (def?.boss) return { type: 'plain', max: shellMaxForArmor(run, def, e, 'plain'), source: 'boss' };
  if (kind === 'warden' || def?.armorWarden) return { type: 'linked', max: shellMaxForArmor(run, def, e, 'linked'), source: 'native' };
  const canLinked = LINKED_ARMOR_KINDS.has(kind);
  const canPlain = PLAIN_ARMOR_KINDS.has(kind);
  if (!canLinked && !canPlain) return null;
  const linkedChance = canLinked ? shellChance(run, kind, def, elite, 'linked') : 0;
  const plainChance = canPlain ? shellChance(run, kind, def, elite, 'plain') : 0;
  const r = Math.random();
  if (r < linkedChance) return { type: 'linked', max: shellMaxForArmor(run, def, e, 'linked'), source: 'roll' };
  if (r < linkedChance + plainChance) return { type: 'plain', max: shellMaxForArmor(run, def, e, 'plain'), source: 'roll' };
  return null;
}
function isLinkableShellBattery(e) {
  if (!e || e.hp <= 0) return false;
  const def = ENEMIES[e.kind] || {};
  // Battery targets must be genuinely unarmored. Never link to another shell carrier,
  // another linked-armor carrier, boss, or already broken armored mob; otherwise chains can become unfair.
  if (def.boss || e.kind === 'warden' || def.armorWarden) return false;
  if (hasShellArmor(e)) return false;
  return true;
}
function steerMove(run, e, dir, speedValue, dt, opts = {}) {
  const walls = run.plan?.walls || [];
  const half = e.size / 2;
  const base = norm(dir.x || 0, dir.y || 0);
  const amount = Math.max(0, speedValue * dt);
  if (!amount) return { x: e.x, y: e.y, moved: 0, blocked: false };
  const target = opts.target || null;
  const sideBias = e.steerSide || ((parseInt(e.id, 36) || 1) % 2 ? 1 : -1);
  const directLook = Math.max(half + 18, Math.min(95, amount * 7 + half));
  const directBlocked = wallPenalty(e.x + base.x * directLook, e.y + base.y * directLook, half, walls) > 0;
  const angles = directBlocked
    ? [0, 0.42 * sideBias, -0.42 * sideBias, 0.82 * sideBias, -0.82 * sideBias, 1.22 * sideBias, -1.22 * sideBias, 1.58 * sideBias, -1.58 * sideBias, Math.PI]
    : [0, 0.25 * sideBias, -0.25 * sideBias, 0.55 * sideBias, -0.55 * sideBias];
  let best = null;
  for (const a of angles) {
    const v = rotateVec(base, a);
    const ox = e.x, oy = e.y;
    const nx0 = ox + v.x * amount;
    const ny0 = oy + v.y * amount;
    const c = collideWalls(nx0, ny0, half, walls, ox, oy);
    const moved = Math.hypot(c.x - ox, c.y - oy);
    const lookPenalty = wallPenalty(ox + v.x * directLook, oy + v.y * directLook, half, walls);
    let score = moved * 1.3 - lookPenalty * 95 - Math.abs(a) * 8;
    if (target) score -= Math.hypot(target.x - c.x, target.y - c.y) * 0.035;
    if (a * sideBias > 0) score += 2.5;
    if (!best || score > best.score) best = { x: c.x, y: c.y, moved, score, angle: a, blocked: lookPenalty > 0 || moved < amount * 0.35 };
  }
  if (!best) return { x: e.x, y: e.y, moved: 0, blocked: true };
  const prevX = e.x, prevY = e.y;
  e.x = best.x; e.y = best.y;
  if (best.moved < amount * 0.25 || best.blocked) e.stuckT = (e.stuckT || 0) + dt;
  else e.stuckT = Math.max(0, (e.stuckT || 0) - dt * 2);
  if ((e.stuckT || 0) > 0.45) {
    e.steerSide = -(e.steerSide || sideBias);
    e.stuckT = 0.12;
    run.fx.push({ t: 'path_turn', id: e.id, x: Math.round(e.x), y: Math.round(e.y) });
  }
  return { x: e.x, y: e.y, moved: Math.hypot(e.x - prevX, e.y - prevY), blocked: best.blocked };
}
function resolveEnemyCrowd(run, walls, dt) {
  const arr = run.enemies;
  const n = arr.length;
  const maxPairs = n > 42 ? 3 : 5;
  for (let pass = 0; pass < maxPairs; pass++) {
    for (let i = 0; i < n; i++) {
      const a = arr[i]; if (!a) continue;
      for (let j = i + 1; j < n; j++) {
        const b = arr[j]; if (!b) continue;
        const minD = (a.size + b.size) / 2 + 5;
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= minD) continue;
        if (d < 0.001) { dx = ((i * 17 + j * 31) % 100) / 50 - 1; dy = ((i * 29 + j * 13) % 100) / 50 - 1; d = Math.hypot(dx, dy) || 1; }
        const nx = dx / d, ny = dy / d;
        const overlap = (minD - d) * 0.5;
        const heavyA = a.kind === 'boss' || a.kind === 'tank' || a.kind === 'anchor' || a.kind === 'herald' || a.kind === 'damper';
        const heavyB = b.kind === 'boss' || b.kind === 'tank' || b.kind === 'anchor' || b.kind === 'herald' || b.kind === 'damper';
        const am = heavyA ? 0.35 : 0.65;
        const bm = heavyB ? 0.35 : 0.65;
        const ac = collideWalls(a.x - nx * overlap * am, a.y - ny * overlap * am, a.size / 2, walls, a.x, a.y);
        const bc = collideWalls(b.x + nx * overlap * bm, b.y + ny * overlap * bm, b.size / 2, walls, b.x, b.y);
        a.x = ac.x; a.y = ac.y; b.x = bc.x; b.y = bc.y;
      }
    }
  }
}
function stepEnemySynergies(run, players, dt) {
  const alive = [...players.values()].filter(p => p.alive);
  for (const e of run.enemies) {
    e.rallyT = Math.max(0, (e.rallyT || 0) - dt);
    e.anchorT = Math.max(0, (e.anchorT || 0) - dt);
    e.leechLinkT = Math.max(0, (e.leechLinkT || 0) - dt);
    e.orbShieldT = Math.max(0, (e.orbShieldT || 0) - dt);
    e.armorLockT = Math.max(0, (e.armorLockT || 0) - dt);
    if (e.armorLockT <= 0) e.armorLinkId = '';
    e.activeSlowT = Math.max(0, (e.activeSlowT || 0) - dt);
    e.activeExposeT = Math.max(0, (e.activeExposeT || 0) - dt);
    if (e.activeExposeT <= 0) e.activeExposeMul = 1;
    e.shellFlashT = Math.max(0, (e.shellFlashT || 0) - dt);
    e.comboCd = Math.max(0, (e.comboCd || 0) - dt);
  }
  const anchors = run.enemies.filter(e => e.kind === 'anchor');
  for (const a of anchors) {
    const def = ENEMIES.anchor;
    let count = 0;
    for (const e of run.enemies) {
      if (e.id === a.id || e.kind === 'boss') continue;
      if (dist2(e.x, e.y, a.x, a.y) < def.fieldR * def.fieldR) { e.anchorT = 0.26; count++; }
    }
    if (count && (a.comboCd || 0) <= 0) { a.comboCd = 0.85; run.fx.push({ t: 'enemy_combo', label: 'ANCHOR FIELD', x: Math.round(a.x), y: Math.round(a.y) }); }
  }
  const heralds = run.enemies.filter(e => e.kind === 'herald');
  for (const h of heralds) {
    h.rallyCd = (h.rallyCd || 0) - dt;
    if (h.rallyCd > 0) continue;
    h.rallyCd = 1.15;
    const target = nearestAlive(players, h.x, h.y);
    let rallied = 0;
    for (const e of run.enemies) {
      if (e.id === h.id || e.kind === 'boss' || e.kind === 'anchor') continue;
      if (dist2(e.x, e.y, h.x, h.y) < 560 * 560) {
        e.rallyT = Math.max(e.rallyT || 0, 2.1);
        if (target) e.rallyTargetId = target.id;
        rallied++;
        if (rallied >= 7) break;
      }
    }
    if (rallied) run.fx.push({ t: 'enemy_combo', label: 'HERALD RALLY', x: Math.round(h.x), y: Math.round(h.y) });
  }
  const orbiters = run.enemies.filter(e => e.kind === 'orbiter');
  for (const o of orbiters) {
    let guarded = 0;
    for (const e of run.enemies) {
      if (e.id === o.id || e.kind === 'boss') continue;
      if (!['shooter','prism','pulse','leech'].includes(e.kind)) continue;
      if (dist2(e.x, e.y, o.x, o.y) < 230 * 230) { e.orbShieldT = 0.30; guarded++; }
    }
    if (guarded && (o.comboCd || 0) <= 0) { o.comboCd = 1.0; run.fx.push({ t: 'enemy_combo', label: 'ORB GUARD', x: Math.round(o.x), y: Math.round(o.y) }); }
  }

  // Linked armor is now a general armor class, not only a WRD gimmick:
  // any eligible shell carrier that spawned with linked armor can anchor its shell to a nearby unarmored battery mob.
  // The link never targets another armored/shelled enemy, another linked-armor carrier, or boss.
  const linkedCarriers = run.enemies.filter(e => e.shellType === 'linked' && (e.shellHp || 0) > 0);
  for (const carrier of linkedCarriers) {
    const def = ENEMIES[carrier.kind] || {};
    const radius = def.linkR || 340;
    let best = null, bd = radius * radius;
    for (const e of run.enemies) {
      if (e.id === carrier.id || !isLinkableShellBattery(e)) continue;
      const d = dist2(carrier.x, carrier.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) {
      carrier.armorLockT = 0.34;
      carrier.armorLinkId = best.id;
      best.armorBatteryT = 0.34;
      if ((carrier.comboCd || 0) <= 0) {
        carrier.comboCd = carrier.kind === 'warden' ? 0.75 : 1.05;
        run.fx.push({ t: 'armor_link', x: Math.round(carrier.x), y: Math.round(carrier.y), x2: Math.round(best.x), y2: Math.round(best.y), label: carrier.kind === 'warden' ? 'WARDEN LINK' : 'ARMOR LINK' });
      }
    }
  }
  // Splitting enemies agitate nearby runners: a small swarm moment after a split pack appears.
  const splitters = run.enemies.filter(e => e.kind === 'splitter');
  for (const s of splitters) {
    if ((s.splitStage || 0) <= 0 || (s.comboCd || 0) > 0) continue;
    let aggro = 0;
    for (const e of run.enemies) {
      if (e.id === s.id || !['runner','grunt','glitch'].includes(e.kind)) continue;
      if (dist2(e.x, e.y, s.x, s.y) < 300 * 300) { e.rallyT = Math.max(e.rallyT || 0, 1.1); aggro++; }
    }
    if (aggro) { s.comboCd = 2.2; run.fx.push({ t: 'enemy_combo', label: 'SPL SWARM', x: Math.round(s.x), y: Math.round(s.y) }); }
  }
}

function resolveEnemyPlayerOverlap(run, e, p, walls, opts = {}) {
  if (!p || !p.alive || !e) return null;
  const pad = opts.pad ?? 7;
  const minD = (PLAYER_SIZE + e.size) / 2 + pad;
  let dx = p.x - e.x;
  let dy = p.y - e.y;
  let d = Math.hypot(dx, dy);
  if (d >= minD) return null;
  if (d < 0.001) {
    dx = (p.aimX || p.x + 1) - p.x;
    dy = (p.aimY || p.y) - p.y;
    d = Math.hypot(dx, dy) || 1;
  }
  const nx = dx / d;
  const ny = dy / d;
  const overlap = minD - d;
  const bossy = e.kind === 'boss' || e.kind === 'tank';
  const enemyMove = overlap * (bossy ? 0.42 : 0.78);
  const playerMove = overlap * (bossy ? 0.78 : 0.48) + (opts.playerKick ?? 0);
  const ec = collideWalls(e.x - nx * enemyMove, e.y - ny * enemyMove, e.size / 2, walls, e.x, e.y);
  const pc = collideWalls(p.x + nx * playerMove, p.y + ny * playerMove, PLAYER_SIZE / 2, walls, p.x, p.y);
  e.x = ec.x; e.y = ec.y;
  p.x = pc.x; p.y = pc.y;
  if (opts.fx && Math.random() < 0.18) run.fx.push({ t: 'body_push', x: Math.round((e.x + p.x) / 2), y: Math.round((e.y + p.y) / 2) });
  return { nx, ny, overlap };
}
function resolveEnemyPlayerBodies(run, players, walls) {
  for (const e of run.enemies) {
    for (const p of players.values()) resolveEnemyPlayerOverlap(run, e, p, walls, { pad: 8 });
  }
}
function chanceStacks(v) {
  const full = Math.floor(Math.max(0, v));
  return full + (Math.random() < Math.max(0, v - full) ? 1 : 0);
}
function openPortal(run) {
  if (run.portal.open) return;
  run.portal.open = true;
  run.fx.push({ t: 'portal_open', x: run.portal.x, y: run.portal.y, skinRarity: run.skinRoomReward?.rarity || '' });
  if (run.skinRoomReward && !run.skinRoomReward.claimed) {
    run.fx.push({ t: 'skin_room_ready', skinRarity: run.skinRoomReward.rarity, x: run.portal.x, y: run.portal.y });
  }
}
function quotaCanOpenPortal(run) {
  return run.plan.category !== 'boss' && run.kills >= run.plan.quota;
}

// ---------------------------------------------------------------- state
export function createRun(seedBase) {
  return {
    seedBase: seedBase >>> 0,
    runDepth: 0,
    phase: 'play',           // play | install | lost
    phaseT: 0,
    staticDebt: false,
    plan: null,
    enemies: [], bullets: [], pickups: [], activeFields: [],
    portal: null,
    kills: 0, spawned: 0,
    directorT: 1.2,
    director: null, // v1 encounter director: room mode + wave cadence
    rainT: 3,
    fx: [],                  // dopamine events flushed each snapshot
    hunterSpawned: false, hunterTarget: null, roomAge: 0,
    tick: 0
  };
}


function skinPart(v, fallback) {
  const x = String(v || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(x) ? x.toLowerCase() : fallback;
}
function skinId(v) {
  const x = String(v || 'terminal_mint').trim().toLowerCase();
  return /^[a-z0-9_\-]{2,32}$/.test(x) ? x : 'terminal_mint';
}
export function sanitizeSkin(skin = {}) {
  skin = skin || {};
  return {
    id: skinId(skin.id),
    fill: skinPart(skin.fill, '#f3f3f3'),
    outline: skinPart(skin.outline, '#00ff66'),
    barrel: skinPart(skin.barrel, '#00ff66')
  };
}

export function createPlayer(id, name, idx, skin = null) {
  const sp = spawnPoint(idx);
  return {
    id, name: String(name || 'p?').slice(0, 12), idx, skin: sanitizeSkin(skin),
    x: sp.x, y: sp.y, hp: PLAYER_HP, alive: true,
    aimX: sp.x, aimY: sp.y - 100,
    moveX: 0, moveY: 0, fire: false,
    weapons: ['shotgun'], weaponIdx: 0, cd: 0,
    shgCharges: 4, shgReload: 0, fireWasDown: false,
    recoilT: 0, recoilX: 0, recoilY: 0,
    dashCharges: 1, dashTimer: 0, invuln: 0, activeCd: 0, activeBuffT: 0,
    stats: defaultStats(),
    active: { core: null, level: 0, mutations: [] },
    economy: { money: 0, xp: 0, level: 0, nextLevelXp: 40, pending: 0, lifetimeXp: 0 },
    lastSeq: 0,
    droneCd: 0, orbHits: new Map(),
    offer: null,
    weaponChestOffer: null,
    abilityChestOffer: null,
    touch: new Map(),
    wantDash: false, wantInteract: false, wantActive: false, wantWeapon: -1,
    connected: true
  };
}
export function maxHp(p) { return Math.max(20, PLAYER_HP + p.stats.maxHpAdd); }
export function speed(p) { return PLAYER_SPEED * p.stats.spdMul * (p.slowT > 0 ? (p.slowMul || 0.6) : 1); }
export function dashMax(p) { return 1 + p.stats.dashAdd; }

export function startRoom(run, players) {
  const seed = (run.seedBase + run.runDepth * 7919) >>> 0;
  const loopIndex = Math.floor(run.runDepth / 4);
  run.plan = generateRoom(seed, run.runDepth, loopIndex);
  if (run.staticDebt && run.plan.category !== 'boss') {
    if (!run.plan.modifierIds.includes('static_rain')) run.plan.modifierIds.push('static_rain');
    run.staticDebt = false;
  }
  run.skinRoomReward = null;
  if (run.plan.category !== 'boss') {
    const skinRng = mulberry32((seed ^ 0x5A11C0DE ^ (run.runDepth * 1319)) >>> 0);
    const mods = run.plan.modifierIds || [];
    const special = !!run.plan.specialRoomId;
    let skinChance = 0.026 + Math.min(0.026, loopIndex * 0.004);
    if (special) skinChance += 0.018;
    if (run.plan.specialRoomId === 'reward_pocket') skinChance += 0.018;
    if (mods.includes('casino_virus') || mods.includes('mirror_room') || mods.includes('hunter_contract') || mods.includes('debt_floor')) skinChance += 0.014;
    skinChance = Math.min(0.082, skinChance);
    if (skinRng() < skinChance) {
      const skin = rollRoomSkin(skinRng, run.runDepth, mods);
      run.skinRoomReward = { id: skin.id, rarity: skin.rarity || 'uncommon', claimed: false };
      if (!mods.includes('skin_cache')) mods.push('skin_cache');
    }
  }
  run.enemies = []; run.bullets = []; run.pickups = []; run.activeFields = [];
  run.pendingStrikes = []; run.pendingActives = [];
  run.hunterSpawned = false; run.hunterTarget = null; run.roomAge = 0;
  run.kills = 0; run.spawned = 0;
  run.directorT = 1.4; run.director = null; run.rainT = 3.5;
  const pp = portalSpot(seed + 0x51F15EED, run.plan.walls, run.plan.interactables);
  run.portal = { x: pp.x, y: pp.y, open: false };
  run.director = createDirectorState(run);
  run.phase = 'play'; run.phaseT = 0;
  let i = 0;
  for (const p of players.values()) {
    const sp = spawnPoint(i++);
    p.x = sp.x; p.y = sp.y;
    if (!p.alive) { p.alive = true; p.hp = Math.round(maxHp(p) * 0.5); }
    else p.hp = Math.min(maxHp(p), p.hp + 15);
    p.invuln = 1.2;
    p.offer = null;
    p.weaponChestOffer = null;
    if (p.stats.debtEngine > 0 && run.plan.category !== 'boss' && !run.plan.modifierIds.includes('static_rain')) run.plan.modifierIds.push('static_rain');
  }
  if (run.plan.category === 'boss') spawnEnemy(run, players, 'boss', false);
  else if (run.plan.modifierIds.includes('hunter_contract')) {
    const h = spawnEnemy(run, players, 'herald', true);
    h.hunter = true; run.hunterSpawned = true; run.hunterTarget = h.id;
    run.fx.push({ t: 'contract', label: 'HUNTER CONTRACT', x: Math.round(h.x), y: Math.round(h.y) });
  }
  if (run.plan.specialRoomId === 'reward_pocket') {
    for (let r = 0; r < 4; r++) dropPickup(run, run.portal.x + (Math.random() - 0.5) * 120, run.portal.y + (Math.random() - 0.5) * 120, Math.random() < 0.6 ? 'GLD' : 'EXP', 16 + Math.round(Math.random() * 18));
  }
  run.fx.push({ t: 'room', roomId: run.plan.roomId, loop: loopIndex, depth: run.runDepth, mods: run.plan.modifierIds, cat: run.plan.category, special: run.plan.specialRoomId, director: run.director?.label || '', skinRarity: run.skinRoomReward?.rarity || '' });
  if (run.skinRoomReward) run.fx.push({ t: 'skin_room', skinRarity: run.skinRoomReward.rarity, x: run.portal.x, y: run.portal.y });
  if (run.director?.label) run.fx.push({ t: 'director_room', label: run.director.label, intent: run.director.mode, x: run.portal.x, y: run.portal.y });
}

export function resetRun(run, players) {
  run.runDepth = 0;
  run.staticDebt = false;
  for (const p of players.values()) {
    p.weapons = ['shotgun']; p.weaponIdx = 0; p.cd = 0;
    p.shgCharges = 4; p.shgReload = 0; p.fireWasDown = false; p.recoilT = 0; p.recoilX = 0; p.recoilY = 0;
    p.stats = defaultStats();
    p.active = { core: null, level: 0, mutations: [] };
    p.economy = { money: 0, xp: 0, level: 0, nextLevelXp: 40, pending: 0, lifetimeXp: 0 };
    p.dashCharges = 1; p.activeCd = 0; p.activeBuffT = 0; p.alive = true; p.hp = PLAYER_HP; p.offer = null; p.weaponChestOffer = null; p.abilityChestOffer = null;
  }
  startRoom(run, players);
}

// ---------------------------------------------------------------- spawning
function difficulty(run) {
  const loop = Math.floor(run.runDepth / 4);
  const late = Math.max(0, loop - 2);
  const depth = run.runDepth;
  // First loop is deliberately readable. After several loops, pressure ramps hard.
  const hpBase = 0.74 + depth * 0.055 + loop * 0.11 + Math.pow(late, 1.55) * 0.34;
  const dmgBase = 0.62 + depth * 0.045 + loop * 0.09 + Math.pow(late, 1.45) * 0.26;
  return {
    loop, late,
    // Keep control readable, but make the room pressure about 2x: denser spawns, bigger quotas, harsher elites.
    hp: hpBase * 1.30,
    dmg: dmgBase * 1.25,
    eliteChance: loop <= 0 ? 0 : Math.min(0.58, (0.045 + loop * 0.035 + late * 0.04) * 1.75),
    eliteHp: 1.75 + loop * 0.16,
    eliteDmg: 1.34 + loop * 0.07,
    maxActive: Math.min(MAX_ENEMIES, Math.round((8 + depth * 1.15 + loop * 4 + Math.pow(late, 1.5) * 8) * DIFFICULTY_MULT)),
    addCap: Math.min(42, Math.round((8 + loop * 3 + late * 4) * DIFFICULTY_MULT))
  };
}
function scaling(run) {
  return difficulty(run).hp;
}
function spawnPool(run) {
  const loop = Math.floor(run.runDepth / 4);
  if (run.runDepth === 0) return ['grunt','grunt','grunt','runner'];
  if (run.runDepth === 1) return ['grunt','grunt','runner','shooter'];
  if (run.runDepth === 2) return ['grunt','runner','runner','shooter','charger'];
  if (loop === 1) return ['grunt','runner','shooter','charger','bomber','bouncer','splitter'];
  if (loop === 2) return ['grunt','runner','shooter','charger','bomber','bouncer','tank','glitch','anchor','leech','pulse','damper'];
  return SPAWN_POOLS[Math.min(loop, SPAWN_POOLS.length - 1)];
}


// ---------------------------------------------------------------- director v1: encounter packs, wave cadence, room intent
const ENCOUNTER_PACKS = [
  {
    id: 'warm_swarm', label: 'SWARM PACK', intent: 'swarm', minDepth: 0, weight: 4.8, minGap: 4.2, maxGap: 6.6,
    roles: [
      { pick: ['grunt'], count: [2, 4], opts: { noArmor: true } },
      { pick: ['runner'], count: [1, 3], opts: { noArmor: true } }
    ]
  },
  {
    id: 'ranged_line', label: 'RANGED LINE', intent: 'ranged', minDepth: 1, weight: 3.2, minGap: 5.2, maxGap: 7.4,
    roles: [
      { pick: ['shooter'], count: [1, 2] },
      { pick: ['grunt','runner'], count: [2, 3], opts: { noArmor: true } }
    ]
  },
  {
    id: 'damper_nest', label: 'DAMPER NEST', intent: 'control', minLoop: 2, weight: 2.3, minGap: 7.2, maxGap: 10.4, supportCap: 4,
    roles: [
      { pick: ['damper'], count: [1, 1], opts: { noArmor: true } },
      { pick: ['shooter','prism','pulse'], count: [1, 3] },
      { pick: ['grunt','runner','tank'], count: [2, 3] }
    ]
  },
  {
    id: 'pinball_panic', label: 'PINBALL PANIC', intent: 'chaos', minLoop: 1, weight: 2.0, minGap: 5.8, maxGap: 8.2,
    roles: [
      { pick: ['bouncer'], count: [1, 2] },
      { pick: ['runner','bomber','glitch'], count: [2, 4] }
    ]
  },
  {
    id: 'splitter_swarm', label: 'SPLITTER SWARM', intent: 'swarm', minLoop: 1, weight: 2.4, minGap: 5.4, maxGap: 7.7,
    roles: [
      { pick: ['splitter'], count: [1, 2] },
      { pick: ['runner','grunt','glitch'], count: [2, 4], opts: { noArmor: true } }
    ]
  },
  {
    id: 'anchor_battery', label: 'ANCHOR BATTERY', intent: 'control', minLoop: 2, weight: 2.1, minGap: 7.0, maxGap: 10.0, supportCap: 3,
    roles: [
      { pick: ['anchor'], count: [1, 1], opts: { forcePlain: true } },
      { pick: ['shooter','prism','pulse'], count: [1, 3] },
      { pick: ['grunt','runner','tank'], count: [2, 4] }
    ]
  },
  {
    id: 'leech_wall', label: 'LEECH WALL', intent: 'support', minLoop: 2, weight: 2.0, minGap: 7.2, maxGap: 10.5, supportCap: 4,
    roles: [
      { pick: ['leech'], count: [1, 1], opts: { noArmor: true } },
      { pick: ['tank','charger','bouncer'], count: [1, 2], opts: { forcePlain: true } },
      { pick: ['grunt','runner'], count: [2, 3], opts: { noArmor: true } }
    ]
  },
  {
    id: 'armor_link_pack', label: 'ARMOR LINK PACK', intent: 'armor', minLoop: 1, weight: 2.4, minGap: 7.0, maxGap: 10.0, armorCap: 3,
    roles: [
      { pick: ['tank','charger','shooter','splitter','warden'], count: [1, 1], opts: { forceLinked: true } },
      { pick: ['grunt','runner','echo','splitter'], count: [2, 3], opts: { noArmor: true } },
      { pick: ['runner','glitch'], count: [0, 2], opts: { noArmor: true } }
    ]
  },
  {
    id: 'prism_crossfire', label: 'PRISM CROSSFIRE', intent: 'ranged', minLoop: 3, weight: 1.8, minGap: 7.2, maxGap: 10.2, supportCap: 4,
    roles: [
      { pick: ['prism','pulse'], count: [1, 2] },
      { pick: ['orbiter','shooter','damper'], count: [1, 2] },
      { pick: ['grunt','runner'], count: [2, 3], opts: { noArmor: true } }
    ]
  },
  {
    id: 'herald_event', label: 'HERALD SIGNAL', intent: 'director', minLoop: 3, weight: 1.3, minGap: 8.5, maxGap: 12.5, supportCap: 3,
    roles: [
      { pick: ['herald'], count: [1, 1], opts: { forceLinked: true } },
      { pick: ['runner','glitch','bouncer'], count: [3, 5], opts: { noArmor: true } },
      { pick: ['prism','pulse'], count: [0, 1] }
    ]
  },
  {
    id: 'debt_shells', label: 'DEBT SHELLS', intent: 'armor', minLoop: 1, weight: 1.0, requireMod: 'debt_floor', minGap: 7.0, maxGap: 10.2, armorCap: 4,
    roles: [
      { pick: ['charger','bouncer','tank'], count: [1, 2], opts: { forcePlain: true } },
      { pick: ['grunt','runner'], count: [2, 4], opts: { noArmor: true } }
    ]
  },
  {
    id: 'casino_chaos', label: 'CASINO CHAOS', intent: 'chaos', minLoop: 1, weight: 1.0, requireMod: 'casino_virus', minGap: 5.6, maxGap: 8.2,
    roles: [
      { pick: ['bouncer','glitch','bomber'], count: [2, 4] },
      { pick: ['runner','splitter'], count: [2, 4], opts: { noArmor: true } }
    ]
  },
  {
    id: 'mirror_echo', label: 'MIRROR ECHO', intent: 'mirror', minLoop: 2, weight: 1.0, requireMod: 'mirror_room', minGap: 6.2, maxGap: 8.8,
    roles: [
      { pick: ['echo'], count: [1, 2], opts: { noArmor: true } },
      { pick: ['seeker','shooter','glitch','runner'], count: [2, 4], opts: { noArmor: true } }
    ]
  }
];

const DIRECTOR_MODES = [
  { id: 'swarm_route', label: 'SWARM ROUTE', weight: 3.0, intents: { swarm: 1.8, chaos: 1.2 } },
  { id: 'crossfire', label: 'CROSSFIRE ROOM', weight: 2.0, minDepth: 1, intents: { ranged: 1.8, control: 1.1 } },
  { id: 'armor_puzzle', label: 'ARMOR PUZZLE', weight: 1.7, minLoop: 1, intents: { armor: 2.0, support: 1.2 } },
  { id: 'control_zone', label: 'CONTROL ZONE', weight: 1.6, minLoop: 2, intents: { control: 2.0, ranged: 1.2 } },
  { id: 'support_wall', label: 'SUPPORT WALL', weight: 1.4, minLoop: 2, intents: { support: 2.0, armor: 1.2 } },
  { id: 'signal_chaos', label: 'SIGNAL CHAOS', weight: 1.2, minLoop: 3, intents: { chaos: 1.8, director: 1.4, mirror: 1.2 } }
];
function createDirectorState(run) {
  const mode = pickDirectorMode(run);
  return {
    mode: mode.id,
    label: mode.label,
    intents: mode.intents || {},
    waveIndex: 0,
    lastPack: '',
    lastIntent: '',
    pauseT: run.plan.category === 'boss' ? 1.4 : 1.2,
    used: {}
  };
}
function pickDirectorMode(run) {
  const df = difficulty(run);
  const mods = run.plan?.modifierIds || [];
  const special = run.plan?.specialRoomId || '';
  if (mods.includes('hunter_contract')) return { id: 'hunter', label: 'HUNTER EVENT', intents: { director: 2.2, swarm: 1.2, ranged: 1.1 } };
  if (mods.includes('debt_floor')) return { id: 'debt', label: 'DEBT ARMORY', intents: { armor: 2.3, support: 1.2, chaos: 1.1 } };
  if (mods.includes('casino_virus')) return { id: 'casino', label: 'CASINO VIRUS ROOM', intents: { chaos: 2.4, swarm: 1.3 } };
  if (mods.includes('mirror_room')) return { id: 'mirror', label: 'MIRROR ROOM', intents: { mirror: 2.3, ranged: 1.1 } };
  if (special === 'reward_pocket') return { id: 'greed_pocket', label: 'GREED POCKET', intents: { swarm: 1.3, armor: 1.2, chaos: 1.1 } };
  if (special === 'signal_contract') return { id: 'contract', label: 'SIGNAL CONTRACT', intents: { control: 1.3, support: 1.3, armor: 1.3, chaos: 1.3 } };
  const candidates = DIRECTOR_MODES.filter(m => (m.minLoop ?? 0) <= df.loop && (m.minDepth ?? 0) <= run.runDepth);
  return weightedPick(candidates, m => m.weight || 1) || DIRECTOR_MODES[0];
}
function weightedPick(arr, weightFn) {
  let total = 0;
  for (const x of arr) total += Math.max(0, weightFn(x));
  if (total <= 0) return arr[0] || null;
  let r = Math.random() * total;
  for (const x of arr) {
    r -= Math.max(0, weightFn(x));
    if (r <= 0) return x;
  }
  return arr[arr.length - 1] || null;
}
function countLive(run, pred) { let n = 0; for (const e of run.enemies) if (pred(e)) n++; return n; }
function packEligible(run, pack) {
  const df = difficulty(run);
  if ((pack.minLoop ?? 0) > df.loop || (pack.minDepth ?? 0) > run.runDepth) return false;
  if (pack.requireMod && !(run.plan?.modifierIds || []).includes(pack.requireMod)) return false;
  if (pack.intent === 'director' && countLive(run, e => e.kind === 'herald') > 0) return false;
  if (pack.supportCap && countLive(run, e => ['anchor','leech','herald','orbiter','prism','pulse','damper'].includes(e.kind)) >= pack.supportCap) return false;
  if (pack.armorCap && countLive(run, e => (e.shellHp || 0) > 0) >= pack.armorCap) return false;
  return true;
}
function choosePack(run) {
  const dir = run.director || createDirectorState(run);
  const candidates = ENCOUNTER_PACKS.filter(p => packEligible(run, p));
  const pool = spawnPool(run);
  const modeIntents = dir.intents || {};
  return weightedPick(candidates, p => {
    let w = p.weight || 1;
    w *= modeIntents[p.intent] || 1;
    if (p.id === dir.lastPack) w *= 0.22;
    if (p.intent === dir.lastIntent) w *= 0.60;
    // If the room is already crowded, favor tiny/simple packs and avoid support/armor escalation.
    const df = difficulty(run);
    const fullness = run.enemies.length / Math.max(1, df.maxActive);
    if (fullness > 0.62 && ['armor','support','director','control'].includes(p.intent)) w *= 0.45;
    if (p.roles.some(r => r.pick.some(k => pool.includes(k)))) w *= 1.1;
    return w;
  }) || ENCOUNTER_PACKS[0];
}
function chooseKindFrom(candidates, pool) {
  const allowed = candidates.filter(k => pool.includes(k) && ENEMIES[k]);
  const src = allowed.length ? allowed : candidates.filter(k => ENEMIES[k]);
  return src[Math.floor(Math.random() * src.length)] || 'grunt';
}
function roleCount(role, run) {
  const [a, b] = role.count || [1, 1];
  let n = a + Math.floor(Math.random() * (b - a + 1));
  const df = difficulty(run);
  if (df.late > 0 && Math.random() < Math.min(0.45, df.late * 0.10)) n += 1;
  return Math.max(0, n);
}
function spawnClusterPoint(run, players) {
  return enemySpawnPoint(mulberry32((Math.random() * 1e9) >>> 0), run.plan.walls, [...players.values()].filter(pl => pl.alive));
}
function offsetSpawnPos(run, center, idx, total) {
  const a = (idx / Math.max(1, total)) * Math.PI * 2 + Math.random() * 0.55;
  const r = 55 + Math.random() * 170 + Math.floor(idx / 4) * 35;
  const x = center.x + Math.cos(a) * r;
  const y = center.y + Math.sin(a) * r;
  return collideWalls(x, y, 32, run.plan.walls, center.x, center.y);
}
function spawnEncounterPack(run, players, pack, budgetLeft) {
  const pool = spawnPool(run);
  const center = spawnClusterPoint(run, players);
  let planned = [];
  for (const role of pack.roles) {
    const n = roleCount(role, run);
    for (let i = 0; i < n; i++) planned.push({ kind: chooseKindFrom(role.pick, pool), opts: role.opts || {} });
  }
  const df = difficulty(run);
  const roomLeft = Math.max(0, df.maxActive - run.enemies.length);
  const count = Math.max(0, Math.min(planned.length, roomLeft, budgetLeft));
  if (!count) return 0;
  for (let i = 0; i < count; i++) {
    const pos = offsetSpawnPos(run, center, i, count);
    spawnEnemy(run, players, planned[i].kind, true, pos, planned[i].opts);
  }
  run.fx.push({ t: 'director_wave', label: pack.label, intent: pack.intent, x: Math.round(center.x), y: Math.round(center.y), count });
  if (run.director) {
    run.director.waveIndex++;
    run.director.lastPack = pack.id;
    run.director.lastIntent = pack.intent;
    run.director.used[pack.id] = (run.director.used[pack.id] || 0) + 1;
  }
  return count;
}
function nextWaveDelay(run, pack) {
  const df = difficulty(run);
  const greed = run.plan?.modifierIds?.includes('greed');
  const min = pack.minGap ?? 4.5;
  const max = pack.maxGap ?? 7.0;
  const base = min + Math.random() * Math.max(0.2, max - min);
  const pressure = Math.max(0.68, 1 - df.loop * 0.035 - df.late * 0.055);
  const crowded = run.enemies.length / Math.max(1, df.maxActive);
  const crowdPause = crowded > 0.58 ? 1.4 + crowded * 3.2 : 0;
  return Math.max(1.0, base * pressure / (greed ? 1.12 : 1) + crowdPause);
}
function spawnEnemy(run, players, kind, canElite = true, pos = null, opts = {}) {
  const def = ENEMIES[kind] || ENEMIES.grunt;
  if (!ENEMIES[kind]) kind = 'grunt';
  const rng = Math.random;
  const p = pos || enemySpawnPoint(mulberry32((Math.random() * 1e9) >>> 0), run.plan.walls, [...players.values()].filter(pl => pl.alive));
  const df = difficulty(run);
  const elite = canElite && rng() < df.eliteChance;
  const hpMul = Math.max(0.42, df.hp) * (elite ? df.eliteHp : 1);
  const dmgMul = Math.max(0.40, df.dmg) * (elite ? df.eliteDmg : 1);
  const e = {
    id: nid(), kind, x: p.x, y: p.y,
    hp: Math.max(4, Math.round(def.hp * hpMul)),
    maxHp: Math.max(4, Math.round(def.hp * hpMul)),
    dmg: Math.max(1, Math.round(def.dmg * dmgMul)),
    size: Math.round(def.size * (elite ? 1.18 : 1)),
    spd: def.spd, elite,
    state: 'move', st: 0, // state timer
    vx: 0, vy: 0, fireCd: (def.fireCd || 0) * (0.75 + rng() * 0.75),
    dirX: 0, dirY: 0, aux: 0
  };
  let shell = null;
  if (opts.noArmor) shell = null;
  else if (opts.forceLinked) shell = { type: 'linked', max: shellMaxForArmor(run, def, e, 'linked'), source: 'director' };
  else if (opts.forcePlain) shell = { type: 'plain', max: shellMaxForArmor(run, def, e, 'plain'), source: 'director' };
  else shell = rollShellArmor(run, kind, def, e, elite);
  if (shell && shell.max > 0) {
    e.shellType = shell.type;          // 'plain' = breakable by damage, 'linked' = unbreakable while battery-link is alive
    e.shellSource = shell.source;      // native / roll / boss, for debugging and future tuning
    e.shellMax = shell.max;
    e.shellHp = shell.max;
    e.shellFlashT = 0;
    if (shell.type === 'linked') e.armorLinkId = '';
  }
  if (kind === 'damper') { e.state = 'field'; e.dirX = 1; e.dirY = 0; e.fireCd = 0; }
  if (kind === 'bouncer') {
    const a = rng() * Math.PI * 2;
    e.vx = Math.cos(a) * def.spd; e.vy = Math.sin(a) * def.spd;
  }
  if (kind === 'splitter') e.splitStage = 0;
  if (kind === 'orbiter') e.phase = rng() * Math.PI * 2;
  if (kind === 'herald') e.summonCd = def.summonCd * (0.55 + rng() * 0.5);
  if (kind === 'leech') e.healCd = def.healCd * (0.6 + rng() * 0.6);
  if (kind === 'echo') e.fireCd = def.mirrorFireCd * (0.5 + rng() * 0.8);
  run.enemies.push(e);
  run.spawned++;
  return e;
}

function director(run, players, dt) {
  if (run.phase !== 'play') return;
  const alive = [...players.values()].filter(p => p.alive);
  if (!alive.length) return;
  const plan = run.plan;
  const df = difficulty(run);

  if (!run.director) run.director = createDirectorState(run);

  if (plan.category === 'boss') {
    // Boss adds now use tiny encounter packs instead of pure random trickle.
    const boss = run.enemies.find(e => e.kind === 'boss');
    if (boss && boss.hp < boss.maxHp * 0.55) {
      run.director.pauseT -= dt;
      if (run.director.pauseT <= 0 && run.enemies.length < df.addCap) {
        const pool = df.loop < 2 ? ['grunt','runner'] : ['grunt','runner','shooter','bouncer','glitch','leech'];
        const center = { x: boss.x + (Math.random() - 0.5) * 480, y: boss.y + (Math.random() - 0.5) * 360 };
        const n = Math.min(df.addCap - run.enemies.length, 2 + Math.min(5, df.loop + Math.floor(Math.random() * 3)));
        for (let i = 0; i < n; i++) {
          const pos = offsetSpawnPos(run, center, i, n);
          const kind = pool[Math.floor(Math.random() * pool.length)];
          spawnEnemy(run, players, kind, df.loop >= 3, pos, { noArmor: df.loop < 2 });
        }
        run.fx.push({ t: 'director_wave', label: df.loop >= 2 ? 'BOSS ADD PACK' : 'BOSS SWARM', intent: 'boss', x: Math.round(center.x), y: Math.round(center.y), count: n });
        run.director.pauseT = Math.max(1.7, (6.8 - df.loop * 0.42 - df.late * 0.55) / DIFFICULTY_MULT + Math.random() * 1.4);
      }
    }
    return;
  }

  if (run.portal.open) return; // calm after objective

  const greed = plan.modifierIds.includes('greed');
  const lateBudget = Math.floor(Math.pow(df.late, 1.45) * 14);
  const totalBudget = Math.round((plan.quota + 5 + df.loop * 5 + lateBudget) * DIFFICULTY_MULT);
  if (run.spawned >= totalBudget) return;

  // Anti-spam: when the room is already full, stop creating waves and let the player read the encounter.
  const fullness = run.enemies.length / Math.max(1, df.maxActive);
  if (fullness > 0.82) {
    run.director.pauseT = Math.max(run.director.pauseT, 1.8);
    return;
  }

  run.director.pauseT -= dt * (greed ? 1.12 : 1);
  if (run.director.pauseT > 0) return;

  const budgetLeft = totalBudget - run.spawned;
  const pack = choosePack(run);
  const spawned = spawnEncounterPack(run, players, pack, budgetLeft);
  if (!spawned) {
    run.director.pauseT = 1.0;
    return;
  }
  run.director.pauseT = nextWaveDelay(run, pack);
}

// ---------------------------------------------------------------- damage
function damagePlayer(run, p, dmg, srcX, srcY) {
  if (!p.alive || p.invuln > 0) return;
  p.hp -= dmg;
  p.invuln = Math.max(p.invuln, PLAYER_HIT_INVULN);
  run.fx.push({ t: 'phit', id: p.id, dmg, x: Math.round(srcX ?? p.x), y: Math.round(srcY ?? p.y) });
  if (p.hp <= 0) {
    p.hp = 0; p.alive = false;
    run.fx.push({ t: 'pdown', id: p.id });
  }
}

function damageEnemy(run, players, e, dmg, owner, knock, kx, ky) {
  const def = ENEMIES[e.kind];
  // Armor is a real shell class: it absorbs hits before HP.
  // Plain shell loses shell HP from shots. Linked shell loses nothing while its unarmored battery mob is alive nearby.
  const rawDmg = Math.max(1, Math.round(dmg));
  const shellActive = (e.shellHp || 0) > 0;
  if (shellActive) {
    const locked = e.shellType === 'linked' && ((e.armorLockT || 0) > 0 && !!e.armorLinkId);
    e.shellFlashT = 0.16;
    if (locked) {
      run.fx.push({ t: 'armor_shell', locked: 1, shellType: e.shellType || 'linked', id: e.id, link: e.armorLinkId, dmg: rawDmg, x: Math.round(e.x), y: Math.round(e.y) });
      return;
    }
    e.shellHp = Math.max(0, (e.shellHp || 0) - rawDmg);
    run.fx.push({ t: 'armor_shell', id: e.id, shellType: e.shellType || 'plain', dmg: rawDmg, left: Math.round(e.shellHp || 0), x: Math.round(e.x), y: Math.round(e.y) });
    if (e.shellHp <= 0) {
      e.armorLockT = 0;
      e.armorLinkId = '';
      run.fx.push({ t: 'armor_break', id: e.id, shellType: e.shellType || 'plain', x: Math.round(e.x), y: Math.round(e.y) });
    }
    return;
  }
  if (e.activeExposeT > 0) dmg *= (e.activeExposeMul || 1.35);
  if (e.anchorT > 0) dmg *= 0.88;
  if (e.leechLinkT > 0) dmg *= 0.82;
  if (e.orbShieldT > 0) dmg *= 0.76;
  if (e.kind === 'orbiter' && def.shield && (kx || ky)) {
    // Front shield faces the player/target. Hits coming into the shield face are reduced.
    const incomingTowardEnemy = norm(kx || 0, ky || 0);
    const face = norm(e.dirX || 1, e.dirY || 0);
    const dot = incomingTowardEnemy.x * face.x + incomingTowardEnemy.y * face.y;
    if (dot > 0.25) { dmg *= (1 - def.shield); run.fx.push({ t: 'shield', x: Math.round(e.x), y: Math.round(e.y), id: e.id }); }
  }
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  run.fx.push({ t: 'ehit', id: e.id, dmg, x: Math.round(e.x), y: Math.round(e.y) });
  if (knock && !def.boss && e.kind !== 'bouncer' && !def.immobile) {
    e.x += kx * knock * 0.02; e.y += ky * knock * 0.02;
  }
  const p = owner ? players.get(owner) : null;
  if (p && p.stats.lifesteal > 0 && p.alive) {
    p.hp = Math.min(maxHp(p), p.hp + dmg * p.stats.lifesteal);
  }
  if (e.hp <= 0) killEnemy(run, players, e, p);
}

function killEnemy(run, players, e, killer) {
  const def = ENEMIES[e.kind];
  run.enemies = run.enemies.filter(x => x.id !== e.id);
  run.kills++;
  run.fx.push({ t: 'kill', x: Math.round(e.x), y: Math.round(e.y), kind: e.kind, elite: e.elite, size: e.size });
  if (e.kind === 'splitter' && (e.splitStage || 0) < 2) {
    const children = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < children && run.enemies.length < MAX_ENEMIES; i++) {
      const ch = spawnEnemy(run, players, 'splitter', false);
      ch.x = e.x + (Math.random() - 0.5) * 70; ch.y = e.y + (Math.random() - 0.5) * 70;
      ch.splitStage = (e.splitStage || 0) + 1;
      ch.size = Math.max(16, Math.round(e.size * 0.68));
      ch.maxHp = Math.max(10, Math.round(e.maxHp * 0.38)); ch.hp = ch.maxHp;
      ch.spd = Math.round(e.spd * 1.35); ch.dmg = Math.max(5, Math.round(e.dmg * 0.72));
    }
    run.fx.push({ t: 'split', x: Math.round(e.x), y: Math.round(e.y) });
  }
  if (e.hunter || e.id === run.hunterTarget) {
    run.hunterTarget = null;
    run.fx.push({ t: 'contract_done', x: Math.round(e.x), y: Math.round(e.y) });
    for (const p of players.values()) if (p.alive && p.connected) {
      const pool = HERO_UPGRADES.filter(u => u.tier === 1 || u.tier === 2);
      const u = pool[Math.floor(Math.random() * pool.length)];
      if (u) { u.apply(p.stats); p.hp = Math.min(p.hp, maxHp(p)); run.fx.push({ t: 'install', id: p.id, label: 'HUNTER: ' + u.label, cursed: !!u.cursed }); }
    }
  }
  if (run.plan.modifierIds.includes('casino_virus') && e.elite && Math.random() < 0.42) {
    if (Math.random() < 0.62) { dropPickup(run, e.x, e.y, 'GLD', 18 + Math.round(Math.random() * 26)); run.fx.push({ t: 'casino_tick', x: Math.round(e.x), y: Math.round(e.y), good: 1 }); }
    else { run.staticDebt = true; run.fx.push({ t: 'casino_tick', x: Math.round(e.x), y: Math.round(e.y), good: 0 }); }
  }
  // drops
  const greed = run.plan.modifierIds.includes('greed');
  const mult = (e.elite ? 2.5 : 1) * (def.boss ? 1 : 1);
  const goldMul = (killer ? killer.stats.goldMul : 1) * (greed ? 1.6 : 1);
  dropPickup(run, e.x, e.y, 'GLD', Math.max(1, Math.round(def.gld * mult * goldMul * scaling(run) * 0.6)));
  dropPickup(run, e.x + 14, e.y - 8, 'EXP', Math.max(1, Math.round(def.xp * mult)));
  if ((e.elite && Math.random() < 0.35) || def.boss) dropPickup(run, e.x - 14, e.y + 8, 'HEA', 25);
  if (def.boss) {
    run.fx.push({ t: 'boss_down', x: Math.round(e.x), y: Math.round(e.y) });
    // boss reward burst
    for (let i = 0; i < 6; i++) dropPickup(run, e.x + (Math.random() - 0.5) * 160, e.y + (Math.random() - 0.5) * 160, Math.random() < 0.7 ? 'GLD' : 'EXP', 20 + Math.round(Math.random() * 20));
    openPortal(run);
  }
  // proc blast on kill? (proc handled at bullet hit)
  if (quotaCanOpenPortal(run)) openPortal(run);
}

function dropPickup(run, x, y, type, val) {
  if (run.pickups.length >= MAX_PICKUPS) {
    // merge into nearest same-type
    let best = null, bd = Infinity;
    for (const pk of run.pickups) {
      if (pk.type !== type) continue;
      const d = dist2(pk.x, pk.y, x, y);
      if (d < bd) { bd = d; best = pk; }
    }
    if (best) { best.val += val; return; }
    return;
  }
  run.pickups.push({ id: nid(), type, x: Math.round(x), y: Math.round(y), val });
}

function grantEconomy(run, players, type, val) {
  // pickup credit: all alive connected players get it
  for (const p of players.values()) {
    if (!p.alive || !p.connected) continue;
    if (type === 'GLD') p.economy.money += val;
    else if (type === 'EXP') addXp(run, p, val);
    else if (type === 'HEA') p.hp = Math.min(maxHp(p), p.hp + val);
  }
}

function addXp(run, p, val) {
  p.economy.xp += val; p.economy.lifetimeXp += val;
  while (p.economy.xp >= p.economy.nextLevelXp) {
    p.economy.xp -= p.economy.nextLevelXp;
    p.economy.level++;
    p.economy.pending++;
    p.economy.nextLevelXp = Math.round(40 * Math.pow(1.32, p.economy.level));
    run.fx.push({ t: 'levelup', id: p.id, level: p.economy.level, pending: p.economy.pending });
  }
}

// ---------------------------------------------------------------- shooting
function fireWeapon(run, players, p, dt) {
  p.cd = Math.max(0, (p.cd || 0) - dt);
  if (!p.fire) { p.fireWasDown = false; return; }
  if (!p.alive) return;
  const w = WEAPONS[p.weapons[p.weaponIdx]];
  if (!w) return;
  const tempFire = p.activeBuffT > 0 ? 1.65 + p.stats.activeOver * 0.20 : 1;
  const dir = norm(p.aimX - p.x, p.aimY - p.y);
  if (w.id === 'shotgun') {
    if (p.fireWasDown) return;
    if ((p.shgCharges ?? 4) <= 0) { p.fireWasDown = true; return; }
    p.fireWasDown = true;
    p.shgCharges = Math.max(0, (p.shgCharges ?? 4) - 1);
    p.cd = 0; // shotgun is gated by click edges + 4-charge ammo, not by cooldown
  } else {
    if (p.cd > 0) return;
    p.cd = w.cooldown / (p.stats.fireMul * tempFire);
  }

  const echoBase = p.stats.echoShot + (run.plan.modifierIds.includes('mirror_room') ? 0.18 : 0);
  const echoMul = w.id === 'seeker' ? 0.38 : (w.id === 'rocketgun' ? 0.18 : 1);
  const shots = 1 + chanceStacks(echoBase * echoMul);
  const pellets = w.pellets + (w.id === 'shotgun' ? p.stats.shgPellets : 0);
  const rangeMul = Math.max(0.25, p.stats.bulletRange || 1);
  const homing = (w.homing || 0) + (w.id === 'seeker' ? p.stats.sekChain * 0.7 : 0);
  const life = (w.life + (w.id === 'seeker' ? p.stats.sekChain * 0.10 : 0)) * rangeMul;
  const maxDist = w.maxDist ? Math.round(w.maxDist * rangeMul + (w.id === 'seeker' ? p.stats.sekChain * 35 : 0)) : 0;
  const detonateDist = w.detonateDist ? Math.round(((w.detonateDist || 0) + (w.id === 'rocketgun' ? p.stats.rktCluster * 35 : 0)) * rangeMul) : 0;
  const originX = p.x + dir.x * 24;
  const originY = p.y + dir.y * 24;
  for (let s = 0; s < shots; s++) {
    const delay = s * (w.id === 'shotgun' ? 0.018 : 0.055);
    for (let i = 0; i < pellets; i++) {
      if (run.bullets.length >= MAX_BULLETS) break;
      const spreadKick = w.id === 'shotgun' ? (Math.random() - 0.5) * w.spread : (Math.random() - 0.5) * w.spread;
      const ang = Math.atan2(dir.y, dir.x) + spreadKick;
      run.bullets.push({
        id: nid(), x: originX, y: originY,
        vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed,
        dmg: w.dmg * p.stats.dmgMul, from: 'p', owner: p.id,
        life, delay, size: w.size, aoe: w.aoe || 0, homing,
        knock: w.knock || 0, proc: p.stats.procBlast, kind: w.id, travelled: 0, detonateDist, maxDist, rangeMul,
        bounces: (p.stats.bulletBounce || 0) + (w.id === 'shotgun' ? (p.stats.shgBounce || 0) : 0),
        sekSplit: w.id === 'seeker' ? p.stats.sekSplit : 0,
        rktCluster: w.id === 'rocketgun' ? p.stats.rktCluster : 0,
        rktMines: w.id === 'rocketgun' ? p.stats.rktMines : 0,
        mineDist: 0
      });
    }
  }
  const recoil = w.id === 'shotgun' ? 36 : (w.id === 'rocketgun' ? 54 : 18);
  p.recoilT = Math.max(p.recoilT || 0, w.id === 'rocketgun' ? 0.16 : 0.09);
  p.recoilX = -dir.x * recoil;
  p.recoilY = -dir.y * recoil;
  run.fx.push({
    t: 'shot', id: p.id, w: w.label, kind: w.id,
    x: Math.round(p.x), y: Math.round(p.y), mx: Math.round(originX), my: Math.round(originY),
    dx: Math.round(dir.x * 100), dy: Math.round(dir.y * 100), ammo: p.shgCharges ?? 0
  });
}
function explode(run, players, x, y, r, dmg, owner, hurtPlayers = false, style = 'blast') {
  run.fx.push({ t: 'blast', x: Math.round(x), y: Math.round(y), r: Math.round(r), style });
  for (const e of [...run.enemies]) {
    if (dist2(e.x, e.y, x, y) < (r + e.size / 2) ** 2) damageEnemy(run, players, e, dmg, owner, 0, 0, 0);
  }
  if (hurtPlayers) {
    for (const p of players.values()) {
      if (p.alive && dist2(p.x, p.y, x, y) < (r + PLAYER_SIZE / 2) ** 2) damagePlayer(run, p, dmg, x, y);
    }
  }
}

function rocketAftermath(run, players, b) {
  if (b.rktCluster > 0) {
    const pieces = Math.min(10, b.rktCluster * 2);
    for (let i = 0; i < pieces; i++) {
      const a = (i / pieces) * Math.PI * 2 + Math.random() * 0.35;
      const d = 52 + Math.random() * 74;
      explode(run, players, b.x + Math.cos(a) * d, b.y + Math.sin(a) * d, 38 + b.rktCluster * 5, b.dmg * 0.36, b.owner, false, 'rocket');
    }
  }
}

function spawnSeekerFragments(run, owner, x, y, count, dmg, opts = {}) {
  if (count <= 0) return;
  const n = Math.min(8, count * 2);
  for (let i = 0; i < n && run.bullets.length < MAX_BULLETS; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.35;
    run.bullets.push({ id: nid(), x, y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, dmg, from: 'p', owner, life: 0.85 * (opts.rangeMul || 1), size: 4, homing: 6.0, kind: 'seeker', travelled: 0, maxDist: Math.round(420 * 0.85 * (opts.rangeMul || 1)), bounces: opts.bounces || 0 });
  }
}


function applyDamperFieldsToBullet(run, b, dt) {
  if (b.from !== 'p') return false;
  const dampers = run.enemies.filter(e => e.kind === 'damper' && e.hp > 0);
  if (!dampers.length) return false;
  for (const d of dampers) {
    const def = ENEMIES.damper;
    const r = def.fieldR || 260;
    if (dist2(b.x, b.y, d.x, d.y) > r * r) continue;
    const before = Math.hypot(b.vx || 0, b.vy || 0);
    const damp = Math.pow(def.bulletDamp || 0.02, dt);
    b.vx *= damp;
    b.vy *= damp;
    b.life -= dt * 1.25;
    b.dampedT = 0.18;
    b.dampFxCd = (b.dampFxCd || 0) - dt;
    if (b.dampFxCd <= 0) {
      b.dampFxCd = 0.16;
      run.fx.push({ t: 'bullet_damp', x: Math.round(b.x), y: Math.round(b.y), id: d.id });
    }
    const after = Math.hypot(b.vx || 0, b.vy || 0);
    if (after < (def.stopSpd || 36) || before < (def.stopSpd || 36)) {
      run.fx.push({ t: 'bullet_stop', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind || '' });
      b.life = -1;
      return true;
    }
    return false;
  }
  return false;
}

function stepBullets(run, players, dt) {
  const walls = run.plan.walls;
  for (const b of run.bullets) {
    if (b.delay > 0) {
      b.delay -= dt;
      if (b.delay <= 0 && b.mine) {
        explode(run, players, b.x, b.y, b.aoe || 55, b.dmg, b.owner, false, 'rocket');
        b.life = -1;
      }
      continue;
    }
    b.life -= dt;
    if (applyDamperFieldsToBullet(run, b, dt)) continue;
    if (b.homing > 0 && b.from === 'p') {
      let best = null, bd = 330 * 330;
      for (const e of run.enemies) {
        const d = dist2(e.x, e.y, b.x, b.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) {
        const want = norm(best.x - b.x, best.y - b.y);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx += (want.x * sp - b.vx) * b.homing * dt;
        b.vy += (want.y * sp - b.vy) * b.homing * dt;
        const n = norm(b.vx, b.vy);
        b.vx = n.x * sp; b.vy = n.y * sp;
      }
    }
    const ox = b.x, oy = b.y;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (applyDamperFieldsToBullet(run, b, dt)) continue;
    const moved = Math.hypot(b.x - ox, b.y - oy);
    b.travelled = (b.travelled || 0) + moved;
    if (b.rktMines > 0) {
      b.mineDist = (b.mineDist || 0) + moved;
      if (b.mineDist > 160 && run.bullets.length < MAX_BULLETS) {
        b.mineDist = 0;
        run.bullets.push({ id: nid(), x: b.x, y: b.y, vx: 0, vy: 0, dmg: b.dmg * 0.34, from: 'p', owner: b.owner, life: 1.0 * (b.rangeMul || 1), delay: 0.42, size: 10, aoe: 50 + b.rktMines * 6, kind: 'mine', mine: true, rangeMul: b.rangeMul || 1 });
        run.fx.push({ t: 'mine', x: Math.round(b.x), y: Math.round(b.y) });
      }
    }
    if (b.detonateDist && b.travelled >= b.detonateDist) {
      explode(run, players, b.x, b.y, b.aoe || 70, b.dmg, b.owner, false, (b.kind === 'rocketgun' || b.mine) ? 'rocket' : 'blast');
      rocketAftermath(run, players, b);
      b.life = -1; continue;
    }
    if (b.maxDist && b.travelled >= b.maxDist) {
      const n = norm(b.vx || 1, b.vy || 0);
      run.fx.push({ t: 'impact', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind, range: 1, dx: Math.round(n.x * 80), dy: Math.round(n.y * 80) });
      b.life = -1; continue;
    }
    // walls
    let hitWall = false, hitWallAxis = '', hitWallObj = null;
    for (const w of walls) {
      if (aabbHit(b.x, b.y, b.size / 2, w)) {
        hitWall = true; hitWallObj = w;
        const bh = (b.size || 4) / 2;
        const overlapX = Math.min(b.x + bh - w.x, w.x + w.w - (b.x - bh));
        const overlapY = Math.min(b.y + bh - w.y, w.y + w.h - (b.y - bh));
        hitWallAxis = Math.abs(b.vx || 0) > Math.abs(b.vy || 0) * 1.25 ? 'x' : (Math.abs(b.vy || 0) > Math.abs(b.vx || 0) * 1.25 ? 'y' : (overlapX < overlapY ? 'x' : 'y'));
        break;
      }
    }
    if (hitWall) {
      if (b.bounces > 0) {
        const half = (b.size || 4) / 2 + 0.75;
        if (hitWallAxis === 'x') {
          const fromLeft = ox < hitWallObj.x || (ox <= hitWallObj.x + hitWallObj.w && b.vx > 0);
          b.x = fromLeft ? hitWallObj.x - half : hitWallObj.x + hitWallObj.w + half;
          b.y = oy;
          b.vx *= -0.82;
        } else {
          const fromTop = oy < hitWallObj.y || (oy <= hitWallObj.y + hitWallObj.h && b.vy > 0);
          b.y = fromTop ? hitWallObj.y - half : hitWallObj.y + hitWallObj.h + half;
          b.x = ox;
          b.vy *= -0.82;
        }
        b.bounces--; b.life *= 0.90;
        run.fx.push({ t: 'ricochet', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind, rocket: b.kind === 'rocketgun' ? 1 : 0, left: b.bounces, dx: Math.round((b.vx || 0) / 10), dy: Math.round((b.vy || 0) / 10) });
        continue;
      }
      run.fx.push({ t: 'impact', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind, wall: 1, dx: Math.round((b.vx || 0) / 10), dy: Math.round((b.vy || 0) / 10) });
      if (b.aoe) { explode(run, players, b.x, b.y, b.aoe, b.dmg, b.owner, false, (b.kind === 'rocketgun' || b.mine) ? 'rocket' : 'blast'); rocketAftermath(run, players, b); }
      b.life = -1; continue;
    }
    if (b.from === 'p') {
      for (const e of run.enemies) {
        if (dist2(e.x, e.y, b.x, b.y) < ((e.size + b.size) / 2 + 4) ** 2) {
          if (b.aoe) { explode(run, players, b.x, b.y, b.aoe, b.dmg, b.owner, false, (b.kind === 'rocketgun' || b.mine) ? 'rocket' : 'blast'); rocketAftermath(run, players, b); }
          else {
            const n = norm(b.vx, b.vy);
            run.fx.push({ t: 'impact', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind, dx: Math.round(n.x * 100), dy: Math.round(n.y * 100) });
            damageEnemy(run, players, e, b.dmg, b.owner, b.knock, n.x, n.y);
            if (b.sekSplit > 0) spawnSeekerFragments(run, b.owner, b.x, b.y, b.sekSplit, b.dmg * 0.48, { rangeMul: b.rangeMul || 1, bounces: b.bounces || 0 });
            const blasts = chanceStacks(b.proc || 0);
            for (let bi = 0; bi < blasts; bi++) explode(run, players, b.x, b.y, 70, b.dmg * 0.8, b.owner, false, 'proc');
          }
          b.life = -1; break;
        }
      }
    } else {
      for (const p of players.values()) {
        if (p.alive && dist2(p.x, p.y, b.x, b.y) < ((PLAYER_SIZE + b.size) / 2 + 2) ** 2) {
          damagePlayer(run, p, b.dmg, b.x, b.y);
          b.life = -1; break;
        }
      }
    }
  }
  run.bullets = run.bullets.filter(b => b.life > 0);
}
// ---------------------------------------------------------------- enemies
function nearestAlive(players, x, y) {
  let best = null, bd = Infinity;
  for (const p of players.values()) {
    if (!p.alive) continue;
    const d = dist2(p.x, p.y, x, y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

function stepEnemies(run, players, dt) {
  if (run.phase !== 'play') return;
  const walls = run.plan.walls;
  stepEnemySynergies(run, players, dt);
  for (const e of [...run.enemies]) {
    const def = ENEMIES[e.kind];
    const target = nearestAlive(players, e.x, e.y);
    e.st += dt;
    const half = e.size / 2;
    const spd = enemySpeed(e);

    if (e.kind === 'bouncer') {
      let nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
      for (const w of walls) {
        if (aabbHit(nx, e.y, half, w)) { e.vx *= -1; nx = e.x; }
        if (aabbHit(e.x, ny, half, w)) { e.vy *= -1; ny = e.y; }
      }
      e.x = nx; e.y = ny;
      if (!e.touchCds) e.touchCds = new Map();
      for (const [k, v] of e.touchCds) { const nv = v - dt; if (nv <= 0) e.touchCds.delete(k); else e.touchCds.set(k, nv); }
      for (const p of players.values()) {
        if (!p.alive) continue;
        const sep = resolveEnemyPlayerOverlap(run, e, p, walls, { pad: 10, playerKick: def.push * 0.10, fx: true });
        if (sep) {
          if (!e.touchCds.has(p.id)) { damagePlayer(run, p, enemyDamageValue(e), e.x, e.y); e.touchCds.set(p.id, TOUCH_CD * 0.55); }
          e.vx = -sep.nx * def.spd; e.vy = -sep.ny * def.spd;
        }
      }
      continue;
    }

    if (!target) continue;
    const toT = norm(target.x - e.x, target.y - e.y);
    const dT = Math.hypot(target.x - e.x, target.y - e.y);

    if (e.kind === 'shooter') {
      let mv = 0;
      if (dT > def.keep + 40) mv = 1; else if (dT < def.keep - 60) mv = -1;
      if (mv !== 0) { steerMove(run, e, { x: toT.x * mv, y: toT.y * mv }, spd, dt, { target }); }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS) {
        e.fireCd = enemyFireCooldown(def.fireCd, e);
        const bspd = enemyBulletSpeed(def.bulletSpd, e);
        run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: toT.x * bspd, vy: toT.y * bspd, dmg: enemyDamageValue(e), from: 'e', life: 2.6, size: 7 });
        run.fx.push({ t: 'eshot', id: e.id });
      }
      e.dirX = toT.x; e.dirY = toT.y;
    } else if (e.kind === 'charger') {
      if (e.state === 'move') {
        if (dT < 300) { e.state = 'windup'; e.st = 0; e.dirX = toT.x; e.dirY = toT.y; }
        else { steerMove(run, e, toT, spd, dt, { target }); }
      } else if (e.state === 'windup') {
        e.dirX = toT.x; e.dirY = toT.y;
        if (e.st >= def.windup) { e.state = 'charge'; e.st = 0; }
      } else if (e.state === 'charge') {
        const c = collideWalls(e.x + e.dirX * def.chargeSpd * dt, e.y + e.dirY * def.chargeSpd * dt, half, walls, e.x, e.y);
        const blocked = (c.x === e.x && c.y === e.y); e.x = c.x; e.y = c.y;
        for (const p of players.values()) if (p.alive) {
          const sep = resolveEnemyPlayerOverlap(run, e, p, walls, { pad: 10, playerKick: 16, fx: true });
          if (sep) { damagePlayer(run, p, enemyDamageValue(e), e.x, e.y); e.state = 'cool'; e.st = 0; }
        }
        if (e.st >= def.chargeTime || blocked) { e.state = 'cool'; e.st = 0; }
      } else if (e.state === 'cool') { if (e.st >= def.chargeCd) { e.state = 'move'; e.st = 0; } }
    } else if (e.kind === 'bomber') {
      if (e.state === 'move') {
        steerMove(run, e, toT, spd, dt, { target });
        if (dT < 80) { e.state = 'fuse'; e.st = 0; run.fx.push({ t: 'fuse', id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: def.blast, dur: def.fuse }); }
      } else if (e.state === 'fuse') {
        if (e.st >= def.fuse) {
          explode(run, players, e.x, e.y, def.blast, e.dmg, null, true, 'danger');
          run.enemies = run.enemies.filter(x => x.id !== e.id); run.kills++;
          run.fx.push({ t: 'kill', x: Math.round(e.x), y: Math.round(e.y), kind: e.kind, elite: e.elite, size: e.size });
          dropPickup(run, e.x, e.y, 'GLD', Math.round(def.gld * scaling(run) * 0.6)); dropPickup(run, e.x + 10, e.y, 'EXP', def.xp);
          if (quotaCanOpenPortal(run)) openPortal(run);
        }
      }
    } else if (e.kind === 'glitch') {
      if (e.state === 'move') {
        steerMove(run, e, toT, spd, dt, { target });
        if (e.st >= def.blinkCd && dT < 600) {
          const a = Math.random() * Math.PI * 2; const bx = target.x + Math.cos(a) * 90, by = target.y + Math.sin(a) * 90;
          run.fx.push({ t: 'blink', id: e.id, fx: Math.round(e.x), fy: Math.round(e.y), tx: Math.round(bx), ty: Math.round(by) });
          e.x = bx; e.y = by; e.state = 'strike'; e.st = 0;
        }
      } else if (e.state === 'strike') {
        if (e.st >= def.strikeCd) { if (dT < 75) damagePlayer(run, target, enemyDamageValue(e), e.x, e.y); run.fx.push({ t: 'gstrike', x: Math.round(e.x), y: Math.round(e.y) }); e.state = 'move'; e.st = 0; }
      }
    } else if (e.kind === 'echo') {
      const keep = 220;
      let mv = dT > keep ? 1 : dT < keep * 0.65 ? -0.8 : 0;
      if (mv !== 0) { steerMove(run, e, { x: toT.x * mv, y: toT.y * mv }, spd, dt, { target }); }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS) {
        e.fireCd = enemyFireCooldown(def.mirrorFireCd, e);
        const a = Math.atan2(toT.y, toT.x) + (Math.random() - 0.5) * 0.38;
        const bspd = enemyBulletSpeed(280, e);
        run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: Math.cos(a) * bspd, vy: Math.sin(a) * bspd, dmg: enemyDamageValue(e), from: 'e', life: 2.2, delay: 0.22, size: 7 });
        run.fx.push({ t: 'echo_shot', id: e.id, x: Math.round(e.x), y: Math.round(e.y) });
      }
      e.dirX = toT.x; e.dirY = toT.y;
    } else if (e.kind === 'orbiter') {
      e.phase += dt * 1.15;
      const desired = { x: target.x + Math.cos(e.phase) * def.orbitR, y: target.y + Math.sin(e.phase) * def.orbitR };
      const mv = norm(desired.x - e.x, desired.y - e.y);
      steerMove(run, e, mv, spd, dt, { target: desired });
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS) {
        e.fireCd = enemyFireCooldown(def.fireCd, e);
        const bspd = enemyBulletSpeed(def.bulletSpd, e);
        run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: toT.x * bspd, vy: toT.y * bspd, dmg: enemyDamageValue(e), from: 'e', life: 2.1, size: 6 });
      }
      e.dirX = toT.x; e.dirY = toT.y;
      touchDamage(run, e, players, dt);
    } else if (e.kind === 'damper') {
      // Stationary bullet-damper node. It does not chase; it creates a safe zone for ranged/support enemies.
      e.dirX = toT.x; e.dirY = toT.y;
      e.fxT = (e.fxT || 0) - dt;
      if (e.fxT <= 0) {
        e.fxT = 0.18;
        run.fx.push({ t: 'damper_field', id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: def.fieldR });
      }
    } else if (e.kind === 'anchor') {
      steerMove(run, e, toT, spd, dt, { target });
      for (const p of players.values()) {
        if (!p.alive) continue;
        const d = Math.sqrt(dist2(p.x, p.y, e.x, e.y));
        if (d < def.fieldR) {
          p.slowT = 0.18; p.slowMul = 0.56;
          const n = norm(e.x - p.x, e.y - p.y);
          const cc = collideWalls(p.x + n.x * def.pull * dt, p.y + n.y * def.pull * dt, PLAYER_SIZE / 2, walls, p.x, p.y); p.x = cc.x; p.y = cc.y;
        }
      }
      for (const pk of [...run.pickups]) {
        if (dist2(pk.x, pk.y, e.x, e.y) < (def.fieldR + 90) ** 2) {
          const n = norm(e.x - pk.x, e.y - pk.y); pk.x += n.x * 180 * dt; pk.y += n.y * 180 * dt;
          if (dist2(pk.x, pk.y, e.x, e.y) < (e.size * 0.7) ** 2) { run.pickups = run.pickups.filter(x => x !== pk); run.fx.push({ t: 'consume', x: Math.round(e.x), y: Math.round(e.y) }); }
        }
      }
      e.fxT = (e.fxT || 0) - dt;
      if (e.fxT <= 0) { e.fxT = 0.22; run.fx.push({ t: 'field', id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: def.fieldR }); }
      touchDamage(run, e, players, dt);
    } else if (e.kind === 'splitter') {
      steerMove(run, e, toT, spd, dt, { target });
      touchDamage(run, e, players, dt);
    } else if (e.kind === 'prism') {
      let mv = dT > 360 ? 1 : dT < 260 ? -1 : 0;
      if (mv !== 0) { steerMove(run, e, { x: toT.x * mv, y: toT.y * mv }, spd, dt, { target }); }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS - 3) {
        e.fireCd = enemyFireCooldown(def.fireCd, e);
        const base = Math.atan2(toT.y, toT.x);
        const bspd = enemyBulletSpeed(def.beamSpd, e);
        for (const da of [-0.34, 0, 0.34]) run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: Math.cos(base + da) * bspd, vy: Math.sin(base + da) * bspd, dmg: enemyDamageValue(e), from: 'e', life: 2.3, size: 5 });
        run.fx.push({ t: 'prism', id: e.id, x: Math.round(e.x), y: Math.round(e.y) });
      }
      e.dirX = toT.x; e.dirY = toT.y;
    } else if (e.kind === 'pulse') {
      steerMove(run, e, toT, spd, dt, { target });
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS - 5) {
        e.fireCd = enemyFireCooldown(def.fireCd, e);
        const nx = -toT.y, ny = toT.x;
        const wspd = enemyBulletSpeed(def.waveSpd, e);
        for (let i = -2; i <= 2; i++) run.bullets.push({ id: nid(), x: e.x + nx * i * 18, y: e.y + ny * i * 18, vx: toT.x * wspd, vy: toT.y * wspd, dmg: enemyDamageValue(e), from: 'e', life: 1.4, size: 9 });
        run.fx.push({ t: 'pulse_wave', id: e.id, x: Math.round(e.x), y: Math.round(e.y), dx: toT.x, dy: toT.y });
      }
      e.dirX = toT.x; e.dirY = toT.y;
      touchDamage(run, e, players, dt);
    } else if (e.kind === 'leech') {
      let ally = null, missing = 0;
      for (const a of run.enemies) {
        if (a.id === e.id || a.hp >= a.maxHp) continue;
        const miss = a.maxHp - a.hp;
        if (miss > missing && dist2(a.x, a.y, e.x, e.y) < def.linkR * def.linkR) { ally = a; missing = miss; }
      }
      if (ally) {
        const toA = norm(ally.x - e.x, ally.y - e.y);
        const dd = Math.hypot(ally.x - e.x, ally.y - e.y);
        if (dd > 170) { steerMove(run, e, toA, spd, dt, { target: ally }); }
        e.healCd -= dt;
        e.fxT = (e.fxT || 0) - dt;
        if (e.fxT <= 0) { e.fxT = 0.18; run.fx.push({ t: 'leech_link', id: e.id, target: ally.id, x: Math.round(e.x), y: Math.round(e.y), x2: Math.round(ally.x), y2: Math.round(ally.y) }); }
        if (e.healCd <= 0) { e.healCd = def.healCd; ally.hp = Math.min(ally.maxHp, ally.hp + def.heal); ally.leechLinkT = Math.max(ally.leechLinkT || 0, 1.4); run.fx.push({ t: 'heal_enemy', x: Math.round(ally.x), y: Math.round(ally.y), val: def.heal }); }
      } else {
        steerMove(run, e, toT, spd, dt, { target });
        touchDamage(run, e, players, dt);
      }
    } else if (e.kind === 'herald') {
      const keep = 420;
      const mv = dT > keep ? 1 : dT < keep - 120 ? -0.7 : 0;
      if (mv !== 0) { steerMove(run, e, { x: toT.x * mv, y: toT.y * mv }, spd, dt, { target }); }
      e.summonCd -= dt;
      e.fxT = (e.fxT || 0) - dt;
      if (e.fxT <= 0) { e.fxT = 0.14; run.fx.push({ t: 'tether', id: e.id, target: target.id, x: Math.round(e.x), y: Math.round(e.y), x2: Math.round(target.x), y2: Math.round(target.y) }); }
      if (dT < 480 && e.st > 0.9) { e.st = 0; damagePlayer(run, target, enemyDamageValue(e, def.tetherDmg / Math.max(1, e.dmg)), e.x, e.y); }
      if (e.summonCd <= 0 && run.enemies.length < difficulty(run).maxActive) {
        e.summonCd = Math.max(1.7, def.summonCd - difficulty(run).loop * 0.25);
        const pool = ['grunt','runner','runner','glitch','bouncer','pulse'];
        for (let i = 0; i < 2 + Math.min(3, difficulty(run).loop); i++) spawnEnemy(run, players, pool[Math.floor(Math.random() * pool.length)], false);
        run.fx.push({ t: 'summon', x: Math.round(e.x), y: Math.round(e.y) });
      }
      e.dirX = toT.x; e.dirY = toT.y;
    } else if (e.kind === 'boss') {
      steerMove(run, e, toT, spd, dt, { target });
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS - 12) {
        e.fireCd = def.fireCd * (e.hp < e.maxHp * 0.5 ? 0.65 : 1);
        const n = 10; const base = Math.random() * Math.PI * 2;
        for (let i = 0; i < n; i++) { const a = base + (i / n) * Math.PI * 2; run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: Math.cos(a) * def.bulletSpd, vy: Math.sin(a) * def.bulletSpd, dmg: enemyDamageValue(e, 0.6), from: 'e', life: 3.2, size: 9 }); }
        run.fx.push({ t: 'boss_burst', id: e.id, x: Math.round(e.x), y: Math.round(e.y) });
      }
      touchDamage(run, e, players, dt);
    } else {
      steerMove(run, e, toT, spd, dt, { target });
      touchDamage(run, e, players, dt);
    }
  }
  // Anti-zator pass: enemies should surround/flow, not stack into one blocked clump.
  resolveEnemyCrowd(run, walls, dt);
  // Safety pass: even ranged/non-touch enemies must never remain inside a player.
  resolveEnemyPlayerBodies(run, players, walls);
}

function touchDamage(run, e, players, dt) {
  const walls = run.plan?.walls || [];
  if (!e.touchCds) e.touchCds = new Map();
  for (const p of players.values()) {
    if (!p.alive) continue;
    const key = p.id;
    const sep = resolveEnemyPlayerOverlap(run, e, p, walls, { pad: 9, playerKick: 6, fx: true });
    const cd = e.touchCds.get(key) || 0;
    if (cd > 0) {
      const nv = cd - dt;
      if (nv <= 0) e.touchCds.delete(key); else e.touchCds.set(key, nv);
      continue;
    }
    if (sep) {
      damagePlayer(run, p, enemyDamageValue(e), e.x, e.y);
      e.touchCds.set(key, TOUCH_CD);
    }
  }
}

// ---------------------------------------------------------------- companions
// drones/orbitals: positions derived deterministically from player pos + time
export function orbitalPos(p, i, total, now) {
  const ang = (now * 1.8 + (i / total) * Math.PI * 2);
  const r = 58 + 14 * Math.floor(i / 8);
  return { x: p.x + Math.cos(ang) * r, y: p.y + Math.sin(ang) * r };
}
function stepCompanions(run, players, dt, now) {
  for (const p of players.values()) {
    if (!p.alive) continue;
    // drones: auto-fire nearest enemy
    if (p.stats.drones > 0) {
      p.droneCd -= dt;
      if (p.droneCd <= 0 && run.enemies.length && run.bullets.length < MAX_BULLETS) {
        p.droneCd = Math.max(0.18, 0.8 / Math.sqrt(p.stats.drones));
        let best = null, bd = 480 * 480;
        for (const e of run.enemies) {
          const d = dist2(e.x, e.y, p.x, p.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) {
          const di = Math.floor(Math.random() * p.stats.drones);
          const dp = orbitalPos(p, di, Math.max(1, p.stats.drones), now + 100);
          const n = norm(best.x - dp.x, best.y - dp.y);
          run.bullets.push({ id: nid(), x: dp.x, y: dp.y, vx: n.x * 520, vy: n.y * 520, dmg: 8 * p.stats.dmgMul, from: 'p', owner: p.id, life: 1.1 * (p.stats.bulletRange || 1), size: 4, proc: p.stats.droneProc ? Math.min(0.9, p.stats.procBlast * 0.55 + p.stats.droneProc * 0.10) : 0, kind: 'drone', travelled: 0, maxDist: Math.round(570 * (p.stats.bulletRange || 1)), bounces: p.stats.bulletBounce || 0, rangeMul: p.stats.bulletRange || 1 });
        }
      }
    }
    // orbitals: contact damage with per-enemy cooldown
    if (p.stats.orbitals > 0) {
      for (const [k, v] of p.orbHits) { if (v <= now) p.orbHits.delete(k); }
      for (let i = 0; i < p.stats.orbitals; i++) {
        const op = orbitalPos(p, i, p.stats.orbitals, now);
        if (p.stats.orbReflect > 0) {
          for (const b of [...run.bullets]) {
            if (b.from === 'e' && dist2(b.x, b.y, op.x, op.y) < (20 + p.stats.orbReflect * 4) ** 2) {
              run.bullets = run.bullets.filter(x => x !== b);
              run.fx.push({ t: 'bullet_cut', id: p.id, x: Math.round(op.x), y: Math.round(op.y), count: 1 });
            }
          }
        }
        for (const e of run.enemies) {
          if (p.orbHits.has(e.id)) continue;
          if (dist2(e.x, e.y, op.x, op.y) < ((e.size / 2) + 12) ** 2) {
            damageEnemy(run, players, e, 11 * p.stats.dmgMul, p.id, 0, 0, 0);
            p.orbHits.set(e.id, now + 0.5);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------- pickups
function stepPickups(run, players, dt) {
  for (const pk of [...run.pickups]) {
    let best = null, bd = Infinity;
    for (const p of players.values()) {
      if (!p.alive) continue;
      const d = dist2(p.x, p.y, pk.x, pk.y);
      const magnet = PICKUP_BASE_MAGNET * p.stats.magnetMul;
      if (d < magnet * magnet && d < bd) { bd = d; best = p; }
    }
    if (best) {
      const n = norm(best.x - pk.x, best.y - pk.y);
      const pull = 340 * dt;
      pk.x += n.x * pull; pk.y += n.y * pull;
      if (dist2(best.x, best.y, pk.x, pk.y) < PICKUP_COLLECT * PICKUP_COLLECT) {
        run.pickups = run.pickups.filter(x => x.id !== pk.id);
        grantEconomy(run, players, pk.type, pk.val);
        run.fx.push({ t: 'pick', id: best.id, type: pk.type, val: pk.val, x: Math.round(pk.x), y: Math.round(pk.y) });
      }
    }
  }
}

// ---------------------------------------------------------------- room mods
function stepMods(run, players, dt) {
  if (run.phase !== 'play') return;
  run.roomAge = (run.roomAge || 0) + dt;
  if (run.plan.modifierIds.includes('hunter_contract') && run.hunterTarget && run.roomAge > 38) {
    const h = run.enemies.find(e => e.id === run.hunterTarget);
    if (h && !h.hunterEscalated) {
      h.hunterEscalated = true; h.elite = true; h.maxHp = Math.round(h.maxHp * 1.55); h.hp = h.maxHp; h.dmg = Math.round(h.dmg * 1.35); h.size = Math.round(h.size * 1.12);
      run.fx.push({ t: 'contract_fail', x: Math.round(h.x), y: Math.round(h.y) });
      for (let i = 0; i < 5; i++) spawnEnemy(run, players, ['runner','glitch','bouncer'][Math.floor(Math.random()*3)], false);
    }
  }
  if (run.plan.modifierIds.includes('static_rain')) {
    run.rainT -= dt;
    if (run.rainT <= 0) {
      run.rainT = 2.6 + Math.random() * 2.4;
      const alive = [...players.values()].filter(p => p.alive);
      const nearPlayer = Math.random() < 0.55 && alive.length;
      const target = nearPlayer ? alive[Math.floor(Math.random() * alive.length)] : null;
      const x = target ? target.x + (Math.random() - 0.5) * 260
        : WALL_T + Math.random() * (run.plan.w - WALL_T * 2);
      const y = target ? target.y + (Math.random() - 0.5) * 260
        : WALL_T + Math.random() * (run.plan.h - WALL_T * 2);
      const r = 80;
      run.fx.push({ t: 'rain_warn', x: Math.round(x), y: Math.round(y), r, dur: 1.2 });
      if (!run.pendingStrikes) run.pendingStrikes = [];
      run.pendingStrikes.push({ x, y, r, at: run.now + 1.2 });
    }
  }
  if (run.pendingStrikes) {
    for (const s of [...run.pendingStrikes]) {
      if (run.now >= s.at) {
        run.pendingStrikes = run.pendingStrikes.filter(x => x !== s);
        run.fx.push({ t: 'rain_hit', x: Math.round(s.x), y: Math.round(s.y), r: s.r });
        for (const p of players.values()) {
          if (p.alive && dist2(p.x, p.y, s.x, s.y) < (s.r + PLAYER_SIZE / 2) ** 2) damagePlayer(run, p, 25, s.x, s.y);
        }
        for (const e of [...run.enemies]) {
          if (dist2(e.x, e.y, s.x, s.y) < (s.r + e.size / 2) ** 2) damageEnemy(run, players, e, 60, null, 0, 0, 0);
        }
      }
    }
  }
}

// ---------------------------------------------------------------- interact
function tryInteract(run, players, p) {
  if (!p.alive) return;
  // portal first
  if (run.portal.open && dist2(p.x, p.y, run.portal.x, run.portal.y) < INTERACT_DIST ** 2) {
    beginTransition(run, players);
    return;
  }
  for (const o of run.plan.interactables) {
    if (o.opened) continue;
    if (dist2(p.x, p.y, o.x, o.y) > INTERACT_DIST ** 2) continue;
    if (o.type === 'chest') { openChest(run, players, p, o); return; }
    // bet handled via casino message (modal), but E near bet just notifies client to open modal
    if (o.type === 'bet') { run.fx.push({ t: 'bet_ui', id: p.id, obj: o.id }); return; }
  }
}


function weaponChoiceDisabled(p, opt) {
  if (!opt) return 'НЕТ ВАРИАНТА';
  if (opt.kind === 'weapon' && p.weapons.includes(opt.weapon)) return 'УЖЕ ЕСТЬ';
  if (opt.kind === 'weapon_upgrade' && opt.reqWeapon && !p.weapons.includes(opt.reqWeapon)) return `НУЖЕН ${WEAPONS[opt.reqWeapon]?.label || opt.reqWeapon}`;
  return '';
}

function makeWeaponChestChoices(p, rng = Math.random) {
  const pool = WEAPON_CHEST_REWARDS
    .filter(opt => !(opt.kind === 'weapon' && p.weapons.includes(opt.weapon)))
    .map(opt => {
      const disabledReason = weaponChoiceDisabled(p, opt);
      return { ...opt, disabled: disabledReason ? 1 : 0, disabledReason };
    });
  const choices = [];
  const used = new Set();
  let guard = 0;
  while (choices.length < 3 && guard++ < 100 && pool.length) {
    const opt = pool[Math.floor(rng() * pool.length)];
    if (!opt || used.has(opt.id)) continue;
    used.add(opt.id);
    choices.push(opt);
  }
  const enabled = pool.filter(o => !o.disabled);
  if (enabled.length && choices.every(o => o.disabled)) choices[0] = enabled[Math.floor(rng() * enabled.length)];
  return choices;
}


function ensureActive(p) {
  if (!p.active || typeof p.active !== 'object') p.active = { core: null, level: 0, mutations: [] };
  if (!Array.isArray(p.active.mutations)) p.active.mutations = [];
  p.active.mutations = p.active.mutations.filter(id => ACTIVE_MUTATIONS[id]).slice(0, ACTIVE_MUTATION_SLOTS);
  if (p.active.core && !ACTIVE_CORES[p.active.core]) { p.active.core = null; p.active.level = 0; p.active.mutations = []; }
  if (p.active.core && (!p.active.level || p.active.level < 1)) p.active.level = 1;
  return p.active;
}
function activeHasMutation(p, id) { return ensureActive(p).mutations.includes(id); }
function activeMutationLabels(p) { return ensureActive(p).mutations.map(id => ACTIVE_MUTATIONS[id]?.label || id.toUpperCase()); }
function addActiveChoiceMeta(opt) {
  const tone = opt.tone || (opt.kind && String(opt.kind).includes('mutation') ? 'purple' : 'cyan');
  return { ...opt, tone };
}
function makeCoreChoice(coreId, kind, p) {
  const c = ACTIVE_CORES[coreId];
  const a = ensureActive(p);
  const current = a.core ? ACTIVE_CORES[a.core]?.label : 'НЕТ Q';
  const replace = kind === 'active_core_replace';
  return addActiveChoiceMeta({
    id: `${kind}_${coreId}`, kind, core: coreId,
    label: replace ? `ЗАМЕНИТЬ: ${c.label}` : `Q CORE: ${c.label}`,
    actionLabel: replace ? 'ЗАМЕНИТ CORE' : 'УСТАНОВИТ CORE',
    preview: replace ? `${current} → ${c.label}. Мутации сохранятся и начнут работать иначе.` : `Q станет ${c.label} I.`,
    desc: c.desc,
    tone: c.tone
  });
}
function makeUpgradeCoreChoice(p) {
  const a = ensureActive(p); const c = ACTIVE_CORES[a.core];
  return addActiveChoiceMeta({
    id: `active_upgrade_${a.core}_${a.level + 1}`, kind: 'active_upgrade_core', core: a.core,
    label: `${c.label} ${roman(a.level)} → ${roman(a.level + 1)}`,
    actionLabel: 'УЛУЧШИТ CORE', preview: `Level ${a.level + 1}: ${c.upgrade?.join(' · ') || '+сила'}`,
    desc: c.desc, tone: c.tone
  });
}
function makeMutationChoice(mutId, p, replaceIdx = -1) {
  const m = ACTIVE_MUTATIONS[mutId]; const a = ensureActive(p);
  const replace = replaceIdx >= 0;
  const old = replace ? ACTIVE_MUTATIONS[a.mutations[replaceIdx]]?.label || a.mutations[replaceIdx] : '';
  return addActiveChoiceMeta({
    id: replace ? `active_replace_mut_${replaceIdx}_${mutId}` : `active_mut_${mutId}`,
    kind: replace ? 'active_replace_mutation' : 'active_add_mutation', mutation: mutId, replaceIdx,
    label: replace ? `MUTATE: ${old} → ${m.label}` : `MUTATION: ${m.label}`,
    actionLabel: replace ? 'ЗАМЕНИТ МУТАЦИЮ' : 'ДОБАВИТ МУТАЦИЮ',
    preview: `${m.label} войдёт в текущую Q. При 2+ мутациях сигнал может грязно сшиться во время каста: ${m.desc}`,
    desc: m.desc, tone: m.tone
  });
}
function roman(n) { return n <= 1 ? 'I' : n === 2 ? 'II' : n === 3 ? 'III' : String(n); }
function pickUnique(rng, arr, used = new Set()) {
  const pool = arr.filter(x => !used.has(x));
  if (!pool.length) return null;
  const x = pool[Math.floor(rng() * pool.length)]; used.add(x); return x;
}
function makeAbilityChestChoices(p, rng = Math.random) {
  const a = ensureActive(p);
  const choices = [];
  const used = new Set();
  const coreIds = Object.keys(ACTIVE_CORES);
  const mutIds = Object.keys(ACTIVE_MUTATIONS);
  if (!a.core) {
    while (choices.length < 3) {
      const id = pickUnique(rng, coreIds, used); if (!id) break;
      choices.push(makeCoreChoice(id, 'active_core_install', p));
    }
    return choices;
  }

  if (a.level < 3) choices.push(makeUpgradeCoreChoice(p));
  const availableMuts = mutIds.filter(id => !a.mutations.includes(id));
  if (a.mutations.length < ACTIVE_MUTATION_SLOTS && availableMuts.length) {
    choices.push(makeMutationChoice(pickUnique(rng, availableMuts, used), p));
  } else if (availableMuts.length && a.mutations.length) {
    const idx = Math.floor(rng() * a.mutations.length);
    choices.push(makeMutationChoice(pickUnique(rng, availableMuts, used), p, idx));
  }
  const otherCores = coreIds.filter(id => id !== a.core);
  if (otherCores.length) choices.push(makeCoreChoice(pickUnique(rng, otherCores, used), 'active_core_replace', p));

  // One side-grade keeps ABL chests useful for mobility builds without stealing the Q identity.
  if (choices.length < 3) {
    const side = ABILITY_CHEST_REWARDS[Math.floor(rng() * ABILITY_CHEST_REWARDS.length)];
    choices.push(addActiveChoiceMeta({ ...side, actionLabel: 'SIDE UPGRADE', preview: side.desc, tone: 'cyan' }));
  }
  while (choices.length < 3 && availableMuts.length) choices.push(makeMutationChoice(pickUnique(rng, availableMuts, used), p));
  return choices.slice(0, 3);
}

function applyAbilityChestOption(run, players, p, opt) {
  if (!opt) return false;
  const a = ensureActive(p);
  let label = opt.label || opt.id;
  if (opt.kind === 'active_core_install') {
    if (!ACTIVE_CORES[opt.core]) return false;
    p.active.core = opt.core; p.active.level = 1; p.active.mutations = [];
    label = `Q CORE: ${ACTIVE_CORES[opt.core].label} I`;
  } else if (opt.kind === 'active_core_replace') {
    if (!ACTIVE_CORES[opt.core]) return false;
    p.active.core = opt.core; p.active.level = Math.max(1, p.active.level || 1);
    label = `Q REPLACED: ${ACTIVE_CORES[opt.core].label} ${roman(p.active.level)}`;
  } else if (opt.kind === 'active_upgrade_core') {
    if (!a.core) return false;
    p.active.level = Math.min(3, Math.max(1, p.active.level || 1) + 1);
    label = `Q UPGRADE: ${ACTIVE_CORES[p.active.core].label} ${roman(p.active.level)}`;
  } else if (opt.kind === 'active_add_mutation') {
    if (!a.core || !ACTIVE_MUTATIONS[opt.mutation]) return false;
    if (!p.active.mutations.includes(opt.mutation)) {
      if (p.active.mutations.length >= ACTIVE_MUTATION_SLOTS) return false;
      p.active.mutations.push(opt.mutation);
    }
    label = `Q MUTATION: ${ACTIVE_MUTATIONS[opt.mutation].label}`;
  } else if (opt.kind === 'active_replace_mutation') {
    if (!a.core || !ACTIVE_MUTATIONS[opt.mutation]) return false;
    const idx = Math.max(0, Math.min(p.active.mutations.length - 1, opt.replaceIdx | 0));
    if (!p.active.mutations.length) return false;
    p.active.mutations[idx] = opt.mutation;
    p.active.mutations = [...new Set(p.active.mutations)].slice(0, ACTIVE_MUTATION_SLOTS);
    label = `Q MUTATION: ${ACTIVE_MUTATIONS[opt.mutation].label}`;
  } else if (opt.kind === 'ability_upgrade') {
    const u = UPGRADES.find(x => x.id === opt.upgrade);
    if (!u) return false;
    u.apply(p.stats);
    p.dashCharges = Math.min(dashMax(p), p.dashCharges + (opt.upgrade === 'dash' ? 1 : 0));
    label = u.label;
  } else if (opt.kind === 'stat') {
    if (opt.stat === 'spd') p.stats.spdMul *= 1.12;
    else if (opt.stat === 'dashflow') p.stats.dashRegenMul *= 1.2;
    else return false;
  } else return false;
  ensureActive(p);
  p.hp = Math.min(p.hp, maxHp(p));
  p.dashCharges = Math.min(dashMax(p), p.dashCharges);
  run.fx.push({ t: 'ability_get', id: p.id, label, x: Math.round(p.x), y: Math.round(p.y) });
  run.fx.push({ t: 'chest_open', id: p.id, chest: 'ABL', rewards: [label], x: Math.round(p.x), y: Math.round(p.y) });
  return true;
}

function applyRandomCasinoAbility(run, players, p, pl = {}) {
  const choices = makeAbilityChestChoices(p, Math.random);
  const opt = choices.find(o => !o.disabled) || choices[0];
  if (!opt) return false;
  const beforeFx = run.fx.length;
  const ok = applyAbilityChestOption(run, players, p, opt);
  if (ok) {
    pl.abilityLabel = opt.actionLabel ? `${opt.actionLabel}: ${opt.label}` : opt.label;
    // Casino results should be compact; remove chest_open duplicate if it was just pushed.
    run.fx = run.fx.filter((f, i) => i < beforeFx || f.t !== 'chest_open');
  }
  return ok;
}

function applyWeaponChestOption(run, players, p, opt) {
  if (!opt) return false;
  const disabledReason = weaponChoiceDisabled(p, opt);
  if (disabledReason) {
    run.fx.push({ t: 'denied', id: p.id, x: Math.round(p.x), y: Math.round(p.y), reason: disabledReason, chest: 'WPN' });
    return false;
  }
  if (opt.kind === 'weapon') {
    if (!p.weapons.includes(opt.weapon)) {
      p.weapons.push(opt.weapon);
      run.fx.push({ t: 'weapon_get', id: p.id, w: WEAPONS[opt.weapon]?.label || opt.label });
    }
  } else if (opt.kind === 'weapon_upgrade') {
    const u = UPGRADES.find(x => x.id === opt.upgrade);
    if (!u) return false;
    u.apply(p.stats);
    run.fx.push({ t: 'weapon_mod', id: p.id, label: u.label, w: u.branch });
  } else if (opt.kind === 'stat') {
    if (opt.stat === 'dmg') p.stats.dmgMul *= 1.18;
    else if (opt.stat === 'fire') p.stats.fireMul *= 1.14;
    run.fx.push({ t: 'weapon_mod', id: p.id, label: opt.label, w: 'ALL' });
  } else return false;
  p.hp = Math.min(p.hp, maxHp(p));
  p.dashCharges = Math.min(dashMax(p), p.dashCharges);
  run.fx.push({ t: 'chest_open', id: p.id, chest: 'WPN', rewards: [opt.label], x: Math.round(p.x), y: Math.round(p.y) });
  return true;
}

function openChest(run, players, p, o) {
  const def = CHESTS[o.chest];
  const debtFloor = run.plan.modifierIds.includes('debt_floor');
  const cost = debtFloor && def.cost > 0 ? Math.max(0, Math.floor(def.cost * 0.5)) : def.cost;
  if (cost > 0) {
    if (p.economy.money < cost) {
      run.fx.push({ t: 'denied', id: p.id, obj: o.id, x: o.x, y: o.y, cost, have: p.economy.money, chest: def.label });
      return;
    }
    p.economy.money -= cost;
  }
  o.opened = true;
  if (debtFloor && o.chest !== 'basic_chest') { run.staticDebt = true; run.fx.push({ t: 'debt', id: p.id, x: o.x, y: o.y }); }
  const rng = Math.random;
  const rewards = [];
  if (o.chest === 'basic_chest') {
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      dropPickup(run, o.x + Math.cos(a) * 50, o.y + Math.sin(a) * 50, rng() < 0.6 ? 'GLD' : 'EXP', 6 + Math.round(rng() * 10));
    }
    if (rng() < 0.15) dropPickup(run, o.x, o.y - 50, 'HEA', 20);
    rewards.push('LOOT');
  } else if (o.chest === 'weapon_chest') {
    p.weaponChestOffer = { choices: makeWeaponChestChoices(p, rng), chestId: o.id };
    run.fx.push({ t: 'weapon_offer', id: p.id, obj: o.id, x: o.x, y: o.y });
    run.fx.push({ t: 'chest_open', id: p.id, obj: o.id, chest: def.label, rewards: ['ВЫБОР WPN'], x: o.x, y: o.y });
    return;
  } else if (o.chest === 'ability_chest') {
    p.abilityChestOffer = { choices: makeAbilityChestChoices(p, rng), chestId: o.id };
    run.fx.push({ t: 'ability_offer', id: p.id, obj: o.id, x: o.x, y: o.y });
    run.fx.push({ t: 'chest_open', id: p.id, obj: o.id, chest: def.label, rewards: ['ВЫБОР ABL'], x: o.x, y: o.y });
    return;
  } else if (o.chest === 'rare_chest') {
    const pool = HERO_UPGRADES.filter(u => u.tier === 1);
    const u = pool[Math.floor(rng() * pool.length)];
    u.apply(p.stats);
    p.hp = Math.min(p.hp, maxHp(p));
    rewards.push(u.label);
  } else if (o.chest === 'cursed_chest') {
    const pool = HERO_UPGRADES.filter(u => u.tier === 2);
    const u = pool[Math.floor(rng() * pool.length)];
    u.apply(p.stats);
    p.hp = Math.min(p.hp, maxHp(p));
    run.staticDebt = true;
    rewards.push(u.label, 'CURSE: STATIC DEBT');
  }
  run.fx.push({ t: 'chest_open', id: p.id, obj: o.id, chest: def.label, rewards, x: o.x, y: o.y, cursed: !!def.cursed });
}


export function handleWeaponPick(run, players, p, choiceIdx) {
  if (!p.weaponChestOffer) return false;
  const idx = choiceIdx | 0;
  if (idx < 0 || idx >= p.weaponChestOffer.choices.length) return false;
  const opt = p.weaponChestOffer.choices[idx];
  const ok = applyWeaponChestOption(run, players, p, opt);
  if (ok) p.weaponChestOffer = null;
  return ok;
}

export function handleAbilityPick(run, players, p, choiceIdx) {
  if (!p.abilityChestOffer) return false;
  const idx = choiceIdx | 0;
  if (idx < 0 || idx >= p.abilityChestOffer.choices.length) return false;
  const opt = p.abilityChestOffer.choices[idx];
  const ok = applyAbilityChestOption(run, players, p, opt);
  if (ok) p.abilityChestOffer = null;
  return ok;
}

export function handleCasino(run, players, p, stakeKey, knownUnlockedSkins = []) {
  const fail = (error) => ({ ok: false, error, stakeKey });
  if (!p.alive) return fail('ИГРОК DOWN');
  if (run.phase !== 'play') return fail('BET ДОСТУПЕН ТОЛЬКО В БОЮ');
  const stakes = { low: 20, mid: 50, high: 120 };
  const stake = stakes[stakeKey];
  if (!stake) return fail('НЕВЕРНАЯ СТАВКА');
  // must be near an unopened bet terminal
  const near = run.plan.interactables.find(o => o.type === 'bet' && dist2(p.x, p.y, o.x, o.y) < (INTERACT_DIST + 30) ** 2);
  if (!near) return fail('ПОДОЙДИ К BET TERMINAL');
  if (p.economy.money < stake) {
    run.fx.push({ t: 'denied', id: p.id, obj: near.id });
    return fail('НЕДОСТАТОЧНО GLD');
  }
  p.economy.money -= stake;
  const res = spinCasino(Math.random, stakeKey, p.stats.luck, knownUnlockedSkins);
  const pl = res.payload;
  if (pl.gld) p.economy.money += pl.gld;
  if (pl.xp) addXp(run, p, pl.xp);
  if (pl.heal) p.hp = Math.min(maxHp(p), p.hp + pl.heal);
  if (pl.dash) { p.stats.dashAdd += 1; p.dashCharges = Math.min(dashMax(p), p.dashCharges + 1); }
  if (pl.ability) {
    // Casino ABL now routes through the same visible core/mutation system as ABL chests.
    if (!applyRandomCasinoAbility(run, players, p, pl)) {
      p.stats.dashAdd += 1; pl.dash = 1; pl.abilityLabel = 'DASH +1';
      p.dashCharges = Math.min(dashMax(p), p.dashCharges + 1);
    }
  }
  if (pl.weapon) {
    const unowned = WEAPON_ORDER.filter(w => !p.weapons.includes(w));
    if (unowned.length) { const w = unowned[Math.floor(Math.random() * unowned.length)]; p.weapons.push(w); pl.weaponLabel = WEAPONS[w].label; }
    else { p.stats.dmgMul *= 1.15; pl.weaponLabel = 'WEAPON DMG +15%'; }
  }
  if (pl.static) run.staticDebt = true;
  const seq = (p.casinoSeq = (p.casinoSeq || 0) + 1);
  const fx = { ok: true, t: 'casino', id: p.id, seq, symbols: res.symbols, outcome: res.outcome, payload: pl, stake };
  run.fx.push(fx);
  return fx;
}

// ---------------------------------------------------------------- transition
function beginTransition(run, players) {
  if (run.phase !== 'play') return;
  run.phase = 'install';
  run.phaseT = 0;
  run.enemies = []; run.bullets = [];
  if (run.skinRoomReward && !run.skinRoomReward.claimed) {
    run.skinRoomReward.claimed = true;
    run.fx.push({ t: 'skin_unlock', skinId: run.skinRoomReward.id, skinRarity: run.skinRoomReward.rarity, source: 'room' });
  }
  run.fx.push({ t: 'transition', skinRarity: run.skinRoomReward?.rarity || '' });
  for (const p of players.values()) {
    if (p.economy.pending > 0 && p.connected) {
      p.offer = { choices: rollUpgradeChoices(Math.random, p.stats.luck), expires: OFFER_TIMEOUT };
    }
  }
}

export function handlePick(run, players, p, choiceIdx) {
  if (run.phase !== 'install' || !p.offer) return false;
  const idx = choiceIdx | 0;
  if (idx < 0 || idx >= p.offer.choices.length) return false;
  const id = p.offer.choices[idx];
  const u = UPGRADES.find(x => x.id === id);
  if (!u) return false;
  u.apply(p.stats);
  p.hp = Math.min(p.hp, maxHp(p));
  p.dashCharges = Math.min(dashMax(p), p.dashCharges);
  p.economy.pending = Math.max(0, p.economy.pending - 1);
  run.fx.push({ t: 'install', id: p.id, label: u.label, cursed: !!u.cursed });
  p.offer = p.economy.pending > 0 ? { choices: rollUpgradeChoices(Math.random, p.stats.luck), expires: OFFER_TIMEOUT } : null;
  return true;
}

function stepInstall(run, players, dt) {
  run.phaseT += dt;
  let waiting = false;
  for (const p of players.values()) {
    if (!p.offer) continue;
    p.offer.expires -= dt;
    if (p.offer.expires <= 0) handlePick(run, players, p, 0); // auto-pick first
    if (p.offer) waiting = true;
  }
  if (!waiting || run.phaseT > 60) {
    run.runDepth++;
    startRoom(run, players);
  }
}

// ---------------------------------------------------------------- active ability core/mutation runtime
function activeCoreLabel(p) {
  const a = ensureActive(p);
  const c = ACTIVE_CORES[a.core];
  if (!c) return 'НЕТ АКТИВКИ';
  const muts = activeMutationLabels(p);
  return `Q: ${c.label} ${roman(a.level || 1)}${muts.length ? ' +' + muts.join('+') : ''}`;
}
function activeCoreDesc(p) {
  const a = ensureActive(p);
  const c = ACTIVE_CORES[a.core];
  if (!c) return 'Q сейчас пустая. Открой ABL chest, чтобы выбрать core-активку.';
  const muts = a.mutations.map(id => ACTIVE_MUTATIONS[id]).filter(Boolean);
  return `${c.label} ${roman(a.level || 1)} — ${c.desc}` + (muts.length ? ` Мутации: ${muts.map(m => `${m.label}: ${m.desc}`).join(' · ')}. При 2+ мутациях сигнал иногда сшивается грязно: дополнительные вспышки не гарантированы и не подписываются как формула.` : ' Мутаций пока нет.');
}
function activeCooldown(p) {
  const a = ensureActive(p);
  const lvl = Math.max(1, a.level || 1);
  const base = a.core === 'blood_ring' ? 7.2 : a.core === 'field_snap' ? 6.8 : a.core === 'bullet_freeze' ? 8.2 : a.core === 'shell_ripper' ? 7.6 : 6.5;
  return Math.max(1.8, base - (lvl - 1) * 0.95 - p.stats.luck * 0.07);
}
function activeField(run, f) {
  if (!run.activeFields) run.activeFields = [];
  const field = { id: nid(), tickT: 0.08, fxT: 0.02, ...f };
  if (!field.maxT) field.maxT = field.ttl || 0;
  if (!field.startR) field.startR = field.r || 0;
  if (!field.baseR) field.baseR = field.r || 0;
  run.activeFields.push(field);
}
function activeTargets(run, x, y, r) {
  return run.enemies.filter(e => dist2(e.x, e.y, x, y) < (r + e.size / 2) ** 2);
}
function activeDamageEnemy(run, players, e, dmg, owner, kind = 'active') {
  const before = e.hp;
  damageEnemy(run, players, e, dmg, owner, 0, 0, 0);
  return Math.max(0, before - Math.max(0, e.hp || 0));
}
function activeCrackShell(run, e, dmg, forceBreakLink = false) {
  if ((e.shellHp || 0) <= 0) return 0;
  const d = Math.max(1, Math.round(dmg));
  if (forceBreakLink) { e.armorLockT = 0; e.armorLinkId = ''; }
  e.shellHp = Math.max(0, (e.shellHp || 0) - d);
  run.fx.push({ t: 'armor_shell', id: e.id, shellType: e.shellType || 'plain', dmg: d, left: Math.round(e.shellHp || 0), x: Math.round(e.x), y: Math.round(e.y), active: 1 });
  if (e.shellHp <= 0) run.fx.push({ t: 'armor_break', id: e.id, shellType: e.shellType || 'plain', x: Math.round(e.x), y: Math.round(e.y), active: 1 });
  return d;
}
function activeShrapnel(run, p, x, y, power = 1) {
  const n = Math.min(18, 8 + Math.floor(power * 3) + ensureActive(p).mutations.length);
  const rangeMul = p.stats.bulletRange || 1;
  for (let i = 0; i < n && run.bullets.length < MAX_BULLETS; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.12;
    run.bullets.push({ id: nid(), x, y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: (7 + power * 2) * p.stats.dmgMul, from: 'p', owner: p.id, life: 0.75 * rangeMul, size: 4, proc: p.stats.procBlast * 0.35, kind: 'active_shrapnel', travelled: 0, maxDist: Math.round(450 * rangeMul), bounces: p.stats.bulletBounce || 0, rangeMul });
  }
  run.fx.push({ t: 'active_mutation', label: 'SHRAPNEL', x: Math.round(x), y: Math.round(y), r: 85, tone: 'cyan' });
}
function activeCasinoRoll(run, p, ctx) {
  const r = Math.random() + p.stats.luck * 0.015;
  if (r < 0.16) { run.staticDebt = true; run.fx.push({ t: 'active_mutation', label: 'CASINO DEBT', x: Math.round(ctx.x), y: Math.round(ctx.y), r: 125, tone: 'purple' }); }
  else if (r < 0.48) { dropPickup(run, ctx.x, ctx.y, 'GLD', 10 + Math.round(Math.random() * 24)); run.fx.push({ t: 'active_mutation', label: 'CASINO GLD', x: Math.round(ctx.x), y: Math.round(ctx.y), r: 95, tone: 'green' }); }
  else if (r < 0.74) { dropPickup(run, ctx.x, ctx.y, 'EXP', 12 + Math.round(Math.random() * 18)); run.fx.push({ t: 'active_mutation', label: 'CASINO EXP', x: Math.round(ctx.x), y: Math.round(ctx.y), r: 95, tone: 'green' }); }
  else { p.hp = Math.min(maxHp(p), p.hp + 12 + (ctx.hitCount || 0) * 2); run.fx.push({ t: 'active_mutation', label: 'CASINO HEAL', x: Math.round(p.x), y: Math.round(p.y), r: 95, tone: 'green' }); }
}

function activeNoise(run, label, x, y, r = 110, tone = 'cyan', extra = {}) {
  run.fx.push({ t: 'active_mutation', label, x: Math.round(x), y: Math.round(y), r: Math.round(r), tone, ...extra });
}
function activeHasAll(p, ...ids) {
  const muts = ensureActive(p).mutations || [];
  return ids.every(id => muts.includes(id));
}
function activeNeedles(run, p, x, y, count, speed, dmg, kind = 'active_noise') {
  const rangeMul = p.stats.bulletRange || 1;
  const n = Math.max(1, Math.min(18, count | 0));
  const off = Math.random() * Math.PI * 2;
  for (let i = 0; i < n && run.bullets.length < MAX_BULLETS; i++) {
    const a = off + (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.26;
    run.bullets.push({ id: nid(), x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, dmg: dmg * p.stats.dmgMul, from: 'p', owner: p.id, life: 0.62 * rangeMul, size: 3 + Math.min(3, n / 8), proc: p.stats.procBlast * 0.25, kind, travelled: 0, maxDist: Math.round(380 * rangeMul), bounces: p.stats.bulletBounce || 0, rangeMul });
  }
}
function applyActiveUnstableReactions(run, players, p, ctx, opts = {}) {
  const a = ensureActive(p);
  const muts = a.mutations || [];
  if (muts.length < 2 || opts.echo) return;
  const lvl = Math.max(1, a.level || 1);
  // Intentional grime: not a deterministic clean banner. Mutations leak into each other with noisy odds.
  const baseChance = Math.min(0.88, 0.56 + (muts.length - 2) * 0.13 + p.stats.luck * 0.01);
  if (Math.random() > baseChance) return;
  let fired = 0;
  const roll = () => Math.random() < (fired ? 0.34 : 0.92);

  if (activeHasAll(p, 'static', 'blood') && roll()) {
    activeField(run, { kind: 'red_static', owner: p.id, x: ctx.x, y: ctx.y, r: Math.round((ctx.r || 130) * 0.66), ttl: 3.0 + lvl * 0.45, tickEvery: 0.38, dmg: (5 + lvl * 2) * p.stats.dmgMul, slow: 0.48, damp: 0.33 });
    activeNoise(run, 'RED STATIC', ctx.x, ctx.y, (ctx.r || 130) * 0.74, 'red');
    fired++;
  }
  if (activeHasAll(p, 'echo', 'shrapnel') && roll()) {
    const ox = ctx.x + (Math.random() - 0.5) * 90;
    const oy = ctx.y + (Math.random() - 0.5) * 90;
    activeNeedles(run, p, ox, oy, 7 + lvl * 2, 430 + lvl * 35, 4 + lvl * 2, 'bad_copy');
    activeNoise(run, 'BAD COPY', ox, oy, 88 + lvl * 12, 'purple');
    fired++;
  }
  if (activeHasAll(p, 'static', 'shrapnel') && roll()) {
    activeNeedles(run, p, ctx.x, ctx.y, 5 + lvl, 250, 5 + lvl, 'slow_shrapnel');
    activeField(run, { kind: 'static', owner: p.id, x: ctx.x, y: ctx.y, r: 72 + lvl * 12, ttl: 2.4 + lvl * 0.35, dmg: 0, slow: 0.30, damp: 0.22 });
    activeNoise(run, 'SLOW NEEDLES', ctx.x, ctx.y, 84, 'cyan');
    fired++;
  }
  if (activeHasAll(p, 'blood', 'leech') && roll()) {
    const heal = Math.min(22, 4 + (ctx.hitCount || 0) * 2.2 + lvl * 3);
    if (heal > 0) p.hp = Math.min(maxHp(p), p.hp + heal);
    activeNoise(run, `RED FEED +${Math.round(heal)}`, p.x, p.y, 76 + lvl * 8, 'green');
    fired++;
  }
  if (activeHasAll(p, 'armor_crack', 'leech') && roll()) {
    let cracked = 0;
    for (const e of run.enemies) {
      if (dist2(e.x, e.y, ctx.x, ctx.y) < ((ctx.r || 130) + 55 + e.size / 2) ** 2) cracked += activeCrackShell(run, e, 18 + lvl * 8, false);
    }
    if (cracked > 0) {
      p.hp = Math.min(maxHp(p), p.hp + Math.min(20, 4 + cracked * 0.08));
      activeNoise(run, 'SHELL FEED', ctx.x, ctx.y, (ctx.r || 130) + 70, 'green');
      fired++;
    }
  }
  if (activeHasAll(p, 'casino', 'void') && roll()) {
    if (Math.random() < 0.45) {
      dropPickup(run, p.x + (Math.random() - 0.5) * 80, p.y + (Math.random() - 0.5) * 80, 'GLD', 7 + Math.round(Math.random() * 18));
      activeNoise(run, 'FALSE WIN', p.x, p.y, 96, 'green');
    } else {
      p.invuln = Math.max(p.invuln || 0, 0.7 + lvl * 0.05);
      activeNoise(run, 'VOID CREDIT', p.x, p.y, 108, 'purple');
    }
    fired++;
  }
  if (ctx.core === 'bullet_freeze' && activeHasAll(p, 'shrapnel') && (ctx.hitCount || 0) > 0 && roll()) {
    const n = Math.min(14, 3 + (ctx.hitCount || 0));
    activeNeedles(run, p, ctx.x, ctx.y, n, 360, 5 + lvl * 1.5, 'frozen_shatter');
    activeNoise(run, 'SHATTER', ctx.x, ctx.y, ctx.r || 150, 'cyan');
    fired++;
  }
  if (ctx.core === 'shell_ripper' && activeHasAll(p, 'shrapnel') && roll()) {
    activeNeedles(run, p, ctx.x, ctx.y, 8 + lvl * 2, 470, 6 + lvl * 2, 'shell_shard');
    activeNoise(run, 'SHELL SHARDS', ctx.x, ctx.y, (ctx.r || 140) + 30, 'purple');
    fired++;
  }
  if (ctx.core === 'field_snap' && activeHasAll(p, 'blood', 'echo') && roll()) {
    explode(run, players, ctx.x, ctx.y, 64 + lvl * 12, (8 + lvl * 4 + (ctx.hitCount || 0)) * p.stats.dmgMul, p.id, false, 'blood');
    activeNoise(run, 'LATE PULSE', ctx.x, ctx.y, 102 + lvl * 12, 'red');
    fired++;
  }
}

function applyActiveMutations(run, players, p, ctx, opts = {}) {
  const a = ensureActive(p);
  const lvl = a.level || 1;
  const mods = opts.skipEcho ? a.mutations.filter(id => id !== 'echo') : a.mutations;
  for (const id of mods) {
    if (id === 'static') {
      activeField(run, { kind: 'static', owner: p.id, x: ctx.x, y: ctx.y, r: Math.round((ctx.r || 120) * (0.80 + lvl * 0.06)), ttl: 4.2 + lvl * 0.9, dmg: 0, slow: Math.max(0.24, 0.38 - lvl * 0.04), damp: Math.max(0.20, 0.42 - lvl * 0.06) });
      run.fx.push({ t: 'active_mutation', label: 'STATIC', x: Math.round(ctx.x), y: Math.round(ctx.y), r: Math.round((ctx.r || 120) * 0.72), tone: 'cyan' });
    } else if (id === 'blood') {
      if (p.hp > 16) p.hp = Math.max(1, p.hp - Math.max(4, Math.round(maxHp(p) * 0.035)));
      explode(run, players, ctx.x, ctx.y, 92 + lvl * 16, (14 + lvl * 5 + (ctx.hitCount || 0) * 1.5) * p.stats.dmgMul, p.id, false, 'blood');
      run.fx.push({ t: 'active_mutation', label: 'BLOOD', x: Math.round(ctx.x), y: Math.round(ctx.y), r: 105 + lvl * 16, tone: 'red' });
    } else if (id === 'echo' && !opts.echo) {
      if (!run.pendingActives) run.pendingActives = [];
      run.pendingActives.push({ owner: p.id, at: run.now + 0.9, core: a.core, level: Math.max(1, lvl - 1), echo: 1 });
      run.fx.push({ t: 'active_mutation', label: 'ECHO ARMED', x: Math.round(ctx.x), y: Math.round(ctx.y), r: 90, tone: 'purple' });
    } else if (id === 'shrapnel') activeShrapnel(run, p, ctx.x, ctx.y, lvl);
    else if (id === 'casino') activeCasinoRoll(run, p, ctx);
    else if (id === 'void') {
      p.invuln = Math.max(p.invuln || 0, 0.75 + lvl * 0.16);
      run.fx.push({ t: 'dash', id: p.id, fx: Math.round(p.x - (p.dirX || 1) * 20), fy: Math.round(p.y - (p.dirY || 0) * 20), tx: Math.round(p.x + (p.dirX || 1) * 20), ty: Math.round(p.y + (p.dirY || 0) * 20) });
      run.fx.push({ t: 'active_mutation', label: 'VOID PHASE', x: Math.round(p.x), y: Math.round(p.y), r: 80, tone: 'purple' });
    } else if (id === 'leech') {
      const heal = Math.min(30, 5 + (ctx.hitCount || 0) * 3 + (ctx.damageDone || 0) * 0.035);
      if (heal > 0) p.hp = Math.min(maxHp(p), p.hp + heal);
      run.fx.push({ t: 'active_mutation', label: `LEECH +${Math.round(heal)}`, x: Math.round(p.x), y: Math.round(p.y), r: 72, tone: 'green' });
    } else if (id === 'armor_crack') {
      let cracked = 0;
      for (const e of run.enemies) if (dist2(e.x, e.y, ctx.x, ctx.y) < ((ctx.r || 130) + 35 + e.size / 2) ** 2) cracked += activeCrackShell(run, e, 38 + lvl * 18, true);
      if (cracked) run.fx.push({ t: 'active_mutation', label: 'ARMOR CRACK', x: Math.round(ctx.x), y: Math.round(ctx.y), r: (ctx.r || 120) + 55, tone: 'purple' });
    }
  }
}
function castActiveCore(run, players, p, opts = {}) {
  const a = ensureActive(p);
  const core = opts.core || a.core;
  const lvl = opts.level || a.level || 1;
  const ctx = { x: p.x, y: p.y, r: 120, hitCount: 0, damageDone: 0, core };
  if (core === 'blood_ring') {
    const start = 96 + lvl * 22;
    const end = 172 + lvl * 46;
    ctx.r = end;
    const ttl = 3.3 + lvl * 1.5; // x1.5 from the longer aura target: 4.8 / 6.3 / 7.8s
    activeField(run, {
      kind: 'blood_ring', owner: p.id, follow: 1, x: p.x, y: p.y, r: start, startR: start, growTo: end,
      ttl, maxT: ttl, tickEvery: Math.max(0.24, 0.46 - lvl * 0.06), dmg: (8 + lvl * 9) * p.stats.dmgMul
    });
    run.fx.push({ t: 'active', id: p.id, label: `BLOOD RING ${roman(lvl)}`, x: Math.round(p.x), y: Math.round(p.y), r: end });
  } else if (core === 'field_snap') {
    ctx.r = 260 + lvl * 55;
    const pull = 78 + lvl * 34;
    for (const e of [...activeTargets(run, p.x, p.y, ctx.r)]) {
      const n = norm(p.x - e.x, p.y - e.y);
      e.x += n.x * pull; e.y += n.y * pull;
      ctx.damageDone += activeDamageEnemy(run, players, e, (16 + lvl * 11) * p.stats.dmgMul, p.id);
      ctx.hitCount++;
    }
    for (const pk of run.pickups) if (dist2(pk.x, pk.y, p.x, p.y) < (ctx.r + 110) ** 2) { const n = norm(p.x - pk.x, p.y - pk.y); pk.x += n.x * (120 + lvl * 30); pk.y += n.y * (120 + lvl * 30); }
    activeField(run, { kind: 'snap_linger', owner: p.id, x: p.x, y: p.y, r: Math.round(ctx.r * 0.62), ttl: 1.7 + lvl * 0.55, tickEvery: 0.18, dmg: 0, slow: Math.max(0.34, 0.62 - lvl * 0.08), pull: 26 + lvl * 12 });
    run.fx.push({ t: 'active', id: p.id, label: `FIELD SNAP ${roman(lvl)}`, x: Math.round(p.x), y: Math.round(p.y), r: ctx.r });
  } else if (core === 'bullet_freeze') {
    ctx.r = 210 + lvl * 70;
    let cut = 0;
    for (const b of run.bullets) {
      if (b.from !== 'e') continue;
      if (dist2(b.x, b.y, p.x, p.y) < (ctx.r + b.size) ** 2) {
        b.vx *= Math.max(0.035, 0.18 - lvl * 0.045); b.vy *= Math.max(0.035, 0.18 - lvl * 0.045);
        b.life = Math.min(b.life, 0.9 + lvl * 0.35); cut++;
        if (lvl >= 3 && Math.random() < 0.32) { b.from = 'p'; b.owner = p.id; b.dmg = 12 * p.stats.dmgMul; }
      }
    }
    for (const e of activeTargets(run, p.x, p.y, ctx.r)) {
      e.activeSlowT = Math.max(e.activeSlowT || 0, 0.75);
      e.activeSlowMul = Math.max(0.05, 0.36 - lvl * 0.10);
      cut++;
    }
    ctx.hitCount = cut;
    const ttl = 3.6 + lvl * 1.4; // 5.0 / 6.4 / 7.8s
    activeField(run, { kind: 'freeze_aura', owner: p.id, follow: 1, x: p.x, y: p.y, r: ctx.r, ttl, maxT: ttl, dmg: 0, slow: Math.max(0.05, 0.34 - lvl * 0.09), damp: Math.max(0.035, 0.16 - lvl * 0.035), tickEvery: 0.16 });
    run.fx.push({ t: 'active', id: p.id, label: `BULLET FREEZE ${roman(lvl)}`, x: Math.round(p.x), y: Math.round(p.y), r: ctx.r });
  } else if (core === 'shell_ripper') {
    ctx.r = 195 + lvl * 58;
    for (const e of [...activeTargets(run, p.x, p.y, ctx.r)]) {
      const shell = activeCrackShell(run, e, 80 + lvl * 55, true);
      if (shell) ctx.hitCount++;
      ctx.damageDone += shell;
      if (!shell) {
        e.activeExposeT = Math.max(e.activeExposeT || 0, 3.0 + lvl * 0.9);
        e.activeExposeMul = Math.max(e.activeExposeMul || 1, 1.28 + lvl * 0.22);
        e.activeSlowT = Math.max(e.activeSlowT || 0, 0.55 + lvl * 0.15);
        e.activeSlowMul = Math.min(e.activeSlowMul || 1, Math.max(0.36, 0.68 - lvl * 0.10));
        ctx.damageDone += activeDamageEnemy(run, players, e, (13 + lvl * 7) * p.stats.dmgMul, p.id);
        ctx.hitCount++;
        run.fx.push({ t: 'active_mutation', label: 'EXPOSED', x: Math.round(e.x), y: Math.round(e.y), r: Math.round(e.size + 42), tone: 'purple' });
      }
    }
    run.fx.push({ t: 'active', id: p.id, label: `SHELL RIPPER ${roman(lvl)}`, x: Math.round(p.x), y: Math.round(p.y), r: ctx.r });
  }
  applyActiveMutations(run, players, p, ctx, { echo: opts.echo, skipEcho: opts.echo });
  applyActiveUnstableReactions(run, players, p, ctx, { echo: opts.echo });
  return ctx;
}
function stepActiveFields(run, players, dt) {
  if (!run.activeFields) run.activeFields = [];
  if (!run.pendingActives) run.pendingActives = [];
  for (const pe of [...run.pendingActives]) {
    if (run.now >= pe.at) {
      run.pendingActives = run.pendingActives.filter(x => x !== pe);
      const p = players.get(pe.owner);
      if (p?.alive) castActiveCore(run, players, p, { core: pe.core, level: pe.level, echo: 1 });
    }
  }
  for (const f of [...run.activeFields]) {
    const owner = players.get(f.owner);
    if (f.follow && owner?.alive) { f.x = owner.x; f.y = owner.y; }
    if (f.growTo && f.maxT > 0) {
      const t = Math.max(0, Math.min(1, 1 - (f.ttl || 0) / f.maxT));
      f.r = Math.round((f.startR || f.r || 0) + (f.growTo - (f.startR || f.r || 0)) * t);
    }
    f.ttl -= dt; f.tickT -= dt; f.fxT -= dt;
    if (f.fxT <= 0) {
      f.fxT = f.kind === 'blood_ring' || f.kind === 'freeze_aura' ? 0.13 : 0.18;
      run.fx.push({ t: 'active_field', kind: f.kind, x: Math.round(f.x), y: Math.round(f.y), r: f.r, tone: f.kind === 'blood_ring' ? 'red' : (f.kind === 'red_static' || f.kind === 'snap_linger' ? 'purple' : 'cyan') });
    }
    if (f.kind === 'static' || f.kind === 'red_static' || f.kind === 'freeze_aura' || f.kind === 'snap_linger') {
      for (const e of run.enemies) if (!f.bulletsOnly && dist2(e.x, e.y, f.x, f.y) < (f.r + e.size / 2) ** 2) {
        e.activeSlowT = Math.max(e.activeSlowT || 0, f.kind === 'freeze_aura' ? 0.32 : 0.20);
        e.activeSlowMul = f.slow || 0.55;
        if (f.kind === 'snap_linger' && f.pull) { const n = norm(f.x - e.x, f.y - e.y); e.x += n.x * f.pull * dt * 3.0; e.y += n.y * f.pull * dt * 3.0; }
      }
      if (f.kind !== 'snap_linger') for (const b of run.bullets) if (dist2(b.x, b.y, f.x, f.y) < (f.r + b.size) ** 2) {
        if (f.kind === 'freeze_aura' && b.from !== 'e') continue;
        const damp = Math.pow(f.damp || 0.45, dt * (f.kind === 'freeze_aura' ? 5.2 : 3.0));
        b.vx *= damp; b.vy *= damp;
        if (Math.hypot(b.vx, b.vy) < (f.kind === 'freeze_aura' ? 52 : 32) && b.from === 'e') { b.life = -1; run.fx.push({ t: 'bullet_stop', x: Math.round(b.x), y: Math.round(b.y), kind: b.kind || '' }); }
      }
    }
    if (f.tickT <= 0) {
      f.tickT = f.tickEvery || 0.35;
      if (f.kind === 'blood_ring' || f.kind === 'red_static') {
        const p = players.get(f.owner);
        for (const e of [...activeTargets(run, f.x, f.y, f.r)]) activeDamageEnemy(run, players, e, f.dmg || 8, f.owner);
        if (p && activeHasMutation(p, 'leech')) p.hp = Math.min(maxHp(p), p.hp + 1.6);
        run.fx.push({ t: 'active_tick', kind: f.kind, x: Math.round(f.x), y: Math.round(f.y), r: f.r, tone: f.kind === 'red_static' ? 'purple' : 'red' });
      }
    }
  }
  run.activeFields = run.activeFields.filter(f => f.ttl > 0);
  run.bullets = run.bullets.filter(b => b.life > 0);
}

// ---------------------------------------------------------------- players
function doActive(run, players, p) {
  if (p.activeCd > 0) return;
  const a = ensureActive(p);
  if (!a.core) { run.fx.push({ t: 'active_denied', id: p.id, reason: 'missing', label: 'НЕТ АКТИВКИ', x: Math.round(p.x), y: Math.round(p.y) }); p.activeCd = 0.25; return; }
  p.activeCd = activeCooldown(p);
  castActiveCore(run, players, p);
}

function stepPlayers(run, players, dt) {
  for (const p of players.values()) {
    if (!p.connected) continue;
    p.invuln = Math.max(0, p.invuln - dt);
    p.activeCd = Math.max(0, (p.activeCd || 0) - dt);
    p.activeBuffT = Math.max(0, (p.activeBuffT || 0) - dt);
    p.slowT = Math.max(0, (p.slowT || 0) - dt);
    // weapon recoil / ammo regen
    if (typeof p.shgCharges !== 'number') p.shgCharges = 4;
    if (typeof p.shgReload !== 'number') p.shgReload = 0;
    const shgDef = WEAPONS.shotgun;
    if (p.shgCharges < shgDef.charges) {
      // SHG is a shell/charge weapon: fire-rate upgrades help only slightly so the reload remains readable.
      const reloadScale = Math.max(0.55, 0.78 + Math.min(1.5, Math.max(0, p.stats.fireMul - 1)) * 0.18);
      p.shgReload += dt * reloadScale;
      const every = shgDef.chargeRegen;
      while (p.shgCharges < shgDef.charges && p.shgReload >= every) { p.shgReload -= every; p.shgCharges++; }
    } else p.shgReload = 0;
    if ((p.recoilT || 0) > 0 && run.phase === 'play') {
      const step = Math.min(dt, p.recoilT);
      const c = collideWalls(p.x + (p.recoilX || 0) * step, p.y + (p.recoilY || 0) * step, PLAYER_SIZE / 2, run.plan.walls, p.x, p.y);
      p.x = c.x; p.y = c.y; p.recoilT -= step;
    }
    // dash regen
    const dm = dashMax(p);
    if (p.dashCharges < dm) {
      p.dashTimer += dt;
      if (p.dashTimer >= DASH_REGEN / Math.max(0.25, p.stats.dashRegenMul || 1)) { p.dashTimer = 0; p.dashCharges++; }
    } else p.dashTimer = 0;

    if (!p.alive) continue;
    // movement
    let mx = p.moveX, my = p.moveY;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (ml > 0.01 && run.phase === 'play') {
      const s = speed(p);
      const c = collideWalls(p.x + mx * s * dt, p.y + my * s * dt, PLAYER_SIZE / 2, run.plan.walls, p.x, p.y);
      p.x = c.x; p.y = c.y;
    }
    // dash
    if (p.wantDash && p.dashCharges > 0 && run.phase === 'play') {
      let dx = mx, dy = my;
      if (Math.hypot(dx, dy) < 0.01) { const n = norm(p.aimX - p.x, p.aimY - p.y); dx = n.x; dy = n.y; }
      const n = norm(dx, dy);
      const c = collideWalls(p.x + n.x * DASH_DIST, p.y + n.y * DASH_DIST, PLAYER_SIZE / 2, run.plan.walls, p.x, p.y);
      const ox = p.x, oy = p.y;
      run.fx.push({ t: 'dash', id: p.id, fx: Math.round(p.x), fy: Math.round(p.y), tx: Math.round(c.x), ty: Math.round(c.y) });
      if (p.stats.voidStep > 0) {
        const mx = (ox + c.x) / 2, my = (oy + c.y) / 2;
        explode(run, players, mx, my, 58 + p.stats.voidStep * 12, (18 + p.stats.voidStep * 7) * p.stats.dmgMul, p.id, false, 'void');
      }
      if (p.stats.dashClone > 0) explode(run, players, ox, oy, 46 + p.stats.dashClone * 8, (10 + p.stats.dashClone * 5) * p.stats.dmgMul, p.id, false, 'echo');
      if (p.stats.dashCut > 0) {
        const minx = Math.min(ox, c.x) - 80, maxx = Math.max(ox, c.x) + 80, miny = Math.min(oy, c.y) - 80, maxy = Math.max(oy, c.y) + 80;
        let cut = 0;
        run.bullets = run.bullets.filter(b => {
          if (b.from !== 'e') return true;
          if (b.x >= minx && b.x <= maxx && b.y >= miny && b.y <= maxy) { cut++; return false; }
          return true;
        });
        if (cut) run.fx.push({ t: 'bullet_cut', id: p.id, x: Math.round((ox + c.x) / 2), y: Math.round((oy + c.y) / 2), count: cut });
      }
      p.x = c.x; p.y = c.y;
      p.dashCharges--;
      p.invuln = Math.max(p.invuln, DASH_INVULN);
    }
    p.wantDash = false;
    if (p.wantActive && run.phase === 'play') doActive(run, players, p);
    p.wantActive = false;
    // weapon switch
    if (p.wantWeapon >= 0 && p.wantWeapon < p.weapons.length) p.weaponIdx = p.wantWeapon;
    p.wantWeapon = -1;
    // interact
    if (p.wantInteract && run.phase === 'play') tryInteract(run, players, p);
    p.wantInteract = false;
    // fire
    if (run.phase === 'play') fireWeapon(run, players, p, dt);
  }
}

// ---------------------------------------------------------------- main step
export function step(run, players, dt, now) {
  run.now = now;
  run.tick++;
  if (run.phase === 'lost') {
    run.phaseT += dt;
    if (run.phaseT > 4) resetRun(run, players);
    return;
  }
  if (run.phase === 'install') {
    stepPlayers(run, players, dt);
    stepPickups(run, players, dt);
    stepInstall(run, players, dt);
    return;
  }
  stepPlayers(run, players, dt);
  stepActiveFields(run, players, dt);
  director(run, players, dt);
  stepEnemies(run, players, dt);
  stepBullets(run, players, dt);
  stepCompanions(run, players, dt, now);
  stepPickups(run, players, dt);
  stepMods(run, players, dt);
  // all dead?
  const connected = [...players.values()].filter(p => p.connected);
  if (connected.length && connected.every(p => !p.alive)) {
    run.phase = 'lost'; run.phaseT = 0;
    run.fx.push({ t: 'run_lost', depth: run.runDepth, loop: Math.floor(run.runDepth / 4) });
  }
}

// ---------------------------------------------------------------- active ability snapshot
function activeSummary(p) {
  ensureActive(p);
  return { label: activeCoreLabel(p), desc: activeCoreDesc(p) };
}

// ---------------------------------------------------------------- snapshot
export function buildSnapshot(run, players) {
  const ps = [];
  for (const p of players.values()) {
    if (!p.connected) continue;
    ps.push([
      p.id, Math.round(p.x), Math.round(p.y), Math.round(p.hp), maxHp(p),
      p.alive ? 1 : 0, Math.round(p.aimX), Math.round(p.aimY),
      p.weaponIdx, p.weapons.map(w => WEAPONS[w].label),
      p.dashCharges, dashMax(p),
      p.economy.level, p.economy.pending, Math.round(p.economy.money),
      Math.round(p.economy.xp), p.economy.nextLevelXp,
      p.stats.drones, p.stats.orbitals, p.lastSeq, p.name, p.invuln > 0 ? 1 : 0,
      Math.round(speed(p)), Math.ceil((p.activeCd || 0) * 10) / 10, p.activeBuffT > 0 ? 1 : 0,
      activeSummary(p).label, activeSummary(p).desc,
      p.shgCharges ?? 4, (p.shgCharges ?? 4) >= WEAPONS.shotgun.charges ? 0 : Math.max(0, Math.ceil(((WEAPONS.shotgun.chargeRegen - (p.shgReload || 0)) / Math.max(0.55, 0.78 + Math.min(1.5, Math.max(0, p.stats.fireMul - 1)) * 0.18)) * 10) / 10),
      p.skin?.fill || '#f3f3f3', p.skin?.outline || '#00ff66', p.skin?.barrel || '#00ff66', p.skin?.id || 'terminal_mint'
    ]);
  }
  const es = run.enemies.map(e => [
    e.id, KIND_IDX[e.kind], Math.round(e.x), Math.round(e.y),
    Math.round((e.hp / e.maxHp) * 100), e.size, e.state, e.elite ? 1 : 0,
    Math.round((e.dirX || 0) * 100), Math.round((e.dirY || 0) * 100),
    e.shellMax ? Math.round(((e.shellHp || 0) / e.shellMax) * 100) : 0,
    (e.armorLockT || 0) > 0 && e.armorLinkId ? 1 : 0,
    e.armorLinkId || '',
    e.shellType || ''
  ]);
  const bs = run.bullets
    // Delay-buffered echo/enemy shots exist in simulation before launch, but should not be drawn
    // as floating bullets at their future origin. Mines remain visible during their arm delay.
    .filter(b => (b.delay || 0) <= 0 || b.mine)
    .map(b => [
      b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.size, b.from === 'p' ? 1 : 0, b.kind === 'rocketgun' ? 1 : 0, b.kind || ''
    ]);
  const cs = [];
  for (const p of players.values()) {
    if (!p.connected || !p.alive) continue;
    const drones = Math.max(0, p.stats.drones | 0);
    const orbitals = Math.max(0, p.stats.orbitals | 0);
    for (let i = 0; i < orbitals; i++) {
      const op = orbitalPos(p, i, Math.max(1, orbitals), run.now);
      cs.push([`orb:${p.id}:${i}`, p.id, 'orbital', i, Math.round(op.x), Math.round(op.y)]);
    }
    for (let i = 0; i < drones; i++) {
      // Drones intentionally use the same phase offset as drone firing origins.
      // This makes the rendered drone match the real projectile origin.
      const dp = orbitalPos(p, i, Math.max(1, drones), run.now + 100);
      cs.push([`drn:${p.id}:${i}`, p.id, 'drone', i, Math.round(dp.x), Math.round(dp.y)]);
    }
  }
  const ks = run.pickups.map(k => [k.id, k.type, Math.round(k.x), Math.round(k.y)]);
  const os = run.plan.interactables.map(o => [
    o.id, o.type, o.type === 'chest' ? CHESTS[o.chest].label : 'BET',
    o.x, o.y, o.opened ? 1 : 0, o.type === 'chest' ? CHESTS[o.chest].cost : 0
  ]);
  const fx = run.fx;
  run.fx = [];
  return {
    t: 's', tick: run.tick, now: run.now,
    room: {
      id: run.plan.roomId, cat: run.plan.category, special: run.plan.specialRoomId || '',
      loop: run.plan.loopIndex, depth: run.runDepth, inLoop: run.plan.roomInLoop,
      mods: run.plan.modifierIds, quota: run.plan.quota, kills: run.kills,
      w: run.plan.w, h: run.plan.h,
      portal: [Math.round(run.portal.x), Math.round(run.portal.y), run.portal.open ? 1 : 0],
      phase: run.phase,
      skinReward: (run.skinRoomReward && !run.skinRoomReward.claimed) ? (run.skinRoomReward.rarity || 'uncommon') : '',
      director: run.director?.label || '', directorIntent: run.director?.lastIntent || '', directorWave: run.director?.waveIndex || 0
    },
    players: ps, enemies: es, bullets: bs, companions: cs, pickups: ks, objects: os, fx
  };
}

export function buildWalls(run) {
  return run.plan.walls;
}
