// terminal casino roguelike effects: dopamine layer — bursts, floats, shake, sweeps, vignette
import { t, denyText, localText, locLabel } from './i18n.v2-1.js';
const HEX = /^#[0-9a-fA-F]{6}$/;
function safeCol(v, fallback) { const x = String(v || '').trim(); return HEX.test(x) ? x : fallback; }
function fxLabel(v) {
  const s = String(v || '');
  const map = {
    'CASINO ROLL': localText('КАЗИНО-БРОСОК', 'CASINO ROLL'),
    'ROLLING...': localText('КРУТИТСЯ...', 'ROLLING...'),
    'CASINO GLD': localText('КАЗИНО GLD', 'CASINO GLD'),
    'CASINO EXP': localText('КАЗИНО EXP', 'CASINO EXP'),
    'CASINO HEAL': localText('КАЗИНО HP', 'CASINO HEAL'),
    'CASINO HIT': localText('КАЗИНО УДАР', 'CASINO HIT'),
    'STATIC STORM': localText('СТАТИК-ШТОРМ', 'STATIC STORM')
  };
  return map[s] || locLabel(s);
}

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
    this.levelPulse = 0;
    this.levelLabel = '';
    this.killSwitchFlash = 0;
    this.nullRevivalFlash = 0;
    this.rewindPulse = 0;
  }

  add(e) { const delay = Math.max(0, Number(e?.delay || 0)); this.list.push({ ...e, t: -delay }); if (this.list.length > 220) this.list.shift(); }

  slotAssemblyTimeLeftNear(x, y, radius = 190) {
    const px = Number(x), py = Number(y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) return 0;
    let left = 0;
    for (const e of this.list) {
      if (!e || e.kind !== 'slotBreakChunks') continue;
      const tx = Number(e.x2 ?? e.x), ty = Number(e.y2 ?? e.y);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
      const dx = tx - px, dy = ty - py;
      if (dx * dx + dy * dy > radius * radius) continue;
      const pre = Math.max(0, Number(e.preBreak || 0));
      const hold = Math.max(0, Number(e.hold || 3.0));
      const step = Math.max(0.32, Number(e.gatherStep || 0.52));
      const dur = Math.max(0.72, Number(e.gatherDur || 1.08));
      const finalJoin = pre + hold + dur * 4 + step * 3;
      const finalGone = finalJoin + 0.72;
      // While the four quarters exist visually, the casino mob must not be drawn or roll.
      // This covers delayed FX delivery / laggy frames where the authoritative snapshot
      // can arrive before the visible assembly chain has finished on the client.
      left = Math.max(left, finalGone - (Number(e.t) || 0));
    }
    return Math.max(0, left);
  }

  slotAssemblyActiveNear(x, y, radius = 190) { return this.slotAssemblyTimeLeftNear(x, y, radius) > 0.0001; }

  float(x, y, text, color = '#f3f3f3', size = 13) {
    this.floats.push({ x, y, text, color, size, t: 0, ttl: 0.9 });
    if (this.floats.length > 60) this.floats.shift();
  }

  kick(amount) { this.shake = Math.min(9, this.shake + amount); }

  update(dt, state = null) {
    for (const e of this.list) e.t += dt;
    this.list = this.list.filter(e => e.t < (e.ttl ?? 0.6));
    // v2.1.87: spawn-warning zones are only pre-spawn telegraphs.
    // As soon as the authoritative snapshot says an enemy at that spot is live,
    // remove the old world FX immediately instead of letting it fade over the mob.
    const enemies = state?.latest?.enemies || [];
    if (enemies.length) {
      this.list = this.list.filter(e => {
        if (e.kind !== 'spawnWarning') return true;
        return !enemies.some(row => row && Number(row[21] || 0) <= 0 && Math.abs(Number(row[2] || 0) - e.x) <= 8 && Math.abs(Number(row[3] || 0) - e.y) <= 8);
      });
    }
    for (const f of this.floats) { f.t += dt; f.y -= 34 * dt; }
    this.floats = this.floats.filter(f => f.t < f.ttl);
    this.shake = Math.max(0, this.shake - 72 * dt);
    this.hitFlash = Math.max(0, this.hitFlash - 2.2 * dt);
    this.slam = Math.max(0, this.slam - 2.5 * dt);
    this.zoomKick = Math.max(0, this.zoomKick - 3 * dt);
    this.levelPulse = Math.max(0, this.levelPulse - 1.35 * dt);
    this.levelEdge = Math.max(0, this.levelEdge - 1.45 * dt);
    this.killSwitchFlash = Math.max(0, this.killSwitchFlash - 1.85 * dt);
    this.nullRevivalFlash = Math.max(0, this.nullRevivalFlash - 1.25 * dt);
    this.rewindPulse = Math.max(0, (this.rewindPulse || 0) - 1.65 * dt);
    if (this.sweep > 0) { this.sweep += dt * 1.6; if (this.sweep >= 1) this.sweep = 0; }
  }

  // handle a server fx event; ctxInfo: {myId, getPlayerPos}
  handleFx(f, info) {
    const mine = f.id === info.myId;
    switch (f.t) {
      case 'ehit':
        this.add({ kind: 'hitmark', x: f.x, y: f.y, ttl: 0.18 });
        if (f.dmg >= 1) this.float(f.x + (Math.random() - 0.5) * 18, f.y - 16, String(f.dmg), '#f3f3f3', Math.min(34, 15 + f.dmg * 0.26));
        break;
      case 'phit':
        if (mine) { this.hitFlash = Math.min(0.65, 0.24 + f.dmg * 0.012); this.kick(Math.min(3.2, 0.7 + f.dmg * 0.045)); }
        this.add({ kind: 'hitmark', x: f.x, y: f.y, ttl: 0.15 });
        break;
      case 'gld_hit':
        if (mine) { this.hitFlash = Math.min(0.50, 0.22); this.kick(Math.min(2.8, 0.8 + (f.cost || 0) * 0.012)); }
        this.add({ kind: 'denybox', x: f.x, y: f.y, ttl: 0.24, color: '#ffd34d' });
        this.float(f.x + (Math.random() - 0.5) * 20, f.y - 20, `-${f.cost || 0} GLD`, '#ffd34d', 13);
        if (mine) this.float(f.x, f.y - 38, `BAL ${f.balance ?? 0}`, '#ff3048', 10);
        break;
      case 'shot': {
        const dx = (f.dx || 100) / 100, dy = (f.dy || 0) / 100;
        const col = f.kind === 'seeker' ? '#66f6ff' : (f.kind === 'rocketgun' ? '#ff3048' : '#f3f3f3');
        let mx = f.mx || f.x, my = f.my || f.y;
        if (mine && typeof info.getMyPos === 'function') {
          const mp = info.getMyPos();
          if (mp) { mx = Math.round(mp.x + dx * 24); my = Math.round(mp.y + dy * 24); }
        }
        this.add({ kind: 'muzzle', x: mx, y: my, dx, dy, ttl: f.kind === 'rocketgun' ? 0.14 : 0.10, color: col, weapon: f.kind || f.w });
        if (mine) { this.kick(f.kind === 'rocketgun' ? 2.6 : f.kind === 'shotgun' ? 1.8 : 1.1); this.zoomKick = Math.max(this.zoomKick, f.kind === 'rocketgun' ? 0.14 : 0.08); }
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
          this.kick(Math.min(6.2, (f.style === 'rocket' ? 1.6 : 1.0) + Math.min(4.2, Math.max(0, f.hits || 0) * 0.42)));
        } else {
          this.add({ kind: 'squareBlastLite', x: f.x, y: f.y, r: f.r, ttl: 0.26, color: f.style === 'proc' ? '#66f6ff' : '#f3f3f3' });
          this.kick(Math.min(4.6, (f.style === 'proc' ? 0.8 : 1.0) + Math.min(3.4, Math.max(0, f.hits || 0) * 0.34)));
        }
        break;
      case 'spawn_warning':
        this.add({ kind: 'spawnWarning', x: f.x, y: f.y, r: f.r || 64, ttl: Math.max(0.65, f.delay || 1.0), color: '#8a8a8a', count: f.count || 1 });
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
        if (mine) {
          this.levelPulse = 1;
          this.levelEdge = 0;
          this.levelLabel = f.level ? `LVL ${f.level}` : 'LEVEL UP';
          this.kick(7);
        }
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
            this.float(f.x, f.y - 34, denyText(f), f.hpCost ? '#ff3048' : '#ff3048', 14);
          }
          this.hitFlash = Math.max(this.hitFlash, 0.18);
          this.kick(6);
        }
        break;
      case 'active_denied':
        if (mine) {
          if (typeof f.x === 'number' && typeof f.y === 'number') {
            this.add({ kind: 'denybox', x: f.x, y: f.y, ttl: 0.45, color: '#66f6ff' });
            this.float(f.x, f.y - 34, denyText(f), '#66f6ff', 13);
          }
          this.kick(3);
        }
        break;
      case 'portal_open':
        // v2.1: portal open is a hard square signal burst, never a round ring.
        this.add({ kind: 'portalSquare', x: f.x, y: f.y, r: 172, ttl: 0.74, color: '#00ff66' });
        this.add({ kind: 'portalBurst', x: f.x, y: f.y, r: 150, ttl: 0.58, color: '#00ff66' });
        this.add({ kind: 'squareBlastLite', x: f.x, y: f.y, r: 92, ttl: 0.34, color: '#9dffbf' });
        this.float(f.x, f.y - 46, t('portalOpen'), '#00ff66', 14);
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
      case 'blood_tax_warn':
        this.add({ kind: 'warnring', x: f.x, y: f.y, r: f.r, ttl: f.dur || 0.8, color: '#ff3048' });
        break;
      case 'blood_tax_hit':
        this.add({ kind: 'rocketBlast', x: f.x, y: f.y, r: f.r || 72, ttl: 0.28, color: '#ff3048' });
        this.kick(4);
        break;
      case 'moving_zone_hit':
        this.add({ kind: 'movingZoneHit', x: f.x, y: f.y, w: f.w || 120, h: f.h || 70, ttl: 0.26, color: '#ff3048' });
        this.kick(2);
        break;
      case 'room_invoice':
        if (f.noHit) { this.sweep = 0.01; this.sweepColor = '#00ff66'; }
        if (f.fast) this.kick(3);
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
        this.add({ kind: 'heraldCastLine', x: f.x, y: f.y, x2: f.x2, y2: f.y2, points: Array.isArray(f.points) ? f.points : null, seed: f.seed || 0, pfill: (f.p || 0) / 100, ttl: 0.42, color: '#ff3048', start: f.start ? 1 : 0 });
        this.add({ kind: 'heraldCore', x: f.x, y: f.y, ttl: 0.22, color: '#b45cff', start: f.start ? 1 : 0 });
        break;
      case 'summon':
        if (f.kind === 'herald') this.add({ kind: 'heraldSummonBurst', x: f.x, y: f.y, x2: f.x2, y2: f.y2, hx: f.hx, hy: f.hy, dx: (f.dx || 0) / 100, dy: (f.dy || 0) / 100, count: f.count || 0, ttl: 0.55, color: '#ff3048' });
        else this.add({ kind: 'burst', x: f.x, y: f.y, r: 70, ttl: 0.24, color: '#ff3048' });
        break;
      case 'echo_shot':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 38, ttl: 0.18, color: f.enemy ? '#ff3048' : '#b45cff' });
        this.add({ kind: 'denybox', x: f.x, y: f.y, ttl: 0.18, color: f.enemy ? '#ff3048' : '#b45cff' });
        break;
      case 'prism':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 62, ttl: 0.22, color: '#66f6ff' });
        break;
      case 'pulse_wave':
        this.add({ kind: 'pulseWave', x: f.x, y: f.y, dx: f.dx, dy: f.dy, ttl: 0.28, color: '#ff3048' });
        break;
      case 'dash_stun':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: f.r || 72, ttl: 0.30, color: '#f3f3f3', tick: 1 });
        this.float(f.x, f.y - 36, `STUN x${f.count || 1}`, '#f3f3f3', 10);
        if (mine) this.kick(2);
        break;
      case 'dash_void': {
        this.add({ kind: 'voidDashRift', x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, w: f.w || 48, ttl: 0.30, color: '#b45cff' });
        if (f.count) this.float((f.x1 + f.x2) / 2, (f.y1 + f.y2) / 2 - 34, `VOID x${f.count}`, '#b45cff', 10);
        if (mine) this.kick(2);
        break;
      }
      case 'bullet_cut':
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 50 + (f.count || 1) * 4, ttl: 0.18, color: '#66f6ff' });
        break;
      case 'active': {
        const activeLabel = String(f.label || '').toUpperCase();
        const noScreenSweep = activeLabel.includes('FIELD SNAP');
        if (mine) {
          if (!noScreenSweep) { this.sweep = 0.01; this.sweepColor = activeLabel.includes('BLOOD') ? '#ff3048' : '#66f6ff'; }
          this.kick(noScreenSweep ? 3 : 5);
        }
        const isBox = f.kind === 'black_box' || String(f.label || '').includes('BLACK BOX');
        const isFreeze = f.kind === 'freeze_aura' || String(f.label || '').includes('FREEZE');
        const col = isBox ? '#b45cff' : f.label && f.label.includes('BLOOD') ? '#ff3048' : (f.label && f.label.includes('RIPPER') ? '#b45cff' : '#66f6ff');
        this.add({ kind: isBox ? 'blackBoxAura' : 'squareField', activeKind: isBox ? 'black_box' : (isFreeze ? 'freeze_aura' : String(f.label || '').toLowerCase().replace(/ .*/, '')), x: f.x, y: f.y, r: f.r || 160, ttl: isBox ? 0.38 : 0.26, color: col, cast: isBox ? 1 : 0 });
        this.float(f.x, f.y - 50, fxLabel(f.label || 'Q'), col, 12);
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
        else if (f.kind === 'void_laser') this.add({ kind: 'voidLaser', x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, w: f.width || 1.5, hitW: f.hitWidth || 8, ttl: 0.16, color: '#b45cff' });
        else this.add({ kind: 'voidLine', x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, w: f.width || 44, ttl: 0.20, color: f.tone === 'red' ? '#ff3048' : (f.tone === 'purple' ? '#b45cff' : '#66f6ff') });
        break;
      case 'active_line_tick':
        if (f.kind === 'void_laser') this.add({ kind: 'voidLaser', tick: 1, x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, w: f.width || 1.5, hitW: f.hitWidth || 8, ttl: 0.15, color: '#b45cff' });
        else this.add({ kind: 'voidLine', tick: 1, x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, w: f.width || 44, ttl: 0.14, color: '#b45cff' });
        break;
      case 'weapon_chain_link':
        this.add({ kind: 'weaponChainLine', x: f.x1, y: f.y1, x2: f.x2, y2: f.y2, ttl: 0.22, color: '#66f6ff', jump: f.jump || 1 });
        break;
      case 'weapon_chain_lock':
        this.add({ kind: 'chainLock', x: f.x, y: f.y, r: f.r || 30, ttl: 0.30, color: '#66f6ff' });
        break;
      case 'element_hit': {
        const col = f.tone === 'red' ? '#ff3048' : f.tone === 'green' ? '#00ff66' : '#66f6ff';
        this.add({ kind: 'squareField', activeKind: String(f.label || '').toLowerCase(), x: f.x, y: f.y, r: f.r || 48, ttl: 0.18, color: col, tick: 1 });
        if (f.label) this.float(f.x, f.y - 34, fxLabel(f.label), col, 8);
        break;
      }
      case 'active_field': {
        const col = f.tone === 'red' ? '#ff3048' : (f.tone === 'purple' ? '#b45cff' : '#66f6ff');
        this.add({ kind: f.kind === 'black_box' ? 'blackBoxAura' : 'squareField', activeKind: String(f.kind || ''), x: f.x, y: f.y, r: f.r || 130, ttl: f.kind === 'black_box' ? 0.34 : 0.30, color: col });
        break;
      }
      case 'active_tick':
        this.add({ kind: 'squareField', activeKind: String(f.kind || '') + '_tick', x: f.x, y: f.y, r: f.r || 130, ttl: 0.12, color: f.tone === 'red' ? '#ff3048' : (f.tone === 'purple' ? '#b45cff' : '#66f6ff'), tick: 1 });
        break;
      case 'redline_boost': {
        if (mine) { this.slam = Math.max(this.slam, 0.18); this.kick(7 + Math.min(8, f.stack || 1)); }
        const stack = Math.max(1, Number(f.stack || 1) | 0);
        const r = Number(f.r || 140);
        this.add({ kind: 'squareField', activeKind: 'redline_boost_start', x: f.x, y: f.y, r, ttl: 0.36, color: '#ff3048' });
        this.add({ kind: 'squareField', activeKind: 'redline_boost_core', x: f.x, y: f.y, r: Math.max(52, r * 0.52), ttl: 0.42, color: '#ffd34d', tick: 1 });
        for (let i = 0; i < Math.min(6, 2 + stack); i++) {
          const a = (i / Math.max(1, Math.min(6, 2 + stack))) * Math.PI * 2;
          this.add({ kind: 'squareField', activeKind: 'redline_speed_line', x: f.x + Math.cos(a) * 24, y: f.y + Math.sin(a) * 24, r: 42 + stack * 5, ttl: 0.18 + i * 0.025, color: '#ff3048', tick: 1 });
        }
        this.float(f.x, f.y - 56, `REDLINE x${stack}`, '#ff3048', 13);
        break;
      }
      case 'ghost_decoy': {
        if (mine) { this.slam = Math.max(this.slam, 0.10); this.kick(5); }
        this.add({ kind: 'squareField', activeKind: 'ghost_decoy_start', x: f.x, y: f.y, r: f.r || 125, ttl: 0.42, color: '#66f6ff', tick: 1 });
        this.float(f.x, f.y - 56, 'GHOST MODE', '#66f6ff', 13);
        break;
      }
      case 'active_mutation': {
        const col = f.tone === 'red' ? '#ff3048' : f.tone === 'green' ? '#00ff66' : f.tone === 'purple' ? '#b45cff' : '#66f6ff';
        this.add({ kind: f.squareBlast ? 'rocketBlast' : 'squareField', activeKind: String(f.label || '').toLowerCase(), x: f.x, y: f.y, r: f.r || 95, ttl: f.squareBlast ? 0.22 : 0.24, color: col });
        if (f.label && !f.noFloat) this.float(f.x, f.y - 42, f.label, col, 10);
        break;
      }
      case 'rewind_mark':
        if (mine) { this.rewindPulse = 0.42; this.kick(3); }
        this.float(f.x, f.y - 42, 'REWIND MARK', '#b45cff', 10);
        break;
      case 'rewind_return':
        if (mine) { this.rewindPulse = 0.82; this.slam = Math.max(this.slam, 0.12); this.kick(9); }
        this.float(f.x, f.y - 56, `REWIND STUN x${f.hit || 0}`, '#b45cff', 13);
        break;
      case 'kill_switch_screen':
        if (mine) { this.killSwitchFlash = 1; this.slam = Math.max(this.slam, 0.35); this.kick(14); }
        this.add({ kind: 'squareField', activeKind: 'kill_switch_screen', x: f.x, y: f.y, r: 640, ttl: 0.55, color: '#ff3048' });
        break;
      case 'null_revival_screen':
        if (mine) { this.nullRevivalFlash = 1; this.slam = Math.max(this.slam, 0.26); this.kick(11); }
        this.add({ kind: 'squareField', activeKind: 'null_revival_screen', x: f.x, y: f.y, r: 560, ttl: 0.70, color: '#b45cff' });
        this.float(f.x, f.y - 68, f.label || 'NULL REVIVAL', '#b45cff', 16);
        break;
      case 'enemy_combo':
        // Hidden: synergy labels around mobs were too noisy for normal play.
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
      case 'room_event':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: 170, ttl: 0.55, color: '#b45cff' });
        break;
      case 'room_event_done':
      case 'room_wager_paid':
      case 'room_wager_accept':
        this.add({ kind: 'ring', x: f.x, y: f.y, r: 210, ttl: 0.65, color: '#ffd34d' }); this.kick(6);
        break;
      case 'room_wager_lost':
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: 220, ttl: 0.72, color: '#ff3048' }); this.kick(8);
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
      case 'casino_overload': {
        const d = Math.max(3.0, Number(f.breakDelay || 4.18));
        const hold = Math.max(3.0, Number(f.holdDelay || 3.0));
        const step = Math.max(0.32, Number(f.gatherStep || 0.52));
        const dur = Math.max(0.72, Number(f.gatherDur || 1.08));
        // One authoritative visual chain: terminal shakes after the BET window closes,
        // breaks into 4 colored physical quarters, then the quarters magnetize back.
        // The slot mob entity is not present in the snapshot until this chain has fully ended.
        this.add({ kind: 'slotBreakChunks', x: f.x, y: f.y, x2: f.sx || f.x, y2: f.sy || f.y, ttl: d + hold + dur * 4 + step * 3 + 0.92, color: '#ffd34d', delay: 0, preBreak: d, hold, gatherStep: step, gatherDur: dur, heavy: 1, physical: 1, spawn: 1, mobSize: f.mobSize || 44 });
        this.float(f.x, f.y - 70, f.label || 'SLOT OVERLOAD', '#ff3048', 16);
        this.slam = 0.55; this.kick(10);
        break;
      }
      case 'slot_mob_roll':
        if (this.slotAssemblyActiveNear(f.x, f.y, 210)) break;
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: 96, ttl: 0.34, color: '#ffd34d' });
        this.float(f.x, f.y - 42, String(f.mode || 'ROLL').toUpperCase(), '#ffd34d', 9);
        break;
      case 'slot_mob_roll_tick':
        if (this.slotAssemblyActiveNear(f.x, f.y, 210)) break;
        this.add({ kind: 'slotTick', x: f.x, y: f.y, ttl: 0.22, color: '#ffd34d' });
        break;
      case 'slot_mob_rebuild': {
        const d = Math.max(0, Number(f.delay || 0));
        const hold = Math.max(3.0, Number(f.holdDelay || 3.0));
        const step = Math.max(0.32, Number(f.gatherStep || 0.52));
        const dur = Math.max(0.72, Number(f.gatherDur || 1.08));
        this.add({ kind: 'slotBreakChunks', x: f.x, y: f.y, ttl: hold + dur * 4 + step * 3 + 0.92, color: '#ffd34d', delay: d, preBreak: 0, hold, gatherStep: step, gatherDur: dur, heavy: 1, physical: 1, spawn: f.spawn ? 1 : 0, mobSize: f.mobSize || 44 });
        if (d <= 0.05) this.float(f.x, f.y - 54, f.spawn ? 'SLOT MOB' : `REBUILD ${f.lives || ''}/10`, '#ffd34d', 12);
        this.kick(f.spawn ? 10 : 7);
        break;
      }
      case 'slot_mob_break':
        this.add({ kind: 'squareBlastLite', x: f.x, y: f.y, r: 86, ttl: 0.30, color: '#ff3048' });
        this.float(f.x, f.y - 62, localText('РАЗЛОМ СЛОТА', 'SLOT FRACTURE'), '#ff3048', 14);
        this.slam = Math.max(this.slam, 0.35); this.kick(12);
        break;
      case 'slot_mob_piece_impact': {
        const final = !!f.final;
        this.add({ kind: 'squareField', x: f.x, y: f.y, r: final ? 145 : 58 + (f.step || 1) * 18, ttl: final ? 0.46 : 0.26, color: final ? '#ff3048' : '#ffd34d' });
        this.kick(final ? 15 : (2.5 + (f.step || 1) * 2));
        if (final) this.slam = Math.max(this.slam, 0.50);
        break;
      }
      case 'slot_mob_assemble_burst': {
        const wait = this.slotAssemblyTimeLeftNear(f.x, f.y, 220);
        this.add({ kind: 'burst', x: f.x, y: f.y, r: 110, ttl: 0.34, delay: wait, color: '#ffd34d' });
        if (wait <= 0.01) this.float(f.x, f.y - 62, 'SLOT MOB', '#ffd34d', 16);
        this.kick(wait > 0.01 ? 0 : 14); this.slam = Math.max(this.slam, wait > 0.01 ? this.slam : 0.40);
        break;
      }
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
      if (e.t < 0) continue;
      const p = Math.max(0, Math.min(1, e.t / (e.ttl ?? 0.6)));
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
      } else if (e.kind === 'portalSquare') {
        const fade = 1 - p;
        const snap = Math.floor(p * 7);
        const steps = 4;
        ctx.setLineDash([18, 9, 4, 9]);
        for (let i = 0; i < steps; i++) {
          const q = (i + 1) / steps;
          const s = e.r * (0.14 + snap * 0.105 + q * 0.11);
          ctx.globalAlpha = fade * (0.58 - i * 0.09);
          ctx.strokeStyle = i % 2 ? '#9dffbf' : e.color;
          ctx.lineWidth = Math.max(1, 4 - p * 2.8 - i * 0.35);
          ctx.strokeRect(Math.round(e.x - s / 2), Math.round(e.y - s / 2), Math.round(s), Math.round(s));
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.18; ctx.fillStyle = e.color;
        const core = 26 + snap * 4;
        ctx.fillRect(Math.round(e.x - core / 2), Math.round(e.y - core / 2), Math.round(core), Math.round(core));
      } else if (e.kind === 'portalBurst') {
        const fade = 1 - p;
        const snap = Math.floor(p * 6);
        const base = e.r * (0.22 + snap * 0.13);
        ctx.save();
        ctx.translate(Math.round(e.x), Math.round(e.y));
        ctx.strokeStyle = e.color || '#00ff66';
        ctx.fillStyle = e.color || '#00ff66';
        ctx.lineWidth = 2;
        ctx.globalAlpha = fade * 0.62;
        // Four square shock plates: cardinal only, no circular ring.
        const plates = [
          [0, -1, 1.00], [1, 0, 0.82], [0, 1, 0.70], [-1, 0, 0.88],
          [1, -1, 0.54], [1, 1, 0.48], [-1, 1, 0.44], [-1, -1, 0.50],
        ];
        for (let i = 0; i < plates.length; i++) {
          const [dx, dy, m] = plates[i];
          const dist = base * (0.24 + m * 0.42);
          const sz = Math.max(6, Math.round((18 + (i % 3) * 5) * fade));
          const x = Math.round(dx * dist - sz / 2);
          const y = Math.round(dy * dist - sz / 2);
          if (i < 4) ctx.strokeRect(x, y, sz, sz);
          else { ctx.globalAlpha = fade * 0.22; ctx.fillRect(x, y, sz, sz); ctx.globalAlpha = fade * 0.62; }
        }
        // Pleasant inner green flash: square core only.
        ctx.globalAlpha = fade * 0.28;
        const core = Math.max(8, 28 - snap * 2);
        ctx.fillStyle = '#9dffbf';
        ctx.fillRect(Math.round(-core / 2), Math.round(-core / 2), core, core);
        ctx.restore();
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
      } else if (e.kind === 'slotBreakChunks') {
        // One strict physical/magnet chain. Four colored quarters are the mob body:
        // they bounce/settle, wait, then magnetize back one-by-one. The live mob is
        // rendered only after the server-side pending assembly resolves, so there is no separate ghost mob.
        const pre = Math.max(0, Number(e.preBreak || 0));
        const hold = Math.max(0, Number(e.hold || 3.0));
        const step = Math.max(0.32, Number(e.gatherStep || 0.52));
        const dur = Math.max(0.72, Number(e.gatherDur || 1.08));
        const mobSize = Math.max(34, Number(e.mobSize || 44) || 44);
        const quarter = Math.max(14, mobSize / 2);
        if (e.t < pre) {
          const q = e.t / Math.max(0.01, pre);
          const jx = Math.sin(e.t * 58) * (2 + q * 8) + Math.sin(e.t * 119) * q * 2;
          const jy = Math.cos(e.t * 51) * (1.5 + q * 6) + Math.cos(e.t * 101) * q * 2;
          ctx.save();
          ctx.globalAlpha = 0.56 + Math.sin(e.t * 31) * 0.18;
          ctx.strokeStyle = '#ff3048'; ctx.fillStyle = 'rgba(255,48,72,0.10)'; ctx.lineWidth = 3.2;
          ctx.setLineDash([9, 5]);
          const s = mobSize * (1.26 + q * 0.42);
          ctx.strokeRect(Math.round(e.x - s / 2 + jx), Math.round(e.y - s / 2 + jy), Math.round(s), Math.round(s));
          ctx.fillRect(Math.round(e.x - s / 2 + jx), Math.round(e.y - s / 2 + jy), Math.round(s), Math.round(s));
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.48 + q * 0.24;
          ctx.strokeStyle = '#ffd34d';
          ctx.strokeRect(Math.round(e.x - quarter / 2 - jx), Math.round(e.y - quarter / 2 - jy), Math.round(quarter), Math.round(quarter));
          ctx.restore();
        } else {
          const t = Math.max(0, e.t - pre);
          if (!e.parts) {
            const timeSeed = ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now()) * 0.001;
            const seed = Math.abs(Math.sin((e.x || 1) * 12.9898 + (e.y || 1) * 78.233 + timeSeed * 37.719) * 43758.5453);
            const rnd = (i, off = 0) => {
              const v = Math.sin((seed + i * 23.71 + off * 9.13) * 997.31) * 43758.5453;
              return v - Math.floor(v);
            };
            const cols = ['#ffd34d', '#66f6ff', '#b45cff', '#ff3048'];
            const order = [0, 1, 2, 3].sort((a, b) => rnd(a, 7) - rnd(b, 7));
            e.parts = order.map((quad, i) => {
              const a = (-Math.PI + rnd(i, 1) * Math.PI * 2);
              const sp = 245 + rnd(i, 2) * 155;
              return {
                quad, col: cols[quad % cols.length],
                px: e.x + (rnd(i, 3) - 0.5) * 8,
                py: e.y + (rnd(i, 4) - 0.5) * 8,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - (150 + rnd(i, 5) * 170),
                rot: (rnd(i, 6) - 0.5) * Math.PI,
                spin: (rnd(i, 8) < 0.5 ? -1 : 1) * (4.4 + rnd(i, 9) * 5.2),
                joined: false, gatherFrom: null
              };
            });
            e.lastPhysT = t;
            e.impacts = [];
            e.finalBits = [];
          }
          const dtp = Math.max(0, Math.min(0.05, t - (e.lastPhysT ?? t)));
          e.lastPhysT = t;
          const targetX = Number(e.x2 || e.x), targetY = Number(e.y2 || e.y);
          const localMinX = Math.min(e.x, targetX) - 300, localMaxX = Math.max(e.x, targetX) + 300;
          const localMinY = Math.min(e.y, targetY) - 230, localMaxY = Math.max(e.y, targetY) + 230;
          const groundY = Math.min(localMaxY, Math.max(e.y, targetY) + 142);
          const finalOffsetsByQuad = [
            [-quarter / 2, -quarter / 2],
            [ quarter / 2, -quarter / 2],
            [-quarter / 2,  quarter / 2],
            [ quarter / 2,  quarter / 2]
          ];
          ctx.save();
          for (let i = 0; i < e.parts.length; i++) {
            const part = e.parts[i];
            const gatherStart = hold + i * (dur + step);
            let rot = part.rot;
            if (t < gatherStart) {
              // True visual physics while the piece is still free: gravity, damping,
              // and bounces against the local arena/wall box.
              if (dtp > 0) {
                part.vy += 640 * dtp;
                part.px += part.vx * dtp;
                part.py += part.vy * dtp;
                part.rot += part.spin * dtp;
                const bounce = 0.58;
                if (part.px < localMinX + quarter / 2) { part.px = localMinX + quarter / 2; part.vx = Math.abs(part.vx) * bounce; part.spin *= -0.78; }
                if (part.px > localMaxX - quarter / 2) { part.px = localMaxX - quarter / 2; part.vx = -Math.abs(part.vx) * bounce; part.spin *= -0.78; }
                if (part.py < localMinY + quarter / 2) { part.py = localMinY + quarter / 2; part.vy = Math.abs(part.vy) * bounce; part.spin *= -0.72; }
                if (part.py > groundY - quarter / 2) {
                  part.py = groundY - quarter / 2;
                  part.vy = -Math.abs(part.vy) * 0.34;
                  part.vx *= 0.78;
                  part.spin *= 0.66;
                  if (Math.abs(part.vy) < 38) part.vy = 0;
                  if (Math.abs(part.vx) < 9) part.vx = 0;
                }
              }
            } else {
              if (!part.gatherFrom) part.gatherFrom = { x: part.px, y: part.py, rot: part.rot };
              const q = Math.max(0, Math.min(1, (t - gatherStart) / dur));
              // Magnet feel: very slow at first, then rapidly accelerates near the core.
              const mag = Math.pow(q, 2.8);
              const final = finalOffsetsByQuad[part.quad] || [0, 0];
              const tx = targetX + final[0];
              const ty = targetY + final[1];
              const left = 1 - mag;
              const vib = Math.sin((t - gatherStart) * (46 + i * 13) + part.quad * 1.7) * left * (2.4 + i * 0.9);
              part.px = part.gatherFrom.x + (tx - part.gatherFrom.x) * mag + vib;
              part.py = part.gatherFrom.y + (ty - part.gatherFrom.y) * mag - Math.sin(q * Math.PI) * (20 + i * 5) + vib * 0.35;
              rot = part.gatherFrom.rot + q * Math.PI * (i % 2 ? -1 : 1) * 1.35;
              part.rot = rot;
              if (!part.joined && q >= 1) {
                part.joined = true;
                part.px = tx; part.py = ty;
                const pow = i + 1;
                e.impacts.push({ x: targetX, y: targetY, t: 0, ttl: i === 3 ? 0.62 : 0.34, pow, col: i === 3 ? '#ff3048' : part.col });
                this.kick(i === 3 ? 14 : (2.8 + i * 2.2));
                if (i === 3) {
                  e.finalJoinT = t;
                  this.slam = Math.max(this.slam, 0.45);
                  const burstCols = ['#ffd34d', '#66f6ff', '#b45cff', '#ff3048'];
                  e.finalBits = Array.from({ length: 18 }, (_, k) => {
                    const a = (k / 18) * Math.PI * 2 + (k % 3) * 0.18;
                    const sp = 80 + (k % 5) * 18;
                    return { a, sp, col: burstCols[k % burstCols.length], sz: 3 + (k % 3), t: 0 };
                  });
                }
              }
            }
            const afterFinal = (typeof e.finalJoinT === 'number') ? Math.max(0, t - e.finalJoinT) : 0;
            const finalFade = (typeof e.finalJoinT === 'number') ? Math.max(0, 1 - afterFinal / 0.52) : 1;
            if (finalFade <= 0.01) continue;
            ctx.save();
            ctx.translate(Math.round(part.px), Math.round(part.py));
            ctx.rotate(rot);
            ctx.globalAlpha = 0.96 * finalFade;
            ctx.fillStyle = part.col + '2a';
            ctx.strokeStyle = part.col;
            ctx.lineWidth = 2.6;
            ctx.fillRect(-quarter / 2, -quarter / 2, quarter, quarter);
            ctx.strokeRect(-quarter / 2, -quarter / 2, quarter, quarter);
            ctx.globalAlpha = 0.75;
            ctx.strokeStyle = '#f3f3f3'; ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(-quarter * 0.32, 0); ctx.lineTo(quarter * 0.32, 0);
            ctx.moveTo(0, -quarter * 0.32); ctx.lineTo(0, quarter * 0.32);
            ctx.stroke();
            ctx.restore();
          }
          if (Array.isArray(e.impacts)) {
            for (const imp of e.impacts) {
              imp.t += dtp;
              const q = Math.max(0, Math.min(1, imp.t / Math.max(0.01, imp.ttl)));
              ctx.save();
              ctx.globalAlpha = (1 - q) * (imp.pow >= 4 ? 0.95 : 0.62);
              ctx.strokeStyle = imp.col; ctx.lineWidth = imp.pow >= 4 ? 4 : 1.6 + imp.pow * 0.45;
              ctx.setLineDash(imp.pow >= 4 ? [] : [5, 4]);
              const s = mobSize * (0.85 + imp.pow * 0.28 + q * (imp.pow >= 4 ? 2.4 : 1.2));
              ctx.strokeRect(Math.round(imp.x - s / 2), Math.round(imp.y - s / 2), Math.round(s), Math.round(s));
              ctx.setLineDash([]);
              ctx.restore();
            }
            e.impacts = e.impacts.filter(imp => imp.t < imp.ttl);
          }
          if (Array.isArray(e.finalBits) && e.finalBits.length) {
            for (const bit of e.finalBits) {
              bit.t += dtp;
              const q = Math.max(0, Math.min(1, bit.t / 0.55));
              ctx.save();
              ctx.globalAlpha = 1 - q;
              ctx.fillStyle = bit.col;
              const d = bit.sp * q;
              const x = targetX + Math.cos(bit.a) * d;
              const y = targetY + Math.sin(bit.a) * d;
              ctx.fillRect(Math.round(x - bit.sz / 2), Math.round(y - bit.sz / 2), bit.sz, bit.sz);
              ctx.restore();
            }
            e.finalBits = e.finalBits.filter(bit => bit.t < 0.55);
          }
          ctx.restore();
        }
      } else if (e.kind === 'slotTick') {
        ctx.save();
        const p2 = Math.max(0, Math.min(1, e.t / (e.ttl || 0.22)));
        ctx.globalAlpha = 1 - p2;
        ctx.strokeStyle = e.color || '#ffd34d'; ctx.lineWidth = 2;
        const s = 48 + p2 * 26;
        ctx.strokeRect(Math.round(e.x - s / 2), Math.round(e.y - s / 2), Math.round(s), Math.round(s));
        ctx.restore();
      } else if (e.kind === 'slotScatter') {
        const syms = ['GLD','EXP','STC','WPN','ABL','BAD','JCK','RAR'];
        const cx = e.x2 || e.x, cy = e.y2 || e.y;
        if (!e.bits) {
          e.bits = Array.from({ length: e.heavy ? 44 : 30 }, (_, i) => {
            const a = i * 2.399 + e.x * 0.013;
            const m = 0.82 + ((i * 37) % 29) / 28;
            const vx = Math.cos(a) * (105 + (i % 9) * 18) * m;
            const vy = Math.sin(a) * (82 + (i % 6) * 17) * m - (55 + (i % 5) * 19);
            const far = 42 + (i % 9) * 19;
            return { a, vx, vy, far, rot: (i % 2 ? -1 : 1) * (2.2 + (i % 7) * 0.38), sym: syms[i % syms.length] };
          });
        }
        ctx.save();
        ctx.font = '700 9px var(--mono, monospace)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < e.bits.length; i++) {
          const bit = e.bits[i];
          let x, y, alpha;
          if (e.explode) {
            const tt = Math.min(1.22, p * 1.24);
            x = e.x + bit.vx * tt;
            y = e.y + bit.vy * tt + 185 * tt * tt;
            alpha = Math.max(0, 1 - p * 0.52);
          } else {
            const sx = e.x + Math.cos(bit.a) * bit.far + bit.vx * 0.44;
            const sy = e.y + Math.sin(bit.a) * bit.far + bit.vy * 0.26 + 48;
            const tx = cx + Math.cos(bit.a + 1.2) * (7 + (i % 5) * 3);
            const ty = cy + Math.sin(bit.a + 1.2) * (7 + (i % 5) * 3);
            const q = 1 - Math.pow(1 - p, 3.2);
            x = sx + (tx - sx) * q;
            y = sy + (ty - sy) * q - Math.sin(p * Math.PI) * 36;
            alpha = Math.max(0, 0.92 - p * 0.28);
          }
          ctx.save();
          ctx.translate(Math.round(x), Math.round(y));
          ctx.rotate(bit.rot * p);
          ctx.globalAlpha = alpha * (0.50 + (i % 4) * 0.11);
          ctx.fillStyle = i % 3 === 0 ? '#66f6ff' : (i % 3 === 1 ? '#ffd34d' : '#f3f3f3');
          if ((i % 5) === 0) {
            const sz = 8 + (i % 4) * 2;
            ctx.strokeStyle = ctx.fillStyle;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-sz/2, -sz/2, sz, sz);
          } else ctx.fillText(bit.sym, 0, 0);
          ctx.restore();
        }
        ctx.restore();
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
      } else if (e.kind === 'spawnWarning') {
        const p = e.t / (e.ttl || 1);
        const fade = Math.max(0, 1 - p * 0.65);
        const r = e.r || 64;
        ctx.save();
        ctx.globalAlpha = fade * (0.38 + 0.28 * Math.sin(e.t * 22));
        ctx.strokeStyle = e.color || '#8a8a8a'; ctx.lineWidth = 2; ctx.setLineDash([10, 6]);
        ctx.strokeRect(Math.round(e.x - r / 2), Math.round(e.y - r / 2), Math.round(r), Math.round(r));
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.16; ctx.fillStyle = e.color || '#8a8a8a';
        ctx.fillRect(Math.round(e.x - 4), Math.round(e.y - 4), 8, 8);
        ctx.restore();
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
      } else if (e.kind === 'movingZoneHit') {
        const fade = 1 - p;
        const w = Math.max(48, e.w || 120), h = Math.max(38, e.h || 70);
        const x = Math.round(e.x - w / 2), y = Math.round(e.y - h / 2);
        ctx.save();
        ctx.globalAlpha = fade * 0.72;
        ctx.strokeStyle = e.color || '#ff3048'; ctx.lineWidth = 3;
        ctx.setLineDash([12, 6, 2, 6]);
        ctx.strokeRect(x, y, Math.round(w), Math.round(h));
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.18;
        ctx.fillStyle = e.color || '#ff3048';
        const sweep = Math.round((p * 1.25 % 1) * w);
        ctx.fillRect(x + sweep - 7, y, 14, Math.round(h));
        ctx.globalAlpha = fade * 0.56;
        for (let i = 0; i < 5; i++) {
          const bx = x + 10 + ((i * 37 + Math.floor(p * 90)) % Math.max(12, w - 20));
          const by = y + 8 + ((i * 23) % Math.max(12, h - 16));
          ctx.fillRect(Math.round(bx - 3), Math.round(by - 3), 6, 6);
        }
        ctx.restore();
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
        const fade = 1 - p;
        const coreW = Math.max(1, e.w || 1.5);
        const glowW = Math.max(2.25, Math.min(4.5, (e.hitW || 8) * 0.30));
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.10;
        ctx.strokeStyle = e.color; ctx.lineWidth = glowW;
        ctx.beginPath(); ctx.moveTo(Math.round(e.x), Math.round(e.y)); ctx.lineTo(Math.round(e.x2), Math.round(e.y2)); ctx.stroke();
        ctx.globalAlpha = fade * 0.92;
        ctx.strokeStyle = '#f4f1ff'; ctx.lineWidth = coreW;
        ctx.beginPath(); ctx.moveTo(Math.round(e.x), Math.round(e.y)); ctx.lineTo(Math.round(e.x2), Math.round(e.y2)); ctx.stroke();
        ctx.globalAlpha = fade * 0.36;
        ctx.strokeStyle = e.color; ctx.lineWidth = 1;
        ctx.setLineDash([24, 18]);
        ctx.beginPath(); ctx.moveTo(Math.round(e.x), Math.round(e.y)); ctx.lineTo(Math.round(e.x2), Math.round(e.y2)); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.62;
        ctx.strokeStyle = e.color; ctx.lineWidth = 1;
        const ss = 7, es = 5;
        ctx.strokeRect(Math.round(e.x - ss / 2), Math.round(e.y - ss / 2), ss, ss);
        ctx.strokeRect(Math.round(e.x2 - es / 2), Math.round(e.y2 - es / 2), es, es);
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
      } else if (e.kind === 'voidDashRift') {
        const dx = e.x2 - e.x, dy = e.y2 - e.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const fade = 1 - p;
        const width = Math.max(18, e.w || 48);
        ctx.globalAlpha = fade * 0.18;
        ctx.strokeStyle = e.color; ctx.lineWidth = Math.max(3, width * 0.12);
        ctx.beginPath(); ctx.moveTo(Math.round(e.x), Math.round(e.y)); ctx.lineTo(Math.round(e.x2), Math.round(e.y2)); ctx.stroke();
        ctx.globalAlpha = fade * 0.88;
        ctx.strokeStyle = '#f4f1ff'; ctx.lineWidth = 2;
        ctx.setLineDash([16, 7]);
        ctx.beginPath(); ctx.moveTo(Math.round(e.x), Math.round(e.y)); ctx.lineTo(Math.round(e.x2), Math.round(e.y2)); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.46;
        ctx.strokeStyle = e.color; ctx.lineWidth = 1;
        for (const off of [-width * 0.34, width * 0.34]) {
          ctx.beginPath(); ctx.moveTo(Math.round(e.x + nx * off), Math.round(e.y + ny * off)); ctx.lineTo(Math.round(e.x2 + nx * off), Math.round(e.y2 + ny * off)); ctx.stroke();
        }
        ctx.globalAlpha = fade * 0.42; ctx.fillStyle = e.color;
        const b = 7;
        ctx.fillRect(Math.round(e.x - b / 2), Math.round(e.y - b / 2), b, b);
        ctx.fillRect(Math.round(e.x2 - b / 2), Math.round(e.y2 - b / 2), b, b);
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
        const fade = Math.max(0, Math.min(1, 1 - p * 0.35));
        const fill = Math.max(0, Math.min(1, e.pfill || 0));
        const pts = (Array.isArray(e.points) && e.points.length >= 2) ? e.points.map(q => ({ x: q[0], y: q[1] })) : [{ x: e.x, y: e.y }, { x: e.x2, y: e.y2 }];
        let total = 0;
        for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        const drawLen = total * fill;
        ctx.save();
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
        // Fixed floor drawing: no moving dash offset, no crawling reticle.
        ctx.globalAlpha = fade * 0.28;
        ctx.strokeStyle = '#26070b'; ctx.lineWidth = 7;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.globalAlpha = fade * 0.48;
        ctx.strokeStyle = '#6b1020'; ctx.lineWidth = 3;
        ctx.setLineDash([13, 6, 3, 6]);
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = fade * 0.88;
        ctx.strokeStyle = e.color || '#ff3048'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        let remain = drawLen;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          const seg = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          if (remain >= seg) { ctx.lineTo(b.x, b.y); remain -= seg; }
          else { const t = Math.max(0, remain / seg); ctx.lineTo(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); remain = 0; break; }
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = e.color || '#ff3048';
        let walked = 0;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i];
          const seg = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const offset = 18 + (((e.seed || 0) + i * 11) % 17);
          for (let d = offset; d < seg && walked + d <= drawLen; d += 38) {
            const t = d / seg, bx = a.x + (b.x - a.x) * t, by = a.y + (b.y - a.y) * t;
            ctx.globalAlpha = fade * 0.78;
            ctx.fillRect(Math.round(bx - 3), Math.round(by - 3), 6, 6);
            ctx.globalAlpha = fade * 0.28;
            ctx.strokeRect(Math.round(bx - 8), Math.round(by - 8), 16, 16);
          }
          walked += seg;
        }
        if (fill > 0.94) {
          const end = pts[pts.length - 1];
          ctx.globalAlpha = fade * 0.78;
          ctx.strokeStyle = e.color || '#ff3048';
          ctx.strokeRect(Math.round(end.x - 18), Math.round(end.y - 18), 36, 36);
          ctx.globalAlpha = fade * 0.20;
          ctx.fillRect(Math.round(end.x - 12), Math.round(end.y - 12), 24, 24);
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
    // level-up no longer flashes the whole screen; HUD HP/LVL blinks instead.
    if (this.levelPulse > 0) {
      const p = this.levelPulse;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p * 1.05);
      const cx = w / 2;
      const cy = h * 0.42;
      const bw = Math.min(300, w * 0.58);
      const bh = 42;
      const x = Math.round(cx - bw / 2);
      const y = Math.round(cy - bh / 2);
      ctx.fillStyle = `rgba(0, 12, 4, ${0.66 * p})`;
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = `rgba(0,255,102,${0.86 * p})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
      ctx.fillStyle = `rgba(0,255,102,${0.95 * p})`;
      ctx.font = `bold ${Math.round(16 + 2 * p)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.levelLabel || 'LEVEL UP', cx, cy - 3);
      ctx.font = `bold 9px 'Courier New', monospace`;
      ctx.fillText(localText('УЛУЧШЕНИЕ ГОТОВО', 'INSTALL READY'), cx, cy + 12);
      ctx.restore();
    }
    if ((this.rewindPulse || 0) > 0) {
      const p = this.rewindPulse;
      ctx.save();
      ctx.fillStyle = `rgba(180,92,255,${0.06 * p})`;
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h * 0.42;
      ctx.font = `bold ${Math.round(12 + 5 * p)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(243,243,243,${0.70 * p})`;
      ctx.fillText('REWIND', cx, cy - 56);
      ctx.restore();
    }
    if (this.killSwitchFlash > 0) {
      const p = this.killSwitchFlash;
      ctx.save();
      ctx.fillStyle = `rgba(255,48,72,${0.18 * p})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.80 * p;
      ctx.strokeStyle = '#ff3048';
      ctx.lineWidth = 2;
      const step = 42;
      for (let x = -step; x < w + step; x += step) ctx.strokeRect(Math.round(x + (1 - p) * 24), Math.round(h * 0.18), 18, Math.round(h * 0.64));
      ctx.font = `bold ${Math.round(18 + 10 * p)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(243,243,243,${0.95 * p})`;
      ctx.fillText('KILL SWITCH', w / 2, h * 0.38);
      ctx.font = `bold 11px 'Courier New', monospace`;
      ctx.fillText('FIELD CLEARED', w / 2, h * 0.38 + 26);
      ctx.restore();
    }
    if (this.nullRevivalFlash > 0) {
      const p = this.nullRevivalFlash;
      ctx.save();
      ctx.fillStyle = `rgba(180,92,255,${0.20 * p})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.85 * p;
      ctx.strokeStyle = '#b45cff';
      ctx.lineWidth = 2;
      const cx = w / 2, cy = h * 0.40;
      const r = 78 + (1 - p) * 90;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + (1 - p) * 0.45;
        ctx.strokeRect(Math.round(cx + Math.cos(a) * r - 20), Math.round(cy + Math.sin(a) * r - 20), 40, 40);
      }
      ctx.font = `bold ${Math.round(19 + 9 * p)}px 'Courier New', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = `rgba(243,243,243,${0.96 * p})`;
      ctx.fillText('NULL REVIVAL', cx, cy - 4);
      ctx.font = `bold 11px 'Courier New', monospace`;
      ctx.fillText(localText('СМЕРТЬ ОТМЕНЕНА · ВОЗВРАТ В ЦЕНТР', 'DEATH DENIED · CENTER REBOOT'), cx, cy + 25);
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
