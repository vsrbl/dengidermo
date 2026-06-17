// nncckkrr HUD: bars, pips, feed, banners, TAB panel, install + casino modals
import { P, ENEMY_KINDS } from './state.v2-0-79.js';
import { UPGRADES, WEAPONS, CHESTS, ROOM_MODS, BET_STAKES, ENEMIES } from '../shared/data.v2-0-79.js';
import { t, onLangChange, cleanPlayerText, activeNoneLabel, activeNoneDesc, activeShort as locActiveShort, activeDescFrom, chestDesc, pickupDesc, enemyDesc, weaponDesc, optionDesc, locAction, locRole, locLabel, locReward, disabledReason, objectStateText, localText, esc as escHtml } from './i18n.v2-0-79.js';

const $ = id => document.getElementById(id);
const MOD_LABELS = Object.fromEntries(Object.values(ROOM_MODS).map(m => [m.id, m.label]));
const ARCH_LABELS = { panic_box: 'PANIC BOX', compact: 'COMPACT', standard: 'STANDARD', wide: 'WIDE FIELD', long_lane: 'LONG LANE', lounge: 'CASINO LOUNGE', boss: 'BOSS FLOOR' };
const nextStaticEligible = nx => !!nx && nx.cat !== 'boss' && nx.special !== 'chill_room';
function roomModLabel(m, room = null, forcedStaticLevel = 0) {
  const label = MOD_LABELS[m] || String(m || '').toUpperCase();
  if (m === 'static_rain') {
    const lvl = forcedStaticLevel || Math.max(0, room?.staticRainStacks | 0);
    return lvl > 0 ? `${label} LVL ${lvl}` : label;
  }
  return label;
}
function roomModHint(m, room = {}) {
  const mode = room.staticRainMode || '';
  const lvl = Math.max(0, room.staticRainStacks | 0);
  const hints = {
    blackout: localText('Темнота режет обзор и снижает дальнюю читаемость угроз.', 'Visibility is reduced and long-range threats are harder to read.'),
    static_rain: mode === 'paid'
      ? localText(`Static Rain LVL ${lvl}: это оплаченный долг. Удары в этой комнате НЕ копят следующий Static Rain.`, `Static Rain LVL ${lvl}: this is debt payoff. Strikes in this room do NOT seed the next Static Rain.`)
      : localText(`Static Rain LVL ${Math.max(1, lvl)}: реальные удары копят уровень следующей подходящей комнаты.`, `Static Rain LVL ${Math.max(1, lvl)}: real strikes seed the next eligible room level.`),
    greed: localText('Только золото. Урон тратит личный GLD и может увести баланс в минус.', 'Gold-only room. Damage spends personal GLD and can push your balance negative.'),
    hunter_contract: localText('Закрытая арена волн. Портал откроется только после всех hunter waves.', 'Locked wave arena. Portal opens only after all hunter waves are cleared.'),
    casino_virus: localText('Каждые 30 секунд отдельный virus-slot запускает событие. После 3 spins и зачистки откроется портал.', 'Every 30 seconds a separate virus slot fires an event. After 3 spins and cleanup, the portal opens.'),
    moving_room: localText('Двигающиеся стены с шипами могут зажать игроков и врагов.', 'Moving spiked walls can squeeze players and enemies.'),
    skin_cache: localText('В комнате спрятан скин. Пройди комнату и выйди в портал.', 'A skin is hidden here. Clear the room and leave through the portal.'),
    prism_grid: localText('Prism slow grid замедляет всех, кто стоит на клетках, примерно в 3 раза.', 'Prism slow grid slows anyone standing on the plates by roughly 3x.'),
    blood_tax: localText('Все покупки стоят HP вместо GLD. Нельзя купить ценой смерти.', 'All purchases cost HP instead of GLD. You cannot buy with lethal HP cost.'),
    echo_walls: localText('ECHO SHOTS: 50% шанс echo для всех выстрелов, включая вражеские. Echo-пули отмечены ghost-square визуалом.', 'ECHO SHOTS: 50% echo chance for all shots, including enemy shots. Echo bullets use a ghost-square visual marker.'),
    anchor_gravity: localText('Gravity sockets тянут игроков, мобов, pickups и все bullets к центрам.', 'Gravity sockets pull players, enemies, pickups, and every bullet toward centers.')
  };
  return hints[m] || localText('Особое правило комнаты меняет бой и награды.', 'A special room rule changes combat and rewards.');
}
function roomRuleSummary(room, ids = []) {
  const mods = (ids || []).filter(Boolean);
  if (!mods.length) return localText('Чистая комната: без особых правил, решает pack врагов.', 'Clean room: no special rules, enemy pack matters most.');
  return mods.slice(0, 3).map(m => roomModHint(m, room)).join(' / ');
}
function dangerLabel(room = {}) {
  const lvl = Math.max(0, Math.min(5, room.danger | 0));
  const label = room.dangerLabel || ['SAFE', 'LOW', 'MED', 'HIGH', 'SEVERE', 'BOSS'][lvl] || 'MED';
  return `DANGER ${lvl} ${label}`;
}
function tagJoin(tags = [], fallback = '—') {
  return Array.isArray(tags) && tags.length ? tags.slice(0, 4).join(' / ') : fallback;
}
function roomIntelExplain(room = {}, isNext = false) {
  const base = isNext
    ? localText('Что ждёт в следующей комнате: размер, риск, угрозы, наградный сигнал и правила.', 'What waits in the next room: size, risk, threats, reward signal, and rules.')
    : localText('Что происходит в текущей комнате: размер, риск, угрозы, наградный сигнал и правила.', 'What is happening in the current room: size, risk, threats, reward signal, and rules.');
  const threats = tagJoin(room.threatTags, localText('обычная зачистка', 'normal clear'));
  const rewards = tagJoin(room.rewardTags, localText('обычная награда', 'normal reward'));
  const rules = roomRuleSummary(room, room.mods || []);
  return `${base}
${dangerLabel(room)}
THREAT: ${threats}
REWARD: ${rewards}
RULES: ${rules}`;
}

function objectiveExplain(obj = {}) {
  if (!obj?.id) return localText('Контракт комнаты. Выполни его для бонуса, серии контрактов и записи в Tape Log.', 'Room contract. Complete it for a bonus, contract chain, and a Tape Log entry.');
  const map = {
    boss_cut: localText('Убей босса. Бонус выдаётся при переходе.', 'Kill the boss. Bonus is paid on transition.'),
    lounge_cashout: localText('Безопасная lounge-комната: покупай, ставь BET и выходи, когда готов.', 'Safe lounge room: shop, BET, and leave when ready.'),
    hunter_waves: localText('Пройди все hunter waves. Портал откроется только после последней волны.', 'Clear all hunter waves. The portal opens only after the final wave.'),
    virus_clear: localText('Переживи 3 casino-virus spins, затем зачисти мобов.', 'Survive 3 casino-virus spins, then clear remaining mobs.'),
    wire_ghost: localText('Пройди комнату, не касаясь static wires.', 'Clear the room without touching static wires.'),
    grid_slow_clear: localText('Зачисти комнату с prism slow grid. Сетка замедляет всех на ней.', 'Clear the prism slow-grid room. The grid slows everyone standing on it.'),
    blood_paid: localText('Покупки в этой комнате стоят HP вместо GLD. Очисти комнату.', 'Purchases in this room cost HP instead of GLD. Clear the room.'),
    static_clean: localText('Пройди Static Rain комнату с низким входящим уроном.', 'Clear the Static Rain room with low incoming damage.'),
    cache_claim: localText('Очисти комнату и забери SKN CACHE через портал.', 'Clear the room and claim the SKN CACHE through the portal.'),
    fast_clear: localText('Очисти комнату быстро.', 'Clear the room quickly.'),
    no_hit: localText('Очисти комнату без полученного урона.', 'Clear the room without taking damage.'),
    clean_signal: localText('Обычная цель: зачистить комнату. Маленький стабильный бонус.', 'Basic objective: clear the room. Small stable bonus.')
  };
  const status = obj.statusLabel ? `${localText('Статус', 'Status')}: ${obj.statusLabel}${obj.failReason ? ' / ' + obj.failReason : ''}` : `${localText('Статус', 'Status')}: ${localText('активен до открытия портала', 'active until portal opens')}`;
  return `${map[obj.id] || localText('Контракт комнаты.', 'Room contract.')}
${status}
${localText('Прогресс', 'Progress')}: ${obj.progress || '—'}
${localText('Награда начисляется только в ROOM CHECK после перехода.', 'Reward is shown only in ROOM CHECK after transition payout.')}
${localText('Серия контрактов растёт только после фактической выплаты; провал сбрасывает серию.', 'Contract chain grows only after actual payout; failure resets the chain.')}`;
}
function objectiveChip(obj = {}, label = 'OBJ') {
  if (!obj?.label) return '';
  const prog = obj.progress ? ` · ${obj.progress}` : '';
  const status = obj.statusLabel || (obj.status === 'planned' ? 'NEXT' : 'ACTIVE');
  const fail = obj.failReason ? ` · ${obj.failReason}` : '';
  const cls = obj.status === 'failed' ? ' danger' : (obj.status === 'done' || obj.status === 'done_pending' ? ' good' : '');
  return `<span class="term${cls}" data-explain-title="${esc(label)}: ${esc(obj.label)}" data-explain="${esc(objectiveExplain(obj))}">${esc(label)}: ${esc(obj.label)} · ${esc(status)}${esc(fail)}${esc(prog)}</span>`;
}
const rarityText = r => String(r || '').replace('superrare', 'SUPER RARE').toUpperCase();
const UPG = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
const WEAPON_BY_LABEL = Object.fromEntries(Object.values(WEAPONS).map(w => [w.label, w]));
const CHEST_BY_LABEL = Object.fromEntries(Object.entries(CHESTS).map(([id, c]) => [c.label, { id, ...c }]));
const CHEST_DESC = {
  BSC: 'Бесплатный базовый сундук: GLD/EXP и редкий HEA. Хорошая безопасная награда.',
  WPN: 'Оружейный сундук: открывает выбор из 3 вариантов — оружие, оружейные апгрейды или усиление урона/скорострельности. Апгрейды недоступного оружия серые.',
  ABL: 'Сундук способностей: Q core, улучшение core, мутации Q и мобильные side-upgrades.',
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
const esc = escHtml;


function weaponReadability(opt = {}) {
  const key = String(opt.upgrade || opt.id || opt.stat || '');
  const req = opt.reqWeapon ? String(opt.reqWeapon).toUpperCase().replace('SHOTGUN', 'SHG').replace('SEEKER', 'SEK').replace('ROCKETGUN', 'RKT') : '';
  const m = {
    weapon_seeker: {
      role: 'NEW', tone: 'new',
      ru: 'Открывает SEEKER как новый слот оружия.', en: 'Unlocks SEEKER as a new weapon slot.',
      changeRu: 'самонаводящийся снаряд · одиночное давление', changeEn: 'homing projectile · single-target pressure'
    },
    weapon_rocketgun: {
      role: 'NEW', tone: 'new',
      ru: 'Открывает ROCKETGUN как новый слот оружия.', en: 'Unlocks ROCKETGUN as a new weapon slot.',
      changeRu: 'тяжёлый взрыв · контроль зоны', changeEn: 'heavy blast · area control'
    },
    bullet_ricochet: {
      role: 'RANGE', tone: 'range',
      ru: 'Все снаряды получают дополнительный отскок.', en: 'All projectiles gain one extra wall bounce.',
      changeRu: '+1 bounce · лучше в узких комнатах', changeEn: '+1 bounce · better in tight rooms'
    },
    bullet_range: {
      role: 'RANGE', tone: 'range',
      ru: 'Снаряды живут дольше и летят дальше.', en: 'Projectiles live longer and travel farther.',
      changeRu: '+дальность / lifetime для SHG, SEK, RKT', changeEn: '+range / lifetime for SHG, SEK, RKT'
    },
    bullet_fire: {
      role: 'STATUS', tone: 'status', element: 'fire',
      ru: 'Пули накладывают burn damage-over-time.', en: 'Bullets apply burn damage-over-time.',
      changeRu: 'FIRE status · сильнее с POISON', changeEn: 'FIRE status · stronger with POISON'
    },
    bullet_freeze: {
      role: 'CONTROL', tone: 'control', element: 'freeze',
      ru: 'Пули замедляют и могут коротко freeze-lock врагов.', en: 'Bullets slow and can briefly freeze-lock enemies.',
      changeRu: 'freeze/chill · безопаснее против swarm', changeEn: 'freeze/chill · safer versus swarms'
    },
    bullet_poison: {
      role: 'STATUS', tone: 'status', element: 'poison',
      ru: 'Пули оставляют токсичный damage-over-time.', en: 'Bullets apply toxic damage-over-time.',
      changeRu: 'POISON status · хорошо против толстых целей', changeEn: 'POISON status · good versus high HP targets'
    },
    drone_element_link: {
      role: 'SYNERGY', tone: 'synergy', element: 'drone',
      ru: 'Дроны начинают переносить статусы оружия.', en: 'Drones start carrying weapon statuses.',
      changeRu: 'дроны копируют fire/freeze/poison', changeEn: 'drones copy fire/freeze/poison'
    },
    element_amp: {
      role: 'STATUS', tone: 'status',
      ru: 'Усиливает длительность и силу elemental статусов.', en: 'Improves duration and strength of elemental statuses.',
      changeRu: '+25% к статус-эффектам', changeEn: '+25% status effect strength'
    },
    element_spread: {
      role: 'STATUS', tone: 'status',
      ru: 'Статусы прыгают с убитых врагов на ближайшие цели.', en: 'Statuses jump from killed enemies to nearby targets.',
      changeRu: 'spread on kill · лучше в плотных комнатах', changeEn: 'spread on kill · better in dense rooms'
    },
    bullet_chain: {
      role: 'CONTROL', tone: 'control',
      ru: 'Попадания связывают ближайших врагов линией.', en: 'Hits link nearby enemies with a thin line.',
      changeRu: '+1 link jump · часть урона идёт дальше', changeEn: '+1 link jump · part of damage travels onward'
    },
    shg_teeth: {
      role: 'DPS', tone: 'dps',
      ru: 'SHOTGUN получает больше дробин в каждом залпе.', en: 'SHOTGUN fires more pellets per shot.',
      changeRu: '+2 pellets · больше ближнего burst', changeEn: '+2 pellets · more close burst'
    },
    shg_longshot: {
      role: 'RANGE', tone: 'range',
      ru: 'ПКМ тратит все заряды SHOTGUN на один дальний slug-выстрел.', en: 'RMB spends all SHOTGUN charges on one long slug shot.',
      changeRu: 'RMB longshot · x2 range / x1.2 dmg, дальше со стаками', changeEn: 'RMB longshot · x2 range / x1.2 dmg, scales with stacks'
    },
    sek_split: {
      role: 'DPS', tone: 'dps',
      ru: 'SEEKER kills выпускают самонаводящиеся фрагменты.', en: 'SEEKER kills release homing fragments.',
      changeRu: 'on-kill fragments · лучше chain clear', changeEn: 'on-kill fragments · better chain clear'
    },
    sek_chain: {
      role: 'CONTROL', tone: 'control',
      ru: 'SEEKER лучше держит цель и живёт дольше.', en: 'SEEKER locks on harder and lives longer.',
      changeRu: '+lock-on / lifetime', changeEn: '+lock-on / lifetime'
    },
    sek_swarm: {
      role: 'DPS', tone: 'dps',
      ru: 'ПКМ выпускает рой SEK-пуль сразу вместо одиночных выстрелов.', en: 'RMB releases a burst swarm of SEK bullets instead of single shots.',
      changeRu: '+5 swarm bullets per stack · longer cooldown', changeEn: '+5 swarm bullets per stack · longer cooldown'
    },
    rkt_cluster: {
      role: 'DPS', tone: 'dps',
      ru: 'ROCKETGUN добавляет мини-взрывы вокруг детонации.', en: 'ROCKETGUN adds mini-blasts around detonation.',
      changeRu: '+2 cluster blasts · финальный радиус обычный', changeEn: '+2 cluster blasts · normal final radius'
    },
    rkt_mines: {
      role: 'CONTROL', tone: 'control',
      ru: 'ROCKETGUN оставляет отложенные квадратные мины.', en: 'ROCKETGUN leaves delayed square mines.',
      changeRu: 'flight mines · x2 radius while rocket flies', changeEn: 'flight mines · x2 radius while rocket flies'
    },
    rkt_stun: {
      role: 'CONTROL', tone: 'control',
      ru: 'Все взрывы ROCKETGUN могут оглушать врагов.', en: 'All ROCKETGUN explosions can stun enemies.',
      changeRu: 'stun on blast · контроль толпы', changeEn: 'stun on blast · crowd control'
    },
    rkt_scatter: {
      role: 'CONTROL', tone: 'control',
      ru: 'Все взрывы ROCKETGUN разбрасывают врагов сильнее.', en: 'All ROCKETGUN explosions scatter enemies harder.',
      changeRu: 'knockback on blast · разрыв пачек', changeEn: 'knockback on blast · breaks packs apart'
    },
    rkt_remote: {
      role: 'CONTROL', tone: 'control',
      ru: 'ПКМ взрывает выпущенные ракеты по одной, начиная со старой.', en: 'RMB detonates launched rockets one by one, oldest first.',
      changeRu: 'remote detonate · sequential control', changeEn: 'remote detonate · sequential control'
    },
    wpn_dmg: {
      role: 'DPS', tone: 'dps',
      ru: 'Повышает прямой урон всего оружия.', en: 'Increases direct damage for all weapons.',
      changeRu: '+18% weapon damage · всегда работает', changeEn: '+18% weapon damage · always works'
    },
    wpn_fire: {
      role: 'DPS', tone: 'dps',
      ru: 'Ускоряет темп стрельбы всего оружия.', en: 'Increases firing tempo for all weapons.',
      changeRu: '+14% fire rate · НЕ fire-element', changeEn: '+14% fire rate · NOT fire element'
    }
  };
  const out = m[key] || {
    role: opt.kind === 'weapon' ? 'NEW' : opt.kind === 'stat' ? 'DPS' : 'UTILITY', tone: opt.kind === 'weapon' ? 'new' : 'utility',
    ru: cleanPlayerText(opt.desc || opt.preview || 'Оружейный апгрейд.'),
    en: cleanPlayerText(opt.desc || opt.preview || 'Weapon upgrade.'),
    changeRu: req ? `требует ${req}` : 'изменяет оружейный билд',
    changeEn: req ? `requires ${req}` : 'changes your weapon build'
  };
  if (req) {
    out.changeRu = `${out.changeRu} · нужно ${req}`;
    out.changeEn = `${out.changeEn} · needs ${req}`;
  }
  return { ...out, summary: localText(out.ru, out.en), change: localText(out.changeRu, out.changeEn) };
}

function weaponRoleHint(role = '') {
  const r = String(role || '').toUpperCase();
  const ru = {
    NEW: 'NEW = новый слот оружия.', DPS: 'DPS = больше урона или темпа стрельбы.', RANGE: 'RANGE = снаряды дальше живут, летят или отскакивают.', STATUS: 'STATUS = burn/freeze/poison и их распространение.', CONTROL: 'CONTROL = замедление, lock, area denial или цепи.', SYNERGY: 'SYNERGY = усиливает уже собранные элементы билда.', ECONOMY: 'ECONOMY = больше ресурсов.'
  };
  const en = {
    NEW: 'NEW = new weapon slot.', DPS: 'DPS = more damage or firing tempo.', RANGE: 'RANGE = projectiles travel, live, or bounce farther.', STATUS: 'STATUS = burn/freeze/poison and their spread.', CONTROL: 'CONTROL = slow, lock, area denial, or chains.', SYNERGY: 'SYNERGY = improves existing build pieces.', ECONOMY: 'ECONOMY = more resources.'
  };
  return localText(ru[r] || 'Категория оружейного выбора.', en[r] || 'Weapon choice category.');
}

const activeLabel = p => p?.[P.ACTIVELABEL] || activeNoneLabel();
const activeDesc = p => activeDescFrom(activeLabel(p), p?.[P.ACTIVEDESC] || activeNoneDesc());
const activeShort = p => locActiveShort(activeLabel(p));

export class Hud {
  constructor(net, audio = null) {
    this.net = net;
    this.audio = audio;
    this.feedLines = [];
    this.bannerTimer = null;
    this.promptTimer = null;
    this.activeRollTimer = null;
    this.activeRollSpin = { token: 0, timers: [], intervals: [] };
    this.wasAlive = true;
    this.casino = { open: false, spinning: false, betId: null, spinToken: 0, timeout: null, lastResultSeq: 0, reelTimers: [] };
    this.install = { open: false, choices: [], expires: 0, total: 15, locked: false };
    this.weapon = { open: false, choices: [], locked: false };
    this.ability = { open: false, choices: [], locked: false };
    this.names = new Map();

    this.initExplain();
    onLangChange(() => { this.hideTip(); });
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
    const move = (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      if (this.tipData?.source === 'dom') {
        const under = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-explain]');
        if (!under) { this.domTipActive = false; this.hideTip(); }
      }
      this.placeTip();
    };
    window.addEventListener('mousemove', move, { passive: true });
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest?.('[data-explain]');
      if (!el) return;
      this.domTipActive = true;
      this.showTip(el.dataset.explainTitle || localText('ИНФО', 'INFO'), el.dataset.explain || '', el.dataset.explainTone || '', 'dom');
    });
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest?.('[data-explain]');
      if (!el) return;
      this.domTipActive = true;
      this.showTip(el.dataset.explainTitle || localText('ИНФО', 'INFO'), el.dataset.explain || '', el.dataset.explainTone || '', 'dom');
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
    this.tipTitle.textContent = cleanPlayerText(title);
    this.tipBody.textContent = cleanPlayerText(body);
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
      if (dist2(x, y) < 38 ** 2) found = { title: `PRT / ${t('portalTitle')}`, body: open ? t('portalOpenBody') : t('portalClosedBody'), tone: open ? '' : 'red' };
    }
    if (!found) for (const o of state.latest.objects || []) {
      const [, type, label, x, y, opened, cost] = o;
      if (dist2(x, y) > 34 ** 2) continue;
      if (type === 'bet') { const bs = room?.betStakes; const blood = (room?.mods || []).includes('blood_tax'); found = { title: t('betTitle'), body: bs ? `${t('betInspect')} LOW ${bs.low} / MID ${bs.mid} / HIGH ${bs.high} ${blood ? 'HP' : 'GLD'}.` : t('betInspect'), tone: 'red' }; }
      else { const blood = (room?.mods || []).includes('blood_tax'); const costBody = opened ? objectStateText(opened, cost) : (cost > 0 && blood ? localText(`СТОИТ ${cost} HP`, `COST ${cost} HP`) : objectStateText(opened, cost)); found = { title: `${label} / ${t('chestTitle')}`, body: `${chestDesc(label)} ${costBody}`, tone: blood ? 'red' : (label === 'CRS' ? 'purple' : '') }; }
      break;
    }
    if (!found) for (const pk of state.latest.pickups || []) {
      const [, type, x, y, val] = pk;
      if (dist2(x, y) > 22 ** 2) continue;
      found = { title: `${type} +${val ?? ''}`.trim(), body: pickupDesc(type), tone: type === 'EXP' ? 'cyan' : '' };
      break;
    }
    if (!found) for (const e of state.latest.enemies || []) {
      const [, kindIdx, x, y, hp01, size, st, elite] = e;
      if (dist2(x, y) > Math.max(24, size * 0.75) ** 2) continue;
      const kind = ENEMY_KINDS[kindIdx] || 'enemy';
      const def = ENEMIES[kind] || {};
      found = { title: `${elite ? localText('ЭЛИТНЫЙ ', 'ELITE ') : ''}${def.label || kind.toUpperCase()}`, body: `${enemyDesc(kind)} ${localText('Здоровье', 'Health')} ${Math.round(hp01)}%.${elite ? ' ' + localText('Элитный: сильнее и даёт лучшую награду.', 'Elite: stronger and better reward.') : ''}${st && st !== 'move' ? ' ' + localText('Состояние', 'State') + ': ' + st + '.' : ''}`, tone: elite || kind === 'boss' ? 'red' : '' };
      break;
    }
    if (found) this.showTip(found.title, found.body, found.tone, 'inspect');
    else if (this.tipData?.source === 'inspect' && !this.domTipActive) this.hideTip();
  }

  setExplain(el, title, body, tone = '') {
    if (!el) return;
    el.dataset.explainTitle = cleanPlayerText(title);
    el.dataset.explain = cleanPlayerText(body);
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
    const aliveNow = !!me[P.ALIVE] && (me[P.HP] > 0);
    if (!aliveNow && this.wasAlive) {
      this.cancelActiveRoll();
      if (this.casino.open || this.casino.spinning) this.closeCasino();
    } else if (!aliveNow && ((this.activeRollSpin?.intervals?.length || 0) > 0 || (this.activeRollSpin?.timers?.length || 0) > 0)) {
      this.cancelActiveRoll();
    }
    this.wasAlive = aliveNow;

    // top
    $('hud-room').textContent = `${this.net.roomId || '----'} · ${room.id}`;
    $('hud-loop').textContent = `LOOP ${room.loop} / DEPTH ${room.depth}`;
    const modLabels = (room.mods || []).map(m => roomModLabel(m, room));
    $('hud-mods').textContent = modLabels.join(' · ');
    if (room.betStakes) {
      const names = { low: 'LOW', mid: 'MID', high: 'HIGH' };
      document.querySelectorAll('#casino-stakes button').forEach(btn => {
        const k = btn.dataset.stake;
        const cost = room.betStakes[k];
        if (!cost) return;
        const blood = (room.mods || []).includes('blood_tax');
        btn.innerHTML = `${names[k] || String(k).toUpperCase()}<br>${cost}${blood ? ' HP' : ' GLD'}`;
        const risk = k === 'high' ? localText('Высокий риск.', 'High risk.') : k === 'mid' ? localText('Средний риск.', 'Medium risk.') : localText('Низкий риск.', 'Low risk.');
        this.setExplain(btn, `${names[k] || String(k).toUpperCase()} BET`, `${localText('Ставка', 'Stake')} ${cost} ${blood ? 'HP' : 'GLD'}. ${risk}`, blood ? 'red' : 'red');
      });
    }
    $('hud-ping').textContent = this.net.ping ? `${this.net.ping}ms` : '';
    const obj = $('hud-objective');
    const skn = room.skinReward ? ` · <span class="term" data-explain-title="SKN CACHE" data-explain="${esc(localText('В этой комнате спрятан закрытый скин. Пройди комнату и выйди в портал, чтобы открыть его.', 'A locked skin is hidden in this room. Clear the room and enter the portal to unlock it.'))}">SKN ${rarityText(room.skinReward)}</span>` : '';
    const curRain = Math.max(0, room.staticRainStacks | 0);
    const nextRain = Math.max(0, room.staticRainNext | 0);
    const rainBits = [];
    const nx = room.next || null;
    const appliesNextRoom = nextRain > 0 && nextStaticEligible(nx);
    if ((room.mods || []).includes('static_rain') && curRain > 0) {
      const paid = room.staticRainMode === 'paid';
      rainBits.push(`<span class="term" data-explain-title="STATIC RAIN" data-explain="${esc(roomModHint('static_rain', room))}">NOW STATIC RAIN LVL ${curRain}${paid ? ' · PAID' : ''}</span>`);
    }
    if (nextRain > 0) {
      const txt = appliesNextRoom ? `NEXT ROOM STATIC RAIN LVL ${nextRain}` : `STATIC BANKED LVL ${nextRain}`;
      const body = appliesNextRoom
        ? localText('Следующая комната получит Static Rain этого уровня. После payoff-комнаты долг сгорит и не зациклится.', 'The next room gets Static Rain at this level. After the payoff room, the debt is spent and will not loop.')
        : localText('Static Rain сохранён, но ближайшая комната не подходит. Он сработает на следующей обычной комнате.', 'Static Rain is banked, but the immediate next room is not eligible. It will fire on the next normal room.');
      rainBits.push(`<span class="term" data-explain-title="NEXT STATIC RAIN" data-explain="${esc(body)}">${txt}</span>`);
    }
    const rainHud = rainBits.length ? `<div class="static-rain-status">${rainBits.join(' · ')}</div>` : '';
    const virusHud = room.casinoVirus ? `<div class="static-rain-status"><span class="term" data-explain-title="CASINO VIRUS" data-explain="${esc(roomModHint('casino_virus', room))}">VIRUS SLOT · ${Math.max(0, room.casinoVirus.spinsLeft || 0)} SPINS LEFT · NEXT ${Math.max(0, Math.ceil(room.casinoVirus.nextSpin || 0))}s${room.casinoVirus.activeRainStacks ? ' · STATIC RAIN LVL ' + room.casinoVirus.activeRainStacks : ''}</span></div>` : '';
    const currentRules = roomRuleSummary(room, room.mods || []);
    const currentThreats = tagJoin(room.threatTags, 'NORMAL CLEAR');
    const currentRewards = tagJoin(room.rewardTags, 'NORMAL REWARD');
    const currentObjective = objectiveChip(room.objective, 'CONTRACT');
    const currentHud = `<div class="room-current"><span class="term" data-explain-title="CURRENT ROOM" data-explain="${esc(roomIntelExplain(room, false))}">NOW</span>: ${esc(ARCH_LABELS[room.archetype] || String(room.archetype || 'STANDARD').toUpperCase())}${modLabels.length ? ' · ' + esc(modLabels.slice(0, 4).join(' + ')) : ' · CLEAN'}</div>` +
      `<div class="room-intel"><span class="term" data-explain-title="ROOM DANGER" data-explain="${esc(roomIntelExplain(room, false))}">${esc(dangerLabel(room))}</span> · THREAT: ${esc(currentThreats)} · REWARD: ${esc(currentRewards)}</div>` +
      (currentObjective ? `<div class="room-objective">${currentObjective}</div>` : '');
    const nextModIds = nx ? (nx.mods || []).slice(0, 5) : [];
    const nextModLabels = nx ? nextModIds.map(m => roomModLabel(m, nx, m === 'static_rain' && appliesNextRoom ? nextRain : 0)) : [];
    if (appliesNextRoom && !nextModIds.includes('static_rain')) nextModLabels.push(`STATIC RAIN LVL ${nextRain}`);
    const nextMods = nextModLabels.slice(0, 5).join(' + ');
    const nextRewards = nx?.rewardTags?.length ? ` · REWARD: ${nx.rewardTags.join(' / ')}` : '';
    const nextThreats = nx?.threatTags?.length ? ` · THREAT: ${nx.threatTags.slice(0, 3).join(' / ')}` : '';
    const nextStatic = nextRain > 0 && !appliesNextRoom ? ` · STATIC BANKED LVL ${nextRain}` : '';
    const nextObjective = nx?.objective ? ` · ${objectiveChip(nx.objective, 'CONTRACT')}` : '';
    const prophecyHud = nx ? `<div class="room-prophecy"><span class="term" data-explain-title="NEXT ROOM" data-explain="${esc(roomIntelExplain(nx, true))}">NEXT</span>: ${esc(ARCH_LABELS[nx.archetype] || String(nx.archetype || '').toUpperCase())}${nextMods ? ' · ' + esc(nextMods) : ' · CLEAN'} · ${esc(dangerLabel(nx))}${esc(nextThreats)}${esc(nextRewards)}${esc(nextStatic)}${nextObjective}</div>` : '';
    let goalHtml = '';
    if (room.phase === 'install') goalHtml = `<span class="done">${t('installPhase')}</span>`;
    else if (room.cat === 'boss') goalHtml = room.portal[2] ? `<span class="done">${t('portalOpen')} — E</span>${skn}` : `${t('killBoss')}${skn}`;
    else if (room.portal[2]) goalHtml = `<span class="done">${t('portalOpen')} — E</span>${skn}`;
    else goalHtml = `${t('clear')} ${room.kills} / ${room.quota}${skn}`;
    obj.innerHTML = `${rainHud}${virusHud}${currentHud}${prophecyHud}<div>${goalHtml}</div>`;

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
        this.setExplain(d, t('dashChargeTitle'), i < me[P.DASH] ? t('dashReady') : t('dashEmpty'), 'cyan');
        pips.appendChild(d);
      }
      if (me[P.DASHMAX] > 14) pips.append(` x${me[P.DASHMAX]}`);
    }

    const acd = me[P.ACTIVECD] || 0;
    const qName = activeLabel(me);
    const qTxt = qName === activeNoneLabel() || qName === 'НЕТ АКТИВКИ' || qName === 'NO ACTIVE'
      ? t('qNoneLong')
      : (acd > 0 ? `${t('qCd')} ${acd.toFixed ? acd.toFixed(1) : acd}` : (me[P.ACTIVEBUFF] ? t('qOver') : activeShort(me)));
    const lvlEl = $('hud-lvl');
    lvlEl.textContent = `LVL ${me[P.LVL]} · ${qTxt}`;
    this.setExplain(lvlEl, t('activeQTitle'), `${activeLabel(me)}. ${activeDesc(me)}${qName !== activeNoneLabel() && qName !== 'НЕТ АКТИВКИ' && qName !== 'NO ACTIVE' ? ' ' + t('activeQUse') : ''}`, qName === activeNoneLabel() || qName === 'НЕТ АКТИВКИ' || qName === 'NO ACTIVE' ? '' : 'cyan');

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
        const desc = weaponDesc(wd, me[P.SHG] ?? 4);
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
        prompt.textContent = t('portalPrompt');
        this.setExplain(prompt, t('portalTitle'), t('portalOpenBody'), '');
      } else if (near.kind === 'bet') {
        prompt.textContent = t('betPrompt');
        this.setExplain(prompt, t('betTitle'), t('betInspect'), 'red');
      } else {
        const blood = (room.mods || []).includes('blood_tax');
        prompt.textContent = near.cost > 0 ? `E / ${near.cost}${blood ? ' HP' : ''} — ${near.label}` : `E — ${near.label}`;
        const costTxt = near.cost > 0 ? (blood ? localText(`Нужно ${near.cost} HP.`, `Need ${near.cost} HP.`) : t('chestNeed', { cost: near.cost })) : t('chestFree');
        this.setExplain(prompt, `${near.label} / ${t('chestTitle')}`, `${chestDesc(near.label)} ${costTxt}`, blood ? 'red' : (near.label === 'CRS' ? 'purple' : '')); 
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
    const name = id => id === myId ? t('you') : (this.names.get(id) || '??');
    switch (f.t) {
      case 'room': {
        const mods = (f.mods || []).map(m => MOD_LABELS[m] || m).join(' + ');
        const skn = f.skinRarity ? ` · SKN ${rarityText(f.skinRarity)}` : '';
        const arch = f.archetype ? ` · ${ARCH_LABELS[f.archetype] || String(f.archetype).toUpperCase()}` : '';
        const danger = `DANGER ${Math.max(0, f.danger | 0)} ${f.dangerLabel || ''}`.trim();
        const threats = Array.isArray(f.threatTags) && f.threatTags.length ? ` · THREAT ${f.threatTags.slice(0, 3).join('/')}` : '';
        const rewards = Array.isArray(f.rewardTags) && f.rewardTags.length ? ` · REWARD ${f.rewardTags.slice(0, 3).join('/')}` : '';
        this.banner(f.cat === 'boss' ? t('bossFloor') : `${f.roomId}`, `${t('loop')} ${f.loop} · ${t('depth')} ${f.depth}${arch}${mods ? ' · ' + mods : ''} · ${danger}${threats}${rewards}${skn}`,
          f.cat === 'boss' || (f.danger | 0) >= 4 ? 'red' : (f.skinRarity ? 'purple' : (mods ? 'purple' : '')));
        if (f.skinRarity) this.feed(`SKN CACHE: ${rarityText(f.skinRarity)} / ${t('portalNext')}`, 'p');
        this.cancelActiveRoll(); this.closeCasino(); this.closeWeaponChest(); this.closeAbilityChest();
        break;
      }
      case 'room_invoice': {
        const marks = [];
        if (f.noHit) marks.push('NO HIT');
        if (f.fast) marks.push('FAST');
        if (f.staticPaid) marks.push('STATIC PAID');
        if (f.nextStatic) marks.push(`NEXT STATIC LVL ${f.nextStatic}`);
        if (f.bonusGld) marks.push(`BONUS GLD +${f.bonusGld}`);
        if (f.bonusExp) marks.push(`BONUS EXP +${f.bonusExp}`);
        if (f.objective) {
          if (f.objective.done) marks.push(`CONTRACT PAID ${f.objective.label} +${f.objectiveBonusGld || 0}G +${f.objectiveBonusExp || 0}XP`);
          else marks.push(`CONTRACT FAILED ${f.objective.label}${f.objective.failReason ? ' / ' + f.objective.failReason : ''}`);
        }
        if (f.contractChain >= 2) marks.push(`CHAIN PAID x${f.contractChain} +${f.contractBonusGld || 0}G +${f.contractBonusExp || 0}XP`);
        const tapes = Array.isArray(f.tapes) && f.tapes.length ? ` · TAPE: ${f.tapes.join(' / ')}` : '';
        const solved = Number.isFinite(Number(f.solvedTime)) ? ` · SOLVED ${Math.max(0, Math.round(Number(f.solvedTime)))}s` : '';
        const line = `KILLS ${f.kills || 0}${solved} · GLD +${f.gld || 0} · EXP +${f.exp || 0} · DMG ${f.dmg || 0}${marks.length ? ' · ' + marks.join(' / ') : ''}${tapes}`;
        this.banner('ROOM CHECK', line, f.noHit || f.fast ? 'green' : '');
        this.feed(`ROOM CHECK: ${line}`, f.noHit ? 'g' : '');
        break;
      }
      case 'join': this.feed(`${f.name} ${t('playerJoined')}`, 'g'); break;
      case 'leave': this.feed(`${f.name} ${t('playerLeft')}`, 'r'); break;
      case 'levelup':
        if (f.id === myId) this.feed(`LEVEL UP → ${f.level} · INSTALL x${f.pending}`, 'g');
        break;
      case 'pdown': this.feed(`${name(f.id)} ${t('down')}`, 'r'); if (f.id === myId) { this.cancelActiveRoll(); this.closeCasino(); this.banner(t('youDown'), t('carry'), 'red'); } break;
      case 'director_room':
        this.feed(`${t('eventSignal')}: ${localText('новая угроза', 'new threat')}`, 'c');
        break;
      case 'gld_hit': if (f.id === myId) { this.feed(`GREED HIT -${f.cost || 0} GLD · BAL ${f.balance ?? 0}`, 'r'); } break;
      case 'casino_virus_spin': this.banner('CASINO VIRUS', `${f.label || 'VIRUS EVENT'} · ${f.spinsLeft || 0} SPINS LEFT`, 'purple'); this.feed(`CASINO VIRUS: ${f.label || 'EVENT'} · ${f.spinsLeft || 0} SPINS LEFT`, 'p'); break;
      case 'director_wave':
        this.feed(`${f.label || 'WAVE'} · ${f.count || 0}`, f.intent === 'armor' ? 'p' : (f.intent === 'ranged' || f.intent === 'control' ? 'c' : 'r'));
        break;
      case 'skin_room': this.feed(`${t('skinHidden')} · ${rarityText(f.skinRarity)}`, 'p'); break;
      case 'skin_room_ready': this.banner(t('skinReady'), `${t('portalNext')} · ${rarityText(f.skinRarity)}`, 'purple'); this.feed(`${t('skinReady')} · ${rarityText(f.skinRarity)}`, 'p'); break;
      case 'portal_open': this.banner(t('portalOpen'), f.skinRarity ? `${t('portalTake')} ${rarityText(f.skinRarity)}` : t('portalNext'), f.skinRarity ? 'purple' : 'green'); this.feed(f.skinRarity ? `${t('portalOpen')} · SKN ${rarityText(f.skinRarity)}` : t('portalOpen'), f.skinRarity ? 'p' : 'g'); break;
      case 'boss_down': this.banner(t('bossDown'), t('loot'), 'green'); break;
      case 'chest_open':
        if (f.id === myId) this.feed(`${locLabel(f.chest)}: ${(f.rewards || []).map(locReward).join(' + ')}`, f.cursed ? 'p' : 'g');
        break;
      case 'weapon_get': this.feed(`${name(f.id)} ${localText('ВЗЯЛ', 'TOOK')} ${f.w}`, 'c'); break;
      case 'weapon_mod': if (f.id === myId) this.feed(`WPN: ${f.label}`, 'c'); break;
      case 'ability_get': if (f.id === myId) this.feed(locLabel(f.label), 'c'); break;
      case 'active': if (f.id === myId) this.feed(`Q: ${locLabel(f.label)}`, 'c'); break;
      case 'active_denied': if (f.id === myId) { this.denyPrompt(t('qNoneLong')); this.feed(`Q: ${t('noActive')}`, 'r'); } break;
      case 'contract': this.banner(f.label || t('contract'), t('contractBody'), 'red'); break;
      case 'contract_done': this.banner(t('contractDone'), `${f.label || ''}${f.body ? ' · ' + f.body : ''}`, 'green'); break;
      case 'contract_paid': this.banner(t('contractPaid'), `${f.label || ''}${f.body ? ' · ' + f.body : ''}`, 'green'); break;
      case 'contract_fail': this.banner(t('contractFail'), `${f.label || ''}${f.body ? ' · ' + f.body : ''}`, 'red'); break;
      case 'denied': if (f.id === myId) this.denyPrompt(f.cost ? `${f.hpCost ? 'NO HP' : 'NO GLD'} ${f.have}/${f.cost}` : t('gldLack')); break;
      case 'bet_ui': if (f.id === myId) this.openCasino(); break;
      case 'casino': this.casinoResult(f, myId); break;
      case 'active_casino_roll': if (f.id === myId) this.activeRoll(f); break;
      case 'install': if (f.id === myId) this.feed(`INSTALL: ${locLabel(f.label)}`, f.cursed ? 'p' : 'g'); break;
      case 'transition': this.cancelActiveRoll(); this.banner(t('installPhase'), t('installPhaseSub'), 'green'); break;
      case 'run_lost':
        this.banner(t('runLost'), `${t('loop')} ${f.loop} · ${t('depth')} ${f.depth} — ${t('restart')}`, 'red');
        this.cancelActiveRoll(); this.closeInstall(); this.closeCasino(); this.closeWeaponChest(); this.closeAbilityChest();
        break;
    }
  }

  feed(text, cls = '') {
    const el = document.createElement('div');
    if (cls) el.className = cls;
    el.textContent = text;
    const feed = $('feed');
    feed.prepend(el);
    while (feed.children.length > 5) feed.lastChild.remove();
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

  clearActiveRollSpin() {
    const st = this.activeRollSpin || { timers: [], intervals: [], token: 0 };
    for (const t of st.timers || []) clearTimeout(t);
    for (const iv of st.intervals || []) clearInterval(iv);
    this.activeRollSpin = { token: (st.token || 0) + 1, timers: [], intervals: [] };
  }

  cancelActiveRoll() {
    clearTimeout(this.activeRollTimer);
    this.activeRollTimer = null;
    this.clearActiveRollSpin();
    const el = $('active-roll');
    if (el) { el.className = 'hidden'; el.innerHTML = ''; }
  }

  activeRoll(f) {
    if (!this.wasAlive) { this.cancelActiveRoll(); return; }
    const el = $('active-roll');
    if (!el) return;
    const tone = f.tone === 'red' ? 'red' : f.tone === 'purple' ? 'purple' : f.tone === 'cyan' ? 'cyan' : '';
    const casinoSymbols = ['Q', 'GLD', 'EXP', 'HEA', 'DMG', 'STC', 'COPY', '10', 'PAY', 'BAD'];
    clearTimeout(this.activeRollTimer);

    if (f.phase === 'spin') {
      this.clearActiveRollSpin();
      const token = this.activeRollSpin.token;
      el.className = `${tone} spinning`;
      el.innerHTML = `<div class="roll-title">CASINO MUTATION ROLL</div>` +
        `<div class="roll-symbols"><span>—</span><span>—</span><span>—</span></div>` +
        `<div class="roll-result">${localText('КРУТИТСЯ...', 'ROLLING...')}</div>`;
      el.classList.remove('hidden');
      const spans = [...el.querySelectorAll('.roll-symbols span')];
      spans.forEach((sp, i) => {
        const iv = setInterval(() => {
          sp.textContent = casinoSymbols[Math.floor(Math.random() * casinoSymbols.length)];
          if (i === 0) this.playUiSound('casino_spin');
        }, 64 + i * 8);
        this.activeRollSpin.intervals.push(iv);
      });
      this.activeRollTimer = setTimeout(() => { if (this.activeRollSpin.token === token) el.classList.add('hidden'); }, 3200);
      return;
    }

    const prevToken = this.activeRollSpin?.token || 0;
    const oldIntervals = [...(this.activeRollSpin?.intervals || [])];
    const oldTimers = [...(this.activeRollSpin?.timers || [])];
    oldTimers.forEach(t => clearTimeout(t));
    this.activeRollSpin = { token: prevToken + 1, timers: [], intervals: oldIntervals };
    const token = this.activeRollSpin.token;
    const symbols = Array.isArray(f.symbols) && f.symbols.length ? f.symbols.slice(0, 3) : ['Q', '?', '?'];
    if (!el.querySelector('.roll-symbols span')) {
      el.innerHTML = `<div class="roll-title">CASINO MUTATION ROLL</div>` +
        `<div class="roll-symbols"><span>?</span><span>?</span><span>?</span></div>` +
        `<div class="roll-result">${localText('КРУТИТСЯ...', 'ROLLING...')}</div>`;
    }
    el.className = `${tone} stopping`;
    el.classList.remove('hidden');
    const spans = [...el.querySelectorAll('.roll-symbols span')];
    spans.forEach((sp, i) => {
      const timer = setTimeout(() => {
        if (this.activeRollSpin.token !== token) return;
        const iv = this.activeRollSpin.intervals[i];
        if (iv) clearInterval(iv);
        sp.textContent = esc(String(symbols[i] || '?').slice(0, 4));
        sp.classList.add(f.outcome === 'HIT' || f.outcome === 'DEBT' ? 'lose' : 'win');
        this.playUiSound('casino_reel_stop');
        if (i === 2) {
          this.activeRollSpin.intervals.forEach(x => clearInterval(x));
          this.activeRollSpin.intervals = [];
          const res = el.querySelector('.roll-result');
          if (res) res.textContent = f.label || f.outcome || 'ROLL';
          this.feed(`CASINO MUTATION: ${f.label || f.outcome || 'ROLL'}`, tone === 'red' ? 'r' : tone === 'purple' ? 'p' : 'g');
          this.playUiSound(f.outcome === 'HIT' || f.outcome === 'DEBT' ? 'casino_static' : f.outcome === 'TEN' ? 'jackpot' : 'casino_ability');
          this.activeRollTimer = setTimeout(() => el.classList.add('hidden'), 1550);
        }
      }, 180 * (i + 1));
      this.activeRollSpin.timers.push(timer);
    });
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
    const modLabels = (room.mods || []).map(m => roomModLabel(m, room));
    const tabStatic = room.staticRainNext > 0
      ? (nextStaticEligible(room.next) ? `   NEXT ROOM STATIC RAIN LVL ${esc(room.staticRainNext)}` : `   STATIC BANKED LVL ${esc(room.staticRainNext)}`)
      : '';
    const next = room.next || null;
    const explainAttr = (title, body, tone = '') => `data-explain-title="${esc(title)}" data-explain="${esc(body)}"${tone ? ` data-explain-tone="${tone}"` : ''}`;
    const modChip = (m, r = room) => `<span class="term" ${explainAttr(roomModLabel(m, r), roomModHint(m, r), m === 'static_rain' || m === 'prism_grid' ? 'cyan' : m === 'blood_tax' || m === 'moving_room' || m === 'hunter_contract' ? 'red' : m === 'echo_walls' || m === 'anchor_gravity' || m === 'casino_virus' ? 'purple' : m === 'greed' ? 'gold' : '')}>${esc(roomModLabel(m, r))}</span>`;
    const modList = (r) => (r?.mods || []).length ? (r.mods || []).map(m => modChip(m, r)).join(' ') : `<span class="muted">CLEAN</span>`;
    const currentRules = roomRuleSummary(room, room.mods || []);
    const nextRules = next ? roomRuleSummary(next, next.mods || []) : '—';
    const nextStaticLine = room.staticRainNext > 0
      ? (nextStaticEligible(room.next) ? `NEXT STATIC LVL ${room.staticRainNext}` : `STATIC BANKED LVL ${room.staticRainNext}`)
      : '—';
    const portalState = room.portal?.[2] ? localText('ОТКРЫТ', 'OPEN') : localText('ЗАКРЫТ', 'CLOSED');
    const mem = room.runMemory || {};
    const tapes = Array.isArray(room.tapeLog) ? room.tapeLog.slice(0, 6) : [];
    const tapeRows = tapes.length
      ? tapes.map(x => `<p class="tape-row"><span class="term" ${explainAttr('TAPE', localText('Памятная запись за этот забег: чистая комната, быстрый клир, особый модификатор или редкая награда.', 'Run memory entry: clean room, fast clear, special modifier, or rare reward.'), x.tone || '')}>${esc(x.label || x)}</span> <span class="muted">D${esc(String(x.depth ?? ''))}</span></p>`).join('')
      : `<p class="muted">${esc(localText('Пока нет записей.', 'No tapes yet.'))}</p>`;
    $('tab-run').innerHTML =
      `<div class="tab-dossier">` +
        `<div class="tab-card current"><h3><span class="term" ${explainAttr('CURRENT ROOM', roomIntelExplain(room, false), 'cyan')}>NOW</span> ${esc(ARCH_LABELS[room.archetype] || String(room.archetype || 'STANDARD').toUpperCase())}</h3>` +
          `<div>${modList(room)}</div>` +
          `<p><span class="term" ${explainAttr('DANGER', roomIntelExplain(room, false), 'red')}>${esc(dangerLabel(room))}</span></p>` +
          `<p>THREAT: ${esc(tagJoin(room.threatTags, 'NORMAL'))}</p>` +
          `<p>REWARD: ${esc(tagJoin(room.rewardTags, 'NORMAL'))}</p>` +
          (room.objective ? `<p>${objectiveChip(room.objective, 'CONTRACT')}</p>` : '') +
          `<p class="rules"><span class="term" ${explainAttr(t('rules'), currentRules, 'purple')}>${esc(t('rules'))}</span>: ${esc(currentRules)}</p></div>` +
        `<div class="tab-card next"><h3><span class="term" ${explainAttr('NEXT ROOM', next ? roomIntelExplain(next, true) : '—', 'cyan')}>NEXT</span> ${next ? esc(ARCH_LABELS[next.archetype] || String(next.archetype || 'STANDARD').toUpperCase()) : '—'}</h3>` +
          `<div>${next ? modList(next) : '<span class="muted">—</span>'}</div>` +
          `<p>${next ? esc(dangerLabel(next)) : 'DANGER —'}</p>` +
          `<p>THREAT: ${next ? esc(tagJoin(next.threatTags, 'NORMAL')) : '—'}</p>` +
          `<p>REWARD: ${next ? esc(tagJoin(next.rewardTags, 'NORMAL')) : '—'}</p>` +
          (next?.objective ? `<p>${objectiveChip(next.objective, 'CONTRACT')}</p>` : '') +
          `<p class="rules"><span class="term" ${explainAttr('NEXT RULES', nextRules, 'purple')}>${esc(t('rules'))}</span>: ${esc(nextRules)}</p></div>` +
        `<div class="tab-card run"><h3>RUN</h3>` +
          `<p><span class="term" ${explainAttr(t('loopTitle'), t('loopBody'))}>${esc(t('loop'))}</span> ${room.loop} · <span class="term" ${explainAttr(t('depth'), localText('Сколько комнат уже пройдено в текущем забеге.', 'Rooms cleared in this run.'))}>${esc(t('depth'))}</span> ${room.depth}</p>` +
          `<p><span class="term" ${explainAttr(t('room'), t('roomBody'))}>${esc(t('room'))}</span> ${esc(room.id)} · <span class="term" ${explainAttr(t('code'), t('codeBody'))}>${esc(t('code'))}</span> ${esc(this.net.roomId || '----')}</p>` +
          `<p><span class="term" ${explainAttr(t('goal'), localText('Прогресс зачистки. После выполнения цели открывается портал.', 'Clear progress. Portal opens when the objective is done.'))}>${esc(t('clear'))}</span> ${room.kills}/${room.quota} · PORTAL ${esc(portalState)}</p>` +
          `<p><span class="term" ${explainAttr('STATIC RAIN', localText('Static Rain debt and current-room payoff state.', 'Static Rain debt and current-room payoff state.'), 'cyan')}>STATIC</span> ${esc(nextStaticLine)}${room.staticRainStacks ? ` · NOW LVL ${esc(room.staticRainStacks)}` : ''}</p>` +
          `${room.skinReward ? `<p>SKN CACHE: ${esc(rarityText(room.skinReward))}</p>` : ''}` +
          `<p><span class="term" ${explainAttr('SKIN PITY', localText('Чем выше число, тем сильнее игра подталкивает следующий SKN CACHE.', 'Higher value means the run is pushing the next SKN CACHE harder.'))}>SKIN PITY</span> ${esc(room.skinPity || 0)}/8</p></div>` +
        `<div class="tab-card memory"><h3><span class="term" ${explainAttr('RUN MEMORY', localText('Сводка по текущему забегу: зачистки, streaks и накопленные награды.', 'Current run summary: clears, streaks, and accumulated rewards.'), 'green')}>RUN MEMORY</span></h3>` +
          `<p>ROOMS ${esc(mem.roomsCleared || 0)} · KILLS ${esc(mem.totalKills || 0)}</p>` +
          `<p>GLD +${esc(Math.round(mem.totalGld || 0))} · EXP +${esc(Math.round(mem.totalExp || 0))}</p>` +
          `<p>NO HIT ${esc(mem.noHitStreak || 0)} / BEST ${esc(mem.bestNoHitStreak || 0)}</p>` +
          `<p>FAST ${esc(mem.fastStreak || 0)} / BEST ${esc(mem.bestFastStreak || 0)}</p>` +
          `<p>STATIC PAID ${esc(mem.staticPaid || 0)} · SKN ROOMS ${esc(mem.skinRoomsSeen || 0)}</p>` +
          `<p><span class="term" ${explainAttr('CONTRACT CHAIN', localText('Подряд выполненные контракты комнат. Провал контракта сбрасывает серию.', 'Consecutive completed room contracts. Failing a contract resets the chain.'), 'gold')}>CONTRACT CHAIN</span> x${esc(mem.contractStreak || 0)} / BEST x${esc(mem.bestContractStreak || 0)}</p>` +
          `<p>CONTRACTS ${esc(mem.objectivesDone || 0)}/${esc(mem.objectivesSeen || 0)} · +${esc(Math.round((mem.objectiveGld || 0) + (mem.contractGld || 0)))} GLD · +${esc(Math.round((mem.objectiveExp || 0) + (mem.contractExp || 0)))} EXP</p></div>` +
        `<div class="tab-card tapes"><h3><span class="term" ${explainAttr('TAPE LOG', localText('Последние значимые записи текущего забега. Они не мешают HUD и живут в TAB.', 'Recent meaningful run records. They stay in TAB instead of cluttering combat HUD.'), 'purple')}>TAPE LOG</span></h3>${tapeRows}</div>` +
      `</div>`;
    const table = $('tab-table');
    let html = '<tr>' +
      `<th><span class="term" data-explain-title="${esc(t('player'))}" data-explain="${esc(t('nameBody'))}">${esc(t('player'))}</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('health'))}" data-explain="${esc(t('hpBody'))}">HP</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('level'))}" data-explain="${esc(t('lvlBody'))}">LVL</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('money'))}" data-explain="${esc(t('gldBody'))}">GLD</span></th>` +
      `<th><span class="term" data-explain-title="EXP" data-explain="${esc(t('xpBody'))}">EXP</span></th>` +
      `<th><span class="term" data-explain-title="SPD" data-explain="${esc(localText('Текущая скорость движения игрока.', 'Current player movement speed.'))}">SPD</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('dash').toUpperCase())}" data-explain="${esc(t('dashReady'))}">DASH</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('drones'))}" data-explain="${esc(localText('Автостреляющие спутники игрока.', 'Auto-firing player drones.'))}">DRN</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('orbitals'))}" data-explain="${esc(localText('Орбитальные спутники с контактным уроном.', 'Orbiting satellites with contact damage.'))}">ORB</span></th>` +
      `<th><span class="term" data-explain-title="WPN" data-explain="${esc(localText('Оружие игрока. Активный слот помечен звёздочкой.', 'Player weapons. Active slot is marked with an asterisk.'))}">WPN</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('qAbility'))}" data-explain="${esc(t('activeQTitle'))}">Q</span></th>` +
      `<th><span class="term" data-explain-title="SKIN" data-explain="${esc(localText('Текущий скин игрока.', 'Current player skin.'))}">SKIN</span></th>` +
      `<th><span class="term" data-explain-title="INSTALL" data-explain="${esc(t('installBody'))}">INSTALL</span></th>` +
      '</tr>';
    for (const p of state.latest.players) {
      const cls = p[P.ID] === state.myId ? 'me' : (!p[P.ALIVE] ? 'dead' : '');
      const qTitle = esc(activeLabel(p));
      const qBody = esc(activeDesc(p));
      const qCell = `<span class="term" data-explain-title="${qTitle}" data-explain="${qBody}">${qTitle}</span>`;
      const weaponNames = (p[P.WEAPONS] || []).map((w, i) => `${i === p[P.WIDX] ? '*' : ''}${WEAPONS[w]?.label || w}`).join('/');
      html += `<tr class="${cls}"><td>${esc(p[P.NAME])}</td><td>${p[P.ALIVE] ? p[P.HP] + '/' + p[P.MAXHP] : t('eliminated')}</td>` +
        `<td>${p[P.LVL]}</td><td>${p[P.GLD]}</td><td>${p[P.XP]}/${p[P.NEXTXP]}</td><td>${Math.round(p[P.SPD] || 0)}</td><td>${p[P.DASH]}/${p[P.DASHMAX]}</td>` +
        `<td>${p[P.DRONES]}</td><td>${p[P.ORBITALS]}</td><td>${esc(weaponNames || '—')}</td><td>${qCell}</td><td>${esc(p[P.SKINID] || '—')}</td><td>${p[P.PEND] > 0 ? 'x' + p[P.PEND] : '—'}</td></tr>`;
    }
    table.innerHTML = html;
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
      d.innerHTML = `<span class="key">[${i + 1}]</span>${esc(locLabel(u?.label || id))}`;
      this.setExplain(d, locLabel(u?.label || id), optionDesc(u || { id }), u?.cursed ? 'purple' : (u?.branch === 'Q' || u?.branch === 'DASH' ? 'cyan' : ''));
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
  pickRandomInstall() {
    if (!this.install.open || this.install.locked || !this.install.choices.length) return false;
    this.pick(Math.floor(Math.random() * this.install.choices.length));
    return true;
  }
  closeInstall() { this.install.open = false; this.install.locked = false; $('install-modal').classList.add('hidden'); this.hideTip(); }

  // ------------------------------------------------- WPN chest modal
  openWeaponChest(choices = []) {
    this.weapon = { open: true, choices, locked: false };
    const box = $('weapon-choices');
    box.innerHTML = '';
    choices.forEach((opt, i) => {
      const d = document.createElement('div');
      const meta = weaponReadability(opt);
      d.className = `choice weapon-choice tone-${meta.tone || 'utility'}` + (opt.disabled ? ' disabled' : '');
      const locked = opt.disabled ? `<span class="lock">${esc(disabledReason(opt.disabledReason))}</span>` : '';
      // Element tag is only for real elemental bullet upgrades. `wpn_fire` is fire-rate, not FIRE element.
      const upKey = String(opt.upgrade || opt.id || '');
      const elementClass = meta.element || (upKey === 'bullet_fire' ? 'fire' : upKey === 'bullet_freeze' ? 'freeze' : upKey === 'bullet_poison' ? 'poison' : upKey === 'drone_element_link' ? 'drone' : '');
      const elementTag = elementClass ? `<span class="wpn-tag element ${elementClass}">${elementClass.toUpperCase()}</span>` : '';
      const roleTag = `<span class="wpn-role ${meta.tone || 'utility'}">${esc(meta.role)}</span>`;
      d.innerHTML = `
        <div class="wpn-choice-top"><span><span class="key">[${i + 1}]</span>${esc(locLabel(opt.label || opt.id))}</span><span class="wpn-tags">${roleTag}${elementTag}</span>${locked}</div>
        <span class="wpn-choice-read">${esc(meta.summary)}</span>
        <span class="wpn-choice-change">${esc(meta.change)}</span>`;
      const title = opt.disabled ? `${locLabel(opt.label || opt.id)} / ${t('unavailable').toUpperCase()}` : `${locLabel(opt.label || opt.id)} · ${meta.role}`;
      const body = `${weaponRoleHint(meta.role)} ${meta.summary} ${meta.change}. ${optionDesc(opt)} ${opt.disabled ? `${t('unavailable')}: ${disabledReason(opt.disabledReason)}.` : t('available')}`;
      this.setExplain(d, title, body, opt.disabled ? 'red' : (meta.tone === 'dps' ? 'green' : 'cyan'));
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
  pickRandomWeapon() {
    if (!this.weapon.open || this.weapon.locked || !this.weapon.choices.length) return false;
    const valid = this.weapon.choices.map((o, i) => ({ o, i })).filter(x => x.o && !x.o.disabled);
    const pool = valid.length ? valid : this.weapon.choices.map((o, i) => ({ o, i }));
    this.pickWeapon(pool[Math.floor(Math.random() * pool.length)].i);
    return true;
  }
  closeWeaponChest() { this.weapon.open = false; this.weapon.locked = false; $('weapon-modal').classList.add('hidden'); this.hideTip(); }

  // ------------------------------------------------- ABL chest modal
  openAbilityChest(choices = []) {
    this.ability = { open: true, choices, locked: false };
    const box = $('ability-choices');
    box.innerHTML = '';
    choices.forEach((opt, i) => {
      const d = document.createElement('div');
      const group = opt.group || (String(opt.kind || '').includes('mutation') ? 'MUTATION' : String(opt.kind || '').includes('core') ? 'CORE' : 'SIDE');
      const rarity = opt.rarity || opt.tone || (String(opt.actionLabel || '').includes('ЗАМЕНИТ') ? 'rare' : group.toLowerCase());
      const tone = opt.disabled ? 'red' : (opt.tone || (rarity === 'cursed' ? 'red' : rarity === 'rare' ? 'purple' : group === 'CORE' ? 'cyan' : 'green'));
      d.className = 'choice ability-choice ability-card' + (opt.disabled ? ' disabled' : '') + ` tone-${tone} rarity-${rarity}`;
      const locked = opt.disabled ? `<span class="lock">${esc(disabledReason(opt.disabledReason))}</span>` : '';
      const role = opt.role ? `<span class="abl-role">${esc(locRole(opt.role))}</span>` : '';
      const action = opt.actionLabel ? `<div class="abl-action">${esc(locAction(opt.actionLabel))}</div>` : '';
      d.innerHTML = `
        <div class="abl-card-top">
          <span class="key abl-key">[${i + 1}]</span>
          <div class="abl-title-wrap">
            <div class="abl-name">${esc(locLabel(opt.label || opt.id))}</div>
            ${action}
          </div>
          <div class="abl-tags"><span class="rarity-tag">${esc(String(group).toUpperCase())}</span>${role}${locked}</div>
        </div>`;
      const title = opt.disabled ? `${locLabel(opt.label || opt.id)} / ${t('unavailable').toUpperCase()}` : `${locLabel(opt.label || opt.id)} / ${String(group).toUpperCase()}`;
      const body = `${opt.actionLabel ? locAction(opt.actionLabel) + ': ' : ''}${optionDesc(opt)}${opt.disabled ? `\n\n${t('unavailable')}: ${disabledReason(opt.disabledReason)}.` : '\n\n' + t('available')}`;
      this.setExplain(d, title, body, opt.disabled ? 'red' : tone);
      d.addEventListener('click', () => {
        if (opt.disabled) { this.playUiSound('denied'); return; }
        this.pickAbility(i);
      });
      box.appendChild(d);
    });
    $('ability-modal').classList.remove('hidden');
    this.playUiSound('chest_ability');
  }
  pickAbility(i) {
    if (this.ability.locked || !this.ability.open) return;
    const opt = this.ability.choices[i];
    if (!opt || opt.disabled) { this.playUiSound('denied'); return; }
    this.ability.locked = true;
    const els = document.querySelectorAll('#ability-choices .choice');
    els.forEach((el, j) => el.classList.add(j === i ? 'picked' : 'dimmed'));
    this.net.sendAbilityPick(i);
  }
  pickRandomAbility() {
    if (!this.ability.open || this.ability.locked || !this.ability.choices.length) return false;
    const valid = this.ability.choices.map((o, i) => ({ o, i })).filter(x => x.o && !x.o.disabled);
    const pool = valid.length ? valid : this.ability.choices.map((o, i) => ({ o, i }));
    this.pickAbility(pool[Math.floor(Math.random() * pool.length)].i);
    return true;
  }
  closeAbilityChest() { this.ability.open = false; this.ability.locked = false; $('ability-modal').classList.add('hidden'); this.hideTip(); }

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
    this.hideTip();
  }
  placeBet(stake) {
    if (this.casino.spinning || !this.casino.open) return;
    this.clearReels();
    this.casino.spinning = true;
    this.setCasinoButtons(true);
    const token = ++this.casino.spinToken;
    $('casino-result').textContent = '';
    $('casino-result').style.color = '';
    const syms = ['GLD', 'HEA', 'EXP', 'WPN', 'ABL', 'SKN', 'STC', 'JCK'];
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
        el.textContent = t('noResponse');
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
      const timer = setTimeout(() => {
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
      this.casino.reelTimers.push(timer);
    });
  }
  casinoDenied(f) {
    if (!this.casino.open) this.openCasino();
    this.playUiSound('denied');
    this.clearReels();
    this.casino.spinning = false;
    this.setCasinoButtons(false);
    document.querySelectorAll('.reel').forEach(r => { r.textContent = localText('ОТК', 'NO'); r.className = 'reel lose'; });
    const el = $('casino-result');
    const errors = { 'BET FAILED': t('betFailed'), 'not enough GLD': t('gldLack'), 'invalid stake': t('invalidStake') };
    el.textContent = errors[f.error] || f.error || t('betFailed');
    el.style.color = '#ff3048';
  }
  casinoResult(f, myId) {
    if (f.ok === false) { this.casinoDenied(f); return; }
    if (f.id !== myId) {
      const RES = { JCK: t('jackpot'), LOSE: t('lose'), STC: t('staticDebt'), SKN: t('skin') };
      this.feed(`${this.names.get(f.id) || '??'} BET ${f.stake} → ${RES[f.outcome] || f.outcome}`, f.outcome === 'LOSE' ? 'r' : 'g');
      return;
    }
    if (f.seq && this.casino.lastResultSeq === f.seq) return; // direct result + later snapshot duplicate
    if (f.seq) this.casino.lastResultSeq = f.seq;
    if (!this.casino.open) this.openCasino();
    const resultToken = this.casino.spinToken;
    this.stopReels(f);
    const timer = setTimeout(() => {
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
      if (pl.skinLabel) parts.push(`SKN: ${pl.skinLabel}${pl.skinRarity ? ' / ' + String(pl.skinRarity).toUpperCase() : ''}`);
      if (pl.static) parts.push(t('nextRoomDebt'));
      if (f.outcome === 'JCK') parts.unshift(t('jackpot'));
      if (pl.gld) parts.push(`NET ${pl.gld - f.stake >= 0 ? '+' : ''}${pl.gld - f.stake} GLD`);
      el.innerHTML = parts.map(x => `<span>${esc(x)}</span>`).join('');
      el.style.color = f.outcome === 'LOSE' ? '#ff3048' : f.outcome === 'STC' ? '#b45cff' : '#00ff66';
      this.playUiSound(f.outcome === 'JCK' ? 'jackpot' : f.outcome === 'LOSE' ? 'casino_lose' : f.outcome === 'STC' ? 'casino_static' : f.outcome === 'WPN' ? 'casino_weapon' : (f.outcome === 'ABL' || f.outcome === 'SKN') ? 'casino_ability' : 'casino_win');
    }, 640);
    this.casino.reelTimers.push(timer);
  }

}
