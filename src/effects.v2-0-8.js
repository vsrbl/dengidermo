// nncckkrr effects: dopamine layer — bursts, floats, shake, sweeps, vignette
export class Effects {
  constructor() {
    this.list = [];       // world-space effects
    this.floats = [];     // floating texts
    this.shake = 0;
    this.hitFlash = 0;    // red vignette on own damage
    this.sweep = 0;       // green level-up sweep (0..1 progress, 0 = off)
    this.sweepColor = '#00ff66';
    this.slam = 0;        // jackpot white slam
    this.zoomKick = 0;
  }

  add(e) { this.list.push({ ...e, t: 0 }); if (this.list.length > 200) this.list.shift(); }
  float(x, y, text, color = '#f3f3f3', size = 13) {
    this.floats.push({ x, y, text, color, size, t: 0, ttl: 0.9 });
    if (this.floats.length > 60) this.floats.shift();
  }

  kick(amount) { this.shake = Math.min(18, this.shake + amount); }

  update(dt) {
    for (const e of this.list) e.t += dt;
    this.list = this.list.filter(e => e.t < (e.ttl ?? 0.6));
    for (const f of this.floats) { f.t += dt; f.y -= 34 * dt; }
    this.floats = this.floats.filter(f => f.t < f.ttl);
    this.shake = Math.max(0, this.shake - 60 * dt);
    this.hitFlash = Math.max(0, this.hitFlash - 2.2 * dt);
    this.slam = Math.max(0, this.slam - 2.5 * dt);
    this.zoomKick = Math.max(0, this.zoomKick - 3 * dt);
    if (this.sweep > 0) { this.sweep += dt * 1.6; if (this.sweep >= 1) this.sweep = 0; }
  }

  // handle a server fx event; ctxInfo: {myId, getPlayerPos}
  handleFx(f, info) {
    const mine = f.id === info.myId;
    switch (f.t) {
      case 'ehit':
        this.add({ kind: 'enemyHitBox', x: f.x, y: f.y, size: f.size || 24, ttl: f.heavy ? 0.24 : 0.16, heavy: !!f.heavy, kx: f.kx || 0, ky: f.ky || 0 });
        this.add({ kind: 'hitmark', x: f.x, y: f.y, ttl: f.heavy ? 0.22 : 0.16, heavy: !!f.heavy });
        if (f.heavy) this.kick(1.6);
        if (f.dmg >= 1) this.float(f.x + (Math.random() - 0.5) * 16, f.y - 14, String(f.dmg), f.heavy ? '#ff3048' : '#f3f3f3', Math.min(24, 12 + f.dmg * 0.22));
        break;
      case 'phit':
        if (mine) { this.hitFlash = Math.min(1, 0.35 + f.dmg * 0.02); this.kick(4 + f.dmg * 0.35); }
        this.add({ kind: 'hitmark', x: f.x, y: f.y, ttl: 0.15 });
        break;
      case 'kill':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: f.size * 1.6, ttl: 0.35, color: f.elite ? '#ff3048' : '#f3f3f3' });
        this.kick(f.elite ? 5 : 2);
        break;
      case 'blast':
        if (f.style === 'rocket') {
          this.add({ kind: 'rocketBlast', x: f.x, y: f.y, r: f.r, ttl: 0.28, color: '#f3f3f3' });
          this.kick(8);
        } else {
          this.add({ kind: 'ring', x: f.x, y: f.y, r: f.r, ttl: 0.34, color: f.style === 'proc' ? '#66f6ff' : '#f3f3f3' });
          this.kick(f.style === 'proc' ? 4 : 6);
        }
        break;
      case 'dash':
        this.add({ kind: 'dashCut', x: f.fx, y: f.fy, x2: f.tx, y2: f.ty, ttl: 0.18, color: '#66f6ff' });
        if (mine) this.zoomKick = 0.42;
        break;
      case 'levelup':
        if (mine) { this.sweep = 0.01; this.sweepColor = '#00ff66'; this.kick(5); }
        break;
      case 'pick':
        if (f.type === 'GLD') this.float(f.x, f.y, `+${f.val}`, '#00ff66', 12);
        else if (f.type === 'EXP') this.float(f.x, f.y, `+${f.val} EXP`, '#66f6ff', 11);
        else if (f.type === 'HEA') this.float(f.x, f.y, `+${f.val} HP`, '#00ff66', 13);
        break;
      case 'denied':
        if (mine) {
          if (typeof f.x === 'number' && typeof f.y === 'number') {
            this.add({ kind: 'denybox', x: f.x, y: f.y, ttl: 0.55, color: '#ff3048' });
            this.float(f.x, f.y - 34, f.cost ? `NO GLD ${f.have}/${f.cost}` : 'NO GLD', '#ff3048', 14);
          }
          this.hitFlash = Math.max(this.hitFlash, 0.18);
          this.kick(6);
        }
        break;
      case 'portal_open':
        this.add({ kind: 'ring', x: f.x, y: f.y, r: 160, ttl: 0.8, color: '#00ff66' });
        this.kick(4);
        break;
      case 'fuse':
        this.add({ kind: 'warnring', x: f.x, y: f.y, r: f.r, ttl: f.dur, color: '#ff3048' });
        break;
      case 'rain_warn':
        this.add({ kind: 'warnring', x: f.x, y: f.y, r: f.r, ttl: f.dur, color: '#b45cff' });
        break;
      case 'rain_hit':
        this.add({ kind: 'strike', x: f.x, y: f.y, r: f.r, ttl: 0.3, color: '#b45cff' });
        this.kick(3);
        break;
      case 'blink':
        this.add({ kind: 'trail', x: f.fx, y: f.fy, x2: f.tx, y2: f.ty, ttl: 0.3, color: '#b45cff' });
        break;
      case 'gstrike':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 60, ttl: 0.25, color: '#b45cff' });
        break;
      case 'boss_burst':
        this.add({ kind: 'ring', x: f.x, y: f.y, r: 90, ttl: 0.4, color: '#ff3048' });
        this.kick(3);
        break;
      case 'boss_down':
        this.add({ kind: 'ring', x: f.x, y: f.y, r: 320, ttl: 1.0, color: '#00ff66' });
        this.slam = 1; this.kick(14);
        break;
      case 'chest_open':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 70, ttl: 0.4, color: f.cursed ? '#b45cff' : '#00ff66' });
        if (mine) this.kick(3);
        break;
      case 'casino':
        if (mine && (f.outcome === 'JCK')) { this.slam = 1; this.kick(12); this.sweep = 0.01; this.sweepColor = '#00ff66'; }
        break;
      case 'install':
        if (mine) { this.sweep = 0.01; this.sweepColor = f.cursed ? '#b45cff' : '#00ff66'; this.kick(4); }
        break;
      case 'run_lost':
        this.hitFlash = 1; this.kick(10);
        break;
    }
  }

  // draw world-space effects (ctx already camera-transformed)
  drawWorld(ctx) {
    for (const e of this.list) {
      const p = e.t / (e.ttl ?? 0.6);
      ctx.save();
      if (e.kind === 'ring') {
        ctx.strokeStyle = e.color; ctx.globalAlpha = 1 - p; ctx.lineWidth = 3 - p * 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.3 + p * 0.7), 0, Math.PI * 2); ctx.stroke();
      } else if (e.kind === 'warnring') {
        ctx.strokeStyle = e.color; ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(e.t * 14));
        ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha *= 0.25; ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * p, 0, Math.PI * 2); ctx.fill();
      } else if (e.kind === 'strike') {
        ctx.fillStyle = e.color; ctx.globalAlpha = (1 - p) * 0.7;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1 - p; ctx.fillRect(e.x - 2, e.y - 600, 4, 600);
      } else if (e.kind === 'burst') {
        ctx.strokeStyle = e.color; ctx.globalAlpha = 1 - p; ctx.lineWidth = 2;
        const n = 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + e.x * 0.01;
          const d1 = e.r * 0.3 + e.r * p, d2 = d1 + e.r * 0.25 * (1 - p);
          ctx.beginPath();
          ctx.moveTo(e.x + Math.cos(a) * d1, e.y + Math.sin(a) * d1);
          ctx.lineTo(e.x + Math.cos(a) * d2, e.y + Math.sin(a) * d2);
          ctx.stroke();
        }
      } else if (e.kind === 'rocketBlast') {
        const step = Math.min(1, Math.floor(p * 6) / 5);
        const base = e.r * (0.28 + step * 0.9);
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = e.color; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) {
          const s = base * (0.55 + i * 0.35);
          const jx = (Math.sin(e.t * 80 + i * 17) * 3) | 0;
          const jy = (Math.cos(e.t * 70 + i * 11) * 3) | 0;
          ctx.strokeRect(e.x - s / 2 + jx, e.y - s / 2 + jy, s, s);
        }
        ctx.globalAlpha = (1 - p) * 0.75;
        ctx.strokeStyle = '#ff3048'; ctx.lineWidth = 2; ctx.setLineDash([8, 5]);
        const arms = 8;
        for (let i = 0; i < arms; i++) {
          const a = (i / arms) * Math.PI * 2 + (i % 2 ? 0.2 : -0.15);
          const d1 = base * 0.18, d2 = base * (0.55 + ((i * 13) % 5) * 0.05);
          const sx = e.x + Math.cos(a) * d1, sy = e.y + Math.sin(a) * d1;
          const ex = e.x + Math.cos(a) * d2, ey = e.y + Math.sin(a) * d2;
          ctx.beginPath(); ctx.moveTo(Math.round(sx), Math.round(sy)); ctx.lineTo(Math.round(ex), Math.round(ey)); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = (1 - p) * 0.28;
        ctx.fillStyle = e.color;
        const block = Math.max(6, e.r * 0.16);
        for (let i = 0; i < 10; i++) {
          const a = (i * 2.399 + e.x * 0.01);
          const d = base * (0.15 + (i % 5) * 0.13);
          ctx.fillRect(Math.round(e.x + Math.cos(a) * d - block / 2), Math.round(e.y + Math.sin(a) * d - block / 2), block, block);
        }
      } else if (e.kind === 'dashCut') {
        const dx = e.x2 - e.x, dy = e.y2 - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const nx = -uy, ny = ux;
        const step = Math.floor(p * 5);
        ctx.globalAlpha = (1 - p) * 0.95;
        ctx.strokeStyle = e.color; ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          if (((i + step) % 3) === 0) continue;
          const a = (i / 6) * len; const b = Math.min(len, a + len * 0.12);
          const off = ((i % 2) ? 7 : -7) * (1 - p);
          ctx.beginPath();
          ctx.moveTo(Math.round(e.x + ux * a + nx * off), Math.round(e.y + uy * a + ny * off));
          ctx.lineTo(Math.round(e.x + ux * b + nx * off), Math.round(e.y + uy * b + ny * off));
          ctx.stroke();
        }
        ctx.fillStyle = e.color; ctx.globalAlpha = (1 - p) * 0.55;
        ctx.fillRect(Math.round(e.x2 - 9), Math.round(e.y2 - 9), 18, 18);
        ctx.globalAlpha = (1 - p) * 0.25;
        ctx.fillRect(Math.round(e.x - 13), Math.round(e.y - 13), 26, 26);
      } else if (e.kind === 'trail') {
        ctx.strokeStyle = e.color; ctx.globalAlpha = (1 - p) * 0.9; ctx.lineWidth = 4 * (1 - p);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2); ctx.stroke();
      } else if (e.kind === 'enemyHitBox') {
        const s0 = (e.size || 24) + (e.heavy ? 18 : 10);
        const s = s0 + p * (e.heavy ? 18 : 10);
        const snap = Math.floor(p * 5);
        ctx.globalAlpha = (1 - p) * (e.heavy ? 0.95 : 0.72);
        ctx.strokeStyle = e.heavy ? '#ff3048' : '#f3f3f3';
        ctx.lineWidth = e.heavy ? 3 : 2;
        ctx.setLineDash(e.heavy ? [9, 5] : [5, 5]);
        ctx.strokeRect(Math.round(e.x - s / 2), Math.round(e.y - s / 2), Math.round(s), Math.round(s));
        ctx.setLineDash([]);
        // terminal-style broken impact ticks around the enemy square
        ctx.strokeStyle = '#00ff66';
        ctx.globalAlpha = (1 - p) * 0.55;
        const r = s * 0.62;
        for (let i = 0; i < 4; i++) {
          if (((i + snap) % 4) === 1) continue;
          const a = i * Math.PI / 2 + 0.22;
          const x1 = e.x + Math.cos(a) * r;
          const y1 = e.y + Math.sin(a) * r;
          const x2 = e.x + Math.cos(a) * (r + 13);
          const y2 = e.y + Math.sin(a) * (r + 13);
          ctx.beginPath(); ctx.moveTo(Math.round(x1), Math.round(y1)); ctx.lineTo(Math.round(x2), Math.round(y2)); ctx.stroke();
        }
        if (e.kx || e.ky) {
          ctx.globalAlpha = (1 - p) * 0.45;
          ctx.strokeStyle = '#f3f3f3';
          ctx.beginPath();
          ctx.moveTo(Math.round(e.x - e.kx * 18), Math.round(e.y - e.ky * 18));
          ctx.lineTo(Math.round(e.x + e.kx * 30), Math.round(e.y + e.ky * 30));
          ctx.stroke();
        }
      } else if (e.kind === 'hitmark') {
        ctx.strokeStyle = e.heavy ? '#ff3048' : '#f3f3f3'; ctx.globalAlpha = 1 - p; ctx.lineWidth = e.heavy ? 3 : 2;
        const s = e.heavy ? 12 : 8;
        ctx.beginPath();
        ctx.moveTo(e.x - s, e.y - s); ctx.lineTo(e.x + s, e.y + s);
        ctx.moveTo(e.x + s, e.y - s); ctx.lineTo(e.x - s, e.y + s);
        ctx.stroke();
      } else if (e.kind === 'denybox') {
        const s = 34 + p * 18;
        const jitter = Math.sin(e.t * 70) * 3 * (1 - p);
        ctx.strokeStyle = e.color; ctx.globalAlpha = 0.95 * (1 - p); ctx.lineWidth = 3;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(e.x - s / 2 + jitter, e.y - s / 2, s, s);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(e.x - s * 0.34 + jitter, e.y); ctx.lineTo(e.x + s * 0.34 + jitter, e.y);
        ctx.moveTo(e.x + jitter, e.y - s * 0.34); ctx.lineTo(e.x + jitter, e.y + s * 0.34);
        ctx.stroke();
      }
      ctx.restore();
    }
    // floats
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      const p = f.t / f.ttl;
      ctx.globalAlpha = 1 - p * p;
      ctx.fillStyle = f.color;
      ctx.font = `bold ${f.size}px 'Courier New', monospace`;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  // draw screen-space overlays (ctx untransformed)
  drawScreen(ctx, w, h) {
    if (this.hitFlash > 0) {
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
      g.addColorStop(0, 'rgba(255,48,72,0)');
      g.addColorStop(1, `rgba(255,48,72,${0.45 * this.hitFlash})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if (this.sweep > 0) {
      const y = h * (1 - this.sweep);
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - this.sweep * 0.5);
      const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, this.sweepColor);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, y - 60, w, 120);
      ctx.restore();
    }
    if (this.slam > 0) {
      ctx.fillStyle = `rgba(243,243,243,${this.slam * 0.35})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  cameraOffset() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return { x: (Math.random() - 0.5) * this.shake, y: (Math.random() - 0.5) * this.shake };
  }
}
