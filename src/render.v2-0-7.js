// nncckkrr renderer: squares, labels above, silhouettes that telegraph mechanics
import { P, ENEMY_KINDS, ENEMY_LABELS } from './state.v2-0-7.js';

const COL = {
  bg: '#050505', fg: '#f3f3f3', dim: '#666',
  green: '#00ff66', red: '#ff3048', purple: '#b45cff', cyan: '#66f6ff',
  wall: '#0d0d0d', wallEdge: '#2c2c2c', grid: '#0b0b0b'
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0 };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth * devicePixelRatio;
    this.canvas.height = window.innerHeight * devicePixelRatio;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
    this.w = window.innerWidth; this.h = window.innerHeight;
  }

  screenToWorld(sx, sy) {
    return { x: sx + this.cam.x, y: sy + this.cam.y };
  }

  label(text, x, y, color = COL.dim, size = 10) {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    ctx.font = `${size}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
  }

  square(x, y, size, { fill, stroke, lw = 2, alpha = 1, rotate = 0 } = {}) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rotate) ctx.rotate(rotate);
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(-size / 2, -size / 2, size, size); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(-size / 2, -size / 2, size, size); }
    ctx.restore();
  }

  draw(state, effects, view, myPos, mouse, now) {
    const ctx = this.ctx;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const shake = effects.cameraOffset();
    this.cam.x = myPos.x - this.w / 2 + shake.x;
    this.cam.y = myPos.y - this.h / 2 + shake.y;
    // clamp camera to world
    this.cam.x = Math.max(-80, Math.min(state.world.w - this.w + 80, this.cam.x));
    this.cam.y = Math.max(-80, Math.min(state.world.h - this.h + 80, this.cam.y));

    ctx.save();
    ctx.translate(-this.cam.x, -this.cam.y);

    // floor grid
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    const gs = 100;
    const x0 = Math.floor(this.cam.x / gs) * gs, x1 = this.cam.x + this.w;
    const y0 = Math.floor(this.cam.y / gs) * gs, y1 = this.cam.y + this.h;
    ctx.beginPath();
    for (let x = x0; x < x1; x += gs) { ctx.moveTo(x, y0); ctx.lineTo(x, y1 + gs); }
    for (let y = y0; y < y1; y += gs) { ctx.moveTo(x0, y); ctx.lineTo(x1 + gs, y); }
    ctx.stroke();

    // walls
    for (const w of state.walls) {
      ctx.fillStyle = COL.wall; ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = COL.wallEdge; ctx.lineWidth = 2; ctx.strokeRect(w.x, w.y, w.w, w.h);
    }

    const room = state.room;

    // portal
    if (room && room.portal) {
      const [px, py, open] = room.portal;
      const pulse = open ? 1 + Math.sin(now * 6) * 0.12 : 1;
      this.square(px, py, 46 * pulse, {
        stroke: open ? COL.green : '#333', lw: open ? 3 : 2,
        fill: open ? 'rgba(0,255,102,0.12)' : 'rgba(255,255,255,0.02)'
      });
      this.label('PRT', px, py - 34, open ? COL.green : '#333', 11);
      if (open) {
        ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(now * 6) * 0.3;
        this.square(px, py, 20, { fill: COL.green });
        ctx.restore();
      }
    }

    // objects: chests / bet terminals — label ABOVE, never inside
    for (const o of view.objects) {
      const [, type, label, ox, oy, opened] = o;
      const isBet = type === 'bet';
      const cursed = label === 'CRS';
      const col = opened ? '#2a2a2a' : (isBet ? COL.red : cursed ? COL.purple : COL.fg);
      this.square(ox, oy, isBet ? 30 : 26, {
        stroke: col, lw: 2,
        fill: opened ? 'rgba(255,255,255,0.02)' : (isBet ? 'rgba(255,48,72,0.08)' : 'rgba(255,255,255,0.05)'),
        alpha: opened ? 0.45 : 1
      });
      if (isBet && !opened) {
        ctx.save(); ctx.globalAlpha = 0.6 + Math.sin(now * 3 + ox) * 0.3;
        ctx.fillStyle = COL.red; ctx.fillRect(ox - 3, oy - 3, 6, 6);
        ctx.restore();
      }
      this.label(label, ox, oy - 24, opened ? '#2a2a2a' : (isBet ? COL.red : cursed ? COL.purple : COL.dim), 10);
    }

    // pickups: small squares, label above
    for (const k of view.pickups) {
      const [, type, kx, ky] = k;
      const bob = Math.sin(now * 4 + kx * 0.1) * 2;
      if (type === 'GLD') {
        this.square(kx, ky + bob, 10, { fill: COL.fg });
        this.label('GLD', kx, ky + bob - 10, COL.green, 8);
      } else if (type === 'EXP') {
        this.square(kx, ky + bob, 8, { fill: COL.cyan, rotate: now * 2 });
        this.label('EXP', kx, ky + bob - 10, COL.cyan, 8);
      } else {
        this.square(kx, ky + bob, 11, { stroke: COL.green, lw: 2 });
        ctx.fillStyle = COL.green;
        ctx.fillRect(kx - 4, ky + bob - 1.2, 8, 2.4); ctx.fillRect(kx - 1.2, ky + bob - 4, 2.4, 8);
        this.label('HEA', kx, ky + bob - 11, COL.green, 8);
      }
    }

    // bullets
    for (const b of view.bullets) {
      const [, bx, by, vx, vy, size, fromP, rocket] = b;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.atan2(vy, vx));
      if (rocket) {
        ctx.strokeStyle = COL.fg; ctx.lineWidth = 2;
        ctx.strokeRect(-size * 1.2, -size * 0.7, size * 2.2, size * 1.4);
        ctx.fillStyle = 'rgba(255,48,72,0.65)';
        ctx.fillRect(-size * 1.75, -size * 0.35, size * 0.55, size * 0.7);
        ctx.strokeStyle = COL.red; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(-size * 2.6, 0); ctx.lineTo(-size * 5.2, 0); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = fromP ? COL.fg : COL.red;
        ctx.fillRect(-size, -size / 2.4, size * 2, size / 1.2);
      }
      ctx.restore();
    }

    // enemies — silhouette = mechanic
    for (const e of view.enemies) {
      const [, kindIdx, ex, ey, hp01, size, st, elite, dirX, dirY] = e;
      const kind = ENEMY_KINDS[kindIdx];
      const stroke = elite ? COL.red : COL.fg;
      if (kind === 'bouncer') {
        this.square(ex, ey, size, { stroke, lw: 2.5, rotate: Math.PI / 4, fill: 'rgba(255,255,255,0.06)' });
      } else if (kind === 'tank') {
        this.square(ex, ey, size, { stroke, lw: 5, fill: 'rgba(255,255,255,0.04)' });
      } else if (kind === 'shooter') {
        this.square(ex, ey, size, { stroke, lw: 2, fill: 'rgba(255,255,255,0.04)' });
        ctx.strokeStyle = stroke; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex, ey);
        ctx.lineTo(ex + (dirX / 100) * size, ey + (dirY / 100) * size); ctx.stroke();
      } else if (kind === 'charger') {
        const winding = st === 'windup';
        if (winding) {
          ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(now * 20) * 0.4;
          ctx.strokeStyle = COL.red; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
          ctx.beginPath(); ctx.moveTo(ex, ey);
          ctx.lineTo(ex + (dirX / 100) * 320, ey + (dirY / 100) * 320); ctx.stroke();
          ctx.restore();
        }
        this.square(ex, ey, size * (winding ? 0.85 : 1), {
          stroke: winding ? COL.red : stroke, lw: 3, fill: 'rgba(255,255,255,0.05)'
        });
      } else if (kind === 'bomber') {
        const fusing = st === 'fuse';
        const blink = fusing ? (Math.sin(now * 24) > 0) : false;
        this.square(ex, ey, size, {
          stroke: fusing ? COL.red : stroke, lw: 2,
          fill: blink ? 'rgba(255,48,72,0.5)' : 'rgba(255,48,72,0.12)'
        });
      } else if (kind === 'glitch') {
        const j = st === 'strike' ? 4 : 1.5;
        this.square(ex + (Math.random() - 0.5) * j, ey + (Math.random() - 0.5) * j, size, {
          stroke: COL.purple, lw: 2, fill: 'rgba(180,92,255,0.1)'
        });
      } else if (kind === 'boss') {
        this.square(ex, ey, size, { stroke, lw: 6, fill: 'rgba(255,255,255,0.05)' });
        this.square(ex, ey, size * 0.55, { stroke: COL.red, lw: 2, rotate: now * 1.2 });
        this.label('BOS', ex, ey - size / 2 - 12, COL.red, 12);
        // boss hp bar above
        const bw = size * 1.4;
        ctx.fillStyle = '#222'; ctx.fillRect(ex - bw / 2, ey - size / 2 - 30, bw, 5);
        ctx.fillStyle = COL.red; ctx.fillRect(ex - bw / 2, ey - size / 2 - 30, bw * hp01 / 100, 5);
      } else {
        // grunt / runner
        this.square(ex, ey, size, { stroke, lw: kind === 'runner' ? 1.5 : 2.5, fill: 'rgba(255,255,255,0.05)' });
      }
      // hp tick under damaged enemies (not boss)
      if (kind !== 'boss' && hp01 < 100) {
        ctx.fillStyle = '#222'; ctx.fillRect(ex - size / 2, ey + size / 2 + 5, size, 3);
        ctx.fillStyle = elite ? COL.red : COL.fg;
        ctx.fillRect(ex - size / 2, ey + size / 2 + 5, size * hp01 / 100, 3);
      }
      if (elite && kind !== 'boss') this.label('ELITE', ex, ey - size / 2 - 8, COL.red, 8);
    }

    // player-to-cursor tether: thin, always green, visible even while input is blocked by modals
    if (myPos && mouse) {
      const mw = this.screenToWorld(mouse.x, mouse.y);
      const dx = mw.x - myPos.x, dy = mw.y - myPos.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const endD = Math.min(d, 420);
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.08 * Math.sin(now * 7);
      ctx.strokeStyle = COL.green;
      ctx.lineWidth = 1;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(myPos.x + ux * 24, myPos.y + uy * 24);
      ctx.lineTo(myPos.x + ux * Math.max(30, endD - 18), myPos.y + uy * Math.max(30, endD - 18));
      ctx.stroke();
      ctx.restore();
    }

    // players + companions
    for (const p of view.players) {
      const isMe = p[P.ID] === state.myId;
      const px = isMe ? myPos.x : p[P.X];
      const py = isMe ? myPos.y : p[P.Y];
      const alive = !!p[P.ALIVE];
      const inv = !!p[P.INV];
      // orbitals / drones (deterministic from now)
      const drones = p[P.DRONES], orbitals = p[P.ORBITALS];
      for (let i = 0; i < orbitals; i++) {
        const ang = now * 1.8 + (i / orbitals) * Math.PI * 2;
        const r = 58 + 14 * Math.floor(i / 8);
        this.square(px + Math.cos(ang) * r, py + Math.sin(ang) * r, 10, { stroke: COL.cyan, lw: 2, rotate: ang });
      }
      for (let i = 0; i < drones; i++) {
        const ang = now * 1.8 + (i / Math.max(1, drones)) * Math.PI * 2 + 100 * 1.8;
        const r = 58 + 14 * Math.floor(i / 8);
        this.square(px + Math.cos(ang) * r, py + Math.sin(ang) * r, 8, { fill: COL.cyan });
      }
      if (!alive) {
        this.square(px, py, 28, { stroke: '#333', lw: 2, rotate: Math.PI / 4 });
        this.label('DOWN', px, py - 24, COL.red, 9);
        this.label(p[P.NAME], px, py - 36, '#333', 10);
        continue;
      }
      ctx.save();
      if (inv) ctx.globalAlpha = 0.55 + Math.sin(now * 18) * 0.25;
      this.square(px, py, 28, { fill: isMe ? COL.fg : '#cfcfcf', stroke: isMe ? COL.green : undefined, lw: 2 });
      ctx.restore();
      // aim tick
      const ax = p[P.AX], ay = p[P.AY];
      const al = Math.hypot(ax - px, ay - py) || 1;
      ctx.strokeStyle = isMe ? COL.green : '#555'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px + (ax - px) / al * 18, py + (ay - py) / al * 18);
      ctx.lineTo(px + (ax - px) / al * 28, py + (ay - py) / al * 28); ctx.stroke();
      this.label(p[P.NAME], px, py - 24, isMe ? COL.green : COL.dim, 10);
    }

    // world effects
    effects.drawWorld(ctx);

    ctx.restore();

    // blackout modifier: visibility collapse
    if (room && room.mods && room.mods.includes('blackout')) {
      const sx = myPos.x - this.cam.x, sy = myPos.y - this.cam.y;
      const g = ctx.createRadialGradient(sx, sy, 90, sx, sy, 300);
      g.addColorStop(0, 'rgba(5,5,5,0)');
      g.addColorStop(1, 'rgba(5,5,5,0.96)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
      // beacons: portal pulses through dark
      if (room.portal && room.portal[2]) {
        const bx = room.portal[0] - this.cam.x, by = room.portal[1] - this.cam.y;
        ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(now * 4) * 0.3;
        ctx.strokeStyle = COL.green; ctx.lineWidth = 2;
        ctx.strokeRect(bx - 8, by - 8, 16, 16);
        ctx.restore();
      }
    }

    // custom cursor is a DOM overlay so it stays identical above menus and casino.

    // screen effects
    effects.drawScreen(ctx, this.w, this.h);
  }
}
