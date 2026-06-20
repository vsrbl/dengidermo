// terminal casino roguelike procedural audio: tiny terminal SFX with priority/cooldown limits
// No external assets. WebAudio is unlocked by the first user gesture.

const AC = () => globalThis.AudioContext || globalThis.webkitAudioContext;
const MUSIC_OUTPUT_GAIN = 56.00; // v2.1.47: music output is 10x louder than v2.1.46

function inGameMusicAmount(room, menu = false) { return menu ? 0.82 : (room ? 1 : 0); }

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.comp = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.musicVolume = this.readVolume('nnc_music_volume', 0.68);
    this.sfxVolume = this.readVolume('nnc_sfx_volume', 0.85);
    this.damageEnergy = 0;
    this.enabled = true;
    this.active = 0;
    this.maxVoices = 16;
    this.last = new Map();
    this.cooldowns = {
      shot_shg: 0.028, shot_sek: 0.12, shot: 0.04, impact: 0.028,
      rocket_launch: 0.10, rocket_blast: 0.16, blast: 0.11,
      dash: 0.07, dash_uncommon: 0.08, dash_rare: 0.09, dash_superrare: 0.11, dash_jackpot: 0.16, dash_dead_channel: 0.16, skin_legendary: 0.55, gld: 0.055, exp: 0.055, hea: 0.09, pickup: 0.05,
      hit: 0.05, phit: 0.12, denied: 0.22, chest_basic: 0.12, chest_weapon: 0.16,
      chest_ability: 0.16, chest_rare: 0.18, chest_cursed: 0.2,
      portal: 0.35, install: 0.18, jackpot: 0.4, active_snap: 0.24, active_blood: 0.24,
      active_over: 0.24, active_void_laser: 0.08, active: 0.24, enemy: 0.18, bet_open: 0.18, casino_win: 0.24,
      casino_lose: 0.28, casino_static: 0.28, casino_weapon: 0.3, casino_ability: 0.3,
      casino_spin: 0.09, casino_reel_stop: 0.06, casino_result: 0.16,
      contract: 0.35, debt: 0.28, shield: 0.12, echo_shot: 0.10, director_wave: 0.72, levelup: 0.42, run_start: 0.80, run_death: 0.80, static_storm: 0.42, ui_click: 0.045, combo_tick: 0.055, combo_drop: 0.18, combo_break: 0.25
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
      dash: 6, dash_uncommon: 6, dash_rare: 7, dash_superrare: 8, dash_jackpot: 8, dash_dead_channel: 8, skin_legendary: 9, chest_weapon: 6, chest_ability: 6, chest_rare: 7, chest_cursed: 7,
      active_snap: 7, active_blood: 7, active_over: 7, active_void_laser: 7, active: 7, enemy: 4,
      blast: 5, rocket_launch: 5, hit: 4, gld: 3, exp: 3, hea: 5, pickup: 3,
      shot_shg: 3, shot_sek: 3, shot: 2, impact: 2, install: 5, contract: 7, debt: 7, shield: 4, echo_shot: 5, director_wave: 6, levelup: 8, run_start: 8, run_death: 9, static_storm: 7, ui_click: 3, combo_tick: 4, combo_drop: 5, combo_break: 5
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
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setValueAtTime(MUSIC_OUTPUT_GAIN * this.musicVolume, this.ctx.currentTime);
    }
  }

  setSfxVolume(value) {
    this.sfxVolume = this.writeVolume('nnc_sfx_volume', value);
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
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
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.musicGain.gain.value = MUSIC_OUTPUT_GAIN * this.musicVolume;
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

  previewVolume(kind = 'sfx') {
    this.unlock();
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - (this.last.get('volume_preview') || -99) < 0.10) return;
    this.last.set('volume_preview', now);
    if (kind === 'music') {
      // v2.1.7: dry terminal slider tick routed through music gain.
      // No pitch glide/lowpass bubble; the preview should feel like UI hardware, not a liquid note.
      const out = this.musicGain || this.master;
      const click = this.ctx.createOscillator();
      const body = this.ctx.createOscillator();
      const clickFilter = this.ctx.createBiquadFilter();
      const bodyFilter = this.ctx.createBiquadFilter();
      const clickGain = this.ctx.createGain();
      const bodyGain = this.ctx.createGain();
      click.type = 'square';
      body.type = 'square';
      click.frequency.setValueAtTime(1046.5, now);
      body.frequency.setValueAtTime(261.63, now);
      clickFilter.type = 'bandpass'; clickFilter.frequency.value = 2400; clickFilter.Q.value = 8.0;
      bodyFilter.type = 'highpass'; bodyFilter.frequency.value = 360; bodyFilter.Q.value = 0.65;
      clickGain.gain.setValueAtTime(0.0001, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0048, now + 0.003);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);
      bodyGain.gain.setValueAtTime(0.0001, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.0028, now + 0.004);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      click.connect(clickFilter); clickFilter.connect(clickGain); clickGain.connect(out);
      body.connect(bodyFilter); bodyFilter.connect(bodyGain); bodyGain.connect(out);
      click.start(now); body.start(now + 0.002);
      click.stop(now + 0.045); body.stop(now + 0.060);
      // Tiny dry contact noise, also through music gain, gives slider movement a broken-terminal edge.
      const nDur = 0.018;
      const buffer = this.ctx.createBuffer(1, Math.max(1, Math.floor(this.ctx.sampleRate * nDur)), this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = this.ctx.createBufferSource();
      const nf = this.ctx.createBiquadFilter();
      const ng = this.ctx.createGain();
      src.buffer = buffer;
      nf.type = 'bandpass'; nf.frequency.value = 3800; nf.Q.value = 10;
      ng.gain.setValueAtTime(0.0022, now);
      ng.gain.exponentialRampToValueAtTime(0.0001, now + nDur);
      src.connect(nf); nf.connect(ng); ng.connect(out);
      src.start(now + 0.001); src.stop(now + nDur + 0.004);
      return;
    }
    // Route through current SFX gain so the preview represents the selected SFX volume.
    this.tone(520, 0.025, 'square', 0.020, 0.70);
    this.noise(0.012, 0.010, 4200, 10, 0.002);
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
      case 'combo_tick':
        this.noise(0.010, 0.010, 3600, 10);
        this.tone(523.25, 0.026, 'square', 0.016, 0.98);
        this.tone(1046.50, 0.018, 'square', 0.008, 0.98, 0.010);
        break;
      case 'combo_drop':
        this.noise(0.018, 0.018, 1100, 5);
        this.tone(196.00, 0.055, 'square', 0.020, 0.72);
        break;
      case 'combo_break':
        this.tone(174.61, 0.070, 'square', 0.024, 0.58);
        this.noise(0.035, 0.018, 1500, 4);
        break;
      case 'dash':
        this.tone(390, 0.045, 'square', 0.065, 2.25);
        this.tone(1050, 0.032, 'square', 0.045, 0.58, 0.015);
        this.noise(0.035, 0.032, 4600, 12);
        break;
      case 'dash_uncommon':
        this.tone(428, 0.050, 'square', 0.056, 1.64);
        this.tone(860, 0.040, 'triangle', 0.026, 0.88, 0.010);
        this.noise(0.030, 0.020, 5100, 11);
        break;
      case 'dash_rare':
        this.tone(312, 0.060, 'square', 0.060, 1.42);
        this.tone(930, 0.042, 'square', 0.034, 0.76, 0.020);
        this.noise(0.050, 0.028, 3400, 8);
        break;
      case 'dash_superrare':
        this.noise(0.012, 0.022, 6200, 16, 0.000);
        this.tone(208, 0.075, 'square', 0.056, 0.72, 0.000);
        this.tone(612, 0.050, 'square', 0.036, 1.12, 0.016);
        this.tone(1224, 0.030, 'triangle', 0.022, 0.84, 0.056);
        this.noise(0.070, 0.026, 4200, 10, 0.024);
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
        // Neutral terminal pickup: dry confirmation tick, no toy coin melody.
        this.noise(0.012, 0.0075, 1800, 7, 0.000);
        this.tone(246.94, 0.034, 'square', 0.014, 0.98, 0.002);
        break;
      case 'exp':
        // Neutral data pickup: slightly higher than GLD, still not cheerful.
        this.noise(0.012, 0.0070, 2100, 7, 0.000);
        this.tone(277.18, 0.036, 'square', 0.0135, 0.985, 0.002);
        break;
      case 'hea':
        // Soft neutral medical pickup: muted, stable, no happy up-chime.
        this.noise(0.014, 0.0065, 1450, 5.5, 0.000);
        this.tone(220.00, 0.044, 'triangle', 0.016, 1.01, 0.002);
        break;
      case 'pickup':
        this.noise(0.010, 0.0060, 1700, 6, 0.000);
        this.tone(233.08, 0.030, 'square', 0.012, 0.99, 0.002);
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
      case 'static_storm':
        this.noise(0.060, 0.018, 820, 5.2, 0.000);
        this.tone(92.50, 0.145, 'square', 0.030, 0.72, 0.012);
        this.tone(185.00, 0.095, 'triangle', 0.018, 0.86, 0.060);
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
    // v2.1.6 score rule: one shared terminal home note. Variation comes from rhythm,
    // register, timbre and room mood, not from changing key under long tails.
    return 49.00;
  }

  musicScaleFor(context = {}) {
    // Safe dark grid: minor-pentatonic / suspended intervals only.
    // No minor-second/tritone stack between active layers, so the music can be loud.
    return [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29, 31, 34, 36, 39, 41, 43, 46, 48, 51, 53, 55];
  }

  musicMoodFor(context = {}) {
    if (context.menu) return 'menu';
    if (context.portalOpen || context.portal > 0.25) return 'portal';
    if (context.resolve > 0.28) return 'resolve';
    if (context.boss) return context.intensity > 0.72 ? 'boss_chaos' : 'boss';
    if (context.chill) return 'rest';
    if (context.intensity > 0.78 || context.crowd > 0.70 || context.damage > 0.55 || context.chaos > 0.48) return 'chaos';
    if (context.intensity > 0.52 || context.crowd > 0.42 || context.combat) return context.staticLike ? 'static' : (context.casino ? 'casino' : 'combat');
    if (context.staticLike) return 'static';
    if (context.casino) return 'casino';
    return 'rest';
  }

  musicMotifsFor(context = {}) {
    // v2.1.6 expanded scorebook. Every motif uses the same safe interval grid,
    // but each mood has a different register/rhythm personality.
    const mood = context.mood || this.musicMoodFor(context);
    const sets = {
      menu: [
        [36, 39, 43, 39, 36],
        [31, 36, 39, 43, 48],
        [43, 41, 39, 36, 31],
        [29, 31, 36, 39, 36]
      ],
      rest: [
        [36, 39, 43, 48, 43, 39],
        [31, 36, 39, 41, 39, 36],
        [43, 39, 36, 31, 29],
        [48, 43, 39, 36]
      ],
      combat: [
        [24, 22, 19, 17, 19, 15, 12],
        [19, 22, 24, 19, 17, 15, 12],
        [27, 24, 22, 19, 17, 19, 22],
        [31, 29, 24, 22, 19, 17, 15]
      ],
      chaos: [
        [31, 29, 24, 22, 19, 17, 15, 12],
        [24, 27, 24, 22, 19, 15, 12],
        [36, 31, 29, 24, 22, 19, 17],
        [19, 22, 24, 29, 24, 22, 19]
      ],
      static: [
        [39, 36, 31, 29, 24, 22],
        [43, 39, 36, 31, 29],
        [31, 36, 31, 29, 24, 19],
        [48, 43, 39, 36, 31]
      ],
      casino: [
        [36, 39, 36, 31, 29, 24],
        [43, 39, 36, 39, 31],
        [31, 36, 39, 36, 31, 29],
        [48, 43, 39, 36, 39, 31]
      ],
      boss: [
        [24, 22, 19, 17, 15, 12, 10],
        [31, 29, 24, 22, 19, 17],
        [36, 31, 29, 24, 22, 19],
        [19, 24, 22, 19, 17, 15, 12]
      ],
      boss_chaos: [
        [36, 31, 29, 24, 22, 19, 17, 15],
        [43, 36, 31, 29, 24, 22, 19],
        [31, 36, 31, 29, 24, 19, 17]
      ],
      portal: [
        [43, 48, 43, 39, 36],
        [36, 39, 43, 48, 51],
        [48, 43, 39, 36]
      ],
      resolve: [
        [36, 39, 43, 39, 36],
        [31, 36, 39, 36, 31],
        [43, 48, 43, 39, 36]
      ]
    };
    return sets[mood] || sets.combat;
  }

  musicHighMotifsFor(context = {}) {
    const mood = context.mood || this.musicMoodFor(context);
    if (mood === 'chaos' || mood === 'boss_chaos') return [[43, 48, 43], [39, 43, 48, 53], [48, 51, 48, 43]];
    if (mood === 'combat' || mood === 'boss') return [[36, 39, 43], [43, 39, 36], [31, 36, 39, 43]];
    if (mood === 'static') return [[48, 43, 39], [51, 48, 43, 39], [43, 48, 43]];
    if (mood === 'casino') return [[43, 39, 43, 48], [36, 39, 36, 31], [48, 43, 39]];
    return [[48, 43, 39, 36], [43, 48, 53, 48], [39, 43, 48]];
  }

  musicDriveMotifsFor(context = {}) {
    const mood = context.mood || this.musicMoodFor(context);
    if (mood === 'boss' || mood === 'boss_chaos') return [[12, 12, 15, 12, 17, 15, 12, 10], [12, 17, 12, 19, 17, 15, 12]];
    if (mood === 'chaos') return [[12, 15, 12, 17, 12, 19, 17, 15], [17, 12, 17, 19, 17, 15, 12]];
    if (mood === 'static') return [[12, 19, 12, 17, 12, 15], [15, 12, 15, 19, 15, 12]];
    if (mood === 'casino') return [[12, 15, 12, 19, 15, 12], [19, 15, 12, 15, 19, 24]];
    return [[12, 12, 15, 12, 17, 12], [12, 15, 17, 15, 12, 10]];
  }

  melodyInstrumentFor(mood, context = {}) {
    if (mood === 'menu' || mood === 'rest') return { lead: 'sine', answer: 'triangle', filter: 1680, step: 1.18, high: 1.25, drive: 0.0 };
    if (mood === 'resolve') return { lead: 'sine', answer: 'triangle', filter: 1720, step: 0.92, high: 1.15, drive: 0.1 };
    if (mood === 'portal') return { lead: 'triangle', answer: 'sine', filter: 1780, step: 0.78, high: 1.20, drive: 0.25 };
    if (mood === 'casino') return { lead: 'triangle', answer: 'square', filter: 1420, step: 0.66, high: 0.95, drive: 0.46 };
    if (mood === 'static') return { lead: 'triangle', answer: 'sine', filter: 1320, step: 0.70, high: 1.05, drive: 0.38 };
    if (mood === 'chaos' || mood === 'boss_chaos') return { lead: 'sawtooth', answer: 'triangle', filter: 1500, step: 0.50, high: 0.70, drive: 0.95 };
    if (mood === 'boss') return { lead: 'triangle', answer: 'sawtooth', filter: 1360, step: 0.58, high: 0.78, drive: 0.82 };
    return { lead: 'triangle', answer: 'sine', filter: 1360, step: 0.66, high: 0.86, drive: 0.58 };
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
    const semitone = n => root * Math.pow(2, n / 12);

    const phraseSeed = this.music.motifIndex++;
    const pressure = Math.max(intensity, crowd * 0.82, damage * 0.92, chaos * 0.88, portal * 0.35, transition * 0.25);
    const motifs = this.musicMotifsFor({ ...context, mood });
    const motif = motifs[(phraseSeed + Math.floor(pressure * motifs.length)) % motifs.length];
    const highs = this.musicHighMotifsFor({ ...context, mood });
    const highMotif = highs[(phraseSeed + (casino ? 1 : 0) + (staticLike ? 2 : 0)) % highs.length];
    const drives = this.musicDriveMotifsFor({ ...context, mood });
    const driveMotif = drives[(phraseSeed + (boss ? 1 : 0) + Math.floor(pressure * 3)) % drives.length];
    const inst = this.melodyInstrumentFor(mood, context);
    const step = Math.max(0.40, inst.step - pressure * (mood.includes('chaos') ? 0.10 : 0.04));
    const swing = casino ? 0.10 : staticLike ? 0.07 : mood.includes('chaos') ? 0.035 : 0.055;

    // Loud-capable music: phrases are more present, while fixed intervals prevent sour stacks.
    const baseVol = menu ? 0.034 : mood === 'rest' ? 0.032 : mood === 'portal' ? 0.058 : mood === 'resolve' ? 0.052 : 0.044 + pressure * 0.030;
    const leadVol = baseVol * (transition > 0.2 ? 1.06 : 1);
    const answerVol = leadVol * (mood.includes('chaos') ? 0.34 : 0.42);
    const highVol = leadVol * inst.high * (menu || mood === 'rest' ? 0.46 : 0.31 + pressure * 0.13);
    const driveVol = leadVol * inst.drive * (0.42 + pressure * 0.28);
    const filterBase = inst.filter + pressure * 340;

    // Main melodic phrase.
    motif.forEach((m, i) => {
      if ((mood === 'menu' || mood === 'rest') && i > 5) return;
      const delay = i * step * (1 + (i % 2 ? swing : -swing * 0.35));
      const longLast = i === motif.length - 1;
      const dur = step * (longLast ? (mood === 'portal' || mood === 'resolve' ? 2.15 : 1.55) : (mood.includes('chaos') ? 0.82 : 1.02));
      const f = semitone(m);
      const accent = i === 0 || longLast ? 1.12 : (i % 3 === 0 ? 1.05 : 1);
      this.musicNote(f, dur, inst.lead, leadVol * accent, filterBase + i * 52, delay, 1, 0);

      // Lower answer keeps phrases musical but never creates a second competing key.
      if (!menu && i % 2 === 1 && i < motif.length - 1) {
        const lower = Math.max(0, motif[Math.max(0, i - 1)] - (mood === 'portal' ? 7 : 12));
        this.musicNote(semitone(lower), step * 1.35, inst.answer, answerVol, 740 + pressure * 220, delay + step * 0.42, 1, 0);
      }

      if ((mood === 'static' || damage > 0.42 || mood.includes('chaos')) && i % 3 === 2) {
        this.musicDust(0.040 + pressure * 0.036, 0.0016 + pressure * 0.0030, 3600 + i * 190, delay + 0.035);
      }
    });

    // Calm high notes: always available in low-pressure/rest/menu, sometimes between fights.
    const shouldHigh = menu || mood === 'rest' || mood === 'portal' || mood === 'resolve' || pressure < 0.58 || phraseSeed % 2 === 0;
    if (shouldHigh) {
      highMotif.forEach((m, i) => {
        const delay = step * (0.65 + i * (mood === 'rest' || menu ? 1.10 : 0.72));
        const dur = step * (mood === 'rest' || menu ? 2.55 : 1.65);
        const type = i % 2 ? 'triangle' : 'sine';
        this.musicNote(semitone(m), dur, type, highVol * (i === 0 ? 0.95 : 0.72), 1500 + i * 170 + pressure * 260, delay, 1, 0);
      });
    }

    // Dark drive line: only when the room needs motion. It is melodic, not a detuned drone.
    const shouldDrive = !menu && !context.chill && (context.combat || boss || mood === 'casino' || mood === 'static' || mood.includes('chaos')) && pressure > 0.30;
    if (shouldDrive) {
      const dStep = Math.max(0.18, step * (mood.includes('chaos') ? 0.40 : 0.50));
      driveMotif.forEach((m, i) => {
        if (i > 7) return;
        const delay = i * dStep;
        const dur = dStep * (mood.includes('chaos') ? 0.72 : 0.86);
        const type = mood.includes('chaos') || boss ? 'sawtooth' : 'square';
        const accent = i === 0 || i === 4 ? 1.20 : 0.88;
        this.musicNote(semitone(m), dur, type, driveVol * accent, 460 + pressure * 260, delay, 1, 0);
      });
    }

    // Event signatures: portal / objective complete / scene transition.
    if (portal > 0.20) {
      const when = step * 0.72;
      this.musicNote(semitone(48), step * 2.25, 'sine', leadVol * 0.58, 1840, when, 1, 0);
      this.musicNote(semitone(43), step * 2.60, 'triangle', leadVol * 0.40, 1200, when + step * 0.72, 1, 0);
    } else if (resolve > 0.20) {
      this.musicNote(semitone(43), step * 1.70, 'triangle', leadVol * 0.48, 1280, step * 0.86, 1, 0);
      this.musicNote(semitone(48), step * 2.00, 'sine', leadVol * 0.38, 1760, step * 1.42, 1, 0);
    } else if (transition > 0.22) {
      this.musicNote(semitone(24), step * 2.10, 'triangle', leadVol * 0.34, 760, step * 0.32, 1, 0);
    }

    // Extra high lament for danger: quiet enough to be musical, clear enough to be noticed.
    if ((crowd > 0.52 || damage > 0.34 || boss || mood.includes('chaos')) && phraseSeed % 2 === 1) {
      const a = highMotif[(phraseSeed + 1) % highMotif.length];
      const b = highMotif[(phraseSeed + 2) % highMotif.length];
      const when = step * (1.05 + ((phraseSeed % 3) * 0.18));
      this.musicNote(semitone(a), step * 1.70, 'sine', highVol * 0.82, 1680 + pressure * 260, when, 1, 0);
      if (pressure > 0.64) this.musicNote(semitone(b), step * 1.95, 'triangle', highVol * 0.54, 1340 + pressure * 220, when + step * 0.58, 1, 0);
    }
  }

  ensureMusic() {
    if (!this.ctx || this.ctx.state !== 'running') return false;
    if (this.music) return true;
    const master = this.ctx.createGain();
    master.gain.value = 0.30;
    master.connect(this.musicGain || this.master);
    this.music = { master, layers: {}, phraseT: 0.35, motifIndex: 0, lastRoomTone: '', dangerPhrase: 0, scoreT: 0 };
    this.music.layers.drone = this.makeToneLayer(49, 'sawtooth', 340);
    this.music.layers.sub = this.makeToneLayer(24.5, 'sine', 70);
    this.music.layers.pulse = this.makeToneLayer(98, 'square', 150);
    this.music.layers.hat = this.makeNoiseLayer(4800, 10);
    this.music.layers.casino = this.makeToneLayer(294, 'square', 620);
    this.music.layers.choir = this.makeToneLayer(196, 'triangle', 780);
    this.music.layers.dirgePad = this.makeToneLayer(98, 'triangle', 360);
    this.music.layers.scrape = this.makeNoiseLayer(760, 3.8);
    this.music.layers.glass = this.makeToneLayer(392, 'sine', 1500);
    this.music.layers.highPad = this.makeToneLayer(784, 'sine', 2100);
    this.music.layers.drive = this.makeToneLayer(147, 'sawtooth', 460);
    this.music.layers.needle = this.makeNoiseLayer(1850, 5.2);
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
    const staticLike = mods.includes('static_rain') || mods.includes('prism_grid');
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
      const highPad = this.music.layers.highPad;
      const drive = this.music.layers.drive;
      const needle = this.music.layers.needle;
      if (pulse) pulse.o.frequency.setTargetAtTime(root * (combat && intensity > 0.72 ? 2.5 : 2), now, 1.3);
      if (casinoL) casinoL.o.frequency.setTargetAtTime(root * (casino ? 7 : 4) * (casino && intensity > 0.70 ? Math.pow(2, 3/12) : 1), now, 1.2);
      if (dirgePad) {
        const base = root * (menu ? 1 : (boss ? 1.5 : chill ? 1.5 : 2));
        const wound = staticLike ? Math.pow(2, -2 / 12) : (casino ? Math.pow(2, -6 / 12) : 1);
        dirgePad.o.frequency.setTargetAtTime(base * wound, now, 1.4);
        dirgePad.f.frequency.setTargetAtTime(staticLike ? 310 : (boss ? 360 : 440), now, 1.2);
      }
      if (choirL) choirL.f.frequency.setTargetAtTime((boss || choir) ? 680 + intensity * 260 : 560 + intensity * 180, now, 1.4);
      if (glass) glass.o.frequency.setTargetAtTime(root * (menu ? 16 : (casino ? 12 : staticLike ? 10 : 12)), now, 1.6);
      if (highPad) {
        const highMul = menu || chill ? 16 : (portalOpen ? 18 : (intensity < 0.50 ? 14 : 12));
        highPad.o.frequency.setTargetAtTime(root * highMul, now, 2.4);
        highPad.f.frequency.setTargetAtTime(menu || chill ? 2200 : 1600 + intensity * 420, now, 2.2);
      }
      if (drive) {
        const driveMul = boss ? 3 : (mood === 'chaos' ? 3.5 : casino ? 4 : staticLike ? 3 : 2.5);
        drive.o.frequency.setTargetAtTime(root * driveMul, now, 1.1);
        drive.f.frequency.setTargetAtTime(360 + intensity * 360, now, 1.0);
      }
      if (needle) needle.f.frequency.setTargetAtTime(staticLike ? 2100 : (casino ? 2600 : 1750 + intensity * 680), now, 1.2);
    }

    const inGame = inGameMusicAmount(room, menu);
    this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
    if ((room || menu) && this.music.phraseT <= 0) {
      this.playDirgePhrase({ boss, chill, casino, staticLike, combat, intensity: menu ? 0.10 : intensity, menu, damage, crowd: alivePressure, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve, transition: this.musicTransition, mood });
      const eventPull = Math.max(this.musicPortal || 0, this.musicResolve || 0, this.musicTransition || 0);
      const calmBase = mood === 'menu' ? 4.8 : mood === 'rest' ? 5.8 : mood === 'portal' ? 2.6 : mood === 'resolve' ? 3.1 : mood.includes('boss') ? 2.65 : mood === 'chaos' ? 2.35 : 3.55;
      this.music.phraseT = Math.max(mood === 'chaos' ? 1.55 : 2.05, calmBase - intensity * 0.70 - alivePressure * 0.35 - eventPull * 1.1);
    }

    // v2.1.6: richer score, still tonal-locked. More music is allowed to be loud,
    // but each layer has a distinct register so it does not sour into false chords.
    this.setMusicLayer('drone', inGame * (menu ? 0.0058 : (chill ? 0.0054 : 0.0065 + intensity * 0.0022)), 2.4);
    this.setMusicLayer('sub', menu ? 0.00004 : (combat ? (0.00006 + Math.max(0, intensity - 0.76) * 0.00052 + (boss ? 0.00016 : 0)) : 0.00004), 1.8);
    this.setMusicLayer('pulse', menu ? 0.00004 : (combat && intensity > 0.58 ? (0.00008 + intensity * 0.00036) : (portalOpen ? 0.00010 : 0.00004)), 1.2);
    this.setMusicLayer('hat', combat && (mood === 'chaos' || intensity > 0.62) ? (0.00035 + Math.max(0, intensity - 0.46) * 0.0038) : 0.0001, 0.8);
    this.setMusicLayer('casino', casino ? (0.00055 + intensity * 0.00120) : 0.0001, 1.4);
    this.setMusicLayer('choir', menu ? 0.0042 : (choir || boss ? (0.0075 + intensity * 0.0135) : (0.0040 + intensity * 0.0055)), 2.0);
    this.setMusicLayer('dirgePad', inGame * (menu ? 0.0060 : (chill ? 0.0055 : 0.0068 + intensity * 0.0046 + (lowHp * 0.0018))), 2.6);
    this.setMusicLayer('scrape', combat && (mood === 'chaos' || staticLike || damage > 0.34) ? (0.00050 + intensity * 0.0018) : 0.0001, 1.2);
    this.setMusicLayer('glass', menu ? 0.0018 : ((mood === 'portal' || mood === 'resolve' || intensity < 0.58 || chill) ? 0.0015 + (1 - intensity) * 0.0016 : 0.00035), 2.2);
    this.setMusicLayer('highPad', menu ? 0.0018 : ((chill || mood === 'rest' || intensity < 0.56 || portalOpen) ? 0.0014 + (1 - intensity) * 0.0018 : 0.00032), 3.0);
    this.setMusicLayer('drive', combat && intensity > 0.42 ? 0.00025 + intensity * 0.0019 + (boss ? 0.0008 : 0) : 0.0001, 1.0);
    this.setMusicLayer('needle', combat && (staticLike || casino || mood === 'chaos' || intensity > 0.70) ? 0.00025 + intensity * 0.0013 : 0.0001, 1.0);
  }


  handleFx(f, info = {}) {
    if (f?.t === 'ehit' || f?.t === 'armor_shell' || f?.t === 'active_tick' || f?.t === 'active_line_tick' || f?.t === 'blast') {
      this.damageEnergy = Math.min(1, (this.damageEnergy || 0) + 0.045);
      this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.040);
    }
    if (f?.t === 'portal_open') { this.musicPortal = 1; this.musicTransition = Math.max(this.musicTransition || 0, 0.7); if (this.music) this.music.phraseT = Math.min(this.music.phraseT || 0, 0.05); }
    if (f?.t === 'room_invoice' || f?.t === 'contract_done' || f?.t === 'boss_down' || f?.t === 'skin_unlock') { this.musicResolve = 1; if (this.music) this.music.phraseT = Math.min(this.music.phraseT || 0, 0.08); }
    // v2.1 loop2 mob SFX hotfix: enemy_combo is a visual/readability marker for
    // support auras and pack synergies, not an actual wave-arrival event. It used
    // to fire the same sting as director waves, which made loop 2 mobs sound like
    // strange one-off events. Only real director waves / casino spins may push
    // the music into chaos here.
    if (f?.t === 'director_wave' || f?.t === 'casino_virus_spin') { this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.24); }
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
      case 'combo_tick': if (mine) this.play('combo_tick'); break;
      case 'combo_drop': if (mine) this.play('combo_drop'); break;
      case 'combo_break': this.play('combo_break'); break;
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
      case 'rain_hit': this.play('static_storm'); this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.18); break;
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
      case 'enemy_combo':
        // Enemy combo markers are informational/visual only. Do not play
        // wave/director audio for ordinary mob synergies in loop 1/2+.
        break;
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
  const depth = Math.max(0, Number(room?.depth || 0));
  const loop = Math.max(0, Math.floor(depth / 4));
  const loopHeat = Math.max(0, Math.min(1, loop / 5));
  const bullets = latest?.bullets?.length || 0;
  const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.35) : 0;
  const mods = room?.mods || [];
  const combat = !menu && room?.phase === 'play' && !room?.portal?.[2] && room?.cat !== 'chill';
  const boss = !menu && room?.cat === 'boss';
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const casino = !menu && (mods.includes('casino_virus') || mods.includes('greed'));
  const staticLike = mods.includes('static_rain') || mods.includes('prism_grid');
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
  this.music.layers.drone = this.makeToneLayer(43.65, 'sine', 130); // neutral low bed; no delayed harsh drone swell
  this.music.layers.sub = this.makeToneLayer(21.8, 'sine', 42);
  this.music.layers.pulse = this.makeToneLayer(65.4, 'triangle', 85);
  this.music.layers.hat = this.makeNoiseLayer(520, 1.8);
  this.music.layers.casino = this.makeToneLayer(103.8, 'triangle', 260);
  this.music.layers.choir = this.makeToneLayer(130.8, 'sine', 360);
  this.music.layers.dirgePad = this.makeToneLayer(87.3, 'triangle', 190);
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
  const depth = Math.max(0, Number(room?.depth || 0));
  const loop = Math.max(0, Math.floor(depth / 4));
  const loopHeat = Math.max(0, Math.min(1, loop / 5));
  const bullets = latest?.bullets?.length || 0;
  const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.35) : 0;
  const mods = room?.mods || [];
  const combat = !menu && room?.phase === 'play' && !room?.portal?.[2] && room?.cat !== 'chill';
  const boss = !menu && room?.cat === 'boss';
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const casino = !menu && (mods.includes('casino_virus') || mods.includes('greed'));
  const staticLike = mods.includes('static_rain') || mods.includes('prism_grid');
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.28);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.30);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.28);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.30);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.36);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = Math.max(0, Math.min(1, enemies / 32));
  const bulletPressure = Math.max(0, Math.min(1, bullets / 90));
  const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
  const intensity = menu ? 0.04 : Math.max(0, Math.min(1, crowd * 0.34 + bulletPressure * 0.08 + lowHp * 0.14 + danger * 0.18 + damage * 0.20 + loopHeat * 0.26 + (boss ? 0.20 : 0) + (staticLike ? 0.09 : 0)));
  const musicDangerLift = 1 + loopHeat * 0.65 + crowd * 0.35;
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
    this.music.phraseT = Math.max(mood === 'chaos' ? 4.8 : (chill || portalOpen ? 8.0 : 6.4), base - intensity * 1.8 - eventPull * 1.6 - loopHeat * 2.1 - crowd * 1.2);
  }
  // Background bed: obvious ambient, but not a bassline. No bright/high music layers.
  // Drone bed hotfix: quieter and quicker to settle. The old 5s swell felt like a delayed unpleasant drone.
  this.setMusicLayer('drone', inGame * (menu ? 0.0028 : (chill ? 0.0030 : 0.0034 + intensity * 0.00055)), 0.85);
  this.setMusicLayer('sub', menu ? 0.000035 : (combat && intensity > 0.82 ? 0.000055 + (intensity - 0.82) * 0.00008 : 0.00003), 1.25);
  this.setMusicLayer('pulse', combat && intensity > 0.62 ? (0.00007 + intensity * 0.00018 + loopHeat * 0.00018) : 0.000035, 0.9);
  this.setMusicLayer('hat', 0.000055, 0.85);
  this.setMusicLayer('casino', casino ? (0.00038 + intensity * 0.00018) : 0.00004, 1.20);
  this.setMusicLayer('choir', inGame * (menu ? 0.0036 : (boss ? 0.0064 + intensity * 0.0026 : 0.0040 + intensity * 0.0016) * musicDangerLift), 1.18);
  this.setMusicLayer('dirgePad', inGame * (menu ? 0.0044 : (chill ? 0.0042 : (0.0052 + intensity * 0.0018) * musicDangerLift)), 1.15);
  this.setMusicLayer('scrape', combat && (mood === 'chaos' || staticLike || damage > 0.48 || loopHeat > 0.45) ? (0.00018 + intensity * 0.00034 + loopHeat * 0.00016) : 0.000035, 0.9);
  this.setMusicLayer('glass', (mood === 'portal' || mood === 'resolve') ? 0.00072 : 0.000035, 1.5);
};


// v2.1.6 EXPANDED SCORE MUSIC REWORK
// Problem fixed: long ambient cells from different room/mood roots could overlap and sound like false harmony.
// New rule: expanded dark scorebook, louder music headroom, calm high notes + drive motifs, no detune/drift,
// and a small music voice budget. Mood changes are timbre/rhythm/filter changes, not key changes.
AudioBus.prototype.musicRootFor = function musicRootForV215TonalLock(context = {}) {
  return 43.65; // F1 anchor for every room; no cross-room key clashes.
};

AudioBus.prototype.musicMoodFor = function musicMoodForV215TonalLock(context = {}) {
  if (context.menu) return 'menu';
  if (context.portalOpen || context.portal > 0.22) return 'portal';
  if (context.resolve > 0.22) return 'resolve';
  if (context.boss) return context.intensity > 0.74 || context.chaos > 0.55 ? 'boss_chaos' : 'boss';
  if (context.chill) return 'rest';
  if (context.intensity > 0.84 || context.crowd > 0.80 || context.damage > 0.68 || context.chaos > 0.62) return 'chaos';
  if (context.staticLike) return 'static';
  if (context.casino) return 'casino';
  if (context.combat) return 'combat';
  return 'rest';
};

AudioBus.prototype.musicMotifsFor = function musicMotifsForV215TonalLock(context = {}) {
  const mood = context.mood || this.musicMoodFor(context);
  // Minor-pentatonic / suspended-safe cells only: no semitone clusters, no tritone cells.
  // Variation comes from register and timing, not from unstable pitch sets.
  const cells = {
    menu: [[12, 10, 7], [15, 12, 10], [7, 10, 12], [19, 15, 12]],
    rest: [[12, 10, 7], [15, 12, 7], [10, 7, 5], [19, 15, 12]],
    combat: [[12, 10, 7, 5], [15, 12, 10, 7], [19, 15, 12, 10], [10, 7, 5, 3]],
    chaos: [[15, 12, 10, 7], [19, 15, 12, 7], [22, 19, 15, 12], [12, 10, 7, 3]],
    static: [[12, 10, 7], [17, 12, 10], [15, 10, 7], [19, 17, 12]],
    casino: [[12, 15, 12, 10], [19, 15, 12], [10, 12, 15], [22, 19, 15]],
    boss: [[12, 10, 7, 3], [19, 15, 12, 10], [22, 19, 15], [15, 12, 7]],
    boss_chaos: [[19, 15, 12, 10], [22, 19, 15, 12], [24, 22, 19, 15], [15, 12, 10, 7]],
    portal: [[12, 15, 19], [19, 15, 12], [7, 10, 12], [24, 19, 15]],
    resolve: [[7, 10, 12], [12, 15, 19], [10, 12, 15], [5, 7, 10, 12]]
  };
  return cells[mood] || cells.combat;
};

AudioBus.prototype.melodyInstrumentFor = function melodyInstrumentForV215TonalLock(mood, context = {}) {
  // No sawtooth/square lead in the score. Those belong to SFX. Music uses filtered sine/triangle.
  if (mood === 'menu' || mood === 'rest') return { lead: 'triangle', answer: 'sine', body: 'sine', filter: 300 };
  if (mood === 'portal' || mood === 'resolve') return { lead: 'sine', answer: 'triangle', body: 'triangle', filter: 350 };
  if (mood === 'casino') return { lead: 'triangle', answer: 'triangle', body: 'sine', filter: 330 };
  if (mood === 'static') return { lead: 'triangle', answer: 'sine', body: 'sine', filter: 285 };
  if (mood === 'chaos' || mood === 'boss_chaos') return { lead: 'triangle', answer: 'sine', body: 'triangle', filter: 360 };
  if (mood === 'boss') return { lead: 'triangle', answer: 'sine', body: 'triangle', filter: 340 };
  return { lead: 'triangle', answer: 'sine', body: 'sine', filter: 315 };
};

AudioBus.prototype.ambientNote = function ambientNoteV215(freq, dur, type = 'triangle', vol = 0.006, filterFreq = 320, delay = 0, detune = 0, drift = 1) {
  if (!this.music?.master || !this.ctx) return;
  this.music.voiceCount = this.music.voiceCount || 0;
  const maxVoices = this.music.maxVoices || 7;
  if (this.music.voiceCount >= maxVoices) return;
  const t = this.ctx.currentTime + Math.max(0, delay);
  const o = this.ctx.createOscillator();
  const f = this.ctx.createBiquadFilter();
  const g = this.ctx.createGain();
  o.type = (type === 'sawtooth' || type === 'square') ? 'triangle' : type;
  o.frequency.setValueAtTime(Math.max(24, freq), t);
  // No pitch drift. The previous slow drift made overlapping cells feel out of tune.
  if (typeof o.detune?.setValueAtTime === 'function') o.detune.setValueAtTime(0, t);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.max(120, filterFreq), t);
  f.Q.value = 0.45;
  const attack = Math.min(0.95, Math.max(0.18, dur * 0.16));
  const safeVol = Math.max(0.0001, vol);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(safeVol, t + attack);
  g.gain.setTargetAtTime(Math.max(0.0001, safeVol * 0.62), t + attack, Math.max(0.18, dur * 0.26));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(this.music.master);
  this.music.voiceCount++;
  o.onended = () => {
    this.music.voiceCount = Math.max(0, (this.music.voiceCount || 1) - 1);
    try { o.disconnect(); f.disconnect(); g.disconnect(); } catch {}
  };
  o.start(t);
  o.stop(t + dur + 0.05);
};

AudioBus.prototype.ambientNoise = function ambientNoiseV215(dur = 3.2, vol = 0.0012, filterFreq = 240, delay = 0) {
  if (!this.music?.master || !this.ctx) return;
  this.music.voiceCount = this.music.voiceCount || 0;
  if (this.music.voiceCount >= (this.music.maxVoices || 7)) return;
  const sr = this.ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * dur));
  const buf = this.ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.992 + white * 0.008;
    const env = Math.sin(Math.PI * i / Math.max(1, len - 1));
    data[i] = last * env * 0.72;
  }
  const src = this.ctx.createBufferSource();
  src.buffer = buf;
  const bp = this.ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = filterFreq; bp.Q.value = 0.95;
  const g = this.ctx.createGain();
  const t = this.ctx.currentTime + Math.max(0, delay);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, vol), t + Math.min(0.9, dur * 0.22));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp); bp.connect(g); g.connect(this.music.master);
  this.music.voiceCount++;
  src.onended = () => {
    this.music.voiceCount = Math.max(0, (this.music.voiceCount || 1) - 1);
    try { src.disconnect(); bp.disconnect(); g.disconnect(); } catch {}
  };
  src.start(t); src.stop(t + dur + 0.05);
};

AudioBus.prototype.playDirgePhrase = function playDirgePhraseV215TonalLock(context = {}) {
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
  const pressure = Math.max(intensity * 0.55, crowd * 0.42, damage * 0.58, chaos * 0.52, portal * 0.35, resolve * 0.30);
  const inst = this.melodyInstrumentFor(mood, context);
  const semitone = n => root * Math.pow(2, n / 12);
  const cell = cells[seed % cells.length];
  const phraseDur = mood === 'menu' ? 11.5 : mood === 'rest' ? 12.5 : mood === 'portal' ? 7.6 : mood === 'resolve' ? 8.4 : mood.includes('boss') ? 8.2 : mood === 'chaos' ? 7.2 : 9.0;
  const step = phraseDur / Math.max(3, cell.length + 1);
  const filt = inst.filter + pressure * 34;
  const leadVol = mood === 'menu' ? 0.0054 : mood === 'rest' ? 0.0048 : mood === 'portal' || mood === 'resolve' ? 0.0066 : 0.0058 + pressure * 0.0016;
  const bodyVol = 0.0018 + pressure * 0.0008;

  // A single pedal tone keeps the bed grounded; it never competes melodically.
  const pedal = mood.includes('boss') ? -12 : (mood === 'portal' || mood === 'resolve' ? 0 : -12);
  this.ambientNote(semitone(pedal), Math.min(6.8, phraseDur * 0.72), inst.body, bodyVol, 165 + pressure * 26, 0, 0, 1);

  // One monophonic cell only. No stacked polyrhythmic cells; no cross-key shimmer.
  cell.slice(0, 4).forEach((m, i) => {
    const d = i * step + (mood === 'casino' ? 0.055 * (i % 2) : 0);
    const dur = Math.max(1.05, Math.min(2.05, step * (mood === 'chaos' ? 0.72 : 0.86)));
    const accent = i === 0 ? 1.08 : 0.86;
    this.ambientNote(semitone(m), dur, inst.lead, leadVol * accent, filt, d, 0, 1);
  });

  // Mood signatures are consonant octave/fifth markers, not new harmony.
  if (portal > 0.2) {
    this.ambientNote(semitone(19), 2.8, 'sine', leadVol * 0.55, 330, step * 0.7, 0, 1);
  } else if (resolve > 0.22) {
    this.ambientNote(semitone(12), 2.9, 'sine', leadVol * 0.50, 320, step * 0.8, 0, 1);
  } else if ((mood === 'static' || mood === 'chaos' || mood === 'boss_chaos') && seed % 2 === 0) {
    this.ambientNoise(3.6 + pressure * 1.4, 0.00065 + pressure * 0.00075, mood === 'static' ? 245 : 210, 0.25);
  }
};

AudioBus.prototype.ensureMusic = function ensureMusicV215TonalLock() {
  if (!this.ctx || this.ctx.state !== 'running') return false;
  if (this.music) return true;
  const master = this.ctx.createGain();
  master.gain.value = 0.30;
  master.connect(this.musicGain || this.master);
  this.music = { master, layers: {}, phraseT: 0.24, motifIndex: 0, lastRoomTone: '', dangerPhrase: 0, voiceCount: 0, maxVoices: 7 };
  const root = this.musicRootFor({});
  this.music.layers.drone = this.makeToneLayer(root, 'sine', 118);
  this.music.layers.sub = this.makeToneLayer(root * 0.5, 'sine', 38);
  this.music.layers.pulse = this.makeToneLayer(root * 1.5, 'triangle', 78);
  this.music.layers.hat = this.makeNoiseLayer(460, 1.25);
  this.music.layers.casino = this.makeToneLayer(root * 2, 'triangle', 210);
  this.music.layers.choir = this.makeToneLayer(root * 3, 'sine', 300);
  this.music.layers.dirgePad = this.makeToneLayer(root * 2, 'triangle', 170);
  this.music.layers.scrape = this.makeNoiseLayer(220, 0.95);
  this.music.layers.glass = this.makeToneLayer(root * 4, 'sine', 360);
  return true;
};

AudioBus.prototype.updateMusic = function updateMusicV215TonalLock(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const enemies = latest?.enemies?.length || 0;
  const depth = Math.max(0, Number(room?.depth || 0));
  const loop = Math.max(0, Math.floor(depth / 4));
  const loopHeat = Math.max(0, Math.min(1, loop / 6));
  const bullets = latest?.bullets?.length || 0;
  const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.35) : 0;
  const mods = room?.mods || [];
  const combat = !menu && room?.phase === 'play' && !room?.portal?.[2] && room?.cat !== 'chill';
  const boss = !menu && room?.cat === 'boss';
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const casino = !menu && (mods.includes('casino_virus') || mods.includes('greed'));
  const staticLike = mods.includes('static_rain') || mods.includes('prism_grid');
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.28);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.26);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.26);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.28);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.34);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = Math.max(0, Math.min(1, enemies / 34));
  const bulletPressure = Math.max(0, Math.min(1, bullets / 95));
  const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
  const intensity = menu ? 0.035 : Math.max(0, Math.min(1, crowd * 0.31 + bulletPressure * 0.06 + lowHp * 0.12 + danger * 0.16 + damage * 0.18 + loopHeat * 0.20 + (boss ? 0.16 : 0) + (staticLike ? 0.07 : 0)));
  const portalOpen = !!room?.portal?.[2];
  const area = menu ? 'menu' : `${room?.cat || 'room'}:${room?.special || ''}:${mods.join(',')}:${portalOpen ? 'portal' : 'closed'}`;
  if (area !== this.musicLastArea) {
    this.musicTransition = Math.max(this.musicTransition || 0, 0.70);
    // Do not instantly fire many new notes; the previous room notes are still fading.
    this.music.phraseT = Math.min(Math.max(this.music.phraseT || 0, 1.2), 2.0);
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
  if (pulse) pulse.o.frequency.setTargetAtTime(root * 1.5, now, 3.5);
  if (casinoL) casinoL.o.frequency.setTargetAtTime(root * 2, now, 4.2);
  if (dirgePad) { dirgePad.o.frequency.setTargetAtTime(root * 2, now, 4.5); dirgePad.f.frequency.setTargetAtTime(150 + intensity * 32, now, 3.5); }
  if (choirL) choirL.f.frequency.setTargetAtTime(230 + intensity * 46, now, 4.0);
  if (glass) glass.o.frequency.setTargetAtTime(root * 4, now, 5.0);

  const inGame = inGameMusicAmount(room, menu);
  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    this.playDirgePhrase({ boss, chill, casino, staticLike, combat, intensity: menu ? 0.03 : intensity, menu, damage, crowd, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve, transition: this.musicTransition, mood });
    const eventPull = Math.max(this.musicPortal || 0, this.musicResolve || 0, this.musicTransition || 0);
    const base = mood === 'menu' ? 11.6 : mood === 'rest' ? 12.5 : mood === 'portal' ? 7.8 : mood === 'resolve' ? 8.6 : mood.includes('boss') ? 8.4 : mood === 'chaos' ? 7.5 : 9.6;
    this.music.phraseT = Math.max(mood === 'chaos' ? 6.2 : (chill || portalOpen ? 8.0 : 7.0), base - intensity * 1.25 - eventPull * 0.8 - loopHeat * 0.9 - crowd * 0.65);
  }

  // Low bed only. It should feel like machinery under the game, not a band playing over SFX.
  this.setMusicLayer('drone', inGame * (menu ? 0.0018 : (chill ? 0.0019 : 0.00215 + intensity * 0.00030)), 1.0);
  this.setMusicLayer('sub', menu ? 0.000025 : (combat && intensity > 0.86 ? 0.000035 + (intensity - 0.86) * 0.000055 : 0.000018), 1.4);
  this.setMusicLayer('pulse', combat && intensity > 0.68 ? (0.000035 + intensity * 0.000095 + loopHeat * 0.000055) : 0.000020, 1.0);
  this.setMusicLayer('hat', 0.000030, 0.9);
  this.setMusicLayer('casino', casino ? (0.00016 + intensity * 0.00009) : 0.000022, 1.5);
  this.setMusicLayer('choir', inGame * (menu ? 0.0017 : (boss ? 0.0031 + intensity * 0.0013 : 0.0019 + intensity * 0.00075)), 1.5);
  this.setMusicLayer('dirgePad', inGame * (menu ? 0.0021 : (chill ? 0.0020 : 0.00255 + intensity * 0.00085)), 1.5);
  this.setMusicLayer('scrape', combat && (mood === 'chaos' || staticLike || damage > 0.52 || loopHeat > 0.50) ? (0.000090 + intensity * 0.00018 + loopHeat * 0.00007) : 0.000022, 1.1);
  this.setMusicLayer('glass', (mood === 'portal' || mood === 'resolve') ? 0.00030 : 0.000022, 1.7);
};

// v2.1.8 ORBITAL FLOW + BOSS SCORE RESTORE
// Music rule: keep one safe tonal grid, but bring back a recognizable boss hook,
// higher calm notes, and darker drive phrases. Variation is authored rhythm/register,
// not detune or random key changes.
AudioBus.prototype.musicRootFor = function musicRootForV218Score(context = {}) {
  return 43.65; // F1 terminal anchor for every room.
};

AudioBus.prototype.musicMoodFor = function musicMoodForV218Score(context = {}) {
  if (context.menu) return 'menu';
  if (context.portalOpen || context.portal > 0.22) return 'portal';
  if (context.resolve > 0.22) return 'resolve';
  if (context.boss) return context.intensity > 0.70 || context.chaos > 0.44 ? 'boss_chaos' : 'boss';
  if (context.chill) return 'rest';
  if (context.intensity > 0.82 || context.crowd > 0.78 || context.damage > 0.64 || context.chaos > 0.58) return 'chaos';
  if (context.staticLike) return 'static';
  if (context.casino) return 'casino';
  if (context.combat) return 'combat';
  return 'rest';
};

AudioBus.prototype.musicMotifsFor = function musicMotifsForV218Score(context = {}) {
  const mood = context.mood || this.musicMoodFor(context);
  const cells = {
    menu: [[24, 22, 19, 15], [31, 27, 24], [19, 22, 24], [36, 31, 27]],
    rest: [[31, 27, 24], [36, 31, 27], [24, 22, 19], [39, 36, 31]],
    combat: [[24, 22, 19, 15], [27, 24, 22, 19], [31, 27, 24, 19], [22, 19, 15, 12]],
    chaos: [[31, 27, 24, 22], [36, 31, 27, 24], [27, 24, 19, 15], [39, 36, 31, 27]],
    static: [[24, 22, 17], [29, 24, 22], [27, 22, 19], [31, 29, 24]],
    casino: [[24, 27, 24, 22], [31, 27, 24], [22, 24, 27], [36, 31, 27]],
    boss: [[36, 34, 31, 27, 24, 27, 31, 34], [31, 27, 24, 19, 24, 27], [36, 31, 27, 24], [39, 36, 31, 27]],
    boss_chaos: [[39, 36, 34, 31, 27, 31], [43, 39, 36, 31], [36, 34, 31, 27, 24], [46, 43, 39, 36]],
    portal: [[31, 36, 39], [39, 36, 31], [24, 27, 31], [43, 39, 36]],
    resolve: [[19, 22, 24], [24, 27, 31], [22, 24, 27], [15, 19, 22, 24]]
  };
  return cells[mood] || cells.combat;
};

AudioBus.prototype.musicDriveMotifsFor = function musicDriveMotifsForV218Score(context = {}) {
  const mood = context.mood || this.musicMoodFor(context);
  if (mood === 'boss' || mood === 'boss_chaos') return [[12, 12, 15, 12, 19, 15, 12, 10], [12, 19, 12, 22, 19, 15, 12]];
  if (mood === 'chaos') return [[12, 15, 12, 19, 12, 15], [12, 19, 15, 12, 10, 12]];
  if (mood === 'casino') return [[12, 15, 12, 10], [12, 19, 15, 12]];
  if (mood === 'static') return [[12, 17, 12, 10], [12, 10, 12, 17]];
  return [[12, 12, 15, 12], [12, 19, 15, 12]];
};

AudioBus.prototype.melodyInstrumentFor = function melodyInstrumentForV218Score(mood, context = {}) {
  if (mood === 'menu' || mood === 'rest') return { lead: 'sine', answer: 'triangle', body: 'sine', filter: 1350, step: 0.86, high: 1.0, drive: 0.0 };
  if (mood === 'portal' || mood === 'resolve') return { lead: 'sine', answer: 'triangle', body: 'triangle', filter: 1450, step: 0.72, high: 0.9, drive: 0.14 };
  if (mood === 'casino') return { lead: 'triangle', answer: 'square', body: 'triangle', filter: 980, step: 0.58, high: 0.72, drive: 0.45 };
  if (mood === 'static') return { lead: 'triangle', answer: 'sine', body: 'triangle', filter: 900, step: 0.62, high: 0.72, drive: 0.38 };
  if (mood === 'chaos' || mood === 'boss_chaos') return { lead: 'triangle', answer: 'sawtooth', body: 'triangle', filter: 1260, step: 0.42, high: 0.60, drive: 1.0 };
  if (mood === 'boss') return { lead: 'triangle', answer: 'sawtooth', body: 'triangle', filter: 1180, step: 0.48, high: 0.64, drive: 0.88 };
  return { lead: 'triangle', answer: 'sine', body: 'sine', filter: 1050, step: 0.58, high: 0.76, drive: 0.55 };
};

AudioBus.prototype.ensureMusic = function ensureMusicV218Score() {
  if (!this.ctx || this.ctx.state !== 'running') return false;
  if (this.music) return true;
  const master = this.ctx.createGain();
  master.gain.value = 0.42;
  master.connect(this.musicGain || this.master);
  this.music = { master, layers: {}, phraseT: 0.10, motifIndex: 0, lastRoomTone: '', dangerPhrase: 0, voiceCount: 0, maxVoices: 14 };
  const root = this.musicRootFor({});
  this.music.layers.drone = this.makeToneLayer(root, 'sine', 160);
  this.music.layers.sub = this.makeToneLayer(root * 0.5, 'sine', 48);
  this.music.layers.pulse = this.makeToneLayer(root * 1.5, 'triangle', 140);
  this.music.layers.hat = this.makeNoiseLayer(1250, 2.4);
  this.music.layers.casino = this.makeToneLayer(root * 4, 'square', 520);
  this.music.layers.choir = this.makeToneLayer(root * 3, 'triangle', 520);
  this.music.layers.dirgePad = this.makeToneLayer(root * 2, 'triangle', 290);
  this.music.layers.scrape = this.makeNoiseLayer(360, 1.25);
  this.music.layers.glass = this.makeToneLayer(root * 8, 'sine', 1750);
  this.music.layers.highPad = this.makeToneLayer(root * 12, 'sine', 2200);
  this.music.layers.drive = this.makeToneLayer(root * 3, 'sawtooth', 560);
  this.music.layers.bossLine = this.makeToneLayer(root * 8, 'triangle', 1450);
  this.music.layers.needle = this.makeNoiseLayer(2200, 4.2);
  return true;
};

AudioBus.prototype.playBossHook = function playBossHookV218(context = {}) {
  if (!this.music?.master || !this.ctx) return;
  const root = this.musicRootFor(context);
  const semitone = n => root * Math.pow(2, n / 12);
  const mood = context.mood || this.musicMoodFor(context);
  const pressure = Math.max(0.56, Math.min(1, (context.intensity || 0) * 0.72 + (context.crowd || 0) * 0.35 + (context.chaos || 0) * 0.35));
  const seed = this.music.motifIndex || 0;
  const hooks = this.musicMotifsFor({ ...context, mood });
  const hook = hooks[seed % hooks.length];
  const step = mood === 'boss_chaos' ? 0.34 : 0.43;
  const leadVol = 0.0125 + pressure * 0.0045;
  hook.slice(0, mood === 'boss_chaos' ? 6 : 8).forEach((m, i) => {
    const delay = i * step;
    const accent = (i === 0 || i === 4) ? 1.22 : 0.82;
    this.musicNote(semitone(m), step * 1.38, i % 3 === 0 ? 'triangle' : 'sine', leadVol * accent, 1300 + pressure * 420, delay, 1, 0);
    if (i % 2 === 1 && pressure > 0.68) {
      this.musicNote(semitone(m - 12), step * 1.6, 'sawtooth', leadVol * 0.40, 520 + pressure * 210, delay + step * 0.10, 1, 0);
    }
  });
  const drives = this.musicDriveMotifsFor({ ...context, mood });
  const drive = drives[(seed + 1) % drives.length];
  drive.forEach((m, i) => {
    const delay = i * (step * 0.50);
    const accent = i % 4 === 0 ? 1.05 : 0.64;
    this.musicNote(semitone(m), step * 0.42, 'sawtooth', (0.0036 + pressure * 0.0022) * accent, 470 + pressure * 300, delay, 1, 0);
  });
  this.musicDust(0.09, 0.0026 + pressure * 0.0022, 2400, 0.025);
};

AudioBus.prototype.playDirgePhrase = function playDirgePhraseV218Score(context = {}) {
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
  const boss = !!context.boss;
  const pressure = Math.max(intensity * 0.70, crowd * 0.46, damage * 0.58, chaos * 0.54, portal * 0.36, resolve * 0.30, boss ? 0.58 : 0);
  const inst = this.melodyInstrumentFor(mood, context);
  const semitone = n => root * Math.pow(2, n / 12);
  if (boss) this.playBossHook({ ...context, mood, intensity: Math.max(intensity, 0.66), crowd, chaos, damage });

  const cell = cells[seed % cells.length];
  const step = inst.step;
  const filt = inst.filter + pressure * 250;
  const leadVol = mood === 'menu' ? 0.0066 : mood === 'rest' ? 0.0062 : mood === 'portal' || mood === 'resolve' ? 0.0082 : 0.0074 + pressure * 0.0026;
  const bodyVol = 0.0019 + pressure * 0.0012;
  const pedal = boss ? 0 : -12;
  this.ambientNote(semitone(pedal), boss ? 3.6 : 4.8, inst.body, bodyVol, 190 + pressure * 70, 0, 0, 1);

  if (!boss) {
    cell.slice(0, 4).forEach((m, i) => {
      const delay = i * step;
      const accent = i === 0 ? 1.12 : 0.82;
      this.musicNote(semitone(m), step * 1.30, inst.lead, leadVol * accent, filt, delay, 1, 0);
      if ((mood === 'combat' || mood === 'chaos' || mood === 'casino' || mood === 'static') && i % 2 === 0) {
        this.musicNote(semitone(m - 12), step * 1.55, inst.answer, leadVol * 0.34, 520 + pressure * 190, delay + step * 0.45, 1, 0);
      }
    });
  }

  const calmHigh = (mood === 'menu' || mood === 'rest' || mood === 'portal' || mood === 'resolve' || (!context.combat && !boss));
  if (calmHigh || (boss && seed % 2 === 0)) {
    const highA = boss ? 43 : (mood === 'resolve' ? 36 : 39);
    const highB = boss ? 39 : (mood === 'portal' ? 43 : 36);
    this.musicNote(semitone(highA), calmHigh ? 2.9 : 1.25, 'sine', leadVol * (calmHigh ? 0.56 : 0.34), 1750 + pressure * 280, step * 0.6, 1, 0);
    this.musicNote(semitone(highB), calmHigh ? 3.5 : 1.55, 'triangle', leadVol * (calmHigh ? 0.38 : 0.24), 1320 + pressure * 220, step * 1.7, 1, 0);
  }

  const shouldDrive = !context.menu && !context.chill && (context.combat || boss || mood === 'casino' || mood === 'static' || mood === 'chaos' || mood === 'boss_chaos') && pressure > 0.34;
  if (shouldDrive && !boss) {
    const drives = this.musicDriveMotifsFor({ ...context, mood });
    const drive = drives[(seed + Math.floor(pressure * 4)) % drives.length];
    drive.forEach((m, i) => {
      const delay = i * (step * 0.48);
      this.musicNote(semitone(m), step * 0.38, i % 3 === 0 ? 'square' : 'sawtooth', (0.0024 + pressure * 0.0018) * (i % 4 === 0 ? 1 : 0.64), 430 + pressure * 310, delay, 1, 0);
    });
  }

  if ((mood === 'static' || mood === 'chaos' || mood === 'boss_chaos') && seed % 2 === 0) {
    this.ambientNoise(2.6 + pressure * 0.9, 0.00055 + pressure * 0.00075, mood === 'static' ? 680 : 520, 0.18);
  }
};

AudioBus.prototype.updateMusic = function updateMusicV218Score(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const enemies = latest?.enemies?.length || 0;
  const depth = Math.max(0, Number(room?.depth || 0));
  const loop = Math.max(0, Math.floor(depth / 4));
  const loopHeat = Math.max(0, Math.min(1, loop / 6));
  const bullets = latest?.bullets?.length || 0;
  const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.35) : 0;
  const mods = room?.mods || [];
  const combat = !menu && room?.phase === 'play' && !room?.portal?.[2] && room?.cat !== 'chill';
  const boss = !menu && room?.cat === 'boss';
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const casino = !menu && (mods.includes('casino_virus') || mods.includes('greed'));
  const staticLike = mods.includes('static_rain') || mods.includes('prism_grid');
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.28);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.34);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.30);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.30);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.36);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = Math.max(0, Math.min(1, enemies / 32));
  const bulletPressure = Math.max(0, Math.min(1, bullets / 90));
  const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
  let intensity = menu ? 0.06 : Math.max(0, Math.min(1, crowd * 0.32 + bulletPressure * 0.08 + lowHp * 0.14 + danger * 0.18 + damage * 0.20 + loopHeat * 0.20 + (boss ? 0.30 : 0) + (staticLike ? 0.08 : 0)));
  if (boss) intensity = Math.max(intensity, 0.64);
  const portalOpen = !!room?.portal?.[2];
  const area = menu ? 'menu' : `${room?.cat || 'room'}:${room?.special || ''}:${mods.join(',')}:${portalOpen ? 'portal' : 'closed'}`;
  if (area !== this.musicLastArea) {
    const wasBoss = String(this.musicLastArea || '').startsWith('boss:');
    this.musicTransition = Math.max(this.musicTransition || 0, boss ? 1.0 : 0.78);
    this.music.phraseT = boss && !wasBoss ? 0.03 : Math.min(this.music.phraseT || 0, 0.16);
    this.musicLastArea = area;
  }
  const mood = this.musicMoodFor({ menu, boss, chill, casino, staticLike, combat, intensity, crowd, damage, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve });
  const root = this.musicRootFor({ menu, boss, chill, casino, staticLike, mood });
  const now = this.ctx.currentTime;
  const L = this.music.layers;
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * (boss ? 1.5 : 1.5), now, 1.6); L.pulse.f.frequency.setTargetAtTime(120 + intensity * 170, now, 1.4); }
  if (L.casino) L.casino.o.frequency.setTargetAtTime(root * (casino ? 8 : 4), now, 2.0);
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * (boss ? 3 : 2), now, 2.0); L.dirgePad.f.frequency.setTargetAtTime(250 + intensity * 150, now, 1.8); }
  if (L.choir) L.choir.f.frequency.setTargetAtTime((boss ? 540 : 340) + intensity * 260, now, 1.8);
  if (L.glass) L.glass.o.frequency.setTargetAtTime(root * (boss ? 9 : 8), now, 2.0);
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * (boss ? 16 : (chill || menu || portalOpen ? 12 : 10)), now, 2.8); L.highPad.f.frequency.setTargetAtTime(1600 + intensity * 650, now, 2.0); }
  if (L.drive) { L.drive.o.frequency.setTargetAtTime(root * (boss ? 3 : (mood === 'chaos' ? 3 : 2.5)), now, 0.9); L.drive.f.frequency.setTargetAtTime(420 + intensity * 420, now, 0.9); }
  if (L.bossLine) { L.bossLine.o.frequency.setTargetAtTime(root * (boss ? 8 : 6), now, 1.0); L.bossLine.f.frequency.setTargetAtTime(1100 + intensity * 420, now, 1.0); }
  if (L.needle) L.needle.f.frequency.setTargetAtTime(staticLike ? 1700 : (casino ? 2400 : 1200 + intensity * 900), now, 1.0);

  const inGame = inGameMusicAmount(room, menu);
  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    this.playDirgePhrase({ boss, chill, casino, staticLike, combat, intensity: menu ? 0.04 : intensity, menu, damage, crowd, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve, transition: this.musicTransition, mood });
    const eventPull = Math.max(this.musicPortal || 0, this.musicResolve || 0, this.musicTransition || 0);
    const base = mood === 'menu' ? 6.0 : mood === 'rest' ? 7.4 : mood === 'portal' ? 3.6 : mood === 'resolve' ? 4.2 : mood.includes('boss') ? 2.8 : mood === 'chaos' ? 2.45 : 4.2;
    this.music.phraseT = Math.max(mood.includes('boss') ? 1.65 : mood === 'chaos' ? 2.2 : (chill || portalOpen ? 3.7 : 2.7), base - intensity * 1.15 - eventPull * 0.65 - loopHeat * 0.70 - crowd * 0.45);
  }

  this.setMusicLayer('drone', inGame * (menu ? 0.0018 : (chill ? 0.0020 : 0.0024 + intensity * 0.00042)), 1.0);
  this.setMusicLayer('sub', menu ? 0.000025 : (combat && intensity > 0.70 ? 0.000045 + intensity * 0.00011 + (boss ? 0.00010 : 0) : 0.000020), 1.1);
  this.setMusicLayer('pulse', combat && intensity > 0.45 ? (0.00010 + intensity * 0.00036 + loopHeat * 0.00010 + (boss ? 0.00022 : 0)) : 0.000024, 0.7);
  this.setMusicLayer('hat', combat && intensity > 0.50 ? 0.00012 + intensity * 0.00018 : 0.000036, 0.8);
  this.setMusicLayer('casino', casino ? (0.00030 + intensity * 0.00024) : 0.000026, 1.0);
  this.setMusicLayer('choir', inGame * (menu ? 0.0018 : (boss ? 0.0058 + intensity * 0.0046 : 0.0024 + intensity * 0.0015)), 1.0);
  this.setMusicLayer('dirgePad', inGame * (menu ? 0.0022 : (chill ? 0.0021 : 0.0028 + intensity * 0.0016 + (boss ? 0.0014 : 0))), 1.0);
  this.setMusicLayer('scrape', combat && (mood === 'chaos' || staticLike || damage > 0.50 || loopHeat > 0.50) ? (0.00012 + intensity * 0.00024 + loopHeat * 0.00009) : 0.000026, 0.85);
  this.setMusicLayer('glass', (mood === 'portal' || mood === 'resolve' || menu || chill) ? 0.00042 + (1 - intensity) * 0.00020 : (boss ? 0.00020 : 0.000030), 1.4);
  this.setMusicLayer('highPad', (menu || chill || mood === 'rest' || portalOpen) ? 0.00055 + (1 - intensity) * 0.00055 : (boss ? 0.00050 + intensity * 0.00042 : 0.00011), 1.6);
  this.setMusicLayer('drive', combat && intensity > 0.38 ? 0.00018 + intensity * 0.00115 + (boss ? 0.00072 : 0) : 0.000030, 0.65);
  this.setMusicLayer('bossLine', boss ? 0.00058 + intensity * 0.00105 : 0.000020, 0.65);
  this.setMusicLayer('needle', combat && (staticLike || casino || mood === 'chaos' || mood === 'boss_chaos' || intensity > 0.72) ? 0.00010 + intensity * 0.00052 : 0.000024, 0.75);
};

// v2.1.12 MUSIC PACE HOTFIX
// Keep the v2.1.8 variety, but make early loops less bright and less busy.
// The first loops use longer phrase gaps, lower drive/pulse layers, and fewer high notes.
// v2.1.13: high-register parts are folded down into mid/low-mid registers; no piercing top notes.
AudioBus.prototype.ensureMusic = function ensureMusicV2112Pace() {
  if (!this.ctx || this.ctx.state !== 'running') return false;
  if (this.music) return true;
  const master = this.ctx.createGain();
  master.gain.value = 0.34;
  master.connect(this.musicGain || this.master);
  this.music = { master, layers: {}, phraseT: 0.42, motifIndex: 0, lastRoomTone: '', dangerPhrase: 0, voiceCount: 0, maxVoices: 12 };
  const root = this.musicRootFor({});
  this.music.layers.drone = this.makeToneLayer(root, 'sine', 150);
  this.music.layers.sub = this.makeToneLayer(root * 0.5, 'sine', 48);
  this.music.layers.pulse = this.makeToneLayer(root * 1.5, 'triangle', 125);
  this.music.layers.hat = this.makeNoiseLayer(1100, 2.1);
  this.music.layers.casino = this.makeToneLayer(root * 4, 'square', 480);
  this.music.layers.choir = this.makeToneLayer(root * 3, 'triangle', 470);
  this.music.layers.dirgePad = this.makeToneLayer(root * 2, 'triangle', 250);
  this.music.layers.scrape = this.makeNoiseLayer(340, 1.1);
  this.music.layers.glass = this.makeToneLayer(root * 4, 'sine', 860);
  this.music.layers.highPad = this.makeToneLayer(root * 4, 'sine', 820);
  this.music.layers.drive = this.makeToneLayer(root * 3, 'sawtooth', 500);
  this.music.layers.bossLine = this.makeToneLayer(root * 4, 'triangle', 900);
  this.music.layers.needle = this.makeNoiseLayer(1900, 3.7);
  return true;
};

AudioBus.prototype.playDirgePhrase = function playDirgePhraseV2112Pace(context = {}) {
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
  const boss = !!context.boss;
  const earlyHold = Math.max(0, Math.min(1, context.earlyHold || 0));
  const pressure = Math.max(intensity * 0.58, crowd * 0.38, damage * 0.50, chaos * 0.42, portal * 0.34, resolve * 0.28, boss ? 0.52 : 0);
  const inst = this.melodyInstrumentFor(mood, context);
  const semitone = n => root * Math.pow(2, n / 12);

  // Boss keeps a theme, but the normal first rooms do not instantly start racing.
  if (boss) this.playBossHook({ ...context, mood, intensity: Math.max(intensity, 0.58), crowd, chaos, damage });

  const cell = cells[seed % cells.length];
  const step = inst.step + (boss ? 0 : earlyHold * 0.18);
  const filt = inst.filter + pressure * (boss ? 220 : 150) - earlyHold * 90;
  const earlyVol = boss ? 1 : (0.62 + (1 - earlyHold) * 0.38);
  const leadVol = (mood === 'menu' ? 0.0064 : mood === 'rest' ? 0.0058 : mood === 'portal' || mood === 'resolve' ? 0.0074 : 0.0060 + pressure * 0.0019) * earlyVol;
  const bodyVol = (0.0015 + pressure * 0.00085) * (boss ? 1 : 0.85);
  const pedal = boss ? 0 : -12;
  this.ambientNote(semitone(pedal), boss ? 3.4 : 5.2 + earlyHold * 1.2, inst.body, bodyVol, 170 + pressure * 55, 0, 0, 1);

  if (!boss) {
    const noteCount = earlyHold > 0.68 ? 2 : 3;
    cell.slice(0, noteCount).forEach((m, i) => {
      const delay = i * step;
      const accent = i === 0 ? 1.05 : 0.72;
      this.musicNote(semitone(m), step * 1.28, inst.lead, leadVol * accent, Math.max(360, filt), delay, 1, 0);
      if (earlyHold < 0.50 && (mood === 'combat' || mood === 'casino' || mood === 'static') && i === 1) {
        this.musicNote(semitone(m - 12), step * 1.45, inst.answer, leadVol * 0.25, 470 + pressure * 130, delay + step * 0.48, 1, 0);
      }
    });
  }

  const calmHigh = (mood === 'menu' || mood === 'rest' || mood === 'portal' || mood === 'resolve' || (!context.combat && !boss));
  if ((calmHigh && seed % 2 === 0) || (boss && seed % 3 === 0)) {
    const highA = boss ? 19 : (mood === 'resolve' ? 12 : 15);
    const highB = boss ? 15 : (mood === 'portal' ? 19 : 12);
    const highMul = boss ? 0.22 : (calmHigh ? 0.42 : 0.18);
    this.musicNote(semitone(highA), calmHigh ? 3.4 : 1.35, 'sine', leadVol * highMul, 760 + pressure * 95, step * 0.8, 1, 0);
    if (earlyHold < 0.38 || boss) this.musicNote(semitone(highB), calmHigh ? 3.9 : 1.65, 'triangle', leadVol * highMul * 0.58, 660 + pressure * 85, step * 1.9, 1, 0);
  }

  const shouldDrive = !context.menu && !context.chill && (context.combat || boss || mood === 'casino' || mood === 'static' || mood === 'chaos' || mood === 'boss_chaos') && pressure > 0.42 && (boss || earlyHold < 0.62);
  if (shouldDrive && !boss) {
    const drives = this.musicDriveMotifsFor({ ...context, mood });
    const drive = drives[(seed + Math.floor(pressure * 3)) % drives.length];
    drive.slice(0, earlyHold > 0.35 ? 3 : 5).forEach((m, i) => {
      const delay = i * (step * 0.62);
      this.musicNote(semitone(m), step * 0.40, i % 3 === 0 ? 'square' : 'sawtooth', (0.0015 + pressure * 0.0010) * (i % 4 === 0 ? 1 : 0.55), 380 + pressure * 220, delay, 1, 0);
    });
  }

  if ((mood === 'static' || mood === 'chaos' || mood === 'boss_chaos') && seed % 3 === 0 && earlyHold < 0.55) {
    this.ambientNoise(2.3 + pressure * 0.7, 0.00038 + pressure * 0.00048, mood === 'static' ? 620 : 480, 0.20);
  }
};

AudioBus.prototype.updateMusic = function updateMusicV2112Pace(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const enemies = latest?.enemies?.length || 0;
  const depth = Math.max(0, Number(room?.depth || 0));
  const loop = Math.max(0, Math.floor(depth / 4));
  const loopHeat = Math.max(0, Math.min(1, loop / 6));
  const earlyHold = menu || room?.cat === 'chill' ? 0 : Math.max(0, 1 - Math.min(1, loop / 3));
  const bullets = latest?.bullets?.length || 0;
  const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.35) : 0;
  const mods = room?.mods || [];
  const combat = !menu && room?.phase === 'play' && !room?.portal?.[2] && room?.cat !== 'chill';
  const boss = !menu && room?.cat === 'boss';
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const casino = !menu && (mods.includes('casino_virus') || mods.includes('greed'));
  const staticLike = mods.includes('static_rain') || mods.includes('prism_grid');
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.28);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.30);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.28);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.28);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.40);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = Math.max(0, Math.min(1, enemies / 36));
  const bulletPressure = Math.max(0, Math.min(1, bullets / 100));
  const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
  let intensity = menu ? 0.055 : Math.max(0, Math.min(1, crowd * 0.28 + bulletPressure * 0.06 + lowHp * 0.12 + danger * 0.16 + damage * 0.18 + loopHeat * 0.18 + (boss ? 0.27 : 0) + (staticLike ? 0.07 : 0)));
  if (!boss) intensity *= (0.58 + (1 - earlyHold) * 0.42);
  if (boss) intensity = Math.max(intensity, 0.58);
  const portalOpen = !!room?.portal?.[2];
  const area = menu ? 'menu' : `${room?.cat || 'room'}:${room?.special || ''}:${mods.join(',')}:${portalOpen ? 'portal' : 'closed'}`;
  if (area !== this.musicLastArea) {
    const wasBoss = String(this.musicLastArea || '').startsWith('boss:');
    this.musicTransition = Math.max(this.musicTransition || 0, boss ? 0.88 : 0.70);
    this.music.phraseT = boss && !wasBoss ? 0.12 : Math.max(this.music.phraseT || 0, 1.05 + earlyHold * 0.95);
    this.musicLastArea = area;
  }
  const mood = this.musicMoodFor({ menu, boss, chill, casino, staticLike, combat, intensity, crowd, damage, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve });
  const root = this.musicRootFor({ menu, boss, chill, casino, staticLike, mood });
  const now = this.ctx.currentTime;
  const L = this.music.layers;
  const calmMul = boss ? 1 : (0.56 + (1 - earlyHold) * 0.44);
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * 1.5, now, 1.9); L.pulse.f.frequency.setTargetAtTime(105 + intensity * 130, now, 1.7); }
  if (L.casino) L.casino.o.frequency.setTargetAtTime(root * (casino ? 8 : 4), now, 2.2);
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * (boss ? 3 : 2), now, 2.2); L.dirgePad.f.frequency.setTargetAtTime(220 + intensity * 115, now, 2.0); }
  if (L.choir) L.choir.f.frequency.setTargetAtTime((boss ? 500 : 300) + intensity * 210, now, 2.0);
  if (L.glass) L.glass.o.frequency.setTargetAtTime(root * (boss ? 5 : 4), now, 2.2);
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * (boss ? 6 : (chill || menu || portalOpen ? 5 : 4)), now, 3.0); L.highPad.f.frequency.setTargetAtTime(780 + intensity * 260, now, 2.3); }
  if (L.drive) { L.drive.o.frequency.setTargetAtTime(root * (boss ? 3 : (mood === 'chaos' ? 3 : 2.5)), now, 1.2); L.drive.f.frequency.setTargetAtTime(360 + intensity * 300, now, 1.1); }
  if (L.bossLine) { L.bossLine.o.frequency.setTargetAtTime(root * (boss ? 4 : 3), now, 1.2); L.bossLine.f.frequency.setTargetAtTime(700 + intensity * 220, now, 1.2); }
  if (L.needle) L.needle.f.frequency.setTargetAtTime(staticLike ? 1050 : (casino ? 1350 : 820 + intensity * 360), now, 1.2);

  const inGame = inGameMusicAmount(room, menu);
  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    this.playDirgePhrase({ boss, chill, casino, staticLike, combat, intensity: menu ? 0.04 : intensity, menu, damage, crowd, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve, transition: this.musicTransition, mood, earlyHold });
    const eventPull = Math.max(this.musicPortal || 0, this.musicResolve || 0, this.musicTransition || 0);
    const base = mood === 'menu' ? 6.4 : mood === 'rest' ? 8.0 : mood === 'portal' ? 4.2 : mood === 'resolve' ? 4.8 : mood.includes('boss') ? 3.25 : mood === 'chaos' ? 3.4 : 5.4 + earlyHold * 2.4;
    this.music.phraseT = Math.max(mood.includes('boss') ? 2.05 : mood === 'chaos' ? 2.9 : (chill || portalOpen ? 4.4 : 3.6 + earlyHold * 1.9), base - intensity * 0.72 - eventPull * 0.48 - loopHeat * 0.48 - crowd * 0.28);
  }

  this.setMusicLayer('drone', inGame * (menu ? 0.0018 : (chill ? 0.0020 : (0.0021 + intensity * 0.00034) * calmMul)), 1.4);
  this.setMusicLayer('sub', menu ? 0.000025 : (combat && intensity > 0.76 ? (0.000030 + intensity * 0.000075 + (boss ? 0.00008 : 0)) * calmMul : 0.000018), 1.35);
  this.setMusicLayer('pulse', combat && intensity > (boss ? 0.44 : 0.62) ? (0.000060 + intensity * 0.00022 + loopHeat * 0.000055 + (boss ? 0.00016 : 0)) * calmMul : 0.000022, 0.95);
  this.setMusicLayer('hat', combat && intensity > 0.64 && earlyHold < 0.42 ? 0.000080 + intensity * 0.00012 : 0.000030, 0.95);
  this.setMusicLayer('casino', casino ? (0.00022 + intensity * 0.00018) * calmMul : 0.000024, 1.15);
  this.setMusicLayer('choir', inGame * (menu ? 0.0018 : (boss ? 0.0048 + intensity * 0.0036 : (0.0020 + intensity * 0.00105) * calmMul)), 1.25);
  this.setMusicLayer('dirgePad', inGame * (menu ? 0.0022 : (chill ? 0.0021 : (0.00255 + intensity * 0.00115 + (boss ? 0.0010 : 0)) * calmMul)), 1.35);
  this.setMusicLayer('scrape', combat && (mood === 'chaos' || staticLike || damage > 0.52 || loopHeat > 0.55) && earlyHold < 0.62 ? (0.000075 + intensity * 0.00015 + loopHeat * 0.00006) : 0.000024, 1.0);
  this.setMusicLayer('glass', (mood === 'portal' || mood === 'resolve' || menu || chill) ? 0.00026 + (1 - intensity) * 0.00011 : (boss ? 0.000090 : 0.000020), 1.5);
  this.setMusicLayer('highPad', (menu || chill || mood === 'rest' || portalOpen) ? 0.00032 + (1 - intensity) * 0.00028 : (boss ? 0.00020 + intensity * 0.00016 : 0.000045), 1.8);
  this.setMusicLayer('drive', combat && intensity > (boss ? 0.36 : 0.52) ? (0.000105 + intensity * 0.00062 + (boss ? 0.00052 : 0)) * calmMul : 0.000028, 0.85);
  this.setMusicLayer('bossLine', boss ? 0.00040 + intensity * 0.00064 : 0.000018, 0.85);
  this.setMusicLayer('needle', combat && (staticLike || casino || mood === 'chaos' || mood === 'boss_chaos' || intensity > 0.78) && earlyHold < 0.45 ? 0.000070 + intensity * 0.00036 : 0.000024, 0.9);
};

// v2.1.14 LOW REGISTER HOTFIX
// User note: remaining high notes are still too intrusive. This final override keeps the score varied,
// but folds nearly every musical voice down into low / low-mid registers and clamps filters so gameplay
// effects own the treble range.
AudioBus.prototype.ensureMusic = function ensureMusicV2114LowRegister() {
  if (!this.ctx || this.ctx.state !== 'running') return false;
  if (this.music) return true;
  const master = this.ctx.createGain();
  master.gain.value = 0.32;
  master.connect(this.musicGain || this.master);
  this.music = { master, layers: {}, phraseT: 0.55, motifIndex: 0, lastRoomTone: '', dangerPhrase: 0, voiceCount: 0, maxVoices: 10 };
  const root = this.musicRootFor({});
  this.music.layers.drone = this.makeToneLayer(root, 'sine', 125);
  this.music.layers.sub = this.makeToneLayer(root * 0.5, 'sine', 44);
  this.music.layers.pulse = this.makeToneLayer(root * 1.5, 'triangle', 105);
  this.music.layers.hat = this.makeNoiseLayer(720, 1.7);
  this.music.layers.casino = this.makeToneLayer(root * 2, 'square', 260);
  this.music.layers.choir = this.makeToneLayer(root * 2, 'triangle', 300);
  this.music.layers.dirgePad = this.makeToneLayer(root * 1.5, 'triangle', 180);
  this.music.layers.scrape = this.makeNoiseLayer(240, 1.0);
  this.music.layers.glass = this.makeToneLayer(root * 2, 'triangle', 360);
  this.music.layers.highPad = this.makeToneLayer(root * 2, 'sine', 340);
  this.music.layers.drive = this.makeToneLayer(root * 2.5, 'sawtooth', 330);
  this.music.layers.bossLine = this.makeToneLayer(root * 3, 'triangle', 420);
  this.music.layers.needle = this.makeNoiseLayer(760, 2.0);
  return true;
};

AudioBus.prototype.playDirgePhrase = function playDirgePhraseV2114LowRegister(context = {}) {
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
  const boss = !!context.boss;
  const earlyHold = Math.max(0, Math.min(1, context.earlyHold || 0));
  const pressure = Math.max(intensity * 0.50, crowd * 0.32, damage * 0.44, chaos * 0.38, portal * 0.28, resolve * 0.24, boss ? 0.46 : 0);
  const inst = this.melodyInstrumentFor(mood, context);
  const semitone = n => root * Math.pow(2, n / 12);
  const low = n => n - 12; // fold authored phrases one octave lower by default.

  if (boss && seed % 2 === 0) this.playBossHook?.({ ...context, mood, intensity: Math.max(intensity, 0.54), crowd, chaos, damage });

  const cell = cells[seed % cells.length];
  const step = inst.step + (boss ? 0.05 : earlyHold * 0.22);
  const filt = Math.min(520, inst.filter + pressure * (boss ? 90 : 65) - earlyHold * 80);
  const earlyVol = boss ? 0.92 : (0.55 + (1 - earlyHold) * 0.35);
  const leadVol = (mood === 'menu' ? 0.0048 : mood === 'rest' ? 0.0042 : mood === 'portal' || mood === 'resolve' ? 0.0050 : 0.0045 + pressure * 0.0014) * earlyVol;
  const bodyVol = (0.0013 + pressure * 0.00062) * (boss ? 0.96 : 0.78);

  this.ambientNote(semitone(-12), boss ? 3.6 : 5.6 + earlyHold * 1.3, inst.body, bodyVol, 145 + pressure * 32, 0, 0, 1);

  if (!boss) {
    const noteCount = earlyHold > 0.64 ? 2 : 3;
    cell.slice(0, noteCount).forEach((m, i) => {
      const delay = i * step;
      const accent = i === 0 ? 1.0 : 0.68;
      this.musicNote(semitone(low(m)), step * 1.35, inst.lead, leadVol * accent, Math.max(240, filt), delay, 1, 0);
      if (earlyHold < 0.42 && (mood === 'combat' || mood === 'casino' || mood === 'static') && i === 1) {
        this.musicNote(semitone(low(m) - 7), step * 1.50, inst.answer, leadVol * 0.22, 310 + pressure * 80, delay + step * 0.50, 1, 0);
      }
    });
  }

  const calmTone = (mood === 'menu' || mood === 'rest' || mood === 'portal' || mood === 'resolve' || (!context.combat && !boss));
  if ((calmTone && seed % 3 === 0) || (boss && seed % 4 === 0)) {
    const a = boss ? 7 : (mood === 'resolve' ? 3 : 5);
    const b = boss ? 3 : (mood === 'portal' ? 7 : 0);
    const v = boss ? 0.16 : 0.24;
    this.musicNote(semitone(a), calmTone ? 3.8 : 1.5, 'sine', leadVol * v, 420 + pressure * 50, step * 0.85, 1, 0);
    if (earlyHold < 0.25 || boss) this.musicNote(semitone(b), calmTone ? 4.2 : 1.7, 'triangle', leadVol * v * 0.46, 360 + pressure * 45, step * 1.95, 1, 0);
  }

  const shouldDrive = !context.menu && !context.chill && (context.combat || boss || mood === 'casino' || mood === 'static' || mood === 'chaos' || mood === 'boss_chaos') && pressure > 0.44 && (boss || earlyHold < 0.52);
  if (shouldDrive && !boss) {
    const drives = this.musicDriveMotifsFor({ ...context, mood });
    const drive = drives[(seed + Math.floor(pressure * 3)) % drives.length];
    drive.slice(0, earlyHold > 0.28 ? 3 : 4).forEach((m, i) => {
      const delay = i * (step * 0.68);
      this.musicNote(semitone(m - 12), step * 0.44, i % 3 === 0 ? 'square' : 'sawtooth', (0.0010 + pressure * 0.00078) * (i % 4 === 0 ? 1 : 0.50), 280 + pressure * 115, delay, 1, 0);
    });
  }

  if ((mood === 'static' || mood === 'chaos' || mood === 'boss_chaos') && seed % 3 === 0 && earlyHold < 0.48) {
    this.ambientNoise(2.4 + pressure * 0.65, 0.00032 + pressure * 0.00038, mood === 'static' ? 420 : 340, 0.20);
  }
};

AudioBus.prototype.updateMusic = function updateMusicV2114LowRegister(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const enemies = latest?.enemies?.length || 0;
  const depth = Math.max(0, Number(room?.depth || 0));
  const loop = Math.max(0, Math.floor(depth / 4));
  const loopHeat = Math.max(0, Math.min(1, loop / 6));
  const earlyHold = menu || room?.cat === 'chill' ? 0 : Math.max(0, 1 - Math.min(1, loop / 3));
  const bullets = latest?.bullets?.length || 0;
  const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.35) : 0;
  const mods = room?.mods || [];
  const combat = !menu && room?.phase === 'play' && !room?.portal?.[2] && room?.cat !== 'chill';
  const boss = !menu && room?.cat === 'boss';
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const casino = !menu && (mods.includes('casino_virus') || mods.includes('greed'));
  const staticLike = mods.includes('static_rain') || mods.includes('prism_grid');
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.28);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.30);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.28);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.28);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.40);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = Math.max(0, Math.min(1, enemies / 36));
  const bulletPressure = Math.max(0, Math.min(1, bullets / 100));
  const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
  let intensity = menu ? 0.050 : Math.max(0, Math.min(1, crowd * 0.25 + bulletPressure * 0.05 + lowHp * 0.11 + danger * 0.14 + damage * 0.16 + loopHeat * 0.16 + (boss ? 0.26 : 0) + (staticLike ? 0.06 : 0)));
  if (!boss) intensity *= (0.54 + (1 - earlyHold) * 0.40);
  if (boss) intensity = Math.max(intensity, 0.54);
  const portalOpen = !!room?.portal?.[2];
  const area = menu ? 'menu' : `${room?.cat || 'room'}:${room?.special || ''}:${mods.join(',')}:${portalOpen ? 'portal' : 'closed'}`;
  if (area !== this.musicLastArea) {
    const wasBoss = String(this.musicLastArea || '').startsWith('boss:');
    this.musicTransition = Math.max(this.musicTransition || 0, boss ? 0.82 : 0.68);
    this.music.phraseT = boss && !wasBoss ? 0.20 : Math.max(this.music.phraseT || 0, 1.20 + earlyHold * 1.05);
    this.musicLastArea = area;
  }
  const mood = this.musicMoodFor({ menu, boss, chill, casino, staticLike, combat, intensity, crowd, damage, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve });
  const root = this.musicRootFor({ menu, boss, chill, casino, staticLike, mood });
  const now = this.ctx.currentTime;
  const L = this.music.layers;
  const calmMul = boss ? 1 : (0.52 + (1 - earlyHold) * 0.38);
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * 1.5, now, 2.0); L.pulse.f.frequency.setTargetAtTime(90 + intensity * 100, now, 1.9); }
  if (L.casino) L.casino.o.frequency.setTargetAtTime(root * (casino ? 4 : 2), now, 2.4);
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * (boss ? 2 : 1.5), now, 2.4); L.dirgePad.f.frequency.setTargetAtTime(170 + intensity * 80, now, 2.2); }
  if (L.choir) L.choir.f.frequency.setTargetAtTime((boss ? 360 : 230) + intensity * 130, now, 2.2);
  if (L.glass) L.glass.o.frequency.setTargetAtTime(root * (boss ? 3 : 2), now, 2.5);
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * (boss ? 3 : (chill || menu || portalOpen ? 2.5 : 2)), now, 3.1); L.highPad.f.frequency.setTargetAtTime(360 + intensity * 100, now, 2.5); }
  if (L.drive) { L.drive.o.frequency.setTargetAtTime(root * (boss ? 2.5 : 2), now, 1.3); L.drive.f.frequency.setTargetAtTime(270 + intensity * 160, now, 1.2); }
  if (L.bossLine) { L.bossLine.o.frequency.setTargetAtTime(root * (boss ? 3 : 2), now, 1.3); L.bossLine.f.frequency.setTargetAtTime(420 + intensity * 110, now, 1.3); }
  if (L.needle) L.needle.f.frequency.setTargetAtTime(staticLike ? 620 : (casino ? 740 : 520 + intensity * 170), now, 1.3);

  const inGame = inGameMusicAmount(room, menu);
  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    this.playDirgePhrase({ boss, chill, casino, staticLike, combat, intensity: menu ? 0.035 : intensity, menu, damage, crowd, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve, transition: this.musicTransition, mood, earlyHold });
    const eventPull = Math.max(this.musicPortal || 0, this.musicResolve || 0, this.musicTransition || 0);
    const base = mood === 'menu' ? 6.8 : mood === 'rest' ? 8.6 : mood === 'portal' ? 4.6 : mood === 'resolve' ? 5.2 : mood.includes('boss') ? 3.6 : mood === 'chaos' ? 3.8 : 5.9 + earlyHold * 2.7;
    this.music.phraseT = Math.max(mood.includes('boss') ? 2.35 : mood === 'chaos' ? 3.25 : (chill || portalOpen ? 4.9 : 4.0 + earlyHold * 2.2), base - intensity * 0.60 - eventPull * 0.42 - loopHeat * 0.40 - crowd * 0.22);
  }

  this.setMusicLayer('drone', inGame * (menu ? 0.0017 : (chill ? 0.0019 : (0.0019 + intensity * 0.00028) * calmMul)), 1.45);
  this.setMusicLayer('sub', menu ? 0.000024 : (combat && intensity > 0.78 ? (0.000026 + intensity * 0.000060 + (boss ? 0.00006 : 0)) * calmMul : 0.000016), 1.40);
  this.setMusicLayer('pulse', combat && intensity > (boss ? 0.46 : 0.66) ? (0.000048 + intensity * 0.00018 + loopHeat * 0.000042 + (boss ? 0.00013 : 0)) * calmMul : 0.000020, 1.0);
  this.setMusicLayer('hat', combat && intensity > 0.70 && earlyHold < 0.30 ? 0.000052 + intensity * 0.000085 : 0.000024, 1.0);
  this.setMusicLayer('casino', casino ? (0.00018 + intensity * 0.00014) * calmMul : 0.000020, 1.2);
  this.setMusicLayer('choir', inGame * (menu ? 0.0016 : (boss ? 0.0039 + intensity * 0.0028 : (0.0017 + intensity * 0.00082) * calmMul)), 1.35);
  this.setMusicLayer('dirgePad', inGame * (menu ? 0.0020 : (chill ? 0.0019 : (0.00215 + intensity * 0.00092 + (boss ? 0.00072 : 0)) * calmMul)), 1.45);
  this.setMusicLayer('scrape', combat && (mood === 'chaos' || staticLike || damage > 0.55 || loopHeat > 0.60) && earlyHold < 0.50 ? (0.000058 + intensity * 0.000115 + loopHeat * 0.000045) : 0.000020, 1.05);
  this.setMusicLayer('glass', (mood === 'portal' || mood === 'resolve' || menu || chill) ? 0.00018 + (1 - intensity) * 0.000070 : (boss ? 0.000060 : 0.000014), 1.6);
  this.setMusicLayer('highPad', (menu || chill || mood === 'rest' || portalOpen) ? 0.00020 + (1 - intensity) * 0.00016 : (boss ? 0.00012 + intensity * 0.000090 : 0.000024), 1.9);
  this.setMusicLayer('drive', combat && intensity > (boss ? 0.38 : 0.56) ? (0.000080 + intensity * 0.00046 + (boss ? 0.00039 : 0)) * calmMul : 0.000022, 0.9);
  this.setMusicLayer('bossLine', boss ? 0.00028 + intensity * 0.00044 : 0.000014, 0.9);
  this.setMusicLayer('needle', combat && (staticLike || casino || mood === 'chaos' || mood === 'boss_chaos' || intensity > 0.82) && earlyHold < 0.35 ? 0.000045 + intensity * 0.00024 : 0.000018, 1.0);
};


// v2.1.20: room-stage score director.
// The score now changes by room stage (start / fight / climax / clear), room modifier,
// and boss identity. Boss hook notes are intentionally lower and quieter so they keep
// their character without stabbing above the combat mix.
function musicStageV2120(room, latest = null, bossHpPct = 100) {
  if (!room) return 'menu';
  if (room.cat === 'chill' || room.special === 'chill_room') return 'rest';
  if (room.portal?.[2] || room.solved) return 'clear';
  const age = Math.max(0, Number(room.age || 0));
  const kills = Math.max(0, Number(room.kills || 0));
  const live = Math.max(0, Number(room.liveEnemies || latest?.enemies?.length || 0));
  const spawned = Math.max(0, Number(room.spawned || 0));
  const quota = Math.max(1, Number(room.quota || room.baseQuota || 1));
  if (room.cat === 'boss' && bossHpPct > 0 && bossHpPct <= 42) return 'climax';
  if (age < 7 && kills < 3 && spawned < Math.max(7, quota * 0.22)) return 'start';
  if (live >= 24 || spawned >= quota * 0.78 || kills >= quota * 0.70) return 'climax';
  return 'fight';
}
function musicModThemeV2120(mods = []) {
  if (mods.includes('casino_virus') || mods.includes('greed')) return 'casino';
  if (mods.includes('static_rain')) return 'static';
  if (mods.includes('prism_grid')) return 'prism';
  if (mods.includes('hunter_contract')) return 'hunter';
  if (mods.includes('blood_tax')) return 'blood';
  if (mods.includes('echo_walls')) return 'echo';
  if (mods.includes('moving_room')) return 'shift';
  return 'plain';
}
function bossThemeV2120(kind = '') {
  if (kind === 'boss_croupier') return 'croupier';
  if (kind === 'boss_anchor_cashier') return 'anchor_boss';
  if (kind === 'boss_hunter_chorus') return 'hunter_boss';
  if (kind === 'boss_q_revisor') return 'q_revisor';
  return kind ? 'boss' : '';
}
function musicThemeShiftV2120(modTheme = '', bossTheme = '') {
  const byBoss = { croupier: -5, anchor_boss: -12, hunter_boss: -7, q_revisor: -9, boss: -8 };
  const byMod = { anchor: -12, casino: -5, static: -9, prism: -7, hunter: -6, blood: -10, echo: -8, shift: -4, plain: 0 };
  return Math.pow(2, ((byBoss[bossTheme] ?? byMod[modTheme] ?? 0) / 12));
}

AudioBus.prototype.playBossHook = function playBossHookV2120Low(context = {}) {
  if (!this.music?.master || !this.ctx) return;
  const root = this.musicRootFor(context) * musicThemeShiftV2120(context.modTheme, context.bossTheme);
  const semitone = n => root * Math.pow(2, n / 12);
  const pressure = Math.max(0.35, Math.min(1, (context.intensity || 0) * 0.55 + (context.crowd || 0) * 0.18 + (context.chaos || 0) * 0.16));
  const bossTheme = context.bossTheme || 'boss';
  const hooks = {
    croupier: [-12, -7, -5, -10],
    anchor_boss: [-24, -19, -17, -22],
    hunter_boss: [-12, -15, -10, -17],
    q_revisor: [-19, -12, -16, -9],
    boss: [-17, -12, -10, -14]
  };
  const hook = hooks[bossTheme] || hooks.boss;
  const step = context.stage === 'climax' ? 0.56 : 0.72;
  const leadVol = (0.0024 + pressure * 0.0016) * (context.stage === 'climax' ? 1.08 : 0.82);
  hook.forEach((m, i) => {
    const delay = i * step;
    this.musicNote(semitone(m), step * 1.8, i % 2 ? 'triangle' : 'sine', leadVol * (i === 0 ? 1.05 : 0.70), 300 + pressure * 90, delay, 1, 0);
  });
  if (context.stage === 'climax') {
    for (let i = 0; i < 4; i++) this.musicNote(semitone(-24 + (i % 2) * 5), 0.18, 'sawtooth', 0.0011 + pressure * 0.0007, 260 + pressure * 80, i * 0.32, 1, 0);
  }
  this.musicDust(0.075, 0.00065 + pressure * 0.00055, 620, 0.025);
};

AudioBus.prototype.playDirgePhrase = function playDirgePhraseV2120Stage(context = {}) {
  if (!this.music?.master || !this.ctx) return;
  const mood = context.mood || this.musicMoodFor(context);
  const baseRoot = this.musicRootFor(context);
  const root = baseRoot * musicThemeShiftV2120(context.modTheme, context.bossTheme);
  const semitone = n => root * Math.pow(2, n / 12);
  const seed = this.music.motifIndex++;
  const stage = context.stage || 'fight';
  const boss = !!context.boss;
  const intensity = Math.max(0, Math.min(1, context.intensity || 0));
  const crowd = Math.max(0, Math.min(1, context.crowd || 0));
  const chaos = Math.max(0, Math.min(1, context.chaos || 0));
  const pressure = Math.max(intensity * 0.42, crowd * 0.25, chaos * 0.28, boss ? 0.42 : 0);
  const stageMul = stage === 'start' ? 0.46 : stage === 'clear' ? 0.34 : stage === 'climax' ? 0.92 : 0.68;
  const step = stage === 'start' ? 1.12 : stage === 'clear' ? 1.22 : stage === 'climax' ? 0.64 : 0.84;
  const cells = {
    start: [-24, -19, -17],
    fight: [-24, -17, -14, -19],
    climax: [-24, -19, -12, -17, -14],
    clear: [-19, -15, -12]
  };
  const modCells = {
    anchor: [-36, -31, -29, -34],
    casino: [-24, -17, -14, -22],
    static: [-31, -24, -22, -29],
    prism: [-28, -21, -19, -26],
    hunter: [-24, -27, -19, -31],
    blood: [-31, -24, -29, -19],
    echo: [-24, -17, -24, -12],
    shift: [-24, -16, -21, -14]
  };
  const motif = (modCells[context.modTheme] || cells[stage] || cells.fight).slice();
  if (boss) this.playBossHook({ ...context, mood, intensity: Math.max(intensity, stage === 'climax' ? 0.64 : 0.46), crowd, chaos, stage });
  this.ambientNote(semitone(context.modTheme === 'anchor' || context.bossTheme === 'anchor_boss' ? -36 : -24), boss ? 4.4 : 6.6, 'triangle', (0.00075 + pressure * 0.00032) * stageMul, 120 + pressure * 40, 0, 0, 1);
  const maxNotes = stage === 'start' ? 2 : stage === 'clear' ? 2 : stage === 'climax' ? 4 : 3;
  motif.slice(0, maxNotes).forEach((m, i) => {
    const delay = i * step;
    const vol = (0.0030 + pressure * 0.0011) * stageMul * (i === 0 ? 1 : 0.62);
    this.musicNote(semitone(m), step * (stage === 'climax' ? 1.12 : 1.55), i % 2 ? 'triangle' : 'sine', vol, 260 + pressure * 100, delay, 1, 0);
    if (stage === 'climax' && i === 2) this.musicNote(semitone(m - 12), step * 1.25, 'sawtooth', vol * 0.36, 220 + pressure * 80, delay + step * 0.35, 1, 0);
  });
  if (stage === 'clear' && seed % 2 === 0) {
    this.musicNote(semitone(-12), 3.2, 'sine', 0.00070, 340, step * 0.7, 1, 0);
  }
  if ((context.modTheme === 'static' || context.modTheme === 'prism') && stage !== 'clear') this.ambientNoise(1.9, 0.00020 + pressure * 0.00020, 360, 0.18);
  if ((context.modTheme === 'casino' || context.bossTheme === 'croupier') && stage !== 'start') {
    this.musicNote(semitone(-17), 0.16, 'square', 0.00070 + pressure * 0.00040, 300, step * 0.25, 1, 0);
    this.musicNote(semitone(-24), 0.16, 'square', 0.00055 + pressure * 0.00030, 260, step * 1.10, 1, 0);
  }
};

AudioBus.prototype.updateMusic = function updateMusicV2120StageDirector(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const mods = room?.mods || [];
  const portalOpen = !!room?.portal?.[2];
  const boss = !menu && room?.cat === 'boss';
  const bossHpPct = Math.max(0, Number(room?.bossHpPct || 0));
  const stage = menu ? 'menu' : musicStageV2120(room, latest, bossHpPct || 100);
  const modTheme = musicModThemeV2120(mods);
  const bossTheme = bossThemeV2120(room?.bossKind || '');
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const combat = !menu && room?.phase === 'play' && !portalOpen && !chill;
  const enemies = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  const bullets = latest?.bullets?.length || 0;
  const depth = Math.max(0, Number(room?.depth || 0));
  const loop = Math.max(0, Math.floor(depth / 4));
  const loopHeat = Math.max(0, Math.min(1, loop / 6));
  const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.35) : 0;
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = Math.max(0, Math.min(1, enemies / 36));
  const bulletPressure = Math.max(0, Math.min(1, bullets / 100));
  const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.26);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.26);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.26);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.30);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.38);
  const stageBoost = stage === 'start' ? -0.18 : stage === 'clear' ? -0.22 : stage === 'climax' ? 0.24 : 0;
  const themeBoost = modTheme === 'static' || modTheme === 'anchor' || modTheme === 'hunter' ? 0.04 : 0;
  let intensity = menu ? 0.045 : Math.max(0, Math.min(1, crowd * 0.24 + bulletPressure * 0.05 + lowHp * 0.10 + danger * 0.13 + damage * 0.14 + loopHeat * 0.13 + (boss ? 0.18 : 0) + themeBoost + stageBoost));
  if (stage === 'clear' || chill) intensity *= 0.42;
  if (stage === 'start') intensity *= 0.58;
  if (boss) intensity = Math.max(intensity, stage === 'climax' ? 0.50 : 0.36);
  const staticLike = modTheme === 'static' || modTheme === 'prism' || modTheme === 'anchor';
  const casino = modTheme === 'casino';
  const mood = stage === 'clear' ? 'resolve' : stage === 'start' ? (chill ? 'rest' : 'combat') : this.musicMoodFor({ menu, boss, chill, casino, staticLike, combat, intensity, crowd, damage, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve });
  const root = this.musicRootFor({ menu, boss, chill, casino, staticLike, mood }) * musicThemeShiftV2120(modTheme, bossTheme);
  const now = this.ctx.currentTime;
  const L = this.music.layers;
  const area = menu ? 'menu' : `${room?.cat || 'room'}:${room?.special || ''}:${mods.join(',')}:${stage}:${room?.bossKind || ''}`;
  if (area !== this.musicLastArea) {
    this.musicTransition = Math.max(this.musicTransition || 0, boss ? 0.74 : 0.58);
    this.music.phraseT = Math.min(this.music.phraseT || 0.9, stage === 'start' ? 0.42 : boss ? 0.28 : stage === 'clear' ? 0.18 : 0.55);
    this.musicLastArea = area;
  }
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * (stage === 'climax' ? 2 : 1.35), now, 2.1); L.pulse.f.frequency.setTargetAtTime(85 + intensity * 100, now, 1.9); }
  if (L.casino) L.casino.o.frequency.setTargetAtTime(root * (modTheme === 'casino' || bossTheme === 'croupier' ? 3 : 1.5), now, 2.4);
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * (boss ? 1.5 : 1.2), now, 2.6); L.dirgePad.f.frequency.setTargetAtTime(145 + intensity * 68, now, 2.4); }
  if (L.choir) L.choir.f.frequency.setTargetAtTime((boss ? 260 : 180) + intensity * 84, now, 2.2);
  if (L.glass) L.glass.o.frequency.setTargetAtTime(root * (stage === 'clear' ? 2 : 1.4), now, 2.8);
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * (stage === 'clear' ? 2 : 1.45), now, 3.4); L.highPad.f.frequency.setTargetAtTime(300 + intensity * 80, now, 2.8); }
  if (L.drive) { L.drive.o.frequency.setTargetAtTime(root * (stage === 'climax' ? 2.2 : 1.75), now, 1.4); L.drive.f.frequency.setTargetAtTime(230 + intensity * 135, now, 1.3); }
  if (L.bossLine) { L.bossLine.o.frequency.setTargetAtTime(root * (boss ? 2 : 1.4), now, 1.4); L.bossLine.f.frequency.setTargetAtTime(310 + intensity * 95, now, 1.4); }
  if (L.needle) L.needle.f.frequency.setTargetAtTime(modTheme === 'static' ? 520 : modTheme === 'casino' ? 600 : 420 + intensity * 120, now, 1.4);

  const inGame = inGameMusicAmount(room, menu);
  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    this.playDirgePhrase({ boss, chill, casino, staticLike, combat, intensity: menu ? 0.035 : intensity, menu, damage, crowd, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve, transition: this.musicTransition, mood, stage, modTheme, bossTheme });
    const eventPull = Math.max(this.musicPortal || 0, this.musicResolve || 0, this.musicTransition || 0);
    const base = menu ? 6.8 : stage === 'start' ? 7.4 : stage === 'clear' ? 5.8 : stage === 'climax' ? (boss ? 3.05 : 3.7) : boss ? 4.2 : 5.2;
    this.music.phraseT = Math.max(stage === 'climax' ? (boss ? 2.45 : 3.0) : stage === 'clear' ? 4.0 : 3.6, base - intensity * 0.42 - eventPull * 0.32 - loopHeat * 0.26 - crowd * 0.12);
  }
  const stageVol = stage === 'start' ? 0.62 : stage === 'clear' ? 0.52 : stage === 'climax' ? 0.95 : 0.74;
  const modVol = modTheme === 'anchor' ? 1.12 : modTheme === 'static' ? 0.88 : modTheme === 'casino' ? 0.92 : 1;
  const bossVol = boss ? (stage === 'climax' ? 0.86 : 0.68) : 1;
  const mul = inGame * stageVol * modVol * bossVol;
  this.setMusicLayer('drone', mul * (menu ? 0.0017 : chill ? 0.0016 : 0.0018 + intensity * 0.00024), 1.6);
  this.setMusicLayer('sub', menu ? 0.000020 : (combat && intensity > 0.68 ? (0.000030 + intensity * 0.000070 + (modTheme === 'anchor' ? 0.000040 : 0)) * mul : 0.000014), 1.5);
  this.setMusicLayer('pulse', combat && intensity > (stage === 'start' ? 0.78 : 0.50) ? (0.000040 + intensity * 0.00015 + (stage === 'climax' ? 0.000055 : 0)) * mul : 0.000018, 1.1);
  this.setMusicLayer('hat', combat && stage === 'climax' && intensity > 0.66 ? 0.000040 + intensity * 0.000060 : 0.000018, 1.0);
  this.setMusicLayer('casino', (modTheme === 'casino' || bossTheme === 'croupier') ? (0.00012 + intensity * 0.00010) * mul : 0.000016, 1.4);
  this.setMusicLayer('choir', mul * (menu ? 0.0015 : boss ? 0.0022 + intensity * 0.0014 : 0.00145 + intensity * 0.00055), 1.5);
  this.setMusicLayer('dirgePad', mul * (menu ? 0.0019 : chill ? 0.0016 : 0.00185 + intensity * 0.00058), 1.6);
  this.setMusicLayer('scrape', combat && (modTheme === 'static' || modTheme === 'prism' || stage === 'climax') ? (0.000035 + intensity * 0.000075) * mul : 0.000016, 1.1);
  this.setMusicLayer('glass', stage === 'clear' || menu || chill ? 0.00011 + (1 - intensity) * 0.000035 : 0.000012, 1.8);
  this.setMusicLayer('highPad', stage === 'clear' || menu || chill ? 0.00011 + (1 - intensity) * 0.000055 : 0.000010, 2.1);
  this.setMusicLayer('drive', combat && stage !== 'start' && intensity > (boss ? 0.42 : 0.54) ? (0.000050 + intensity * 0.00025 + (stage === 'climax' ? 0.000070 : 0)) * mul : 0.000016, 1.0);
  this.setMusicLayer('bossLine', boss ? (0.000060 + intensity * 0.00016) * (stage === 'climax' ? 1.05 : 0.65) : 0.000010, 1.1);
  this.setMusicLayer('needle', combat && (modTheme === 'static' || stage === 'climax') && intensity > 0.70 ? 0.000020 + intensity * 0.000070 : 0.000012, 1.1);
};

// v2.1.24 MUSIC REPAIR
// v2.1.20 pushed the stage/modifier director too far down: most motifs lived below
// a useful melodic register and felt like the music disappeared. Keep the room-stage
// idea, but restore audible low/mid melodic cells with restrained filters.
function musicStageV2124(room, latest = null, bossHpPct = 100) {
  if (!room) return 'menu';
  if (room.cat === 'chill' || room.special === 'chill_room') return 'rest';
  if (room.portal?.[2] || room.solved) return 'clear';
  const age = Math.max(0, Number(room.age || 0));
  const kills = Math.max(0, Number(room.kills || 0));
  const live = Math.max(0, Number(room.liveEnemies || latest?.enemies?.length || 0));
  const spawned = Math.max(0, Number(room.spawned || 0));
  const quota = Math.max(1, Number(room.quota || room.baseQuota || 1));
  if (room.cat === 'boss' && bossHpPct > 0 && bossHpPct <= 42) return 'climax';
  if (age < 6 && kills < 3 && spawned < Math.max(7, quota * 0.20)) return 'start';
  if (live >= 24 || spawned >= quota * 0.76 || kills >= quota * 0.68) return 'climax';
  return 'fight';
}
function musicModThemeV2124(mods = []) {
  if (mods.includes('casino_virus') || mods.includes('greed')) return 'casino';
  if (mods.includes('static_rain')) return 'static';
  if (mods.includes('prism_grid')) return 'prism';
  if (mods.includes('hunter_contract')) return 'hunter';
  if (mods.includes('blood_tax')) return 'blood';
  if (mods.includes('echo_walls')) return 'echo';
  if (mods.includes('moving_room')) return 'shift';
  return 'plain';
}
function bossThemeV2124(kind = '') {
  if (kind === 'boss_croupier') return 'croupier';
  if (kind === 'boss_anchor_cashier') return 'anchor_boss';
  if (kind === 'boss_hunter_chorus' || kind === 'boss_hunter_duelist' || kind === 'boss_hunter_marksman' || kind === 'boss_hunter_trapper') return 'hunter_boss';
  if (kind === 'boss_q_revisor') return 'rush';
  return kind ? 'boss' : '';
}
AudioBus.prototype.musicRootFor = function musicRootForV2124(context = {}) {
  // One tonal anchor prevents false harmony. Theme identity comes from rhythm/cell choice.
  return 43.65; // F1
};
AudioBus.prototype.musicMoodFor = function musicMoodForV2124(context = {}) {
  if (context.menu) return 'menu';
  if (context.portalOpen || context.stage === 'clear' || context.portal > 0.22) return 'portal';
  if (context.resolve > 0.22) return 'resolve';
  if (context.boss) return context.stage === 'climax' || context.intensity > 0.70 || context.chaos > 0.48 ? 'boss_chaos' : 'boss';
  if (context.chill) return 'rest';
  if (context.stage === 'climax' || context.intensity > 0.82 || context.crowd > 0.78 || context.damage > 0.64 || context.chaos > 0.58) return 'chaos';
  if (context.staticLike) return 'static';
  if (context.casino) return 'casino';
  if (context.combat) return 'combat';
  return 'rest';
};
function musicCellsV2124(stage, modTheme, bossTheme, mood) {
  const stageCells = {
    menu: [[19, 17, 15, 12], [15, 12, 10], [22, 19, 15]],
    rest: [[15, 12, 10], [19, 15, 12], [12, 10, 7]],
    start: [[12, 15, 19], [10, 12, 15], [15, 19, 22]],
    fight: [[19, 15, 12, 10], [15, 12, 10, 7], [22, 19, 15, 12]],
    climax: [[24, 22, 19, 15, 12], [22, 19, 17, 15], [27, 24, 22, 19]],
    clear: [[12, 15, 19, 24], [7, 10, 12, 15], [19, 15, 12]],
    boss: [[24, 22, 19, 15, 19], [27, 24, 19, 15], [22, 19, 15, 12]],
    boss_chaos: [[27, 24, 22, 19, 15], [31, 27, 24, 22], [24, 22, 19, 15, 12]]
  };
  const modCells = {
    casino: [[24, 27, 24, 19], [22, 24, 27, 19]],
    static: [[17, 19, 22, 17], [19, 17, 12, 10]],
    prism: [[19, 24, 22, 17], [12, 17, 19, 24]],
    hunter: [[22, 19, 15, 12], [19, 15, 10, 12]],
    blood: [[15, 12, 10, 7], [19, 15, 12, 7]],
    echo: [[12, 19, 12, 22], [15, 22, 15, 24]],
    shift: [[19, 12, 17, 10], [22, 15, 19, 12]]
  };
  const bossCells = {
    croupier: [[24, 22, 19, 15, 22], [27, 24, 19, 17]],
    anchor_boss: [[15, 12, 10, 7], [19, 15, 12, 10]],
    hunter_boss: [[22, 19, 15, 12], [24, 19, 15, 10]],
    rush: [[27, 24, 19, 24], [24, 19, 12, 19]],
    boss: [[24, 22, 19, 15], [27, 24, 19]]
  };
  if (bossTheme) return bossCells[bossTheme] || bossCells.boss;
  if (modTheme && modTheme !== 'plain' && stage !== 'clear' && stage !== 'start') return modCells[modTheme] || stageCells.fight;
  if (mood === 'menu') return stageCells.menu;
  if (mood === 'rest') return stageCells.rest;
  if (mood === 'boss' || mood === 'boss_chaos') return stageCells[mood];
  return stageCells[stage] || stageCells.fight;
}
AudioBus.prototype.ensureMusic = function ensureMusicV2124Repair() {
  if (!this.ctx || this.ctx.state !== 'running') return false;
  if (this.music) {
    this.music.maxVoices = Math.max(this.music.maxVoices || 0, 12);
    return true;
  }
  const master = this.ctx.createGain();
  master.gain.value = 0.40;
  master.connect(this.musicGain || this.master);
  this.music = { master, layers: {}, phraseT: 0.18, motifIndex: 0, lastRoomTone: '', dangerPhrase: 0, voiceCount: 0, maxVoices: 12 };
  const root = this.musicRootFor({});
  this.music.layers.drone = this.makeToneLayer(root, 'sine', 150);
  this.music.layers.sub = this.makeToneLayer(root * 0.5, 'sine', 48);
  this.music.layers.pulse = this.makeToneLayer(root * 1.5, 'triangle', 120);
  this.music.layers.hat = this.makeNoiseLayer(900, 1.7);
  this.music.layers.casino = this.makeToneLayer(root * 4, 'square', 460);
  this.music.layers.choir = this.makeToneLayer(root * 3, 'triangle', 520);
  this.music.layers.dirgePad = this.makeToneLayer(root * 2, 'triangle', 250);
  this.music.layers.scrape = this.makeNoiseLayer(340, 1.2);
  this.music.layers.glass = this.makeToneLayer(root * 5, 'sine', 900);
  this.music.layers.highPad = this.makeToneLayer(root * 5, 'sine', 980);
  this.music.layers.drive = this.makeToneLayer(root * 3, 'sawtooth', 520);
  this.music.layers.bossLine = this.makeToneLayer(root * 4, 'triangle', 780);
  this.music.layers.needle = this.makeNoiseLayer(1300, 2.6);
  return true;
};
AudioBus.prototype.playDirgePhrase = function playDirgePhraseV2124Repair(context = {}) {
  if (!this.music?.master || !this.ctx) return;
  const stage = context.stage || 'fight';
  const mood = context.mood || this.musicMoodFor(context);
  const root = this.musicRootFor(context);
  const cells = musicCellsV2124(stage, context.modTheme, context.bossTheme, mood);
  const seed = this.music.motifIndex++;
  const cell = cells[seed % cells.length];
  const boss = !!context.boss;
  const intensity = Math.max(0, Math.min(1, context.intensity || 0));
  const crowd = Math.max(0, Math.min(1, context.crowd || 0));
  const chaos = Math.max(0, Math.min(1, context.chaos || 0));
  const pressure = Math.max(intensity * 0.72, crowd * 0.44, chaos * 0.44, boss ? 0.54 : 0);
  const semitone = n => root * Math.pow(2, n / 12);
  const step = stage === 'start' ? 0.95 : stage === 'clear' ? 1.05 : stage === 'climax' ? 0.58 : boss ? 0.60 : 0.72;
  const filter = (boss ? 760 : stage === 'climax' ? 860 : stage === 'clear' ? 920 : 720) + pressure * 190;
  const stageVol = stage === 'start' ? 0.70 : stage === 'clear' ? 0.72 : stage === 'climax' ? 1.06 : 0.92;
  const leadVol = (boss ? 0.0068 : 0.0076 + pressure * 0.0030) * stageVol;
  const bodyVol = 0.0017 + pressure * 0.0009;
  this.ambientNote(semitone(boss ? 0 : -12), boss ? 3.8 : 5.0, boss ? 'triangle' : 'sine', bodyVol, 190 + pressure * 50, 0, 0, 1);
  const count = stage === 'start' || stage === 'clear' ? 3 : stage === 'climax' ? 5 : 4;
  cell.slice(0, count).forEach((m, i) => {
    const delay = i * step;
    const dur = step * (i === cell.length - 1 ? 1.55 : 1.18);
    const accent = (i === 0 || (stage === 'climax' && i === 2)) ? 1.12 : 0.76;
    this.musicNote(semitone(m), dur, i % 2 ? 'triangle' : 'sine', leadVol * accent, filter, delay, 1, 0);
    if ((stage === 'fight' || stage === 'climax' || boss) && i % 2 === 1) {
      this.musicNote(semitone(m - 12), dur * 1.25, boss ? 'triangle' : 'sine', leadVol * 0.30, 420 + pressure * 110, delay + step * 0.42, 1, 0);
    }
  });
  if (boss && seed % 2 === 0) {
    const b = (context.bossTheme === 'rush') ? [12, 19, 12] : (context.bossTheme === 'hunter_boss' ? [7, 12, 15] : [12, 15, 19]);
    b.forEach((m, i) => this.musicNote(semitone(m), 0.48, 'triangle', (0.0024 + pressure * 0.0010) * (i === 0 ? 1 : 0.65), 520 + pressure * 120, i * 0.34, 1, 0));
  }
  if ((context.modTheme === 'static' || context.modTheme === 'prism') && stage !== 'clear' && seed % 2 === 0) this.ambientNoise(1.8, 0.00036 + pressure * 0.00026, 520, 0.16);
};
AudioBus.prototype.updateMusic = function updateMusicV2124Repair(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const mods = room?.mods || [];
  const portalOpen = !!room?.portal?.[2];
  const boss = !menu && room?.cat === 'boss';
  const bossHpPct = Math.max(0, Number(room?.bossHpPct || 0));
  const stage = menu ? 'menu' : musicStageV2124(room, latest, bossHpPct || 100);
  const modTheme = musicModThemeV2124(mods);
  const bossTheme = bossThemeV2124(room?.bossKind || '');
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const combat = !menu && room?.phase === 'play' && !portalOpen && !chill;
  const enemies = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  const bullets = latest?.bullets?.length || 0;
  const depth = Math.max(0, Number(room?.depth || 0));
  const loop = Math.max(0, Math.floor(depth / 4));
  const loopHeat = Math.max(0, Math.min(1, loop / 6));
  const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.35) : 0;
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = Math.max(0, Math.min(1, enemies / 34));
  const bulletPressure = Math.max(0, Math.min(1, bullets / 100));
  const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.28);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.30);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.28);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.30);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.38);
  const stageBoost = stage === 'start' ? -0.10 : stage === 'clear' ? -0.18 : stage === 'climax' ? 0.26 : 0;
  const themeBoost = modTheme === 'static' || modTheme === 'hunter' ? 0.05 : 0;
  let intensity = menu ? 0.06 : Math.max(0, Math.min(1, crowd * 0.28 + bulletPressure * 0.06 + lowHp * 0.12 + danger * 0.16 + damage * 0.18 + loopHeat * 0.16 + (boss ? 0.24 : 0) + themeBoost + stageBoost));
  if (stage === 'clear' || chill) intensity *= 0.50;
  if (stage === 'start') intensity *= 0.72;
  if (boss) intensity = Math.max(intensity, stage === 'climax' ? 0.62 : 0.46);
  const staticLike = modTheme === 'static' || modTheme === 'prism';
  const casino = modTheme === 'casino';
  const mood = this.musicMoodFor({ menu, boss, chill, casino, staticLike, combat, intensity, crowd, damage, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve, stage });
  const root = this.musicRootFor({ menu, boss, chill, casino, staticLike, mood });
  const now = this.ctx.currentTime;
  const L = this.music.layers;
  const area = menu ? 'menu' : `${room?.cat || 'room'}:${room?.special || ''}:${mods.join(',')}:${stage}:${room?.bossKind || ''}`;
  if (area !== this.musicLastArea) {
    this.musicTransition = Math.max(this.musicTransition || 0, boss ? 0.78 : 0.62);
    this.music.phraseT = Math.min(this.music.phraseT || 0.4, stage === 'start' ? 0.26 : boss ? 0.14 : stage === 'clear' ? 0.12 : 0.34);
    this.musicLastArea = area;
  }
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * (stage === 'climax' ? 2 : 1.5), now, 1.4); L.pulse.f.frequency.setTargetAtTime(120 + intensity * 180, now, 1.2); }
  if (L.casino) L.casino.o.frequency.setTargetAtTime(root * (modTheme === 'casino' || bossTheme === 'croupier' ? 5 : 3), now, 1.7);
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * (boss ? 3 : 2), now, 1.7); L.dirgePad.f.frequency.setTargetAtTime(260 + intensity * 140, now, 1.4); }
  if (L.choir) L.choir.f.frequency.setTargetAtTime((boss ? 520 : 360) + intensity * 230, now, 1.4);
  if (L.glass) L.glass.o.frequency.setTargetAtTime(root * (stage === 'clear' ? 6 : 5), now, 2.0);
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * (stage === 'clear' || menu || chill ? 6 : 4), now, 2.3); L.highPad.f.frequency.setTargetAtTime(720 + intensity * 260, now, 1.8); }
  if (L.drive) { L.drive.o.frequency.setTargetAtTime(root * (stage === 'climax' ? 3 : 2.5), now, 0.8); L.drive.f.frequency.setTargetAtTime(360 + intensity * 300, now, 0.8); }
  if (L.bossLine) { L.bossLine.o.frequency.setTargetAtTime(root * (boss ? 4 : 3), now, 0.9); L.bossLine.f.frequency.setTargetAtTime(650 + intensity * 220, now, 0.9); }
  if (L.needle) L.needle.f.frequency.setTargetAtTime(modTheme === 'static' ? 900 : modTheme === 'casino' ? 1050 : 780 + intensity * 260, now, 0.9);
  const inGame = inGameMusicAmount(room, menu);
  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    this.playDirgePhrase({ boss, chill, casino, staticLike, combat, intensity: menu ? 0.04 : intensity, menu, damage, crowd, chaos: this.musicChaos, portalOpen, portal: this.musicPortal, resolve: this.musicResolve, transition: this.musicTransition, mood, stage, modTheme, bossTheme });
    const eventPull = Math.max(this.musicPortal || 0, this.musicResolve || 0, this.musicTransition || 0);
    const base = menu ? 5.8 : stage === 'start' ? 5.2 : stage === 'clear' ? 4.4 : stage === 'climax' ? (boss ? 2.45 : 2.9) : boss ? 3.2 : 3.8;
    this.music.phraseT = Math.max(stage === 'climax' ? (boss ? 1.9 : 2.35) : stage === 'clear' ? 3.25 : 2.6, base - intensity * 0.70 - eventPull * 0.45 - loopHeat * 0.36 - crowd * 0.22);
  }
  const stageVol = stage === 'start' ? 0.72 : stage === 'clear' ? 0.60 : stage === 'climax' ? 1.0 : 0.84;
  const bossVol = boss ? (stage === 'climax' ? 0.86 : 0.78) : 1;
  const mul = inGame * stageVol * bossVol;
  this.setMusicLayer('drone', mul * (menu ? 0.0020 : chill ? 0.0018 : 0.0022 + intensity * 0.00030), 1.0);
  this.setMusicLayer('sub', menu ? 0.000024 : (combat && intensity > 0.70 ? (0.000038 + intensity * 0.000080) * mul : 0.000018), 1.0);
  this.setMusicLayer('pulse', combat && intensity > (stage === 'start' ? 0.70 : 0.45) ? (0.000070 + intensity * 0.00022 + (stage === 'climax' ? 0.000070 : 0)) * mul : 0.000022, 0.75);
  this.setMusicLayer('hat', combat && stage === 'climax' && intensity > 0.62 ? 0.000070 + intensity * 0.000095 : 0.000024, 0.8);
  this.setMusicLayer('casino', (modTheme === 'casino' || bossTheme === 'croupier') ? (0.00020 + intensity * 0.00015) * mul : 0.000020, 1.0);
  this.setMusicLayer('choir', mul * (menu ? 0.0017 : boss ? 0.0037 + intensity * 0.0024 : 0.0020 + intensity * 0.00085), 1.0);
  this.setMusicLayer('dirgePad', mul * (menu ? 0.0022 : chill ? 0.0018 : 0.0026 + intensity * 0.00088), 1.0);
  this.setMusicLayer('scrape', combat && (modTheme === 'static' || modTheme === 'prism' || stage === 'climax') ? (0.000055 + intensity * 0.00011) * mul : 0.000020, 0.85);
  this.setMusicLayer('glass', stage === 'clear' || menu || chill ? 0.00020 + (1 - intensity) * 0.000060 : 0.000020, 1.3);
  this.setMusicLayer('highPad', stage === 'clear' || menu || chill ? 0.00018 + (1 - intensity) * 0.000080 : 0.000028, 1.5);
  this.setMusicLayer('drive', combat && stage !== 'start' && intensity > (boss ? 0.38 : 0.50) ? (0.000105 + intensity * 0.00045 + (stage === 'climax' ? 0.00010 : 0)) * mul : 0.000024, 0.65);
  this.setMusicLayer('bossLine', boss ? (0.00018 + intensity * 0.00042) * (stage === 'climax' ? 1.0 : 0.72) : 0.000014, 0.65);
  this.setMusicLayer('needle', combat && (modTheme === 'static' || stage === 'climax') && intensity > 0.68 ? 0.000042 + intensity * 0.00013 : 0.000018, 0.8);
};

// v2.1.25: final completion theme. This deliberately sits above the room-stage
// director: after the 10th loop the game should stop sounding like combat and
// play a long, pleasant, low/mid-register ending phrase.
const updateMusicBeforeFinaleV2125 = AudioBus.prototype.updateMusic;
function playFinaleThemePhraseV2125(bus, intensity = 0.25) {
  if (!bus.music?.master || !bus.ctx) return;
  const root = 55; // A1-ish: warm low center, no sharp top notes.
  const semi = n => root * Math.pow(2, n / 12);
  const cell = [0, 3, 7, 12, 10, 7, 5, 3, 0, -5, 0, 7];
  const step = 0.82;
  cell.forEach((n, i) => {
    const delay = i * step;
    const vol = 0.0072 * (i === 0 || i === 3 || i === 8 ? 1.0 : 0.68);
    bus.musicNote(semi(n), step * 1.55, i % 3 === 1 ? 'triangle' : 'sine', vol, 860 + intensity * 160, delay, 1, 0);
    if (i % 4 === 0) bus.musicNote(semi(n - 12), step * 2.8, 'triangle', 0.0022, 360, delay, 1, 0);
  });
  bus.ambientNote(semi(-24), 9.5, 'sine', 0.0026, 120, 0, 0, 1);
}
AudioBus.prototype.updateMusic = function updateMusicV2125Finale(state, dt = 0.016) {
  const room = state?.room || null;
  if (!room || room.phase !== 'won') return updateMusicBeforeFinaleV2125.call(this, state, dt);
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const now = this.ctx.currentTime;
  const L = this.music.layers || {};
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.20);
  const root = 55;
  if (L.drone) { L.drone.o.frequency.setTargetAtTime(root, now, 2.4); L.drone.f.frequency.setTargetAtTime(240, now, 2.0); }
  if (L.sub) L.sub.o.frequency.setTargetAtTime(root * 0.5, now, 2.0);
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * 2, now, 2.4); L.pulse.f.frequency.setTargetAtTime(95, now, 2.0); }
  if (L.casino) L.casino.o.frequency.setTargetAtTime(root * 3, now, 2.6);
  if (L.choir) { L.choir.o.frequency.setTargetAtTime(root * 4, now, 2.8); L.choir.f.frequency.setTargetAtTime(620, now, 2.4); }
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * 2, now, 2.5); L.dirgePad.f.frequency.setTargetAtTime(340, now, 2.0); }
  if (L.glass) { L.glass.o.frequency.setTargetAtTime(root * 6, now, 3.0); L.glass.f.frequency.setTargetAtTime(780, now, 2.4); }
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * 5, now, 3.0); L.highPad.f.frequency.setTargetAtTime(740, now, 2.4); }
  if (L.drive) L.drive.o.frequency.setTargetAtTime(root * 2, now, 2.0);
  if (L.bossLine) L.bossLine.o.frequency.setTargetAtTime(root * 3, now, 2.0);
  this.setMusicLayer('drone', 0.0030, 1.8);
  this.setMusicLayer('sub', 0.000050, 1.8);
  this.setMusicLayer('pulse', 0.000035, 1.6);
  this.setMusicLayer('hat', 0.000012, 1.4);
  this.setMusicLayer('casino', 0.000060, 1.6);
  this.setMusicLayer('choir', 0.0038, 2.0);
  this.setMusicLayer('dirgePad', 0.0036, 2.0);
  this.setMusicLayer('scrape', 0.000006, 1.0);
  this.setMusicLayer('glass', 0.00022, 2.0);
  this.setMusicLayer('highPad', 0.00016, 2.0);
  this.setMusicLayer('drive', 0.000018, 1.0);
  this.setMusicLayer('bossLine', 0.000010, 1.0);
  this.setMusicLayer('needle', 0.000006, 1.0);
  this.music.finalPhraseT = Math.max(0, (this.music.finalPhraseT || 0) - dt);
  if (this.music.finalPhraseT <= 0) {
    playFinaleThemePhraseV2125(this, 0.22);
    this.music.finalPhraseT = 10.2;
  }
};



// v2.1.26 GLOBAL SLOW MIX
// The v2.1.20+ stage director survived, but the whole score is now slower,
// lower, and less bright. High layers are clamped to low-mid filter ranges and
// melody density depends on actual room pressure, so small rooms do not sound
// like climax fights.
const updateMusicBeforeV2126SlowMix = AudioBus.prototype.updateMusic;
const playDirgePhraseBeforeV2126SlowMix = AudioBus.prototype.playDirgePhrase;
const playBossHookBeforeV2126SlowMix = AudioBus.prototype.playBossHook;
AudioBus.prototype.playBossHook = function playBossHookV2126Soft(context = {}) {
  const ctx = { ...context, intensity: Math.max(0, Math.min(1, (context.intensity || 0) * 0.62)), chaos: Math.max(0, (context.chaos || 0) * 0.55) };
  const oldMusicNote = this.musicNote;
  this.musicNote = (freq, dur, wave, vol, filter, delay, pan, detune) => oldMusicNote.call(this, Math.max(32, freq * 0.5), dur * 1.5, wave === 'sawtooth' ? 'triangle' : wave, vol * 0.46, Math.min(filter || 700, 520), delay * 1.5, pan, detune);
  try { return playBossHookBeforeV2126SlowMix.call(this, ctx); }
  finally { this.musicNote = oldMusicNote; }
};
AudioBus.prototype.playDirgePhrase = function playDirgePhraseV2126Slow(context = {}) {
  const roomPressure = Math.max(0, Math.min(1, (context.crowd || 0) * 0.65 + (context.intensity || 0) * 0.35));
  const ctx = { ...context, intensity: Math.max(0, Math.min(1, (context.intensity || 0) * (0.55 + roomPressure * 0.25))), chaos: Math.max(0, (context.chaos || 0) * 0.55) };
  const oldMusicNote = this.musicNote;
  const oldAmbientNote = this.ambientNote;
  const oldAmbientNoise = this.ambientNoise;
  this.musicNote = (freq, dur, wave, vol, filter, delay, pan, detune) => oldMusicNote.call(this, Math.max(30, freq * 0.5), dur * 1.5, wave === 'sawtooth' ? 'triangle' : wave, vol * (0.50 + roomPressure * 0.18), Math.min(filter || 620, roomPressure < 0.35 ? 420 : 560), delay * 1.5, pan, detune);
  this.ambientNote = (freq, dur, wave, vol, filter, delay, pan, detune) => oldAmbientNote.call(this, Math.max(28, freq * 0.5), dur * 1.5, wave === 'sawtooth' ? 'triangle' : wave, vol * 0.62, Math.min(filter || 420, 420), delay * 1.5, pan, detune);
  this.ambientNoise = (dur, vol, filter, delay) => oldAmbientNoise.call(this, dur * 1.5, vol * 0.45, Math.min(filter || 420, 420), delay * 1.5);
  try { return playDirgePhraseBeforeV2126SlowMix.call(this, ctx); }
  finally { this.musicNote = oldMusicNote; this.ambientNote = oldAmbientNote; this.ambientNoise = oldAmbientNoise; }
};
AudioBus.prototype.updateMusic = function updateMusicV2126SlowMix(state, dt = 0.016) {
  const room = state?.room || null;
  const live = Math.max(0, Number(room?.liveEnemies || state?.latest?.enemies?.length || 0));
  const boss = !!room && room.cat === 'boss';
  const pressure = Math.max(0, Math.min(1, live / (boss ? 18 : 28)));
  const globalMul = 0.54 + pressure * 0.20;
  const oldSetMusicLayer = this.setMusicLayer;
  this.setMusicLayer = (name, target, time = 0.7) => {
    const bright = name === 'glass' || name === 'highPad' || name === 'needle' || name === 'bossLine' || name === 'casino' || name === 'hat';
    const mul = globalMul * (bright ? 0.52 : 1.0);
    return oldSetMusicLayer.call(this, name, Math.max(0, target || 0) * mul, Math.max(0.2, time * 1.5));
  };
  try { updateMusicBeforeV2126SlowMix.call(this, state, dt * 0.66); }
  finally { this.setMusicLayer = oldSetMusicLayer; }
  if (!this.music?.layers || !this.ctx) return;
  const L = this.music.layers;
  const now = this.ctx.currentTime;
  for (const name of ['casino','choir','dirgePad','glass','highPad','drive','bossLine','needle','pulse','hat']) {
    const layer = L[name];
    if (layer?.f?.frequency) layer.f.frequency.setTargetAtTime(Math.min(layer.f.frequency.value || 600, name === 'needle' ? 520 : name === 'glass' || name === 'highPad' ? 470 : 560), now, 1.4);
  }
};


// v2.1.28 MUSIC THEME BRIGHTNESS PASS
// Goal: undo the over-muted v2.1.26 blanket while keeping the game dark.
// Design notes used here: short recognizable cells, Herrmann-like repetition,
// low/mid industrial color, and a single main menu motif that returns in room clear/finale.
const handleFxBeforeV2128MusicTheme = AudioBus.prototype.handleFx;
function clamp01V2128(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }
function musicSemiV2128(root, n) { return root * Math.pow(2, n / 12); }
function musicBossThemeV2128(kind = '') {
  const k = String(kind || '').toLowerCase();
  if (k.includes('croupier')) return 'croupier';
  if (k.includes('hunter')) return 'hunter';
  if (k.includes('rush')) return 'rush';
  if (k.includes('anchor')) return 'cashier';
  return 'boss';
}
function musicModThemeV2128(mods = []) {
  const list = Array.isArray(mods) ? mods : [];
  if (list.includes('greed') || list.includes('casino_virus')) return 'casino';
  if (list.includes('static_rain')) return 'static';
  if (list.includes('prism_grid')) return 'prism';
  if (list.includes('hunter_contract')) return 'hunter';
  if (list.includes('blood_tax')) return 'blood';
  if (list.includes('echo_walls')) return 'echo';
  if (list.includes('moving_room')) return 'shift';
  return 'none';
}
function musicStageV2128(room, latest = null, bossHpPct = 100) {
  if (!room) return 'menu';
  if (room.phase === 'won') return 'finale';
  const portal = !!room?.portal?.[2];
  if (portal) return 'clear';
  const live = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  if (room.cat === 'boss' && Number.isFinite(bossHpPct) && bossHpPct > 0 && bossHpPct <= 35) return 'climax';
  if ((room.t || 0) < 8 && live < 10) return 'start';
  if (live > 22 || room?.finalBoss) return 'climax';
  return 'fight';
}
function musicCellsV2128(stage = 'fight', modTheme = 'none', bossTheme = 'boss', mood = 'combat') {
  const menuMain = [24, 27, 31, 34, 31, 27, 24, 22, 19, 22, 24, 19]; // dark, harmonic, recognizable
  const base = {
    menu: [menuMain, [19, 22, 24, 27, 31, 27, 24], [24, 22, 19, 15, 19, 22, 24]],
    start: [[19, 22, 24, 27, 24, 22], [24, 27, 31, 27, 24], [15, 19, 22, 24, 22]],
    fight: [[24, 22, 19, 15, 19, 22], [27, 24, 22, 19, 22, 24], [31, 27, 24, 19, 24, 27]],
    climax: [[31, 27, 24, 22, 19, 22], [36, 31, 27, 24, 27, 31], [34, 31, 27, 24, 22]],
    clear: [[24, 27, 31, 34, 31, 27], [19, 24, 27, 31, 27, 24], [12, 19, 24, 27, 24]],
    finale: [[0, 4, 7, 12, 16, 19, 21, 19, 16, 12, 7, 4], [7, 12, 16, 19, 24, 21, 19, 16, 12], [0, 7, 12, 16, 19, 16, 12, 7]],
    boss: [[31, 27, 24, 19, 24, 27, 31], [36, 34, 31, 27, 24, 27], [39, 36, 31, 27, 24]],
  };
  if (stage === 'menu') return base.menu;
  if (stage === 'finale') return base.finale;
  if (stage === 'clear') return base.clear;
  if (mood === 'boss' || mood === 'boss_chaos') {
    if (bossTheme === 'rush') return [[31, 24, 31, 22, 31, 19], [36, 31, 24, 31, 22], [24, 31, 36, 31, 24]];
    if (bossTheme === 'hunter') return [[24, 27, 31, 24, 27, 34], [19, 24, 31, 27, 24], [31, 34, 31, 27, 24]];
    if (bossTheme === 'croupier') return [[24, 27, 24, 31, 27, 34], [19, 24, 27, 31, 27], [31, 27, 24, 22, 24]];
    return base.boss;
  }
  if (stage === 'climax') return base.climax;
  if (stage === 'start') return base.start;
  if (modTheme === 'casino') return [[24, 27, 24, 31, 27, 24], [19, 24, 27, 31, 27], [31, 34, 31, 27, 24]];
  if (modTheme === 'static' || modTheme === 'prism') return [[24, 22, 19, 17, 19, 22], [29, 24, 22, 19, 17], [31, 29, 24, 22]];
  if (modTheme === 'hunter') return [[24, 27, 31, 27, 24], [19, 24, 31, 27, 24], [31, 27, 24, 19]];
  return base.fight;
}
function musicMoodV2128({ menu, boss, stage, modTheme, combat, intensity, crowd, damage, chaos, portalOpen }) {
  if (menu) return 'menu';
  if (stage === 'clear' || portalOpen) return 'resolve';
  if (boss) return intensity > 0.68 || chaos > 0.48 || stage === 'climax' ? 'boss_chaos' : 'boss';
  if (stage === 'start') return 'rest';
  if (stage === 'climax' || intensity > 0.78 || crowd > 0.78 || damage > 0.62 || chaos > 0.58) return 'chaos';
  if (modTheme === 'static' || modTheme === 'prism') return 'static';
  if (modTheme === 'casino') return 'casino';
  if (combat) return 'combat';
  return 'rest';
}
function playMusicCellV2128(bus, opts = {}) {
  if (!bus.music?.master || !bus.ctx) return;
  const stage = opts.stage || 'fight';
  const mood = opts.mood || 'combat';
  const boss = !!opts.boss;
  const intensity = clamp01V2128(opts.intensity);
  const crowd = clamp01V2128(opts.crowd);
  const pressure = Math.max(intensity * 0.74, crowd * 0.42, boss ? 0.46 : 0);
  const root = stage === 'finale' ? 55.0 : 43.65;
  const cells = musicCellsV2128(stage, opts.modTheme, opts.bossTheme, mood);
  const seed = bus.music.motifIndex++;
  const cell = cells[seed % cells.length];
  const speedVar = [0.78, 0.92, 1.06, 1.22, 0.86][seed % 5];
  const baseStep = stage === 'menu' ? 0.82 : stage === 'start' ? 0.88 : stage === 'clear' ? 0.66 : stage === 'finale' ? 0.50 : stage === 'climax' ? 0.46 : boss ? 0.54 : 0.62;
  const step = Math.max(0.34, baseStep * speedVar);
  const bright = stage === 'finale' ? 5.0 : stage === 'clear' ? 1.65 : boss ? 1.18 : stage === 'menu' ? 1.25 : 1.18;
  const filter = stage === 'finale' ? 2400 : stage === 'clear' ? 1650 : stage === 'menu' ? 1420 : boss ? 1250 : stage === 'climax' ? 1380 : 1180;
  const leadVol = (stage === 'finale' ? 0.024 : stage === 'clear' ? 0.014 : stage === 'menu' ? 0.0105 : boss ? 0.0108 : 0.0092 + pressure * 0.0032) * (bright >= 5 ? 1 : 1.0);
  const count = stage === 'menu' ? Math.min(10, cell.length) : stage === 'finale' ? Math.min(12, cell.length) : stage === 'climax' || boss ? Math.min(6, cell.length) : Math.min(5, cell.length);
  const wave = stage === 'finale' || stage === 'menu' || stage === 'clear' ? 'sine' : 'triangle';
  // Warm body note below the melody: keeps harmony dark, but no longer swallows the theme.
  bus.musicNote(musicSemiV2128(root, (cell[0] || 12) - 12), step * (stage === 'finale' ? 7.2 : 4.8), 'triangle', leadVol * (stage === 'finale' ? 0.28 : 0.20), Math.max(260, filter * 0.34), 0, 1, 0);
  for (let i = 0; i < count; i++) {
    const n = cell[i];
    const delay = i * step * (i % 3 === 2 ? 1.12 : 1.0);
    const accent = (i === 0 || i === count - 1 || (stage === 'finale' && i === 4)) ? 1.20 : 0.80;
    bus.musicNote(musicSemiV2128(root, n), step * (stage === 'finale' ? 1.75 : 1.25), i % 2 ? 'triangle' : wave, leadVol * accent, filter, delay, 1, 0);
    if ((i % 2 === 1 || stage === 'finale') && stage !== 'menu') {
      const lower = n - (stage === 'finale' ? 12 : boss ? 7 : 12);
      bus.musicNote(musicSemiV2128(root, lower), step * 1.6, 'triangle', leadVol * (stage === 'finale' ? 0.34 : 0.24), Math.max(420, filter * 0.55), delay + step * 0.36, 1, 0);
    }
  }
  if (stage === 'finale') {
    bus.musicNote(musicSemiV2128(root, 28), 3.4, 'sine', 0.0062, 2600, step * 6.1, 1, 0);
    bus.ambientNoise(5.0, 0.00055, 1450, step * 2.0);
  } else if (stage === 'clear') {
    bus.musicNote(musicSemiV2128(root, 36), 1.7, 'sine', leadVol * 0.46, 1750, step * 3.1, 1, 0);
  }
}
function playRoomClearStingV2128(bus) {
  if (!bus.music?.master || !bus.ctx) return;
  playMusicCellV2128(bus, { stage: 'clear', mood: 'resolve', intensity: 0.35, crowd: 0.0, modTheme: 'none' });
}
function playBossAfterglowV2128(bus) {
  if (!bus.music?.master || !bus.ctx) return;
  const root = 43.65;
  const notes = [24, 27, 31, 34, 31, 27, 24];
  notes.forEach((n, i) => bus.musicNote(musicSemiV2128(root, n), 0.82, i % 2 ? 'triangle' : 'sine', 0.011 * (i === 0 ? 1.1 : 0.78), 1550, i * 0.42, 1, 0));
  bus.musicNote(musicSemiV2128(root, 12), 5.6, 'triangle', 0.0038, 520, 0.1, 1, 0);
}
AudioBus.prototype.handleFx = function handleFxV2128MusicTheme(f, info = {}) {
  const out = handleFxBeforeV2128MusicTheme.call(this, f, info);
  if (!this.ensureMusic?.()) return out;
  if (f?.t === 'boss_down') {
    this.musicResolve = 1;
    this.music.phraseT = Math.min(this.music.phraseT || 0, 0.04);
    playBossAfterglowV2128(this);
  } else if (f?.t === 'room_invoice' || f?.t === 'portal_open') {
    this.musicResolve = Math.max(this.musicResolve || 0, 0.85);
    this.music.phraseT = Math.min(this.music.phraseT || 0, 0.06);
    playRoomClearStingV2128(this);
  }
  return out;
};
AudioBus.prototype.updateMusic = function updateMusicV2128Theme(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const mods = room?.mods || [];
  const boss = !menu && room?.cat === 'boss';
  const bossHpPct = Math.max(0, Number(room?.bossHpPct || 0));
  const stage = menu ? 'menu' : musicStageV2128(room, latest, bossHpPct || 100);
  const modTheme = musicModThemeV2128(mods);
  const bossTheme = musicBossThemeV2128(room?.bossKind || '');
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const combat = !menu && room?.phase === 'play' && !room?.portal?.[2] && !chill;
  const enemies = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  const bullets = latest?.bullets?.length || 0;
  const depth = Math.max(0, Number(room?.depth || 0));
  const loop = Math.max(0, Math.floor(depth / 4));
  const loopHeat = Math.max(0, Math.min(1, loop / 8));
  const portalOpen = !!room?.portal?.[2];
  const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.25) : 0;
  const crowd = Math.max(0, Math.min(1, enemies / 30));
  const bulletPressure = Math.max(0, Math.min(1, bullets / 88));
  const damage = Math.max(0, Math.min(1, this.damageEnergy || 0));
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.34);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.36);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.32);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.34);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.40);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  let intensity = menu ? 0.12 : Math.max(0, Math.min(1, crowd * 0.31 + bulletPressure * 0.075 + lowHp * 0.12 + danger * 0.17 + damage * 0.20 + loopHeat * 0.14 + (boss ? 0.22 : 0) + (stage === 'climax' ? 0.18 : 0)));
  if (stage === 'start') intensity *= 0.76;
  if (stage === 'clear') intensity *= 0.42;
  const mood = musicMoodV2128({ menu, boss, stage, modTheme, combat, intensity, crowd, damage, chaos: this.musicChaos, portalOpen });
  const root = stage === 'finale' ? 55 : 43.65;
  const now = this.ctx.currentTime;
  const L = this.music.layers || {};
  const area = menu ? 'menu' : `${room?.phase || 'room'}:${room?.cat || 'room'}:${stage}:${modTheme}:${bossTheme}:${mods.join(',')}`;
  if (area !== this.musicLastArea) {
    this.musicTransition = Math.max(this.musicTransition || 0, stage === 'finale' ? 1.0 : boss ? 0.84 : 0.66);
    this.music.phraseT = Math.min(this.music.phraseT || 0.4, stage === 'clear' || stage === 'finale' ? 0.03 : menu ? 0.06 : 0.18);
    this.musicLastArea = area;
  }
  const final = stage === 'finale';
  const clear = stage === 'clear';
  if (L.drone) { L.drone.o.frequency.setTargetAtTime(root, now, 1.4); L.drone.f.frequency.setTargetAtTime(final ? 420 : menu ? 330 : 260 + intensity * 120, now, 1.2); }
  if (L.sub) L.sub.o.frequency.setTargetAtTime(root * 0.5, now, 1.6);
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * (final ? 2 : clear ? 2.5 : stage === 'climax' ? 2.25 : 1.5), now, 1.0); L.pulse.f.frequency.setTargetAtTime(final ? 340 : 160 + intensity * 240, now, 1.0); }
  if (L.casino) { L.casino.o.frequency.setTargetAtTime(root * (modTheme === 'casino' || bossTheme === 'croupier' ? 5 : final ? 4 : 3), now, 1.2); L.casino.f.frequency.setTargetAtTime(final ? 1100 : 520 + intensity * 280, now, 1.0); }
  if (L.choir) { L.choir.o.frequency.setTargetAtTime(root * (final ? 5 : boss ? 4 : 3), now, 1.4); L.choir.f.frequency.setTargetAtTime(final ? 1350 : boss ? 820 : 520 + intensity * 330, now, 1.1); }
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * (final ? 3 : boss ? 3 : 2), now, 1.3); L.dirgePad.f.frequency.setTargetAtTime(final ? 980 : clear ? 780 : 360 + intensity * 260, now, 1.0); }
  if (L.glass) { L.glass.o.frequency.setTargetAtTime(root * (final ? 7 : clear || menu ? 6 : 5), now, 1.5); L.glass.f.frequency.setTargetAtTime(final ? 2100 : clear ? 1650 : menu ? 1350 : 980 + intensity * 260, now, 1.2); }
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * (final ? 8 : clear || menu ? 7 : 5), now, 1.8); L.highPad.f.frequency.setTargetAtTime(final ? 2300 : clear ? 1700 : menu ? 1450 : 1050 + intensity * 260, now, 1.4); }
  if (L.drive) { L.drive.o.frequency.setTargetAtTime(root * (stage === 'climax' ? 3 : boss ? 2.5 : 2), now, 0.8); L.drive.f.frequency.setTargetAtTime(final ? 720 : 460 + intensity * 380, now, 0.8); }
  if (L.bossLine) { L.bossLine.o.frequency.setTargetAtTime(root * (boss ? 4 : final ? 5 : 3), now, 0.9); L.bossLine.f.frequency.setTargetAtTime(final ? 1500 : 820 + intensity * 260, now, 0.9); }
  if (L.needle) L.needle.f.frequency.setTargetAtTime(final ? 1600 : modTheme === 'static' ? 900 : 950 + intensity * 420, now, 0.9);
  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    playMusicCellV2128(this, { stage, mood, boss, intensity, crowd, modTheme, bossTheme });
    const eventPull = Math.max(this.musicPortal || 0, this.musicResolve || 0, this.musicTransition || 0);
    const speedFamily = [0.82, 1.0, 1.16, 0.92, 1.28][(this.music.motifIndex || 0) % 5];
    const base = final ? 6.6 : menu ? 4.8 : stage === 'start' ? 4.6 : clear ? 3.45 : stage === 'climax' ? (boss ? 2.20 : 2.55) : boss ? 2.95 : 3.35;
    this.music.phraseT = Math.max(final ? 4.8 : clear ? 2.7 : 1.75, (base - intensity * 0.58 - eventPull * 0.34 - crowd * 0.18) * speedFamily);
  }
  const inGame = inGameMusicAmount(room, menu);
  const stageVol = final ? 2.75 : clear ? 1.35 : stage === 'start' ? 0.92 : stage === 'climax' ? 1.18 : 1.0;
  const crowdDim = !boss && !menu && enemies <= 6 && stage !== 'clear' ? 0.82 : 1.0;
  const mul = inGame * stageVol * crowdDim;
  this.setMusicLayer('drone', mul * (menu ? 0.0032 : 0.0028 + intensity * 0.00055), 0.8);
  this.setMusicLayer('sub', final ? 0.000075 : (combat && intensity > 0.58 ? (0.000050 + intensity * 0.00011) * mul : 0.000026), 0.85);
  this.setMusicLayer('pulse', final ? 0.00013 : (combat && intensity > 0.35 ? (0.00010 + intensity * 0.00034) * mul : clear ? 0.000060 : 0.000030), 0.65);
  this.setMusicLayer('hat', final ? 0.000065 : (combat && stage === 'climax' ? 0.000095 + intensity * 0.00012 : 0.000032), 0.65);
  this.setMusicLayer('casino', (modTheme === 'casino' || bossTheme === 'croupier' || final) ? (0.00026 + intensity * 0.00022) * mul : 0.000030, 0.85);
  this.setMusicLayer('choir', mul * (menu ? 0.0034 : final ? 0.0105 : boss ? 0.0061 + intensity * 0.0030 : 0.0030 + intensity * 0.0013), 0.9);
  this.setMusicLayer('dirgePad', mul * (menu ? 0.0038 : final ? 0.0092 : clear ? 0.0052 : 0.0038 + intensity * 0.0014), 0.9);
  this.setMusicLayer('scrape', combat && (modTheme === 'static' || modTheme === 'prism' || stage === 'climax') ? (0.000065 + intensity * 0.00013) * mul : 0.000026, 0.75);
  this.setMusicLayer('glass', final ? 0.00145 : clear || menu ? 0.00048 : 0.000075, 1.0);
  this.setMusicLayer('highPad', final ? 0.00118 : clear || menu ? 0.00042 : 0.000085, 1.1);
  this.setMusicLayer('drive', combat && stage !== 'start' && intensity > (boss ? 0.32 : 0.42) ? (0.00015 + intensity * 0.00056 + (stage === 'climax' ? 0.00012 : 0)) * mul : final ? 0.00008 : 0.000028, 0.55);
  this.setMusicLayer('bossLine', boss ? (0.00024 + intensity * 0.00050) * (stage === 'climax' ? 1.08 : 0.78) : final ? 0.00018 : 0.000018, 0.55);
  this.setMusicLayer('needle', combat && (modTheme === 'static' || stage === 'climax') && intensity > 0.58 ? 0.000050 + intensity * 0.00015 : final ? 0.000036 : 0.000020, 0.7);
};

// v2.1.29 COMPOSED SOFT MUSIC PASS
// Replaces the fast pseudo-random phrase layer with fixed, recognizable themes.
// The score now uses slow written motifs, soft sine/triangle instruments, and a darker low-mid register.
const handleFxBeforeV2129ComposedMusic = AudioBus.prototype.handleFx;
function clamp01V2129(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }
function semiV2129(root, n) { return root * Math.pow(2, n / 12); }
function bossThemeV2129(kind = '') {
  const k = String(kind || '').toLowerCase();
  if (k.includes('croupier')) return 'croupier';
  if (k.includes('hunter')) return 'hunter';
  if (k.includes('rush')) return 'rush';
  if (k.includes('anchor')) return 'cashier';
  return 'boss';
}
function modThemeV2129(mods = []) {
  const list = Array.isArray(mods) ? mods : [];
  if (list.includes('greed') || list.includes('casino_virus')) return 'casino';
  if (list.includes('static_rain')) return 'static';
  if (list.includes('prism_grid')) return 'prism';
  if (list.includes('hunter_contract')) return 'hunter';
  if (list.includes('blood_tax')) return 'blood';
  if (list.includes('echo_walls')) return 'echo';
  if (list.includes('moving_room')) return 'shift';
  return 'none';
}
function stageV2129(room, latest = null, bossHpPct = 100) {
  if (!room) return 'menu';
  if (room.phase === 'won') return 'finale';
  if (room?.portal?.[2]) return 'clear';
  const live = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  if (room.cat === 'boss' && Number.isFinite(bossHpPct) && bossHpPct > 0 && bossHpPct <= 35) return 'bossLow';
  if ((room.t || 0) < 8 && live < 12) return 'start';
  if (live > 24 || room?.finalBoss) return 'climax';
  return 'fight';
}
const THEMES_V2129 = {
  menu: {
    root: 43.65,
    notes: [12, 15, 17, 19, 17, 15, 12, 10, 7, 10, 12],
    step: 1.06,
    lead: 'triangle',
    filter: 1180,
    vol: 0.0066,
    answer: true,
    bass: [0, 7, 10, 7]
  },
  start: {
    root: 43.65,
    notes: [7, 10, 12, 15, 12, 10],
    step: 1.08,
    lead: 'sine',
    filter: 980,
    vol: 0.0050,
    answer: false,
    bass: [0, 0, 7]
  },
  fight: {
    root: 43.65,
    notes: [12, 10, 7, 5, 7, 10, 12, 10],
    step: 0.92,
    lead: 'triangle',
    filter: 1040,
    vol: 0.0060,
    answer: true,
    bass: [0, 5, 7, 5]
  },
  climax: {
    root: 43.65,
    notes: [15, 12, 10, 7, 10, 12, 15, 17],
    step: 0.78,
    lead: 'triangle',
    filter: 1120,
    vol: 0.0068,
    answer: true,
    bass: [0, 7, 10, 7]
  },
  boss: {
    root: 43.65,
    notes: [12, 7, 10, 12, 5, 7, 10, 7],
    step: 0.88,
    lead: 'triangle',
    filter: 1020,
    vol: 0.0064,
    answer: true,
    bass: [0, 0, 5, 7]
  },
  bossLow: {
    root: 43.65,
    notes: [15, 12, 10, 12, 7, 10, 12, 15],
    step: 0.82,
    lead: 'triangle',
    filter: 1160,
    vol: 0.0070,
    answer: true,
    bass: [0, 7, 7, 10]
  },
  clear: {
    root: 43.65,
    notes: [12, 15, 19, 22, 19, 15, 12],
    step: 0.96,
    lead: 'sine',
    filter: 1280,
    vol: 0.0068,
    answer: true,
    bass: [0, 7, 12]
  },
  finale: {
    root: 49.00,
    notes: [0, 4, 7, 12, 16, 12, 7, 4, 0, 7, 12],
    step: 1.02,
    lead: 'sine',
    filter: 1450,
    vol: 0.0084,
    answer: true,
    bass: [0, 7, 12, 7]
  }
};
function themeForV2129(stage, bossTheme, modTheme) {
  if (stage === 'menu') return THEMES_V2129.menu;
  if (stage === 'finale') return THEMES_V2129.finale;
  if (stage === 'clear') return THEMES_V2129.clear;
  if (stage === 'bossLow') return THEMES_V2129.bossLow;
  if (stage === 'climax') return THEMES_V2129.climax;
  if (stage === 'start') return THEMES_V2129.start;
  if (stage === 'fight' && modTheme === 'casino') return { ...THEMES_V2129.fight, notes: [12, 15, 12, 19, 15, 12, 10], filter: 1120, step: 0.94 };
  if (stage === 'fight' && (modTheme === 'static' || modTheme === 'prism')) return { ...THEMES_V2129.fight, notes: [12, 10, 7, 3, 7, 10, 12], filter: 960, step: 1.02 };
  if (stage === 'fight' && modTheme === 'hunter') return { ...THEMES_V2129.fight, notes: [7, 12, 15, 12, 10, 7, 10], step: 0.86 };
  if (bossTheme === 'rush') return { ...THEMES_V2129.boss, notes: [12, 7, 12, 10, 7, 5, 7], step: 0.74 };
  if (bossTheme === 'hunter') return { ...THEMES_V2129.boss, notes: [7, 12, 15, 12, 7, 10, 12], step: 0.86 };
  if (bossTheme === 'croupier') return { ...THEMES_V2129.boss, notes: [12, 15, 12, 19, 15, 12, 7], step: 0.90 };
  return THEMES_V2129[stage] || THEMES_V2129.fight;
}
function playComposedThemeV2129(bus, opts = {}) {
  if (!bus.music?.master || !bus.ctx) return;
  const stage = opts.stage || 'fight';
  const theme = themeForV2129(stage, opts.bossTheme || 'boss', opts.modTheme || 'none');
  const intensity = clamp01V2129(opts.intensity);
  const lowMobs = !!opts.lowMobs;
  const root = theme.root;
  const step = theme.step * (stage === 'finale' ? 1.08 : stage === 'menu' ? 1.10 : lowMobs ? 1.18 : 1.0);
  const leadVol = theme.vol * (stage === 'finale' ? 1.18 : stage === 'clear' ? 1.05 : lowMobs ? 0.82 : 0.92 + intensity * 0.12);
  const noteCount = stage === 'menu' || stage === 'finale' ? theme.notes.length : Math.min(theme.notes.length, stage === 'start' ? 5 : 7);
  // Warm slow bass/organ body. It gives the phrase harmony, not random rhythm.
  const bass = theme.bass || [0, 7];
  bass.forEach((n, i) => {
    bus.musicNote(semiV2129(root, n - 12), step * 2.85, 'triangle', leadVol * 0.18, 360, i * step * 2.0, 1, 0);
  });
  // Main written melody. No randomized note order and no randomized speed.
  for (let i = 0; i < noteCount; i++) {
    const n = theme.notes[i];
    const delay = i * step;
    const longTone = i === noteCount - 1 || i === 3;
    const dur = step * (longTone ? 1.85 : 1.22);
    const accent = i === 0 || longTone ? 1.10 : 0.78;
    bus.musicNote(semiV2129(root, n), dur, i % 2 ? 'sine' : theme.lead, leadVol * accent, theme.filter, delay, 1, 0);
    if (theme.answer && i % 2 === 1 && i < noteCount - 1) {
      // Soft lower reply, like a muted second voice. This is the only counter-line.
      bus.musicNote(semiV2129(root, n - 12), step * 1.75, 'triangle', leadVol * 0.24, Math.max(420, theme.filter * 0.55), delay + step * 0.42, 1, 0);
    }
  }
  // Very restrained clear/finale shimmer, never a bright random top line.
  if (stage === 'clear' || stage === 'finale') {
    const top = stage === 'finale' ? 24 : 22;
    bus.musicNote(semiV2129(root, top), step * 2.6, 'sine', leadVol * (stage === 'finale' ? 0.36 : 0.24), stage === 'finale' ? 1650 : 1380, step * 4.0, 1, 0);
  }
}
function softStingV2129(bus, stage = 'clear') {
  if (!bus.music?.master || !bus.ctx) return;
  playComposedThemeV2129(bus, { stage, intensity: 0.25, lowMobs: true });
}
AudioBus.prototype.handleFx = function handleFxV2129ComposedMusic(f, info = {}) {
  const suppressOldBrightMusic = f?.t === 'boss_down' || f?.t === 'room_invoice' || f?.t === 'portal_open';
  let out;
  if (suppressOldBrightMusic) {
    const oldNote = this.musicNote;
    const oldDust = this.musicDust;
    try {
      this.musicNote = () => {};
      this.musicDust = () => {};
      out = handleFxBeforeV2129ComposedMusic.call(this, f, info);
    } finally {
      this.musicNote = oldNote;
      this.musicDust = oldDust;
    }
  } else {
    out = handleFxBeforeV2129ComposedMusic.call(this, f, info);
  }
  if (this.ensureMusic?.()) {
    if (f?.t === 'boss_down') { this.musicResolve = 1; this.music.phraseT = Math.min(this.music.phraseT || 0, 0.05); softStingV2129(this, 'clear'); }
    else if (f?.t === 'room_invoice' || f?.t === 'portal_open') { this.musicResolve = Math.max(this.musicResolve || 0, 0.75); this.music.phraseT = Math.min(this.music.phraseT || 0, 0.06); softStingV2129(this, 'clear'); }
  }
  return out;
};
AudioBus.prototype.updateMusic = function updateMusicV2129ComposedMusic(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const mods = room?.mods || [];
  const boss = !menu && room?.cat === 'boss';
  const bossHpPct = Math.max(0, Number(room?.bossHpPct || 0));
  const stage = menu ? 'menu' : stageV2129(room, latest, bossHpPct || 100);
  const modTheme = modThemeV2129(mods);
  const bossTheme = bossThemeV2129(room?.bossKind || '');
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const combat = !menu && room?.phase === 'play' && !room?.portal?.[2] && !chill;
  const enemies = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  const bullets = latest?.bullets?.length || 0;
  const depth = Math.max(0, Number(room?.depth || 0));
  const loopHeat = Math.max(0, Math.min(1, Math.floor(depth / 4) / 8));
  const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.25) : 0;
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.24);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.24);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.24);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.26);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.30);
  const crowd = Math.max(0, Math.min(1, enemies / 32));
  const bulletPressure = Math.max(0, Math.min(1, bullets / 90));
  const damage = clamp01V2129(this.damageEnergy || 0);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  let intensity = menu ? 0.10 : Math.max(0, Math.min(1, crowd * 0.25 + bulletPressure * 0.055 + lowHp * 0.10 + danger * 0.12 + damage * 0.14 + loopHeat * 0.10 + (boss ? 0.20 : 0) + (stage === 'climax' || stage === 'bossLow' ? 0.14 : 0)));
  if (stage === 'start') intensity *= 0.70;
  if (stage === 'clear') intensity *= 0.34;
  const area = menu ? 'menu' : `${room?.phase || 'room'}:${room?.cat || 'room'}:${stage}:${modTheme}:${bossTheme}:${mods.join(',')}`;
  if (area !== this.musicLastArea) {
    this.musicTransition = Math.max(this.musicTransition || 0, stage === 'finale' ? 1.0 : 0.62);
    this.music.phraseT = Math.min(this.music.phraseT || 0.5, stage === 'clear' || stage === 'finale' ? 0.04 : menu ? 0.08 : 0.24);
    this.musicLastArea = area;
  }
  const L = this.music.layers || {};
  const now = this.ctx.currentTime;
  const theme = themeForV2129(stage, bossTheme, modTheme);
  const root = theme.root;
  const final = stage === 'finale';
  const clear = stage === 'clear';
  const lowMobs = !boss && !menu && enemies <= 7 && !clear;
  if (L.drone) { L.drone.o.frequency.setTargetAtTime(root, now, 1.6); L.drone.f.frequency.setTargetAtTime(final ? 520 : menu ? 420 : 260 + intensity * 80, now, 1.8); }
  if (L.sub) L.sub.o.frequency.setTargetAtTime(root * 0.5, now, 1.8);
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * (boss ? 1.5 : final ? 1.25 : clear ? 1.5 : 1.0), now, 1.5); L.pulse.f.frequency.setTargetAtTime(final ? 300 : 120 + intensity * 110, now, 1.4); }
  if (L.casino) { L.casino.o.frequency.setTargetAtTime(root * (modTheme === 'casino' || bossTheme === 'croupier' ? 3 : 2), now, 1.7); L.casino.f.frequency.setTargetAtTime(360 + intensity * 120, now, 1.5); }
  if (L.choir) { L.choir.o.frequency.setTargetAtTime(root * (final ? 3 : boss ? 2.5 : 2), now, 1.9); L.choir.f.frequency.setTargetAtTime(final ? 980 : boss ? 640 : 420 + intensity * 150, now, 1.7); }
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * (final ? 2 : 1.5), now, 1.8); L.dirgePad.f.frequency.setTargetAtTime(final ? 740 : clear ? 620 : 320 + intensity * 120, now, 1.6); }
  if (L.glass) { L.glass.o.frequency.setTargetAtTime(root * (final ? 4 : clear || menu ? 3.5 : 3), now, 2.0); L.glass.f.frequency.setTargetAtTime(final ? 1150 : clear ? 980 : menu ? 900 : 760 + intensity * 120, now, 1.8); }
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * (final ? 4 : clear || menu ? 3.5 : 3), now, 2.0); L.highPad.f.frequency.setTargetAtTime(final ? 1220 : clear ? 980 : 820 + intensity * 100, now, 1.8); }
  if (L.drive) { L.drive.o.frequency.setTargetAtTime(root * (boss ? 1.5 : 1), now, 1.4); L.drive.f.frequency.setTargetAtTime(280 + intensity * 140, now, 1.2); }
  if (L.bossLine) { L.bossLine.o.frequency.setTargetAtTime(root * (boss ? 2 : 1.5), now, 1.3); L.bossLine.f.frequency.setTargetAtTime(520 + intensity * 160, now, 1.2); }
  if (L.needle) L.needle.f.frequency.setTargetAtTime(620 + intensity * 100, now, 1.2);

  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    playComposedThemeV2129(this, { stage, boss, intensity, crowd, modTheme, bossTheme, lowMobs });
    const base = final ? 9.2 : menu ? 8.6 : clear ? 7.1 : stage === 'start' ? 7.6 : boss ? 6.2 : stage === 'climax' || stage === 'bossLow' ? 5.4 : 6.6;
    this.music.phraseT = base - intensity * 0.55 + (lowMobs ? 1.2 : 0);
  }
  const inGame = inGameMusicAmount(room, menu);
  const stageVol = final ? 1.35 : clear ? 1.02 : stage === 'start' ? 0.72 : boss ? 0.92 : 0.82;
  const crowdDim = lowMobs ? 0.70 : 1.0;
  const mul = inGame * stageVol * crowdDim;
  this.setMusicLayer('drone', mul * (menu ? 0.0028 : 0.0024 + intensity * 0.00035), 1.4);
  this.setMusicLayer('sub', combat && intensity > 0.55 ? (0.000034 + intensity * 0.00007) * mul : final ? 0.000045 : 0.000020, 1.3);
  this.setMusicLayer('pulse', combat && intensity > 0.45 ? (0.000045 + intensity * 0.00012) * mul : final ? 0.000045 : 0.000020, 1.1);
  this.setMusicLayer('hat', 0.000018, 0.8);
  this.setMusicLayer('casino', (modTheme === 'casino' || bossTheme === 'croupier') ? (0.000075 + intensity * 0.00010) * mul : 0.000018, 1.2);
  this.setMusicLayer('choir', mul * (menu ? 0.0026 : final ? 0.0056 : boss ? 0.0039 + intensity * 0.0012 : 0.0022 + intensity * 0.0007), 1.4);
  this.setMusicLayer('dirgePad', mul * (menu ? 0.0030 : final ? 0.0048 : clear ? 0.0036 : 0.0027 + intensity * 0.0007), 1.4);
  this.setMusicLayer('scrape', 0.000018, 0.9);
  this.setMusicLayer('glass', final ? 0.00042 : clear || menu ? 0.00020 : 0.000030, 1.4);
  this.setMusicLayer('highPad', final ? 0.00036 : clear || menu ? 0.00016 : 0.000026, 1.4);
  this.setMusicLayer('drive', combat && !lowMobs && intensity > (boss ? 0.42 : 0.54) ? (0.000055 + intensity * 0.00018) * mul : 0.000020, 0.9);
  this.setMusicLayer('bossLine', boss ? (0.000070 + intensity * 0.00016) * mul : final ? 0.000055 : 0.000016, 0.9);
  this.setMusicLayer('needle', 0.000016, 0.9);
};

// v2.1.30 PROPER COMPOSED MUSIC REBUILD
// Replaces the v2.1.28/29 "note stream" feel with fewer, slower, written phrases.
// Rules:
// - no random note order;
// - no speed jitter;
// - room clear/portal-open is calm, sparse, and low;
// - combat adds weight, not random percussion;
// - menu keeps one recognizable dark antivirus theme.
const handleFxBeforeV2130MusicRebuild = AudioBus.prototype.handleFx;
function clamp01V2130(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }
function hzV2130(root, semis) { return root * Math.pow(2, semis / 12); }
function bossThemeV2130(kind = '') {
  const k = String(kind || '').toLowerCase();
  if (k.includes('croupier')) return 'croupier';
  if (k.includes('hunter')) return 'hunter';
  if (k.includes('rush')) return 'rush';
  if (k.includes('anchor')) return 'cashier';
  return 'boss';
}
function modThemeV2130(mods = []) {
  const list = Array.isArray(mods) ? mods : [];
  if (list.includes('greed') || list.includes('casino_virus')) return 'casino';
  if (list.includes('static_rain') || list.includes('prism_grid')) return 'static';
  if (list.includes('hunter_contract')) return 'hunter';
  if (list.includes('blood_tax')) return 'blood';
  if (list.includes('echo_walls')) return 'echo';
  if (list.includes('moving_room')) return 'shift';
  return 'none';
}
function stageV2130(room, latest = null, bossHpPct = 100) {
  if (!room) return 'menu';
  if (room.phase === 'won') return 'finale';
  if (room?.portal?.[2]) return 'clear';
  const live = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  if (room.cat === 'boss' && Number.isFinite(bossHpPct) && bossHpPct > 0 && bossHpPct <= 35) return 'bossLow';
  if ((room.t || 0) < 8 && live < 12) return 'start';
  if (live > 24 || room?.finalBoss) return 'climax';
  return 'fight';
}
const THEMES_V2130 = {
  menu: {
    root: 43.65,
    step: 1.72,
    vol: 0.0048,
    filter: 900,
    lead: 'triangle',
    // One main antivirus theme: descending, then a small rise. Dark but not random.
    notes: [12, 10, 7, 3, 7, 10, 7, 3],
    bass: [0, -5, 0, 7]
  },
  start: {
    root: 43.65,
    step: 1.92,
    vol: 0.0035,
    filter: 780,
    lead: 'sine',
    notes: [7, 10, 12, 10, 7],
    bass: [0, 0, 7]
  },
  fight: {
    root: 43.65,
    step: 1.46,
    vol: 0.0042,
    filter: 880,
    lead: 'triangle',
    notes: [12, 10, 7, 10, 5, 7],
    bass: [0, 0, 5, 7]
  },
  climax: {
    root: 43.65,
    step: 1.20,
    vol: 0.0049,
    filter: 960,
    lead: 'triangle',
    notes: [12, 10, 12, 15, 12, 10, 7],
    bass: [0, 7, 5, 7]
  },
  boss: {
    root: 43.65,
    step: 1.34,
    vol: 0.0047,
    filter: 900,
    lead: 'triangle',
    notes: [12, 7, 10, 7, 5, 7],
    bass: [0, 0, 7, 5]
  },
  bossLow: {
    root: 43.65,
    step: 1.18,
    vol: 0.0052,
    filter: 980,
    lead: 'triangle',
    notes: [12, 15, 12, 10, 7, 10],
    bass: [0, 7, 7, 5]
  },
  clear: {
    root: 43.65,
    step: 2.35,
    vol: 0.0029,
    filter: 720,
    lead: 'sine',
    // Calm after room: falling phrase, no victory sparkle.
    notes: [10, 7, 3, 0],
    bass: [0, -5]
  },
  finale: {
    root: 49.00,
    step: 1.88,
    vol: 0.0060,
    filter: 1050,
    lead: 'sine',
    notes: [0, 4, 7, 11, 12, 11, 7, 4, 0],
    bass: [0, 7, 12, 7]
  }
};
function themeForV2130(stage, bossTheme, modTheme) {
  const base = THEMES_V2130[stage] || THEMES_V2130.fight;
  if (stage === 'fight' && modTheme === 'casino') return { ...base, notes: [12, 10, 7, 10, 12, 7], step: 1.54, filter: 840 };
  if (stage === 'fight' && modTheme === 'static') return { ...base, notes: [12, 7, 3, 7, 10, 7], step: 1.62, filter: 760 };
  if (stage === 'fight' && modTheme === 'hunter') return { ...base, notes: [7, 10, 12, 10, 7, 5], step: 1.36, filter: 860 };
  if (stage === 'boss' || stage === 'bossLow') {
    if (bossTheme === 'rush') return { ...base, notes: [12, 7, 12, 10, 7, 5], step: Math.max(1.08, base.step - 0.08) };
    if (bossTheme === 'hunter') return { ...base, notes: [7, 12, 10, 7, 10, 5], step: base.step + 0.04 };
    if (bossTheme === 'croupier') return { ...base, notes: [12, 10, 12, 7, 10, 5], filter: 860 };
  }
  return base;
}
function playHeldNoteV2130(bus, freq, dur, type, vol, filter, delay = 0) {
  // Same WebAudio primitives, but much softer envelope than the old phrase layer.
  bus.musicNote(freq, dur, type, vol, filter, delay, 1, 0);
}
function playProperThemeV2130(bus, opts = {}) {
  if (!bus.music?.master || !bus.ctx) return;
  const stage = opts.stage || 'fight';
  const theme = themeForV2130(stage, opts.bossTheme || 'boss', opts.modTheme || 'none');
  const intensity = clamp01V2130(opts.intensity);
  const lowMobs = !!opts.lowMobs;
  const root = theme.root;
  const slowMul = stage === 'clear' ? 1.22 : stage === 'menu' ? 1.08 : lowMobs ? 1.16 : 1.0;
  const step = theme.step * slowMul;
  const phraseVol = theme.vol * (stage === 'clear' ? 0.72 : stage === 'finale' ? 1.0 : lowMobs ? 0.78 : 0.88 + intensity * 0.10);
  const notes = theme.notes || [];
  const bass = theme.bass || [0, 7];
  // Slow harmonic body first: two or four long tones, no rhythm spam.
  bass.forEach((n, i) => {
    const d = i * step * 2.0;
    playHeldNoteV2130(bus, hzV2130(root, n - 12), step * 3.35, 'sine', phraseVol * 0.135, Math.max(260, theme.filter * 0.40), d);
    if (stage !== 'clear' && i % 2 === 0) {
      playHeldNoteV2130(bus, hzV2130(root, n), step * 2.85, 'triangle', phraseVol * 0.060, Math.max(360, theme.filter * 0.48), d + step * 0.20);
    }
  });
  // Written melody: only one line. No answer-line in clear state; clear must breathe.
  notes.forEach((n, i) => {
    const delay = i * step;
    const isLast = i === notes.length - 1;
    const dur = step * (isLast ? (stage === 'clear' ? 2.75 : 2.00) : 1.35);
    const accent = i === 0 || isLast ? 1.0 : 0.72;
    playHeldNoteV2130(bus, hzV2130(root, n), dur, i % 2 ? 'sine' : theme.lead, phraseVol * accent, theme.filter, delay);
  });
  // Optional very low reply only in active states. This is not a second random melody.
  if (stage !== 'clear' && stage !== 'start' && stage !== 'menu' && notes.length >= 4) {
    const n = notes[2] - 12;
    playHeldNoteV2130(bus, hzV2130(root, n), step * 2.4, 'triangle', phraseVol * 0.18, Math.max(380, theme.filter * 0.55), step * 2.4);
  }
  // Finale gets one soft upper consonance, but still not a bright high melody.
  if (stage === 'finale') {
    playHeldNoteV2130(bus, hzV2130(root, 16), step * 3.0, 'sine', phraseVol * 0.22, 1200, step * 4.0);
  }
}
function playCalmCueV2130(bus, stage = 'clear') {
  if (!bus.music?.master || !bus.ctx) return;
  playProperThemeV2130(bus, { stage, intensity: 0.10, lowMobs: true });
}
AudioBus.prototype.handleFx = function handleFxV2130MusicRebuild(f, info = {}) {
  const musicalEvent = f?.t === 'boss_down' || f?.t === 'room_invoice' || f?.t === 'portal_open' || f?.t === 'run_end';
  let out;
  if (musicalEvent) {
    // Suppress previous bright clear stings from older patch layers.
    const oldNote = this.musicNote;
    const oldDust = this.musicDust;
    try {
      this.musicNote = () => {};
      this.musicDust = () => {};
      out = handleFxBeforeV2130MusicRebuild.call(this, f, info);
    } finally {
      this.musicNote = oldNote;
      this.musicDust = oldDust;
    }
  } else {
    out = handleFxBeforeV2130MusicRebuild.call(this, f, info);
  }
  if (this.ensureMusic?.()) {
    if (f?.t === 'boss_down') {
      this.musicResolve = 1;
      this.music.phraseT = Math.min(this.music.phraseT || 0, 0.10);
      playCalmCueV2130(this, 'clear');
    } else if (f?.t === 'room_invoice' || f?.t === 'portal_open') {
      this.musicResolve = Math.max(this.musicResolve || 0, 0.85);
      this.music.phraseT = Math.min(this.music.phraseT || 0, 0.12);
      playCalmCueV2130(this, 'clear');
    } else if (f?.t === 'run_end') {
      this.musicResolve = 1;
      this.music.phraseT = Math.min(this.music.phraseT || 0, 0.08);
      playCalmCueV2130(this, 'finale');
    }
  }
  return out;
};
AudioBus.prototype.updateMusic = function updateMusicV2130MusicRebuild(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const mods = room?.mods || [];
  const boss = !menu && room?.cat === 'boss';
  const bossHpPct = Math.max(0, Number(room?.bossHpPct || 0));
  const stage = menu ? 'menu' : stageV2130(room, latest, bossHpPct || 100);
  const modTheme = modThemeV2130(mods);
  const bossTheme = bossThemeV2130(room?.bossKind || '');
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const combat = !menu && room?.phase === 'play' && !room?.portal?.[2] && !chill;
  const enemies = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  const bullets = latest?.bullets?.length || 0;
  const lowHp = me ? Math.max(0, 1 - ((me[3] || 0) / Math.max(1, me[4] || 100)) * 1.25) : 0;
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.22);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.22);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.22);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.24);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.26);
  const crowd = clamp01V2130(enemies / 34);
  const bulletPressure = clamp01V2130(bullets / 95);
  const damage = clamp01V2130(this.damageEnergy || 0);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  let intensity = menu ? 0.08 : clamp01V2130(crowd * 0.22 + bulletPressure * 0.045 + lowHp * 0.09 + danger * 0.10 + damage * 0.12 + (boss ? 0.18 : 0) + (stage === 'climax' || stage === 'bossLow' ? 0.12 : 0));
  if (stage === 'start') intensity *= 0.52;
  if (stage === 'clear') intensity = 0.05;
  const area = menu ? 'menu' : `${room?.phase || 'room'}:${room?.cat || 'room'}:${stage}:${modTheme}:${bossTheme}:${mods.join(',')}`;
  if (area !== this.musicLastArea) {
    this.musicTransition = Math.max(this.musicTransition || 0, stage === 'finale' ? 0.9 : 0.45);
    this.music.phraseT = Math.min(this.music.phraseT || 0.6, stage === 'clear' ? 0.10 : menu ? 0.18 : 0.28);
    this.musicLastArea = area;
  }
  const theme = themeForV2130(stage, bossTheme, modTheme);
  const root = theme.root;
  const L = this.music.layers || {};
  const now = this.ctx.currentTime;
  const final = stage === 'finale';
  const clear = stage === 'clear';
  const lowMobs = !boss && !menu && enemies <= 7 && !clear;
  // Retune persistent layers as pad/instrument bed, not melody generators.
  if (L.drone) { L.drone.o.frequency.setTargetAtTime(root, now, 2.4); L.drone.f.frequency.setTargetAtTime(clear ? 260 : final ? 560 : menu ? 420 : 300 + intensity * 60, now, 2.4); }
  if (L.sub) L.sub.o.frequency.setTargetAtTime(root * 0.5, now, 2.2);
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * (boss ? 1.5 : 1), now, 2.0); L.pulse.f.frequency.setTargetAtTime(clear ? 95 : 120 + intensity * 70, now, 2.0); }
  if (L.casino) { L.casino.o.frequency.setTargetAtTime(root * (modTheme === 'casino' || bossTheme === 'croupier' ? 2 : 1.5), now, 2.1); L.casino.f.frequency.setTargetAtTime(260 + intensity * 80, now, 2.0); }
  if (L.choir) { L.choir.o.frequency.setTargetAtTime(root * (final ? 2 : boss ? 1.5 : 1), now, 2.5); L.choir.f.frequency.setTargetAtTime(final ? 680 : clear ? 360 : boss ? 520 : 380 + intensity * 100, now, 2.3); }
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * (final ? 1.5 : 1), now, 2.3); L.dirgePad.f.frequency.setTargetAtTime(final ? 620 : clear ? 320 : 300 + intensity * 90, now, 2.2); }
  if (L.glass) { L.glass.o.frequency.setTargetAtTime(root * (final ? 3 : clear || menu ? 2 : 1.5), now, 2.4); L.glass.f.frequency.setTargetAtTime(final ? 900 : clear ? 620 : menu ? 740 : 560 + intensity * 80, now, 2.3); }
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * (final ? 3 : clear || menu ? 2 : 1.5), now, 2.6); L.highPad.f.frequency.setTargetAtTime(final ? 880 : clear ? 540 : 520 + intensity * 70, now, 2.4); }
  if (L.drive) { L.drive.o.frequency.setTargetAtTime(root * (boss ? 1.0 : 0.75), now, 2.0); L.drive.f.frequency.setTargetAtTime(220 + intensity * 95, now, 1.8); }
  if (L.bossLine) { L.bossLine.o.frequency.setTargetAtTime(root * (boss ? 1.5 : 1), now, 1.8); L.bossLine.f.frequency.setTargetAtTime(360 + intensity * 100, now, 1.8); }
  if (L.needle) L.needle.f.frequency.setTargetAtTime(420 + intensity * 70, now, 1.8);

  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    playProperThemeV2130(this, { stage, boss, intensity, crowd, modTheme, bossTheme, lowMobs });
    const base = final ? 13.0 : menu ? 12.0 : clear ? 12.5 : stage === 'start' ? 10.5 : boss ? 8.2 : stage === 'climax' || stage === 'bossLow' ? 7.2 : 8.8;
    this.music.phraseT = base - intensity * 0.85 + (lowMobs ? 1.6 : 0);
  }
  const inGame = inGameMusicAmount(room, menu);
  const stageVol = final ? 1.05 : clear ? 0.58 : stage === 'start' ? 0.60 : boss ? 0.78 : 0.66;
  const crowdDim = lowMobs ? 0.62 : 1.0;
  const mul = inGame * stageVol * crowdDim;
  // Much lower persistent layer volumes; melody is in written phrases, not noisy beds.
  this.setMusicLayer('drone', mul * (menu ? 0.0022 : clear ? 0.0018 : 0.0020 + intensity * 0.00025), 2.4);
  this.setMusicLayer('sub', combat && intensity > 0.58 ? (0.000024 + intensity * 0.000052) * mul : final ? 0.000030 : 0.000014, 2.0);
  this.setMusicLayer('pulse', combat && intensity > 0.50 ? (0.000030 + intensity * 0.000080) * mul : 0.000014, 1.8);
  this.setMusicLayer('hat', 0.000010, 1.0);
  this.setMusicLayer('casino', (modTheme === 'casino' || bossTheme === 'croupier') ? (0.000040 + intensity * 0.000055) * mul : 0.000012, 1.8);
  this.setMusicLayer('choir', mul * (menu ? 0.0018 : final ? 0.0038 : clear ? 0.0015 : boss ? 0.0025 + intensity * 0.0007 : 0.0016 + intensity * 0.0004), 2.3);
  this.setMusicLayer('dirgePad', mul * (menu ? 0.0024 : final ? 0.0035 : clear ? 0.0020 : 0.0020 + intensity * 0.00045), 2.5);
  this.setMusicLayer('scrape', 0.000010, 1.1);
  this.setMusicLayer('glass', final ? 0.00022 : clear || menu ? 0.000070 : 0.000016, 2.2);
  this.setMusicLayer('highPad', final ? 0.00018 : clear || menu ? 0.000055 : 0.000014, 2.4);
  this.setMusicLayer('drive', combat && !lowMobs && intensity > (boss ? 0.48 : 0.60) ? (0.000035 + intensity * 0.000105) * mul : 0.000012, 1.7);
  this.setMusicLayer('bossLine', boss ? (0.000045 + intensity * 0.000100) * mul : final ? 0.000028 : 0.000010, 1.7);
  this.setMusicLayer('needle', 0.000010, 1.4);
};



// v2.1.42: controlled breakcore layer for combat. It is rhythmic pressure, not a random melody.
const updateMusicBeforeV2142Breakcore = AudioBus.prototype.updateMusic;
AudioBus.prototype.updateMusic = function updateMusicV2142Breakcore(state, dt = 0.016) {
  const out = updateMusicBeforeV2142Breakcore.call(this, state, dt);
  if (!this.enabled || !this.music?.master || !this.ctx) return out;
  const room = state?.room || null;
  const latest = state?.latest || null;
  const combat = !!room && room.phase === 'play' && !room.portal?.[2] && room.cat !== 'chill' && room.special !== 'chill_room';
  const enemies = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  const bullets = latest?.bullets?.length || 0;
  const boss = room?.cat === 'boss';
  const pressure = Math.max(0, Math.min(1, enemies / 26 + bullets / 160 + (boss ? 0.28 : 0) + (this.damageEnergy || 0) * 0.25));
  this.breakcoreT = Math.max(0, (this.breakcoreT || 0) - dt);
  if (!combat || pressure < 0.28) return out;
  if (this.breakcoreT <= 0) {
    const root = boss ? 43.65 : 49.00;
    const density = pressure > 0.72 ? 8 : pressure > 0.50 ? 6 : 4;
    const step = pressure > 0.72 ? 0.105 : pressure > 0.50 ? 0.135 : 0.175;
    const vol = 0.00065 + pressure * 0.0012;
    for (let i = 0; i < density; i++) {
      const d = i * step;
      const strong = i === 0 || i === 3 || (pressure > 0.72 && i === 6);
      if (strong) this.musicNote(root * 0.5, 0.050, 'square', vol * 1.6, 180 + pressure * 160, d, 0.998, 0);
      else this.musicDust(0.026 + pressure * 0.018, vol * 0.74, 1400 + (i % 3) * 680, d);
      if ((i + (room?.depth || 0)) % 4 === 2) this.musicNote(root * 1.5, 0.036, 'square', vol * 0.72, 620 + pressure * 420, d + 0.018, 1, 0);
    }
    this.breakcoreT = density * step + (pressure > 0.72 ? 0.08 : pressure > 0.50 ? 0.18 : 0.34);
  }
  return out;
};

// v2.1.46 DARK BREAKCORE SOUNDTRACK REWORK
// The old dark ambient bed is replaced by a procedural breakcore score.
// No external samples are used: drums are synthesized/noise-sliced in WebAudio so the soundtrack stays shippable.
const clamp01V2146 = v => Math.max(0, Math.min(1, Number(v) || 0));
const hzV2146 = (root, semis) => root * Math.pow(2, semis / 12);
const pickV2146 = (arr, idx) => arr[Math.abs(Math.floor(idx || 0)) % arr.length];
function stageV2146(room, latest, bossHpPct = 100) {
  if (!room) return 'menu';
  if (room?.portal?.[2] || room?.phase === 'clear') return 'clear';
  if (room?.cat === 'boss') return bossHpPct > 0 && bossHpPct < 42 ? 'bossLow' : 'boss';
  const enemies = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  if (enemies <= 0) return 'clear';
  if (enemies <= 5) return 'stalk';
  if (enemies >= 22) return 'climax';
  return 'fight';
}
function musicOutV2146(bus) {
  return bus.music?.master || bus.musicGain || bus.master;
}
function percGainV2146(bus, vol, dur, delay = 0, attack = 0.002, hold = 0.004) {
  const ctx = bus.ctx;
  const g = ctx.createGain();
  const t = ctx.currentTime + Math.max(0, delay);
  const safe = Math.max(0.0001, vol);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(safe, t + Math.max(0.001, attack));
  g.gain.setValueAtTime(safe, t + Math.max(0.001, attack) + Math.max(0, hold));
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.012, dur));
  g.connect(musicOutV2146(bus));
  return { g, t };
}
function oscHitV2146(bus, freq, dur, type, vol, delay = 0, bend = 1, filter = 700, q = 0.8) {
  if (!bus.ctx || !bus.music?.master) return;
  const ctx = bus.ctx;
  const { g, t } = percGainV2146(bus, vol, dur, delay, 0.002, dur * 0.08);
  const o = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(20, freq), t);
  if (bend !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * bend), t + dur * 0.82);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(Math.max(50, filter), t);
  f.Q.value = q;
  o.connect(f); f.connect(g);
  o.onended = () => { try { o.disconnect(); f.disconnect(); g.disconnect(); } catch {} };
  o.start(t); o.stop(t + dur + 0.025);
}
function noiseHitV2146(bus, dur, vol, filterFreq = 1800, q = 5, delay = 0, mode = 'bandpass', grit = 1) {
  if (!bus.ctx || !bus.music?.master) return;
  const ctx = bus.ctx;
  const sr = ctx.sampleRate;
  const len = Math.max(1, Math.floor(sr * Math.max(0.006, dur)));
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  let latch = 0;
  const step = Math.max(1, Math.floor(1 + grit * 10));
  for (let i = 0; i < len; i++) {
    if (i % step === 0) latch = Math.random() * 2 - 1;
    const env = Math.pow(1 - i / Math.max(1, len - 1), 1.45);
    data[i] = (latch * 0.68 + (Math.random() * 2 - 1) * 0.32) * env;
  }
  const src = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const { g, t } = percGainV2146(bus, vol, dur, delay, 0.0015, dur * 0.02);
  src.buffer = buf;
  f.type = mode;
  f.frequency.setValueAtTime(Math.max(40, filterFreq), t);
  f.Q.value = q;
  src.connect(f); f.connect(g);
  src.onended = () => { try { src.disconnect(); f.disconnect(); g.disconnect(); } catch {} };
  src.start(t); src.stop(t + dur + 0.018);
}
function kickV2146(bus, delay, pressure = 0, boss = false) {
  const root = boss ? 43.65 : 49.00;
  const v = 0.0019 + pressure * 0.0028 + (boss ? 0.0010 : 0);
  oscHitV2146(bus, root * 2.9, 0.110 + pressure * 0.030, 'sine', v, delay, 0.26, 190 + pressure * 110, 0.7);
  oscHitV2146(bus, root * 0.75, 0.070, 'square', v * 0.42, delay + 0.004, 0.74, 240, 0.9);
  noiseHitV2146(bus, 0.014, v * 0.60, 1100 + pressure * 500, 3.8, delay, 'bandpass', 0.8);
}
function snareV2146(bus, delay, pressure = 0, ghost = false) {
  const v = (ghost ? 0.00065 : 0.00135) + pressure * (ghost ? 0.0009 : 0.0022);
  noiseHitV2146(bus, ghost ? 0.040 : 0.075, v, ghost ? 2100 : 1650, ghost ? 8.5 : 5.5, delay, 'bandpass', ghost ? 1.8 : 1.1);
  oscHitV2146(bus, 170 + pressure * 45, ghost ? 0.036 : 0.060, 'triangle', v * 0.48, delay + 0.002, 0.72, 420, 0.9);
  if (!ghost && pressure > 0.62) noiseHitV2146(bus, 0.020, v * 0.42, 5200, 9.5, delay + 0.016, 'bandpass', 2.3);
}
function hatV2146(bus, delay, pressure = 0, open = false) {
  const v = (open ? 0.00055 : 0.00032) + pressure * (open ? 0.00095 : 0.00062);
  noiseHitV2146(bus, open ? 0.060 : 0.022, v, open ? 6400 : 7800, open ? 5.8 : 10.5, delay, 'highpass', 2.4 + pressure * 2.0);
}
function glitchV2146(bus, delay, pressure = 0, flavor = 0) {
  const v = 0.00048 + pressure * 0.00125;
  const f = [930, 1280, 1750, 2600, 3400, 470][Math.abs(flavor) % 6] + pressure * 350;
  noiseHitV2146(bus, 0.018 + (flavor % 3) * 0.010, v, f, 9 + (flavor % 4), delay, flavor % 2 ? 'bandpass' : 'highpass', 3.2);
  if (pressure > 0.55 && flavor % 3 === 0) oscHitV2146(bus, 392 * (flavor % 2 ? 1.5 : 1), 0.022, 'square', v * 0.55, delay + 0.004, 0.62, 1800, 1.2);
}
function casinoTickV2146(bus, delay, pressure = 0, good = false) {
  const root = good ? 261.63 : 196.00;
  const v = 0.00055 + pressure * 0.00085;
  oscHitV2146(bus, root, 0.030, 'square', v, delay, good ? 1.22 : 0.78, 1700, 1.4);
  oscHitV2146(bus, root * (good ? 1.5 : 0.75), 0.026, 'triangle', v * 0.55, delay + 0.018, good ? 1.05 : 0.82, 1400, 1.1);
}
function bassPulseV2146(bus, delay, root, step, pressure = 0, boss = false) {
  const n = pickV2146(boss ? [0, 0, -5, -7, 3, -5] : [0, -5, 0, 3, -7, -5], step);
  const f = hzV2146(root, n - 12);
  oscHitV2146(bus, f, 0.110 + pressure * 0.050, step % 4 === 0 ? 'sawtooth' : 'triangle', 0.0010 + pressure * 0.0019 + (boss ? 0.0006 : 0), delay, 0.998, 210 + pressure * 160, 0.9);
}
function hookV2146(bus, stage, modTheme, bossTheme, pressure = 0) {
  if (!bus.music?.master || !bus.ctx) return;
  const root = stage === 'boss' || stage === 'bossLow' ? 43.65 : modTheme === 'casino' ? 51.91 : 49.00;
  const motifs = {
    menu: [12, 10, 7, 5], stalk: [7, 10, 7, 3], fight: [12, 7, 10, 5], climax: [12, 15, 12, 7, 10], boss: [12, 7, 10, 7, 3], bossLow: [15, 12, 10, 7, 3], clear: [7, 5, 3]
  };
  let notes = motifs[stage] || motifs.fight;
  if (bossTheme === 'croupier') notes = [12, 10, 12, 7, 5];
  if (modTheme === 'static') notes = notes.map((n, i) => n - (i % 2 ? 2 : 0));
  const step = stage === 'menu' ? 0.34 : stage === 'clear' ? 0.42 : 0.18 - pressure * 0.035;
  const vol = stage === 'menu' ? 0.0013 : 0.00115 + pressure * 0.00115;
  notes.forEach((n, i) => {
    const d = i * step;
    const dur = step * (i === notes.length - 1 ? 1.8 : 0.72);
    oscHitV2146(bus, hzV2146(root, n), dur, i % 2 ? 'triangle' : 'square', vol * (i === 0 ? 1.08 : 0.82), d, 0.996, 620 + pressure * 580, 0.95);
  });
}
function scheduleBreakStepV2146(bus, context, step, when) {
  const pressure = context.pressure;
  const boss = context.boss;
  const stage = context.stage;
  const casino = context.modTheme === 'casino';
  const staticLike = context.modTheme === 'static';
  const lowHp = context.lowHp;
  const root = boss ? 43.65 : casino ? 51.91 : 49.00;
  const s16 = step % 16;
  const s32 = step % 32;
  const seed = (step * 1103515245 + (context.depth || 0) * 97 + (boss ? 41 : 0) + (casino ? 23 : 0)) >>> 0;
  const chaosHit = ((seed >>> 7) % 100) / 100;
  const busy = pressure > 0.46 || stage === 'climax' || boss;
  const insane = pressure > 0.76 || stage === 'bossLow';
  if (stage === 'clear') {
    if (s16 === 0) kickV2146(bus, when, 0.20, false);
    if (s16 === 8) casinoTickV2146(bus, when + 0.014, 0.15, true);
    return;
  }
  if (stage === 'menu') {
    if (s16 === 0 || s16 === 10) kickV2146(bus, when, 0.24, false);
    if (s16 === 4 || s16 === 12) snareV2146(bus, when, 0.18, false);
    if (s16 % 4 === 2) hatV2146(bus, when, 0.12, false);
    if (s16 === 15) glitchV2146(bus, when + 0.018, 0.22, seed % 9);
    return;
  }
  if (s16 === 0 || s16 === 6 || s16 === 10 || (busy && s16 === 14) || (boss && s16 === 3)) kickV2146(bus, when, pressure, boss);
  if (s16 === 4 || s16 === 12 || (insane && (s16 === 7 || s16 === 15))) snareV2146(bus, when + (s16 === 15 ? 0.010 : 0), pressure, false);
  if (busy && (s16 === 2 || s16 === 11)) snareV2146(bus, when + 0.006, pressure * 0.72, true);
  if (s16 % 2 === 1 || (busy && s16 % 4 === 2)) hatV2146(bus, when, pressure, insane && s16 % 8 === 7);
  if (s16 === 0 || (busy && s16 === 8) || (insane && s16 % 4 === 0)) bassPulseV2146(bus, when + 0.004, root, step, pressure, boss);
  if (chaosHit < (0.16 + pressure * 0.34 + (staticLike ? 0.12 : 0))) glitchV2146(bus, when + (chaosHit * 0.030), pressure, seed % 13);
  if (casino && (s16 === 3 || s16 === 9 || s16 === 13)) casinoTickV2146(bus, when + 0.012, pressure, s32 === 13);
  if (lowHp > 0.30 && (s16 === 15 || s16 === 7)) {
    glitchV2146(bus, when + 0.012, Math.max(pressure, lowHp), seed % 17);
    if (lowHp > 0.58) glitchV2146(bus, when + 0.034, Math.max(pressure, lowHp), (seed + 5) % 17);
  }
  if (insane && s16 >= 13) {
    const micro = context.stepDur * 0.35;
    glitchV2146(bus, when + micro, pressure, seed % 19);
    if (s16 === 15) snareV2146(bus, when + micro * 1.55, pressure * 0.82, true);
  }
}
function modThemeV2146(mods = []) {
  if (mods.includes('casino_virus') || mods.includes('greed')) return 'casino';
  if (mods.includes('static_rain') || mods.includes('prism_grid')) return 'static';
  if (mods.includes('hunter_pack') || mods.includes('split_pack')) return 'hunter';
  return 'none';
}
function bossThemeV2146(kind = '') {
  const k = String(kind || '').toLowerCase();
  if (k.includes('croupier') || k.includes('casino')) return 'croupier';
  if (k.includes('hunter')) return 'hunter';
  if (k.includes('rush')) return 'rush';
  return 'boss';
}

AudioBus.prototype.ensureMusic = function ensureMusicV2146DarkBreakcore() {
  if (!this.ctx || this.ctx.state !== 'running') return false;
  if (this.music?.flavor === 'dark_breakcore_v2146') return true;
  if (this.music?.master) { try { this.music.master.disconnect(); } catch {} }
  const master = this.ctx.createGain();
  master.gain.value = 0.24;
  master.connect(this.musicGain || this.master);
  this.music = {
    master,
    flavor: 'dark_breakcore_v2146',
    layers: {},
    phraseT: 0.10,
    motifIndex: 0,
    lastRoomTone: '',
    voiceCount: 0,
    maxVoices: 20,
    stepIndex: 0,
    nextStepTime: 0,
    lastBpm: 180,
    hitFlashT: 0
  };
  const root = 49.00;
  this.music.layers.drone = this.makeToneLayer(root * 0.5, 'sine', 95);
  this.music.layers.sub = this.makeToneLayer(root * 0.25, 'sine', 42);
  this.music.layers.pulse = this.makeToneLayer(root, 'sawtooth', 180);
  this.music.layers.hat = this.makeNoiseLayer(4800, 7.5);
  this.music.layers.casino = this.makeToneLayer(root * 6, 'square', 900);
  this.music.layers.choir = this.makeToneLayer(root * 1.5, 'triangle', 320);
  this.music.layers.dirgePad = this.makeToneLayer(root, 'sawtooth', 210);
  this.music.layers.scrape = this.makeNoiseLayer(950, 2.8);
  this.music.layers.glass = this.makeToneLayer(root * 8, 'triangle', 1500);
  this.music.layers.highPad = this.makeToneLayer(root * 4, 'square', 1200);
  this.music.layers.drive = this.makeToneLayer(root * 0.75, 'sawtooth', 360);
  this.music.layers.bossLine = this.makeToneLayer(root * 1.5, 'square', 520);
  this.music.layers.needle = this.makeNoiseLayer(2600, 6.5);
  return true;
};

AudioBus.prototype.updateMusic = function updateMusicV2146DarkBreakcore(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const mods = room?.mods || [];
  const boss = !menu && room?.cat === 'boss';
  const bossHpPct = Math.max(0, Number(room?.bossHpPct || 0));
  const chill = !menu && (room?.cat === 'chill' || room?.special === 'chill_room');
  const combat = !menu && room?.phase === 'play' && !room?.portal?.[2] && !chill;
  const enemies = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  const bullets = latest?.bullets?.length || 0;
  const depth = Math.max(0, Number(room?.depth || 0));
  const lowHp = me ? clamp01V2146(1 - ((me[3] || 0) / Math.max(1, me[4] || 100))) : 0;
  const damage = clamp01V2146(this.damageEnergy || 0);
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.40);
  this.musicTransition = Math.max(0, (this.musicTransition || 0) - dt * 0.38);
  this.musicPortal = Math.max(0, (this.musicPortal || 0) - dt * 0.36);
  this.musicResolve = Math.max(0, (this.musicResolve || 0) - dt * 0.42);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.45);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = clamp01V2146(enemies / 30);
  const bulletPressure = clamp01V2146(bullets / 105);
  const loopHeat = clamp01V2146(Math.floor(depth / 4) / 6);
  const modTheme = modThemeV2146(mods);
  const bossTheme = bossThemeV2146(room?.bossKind || '');
  const stage = menu ? 'menu' : (chill ? 'clear' : stageV2146(room, latest, bossHpPct || 100));
  let pressure = menu ? 0.18 : clamp01V2146(crowd * 0.34 + bulletPressure * 0.10 + lowHp * 0.22 + danger * 0.18 + damage * 0.23 + loopHeat * 0.17 + (boss ? 0.34 : 0) + (stage === 'climax' || stage === 'bossLow' ? 0.18 : 0) + (this.musicChaos || 0) * 0.20);
  if (stage === 'clear') pressure = Math.min(0.24, pressure * 0.35);
  if (boss) pressure = Math.max(pressure, stage === 'bossLow' ? 0.82 : 0.66);
  const root = boss ? 43.65 : modTheme === 'casino' ? 51.91 : 49.00;
  const area = menu ? 'menu' : `${room?.phase || 'room'}:${room?.cat || 'room'}:${stage}:${modTheme}:${bossTheme}:${mods.join(',')}`;
  if (area !== this.musicLastArea) {
    this.musicTransition = Math.max(this.musicTransition || 0, boss ? 1.0 : 0.65);
    this.music.phraseT = Math.min(this.music.phraseT || 0.35, boss ? 0.035 : 0.10);
    this.music.lastBpm = 0;
    this.musicLastArea = area;
  }
  const bpm = menu ? 154 : stage === 'clear' ? 132 : boss ? (stage === 'bossLow' ? 212 : 202) : stage === 'climax' ? 202 : stage === 'fight' ? 190 : 176;
  const bpmLift = pressure * (boss ? 16 : 12) + lowHp * 10 + (modTheme === 'casino' ? 4 : 0);
  const finalBpm = Math.max(128, Math.min(224, bpm + bpmLift));
  const stepDur = 60 / finalBpm / 4;
  if (!this.music.nextStepTime || Math.abs((this.music.lastBpm || finalBpm) - finalBpm) > 18) {
    this.music.nextStepTime = this.ctx.currentTime + 0.025;
    this.music.lastBpm = finalBpm;
  }
  const L = this.music.layers || {};
  const now = this.ctx.currentTime;
  if (L.drone) { L.drone.o.frequency.setTargetAtTime(root * (boss ? 0.5 : 0.5), now, 0.9); L.drone.f.frequency.setTargetAtTime(80 + pressure * 90, now, 0.8); }
  if (L.sub) L.sub.o.frequency.setTargetAtTime(root * 0.25, now, 0.8);
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * (stage === 'clear' ? 0.5 : boss ? 0.75 : 1), now, 0.45); L.pulse.f.frequency.setTargetAtTime(130 + pressure * 260, now, 0.35); }
  if (L.casino) { L.casino.o.frequency.setTargetAtTime(root * (modTheme === 'casino' ? 10 : 8), now, 0.55); L.casino.f.frequency.setTargetAtTime(680 + pressure * 720, now, 0.55); }
  if (L.choir) { L.choir.o.frequency.setTargetAtTime(root * (boss ? 1 : 1.5), now, 1.2); L.choir.f.frequency.setTargetAtTime(220 + pressure * 250, now, 0.9); }
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * 0.75, now, 0.9); L.dirgePad.f.frequency.setTargetAtTime(180 + pressure * 170, now, 0.7); }
  if (L.glass) L.glass.o.frequency.setTargetAtTime(root * (modTheme === 'casino' ? 12 : 8), now, 0.8);
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * (boss ? 3 : 4), now, 0.6); L.highPad.f.frequency.setTargetAtTime(900 + pressure * 700, now, 0.5); }
  if (L.drive) { L.drive.o.frequency.setTargetAtTime(root * (boss ? 0.5 : 0.75), now, 0.35); L.drive.f.frequency.setTargetAtTime(210 + pressure * 320, now, 0.35); }
  if (L.bossLine) { L.bossLine.o.frequency.setTargetAtTime(root * (boss ? 1 : 0.75), now, 0.45); L.bossLine.f.frequency.setTargetAtTime(300 + pressure * 360, now, 0.4); }
  if (L.needle) L.needle.f.frequency.setTargetAtTime(modTheme === 'static' ? 1800 + pressure * 900 : 2300 + pressure * 1400, now, 0.45);

  const inGame = inGameMusicAmount(room, menu);
  const stageVol = menu ? 0.54 : stage === 'clear' ? 0.30 : boss ? 0.78 : stage === 'climax' ? 0.72 : 0.62;
  const mul = inGame * stageVol;
  this.setMusicLayer('drone', mul * (0.00035 + pressure * 0.00060), 0.55);
  this.setMusicLayer('sub', combat ? mul * (0.000040 + pressure * 0.000135 + (boss ? 0.00005 : 0)) : 0.000018, 0.45);
  this.setMusicLayer('pulse', combat && pressure > 0.34 ? mul * (0.000055 + pressure * 0.00022) : 0.000018, 0.35);
  this.setMusicLayer('hat', combat && pressure > 0.62 ? mul * (0.000030 + pressure * 0.000080) : 0.000010, 0.25);
  this.setMusicLayer('casino', modTheme === 'casino' ? mul * (0.000045 + pressure * 0.000150) : 0.000010, 0.45);
  this.setMusicLayer('choir', mul * (menu ? 0.00072 : boss ? 0.00125 + pressure * 0.00070 : 0.00055 + pressure * 0.00035), 0.8);
  this.setMusicLayer('dirgePad', mul * (menu ? 0.00072 : 0.00058 + pressure * 0.00045), 0.65);
  this.setMusicLayer('scrape', combat && (pressure > 0.55 || modTheme === 'static') ? mul * (0.000030 + pressure * 0.000150) : 0.000010, 0.35);
  this.setMusicLayer('glass', (menu || stage === 'clear' || modTheme === 'casino') ? mul * 0.000050 : 0.000010, 0.65);
  this.setMusicLayer('highPad', combat && pressure > 0.68 ? mul * (0.000025 + pressure * 0.000090) : 0.000010, 0.35);
  this.setMusicLayer('drive', combat && pressure > 0.40 ? mul * (0.000060 + pressure * 0.000280 + (boss ? 0.000090 : 0)) : 0.000010, 0.25);
  this.setMusicLayer('bossLine', boss ? mul * (0.000080 + pressure * 0.000220) : 0.000010, 0.35);
  this.setMusicLayer('needle', combat && (pressure > 0.50 || modTheme === 'static') ? mul * (0.000025 + pressure * 0.000115) : 0.000010, 0.25);

  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    hookV2146(this, stage, modTheme, bossTheme, pressure);
    this.music.phraseT = stage === 'clear' ? 3.2 : menu ? 2.9 : boss ? 1.15 : Math.max(1.20, 2.25 - pressure * 0.82);
  }

  const scheduleWindow = now + 0.18;
  while (this.music.nextStepTime < scheduleWindow) {
    const when = Math.max(0, this.music.nextStepTime - now);
    scheduleBreakStepV2146(this, { pressure, boss, stage, modTheme, bossTheme, lowHp, depth, stepDur }, this.music.stepIndex || 0, when);
    this.music.stepIndex = ((this.music.stepIndex || 0) + 1) % 128;
    this.music.nextStepTime += stepDur;
  }
};

const handleFxBeforeV2146DarkBreakcore = AudioBus.prototype.handleFx;
AudioBus.prototype.handleFx = function handleFxV2146DarkBreakcore(f, info = {}) {
  // Preserve gameplay SFX, but suppress older melodic/ambient event stings.
  const old = {
    musicNote: this.musicNote,
    musicDust: this.musicDust,
    ambientNote: this.ambientNote,
    ambientNoise: this.ambientNoise,
    playDirgePhrase: this.playDirgePhrase,
    scoreEventWave: this.scoreEventWave
  };
  let out;
  try {
    this.musicNote = () => {};
    this.musicDust = () => {};
    this.ambientNote = () => {};
    this.ambientNoise = () => {};
    this.playDirgePhrase = () => {};
    this.scoreEventWave = () => {};
    out = handleFxBeforeV2146DarkBreakcore.call(this, f, info);
  } finally {
    this.musicNote = old.musicNote;
    this.musicDust = old.musicDust;
    this.ambientNote = old.ambientNote;
    this.ambientNoise = old.ambientNoise;
    this.playDirgePhrase = old.playDirgePhrase;
    this.scoreEventWave = old.scoreEventWave;
  }
  const mine = f?.id === info?.myId;
  if (f?.t === 'ehit' || f?.t === 'blast' || f?.t === 'phit' || f?.t === 'rain_hit') this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.09);
  if (f?.t === 'director_wave' || f?.t === 'casino_virus_spin') this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.32);
  if (f?.t === 'portal_open' || f?.t === 'room_invoice' || f?.t === 'boss_down') {
    this.musicResolve = Math.max(this.musicResolve || 0, 0.9);
    if (this.music) this.music.phraseT = Math.min(this.music.phraseT || 0, 0.05);
    if (this.ensureMusic?.()) {
      const pressure = f?.t === 'boss_down' ? 0.76 : 0.38;
      casinoTickV2146(this, 0.020, pressure, true);
      glitchV2146(this, 0.055, pressure, 11);
    }
  }
  if (mine && (f?.t === 'combo_tick' || f?.t === 'casino_tick')) {
    if (this.ensureMusic?.()) casinoTickV2146(this, 0.010, 0.42, !!f.good);
  }
  return out;
};


// v2.1.48 REFERENCE-INFORMED ORIGINAL BREAKCORE REWRITE
// Legal note: this does not embed or recreate any commercial track. It uses original WebAudio synthesis,
// with arrangement ideas inspired by genre references: odd-grid edits, gabber pressure, melodic drops,
// short stutters, and casino-machine percussion.
const clamp01V2148 = v => Math.max(0, Math.min(1, Number(v) || 0));
const hzV2148 = (root, semis) => root * Math.pow(2, semis / 12);
const r2148 = n => {
  const x = Math.sin((Number(n) || 0) * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};
function themeFromModsV2148(mods = []) {
  const list = Array.isArray(mods) ? mods.join(' ') : String(mods || '');
  if (/casino|jackpot|roulette|slot|dealer|debt/i.test(list)) return 'casino';
  if (/static|virus|glitch|dead/i.test(list)) return 'static';
  if (/blood|biomass|flesh|meat/i.test(list)) return 'flesh';
  if (/void|portal|echo/i.test(list)) return 'void';
  return 'floor';
}
function stageV2148(room, latest, bossHpPct = 100) {
  if (!room) return 'menu';
  if (room.cat === 'chill' || room.special === 'chill_room') return 'clear';
  if (room.portal?.[2]) return 'clear';
  if (room.cat === 'boss') return bossHpPct <= 32 ? 'bossDrop' : 'boss';
  const enemies = Number(room.liveEnemies || latest?.enemies?.length || 0);
  if (enemies <= 0 && room.phase === 'play') return 'clear';
  if (enemies > 24 || Number(room.danger || 0) >= 4) return 'drop';
  if (enemies > 8) return 'fight';
  return 'build';
}
function rootV2148(stage, theme, boss) {
  if (boss) return 43.65; // F1-ish, dark but readable
  if (theme === 'casino') return 51.91; // G#1-ish, more mechanical
  if (theme === 'void') return 46.25;
  return 49.00; // G1-ish
}
function hitKickV2148(bus, w, p = 0, boss = false) {
  const v = 0.00042 + p * 0.00105 + (boss ? 0.00022 : 0);
  oscHitV2146(bus, boss ? 55 : 62, 0.095 + p * 0.026, 'sine', v, w, 0.22, 150 + p * 90, 0.75);
  oscHitV2146(bus, boss ? 94 : 104, 0.038, 'square', v * 0.34, w + 0.003, 0.58, 270, 1.0);
  noiseHitV2146(bus, 0.011, v * 0.46, 850 + p * 650, 4.2, w, 'bandpass', 1.2);
}
function hitSnareV2148(bus, w, p = 0, ghost = false) {
  const v = ghost ? 0.00018 + p * 0.00028 : 0.00044 + p * 0.00095;
  noiseHitV2146(bus, ghost ? 0.032 : 0.070, v, ghost ? 2600 : 1750, ghost ? 8.2 : 5.0, w, 'bandpass', ghost ? 2.4 : 1.5);
  oscHitV2146(bus, ghost ? 220 : 178, ghost ? 0.030 : 0.055, 'triangle', v * 0.38, w + 0.002, 0.68, 480, 0.9);
  if (!ghost && p > 0.52) noiseHitV2146(bus, 0.014, v * 0.38, 5600, 9.5, w + 0.011, 'highpass', 3.1);
}
function hitHatV2148(bus, w, p = 0, open = false) {
  const v = open ? 0.00017 + p * 0.00034 : 0.000085 + p * 0.00021;
  noiseHitV2146(bus, open ? 0.058 : 0.017, v, open ? 6200 : 8500, open ? 5.0 : 12, w, 'highpass', 3.8 + p * 2.4);
}
function hitGlitchV2148(bus, w, p = 0, seed = 0) {
  const f = [1200, 1600, 2100, 2900, 3600, 4800, 6200][Math.abs(seed) % 7];
  const dur = 0.011 + (Math.abs(seed) % 5) * 0.004;
  const v = 0.00011 + p * 0.00034;
  noiseHitV2146(bus, dur, v, f, 9 + (seed % 5), w, seed % 2 ? 'bandpass' : 'highpass', 4.1);
  if (p > 0.56 && seed % 4 === 0) oscHitV2146(bus, 196 * (1 + (seed % 3) * 0.25), 0.018, 'square', v * 0.45, w + 0.004, 0.54, 1900, 1.3);
}
function hitCasinoV2148(bus, w, p = 0, good = false) {
  const v = 0.00013 + p * 0.00025;
  const f = good ? 1318.51 : 932.33;
  oscHitV2146(bus, f, 0.024, 'square', v, w, good ? 1.18 : 0.74, 2200, 1.7);
  noiseHitV2146(bus, 0.010, v * 0.45, 3800, 11, w + 0.004, 'bandpass', 2.5);
}
function hitBassV2148(bus, w, root, step, p = 0, boss = false, theme = 'floor') {
  const floorRiff = [0, -12, -5, -12, 3, -12, -7, -12, 0, -12, -5, -12, 2, -12, -7, -12];
  const casinoRiff = [0, -12, 1, -12, -5, -12, 0, -12, 3, -12, -2, -12, -7, -12, 0, -12];
  const bossRiff = [0, -12, -1, -12, -5, -12, -6, -12, 0, -12, -7, -12, -5, -12, -1, -12];
  const riff = boss ? bossRiff : theme === 'casino' ? casinoRiff : floorRiff;
  const semis = riff[Math.abs(step) % riff.length] - 12;
  const v = 0.00022 + p * 0.00070 + (boss ? 0.00016 : 0);
  oscHitV2146(bus, hzV2148(root, semis), 0.105 + p * 0.030, p > 0.68 ? 'sawtooth' : 'triangle', v, w, 0.995, 180 + p * 210, 0.9);
}
function playHookV2148(bus, stage, theme, root, p = 0, boss = false) {
  if (!bus.music?.master || !bus.ctx) return;
  const now = bus.ctx.currentTime;
  const motifs = {
    floor: [0, 1, -5, -7, 0, 3, 1, -5],
    casino: [0, 3, 1, -2, 0, 6, 3, 1],
    static: [0, -1, -5, 1, -7, -1, 0, -5],
    flesh: [0, -2, -5, -6, -2, 0, -7, -5],
    void: [0, -5, -1, -8, 0, -7, -5, -12]
  };
  const motif = boss ? [0, -1, -5, -7, 0, 2, -1, -5, -8, -5, -1, 0] : (motifs[theme] || motifs.floor);
  const speed = stage === 'clear' ? 0.22 : boss ? 0.108 : stage === 'drop' ? 0.118 : 0.142;
  const count = stage === 'clear' ? 4 : boss ? 10 : 8;
  const baseVol = stage === 'clear' ? 0.00010 : 0.00014 + p * 0.00030;
  for (let i = 0; i < count; i++) {
    const semis = motif[i % motif.length] + (i >= 6 && p > 0.62 ? 12 : 0);
    const w = Math.max(0, 0.010 + i * speed + (i % 2 ? speed * 0.10 : 0));
    const type = boss ? (i % 3 === 0 ? 'square' : 'triangle') : (theme === 'casino' ? 'square' : 'triangle');
    oscHitV2146(bus, hzV2148(root, semis + 12), speed * 1.25, type, baseVol * (i === 0 ? 1.18 : 0.88), w, 0.998, 620 + p * 920, 1.05);
  }
  if (stage === 'drop' || stage === 'bossDrop') {
    noiseHitV2146(bus, 0.060, 0.00020 + p * 0.00036, 2400, 8.5, 0.006, 'bandpass', 2.7);
  }
}
function rollSnareV2148(bus, w, p, stepDur, seed = 0) {
  const n = p > 0.78 ? 4 : 3;
  for (let i = 0; i < n; i++) hitSnareV2148(bus, w + i * stepDur / (n + 0.35), p * (0.85 - i * 0.10), i < n - 1);
  if (seed % 2 === 0) hitGlitchV2148(bus, w + stepDur * 0.68, p, seed + 3);
}
function scheduleStepV2148(bus, c, step, when) {
  const { pressure, boss, stage, theme, lowHp, depth, stepDur, root } = c;
  const s16 = step % 16;
  const s32 = step % 32;
  const bar = Math.floor(step / 16);
  const phrase = Math.floor(step / 64) % 8;
  const seed = step * 37 + Math.floor(depth || 0) * 19 + (boss ? 97 : 0);
  const swing = (s16 % 2 ? stepDur * (pressure > 0.70 ? 0.035 : 0.075) : 0);
  const w = when + swing;
  const busy = pressure > 0.46;
  const insane = pressure > 0.72 || stage === 'bossDrop';
  const breakdown = phrase === 2 || stage === 'clear';
  const assault = phrase === 5 || phrase === 7 || stage === 'drop' || boss;
  if (stage === 'clear') {
    if (s16 === 0) hitKickV2148(bus, w, 0.15, false);
    if (s16 === 8) hitCasinoV2148(bus, w + 0.012, 0.10, true);
    if (s16 === 12) hitHatV2148(bus, w, 0.08, true);
    return;
  }
  if (breakdown && !boss) {
    if (s16 === 0 || s16 === 10) hitKickV2148(bus, w, pressure * 0.58, false);
    if (s16 === 4 || s16 === 12) hitSnareV2148(bus, w, pressure * 0.50, false);
    if (s16 % 4 === 2) hitHatV2148(bus, w, pressure * 0.35, false);
    if (theme === 'casino' && (s16 === 3 || s16 === 9 || s16 === 15)) hitCasinoV2148(bus, w + 0.008, pressure * 0.50, s16 === 15);
    if (s16 === 15) hitGlitchV2148(bus, w + 0.012, pressure * 0.7, seed);
    if (s16 === 0 || s16 === 8) hitBassV2148(bus, w + 0.004, root, step, pressure * 0.55, false, theme);
    return;
  }
  // Main break patterns: structured first, chaos second. This is much closer to track arrangement
  // than the previous random rain of percussion.
  const amenKicks = assault ? [0, 3, 6, 10, 14] : [0, 6, 10];
  const oddKicks = [0, 5, 9, 13];
  const gabberKicks = [0, 4, 8, 12];
  const kicks = boss && phrase >= 4 ? gabberKicks : (phrase === 1 || phrase === 6 ? oddKicks : amenKicks);
  if (kicks.includes(s16)) hitKickV2148(bus, w, pressure, boss);
  if (s16 === 4 || s16 === 12 || (assault && (s16 === 7 || s16 === 15))) hitSnareV2148(bus, w + (s16 === 15 ? 0.006 : 0), pressure, false);
  if (busy && (s16 === 2 || s16 === 11 || (assault && s16 === 14))) hitSnareV2148(bus, w + 0.004, pressure * 0.62, true);
  if (s16 % 2 === 1 || (busy && s16 % 4 === 2) || (insane && s16 % 4 === 0)) hitHatV2148(bus, w, pressure, insane && s16 % 8 === 7);
  if (s16 === 0 || s16 === 8 || (assault && (s16 === 6 || s16 === 14))) hitBassV2148(bus, w + 0.003, root, step, pressure, boss, theme);
  if (theme === 'casino' && (s16 === 3 || s16 === 9 || s16 === 13 || (assault && s16 === 15))) hitCasinoV2148(bus, w + 0.010, pressure, s32 === 13 || s16 === 15);
  const glitchChance = 0.055 + pressure * 0.22 + (theme === 'static' ? 0.17 : 0) + (lowHp > 0.50 ? 0.11 : 0);
  if (r2148(seed) < glitchChance) hitGlitchV2148(bus, w + r2148(seed + 4) * Math.min(0.026, stepDur * 0.45), pressure, seed % 31);
  if ((assault || insane) && (s16 === 15 || (boss && s16 === 3))) rollSnareV2148(bus, w, pressure, stepDur, seed);
  if (insane && r2148(seed + 9) < 0.22) {
    hitGlitchV2148(bus, w + stepDur * 0.36, pressure, seed + 11);
    if (lowHp > 0.62) hitGlitchV2148(bus, w + stepDur * 0.66, Math.max(pressure, lowHp), seed + 17);
  }
}

AudioBus.prototype.updateMusic = function updateMusicV2148ReferenceBreakcore(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const mods = room?.mods || [];
  const boss = !menu && room?.cat === 'boss';
  const bossHpPct = Math.max(0, Number(room?.bossHpPct || 0));
  const stage = menu ? 'menu' : stageV2148(room, latest, bossHpPct || 100);
  const theme = themeFromModsV2148(mods);
  const enemies = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  const bullets = latest?.bullets?.length || 0;
  const depth = Math.max(0, Number(room?.depth || 0));
  const lowHp = me ? clamp01V2148(1 - ((me[3] || 0) / Math.max(1, me[4] || 100))) : 0;
  const damage = clamp01V2148(this.damageEnergy || 0);
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.48);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.48);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = clamp01V2148(enemies / 30);
  const bulletPressure = clamp01V2148(bullets / 115);
  const loopHeat = clamp01V2148(Math.floor(depth / 4) / 6);
  let pressure = menu ? 0.10 : clamp01V2148(crowd * 0.30 + bulletPressure * 0.11 + lowHp * 0.23 + danger * 0.16 + damage * 0.18 + loopHeat * 0.17 + (boss ? 0.34 : 0) + (stage === 'drop' || stage === 'bossDrop' ? 0.16 : 0) + (this.musicChaos || 0) * 0.16);
  if (stage === 'clear') pressure = Math.min(0.20, pressure * 0.35);
  if (boss) pressure = Math.max(pressure, stage === 'bossDrop' ? 0.84 : 0.68);
  const root = rootV2148(stage, theme, boss);
  const area = menu ? 'menu' : `${room?.phase || 'room'}:${room?.cat || 'room'}:${stage}:${theme}:${mods.join(',')}`;
  if (area !== this.musicLastArea) {
    this.musicLastArea = area;
    this.music.stepIndex = 0;
    this.music.nextStepTime = this.ctx.currentTime + 0.035;
    this.music.phraseT = menu ? 0.24 : boss ? 0.030 : 0.080;
    this.music.lastBpm = 0;
  }
  const baseBpm = menu ? 150 : stage === 'clear' ? 128 : boss ? (stage === 'bossDrop' ? 214 : 204) : stage === 'drop' ? 202 : stage === 'fight' ? 190 : 176;
  const finalBpm = Math.max(126, Math.min(226, baseBpm + pressure * (boss ? 12 : 10) + lowHp * 8 + (theme === 'casino' ? 3 : 0)));
  const stepDur = 60 / finalBpm / 4;
  if (!this.music.nextStepTime || Math.abs((this.music.lastBpm || finalBpm) - finalBpm) > 20) {
    this.music.nextStepTime = this.ctx.currentTime + 0.025;
    this.music.lastBpm = finalBpm;
  }
  const L = this.music.layers || {};
  const now = this.ctx.currentTime;
  if (L.drone) { L.drone.o.frequency.setTargetAtTime(root * 0.5, now, 0.9); L.drone.f.frequency.setTargetAtTime(95 + pressure * 145, now, 0.7); }
  if (L.sub) L.sub.o.frequency.setTargetAtTime(root * 0.25, now, 0.7);
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * (boss ? 0.75 : 1), now, 0.45); L.pulse.f.frequency.setTargetAtTime(150 + pressure * 300, now, 0.38); }
  if (L.casino) { L.casino.o.frequency.setTargetAtTime(root * (theme === 'casino' ? 10 : 8), now, 0.50); L.casino.f.frequency.setTargetAtTime(760 + pressure * 850, now, 0.50); }
  if (L.choir) { L.choir.o.frequency.setTargetAtTime(root * (boss ? 1 : 1.5), now, 1.1); L.choir.f.frequency.setTargetAtTime(200 + pressure * 280, now, 0.8); }
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * 0.75, now, 0.8); L.dirgePad.f.frequency.setTargetAtTime(160 + pressure * 180, now, 0.65); }
  if (L.glass) L.glass.o.frequency.setTargetAtTime(root * (theme === 'casino' ? 12 : 8), now, 0.7);
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * (boss ? 3 : 4), now, 0.55); L.highPad.f.frequency.setTargetAtTime(950 + pressure * 740, now, 0.45); }
  if (L.drive) { L.drive.o.frequency.setTargetAtTime(root * (boss ? 0.5 : 0.75), now, 0.35); L.drive.f.frequency.setTargetAtTime(220 + pressure * 360, now, 0.30); }
  if (L.bossLine) { L.bossLine.o.frequency.setTargetAtTime(root * (boss ? 1 : 0.75), now, 0.42); L.bossLine.f.frequency.setTargetAtTime(320 + pressure * 380, now, 0.35); }
  if (L.needle) L.needle.f.frequency.setTargetAtTime(theme === 'static' ? 1850 + pressure * 1000 : 2500 + pressure * 1500, now, 0.40);
  const inGame = inGameMusicAmount(room, menu);
  const stageVol = menu ? 0.44 : stage === 'clear' ? 0.24 : boss ? 0.72 : stage === 'drop' ? 0.70 : 0.58;
  const mul = inGame * stageVol;
  // Persistent layers are deliberately low; the soundtrack identity now comes from arranged breaks and hooks.
  this.setMusicLayer('drone', mul * (0.00030 + pressure * 0.00045), 0.55);
  this.setMusicLayer('sub', !menu && stage !== 'clear' ? mul * (0.000035 + pressure * 0.000115 + (boss ? 0.000045 : 0)) : 0.000014, 0.42);
  this.setMusicLayer('pulse', !menu && pressure > 0.30 ? mul * (0.000045 + pressure * 0.00017) : 0.000014, 0.32);
  this.setMusicLayer('hat', !menu && pressure > 0.58 ? mul * (0.000022 + pressure * 0.000050) : 0.000008, 0.25);
  this.setMusicLayer('casino', theme === 'casino' ? mul * (0.000035 + pressure * 0.000095) : 0.000008, 0.42);
  this.setMusicLayer('choir', mul * (menu ? 0.00056 : boss ? 0.00100 + pressure * 0.00052 : 0.00042 + pressure * 0.00028), 0.75);
  this.setMusicLayer('dirgePad', mul * (menu ? 0.00056 : 0.00046 + pressure * 0.00032), 0.60);
  this.setMusicLayer('scrape', !menu && (pressure > 0.54 || theme === 'static') ? mul * (0.000022 + pressure * 0.000110) : 0.000008, 0.35);
  this.setMusicLayer('glass', (menu || stage === 'clear' || theme === 'casino') ? mul * 0.000040 : 0.000008, 0.62);
  this.setMusicLayer('highPad', !menu && pressure > 0.70 ? mul * (0.000016 + pressure * 0.000052) : 0.000008, 0.35);
  this.setMusicLayer('drive', !menu && stage !== 'clear' && pressure > 0.36 ? mul * (0.000048 + pressure * 0.000220 + (boss ? 0.000070 : 0)) : 0.000008, 0.24);
  this.setMusicLayer('bossLine', boss ? mul * (0.000060 + pressure * 0.000170) : 0.000008, 0.32);
  this.setMusicLayer('needle', !menu && (pressure > 0.52 || theme === 'static') ? mul * (0.000017 + pressure * 0.000075) : 0.000008, 0.25);
  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    playHookV2148(this, stage, theme, root, pressure, boss);
    this.music.phraseT = stage === 'clear' ? 4.2 : menu ? 3.1 : boss ? 1.05 : Math.max(1.10, 2.05 - pressure * 0.80);
  }
  if (menu) return;
  const scheduleWindow = now + 0.18;
  while (this.music.nextStepTime < scheduleWindow) {
    const when = Math.max(0, this.music.nextStepTime - now);
    scheduleStepV2148(this, { pressure, boss, stage, theme, lowHp, depth, stepDur, root }, this.music.stepIndex || 0, when);
    this.music.stepIndex = ((this.music.stepIndex || 0) + 1) % 512;
    this.music.nextStepTime += stepDur;
  }
};

const handleFxBeforeV2148ReferenceBreakcore = AudioBus.prototype.handleFx;
AudioBus.prototype.handleFx = function handleFxV2148ReferenceBreakcore(f, info = {}) {
  const out = handleFxBeforeV2148ReferenceBreakcore.call(this, f, info);
  if (f?.t === 'ehit' || f?.t === 'blast' || f?.t === 'phit' || f?.t === 'rain_hit') this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.10);
  if (f?.t === 'director_wave' || f?.t === 'casino_virus_spin' || f?.t === 'boss_spawn') this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.36);
  if ((f?.t === 'portal_open' || f?.t === 'room_invoice' || f?.t === 'boss_down') && this.ensureMusic?.()) {
    const p = f?.t === 'boss_down' ? 0.82 : 0.48;
    hitCasinoV2148(this, 0.010, p, true);
    hitGlitchV2148(this, 0.040, p, 23);
    hitKickV2148(this, 0.060, p, f?.t === 'boss_down');
    if (this.music) this.music.phraseT = Math.min(this.music.phraseT || 0, 0.04);
  }
  return out;
};

// v2.1.50 STARRY BREAKCORE ACCELERATION PASS
// Ref direction: fast starry/celestial breakcore mix energy — dense chopped drums, bright arps,
// rapid fills and less slow droning. Original WebAudio synthesis only; no copyrighted track/audio is copied.
const clamp01V2150 = v => Math.max(0, Math.min(1, Number(v) || 0));
const hzV2150 = (root, semis) => root * Math.pow(2, semis / 12);
const randV2150 = n => {
  const x = Math.sin((Number(n) || 0) * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};
function stageV2150(room, latest, bossHpPct = 100) {
  if (!room) return 'menu';
  if (room.cat === 'boss') return bossHpPct <= 34 ? 'bossBreak' : 'boss';
  if (room.cat === 'chill' || room.special === 'chill_room' || room.portal?.[2]) return 'float';
  const enemies = Number(room.liveEnemies || latest?.enemies?.length || 0);
  if (enemies <= 0 && room.phase === 'play') return 'float';
  if (enemies > 22 || Number(room.danger || 0) >= 4) return 'storm';
  if (enemies > 7) return 'rush';
  return 'spark';
}
function rootV2150(stage, theme, boss) {
  if (boss) return 46.25; // F#1-ish: darker boss root, still bright enough for arps
  if (theme === 'casino') return 51.91;
  if (theme === 'void' || theme === 'static') return 43.65;
  return 49.00;
}
function kickV2150(bus, w, p = 0, boss = false, ghost = false) {
  const v = ghost ? 0.00022 + p * 0.00045 : 0.00058 + p * 0.00125 + (boss ? 0.00026 : 0);
  oscHitV2146(bus, boss ? 58 : 66, ghost ? 0.045 : 0.076, 'sine', v, w, ghost ? 0.50 : 0.20, 180 + p * 140, 0.85);
  if (!ghost) oscHitV2146(bus, boss ? 112 : 124, 0.027, 'square', v * 0.28, w + 0.002, 0.55, 390, 1.0);
  noiseHitV2146(bus, ghost ? 0.008 : 0.012, v * 0.40, 1050 + p * 900, 5.0, w, 'bandpass', 1.6);
}
function snareV2150(bus, w, p = 0, ghost = false) {
  const v = ghost ? 0.00024 + p * 0.00042 : 0.00062 + p * 0.00116;
  noiseHitV2146(bus, ghost ? 0.026 : 0.052, v, ghost ? 3150 : 2100, ghost ? 10.5 : 7.0, w, 'bandpass', ghost ? 3.3 : 2.2);
  oscHitV2146(bus, ghost ? 240 : 190, ghost ? 0.022 : 0.045, 'triangle', v * 0.38, w + 0.001, 0.62, 700, 1.0);
  if (!ghost && p > 0.36) noiseHitV2146(bus, 0.010, v * 0.52, 7200, 12.0, w + 0.008, 'highpass', 4.0);
}
function hatV2150(bus, w, p = 0, open = false) {
  const v = open ? 0.00024 + p * 0.00042 : 0.00013 + p * 0.00026;
  noiseHitV2146(bus, open ? 0.046 : 0.013, v, open ? 6900 : 9400, open ? 6.5 : 14.5, w, 'highpass', 4.6 + p * 2.8);
}
function glitchV2150(bus, w, p = 0, seed = 0, bright = false) {
  const freqs = bright ? [2400, 3200, 4400, 6100, 7600, 9300] : [820, 1260, 1700, 2350, 3100, 4700, 6200];
  const f = freqs[Math.abs(seed) % freqs.length];
  const dur = 0.006 + (Math.abs(seed) % 6) * 0.0035;
  const v = 0.00013 + p * 0.00040;
  noiseHitV2146(bus, dur, v, f + p * 700, 11 + (seed % 6), w, bright ? 'highpass' : (seed % 2 ? 'bandpass' : 'highpass'), 5.6);
  if (p > 0.50 && seed % 3 === 0) oscHitV2146(bus, f * 0.5, 0.010, 'square', v * 0.42, w + 0.002, 0.72, 2400, 1.4);
}
function bassV2150(bus, w, root, step, p = 0, boss = false, theme = 'floor') {
  const floor = [0, -12, -7, -12, 1, -12, -5, -12, 0, -12, 3, -12, -7, -12, -5, -12];
  const casino = [0, -12, 3, -12, 1, -12, -2, -12, 6, -12, 3, -12, 1, -12, -5, -12];
  const bossR = [0, -12, -1, -12, -6, -12, -7, -12, 0, -12, -8, -12, -6, -12, -1, -12];
  const riff = boss ? bossR : theme === 'casino' ? casino : floor;
  const semi = riff[Math.abs(step) % riff.length] - 12;
  const v = 0.00034 + p * 0.00095 + (boss ? 0.00023 : 0);
  oscHitV2146(bus, hzV2150(root, semi), 0.062 + p * 0.025, p > 0.58 ? 'sawtooth' : 'triangle', v, w, 0.990, 230 + p * 330, 1.05);
  if (p > 0.68 && step % 8 === 6) oscHitV2146(bus, hzV2150(root, semi + 12), 0.030, 'square', v * 0.26, w + 0.018, 0.985, 480 + p * 420, 1.0);
}
function casinoPingV2150(bus, w, p = 0, good = false) {
  const base = good ? 1567.98 : 1174.66;
  const v = 0.00018 + p * 0.00036;
  oscHitV2146(bus, base, 0.018, 'square', v, w, good ? 1.22 : 0.78, 3000, 2.0);
  oscHitV2146(bus, base * 1.5, 0.014, 'triangle', v * 0.42, w + 0.014, 0.92, 4200, 1.6);
}
function starArpV2150(bus, stage, theme, root, p = 0, boss = false, seed = 0) {
  if (!bus.music?.master || !bus.ctx) return;
  const star = theme === 'casino'
    ? [12, 15, 19, 22, 27, 24, 19, 15, 12, 19, 24, 31]
    : boss
      ? [12, 13, 19, 20, 24, 25, 20, 19, 13, 20, 25, 32]
      : [12, 14, 19, 21, 26, 28, 26, 21, 19, 14, 21, 26];
  const count = stage === 'float' ? 6 : boss ? 14 : 12;
  const step = stage === 'float' ? 0.082 : boss ? 0.041 : 0.046;
  const baseVol = stage === 'float' ? 0.000085 : 0.00016 + p * 0.00033;
  for (let i = 0; i < count; i++) {
    const n = star[(i + seed) % star.length] + (i > 7 && p > 0.62 ? 12 : 0);
    const w = 0.006 + i * step + (i % 3 === 2 ? step * 0.32 : 0);
    oscHitV2146(bus, hzV2150(root, n), step * 1.35, i % 4 === 0 ? 'square' : 'triangle', baseVol * (i % 5 === 0 ? 1.25 : 0.82), w, 0.994, 1400 + p * 2200, 1.35);
  }
  if (p > 0.46) glitchV2150(bus, 0.006 + count * step, p * 0.8, seed + 9, true);
}
function microRollV2150(bus, w, p, dur, seed = 0, kind = 'snare') {
  const n = p > 0.78 ? 7 : p > 0.55 ? 5 : 4;
  for (let i = 0; i < n; i++) {
    const t = w + i * dur / (n + 0.2) + (i % 2 ? dur * 0.018 : 0);
    if (kind === 'kick') kickV2150(bus, t, p * (0.92 - i * 0.055), false, i < n - 1);
    else if (kind === 'hat') hatV2150(bus, t, p * (0.95 - i * 0.05), i === n - 1);
    else snareV2150(bus, t, p * (0.96 - i * 0.06), i < n - 1);
  }
  if (seed % 2 === 0) glitchV2150(bus, w + dur * 0.72, p, seed + 5, true);
}
function scheduleStepV2150(bus, c, step, when) {
  const { pressure, boss, stage, theme, lowHp, depth, stepDur, root } = c;
  const s16 = step % 16;
  const s32 = step % 32;
  const s64 = step % 64;
  const phrase = Math.floor(step / 64) % 8;
  const seed = step * 53 + Math.floor(depth || 0) * 29 + (boss ? 700 : 0) + (theme === 'casino' ? 131 : 0);
  const swing = s16 % 2 ? stepDur * 0.028 : 0;
  const w = when + swing;
  const busy = pressure > 0.28 || stage === 'rush' || stage === 'storm' || boss;
  const insane = pressure > 0.58 || stage === 'storm' || stage === 'bossBreak';
  if (stage === 'float') {
    // Even calm rooms keep a fast pulse so the soundtrack no longer feels dead/slow.
    if (s16 === 0 || s16 === 10) kickV2150(bus, w, 0.20, false);
    if (s16 === 4 || s16 === 12) snareV2150(bus, w, 0.17, true);
    if (s16 % 2 === 1) hatV2150(bus, w, 0.18, false);
    if (s16 === 15) glitchV2150(bus, w + stepDur * 0.38, 0.22, seed, true);
    if (s16 === 0 || s16 === 8) bassV2150(bus, w + 0.002, root, step, 0.18, false, theme);
    return;
  }
  // Fast break banks. Each phrase swaps accents so it does not loop like one boring beat.
  const banks = [
    { k: [0, 3, 6, 10, 14], s: [4, 7, 12, 15], g: [2, 11] },
    { k: [0, 5, 8, 13], s: [3, 6, 12, 15], g: [1, 10, 14] },
    { k: [0, 2, 6, 9, 12, 15], s: [4, 11, 14], g: [7, 10, 13] },
    { k: [0, 4, 8, 10, 12, 14], s: [2, 6, 11, 15], g: [3, 5, 13] }
  ];
  const bank = banks[(phrase + (boss ? 1 : 0) + (theme === 'casino' ? 2 : 0)) % banks.length];
  const gabber = boss && phrase >= 4;
  if (gabber) {
    if (s16 % 2 === 0 || s16 === 15) kickV2150(bus, w, pressure, boss, s16 % 4 !== 0);
  } else if (bank.k.includes(s16)) kickV2150(bus, w, pressure, boss, false);
  if (bank.s.includes(s16)) snareV2150(bus, w + (s16 === 15 ? stepDur * 0.10 : 0), pressure, false);
  if (busy && bank.g.includes(s16)) snareV2150(bus, w + stepDur * 0.14, pressure * 0.66, true);
  if (s16 % 2 === 1 || (busy && s16 % 4 === 0) || (insane && s16 % 4 === 2)) hatV2150(bus, w, pressure, insane && (s16 === 7 || s16 === 15));
  if (s16 === 0 || s16 === 6 || s16 === 8 || s16 === 14 || (insane && s16 === 3)) bassV2150(bus, w + 0.002, root, step, pressure, boss, theme);
  if (theme === 'casino' && (s16 === 1 || s16 === 5 || s16 === 9 || s16 === 13 || s16 === 15)) casinoPingV2150(bus, w + 0.005, pressure, s16 === 15 || s32 === 9);
  // High variation: short glitch hits are deliberately frequent, but deterministic.
  const gChance = 0.18 + pressure * 0.38 + (theme === 'static' ? 0.16 : 0) + (lowHp > 0.42 ? 0.10 : 0);
  if (randV2150(seed) < gChance) glitchV2150(bus, w + randV2150(seed + 2) * Math.min(0.020, stepDur * 0.50), pressure, seed, randV2150(seed + 3) > 0.42);
  // Rolls every half-bar and at phrase edges: this is the main anti-boring change.
  if ((s16 === 7 && (busy || phrase % 2 === 1)) || s16 === 15 || (insane && s16 === 3)) {
    const kind = s16 === 15 ? 'snare' : (phrase % 3 === 0 ? 'hat' : 'kick');
    microRollV2150(bus, w, Math.max(pressure, 0.45), stepDur * (s16 === 15 ? 0.95 : 0.62), seed, kind);
  }
  if (insane && (s64 === 30 || s64 === 31 || s64 === 62 || s64 === 63)) {
    glitchV2150(bus, w + stepDur * 0.32, pressure, seed + 17, true);
    snareV2150(bus, w + stepDur * 0.60, pressure * 0.72, true);
  }
}

AudioBus.prototype.updateMusic = function updateMusicV2150StarryBreakcore(state, dt = 0.016) {
  if (!this.enabled) return;
  this.unlock();
  if (!this.ensureMusic()) return;
  const room = state?.room || null;
  const menu = !!state?.menu || !room;
  const latest = state?.latest || null;
  const me = typeof state?.me === 'function' ? state.me() : null;
  const mods = room?.mods || [];
  const boss = !menu && room?.cat === 'boss';
  const bossHpPct = Math.max(0, Number(room?.bossHpPct || 0));
  const stage = menu ? 'menu' : stageV2150(room, latest, bossHpPct || 100);
  const theme = themeFromModsV2148(mods);
  const enemies = Math.max(0, Number(room?.liveEnemies || latest?.enemies?.length || 0));
  const bullets = latest?.bullets?.length || 0;
  const depth = Math.max(0, Number(room?.depth || 0));
  const lowHp = me ? clamp01V2150(1 - ((me[3] || 0) / Math.max(1, me[4] || 100))) : 0;
  const damage = clamp01V2150(this.damageEnergy || 0);
  this.damageEnergy = Math.max(0, (this.damageEnergy || 0) - dt * 0.62);
  this.musicChaos = Math.max(0, (this.musicChaos || 0) - dt * 0.40);
  const danger = Math.max(0, Math.min(5, Number(room?.danger || 0))) / 5;
  const crowd = clamp01V2150(enemies / 24);
  const bulletPressure = clamp01V2150(bullets / 88);
  const loopHeat = clamp01V2150(Math.floor(depth / 3) / 7);
  let pressure = menu ? 0.22 : clamp01V2150(crowd * 0.28 + bulletPressure * 0.16 + lowHp * 0.22 + danger * 0.18 + damage * 0.17 + loopHeat * 0.16 + (boss ? 0.36 : 0) + (stage === 'storm' || stage === 'bossBreak' ? 0.20 : 0) + (this.musicChaos || 0) * 0.20);
  if (stage === 'float') pressure = Math.max(0.24, Math.min(0.42, pressure * 0.70 + 0.18));
  if (boss) pressure = Math.max(pressure, stage === 'bossBreak' ? 0.88 : 0.72);
  const root = rootV2150(stage, theme, boss);
  const area = menu ? 'menu' : `${room?.phase || 'room'}:${room?.cat || 'room'}:${stage}:${theme}:${mods.join(',')}`;
  if (area !== this.musicLastArea) {
    this.musicLastArea = area;
    this.music.stepIndex = 0;
    this.music.nextStepTime = this.ctx.currentTime + 0.018;
    this.music.phraseT = menu ? 0.18 : boss ? 0.018 : 0.032;
    this.music.lastBpm = 0;
  }
  const baseBpm = menu ? 182 : stage === 'float' ? 218 : boss ? (stage === 'bossBreak' ? 294 : 282) : stage === 'storm' ? 286 : stage === 'rush' ? 266 : 242;
  const finalBpm = Math.max(178, Math.min(318, baseBpm + pressure * (boss ? 22 : 18) + lowHp * 14 + (theme === 'casino' ? 5 : 0)));
  const stepDur = 60 / finalBpm / 4;
  if (!this.music.nextStepTime || Math.abs((this.music.lastBpm || finalBpm) - finalBpm) > 28) {
    this.music.nextStepTime = this.ctx.currentTime + 0.018;
    this.music.lastBpm = finalBpm;
  }
  const L = this.music.layers || {};
  const now = this.ctx.currentTime;
  if (L.drone) { L.drone.o.frequency.setTargetAtTime(root * 0.5, now, 0.55); L.drone.f.frequency.setTargetAtTime(70 + pressure * 125, now, 0.45); }
  if (L.sub) L.sub.o.frequency.setTargetAtTime(root * 0.25, now, 0.35);
  if (L.pulse) { L.pulse.o.frequency.setTargetAtTime(root * (boss ? 0.5 : 1), now, 0.22); L.pulse.f.frequency.setTargetAtTime(240 + pressure * 620, now, 0.20); }
  if (L.casino) { L.casino.o.frequency.setTargetAtTime(root * (theme === 'casino' ? 14 : 10), now, 0.25); L.casino.f.frequency.setTargetAtTime(1200 + pressure * 1800, now, 0.20); }
  if (L.choir) { L.choir.o.frequency.setTargetAtTime(root * (boss ? 1.5 : 2), now, 0.55); L.choir.f.frequency.setTargetAtTime(280 + pressure * 360, now, 0.42); }
  if (L.dirgePad) { L.dirgePad.o.frequency.setTargetAtTime(root * 0.75, now, 0.55); L.dirgePad.f.frequency.setTargetAtTime(130 + pressure * 190, now, 0.42); }
  if (L.glass) L.glass.o.frequency.setTargetAtTime(root * (theme === 'casino' ? 18 : 16), now, 0.22);
  if (L.highPad) { L.highPad.o.frequency.setTargetAtTime(root * (boss ? 5 : 6), now, 0.22); L.highPad.f.frequency.setTargetAtTime(1500 + pressure * 2600, now, 0.16); }
  if (L.drive) { L.drive.o.frequency.setTargetAtTime(root * (boss ? 0.5 : 0.75), now, 0.18); L.drive.f.frequency.setTargetAtTime(290 + pressure * 700, now, 0.18); }
  if (L.bossLine) { L.bossLine.o.frequency.setTargetAtTime(root * (boss ? 1 : 0.75), now, 0.22); L.bossLine.f.frequency.setTargetAtTime(420 + pressure * 760, now, 0.18); }
  if (L.needle) L.needle.f.frequency.setTargetAtTime(theme === 'static' ? 2400 + pressure * 2200 : 3200 + pressure * 3300, now, 0.15);
  const inGame = inGameMusicAmount(room, menu);
  const stageVol = menu ? 0.46 : stage === 'float' ? 0.52 : boss ? 0.80 : stage === 'storm' ? 0.82 : stage === 'rush' ? 0.74 : 0.66;
  const mul = inGame * stageVol;
  // Less slow ambience, more rhythmic/bright energy.
  this.setMusicLayer('drone', mul * (0.00006 + pressure * 0.00016), 0.26);
  this.setMusicLayer('sub', !menu ? mul * (0.000055 + pressure * 0.000180 + (boss ? 0.000050 : 0)) : 0.000014, 0.24);
  this.setMusicLayer('pulse', !menu ? mul * (0.000075 + pressure * 0.000260) : 0.000020, 0.18);
  this.setMusicLayer('hat', !menu ? mul * (0.000035 + pressure * 0.000100) : 0.000010, 0.18);
  this.setMusicLayer('casino', theme === 'casino' ? mul * (0.000060 + pressure * 0.000160) : 0.000010, 0.24);
  this.setMusicLayer('choir', mul * (menu ? 0.00030 : boss ? 0.00042 + pressure * 0.00034 : 0.00018 + pressure * 0.00018), 0.38);
  this.setMusicLayer('dirgePad', mul * (menu ? 0.00026 : 0.00009 + pressure * 0.00012), 0.30);
  this.setMusicLayer('scrape', !menu && (pressure > 0.42 || theme === 'static') ? mul * (0.000030 + pressure * 0.000130) : 0.000008, 0.20);
  this.setMusicLayer('glass', !menu ? mul * (0.000065 + pressure * 0.000110) : mul * 0.000035, 0.22);
  this.setMusicLayer('highPad', !menu ? mul * (0.000040 + pressure * 0.000130) : 0.000010, 0.18);
  this.setMusicLayer('drive', !menu ? mul * (0.000075 + pressure * 0.000330 + (boss ? 0.000090 : 0)) : 0.000010, 0.16);
  this.setMusicLayer('bossLine', boss ? mul * (0.000090 + pressure * 0.000230) : 0.000010, 0.18);
  this.setMusicLayer('needle', !menu && (pressure > 0.36 || theme === 'static') ? mul * (0.000030 + pressure * 0.000125) : 0.000008, 0.16);
  this.music.phraseT = Math.max(0, (this.music.phraseT || 0) - dt);
  if ((room || menu) && this.music.phraseT <= 0) {
    starArpV2150(this, stage, theme, root, pressure, boss, (this.music.stepIndex || 0) % 12);
    this.music.phraseT = stage === 'float' ? 0.92 : menu ? 1.20 : boss ? 0.44 : Math.max(0.46, 0.84 - pressure * 0.32);
  }
  if (menu) return;
  const scheduleWindow = now + 0.15;
  while (this.music.nextStepTime < scheduleWindow) {
    const when = Math.max(0, this.music.nextStepTime - now);
    scheduleStepV2150(this, { pressure, boss, stage, theme, lowHp, depth, stepDur, root }, this.music.stepIndex || 0, when);
    this.music.stepIndex = ((this.music.stepIndex || 0) + 1) % 1024;
    this.music.nextStepTime += stepDur;
  }
};

const handleFxBeforeV2150StarryBreakcore = AudioBus.prototype.handleFx;
AudioBus.prototype.handleFx = function handleFxV2150StarryBreakcore(f, info = {}) {
  const out = handleFxBeforeV2150StarryBreakcore.call(this, f, info);
  if (f?.t === 'ehit' || f?.t === 'blast' || f?.t === 'phit' || f?.t === 'rain_hit') this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.15);
  if (f?.t === 'director_wave' || f?.t === 'casino_virus_spin' || f?.t === 'boss_spawn') this.musicChaos = Math.min(1, (this.musicChaos || 0) + 0.48);
  if ((f?.t === 'portal_open' || f?.t === 'room_invoice' || f?.t === 'boss_down') && this.ensureMusic?.()) {
    const p = f?.t === 'boss_down' ? 0.90 : 0.62;
    casinoPingV2150(this, 0.006, p, true);
    glitchV2150(this, 0.020, p, 99, true);
    microRollV2150(this, 0.040, p, 0.170, 123, 'snare');
    if (this.music) this.music.phraseT = Math.min(this.music.phraseT || 0, 0.012);
  }
  return out;
};
