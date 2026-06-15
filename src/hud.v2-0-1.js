// nncckkrr HUD: bars, pips, feed, banners, TAB panel, install + casino modals
import { P } from './state.v2-0-1.js';

const $ = id => document.getElementById(id);
const MOD_LABELS = { blackout: 'BLACKOUT', static_rain: 'STATIC RAIN', greed: 'GREED SIGNAL' };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Hud {
  constructor(net) {
    this.net = net;
    this.feedLines = [];
    this.bannerTimer = null;
    this.promptTimer = null;
    this.casino = { open: false, spinning: false, betId: null, spinToken: 0, timeout: null, lastResultSeq: 0 };
    this.install = { open: false, choices: [], expires: 0, total: 15, locked: false };
    this.names = new Map();

    $('casino-stakes').querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => this.placeBet(btn.dataset.stake));
    });
  }

  show() { $('hud').classList.remove('hidden'); }

  // ------------------------------------------------- per-frame update
  update(state, dt) {
    const me = state.me();
    const room = state.room;
    if (!me || !room) return;
    for (const p of state.latest.players) this.names.set(p[P.ID], p[P.NAME]);

    // top
    $('hud-room').textContent = `${this.net.roomId || '----'} · ${room.id}`;
    $('hud-loop').textContent = `LOOP ${room.loop} / DEPTH ${room.depth}`;
    $('hud-mods').textContent = (room.mods || []).map(m => MOD_LABELS[m] || m).join(' · ');
    $('hud-ping').textContent = this.net.ping ? `${this.net.ping}ms` : '';
    const obj = $('hud-objective');
    if (room.phase === 'install') obj.innerHTML = '<span class="done">INSTALL PHASE</span>';
    else if (room.cat === 'boss') obj.innerHTML = room.portal[2] ? '<span class="done">ПОРТАЛ ОТКРЫТ — E</span>' : 'УНИЧТОЖИТЬ БОССА';
    else if (room.portal[2]) obj.innerHTML = '<span class="done">ПОРТАЛ ОТКРЫТ — E</span>';
    else obj.textContent = `ЗАЧИСТКА ${room.kills} / ${room.quota}`;

    // bars — EXP always with denominator
    const hp = me[P.HP], mhp = me[P.MAXHP];
    $('hp-bar').style.width = Math.max(0, hp / mhp * 100) + '%';
    $('hp-text').textContent = `${hp} / ${mhp}`;
    $('xp-bar').style.width = Math.max(0, me[P.XP] / me[P.NEXTXP] * 100) + '%';
    $('xp-text').textContent = `${me[P.XP]} / ${me[P.NEXTXP]}`;
    $('hud-gld').textContent = `GLD ${me[P.GLD]}`;
    $('hud-lvl').textContent = `LVL ${me[P.LVL]}`;
    const inst = $('hud-install');
    if (me[P.PEND] > 0) { inst.textContent = `INSTALL x${me[P.PEND]}`; inst.classList.remove('hidden'); }
    else inst.classList.add('hidden');

    // dash pips
    const pips = $('dash-pips');
    const want = `${me[P.DASH]}/${me[P.DASHMAX]}`;
    if (pips.dataset.v !== want) {
      pips.dataset.v = want;
      pips.innerHTML = '';
      for (let i = 0; i < Math.min(me[P.DASHMAX], 14); i++) {
        const d = document.createElement('span');
        d.className = 'pip' + (i < me[P.DASH] ? ' full' : '');
        pips.appendChild(d);
      }
      if (me[P.DASHMAX] > 14) pips.append(` x${me[P.DASHMAX]}`);
    }

    // weapon slots
    const slots = $('weapon-slots');
    const wKey = me[P.WEAPONS].join(',') + me[P.WIDX];
    if (slots.dataset.v !== wKey) {
      slots.dataset.v = wKey;
      slots.innerHTML = '';
      me[P.WEAPONS].forEach((w, i) => {
        const s = document.createElement('span');
        s.className = 'wslot' + (i === me[P.WIDX] ? ' active' : '');
        s.textContent = `${i + 1} ${w}`;
        slots.appendChild(s);
      });
    }

    // interact prompt
    const near = state.nearestInteractable(state.pred.x, state.pred.y);
    const prompt = $('hud-prompt');
    if (near && room.phase === 'play') {
      prompt.classList.remove('hidden', 'deny');
      if (near.kind === 'portal') prompt.textContent = 'E — ВОЙТИ В ПОРТАЛ';
      else if (near.kind === 'bet') prompt.textContent = 'E — BET TERMINAL';
      else prompt.textContent = near.cost > 0 ? `E / ${near.cost} — ${near.label}` : `E — ${near.label}`;
    } else if (!this.promptTimer) prompt.classList.add('hidden');

    // install timer bar
    if (this.install.open) {
      this.install.expires -= dt;
      $('install-timer-bar').style.width = Math.max(0, this.install.expires / this.install.total * 100) + '%';
    }
  }

  // ------------------------------------------------- fx handling
  handleFx(f, myId, state) {
    const name = id => id === myId ? 'ТЫ' : (this.names.get(id) || '??');
    switch (f.t) {
      case 'room': {
        const mods = (f.mods || []).map(m => MOD_LABELS[m] || m).join(' + ');
        this.banner(f.cat === 'boss' ? 'BOSS FLOOR' : `${f.roomId}`, `LOOP ${f.loop} · DEPTH ${f.depth}${mods ? ' · ' + mods : ''}`,
          f.cat === 'boss' ? 'red' : (mods ? 'purple' : ''));
        this.closeCasino();
        break;
      }
      case 'join': this.feed(`${f.name} ПОДКЛЮЧИЛСЯ`, 'g'); break;
      case 'leave': this.feed(`${f.name} ВЫШЕЛ`, 'r'); break;
      case 'levelup':
        if (f.id === myId) this.feed(`LEVEL UP → ${f.level} · INSTALL x${f.pending}`, 'g');
        break;
      case 'pdown': this.feed(`${name(f.id)} DOWN`, 'r'); if (f.id === myId) this.banner('ТЫ ВЫБЫЛ', 'союзники дотащат до портала', 'red'); break;
      case 'portal_open': this.banner('ПОРТАЛ ОТКРЫТ', 'E — перейти дальше', 'green'); this.feed('ПОРТАЛ ОТКРЫТ', 'g'); break;
      case 'boss_down': this.banner('BOSS DOWN', 'забирай лут', 'green'); break;
      case 'chest_open':
        if (f.id === myId) this.feed(`${f.chest}: ${f.rewards.join(' + ')}`, f.cursed ? 'p' : 'g');
        break;
      case 'weapon_get': this.feed(`${name(f.id)} ВЗЯЛ ${f.w}`, 'c'); break;
      case 'ability_get': if (f.id === myId) this.feed(f.label, 'c'); break;
      case 'denied': if (f.id === myId) this.denyPrompt('НЕДОСТАТОЧНО GLD'); break;
      case 'bet_ui': if (f.id === myId) this.openCasino(); break;
      case 'casino': this.casinoResult(f, myId); break;
      case 'install': if (f.id === myId) this.feed(`INSTALL: ${f.label}`, f.cursed ? 'p' : 'g'); break;
      case 'transition': this.banner('INSTALL PHASE', 'распределение апгрейдов', 'green'); break;
      case 'run_lost':
        this.banner('RUN LOST', `LOOP ${f.loop} · DEPTH ${f.depth} — перезапуск…`, 'red');
        this.closeInstall(); this.closeCasino();
        break;
    }
  }

  feed(text, cls = '') {
    const el = document.createElement('div');
    if (cls) el.className = cls;
    el.textContent = text;
    const feed = $('feed');
    feed.prepend(el);
    while (feed.children.length > 7) feed.lastChild.remove();
    setTimeout(() => el.remove(), 6000);
  }

  banner(text, sub = '', cls = '') {
    const b = $('banner');
    b.className = cls;
    b.innerHTML = text + (sub ? `<div class="sub">${sub}</div>` : '');
    b.classList.remove('hidden');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.add('hidden'), 2600);
  }

  denyPrompt(text) {
    const prompt = $('hud-prompt');
    prompt.textContent = text;
    prompt.classList.remove('hidden');
    prompt.classList.add('deny');
    clearTimeout(this.promptTimer);
    this.promptTimer = setTimeout(() => { prompt.classList.add('hidden'); prompt.classList.remove('deny'); this.promptTimer = null; }, 1200);
  }

  // ------------------------------------------------- TAB panel
  setTab(visible, state) {
    const panel = $('tab-panel');
    if (!visible) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    const room = state.room;
    if (!room || !state.latest) return;
    $('tab-run').textContent =
      `LOOP ${room.loop} / DEPTH ${room.depth}   КОМНАТА ${room.id}   КОД ${this.net.roomId || '----'}\n` +
      `ЗАЧИСТКА ${room.kills}/${room.quota}   МОДЫ: ${(room.mods || []).map(m => MOD_LABELS[m]).join(', ') || '—'}`;
    const t = $('tab-table');
    let html = '<tr><th>ИГРОК</th><th>HP</th><th>LVL</th><th>GLD</th><th>DASH</th><th>DRN</th><th>ORB</th><th>INSTALL</th></tr>';
    for (const p of state.latest.players) {
      const cls = p[P.ID] === state.myId ? 'me' : (!p[P.ALIVE] ? 'dead' : '');
      html += `<tr class="${cls}"><td>${esc(p[P.NAME])}</td><td>${p[P.ALIVE] ? p[P.HP] + '/' + p[P.MAXHP] : 'DOWN'}</td>` +
        `<td>${p[P.LVL]}</td><td>${p[P.GLD]}</td><td>${p[P.DASH]}/${p[P.DASHMAX]}</td>` +
        `<td>${p[P.DRONES]}</td><td>${p[P.ORBITALS]}</td><td>${p[P.PEND] > 0 ? 'x' + p[P.PEND] : '—'}</td></tr>`;
    }
    t.innerHTML = html;
  }

  // ------------------------------------------------- install modal
  openInstall(choices, pending) {
    this.install = { open: true, choices, expires: 15, total: 15, locked: false };
    $('install-pending').textContent = `x${pending}`;
    const box = $('install-choices');
    box.innerHTML = '';
    const CURSED = ['overload', 'gamble'];
    const LABELS = {
      dmg: 'DMG +15%', fire: 'FIRE RATE +12%', spd: 'SPD +8%', maxhp: 'HP +20',
      magnet: 'MAGNET +40%', dash: 'DASH +1', drone: 'DRONE +1', orbital: 'ORBITAL +1',
      luck: 'LUCK +1', proc: 'BLAST PROC 10%', echo: 'ECHO SHOT 12%', leech: 'LIFESTEAL 2%',
      goldgun: 'GLD ON KILL +40%', overload: 'DMG +50% / HP -15', gamble: 'LUCK +3 / SPD -10%'
    };
    choices.forEach((id, i) => {
      const d = document.createElement('div');
      d.className = 'choice' + (CURSED.includes(id) ? ' cursed' : '');
      d.innerHTML = `<span class="key">[${i + 1}]</span>${LABELS[id] || id}`;
      d.addEventListener('click', () => this.pick(i));
      box.appendChild(d);
    });
    $('install-modal').classList.remove('hidden');
  }
  pick(i) {
    // guard against double-picks: lock until the next offer (or close) arrives
    if (this.install.locked || !this.install.open) return;
    if (i < 0 || i >= this.install.choices.length) return;
    this.install.locked = true;
    const els = document.querySelectorAll('#install-choices .choice');
    els.forEach((el, j) => el.classList.add(j === i ? 'picked' : 'dimmed'));
    this.net.sendPick(i);
  }
  closeInstall() { this.install.open = false; this.install.locked = false; $('install-modal').classList.add('hidden'); }

  // ------------------------------------------------- casino modal
  clearReels() {
    clearTimeout(this.casino.timeout);
    this.casino.timeout = null;
    document.querySelectorAll('.reel').forEach(r => {
      if (r._iv) clearInterval(r._iv);
      r._iv = null;
      r.classList.remove('spin');
    });
  }
  openCasino() {
    this.clearReels();
    this.casino.open = true;
    this.casino.spinning = false;
    $('casino-modal').classList.remove('hidden');
    $('casino-result').textContent = '';
    $('casino-result').style.color = '';
    document.querySelectorAll('.reel').forEach(r => { r.textContent = '—'; r.className = 'reel'; });
  }
  closeCasino() {
    this.clearReels();
    this.casino.open = false;
    this.casino.spinning = false;
    $('casino-modal').classList.add('hidden');
  }
  placeBet(stake) {
    if (this.casino.spinning) return;
    this.casino.spinning = true;
    const token = ++this.casino.spinToken;
    $('casino-result').textContent = '';
    $('casino-result').style.color = '';
    const syms = ['GLD', 'HEA', 'EXP', 'WPN', 'ABL', 'STC'];
    document.querySelectorAll('.reel').forEach(r => {
      if (r._iv) clearInterval(r._iv);
      r.className = 'reel spin';
      r._iv = setInterval(() => { r.textContent = syms[Math.floor(Math.random() * syms.length)]; }, 70);
    });
    this.net.sendCasino(stake);
    // safety: command is reliable now, so no answer usually means no confirmation/no charge
    clearTimeout(this.casino.timeout);
    this.casino.timeout = setTimeout(() => {
      if (this.casino.spinning && token === this.casino.spinToken) {
        this.stopReels(null);
        const el = $('casino-result');
        el.textContent = 'НЕТ ОТВЕТА — СТАВКА НЕ ПОДТВЕРЖДЕНА';
        el.style.color = '#ff3048';
      }
    }, 4000);
  }
  stopReels(f) {
    clearTimeout(this.casino.timeout);
    this.casino.timeout = null;
    const reels = [...document.querySelectorAll('.reel')];
    reels.forEach((r, i) => {
      setTimeout(() => {
        if (r._iv) clearInterval(r._iv);
        r._iv = null;
        r.classList.remove('spin');
        if (f) {
          r.textContent = f.symbols[i];
          r.classList.add(f.outcome === 'LOSE' || f.outcome === 'STC' ? 'lose' : 'win');
        } else r.textContent = '—';
        if (i === 2) this.casino.spinning = false;
      }, 220 * (i + 1));
    });
  }
  casinoDenied(f) {
    if (!this.casino.open) this.openCasino();
    this.clearReels();
    this.casino.spinning = false;
    document.querySelectorAll('.reel').forEach(r => { r.textContent = 'ERR'; r.className = 'reel lose'; });
    const el = $('casino-result');
    el.textContent = f.error || 'BET FAILED';
    el.style.color = '#ff3048';
  }
  casinoResult(f, myId) {
    if (f.ok === false) { this.casinoDenied(f); return; }
    if (f.id !== myId) {
      const RES = { JCK: 'JACKPOT', LOSE: 'проиграл', STC: 'STATIC' };
      this.feed(`${this.names.get(f.id) || '??'} BET ${f.stake} → ${RES[f.outcome] || f.outcome}`, f.outcome === 'LOSE' ? 'r' : 'g');
      return;
    }
    if (f.seq && this.casino.lastResultSeq === f.seq) return; // direct result + later snapshot duplicate
    if (f.seq) this.casino.lastResultSeq = f.seq;
    if (!this.casino.open) this.openCasino();
    this.stopReels(f);
    const resultToken = ++this.casino.spinToken;
    setTimeout(() => {
      if (resultToken !== this.casino.spinToken) return;
      const el = $('casino-result');
      const pl = f.payload || {};
      const parts = [`-${f.stake} GLD`];
      if (pl.gld) parts.push(`+${pl.gld} GLD`);
      if (pl.xp) parts.push(`+${pl.xp} EXP`);
      if (pl.heal) parts.push(`+${pl.heal} HP`);
      if (pl.dash) parts.push('DASH +1');
      if (pl.weaponLabel) parts.push(pl.weaponLabel);
      if (pl.static) parts.push('STATIC DEBT → СЛЕД. КОМНАТА');
      if (f.outcome === 'JCK') parts.unshift('☰ JACKPOT ☰');
      if (pl.gld) parts.push(`NET ${pl.gld - f.stake >= 0 ? '+' : ''}${pl.gld - f.stake} GLD`);
      el.textContent = parts.join(' · ');
      el.style.color = f.outcome === 'LOSE' ? '#ff3048' : f.outcome === 'STC' ? '#b45cff' : '#00ff66';
    }, 760);
  }

}
