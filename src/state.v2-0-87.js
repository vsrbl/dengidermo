// nncckkrr client state: snapshot buffer, interpolation, prediction + reconciliation
import { ENEMIES } from '../shared/data.v2-0-87.js';
const PLAYER_SIZE = 28;
const DASH_DIST = 175;
const INTERP_DELAY = 55; // ms behind host for remote entities (guest mode); lower delay for less floaty guest feel
const INTERP_DELAY_LOCAL = 0; // local/host uses latest authoritative sim frame to keep shots/companions aligned

// player row indices
export const P = {
  ID: 0, X: 1, Y: 2, HP: 3, MAXHP: 4, ALIVE: 5, AX: 6, AY: 7, WIDX: 8, WEAPONS: 9,
  DASH: 10, DASHMAX: 11, LVL: 12, PEND: 13, GLD: 14, XP: 15, NEXTXP: 16,
  DRONES: 17, ORBITALS: 18, LASTSEQ: 19, NAME: 20, INV: 21, SPD: 22, ACTIVECD: 23, ACTIVEBUFF: 24,
  ACTIVELABEL: 25, ACTIVEDESC: 26, SHG: 27, SHGRELOAD: 28, SKINFILL: 29, SKINOUTLINE: 30, SKINBARREL: 31, SKINID: 32
};
export const ENEMY_KINDS = Object.keys(ENEMIES);
export const ENEMY_LABELS = ENEMY_KINDS.map(k => ENEMIES[k].label || k.toUpperCase());

function aabbHit(x, y, half, w) {
  return x + half > w.x && x - half < w.x + w.w && y + half > w.y && y - half < w.y + w.h;
}
function collideWalls(x, y, half, walls, ox, oy) {
  let nx = x, ny = y;
  for (const w of walls) if (aabbHit(nx, oy, half, w)) nx = nx > w.x + w.w / 2 ? w.x + w.w + half : w.x - half;
  for (const w of walls) if (aabbHit(nx, ny, half, w)) ny = ny > w.y + w.h / 2 ? w.y + w.h + half : w.y - half;
  return { x: nx, y: ny };
}

export class GameState {
  constructor() {
    this.walls = [];
    this.world = { w: 2200, h: 1500 };
    this.snaps = [];        // ring of recent snapshots with recv time
    this.latest = null;
    this.room = null;
    this.myId = null;
    this.localMode = false; // solo/host: snapshots arrive every sim tick
    // prediction
    this.pred = { x: 0, y: 0, init: false };
    this.history = [];      // [{seq, mx, my, dt, dash, speed}]
    this.seq = 0;
    this.mySpeed = 260;
    this.smooth = { x: 0, y: 0 };
  }

  setWalls(walls, world) {
    this.walls = walls || [];
    if (world) this.world = world;
    this.pred.init = false; // teleported to new room: re-init from next snapshot
    this.history = [];
  }

  addSnapshot(s) {
    s._recv = performance.now();
    this.snaps.push(s);
    if (this.snaps.length > 12) this.snaps.shift();
    this.latest = s;
    this.room = s.room;
    const me = this.me();
    if (me) {
      this.mySpeed = me[P.SPD] || 260;
      // reconcile prediction
      const sx = me[P.X], sy = me[P.Y];
      const lastSeq = me[P.LASTSEQ];
      this.history = this.history.filter(h => h.seq > lastSeq);
      let px = sx, py = sy;
      for (const h of this.history) {
        if (h.dash) {
          let dx = h.mx, dy = h.my;
          if (Math.hypot(dx, dy) < 0.01) { dx = h.adx; dy = h.ady; }
          const l = Math.hypot(dx, dy) || 1;
          const c = collideWalls(px + (dx / l) * DASH_DIST, py + (dy / l) * DASH_DIST, PLAYER_SIZE / 2, this.walls, px, py);
          px = c.x; py = c.y;
        }
        if (h.mx || h.my) {
          const c = collideWalls(px + h.mx * h.speed * h.dt, py + h.my * h.speed * h.dt, PLAYER_SIZE / 2, this.walls, px, py);
          px = c.x; py = c.y;
        }
      }
      if (!this.pred.init || !me[P.ALIVE]) {
        this.pred = { x: sx, y: sy, init: true };
        this.smooth = { x: sx, y: sy };
      } else {
        // pull predicted toward replayed authoritative result
        const err = Math.hypot(px - this.pred.x, py - this.pred.y);
        if (err > 120) { this.pred.x = px; this.pred.y = py; }
        else { this.pred.x += (px - this.pred.x) * 0.55; this.pred.y += (py - this.pred.y) * 0.55; }
      }
    }
  }

  me() {
    if (!this.latest || !this.myId) return null;
    return this.latest.players.find(p => p[P.ID] === this.myId) || null;
  }

  // apply local input for prediction; returns input packet to send
  applyLocalInput(mv, aim, fire, dash, inter, active, wpn, dt, secondary = false) {
    const me = this.me();
    const alive = me ? !!me[P.ALIVE] : true;
    const playPhase = !this.room || this.room.phase === 'play';
    this.seq++;
    if (alive && playPhase && this.pred.init) {
      const adir = { x: aim.x - this.pred.x, y: aim.y - this.pred.y };
      const al = Math.hypot(adir.x, adir.y) || 1;
      if (dash && me && me[P.DASH] > 0) {
        let dx = mv.x, dy = mv.y;
        if (Math.hypot(dx, dy) < 0.01) { dx = adir.x / al; dy = adir.y / al; }
        const l = Math.hypot(dx, dy) || 1;
        const c = collideWalls(this.pred.x + (dx / l) * DASH_DIST, this.pred.y + (dy / l) * DASH_DIST, PLAYER_SIZE / 2, this.walls, this.pred.x, this.pred.y);
        this.pred.x = c.x; this.pred.y = c.y;
      }
      if (mv.x || mv.y) {
        const c = collideWalls(this.pred.x + mv.x * this.mySpeed * dt, this.pred.y + mv.y * this.mySpeed * dt, PLAYER_SIZE / 2, this.walls, this.pred.x, this.pred.y);
        this.pred.x = c.x; this.pred.y = c.y;
      }
      this.history.push({ seq: this.seq, mx: mv.x, my: mv.y, dt, dash, speed: this.mySpeed, adx: adir.x / al, ady: adir.y / al });
      if (this.history.length > 120) this.history.shift();
    }
    return {
      seq: this.seq, mx: mv.x, my: mv.y,
      ax: Math.round(aim.x), ay: Math.round(aim.y),
      fire, dash: dash || undefined, inter: inter || undefined, active: active || undefined, secondary: secondary || undefined,
      wpn: wpn >= 0 ? wpn : undefined
    };
  }

  // own position for camera/render.
  // Host already feels crisp because it receives the sim frame synchronously.
  // Guest now follows local prediction directly; remote entities are still interpolated.
  myRenderPos(dt) {
    const me = this.me();
    if (this.localMode && me) return { x: me[P.X], y: me[P.Y] };
    if (!this.pred.init) {
      if (me) return { x: me[P.X], y: me[P.Y] };
      return { x: this.world.w / 2, y: this.world.h / 2 };
    }
    this.smooth.x = this.pred.x;
    this.smooth.y = this.pred.y;
    return { x: this.pred.x, y: this.pred.y };
  }

  // interpolated entities at render time
  interp() {
    const now = performance.now();
    if (this.localMode) {
      const s = this.latest;
      if (!s) return { players: [], enemies: [], bullets: [], pickups: [], objects: [], companions: [] };
      return { players: s.players, enemies: s.enemies, bullets: s.bullets, pickups: s.pickups, objects: s.objects, companions: s.companions || [] };
    }
    const rt = now - INTERP_DELAY;
    let a = null, b = null;
    for (let i = this.snaps.length - 1; i >= 1; i--) {
      if (this.snaps[i - 1]._recv <= rt && this.snaps[i]._recv >= rt) { a = this.snaps[i - 1]; b = this.snaps[i]; break; }
    }
    if (!a) {
      const s = this.latest;
      if (!s) return { players: [], enemies: [], bullets: [], pickups: [], objects: [], companions: [] };
      return { players: s.players, enemies: s.enemies, bullets: s.bullets, pickups: s.pickups, objects: s.objects, companions: s.companions || [] };
    }
    const t = Math.max(0, Math.min(1, (rt - a._recv) / Math.max(1, b._recv - a._recv)));
    const lerpRows = (ra, rb, xi, yi) => {
      const map = new Map(ra.map(r => [r[0], r]));
      return rb.map(r => {
        const pa = map.get(r[0]);
        if (!pa) return r;
        const out = r.slice();
        out[xi] = pa[xi] + (r[xi] - pa[xi]) * t;
        out[yi] = pa[yi] + (r[yi] - pa[yi]) * t;
        return out;
      });
    };
    return {
      players: lerpRows(a.players, b.players, P.X, P.Y),
      enemies: lerpRows(a.enemies, b.enemies, 2, 3),
      bullets: lerpRows(a.bullets, b.bullets, 1, 2),
      pickups: b.pickups,
      objects: b.objects,
      companions: lerpRows(a.companions || [], b.companions || [], 4, 5)
    };
  }

  nearestInteractable(px, py) {
    if (!this.latest) return null;
    let best = null, bd = 95 * 95;
    const r = this.room;
    if (r && r.portal && r.portal[2]) {
      const d = (px - r.portal[0]) ** 2 + (py - r.portal[1]) ** 2;
      if (d < bd) { bd = d; best = { kind: 'portal' }; }
    }
    for (const o of this.latest.objects) {
      if (o[5]) continue; // opened
      const d = (px - o[3]) ** 2 + (py - o[4]) ** 2;
      if (d < bd) { bd = d; best = { kind: o[1], label: o[2], cost: o[6], currency: o[7] || 'GLD', id: o[0] }; }
    }
    return best;
  }
}
