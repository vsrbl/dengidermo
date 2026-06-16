// nncckkrr HUD: bars, pips, feed, banners, TAB panel, install + casino modals
import { P, ENEMY_KINDS } from './state.v2-0-13.js';
import { UPGRADES, WEAPONS, CHESTS, ROOM_MODS, BET_STAKES, ENEMIES } from '../shared/data.v2-0-13.js';

const $ = id => document.getElementById(id);
const MOD_LABELS = Object.fromEntries(Object.values(ROOM_MODS).map(m => [m.id, m.label]));
const UPG = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
const WEAPON_BY_LABEL = Object.fromEntries(Object.values(WEAPONS).map(w => [w.label, w]));
const CHEST_BY_LABEL = Object.fromEntries(Object.entries(CHESTS).map(([id, c]) => [c.label, { id, ...c }]));
const CHEST_DESC = {
  BSC: 'Бесплатный базовый сундук: GLD/EXP и редкий HEA. Хорошая безопасная награда.',
  WPN: 'Оружейный сундук: открывает выбор из 3 вариантов — оружие, оружейные апгрейды или усиление урона/скорострельности. Апгрейды недоступного оружия серые.',
  ABL: 'Сундук способностей: ветки рывка, Q-способности и улучшения мобильности.',
  RAR: 'Редкий сундук: tier-1 апгрейд для билда, срабатывания, спутников или экономики.',
  CRS: 'Проклятый сундук: сильная tier-2 награда, но создаёт статический долг/опасность дальше.'
};
const PICKUP_DESC = {
  GLD: 'Деньги для сундуков и BET. Подбор шарится между живыми игроками.',
  EXP: 'Опыт для level-up. INSTALL выбор появится после перехода через портал.',
  HEA: 'Лечение. В обычном бою редкое, чаще от элит/боссов/сундуков.'
};
const ENEMY_DESC = {
  grunt: 'Базовый преследователь: давит количеством и контактным уроном.', runner: 'Быстрый слабый враг: закрывает дистанцию и ломает позицию.', tank: 'Медленный бронированный враг: блокирует пространство и впитывает урон.', shooter: 'Дальний враг: держит дистанцию и стреляет красными снарядами.', charger: 'Windup → рывок. Следи за красной линией перед атакой.', bomber: 'Подходит, включает fuse и взрывается. Уходи из радиуса.', bouncer: 'Pinball-враг: отскакивает от стен и игрока, толкает без усталости.', glitch: 'Blink attacker: телепортируется рядом и делает strike.',
  echo: 'ECH: glitch-клон, стреляет delayed echo shots.', orbiter: 'ORB: орбитит игрока и имеет фронтальный shield.', anchor: 'ANC: поле замедляет/тянет и пожирает pickups.', splitter: 'SPL: после смерти делится на маленькие быстрые части.', prism: 'PRS: стреляет split/prism beams.', pulse: 'PLS: forward square-wave attack.', leech: 'LCH: лечит раненых врагов, приоритетная цель.', herald: 'HRD: tether к игроку и summon swarm.', boss: 'BOS: boss floor, burst fire и adds после просадки HP.'
};
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const activeLabel = p => p?.[P.ACTIVELABEL] || 'НЕТ АКТИВКИ';
const activeDesc = p => p?.[P.ACTIVEDESC] || 'Q сейчас ничего не запускает. Получи Q-апгрейд, чтобы установить активную способность.';
const activeShort = p => {
  const label = activeLabel(p);
  if (label === 'НЕТ АКТИВКИ') return 'Q — НЕТ';
  return label.replace(/^Q:\s*/, 'Q ');
};

export class Hud {
  constructor(net, audio = null) {
    this.net = net;
    this.audio = audio;
    this.feedLines = [];
    this.bannerTimer = null;
    this.promptTimer = null;
    this.casino = { open: false, spinning: false, betId: null, spinToken: 0, timeout: null, lastResultSeq: 0, reelTimers: [] };
    this.install = { open: false, choices: [], expires: 0, total: 15, locked: false };
    this.weapon = { open: false, choices: [], locked: false };
    this.names = new Map();

    this.initExplain();
    $('casino-stakes').querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => this.placeBet(btn.dataset.stake));
    });
  }

  playUiSound(type) { try { this.audio?.play?.(type); } catch {} }

  show() { $('hud').classList.remove('hidden'); }

  // ------------------------------------------------- hover explanations
  initExplain() {
    this.tip = $('explain-tip');
    this.tipTitle = this.tip?.querySelector('.et-title');
    this.tipBody = this.tip?.querySelector('.et-body');
    this.tipData = null;
    this.domTipActive = false;
    this.mouse = { x: 0, y: 0 };
    const move = (e) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.placeTip(); };
    window.addEventListener('mousemove', move, { passive: true });
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest?.('[data-explain]');
      if (!el) return;
      this.domTipActive = true;
      this.showTip(el.dataset.explainTitle || 'ИНФО', el.dataset.explain || '', el.dataset.explainTone || '', 'dom');
    });
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest?.('[data-explain]');
      if (!el) return;
      this.domTipActive = true;
      this.showTip(el.dataset.explainTitle || 'ИНФО', el.dataset.explain || '', el.dataset.explainTone || '', 'dom');
    });
    document.addEventListener('mouseout', (e) => {
      const el = e.target.closest?.('[data-explain]');
      if (!el) return;
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      this.domTipActive = false;
      this.hideTip();
    });
    document.addEventListener('focusout', (e) => {
      const el = e.target.closest?.('[data-explain]');
      if (!el) return;
      this.domTipActive = false;
      this.hideTip();
    });
  }

  showTip(title, body, tone = '', source = 'dom') {
    if (!this.tip || !body) return;
    this.tipTitle.textContent = title;
    this.tipBody.textContent = body;
    this.tip.className = tone || '';
    this.tip.classList.remove('hidden');
    this.tipData = { title, body, tone, source };
    this.placeTip();
  }

  hideTip() {
    if (!this.tip) return;
    this.tip.classList.add('hidden');
    this.tipData = null;
  }

  placeTip() {
    if (!this.tip || this.tip.classList.contains('hidden')) return;
    const pad = 14;
    const tw = this.tip.offsetWidth || 260;
    const th = this.tip.offsetHeight || 80;
    let x = this.mouse.x + 18;
    let y = this.mouse.y + 20;
    if (x + tw + pad > window.innerWidth) x = this.mouse.x - tw - 18;
    if (y + th + pad > window.innerHeight) y = this.mouse.y - th - 18;
    x = Math.max(pad, Math.min(window.innerWidth - tw - pad, x));
    y = Math.max(pad, Math.min(window.innerHeight - th - pad, y));
    this.tip.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  setWorldHover(state, input, renderer) {
    if (this.domTipActive || !state?.latest || !renderer || !input) return;
    if (!input.inspectMode) {
      if (this.tipData?.source === 'inspect') this.hideTip();
      return;
    }
    const mw = renderer.screenToWorld(input.mouseX, input.mouseY);
    let found = null;
    const dist2 = (x, y) => (mw.x - x) ** 2 + (mw.y - y) ** 2;
    const room = state.room;
    if (room?.portal) {
      const [x, y, open] = room.portal;
      if (dist2(x, y) < 38 ** 2) found = { title: 'PRT / ПОРТАЛ', body: open ? 'Открытый переход: нажми E рядом, чтобы войти в INSTALL-фазу и перейти глубже.' : 'Портал закрыт. Выполни цель комнаты, чтобы открыть его.', tone: open ? '' : 'red' };
    }
    if (!found) for (const o of state.latest.objects || []) {
      const [, type, label, x, y, opened, cost] = o;
      if (dist2(x, y) > 34 ** 2) continue;
      if (type === 'bet') found = { title: 'BET-ТЕРМИНАЛ', body: 'Казино-терминал: E открывает ставки LOW/MID/HIGH. Результат решается хостом, ставка списывается только при принятой игре.', tone: 'red' };
      else found = { title: `${label} / СУНДУК`, body: `${CHEST_DESC[label] || 'Сундук с наградой.'}${opened ? ' Уже открыт.' : cost > 0 ? ` Цена: ${cost} GLD.` : ' Бесплатно.'}`, tone: label === 'CRS' ? 'purple' : '' };
      break;
    }
    if (!found) for (const pk of state.latest.pickups || []) {
      const [, type, x, y, val] = pk;
      if (dist2(x, y) > 22 ** 2) continue;
      found = { title: `${type} +${val ?? ''}`.trim(), body: PICKUP_DESC[type] || 'Подбираемая награда.', tone: type === 'EXP' ? 'cyan' : '' };
      break;
    }
    if (!found) for (const e of state.latest.enemies || []) {
      const [, kindIdx, x, y, hp01, size, st, elite] = e;
      if (dist2(x, y) > Math.max(24, size * 0.75) ** 2) continue;
      const kind = ENEMY_KINDS[kindIdx] || 'enemy';
      const def = ENEMIES[kind] || {};
      found = { title: `${elite ? 'ЭЛИТНЫЙ ' : ''}${def.label || kind.toUpperCase()}`, body: `${ENEMY_DESC[kind] || 'Враг.'} Здоровье ${Math.round(hp01)}%.${elite ? ' Элитный: больше HP/урона и лучше награда.' : ''}${st && st !== 'move' ? ' Состояние: ' + st + '.' : ''}`, tone: elite || kind === 'boss' ? 'red' : '' };
      break;
    }
    if (found) this.showTip(found.title, found.body, found.tone, 'inspect');
    else if (this.tipData?.source === 'inspect' && !this.domTipActive) this.hideTip();
  }

  setExplain(el, title, body, tone = '') {
    if (!el) return;
    el.dataset.explainTitle = title;
    el.dataset.explain = body;
    if (tone) el.dataset.explainTone = tone; else delete el.dataset.explainTone;
  }


  setInspect(on) {
    const el = $('hud-inspect');
    if (!el) return;
    el.classList.toggle('hidden', !on);
  }


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
    if (room.phase === 'install') obj.innerHTML = '<span class="done">INSTALL-ФАЗА</span>';
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
        this.setExplain(d, 'ЗАРЯД РЫВКА', i < me[P.DASH] ? 'Готовый заряд рывка. Shift — рывок/телепорт.' : 'Пустой заряд рывка, скоро восстановится.', 'cyan');
        pips.appendChild(d);
      }
      if (me[P.DASHMAX] > 14) pips.append(` x${me[P.DASHMAX]}`);
    }

    const acd = me[P.ACTIVECD] || 0;
    const qName = activeLabel(me);
    const qTxt = qName === 'НЕТ АКТИВКИ'
      ? 'Q — НЕТ АКТИВКИ'
      : (acd > 0 ? `Q CD ${acd.toFixed ? acd.toFixed(1) : acd}` : (me[P.ACTIVEBUFF] ? 'Q OVERCLOCK' : activeShort(me)));
    const lvlEl = $('hud-lvl');
    lvlEl.textContent = `LVL ${me[P.LVL]} · ${qTxt}`;
    this.setExplain(lvlEl, 'АКТИВНАЯ СПОСОБНОСТЬ Q', `${activeLabel(me)}. ${activeDesc(me)}${qName !== 'НЕТ АКТИВКИ' ? ' Нажми Q, чтобы активировать. Перезарядка показывается рядом с уровнем.' : ''}`, qName === 'НЕТ АКТИВКИ' ? '' : 'cyan');

    // weapon slots
    const slots = $('weapon-slots');
    const wKey = me[P.WEAPONS].join(',') + me[P.WIDX] + ':' + (me[P.SHG] ?? '');
    if (slots.dataset.v !== wKey) {
      slots.dataset.v = wKey;
      slots.innerHTML = '';
      me[P.WEAPONS].forEach((w, i) => {
        const s = document.createElement('span');
        s.className = 'wslot' + (i === me[P.WIDX] ? ' active' : '');
        const wd = WEAPONS[w] || WEAPON_BY_LABEL[w];
        const isShg = (wd?.label || w) === 'SHG';
        s.textContent = `${i + 1} ${wd?.label || w}${isShg ? ' ' + (me[P.SHG] ?? 4) + '/4' : ''}`;
        const desc = wd ? (
          wd.label === 'SHG'
            ? `Дробовик на 4 заряда. Можно быстро выпустить заряды почти без задержки; каждый заряд восстанавливается примерно за ${wd.chargeRegen}s. Сейчас зарядов: ${me[P.SHG] ?? 4}/4.`
            : wd.label === 'SEK'
              ? `Медленный самонаводящийся снаряд: урон ${wd.dmg}, перезарядка ${wd.cooldown}s, скорость ${wd.speed}. Не спамит экран, зато держит цель.`
              : `Тяжёлая ракетница: урон ${wd.dmg}, перезарядка ${wd.cooldown}s, AoE ${wd.aoe}. Ракета взрывается при попадании, об стену или после дистанции.`
        ) : 'Слот оружия.';
        this.setExplain(s, wd?.name || String(w).toUpperCase(), desc, 'cyan');
        slots.appendChild(s);
      });
    }

    // interact prompt
    const near = state.nearestInteractable(state.pred.x, state.pred.y);
    const prompt = $('hud-prompt');
    if (near && room.phase === 'play') {
      prompt.classList.remove('hidden', 'deny');
      if (near.kind === 'portal') {
        prompt.textContent = 'E — ВОЙТИ В ПОРТАЛ';
        this.setExplain(prompt, 'ПОРТАЛ', 'Переход дальше: запускает INSTALL-фазу и следующую комнату.', '');
      } else if (near.kind === 'bet') {
        prompt.textContent = 'E — BET TERMINAL';
        this.setExplain(prompt, 'BET-ТЕРМИНАЛ', 'Открывает казино. LOW/MID/HIGH ставки, результат решает хост.', 'red');
      } else {
        prompt.textContent = near.cost > 0 ? `E / ${near.cost} — ${near.label}` : `E — ${near.label}`;
        this.setExplain(prompt, `${near.label} / СУНДУК`, `${CHEST_DESC[near.label] || 'Сундук с наградой.'}${near.cost > 0 ? ` Нужно ${near.cost} GLD.` : ' Бесплатно.'}`, near.label === 'CRS' ? 'purple' : '');
      }
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
        this.banner(f.cat === 'boss' ? 'ЭТАЖ БОССА' : `${f.roomId}`, `LOOP ${f.loop} · DEPTH ${f.depth}${mods ? ' · ' + mods : ''}`,
          f.cat === 'boss' ? 'red' : (mods ? 'purple' : ''));
        this.closeCasino(); this.closeWeaponChest();
        break;
      }
      case 'join': this.feed(`${f.name} ПОДКЛЮЧИЛСЯ`, 'g'); break;
      case 'leave': this.feed(`${f.name} ВЫШЕЛ`, 'r'); break;
      case 'levelup':
        if (f.id === myId) this.feed(`LEVEL UP → ${f.level} · INSTALL x${f.pending}`, 'g');
        break;
      case 'pdown': this.feed(`${name(f.id)} ВЫБЫЛ`, 'r'); if (f.id === myId) this.banner('ТЫ ВЫБЫЛ', 'союзники дотащат до портала', 'red'); break;
      case 'portal_open': this.banner('ПОРТАЛ ОТКРЫТ', 'E — перейти дальше', 'green'); this.feed('ПОРТАЛ ОТКРЫТ', 'g'); break;
      case 'boss_down': this.banner('БОСС УНИЧТОЖЕН', 'забирай лут', 'green'); break;
      case 'chest_open':
        if (f.id === myId) this.feed(`${f.chest}: ${f.rewards.join(' + ')}`, f.cursed ? 'p' : 'g');
        break;
      case 'weapon_get': this.feed(`${name(f.id)} ВЗЯЛ ${f.w}`, 'c'); break;
      case 'weapon_mod': if (f.id === myId) this.feed(`WPN: ${f.label}`, 'c'); break;
      case 'ability_get': if (f.id === myId) this.feed(f.label, 'c'); break;
      case 'active': if (f.id === myId) this.feed(`Q: ${f.label}`, 'c'); break;
      case 'active_denied': if (f.id === myId) { this.denyPrompt('НЕТ АКТИВНОЙ СПОСОБНОСТИ Q'); this.feed('Q: НЕТ АКТИВКИ', 'r'); } break;
      case 'contract': this.banner(f.label, 'убей отмеченную цель быстро', 'red'); break;
      case 'contract_done': this.banner('КОНТРАКТ ВЫПОЛНЕН', 'редкий апгрейд установлен', 'green'); break;
      case 'contract_fail': this.banner('КОНТРАКТ ПРОВАЛЕН', 'цель эволюционировала', 'red'); break;
      case 'denied': if (f.id === myId) this.denyPrompt(f.cost ? `НЕТ GLD ${f.have}/${f.cost}` : 'НЕДОСТАТОЧНО GLD'); break;
      case 'bet_ui': if (f.id === myId) this.openCasino(); break;
      case 'casino': this.casinoResult(f, myId); break;
      case 'install': if (f.id === myId) this.feed(`INSTALL: ${f.label}`, f.cursed ? 'p' : 'g'); break;
      case 'transition': this.banner('INSTALL-ФАЗА', 'распределение апгрейдов', 'green'); break;
      case 'run_lost':
        this.banner('ЗАБЕГ ПРОВАЛЕН', `LOOP ${f.loop} · DEPTH ${f.depth} — перезапуск…`, 'red');
        this.closeInstall(); this.closeCasino(); this.closeWeaponChest();
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
    this.promptTimer = setTimeout(() => { prompt.classList.add('hidden'); prompt.classList.remove('deny'); this.promptTimer = null; }, 1500);
  }

  // ------------------------------------------------- TAB panel
  setTab(visible, state) {
    const panel = $('tab-panel');
    const room = state?.room;
    if (!visible || !room || !state?.latest || !state.me()) {
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    $('tab-run').innerHTML =
      `<span class="term" data-explain-title="ЦИКЛ" data-explain="Полный оборот маршрута. Чем выше цикл, тем тяжелее враги и опаснее правила.">LOOP</span> ${room.loop} / ` +
      `<span class="term" data-explain-title="ГЛУБИНА" data-explain="Сколько комнат уже пройдено в текущем забеге.">DEPTH</span> ${room.depth}   ` +
      `<span class="term" data-explain-title="КОМНАТА" data-explain="Текущая внутренняя локация забега.">КОМНАТА</span> ${esc(room.id)}   ` +
      `<span class="term" data-explain-title="КОД" data-explain="Код сетевой комнаты для подключения друзей.">КОД</span> ${esc(this.net.roomId || '----')}<br>` +
      `<span class="term" data-explain-title="ЦЕЛЬ" data-explain="Прогресс зачистки. После выполнения цели открывается портал.">ЗАЧИСТКА</span> ${room.kills}/${room.quota}   ` +
      `<span class="term" data-explain-title="ПРАВИЛА" data-explain="Активные модификаторы комнаты, которые меняют бой и награды.">ПРАВИЛА</span>: ${(room.mods || []).map(m => esc(MOD_LABELS[m] || m)).join(', ') || '—'}`;
    const t = $('tab-table');
    let html = '<tr>' +
      '<th><span class="term" data-explain-title="ИГРОК" data-explain="Имя игрока в комнате.">ИГРОК</span></th>' +
      '<th><span class="term" data-explain-title="ЗДОРОВЬЕ" data-explain="Текущее и максимальное здоровье.">HP</span></th>' +
      '<th><span class="term" data-explain-title="УРОВЕНЬ" data-explain="Текущий уровень игрока.">LVL</span></th>' +
      '<th><span class="term" data-explain-title="ДЕНЬГИ" data-explain="GLD для сундуков и BET-терминала.">GLD</span></th>' +
      '<th><span class="term" data-explain-title="РЫВОК" data-explain="Готовые заряды рывка / максимум зарядов.">DASH</span></th>' +
      '<th><span class="term" data-explain-title="ДРОНЫ" data-explain="Автостреляющие спутники игрока.">DRN</span></th>' +
      '<th><span class="term" data-explain-title="ОРБИТАЛИ" data-explain="Орбитальные спутники с контактным уроном.">ORB</span></th>' +
      '<th><span class="term" data-explain-title="АКТИВКА Q" data-explain="Текущая активная способность на Q. Наведи на значение в строке игрока, чтобы увидеть описание.">Q</span></th>' +
      '<th><span class="term" data-explain-title="INSTALL" data-explain="Очередь апгрейдов, которые нужно выбрать между комнатами.">INSTALL</span></th>' +
      '</tr>';
    for (const p of state.latest.players) {
      const cls = p[P.ID] === state.myId ? 'me' : (!p[P.ALIVE] ? 'dead' : '');
      const qTitle = esc(activeLabel(p));
      const qBody = esc(activeDesc(p));
      const qCell = `<span class="term" data-explain-title="${qTitle}" data-explain="${qBody}">${qTitle}</span>`;
      html += `<tr class="${cls}"><td>${esc(p[P.NAME])}</td><td>${p[P.ALIVE] ? p[P.HP] + '/' + p[P.MAXHP] : 'ВЫБЫЛ'}</td>` +
        `<td>${p[P.LVL]}</td><td>${p[P.GLD]}</td><td>${p[P.DASH]}/${p[P.DASHMAX]}</td>` +
        `<td>${p[P.DRONES]}</td><td>${p[P.ORBITALS]}</td><td>${qCell}</td><td>${p[P.PEND] > 0 ? 'x' + p[P.PEND] : '—'}</td></tr>`;
    }
    t.innerHTML = html;
  }

  // ------------------------------------------------- install modal
  openInstall(choices, pending) {
    this.install = { open: true, choices, expires: 15, total: 15, locked: false };
    $('install-pending').textContent = `x${pending}`;
    const box = $('install-choices');
    box.innerHTML = '';
    choices.forEach((id, i) => {
      const u = UPG[id];
      const d = document.createElement('div');
      d.className = 'choice' + (u?.cursed ? ' cursed' : '');
      d.innerHTML = `<span class="key">[${i + 1}]</span>${esc(u?.label || id)}`;
      this.setExplain(d, u?.label || id, u?.desc || 'Стакаемый апгрейд. Наведи на другие варианты, чтобы сравнить.', u?.cursed ? 'purple' : (u?.branch === 'Q' || u?.branch === 'DASH' ? 'cyan' : ''));
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

  // ------------------------------------------------- WPN chest modal
  openWeaponChest(choices = []) {
    this.weapon = { open: true, choices, locked: false };
    const box = $('weapon-choices');
    box.innerHTML = '';
    choices.forEach((opt, i) => {
      const d = document.createElement('div');
      d.className = 'choice weapon-choice' + (opt.disabled ? ' disabled' : '');
      const locked = opt.disabled ? `<span class="lock">${esc(opt.disabledReason || 'ЗАКРЫТО')}</span>` : '';
      d.innerHTML = `<span class="key">[${i + 1}]</span>${esc(opt.label || opt.id)}${locked}`;
      const title = opt.disabled ? `${opt.label || opt.id} / НЕДОСТУПНО` : (opt.label || opt.id);
      const body = `${opt.desc || 'Награда оружейного сундука.'}${opt.disabled ? ` Недоступно: ${opt.disabledReason || 'требуется другое оружие'}.` : ' Можно выбрать сейчас.'}`;
      this.setExplain(d, title, body, opt.disabled ? 'red' : (opt.kind === 'weapon_upgrade' ? 'cyan' : ''));
      d.addEventListener('click', () => {
        if (opt.disabled) { this.playUiSound('denied'); return; }
        this.pickWeapon(i);
      });
      box.appendChild(d);
    });
    $('weapon-modal').classList.remove('hidden');
    this.playUiSound('chest_weapon');
  }
  pickWeapon(i) {
    if (this.weapon.locked || !this.weapon.open) return;
    const opt = this.weapon.choices[i];
    if (!opt || opt.disabled) { this.playUiSound('denied'); return; }
    this.weapon.locked = true;
    const els = document.querySelectorAll('#weapon-choices .choice');
    els.forEach((el, j) => el.classList.add(j === i ? 'picked' : 'dimmed'));
    this.net.sendWeaponPick(i);
  }
  closeWeaponChest() { this.weapon.open = false; this.weapon.locked = false; $('weapon-modal').classList.add('hidden'); }

  // ------------------------------------------------- casino modal
  setCasinoButtons(disabled) {
    $('casino-stakes').querySelectorAll('button').forEach(btn => { btn.disabled = !!disabled; });
  }
  clearReels() {
    clearTimeout(this.casino.timeout);
    this.casino.timeout = null;
    for (const t of this.casino.reelTimers || []) clearTimeout(t);
    this.casino.reelTimers = [];
    document.querySelectorAll('.reel').forEach(r => {
      if (r._iv) clearInterval(r._iv);
      r._iv = null;
      r.classList.remove('spin', 'win', 'lose');
    });
  }
  openCasino() {
    this.clearReels();
    this.casino.open = true;
    this.casino.spinning = false;
    this.setCasinoButtons(false);
    $('casino-modal').classList.remove('hidden');
    $('casino-result').textContent = '';
    $('casino-result').style.color = '';
    document.querySelectorAll('.reel').forEach(r => { r.textContent = '—'; r.className = 'reel'; });
  }
  closeCasino() {
    this.clearReels();
    this.casino.open = false;
    this.casino.spinning = false;
    this.setCasinoButtons(false);
    $('casino-modal').classList.add('hidden');
  }
  placeBet(stake) {
    if (this.casino.spinning || !this.casino.open) return;
    this.clearReels();
    this.casino.spinning = true;
    this.setCasinoButtons(true);
    const token = ++this.casino.spinToken;
    $('casino-result').textContent = '';
    $('casino-result').style.color = '';
    const syms = ['GLD', 'HEA', 'EXP', 'WPN', 'ABL', 'STC', 'JCK'];
    document.querySelectorAll('.reel').forEach(r => {
      if (r._iv) clearInterval(r._iv);
      r.className = 'reel spin';
      r._iv = setInterval(() => { r.textContent = syms[Math.floor(Math.random() * syms.length)]; this.playUiSound('casino_spin'); }, 70);
    });
    this.playUiSound('casino_spin');
    this.net.sendCasino(stake);
    // safety: command is reliable now, so no answer usually means no confirmation/no charge
    clearTimeout(this.casino.timeout);
    this.casino.timeout = setTimeout(() => {
      if (this.casino.spinning && token === this.casino.spinToken) {
        this.stopReels(null);
        this.setCasinoButtons(false);
        const el = $('casino-result');
        el.textContent = 'НЕТ ОТВЕТА — СТАВКА НЕ ПОДТВЕРЖДЕНА';
        el.style.color = '#ff3048';
      }
    }, 4000);
  }
  stopReels(f) {
    clearTimeout(this.casino.timeout);
    this.casino.timeout = null;
    for (const t of this.casino.reelTimers || []) clearTimeout(t);
    this.casino.reelTimers = [];
    const reels = [...document.querySelectorAll('.reel')];
    reels.forEach((r, i) => {
      const t = setTimeout(() => {
        if (r._iv) clearInterval(r._iv);
        r._iv = null;
        r.classList.remove('spin');
        if (f) {
          r.textContent = f.symbols?.[i] || '—';
          r.classList.add(f.outcome === 'LOSE' || f.outcome === 'STC' ? 'lose' : 'win');
        } else {
          r.textContent = '—';
          r.classList.add('lose');
        }
        this.playUiSound('casino_reel_stop');
        if (i === 2) { this.casino.spinning = false; this.setCasinoButtons(false); }
      }, 190 * (i + 1));
      this.casino.reelTimers.push(t);
    });
  }
  casinoDenied(f) {
    if (!this.casino.open) this.openCasino();
    this.playUiSound('denied');
    this.clearReels();
    this.casino.spinning = false;
    this.setCasinoButtons(false);
    document.querySelectorAll('.reel').forEach(r => { r.textContent = 'ОТК'; r.className = 'reel lose'; });
    const el = $('casino-result');
    const errors = { 'BET FAILED': 'СТАВКА НЕ ПРИНЯТА', 'not enough GLD': 'НЕДОСТАТОЧНО GLD', 'invalid stake': 'НЕВЕРНАЯ СТАВКА' };
    el.textContent = errors[f.error] || f.error || 'СТАВКА НЕ ПРИНЯТА';
    el.style.color = '#ff3048';
  }
  casinoResult(f, myId) {
    if (f.ok === false) { this.casinoDenied(f); return; }
    if (f.id !== myId) {
      const RES = { JCK: 'ДЖЕКПОТ', LOSE: 'проигрыш', STC: 'СТАТИКА' };
      this.feed(`${this.names.get(f.id) || '??'} BET ${f.stake} → ${RES[f.outcome] || f.outcome}`, f.outcome === 'LOSE' ? 'r' : 'g');
      return;
    }
    if (f.seq && this.casino.lastResultSeq === f.seq) return; // direct result + later snapshot duplicate
    if (f.seq) this.casino.lastResultSeq = f.seq;
    if (!this.casino.open) this.openCasino();
    const resultToken = this.casino.spinToken;
    this.stopReels(f);
    const t = setTimeout(() => {
      if (resultToken !== this.casino.spinToken) return;
      const el = $('casino-result');
      const pl = f.payload || {};
      const parts = [`-${f.stake} GLD`];
      if (pl.gld) parts.push(`+${pl.gld} GLD`);
      if (pl.xp) parts.push(`+${pl.xp} EXP`);
      if (pl.heal) parts.push(`+${pl.heal} HP`);
      if (pl.dash) parts.push('DASH +1');
      if (pl.abilityLabel) parts.push(pl.abilityLabel);
      if (pl.weaponLabel) parts.push(pl.weaponLabel);
      if (pl.static) parts.push('СТАТИЧЕСКИЙ ДОЛГ → СЛЕД. КОМНАТА');
      if (f.outcome === 'JCK') parts.unshift('ДЖЕКПОТ');
      if (pl.gld) parts.push(`NET ${pl.gld - f.stake >= 0 ? '+' : ''}${pl.gld - f.stake} GLD`);
      el.innerHTML = parts.map(x => `<span>${esc(x)}</span>`).join('');
      el.style.color = f.outcome === 'LOSE' ? '#ff3048' : f.outcome === 'STC' ? '#b45cff' : '#00ff66';
      this.playUiSound(f.outcome === 'JCK' ? 'jackpot' : f.outcome === 'LOSE' ? 'casino_lose' : f.outcome === 'STC' ? 'casino_static' : f.outcome === 'WPN' ? 'casino_weapon' : f.outcome === 'ABL' ? 'casino_ability' : 'casino_win');
    }, 640);
    this.casino.reelTimers.push(t);
  }

}
