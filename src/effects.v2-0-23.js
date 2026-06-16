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
        this.add({ kind: 'hitmark', x: f.x, y: f.y, ttl: 0.18 });
        if (f.dmg >= 1) this.float(f.x + (Math.random() - 0.5) * 16, f.y - 14, String(f.dmg), '#f3f3f3', Math.min(22, 11 + f.dmg * 0.18));
        break;
      case 'phit':
        if (mine) { this.hitFlash = Math.min(1, 0.35 + f.dmg * 0.02); this.kick(4 + f.dmg * 0.35); }
        this.add({ kind: 'hitmark', x: f.x, y: f.y, ttl: 0.15 });
        break;
      case 'shot': {
        const dx = (f.dx || 100) / 100, dy = (f.dy || 0) / 100;
        const col = f.kind === 'seeker' ? '#66f6ff' : (f.kind === 'rocketgun' ? '#ff3048' : '#f3f3f3');
        this.add({ kind: 'muzzle', x: f.mx || f.x, y: f.my || f.y, dx, dy, ttl: f.kind === 'rocketgun' ? 0.16 : 0.10, color: col, weapon: f.kind || f.w });
        if (mine) { this.kick(f.kind === 'rocketgun' ? 7 : f.kind === 'shotgun' ? 4.5 : 2.5); this.zoomKick = Math.max(this.zoomKick, f.kind === 'rocketgun' ? 0.25 : 0.12); }
        break;
      }
      case 'impact':
        this.add({ kind: 'impact', x: f.x, y: f.y, dx: (f.dx || 0) / 100, dy: (f.dy || 0) / 100, ttl: f.wall ? 0.18 : 0.14, weapon: f.kind || '', color: f.kind === 'seeker' ? '#66f6ff' : '#f3f3f3' });
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
            this.float(f.x, f.y - 34, f.cost ? `NO GLD ${f.have}/${f.cost}` : 'ОТКАЗ', '#ff3048', 14);
          }
          this.hitFlash = Math.max(this.hitFlash, 0.18);
          this.kick(6);
        }
        break;
      case 'active_denied':
        if (mine) {
          if (typeof f.x === 'number' && typeof f.y === 'number') {
            this.add({ kind: 'denybox', x: f.x, y: f.y, ttl: 0.45, color: '#66f6ff' });
            this.float(f.x, f.y - 34, 'НЕТ АКТИВКИ', '#66f6ff', 13);
          }
          this.kick(3);
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
      case 'shield':
        this.add({ kind: 'denybox', x: f.x, y: f.y, ttl: 0.22, color: '#66f6ff' });
        break;
      case 'armor_shell':
        this.add({ kind: 'shellHit', x: f.x, y: f.y, ttl: f.locked ? 0.30 : 0.22, color: f.locked ? '#ff3048' : '#66f6ff', locked: !!f.locked });
        this.float(f.x, f.y - 36, f.locked ? 'LINKED ARMOR' : 'SHELL HIT', f.locked ? '#ff3048' : '#66f6ff', 10);
        break;
      case 'armor_break':
        this.add({ kind: 'rocketBlast', x: f.x, y: f.y, r: 72, ttl: 0.24, color: '#66f6ff' });
        this.float(f.x, f.y - 42, 'SHELL BREAK', '#66f6ff', 12);
        this.kick(4);
        break;
      case 'armor_link':
        this.add({ kind: 'line', x: f.x, y: f.y, x2: f.x2, y2: f.y2, ttl: 0.26, color: '#ff3048', dash: true });
        this.float(f.x, f.y - 44, f.label || 'ARMOR LINK', '#ff3048', 11);
        break;
      case 'split':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 80, ttl: 0.28, color: '#f3f3f3' });
        break;
      case 'ricochet': {
        const n = Math.hypot(f.dx || 0, f.dy || 0) || 1;
        if (f.rocket) {
          this.add({ kind: 'rocketBlast', x: f.x, y: f.y, r: 42, ttl: 0.16, color: '#66f6ff' });
          this.add({ kind: 'denybox', x: f.x, y: f.y, ttl: 0.16, color: '#00ff66' });
        } else {
          this.add({ kind: 'impact', x: f.x, y: f.y, dx: (f.dx || 1) / n, dy: (f.dy || 0) / n, weapon: f.kind === 'seeker' ? 'seeker' : 'shotgun', ttl: 0.18, color: '#66f6ff' });
          this.add({ kind: 'denybox', x: f.x, y: f.y, ttl: 0.14, color: '#00ff66' });
        }
        break;
      }
      case 'mine':
        this.add({ kind: 'denybox', x: f.x, y: f.y, ttl: 0.42, color: '#ff3048' });
        break;
      case 'consume':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 45, ttl: 0.22, color: '#b45cff' });
        break;
      case 'field':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: f.r, ttl: 0.24, color: '#b45cff' });
        break;
      case 'damper_field':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: f.r || 280, ttl: 0.22, color: '#66f6ff' });
        break;
      case 'bullet_damp':
        this.add({ kind: 'hitmark', x: f.x, y: f.y, ttl: 0.10 });
        break;
      case 'bullet_stop':
        this.add({ kind: 'denybox', x: f.x, y: f.y, ttl: 0.18, color: '#66f6ff' });
        break;
      case 'leech_link':
        this.add({ kind: 'line', x: f.x, y: f.y, x2: f.x2, y2: f.y2, ttl: 0.2, color: '#00ff66' });
        break;
      case 'tether':
        this.add({ kind: 'line', x: f.x, y: f.y, x2: f.x2, y2: f.y2, ttl: 0.16, color: '#ff3048', dash: true });
        break;
      case 'echo_shot':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 38, ttl: 0.18, color: '#b45cff' });
        break;
      case 'prism':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 62, ttl: 0.22, color: '#66f6ff' });
        break;
      case 'pulse_wave':
        this.add({ kind: 'pulseWave', x: f.x, y: f.y, dx: f.dx, dy: f.dy, ttl: 0.28, color: '#ff3048' });
        break;
      case 'bullet_cut':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 50 + (f.count || 1) * 4, ttl: 0.18, color: '#66f6ff' });
        break;
      case 'active': {
        if (mine) { this.sweep = 0.01; this.sweepColor = f.label && f.label.includes('BLOOD') ? '#ff3048' : '#66f6ff'; this.kick(5); }
        const col = f.label && f.label.includes('BLOOD') ? '#ff3048' : (f.label && f.label.includes('RIPPER') ? '#b45cff' : '#66f6ff');
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: f.r || 160, ttl: 0.3, color: col });
        this.float(f.x, f.y - 50, f.label || 'Q', col, 12);
        break;
      }
      case 'active_field':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: f.r || 130, ttl: 0.22, color: f.tone === 'red' ? '#ff3048' : (f.tone === 'purple' ? '#b45cff' : '#66f6ff') });
        break;
      case 'active_tick':
        this.add({ kind: 'ring', x: f.x, y: f.y, r: f.r || 130, ttl: 0.16, color: f.tone === 'red' ? '#ff3048' : '#66f6ff' });
        break;
      case 'active_mutation': {
        const col = f.tone === 'red' ? '#ff3048' : f.tone === 'green' ? '#00ff66' : f.tone === 'purple' ? '#b45cff' : '#66f6ff';
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: f.r || 95, ttl: 0.28, color: col });
        if (f.label) this.float(f.x, f.y - 42, f.label, col, 10);
        break;
      }
      case 'enemy_combo':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: 135, ttl: 0.42, color: f.label && f.label.includes('ANCHOR') ? '#b45cff' : (f.label && f.label.includes('ORB') ? '#66f6ff' : '#ff3048') });
        this.float(f.x, f.y - 44, f.label || 'COMBO', f.label && f.label.includes('ORB') ? '#66f6ff' : '#ff3048', 11);
        break;
      case 'director_room':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: 190, ttl: 0.55, color: '#66f6ff' });
        this.float(f.x, f.y - 58, f.label || 'DIRECTOR', '#66f6ff', 12);
        break;
      case 'director_wave': {
        const col = f.intent === 'armor' ? '#b45cff' : (f.intent === 'ranged' || f.intent === 'control' ? '#66f6ff' : '#ff3048');
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: 140 + Math.min(80, (f.count || 1) * 12), ttl: 0.44, color: col });
        this.float(f.x, f.y - 48, f.label || 'WAVE', col, 11);
        break;
      }
      case 'path_turn':
        this.add({ kind: 'hitmark', x: f.x, y: f.y, ttl: 0.10 });
        break;
      case 'contract':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: 180, ttl: 0.8, color: '#ff3048' });
        break;
      case 'contract_done':
        this.add({ kind: 'ring', x: f.x, y: f.y, r: 220, ttl: 0.7, color: '#00ff66' }); this.kick(7);
        break;
      case 'contract_fail':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: 260, ttl: 0.8, color: '#ff3048' }); this.kick(8);
        break;
      case 'debt':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: 110, ttl: 0.5, color: '#b45cff' });
        break;
      case 'casino_tick':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 75, ttl: 0.32, color: f.good ? '#00ff66' : '#b45cff' });
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
      if (e.kind === 'muzzle') {
        const dx = e.dx || 1, dy = e.dy || 0; const nx = -dy, ny = dx;
        const snap = Math.floor(p * 5);
        ctx.globalAlpha = (1 - p) * 0.95;
        ctx.strokeStyle = e.color; ctx.lineWidth = e.weapon === 'rocketgun' ? 3 : 2;
        const len = e.weapon === 'rocketgun' ? 64 : e.weapon === 'seeker' ? 42 : 34;
        for (let i = 0; i < (e.weapon === 'shotgun' ? 7 : 3); i++) {
          const off = (i - 3) * (e.weapon === 'shotgun' ? 5 : 3);
          const start = 5 + (i % 2) * 4 + snap;
          const end = len * (0.35 + (i % 3) * 0.15);
          ctx.beginPath();
          ctx.moveTo(Math.round(e.x + nx * off + dx * start), Math.round(e.y + ny * off + dy * start));
          ctx.lineTo(Math.round(e.x + nx * off + dx * end), Math.round(e.y + ny * off + dy * end));
          ctx.stroke();
        }
        ctx.fillStyle = e.color; ctx.globalAlpha = (1 - p) * 0.32;
        const block = e.weapon === 'rocketgun' ? 18 : 10;
        ctx.fillRect(Math.round(e.x + dx * 10 - block/2), Math.round(e.y + dy * 10 - block/2), block, block);
      } else if (e.kind === 'impact') {
        const dx = e.dx || 1, dy = e.dy || 0; const nx = -dy, ny = dx;
        ctx.strokeStyle = e.color; ctx.globalAlpha = (1 - p) * 0.9; ctx.lineWidth = 2;
        const count = e.weapon === 'shotgun' ? 5 : 3;
        for (let i = 0; i < count; i++) {
          const off = (i - (count - 1) / 2) * 7;
          const len = 8 + i * 3 + p * 14;
          ctx.beginPath();
          ctx.moveTo(Math.round(e.x + nx * off), Math.round(e.y + ny * off));
          ctx.lineTo(Math.round(e.x - dx * len + nx * off * 0.5), Math.round(e.y - dy * len + ny * off * 0.5));
          ctx.stroke();
        }
        ctx.fillStyle = e.color; ctx.globalAlpha = (1 - p) * 0.35;
        const b = 4 + p * 10; ctx.fillRect(Math.round(e.x - b/2), Math.round(e.y - b/2), b, b);
      } else if (e.kind === 'ring') {
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
      } else if (e.kind === 'squareField') {
        const s = e.r * (0.75 + p * 0.35);
        ctx.strokeStyle = e.color; ctx.globalAlpha = (1 - p) * 0.35; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
        ctx.strokeRect(e.x - s / 2, e.y - s / 2, s, s);
        ctx.setLineDash([]);
      } else if (e.kind === 'line') {
        ctx.strokeStyle = e.color; ctx.globalAlpha = (1 - p) * 0.85; ctx.lineWidth = e.dash ? 2 : 1.5;
        if (e.dash) ctx.setLineDash([10, 7]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2); ctx.stroke(); ctx.setLineDash([]);
      } else if (e.kind === 'pulseWave') {
        const dx = e.dx || 1, dy = e.dy || 0; const nx = -dy, ny = dx;
        ctx.strokeStyle = e.color; ctx.globalAlpha = (1 - p) * 0.8; ctx.lineWidth = 2;
        const base = p * 160;
        for (let i = -2; i <= 2; i++) {
          const cx = e.x + dx * base + nx * i * 24, cy = e.y + dy * base + ny * i * 24;
          ctx.strokeRect(cx - 10, cy - 10, 20, 20);
        }
      } else if (e.kind === 'trail') {
        ctx.strokeStyle = e.color; ctx.globalAlpha = (1 - p) * 0.9; ctx.lineWidth = 4 * (1 - p);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2); ctx.stroke();
      } else if (e.kind === 'hitmark') {
        ctx.strokeStyle = '#f3f3f3'; ctx.globalAlpha = 1 - p; ctx.lineWidth = 2;
        const s = 8;
        ctx.beginPath();
        ctx.moveTo(e.x - s, e.y - s); ctx.lineTo(e.x + s, e.y + s);
        ctx.moveTo(e.x + s, e.y - s); ctx.lineTo(e.x - s, e.y + s);
        ctx.stroke();
      } else if (e.kind === 'shellHit') {
        const s = (e.locked ? 58 : 46) + p * (e.locked ? 26 : 18);
        const jitter = Math.sin(e.t * 90) * 4 * (1 - p);
        ctx.strokeStyle = e.color; ctx.globalAlpha = 0.95 * (1 - p); ctx.lineWidth = e.locked ? 4 : 3;
        ctx.setLineDash(e.locked ? [10, 4, 2, 4] : [7, 6]);
        ctx.strokeRect(Math.round(e.x - s / 2 + jitter), Math.round(e.y - s / 2 - jitter), Math.round(s), Math.round(s));
        ctx.setLineDash([]);
        ctx.globalAlpha = 0.35 * (1 - p); ctx.fillStyle = e.color;
        ctx.fillRect(Math.round(e.x - s * 0.18), Math.round(e.y - s * 0.18), Math.round(s * 0.36), Math.round(s * 0.36));
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
