// nncckkrr procedural audio: tiny terminal SFX with priority/cooldown limits
// No external assets. WebAudio is unlocked by the first user gesture.

const AC = () => globalThis.AudioContext || globalThis.webkitAudioContext;

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.comp = null;
    this.enabled = true;
    this.active = 0;
    this.maxVoices = 16;
    this.last = new Map();
    this.cooldowns = {
      shot: 0.035, rocket_launch: 0.10, rocket_blast: 0.16, blast: 0.11,
      dash: 0.07, pickup: 0.05, hit: 0.05, phit: 0.12,
      denied: 0.22, chest: 0.12, portal: 0.35, install: 0.18, jackpot: 0.4, active: 0.24, enemy: 0.18
    };
    this.prio = {
      phit: 10, rocket_blast: 9, portal: 8, jackpot: 8, denied: 7,
      dash: 6, chest: 6, active: 7, enemy: 4, blast: 5, rocket_launch: 5, hit: 4, pickup: 3, shot: 2, install: 5
    };
    this._unlock = () => this.unlock();
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this._unlock, { passive: true });
      window.addEventListener('keydown', this._unlock, { passive: true });
    }
  }

  unlock() {
    if (!this.enabled) return;
    const Ctx = AC();
    if (!Ctx) return;
    if (!this.ctx) {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.36;
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18;
      this.comp.knee.value = 14;
      this.comp.ratio.value = 5;
      this.comp.attack.value = 0.004;
      this.comp.release.value = 0.08;
      this.master.connect(this.comp);
      this.comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  can(type) {
    if (!this.enabled) return false;
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return false;
    const now = this.ctx.currentTime;
    const cd = this.cooldowns[type] ?? 0.08;
    if (now - (this.last.get(type) || -99) < cd) return false;
    if (this.active >= this.maxVoices && (this.prio[type] || 0) < 7) return false;
    this.last.set(type, now);
    return true;
  }

  envGain(vol, dur, attack = 0.004, hold = 0.01) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + attack);
    g.gain.setValueAtTime(Math.max(0.0001, vol), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.master);
    return g;
  }

  tone(freq, dur, type = 'square', vol = 0.12, bend = 1, delay = 0) {
    const o = this.ctx.createOscillator();
    const g = this.envGain(vol, dur, 0.003, 0.006);
    const t = this.ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (bend !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + dur * 0.85);
    o.connect(g);
    this.active++;
    o.onended = () => { this.active = Math.max(0, this.active - 1); try { g.disconnect(); } catch {} };
    o.start(t); o.stop(t + dur + 0.015);
  }

  noise(dur, vol = 0.08, freq = 1200, q = 5, delay = 0) {
    const sr = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * dur));
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    const g = this.envGain(vol, dur, 0.002, 0.002);
    src.connect(bp); bp.connect(g);
    const t = this.ctx.currentTime + delay;
    this.active++;
    src.onended = () => { this.active = Math.max(0, this.active - 1); try { bp.disconnect(); g.disconnect(); } catch {} };
    src.start(t); src.stop(t + dur + 0.01);
  }

  play(type) {
    if (!this.can(type)) return;
    switch (type) {
      case 'shot':
        this.tone(520, 0.045, 'square', 0.055, 0.72);
        this.noise(0.035, 0.035, 2600, 8);
        break;
      case 'rocket_launch':
        this.tone(120, 0.13, 'sawtooth', 0.105, 1.55);
        this.noise(0.08, 0.06, 420, 2.5);
        this.tone(900, 0.045, 'square', 0.035, 0.55, 0.015);
        break;
      case 'rocket_blast':
        this.tone(72, 0.16, 'square', 0.17, 0.45);
        this.noise(0.13, 0.12, 220, 1.4);
        this.noise(0.09, 0.07, 3100, 7);
        this.tone(180, 0.06, 'sawtooth', 0.07, 0.5, 0.025);
        break;
      case 'blast':
        this.tone(110, 0.11, 'square', 0.11, 0.55);
        this.noise(0.08, 0.07, 520, 2);
        break;
      case 'dash':
        this.tone(360, 0.055, 'square', 0.07, 2.1);
        this.tone(980, 0.035, 'square', 0.05, 0.62, 0.018);
        this.noise(0.045, 0.035, 4200, 10);
        break;
      case 'pickup':
        this.tone(760, 0.035, 'square', 0.045, 1.25);
        this.tone(1140, 0.04, 'square', 0.03, 1.0, 0.025);
        break;
      case 'hit':
        this.noise(0.035, 0.045, 1800, 5);
        this.tone(260, 0.035, 'square', 0.035, 0.8);
        break;
      case 'phit':
        this.tone(92, 0.16, 'sawtooth', 0.13, 0.55);
        this.noise(0.1, 0.085, 900, 2.5);
        break;
      case 'denied':
        this.tone(170, 0.09, 'square', 0.075, 0.7);
        this.tone(130, 0.09, 'square', 0.06, 0.7, 0.045);
        this.noise(0.075, 0.055, 1600, 4);
        break;
      case 'chest':
        this.tone(280, 0.05, 'square', 0.055, 1.6);
        this.tone(620, 0.08, 'square', 0.05, 1.15, 0.045);
        break;
      case 'portal':
        this.tone(110, 0.22, 'sawtooth', 0.08, 2.4);
        this.tone(330, 0.22, 'square', 0.05, 1.6, 0.05);
        this.noise(0.16, 0.045, 2600, 5);
        break;
      case 'install':
        this.tone(430, 0.055, 'square', 0.05, 1.5);
        this.tone(860, 0.06, 'square', 0.04, 1.15, 0.045);
        break;
      case 'active':
        this.tone(250, 0.08, 'square', 0.07, 1.9);
        this.tone(720, 0.05, 'square', 0.04, 0.7, 0.035);
        this.noise(0.07, 0.04, 3600, 8);
        break;
      case 'enemy':
        this.tone(210, 0.055, 'square', 0.035, 0.72);
        this.noise(0.05, 0.025, 1300, 4);
        break;
      case 'jackpot':
        this.tone(180, 0.18, 'square', 0.09, 2.0);
        this.tone(540, 0.12, 'square', 0.06, 1.6, 0.06);
        this.tone(1080, 0.1, 'square', 0.045, 1.2, 0.11);
        break;
    }
  }

  handleFx(f, info = {}) {
    const mine = f.id === info.myId;
    switch (f.t) {
      case 'shot': this.play(f.w === 'RKT' ? 'rocket_launch' : 'shot'); break;
      case 'blast': this.play(f.style === 'rocket' ? 'rocket_blast' : 'blast'); break;
      case 'dash': if (mine) this.play('dash'); break;
      case 'pick': this.play('pickup'); break;
      case 'ehit': this.play('hit'); break;
      case 'phit': if (mine) this.play('phit'); break;
      case 'denied': if (mine) this.play('denied'); break;
      case 'chest_open': if (mine) this.play('chest'); break;
      case 'portal_open': this.play('portal'); break;
      case 'install': if (mine) this.play('install'); break;
      case 'casino': if (mine) this.play(f.outcome === 'JCK' ? 'jackpot' : (f.outcome === 'LOSE' || f.outcome === 'STC' ? 'denied' : 'pickup')); break;
      case 'active': if (mine) this.play('active'); break;
      case 'contract_done': this.play('jackpot'); break;
      case 'contract_fail': this.play('denied'); break;
      case 'split': case 'summon': case 'pulse_wave': case 'prism': this.play('enemy'); break;
      case 'boss_down': this.play('jackpot'); break;
      case 'run_lost': this.play('phit'); break;
    }
  }
}
