// nncckkrr procedural audio: tiny terminal SFX with priority/cooldown limits
// No external assets. WebAudio is unlocked by the first user gesture.

const AC = () => globalThis.AudioContext || globalThis.webkitAudioContext;

function inGameMusicAmount(room, menu = false) { return menu ? 0.82 : (room ? 1 : 0); }

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.comp = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.musicVolume = this.readVolume('nnc_music_volume', 0.72);
    this.sfxVolume = this.readVolume('nnc_sfx_volume', 0.85);
    this.damageEnergy = 0;
    this.enabled = true;
    this.active = 0;
    this.maxVoices = 16;
    this.last = new Map();
    this.cooldowns = {
      shot_shg: 0.028, shot_sek: 0.12, shot: 0.04, impact: 0.028,
      rocket_launch: 0.10, rocket_blast: 0.16, blast: 0.11,
      dash: 0.07, dash_jackpot: 0.16, dash_dead_channel: 0.16, skin_legendary: 0.55, gld: 0.055, exp: 0.055, hea: 0.09, pickup: 0.05,
      hit: 0.05, phit: 0.12, denied: 0.22, chest_basic: 0.12, chest_weapon: 0.16,
      chest_ability: 0.16, chest_rare: 0.18, chest_cursed: 0.2,
      portal: 0.35, install: 0.18, jackpot: 0.4, active_snap: 0.24, active_blood: 0.24,
      active_over: 0.24, active_void_laser: 0.08, active: 0.24, enemy: 0.18, bet_open: 0.18, casino_win: 0.24,
      casino_lose: 0.28, casino_static: 0.28, casino_weapon: 0.3, casino_ability: 0.3,
      casino_spin: 0.09, casino_reel_stop: 0.06, casino_result: 0.16,
      contract: 0.35, debt: 0.28, shield: 0.12, echo_shot: 0.10, director_wave: 0.72, ui_click: 0.045
    };
    this.music = null;
    this.musicPulseT = 0;
    this.musicStepT = 0;
    this.prio = {
      phit: 10, rocket_blast: 9, portal: 8, jackpot: 8, denied: 7,
      casino_static: 8, casino_lose: 7, casino_weapon: 7, casino_ability: 7, casino_win: 6, casino_result: 6, casino_spin: 3, casino_reel_stop: 4,
      dash: 6, dash_jackpot: 8, dash_dead_channel: 8, skin_legendary: 9, chest_weapon: 6, chest_ability: 6, chest_rare: 7, chest_cursed: 7,
      active_snap: 7, active_blood: 7, active_over: 7, active_void_laser: 7, active: 7, enemy: 4,
      blast: 5, rocket_launch: 5, hit: 4, gld: 3, exp: 3, hea: 5, pickup: 3,
      shot_shg: 3, shot_sek: 3, shot: 2, impact: 2, install: 5, contract: 7, debt: 7, shield: 4, echo_shot: 5, director_wave: 6, ui_click: 3
    };
    this._unlock = () => this.unlock();
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this._unlock, { passive: true });
      window.addEventListener('keydown', this._unlock, { passive: true });
    }
  }

  readVolume(key, fallback) {
    if (typeof localStorage === 'undefined') return fallback;
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
  }

  writeVolume(key, value) {
    const v = Math.max(0, Math.min(1, Number(value)));
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, String(v));
    return v;
  }

  getVolumes() { return { music: this.musicVolume, sfx: this.sfxVolume }; }

  setMusicVolume(value) {
    this.musicVolume = this.writeVolume('nnc_music_volume', value);
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(0.82 * this.musicVolume, this.ctx.currentTime, 0.05);
  }

  setSfxVolume(value) {
    this.sfxVolume = this.writeVolume('nnc_sfx_volume', value);
    if (this.sfxGain && this.ctx) this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.05);
  }

  unlock() {
    if (!this.enabled) return;
    const Ctx = AC();
    if (!Ctx) return;
    if (!this.ctx) {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.36;
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.musicGain.gain.value = 0.82 * this.musicVolume;
      this.comp = this.ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18;
      this.comp.knee.value = 14;
      this.comp.ratio.value = 5;
      this.comp.attack.value = 0.004;
      this.comp.release.value = 0.08;
      this.sfxGain.connect(this.master);
      this.musicGain.connect(this.master);
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
    g.connect(this.sfxGain || this.master);
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
      case 'shot_shg':
        // dry chunky terminal buckshot: low punch + bright click, short enough for 4-charge bursts
        this.tone(145, 0.048, 'square', 0.062, 0.56);
        this.tone(305, 0.028, 'square', 0.035, 0.42, 0.006);
        this.noise(0.04, 0.045, 1450, 4.2);
        this.noise(0.018, 0.022, 3600, 10, 0.006);
        break;
      case 'shot_sek':
        // v2.0.97: SEEKER is 50% quieter and pitched higher; still dry/terminal, no bubble chirp.
        this.tone(470, 0.038, 'square', 0.026, 0.62);
        this.tone(1120, 0.024, 'square', 0.017, 0.50, 0.005);
        this.noise(0.026, 0.019, 4300, 6.2);
        this.noise(0.010, 0.0085, 8200, 15, 0.006);
        break;
      case 'shot':
        this.tone(520, 0.045, 'square', 0.055, 0.72);
        this.noise(0.035, 0.035, 2600, 8);
        break;
      case 'rocket_launch':
        this.tone(72, 0.18, 'sawtooth', 0.13, 1.25);
        this.noise(0.10, 0.065, 320, 1.8);
        this.tone(520, 0.05, 'square', 0.028, 0.46, 0.02);
        break;
      case 'rocket_blast':
        this.tone(62, 0.17, 'square', 0.16, 0.42);
        this.noise(0.13, 0.115, 180, 1.2);
        this.noise(0.075, 0.065, 3200, 8);
        this.tone(160, 0.055, 'sawtooth', 0.065, 0.5, 0.025);
        break;
      case 'blast':
        this.tone(118, 0.095, 'square', 0.095, 0.58);
        this.noise(0.065, 0.055, 620, 2.5);
        break;
      case 'impact':
        this.noise(0.018, 0.018, 2200, 8);
        this.tone(360, 0.018, 'square', 0.018, 0.3);
        break;
      case 'dash':
        this.tone(390, 0.045, 'square', 0.065, 2.25);
        this.tone(1050, 0.032, 'square', 0.045, 0.58, 0.015);
        this.noise(0.035, 0.032, 4600, 12);
        break;
      case 'dash_jackpot':
        // legendary JACKPOT WOUND dash: layered transient/body/tail — slot latch, coin bite, red wound cut.
        this.noise(0.010, 0.030, 7200, 18, 0.000);          // hard digital transient
        this.tone(132, 0.070, 'square', 0.060, 0.64, 0.000); // body thump
        this.tone(264, 0.045, 'square', 0.046, 1.60, 0.012);
        this.tone(528, 0.038, 'square', 0.036, 1.34, 0.042);
        this.tone(792, 0.034, 'square', 0.030, 1.18, 0.072);
        this.tone(1188, 0.026, 'square', 0.022, 0.72, 0.108);
        this.noise(0.055, 0.030, 2800, 7, 0.024);           // coin scrape
        this.noise(0.085, 0.020, 5200, 12, 0.085);          // short glitter tail
        break;
      case 'dash_dead_channel':
        // legendary DEAD CHANNEL dash: layered transient/body/tail — TV sync tear, dropout, scanline buzz.
        this.noise(0.012, 0.036, 6400, 16, 0.000);          // snap transient
        this.tone(72, 0.085, 'square', 0.058, 0.42, 0.000); // sync-loss drop
        this.tone(1510, 0.024, 'square', 0.030, 0.52, 0.010);
        this.tone(2190, 0.020, 'square', 0.022, 0.68, 0.038);
        this.tone(980, 0.028, 'square', 0.024, 0.36, 0.066);
        this.noise(0.070, 0.034, 5100, 14, 0.018);          // bright static band
        this.noise(0.105, 0.018, 900, 2.5, 0.070);          // dead-air tail
        break;
      case 'gld':
        this.tone(520, 0.035, 'square', 0.035, 1.18);
        this.tone(650, 0.03, 'square', 0.026, 1.05, 0.018);
        break;
      case 'exp':
        this.tone(880, 0.04, 'triangle', 0.035, 1.32);
        this.tone(1320, 0.035, 'square', 0.024, 0.96, 0.026);
        break;
      case 'hea':
        this.tone(420, 0.055, 'sine', 0.052, 1.25);
        this.tone(840, 0.075, 'triangle', 0.035, 1.05, 0.038);
        break;
      case 'pickup':
        this.tone(760, 0.035, 'square', 0.045, 1.25);
        break;
      case 'hit':
        this.noise(0.032, 0.04, 1700, 5);
        this.tone(245, 0.03, 'square', 0.027, 0.78);
        break;
      case 'phit':
        this.tone(86, 0.17, 'sawtooth', 0.13, 0.52);
        this.noise(0.09, 0.08, 760, 2.2);
        break;
      case 'denied':
        this.tone(170, 0.085, 'square', 0.075, 0.68);
        this.tone(125, 0.085, 'square', 0.058, 0.68, 0.045);
        this.noise(0.06, 0.045, 1550, 4);
        break;
      case 'chest_basic':
        this.tone(300, 0.045, 'square', 0.045, 1.45);
        this.tone(580, 0.055, 'square', 0.035, 1.05, 0.035);
        break;
      case 'chest_weapon':
        this.tone(180, 0.055, 'square', 0.055, 1.25);
        this.tone(520, 0.075, 'sawtooth', 0.045, 1.5, 0.045);
        this.noise(0.04, 0.035, 2300, 6);
        break;
      case 'chest_ability':
        this.tone(350, 0.055, 'square', 0.05, 2.0);
        this.tone(980, 0.055, 'square', 0.035, 0.8, 0.04);
        break;
      case 'chest_rare':
        this.tone(260, 0.06, 'square', 0.055, 1.7);
        this.tone(720, 0.07, 'square', 0.045, 1.25, 0.05);
        this.tone(1180, 0.055, 'triangle', 0.03, 1.0, 0.095);
        break;
      case 'chest_cursed':
        this.tone(155, 0.12, 'sawtooth', 0.07, 0.55);
        this.tone(460, 0.08, 'square', 0.038, 0.72, 0.045);
        this.noise(0.08, 0.045, 900, 2.2);
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
      case 'bet_open':
        this.tone(190, 0.08, 'square', 0.05, 0.9);
        this.tone(380, 0.06, 'square', 0.03, 1.1, 0.04);
        break;
      case 'casino_spin':
        this.tone(260, 0.032, 'square', 0.028, 0.55);
        this.noise(0.022, 0.018, 1800, 7);
        break;
      case 'casino_reel_stop':
        this.tone(720, 0.025, 'square', 0.025, 0.5);
        this.noise(0.012, 0.012, 3200, 10);
        break;
      case 'casino_result':
        this.tone(360, 0.04, 'square', 0.038, 1.25);
        this.tone(720, 0.035, 'triangle', 0.025, 0.9, 0.032);
        break;
      case 'casino_win':
        this.tone(480, 0.05, 'square', 0.05, 1.55);
        this.tone(960, 0.06, 'triangle', 0.038, 1.2, 0.05);
        break;
      case 'casino_weapon':
        this.tone(140, 0.07, 'square', 0.06, 1.35);
        this.tone(620, 0.08, 'sawtooth', 0.044, 1.55, 0.04);
        break;
      case 'casino_ability':
        this.tone(330, 0.065, 'square', 0.055, 2.1);
        this.tone(1000, 0.055, 'square', 0.04, 0.72, 0.04);
        break;
      case 'casino_static':
        this.tone(150, 0.13, 'sawtooth', 0.075, 0.5);
        this.noise(0.11, 0.06, 1250, 3.5);
        break;
      case 'casino_lose':
        this.tone(220, 0.09, 'square', 0.055, 0.72);
        this.tone(110, 0.11, 'square', 0.045, 0.62, 0.05);
        break;
      case 'active_snap':
        this.tone(250, 0.08, 'square', 0.07, 1.9);
        this.noise(0.065, 0.04, 3600, 8);
        break;
      case 'active_blood':
        this.tone(92, 0.1, 'sawtooth', 0.08, 0.72);
        this.noise(0.075, 0.055, 640, 2.5);
        break;
      case 'active_over':
        this.tone(520, 0.07, 'square', 0.06, 2.35);
        this.tone(1040, 0.045, 'square', 0.04, 1.2, 0.045);
        break;
      case 'active_void_laser':
        // minimal void laser: dry terminal ignition + thin high line + short dirty tail.
        this.tone(1180, 0.075, 'square', 0.040, 0.72);
        this.tone(2360, 0.045, 'square', 0.024, 0.58, 0.010);
        this.noise(0.055, 0.020, 6200, 14, 0.004);
        this.tone(170, 0.055, 'square', 0.020, 0.55, 0.018);
        break;
      case 'active':
        this.tone(250, 0.08, 'square', 0.07, 1.9);
        this.tone(720, 0.05, 'square', 0.04, 0.7, 0.035);
        break;
      case 'enemy':
        this.tone(210, 0.055, 'square', 0.035, 0.72);
        this.noise(0.05, 0.025, 1300, 4);
        break;
      case 'director_wave':
        // Single wave-arrival sting: kept rare via cooldown so it marks a spawn pack, not every enemy.
        this.tone(92, 0.16, 'sawtooth', 0.072, 0.62);
        this.tone(184, 0.10, 'square', 0.040, 0.72, 0.035);
        this.noise(0.075, 0.030, 950, 3.2, 0.006);
        break;
      case 'contract':
        this.tone(130, 0.14, 'square', 0.07, 1.2);
        this.tone(390, 0.06, 'square', 0.045, 0.85, 0.08);
        break;
      case 'debt':
        this.tone(105, 0.14, 'sawtooth', 0.07, 0.55);
        this.noise(0.1, 0.04, 700, 2);
        break;
      case 'shield':
        this.tone(820, 0.045, 'square', 0.032, 0.45);
        break;
      case 'skin_legendary':
        this.tone(210, 0.16, 'square', 0.070, 2.25);
        this.tone(630, 0.12, 'square', 0.055, 1.45, 0.055);
        this.tone(1260, 0.10, 'square', 0.042, 0.92, 0.110);
        this.noise(0.08, 0.040, 4400, 11, 0.020);
        break;
      case 'echo_shot':
        this.tone(310, 0.045, 'square', 0.040, 1.55);
        this.tone(930, 0.035, 'square', 0.022, 0.62, 0.010);
        this.noise(0.026, 0.024, 3600, 9, 0.004);
        break;
      case 'ui_click':
        this.tone(520, 0.025, 'square', 0.020, 0.70);
        this.noise(0.012, 0.010, 4200, 10, 0.002);
        break;
      case 'jackpot':
        this.tone(180, 0.18, 'square', 0.09, 2.0);
        this.tone(540, 0.12, 'square', 0.06, 1.6, 0.06);
        this.tone(1080, 0.1, 'square', 0.045, 1.2, 0.11);
        break;
    }
  }

  makeToneLayer(freq, type = 'sawtooth', filterFreq = 700) {
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = filterFreq; f.Q.value = 0.8;
    g.gain.value = 0.0001;
    o.connect(f); f.connect(g); g.connect(this.music.master);
    o.start();
    return { o, f, g, target: 0 };
  }

  makeNoiseLayer(filterFreq = 3400, q = 8) {
    const sr = this.ctx.sampleRate;
    const len = sr * 2;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.65;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = filterFreq; bp.Q.value = q;
    const g = this.ctx.createGain(); g.gain.value = 0.0001;
    src.connect(bp); bp.connect(g); g.connect(this.music.master);
    src.start();
    return { o: src, f: bp, g, target: 0 };
  }

  musicNote(freq, dur, type = 'sawtooth', vol = 0.02, filterFreq = 520, delay = 0, bend = 1, detune = 0) {
    if (!this.music?.master || !this.ctx) return;
    const t = this.ctx.currentTime + Math.max(0, delay);
    const o = this.ctx.createOscillator();
    const f = this.ctx.createBiquadFilter();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (bend !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + dur * 0.86);
    if (typeof o.detune?.setValueAtTime === 'function') o.detune.setValueAtTime(detune, t);
    f.type = 'lowpass';
    f.frequency.setValueAtTime(Math.max(90, filterFreq), t);
    f.Q.value = 1.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + Math.min(0.09, dur * 0.24));
    g.gain.setTargetAtTime(Math.max(0.0001, vol * 0.62), t + dur * 0.28, dur * 0.22);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(this.music.master);
    o.onended = () => { try { o.disconnect(); f.disconnect(); g.disconnect(); } catch {} };
    o.start(t);
    o.stop(t + dur + 0.04);
  }

  musicDust(dur = 0.08, vol = 0.01, filterFreq = 2400, delay = 0) {
    if (!this.music?.master || !this.ctx) return;
    const sr = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(sr * dur));
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const decay = 1 - i / len;
      data[i] = (Math.random() * 2 - 1) * decay * decay;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = filterFreq; bp.Q.value = 9;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime + Math.max(0, delay);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(this.music.master);
    src.onended = () => { try { src.disconnect(); bp.disconnect(); g.disconnect(); } catch {} };
    src.start(t); src.stop(t + dur + 0.02);
  }

  musicRootFor(context = {}) {
    // v2.0.97: keep every music layer locked to the same bass center.
    // Variety changes rhythm, register, filter and motif, not the tonal root.
    return 49.00;
  }

  playDirgePhrase(context = {}) {
    if (!this.music?.master || !this.ctx) return;
    const boss = !!context.boss;
    const chill = !!context.chill;
    const casino = !!context.casino;
    const staticLike = !!context.staticLike;
    const menu = !!context.menu;
    const intensity = Math.max(0, Math.min(1, context.intensity || 0));
    const damage = Math.max(0, Math.min(1, context.damage || 0));
    const crowd = Math.max(0, Math.min(1, context.crowd || 0));
    const root = this.musicRootFor(context);
    const semitone = n => root * Math.pow(2, n / 12);

    // Compatible-loop idea: every layer is derived from the same root as the bass.
    // The variety comes from register, rhythm gaps, filter movement and small motif swaps,
    // not from unrelated pitch centers that clash with the drone.
    const scale = staticLike ? [0, -1, -5, -6, -8, -12, -13] : casino ? [0, -1, -5, -7, -8, -12, -13] : [0, -1, -5, -7, -8, -12, -13];
    const motifs = [
      [0, 1, 3, 5, 6],
      [0, 2, 4, 6, 5],
      [1, 3, 2, 5, 6, 4],
      [0, 4, 3, 6, 5],
      [2, 1, 5, 4, 6],
      [0, 3, 5, 6, 4, 6]
    ];
    const idx = (this.music.motifIndex + (boss ? 2 : 0) + (staticLike ? 1 : 0) + (casino ? 3 : 0) + Math.floor(crowd * 4) + Math.floor(damage * 3)) % motifs.length;
    const motif = motifs[idx].map(i => scale[i % scale.length]);
    this.music.motifIndex = (this.music.motifIndex + 1) % 4096;
    const step = menu ? 1.12 : boss ? 0.76 : chill ? 1.22 : Math.max(0.68, 1.02 - intensity * 0.18);
    const leadVol = menu ? 0.009 : chill ? 0.008 : 0.013 + intensity * 0.014 + damage * 0.008;
    const bodyVol = menu ? 0.005 : chill ? 0.006 : 0.0055 + intensity * 0.006;
    const filter = staticLike ? 300 : casino ? 390 : 340;

    // Background bass stays mostly behind the drone. It only comes forward under real pressure.
    this.musicNote(root * 0.5, step * (boss ? 5.0 : 4.4), 'sawtooth', bodyVol * 0.28, 145 + intensity * 40, 0, 0.998, -7);
    if (intensity > 0.82 || boss || damage > 0.72) this.musicNote(root * 0.25, step * 2.6, 'sine', 0.0025 + intensity * 0.0045, 82, step * 0.5, 1, 0);

    motif.forEach((m, i) => {
      // Intentionally leave holes: terminal-dirge, not a busy tune.
      if (!boss && !menu && intensity < 0.45 && i === 2 && (this.music.motifIndex % 2)) return;
      const delay = i * step * (i % 2 ? 1.06 : 0.96);
      const dur = step * (i === motif.length - 1 ? 2.5 : 1.05 + (i % 3) * 0.22);
      const register = menu || chill ? 12 : (intensity > 0.72 ? 19 : 12);
      const f = semitone(m + register);
      const detune = (i % 2 ? -5 : 4) + (staticLike ? -3 : 0) + (casino ? 3 : 0);
      this.musicNote(f, dur, i % 4 === 0 ? 'triangle' : 'sawtooth', leadVol * (i === 0 ? 0.82 : 1), filter + i * 42 + intensity * 90, delay, 0.999, detune);
      if ((staticLike || damage > 0.55) && i % 2 === 1) this.musicDust(0.05, 0.004 + intensity * 0.006, 4300 + i * 250, delay + 0.02);
      if (casino && i === motif.length - 2) this.musicNote(f * 2, 0.08, 'square', 0.0035 + intensity * 0.003, 1300, delay + 0.03, 1, -7);
    });

    if (crowd > 0.58 || boss) {
      const m = scale[(this.music.motifIndex + 2) % scale.length];
      this.musicNote(semitone(m + 12), step * 2.4, 'triangle', 0.010 + intensity * 0.010, 300, step * 1.4, 1, -7);
    }
  }

  ensureMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    if (this.music) return true;
    const master = this.ctx.createGain();
    master.gain.value = 0.16;
    master.connect(this.musicGain || this.master);
    this.music = { master, layers: {}, phraseT: 0.5, motifIndex: 0, lastRoomTone: '', dangerPhrase: 0 };
    this.music.layers.drone = this.makeToneLayer(49, 'sawtooth', 360);
    this.music.layers.sub = this.makeToneLayer(24.5, 'sine', 150);
    this.music.layers.pulse = this.makeToneLayer(49, 'square', 230);
    this.music.layers.hat = this.makeNoiseLayer(5200, 10);
    this.music.layers.casino = this.makeToneLayer(330, 'square', 900);
    this.music.layers.choir = this.makeToneLayer(147, 'sawtooth', 520);
    this.music.layers.dirgePad = this.makeToneLayer(98, 'sawtooth', 360);
    return true;
  }

  setMusicLayer(name, value, glide = 0.72) {
    if (!this.music?.layers?.[name]) return;
    const now = this.ctx.currentTime;
    const v = Math.max(0.0001, Math.min(0.22, value));
    this.music.layers[name].target = v;
    this.music.layers[name].g.gain.setTargetAtTime(v, now, glide);
  }

  updateMusic(state, dt = 0.016) {
    if (!this.enabled) return;
    this.unlock();
    if (!this.ensureMusic()) return;
    const room = state?.room || null;
    const menu = !!state?.menu || !room;
    const latest = state?.latest || null;
    const me = typeof state?.me === 'function' ? state.me() : null;
    const enemies = latest?.enemies?.length || 0;
    const bullets = latest?.bullets?.length || 0;
    const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.35) : 0;
    const mods = room?.mods || [];
    const combat = !menu && room?.phase === 'play' && !room?.portal?.[2] && room?.cat !== 'chill';
    const boss = !menu && room?.cat === 'boss';
    const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
    const casino = chill || mods.includes('casino_virus') || mods.includes('greed');
    const staticLike = mods.includes('static_rain') || mods.includes('prism_grid') || mods.includes('anchor_gravity');
    const choir = boss || /HERALD|DAMPER|WARDEN|ANCHOR|PRISM|HUNTER|SHIFTING/.test(String(room?.director || '')) || mods.includes('echo_walls') || mods.includes('moving_room') || mods.includes('hunter_contract');
    this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.36);
    const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
    const alivePressure = Math.max(0, Math.min(1, enemies / 34));
    const bulletPressure = Math.max(0, Math.min(1, bullets / 80));
    const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
    const intensity = menu ? 0.20 : Math.max(0, Math.min(1, alivePressure * 0.36 + bulletPressure * 0.13 + lowHp * 0.20 + danger * 0.25 + damage * 0.30 + (boss ? 0.30 : 0) + (staticLike ? 0.10 : 0)));
    const root = this.musicRootFor({ menu, boss, chill, casino, staticLike });
    const portalOpen = !!room?.portal?.[2];

    this.musicStepT = Math.max(0, (this.musicStepT || 0) - dt);
    if (this.musicStepT <= 0) {
      this.musicStepT = menu ? 2.05 : Math.max(0.72, 1.45 - intensity * 0.55);
      const now = this.ctx.currentTime;
      const pulse = this.music.layers.pulse;
      const casinoL = this.music.layers.casino;
      const dirgePad = this.music.layers.dirgePad;
      if (pulse) pulse.o.frequency.setTargetAtTime(root * (combat && intensity > 0.55 ? 2 : 1), now, 0.7);
      if (casinoL) casinoL.o.frequency.setTargetAtTime(root * (casino ? 6 : 4) * (casino && intensity > 0.66 ? 1.125 : 1), now, 0.9);
      if (dirgePad) {
        const base = root * (menu ? 1 : (boss ? 1.5 : chill ? 1.5 : 2));
        const wound = staticLike ? Math.pow(2, -2 / 12) : (casino ? Math.pow(2, -3 / 12) : 1);
        dirgePad.o.frequency.setTargetAtTime(base * wound, now, 1.25);
        dirgePad.f.frequency.setTargetAtTime(staticLike ? 290 : (boss ? 250 : 360), now, 1.1);
      }
    }

    const inGame = inGameMusicAmount(room, menu);
    this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
    if ((room || menu) && this.music.phraseT <= 0) {
      this.playDirgePhrase({ boss, chill, casino, staticLike, intensity: menu ? 0.18 : intensity, menu, damage, crowd: alivePressure });
      // Slow enough to live above the drone without becoming a cheerful loop, but denser under danger.
      const roomShift = (staticLike ? -0.55 : 0) + (casino ? -0.35 : 0) + (lowHp > 0.45 ? -0.70 : 0) + (damage > 0.45 ? -0.55 : 0);
      this.music.phraseT = menu ? 6.0 : Math.max(1.6, ((boss ? 3.2 : chill ? 7.0 : 4.6) - intensity * 2.35 - alivePressure * 0.85 + roomShift + (portalOpen ? 0.9 : 0)));
    }

    this.setMusicLayer('drone', inGame * (menu ? 0.020 : (chill ? 0.020 : 0.030 + intensity * 0.010)), 1.2);
    this.setMusicLayer('sub', menu ? 0.0008 : (combat ? (0.0012 + Math.max(0, intensity - 0.72) * 0.016 + lowHp * 0.006 + (boss ? 0.005 : 0)) : (chill ? 0.0012 : 0.0005)), 1.15);
    this.setMusicLayer('pulse', menu ? 0.0008 : (combat ? (0.0015 + Math.max(0, intensity - 0.48) * 0.018) : (portalOpen ? 0.003 : 0.0006)), 0.75);
    this.setMusicLayer('hat', combat && intensity > 0.32 ? ((intensity - 0.25) * 0.030) : 0.0001, 0.35);
    this.setMusicLayer('casino', casino ? (chill ? 0.006 : 0.003 + intensity * 0.007) : 0.0001, 0.9);
    this.setMusicLayer('choir', menu ? 0.010 : (choir || boss ? (0.014 + intensity * 0.054) : (0.004 + intensity * 0.010)), 1.0);
    this.setMusicLayer('dirgePad', inGame * (menu ? 0.020 : (chill ? 0.016 : 0.024 + intensity * 0.025 + (lowHp * 0.012))), 1.8);
  }


  handleFx(f, info = {}) {
    if (f?.t === 'ehit' || f?.t === 'armor_shell' || f?.t === 'active_tick' || f?.t === 'active_line_tick' || f?.t === 'blast') this.damageEnergy = Math.min(1, (this.damageEnergy || 0) + 0.045);
    const mine = f.id === info.myId;
    switch (f.t) {
      case 'shot':
        this.play(f.w === 'RKT' ? 'rocket_launch' : f.w === 'SEK' ? 'shot_sek' : f.w === 'SHG' ? 'shot_shg' : 'shot');
        break;
      case 'blast': this.play(f.style === 'rocket' ? 'rocket_blast' : 'blast'); break;
      case 'dash':
        if (mine) this.play(f.legendarySfx === 'dash_jackpot' ? 'dash_jackpot' : f.legendarySfx === 'dash_dead_channel' ? 'dash_dead_channel' : 'dash');
        break;
      case 'pick':
        if (f.type === 'GLD') this.play('gld');
        else if (f.type === 'EXP') this.play('exp');
        else if (f.type === 'HEA') this.play('hea');
        else this.play('pickup');
        break;
      case 'ehit': this.play('hit'); break;
      case 'impact': this.play('impact'); break;
      case 'ricochet': this.play(f.rocket ? 'rocket_launch' : 'shot_sek'); break;
      case 'phit': if (mine) this.play('phit'); break;
      case 'denied': if (mine) this.play('denied'); break;
      case 'active_denied': if (mine) this.play('active'); break;
      case 'bet_ui': if (mine) this.play('bet_open'); break;
      case 'chest_open':
        if (mine) {
          const c = String(f.chest || '');
          this.play(c === 'CRS' ? 'chest_cursed' : c === 'RAR' ? 'chest_rare' : c === 'WPN' ? 'chest_weapon' : c === 'ABL' ? 'chest_ability' : 'chest_basic');
        }
        break;
      case 'weapon_get': if (mine) this.play('chest_weapon'); break;
      case 'weapon_mod': if (mine) this.play('casino_weapon'); break;
      case 'ability_get': if (mine) this.play('chest_ability'); break;
      case 'portal_open': this.play('portal'); break;
      case 'install': if (mine) this.play('install'); break;
      case 'casino':
        // The casino modal owns spin / reel-stop / final-result timing, so do not play
        // outcome sounds here immediately when the authoritative result packet arrives.
        break;
      case 'casino_tick': this.play(f.good ? 'casino_win' : 'casino_static'); break;
      case 'blood_tax_warn': this.play('debt'); break;
      case 'blood_tax_hit': this.play('blast'); break;
      case 'gld_hit': if (mine) this.play('debt'); break;
      case 'room_invoice': this.play(f.noHit || f.fast ? 'casino_win' : 'install'); break;
      case 'active_line':
        if (mine && f.kind === 'void_laser') this.play('active_void_laser');
        break;
      case 'active':
        if (mine) {
          const label = String(f.label || '');
          this.play(label.includes('BLOOD') ? 'active_blood' : label.includes('SNAP') ? 'active_snap' : label.includes('OVERCLOCK') ? 'active_over' : 'active');
        }
        break;
      case 'contract': this.play('contract'); break;
      case 'contract_done': this.play('jackpot'); break;
      case 'contract_fail': this.play('denied'); break;
      case 'debt': this.play('debt'); break;
      case 'shield': this.play('shield'); break;
      case 'enemy_combo': this.play('director_wave'); break;
      case 'director_room': break;
      case 'director_wave': this.play('director_wave'); break;
      case 'damper_field': break;
      case 'bullet_damp': break;
      case 'bullet_stop': break;
      case 'herald_cast': this.play('casino_static'); break;
      case 'echo_shot': if (mine && !f.enemy) this.play('echo_shot'); break;
      case 'split': case 'summon': case 'pulse_wave': case 'prism': case 'leech_link': break;
      case 'boss_down': this.play('jackpot'); break;
      case 'skin_unlock': this.play(f.skinRarity === 'legendary' ? 'skin_legendary' : 'chest_rare'); break;
      case 'run_lost': this.play('phit'); break;
    }
  }
}
