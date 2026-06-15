// nncckkrr server simulation — single source of truth, no client authority
import {
  WEAPONS, WEAPON_ORDER, ENEMIES, SPAWN_POOLS, UPGRADES, CHESTS,
  rollUpgradeChoices, defaultStats, spinCasino
} from './data.v2-0-7.js';
import { generateRoom, spawnPoint, enemySpawnPoint, portalSpot, mulberry32, WALL_T } from './mapgen.v2-0-7.js';

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
function chanceStacks(v) {
  const full = Math.floor(Math.max(0, v));
  return full + (Math.random() < Math.max(0, v - full) ? 1 : 0);
}
function openPortal(run) {
  if (run.portal.open) return;
  run.portal.open = true;
  run.fx.push({ t: 'portal_open', x: run.portal.x, y: run.portal.y });
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
    enemies: [], bullets: [], pickups: [],
    portal: null,
    kills: 0, spawned: 0,
    directorT: 1.2,
    rainT: 3,
    fx: [],                  // dopamine events flushed each snapshot
    tick: 0
  };
}

export function createPlayer(id, name, idx) {
  const sp = spawnPoint(idx);
  return {
    id, name: String(name || 'p?').slice(0, 12), idx,
    x: sp.x, y: sp.y, hp: PLAYER_HP, alive: true,
    aimX: sp.x, aimY: sp.y - 100,
    moveX: 0, moveY: 0, fire: false,
    weapons: ['shotgun'], weaponIdx: 0, cd: 0,
    dashCharges: 1, dashTimer: 0, invuln: 0,
    stats: defaultStats(),
    economy: { money: 0, xp: 0, level: 0, nextLevelXp: 40, pending: 0, lifetimeXp: 0 },
    lastSeq: 0,
    droneCd: 0, orbHits: new Map(),
    offer: null,
    touch: new Map(),
    wantDash: false, wantInteract: false, wantWeapon: -1,
    connected: true
  };
}
export function maxHp(p) { return Math.max(20, PLAYER_HP + p.stats.maxHpAdd); }
export function speed(p) { return PLAYER_SPEED * p.stats.spdMul; }
export function dashMax(p) { return 1 + p.stats.dashAdd; }

export function startRoom(run, players) {
  const seed = (run.seedBase + run.runDepth * 7919) >>> 0;
  const loopIndex = Math.floor(run.runDepth / 4);
  run.plan = generateRoom(seed, run.runDepth, loopIndex);
  if (run.staticDebt && run.plan.category !== 'boss') {
    if (!run.plan.modifierIds.includes('static_rain')) run.plan.modifierIds.push('static_rain');
    run.staticDebt = false;
  }
  run.enemies = []; run.bullets = []; run.pickups = [];
  run.pendingStrikes = [];
  run.kills = 0; run.spawned = 0;
  run.directorT = 1.4; run.rainT = 3.5;
  const pp = portalSpot(seed + 0x51F15EED, run.plan.walls, run.plan.interactables);
  run.portal = { x: pp.x, y: pp.y, open: false };
  run.phase = 'play'; run.phaseT = 0;
  let i = 0;
  for (const p of players.values()) {
    const sp = spawnPoint(i++);
    p.x = sp.x; p.y = sp.y;
    if (!p.alive) { p.alive = true; p.hp = Math.round(maxHp(p) * 0.5); }
    else p.hp = Math.min(maxHp(p), p.hp + 15);
    p.invuln = 1.2;
    p.offer = null;
  }
  if (run.plan.category === 'boss') spawnEnemy(run, players, 'boss', false);
  run.fx.push({ t: 'room', roomId: run.plan.roomId, loop: loopIndex, depth: run.runDepth, mods: run.plan.modifierIds, cat: run.plan.category });
}

export function resetRun(run, players) {
  run.runDepth = 0;
  run.staticDebt = false;
  for (const p of players.values()) {
    p.weapons = ['shotgun']; p.weaponIdx = 0;
    p.stats = defaultStats();
    p.economy = { money: 0, xp: 0, level: 0, nextLevelXp: 40, pending: 0, lifetimeXp: 0 };
    p.dashCharges = 1; p.alive = true; p.hp = PLAYER_HP;
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
  return SPAWN_POOLS[Math.min(loop, SPAWN_POOLS.length - 1)];
}
function spawnEnemy(run, players, kind, canElite = true) {
  const def = ENEMIES[kind];
  const rng = Math.random;
  const p = enemySpawnPoint(mulberry32((Math.random() * 1e9) >>> 0), run.plan.walls, [...players.values()].filter(pl => pl.alive));
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
    dirX: 0, dirY: 0
  };
  if (kind === 'bouncer') {
    const a = rng() * Math.PI * 2;
    e.vx = Math.cos(a) * def.spd; e.vy = Math.sin(a) * def.spd;
  }
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
  if (plan.category === 'boss') {
    // boss adds: gentler first boss, nasty after several loops
    const boss = run.enemies.find(e => e.kind === 'boss');
    if (boss && boss.hp < boss.maxHp * 0.55) {
      run.directorT -= dt;
      if (run.directorT <= 0 && run.enemies.length < df.addCap) {
        run.directorT = Math.max(0.9, (7.2 - df.loop * 0.55 - df.late * 0.75) / DIFFICULTY_MULT);
        const pool = df.loop < 2 ? ['grunt','runner'] : ['grunt','runner','shooter','bouncer','glitch'];
        spawnEnemy(run, players, pool[Math.floor(Math.random() * pool.length)], df.loop >= 3);
      }
    }
    return;
  }
  if (run.portal.open) return; // calm after objective
  const greed = plan.modifierIds.includes('greed');
  const lateBudget = Math.floor(Math.pow(df.late, 1.45) * 14);
  const totalBudget = Math.round((plan.quota + 5 + df.loop * 5 + lateBudget) * DIFFICULTY_MULT);
  if (run.spawned >= totalBudget) return;
  run.directorT -= dt * (greed ? 1.18 : 1);
  if (run.directorT > 0) return;
  const pool = spawnPool(run);
  const baseBatch = df.loop === 0 ? 2 : 2 + Math.floor(Math.min(6, df.loop / 1.15));
  const chaosBonus = df.late > 0 && Math.random() < Math.min(0.85, df.late * 0.18) ? 1 + Math.floor(Math.random() * Math.min(4, df.late + 1)) : 0;
  const batch = Math.min(12, baseBatch + chaosBonus + (greed && Math.random() < 0.45 ? 1 : 0));
  for (let i = 0; i < batch && run.enemies.length < df.maxActive && run.spawned < totalBudget; i++) {
    spawnEnemy(run, players, pool[Math.floor(Math.random() * pool.length)]);
  }
  run.directorT = Math.max(0.20, (3.9 - df.loop * 0.42 - run.runDepth * 0.035 - df.late * 0.40) / DIFFICULTY_MULT);
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
  if (def.armor) dmg *= (1 - def.armor);
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg;
  run.fx.push({ t: 'ehit', id: e.id, dmg, x: Math.round(e.x), y: Math.round(e.y) });
  if (knock && !def.boss && e.kind !== 'bouncer') {
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
  p.cd -= dt;
  if (!p.fire || !p.alive || p.cd > 0) return;
  const w = WEAPONS[p.weapons[p.weaponIdx]];
  if (!w) return;
  p.cd = w.cooldown / p.stats.fireMul;
  const dir = norm(p.aimX - p.x, p.aimY - p.y);
  const shots = 1 + chanceStacks(p.stats.echoShot);
  for (let s = 0; s < shots; s++) {
    const delay = s * 0.06;
    for (let i = 0; i < w.pellets; i++) {
      if (run.bullets.length >= MAX_BULLETS) break;
      const ang = Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * w.spread;
      run.bullets.push({
        id: nid(), x: p.x + dir.x * 18, y: p.y + dir.y * 18,
        vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed,
        dmg: w.dmg * p.stats.dmgMul, from: 'p', owner: p.id,
        life: w.life, delay, size: w.size, aoe: w.aoe || 0, homing: w.homing || 0,
        knock: w.knock || 0, proc: p.stats.procBlast, kind: w.id, travelled: 0, detonateDist: w.detonateDist || 0
      });
    }
  }
  run.fx.push({ t: 'shot', id: p.id, w: w.label, x: Math.round(p.x), y: Math.round(p.y) });
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

function stepBullets(run, players, dt) {
  const walls = run.plan.walls;
  for (const b of run.bullets) {
    if (b.delay > 0) { b.delay -= dt; continue; }
    b.life -= dt;
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
    b.travelled = (b.travelled || 0) + Math.hypot(b.x - ox, b.y - oy);
    if (b.detonateDist && b.travelled >= b.detonateDist) {
      explode(run, players, b.x, b.y, b.aoe || 70, b.dmg, b.owner, false, b.kind === 'rocketgun' ? 'rocket' : 'blast');
      b.life = -1; continue;
    }
    // walls
    let hitWall = false;
    for (const w of walls) {
      if (aabbHit(b.x, b.y, b.size / 2, w)) { hitWall = true; break; }
    }
    if (hitWall) {
      if (b.aoe) explode(run, players, b.x, b.y, b.aoe, b.dmg, b.owner, false, b.kind === 'rocketgun' ? 'rocket' : 'blast');
      b.life = -1; continue;
    }
    if (b.from === 'p') {
      for (const e of run.enemies) {
        if (dist2(e.x, e.y, b.x, b.y) < ((e.size + b.size) / 2 + 4) ** 2) {
          if (b.aoe) explode(run, players, b.x, b.y, b.aoe, b.dmg, b.owner, false, b.kind === 'rocketgun' ? 'rocket' : 'blast');
          else {
            const n = norm(b.vx, b.vy);
            damageEnemy(run, players, e, b.dmg, b.owner, b.knock, n.x, n.y);
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
  for (const e of [...run.enemies]) {
    const def = ENEMIES[e.kind];
    const target = nearestAlive(players, e.x, e.y);
    e.st += dt;
    const half = e.size / 2;

    if (e.kind === 'bouncer') {
      // pinball: constant speed, bounce off walls & players, no fatigue
      let nx = e.x + e.vx * dt, ny = e.y + e.vy * dt;
      for (const w of walls) {
        if (aabbHit(nx, e.y, half, w)) { e.vx *= -1; nx = e.x; }
        if (aabbHit(e.x, ny, half, w)) { e.vy *= -1; ny = e.y; }
      }
      e.x = nx; e.y = ny;
      if (!e.touchCds) e.touchCds = new Map();
      for (const [k, v] of e.touchCds) {
        const nv = v - dt;
        if (nv <= 0) e.touchCds.delete(k); else e.touchCds.set(k, nv);
      }
      for (const p of players.values()) {
        if (!p.alive) continue;
        if (dist2(p.x, p.y, e.x, e.y) < ((PLAYER_SIZE + e.size) / 2) ** 2) {
          const n = norm(p.x - e.x, p.y - e.y);
          if (!e.touchCds.has(p.id)) {
            damagePlayer(run, p, e.dmg, e.x, e.y);
            e.touchCds.set(p.id, TOUCH_CD * 0.55);
          }
          // push player, bounce self away even during damage cooldown
          const pushed = collideWalls(p.x + n.x * def.push * 0.25, p.y + n.y * def.push * 0.25, PLAYER_SIZE / 2, walls, p.x, p.y);
          p.x = pushed.x; p.y = pushed.y;
          e.vx = -n.x * def.spd; e.vy = -n.y * def.spd;
        }
      }
      continue;
    }

    if (!target) continue;
    const toT = norm(target.x - e.x, target.y - e.y);
    const dT = Math.hypot(target.x - e.x, target.y - e.y);

    if (e.kind === 'shooter') {
      // keep distance, fire
      let mv = 0;
      if (dT > def.keep + 40) mv = 1; else if (dT < def.keep - 60) mv = -1;
      if (mv !== 0) {
        const c = collideWalls(e.x + toT.x * e.spd * mv * dt, e.y + toT.y * e.spd * mv * dt, half, walls, e.x, e.y);
        e.x = c.x; e.y = c.y;
      }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS) {
        e.fireCd = def.fireCd;
        run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: toT.x * def.bulletSpd, vy: toT.y * def.bulletSpd, dmg: e.dmg, from: 'e', life: 2.6, size: 7 });
        run.fx.push({ t: 'eshot', id: e.id });
      }
      e.dirX = toT.x; e.dirY = toT.y;
    } else if (e.kind === 'charger') {
      if (e.state === 'move') {
        if (dT < 300) { e.state = 'windup'; e.st = 0; e.dirX = toT.x; e.dirY = toT.y; }
        else {
          const c = collideWalls(e.x + toT.x * e.spd * dt, e.y + toT.y * e.spd * dt, half, walls, e.x, e.y);
          e.x = c.x; e.y = c.y;
        }
      } else if (e.state === 'windup') {
        e.dirX = toT.x; e.dirY = toT.y; // track until launch
        if (e.st >= def.windup) { e.state = 'charge'; e.st = 0; }
      } else if (e.state === 'charge') {
        const c = collideWalls(e.x + e.dirX * def.chargeSpd * dt, e.y + e.dirY * def.chargeSpd * dt, half, walls, e.x, e.y);
        const blocked = (c.x === e.x && c.y === e.y);
        e.x = c.x; e.y = c.y;
        for (const p of players.values()) {
          if (p.alive && dist2(p.x, p.y, e.x, e.y) < ((PLAYER_SIZE + e.size) / 2) ** 2) {
            damagePlayer(run, p, e.dmg, e.x, e.y);
            e.state = 'cool'; e.st = 0;
          }
        }
        if (e.st >= def.chargeTime || blocked) { e.state = 'cool'; e.st = 0; }
      } else if (e.state === 'cool') {
        if (e.st >= def.chargeCd) { e.state = 'move'; e.st = 0; }
      }
    } else if (e.kind === 'bomber') {
      if (e.state === 'move') {
        const c = collideWalls(e.x + toT.x * e.spd * dt, e.y + toT.y * e.spd * dt, half, walls, e.x, e.y);
        e.x = c.x; e.y = c.y;
        if (dT < 80) { e.state = 'fuse'; e.st = 0; run.fx.push({ t: 'fuse', id: e.id, x: Math.round(e.x), y: Math.round(e.y), r: def.blast, dur: def.fuse }); }
      } else if (e.state === 'fuse') {
        if (e.st >= def.fuse) {
          explode(run, players, e.x, e.y, def.blast, e.dmg, null, true, 'danger');
          e.hp = 0;
          run.enemies = run.enemies.filter(x => x.id !== e.id);
          run.kills++;
          run.fx.push({ t: 'kill', x: Math.round(e.x), y: Math.round(e.y), kind: e.kind, elite: e.elite, size: e.size });
          dropPickup(run, e.x, e.y, 'GLD', Math.round(def.gld * scaling(run) * 0.6));
          dropPickup(run, e.x + 10, e.y, 'EXP', def.xp);
          if (quotaCanOpenPortal(run)) openPortal(run);
        }
      }
    } else if (e.kind === 'glitch') {
      if (e.state === 'move') {
        const c = collideWalls(e.x + toT.x * e.spd * dt, e.y + toT.y * e.spd * dt, half, walls, e.x, e.y);
        e.x = c.x; e.y = c.y;
        if (e.st >= def.blinkCd && dT < 600) {
          // blink near player (telegraphed by fx)
          const a = Math.random() * Math.PI * 2;
          const bx = target.x + Math.cos(a) * 90, by = target.y + Math.sin(a) * 90;
          run.fx.push({ t: 'blink', id: e.id, fx: Math.round(e.x), fy: Math.round(e.y), tx: Math.round(bx), ty: Math.round(by) });
          e.x = bx; e.y = by;
          e.state = 'strike'; e.st = 0;
        }
      } else if (e.state === 'strike') {
        if (e.st >= def.strikeCd) {
          if (dT < 75) damagePlayer(run, target, e.dmg, e.x, e.y);
          run.fx.push({ t: 'gstrike', x: Math.round(e.x), y: Math.round(e.y) });
          e.state = 'move'; e.st = 0;
        }
      }
    } else if (e.kind === 'boss') {
      const c = collideWalls(e.x + toT.x * e.spd * dt, e.y + toT.y * e.spd * dt, half, walls, e.x, e.y);
      e.x = c.x; e.y = c.y;
      e.fireCd -= dt;
      if (e.fireCd <= 0 && run.bullets.length < MAX_BULLETS - 12) {
        e.fireCd = def.fireCd * (e.hp < e.maxHp * 0.5 ? 0.65 : 1);
        const n = 10;
        const base = Math.random() * Math.PI * 2;
        for (let i = 0; i < n; i++) {
          const a = base + (i / n) * Math.PI * 2;
          run.bullets.push({ id: nid(), x: e.x, y: e.y, vx: Math.cos(a) * def.bulletSpd, vy: Math.sin(a) * def.bulletSpd, dmg: Math.round(e.dmg * 0.6), from: 'e', life: 3.2, size: 9 });
        }
        run.fx.push({ t: 'boss_burst', id: e.id, x: Math.round(e.x), y: Math.round(e.y) });
      }
      // touch
      touchDamage(run, e, players, dt);
    } else {
      // grunt / runner / tank: chase + touch
      const c = collideWalls(e.x + toT.x * e.spd * dt, e.y + toT.y * e.spd * dt, half, walls, e.x, e.y);
      e.x = c.x; e.y = c.y;
      touchDamage(run, e, players, dt);
    }
  }
}

function touchDamage(run, e, players, dt) {
  for (const p of players.values()) {
    if (!p.alive) continue;
    const key = p.id;
    const cd = e.touchCds?.get(key) || 0;
    if (cd > 0) { e.touchCds.set(key, cd - dt); continue; }
    if (dist2(p.x, p.y, e.x, e.y) < ((PLAYER_SIZE + e.size) / 2) ** 2) {
      damagePlayer(run, p, e.dmg, e.x, e.y);
      if (!e.touchCds) e.touchCds = new Map();
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
          run.bullets.push({ id: nid(), x: dp.x, y: dp.y, vx: n.x * 520, vy: n.y * 520, dmg: 8 * p.stats.dmgMul, from: 'p', owner: p.id, life: 1.1, size: 4 });
        }
      }
    }
    // orbitals: contact damage with per-enemy cooldown
    if (p.stats.orbitals > 0) {
      for (const [k, v] of p.orbHits) { if (v <= now) p.orbHits.delete(k); }
      for (let i = 0; i < p.stats.orbitals; i++) {
        const op = orbitalPos(p, i, p.stats.orbitals, now);
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

function openChest(run, players, p, o) {
  const def = CHESTS[o.chest];
  if (def.cost > 0) {
    if (p.economy.money < def.cost) {
      run.fx.push({ t: 'denied', id: p.id, obj: o.id, x: o.x, y: o.y, cost: def.cost, have: p.economy.money, chest: def.label });
      return;
    }
    p.economy.money -= def.cost;
  }
  o.opened = true;
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
    const unowned = WEAPON_ORDER.filter(w => !p.weapons.includes(w));
    if (unowned.length) {
      const w = unowned[Math.floor(rng() * unowned.length)];
      p.weapons.push(w);
      rewards.push(WEAPONS[w].label);
      run.fx.push({ t: 'weapon_get', id: p.id, w: WEAPONS[w].label });
    } else {
      p.stats.dmgMul *= 1.2;
      rewards.push('DMG +20%');
    }
  } else if (o.chest === 'ability_chest') {
    p.stats.dashAdd += 1;
    p.dashCharges = Math.min(dashMax(p), p.dashCharges + 1);
    rewards.push('DASH +1');
    run.fx.push({ t: 'ability_get', id: p.id, label: 'DASH +1' });
  } else if (o.chest === 'rare_chest') {
    const pool = UPGRADES.filter(u => u.tier === 1);
    const u = pool[Math.floor(rng() * pool.length)];
    u.apply(p.stats);
    p.hp = Math.min(p.hp, maxHp(p));
    rewards.push(u.label);
  } else if (o.chest === 'cursed_chest') {
    const pool = UPGRADES.filter(u => u.tier === 2);
    const u = pool[Math.floor(rng() * pool.length)];
    u.apply(p.stats);
    p.hp = Math.min(p.hp, maxHp(p));
    run.staticDebt = true;
    rewards.push(u.label, 'CURSE: STATIC DEBT');
  }
  run.fx.push({ t: 'chest_open', id: p.id, obj: o.id, chest: def.label, rewards, x: o.x, y: o.y, cursed: !!def.cursed });
}

export function handleCasino(run, players, p, stakeKey) {
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
  const res = spinCasino(Math.random, stakeKey, p.stats.luck);
  const pl = res.payload;
  if (pl.gld) p.economy.money += pl.gld;
  if (pl.xp) addXp(run, p, pl.xp);
  if (pl.heal) p.hp = Math.min(maxHp(p), p.hp + pl.heal);
  if (pl.dash) { p.stats.dashAdd += 1; p.dashCharges = Math.min(dashMax(p), p.dashCharges + 1); }
  if (pl.weapon) {
    const unowned = WEAPON_ORDER.filter(w => !p.weapons.includes(w));
    if (unowned.length) { const w = unowned[Math.floor(Math.random() * unowned.length)]; p.weapons.push(w); pl.weaponLabel = WEAPONS[w].label; }
    else { p.stats.dmgMul *= 1.15; pl.weaponLabel = 'DMG +15%'; }
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
  run.fx.push({ t: 'transition' });
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

// ---------------------------------------------------------------- players
function stepPlayers(run, players, dt) {
  for (const p of players.values()) {
    if (!p.connected) continue;
    p.invuln = Math.max(0, p.invuln - dt);
    // dash regen
    const dm = dashMax(p);
    if (p.dashCharges < dm) {
      p.dashTimer += dt;
      if (p.dashTimer >= DASH_REGEN) { p.dashTimer = 0; p.dashCharges++; }
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
      run.fx.push({ t: 'dash', id: p.id, fx: Math.round(p.x), fy: Math.round(p.y), tx: Math.round(c.x), ty: Math.round(c.y) });
      p.x = c.x; p.y = c.y;
      p.dashCharges--;
      p.invuln = Math.max(p.invuln, DASH_INVULN);
    }
    p.wantDash = false;
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
      Math.round(speed(p))
    ]);
  }
  const es = run.enemies.map(e => [
    e.id, KIND_IDX[e.kind], Math.round(e.x), Math.round(e.y),
    Math.round((e.hp / e.maxHp) * 100), e.size, e.state, e.elite ? 1 : 0,
    Math.round((e.dirX || 0) * 100), Math.round((e.dirY || 0) * 100)
  ]);
  const bs = run.bullets.map(b => [
    b.id, Math.round(b.x), Math.round(b.y), Math.round(b.vx), Math.round(b.vy), b.size, b.from === 'p' ? 1 : 0, b.kind === 'rocketgun' ? 1 : 0
  ]);
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
      id: run.plan.roomId, cat: run.plan.category,
      loop: run.plan.loopIndex, depth: run.runDepth, inLoop: run.plan.roomInLoop,
      mods: run.plan.modifierIds, quota: run.plan.quota, kills: run.kills,
      w: run.plan.w, h: run.plan.h,
      portal: [Math.round(run.portal.x), Math.round(run.portal.y), run.portal.open ? 1 : 0],
      phase: run.phase
    },
    players: ps, enemies: es, bullets: bs, pickups: ks, objects: os, fx
  };
}

export function buildWalls(run) {
  return run.plan.walls;
}
