// terminal casino roguelike procedural audio: tiny terminal SFX with priority/cooldown limits
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
    this.musicVolume = this.readVolume('nnc_music_volume', 0.62);
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
      contract: 0.35, debt: 0.28, shield: 0.12, echo_shot: 0.10, director_wave: 0.72, levelup: 0.42, run_start: 0.80, run_death: 0.80, ui_click: 0.045
    };
    this.music = null;
    this.musicPulseT = 0;
    this.musicStepT = 0;
    this.musicMood = 'menu';
    this.musicLastArea = '';
    this.musicTransition = 0;
    this.musicPortal = 0;
    this.musicResolve = 0;
    this.musicChaos = 0;
    this.prio = {
      phit: 10, rocket_blast: 9, portal: 8, jackpot: 8, denied: 7,
      casino_static: 8, casino_lose: 7, casino_weapon: 7, casino_ability: 7, casino_win: 6, casino_result: 6, casino_spin: 3, casino_reel_stop: 4,
      dash: 6, dash_jackpot: 8, dash_dead_channel: 8, skin_legendary: 9, chest_weapon: 6, chest_ability: 6, chest_rare: 7, chest_cursed: 7,
      active_snap: 7, active_blood: 7, active_over: 7, active_void_laser: 7, active: 7, enemy: 4,
      blast: 5, rocket_launch: 5, hit: 4, gld: 3, exp: 3, hea: 5, pickup: 3,
      shot_shg: 3, shot_sek: 3, shot: 2, impact: 2, install: 5, contract: 7, debt: 7, shield: 4, echo_shot: 5, director_wave: 6, levelup: 8, run_start: 8, run_death: 9, ui_click: 3
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
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(1.80 * this.musicVolume, this.ctx.currentTime, 0.05);
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
      this.musicGain.gain.value = 1.80 * this.musicVolume;
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

  envGain(vol, dur, attack = 0.004, hold = 0.01, delay = 0) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime + Math.max(0, delay || 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + attack);
    g.gain.setValueAtTime(Math.max(0.0001, vol), t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.sfxGain || this.master);
    return g;
  }

  tone(freq, dur, type = 'square', vol = 0.12, bend = 1, delay = 0) {
    const o = this.ctx.createOscillator();
    const g = this.envGain(vol, dur, 0.003, 0.006, delay);
    const t = this.ctx.currentTime + Math.max(0, delay || 0);
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
    const g = this.envGain(vol, dur, 0.002, 0.002, delay);
    src.connect(bp); bp.connect(g);
    const t = this.ctx.currentTime + Math.max(0, delay || 0);
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
        // v2.1: SEEKER is 50% quieter and pitched higher; still dry/terminal, no bubble chirp.
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
        // Melancholy terminal pickup: quieter, minor down-bend, no cheerful coin sparkle.
        this.tone(392, 0.045, 'square', 0.022, 0.84);
        this.tone(293.66, 0.050, 'triangle', 0.016, 0.92, 0.024);
        break;
      case 'exp':
        this.tone(440, 0.050, 'triangle', 0.022, 0.89);
        this.tone(349.23, 0.060, 'square', 0.015, 0.93, 0.032);
        break;
      case 'hea':
        this.tone(329.63, 0.070, 'sine', 0.032, 1.06);
        this.tone(261.63, 0.090, 'triangle', 0.018, 0.98, 0.045);
        break;
      case 'pickup':
        this.tone(392, 0.040, 'square', 0.024, 0.82);
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
      case 'levelup':
        // INSTALL-green level chime: quieter, higher than old bubble, but minor/terminal instead of happy.
        this.tone(440.00, 0.085, 'square', 0.028, 0.96);
        this.tone(523.25, 0.100, 'triangle', 0.022, 0.985, 0.055);
        this.tone(659.25, 0.110, 'square', 0.016, 0.94, 0.118);
        this.noise(0.026, 0.006, 3600, 10, 0.010);
        break;
      case 'run_start':
        this.musicTransition = 1;
        this.musicResolve = Math.max(this.musicResolve || 0, 0.18);
        if (this.music) this.music.phraseT = Math.min(this.music.phraseT || 0, 0.03);
        this.scoreEventWave?.('start');
        // Digital run-start marker: packet lock + minor upward gate, less smooth/heroic.
        this.noise(0.018, 0.016, 5200, 15, 0.000);
        this.tone(130.81, 0.115, 'square', 0.032, 1.002, 0.000);
        this.tone(155.56, 0.105, 'square', 0.024, 0.985, 0.055);
        this.tone(196.00, 0.120, 'square', 0.018, 0.970, 0.118);
        this.noise(0.060, 0.010, 900, 4.0, 0.060);
        break;
      case 'run_death':
        this.musicTransition = 1;
        this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.45);
        if (this.music) this.music.phraseT = Math.min(this.music.phraseT || 0, 0.04);
        this.scoreEventWave?.('death');
        // Digital death marker: descending terminal dropout, not a smooth cinematic whoosh.
        this.noise(0.020, 0.018, 4200, 12, 0.000);
        this.tone(261.63, 0.110, 'square', 0.030, 0.72, 0.000);
        this.tone(207.65, 0.145, 'square', 0.026, 0.68, 0.052);
        this.tone(146.83, 0.185, 'sawtooth', 0.024, 0.62, 0.122);
        this.noise(0.145, 0.014, 360, 2.0, 0.095);
        break;
      case 'install':
        this.tone(349.23, 0.060, 'square', 0.030, 1.05);
        this.tone(415.30, 0.075, 'triangle', 0.020, 0.94, 0.050);
        this.noise(0.018, 0.006, 3100, 9, 0.015);
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
        this.tone(392, 0.028, 'square', 0.018, 0.56);
        this.noise(0.010, 0.008, 2200, 9);
        break;
      case 'casino_result':
        this.tone(293.66, 0.050, 'square', 0.026, 0.92);
        this.tone(233.08, 0.060, 'triangle', 0.016, 0.88, 0.038);
        break;
      case 'casino_win':
        this.tone(329.63, 0.060, 'square', 0.030, 1.06);
        this.tone(392.00, 0.080, 'triangle', 0.020, 0.94, 0.052);
        break;
      case 'casino_weapon':
        this.tone(146.83, 0.080, 'square', 0.040, 1.08);
        this.tone(349.23, 0.090, 'sawtooth', 0.024, 0.92, 0.045);
        break;
      case 'casino_ability':
        this.tone(261.63, 0.075, 'square', 0.034, 1.10);
        this.tone(415.30, 0.070, 'square', 0.020, 0.82, 0.045);
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
        this.tone(392, 0.075, 'square', 0.040, 1.35);
        this.tone(523.25, 0.055, 'square', 0.024, 0.88, 0.045);
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
        this.tone(130.81, 0.145, 'square', 0.048, 1.02);
        this.tone(196.00, 0.090, 'triangle', 0.024, 0.86, 0.080);
        break;
      case 'debt':
        this.tone(105, 0.14, 'sawtooth', 0.07, 0.55);
        this.noise(0.1, 0.04, 700, 2);
        break;
      case 'shield':
        this.tone(820, 0.045, 'square', 0.032, 0.45);
        break;
      case 'skin_legendary':
        this.tone(174.61, 0.160, 'square', 0.048, 1.28);
        this.tone(349.23, 0.120, 'square', 0.032, 0.92, 0.055);
        this.tone(523.25, 0.095, 'triangle', 0.020, 0.88, 0.115);
        this.noise(0.060, 0.016, 2600, 9, 0.020);
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
        this.tone(164.81, 0.180, 'square', 0.052, 1.20);
        this.tone(329.63, 0.135, 'square', 0.034, 0.92, 0.060);
        this.tone(415.30, 0.110, 'triangle', 0.020, 0.86, 0.120);
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
    // v2.1: one dark tonal home. Bass is only a distant floor;
    // the player should hear the melodic phrases first.
    return 49.00;
  }

  musicScaleFor(context = {}) {
    // Phrygian / minor set around the same root. It keeps the music mournful,
    // not cheerful, while allowing several recognizable melodies.
    if (context.staticLike) return [0, -1, -3, -6, -7, -10, -12, -13, -15, -18, -19, -22, -24];
    if (context.casino) return [0, -1, -3, -5, -6, -8, -11, -12, -13, -17, -18, -20, -23, -24];
    if (context.boss) return [0, -1, -4, -5, -7, -8, -11, -12, -13, -16, -17, -19, -23, -24];
    if (context.chill || context.menu) return [0, -2, -3, -5, -7, -8, -10, -12, -15, -17, -19, -22, -24];
    return [0, -1, -3, -5, -7, -8, -10, -12, -13, -15, -17, -20, -22, -24];
  }

  musicMoodFor(context = {}) {
    if (context.menu) return 'menu';
    if (context.portalOpen || context.portal > 0.25) return 'portal';
    if (context.resolve > 0.28) return 'resolve';
    if (context.boss) return context.intensity > 0.72 ? 'boss_chaos' : 'boss';
    if (context.chill) return 'rest';
    if (context.intensity > 0.76 || context.crowd > 0.66 || context.damage > 0.55 || context.chaos > 0.45) return 'chaos';
    if (context.staticLike) return 'static';
    if (context.casino) return 'casino';
    if (context.combat) return 'combat';
    return 'rest';
  }

  musicMotifsFor(context = {}) {
    // v2.1: explicit melody families. Same dark scale grammar, different moods.
    // Keep phrases recognizable and sparse: melody first, ambience second, bass last.
    const mood = context.mood || this.musicMoodFor(context);
    const sets = {
      menu: [
        [19, 17, 15, 12, 10],
        [15, 12, 10, 7, 5],
        [22, 19, 17, 15, 12],
        [12, 15, 11, 10, 7]
      ],
      rest: [
        [19, 15, 12, 10, 7],
        [17, 15, 12, 8, 7],
        [12, 10, 7, 5, 3],
        [22, 19, 15, 12]
      ],
      combat: [
        [19, 17, 15, 12, 10, 7],
        [15, 14, 12, 8, 7, 5],
        [22, 19, 17, 13, 12, 10],
        [17, 15, 12, 11, 8, 7]
      ],
      chaos: [
        [24, 23, 19, 17, 13, 12, 7],
        [19, 18, 15, 12, 8, 7, 4],
        [27, 24, 20, 19, 15, 12],
        [17, 19, 16, 12, 11, 7]
      ],
      static: [
        [19, 18, 13, 12, 7, 6],
        [24, 19, 18, 13, 12],
        [15, 13, 12, 6, 5, 0],
        [22, 18, 17, 13, 12, 6]
      ],
      casino: [
        [19, 18, 15, 14, 11, 7],
        [23, 18, 17, 14, 11],
        [15, 18, 14, 11, 7, 6],
        [12, 14, 11, 7, 6, 3]
      ],
      boss: [
        [24, 23, 19, 17, 12, 11, 7],
        [19, 16, 15, 12, 8, 7, 4],
        [27, 24, 23, 19, 16, 15],
        [17, 19, 16, 12, 11, 7]
      ],
      boss_chaos: [
        [31, 27, 24, 23, 19, 16, 15],
        [28, 24, 23, 19, 17, 12, 11],
        [24, 27, 23, 19, 16, 12, 7]
      ],
      portal: [
        [24, 19, 15, 12, 7],
        [19, 15, 12, 10, 12],
        [27, 24, 19, 15]
      ],
      resolve: [
        [19, 22, 24, 19, 15],
        [12, 15, 19, 15, 12],
        [24, 22, 19, 15, 12]
      ]
    };
    return sets[mood] || sets.combat;
  }

  melodyInstrumentFor(mood, context = {}) {
    if (mood === 'menu' || mood === 'rest' || mood === 'resolve') return { lead: 'sine', answer: 'triangle', filter: 1020, step: 1.08 };
    if (mood === 'portal') return { lead: 'triangle', answer: 'sine', filter: 1280, step: 0.82 };
    if (mood === 'casino') return { lead: 'triangle', answer: 'square', filter: 1150, step: 0.78 };
    if (mood === 'static') return { lead: 'triangle', answer: 'sine', filter: 860, step: 0.74 };
    if (mood === 'chaos' || mood === 'boss_chaos') return { lead: 'sawtooth', answer: 'triangle', filter: 1180, step: 0.58 };
    if (mood === 'boss') return { lead: 'triangle', answer: 'sine', filter: 980, step: 0.66 };
    return { lead: 'triangle', answer: 'sine', filter: 960, step: 0.76 };
  }

  playDirgePhrase(context = {}) {
    if (!this.music?.master || !this.ctx) return;
    const mood = context.mood || this.musicMoodFor(context);
    const boss = !!context.boss;
    const casino = !!context.casino;
    const staticLike = !!context.staticLike;
    const menu = !!context.menu;
    const portal = Math.max(0, Math.min(1, context.portal || 0));
    const resolve = Math.max(0, Math.min(1, context.resolve || 0));
    const transition = Math.max(0, Math.min(1, context.transition || 0));
    const intensity = Math.max(0, Math.min(1, context.intensity || 0));
    const damage = Math.max(0, Math.min(1, context.damage || 0));
    const crowd = Math.max(0, Math.min(1, context.crowd || 0));
    const chaos = Math.max(0, Math.min(1, context.chaos || 0));
    const root = this.musicRootFor(context);
    const motifs = this.musicMotifsFor({ ...context, mood });
    const semitone = n => root * Math.pow(2, n / 12);

    const phraseSeed = this.music.motifIndex++;
    const pressure = Math.max(intensity, crowd * 0.82, damage * 0.90, chaos * 0.85, portal * 0.35, transition * 0.25);
    const phraseMode = (phraseSeed + Math.floor(pressure * 7) + (boss ? 4 : 0) + (casino ? 7 : 0) + (staticLike ? 11 : 0)) % 5;
    const motif = motifs[(phraseSeed + Math.floor(pressure * motifs.length)) % motifs.length];
    const inst = this.melodyInstrumentFor(mood, context);
    const step = Math.max(0.48, inst.step - pressure * (mood.includes('chaos') ? 0.10 : 0.05));
    const swing = staticLike ? 0.14 : casino ? 0.09 : mood.includes('chaos') ? 0.04 : 0.06;

    // Melody volume is intentionally above all bass/drone layers, but still not pop-bright.
    const leadVol = (menu ? 0.026 : mood === 'rest' ? 0.024 : mood === 'portal' ? 0.044 : mood === 'resolve' ? 0.040 : 0.034 + pressure * 0.020) * (transition > 0.2 ? 1.08 : 1);
    const answerVol = leadVol * (mood.includes('chaos') ? 0.38 : 0.48);
    const highVol = leadVol * (mood.includes('chaos') || boss || damage > 0.38 || crowd > 0.48 ? 0.44 : 0.22);
    const filterBase = inst.filter + pressure * 180;

    // Bass/body is only a rare shadow, never the lead.
    if (portal > 0.35 || boss || (mood.includes('chaos') && pressure > 0.78)) {
      this.musicNote(root * 0.5, step * 2.6, 'sine', 0.00025 + pressure * 0.00045, 54 + pressure * 10, 0.02, 0.999, 0);
    }
    if (!menu && phraseSeed % 3 === 0) {
      const body = motif[Math.min(2, motif.length - 1)] - 24;
      this.musicNote(semitone(body), step * 4.8, 'triangle', 0.00055 + pressure * 0.00065, 120 + pressure * 28, step * 0.25, 0.999, -8);
    }

    const leadType = inst.lead;
    const answerType = inst.answer;
    motif.forEach((m, i) => {
      // Keep room for silence in rest/menu, but not enough to make melody disappear.
      if ((mood === 'menu' || mood === 'rest') && i > 4) return;
      const delay = i * step * (1 + (i % 2 ? swing : -swing * 0.35));
      const longLast = i === motif.length - 1;
      const dur = step * (longLast ? (mood === 'portal' || mood === 'resolve' ? 2.25 : 1.75) : (phraseMode === 2 ? 0.86 : 1.08));
      const octave = (phraseMode === 1 && i % 4 === 0 && mood !== 'rest') ? 12 : 0;
      const f = semitone(m + octave);
      const detune = (i % 2 ? -5 : 3) + (staticLike ? -4 : 0) + (casino ? 4 : 0) + (mood.includes('chaos') ? -2 : 0);
      const accent = i === 0 || longLast ? 1.10 : 1;
      this.musicNote(f, dur, leadType, leadVol * accent, filterBase + i * 46, delay, mood === 'static' ? 0.997 : 0.999, detune);

      // Answer phrase: sparse, audible, lower register.
      if (i % 2 === 1 && i < motif.length - 1) {
        const lower = motif[Math.max(0, i - 1)] - (mood === 'portal' ? 5 : 12);
        this.musicNote(semitone(lower), step * 1.55, answerType, answerVol, 610 + pressure * 150, delay + step * 0.46, 0.999, -9);
      }

      if ((mood === 'static' || damage > 0.42 || mood.includes('chaos')) && i % 3 === 2) {
        this.musicDust(0.038 + pressure * 0.030, 0.0013 + pressure * 0.0023, 3600 + i * 220, delay + 0.04);
      }
    });

    // Event signatures: portal / objective complete / scene transition.
    if (portal > 0.20) {
      const when = step * 0.75;
      this.musicNote(semitone(24), step * 2.3, 'sine', leadVol * 0.52, 1320, when, 0.999, -12);
      this.musicNote(semitone(19), step * 2.7, 'triangle', leadVol * 0.36, 860, when + step * 0.72, 0.999, 6);
    } else if (resolve > 0.20) {
      this.musicNote(semitone(19), step * 1.7, 'triangle', leadVol * 0.46, 980, step * 0.95, 0.999, -7);
      this.musicNote(semitone(24), step * 2.0, 'sine', leadVol * 0.34, 1250, step * 1.55, 0.999, 5);
    } else if (transition > 0.22) {
      this.musicNote(semitone(12), step * 2.4, 'triangle', leadVol * 0.34, 740, step * 0.35, 0.999, -10);
    }

    // High lament appears only when it has meaning.
    if (crowd > 0.45 || damage > 0.34 || boss || mood.includes('chaos')) {
      const a = motif[(phraseSeed + 2) % motif.length] + (boss ? 12 : 7);
      const b = motif[(phraseSeed + 4) % motif.length] + (boss ? 10 : 5);
      const when = step * (1.28 + ((phraseSeed % 3) * 0.18));
      this.musicNote(semitone(a), step * 1.95, 'sine', highVol, 1180 + pressure * 220, when, 0.998, -11);
      if (pressure > 0.64) this.musicNote(semitone(b), step * 2.2, 'triangle', highVol * 0.66, 820 + pressure * 160, when + step * 0.58, 0.998, 7);
    }
  }

  ensureMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    if (this.music) return true;
    const master = this.ctx.createGain();
    master.gain.value = 0.22;
    master.connect(this.musicGain || this.master);
    this.music = { master, layers: {}, phraseT: 0.35, motifIndex: 0, lastRoomTone: '', dangerPhrase: 0 };
    this.music.layers.drone = this.makeToneLayer(49, 'sawtooth', 340);
    this.music.layers.sub = this.makeToneLayer(24.5, 'sine', 70);
    this.music.layers.pulse = this.makeToneLayer(98, 'square', 150);
    this.music.layers.hat = this.makeNoiseLayer(4800, 10);
    this.music.layers.casino = this.makeToneLayer(294, 'square', 620);
    this.music.layers.choir = this.makeToneLayer(196, 'triangle', 780);
    this.music.layers.dirgePad = this.makeToneLayer(98, 'triangle', 360);
    this.music.layers.scrape = this.makeNoiseLayer(760, 3.8);
    this.music.layers.glass = this.makeToneLayer(392, 'sine', 1500);
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
    this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.42);
    this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.34);
    this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.38);
    this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.46);
    const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
    const alivePressure = Math.max(0, Math.min(1, enemies / 34));
    const bulletPressure = Math.max(0, Math.min(1, bullets / 80));
    const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
    const intensity = menu ? 0.20 : Math.max(0, Math.min(1, alivePressure * 0.34 + bulletPressure * 0.12 + lowHp * 0.20 + danger * 0.24 + damage * 0.34 + (boss ? 0.30 : 0) + (staticLike ? 0.10 : 0)));
    const portalOpen = !!room?.portal?.[2];
    const area = menu ? 'menu' : `${room?.cat || 'room'}:${room?.special || ''}:${mods.join(',')}:${portalOpen ? 'portal' : 'closed'}`;
    if (area !== this.musicLastArea) {
      this.musicTransition = Math.max(this.musicTransition || 0, 0.85);
      this.music.phraseT = Math.min(this.music.phraseT || 0, 0.22);
      this.musicLastArea = area;
    }
    const mood = this.musicMoodFor({ menu, boss, chill, casino, staticLike, combat, intensity, crowd: alivePressure, damage, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve });
    const root = this.musicRootFor({ menu, boss, chill, casino, staticLike, mood });

    this.musicStepT = Math.max(0, (this.musicStepT || 0) - dt);
    if (this.musicStepT <= 0) {
      this.musicStepT = menu ? 2.4 : Math.max(0.85, 1.75 - intensity * 0.48);
      const now = this.ctx.currentTime;
      const pulse = this.music.layers.pulse;
      const casinoL = this.music.layers.casino;
      const dirgePad = this.music.layers.dirgePad;
      const choirL = this.music.layers.choir;
      const glass = this.music.layers.glass;
      if (pulse) pulse.o.frequency.setTargetAtTime(root * (combat && intensity > 0.72 ? 2.5 : 2), now, 1.3);
      if (casinoL) casinoL.o.frequency.setTargetAtTime(root * (casino ? 6 : 4) * (casino && intensity > 0.70 ? Math.pow(2, -1/12) : 1), now, 1.2);
      if (dirgePad) {
        const base = root * (menu ? 1 : (boss ? 1.5 : chill ? 1.5 : 2));
        const wound = staticLike ? Math.pow(2, -2 / 12) : (casino ? Math.pow(2, -6 / 12) : 1);
        dirgePad.o.frequency.setTargetAtTime(base * wound, now, 1.4);
        dirgePad.f.frequency.setTargetAtTime(staticLike ? 310 : (boss ? 360 : 440), now, 1.2);
      }
      if (choirL) choirL.f.frequency.setTargetAtTime((boss || choir) ? 680 + intensity * 260 : 560 + intensity * 180, now, 1.4);
      if (glass) glass.o.frequency.setTargetAtTime(root * (menu ? 8 : (casino ? 7.5 : staticLike ? 6.66 : 8)), now, 1.6);
    }

    const inGame = inGameMusicAmount(room, menu);
    this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
    if ((room || menu) && this.music.phraseT <= 0) {
      this.playDirgePhrase({ boss, chill, casino, staticLike, combat, intensity: menu ? 0.10 : intensity, menu, damage, crowd: alivePressure, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve, transition: this.musicTransition, mood });
      const eventPull = Math.max(this.musicPortal || 0, this.musicResolve || 0, this.musicTransition || 0);
      const calmBase = mood === 'menu' ? 4.8 : mood === 'rest' ? 5.8 : mood === 'portal' ? 2.6 : mood === 'resolve' ? 3.1 : mood.includes('boss') ? 2.65 : mood === 'chaos' ? 2.35 : 3.55;
      this.music.phraseT = Math.max(mood === 'chaos' ? 1.55 : 2.05, calmBase - intensity * 0.70 - alivePressure * 0.35 - eventPull * 1.1);
    }

    // v2.1: the drones are floor texture only. Clear melodic phrases carry the music.
    this.setMusicLayer('drone', inGame * (menu ? 0.0045 : (chill ? 0.0048 : 0.0055 + intensity * 0.0015)), 2.4);
    this.setMusicLayer('sub', menu ? 0.00003 : (combat ? (0.000035 + Math.max(0, intensity - 0.92) * 0.00034 + (boss ? 0.00010 : 0)) : 0.00003), 2.0);
    this.setMusicLayer('pulse', menu ? 0.00003 : (combat && intensity > 0.82 ? (0.00004 + (intensity - 0.82) * 0.00042) : (portalOpen ? 0.00005 : 0.00003)), 1.6);
    this.setMusicLayer('hat', combat && (mood === 'chaos' || intensity > 0.78) ? ((intensity - 0.70) * 0.0028) : 0.0001, 0.9);
    this.setMusicLayer('casino', casino ? (0.00025 + intensity * 0.00070) : 0.0001, 1.6);
    this.setMusicLayer('choir', menu ? 0.0038 : (choir || boss ? (0.006 + intensity * 0.011) : (0.0035 + intensity * 0.0048)), 2.0);
    this.setMusicLayer('dirgePad', inGame * (menu ? 0.0052 : (chill ? 0.0048 : 0.0060 + intensity * 0.0035 + (lowHp * 0.0015))), 2.8);
    this.setMusicLayer('scrape', combat && (mood === 'chaos' || staticLike || damage > 0.34) ? (0.00045 + intensity * 0.0015) : 0.0001, 1.4);
    this.setMusicLayer('glass', menu ? 0.0010 : (combat && (mood === 'portal' || mood === 'resolve' || intensity > 0.56) ? 0.0010 + intensity * 0.0018 : 0.0001), 2.2);
  }


  handleFx(f, info = {}) {
    if (f?.t === 'ehit' || f?.t === 'armor_shell' || f?.t === 'active_tick' || f?.t === 'active_line_tick' || f?.t === 'blast') {
      this.damageEnergy = Math.min(1, (this.damageEnergy || 0) + 0.045);
      this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.040);
    }
    if (f?.t === 'portal_open') { this.musicPortal = 1; this.musicTransition = Math.max(this.musicTransition || 0, 0.7); if (this.music) this.music.phraseT = Math.min(this.music.phraseT || 0, 0.05); }
    if (f?.t === 'room_invoice' || f?.t === 'contract_done' || f?.t === 'boss_down' || f?.t === 'skin_unlock') { this.musicResolve = 1; if (this.music) this.music.phraseT = Math.min(this.music.phraseT || 0, 0.08); }
    if (f?.t === 'director_wave' || f?.t === 'enemy_combo' || f?.t === 'casino_virus_spin') { this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.24); }
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
      case 'pdown': if (mine) this.play('run_death'); break;
      case 'levelup': if (mine) this.play('levelup'); break;
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
      case 'run_lost': this.play('run_death'); break;
    }
  }
}

// v2.1 FINAL music rewrite: low-register melancholic melodic instruments.
// High gameplay SFX own the treble range; music stays low / mid-low and motif-based.
AudioBus.prototype.musicRootFor = function musicRootForV21(context = {}) {
  if (context.boss) return 46.25;     // F#1
  if (context.casino) return 51.91;   // G#1
  if (context.staticLike) return 49.00;// G1
  return 43.65;                       // F1
};
AudioBus.prototype.musicMoodFor = function musicMoodForV21(context = {}) {
  if (context.menu) return 'menu';
  if (context.portalOpen || context.portal > 0.25) return 'portal';
  if (context.resolve > 0.28) return 'resolve';
  if (context.boss) return context.intensity > 0.72 ? 'boss_chaos' : 'boss';
  if (context.chill) return 'rest';
  if (context.intensity > 0.78 || context.crowd > 0.70 || context.damage > 0.58 || context.chaos > 0.52) return 'chaos';
  if (context.staticLike) return 'static';
  if (context.casino) return 'casino';
  if (context.combat) return 'combat';
  return 'rest';
};
AudioBus.prototype.musicMotifsFor = function musicMotifsForV21(context = {}) {
  const mood = context.mood || this.musicMoodFor(context);
  // All motifs are actual authored phrases in a shared dark minor / phrygian grammar.
  // They avoid the treble register: most notes resolve between ~80-220 Hz.
  const sets = {
    menu: [
      [19, 17, 15, 12, 10, 7, 5, 7],
      [15, 12, 10, 8, 7, 5, 3, 5],
      [12, 15, 17, 15, 12, 10, 7],
    ],
    rest: [
      [19, 15, 12, 10, 8, 7, 5],
      [17, 15, 12, 10, 7, 5, 3],
      [12, 10, 8, 7, 5, 3, 0],
    ],
    combat: [
      [19, 17, 15, 12, 10, 8, 7, 5],
      [15, 17, 15, 12, 10, 7, 8, 7],
      [12, 15, 12, 10, 8, 7, 5, 3],
    ],
    chaos: [
      [19, 18, 15, 12, 10, 8, 7, 5],
      [17, 15, 13, 12, 8, 7, 5, 1],
      [22, 19, 18, 15, 12, 10, 7],
    ],
    static: [
      [18, 15, 13, 12, 8, 7, 6, 3],
      [19, 18, 15, 13, 12, 8, 6],
      [15, 13, 12, 8, 7, 6, 3, 1],
    ],
    casino: [
      [19, 18, 15, 14, 11, 8, 7, 6],
      [15, 18, 15, 14, 11, 8, 7],
      [12, 14, 11, 8, 7, 6, 3],
    ],
    boss: [
      [22, 19, 18, 15, 12, 11, 8, 7],
      [19, 16, 15, 12, 11, 8, 7, 4],
      [17, 19, 16, 15, 12, 8, 7],
    ],
    boss_chaos: [
      [22, 19, 18, 15, 12, 11, 8, 7],
      [24, 22, 19, 18, 15, 12, 11, 7],
      [19, 18, 16, 15, 12, 11, 8, 4],
    ],
    portal: [
      [19, 15, 12, 10, 7, 10, 12],
      [22, 19, 15, 12, 10, 12],
      [15, 12, 10, 7, 5, 7, 10],
    ],
    resolve: [
      [12, 15, 19, 17, 15, 12, 10],
      [7, 10, 12, 15, 12, 10, 7],
      [19, 17, 15, 12, 10, 7, 5],
    ]
  };
  return sets[mood] || sets.combat;
};
AudioBus.prototype.melodyInstrumentFor = function melodyInstrumentForV21(mood, context = {}) {
  // Simulated low instruments: bass-clarinet square/triangle, cello saw through lowpass,
  // reed organ triangle. No glassy high lead.
  if (mood === 'menu' || mood === 'rest') return { lead: 'triangle', answer: 'sine', body: 'sawtooth', filter: 540, step: 0.96 };
  if (mood === 'portal' || mood === 'resolve') return { lead: 'triangle', answer: 'triangle', body: 'sine', filter: 620, step: 0.82 };
  if (mood === 'casino') return { lead: 'square', answer: 'triangle', body: 'sawtooth', filter: 560, step: 0.74 };
  if (mood === 'static') return { lead: 'triangle', answer: 'square', body: 'sawtooth', filter: 470, step: 0.78 };
  if (mood === 'chaos' || mood === 'boss_chaos') return { lead: 'sawtooth', answer: 'triangle', body: 'square', filter: 640, step: 0.60 };
  if (mood === 'boss') return { lead: 'sawtooth', answer: 'triangle', body: 'sine', filter: 590, step: 0.68 };
  return { lead: 'triangle', answer: 'sine', body: 'sawtooth', filter: 540, step: 0.78 };
};
AudioBus.prototype.playDirgePhrase = function playDirgePhraseV21(context = {}) {
  if (!this.music?.master || !this.ctx) return;
  const mood = context.mood || this.musicMoodFor(context);
  const root = this.musicRootFor(context);
  const motifs = this.musicMotifsFor({ ...context, mood });
  const seed = this.music.motifIndex++;
  const intensity = Math.max(0, Math.min(1, context.intensity || 0));
  const crowd = Math.max(0, Math.min(1, context.crowd || 0));
  const damage = Math.max(0, Math.min(1, context.damage || 0));
  const chaos = Math.max(0, Math.min(1, context.chaos || 0));
  const portal = Math.max(0, Math.min(1, context.portal || 0));
  const resolve = Math.max(0, Math.min(1, context.resolve || 0));
  const pressure = Math.max(intensity, crowd * 0.75, damage * 0.85, chaos * 0.75, portal * 0.45, resolve * 0.35);
  const motif = motifs[seed % motifs.length];
  const inst = this.melodyInstrumentFor(mood, context);
  const step = Math.max(0.52, inst.step - pressure * 0.08);
  const semitone = n => root * Math.pow(2, n / 12);
  const leadVol = (mood === 'menu' ? 0.036 : mood === 'rest' ? 0.034 : mood === 'portal' || mood === 'resolve' ? 0.046 : 0.040 + pressure * 0.016);
  const answerVol = leadVol * 0.46;
  const bodyVol = 0.0024 + pressure * 0.0012;
  const filter = inst.filter + pressure * 90;

  // Low held body tones: audible color, not sub-bass lead.
  const bodyNote = motif[Math.min(3, motif.length - 1)] - 12;
  this.musicNote(semitone(bodyNote), step * (mood === 'rest' || mood === 'menu' ? 7.8 : 5.8), inst.body, bodyVol, 190 + pressure * 70, step * 0.15, 0.999, -8);
  if (mood === 'boss' || mood === 'boss_chaos' || mood === 'portal') {
    this.musicNote(semitone(motif[0] - 19), step * 5.2, 'triangle', 0.0018 + pressure * 0.0010, 150, step * 0.40, 0.999, 5);
  }

  motif.forEach((m, i) => {
    const delay = i * step * (i % 2 ? 1.06 : 0.98);
    const last = i === motif.length - 1;
    const dur = step * (last ? 2.15 : (i % 3 === 0 ? 1.28 : 1.02));
    const accent = (i === 0 || last) ? 1.12 : 1.0;
    // Never jump into piercing highs. One octave above root max, mostly mid-low.
    this.musicNote(semitone(m), dur, inst.lead, leadVol * accent, filter + (i % 3) * 28, delay, 0.999, (i % 2 ? -6 : 3));
    if (i % 2 === 1 && i < motif.length - 1) {
      const a = motif[Math.max(0, i - 1)] - (mood === 'portal' || mood === 'resolve' ? 7 : 12);
      this.musicNote(semitone(a), step * 1.65, inst.answer, answerVol, Math.max(260, filter - 90), delay + step * 0.52, 0.999, -10);
    }
  });

  // Event signatures: melodic, low, not sparkly.
  if (portal > 0.2) {
    this.musicNote(semitone(19), step * 2.4, 'triangle', leadVol * 0.60, 560, step * 0.55, 0.999, -6);
    this.musicNote(semitone(12), step * 3.2, 'sine', leadVol * 0.38, 420, step * 1.25, 0.999, 4);
  }
  if (resolve > 0.22) {
    this.musicNote(semitone(12), step * 1.9, 'triangle', leadVol * 0.54, 520, step * 0.92, 0.999, -4);
    this.musicNote(semitone(15), step * 2.2, 'triangle', leadVol * 0.42, 540, step * 1.55, 0.999, 5);
  }
};
AudioBus.prototype.ensureMusic = function ensureMusicV21() {
  if (!this.ctx || this.ctx.state !== 'running') return false;
  if (this.music) return true;
  const master = this.ctx.createGain();
  master.gain.value = 0.20;
  master.connect(this.musicGain || this.master);
  this.music = { master, layers: {}, phraseT: 0.15, motifIndex: 0, lastRoomTone: '', dangerPhrase: 0 };
  this.music.layers.drone = this.makeToneLayer(43.65, 'triangle', 250);
  this.music.layers.sub = this.makeToneLayer(21.8, 'sine', 48);
  this.music.layers.pulse = this.makeToneLayer(87.3, 'triangle', 120);
  this.music.layers.hat = this.makeNoiseLayer(2100, 5.5);
  this.music.layers.casino = this.makeToneLayer(155.6, 'square', 420);
  this.music.layers.choir = this.makeToneLayer(130.8, 'triangle', 520);
  this.music.layers.dirgePad = this.makeToneLayer(87.3, 'sawtooth', 260);
  this.music.layers.scrape = this.makeNoiseLayer(420, 2.6);
  this.music.layers.glass = this.makeToneLayer(196, 'triangle', 620);
  return true;
};
AudioBus.prototype.updateMusic = function updateMusicV21(state, dt = 0.016) {
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
  const casino = !menu && (mods.includes('casino_virus') || mods.includes('greed'));
  const staticLike = mods.includes('static_rain') || mods.includes('prism_grid') || mods.includes('anchor_gravity');
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.36);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.42);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.34);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.38);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.46);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = Math.max(0, Math.min(1, enemies / 32));
  const bulletPressure = Math.max(0, Math.min(1, bullets / 90));
  const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
  const intensity = menu ? 0.08 : Math.max(0, Math.min(1, crowd * 0.33 + bulletPressure * 0.08 + lowHp * 0.18 + danger * 0.23 + damage * 0.28 + (boss ? 0.25 : 0) + (staticLike ? 0.08 : 0)));
  const portalOpen = !!room?.portal?.[2];
  const area = menu ? 'menu' : `${room?.cat || 'room'}:${room?.special || ''}:${mods.join(',')}:${portalOpen ? 'portal' : 'closed'}`;
  if (area !== this.musicLastArea) {
    this.musicTransition = Math.max(this.musicTransition || 0, 0.85);
    this.music.phraseT = Math.min(this.music.phraseT || 0, 0.05);
    this.musicLastArea = area;
  }
  const mood = this.musicMoodFor({ menu, boss, chill, casino, staticLike, combat, intensity, crowd, damage, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve });
  const root = this.musicRootFor({ menu, boss, chill, casino, staticLike, mood });
  const now = this.ctx.currentTime;
  const pulse = this.music.layers.pulse;
  const casinoL = this.music.layers.casino;
  const dirgePad = this.music.layers.dirgePad;
  const choirL = this.music.layers.choir;
  const glass = this.music.layers.glass;
  if (pulse) pulse.o.frequency.setTargetAtTime(root * 2, now, 1.8);
  if (casinoL) casinoL.o.frequency.setTargetAtTime(root * (casino ? 3 : 2.5), now, 1.8);
  if (dirgePad) { dirgePad.o.frequency.setTargetAtTime(root * (boss ? 2 : 1.5), now, 1.8); dirgePad.f.frequency.setTargetAtTime(230 + intensity * 80, now, 1.8); }
  if (choirL) choirL.f.frequency.setTargetAtTime(420 + intensity * 110, now, 1.8);
  if (glass) glass.o.frequency.setTargetAtTime(root * 4, now, 2.0);
  const inGame = inGameMusicAmount(room, menu);
  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    this.playDirgePhrase({ boss, chill, casino, staticLike, combat, intensity: menu ? 0.07 : intensity, menu, damage, crowd, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve, transition: this.musicTransition, mood });
    const eventPull = Math.max(this.musicPortal || 0, this.musicResolve || 0, this.musicTransition || 0);
    const base = mood === 'menu' ? 5.0 : mood === 'rest' ? 5.9 : mood === 'portal' ? 2.9 : mood === 'resolve' ? 3.2 : mood.includes('boss') ? 3.0 : mood === 'chaos' ? 2.55 : 3.8;
    this.music.phraseT = Math.max(mood === 'chaos' ? 1.9 : 2.35, base - intensity * 0.45 - crowd * 0.25 - eventPull * 0.9);
  }
  // Background layers are very quiet. Melodic notes carry the score.
  this.setMusicLayer('drone', inGame * (menu ? 0.0022 : (chill ? 0.0024 : 0.0028 + intensity * 0.0007)), 2.5);
  this.setMusicLayer('sub', menu ? 0.00002 : (combat && intensity > 0.90 ? 0.00003 + (intensity - 0.90) * 0.00016 : 0.00002), 2.2);
  this.setMusicLayer('pulse', menu ? 0.00002 : (combat && intensity > 0.86 ? 0.000025 + (intensity - 0.86) * 0.00020 : 0.00002), 1.8);
  this.setMusicLayer('hat', 0.0001, 1.0);
  this.setMusicLayer('casino', casino ? (0.00020 + intensity * 0.00028) : 0.0001, 1.8);
  this.setMusicLayer('choir', menu ? 0.0018 : (boss ? 0.0045 + intensity * 0.004 : 0.0022 + intensity * 0.0018), 2.2);
  this.setMusicLayer('dirgePad', inGame * (menu ? 0.0025 : (chill ? 0.0026 : 0.0030 + intensity * 0.0012)), 2.9);
  this.setMusicLayer('scrape', combat && (mood === 'chaos' || staticLike || damage > 0.40) ? (0.00018 + intensity * 0.00050) : 0.0001, 1.5);
  this.setMusicLayer('glass', 0.0001, 2.4);
};

// v2.1 AMBIENT HOTFIX: Brian-Eno-style generative background bed.
// The score is now slow low/mid-low ambient: long cells, overlapping loops,
// soft attacks, no bright melodic stabs. Gameplay SFX owns the treble.
AudioBus.prototype.musicRootFor = function musicRootForV21Ambient(context = {}) {
  if (context.boss) return 46.25;       // F#1
  if (context.casino) return 51.91;     // G#1
  if (context.staticLike) return 49.00; // G1
  return 43.65;                         // F1
};

AudioBus.prototype.musicMoodFor = function musicMoodForV21Ambient(context = {}) {
  if (context.menu) return 'menu';
  if (context.portalOpen || context.portal > 0.22) return 'portal';
  if (context.resolve > 0.22) return 'resolve';
  if (context.boss) return context.intensity > 0.72 || context.chaos > 0.5 ? 'boss_chaos' : 'boss';
  if (context.chill) return 'rest';
  if (context.intensity > 0.82 || context.crowd > 0.78 || context.damage > 0.64 || context.chaos > 0.58) return 'chaos';
  if (context.staticLike) return 'static';
  if (context.casino) return 'casino';
  if (context.combat) return 'combat';
  return 'rest';
};

AudioBus.prototype.musicMotifsFor = function musicMotifsForV21Ambient(context = {}) {
  const mood = context.mood || this.musicMoodFor(context);
  // Slow cells in one shared dark mode. These are not random note bursts:
  // they are short authored cells that overlap at different lengths.
  const cells = {
    menu: [
      [12, 10, 7, 5], [15, 12, 10], [7, 5, 3, 5], [19, 15, 12]
    ],
    rest: [
      [12, 10, 7, 5], [15, 12, 8, 7], [10, 7, 5, 3], [19, 15, 12, 10]
    ],
    combat: [
      [12, 10, 8, 7], [15, 12, 10, 7], [19, 15, 12, 8], [10, 8, 7, 5]
    ],
    chaos: [
      [15, 13, 12, 8], [19, 18, 15, 12], [12, 8, 7, 5], [17, 15, 12, 11]
    ],
    static: [
      [13, 12, 8, 6], [18, 15, 13, 8], [12, 8, 6, 3], [15, 13, 12, 6]
    ],
    casino: [
      [14, 11, 8, 7], [18, 15, 14, 11], [12, 11, 8, 6], [19, 18, 14, 11]
    ],
    boss: [
      [12, 11, 8, 7], [19, 16, 15, 12], [22, 19, 15, 11], [15, 12, 8, 7]
    ],
    boss_chaos: [
      [19, 18, 15, 12], [22, 19, 16, 15], [15, 12, 11, 8], [24, 22, 19, 15]
    ],
    portal: [
      [12, 10, 7, 10], [19, 15, 12], [15, 12, 10, 7], [22, 19, 15]
    ],
    resolve: [
      [7, 10, 12, 15], [12, 15, 19], [10, 12, 15, 12], [5, 7, 10, 12]
    ]
  };
  return cells[mood] || cells.rest;
};

AudioBus.prototype.melodyInstrumentFor = function melodyInstrumentForV21Ambient(mood, context = {}) {
  // Low/mid-low ambient colors, never glassy. Filters stay below the gameplay treble band.
  if (mood === 'menu' || mood === 'rest') return { lead: 'triangle', answer: 'sine', body: 'sawtooth', filter: 360, drift: 0.9994 };
  if (mood === 'portal' || mood === 'resolve') return { lead: 'sine', answer: 'triangle', body: 'triangle', filter: 410, drift: 0.9992 };
  if (mood === 'casino') return { lead: 'triangle', answer: 'square', body: 'sawtooth', filter: 390, drift: 0.9990 };
  if (mood === 'static') return { lead: 'triangle', answer: 'triangle', body: 'sawtooth', filter: 330, drift: 0.9988 };
  if (mood === 'chaos' || mood === 'boss_chaos') return { lead: 'sawtooth', answer: 'triangle', body: 'square', filter: 430, drift: 0.9986 };
  if (mood === 'boss') return { lead: 'sawtooth', answer: 'sine', body: 'triangle', filter: 410, drift: 0.9990 };
  return { lead: 'triangle', answer: 'sine', body: 'sawtooth', filter: 370, drift: 0.9992 };
};

AudioBus.prototype.ambientNote = function ambientNoteV21(freq, dur, type = 'triangle', vol = 0.012, filterFreq = 360, delay = 0, detune = 0, drift = 0.999) {
  if (!this.music?.master || !this.ctx) return;
  const t = this.ctx.currentTime + Math.max(0, delay);
  const o = this.ctx.createOscillator();
  const f = this.ctx.createBiquadFilter();
  const g = this.ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(24, freq), t);
  o.frequency.exponentialRampToValueAtTime(Math.max(24, freq * drift), t + Math.max(0.5, dur * 0.88));
  if (typeof o.detune?.setValueAtTime === 'function') o.detune.setValueAtTime(detune, t);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.max(120, filterFreq), t);
  f.Q.value = 0.65;
  const attack = Math.min(1.8, Math.max(0.42, dur * 0.18));
  const releaseStart = Math.max(t + attack + 0.08, t + dur * 0.68);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, vol), t + attack);
  g.gain.setTargetAtTime(Math.max(0.0001, vol * 0.72), t + attack, dur * 0.32);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(this.music.master);
  o.onended = () => { try { o.disconnect(); f.disconnect(); g.disconnect(); } catch {} };
  o.start(t);
  o.stop(t + dur + 0.08);
};

AudioBus.prototype.scoreEventWave = function scoreEventWaveV21(kind = 'start') {
  // Musical state marker: a restrained digital wave through the ambient bed.
  // It marks run start/restart/death without turning into a glossy heroic sweep.
  if (!this.music?.master || !this.ctx) return;
  const death = kind === 'death';
  const root = death ? 43.65 : 49.00;
  const notes = death ? [15, 10, 3, -2] : [0, 3, 7, 10]; // minor colour, not major fanfare
  const vol = death ? 0.0070 : 0.0060;
  notes.forEach((n, i) => {
    const f = root * Math.pow(2, n / 12);
    this.ambientNote(f, death ? 1.85 : 1.55, 'triangle', vol * (1 - i * 0.14), death ? 185 : 260, i * 0.115, i % 2 ? -7 : 5, death ? 0.982 : 0.992);
  });
  this.ambientNoise(death ? 1.9 : 1.25, death ? 0.0011 : 0.0008, death ? 155 : 420, 0.04);
};

AudioBus.prototype.ambientNoise = function ambientNoiseV21(dur = 4, vol = 0.002, filterFreq = 260, delay = 0) {
  if (!this.music?.master || !this.ctx) return;
  const sr = this.ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * dur));
  const buf = this.ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.985 + white * 0.015; // slow brown-ish drift
    const env = Math.sin(Math.PI * i / Math.max(1, len - 1));
    data[i] = last * env * 0.8;
  }
  const src = this.ctx.createBufferSource();
  src.buffer = buf;
  const bp = this.ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = filterFreq; bp.Q.value = 1.4;
  const g = this.ctx.createGain();
  const t = this.ctx.currentTime + Math.max(0, delay);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, vol), t + Math.min(1.2, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(this.music.master);
  src.onended = () => { try { src.disconnect(); bp.disconnect(); g.disconnect(); } catch {} };
  src.start(t); src.stop(t + dur + 0.08);
};

AudioBus.prototype.playDirgePhrase = function playDirgePhraseV21Ambient(context = {}) {
  if (!this.music?.master || !this.ctx) return;
  const mood = context.mood || this.musicMoodFor(context);
  const root = this.musicRootFor(context);
  const cells = this.musicMotifsFor({ ...context, mood });
  const seed = this.music.motifIndex++;
  const intensity = Math.max(0, Math.min(1, context.intensity || 0));
  const crowd = Math.max(0, Math.min(1, context.crowd || 0));
  const damage = Math.max(0, Math.min(1, context.damage || 0));
  const chaos = Math.max(0, Math.min(1, context.chaos || 0));
  const portal = Math.max(0, Math.min(1, context.portal || 0));
  const resolve = Math.max(0, Math.min(1, context.resolve || 0));
  const pressure = Math.max(intensity * 0.75, crowd * 0.55, damage * 0.70, chaos * 0.70, portal * 0.45, resolve * 0.35);
  const inst = this.melodyInstrumentFor(mood, context);
  const semitone = n => root * Math.pow(2, n / 12);
  const cellA = cells[seed % cells.length];
  const cellB = cells[(seed + 1) % cells.length];
  const cellC = cells[(seed + 2) % cells.length];
  const baseDur = mood === 'menu' ? 14.5 : mood === 'rest' ? 16.0 : mood === 'portal' ? 9.5 : mood === 'resolve' ? 11.0 : mood.includes('boss') ? 10.5 : mood === 'chaos' ? 8.5 : 12.0;
  const stepA = baseDur / Math.max(1, cellA.length);
  const stepB = (baseDur * 1.43) / Math.max(1, cellB.length);
  const stepC = (baseDur * 1.91) / Math.max(1, cellC.length);
  const leadVol = mood === 'menu' ? 0.011 : mood === 'rest' ? 0.0105 : mood === 'portal' || mood === 'resolve' ? 0.014 : 0.012 + pressure * 0.004;
  const answerVol = leadVol * 0.54;
  const bodyVol = 0.0042 + pressure * 0.0017;
  const filt = inst.filter + pressure * 46;

  // One long body tone: the bed. It is a tone color, not a sub-bass hook.
  const bodyNote = (cellA[cellA.length - 1] || 7) - 12;
  this.ambientNote(semitone(bodyNote), baseDur * 1.75, inst.body, bodyVol, 170 + pressure * 38, 0, -9, inst.drift);
  this.ambientNote(semitone((cellB[1] || 10) - 7), baseDur * 1.35, 'sine', bodyVol * 0.72, 210 + pressure * 35, stepA * 1.25, 7, 0.9993);

  // Three slow loops of different lengths, Eno-style: authored cells drift over each other.
  cellA.forEach((m, i) => {
    const delay = i * stepA + (i % 2 ? 0.08 : 0);
    this.ambientNote(semitone(m), stepA * 1.85, inst.lead, leadVol * (i === 0 ? 1.08 : 1), filt, delay, i % 2 ? -5 : 3, inst.drift);
  });
  cellB.forEach((m, i) => {
    const delay = 1.2 + i * stepB;
    this.ambientNote(semitone(m - 7), stepB * 1.55, inst.answer, answerVol, Math.max(190, filt - 80), delay, i % 2 ? 6 : -8, 0.9991);
  });
  if (mood !== 'menu' || seed % 2 === 0) {
    cellC.slice(0, 3).forEach((m, i) => {
      const delay = 2.8 + i * stepC;
      this.ambientNote(semitone(m - 12), stepC * 1.42, 'triangle', answerVol * 0.46, Math.max(160, filt - 130), delay, i % 2 ? -7 : 4, 0.9990);
    });
  }

  // State signatures stay low and soft.
  if (portal > 0.2) {
    this.ambientNote(semitone(12), 6.6, 'triangle', leadVol * 0.85, 360, 0.5, -4, 0.9988);
    this.ambientNote(semitone(7), 7.8, 'sine', leadVol * 0.58, 260, 2.0, 5, 0.9992);
  }
  if (resolve > 0.22) {
    this.ambientNote(semitone(7), 5.6, 'sine', leadVol * 0.75, 300, 0.8, -3, 0.9994);
    this.ambientNote(semitone(12), 7.0, 'triangle', leadVol * 0.62, 330, 2.7, 4, 0.9994);
  }
  if ((mood === 'static' || mood === 'chaos' || mood === 'boss_chaos') && seed % 2 === 0) {
    this.ambientNoise(4.8 + pressure * 2.4, 0.0015 + pressure * 0.0018, mood === 'static' ? 310 : 230, 0.4);
  }
};

AudioBus.prototype.ensureMusic = function ensureMusicV21Ambient() {
  if (!this.ctx || this.ctx.state !== 'running') return false;
  if (this.music) return true;
  const master = this.ctx.createGain();
  master.gain.value = 0.28;
  master.connect(this.musicGain || this.master);
  this.music = { master, layers: {}, phraseT: 0.20, motifIndex: 0, lastRoomTone: '', dangerPhrase: 0 };
  this.music.layers.drone = this.makeToneLayer(43.65, 'triangle', 190);
  this.music.layers.sub = this.makeToneLayer(21.8, 'sine', 42);
  this.music.layers.pulse = this.makeToneLayer(65.4, 'triangle', 85);
  this.music.layers.hat = this.makeNoiseLayer(520, 1.8);
  this.music.layers.casino = this.makeToneLayer(103.8, 'triangle', 260);
  this.music.layers.choir = this.makeToneLayer(130.8, 'sine', 360);
  this.music.layers.dirgePad = this.makeToneLayer(87.3, 'sawtooth', 210);
  this.music.layers.scrape = this.makeNoiseLayer(260, 1.2);
  this.music.layers.glass = this.makeToneLayer(174.6, 'triangle', 440); // not actually glassy now; low shimmer bed.
  return true;
};

AudioBus.prototype.updateMusic = function updateMusicV21Ambient(state, dt = 0.016) {
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
  const casino = !menu && (mods.includes('casino_virus') || mods.includes('greed'));
  const staticLike = mods.includes('static_rain') || mods.includes('prism_grid') || mods.includes('anchor_gravity');
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.28);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.30);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.28);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.30);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.36);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = Math.max(0, Math.min(1, enemies / 32));
  const bulletPressure = Math.max(0, Math.min(1, bullets / 90));
  const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
  const intensity = menu ? 0.04 : Math.max(0, Math.min(1, crowd * 0.26 + bulletPressure * 0.06 + lowHp * 0.14 + danger * 0.20 + damage * 0.20 + (boss ? 0.18 : 0) + (staticLike ? 0.07 : 0)));
  const portalOpen = !!room?.portal?.[2];
  const area = menu ? 'menu' : `${room?.cat || 'room'}:${room?.special || ''}:${mods.join(',')}:${portalOpen ? 'portal' : 'closed'}`;
  if (area !== this.musicLastArea) {
    this.musicTransition = Math.max(this.musicTransition || 0, 0.95);
    this.music.phraseT = Math.min(this.music.phraseT || 0, 0.08);
    this.musicLastArea = area;
  }
  const mood = this.musicMoodFor({ menu, boss, chill, casino, staticLike, combat, intensity, crowd, damage, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve });
  const root = this.musicRootFor({ menu, boss, chill, casino, staticLike, mood });
  const now = this.ctx.currentTime;
  const pulse = this.music.layers.pulse;
  const casinoL = this.music.layers.casino;
  const dirgePad = this.music.layers.dirgePad;
  const choirL = this.music.layers.choir;
  const glass = this.music.layers.glass;
  if (pulse) pulse.o.frequency.setTargetAtTime(root * 1.5, now, 4.5);
  if (casinoL) casinoL.o.frequency.setTargetAtTime(root * (casino ? 2.0 : 1.75), now, 5.5);
  if (dirgePad) { dirgePad.o.frequency.setTargetAtTime(root * 2, now, 6.0); dirgePad.f.frequency.setTargetAtTime(175 + intensity * 45, now, 4.5); }
  if (choirL) choirL.f.frequency.setTargetAtTime(260 + intensity * 70, now, 5.5);
  if (glass) glass.o.frequency.setTargetAtTime(root * 4, now, 7.0);
  const inGame = inGameMusicAmount(room, menu);
  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    this.playDirgePhrase({ boss, chill, casino, staticLike, combat, intensity: menu ? 0.035 : intensity, menu, damage, crowd, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve, transition: this.musicTransition, mood });
    const eventPull = Math.max(this.musicPortal || 0, this.musicResolve || 0, this.musicTransition || 0);
    const base = mood === 'menu' ? 12.5 : mood === 'rest' ? 14.0 : mood === 'portal' ? 8.2 : mood === 'resolve' ? 9.4 : mood.includes('boss') ? 9.2 : mood === 'chaos' ? 7.8 : 10.8;
    this.music.phraseT = Math.max(mood === 'chaos' ? 6.8 : 8.0, base - intensity * 1.1 - eventPull * 1.6);
  }
  // Background bed: obvious ambient, but not a bassline. No bright/high music layers.
  this.setMusicLayer('drone', inGame * (menu ? 0.0060 : (chill ? 0.0068 : 0.0075 + intensity * 0.0013)), 5.0);
  this.setMusicLayer('sub', menu ? 0.00005 : (combat && intensity > 0.82 ? 0.00008 + (intensity - 0.82) * 0.00012 : 0.00004), 5.5);
  this.setMusicLayer('pulse', combat && intensity > 0.72 ? (0.00010 + intensity * 0.00018) : 0.00005, 4.0);
  this.setMusicLayer('hat', 0.00008, 2.5);
  this.setMusicLayer('casino', casino ? (0.00055 + intensity * 0.00028) : 0.00005, 4.0);
  this.setMusicLayer('choir', inGame * (menu ? 0.0045 : (boss ? 0.0080 + intensity * 0.0025 : 0.0050 + intensity * 0.0014)), 5.0);
  this.setMusicLayer('dirgePad', inGame * (menu ? 0.0065 : (chill ? 0.0072 : 0.0080 + intensity * 0.0015)), 5.8);
  this.setMusicLayer('scrape', combat && (mood === 'chaos' || staticLike || damage > 0.48) ? (0.00025 + intensity * 0.00038) : 0.00005, 4.0);
  this.setMusicLayer('glass', (mood === 'portal' || mood === 'resolve') ? 0.0010 : 0.00005, 6.0);
};
