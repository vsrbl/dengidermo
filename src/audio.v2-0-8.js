// nncckkrr procedural audio v2.0.8: restrained terminal-noise SFX, softer gun layer.
// No external assets. WebAudio unlocks on the first user gesture.

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
      shot: 0.09, shot_shg: 0.095, shot_sek: 0.14, rocket_launch: 0.16,
      rocket_blast: 0.18, blast: 0.12, dash: 0.08, pickup: 0.055,
      hit: 0.055, phit: 0.13, denied: 0.22, chest: 0.13,
      portal: 0.55, levelup: 0.45, install: 0.18,
      casino_open: 0.24, casino_spin: 0.20, casino_tick: 0.08,
      casino_win: 0.22, casino_loss: 0.22, casino_static: 0.28, jackpot: 0.45
    };
    this.prio = {
      phit: 10, rocket_blast: 9, portal: 9, levelup: 8, jackpot: 9,
      denied: 7, casino_static: 7, casino_win: 7, casino_loss: 7,
      dash: 6, chest: 6, install: 6, blast: 5, rocket_launch: 5,
      hit: 4, pickup: 3, shot: 2, shot_shg: 2, shot_sek: 2,
      casino_open: 5, casino_spin: 4, casino_tick: 3
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
      this.master.gain.value = 0.22;
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -20;
      this.comp.knee.value = 8;
      this.comp.ratio.value = 7;
      this.comp.attack.value = 0.003;
      this.comp.release.value = 0.09;
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

  envGain(vol, dur, attack = 0.002, hold = 0.004, delay = 0) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + attack);
    g.gain.setValueAtTime(Math.max(0.0001, vol), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.master);
    return g;
  }

  tone(freq, dur, type = 'square', vol = 0.08, bend = 1, delay = 0) {
    const o = this.ctx.createOscillator();
    const g = this.envGain(vol, dur, 0.002, 0.004, delay);
    const t = this.ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (bend !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + dur * 0.86);
    o.connect(g);
    this.active++;
    o.onended = () => { this.active = Math.max(0, this.active - 1); try { g.disconnect(); } catch {} };
    o.start(t); o.stop(t + dur + 0.015);
  }

  noise(dur, vol = 0.06, freq = 1200, q = 4, delay = 0, filter = 'bandpass') {
    const sr = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * dur));
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    let hold = 0;
    for (let i = 0; i < len; i++) {
      if (i % 14 === 0) hold = Math.random() * 2 - 1;
      const fall = 1 - i / len;
      data[i] = (hold * 0.55 + (Math.random() * 2 - 1) * 0.45) * fall;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = filter; f.frequency.value = freq; f.Q.value = q;
    const g = this.envGain(vol, dur, 0.0015, 0.002, delay);
    src.connect(f); f.connect(g);
    const t = this.ctx.currentTime + delay;
    this.active++;
    src.onended = () => { this.active = Math.max(0, this.active - 1); try { f.disconnect(); g.disconnect(); } catch {} };
    src.start(t); src.stop(t + dur + 0.01);
  }

  // a dry digital transient: better for guns than melodic beeps
  click(freq = 900, vol = 0.04, delay = 0) {
    this.noise(0.022, vol, freq, 12, delay, 'bandpass');
    this.tone(Math.max(35, freq * 0.18), 0.026, 'square', vol * 0.55, 0.7, delay);
  }

  play(type) {
    if (!this.can(type)) return;
    switch (type) {
      case 'shot':
      case 'shot_shg':
        // softened gun layer: dry muzzle tick + low body, less sharp high crack
        this.noise(0.026, 0.030, 720, 2.4, 0, 'bandpass');
        this.tone(92, 0.034, 'square', 0.026, 0.78, 0.002);
        break;
      case 'shot_sek':
        // seeker was too piercing; make it a quiet tracking chirp, not a laser beep
        this.noise(0.020, 0.016, 1350, 5.0, 0, 'bandpass');
        this.tone(180, 0.026, 'triangle', 0.014, 1.12, 0.004);
        break;
      case 'rocket_launch':
        this.tone(72, 0.13, 'sawtooth', 0.085, 1.24);
        this.noise(0.07, 0.052, 330, 1.4, 0.004, 'lowpass');
        break;
      case 'rocket_blast':
        this.tone(46, 0.18, 'square', 0.145, 0.42);
        this.noise(0.14, 0.105, 170, 0.8, 0, 'lowpass');
        this.noise(0.040, 0.040, 2100, 5, 0.018, 'bandpass');
        break;
      case 'blast':
        this.tone(70, 0.105, 'square', 0.070, 0.55);
        this.noise(0.07, 0.055, 390, 1.2, 0, 'lowpass');
        break;
      case 'dash':
        this.noise(0.052, 0.055, 3600, 12, 0, 'bandpass');
        this.tone(210, 0.06, 'square', 0.045, 2.0);
        this.click(2600, 0.035, 0.018);
        break;
      case 'pickup':
        this.click(1900, 0.03);
        this.tone(430, 0.035, 'square', 0.026, 1.18, 0.018);
        break;
      case 'hit':
        this.noise(0.032, 0.045, 1600, 5);
        this.tone(180, 0.032, 'square', 0.03, 0.82);
        break;
      case 'phit':
        this.tone(68, 0.18, 'sawtooth', 0.13, 0.52);
        this.noise(0.12, 0.085, 760, 2.2);
        this.click(420, 0.04, 0.025);
        break;
      case 'denied':
        this.tone(145, 0.08, 'square', 0.072, 0.7);
        this.tone(96, 0.10, 'square', 0.06, 0.7, 0.045);
        this.noise(0.08, 0.052, 1300, 4);
        break;
      case 'chest':
        this.click(900, 0.045);
        this.tone(240, 0.07, 'square', 0.05, 1.42, 0.025);
        this.noise(0.05, 0.035, 2300, 6, 0.04);
        break;
      case 'portal':
        // heavier “signal lock” instead of toy fanfare
        this.tone(55, 0.34, 'sawtooth', 0.115, 2.2);
        this.tone(165, 0.24, 'square', 0.052, 1.55, 0.075);
        this.noise(0.18, 0.055, 2500, 5, 0.045);
        this.click(1400, 0.035, 0.22);
        break;
      case 'levelup':
        this.tone(95, 0.22, 'square', 0.085, 1.75);
        this.tone(285, 0.13, 'square', 0.052, 1.4, 0.065);
        this.noise(0.11, 0.05, 3200, 9, 0.03);
        this.click(2100, 0.045, 0.14);
        break;
      case 'install':
        this.click(1200, 0.04);
        this.tone(260, 0.055, 'square', 0.045, 1.35, 0.025);
        break;
      case 'casino_open':
        this.tone(120, 0.08, 'square', 0.045, 0.82);
        this.noise(0.05, 0.035, 900, 5, 0.02);
        break;
      case 'casino_spin':
        this.noise(0.09, 0.045, 2100, 9, 0, 'bandpass');
        this.tone(150, 0.055, 'square', 0.035, 1.2, 0.012);
        break;
      case 'casino_tick':
        this.click(1550, 0.026);
        break;
      case 'casino_win':
        this.tone(180, 0.09, 'square', 0.055, 1.55);
        this.click(2200, 0.035, 0.055);
        this.noise(0.06, 0.032, 3100, 9, 0.04);
        break;
      case 'casino_loss':
        this.tone(130, 0.09, 'square', 0.055, 0.62);
        this.noise(0.07, 0.045, 760, 3, 0.02);
        break;
      case 'casino_static':
        this.tone(105, 0.15, 'square', 0.065, 0.68);
        this.noise(0.13, 0.075, 1500, 3.2, 0.015);
        break;
      case 'jackpot':
        this.tone(70, 0.24, 'square', 0.11, 2.4);
        this.tone(210, 0.16, 'square', 0.07, 1.7, 0.06);
        this.noise(0.16, 0.065, 3600, 8, 0.04);
        this.click(2600, 0.05, 0.15);
        break;
    }
  }

  handleFx(f, info = {}) {
    const mine = f.id === info.myId;
    switch (f.t) {
      case 'shot': {
        const remote = f.id && info.myId && f.id !== info.myId;
        if (remote && f.w !== 'RKT') break; // remote bullet spam is visual, not loud
        if (f.w === 'RKT') this.play('rocket_launch');
        else if (f.w === 'SEK') this.play('shot_sek');
        else this.play('shot_shg');
        break;
      }
      case 'blast': this.play(f.style === 'rocket' ? 'rocket_blast' : 'blast'); break;
      case 'dash': if (mine) this.play('dash'); break;
      case 'pick': this.play('pickup'); break;
      case 'ehit': this.play('hit'); break;
      case 'phit': if (mine) this.play('phit'); break;
      case 'denied': if (mine) this.play('denied'); break;
      case 'chest_open': if (mine) this.play('chest'); break;
      case 'levelup': if (mine) this.play('levelup'); break;
      case 'portal_open': this.play('portal'); break;
      case 'install': if (mine) this.play('install'); break;
      // casino is handled by Hud too, so direct guest result and host snapshot behave the same without double audio.
      case 'boss_down': this.play('jackpot'); break;
      case 'run_lost': this.play('phit'); break;
    }
  }
}
