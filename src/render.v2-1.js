// terminal casino roguelike renderer: squares, labels above, silhouettes that telegraph mechanics
import { P, ENEMY_KINDS, ENEMY_LABELS } from './state.v2-1.js';
import { ENEMIES, SKIN_PRESETS } from '../shared/data.v2-1.js';

const COL = {
  bg: '#050505', fg: '#f3f3f3', dim: '#666',
  green: '#00ff66', red: '#ff3048', purple: '#b45cff', cyan: '#66f6ff', gold: '#ffd34d',
  wall: '#0d0d0d', wallEdge: '#2c2c2c', grid: '#0b0b0b'
};

const SKIN_META_BY_ID = Object.fromEntries(SKIN_PRESETS.map(s => [s.id, s]));
function rgba(hex, a = 1) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return hex || `rgba(255,255,255,${a})`;
  const v = m[1];
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
function skinMeta(id, fill, outline) {
  const base = SKIN_META_BY_ID[String(id || '')] || {};
  return {
    id: String(id || base.id || 'terminal_mint'), rarity: String(base.rarity || 'basic'),
    fill: fill || base.fill || '#f3f3f3', outline: outline || base.outline || '#00ff66', barrel: base.barrel || outline || '#f3f3f3'
  };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0 };
    this.companionTrail = new Map();
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

  bossHpBar(x, y, size, hp01, color = COL.red) {
    const ctx = this.ctx;
    const pct = Math.max(0, Math.min(100, Number(hp01) || 0));
    const bw = Math.max(82, size * 1.55);
    const bx = Math.round(x - bw / 2);
    const by = Math.round(y - size / 2 - 33);
    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = 'rgba(0,0,0,0.74)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
    ctx.strokeStyle = '#f3f3f3';
    ctx.globalAlpha = 0.34;
    ctx.strokeRect(bx - 2, by - 2, bw + 4, 14);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#202020';
    ctx.fillRect(bx, by, bw, 6);
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, bw * pct / 100, 6);
    ctx.fillStyle = '#f3f3f3';
    ctx.font = `700 9px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`${Math.round(pct)}%`, Math.round(x), by + 6);
    ctx.restore();
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

  drawSkinAura(x, y, meta, now) {
    const ctx = this.ctx;
    const rarity = String(meta?.rarity || 'basic');
    const outline = meta?.outline || COL.green;
    const alt = meta?.barrel || COL.fg;
    const pulse = 0.5 + 0.5 * Math.sin(now * 3.2 + x * 0.01 + y * 0.008);
    ctx.save();
    // Restrained rarity language: square-only, no orbiting dots, no body spam.
    if (rarity === 'uncommon') {
      ctx.globalAlpha = 0.12 + pulse * 0.05;
      ctx.strokeStyle = outline; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(x - 19), Math.round(y - 19), 38, 38);
    } else if (rarity === 'rare') {
      ctx.globalAlpha = 0.16 + pulse * 0.06;
      ctx.strokeStyle = outline; ctx.lineWidth = 1.15;
      ctx.strokeRect(Math.round(x - 21), Math.round(y - 21), 42, 42);
      ctx.globalAlpha = 0.08 + pulse * 0.04;
      ctx.strokeStyle = alt; ctx.strokeRect(Math.round(x - 25), Math.round(y - 25), 50, 50);
    } else if (rarity === 'superrare') {
      ctx.globalAlpha = 0.18 + pulse * 0.07;
      ctx.strokeStyle = outline; ctx.lineWidth = 1.3;
      ctx.strokeRect(Math.round(x - 22), Math.round(y - 22), 44, 44);
      ctx.globalAlpha = 0.10 + pulse * 0.05;
      ctx.strokeStyle = alt; ctx.strokeRect(Math.round(x - 28), Math.round(y - 28), 56, 56);
    } else if (rarity === 'legendary') {
      ctx.globalAlpha = 0.22 + pulse * 0.08;
      ctx.strokeStyle = outline; ctx.lineWidth = 1.8;
      ctx.strokeRect(Math.round(x - 24), Math.round(y - 24), 48, 48);
      ctx.globalAlpha = 0.13 + pulse * 0.05;
      ctx.strokeStyle = alt; ctx.lineWidth = 1.1;
      ctx.strokeRect(Math.round(x - 31), Math.round(y - 31), 62, 62);
    }
    ctx.restore();
  }

  draw(state, effects, view, myPos, mouse, now, cameraPos = null) {
    const ctx = this.ctx;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.fillStyle = COL.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const shake = effects.cameraOffset();
    const camTarget = cameraPos || myPos;
    this.cam.x = camTarget.x - this.w / 2 + shake.x;
    this.cam.y = camTarget.y - this.h / 2 + shake.y;
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

    if (room?.wires?.length) {
      ctx.save();
      for (const w of room.wires) {
        const p = (Math.sin(now * 3.0 + (w.x1 || 0) * 0.01 + (w.y1 || 0) * 0.007) + 1) * 0.5;
        ctx.globalAlpha = 0.20 + p * 0.16;
        ctx.strokeStyle = COL.cyan; ctx.lineWidth = Math.max(3, Math.round((w.w || 38) * 0.18)); ctx.setLineDash([18, 8, 4, 8]);
        ctx.beginPath(); ctx.moveTo(w.x1 || 0, w.y1 || 0); ctx.lineTo(w.x2 || 0, w.y2 || 0); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 0.28; ctx.lineWidth = 1;
        ctx.strokeRect(Math.round((w.x1 + w.x2) / 2 - 18), Math.round((w.y1 + w.y2) / 2 - 18), 36, 36);
      }
      ctx.restore();
    }

    if (room?.sockets?.length) {
      ctx.save();
      for (const so of room.sockets) {
        const x = so.x || 0, y = so.y || 0, r = so.r || 300;
        const p = (Math.sin(now * 2.1 + x * 0.01) + 1) * 0.5;
        ctx.globalAlpha = 0.12 + p * 0.14;
        ctx.strokeStyle = COL.purple; ctx.lineWidth = 2; ctx.setLineDash([14, 8, 4, 8]);
        ctx.strokeRect(Math.round(x - r / 2), Math.round(y - r / 2), Math.round(r), Math.round(r));
        ctx.setLineDash([]); ctx.globalAlpha = 0.24; ctx.fillStyle = COL.purple;
        ctx.fillRect(Math.round(x - 8), Math.round(y - 8), 16, 16);
        this.label('ANC', x, y - 18, COL.purple, 8);
      }
      ctx.restore();
    }



    if (room?.prismZones?.length) {
      ctx.save();
      for (const z of room.prismZones) {
        const p = (Math.sin(now * 2.7 + (z.x || 0) * 0.012 + (z.y || 0) * 0.017) + 1) * 0.5;
        ctx.globalAlpha = 0.10 + p * 0.10;
        ctx.fillStyle = COL.cyan;
        ctx.fillRect(Math.round(z.x), Math.round(z.y), Math.round(z.w), Math.round(z.h));
        ctx.globalAlpha = 0.34;
        ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2; ctx.setLineDash([10, 7, 3, 7]);
        ctx.strokeRect(Math.round(z.x), Math.round(z.y), Math.round(z.w), Math.round(z.h));
        ctx.setLineDash([]);
        this.label('SLOW x3', z.x + z.w / 2, z.y + z.h / 2, COL.cyan, 8);
      }
      ctx.restore();
    }

    if (room?.movingWalls?.length) {
      ctx.save();
      for (const w of room.movingWalls) {
        const pulse = (Math.sin(now * 4.2 + (w.x || 0) * 0.01) + 1) * 0.5;
        ctx.globalAlpha = 0.16 + pulse * 0.12;
        ctx.fillStyle = 'rgba(255,48,72,0.22)';
        ctx.fillRect(Math.round(w.x), Math.round(w.y), Math.round(w.w), Math.round(w.h));
        ctx.globalAlpha = 0.72 + pulse * 0.24;
        ctx.strokeStyle = COL.red; ctx.lineWidth = 2.6; ctx.setLineDash([12, 8, 3, 8]);
        ctx.strokeRect(Math.round(w.x), Math.round(w.y), Math.round(w.w), Math.round(w.h));
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.45 + pulse * 0.22;
        ctx.strokeStyle = COL.fg; ctx.lineWidth = 1;
        const inset = 7 + pulse * 5;
        ctx.strokeRect(Math.round(w.x + inset), Math.round(w.y + inset), Math.round(Math.max(4, w.w - inset * 2)), Math.round(Math.max(4, w.h - inset * 2)));
        this.label('DAMAGE ZONE', w.x + w.w / 2, w.y - 12, COL.red, 8);
      }
      ctx.restore();
    }

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

    // bullets — each weapon gets distinct signal language
    for (const b of view.bullets) {
      const [bulletId, rawBx, rawBy, vx, vy, size, fromP, rocket, kind, elem = '', echoProc = 0, longshot = 0, ownerId = ''] = b;
      let bx = rawBx, by = rawBy;
      if (fromP && ownerId && ownerId === state.myId && !state.localMode && myPos) {
        const meAuth = state.me?.();
        if (meAuth) { bx += (myPos.x - meAuth[P.X]); by += (myPos.y - meAuth[P.Y]); }
      }
      const enemyEcho = !fromP && !!echoProc;
      const enemyEchoColor = '#ff3048';
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(Math.atan2(vy, vx));
      if (rocket) {
        ctx.strokeStyle = enemyEcho ? enemyEchoColor : COL.fg; ctx.lineWidth = enemyEcho ? 2.8 : 2;
        ctx.strokeRect(-size * 1.15, -size * 0.62, size * 2.25, size * 1.24);
        ctx.fillStyle = enemyEcho ? 'rgba(255,48,72,0.95)' : 'rgba(255,48,72,0.7)';
        ctx.fillRect(-size * 1.65, -size * 0.30, size * 0.48, size * 0.60);
        ctx.strokeStyle = enemyEcho ? '#ff6a78' : COL.red; ctx.lineWidth = enemyEcho ? 1.8 : 1; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(-size * 2.8, 0); ctx.lineTo(-size * 4.6, 0); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.35; ctx.fillStyle = COL.red; ctx.fillRect(-size * 2.5, -1.5, size * 0.8, 3);
      } else if (kind === 'seeker') {
        // SEK v3: small square lock-round with a clear outline; no needle/bubble silhouette.
        const tick = Math.floor(now * 18 + bx * 0.04 + by * 0.03) & 1;
        const s = Math.max(4, size);
        ctx.globalAlpha = 0.98;
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.strokeStyle = enemyEcho ? enemyEchoColor : COL.cyan; ctx.lineWidth = enemyEcho ? 2.2 : 1.6;
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.globalAlpha = 0.86;
        ctx.strokeStyle = COL.fg; ctx.lineWidth = 1;
        ctx.strokeRect(-s + 2, -s + 2, Math.max(2, s * 2 - 4), Math.max(2, s * 2 - 4));
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = enemyEcho ? enemyEchoColor : COL.cyan;
        ctx.fillRect(-s * 0.35, -1, s * 0.7, 2);
        ctx.fillRect(-1, -s * 0.35, 2, s * 0.7);
        ctx.globalAlpha = 0.34;
        ctx.fillRect(Math.round(-s * 2.2 - tick * 2), -1, 3, 2);
        ctx.fillRect(Math.round(-s * 3.0 - tick * 2), 2, 2, 2);
      } else if (kind === 'shotgun_slug') {
        const s2 = Math.max(7, size);
        ctx.fillStyle = fromP ? COL.fg : COL.red;
        ctx.fillRect(-s2 * 1.85, -s2 * 0.45, s2 * 3.7, s2 * 0.9);
        ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]);
        ctx.strokeRect(-s2 * 2.1, -s2 * 0.78, s2 * 4.2, s2 * 1.56);
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.35; ctx.fillStyle = COL.cyan; ctx.fillRect(-s2 * 4.2, -1.5, s2 * 1.55, 3);
      } else if (kind === 'shotgun') {
        ctx.fillStyle = fromP ? COL.fg : COL.red;
        ctx.fillRect(-size * 0.8, -size * 0.8, size * 1.6, size * 1.6);
        ctx.globalAlpha = 0.35; ctx.fillRect(-size * 2.5, -size * 0.25, size * 1.2, size * 0.5);
      } else if (kind === 'command_pulse') {
        const s = Math.max(5, size);
        ctx.fillStyle = 'rgba(0,0,0,0.82)';
        ctx.fillRect(-s * 1.35, -s * 0.75, s * 2.7, s * 1.5);
        ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1.7;
        ctx.strokeRect(-s * 1.35, -s * 0.75, s * 2.7, s * 1.5);
        ctx.globalAlpha = 0.78; ctx.fillStyle = COL.cyan;
        ctx.fillRect(-s * 0.45, -1, s * 0.9, 2);
      } else if (kind === 'quarantine_anchor') {
        const s = Math.max(7, size);
        ctx.rotate(now * 1.4);
        ctx.fillStyle = 'rgba(0,0,0,0.86)';
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2;
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.globalAlpha = 0.76; ctx.strokeStyle = COL.purple; ctx.lineWidth = 1.2;
        ctx.strokeRect(-s * 0.52, -s * 0.52, s * 1.04, s * 1.04);
      } else if (kind === 'process_saw') {
        const s = Math.max(8, size);
        ctx.rotate(now * 9.0);
        ctx.fillStyle = 'rgba(102,246,255,0.16)';
        ctx.fillRect(-s * 1.15, -s * 1.15, s * 2.3, s * 2.3);
        ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1.8;
        ctx.strokeRect(-s * 1.15, -s * 1.15, s * 2.3, s * 2.3);
        ctx.strokeStyle = COL.fg; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke();
      } else if (kind === 'roulette') {
        // RLT v2.1.139: one clean rotating square. No tails, inner glyphs, reels, or extra ornaments.
        const s = Math.max(7, size);
        let spinSeed = 0;
        const sid = String(bulletId || '');
        for (let si = 0; si < sid.length; si++) spinSeed = (spinSeed + sid.charCodeAt(si) * (si + 1)) % 628;
        ctx.rotate(now * 7.4 + spinSeed * 0.01);
        ctx.globalAlpha = 1;
        ctx.fillStyle = fromP ? '#ffd34d' : '#ff3048';
        ctx.fillRect(-s, -s, s * 2, s * 2);
        ctx.strokeStyle = '#050505';
        ctx.lineWidth = Math.max(1.5, Math.min(3, s * 0.10));
        ctx.strokeRect(-s, -s, s * 2, s * 2);
      } else {
        ctx.fillStyle = fromP ? COL.fg : COL.red;
        ctx.fillRect(-size, -size / 2.4, size * 2, size / 1.2);
      }
      if (fromP && echoProc && kind !== 'roulette') {
        ctx.globalAlpha = 0.82;
        ctx.strokeStyle = COL.purple; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
        const esz = Math.max(8, size * (kind === 'shotgun_slug' ? 3.0 : 2.5));
        ctx.strokeRect(-esz * 0.5 + 2, -esz * 0.5 - 2, esz, esz);
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.42; ctx.fillStyle = COL.purple;
        ctx.fillRect(-size * 3.2, -size * 0.18, size * 1.15, Math.max(2, size * 0.36));
      } else if (enemyEcho) {
        ctx.globalAlpha = 0.90;
        ctx.strokeStyle = enemyEchoColor; ctx.lineWidth = 1.8; ctx.setLineDash([2, 3]);
        const esz = Math.max(10, size * (rocket ? 3.2 : 2.7));
        ctx.strokeRect(-esz * 0.5 - 1, -esz * 0.5 + 1, esz, esz);
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.55; ctx.fillStyle = enemyEchoColor;
        ctx.fillRect(-size * 3.4, -size * 0.22, size * 1.35, Math.max(2, size * 0.44));
      }
      if (fromP && elem) {
        const es = String(elem);
        ctx.globalAlpha = 0.92;
        if (kind === 'roulette') {
          // RLT elemental overlay stays square-only. No tails, side fins, needles, or protrusions.
          const rs = Math.max(7, size);
          ctx.setLineDash([]);
          if (es.includes('fire')) {
            ctx.globalAlpha = 0.82;
            ctx.strokeStyle = COL.red; ctx.lineWidth = Math.max(1.2, Math.min(2.4, rs * 0.08));
            ctx.strokeRect(-rs * 0.76, -rs * 0.76, rs * 1.52, rs * 1.52);
          }
          if (es.includes('freeze')) {
            ctx.globalAlpha = 0.80;
            ctx.strokeStyle = COL.cyan; ctx.lineWidth = Math.max(1.1, Math.min(2.2, rs * 0.07));
            ctx.strokeRect(-rs * 0.56, -rs * 0.56, rs * 1.12, rs * 1.12);
          }
          if (es.includes('poison')) {
            ctx.globalAlpha = 0.78;
            ctx.fillStyle = 'rgba(0,255,102,0.18)';
            ctx.fillRect(-rs * 0.70, -rs * 0.70, rs * 1.40, rs * 1.40);
            ctx.globalAlpha = 0.96;
            ctx.strokeStyle = COL.green; ctx.lineWidth = Math.max(1.4, Math.min(2.6, rs * 0.09));
            ctx.strokeRect(-rs * 0.86, -rs * 0.86, rs * 1.72, rs * 1.72);
          }
        } else {
          if (es.includes('fire')) {
            ctx.globalAlpha = 0.95;
            ctx.strokeStyle = COL.red; ctx.lineWidth = 1.7;
            ctx.strokeRect(-size * 1.45, -size * 0.95, size * 2.9, size * 1.9);
            ctx.fillStyle = 'rgba(255,48,72,0.55)'; ctx.fillRect(-size * 2.2, -2, size * 0.9, 4);
          }
          if (es.includes('freeze')) {
            ctx.globalAlpha = 0.95;
            ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1.35; ctx.setLineDash([2, 3]);
            ctx.strokeRect(-size * 1.72, -size * 1.12, size * 3.44, size * 2.24);
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(102,246,255,0.42)'; ctx.fillRect(-size * 2.75, -1.5, size * 0.78, 3);
          }
          if (es.includes('poison')) {
            ctx.globalAlpha = 0.95;
            ctx.strokeStyle = COL.green; ctx.lineWidth = 1.35;
            ctx.strokeRect(-size * 1.15, -size * 1.25, size * 2.3, size * 0.35);
            ctx.strokeRect(-size * 1.15, size * 0.90, size * 2.3, size * 0.35);
            ctx.fillStyle = 'rgba(0,255,102,0.40)'; ctx.fillRect(-size * 3.15, 1.5, size * 0.65, 3);
          }
        }
      }
      ctx.restore();
    }

    // armor links are drawn before silhouettes so the shell carriers visibly connect to their batteries
    const enemyById = new Map(view.enemies.map(row => [row[0], row]));
    for (const e of view.enemies) {
      const [eid, kindIdx, ex, ey, hp01, size, st, elite, dirX, dirY, shellPct = 0, shellLock = 0, linkId = '', shellType = ''] = e;
      if (!linkId) continue;
      const target = enemyById.get(linkId);
      if (!target) continue;
      ctx.save();
      ctx.globalAlpha = 0.72 + Math.sin(now * 18) * 0.16;
      ctx.strokeStyle = shellLock ? COL.red : (shellType === 'linked' ? COL.purple : COL.cyan);
      ctx.lineWidth = shellLock ? 2.4 : 1.4;
      ctx.setLineDash([10, 7, 2, 7]);
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(target[2], target[3]);
      ctx.stroke();
      ctx.restore();
    }

    // enemies — silhouette = mechanic
    for (const e of view.enemies) {
      const [eid, kindIdx, ex, ey, hp01, size, st, elite, dirX, dirY, shellPct = 0, shellLock = 0, linkId = '', shellType = '', exposed = 0, frozen = 0, burn = 0, poison = 0, chill = 0, stun = 0, shellRegen = 0, spawnDelay = 0, ctrlLock = 0, ctrlPct = 0, lvcLock = 0, lvcKind = ''] = e;
      const kind = ENEMY_KINDS[kindIdx];
      const isBossKind = !!(ENEMIES[kind]?.boss || kind === 'boss');
      const stroke = elite ? COL.red : COL.fg;
      if (spawnDelay > 0) {
        const pulse = 0.45 + 0.35 * Math.sin(now * 14 + ex * 0.01);
        if (kind === 'slot_mob') {
          ctx.save();
          const r = Math.max(70, size + 54);
          const p = Math.max(0, Math.min(1, 1 - spawnDelay / 1.0));
          ctx.globalAlpha = 0.35 + pulse * 0.28;
          ctx.strokeStyle = COL.gold; ctx.lineWidth = 2; ctx.setLineDash([3, 6]);
          ctx.strokeRect(Math.round(ex - r / 2), Math.round(ey - r / 2), Math.round(r), Math.round(r));
          ctx.setLineDash([]);
          const syms = ['GLD','EXP','STC','WPN','ABL','BAD','JCK','RAR'];
          ctx.fillStyle = COL.gold;
          ctx.font = '700 8px var(--mono, monospace)';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (let i = 0; i < 18; i++) {
            const a = i * 2.399 + now * 2.2;
            const d = r * (0.65 - p * 0.52) + ((i * 13) % 17);
            const px = ex + Math.cos(a) * d;
            const py = ey + Math.sin(a) * d;
            ctx.globalAlpha = 0.38 + ((i % 3) * 0.08);
            ctx.fillText(syms[i % syms.length], Math.round(px), Math.round(py));
          }
          ctx.restore();
          continue;
        }
        const warn = '#8a8a8a';
        ctx.save();
        ctx.globalAlpha = 0.18 + pulse * 0.18;
        ctx.strokeStyle = warn; ctx.lineWidth = 2; ctx.setLineDash([10, 6]);
        const r = Math.max(44, size + 36);
        ctx.strokeRect(Math.round(ex - r / 2), Math.round(ey - r / 2), Math.round(r), Math.round(r));
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.10 + pulse * 0.10;
        ctx.fillStyle = warn; ctx.fillRect(Math.round(ex - 5), Math.round(ey - 5), 10, 10);
        ctx.restore();
        continue;
      }
      if (kind === 'bouncer') {
        this.square(ex, ey, size, { stroke, lw: 2.5, rotate: Math.PI / 4, fill: 'rgba(255,255,255,0.06)' });
      } else if (kind === 'tank') {
        this.square(ex, ey, size, { stroke, lw: 5, fill: 'rgba(255,255,255,0.04)' });
      } else if (kind === 'shooter') {
        this.square(ex, ey, size, { stroke, lw: 2, fill: 'rgba(255,255,255,0.04)' });
        ctx.strokeStyle = stroke; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex, ey);
        ctx.lineTo(ex + (dirX / 100) * size, ey + (dirY / 100) * size); ctx.stroke();
      } else if (kind === 'wall_clinger') {
        const open = st === 'burst' || st === 'open';
        const body = open ? size : size * 0.72;
        const tone = open ? COL.red : COL.cyan;
        this.square(ex, ey, body, { stroke: tone, lw: open ? 2.4 : 4.2, fill: open ? 'rgba(255,48,72,0.09)' : 'rgba(102,246,255,0.08)' });
        if (!open) {
          ctx.save();
          ctx.globalAlpha = 0.72;
          ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
          ctx.strokeRect(Math.round(ex - size * 0.66), Math.round(ey - size * 0.36), Math.round(size * 1.32), Math.round(size * 0.72));
          ctx.setLineDash([]);
          ctx.restore();
        } else {
          ctx.save();
          ctx.strokeStyle = COL.red; ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ex - size * 0.55, ey - size * 0.10); ctx.lineTo(ex + size * 0.55, ey - size * 0.10);
          ctx.moveTo(ex - size * 0.42, ey + size * 0.22); ctx.lineTo(ex + size * 0.42, ey + size * 0.22);
          ctx.stroke();
          ctx.restore();
        }
        ctx.strokeStyle = tone; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(ex, ey);
        ctx.lineTo(ex + ((dirX / 100) || 1) * size * 0.9, ey + ((dirY / 100) || 0) * size * 0.9); ctx.stroke();
        this.label('WCL', ex, ey - size / 2 - 10, tone, 9);
      } else if (kind === 'charger' || kind === 'boss_q_revisor' || kind === 'boss_hunter_duelist') {
        const winding = st === 'windup';
        if (winding) {
          ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(now * 20) * 0.4;
          ctx.strokeStyle = COL.red; ctx.lineWidth = kind === 'charger' ? 2 : 2.8; ctx.setLineDash([8, 6]);
          ctx.beginPath(); ctx.moveTo(ex, ey);
          const len = kind === 'charger' ? 320 : 460;
          const dx = (dirX / 100) || 1, dy = (dirY / 100) || 0;
          const tx = ex + dx * len, ty = ey + dy * len;
          ctx.lineTo(tx, ty); ctx.stroke();
          if (kind === 'charger') {
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.92;
            ctx.fillStyle = COL.red;
            ctx.fillRect(Math.round(tx - 4), Math.round(ty - 4), 8, 8);
            ctx.strokeStyle = '#f3f3f3'; ctx.lineWidth = 1;
            ctx.strokeRect(Math.round(tx - 5), Math.round(ty - 5), 10, 10);
          }
          ctx.restore();
        }
        this.square(ex, ey, size * (winding ? 0.85 : 1), {
          stroke: winding ? COL.red : stroke, lw: kind === 'charger' ? 3 : 4, fill: 'rgba(255,255,255,0.05)'
        });
        if (kind === 'boss_q_revisor') {
          this.label('RUSH', ex, ey - size / 2 - 14, winding ? COL.red : COL.cyan, 12);
          this.bossHpBar(ex, ey, size, hp01, COL.cyan);
        }
        else if (kind === 'boss_hunter_duelist') {
          this.label('HNT-I', ex, ey - size / 2 - 12, COL.red, 10);
          this.bossHpBar(ex, ey, size, hp01, COL.red);
        }
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
      } else if (kind === 'echo') {
        this.square(ex, ey, size, { stroke: COL.purple, lw: 2, fill: 'rgba(180,92,255,0.06)' });
        this.square(ex + Math.sin(now * 12) * 4, ey, size * 0.72, { stroke: '#777', lw: 1 });
        this.label('ECH', ex, ey - size / 2 - 9, COL.purple, 9);
      } else if (kind === 'orbiter') {
        this.square(ex, ey, size, { stroke: COL.cyan, lw: 2.5, fill: 'rgba(102,246,255,0.05)' });
        const fx = (dirX / 100) || 1, fy = (dirY / 100) || 0;
        ctx.strokeStyle = COL.cyan; ctx.lineWidth = 4; ctx.beginPath();
        ctx.moveTo(ex + fx * size * 0.55 - fy * size * 0.3, ey + fy * size * 0.55 + fx * size * 0.3);
        ctx.lineTo(ex + fx * size * 0.55 + fy * size * 0.3, ey + fy * size * 0.55 - fx * size * 0.3); ctx.stroke();
        this.label('ORB', ex, ey - size / 2 - 9, COL.cyan, 9);
      } else if (kind === 'anchor') {
        this.square(ex, ey, size, { stroke: COL.purple, lw: 5, fill: 'rgba(180,92,255,0.08)' });
        this.square(ex, ey, size * 0.55, { stroke: COL.purple, lw: 2, rotate: Math.PI / 4 });
        ctx.save(); ctx.globalAlpha = 0.16 + Math.sin(now * 4) * 0.05; ctx.strokeStyle = COL.purple; ctx.setLineDash([10, 10]); ctx.strokeRect(ex - 125, ey - 125, 250, 250); ctx.restore();
        this.label('ANC', ex, ey - size / 2 - 9, COL.purple, 9);
      } else if (kind === 'splitter') {
        this.square(ex, ey, size, { stroke, lw: 2, fill: 'rgba(255,255,255,0.04)' });
        this.square(ex, ey, size * 0.55, { stroke, lw: 1, rotate: Math.PI / 4 });
        this.label('SPL', ex, ey - size / 2 - 9, COL.dim, 9);
      } else if (kind === 'prism') {
        this.square(ex, ey, size, { stroke: COL.cyan, lw: 2, rotate: Math.PI / 4, fill: 'rgba(102,246,255,0.05)' });
        ctx.strokeStyle = COL.cyan; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex - size/2, ey); ctx.lineTo(ex + size/2, ey); ctx.moveTo(ex, ey - size/2); ctx.lineTo(ex, ey + size/2); ctx.stroke();
        this.label('PRS', ex, ey - size / 2 - 9, COL.cyan, 9);
      } else if (kind === 'pulse') {
        this.square(ex, ey, size, { stroke: COL.red, lw: 2.5, fill: 'rgba(255,48,72,0.07)' });
        const fx = (dirX / 100) || 1, fy = (dirY / 100) || 0; ctx.strokeStyle = COL.red; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + fx * 54, ey + fy * 54); ctx.stroke(); ctx.setLineDash([]);
        this.label('PLS', ex, ey - size / 2 - 9, COL.red, 9);
      } else if (kind === 'leech') {
        this.square(ex, ey, size, { stroke: COL.green, lw: 2, fill: 'rgba(0,255,102,0.06)' });
        ctx.strokeStyle = COL.green; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex - size*0.35, ey); ctx.lineTo(ex + size*0.35, ey); ctx.moveTo(ex, ey - size*0.35); ctx.lineTo(ex, ey + size*0.35); ctx.stroke();
        this.label('LCH', ex, ey - size / 2 - 9, COL.green, 9);
      } else if (kind === 'damper') {
        const rr = 280;
        this.square(ex, ey, size, { stroke: COL.cyan, lw: 4, fill: 'rgba(102,246,255,0.07)' });
        this.square(ex, ey, size * 0.58, { stroke: COL.purple, lw: 2, rotate: Math.PI / 4 });
        ctx.save();
        ctx.globalAlpha = 0.18 + Math.sin(now * 5) * 0.04;
        ctx.strokeStyle = COL.cyan;
        ctx.lineWidth = 2;
        ctx.setLineDash([14, 8, 3, 8]);
        ctx.strokeRect(ex - rr / 2, ey - rr / 2, rr, rr);
        ctx.globalAlpha = 0.09;
        ctx.fillStyle = COL.cyan;
        ctx.fillRect(ex - rr / 2, ey - rr / 2, rr, rr);
        ctx.restore();
        this.label('DMP', ex, ey - size / 2 - 9, COL.cyan, 9);
      } else if (kind === 'warden') {
        this.square(ex, ey, size, { stroke: COL.red, lw: 3.5, fill: 'rgba(255,48,72,0.05)' });
        this.square(ex, ey, size * 0.68, { stroke: COL.purple, lw: 2, rotate: Math.PI / 4 });
        ctx.strokeStyle = COL.red; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(ex - size * 0.55, ey); ctx.lineTo(ex + size * 0.55, ey); ctx.stroke(); ctx.setLineDash([]);
        this.label('WRD', ex, ey - size / 2 - 9, COL.red, 9);
      } else if (kind === 'herald') {
        this.square(ex, ey, size, { stroke: COL.red, lw: 4, fill: 'rgba(255,48,72,0.06)' });
        this.square(ex, ey, size * 0.65, { stroke: COL.purple, lw: 2 });
        this.label('HRD', ex, ey - size / 2 - 9, COL.red, 9);
      } else if (kind === 'slot_mob') {
        const stateText = String(st || 'slot_runner:1');
        const modeRaw = (stateText.match(/slot_([^:]+)/) || [,'runner'])[1];
        const lives = Math.max(1, Number((stateText.match(/:(\d+)/) || [,'1'])[1]) || 1);
        if (modeRaw === 'hidden') continue;
        const isAssemble = modeRaw === 'assemble';
        const isRebuild = modeRaw === 'rebuild' || modeRaw === 'rolling';
        const isChargerWindup = modeRaw === 'charger_windup';
        const isChargerCharge = modeRaw === 'charger_charge';
        const isChargerCool = modeRaw === 'charger_cool';
        const mode = (isChargerWindup || isChargerCharge || isChargerCool) ? 'charger' : modeRaw;
        const pulse = 0.5 + Math.sin(now * 18) * 0.22;
        const frameCol = isRebuild ? COL.gold : (mode === 'charger' ? COL.red : mode === 'shooter' ? COL.cyan : mode === 'pulse' ? COL.purple : COL.fg);
        ctx.save();
        if (isAssemble) {
          const syms = ['GLD','EXP','STC','WPN','ABL','BAD','RAR','JCK'];
          ctx.font = '700 9px var(--mono, monospace)';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (let i = 0; i < 28; i++) {
            const a = i * 2.399 + now * 2.1;
            const d = 86 - ((now * 48 + i * 7) % 54);
            const px = ex + Math.cos(a) * d;
            const py = ey + Math.sin(a) * d;
            ctx.globalAlpha = 0.28 + (i % 5) * 0.08;
            ctx.fillStyle = i % 3 === 0 ? COL.cyan : (i % 3 === 1 ? COL.gold : COL.fg);
            ctx.fillText(syms[i % syms.length], Math.round(px), Math.round(py));
          }
          ctx.globalAlpha = 0.55 + pulse * 0.20;
          ctx.strokeStyle = COL.gold; ctx.lineWidth = 2; ctx.setLineDash([8, 5]);
          ctx.strokeRect(Math.round(ex - size * 0.55), Math.round(ey - size * 0.55), Math.round(size * 1.10), Math.round(size * 1.10));
          ctx.setLineDash([]);
          ctx.restore();
          this.label(`SLT ${lives}/3`, ex, ey - size / 2 - 10, COL.gold, 9);
          this.label('ASSEMBLE', ex, ey + size / 2 + 17, COL.gold, 8);
          continue;
        }
        if (isChargerWindup) {
          const dx = (dirX / 100) || 1, dy = (dirY / 100) || 0;
          ctx.save();
          ctx.globalAlpha = 0.5 + Math.sin(now * 20) * 0.4;
          ctx.strokeStyle = COL.red; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
          const tx = ex + dx * 320, ty = ey + dy * 320;
          ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.92;
          ctx.fillStyle = COL.red;
          ctx.fillRect(Math.round(tx - 4), Math.round(ty - 4), 8, 8);
          ctx.strokeStyle = '#f3f3f3'; ctx.lineWidth = 1;
          ctx.strokeRect(Math.round(tx - 5), Math.round(ty - 5), 10, 10);
          ctx.restore();
        }
        if (isRebuild) ctx.globalAlpha = 0.62 + pulse * 0.25;
        this.square(ex, ey, size * (isChargerWindup ? 0.85 : 1), { stroke: isChargerWindup ? COL.red : frameCol, lw: mode === 'charger' ? 3 : 3.5, fill: 'rgba(255,211,77,0.055)' });
        this.square(ex, ey, size * 0.70, { stroke: COL.fg, lw: 1.4, fill: 'rgba(0,0,0,0.28)' });
        const reelSyms = ['GLD','WPN','ABL','STC','BAD','RAR','JCK'];
        const fixedModeSym = { shooter: 'SHT', charger: 'CHG', runner: 'RUN', pulse: 'PLS' }[mode] || mode.toUpperCase().slice(0, 3);
        const idx = Math.floor(now * (isRebuild ? 12 : 0) + ex * 0.01 + ey * 0.01) % reelSyms.length;
        ctx.fillStyle = frameCol;
        ctx.font = '700 10px var(--mono, monospace)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isRebuild ? reelSyms[idx] : fixedModeSym, Math.round(ex), Math.round(ey));
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = frameCol;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(Math.round(ex - size * 0.38), Math.round(ey - size * 0.15), Math.round(size * 0.76), Math.round(size * 0.30));
        ctx.setLineDash([]);
        ctx.restore();
        this.label(`SLT ${lives}/3`, ex, ey - size / 2 - 10, frameCol, 9);
        if (isRebuild) this.label('ROLLING', ex, ey + size / 2 + 17, frameCol, 8);
        else if (mode !== 'charger') this.label(mode.toUpperCase().slice(0, 7), ex, ey + size / 2 + 17, frameCol, 8);
      } else if (kind === 'boss_croupier') {
        this.square(ex, ey, size, { stroke: COL.red, lw: 5.5, fill: 'rgba(255,48,72,0.05)' });
        this.square(ex, ey, size * 0.62, { stroke: COL.gold || '#f5c84b', lw: 2, rotate: Math.sin(now * 1.8) * 0.28 });
        this.square(ex, ey, size * 0.34, { stroke: COL.fg, lw: 1.5, rotate: Math.PI / 4 });
        this.label('CRP', ex, ey - size / 2 - 12, COL.red, 12);
        const bw = size * 1.45; ctx.fillStyle = '#222'; ctx.fillRect(ex - bw / 2, ey - size / 2 - 30, bw, 5); ctx.fillStyle = COL.red; ctx.fillRect(ex - bw / 2, ey - size / 2 - 30, bw * hp01 / 100, 5);
      } else if (kind === 'boss_anchor_cashier') {
        this.square(ex, ey, size, { stroke: COL.purple, lw: 6, fill: 'rgba(180,92,255,0.08)' });
        this.square(ex, ey, size * 0.62, { stroke: COL.purple, lw: 2.5, rotate: Math.PI / 4 });
        ctx.save(); ctx.globalAlpha = 0.18 + Math.sin(now * 5) * 0.05; ctx.strokeStyle = COL.purple; ctx.setLineDash([12, 10]); ctx.strokeRect(ex - 215, ey - 215, 430, 430); ctx.restore();
        this.label('ANC+', ex, ey - size / 2 - 12, COL.purple, 12);
        const bw = size * 1.45; ctx.fillStyle = '#222'; ctx.fillRect(ex - bw / 2, ey - size / 2 - 30, bw, 5); ctx.fillStyle = COL.purple; ctx.fillRect(ex - bw / 2, ey - size / 2 - 30, bw * hp01 / 100, 5);
      } else if (kind === 'boss_hunter_chorus') {
        this.square(ex, ey, size, { stroke: COL.red, lw: 4.5, fill: 'rgba(255,48,72,0.05)' });
        this.square(ex - size * 0.22, ey, size * 0.42, { stroke: COL.fg, lw: 1.6 });
        this.square(ex + size * 0.22, ey, size * 0.42, { stroke: COL.red, lw: 1.6, rotate: Math.PI / 4 });
        this.square(ex, ey - size * 0.20, size * 0.34, { stroke: COL.purple, lw: 1.4 });
        this.label('HNT', ex, ey - size / 2 - 12, COL.red, 12);
        const bw = size * 1.45; ctx.fillStyle = '#222'; ctx.fillRect(ex - bw / 2, ey - size / 2 - 30, bw, 5); ctx.fillStyle = COL.red; ctx.fillRect(ex - bw / 2, ey - size / 2 - 30, bw * hp01 / 100, 5);
      } else if (kind === 'boss_hunter_marksman') {
        this.square(ex, ey, size, { stroke: COL.red, lw: 3.5, fill: 'rgba(255,48,72,0.045)' });
        ctx.strokeStyle = COL.red; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + (dirX / 100) * size * 0.72, ey + (dirY / 100) * size * 0.72); ctx.stroke();
        this.label('HNT-II', ex, ey - size / 2 - 10, COL.red, 10);
      } else if (kind === 'boss_hunter_trapper') {
        this.square(ex, ey, size, { stroke: COL.purple, lw: 3.5, fill: 'rgba(180,92,255,0.045)' });
        this.square(ex, ey, size * 0.58, { stroke: COL.red, lw: 1.5, rotate: Math.PI / 4 });
        this.label('HNT-III', ex, ey - size / 2 - 10, COL.purple, 10);
      } else if (kind === 'boss_q_revisor') {
        this.square(ex, ey, size, { stroke: COL.cyan, lw: 5, fill: 'rgba(102,246,255,0.05)' });
        this.square(ex, ey, size * 0.68, { stroke: COL.purple, lw: 2, rotate: now * 0.55 });
        this.square(ex, ey, size * 0.36, { stroke: COL.fg, lw: 1.4 });
        this.label('RUSH', ex, ey - size / 2 - 14, COL.cyan, 12);
        this.bossHpBar(ex, ey, size, hp01, COL.cyan);
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
      if (frozen) {
        ctx.save();
        const fz = size + 18;
        ctx.globalAlpha = 0.46 + Math.sin(now * 11) * 0.08;
        ctx.strokeStyle = COL.cyan;
        ctx.lineWidth = 3;
        ctx.setLineDash([3, 5]);
        ctx.strokeRect(Math.round(ex - fz / 2), Math.round(ey - fz / 2), Math.round(fz), Math.round(fz));
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = COL.cyan;
        ctx.fillRect(Math.round(ex - fz * 0.38), Math.round(ey - fz * 0.38), Math.round(fz * 0.76), Math.round(fz * 0.76));
        ctx.globalAlpha = 0.78;
        ctx.strokeStyle = '#f3f3f3';
        ctx.lineWidth = 1.4;
        const shards = Math.max(3, Math.min(7, Math.round(size / 9)));
        for (let i = 0; i < shards; i++) {
          const a = i * Math.PI * 2 / shards + now * 0.18;
          const sx = ex + Math.cos(a) * fz * 0.33;
          const sy = ey + Math.sin(a) * fz * 0.33;
          ctx.beginPath();
          ctx.moveTo(sx - 5, sy); ctx.lineTo(sx + 5, sy);
          ctx.moveTo(sx, sy - 5); ctx.lineTo(sx, sy + 5);
          ctx.stroke();
        }
        ctx.restore();
        this.label('FROZEN', ex, ey + size / 2 + 18, COL.cyan, 8);
      } else if (chill) {
        ctx.save();
        ctx.globalAlpha = 0.42 + Math.sin(now * 12) * 0.06;
        ctx.strokeStyle = COL.cyan;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        const cz = size + 14;
        ctx.strokeRect(Math.round(ex - cz / 2), Math.round(ey - cz / 2), Math.round(cz), Math.round(cz));
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = COL.cyan;
        ctx.fillRect(Math.round(ex - cz * 0.32), Math.round(ey - cz * 0.32), Math.round(cz * 0.64), Math.round(cz * 0.64));
        ctx.restore();
        this.label('CHILL', ex, ey + size / 2 + 18, COL.cyan, 8);
      }
      if (stun) {
        ctx.save();
        const sz = size + 18;
        ctx.globalAlpha = 0.56 + Math.sin(now * 18) * 0.08;
        ctx.strokeStyle = '#f3f3f3';
        ctx.lineWidth = 2;
        ctx.setLineDash([9, 5, 2, 5]);
        ctx.strokeRect(Math.round(ex - sz / 2), Math.round(ey - sz / 2), Math.round(sz), Math.round(sz));
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = COL.cyan;
        ctx.strokeRect(Math.round(ex - sz / 2 + 5), Math.round(ey - sz / 2 + 5), Math.round(sz - 10), Math.round(sz - 10));
        ctx.restore();
        this.label('STUN', ex, ey + size / 2 + (frozen || chill ? 34 : 18), '#f3f3f3', 8);
      }
      if (exposed) {
        ctx.save();
        ctx.globalAlpha = 0.38 + Math.sin(now * 14) * 0.12;
        ctx.strokeStyle = COL.purple;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4, 1, 4]);
        const exSize = size + 20;
        ctx.strokeRect(ex - exSize / 2, ey - exSize / 2, exSize, exSize);
        ctx.restore();
        this.label('EXPOSED', ex, ey + size / 2 + (shellPct > 0 || shellLock ? 36 : 18), COL.purple, 8);
      }
      if (burn || poison) {
        ctx.save();
        ctx.globalAlpha = 0.32;
        if (burn) { ctx.strokeStyle = COL.red; ctx.lineWidth = 1.5; ctx.strokeRect(ex - size / 2 - 7, ey - size / 2 - 7, size + 14, size + 14); }
        if (poison) { ctx.strokeStyle = COL.green; ctx.lineWidth = 1.2; ctx.setLineDash([3, 4]); ctx.strokeRect(ex - size / 2 - 11, ey - size / 2 - 11, size + 22, size + 22); ctx.setLineDash([]); }
        ctx.restore();
        if (burn && poison) this.label('VOLATILE', ex, ey + size / 2 + (frozen || exposed ? 34 : 18), COL.red, 8);
        else if (burn) this.label('BURN', ex, ey + size / 2 + (frozen || exposed ? 34 : 18), COL.red, 8);
        else if (poison) this.label('POISON', ex, ey + size / 2 + (frozen || exposed ? 34 : 18), COL.green, 8);
      }
      // Real armor shell: absorbs hits before HP. Red/purple lock means a linked battery mob is keeping it unbreakable.
      if (shellPct > 0 || shellLock) {
        const pulse = 0.5 + Math.sin(now * (shellLock ? 18 : 9)) * 0.18;
        const shSize = size + 14 + (shellLock ? 5 : 0);
        ctx.save();
        ctx.globalAlpha = shellLock ? 0.82 : 0.48;
        ctx.strokeStyle = shellLock ? COL.red : (shellType === 'linked' ? COL.purple : COL.cyan);
        ctx.lineWidth = shellLock ? 3.2 : 2.2;
        ctx.setLineDash(shellLock ? [12, 5, 2, 5] : [8, 7]);
        ctx.strokeRect(ex - shSize / 2, ey - shSize / 2, shSize, shSize);
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.18 + pulse * 0.16;
        ctx.strokeStyle = shellLock ? COL.purple : (shellType === 'linked' ? COL.red : COL.cyan);
        const inner = shSize - 8;
        ctx.strokeRect(ex - inner / 2, ey - inner / 2, inner, inner);
        if (!shellLock && shellPct < 100) {
          ctx.globalAlpha = 0.78;
          ctx.strokeStyle = COL.fg;
          ctx.lineWidth = 1;
          const cracks = Math.max(1, Math.round((100 - shellPct) / 22));
          for (let i = 0; i < cracks; i++) {
            const a = now * 0.6 + i * 1.73;
            const sx = ex + Math.cos(a) * shSize * 0.42;
            const sy = ey + Math.sin(a) * shSize * 0.42;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a + 1.1) * 10, sy + Math.sin(a + 1.1) * 10); ctx.stroke();
          }
        }
        const bw = Math.max(24, size * 1.15);
        const by = ey - size / 2 - 15;
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(ex - bw / 2, by, bw, 4);
        ctx.strokeStyle = shellRegen ? '#8dffb8' : (shellLock ? COL.red : COL.cyan);
        ctx.lineWidth = 1;
        ctx.strokeRect(ex - bw / 2, by, bw, 4);
        ctx.fillStyle = shellRegen ? '#8dffb8' : (shellType === 'linked' ? COL.purple : COL.cyan);
        ctx.fillRect(ex - bw / 2 + 1, by + 1, Math.max(0, (bw - 2) * Math.min(100, Math.max(0, shellPct)) / 100), 2);
        if (shellRegen) {
          ctx.globalAlpha = 0.45 + Math.sin(now * 14) * 0.18;
          ctx.fillStyle = '#baffd2';
          ctx.fillRect(ex + bw / 2 + 3, by, 5, 4);
          ctx.fillRect(ex + bw / 2 + 10, by + 1, 3, 2);
        }
        ctx.restore();
        if (shellLock) this.label('ARMOR LOCK', ex, ey + size / 2 + 20, COL.red, 8);
        else if (shellType === 'linked') this.label('LINK SHELL', ex, ey + size / 2 + 20, COL.purple, 8);
      }
      if (ctrlLock) {
        const pct = Math.max(0, Math.min(100, Number(ctrlPct || 0) || 0));
        const r = Math.max(30, size + 22);
        ctx.save();
        ctx.globalAlpha = 0.72 + Math.sin(now * 14) * 0.14;
        ctx.strokeStyle = COL.red;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([8, 4, 2, 4]);
        ctx.strokeRect(Math.round(ex - r / 2), Math.round(ey - r / 2), Math.round(r), Math.round(r));
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.fillRect(Math.round(ex - r / 2), Math.round(ey - r / 2 - 8), Math.round(r), 5);
        ctx.fillStyle = COL.red;
        ctx.fillRect(Math.round(ex - r / 2 + 1), Math.round(ey - r / 2 - 7), Math.round((r - 2) * pct / 100), 3);
        ctx.restore();
      }
      if (lvcLock) {
        ctx.save();
        const lk = String(lvcKind || 'lvc');
        const col = lk === 'spark' ? COL.cyan : COL.gold;
        const pulse = 0.58 + Math.sin(now * 12) * 0.15;
        ctx.globalAlpha = 0.72 + pulse * 0.22;
        ctx.strokeStyle = col;
        ctx.lineWidth = lk === 'spark' ? 2.4 : 2.0;
        ctx.setLineDash(lk === 'spark' ? [4, 4] : [9, 5, 2, 5]);
        const lockSize = size + 28;
        ctx.strokeRect(Math.round(ex - lockSize/2), Math.round(ey - lockSize/2), Math.round(lockSize), Math.round(lockSize));
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.90;
        this.label(lk === 'spark' ? 'SPK' : 'LVC', ex, ey - lockSize / 2 - 7, col, 8);
        ctx.restore();
      }
      // hp tick under damaged regular enemies only. Bosses already have their own readable top bar.
      if (!isBossKind && hp01 < 100) {
        ctx.fillStyle = '#222'; ctx.fillRect(ex - size / 2, ey + size / 2 + 5, size, 3);
        ctx.fillStyle = elite ? COL.red : COL.fg;
        ctx.fillRect(ex - size / 2, ey + size / 2 + 5, size * hp01 / 100, 3);
      }
      if (elite && !isBossKind) this.label('ELITE', ex, ey - size / 2 - 8, COL.red, 8);
    }

    // player-to-cursor tether: skin-aware so higher-rarity skins read differently in motion without changing gameplay.
    const meRow = view.players.find(p => p[P.ID] === state.myId);
    const myMeta = meRow ? skinMeta(meRow[P.SKINID], meRow[P.SKINFILL], meRow[P.SKINOUTLINE]) : skinMeta('terminal_mint', '#f3f3f3', COL.green);
    // REWIND MARK tether: visible return line from player to saved anchor point.
    const hasRewindAnchor = meRow && meRow[P.RMARKX] !== null && meRow[P.RMARKY] !== null && meRow[P.RMARKX] !== undefined && meRow[P.RMARKY] !== undefined && Number.isFinite(Number(meRow[P.RMARKX])) && Number.isFinite(Number(meRow[P.RMARKY]));
    if (myPos && meRow && String(meRow[P.RLABEL] || '').includes('REWIND') && (meRow[P.RT] || 0) > 0 && hasRewindAnchor) {
      const rx = Number(meRow[P.RMARKX]), ry = Number(meRow[P.RMARKY]);
      const dx = rx - myPos.x, dy = ry - myPos.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const pulse = 0.5 + Math.sin(now * 10) * 0.25;
      ctx.save();
      ctx.globalAlpha = 0.34 + pulse * 0.22;
      ctx.strokeStyle = COL.purple;
      ctx.lineWidth = 2.1;
      ctx.setLineDash([12, 5, 2, 5]);
      ctx.beginPath();
      ctx.moveTo(myPos.x + ux * 26, myPos.y + uy * 26);
      ctx.lineTo(rx - ux * 18, ry - uy * 18);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.70;
      ctx.strokeStyle = COL.purple;
      ctx.lineWidth = 1.6;
      const s = 12 + pulse * 3;
      ctx.beginPath();
      ctx.moveTo(rx - s, ry);
      ctx.lineTo(rx + s, ry);
      ctx.moveTo(rx, ry - s);
      ctx.lineTo(rx, ry + s);
      ctx.stroke();
      ctx.restore();
    }
    if (myPos && mouse) {
      const lockedAim = meRow && String(meRow[P.RLABEL] || '').includes('TARGET LOCK') && (meRow[P.RT] || 0) > 0;
      const mw = lockedAim ? { x: meRow[P.AX], y: meRow[P.AY] } : this.screenToWorld(mouse.x, mouse.y);
      const dx = mw.x - myPos.x, dy = mw.y - myPos.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const endD = d;
      ctx.save();
      ctx.globalAlpha = 0.18 + 0.08 * Math.sin(now * 7);
      ctx.strokeStyle = lockedAim ? COL.cyan : (myMeta.outline || COL.green);
      ctx.lineWidth = myMeta.rarity === 'legendary' ? 1.6 : myMeta.rarity === 'superrare' ? 1.35 : 1;
      ctx.setLineDash(myMeta.rarity === 'uncommon' ? [11, 8] : myMeta.rarity === 'rare' ? [8, 5, 2, 5] : myMeta.rarity === 'superrare' ? [14, 4, 4, 4] : myMeta.rarity === 'legendary' ? [16, 4, 2, 4] : [10, 10]);
      ctx.beginPath();
      ctx.moveTo(myPos.x + ux * 24, myPos.y + uy * 24);
      ctx.lineTo(myPos.x + ux * endD, myPos.y + uy * endD);
      ctx.stroke();
      ctx.restore();
    }

    // ghost decoys from GHOST DECOY R-active
    for (const d of (state.room?.decoys || [])) {
      const dx = d.x, dy = d.y;
      const pulse = 0.45 + Math.sin(now * 12) * 0.18;
      ctx.save();
      ctx.globalAlpha = 0.34 + pulse * 0.18;
      ctx.strokeStyle = COL.cyan;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 5, 2, 5]);
      ctx.strokeRect(dx - 13, dy - 13, 26, 26);
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = COL.cyan;
      ctx.fillRect(dx - 9, dy - 9, 18, 18);
      ctx.restore();
      this.label('DECOY', dx, dy - 24, COL.cyan, 7);
    }

    // players + companions
    for (const p of view.players) {
      const isMe = p[P.ID] === state.myId;
      const px = isMe ? myPos.x : p[P.X];
      const py = isMe ? myPos.y : p[P.Y];
      const alive = !!p[P.ALIVE];
      const inv = !!p[P.INV];
      const skinFill = /^#[0-9a-fA-F]{6}$/.test(p[P.SKINFILL] || '') ? p[P.SKINFILL] : (isMe ? COL.fg : '#cfcfcf');
      const skinOutline = /^#[0-9a-fA-F]{6}$/.test(p[P.SKINOUTLINE] || '') ? p[P.SKINOUTLINE] : (isMe ? COL.green : '#555');
      const skinId = String(p[P.SKINID] || 'terminal_mint');
      const skinMetaLocal = skinMeta(skinId, skinFill, skinOutline);
      // companions come from authoritative snapshot so drone visuals match real firing origins.
      const drones = p[P.DRONES], orbitals = 0;
      const comps = (view.companions || []).filter(c => c[1] === p[P.ID]);
      if (comps.length) {
        const liveCompIds = new Set();
        for (const c of comps) {
          const id = c[0];
          const type = c[2], cx = c[4], cy = c[5];
          liveCompIds.add(id);
          if (type === 'orbital') {
            const prev = this.companionTrail.get(id);
            const a = prev ? Math.atan2(cy - prev.y, cx - prev.x) : Math.atan2(cy - py, cx - px);
            ctx.save();
            if (prev && Math.hypot(cx - prev.x, cy - prev.y) < 90) {
              ctx.globalAlpha = 0.24;
              ctx.strokeStyle = skinMetaLocal.outline || COL.cyan;
              ctx.lineWidth = 1;
              ctx.setLineDash([6, 7]);
              ctx.beginPath();
              ctx.moveTo(prev.x, prev.y);
              ctx.lineTo(cx, cy);
              ctx.stroke();
              ctx.setLineDash([]);
              this.square(prev.x, prev.y, 7, { stroke: skinMetaLocal.outline || COL.cyan, lw: 1, alpha: 0.16, rotate: a });
            }
            ctx.restore();
            this.square(cx, cy, 13, { stroke: skinMetaLocal.outline || COL.cyan, lw: 1, alpha: 0.24, rotate: a + Math.PI / 4 });
            this.square(cx, cy, 9, { stroke: skinMetaLocal.outline || COL.cyan, lw: 2, rotate: a });
            this.companionTrail.set(id, { x: cx, y: cy, t: now });
          } else if (type === 'lvc_line') {
            const tx = Number(c[6] || cx) || cx;
            const ty = Number(c[7] || cy) || cy;
            const label = String(c[8] || 'LVC');
            const tone = /^#[0-9a-fA-F]{6}$/.test(String(c[9] || '')) ? String(c[9]) : (label === 'SPK' ? COL.cyan : COL.gold);
            const locked = !!c[10];
            const dx = tx - cx, dy = ty - cy;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len, uy = dy / len;
            const sx = cx + ux * 17, sy = cy + uy * 17;
            const ex2 = cx + ux * Math.min(len, locked ? len - 16 : 235);
            const ey2 = cy + uy * Math.min(len, locked ? len - 16 : 235);
            ctx.save();
            ctx.globalAlpha = locked ? 0.86 : 0.42;
            ctx.strokeStyle = tone; ctx.lineWidth = locked ? 2.1 : 1.35;
            ctx.setLineDash(locked ? [] : [8, 7]);
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex2, ey2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 0.95;
            ctx.strokeStyle = tone; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + ux * 28, sy + uy * 28); ctx.stroke();
            ctx.restore();
            this.label(label, sx + ux * 40, sy + uy * 40 - 8, tone, 8);
            this.companionTrail.set(id, { x: cx, y: cy, t: now });
          } else if (type === 'lvc_spark') {
            const tx = Number(c[6] || cx) || cx;
            const ty = Number(c[7] || cy) || cy;
            const ttl = Math.max(0, Number(c[8] || 0) || 0);
            const seed = Number(c[9] || 0) || 0;
            const dx = tx - cx, dy = ty - cy;
            const dist = Math.hypot(dx, dy) || 1;
            const ux = dx / dist, uy = dy / dist;
            const pxn = -uy, pyn = ux;
            const bends = Math.max(2, Math.min(5, Math.round(dist / 95) + 1));
            ctx.save();
            ctx.globalAlpha = 0.72 + Math.sin(now * 22 + seed) * 0.12;
            ctx.strokeStyle = COL.cyan; ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(cx + ux * 18, cy + uy * 18);
            for (let i = 1; i <= bends; i++) {
              const t = i / (bends + 1);
              const wobble = Math.sin(seed * 0.017 + now * 21 + i * 2.31) * (10 + Math.min(24, dist * 0.035));
              ctx.lineTo(cx + dx * t + pxn * wobble, cy + dy * t + pyn * wobble);
            }
            ctx.lineTo(tx - ux * 13, ty - uy * 13);
            ctx.stroke();
            ctx.globalAlpha = 0.22;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(cx + ux * 18, cy + uy * 18);
            ctx.lineTo(tx - ux * 13, ty - uy * 13);
            ctx.stroke();
            ctx.restore();
            if (ttl > 0) this.label(`${ttl.toFixed(1)}s`, (cx + tx) / 2, (cy + ty) / 2 - 12, COL.cyan, 8);
            this.companionTrail.set(id, { x: tx, y: ty, t: now });
          } else if (type === 'active_preview') {
            const r = Math.max(18, Number(c[6] || 80) || 80);
            const label = String(c[7] || 'READY');
            const rawTone = String(c[8] || 'cyan');
            const tone = /^#[0-9a-fA-F]{6}$/.test(rawTone) ? rawTone : (rawTone === 'red' ? COL.red : rawTone === 'purple' ? COL.purple : rawTone === 'gold' ? COL.gold : COL.cyan);
            const kind = String(c[9] || 'radius');
            ctx.save();
            if (kind === 'line') {
              const x2 = Number(c[10] || cx) || cx;
              const y2 = Number(c[11] || cy) || cy;
              const idx = Math.max(1, Number(c[12] || 1) | 0);
              const max = Math.max(idx, Number(c[13] || idx) | 0);
              const dx = x2 - cx, dy = y2 - cy;
              const len = Math.hypot(dx, dy) || 1;
              const ux = dx / len, uy = dy / len;
              ctx.globalAlpha = 0.78 + Math.sin(now * 9) * 0.08;
              ctx.strokeStyle = tone;
              ctx.lineWidth = 2;
              ctx.setLineDash([12, 8]);
              ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2); ctx.stroke();
              ctx.setLineDash([]);
              ctx.globalAlpha = 0.22;
              ctx.lineWidth = Math.max(6, r);
              ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x2, y2); ctx.stroke();
              this.square(cx, cy, 18, { stroke: tone, lw: 2, alpha: 0.80, rotate: now * 1.8 });
              this.square(x2, y2, 14, { stroke: tone, lw: 2, alpha: 0.68, rotate: -now * 1.5 });
              ctx.restore();
              this.label(`${label || 'VOID'} ${idx}/${max}`, cx + ux * Math.min(90, len * 0.45), cy + uy * Math.min(90, len * 0.45) - 14, tone, 9);
            } else {
              ctx.globalAlpha = kind === 'target' ? 0.84 : 0.56;
              ctx.strokeStyle = tone;
              ctx.lineWidth = kind === 'target' ? 2.4 : 2;
              ctx.setLineDash(kind === 'target' ? [10, 4, 2, 4] : [8, 7]);
              ctx.strokeRect(Math.round(cx - r / 2), Math.round(cy - r / 2), Math.round(r), Math.round(r));
              ctx.setLineDash([]);
              ctx.globalAlpha = 0.12;
              ctx.fillStyle = tone;
              ctx.fillRect(Math.round(cx - r / 2 + 4), Math.round(cy - r / 2 + 4), Math.round(Math.max(0, r - 8)), Math.round(Math.max(0, r - 8)));
              const node = Math.max(14, Math.min(34, r * 0.14));
              ctx.globalAlpha = 0.85;
              ctx.strokeStyle = tone; ctx.lineWidth = 2;
              ctx.strokeRect(Math.round(cx - node / 2), Math.round(cy - node / 2), Math.round(node), Math.round(node));
              ctx.restore();
              this.label(label || 'READY', cx, cy - r / 2 - 12, tone, 9);
            }
            this.companionTrail.set(id, { x: cx, y: cy, t: now });
          } else if (type === 'lc_sector') {
            const secType = String(c[6] || 'dmg');
            const ready = !!c[7], active = !!c[8], selected = !!c[9];
            const cd = Math.max(0, Number(c[10] || 0) || 0);
            const lvl = Math.max(1, Number(c[11] || 1) | 0);
            const ringOpen = !!c[12];
            const chainCharges = Math.max(0, Number(c[13] || 0) | 0);
            const tone = secType === 'guard' ? COL.cyan : secType === 'chain' ? COL.purple : secType === 'bet' ? '#ff9f1a' : secType === 'copy' ? COL.green : secType === 'ghost' ? '#7aa8ff' : secType === 'roulette' ? '#ff3048' : secType === 'deck' ? '#66f6ff' : secType === 'jackpot' ? COL.gold : secType === 'table' ? '#f3f3f3' : COL.gold;
            const rot = Number(c[3] || 0) * 0.7;
            ctx.save();
            // Connector line: these are UI panels attached to the player, not loose orbiting blocks.
            ctx.globalAlpha = 0.56;
            ctx.strokeStyle = selected ? '#f3f3f3' : tone;
            ctx.lineWidth = selected ? 1.8 : 1.1;
            ctx.setLineDash(selected ? [] : [6, 7]);
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(cx, cy);
            ctx.stroke();
            ctx.setLineDash([]);
            // Larger terminal UI plate. No inner icon: the label itself is the interaction target.
            const w = selected ? 116 : 104;
            const h = selected ? 46 : 40;
            ctx.globalAlpha = 0.90;
            ctx.fillStyle = '#050505';
            ctx.fillRect(Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
            ctx.globalAlpha = active ? 0.96 : (ready ? 0.90 : 0.46);
            ctx.strokeStyle = selected ? '#f3f3f3' : tone;
            ctx.lineWidth = selected ? 2.6 : 1.6;
            ctx.strokeRect(Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
            ctx.globalAlpha = selected ? 0.22 : 0.10;
            ctx.fillStyle = tone;
            ctx.fillRect(Math.round(cx - w / 2 + 4), Math.round(cy - h / 2 + 4), Math.round(w - 8), 3);
            ctx.restore();
            const secLabel = ({ dmg:'LVC', roulette:'RLT', deck:'CRD', guard:'GUARD', chain:'CHAIN', bet:'BET', copy:'COPY', ghost:'GHOST', jackpot:'JACK', table:'TABLE' })[secType] || String(secType || '').toUpperCase().slice(0, 6);
            this.label(secLabel, cx, cy + 2, ready ? (selected ? '#f3f3f3' : tone) : '#777', selected ? 12 : 10);
            this.companionTrail.set(id, { x: cx, y: cy, t: now });
          } else if (type === 'ctrl_proc') {
            const procLabel = String(c[6] || 'PRC');
            const cmd = !!c[7];
            const procKind = String(c[9] || '').toLowerCase();
            const size = Math.max(14, Number(c[10] || 24) || 24);
            const hp = Math.max(0, Math.min(100, Number(c[11] || 100) || 100));
            const faceX = (Number(c[12] || 100) || 100) / 100;
            const faceY = (Number(c[13] || 0) || 0) / 100;
            const prev = this.companionTrail.get(id);
            if (prev && Math.hypot(cx - prev.x, cy - prev.y) < 140) {
              ctx.save();
              ctx.globalAlpha = cmd ? 0.34 : 0.18;
              ctx.strokeStyle = cmd ? COL.green : COL.cyan;
              ctx.lineWidth = cmd ? 1.8 : 1;
              ctx.setLineDash(cmd ? [] : [5, 6]);
              ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(cx, cy); ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();
            }
            const stroke = cmd ? COL.green : COL.cyan;
            ctx.save();
            ctx.globalAlpha = 0.92;
            const fill = 'rgba(0,0,0,.56)';
            if (procKind === 'runner') {
              this.square(cx, cy, size, { stroke, lw: 1.8, fill, rotate: now * 1.2 });
            } else if (procKind === 'tank') {
              this.square(cx, cy, size, { stroke, lw: 4, fill });
              this.square(cx, cy, size * 0.58, { stroke: COL.fg, lw: 1.2 });
            } else if (procKind === 'shooter') {
              this.square(cx, cy, size, { stroke, lw: 2.2, fill });
              const fl = Math.hypot(faceX, faceY) || 1;
              const fx = faceX / fl, fy = faceY / fl;
              ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + fx * size * 0.75, cy + fy * size * 0.75); ctx.stroke();
            } else if (procKind === 'charger') {
              this.square(cx, cy, size, { stroke, lw: 3, fill });
              ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.moveTo(cx - size * 0.35, cy); ctx.lineTo(cx + size * 0.55, cy); ctx.stroke(); ctx.setLineDash([]);
            } else if (procKind === 'bomber') {
              this.square(cx, cy, size, { stroke: COL.red, lw: 2.4, fill: 'rgba(255,48,72,0.10)' });
              this.square(cx, cy, size * 0.52, { stroke, lw: 1.4, rotate: Math.PI / 4 });
            } else if (procKind === 'anchor') {
              this.square(cx, cy, size, { stroke: COL.purple, lw: 4, fill: 'rgba(180,92,255,0.08)' });
              this.square(cx, cy, size * 0.55, { stroke, lw: 2, rotate: Math.PI / 4 });
            } else if (procKind === 'prism') {
              this.square(cx, cy, size, { stroke, lw: 2, rotate: Math.PI / 4, fill });
              ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - size/2, cy); ctx.lineTo(cx + size/2, cy); ctx.moveTo(cx, cy - size/2); ctx.lineTo(cx, cy + size/2); ctx.stroke();
            } else if (procKind === 'pulse') {
              this.square(cx, cy, size, { stroke: COL.red, lw: 2.2, fill: 'rgba(255,48,72,0.06)' });
              ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(cx - size * 0.55, cy); ctx.lineTo(cx + size * 0.55, cy); ctx.stroke(); ctx.setLineDash([]);
            } else if (procKind === 'leech') {
              this.square(cx, cy, size, { stroke: COL.green, lw: 2, fill: 'rgba(0,255,102,0.07)' });
              ctx.strokeStyle = COL.green; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - size*0.35, cy); ctx.lineTo(cx + size*0.35, cy); ctx.moveTo(cx, cy - size*0.35); ctx.lineTo(cx, cy + size*0.35); ctx.stroke();
            } else {
              this.square(cx, cy, size, { stroke, lw: procKind === 'grunt' ? 2.5 : 2, fill });
            }
            ctx.globalAlpha = 0.62;
            this.square(cx, cy, Math.max(8, size * 0.42), { stroke: cmd ? COL.green : COL.cyan, lw: 1, rotate: Math.PI / 4 });
            ctx.restore();
            if (hp < 100) {
              ctx.fillStyle = '#111'; ctx.fillRect(cx - size/2, cy + size/2 + 5, size, 3);
              ctx.fillStyle = stroke; ctx.fillRect(cx - size/2, cy + size/2 + 5, size * hp / 100, 3);
            }
            this.label(procLabel, cx, cy - size / 2 - 10, stroke, 8);
            this.companionTrail.set(id, { x: cx, y: cy, t: now });
          } else {
            this.square(cx, cy, 8, { fill: skinMetaLocal.outline || COL.cyan });
            this.companionTrail.set(id, { x: cx, y: cy, t: now });
          }
        }
        for (const [id, v] of [...this.companionTrail.entries()]) {
          if (!liveCompIds.has(id) && now - (v.t || 0) > 0.8) this.companionTrail.delete(id);
        }
      } else {
        for (let i = 0; i < orbitals; i++) {
          const ang = now * 1.8 + (i / Math.max(1, orbitals)) * Math.PI * 2;
          const r = 58 + 14 * Math.floor(i / 8);
          this.square(px + Math.cos(ang) * r, py + Math.sin(ang) * r, 10, { stroke: skinMetaLocal.outline || COL.cyan, lw: 2, rotate: ang });
        }
        for (let i = 0; i < drones; i++) {
          const ang = now * 1.8 + (i / Math.max(1, drones)) * Math.PI * 2 + 100 * 1.8;
          const r = 58 + 14 * Math.floor(i / 8);
          this.square(px + Math.cos(ang) * r, py + Math.sin(ang) * r, 8, { fill: skinMetaLocal.outline || COL.cyan });
        }
      }
      if (!alive) {
        this.square(px, py, 28, { stroke: skinOutline || '#333', lw: 2, rotate: Math.PI / 4, alpha: 0.55 });
        this.label('DOWN', px, py - 24, COL.red, 9);
        this.label(p[P.NAME], px, py - 36, '#333', 10);
        continue;
      }
      ctx.save();
      const lvcHud = p[P.LVC] || null;
      const lvcChainCharges = Math.max(0, Number(lvcHud?.chainCharges || 0) | 0);
      if (lvcChainCharges > 0) {
        const gp = 0.55 + Math.sin(now * 18) * 0.16;
        ctx.save();
        ctx.globalAlpha = 0.24 + gp * 0.16;
        ctx.strokeStyle = COL.purple;
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 5, 2, 5]);
        const gr = 52 + Math.sin(now * 14) * 4;
        ctx.strokeRect(px - gr / 2, py - gr / 2, gr, gr);
        ctx.setLineDash([]);
        ctx.restore();
        this.label(`CHAIN x${lvcChainCharges}`, px, py - 50, COL.purple, 8);
      }
      const ghostActive = (String(p[P.RLABEL] || '').includes('GHOST') && Number(p[P.RT] || 0) > 0) || !!(p[P.LVC] && Number(p[P.LVC].ghostActive || 0) > 0);
      if (inv) ctx.globalAlpha = 0.55 + Math.sin(now * 18) * 0.25;
      if (ghostActive) ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.38 + Math.sin(now * 16) * 0.12);
      const redlineActive = String(p[P.RLABEL] || '').includes('REDLINE') && Number(p[P.RT] || 0) > 0;
      if (ghostActive) {
        const gp = 0.50 + Math.sin(now * 20) * 0.22;
        ctx.save();
        ctx.globalAlpha = 0.22 + gp * 0.18;
        ctx.strokeStyle = COL.cyan;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5, 2, 5]);
        const gr = 46 + Math.sin(now * 12) * 4;
        ctx.strokeRect(px - gr / 2, py - gr / 2, gr, gr);
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = COL.cyan;
        ctx.fillRect(px - 3, py - 34, 6, 6);
        ctx.restore();
        this.label('GHOST', px, py - 46, COL.cyan, 8);
      }
      if (redlineActive) {
        const pulse = 0.55 + Math.sin(now * 28) * 0.18;
        const rt = Math.max(0, Number(p[P.RT] || 0));
        ctx.save();
        ctx.globalAlpha = 0.20 + pulse * 0.16;
        ctx.strokeStyle = COL.red;
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 6]);
        const rr = 44 + Math.sin(now * 19) * 5;
        ctx.strokeRect(px - rr / 2, py - rr / 2, rr, rr);
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.28;
        for (let i = 0; i < 5; i++) {
          const a = now * 5.6 + i * Math.PI * 0.4;
          const lx = px - Math.cos(a) * (28 + i * 5);
          const ly = py - Math.sin(a) * (28 + i * 5);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx - Math.cos(a) * (18 + rt * 2), ly - Math.sin(a) * (18 + rt * 2));
          ctx.stroke();
        }
        ctx.restore();
      }
      this.drawSkinAura(px, py, skinMetaLocal, now);
      const shMax = Math.max(0, p[P.SHIELDMAX] || 0);
      const sh = Math.max(0, p[P.SHIELD] || 0);
      if (shMax > 0 && sh > 0) {
        const shPct = Math.max(0, Math.min(100, sh / shMax * 100));
        const shSize = 44;
        ctx.save();
        ctx.globalAlpha = 0.46 + Math.sin(now * 9) * 0.08;
        ctx.strokeStyle = COL.cyan;
        ctx.lineWidth = 2.2;
        ctx.setLineDash([8, 7]);
        ctx.strokeRect(px - shSize / 2, py - shSize / 2, shSize, shSize);
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.24;
        ctx.strokeRect(px - shSize / 2 + 5, py - shSize / 2 + 5, shSize - 10, shSize - 10);
        if (shPct < 100) {
          ctx.globalAlpha = 0.78;
          ctx.strokeStyle = COL.fg;
          ctx.lineWidth = 1;
          const cracks = Math.max(1, Math.round((100 - shPct) / 22));
          for (let i = 0; i < cracks; i++) {
            const a = now * 0.6 + i * 1.73;
            const sx = px + Math.cos(a) * shSize * 0.42;
            const sy = py + Math.sin(a) * shSize * 0.42;
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a + 1.1) * 10, sy + Math.sin(a + 1.1) * 10); ctx.stroke();
          }
        }
        ctx.restore();
      }
      // Skins are now static silhouettes: no rarity pulsing/jitter on the body itself.
      // The unlocked skin identity is expressed through dash VFX/SFX instead, to avoid laggy noisy player bodies.
      if (skinId === 'jackpot_wound') {
        this.square(px, py, 42, { stroke: '#ffd34d', lw: 1, alpha: 0.18, rotate: Math.PI / 4 });
        this.square(px, py, 36, { stroke: '#ff3048', lw: 1, alpha: 0.16, rotate: -Math.PI / 4 });
      } else if (skinId === 'dead_channel') {
        this.square(px, py, 40, { stroke: '#f3f3f3', lw: 1, alpha: 0.16, rotate: Math.PI / 4 });
        this.square(px, py, 34, { stroke: '#66f6ff', lw: 1, alpha: 0.14, rotate: -Math.PI / 4 });
      } else if (skinId === 'red_static' || skinId === 'mirror_coin' || skinId === 'terminal_ghost') {
        this.square(px, py, 34, { stroke: skinOutline, lw: 1, alpha: 0.18, rotate: Math.PI / 4 });
      }
      this.square(px, py, 28, { fill: skinFill, stroke: skinOutline, lw: 2 });
      // Authored preset markings: tiny signal cosmetics, not free color picking.
      ctx.strokeStyle = skinOutline; ctx.lineWidth = 1;
      ctx.globalAlpha *= 0.72;
      if (skinId === 'debt_red') {
        // DEBT RED: no inner cross, just the red shell outline.
      } else if (skinId === 'bruise_purple') {
        // Straight authored X, aligned to the player square.
        ctx.beginPath();
        ctx.moveTo(px - 9, py - 9); ctx.lineTo(px + 9, py + 9);
        ctx.moveTo(px - 9, py + 9); ctx.lineTo(px + 9, py - 9);
        ctx.stroke();
      } else if (skinId === 'casino_gold') {
        ctx.strokeRect(px - 8, py - 8, 16, 16); ctx.beginPath(); ctx.moveTo(px, py - 12); ctx.lineTo(px + 12, py); ctx.lineTo(px, py + 12); ctx.lineTo(px - 12, py); ctx.closePath(); ctx.stroke();
      } else if (skinId === 'bone_static') {
        // BONE NOISE rework: clean fossil/circuit marks instead of messy scanline noise.
        ctx.strokeStyle = '#e7dcc4';
        ctx.lineWidth = 1.25;
        ctx.strokeRect(px - 10, py - 10, 20, 20);
        ctx.strokeStyle = '#8df7ff';
        ctx.globalAlpha *= 0.82;
        ctx.beginPath();
        ctx.moveTo(px - 7, py - 5); ctx.lineTo(px - 1, py - 5); ctx.lineTo(px + 5, py - 10);
        ctx.moveTo(px - 7, py + 5); ctx.lineTo(px - 1, py + 5); ctx.lineTo(px + 5, py + 10);
        ctx.moveTo(px - 3, py - 9); ctx.lineTo(px + 2, py); ctx.lineTo(px - 3, py + 9);
        ctx.stroke();
        ctx.strokeStyle = '#e7dcc4';
        ctx.globalAlpha *= 0.72;
        for (const yy of [-7, 0, 7]) { ctx.beginPath(); ctx.moveTo(px + 7, py + yy); ctx.lineTo(px + 11, py + yy); ctx.stroke(); }
      } else if (skinId === 'bad_tv') {
        ctx.setLineDash([2,2]); ctx.strokeRect(px - 11, py - 11, 22, 22); ctx.setLineDash([]);
      } else if (skinId === 'black_lime') {
        // BLACK LIME keeps a lime outline but the body interior stays fully black.
      } else if (skinId === 'void_cyan') {
        ctx.strokeRect(px - 8, py - 8, 16, 16); ctx.strokeRect(px - 4, py - 4, 8, 8);
      } else if (skinId === 'red_static') {
        ctx.strokeStyle = '#ff3048'; for (let yy = -9; yy <= 9; yy += 6) { ctx.beginPath(); ctx.moveTo(px - 11, py + yy); ctx.lineTo(px + 11, py + yy); ctx.stroke(); }
      } else if (skinId === 'mirror_coin') {
        ctx.strokeStyle = '#ffd34d'; ctx.strokeRect(px - 9, py - 9, 18, 18); ctx.strokeRect(px - 5, py - 5, 10, 10);
      } else if (skinId === 'terminal_ghost') {
        ctx.strokeStyle = '#66f6ff'; ctx.globalAlpha *= 0.65; ctx.strokeRect(px - 13, py - 13, 26, 26); ctx.strokeRect(px - 9, py - 9, 18, 18);
      } else if (skinId === 'jackpot_wound') {
        ctx.strokeStyle = '#ffd34d'; ctx.strokeRect(px - 10, py - 10, 20, 20); ctx.strokeStyle = '#ff3048'; ctx.beginPath(); ctx.moveTo(px - 8, py + 7); ctx.lineTo(px - 2, py - 10); ctx.lineTo(px + 5, py + 4); ctx.lineTo(px + 10, py - 6); ctx.stroke();
      } else if (skinId === 'dead_channel') {
        ctx.strokeStyle = '#f3f3f3'; ctx.setLineDash([3, 3]); ctx.strokeRect(px - 12, py - 12, 24, 24); ctx.setLineDash([]); ctx.strokeStyle = '#66f6ff'; ctx.beginPath(); ctx.moveTo(px - 11, py + 5); ctx.lineTo(px + 11, py - 5); ctx.stroke();
      }
      ctx.restore();
      // no visual barrel/aim stick on the player body; aim stays readable through cursor/tether.
      const activeW = Array.isArray(p[P.WEAPONS]) ? p[P.WEAPONS][p[P.WIDX]] : '';
      if (activeW === 'SHG') {
        // SHG ammo is shown as clean square charges, never as seconds/timers.
        const charges = Math.max(0, Math.min(4, p[P.SHG] ?? 4));
        const baseX = px - 15;
        const y = py - 42;
        ctx.save();
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) {
          const x = baseX + i * 10;
          ctx.strokeStyle = charges <= 0 ? COL.red : (i < charges ? COL.green : COL.dim);
          ctx.fillStyle = i < charges ? (charges <= 1 ? COL.red : COL.green) : 'rgba(0,0,0,0.55)';
          ctx.strokeRect(x - 3, y - 3, 6, 6);
          if (i < charges) ctx.fillRect(x - 2, y - 2, 4, 4);
        }
        ctx.restore();
        this.label('SHG', px, py - 50, charges <= 0 ? COL.red : COL.green, 8);
      }
      this.label(p[P.NAME], px, py - 24, isMe ? skinOutline : COL.dim, 10);
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
