// nncckkrr effects: dopamine layer — bursts, floats, shake, sweeps, vignette
const HEX = /^#[0-9a-fA-F]{6}$/;
function safeCol(v, fallback) { const x = String(v || '').trim(); return HEX.test(x) ? x : fallback; }

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
        if (f.style === 'rocket' || f.style === 'void' || f.style === 'echo' || f.style === 'blood') {
          const col = f.style === 'blood' ? '#ff3048' : f.style === 'void' ? '#b45cff' : f.style === 'echo' ? '#66f6ff' : '#f3f3f3';
          this.add({ kind: 'rocketBlast', x: f.x, y: f.y, r: f.r, ttl: 0.26, color: col });
          this.kick(f.style === 'rocket' ? 8 : 5);
        } else {
          this.add({ kind: 'squareBlastLite', x: f.x, y: f.y, r: f.r, ttl: 0.26, color: f.style === 'proc' ? '#66f6ff' : '#f3f3f3' });
          this.kick(f.style === 'proc' ? 4 : 5);
        }
        break;
      case 'dash': {
        const rarity = String(f.skinRarity || 'basic');
        const legendary = rarity === 'legendary';
        const superRare = rarity === 'superrare';
        const rare = rarity === 'rare';
        this.add({
          kind: 'dashCut', x: f.fx, y: f.fy, x2: f.tx, y2: f.ty,
          ttl: legendary ? 0.50 : superRare ? 0.31 : rare ? 0.25 : 0.21,
          color: safeCol(f.dashColor, '#66f6ff'), alt: safeCol(f.dashAlt, '#f3f3f3'),
          skinId: String(f.skinId || ''), style: String(f.dashStyle || 'terminal'), rarity,
          phase: f.phase ? 1 : 0
        });
        if (mine) { this.zoomKick = legendary ? 0.68 : 0.42; this.kick(legendary ? 7 : superRare ? 4 : 3); }
        break;
      }
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
      case 'enemy_frozen':
        this.add({ kind: 'freezeLock', x: f.x, y: f.y, r: f.r || 44, ttl: 0.24, color: '#66f6ff' });
        break;
      case 'leech_link':
        this.add({ kind: 'line', x: f.x, y: f.y, x2: f.x2, y2: f.y2, ttl: 0.2, color: '#00ff66' });
        break;
      case 'tether':
        this.add({ kind: 'line', x: f.x, y: f.y, x2: f.x2, y2: f.y2, ttl: 0.16, color: '#ff3048', dash: true });
        break;
      case 'herald_cast':
        this.add({ kind: 'heraldCastLine', x: f.x, y: f.y, x2: f.x2, y2: f.y2, pfill: (f.p || 0) / 100, ttl: 0.16, color: '#ff3048', start: f.start ? 1 : 0 });
        this.add({ kind: 'heraldCore', x: f.x, y: f.y, ttl: 0.18, color: '#b45cff', start: f.start ? 1 : 0 });
        break;
      case 'summon':
        if (f.kind === 'herald') this.add({ kind: 'heraldSummonBurst', x: f.x, y: f.y, x2: f.x2, y2: f.y2, hx: f.hx, hy: f.hy, dx: (f.dx || 0) / 100, dy: (f.dy || 0) / 100, count: f.count || 0, ttl: 0.55, color: '#ff3048' });
        else this.add({ kind: 'burst', x: f.x, y: f.y, r: 70, ttl: 0.24, color: '#ff3048' });
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
        const isBox = f.kind === 'black_box' || String(f.label || '').includes('BLACK BOX');
        const isFreeze = f.kind === 'freeze_aura' || String(f.label || '').includes('FREEZE');
        const col = isBox ? '#b45cff' : f.label && f.label.includes('BLOOD') ? '#ff3048' : (f.label && f.label.includes('RIPPER') ? '#b45cff' : '#66f6ff');
        this.add({ kind: isBox ? 'blackBoxAura' : 'squareField', activeKind: isBox ? 'black_box' : (isFreeze ? 'freeze_aura' : String(f.label || '').toLowerCase().replace(/ .*/, '')), x: f.x, y: f.y, r: f.r || 160, ttl: isBox ? 0.38 : 0.26, color: col, cast: isBox ? 1 : 0 });
        this.float(f.x, f.y - 50, f.label || 'Q', col, 12);
        break;
      }
      case 'black_box_cast':
        this.add({ kind: 'blackBoxAura', x: f.x, y: f.y, r: f.r || 180, ttl: 0.55, color: '#b45cff', cast: 1 });
        if (mine) { this.kick(4); this.zoomKick = Math.max(this.zoomKick, 0.25); }
        break;
      case 'active_casino_roll': {
        const col = f.tone === 'red' ? '#ff3048' : f.tone === 'purple' ? '#b45cff' : f.tone === 'cyan' ? '#66f6ff' : '#00ff66';
        const spin = f.phase === 'spin';
        this.add({ kind: 'casinoRollBurst', spin, x: f.x, y: f.y, r: spin ? 92 : (f.outcome === 'TEN' ? 160 : 110), ttl: spin ? 0.34 : 0.46, color: col, symbols: f.symbols || [] });
        if (mine) { this.kick(spin ? 2 : (f.outcome === 'TEN' ? 8 : f.outcome === 'HIT' || f.outcome === 'DEBT' ? 6 : 4)); this.zoomKick = Math.max(this.zoomKick, spin ? 0.08 : (f.outcome === 'TEN' ? 0.44 : 0.22)); }
        break;
      }
      case 'active_line':
        if (f.kind === 'weapon_chain') this.add({ kind: 'weaponChainLine', x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, ttl: 0.18, color: '#66f6ff' });
        else if (f.kind === 'void_laser') this.add({ kind: 'voidLaser', x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, w: f.width || 3, hitW: f.hitWidth || 12, ttl: 0.18, color: '#b45cff' });
        else this.add({ kind: 'voidLine', x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, w: f.width || 44, ttl: 0.20, color: f.tone === 'red' ? '#ff3048' : (f.tone === 'purple' ? '#b45cff' : '#66f6ff') });
        break;
      case 'active_line_tick':
        if (f.kind === 'void_laser') this.add({ kind: 'voidLaser', tick: 1, x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, w: f.width || 3, hitW: f.hitWidth || 12, ttl: 0.12, color: '#b45cff' });
        else this.add({ kind: 'voidLine', tick: 1, x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, w: f.width || 44, ttl: 0.14, color: '#b45cff' });
        break;
      case 'weapon_chain_link':
        this.add({ kind: 'weaponChainLine', x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, ttl: 0.22, color: '#66f6ff', jump: f.jump || 1 });
        break;
      case 'weapon_chain_lock':
        this.add({ kind: 'chainLock', x: f.x, y: f.y, r: f.r || 30, ttl: 0.30, color: '#66f6ff' });
        break;
      case 'active_field': {
        const col = f.tone === 'red' ? '#ff3048' : (f.tone === 'purple' ? '#b45cff' : '#66f6ff');
        this.add({ kind: f.kind === 'black_box' ? 'blackBoxAura' : 'squareField', activeKind: String(f.kind || ''), x: f.x, y: f.y, r: f.r || 130, ttl: f.kind === 'black_box' ? 0.34 : 0.30, color: col });
        break;
      }
      case 'active_tick':
        this.add({ kind: 'squareField', activeKind: String(f.kind || '') + '_tick', x: f.x, y: f.y, r: f.r || 130, ttl: 0.12, color: f.tone === 'red' ? '#ff3048' : (f.tone === 'purple' ? '#b45cff' : '#66f6ff'), tick: 1 });
        break;
      case 'active_mutation': {
        const col = f.tone === 'red' ? '#ff3048' : f.tone === 'green' ? '#00ff66' : f.tone === 'purple' ? '#b45cff' : '#66f6ff';
        this.add({ kind: f.squareBlast ? 'rocketBlast' : 'squareField', activeKind: String(f.label || '').toLowerCase(), x: f.x, y: f.y, r: f.r || 95, ttl: f.squareBlast ? 0.22 : 0.24, color: col });
        if (f.label) this.float(f.x, f.y - 42, f.label, col, 10);
        break;
      }
      case 'enemy_combo':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: 135, ttl: 0.42, color: f.label && f.label.includes('ANCHOR') ? '#b45cff' : (f.label && f.label.includes('ORB') ? '#66f6ff' : '#ff3048') });
        this.float(f.x, f.y - 44, f.label || 'SIGNAL', f.label && f.label.includes('ORB') ? '#66f6ff' : '#ff3048', 11);
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
      case 'skin_unlock':
        this.sweep = 0.01; this.sweepColor = f.skinRarity === 'legendary' ? '#ffd34d' : '#b45cff';
        if (f.skinRarity === 'legendary') { this.slam = 0.55; this.kick(12); }
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
        const step = Math.floor(p * 9);
        const rarity = String(e.rarity || 'basic');
        const style = String(e.style || 'terminal');
        const legendary = rarity === 'legendary';
        const power = legendary ? 5 : rarity === 'superrare' ? 3 : rarity === 'rare' ? 2 : rarity === 'uncommon' ? 1 : 0;
        const fade = Math.max(0, 1 - p);
        const col = e.color || '#66f6ff';
        const alt = e.alt || '#f3f3f3';

        // Base dash readability: one clean cut with square start/end impacts.
        ctx.globalAlpha = fade * 0.92;
        ctx.strokeStyle = col;
        ctx.lineWidth = legendary ? 3.2 : 2 + Math.min(1.5, power * 0.35);
        ctx.setLineDash(style === 'dead_channel' ? [7, 4, 2, 5] : style === 'jackpot' ? [15, 4, 4, 4] : [9, 6]);
        for (let i = 0; i < 7 + Math.min(power, 3); i++) {
          const q0 = i / (7 + Math.min(power, 3));
          const q1 = Math.min(1, q0 + 0.13 + power * 0.006);
          if (!legendary && ((i + step) % 4) === 0) continue;
          const off = ((i % 2) ? 7 : -7) * fade + (style === 'mirror' ? ((i % 2) ? 8 : -8) : 0);
          ctx.beginPath();
          ctx.moveTo(Math.round(e.x + dx * q0 + nx * off), Math.round(e.y + dy * q0 + ny * off));
          ctx.lineTo(Math.round(e.x + dx * q1 + nx * off), Math.round(e.y + dy * q1 + ny * off));
          ctx.stroke();
        }
        ctx.setLineDash([]);

        // Square dash explosion caps. Not round light: hard readable rocket-style blocks.
        for (const cap of [{x:e.x, y:e.y, m:0.8}, {x:e.x2, y:e.y2, m:1.05}]) {
          const base = (legendary ? 30 : 22) * cap.m * (0.85 + 0.35 * fade);
          ctx.globalAlpha = fade * (legendary ? 0.54 : 0.36);
          ctx.strokeStyle = col; ctx.lineWidth = legendary ? 3 : 2;
          ctx.strokeRect(Math.round(cap.x - base / 2), Math.round(cap.y - base / 2), Math.round(base), Math.round(base));
          ctx.globalAlpha = fade * 0.22; ctx.fillStyle = alt;
          const inner = base * 0.36;
          ctx.fillRect(Math.round(cap.x - inner / 2), Math.round(cap.y - inner / 2), Math.round(inner), Math.round(inner));
        }

        // Shared hard packet blocks for non-legendary and as a backing layer for legendary skins.
        const blocks = 3 + Math.min(power, 4) * 2;
        for (let i = 0; i < blocks; i++) {
          const q = (i + 1) / (blocks + 1);
          if (!legendary && ((i + step) % 5) === 1) continue;
          const bx = e.x + dx * q + nx * (((i % 3) - 1) * (5 + power * 2));
          const by = e.y + dy * q + ny * (((i % 3) - 1) * (5 + power * 2));
          const sz = 6 + power * 2 + ((i + step) % 2) * 3;
          ctx.globalAlpha = fade * (0.24 + power * 0.055);
          ctx.fillStyle = (i % 2 && alt) ? alt : col;
          ctx.fillRect(Math.round(bx - sz / 2), Math.round(by - sz / 2), sz, sz);
        }

        if (style === 'jackpot') {
          // JACKPOT WOUND: slot-reel cells + coin boxes + red wound stitches.
          const cells = 6;
          ctx.font = `bold ${Math.max(9, Math.round(12 + 3 * fade))}px 'Courier New', monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (let i = 0; i < cells; i++) {
            const q = (i + 0.5) / cells;
            const cx = e.x + dx * q + nx * (((i % 2) ? 1 : -1) * (10 + 5 * fade));
            const cy = e.y + dy * q + ny * (((i % 2) ? 1 : -1) * (10 + 5 * fade));
            const w = 22 + ((i + step) % 2) * 5;
            const h = 18;
            ctx.globalAlpha = fade * 0.78;
            ctx.strokeStyle = i % 2 ? alt : col; ctx.lineWidth = 2.5;
            ctx.strokeRect(Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
            ctx.globalAlpha = fade * 0.42;
            ctx.fillStyle = i % 3 === 0 ? alt : col;
            ctx.fillText(i % 3 === 0 ? '7' : i % 3 === 1 ? '$' : 'J', Math.round(cx), Math.round(cy + 1));
          }
          for (let i = 0; i < 9; i++) {
            const q = (i + 0.3) / 9;
            const sx = e.x + dx * q + nx * (((i % 4) - 1.5) * 18);
            const sy = e.y + dy * q + ny * (((i % 4) - 1.5) * 18);
            const sz = 7 + (i % 2) * 4;
            ctx.globalAlpha = fade * 0.48;
            ctx.strokeStyle = col; ctx.lineWidth = 2;
            ctx.strokeRect(Math.round(sx - sz / 2), Math.round(sy - sz / 2), sz, sz);
            ctx.globalAlpha = fade * 0.32;
            ctx.fillStyle = alt;
            ctx.fillRect(Math.round(sx - sz * 0.18), Math.round(sy - sz * 0.18), Math.round(sz * 0.36), Math.round(sz * 0.36));
          }
          ctx.globalAlpha = fade * 0.70;
          ctx.strokeStyle = alt; ctx.lineWidth = 2;
          for (let i = 0; i < 7; i++) {
            const q = (i + 0.5) / 7;
            const cx = e.x + dx * q, cy = e.y + dy * q;
            ctx.beginPath();
            ctx.moveTo(Math.round(cx - nx * 12 - ux * 5), Math.round(cy - ny * 12 - uy * 5));
            ctx.lineTo(Math.round(cx + nx * 12 + ux * 5), Math.round(cy + ny * 12 + uy * 5));
            ctx.stroke();
          }
          ctx.globalAlpha = fade * 0.62;
          ctx.fillStyle = col;
          ctx.fillText('JCK', Math.round(e.x2 + nx * 26), Math.round(e.y2 + ny * 26));
        } else if (style === 'dead_channel') {
          // DEAD CHANNEL: broken TV frames, scanline debris, antenna glyphs, NO SIG tag.
          ctx.globalAlpha = fade * 0.68;
          ctx.strokeStyle = alt; ctx.lineWidth = 1.5;
          for (let i = 0; i < 8; i++) {
            const q = (i + 0.5) / 8;
            const cx = e.x + dx * q + nx * (((i % 3) - 1) * 16);
            const cy = e.y + dy * q + ny * (((i % 3) - 1) * 16);
            const w = 24 + (i % 2) * 12;
            ctx.beginPath();
            ctx.moveTo(Math.round(cx - ux * w * 0.5), Math.round(cy - uy * w * 0.5));
            ctx.lineTo(Math.round(cx + ux * w * 0.5), Math.round(cy + uy * w * 0.5));
            ctx.stroke();
          }
          for (let i = 0; i < 4; i++) {
            const q = (i + 0.7) / 4.8;
            const cx = e.x + dx * q + nx * ((i % 2 ? 1 : -1) * 20);
            const cy = e.y + dy * q + ny * ((i % 2 ? 1 : -1) * 20);
            const w = 30 + i * 3, h = 20;
            ctx.globalAlpha = fade * 0.50;
            ctx.strokeStyle = i % 2 ? col : alt; ctx.lineWidth = 2;
            ctx.strokeRect(Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
            ctx.globalAlpha = fade * 0.28;
            ctx.fillStyle = '#000000';
            ctx.fillRect(Math.round(cx - w / 2 + 3), Math.round(cy - 2), Math.round(w - 6), 4);
            ctx.globalAlpha = fade * 0.44;
            ctx.strokeStyle = alt; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(Math.round(cx), Math.round(cy - h / 2));
            ctx.lineTo(Math.round(cx - 8), Math.round(cy - h / 2 - 10));
            ctx.moveTo(Math.round(cx), Math.round(cy - h / 2));
            ctx.lineTo(Math.round(cx + 8), Math.round(cy - h / 2 - 10));
            ctx.stroke();
          }
          ctx.font = `bold ${Math.max(8, Math.round(10 + 2 * fade))}px 'Courier New', monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.globalAlpha = fade * 0.52; ctx.fillStyle = alt;
          ctx.fillText('NO SIG', Math.round(e.x2 + nx * 30), Math.round(e.y2 + ny * 30));
          ctx.globalAlpha = fade * 0.26; ctx.fillStyle = col;
          for (let i = 0; i < 12; i++) {
            const q = (i + 0.2) / 12;
            const sx = e.x + dx * q + nx * (((i % 5) - 2) * 9);
            const sy = e.y + dy * q + ny * (((i % 5) - 2) * 9);
            ctx.fillRect(Math.round(sx), Math.round(sy), 12 + (i % 3) * 8, 2);
          }
        } else if (style === 'tv' || style === 'static' || style === 'red_static') {
          ctx.globalAlpha = fade * 0.38;
          ctx.fillStyle = alt || col;
          for (let i = 0; i < 7; i++) {
            const q = (i + 1) / 8;
            const w = 18 + (i % 3) * 7;
            ctx.fillRect(Math.round(e.x + dx * q - w / 2), Math.round(e.y + dy * q - 1), w, 2);
          }
        }
      } else if (e.kind === 'voidLine') {
        const dx = e.x2 - e.x, dy = e.y2 - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const nx = -uy, ny = ux;
        const baseW = Math.max(12, e.w || 34);
        const tick = !!e.tick;
        ctx.globalAlpha = (1 - p) * (tick ? 0.62 : 0.40);
        ctx.strokeStyle = e.color; ctx.lineWidth = tick ? 3 : 2;
        ctx.setLineDash([14, 8, 3, 8]);
        for (let i = -1; i <= 1; i++) {
          const off = i * baseW * 0.28;
          ctx.beginPath();
          ctx.moveTo(Math.round(e.x + nx * off), Math.round(e.y + ny * off));
          ctx.lineTo(Math.round(e.x2 + nx * off), Math.round(e.y2 + ny * off));
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = (1 - p) * (tick ? 0.22 : 0.14);
        ctx.fillStyle = e.color;
        for (let i = 0; i < 7; i++) {
          const q = (i + 0.5) / 7;
          const sz = tick ? 8 : 6;
          const bx = e.x + dx * q + nx * (((i % 3) - 1) * baseW * 0.22);
          const by = e.y + dy * q + ny * (((i % 3) - 1) * baseW * 0.22);
          ctx.fillRect(Math.round(bx - sz / 2), Math.round(by - sz / 2), sz, sz);
        }
      } else if (e.kind === 'voidLaser') {
        const dx = e.x2 - e.x, dy = e.y2 - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const nx = -uy, ny = ux;
        const fade = 1 - p;
        const coreW = Math.max(1.5, e.w || 3);
        const glowW = Math.max(6, e.hitW || 12);
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * (e.tick ? 0.18 : 0.12);
        ctx.strokeStyle = e.color; ctx.lineWidth = glowW;
        ctx.beginPath(); ctx.moveTo(Math.round(e.x), Math.round(e.y)); ctx.lineTo(Math.round(e.x2), Math.round(e.y2)); ctx.stroke();
        ctx.globalAlpha = fade * (e.tick ? 0.82 : 0.68);
        ctx.strokeStyle = '#f3f3f3'; ctx.lineWidth = coreW;
        ctx.beginPath(); ctx.moveTo(Math.round(e.x), Math.round(e.y)); ctx.lineTo(Math.round(e.x2), Math.round(e.y2)); ctx.stroke();
        ctx.globalAlpha = fade * 0.72;
        ctx.strokeStyle = e.color; ctx.lineWidth = Math.max(1, coreW * 0.55);
        ctx.setLineDash([18, 9]);
        ctx.beginPath(); ctx.moveTo(Math.round(e.x + nx * 5), Math.round(e.y + ny * 5)); ctx.lineTo(Math.round(e.x2 + nx * 5), Math.round(e.y2 + ny * 5)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(Math.round(e.x - nx * 5), Math.round(e.y - ny * 5)); ctx.lineTo(Math.round(e.x2 - nx * 5), Math.round(e.y2 - ny * 5)); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.54; ctx.fillStyle = e.color;
        for (let i = 0; i < 5; i++) {
          const q = (i + 0.5) / 5;
          const bx = e.x + dx * q + nx * (((i % 2) ? 1 : -1) * 9);
          const by = e.y + dy * q + ny * (((i % 2) ? 1 : -1) * 9);
          ctx.fillRect(Math.round(bx - 2), Math.round(by - 2), 4, 4);
        }
      } else if (e.kind === 'weaponChainLine') {
        const dx = e.x2 - e.x, dy = e.y2 - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const fade = 1 - p;
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.18;
        ctx.strokeStyle = e.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(Math.round(e.x), Math.round(e.y)); ctx.lineTo(Math.round(e.x2), Math.round(e.y2)); ctx.stroke();
        ctx.globalAlpha = fade * 0.76;
        ctx.strokeStyle = e.color; ctx.lineWidth = 1.35;
        ctx.setLineDash([10, 7]);
        ctx.beginPath(); ctx.moveTo(Math.round(e.x), Math.round(e.y)); ctx.lineTo(Math.round(e.x2), Math.round(e.y2)); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.55;
        ctx.fillStyle = e.color;
        for (let i = 0; i < 3; i++) {
          const q = (i + 1) / 4;
          const bx = e.x + dx * q + nx * ((i - 1) * 3);
          const by = e.y + dy * q + ny * ((i - 1) * 3);
          ctx.fillRect(Math.round(bx - 1), Math.round(by - 1), 3, 3);
        }
      } else if (e.kind === 'chainLock') {
        const fade = 1 - p;
        const s = Math.round(e.r || 30);
        ctx.globalAlpha = fade * 0.65;
        ctx.strokeStyle = e.color; ctx.lineWidth = 1.5;
        const x = Math.round(e.x - s / 2), y = Math.round(e.y - s / 2);
        const c = Math.max(7, Math.round(s * 0.25));
        ctx.beginPath();
        ctx.moveTo(x, y + c); ctx.lineTo(x, y); ctx.lineTo(x + c, y);
        ctx.moveTo(x + s - c, y); ctx.lineTo(x + s, y); ctx.lineTo(x + s, y + c);
        ctx.moveTo(x + s, y + s - c); ctx.lineTo(x + s, y + s); ctx.lineTo(x + s - c, y + s);
        ctx.moveTo(x + c, y + s); ctx.lineTo(x, y + s); ctx.lineTo(x, y + s - c);
        ctx.stroke();
        ctx.globalAlpha = fade * 0.12;
        ctx.fillStyle = e.color; ctx.fillRect(x, y, s, s);
      } else if (e.kind === 'squareBlastLite') {
        const step = Math.floor(p * 4);
        ctx.globalAlpha = (1 - p) * 0.72;
        ctx.strokeStyle = e.color; ctx.lineWidth = 2.5;
        const s = e.r * (0.45 + step * 0.18);
        ctx.strokeRect(Math.round(e.x - s / 2), Math.round(e.y - s / 2), Math.round(s), Math.round(s));
        ctx.globalAlpha = (1 - p) * 0.24;
        ctx.fillStyle = e.color;
        for (let i = 0; i < 6; i++) {
          const a = i * 2.399;
          const d = s * (0.22 + (i % 3) * 0.18);
          const b = 6 + (i % 2) * 3;
          ctx.fillRect(Math.round(e.x + Math.cos(a) * d - b / 2), Math.round(e.y + Math.sin(a) * d - b / 2), b, b);
        }
      } else if (e.kind === 'blackBoxAura') {
        const s = e.r;
        const fade = Math.max(0, 1 - p);
        const tnow = (typeof performance !== 'undefined' ? performance.now() * 0.001 : e.t);
        ctx.save();
        ctx.translate(Math.round(e.x), Math.round(e.y));
        ctx.globalAlpha = fade * (e.cast ? 0.64 : 0.44);
        ctx.strokeStyle = e.color || '#b45cff';
        ctx.lineWidth = e.cast ? 3 : 2;
        ctx.setLineDash([12, 7, 2, 6]);
        for (const layer of [0, 1]) {
          ctx.save();
          const dir = layer ? -1 : 1;
          const scale = layer ? 0.68 : 1.0;
          ctx.rotate(dir * (tnow * (layer ? 1.35 : 0.95)) + (layer ? Math.PI / 4 : 0));
          const side = s * scale;
          ctx.strokeRect(Math.round(-side / 2), Math.round(-side / 2), Math.round(side), Math.round(side));
          ctx.restore();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.22;
        ctx.fillStyle = '#000000';
        const core = Math.max(20, s * 0.16);
        ctx.fillRect(Math.round(-core / 2), Math.round(-core / 2), Math.round(core), Math.round(core));
        ctx.globalAlpha = fade * 0.55;
        ctx.fillStyle = e.color || '#b45cff';
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4 + tnow * (i % 2 ? -0.65 : 0.5);
          const d = s * (0.34 + (i % 3) * 0.08);
          const sz = 5 + (i % 2) * 3;
          ctx.fillRect(Math.round(Math.cos(a) * d - sz / 2), Math.round(Math.sin(a) * d - sz / 2), sz, sz);
        }
        ctx.restore();
      } else if (e.kind === 'heraldCore') {
        const fade = Math.max(0, 1 - p);
        const s = e.start ? 58 : 44;
        ctx.save();
        ctx.globalAlpha = fade * 0.78;
        ctx.strokeStyle = e.color || '#b45cff'; ctx.lineWidth = 2.4;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(Math.round(e.x - s / 2), Math.round(e.y - s / 2), s, s);
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.28; ctx.fillStyle = e.color || '#b45cff';
        ctx.fillRect(Math.round(e.x - 8), Math.round(e.y - 8), 16, 16);
        ctx.restore();
      } else if (e.kind === 'heraldCastLine') {
        const fade = Math.max(0, 1 - p);
        const fill = Math.max(0, Math.min(1, e.pfill || 0));
        const x2 = e.x + (e.x2 - e.x) * fill;
        const y2 = e.y + (e.y2 - e.y) * fill;
        ctx.save();
        ctx.globalAlpha = fade * 0.20;
        ctx.strokeStyle = '#5b111c'; ctx.lineWidth = 2;
        ctx.setLineDash([7, 7]);
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x2, e.y2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.86;
        ctx.strokeStyle = e.color || '#ff3048'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(x2, y2); ctx.stroke();
        const dx = x2 - e.x, dy = y2 - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = dx / len, ny = dy / len;
        ctx.fillStyle = e.color || '#ff3048';
        const blocks = Math.floor(len / 34);
        for (let i = 1; i <= blocks; i++) {
          const bx = e.x + nx * i * 34, by = e.y + ny * i * 34;
          ctx.fillRect(Math.round(bx - 3), Math.round(by - 3), 6, 6);
        }
        if (fill > 0.94) {
          ctx.globalAlpha = fade * 0.72;
          ctx.strokeRect(Math.round(e.x2 - 18), Math.round(e.y2 - 18), 36, 36);
        }
        ctx.restore();
      } else if (e.kind === 'heraldSummonBurst') {
        const fade = Math.max(0, 1 - p);
        ctx.save();
        ctx.globalAlpha = fade * 0.88;
        ctx.strokeStyle = e.color || '#ff3048'; ctx.lineWidth = 3;
        const base = 52 + p * 28;
        ctx.strokeRect(Math.round(e.x - base / 2), Math.round(e.y - base / 2), Math.round(base), Math.round(base));
        ctx.globalAlpha = fade * 0.52;
        ctx.setLineDash([8, 5]);
        ctx.strokeRect(Math.round(e.x - base * 0.82), Math.round(e.y - base * 0.82), Math.round(base * 1.64), Math.round(base * 1.64));
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.75; ctx.fillStyle = e.color || '#ff3048';
        const dx = e.dx || 1, dy = e.dy || 0;
        const px = -dy, py = dx;
        const n = Math.max(3, Math.min(7, e.count || 5));
        for (let i = 0; i < n; i++) {
          const row = i - (n - 1) / 2;
          const bx = e.x + px * row * 19 + dx * (p * 32);
          const by = e.y + py * row * 19 + dy * (p * 32);
          ctx.fillRect(Math.round(bx - 6), Math.round(by - 6), 12, 12);
        }
        ctx.font = `bold 10px 'Courier New', monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('HRD CALL', Math.round(e.x), Math.round(e.y - base * 0.95));
        ctx.restore();
      } else if (e.kind === 'casinoRollBurst') {
        const fade = Math.max(0, 1 - p);
        ctx.globalAlpha = fade * 0.72;
        ctx.strokeStyle = e.color || '#00ff66';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 4]);
        const slots = e.symbols && e.symbols.length ? e.symbols : ['Q','?','?'];
        const w = 38, h = 24;
        ctx.font = `bold ${Math.round(12 + 2 * fade)}px 'Courier New', monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < 3; i++) {
          const x = e.x + (i - 1) * 44;
          const y = e.y - 80 - p * 16;
          ctx.strokeRect(Math.round(x - w / 2), Math.round(y - h / 2), w, h);
          ctx.globalAlpha = fade * 0.38;
          ctx.fillStyle = e.color || '#00ff66';
          ctx.fillText(String(slots[i] || '?').slice(0, 4), Math.round(x), Math.round(y + 1));
          ctx.globalAlpha = fade * 0.72;
        }
        ctx.setLineDash([]);
      } else if (e.kind === 'freezeLock') {
        const fade = Math.max(0, 1 - p);
        const s = e.r || 44;
        ctx.save();
        ctx.globalAlpha = fade * 0.85;
        ctx.strokeStyle = e.color || '#66f6ff';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([3, 5]);
        ctx.strokeRect(Math.round(e.x - s / 2), Math.round(e.y - s / 2), Math.round(s), Math.round(s));
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.20;
        ctx.fillStyle = e.color || '#66f6ff';
        ctx.fillRect(Math.round(e.x - s * 0.32), Math.round(e.y - s * 0.32), Math.round(s * 0.64), Math.round(s * 0.64));
        ctx.restore();
      } else if (e.kind === 'squareField') {
        const s = e.r;
        const tick = !!e.tick;
        const ak = String(e.activeKind || '');
        ctx.strokeStyle = e.color; ctx.globalAlpha = (1 - p) * (tick ? 0.30 : 0.42); ctx.lineWidth = tick ? 2.5 : 2;
        ctx.setLineDash(ak.includes('freeze') ? [3, 7] : ak.includes('blood') || ak.includes('debt') ? [9, 5] : [7, 7]);
        ctx.strokeRect(Math.round(e.x - s / 2), Math.round(e.y - s / 2), Math.round(s), Math.round(s));
        ctx.setLineDash([]);
        if (ak.includes('signal_spike') || ak.includes('anchor_field')) {
          const node = Math.max(18, Math.min(34, s * 0.16));
          ctx.globalAlpha = (1 - p) * 0.75;
          ctx.strokeStyle = e.color; ctx.lineWidth = 3;
          ctx.strokeRect(Math.round(e.x - node / 2), Math.round(e.y - node / 2), Math.round(node), Math.round(node));
          ctx.globalAlpha = (1 - p) * 0.20;
          ctx.fillStyle = e.color;
          ctx.fillRect(Math.round(e.x - node * 0.28), Math.round(e.y - node * 0.28), Math.round(node * 0.56), Math.round(node * 0.56));
        }
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
