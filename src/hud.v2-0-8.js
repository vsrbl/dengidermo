// nncckkrr HUD: bars, pips, feed, banners, TAB panel, install + casino modals
import { P } from './state.v2-0-8.js';

const $ = id => document.getElementById(id);
const MOD_LABELS = { blackout: 'BLACKOUT', static_rain: 'STATIC RAIN', greed: 'GREED SIGNAL' };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HELP = {
  'stat.HP': { title: 'HP', body: 'Здоровье игрока. Когда падает до 0, игрок становится DOWN до перехода в следующую комнату или до сброса run.' },
  'stat.EXP': { title: 'EXP', body: 'Опыт. Когда шкала заполняется, добавляется INSTALL x1. Меню апгрейдов не прерывает бой и открывается между комнатами.' },
  'stat.GLD': { title: 'GLD', body: 'Деньги. Нужны для платных сундуков и ставок в BET terminal. Подбор GLD засчитывается живым игрокам команды.' },
  'stat.LVL': { title: 'LVL', body: 'Уровень игрока. Каждый level up добавляет pending INSTALL — выбор апгрейда на переходе между комнатами.' },
  'stat.DASH': { title: 'DASH', body: 'Рывок/телепорт на Shift. Заряды восстанавливаются. Во время dash и коротко после него есть неуязвимость.' },
  'stat.DRN': { title: 'DRN / DRONE', body: 'Дрон-компаньон. Сам ищет ближайшего врага и стреляет. Количество дронов стакается.' },
  'stat.ORB': { title: 'ORB / ORBITAL', body: 'Орбитальный спутник. Вращается вокруг игрока и наносит контактный урон врагам. Количество стакается.' },
  'stat.INSTALL': { title: 'INSTALL', body: 'Очередь апгрейдов. Получается за уровень, выбирается в безопасной фазе после портала.' },
  'stat.LOOP': { title: 'LOOP', body: 'Полный круг из комнат grid → void → core → boss. Чем выше loop, тем опаснее враги, чаще элиты и жестче модификаторы.' },
  'stat.DEPTH': { title: 'DEPTH', body: 'Общая глубина run. Растёт на 1 после каждой комнаты и используется для скейлинга сложности.' },

  'upgrade.dmg': { title: 'DMG +15%', body: 'Увеличивает весь твой урон на 15%. Стакается мультипликативно: оружие, дроны, орбиталы и blast-proc становятся сильнее.' },
  'upgrade.fire': { title: 'FIRE RATE +12%', body: 'Ускоряет стрельбу: cooldown оружия становится меньше. Особенно сильно ощущается на shotgun и seeker.' },
  'upgrade.spd': { title: 'SPD +8%', body: 'Увеличивает скорость движения. Помогает кайтить толпы, уворачиваться от статик-ударов и держать дистанцию.' },
  'upgrade.maxhp': { title: 'HP +20', body: 'Увеличивает максимальное здоровье на 20 и поднимает текущий максимум выживаемости.' },
  'upgrade.magnet': { title: 'MAGNET +40%', body: 'Увеличивает радиус притягивания GLD / EXP / HEA. Чем больше стаков, тем меньше нужно рисковать ради лута.' },
  'upgrade.dash': { title: 'DASH +1', body: 'Добавляет ещё один заряд dash. 3, 5, 10+ рывков допустимы: игра рассчитана на абсурдное стакание.' },
  'upgrade.drone': { title: 'DRONE +1', body: 'Добавляет дрона, который сам стреляет по ближайшим врагам. Хорошо работает с DMG и большим количеством стаков.' },
  'upgrade.orbital': { title: 'ORBITAL +1', body: 'Добавляет вращающийся спутник. Он режет врагов контактом и помогает против толпы рядом с игроком.' },
  'upgrade.luck': { title: 'LUCK +1', body: 'Повышает шанс более редких INSTALL-вариантов и улучшает казино. Это не прямой урон, а усиление будущих roll’ов.' },
  'upgrade.proc': { title: 'BLAST PROC 10%', body: 'Пули получают шанс создать взрыв при попадании. После 100% шанс превращается в гарантированные дополнительные blast-срабатывания.' },
  'upgrade.echo': { title: 'ECHO SHOT 12%', body: 'Даёт дополнительные echo-выстрелы. После 100% стаки продолжают добавлять гарантированные/шансовые дополнительные выстрелы.' },
  'upgrade.leech': { title: 'LIFESTEAL 2%', body: 'Возвращает часть нанесённого урона в HP. Чем больше урон и плотнее толпа, тем заметнее лечение.' },
  'upgrade.goldgun': { title: 'GLD ON KILL +40%', body: 'Увеличивает GLD с убийств. Экономический апгрейд для сундуков, BET terminal и быстрого разгона run.' },
  'upgrade.overload': { title: 'DMG +50% / HP -15', body: 'Проклятый апгрейд: очень сильно повышает урон, но снижает максимум HP. Рискованный glass-cannon выбор.' },
  'upgrade.gamble': { title: 'LUCK +3 / SPD -10%', body: 'Проклятый апгрейд: сильно повышает luck, но замедляет игрока. Хорош для редких наград и казино, опасен в плотном бою.' },

  'mod.blackout': { title: 'BLACKOUT', body: 'Комнатный модификатор: видимость становится хуже, важные объекты читаются как сигналы. Играть нужно осторожнее, по beacon’ам и силуэтам.' },
  'mod.static_rain': { title: 'STATIC RAIN', body: 'Комнатный модификатор: по арене появляются предупреждения ударов. Через короткое время зона бьёт и игрока, и врагов — можно bait’ить мобов.' },
  'mod.greed': { title: 'GREED SIGNAL', body: 'Комнатный модификатор: больше наград и сундуков, но выше давление врагов. Это “жадная” комната: риск за экономику.' },

  'weapon.SHG': { title: 'SHG / SHOTGUN', body: 'Стартовое оружие. Выпускает несколько дробин веером. Сильно на близкой дистанции и хорошо скейлится от FIRE RATE.' },
  'weapon.SEK': { title: 'SEK / SEEKER', body: 'Наводящийся выстрел. Удобен против быстрых целей и в хаосе, когда сложно точно целиться.' },
  'weapon.RKT': { title: 'RKT / ROCKETGUN', body: 'Ракетница. Ракета взрывается при попадании, об стену или после пролёта заданной дистанции. Сильный AoE, медленнее темп.' },

  'chest.BSC': { title: 'BSC / BASIC CHEST', body: 'Бесплатный базовый сундук. Даёт GLD / EXP и иногда HEA. Нужен как маленький стабильный reward.' },
  'chest.WPN': { title: 'WPN / WEAPON CHEST', body: 'Платный сундук оружия. Может дать SEEKER или ROCKETGUN. Если всё оружие уже есть — превращается в усиление урона.' },
  'chest.ABL': { title: 'ABL / ABILITY CHEST', body: 'Платный сундук способности. Сейчас даёт DASH +1, то есть ещё один заряд рывка.' },
  'chest.RAR': { title: 'RAR / RARE CHEST', body: 'Платный редкий сундук. Даёт tier-1 upgrade: dash, drone, orbital, luck, proc, echo, lifesteal и другие сильные эффекты.' },
  'chest.CRS': { title: 'CRS / CURSED CHEST', body: 'Бесплатный проклятый сундук. Даёт сильный cursed upgrade, но добавляет STATIC DEBT на следующую комнату.' },
  'chest.BET': { title: 'BET TERMINAL', body: 'Казино-терминал. Можно поставить GLD на LOW / MID / HIGH. Результат решает хост, не клиент. Возможны win, jackpot, static debt или потеря ставки.' },

  'pickup.GLD': { title: 'GLD', body: 'Деньги. Тратятся на сундуки и BET terminal. Когда живой игрок подбирает GLD, награда засчитывается живым игрокам команды.' },
  'pickup.EXP': { title: 'EXP', body: 'Опыт. Заполняет шкалу уровня и добавляет INSTALL-выборы между комнатами.' },
  'pickup.HEA': { title: 'HEA', body: 'Лечение. Восстанавливает HP, но не выше максимального здоровья.' },

  'casino.GLD': { title: 'GLD GLD GLD', body: 'Казино-выигрыш деньгами. Ставка списывается, затем начисляется reward; NET показывает чистую прибыль/убыток по GLD.' },
  'casino.EXP': { title: 'EXP EXP EXP', body: 'Казино-выигрыш опытом. Может сразу привести к level up и добавить INSTALL x1.' },
  'casino.HEA': { title: 'HEA HEA HEA', body: 'Казино-выигрыш лечением. Восстанавливает HP, полезно после тяжёлой комнаты.' },
  'casino.WPN': { title: 'WPN WPN WPN', body: 'Казино-выигрыш оружием. Даёт новое оружие, если оно ещё не открыто; иначе даёт усиление урона.' },
  'casino.ABL': { title: 'ABL ABL ABL', body: 'Казино-выигрыш ability. Сейчас это DASH +1 — дополнительный заряд рывка.' },
  'casino.STC': { title: 'STC / STATIC DEBT', body: 'Плохой/опасный casino outcome: следующая non-boss комната получает STATIC RAIN. Это долг опасностью.' },
  'casino.JCK': { title: 'JCK / JACKPOT', body: 'Джекпот. Большой GLD + EXP reward. Редкий результат, шанс растёт от LUCK.' },
  'casino.LOSE': { title: 'LOSE', body: 'Ставка проиграна. Награды нет, GLD за ставку уже списан.' },
  'casino.stake': { title: 'BET STAKE', body: 'Размер ставки в GLD. Чем выше ставка, тем больше возможная награда, но потеря тоже больнее.' },
  'stake.low': { title: 'LOW / 20 GLD', body: 'Маленькая ставка. Меньше риск, меньше возможный reward. Хорошо проверять терминал без большого удара по экономике.' },
  'stake.mid': { title: 'MID / 50 GLD', body: 'Средняя ставка. Нормальный риск/выигрыш, когда есть запас GLD.' },
  'stake.high': { title: 'HIGH / 120 GLD', body: 'Большая ставка. Может резко разогнать run, но проигрыш или STATIC DEBT сильно накажут.' },

  'term.STATIC_DEBT': { title: 'STATIC DEBT', body: 'Долг опасностью. Следующая подходящая комната гарантированно получает STATIC RAIN.' },
  'term.NET': { title: 'NET', body: 'Чистый итог по GLD после вычитания ставки. Например +80 GLD reward при ставке 20 означает NET +60.' },
  'term.CURSED': { title: 'CURSED', body: 'Проклятая награда: сильный плюс вместе с опасным минусом или долгом. Не обязательно плохо, но требует плана.' }
};

function helpToken(id, label, cls = '') {
  return `<span class="helpable ${cls}" data-help="${esc(id)}">${esc(label)}</span>`;
}


export class Hud {
  constructor(net, audio = null) {
    this.net = net;
    this.audio = audio;
    this.feedLines = [];
    this.bannerTimer = null;
    this.promptTimer = null;
    this.casino = { open: false, spinning: false, betId: null, spinToken: 0, timeout: null, lastResultSeq: 0 };
    this.install = { open: false, choices: [], expires: 0, total: 15, locked: false };
    this.names = new Map();
    this.helpHideTimer = null;
    this.helpAnchor = null;
    this.helpPointer = { x: 0, y: 0 };
    this.helpVisibleId = null;

    $('casino-stakes').querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => this.placeBet(btn.dataset.stake));
    });
    this.bindContextHelp();
  }

  show() { $('hud').classList.remove('hidden'); }

  helpToken(id, label, cls = '') { return helpToken(id, label, cls); }

  bindContextHelp() {
    // v2.0.8: use elementFromPoint on pointermove, not only event.target.
    // This survives modal overlays, DOM re-renders, nested spans, and prevents the panel from vanishing forever.
    const resolveHelp = (clientX, clientY, fallback = null) => {
      const direct = fallback?.closest?.('[data-help]');
      if (direct) return direct;
      const el = document.elementFromPoint(clientX, clientY);
      return el?.closest?.('[data-help]') || null;
    };

    document.addEventListener('pointermove', e => {
      this.helpPointer = { x: e.clientX, y: e.clientY };
      const el = resolveHelp(e.clientX, e.clientY, e.target);
      if (el?.dataset?.help) this.showHelp(el.dataset.help, el);
      else if (!$('context-help')?.classList.contains('hidden')) this.hideHelpSoon(90);
    }, { passive: true });

    document.addEventListener('pointerover', e => {
      this.helpPointer = { x: e.clientX, y: e.clientY };
      const el = resolveHelp(e.clientX, e.clientY, e.target);
      if (el?.dataset?.help) this.showHelp(el.dataset.help, el);
    }, { passive: true });

    document.addEventListener('focusin', e => {
      const el = e.target?.closest?.('[data-help]');
      if (el) this.showHelp(el.dataset.help, el);
    });
    document.addEventListener('focusout', () => this.hideHelpSoon(80));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.hideHelp(); });
    window.addEventListener('resize', () => this.hideHelp(), { passive: true });
    window.addEventListener('blur', () => this.hideHelp());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.hideHelp(); });
    document.addEventListener('pointerdown', e => {
      const el = resolveHelp(e.clientX, e.clientY, e.target);
      if (!el) this.hideHelp();
    }, { passive: true });
  }

  showHelp(id, anchor = null) {
    const info = HELP[id];
    if (!info) return;
    clearTimeout(this.helpHideTimer);
    this.helpAnchor = anchor;
    this.helpVisibleId = id;
    const box = $('context-help');
    $('context-help-title').textContent = info.title;
    $('context-help-body').textContent = info.body;
    box.className = 'context-help';
    if (id.includes('mod.') || id.includes('STC') || id.includes('CRS') || id.includes('CURSED') || id.includes('overload') || id.includes('gamble')) box.classList.add('purple');
    else if (id.includes('stake') || id.includes('casino') || id.includes('BET')) box.classList.add('red');
    else if (id.includes('DASH') || id.includes('ABL') || id.includes('dash') || id.includes('SEK')) box.classList.add('cyan');
    else box.classList.add('green');
    box.style.display = 'block';
    box.classList.remove('hidden');
    this.positionHelp(anchor);
    requestAnimationFrame(() => this.positionHelp(anchor));
  }

  positionHelp(anchor = null) {
    const box = $('context-help');
    if (!box || box.classList.contains('hidden')) return;
    const activePanel = anchor?.closest?.('.panel') || anchor?.closest?.('#hud-prompt') || anchor?.closest?.('#hud-bottom') || anchor?.closest?.('#hud-top') || anchor;
    const r = activePanel?.getBoundingClientRect?.() || { left: 20, right: 20, top: window.innerHeight / 2 - 80, bottom: window.innerHeight / 2 + 80, height: 160 };
    const gap = 12;
    const margin = 14;
    box.style.right = 'auto';
    box.style.bottom = 'auto';
    box.style.transform = 'none';
    box.style.maxWidth = Math.min(320, window.innerWidth - margin * 2) + 'px';
    const bw = box.offsetWidth || 320;
    const bh = box.offsetHeight || 140;
    let left = r.right + gap;
    box.classList.remove('left-side');
    if (left + bw + margin > window.innerWidth) {
      left = r.left - bw - gap;
      box.classList.add('left-side');
    }
    if (left < margin) left = Math.min(Math.max(margin, r.left), window.innerWidth - bw - margin);
    let top = r.top + Math.max(0, (r.height - bh) / 2);
    if (top + bh + margin > window.innerHeight) top = window.innerHeight - bh - margin;
    if (top < margin) top = margin;
    box.style.left = `${Math.round(left)}px`;
    box.style.top = `${Math.round(top)}px`;
  }

  ensureHelpStillValid() {
    const box = $('context-help');
    if (!box || box.classList.contains('hidden')) return;
    let a = this.helpAnchor;
    if (!a || !document.body.contains(a) || a.closest?.('.hidden')) {
      const p = this.helpPointer || { x: -1, y: -1 };
      const fresh = document.elementFromPoint(p.x, p.y)?.closest?.('[data-help]');
      if (fresh?.dataset?.help) { this.showHelp(fresh.dataset.help, fresh); return; }
      this.hideHelp(); return;
    }
    // If the pointer is no longer on any helpable element and the anchor is not focused, do not leave stale help.
    const p = this.helpPointer || { x: -1, y: -1 };
    const hover = document.elementFromPoint(p.x, p.y)?.closest?.('[data-help]');
    if (!hover && document.activeElement !== a) { this.hideHelpSoon(80); return; }
    this.positionHelp(a);
  }

  hideHelpSoon(ms = 120) {
    clearTimeout(this.helpHideTimer);
    this.helpHideTimer = setTimeout(() => this.hideHelp(), ms);
  }

  hideHelp() {
    clearTimeout(this.helpHideTimer);
    this.helpAnchor = null;
    this.helpVisibleId = null;
    const box = $('context-help');
    if (!box) return;
    box.classList.add('hidden');
    box.style.display = '';
    box.style.left = '';
    box.style.top = '';
  }

  // ------------------------------------------------- per-frame update
  update(state, dt) {
    this.ensureHelpStillValid();
    const me = state.me();
    const room = state.room;
    if (!me || !room) return;
    for (const p of state.latest.players) this.names.set(p[P.ID], p[P.NAME]);

    // top
    $('hud-room').textContent = `${this.net.roomId || '----'} · ${room.id}`;
    $('hud-loop').textContent = `LOOP ${room.loop} / DEPTH ${room.depth}`;
    $('hud-mods').innerHTML = (room.mods || []).map(m => this.helpToken('mod.' + m, MOD_LABELS[m] || m)).join(' · ');
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
    $('hud-gld').innerHTML = `${this.helpToken('stat.GLD', 'GLD')} ${me[P.GLD]}`;
    $('hud-lvl').innerHTML = `${this.helpToken('stat.LVL', 'LVL')} ${me[P.LVL]}`;
    const inst = $('hud-install');
    if (me[P.PEND] > 0) { inst.innerHTML = `${this.helpToken('stat.INSTALL', 'INSTALL')} x${me[P.PEND]}`; inst.classList.remove('hidden'); }
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
        s.dataset.help = 'weapon.' + w;
        slots.appendChild(s);
      });
    }

    // interact prompt
    const near = state.nearestInteractable(state.pred.x, state.pred.y);
    const prompt = $('hud-prompt');
    if (near && room.phase === 'play') {
      prompt.classList.remove('hidden', 'deny');
      if (near.kind === 'portal') prompt.textContent = 'E — ВОЙТИ В ПОРТАЛ';
      else if (near.kind === 'bet') prompt.innerHTML = `E — ${this.helpToken('chest.BET', 'BET TERMINAL')}`;
      else {
        const key = 'chest.' + near.label;
        prompt.innerHTML = near.cost > 0 ? `E / ${near.cost} — ${this.helpToken(key, near.label)}` : `E — ${this.helpToken(key, near.label)}`;
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
      case 'denied': if (f.id === myId) this.denyPrompt(f.cost ? `НЕТ GLD ${f.have}/${f.cost}` : 'НЕДОСТАТОЧНО GLD'); break;
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
    this.promptTimer = setTimeout(() => { prompt.classList.add('hidden'); prompt.classList.remove('deny'); this.promptTimer = null; }, 1500);
  }

  // ------------------------------------------------- TAB panel
  setTab(visible, state) {
    const panel = $('tab-panel');
    if (!visible) { panel.classList.add('hidden'); this.hideHelp(); return; }
    panel.classList.remove('hidden');
    const room = state.room;
    if (!room || !state.latest) return;
    const modsHtml = (room.mods || []).map(m => this.helpToken('mod.' + m, MOD_LABELS[m] || m)).join(', ') || '—';
    $('tab-run').innerHTML =
      `${this.helpToken('stat.LOOP', 'LOOP')} ${room.loop} / ${this.helpToken('stat.DEPTH', 'DEPTH')} ${room.depth}   КОМНАТА ${esc(room.id)}   КОД ${esc(this.net.roomId || '----')}\n` +
      `ЗАЧИСТКА ${room.kills}/${room.quota}   МОДЫ: ${modsHtml}`;
    const t = $('tab-table');
    let html = '<tr><th>ИГРОК</th><th>' + this.helpToken('stat.HP', 'HP') + '</th><th>' + this.helpToken('stat.LVL', 'LVL') + '</th><th>' + this.helpToken('stat.GLD', 'GLD') + '</th><th>' + this.helpToken('stat.DASH', 'DASH') + '</th><th>' + this.helpToken('stat.DRN', 'DRN') + '</th><th>' + this.helpToken('stat.ORB', 'ORB') + '</th><th>' + this.helpToken('stat.INSTALL', 'INSTALL') + '</th></tr>';
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
      d.dataset.help = 'upgrade.' + id;
      d.innerHTML = `<span class="key">[${i + 1}]</span>${this.helpToken('upgrade.' + id, LABELS[id] || id)}`;
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
  closeInstall() { this.install.open = false; this.install.locked = false; $('install-modal').classList.add('hidden'); this.hideHelp(); }

  // ------------------------------------------------- casino modal
  clearReels() {
    clearTimeout(this.casino.timeout);
    this.casino.timeout = null;
    document.querySelectorAll('.reel').forEach(r => {
      if (r._iv) clearInterval(r._iv);
      r._iv = null;
      r.classList.remove('spin');
      delete r.dataset.help;
    });
  }
  openCasino() {
    this.clearReels();
    this.casino.open = true;
    this.casino.spinning = false;
    $('casino-modal').classList.remove('hidden');
    this.audio?.play('casino_open');
    $('casino-result').innerHTML = '';
    $('casino-result').title = '';
    $('casino-result').style.color = '';
    document.querySelectorAll('.reel').forEach(r => { r.textContent = '—'; r.className = 'reel'; });
  }
  closeCasino() {
    this.clearReels();
    this.casino.open = false;
    this.casino.spinning = false;
    $('casino-modal').classList.add('hidden');
    this.hideHelp();
  }
  placeBet(stake) {
    if (this.casino.spinning) return;
    this.casino.spinning = true;
    const token = ++this.casino.spinToken;
    $('casino-result').innerHTML = '';
    $('casino-result').title = '';
    $('casino-result').style.color = '';
    this.audio?.play('casino_spin');
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
          this.audio?.play('casino_tick');
          r.textContent = f.symbols[i];
          r.dataset.help = 'casino.' + f.symbols[i];
          r.classList.add(f.outcome === 'LOSE' || f.outcome === 'STC' ? 'lose' : 'win');
        } else { r.textContent = '—'; delete r.dataset.help; }
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
    this.audio?.play('denied');
    el.textContent = f.error || 'BET FAILED';
    el.title = el.textContent;
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
      const parts = [{ text: `-${f.stake} GLD`, help: 'casino.stake' }];
      if (pl.gld) parts.push({ text: `+${pl.gld} GLD`, help: 'casino.GLD' });
      if (pl.xp) parts.push({ text: `+${pl.xp} EXP`, help: 'casino.EXP' });
      if (pl.heal) parts.push({ text: `+${pl.heal} HP`, help: 'casino.HEA' });
      if (pl.dash) parts.push({ text: 'DASH +1', help: 'upgrade.dash' });
      if (pl.weaponLabel) parts.push({ text: pl.weaponLabel, help: 'weapon.' + pl.weaponLabel });
      if (pl.static) parts.push({ text: 'STATIC DEBT → СЛЕД. КОМНАТА', help: 'term.STATIC_DEBT' });
      if (f.outcome === 'JCK') parts.unshift({ text: 'JACKPOT', help: 'casino.JCK' });
      if (f.outcome === 'LOSE') parts.push({ text: 'LOSE', help: 'casino.LOSE' });
      if (pl.gld) parts.push({ text: `NET ${pl.gld - f.stake >= 0 ? '+' : ''}${pl.gld - f.stake} GLD`, help: 'term.NET' });
      el.innerHTML = parts.map(p => this.helpToken(p.help, p.text)).join(' · ');
      el.title = parts.map(p => p.text).join(' · ');
      el.style.color = f.outcome === 'LOSE' ? '#ff3048' : f.outcome === 'STC' ? '#b45cff' : '#00ff66';
      this.audio?.play(f.outcome === 'JCK' ? 'jackpot' : f.outcome === 'LOSE' ? 'casino_loss' : f.outcome === 'STC' ? 'casino_static' : 'casino_win');
    }, 760);
  }

}
