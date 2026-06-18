// terminal casino roguelike HUD: bars, pips, feed, banners, TAB panel, install + casino modals
import { P, ENEMY_KINDS } from './state.v2-1.js';
import { UPGRADES, WEAPONS, CHESTS, ROOM_MODS, BET_STAKES, ENEMIES } from '../shared/data.v2-1.js';
import { t, onLangChange, cleanPlayerText, activeNoneLabel, activeNoneDesc, activeShort as locActiveShort, activeDescFrom, chestDesc, pickupDesc, enemyDesc, weaponDesc, optionDesc, locAction, locRole, locLabel, locReward, disabledReason, objectStateText, priceText, localText, denyText, esc as escHtml } from './i18n.v2-1.js';

const $ = id => document.getElementById(id);
const MOD_LABELS = Object.fromEntries(Object.values(ROOM_MODS).map(m => [m.id, m.label]));
const ARCH_LABELS = { panic_box: 'PANIC BOX', compact: 'COMPACT', standard: 'STANDARD', wide: 'WIDE FIELD', long_lane: 'LONG LANE', lounge: 'CASINO LOUNGE', boss: 'BOSS FLOOR' };
const ARCH_LABELS_RU = { panic_box: 'ТЕСНАЯ КОРОБКА', compact: 'ТЕСНАЯ КОМНАТА', standard: 'СТАНДАРТ', wide: 'ШИРОКОЕ ПОЛЕ', long_lane: 'ДЛИННЫЙ КОРИДОР', lounge: 'КАЗИНО-ЛАУНЖ', boss: 'ЭТАЖ БОССА' };
const MOD_LABELS_RU = {
  blackout: 'ТЕМНОТА', static_rain: 'СТАТИК-ШТОРМ', greed: 'ЗОЛОТАЯ ЛИХОРАДКА', debt_floor: 'СТАТИК-ПОЛ', hunter_contract: 'ВОЛНЫ ОХОТНИКОВ',
  casino_virus: 'КАЗИНО-ВИРУС', mirror_room: 'ЗЕРКАЛЬНЫЙ ЗАЛ', moving_room: 'ДВИЖУЩИЕСЯ ЗОНЫ', prism_grid: 'ПРИЗМ-СЕТКА', blood_tax: 'КРОВАВАЯ ОПЛАТА',
  shell_market: 'БИРЖА ЩИТОВ', echo_walls: 'ЭХО-ВЫСТРЕЛЫ', static_wires: 'СТАТИК-ПРОВОДА', hunted_exit: 'ОХОТА У ВЫХОДА', skin_cache: 'СКИН-ТАЙНИК'
};
const TAG_RU = {
  'NORMAL CLEAR': 'ОБЫЧНАЯ ЗАЧИСТКА', 'NORMAL REWARD': 'ОБЫЧНАЯ НАГРАДА', LANES: 'ЛИНИИ', STATIC: 'СТАТИКА', GREED: 'ЖАДНОСТЬ', ARMOR: 'БРОНЯ',
  'ARMOR WALL': 'СТЕНА БРОНИ', CONTROL: 'КОНТРОЛЬ', SWARM: 'РОЙ', RANGED: 'ДАЛЬНИЙ БОЙ', CHAOS: 'ХАОС', 'GLD↑': 'GLD↑', 'BET↑': 'BET↑',
  'SHELL GLD': 'GLD ЗА ЩИТЫ', 'EARLY EXIT': 'РАННИЙ ВЫХОД', 'OVERSTAY HUNTERS': 'ОХОТА ЗА ЗАДЕРЖКУ', SKIN: 'СКИН', 'SKN CACHE': 'СКИН-ТАЙНИК',
  'CLOSE RANGE': 'БЛИЖНИЙ БОЙ', 'DASH SPACE': 'ПРОСТОР ДЛЯ РЫВКА', CROSSFIRE: 'ПЕРЕКРЁСТНЫЙ ОГОНЬ', SHOP: 'МАГАЗИН', 'LOCKED WAVES': 'ЗАКРЫТЫЕ ВОЛНЫ',
  '3 VIRUS SPINS': '3 БРОСКА ВИРУСА', 'DANGER ZONES': 'ОПАСНЫЕ ЗОНЫ', 'PRISM SLOW': 'ПРИЗМ-ЗАМЕДЛЕНИЕ', 'GRAVITY SOCKETS': 'ГРАВИТАЦИОННЫЕ УЗЛЫ',
  'HP SHOP': 'ПОКУПКИ ЗА HP', '50% ECHO SHOTS': '50% ЭХО-ВЫСТРЕЛОВ', 'PRIORITY TARGET': 'ВАЖНАЯ ЦЕЛЬ', 'NO ENEMIES': 'БЕЗ ВРАГОВ',
  'GLD BONUS': 'БОНУС GLD', '3 SPINS': '3 БРОСКА', 'HP COSTS': 'ЦЕНЫ HP', 'REWARD↑': 'НАГРАДА↑', 'SAFE / SHOP': 'БЕЗОПАСНО / МАГАЗИН'
};
function archLabel(id) { return localText(ARCH_LABELS_RU[id] || String(id || 'STANDARD').toUpperCase(), ARCH_LABELS[id] || String(id || 'STANDARD').toUpperCase()); }
function locTag(v) {
  const s = String(v || '').trim();
  if (!s) return s;
  if (s.includes('STATIC LVL')) return localText(s.replace('STATIC LVL', 'СТАТИК LVL'), s);
  return localText(TAG_RU[s] || s, s);
}
function locProgress(v) {
  let s = String(v || '—');
  if (s === '—') return s;
  if (document.documentElement.lang === 'en') return s;
  return s.replace(/READY/g, 'ГОТОВО').replace(/CLEAR/g, 'ЗАЧИСТКА').replace(/CLEAN/g, 'ЧИСТО').replace(/WAVES/g, 'ВОЛНЫ').replace(/SPINS LEFT/g, 'БРОСКОВ ОСТАЛОСЬ').replace(/HP PRICES/g, 'ЦЕНЫ HP').replace(/TOUCH/g, 'КАСАНИЕ').replace(/HIT/g, 'ПОПАДАНИЕ').replace(/DMG/g, 'УРОН').replace(/ENEMIES/g, 'ВРАГИ').replace(/LEFT/g, 'ОСТАЛОСЬ');
}
function locFail(v) {
  const s = String(v || '');
  const ru = { 'DAMAGE TAKEN':'ПОЛУЧЕН УРОН', 'TIME LOST':'ВРЕМЯ УШЛО', 'WIRE TOUCHED':'КАСАНИЕ ПРОВОДА', 'LANE HIT':'ПОПАДАНИЕ ЛИНИИ', 'TOO MUCH DMG':'СЛИШКОМ МНОГО УРОНА', 'SHELLS LEFT':'ЩИТЫ НЕ СЛОМАНЫ', 'CONDITION LOST':'УСЛОВИЕ СОРВАНО', 'ENEMIES LEFT':'ВРАГИ ОСТАЛИСЬ' };
  return localText(ru[s] || s, s);
}
function contractFavorPreviewLabel(f = {}) {
  const id = String(f.id || '');
  const ru = {
    free_reroll: 'РЕРОЛЛ ВЫБОРА', clear_debt: 'СНЯТЬ СТАТИК-ШТОРМ',
    portal_insurance: 'СТРАХОВКА ОТ СМЕРТИ', epic_reroll: 'ДВА РЕРОЛЛА ВЫБОРА', double_favor: 'ДВОЙНОЙ СЛЕД. ПРИЗ'
  };
  const en = {
    free_reroll: 'CHEST REROLL', clear_debt: 'CLEAR STATIC STORM',
    portal_insurance: 'DEATH INSURANCE', epic_reroll: 'DOUBLE REROLL', double_favor: 'DOUBLE NEXT PRIZE'
  };
  const base = localText(ru[id] || f.labelRu || f.label || id.toUpperCase(), en[id] || f.label || id.toUpperCase());
  return `${base}${(f.uses || 0) > 1 ? ' x' + f.uses : ''}`;
}
function contractRewardText(reward = '', obj = null) {
  const preview = Array.isArray(obj?.prizePreview) ? obj.prizePreview : [];
  if (preview.length) return preview.map(contractFavorPreviewLabel).join(' + ');
  const s = String(reward || 'NEXT ROOM FAVOR');
  if (/NEXT ROOM/i.test(s) || /FAVOR/i.test(s)) return localText('конкретный бонус следующей комнаты', 'specific next-room bonus');
  return cleanPlayerText(locLabel(s));
}
const nextStaticEligible = nx => !!nx && nx.cat !== 'boss' && nx.special !== 'chill_room';
const STATIC_SOURCE_RU = {
  room_modifier: 'мод комнаты', static_debt: 'статик-долг', cursed_chest: 'проклятый сундук', casino_bet: 'казино', active_casino: 'активное казино', bad_tape: 'плохая плёнка', debt_pulse: 'долговой импульс', active_reaction: 'активная реакция', previous_room_hits: 'попадания прошлой комнаты', room_strikes: 'попадания прошлой комнаты', debt_engine: 'статик-ядро', casino_virus: 'казино-вирус'
};
const STATIC_SOURCE_EN = {
  room_modifier: 'room rule', static_debt: 'stored static', cursed_chest: 'cursed chest', casino_bet: 'casino', active_casino: 'Q casino', bad_tape: 'bad tape', debt_pulse: 'debt pulse', active_reaction: 'Q reaction', previous_room_hits: 'previous room hits', room_strikes: 'previous room hits', debt_engine: 'static core', casino_virus: 'casino virus'
};
function staticSourceLabel(id) {
  const k = String(id || 'static_debt');
  return localText(STATIC_SOURCE_RU[k] || k.replace(/_/g, ' '), STATIC_SOURCE_EN[k] || k.replace(/_/g, ' '));
}
function staticBreakdownParts(bd = {}) {
  const sources = Array.isArray(bd.sources) ? bd.sources : [];
  return sources.filter(x => (x?.level | 0) > 0).map((x, i) => `${i === 0 ? '' : '+'}${Math.max(0, x.level | 0)} ${staticSourceLabel(x.id)}`);
}
function staticBreakdownText(bd = {}, banked = 0) {
  const total = Math.max(0, bd.total | 0);
    const parts = staticBreakdownParts(bd);
  if (total > 0) {
    return `${localText('СТАТИК-ШТОРМ LVL', 'STATIC STORM LVL')} ${total}${parts.length ? ' = ' + parts.join(' ') : ''}`;
  }
  if (banked > 0) return `${localText('СТАТИКА В БАНКЕ LVL', 'STATIC BANKED LVL')} ${banked}${parts.length ? ' = ' + parts.join(' ') : ''}`;
  return '';
}
function staticBreakdownExplain(bd = {}, banked = 0) {
  const parts = staticBreakdownParts(bd);
  const total = Math.max(0, bd.total | 0);
    const head = total > 0
    ? localText(`Общий уровень статик-шторма: ${total}.`, `Static Storm level: ${total}.`)
    : localText(`Статик ждёт следующую комнату: ${banked}.`, `Static waiting for the next room: ${banked}.`);
  const sum = parts.length ? localText(`Сумма: ${parts.join(' ')}.`, `Sum: ${parts.join(' ')}.`) : '';
  return `${head} ${sum} ${localText('Каждая часть усиливает один общий шторм.', 'Each source strengthens one shared storm.')}`;
}
function roomModLabel(m, room = null, forcedStaticLevel = 0) {
  const label = m === 'skin_cache' ? localText('СКРЫТЫЙ СКИН', 'HIDDEN SKIN') : localText(MOD_LABELS_RU[m] || (MOD_LABELS[m] || String(m || '').toUpperCase()), MOD_LABELS[m] || String(m || '').toUpperCase());
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
    blackout: localText('Свет ломается. Видишь меньше дальних угроз, поэтому опаснее отходить к краям и стрелять вслепую.', 'Light is broken. Long-range threats are harder to read, so edges and blind firing are more dangerous.'),
    static_rain: String(mode).startsWith('paid')
      ? localText(`Статик-шторм LVL ${lvl}: на полу появляются опасные области, затем по ним бьёт разряд. Этот шторм активен только в текущей комнате.`, `Static Storm LVL ${lvl}: danger areas appear on the floor, then lightning strikes them. This storm is active only in the current room.`)
      : localText(`Статик-шторм LVL ${Math.max(1, lvl)}: комната периодически помечает опасные области и бьёт по ним разрядом. Чем выше LVL, тем чаще и жёстче удары.`, `Static Storm LVL ${Math.max(1, lvl)}: the room marks dangerous areas and strikes them. Higher LVL means faster and harsher strikes.`),
    greed: localText('Золотая лихорадка: всё крутится вокруг GLD. Враги и сундуки дают больше золота, а ошибки забирают золото вместо HP.', 'Gold Fever: everything revolves around GLD. Enemies and chests pay more gold, while mistakes take gold instead of HP.'),
    debt_floor: localText('Статик-пол: сделки выглядят выгоднее, но могут сделать следующие комнаты опаснее.', 'Static Floor: deals look better, but later rooms may become more dangerous.'),
    hunter_contract: localText('Волны охотников: выход закрыт, пока не переживёшь волны быстрых врагов.', 'Hunter Waves: the exit is locked until the fast enemy waves are cleared.'),
    casino_virus: localText('Вирус Казино: комната крутит 3 барабана. Результат срабатывает после броска: может прийти награда, штраф или пачка врагов. Портал откроется после всех слотов и полной зачистки.', 'Casino Virus: the room spins 3 reels. The result triggers after the spin: reward, penalty, or enemy pack. Portal opens after all slots and full cleanup.'),
    mirror_room: localText('Зеркальный зал: больше эхо-угроз. Следи за копиями пуль.', 'Mirror Room: more echo threats. Watch the copied bullets.'),
    moving_room: localText('Движущиеся зоны: красные полые области едут по комнате. Это не стены, но внутри они замедляют и периодически бьют всех.', 'Shifting Zones: red hollow areas move through the room. They are not walls, but they slow and damage everything inside.'),
    prism_grid: localText('Призм-сетка: светлые клетки на полу замедляют движение и пули внутри них. Не стой в сетке, если рядом враги.', 'Prism Grid: pale floor cells slow movement and bullets inside them. Do not fight inside the grid unless you have space.'),
    blood_tax: localText('Кровавая оплата: ставки и покупки платятся HP. Можно зайти в смертельный долг, но страховка от смерти может спасти.', 'Blood Payment: bets and buys cost HP. You can pay into lethal danger, but Death Insurance can save you.'),
    shell_market: localText('Shell-биржа: у врагов чаще есть щиты. Сначала сбиваешь щит, потом HP; щит может восстановиться, если врага не трогать.', 'Shell Market: enemies more often have shields. Break shield before HP; it can regenerate if the enemy is left alone.'),
    echo_walls: localText('Эхо-выстрелы: часть пуль получает копию. Твои копии читаются одним цветом, вражеские — красным.', 'Echo Shots: some bullets get a copy. Your copies have one color; enemy copies are red.'),
    static_wires: localText('Статик-провода: тонкие линии замедляют и искажают траектории.', 'Static Wires: thin lines slow and distort movement and projectiles.'),
    hunted_exit: localText('Охота у выхода: портал может открыться рано, но задержка в комнате вызывает охотников.', 'Hunted Exit: portal can open early, but staying too long calls hunters.'),
    skin_cache: localText('Скин-тайник: в комнате спрятан новый облик. После зачистки появится плашка получения.', 'Skin Cache: a new look is hidden here. After clearing, a claim card appears.')
  };
  return hints[m] || localText('Особое правило меняет бой. Наведи на другие подчёркнутые слова, чтобы понять угрозы и награды.', 'A special rule changes combat. Hover other underlined words to understand threats and rewards.');
}
function roomRuleSummary(room, ids = []) {
  const mods = (ids || []).filter(Boolean);
  if (!mods.length) return localText('Чистая комната: без особых правил.', 'Clean room: no special rules.');
  return mods.slice(0, 3).map(m => roomModHint(m, room)).join(' / ');
}
function dangerLabel(room = {}) {
  const lvl = Math.max(0, Math.min(5, room.danger | 0));
  const label = room.dangerLabel || ['SAFE', 'LOW', 'MED', 'HIGH', 'SEVERE', 'BOSS'][lvl] || 'MED';
  const ru = { SAFE: 'ТИХО', LOW: 'НИЗКО', MED: 'СРЕДНЕ', HIGH: 'ВЫСОКО', SEVERE: 'ОПАСНО', BOSS: 'БОСС' }[label] || label;
  return localText(`ОПАСНОСТЬ ${lvl} ${ru}`, `DANGER ${lvl} ${label}`);
}
function tagJoin(tags = [], fallback = '—') {
  return Array.isArray(tags) && tags.length ? tags.slice(0, 4).map(locTag).join(' / ') : fallback;
}

function comboMethodLabel(m) {
  const key = String(m || '').toLowerCase();
  const ru = {
    shotgun: 'SHOTGUN', seeker: 'SEEKER', rocketgun: 'ROCKETGUN', ricochet: 'ОТСКОК',
    ability: 'Q', dash: 'РЫВОК', orbital: 'ОРБИТАЛЬ', drone: 'ДРОН',
    fire: 'ПОДЖОГ', burn: 'ПОДЖОГ', poison: 'ЯД', freeze: 'ЗАМОРОЗКА', status: 'СТАТУС',
    blast: 'ВЗРЫВ', chain: 'ЦЕПЬ', shell: 'БРОНЯ', weapon: 'ОРУЖИЕ'
  };
  const en = {
    shotgun: 'SHOTGUN', seeker: 'SEEKER', rocketgun: 'ROCKETGUN', ricochet: 'RICOCHET',
    ability: 'Q', dash: 'DASH', orbital: 'ORBITAL', drone: 'DRONE',
    fire: 'BURN', burn: 'BURN', poison: 'POISON', freeze: 'FREEZE', status: 'STATUS',
    blast: 'BLAST', chain: 'CHAIN', shell: 'SHELL', weapon: 'WEAPON'
  };
  return localText(ru[key] || String(key || 'УДАР').toUpperCase(), en[key] || String(key || 'HIT').toUpperCase());
}
function comboPrizeLabel(type) {
  const key = String(type || 'gld').toLowerCase();
  if (key === 'exp') return 'EXP';
  if (key === 'hp') return 'HP';
  return 'GLD';
}
function comboPrizeReadout(c = {}) {
  const label = comboPrizeLabel(c.prizeType || c.prizeLabel || 'gld');
  const amount = Math.max(0, c.prizeAmount | 0);
  return amount > 0 ? localText(`ПРИЗ +${amount} ${label}`, `PRIZE +${amount} ${label}`) : localText(`ПРИЗ ${label}`, `PRIZE ${label}`);
}
function comboExplain(c = {}) {
  const methods = (c.recent || []).map(comboMethodLabel).slice(0, 4).join(' · ') || localText('пока нет', 'none yet');
  const kills = Math.max(0, c.count | 0);
  const prize = comboPrizeReadout(c);
  return localText(
    `Комбо держится, пока ты продолжаешь убивать. В конце цепь выдаёт этот приз. ${prize}. Урон снимает часть комбо. Убито: ${kills}. Способы: ${methods}.`,
    `Combo stays active while you keep killing. When the chain ends, it pays this prize. ${prize}. Damage removes part of the combo. Kills: ${kills}. Methods: ${methods}.`
  );
}
function renderComboHud(c = {}) {
  const mult = Number(c.mult || 1);
  const count = Math.max(0, c.count | 0);
  if (mult <= 1.01 || count <= 0 || (c.timer || 0) <= 0) return '';
  const pct = Math.max(0, Math.min(100, ((c.timer || 0) / Math.max(0.1, c.window || 3)) * 100));
  const methods = (c.recent || []).map(comboMethodLabel).slice(0, 3);
  const methodLine = methods.length ? methods.join(' · ') : comboMethodLabel(c.lastMethod || 'weapon');
  const prizeLine = comboPrizeReadout(c);
  return `<div class="combo-readout${c.flash > 0 ? ' combo-pop' : ''}${c.drop > 0 ? ' combo-hit' : ''}" data-explain-title="${esc(localText('КОМБО', 'COMBO'))}" data-explain="${esc(comboExplain(c))}" data-explain-tone="gold">` +
    `<div class="combo-prize">${esc(prizeLine)}</div>` +
    `<div class="combo-main"><span>${esc(localText('КОМБО', 'COMBO'))}</span><b>x${mult.toFixed(1)}</b><em>${esc(localText('УБИТО', 'KILLS'))} ${count}</em></div>` +
    `<div class="combo-used">${esc(methodLine)}</div>` +
    `<div class="combo-timer"><i style="width:${pct.toFixed(0)}%"></i></div>` +
  `</div>`;
}
function roomIntelExplain(room = {}, isNext = false) {
  const mods = (room.mods || []).map(m => roomModLabel(m, room)).join(' / ') || localText('без модификаторов', 'no modifiers');
  const threats = tagJoin(room.threatTags, localText('обычная зачистка', 'normal clear'));
  const rewards = tagJoin(room.rewardTags, localText('обычная награда', 'normal reward'));
  const headline = isNext ? localText('Короткий прогноз следующей комнаты.', 'Short preview of the next room.') : localText('Короткая сводка текущей комнаты.', 'Short summary of the current room.');
  return `${headline}
${dangerLabel(room)}
${localText('Правила', 'Rules')}: ${mods}
${localText('Угроза', 'Threat')}: ${threats}
${localText('Награда', 'Reward')}: ${rewards}
${localText('Подсказка', 'Hint')}: ${localText('наведи на подчёркнутое правило, чтобы увидеть детали.', 'hover an underlined rule to see details.')}`;
}


function objectiveExplain(obj = {}) {
  if (!obj?.id) return localText('Контракт комнаты. Выполни условие, чтобы получить бонус для следующей комнаты.', 'Room contract. Complete the condition to earn a next-room bonus.');
  const map = {
    boss_cut: localText('Убей босса и забери приз после комнаты.', 'Kill the boss and claim the prize after the room.'),
    lounge_cashout: localText('Безопасная комната: покупай, ставь BET и выходи, когда готов.', 'Safe room: shop, BET, and leave when ready.'),
    hunter_waves: localText('Пройди все волны. Портал откроется только после последней.', 'Clear all waves. The portal opens only after the final wave.'),
    virus_clean: localText('Переживи 3 вирусных броска, затем убей всех врагов.', 'Survive 3 virus spins, then kill every enemy.'),
    wire_ghost: localText('Пройди комнату без касания опасных линий.', 'Clear the room without touching hazard lines.'),
    grid_slow_clear: localText('Зачисти комнату с сеткой замедления.', 'Clear the slow-grid room.'),
    blood_paid: localText('В этой комнате покупки требуют HP. Очисти комнату.', 'Purchases in this room cost HP. Clear the room.'),
    static_clean: localText('Пройди комнату со статик-штормом и получи мало урона. Шторм — это серия опасных областей на арене: они появляются, предупреждают и затем бьют разрядом.', 'Clear the Static Storm room while taking little damage. The storm is a series of danger areas: they appear, warn you, then strike.'),
    cache_claim: localText('Очисти комнату и забери скрытый скин через портал.', 'Clear the room and claim the hidden skin through the portal.'),
    fast_clear: localText('Убей всех врагов, пока таймер не сгорел.', 'Kill every enemy before the timer runs out.'),
    no_hit: localText('Убей всех врагов без полученного урона.', 'Kill every enemy without taking damage.'),
    clean_signal: localText('Убей всех врагов комнаты.', 'Kill every enemy in the room.')
  };
  const status = obj.statusLabel ? `${localText('Состояние', 'State')}: ${objectiveStatusText(obj)}${obj.failReason ? ' / ' + locFail(obj.failReason) : ''}` : `${localText('Состояние', 'State')}: ${localText('идёт', 'active')}`;
  const prize = contractRewardText(obj.reward, obj);
  return `${map[obj.id] || localText('Контракт комнаты.', 'Room contract.')}
${status}
${localText('Ход', 'Progress')}: ${locProgress(obj.progress || '—')}
${localText('Приз', 'Prize')}: ${prize}
${localText('Приз появится после завершения комнаты и поможет в следующей.', 'The prize appears after the room and helps in the next one.')}`;
}
function objectiveStatusText(obj = {}) {
  const status = String(obj.status || '').toLowerCase();
  if (status === 'failed') return localText('ПРОВАЛ', 'FAILED');
  if (status === 'done' || status === 'done_pending') return localText('ВЫПОЛНЕНО', 'DONE');
  if (status === 'planned') return localText('ДАЛЬШЕ', 'NEXT');
  return localText('АКТИВЕН', 'ACTIVE');
}
function objectiveChip(obj = {}, label = 'OBJ') {
  if (!obj?.label) return '';
  const shownLabel = label === 'CONTRACT' ? localText('КОНТРАКТ', 'CONTRACT') : localText('ЗАДАЧА', label);
  const objLabel = locLabel(obj.label);
  const prog = obj.progress ? ` · ${locProgress(obj.progress)}` : '';
  const status = objectiveStatusText(obj);
  const fail = obj.failReason ? ` · ${locFail(obj.failReason)}` : '';
  const cls = obj.status === 'failed' ? ' danger' : (obj.status === 'done' || obj.status === 'done_pending' ? ' good' : '');
  return `<span class="term${cls}" data-explain-title="${esc(shownLabel)}: ${esc(objLabel)}" data-explain="${esc(objectiveExplain(obj))}">${esc(shownLabel)}: ${esc(objLabel)} · ${esc(status)}${esc(fail)}${esc(prog)}</span>`;
}
function contractCardHtml(obj = {}) {
  if (!obj?.label) return '';
  const status = objectiveStatusText(obj);
  const prog = obj.progress ? locProgress(obj.progress) : '—';
  const fail = obj.failReason ? ` · ${locFail(obj.failReason)}` : '';
  const prize = contractRewardText(obj.reward, obj);
  const reward = obj.status === 'failed'
    ? localText('ПРИЗ: НЕТ', 'PRIZE: NONE')
    : (obj.status === 'paid'
      ? localText(`ПРИЗ ПОЛУЧЕН: ${prize}`, `PRIZE RECEIVED: ${prize}`)
      : localText(`ПРИЗ: ${prize}`, `PRIZE: ${prize}`));
  const title = `${locLabel(obj.label)} · ${status}${fail}`;
  return `<div class="contract-kicker">${esc(localText('КОНТРАКТ КОМНАТЫ', 'ROOM CONTRACT'))}</div><div class="contract-title">${esc(title)}</div><div class="contract-sub">${esc(prog)}</div><div class="contract-reward">${esc(reward)}</div>`;
}
const rarityText = r => { const k = String(r || 'skin').toLowerCase(); const en = { basic:'BASIC', uncommon:'UNCOMMON', rare:'RARE', superrare:'SUPER RARE', legendary:'LEGENDARY', skin:'SKIN' }; const ru = { basic:'ОБЫЧНЫЙ', uncommon:'НЕОБЫЧНЫЙ', rare:'РЕДКИЙ', superrare:'СВЕРХРЕДКИЙ', legendary:'ЛЕГЕНДАРНЫЙ', skin:'СКИН' }; return localText(ru[k] || String(r || '').toUpperCase(), en[k] || String(r || '').replace('superrare', 'SUPER RARE').toUpperCase()); };
const UPG = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
const WEAPON_BY_LABEL = Object.fromEntries(Object.values(WEAPONS).map(w => [w.label, w]));
const CHEST_BY_LABEL = Object.fromEntries(Object.entries(CHESTS).map(([id, c]) => [c.label, { id, ...c }]));
const CHEST_DESC = {
  BSC: 'Бесплатный базовый сундук: GLD/EXP и редкий HEA. Хорошая безопасная награда.',
  WPN: 'Оружейный сундук: оружие, оружейные усиления или общий прирост силы.',
  ABL: 'Сундук способностей: активка Q, улучшение Q, мутация или мобильность.',
  RAR: 'Редкий сундук: сильное усиление забега.',
  CRS: 'Проклятый сундук: сильная награда, но забег становится опаснее.'
};
const PICKUP_DESC = {
  GLD: 'Деньги для сундуков и BET. Подбор делится между живыми игроками.',
  EXP: 'Опыт для уровней. Новый выбор улучшения появится между комнатами.',
  HEA: 'Лечение. Восстанавливает HP.'
};
const ENEMY_DESC = {
  grunt: 'Базовый преследователь: давит количеством и контактным уроном.', runner: 'Быстрый слабый враг: закрывает дистанцию и ломает позицию.', tank: 'Медленный бронированный враг: блокирует пространство и впитывает урон.', shooter: 'Дальний враг: держит дистанцию и стреляет красными снарядами.', charger: 'Готовится, затем рывок. Следи за красной линией.', bomber: 'Подходит, запускает взрыв и детонирует. Уходи из радиуса.', bouncer: 'Отскакивает от стен и толкает игрока.', glitch: 'Мигающий враг: телепортируется рядом и бьёт.',
  echo: 'ECH: стреляет знакомыми снарядами с дистанции.', orbiter: 'ORB: кружит рядом и держит фронтальный щит.', anchor: 'ANC: поле тянет и замедляет.', splitter: 'SPL: после смерти делится на маленькие быстрые части.', prism: 'PRS: стреляет призменными линиями.', pulse: 'PLS: атакует областьной волной.', leech: 'LCH: лечит раненых врагов, приоритетная цель.', herald: 'HRD: ведёт линию давления и призывает рой.', boss: 'BOS: босс с залпами и подкреплением.'
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
      changeRu: '+1 отскок · лучше в узких комнатах', changeEn: '+1 bounce · better in tight rooms'
    },
    bullet_range: {
      role: 'RANGE', tone: 'range',
      ru: 'Снаряды живут дольше и летят дальше.', en: 'Projectiles live longer and travel farther.',
      changeRu: 'дальше летит · дольше держится', changeEn: 'travels farther · lasts longer'
    },
    bullet_fire: {
      role: 'STATUS', tone: 'status', element: 'fire',
      ru: 'Пули поджигают врагов и наносят периодический урон.', en: 'Bullets burn enemies over time.',
      changeRu: 'огонь · сильнее с ядом', changeEn: 'burn · stronger with poison'
    },
    bullet_freeze: {
      role: 'CONTROL', tone: 'control', element: 'freeze',
      ru: 'Пули охлаждают и могут коротко остановить врагов.', en: 'Bullets chill and can briefly stop enemies.',
      changeRu: 'холод · безопаснее против толпы', changeEn: 'chill · safer versus swarms'
    },
    bullet_poison: {
      role: 'STATUS', tone: 'status', element: 'poison',
      ru: 'Пули отравляют врагов и наносят периодический урон.', en: 'Bullets poison enemies over time.',
      changeRu: 'яд · хорошо против толстых целей', changeEn: 'poison · good versus high HP targets'
    },
    drone_element_link: {
      role: 'SYNERGY', tone: 'synergy', element: 'drone',
      ru: 'Дроны начинают переносить статусы оружия.', en: 'Drones start carrying weapon statuses.',
      changeRu: 'дроны копируют огонь/холод/яд', changeEn: 'drones copy burn/chill/poison'
    },
    element_amp: {
      role: 'STATUS', tone: 'status',
      ru: 'Усиливает огонь, холод и яд.', en: 'Improves burn, chill, and poison.',
      changeRu: '+25% к статус-эффектам', changeEn: '+25% status effect strength'
    },
    element_spread: {
      role: 'STATUS', tone: 'status',
      ru: 'Статусы прыгают с убитых врагов на ближайшие цели.', en: 'Statuses jump from killed enemies to nearby targets.',
      changeRu: 'переход статуса при убийстве', changeEn: 'status spreads on kill'
    },
    bullet_chain: {
      role: 'CONTROL', tone: 'control',
      ru: 'Попадания связывают ближайших врагов линией.', en: 'Hits link nearby enemies with a thin line.',
      changeRu: '+1 прыжок связи · урон идёт дальше', changeEn: '+1 link jump · damage travels onward'
    },
    shg_teeth: {
      role: 'DPS', tone: 'dps',
      ru: 'SHOTGUN получает больше дробин в каждом залпе.', en: 'SHOTGUN fires more pellets per shot.',
      changeRu: '+2 дробины · сильнее вблизи', changeEn: '+2 pellets · stronger up close'
    },
    shg_longshot: {
      role: 'RANGE', tone: 'range',
      ru: 'ПКМ тратит все заряды SHOTGUN на один дальний тяжёлый выстрел.', en: 'RMB spends all SHOTGUN charges on one heavy long shot.',
      changeRu: 'ПКМ дальний тяжёлый выстрел', changeEn: 'RMB heavy long shot'
    },
    sek_split: {
      role: 'DPS', tone: 'dps',
      ru: 'Убийства SEEKER выпускают самонаводящиеся фрагменты.', en: 'SEEKER kills release homing fragments.',
      changeRu: 'фрагменты при убийстве', changeEn: 'fragments on kill'
    },
    sek_chain: {
      role: 'CONTROL', tone: 'control',
      ru: 'SEEKER лучше держит цель и живёт дольше.', en: 'SEEKER locks on harder and lives longer.',
      changeRu: 'лучше держит цель', changeEn: 'stronger lock-on'
    },
    sek_swarm: {
      role: 'DPS', tone: 'dps',
      ru: 'ПКМ выпускает рой SEK-пуль.', en: 'RMB releases a burst swarm of SEK bullets.',
      changeRu: 'рой самонаводящихся пуль', changeEn: 'homing bullet swarm'
    },
    rkt_cluster: {
      role: 'DPS', tone: 'dps',
      ru: 'ROCKETGUN добавляет мини-взрывы вокруг детонации.', en: 'ROCKETGUN adds mini-blasts around detonation.',
      changeRu: 'дополнительные мини-взрывы', changeEn: 'extra mini-blasts'
    },
    rkt_mines: {
      role: 'CONTROL', tone: 'control',
      ru: 'ROCKETGUN оставляет отложенные областьные мины.', en: 'ROCKETGUN leaves delayed square mines.',
      changeRu: 'мины во время полёта', changeEn: 'mines during flight'
    },
    rkt_stun: {
      role: 'CONTROL', tone: 'control',
      ru: 'Все взрывы ROCKETGUN могут оглушать врагов.', en: 'All ROCKETGUN explosions can stun enemies.',
      changeRu: 'оглушение взрывом', changeEn: 'stun on blast'
    },
    rkt_scatter: {
      role: 'CONTROL', tone: 'control',
      ru: 'Все взрывы ROCKETGUN разбрасывают врагов сильнее.', en: 'All ROCKETGUN explosions scatter enemies harder.',
      changeRu: 'отбрасывание взрывом', changeEn: 'knockback on blast'
    },
    rkt_remote: {
      role: 'CONTROL', tone: 'control',
      ru: 'ПКМ взрывает выпущенные ракеты по одной, начиная со старой.', en: 'RMB detonates launched rockets one by one, oldest first.',
      changeRu: 'ручная детонация по очереди', changeEn: 'remote detonation one by one'
    },
    wpn_dmg: {
      role: 'DPS', tone: 'dps',
      ru: 'Повышает прямой урон всего оружия.', en: 'Increases direct damage for all weapons.',
      changeRu: '+18% урон оружия', changeEn: '+18% weapon damage'
    },
    wpn_fire: {
      role: 'DPS', tone: 'dps',
      ru: 'Ускоряет темп стрельбы всего оружия.', en: 'Increases firing tempo for all weapons.',
      changeRu: '+14% темп стрельбы', changeEn: '+14% fire rate'
    }
  };
  const out = m[key] || {
    role: opt.kind === 'weapon' ? 'NEW' : opt.kind === 'stat' ? 'DPS' : 'UTILITY', tone: opt.kind === 'weapon' ? 'new' : 'utility',
    ru: cleanPlayerText(opt.desc || opt.preview || 'Оружейное усиление.'),
    en: cleanPlayerText(opt.desc || opt.preview || 'Weapon upgrade.'),
    changeRu: req ? `нужно ${req}` : 'усиление оружия',
    changeEn: req ? `needs ${req}` : 'weapon upgrade'
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
    NEW: 'Новое оружие для твоего слота.', DPS: 'Больше урона или темпа стрельбы.', RANGE: 'Снаряды работают на большей дистанции.', STATUS: 'Огонь, холод, яд и их перенос.', CONTROL: 'Замедление, захват, зоны или цепи.', SYNERGY: 'Лучше работает с уже собранным оружием.', ECONOMY: 'Больше ресурсов.'
  };
  const en = {
    NEW: 'New weapon for your slot.', DPS: 'More damage or firing tempo.', RANGE: 'Projectiles work at longer range.', STATUS: 'Burn, chill, poison, and spread.', CONTROL: 'Slow, lock, zones, or chains.', SYNERGY: 'Works better with what you already have.', ECONOMY: 'More resources.'
  };
  return localText(ru[r] || 'Категория оружейного выбора.', en[r] || 'Weapon choice category.');
}
function weaponRoleLabel(role) {
  const r = String(role || '').toUpperCase();
  const en = { NEW:'NEW', DPS:'DAMAGE', RANGE:'RANGE', STATUS:'STATUS', CONTROL:'CONTROL', SYNERGY:'SYNERGY', ECONOMY:'ECONOMY', UTILITY:'UTILITY' };
  const ru = { NEW:'НОВОЕ', DPS:'УРОН', RANGE:'ДАЛЬНОСТЬ', STATUS:'СТАТУС', CONTROL:'КОНТРОЛЬ', SYNERGY:'СВЯЗКА', ECONOMY:'РЕСУРСЫ', UTILITY:'ПОЛЬЗА' };
  return localText(ru[r] || r, en[r] || r);
}
function weaponElementLabel(cls) {
  const k = String(cls || '').toLowerCase();
  const en = { fire:'FIRE', freeze:'FREEZE', poison:'POISON', drone:'DRONE' };
  const ru = { fire:'ОГОНЬ', freeze:'ХОЛОД', poison:'ЯД', drone:'ДРОН' };
  return localText(ru[k] || String(cls || '').toUpperCase(), en[k] || String(cls || '').toUpperCase());
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
    this.virusRollSpin = { token: 0, timers: [], intervals: [] };
    this.wasAlive = true;
    this.casino = { open: false, spinning: false, betId: null, spinToken: 0, timeout: null, lastResultSeq: 0, reelTimers: [] };
    this.install = { open: false, choices: [], expires: 0, total: 15, locked: false, skinOnly: false };
    this.skinClaim = null;
    this.weapon = { open: false, choices: [], locked: false };
    this.ability = { open: false, choices: [], locked: false };
    this.names = new Map();
    this.localRerollSpent = 0;

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
    this.tipEl = null;
    this.mouse = { x: 0, y: 0 };
    const explainTarget = (node) => {
      const el = node?.closest?.('[data-explain]') || null;
      if (!el) return null;
      const inDossier = !!el.closest?.('#hud-objective, #hud-room, #tab-run');
      // Top-right room dossier: only underlined terminal terms may open tooltips.
      if (inDossier && !el.classList.contains('term')) return null;
      return el;
    };
    const move = (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      const under = explainTarget(document.elementFromPoint(e.clientX, e.clientY));
      // HUD rows are rebuilt every frame. Refresh tooltip data from the element under
      // the cursor so it cannot stick to a previous row like GOAL/ЦЕЛЬ.
      if (under) {
        this.domTipActive = true;
        const title = under.dataset.explainTitle || localText('ИНФО', 'INFO');
        const body = under.dataset.explain || '';
        const tone = under.dataset.explainTone || '';
        if (this.tipEl !== under || this.tipData?.source !== 'dom' || this.tipData?.title !== title || this.tipData?.body !== body || this.tipData?.tone !== tone) {
          this.tipEl = under;
          this.showTip(title, body, tone, 'dom');
        }
      } else if (this.tipData?.source === 'dom') {
        this.domTipActive = false;
        this.tipEl = null;
        this.hideTip();
      }
      this.placeTip();
    };
    window.addEventListener('mousemove', move, { passive: true });
    document.addEventListener('mouseover', (e) => {
      const el = explainTarget(e.target);
      if (!el) return;
      this.domTipActive = true;
      this.tipEl = el;
      this.showTip(el.dataset.explainTitle || localText('ИНФО', 'INFO'), el.dataset.explain || '', el.dataset.explainTone || '', 'dom');
    });
    document.addEventListener('focusin', (e) => {
      const el = explainTarget(e.target);
      if (!el) return;
      this.domTipActive = true;
      this.tipEl = el;
      this.showTip(el.dataset.explainTitle || localText('ИНФО', 'INFO'), el.dataset.explain || '', el.dataset.explainTone || '', 'dom');
    });
    document.addEventListener('mouseout', (e) => {
      const el = explainTarget(e.target);
      if (!el) return;
      if (e.relatedTarget && el.contains(e.relatedTarget)) return;
      this.domTipActive = false;
      this.tipEl = null;
      this.hideTip();
    });
    document.addEventListener('focusout', (e) => {
      const el = explainTarget(e.target);
      if (!el) return;
      this.domTipActive = false;
      this.tipEl = null;
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
    // Keep inspect/target popups away from the top-right room dossier, especially in Casino Virus rooms.
    const topRightBlocked = this.mouse.x > window.innerWidth - 760 && this.mouse.y < 245;
    if (topRightBlocked) y = Math.max(y, 250);
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
      const [, type, label, x, y, opened, cost, currency] = o;
      if (dist2(x, y) > 34 ** 2) continue;
      if (type === 'bet') { const bs = room?.betStakes; const blood = (room?.mods || []).includes('blood_tax'); found = { title: t('betTitle'), body: bs ? `${t('betInspect')} LOW ${bs.low} / MID ${bs.mid} / HIGH ${bs.high} ${blood ? 'HP' : 'GLD'}.` : t('betInspect'), tone: 'red' }; }
      else { const blood = (room?.mods || []).includes('blood_tax') || String(currency).toUpperCase() === 'HP'; const costBody = opened ? objectStateText(opened, cost, blood ? 'HP' : 'GLD') : (cost > 0 && blood ? localText(`СТОИТ HP: ${cost} — платится здоровьем`, `HP COST: ${cost} — paid with health`) : objectStateText(opened, cost, currency || 'GLD')); found = { title: `${label} / ${t('chestTitle')}`, body: `${chestDesc(label)} ${costBody}`, tone: blood ? 'red' : (label === 'CRS' ? 'purple' : '') }; }
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
      found = { title: `${elite ? localText('ЭЛИТНЫЙ ', 'ELITE ') : ''}${def.label || kind.toUpperCase()}`, body: `${enemyDesc(kind)} ${localText('Здоровье', 'Health')} ${Math.round(hp01)}%.${elite ? ' ' + localText('Элитный: сильнее и даёт лучшую награду.', 'Elite: stronger and better reward.') : ''}${st && st !== 'move' ? ' ' + localText('Состояние', 'State') + ': ' + st + '.' : ''}`, tone: elite || (ENEMIES[kind]?.boss) ? 'red' : '' };
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
    this.latestRoom = room;
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
    $('hud-loop').textContent = `${localText('ЦИКЛ', 'LOOP')} ${room.loop} / ${localText('ГЛУБИНА', 'DEPTH')} ${room.depth}`;
    const modLabels = (room.mods || []).map(m => roomModLabel(m, room));
    const modTone = (m) => m === 'static_rain' || m === 'prism_grid' ? 'cyan' : m === 'blood_tax' || m === 'moving_room' || m === 'hunter_contract' ? 'red' : m === 'casino_virus' || m === 'echo_walls' ? 'purple' : m === 'greed' ? 'gold' : '';
    const visibleMods = (room.mods || []).filter(m => m !== 'static_rain');
    $('hud-mods').innerHTML = visibleMods.map(m => `<span class="term" data-explain-title="${esc(roomModLabel(m, room))}" data-explain="${esc(roomModHint(m, room))}"${modTone(m) ? ` data-explain-tone="${modTone(m)}"` : ''}>${esc(roomModLabel(m, room))}</span>`).join(' · ');
    if (room.betStakes) {
      const names = { low: 'LOW', mid: 'MID', high: 'HIGH' };
      document.querySelectorAll('#casino-stakes button').forEach(btn => {
        const k = btn.dataset.stake;
        const cost = room.betStakes[k];
        if (!cost) return;
        const blood = (room.mods || []).includes('blood_tax');
        btn.innerHTML = `${names[k] || String(k).toUpperCase()}<br>${blood ? `<span class="hp-cost">${cost} HP</span>` : `${cost} GLD`}`;
        const risk = k === 'high' ? localText('Высокий риск.', 'High risk.') : k === 'mid' ? localText('Средний риск.', 'Medium risk.') : localText('Низкий риск.', 'Low risk.');
        this.setExplain(btn, `${names[k] || String(k).toUpperCase()} BET`, `${localText('Ставка', 'Stake')} ${cost} ${blood ? 'HP' : 'GLD'}. ${risk}`, blood ? 'red' : 'red');
      });
    }
    $('hud-ping').textContent = this.net.ping ? `${this.net.ping}ms` : '';
    const obj = $('hud-objective');
    const skn = room.skinReward ? ` · <span class="term" data-explain-title="${esc(localText('СКРЫТЫЙ СКИН', 'HIDDEN SKIN'))}" data-explain="${esc(localText('В этой комнате есть скрытый скин. После зачистки появится отдельная карточка скина, даже если выбора улучшения нет.', 'This room has a hidden skin. After the room is solved, a separate skin card appears even if there is no INSTALL choice.'))}">${esc(localText('СКИН', 'SKIN'))} ${rarityText(room.skinReward)}</span>` : '';
    const curRain = Math.max(0, room.staticRainStacks | 0);
    const nx = room.next || null;
    const currentStaticBd = room.staticRainBreakdown || { total: curRain, rawTotal: curRain, sources: curRain ? [{ id: 'static_debt', level: curRain }] : [] };
    const nextStaticBd = nx?.staticRainBreakdown || room.staticRainNextBreakdown || null;
    const staticLine = curRain > 0
      ? staticBreakdownText(currentStaticBd)
      : (nextStaticBd && ((nextStaticBd.total | 0) > 0 || (nextStaticBd.banked | 0) > 0) ? localText('СЛЕД. ', 'NEXT ') + staticBreakdownText(nextStaticBd, nextStaticBd.banked || 0) : '');
    const staticExplain = curRain > 0
      ? staticBreakdownExplain(currentStaticBd)
      : (nextStaticBd ? staticBreakdownExplain(nextStaticBd, nextStaticBd.banked || 0) : '');
    const rainHud = staticLine ? `<div class="static-rain-status"><span class="term" data-explain-title="${esc(localText('ОБЩИЙ СТАТИК-ШТОРМ', 'TOTAL STATIC STORM'))}" data-explain="${esc(staticExplain)}" data-explain-tone="cyan">${esc(staticLine)}</span></div>` : '';
    const virusHud = room.casinoVirus ? `<div class="static-rain-status virus-only"><span class="term" data-explain-title="CASINO VIRUS" data-explain="${esc(roomModHint('casino_virus', room))}">${esc(localText(`ВИРУС КАЗИНО · ОСТАЛОСЬ ${Math.max(0, room.casinoVirus.spinsLeft || 0)} · СЛЕД. ${Math.max(0, Math.ceil(room.casinoVirus.nextSpin || 0))}с`, `CASINO VIRUS · ${Math.max(0, room.casinoVirus.spinsLeft || 0)} SPINS LEFT · NEXT ${Math.max(0, Math.ceil(room.casinoVirus.nextSpin || 0))}s`))}</span></div>` : '';
    const hunterHud = room.hunterWave ? (() => {
      const total = Math.max(0, room.hunterWave.total || 0);
      const done = !!room.hunterWave.done;
      const current = done ? total : Math.min(total, Math.max(0, room.hunterWave.index || 0));
      const left = Math.max(0, total - current);
      const waiting = Math.max(0, Math.ceil(room.hunterWave.waiting || 0));
      const line = done
        ? localText('ВОЛНЫ ОХОТНИКОВ · ЗАЧИЩЕНО', 'HUNTER WAVES · CLEARED')
        : current <= 0
          ? localText(`ВОЛНЫ ОХОТНИКОВ · 0/${total} · СТАРТ ${waiting}с`, `HUNTER WAVES · 0/${total} · START ${waiting}s`)
          : localText(`ВОЛНЫ ОХОТНИКОВ · ВОЛНА ${current}/${total} · ОСТАЛОСЬ ${left}`, `HUNTER WAVES · WAVE ${current}/${total} · ${left} LEFT`);
      return `<div class="static-rain-status hunter-only"><span class="term" data-explain-title="${esc(localText('ВОЛНЫ ОХОТНИКОВ', 'HUNTER WAVES'))}" data-explain="${esc(roomModHint('hunter_contract', room))}" data-explain-tone="red">${esc(line)}</span></div>`;
    })() : '';
    const currentThreats = tagJoin(room.threatTags, localText('ОБЫЧНАЯ ЗАЧИСТКА', 'NORMAL CLEAR'));
    const currentRewards = tagJoin(room.rewardTags, localText('ОБЫЧНАЯ НАГРАДА', 'NORMAL REWARD'));
    const currentObjective = objectiveChip(room.objective, 'CONTRACT');
    const modChipSmall = (m, r = room, forcedLevel = 0) => `<span class="term" data-explain-title="${esc(roomModLabel(m, r, forcedLevel))}" data-explain="${esc(roomModHint(m, r))}"${modTone(m) ? ` data-explain-tone="${modTone(m)}"` : ''}>${esc(roomModLabel(m, r, forcedLevel))}</span>`;
    const currentModChips = (room.mods || []).filter(m => m !== 'static_rain').slice(0, 4).map(m => modChipSmall(m, room, 0)).join(' + ');
    const currentHud = `<div class="room-current"><span class="term" data-explain-title="${esc(localText('ТЕКУЩАЯ КОМНАТА', 'CURRENT ROOM'))}" data-explain="${esc(roomIntelExplain(room, false))}">${esc(localText('СЕЙЧАС', 'NOW'))}</span>: ${esc(archLabel(room.archetype))}${currentModChips ? ' · ' + currentModChips : ' · ' + esc(localText('ЧИСТО', 'CLEAN'))}</div>` +
      `<div class="room-intel"><span class="term" data-explain-title="${esc(localText('ОПАСНОСТЬ КОМНАТЫ', 'ROOM DANGER'))}" data-explain="${esc(roomIntelExplain(room, false))}">${esc(dangerLabel(room))}</span> · ${esc(localText('УГРОЗЫ', 'THREAT'))}: ${esc(currentThreats)} · ${esc(localText('НАГРАДА', 'REWARD'))}: ${esc(currentRewards)}</div>` +
      (currentObjective ? `<div class="room-objective">${currentObjective}</div>` : '');
    const nextModIds = nx ? (nx.mods || []).filter(m => m !== 'static_rain').slice(0, 5) : [];
    const nextModChips = nx ? nextModIds.map(m => modChipSmall(m, nx, m === 'static_rain' && (nx?.staticRainLevel || 0) ? nx.staticRainLevel : 0)) : [];
    const nextMods = nextModChips.slice(0, 5).join(' + ');
    const nextRewards = nx?.rewardTags?.length ? ` · ${localText('НАГРАДА', 'REWARD')}: ${tagJoin(nx.rewardTags)}` : '';
    const nextThreats = nx?.threatTags?.length ? ` · ${localText('УГРОЗЫ', 'THREAT')}: ${tagJoin(nx.threatTags)}` : '';
    const nextStatic = ''; // Static shown only once in the unified top-right readout.
    const nextObjective = nx?.objective ? ` · ${objectiveChip(nx.objective, 'CONTRACT')}` : '';
    const prophecyHud = nx ? `<div class="room-prophecy"><span class="term" data-explain-title="${esc(localText('СЛЕДУЮЩАЯ КОМНАТА', 'NEXT ROOM'))}" data-explain="${esc(roomIntelExplain(nx, true))}">${esc(localText('ДАЛЬШЕ', 'NEXT'))}</span>: ${esc(archLabel(nx.archetype))}${nextMods ? ' · ' + nextMods : ' · ' + esc(localText('ЧИСТО', 'CLEAN'))} · ${esc(dangerLabel(nx))}${esc(nextThreats)}${esc(nextRewards)}${esc(nextStatic)}${nextObjective}</div>` : '';
    let goalHtml = '';
    const liveEnemies = Math.max(0, room.liveEnemies || 0);
    const killGoal = Math.max(0, room.quota || 0);
    const killProgress = Math.min(Math.max(0, room.kills || 0), killGoal);
    const fullClearIds = new Set(['fast_clear','virus_clean','hunter_waves','grid_slow_clear','blood_paid','static_clean','cache_claim','clean_signal']);
    const fullClear = fullClearIds.has(String(room.objective?.id || '')) || room.mods?.includes?.('casino_virus') || room.mods?.includes?.('hunter_contract');
    if (room.phase === 'install') goalHtml = `<span class="done">${t('installPhase')}</span>`;
    else if (room.cat === 'boss') goalHtml = room.portal[2] ? `<span class="done">${t('portalOpen')} — E</span>${skn}` : `${t('killBoss')}${skn}`;
    else if (room.portal[2]) goalHtml = `<span class="done">${t('portalOpen')} — E</span>${skn}`;
    else if (fullClear) goalHtml = `${t('clear')}: ${esc(localText('живых врагов', 'live enemies'))} ${liveEnemies}${skn}`;
    else goalHtml = `${t('clear')} ${killProgress} / ${killGoal}${liveEnemies ? ` · ${esc(localText('живых', 'alive'))} ${liveEnemies}` : ''}${skn}`;
    obj.innerHTML = `${rainHud}${virusHud}${hunterHud}${currentHud}${prophecyHud}<div>${goalHtml}</div>`;
    const contractCard = $('hud-contract-card');
    if (contractCard) {
      if (room.objective && room.phase !== 'install') {
        contractCard.classList.remove('hidden', 'failed', 'done');
        if (room.objective.status === 'failed') contractCard.classList.add('failed');
        else if (room.objective.status === 'done' || room.objective.status === 'done_pending') contractCard.classList.add('done');
        contractCard.innerHTML = contractCardHtml(room.objective);
      } else {
        contractCard.classList.add('hidden');
        contractCard.innerHTML = '';
      }
    }

    // bars — EXP always with denominator
    const hp = me[P.HP], mhp = me[P.MAXHP];
    $('hp-bar').style.width = Math.max(0, hp / mhp * 100) + '%';
    $('hp-text').textContent = `${hp} / ${mhp}`;
    $('xp-bar').style.width = Math.max(0, me[P.XP] / me[P.NEXTXP] * 100) + '%';
    $('xp-text').textContent = `${me[P.XP]} / ${me[P.NEXTXP]}`;
    $('hud-gld').textContent = `GLD ${me[P.GLD]}`;
    $('hud-lvl').textContent = `LVL ${me[P.LVL]}`;
    const inst = $('hud-install');
    if (me[P.PEND] > 0) { inst.textContent = `${localText('УЛУЧШЕНИЕ', 'INSTALL')} x${me[P.PEND]}`; inst.classList.remove('hidden'); }
    else inst.classList.add('hidden');
    const favorEl = $('hud-favor');
    if (favorEl) {
      const active = room.contractFavors?.active || [];
      const pending = room.contractFavors?.pending || [];
      const used = room.contractFavors?.used || [];
      const items = active.length ? active : pending;
      if (items.length) {
        const f = items[0];
        const extra = items.length > 1 ? ` +${items.length - 1}` : '';
        favorEl.classList.remove('hidden', 'used', 'pending');
        if (!active.length) favorEl.classList.add('pending');
        if (String(f.status || '') === 'used' || (f.uses || 0) <= 0) favorEl.classList.add('used');
        favorEl.innerHTML = `<b>${esc(localText('ПРИЗ', 'PRIZE'))}</b> ${esc(this.favorUiLabel(f))}${extra} <em>${esc(this.favorStatusText(f))}${f.uses ? ' x' + f.uses : ''}</em>`;
        this.setExplain(favorEl, localText('ПРИЗ КОНТРАКТА', 'CONTRACT PRIZE'), items.map(x => `${this.favorUiLabel(x)}: ${this.favorUiBody(x)} (${this.favorStatusText(x)})`).join('\n'), active.length ? 'gold' : 'cyan');
      } else if (used.length) {
        const f = used[0];
        favorEl.classList.remove('hidden', 'pending');
        favorEl.classList.add('used');
        favorEl.innerHTML = `<b>${esc(localText('ПРИЗ', 'PRIZE'))}</b> ${esc(this.favorUiLabel(f))} <em>${esc(localText('ИСПОЛЬЗОВАН', 'USED'))}</em>`;
        this.setExplain(favorEl, localText('ПРИЗ ИСПОЛЬЗОВАН', 'PRIZE USED'), localText('Этот приз контракта уже сработал в этой комнате.', 'This contract prize has already triggered in this room.'), 'gold');
      } else {
        favorEl.classList.add('hidden');
        favorEl.innerHTML = '';
      }
    }

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

    const comboEl = $('hud-combo');
    if (comboEl) {
      const comboHtml = renderComboHud(room.combo || {});
      if (comboHtml) { comboEl.classList.remove('hidden'); comboEl.innerHTML = comboHtml; }
      else { comboEl.classList.add('hidden'); comboEl.innerHTML = ''; }
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
        const wd = WEAPONS[w] || WEAPON_BY_LABEL[w];
        s.textContent = `${i + 1} ${wd?.label || w}`;
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
        const bloodBet = (room.mods || []).includes('blood_tax');
        this.setExplain(prompt, t('betTitle'), bloodBet ? localText('В BLOOD TAX ставки платятся HP. Красная цена означает риск для жизни.', 'In BLOOD TAX, bets cost HP. Red prices mean real danger.') : t('betInspect'), 'red');
      } else {
        const blood = (room.mods || []).includes('blood_tax');
        if (near.cost > 0 && blood) prompt.innerHTML = `E / <span class="hp-cost">${near.cost} HP</span> — ${esc(near.label)}`;
        else prompt.textContent = near.cost > 0 ? `E / ${near.cost} GLD — ${near.label}` : `E — ${near.label}`;
        const costTxt = near.cost > 0 ? (blood ? localText(`Нужно ${near.cost} HP. Цена платится здоровьем, не золотом.`, `Need ${near.cost} HP. This price is paid with health, not gold.`) : t('chestNeed', { cost: near.cost })) : t('chestFree');
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
        this.localRerollSpent = 0;
        const mods = (f.mods || []).filter(m => m !== 'static_rain').map(m => roomModLabel(m, state?.room || null)).join(' + ');
        const skn = f.skinRarity ? ` · ${localText('СКРЫТЫЙ СКИН', 'HIDDEN SKIN')} ${rarityText(f.skinRarity)}` : '';
        const arch = f.archetype ? ` · ${archLabel(f.archetype)}` : '';
        const danger = dangerLabel({ danger: f.danger, dangerLabel: f.dangerLabel });
        const threats = Array.isArray(f.threatTags) && f.threatTags.length ? ` · ${localText('УГРОЗЫ', 'THREAT')} ${tagJoin(f.threatTags.slice(0, 3))}` : '';
        const rewards = Array.isArray(f.rewardTags) && f.rewardTags.length ? ` · ${localText('НАГРАДА', 'REWARD')} ${tagJoin(f.rewardTags.slice(0, 3))}` : '';
        this.banner(f.cat === 'boss' ? t('bossFloor') : `${f.roomId}`, `${t('loop')} ${f.loop} · ${t('depth')} ${f.depth}${arch}${mods ? ' · ' + mods : ''} · ${danger}${threats}${rewards}${skn}`,
          f.cat === 'boss' || (f.danger | 0) >= 4 ? 'red' : (f.skinRarity ? 'purple' : (mods ? 'purple' : '')));
        if (f.skinRarity) this.feed(`${t('skinHidden')} · ${rarityText(f.skinRarity)}`, 'p');
        this.cancelActiveRoll(); this.closeCasino(); this.closeWeaponChest(); this.closeAbilityChest();
        break;
      }
      case 'room_invoice': {
        const marks = [];
        if (f.noHit) marks.push(localText('БЕЗ УРОНА', 'NO HIT'));
        if (f.fast) marks.push(localText('БЫСТРО', 'FAST'));
        if (f.staticPaid) marks.push(localText('СТАТИКА ОПЛАЧЕНА', 'STATIC PAID'));
        // Static preview is shown only in the unified top-right readout.
        if (f.bonusGld) marks.push(`${localText('БОНУС GLD', 'BONUS GLD')} +${f.bonusGld}`);
        if (f.bonusExp) marks.push(`${localText('БОНУС EXP', 'BONUS EXP')} +${f.bonusExp}`);
        if (f.objective) {
          if (f.objective.done) {
            const fs = (f.contractFavorsEarned || []).map(x => this.favorUiLabel(x)).join(' + ');
            marks.push(`${localText('КОНТРАКТ ОПЛАЧЕН', 'CONTRACT PAID')} ${locLabel(f.objective.label)}${fs ? ' · ' + localText('ПРИЗ', 'PRIZE') + ' ' + fs : ''}`);
          } else {
            marks.push(`${localText('КОНТРАКТ ПРОВАЛЕН', 'CONTRACT FAILED')} ${locLabel(f.objective.label)}${f.objective.failReason ? ' / ' + locFail(f.objective.failReason) : ''}`);
          }
        }
        if (f.contractChain >= 2) marks.push(`${localText('СЕРИЯ КОНТРАКТОВ', 'CONTRACT CHAIN')} x${f.contractChain}`);
        const tapes = Array.isArray(f.tapes) && f.tapes.length ? ` · ${localText('ПЛЁНКА', 'TAPE')}: ${f.tapes.map(locLabel).join(' / ')}` : '';
        const solved = Number.isFinite(Number(f.solvedTime)) ? ` · ${localText('РЕШЕНО', 'SOLVED')} ${Math.max(0, Math.round(Number(f.solvedTime)))}s` : '';
        const line = `${localText('УБИЙСТВА', 'KILLS')} ${f.kills || 0}${solved} · GLD +${f.gld || 0} · EXP +${f.exp || 0} · ${localText('УРОН', 'DMG')} ${f.dmg || 0}${marks.length ? ' · ' + marks.join(' / ') : ''}${tapes}`;
        this.banner(localText('ИТОГ КОМНАТЫ', 'ROOM RESULT'), line, f.noHit || f.fast ? 'green' : '');
        this.feed(`${localText('ИТОГ КОМНАТЫ', 'ROOM RESULT')}: ${line}`, f.noHit ? 'g' : '');
        break;
      }
      case 'join': this.feed(`${f.name} ${t('playerJoined')}`, 'g'); break;
      case 'leave': this.feed(`${f.name} ${t('playerLeft')}`, 'r'); break;
      case 'levelup':
        if (f.id === myId) { this.feed(`${localText('УРОВЕНЬ', 'LEVEL UP')} → ${f.level} · ${localText('УЛУЧШЕНИЕ', 'INSTALL')} x${f.pending}`, 'g'); document.getElementById('hud-left')?.classList.add('level-pulse'); setTimeout(() => document.getElementById('hud-left')?.classList.remove('level-pulse'), 850); }
        break;
      case 'pdown': this.feed(`${name(f.id)} ${t('down')}`, 'r'); if (f.id === myId) { this.cancelActiveRoll(); this.closeCasino(); this.banner(t('youDown'), t('carry'), 'red'); } break;
      case 'director_room':
        this.feed(`${t('eventSignal')}: ${localText('новая угроза', 'new threat')}`, 'c');
        break;
      case 'gld_hit': if (f.id === myId) { this.feed(`${localText('ЖАДНОСТЬ УДАР', 'GREED HIT')} -${f.cost || 0} GLD · BAL ${f.balance ?? 0}`, 'r'); } break;
      case 'casino_virus_spin': this.virusRoll(f); this.feed(`${localText('КАЗИНО-ВИРУС', 'CASINO VIRUS')}: ${locLabel(f.label || 'EVENT')} · ${f.spinsLeft || 0} ${localText('БРОСКОВ ОСТАЛОСЬ', 'SPINS LEFT')}`, 'p'); break;
      case 'director_wave':
        this.feed(`${localText('ВОЛНА', 'WAVE')} · ${f.count || 0}`, f.intent === 'armor' ? 'p' : (f.intent === 'ranged' || f.intent === 'control' ? 'c' : 'r'));
        break;
      case 'combo_payout': {
        const prize = comboPrizeLabel(f.type);
        const kills = Math.max(0, f.kills | 0);
        const mult = Number(f.mult || 1).toFixed(1);
        const amount = Math.max(0, f.amount | 0);
        this.feed(`${localText('КОМБО', 'COMBO')} ${kills} × x${mult} → +${amount} ${prize}`, f.type === 'hp' ? 'g' : 'c');
        break;
      }
      case 'skin_room': break;
      case 'skin_room_ready': this.banner(t('skinReady'), `${localText('карточка скина появится отдельно', 'skin card appears separately')} · ${rarityText(f.skinRarity)}`, 'purple'); this.feed(`${t('skinReady')} · ${rarityText(f.skinRarity)}`, 'p'); break;
      case 'portal_open': this.banner(t('portalOpen'), f.skinRarity ? `${localText('скин ждёт отдельной карточкой', 'skin waits as a separate card')} · ${rarityText(f.skinRarity)}` : t('portalNext'), f.skinRarity ? 'purple' : 'green'); this.feed(f.skinRarity ? `${t('portalOpen')} · ${localText('СКИН ГОТОВ', 'SKIN READY')} ${rarityText(f.skinRarity)}` : t('portalOpen'), f.skinRarity ? 'p' : 'g'); break;
      case 'boss_down': this.banner(t('bossDown'), t('loot'), 'green'); break;
      case 'chest_open':
        if (f.id === myId) this.feed(`${locLabel(f.chest)}: ${(f.rewards || []).map(locReward).join(' + ')}`, f.cursed ? 'p' : 'g');
        break;
      case 'weapon_get': this.feed(`${name(f.id)} ${localText('ВЗЯЛ', 'TOOK')} ${f.w}`, 'c'); break;
      case 'weapon_mod': if (f.id === myId) this.feed(`WPN: ${locLabel(f.label)}`, 'c'); break;
      case 'ability_get': if (f.id === myId) this.feed(locLabel(f.label), 'c'); break;
      case 'active': if (f.id === myId) this.feed(`Q: ${locLabel(f.label)}`, 'c'); break;
      case 'active_denied': if (f.id === myId) { const msg = denyText(f); if (msg) { this.denyPrompt(msg); this.feed(`Q: ${msg}`, 'r'); } } break;
      case 'contract': this.banner(locLabel(f.label || t('contract')), t('contractBody'), 'red'); break;
      case 'contract_done': this.banner(t('contractDone'), `${locLabel(f.label || '')}${f.body ? ' · ' + cleanPlayerText(f.body) : ''}`, 'green'); break;
      case 'contract_paid': this.banner(t('contractPaid'), `${locLabel(f.label || '')}${f.body ? ' · ' + cleanPlayerText(f.body) : ''}`, 'green'); break;
      case 'favor_earned': { const fs = (f.favors || []).map(x => `${this.favorUiLabel(x)}${x.uses > 1 ? ' x' + x.uses : ''}`).join(' + '); this.banner(localText('ПРИЗ ПОЛУЧЕН', 'PRIZE RECEIVED'), fs || localText('Следующая комната', 'Next room'), 'gold'); this.feed(`${localText('ПОЛУЧЕН ПРИЗ', 'PRIZE RECEIVED')}: ${fs}`, 'g'); break; }
      case 'favor_active': { const fs = (f.favors || []).map(x => this.favorUiLabel(x)).join(' + '); if (fs) this.feed(`${localText('БОНУС КОНТРАКТА АКТИВЕН', 'CONTRACT BONUS ACTIVE')}: ${fs}`, 'g'); break; }
      case 'favor_used': this.banner(localText('БОНУС ИСПОЛЬЗОВАН', 'BONUS USED'), `${this.favorUiLabel(f)}${f.body ? ' · ' + cleanPlayerText(f.body) : ''}`, 'gold'); break;
      case 'contract_fail': this.banner(t('contractFail'), `${locLabel(f.label || '')}${f.body ? ' · ' + cleanPlayerText(f.body) : ''}`, 'red'); break;
      case 'denied': if (f.id === myId) { const msg = denyText(f); if (msg) this.denyPrompt(msg); } break;
      case 'bet_ui': if (f.id === myId) this.openCasino(); break;
      case 'casino': this.casinoResult(f, myId); break;
      case 'active_casino_roll': if (f.id === myId) this.activeRoll(f); break;
      case 'install': if (f.id === myId) this.feed(`${localText('УЛУЧШЕНИЕ', 'INSTALL')}: ${locLabel(f.label)}`, f.cursed ? 'p' : 'g'); break;
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
    while (feed.children.length > 9) feed.lastChild.remove();
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

  clearVirusRollSpin() {
    const st = this.virusRollSpin || { timers: [], intervals: [], token: 0 };
    for (const t of st.timers || []) clearTimeout(t);
    for (const iv of st.intervals || []) clearInterval(iv);
    this.virusRollSpin = { token: (st.token || 0) + 1, timers: [], intervals: [] };
    const el = $('virus-roll');
    if (el) { el.className = 'hidden'; el.innerHTML = ''; }
  }

  virusRoll(f) {
    const el = $('virus-roll');
    if (!el) {
      this.banner(localText('КАЗИНО-ВИРУС', 'CASINO VIRUS'), `${locLabel(f.label || 'VIRUS EVENT')} · ${f.spinsLeft || 0} ${localText('БРОСКОВ ОСТАЛОСЬ', 'SPINS LEFT')}`, 'purple');
      return;
    }
    this.clearVirusRollSpin();
    const token = this.virusRollSpin.token;
    const reelPool = ['MOB', 'RAIN', 'BIG', 'ELT', 'HER', 'GLD', 'BAD', 'STC', 'BOSS', 'PAY'];
    const symbols = Array.isArray(f.symbols) && f.symbols.length ? f.symbols.slice(0, 3) : ['VIR', 'ROLL', '?'];
    const bad = String(f.label || '').toUpperCase().includes('BOSS') || String(f.label || '').toUpperCase().includes('BIG') || String(f.label || '').toUpperCase().includes('ELITE');
    el.className = 'spinning';
    el.innerHTML = `<div class="roll-title">${esc(localText('КАЗИНО-ВИРУС', 'CASINO VIRUS'))}</div>` +
      `<div class="roll-symbols"><span>—</span><span>—</span><span>—</span></div>` +
      `<div class="roll-result">${localText('ВИРУС КРУТИТСЯ...', 'VIRUS ROLLING...')}</div>` +
      `<div class="roll-left">${Math.max(0, f.spinsLeft || 0)} ${localText('БРОСКОВ ОСТАЛОСЬ', 'SPINS LEFT')}</div>`;
    el.classList.remove('hidden');
    const spans = [...el.querySelectorAll('.roll-symbols span')];
    spans.forEach((sp, i) => {
      const iv = setInterval(() => {
        sp.textContent = reelPool[Math.floor(Math.random() * reelPool.length)];
        if (i === 0) this.playUiSound('casino_spin');
      }, 58 + i * 8);
      this.virusRollSpin.intervals.push(iv);
    });
    const stop = setTimeout(() => {
      if (this.virusRollSpin.token !== token) return;
      el.className = 'stopping';
      spans.forEach((sp, i) => {
        const timer = setTimeout(() => {
          if (this.virusRollSpin.token !== token) return;
          const iv = this.virusRollSpin.intervals[i];
          if (iv) clearInterval(iv);
          sp.textContent = String(symbols[i] || '?').slice(0, 4);
          sp.classList.add(bad ? 'lose' : 'win');
          this.playUiSound('casino_reel_stop');
          if (i === 2) {
            this.virusRollSpin.intervals.forEach(x => clearInterval(x));
            this.virusRollSpin.intervals = [];
            const res = el.querySelector('.roll-result');
            if (res) res.textContent = f.label || 'VIRUS EVENT';
            const left = el.querySelector('.roll-left');
            if (left) left.textContent = `${Math.max(0, f.spinsLeft || 0)} ${localText('БРОСКОВ ОСТАЛОСЬ', 'SPINS LEFT')}`;
            this.banner(localText('КАЗИНО-ВИРУС', 'CASINO VIRUS'), `${locLabel(f.label || 'VIRUS EVENT')} · ${Math.max(0, f.spinsLeft || 0)} ${localText('БРОСКОВ ОСТАЛОСЬ', 'SPINS LEFT')}`, bad ? 'red' : 'purple');
            this.playUiSound(bad ? 'casino_static' : 'casino_result');
            const hide = setTimeout(() => { if (this.virusRollSpin.token === token) el.classList.add('hidden'); }, 1700);
            this.virusRollSpin.timers.push(hide);
          }
        }, 155 * (i + 1));
        this.virusRollSpin.timers.push(timer);
      });
    }, 720);
    this.virusRollSpin.timers.push(stop);
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
      el.innerHTML = `<div class="roll-title">${esc(localText('МУТАЦИЯ КАЗИНО', 'CASINO MUTATION ROLL'))}</div>` +
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
      el.innerHTML = `<div class="roll-title">${esc(localText('МУТАЦИЯ КАЗИНО', 'CASINO MUTATION ROLL'))}</div>` +
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
          if (res) res.textContent = locLabel(f.label || f.outcome || 'ROLL');
          this.feed(`${localText('МУТАЦИЯ КАЗИНО', 'CASINO MUTATION')}: ${locLabel(f.label || f.outcome || 'ROLL')}`, tone === 'red' ? 'r' : tone === 'purple' ? 'p' : 'g');
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
    const modLabels = (room.mods || []).filter(m => m !== 'static_rain').map(m => roomModLabel(m, room));
    const next = room.next || null;
    const explainAttr = (title, body, tone = '') => `data-explain-title="${esc(title)}" data-explain="${esc(body)}"${tone ? ` data-explain-tone="${tone}"` : ''}`;
    const tabRoomHint = (r, isNext = false) => `${isNext ? localText('Следующая комната.', 'Next room.') : localText('Текущая комната.', 'Current room.')} ${localText('Главное правило смотри на подчёркнутых модификаторах.', 'Hover underlined modifiers for the actual rules.')}`;
    const termLabel = (label, title, body, tone = '') => `<span class="term" ${explainAttr(title, body, tone)}>${esc(label)}</span>`;
    const modChip = (m, r = room) => `<span class="term" ${explainAttr(roomModLabel(m, r), roomModHint(m, r), m === 'static_rain' || m === 'prism_grid' ? 'cyan' : m === 'blood_tax' || m === 'moving_room' || m === 'hunter_contract' ? 'red' : m === 'echo_walls' || m === 'casino_virus' ? 'purple' : m === 'greed' ? 'gold' : '')}>${esc(roomModLabel(m, r))}</span>`;
    const modList = (r) => (r?.mods || []).filter(m => m !== 'static_rain').length ? (r.mods || []).filter(m => m !== 'static_rain').map(m => modChip(m, r)).join(' ') : `<span class="muted">${esc(localText('ЧИСТО', 'CLEAN'))}</span>`;
    const tabStaticBd = room.staticRainBreakdown || { total: room.staticRainStacks || 0, sources: [] };
    const tabNextStaticBd = room.next?.staticRainBreakdown || room.staticRainNextBreakdown || null;
    const nextStaticLine = (tabStaticBd.total || 0) > 0
      ? staticBreakdownText(tabStaticBd)
      : (tabNextStaticBd ? staticBreakdownText(tabNextStaticBd, tabNextStaticBd.banked || 0) : '—');
    const portalState = room.portal?.[2] ? localText('ОТКРЫТ', 'OPEN') : localText('ЗАКРЫТ', 'CLOSED');
    const mem = room.runMemory || {};
    $('tab-run').innerHTML =
      `<div class="tab-dossier">` +
        `<div class="tab-card current"><h3><span class="term" ${explainAttr(localText('ТЕКУЩАЯ КОМНАТА', 'CURRENT ROOM'), tabRoomHint(room, false), 'cyan')}>${esc(localText('СЕЙЧАС', 'NOW'))}</span> ${esc(archLabel(room.archetype))}</h3>` +
          `<div>${modList(room)}</div>` +
          `<p><span class="term" ${explainAttr(localText('ОПАСНОСТЬ', 'DANGER'), localText('Общий риск комнаты: враги, модификаторы и темп волн.', 'Overall room risk: enemies, modifiers, and wave pressure.'), 'red')}>${esc(dangerLabel(room))}</span></p>` +
          `<p>${termLabel(localText('УГРОЗЫ', 'THREAT'), localText('УГРОЗЫ', 'THREAT'), localText('Короткие теги того, что опаснее всего в этой комнате.', 'Short tags for the main dangers in this room.'), 'red')}: ${esc(tagJoin(room.threatTags, localText('ОБЫЧНО', 'NORMAL')))}</p>` +
          `<p>${termLabel(localText('НАГРАДА', 'REWARD'), localText('НАГРАДА', 'REWARD'), localText('Что здесь можно получить.', 'What this room can pay out.'), 'gold')}: ${esc(tagJoin(room.rewardTags, localText('ОБЫЧНО', 'NORMAL')))}</p>` +
          (room.objective ? `<p>${objectiveChip(room.objective, 'CONTRACT')}</p>` : '') +
          `</div>` +
        `<div class="tab-card next"><h3><span class="term" ${explainAttr(localText('СЛЕДУЮЩАЯ КОМНАТА', 'NEXT ROOM'), next ? tabRoomHint(next, true) : '—', 'cyan')}>${esc(localText('ДАЛЬШЕ', 'NEXT'))}</span> ${next ? esc(archLabel(next.archetype)) : '—'}</h3>` +
          `<div>${next ? modList(next) : '<span class="muted">—</span>'}</div>` +
          `<p>${next ? termLabel(dangerLabel(next), localText('ОПАСНОСТЬ', 'DANGER'), localText('Примерный риск следующей комнаты.', 'Estimated risk of the next room.'), 'red') : esc(localText('ОПАСНОСТЬ —', 'DANGER —'))}</p>` +
          `<p>${termLabel(localText('УГРОЗЫ', 'THREAT'), localText('УГРОЗЫ', 'THREAT'), localText('Короткие теги опасностей следующей комнаты.', 'Short danger tags for the next room.'), 'red')}: ${next ? esc(tagJoin(next.threatTags, localText('ОБЫЧНО', 'NORMAL'))) : '—'}</p>` +
          `<p>${termLabel(localText('НАГРАДА', 'REWARD'), localText('НАГРАДА', 'REWARD'), localText('Что может дать следующая комната.', 'What the next room can pay out.'), 'gold')}: ${next ? esc(tagJoin(next.rewardTags, localText('ОБЫЧНО', 'NORMAL'))) : '—'}</p>` +
          (next?.objective ? `<p>${objectiveChip(next.objective, 'CONTRACT')}</p>` : '') +
          `</div>` +
        `<div class="tab-card run"><h3>${esc(localText('ЗАБЕГ', 'RUN'))}</h3>` +
          `<p><span class="term" ${explainAttr(t('loopTitle'), t('loopBody'))}>${esc(t('loop'))}</span> ${room.loop} · <span class="term" ${explainAttr(t('depth'), localText('Сколько комнат уже пройдено в текущем забеге.', 'Rooms cleared in this run.'))}>${esc(t('depth'))}</span> ${room.depth}</p>` +
          `<p><span class="term" ${explainAttr(t('room'), t('roomBody'))}>${esc(t('room'))}</span> ${esc(room.id)} · <span class="term" ${explainAttr(t('code'), t('codeBody'))}>${esc(t('code'))}</span> ${esc(this.net.roomId || '----')}</p>` +
          `<p><span class="term" ${explainAttr(t('goal'), localText('Портал откроется, когда комната полностью затихнет и враги добиты.', 'The portal opens when the room has fully gone quiet and enemies are down.'))}>${esc(t('clear'))}</span> ${esc(Math.min(Math.max(0, room.kills || 0), Math.max(0, room.quota || 0)))}/${esc(Math.max(0, room.quota || 0))} · ${esc(localText('ЖИВЫХ', 'ALIVE'))} ${esc(Math.max(0, room.liveEnemies || 0))} · ${esc(localText('ПОРТАЛ', 'PORTAL'))} ${esc(portalState)}</p>` +
          `<p><span class="term" ${explainAttr(localText('СТАТИК-ШТОРМ', 'STATIC STORM'), staticBreakdownExplain(tabStaticBd.total ? tabStaticBd : (tabNextStaticBd || {}), tabNextStaticBd?.banked || 0), 'cyan')}>${esc(localText('СТАТИК', 'STATIC'))}</span> ${esc(nextStaticLine)}</p>` +
          `<p><span class="term" ${explainAttr(localText('СЕРИЯ КОНТРАКТОВ', 'CONTRACT CHAIN'), localText('Чем дольше серия выполненных контрактов, тем ценнее забег.', 'A longer contract streak makes the run more valuable.'), 'gold')}>${esc(localText('СЕРИЯ КОНТРАКТОВ', 'CONTRACT CHAIN'))}</span> x${esc(mem.contractStreak || 0)} / BEST x${esc(mem.bestContractStreak || 0)} · ${esc(localText('ПРИЗЫ', 'PRIZES'))} ${esc(mem.favorsEarned || 0)}</p>` +
          `${(room.contractFavors?.active || []).length ? `<p><span class="term" ${explainAttr(localText('БОНУСЫ КОНТРАКТА', 'CONTRACT BONUSES'), (room.contractFavors.active || []).map(f => `${this.favorUiLabel(f)}: ${this.favorUiBody(f)} (${this.favorStatusText(f)})`).join('\n'), 'gold')}>${esc(localText('БОНУСЫ', 'BONUSES'))}</span> ${(room.contractFavors.active || []).map(f => `${esc(this.favorUiLabel(f))} · ${esc(this.favorStatusText(f))}${f.uses ? ` x${esc(f.uses)}` : ''}`).join(' · ')}</p>` : ''}` +
          `${(room.contractFavors?.pending || []).length ? `<p><span class="term" ${explainAttr(localText('НА СЛЕДУЮЩУЮ КОМНАТУ', 'NEXT ROOM'), localText('Эти бонусы ждут следующую комнату.', 'These bonuses are waiting for the next room.'), 'gold')}>${esc(localText('СЛЕД. БОНУС', 'NEXT BONUS'))}</span> ${(room.contractFavors.pending || []).map(f => esc(contractFavorPreviewLabel(f))).join(' · ')}</p>` : ''}</div>` +
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
      `<th><span class="term" data-explain-title="${esc(t('installTitle'))}" data-explain="${esc(t('installBody'))}">${esc(t('installTitle'))}</span></th>` +
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
  openInstall(choices, pending, offerId = 0) {
    this.install = { open: true, choices, offerId: Math.max(0, offerId | 0), expires: 24, total: 24, locked: false };
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
    this.appendSkinClaimCard(box);
    $('install-modal').classList.remove('hidden');
  }
  pick(i) {
    // guard against double-picks: lock until the next offer (or close) arrives
    if (this.install.locked || !this.install.open) return;
    if (i < 0 || i >= this.install.choices.length) return;
    this.install.locked = true;
    const els = document.querySelectorAll('#install-choices .choice');
    els.forEach((el, j) => el.classList.add(j === i ? 'picked' : 'dimmed'));
    this.net.sendPick(i, this.install.offerId || 0);
  }
  pickRandomInstall() {
    if (!this.install.open || this.install.locked || !this.install.choices.length) return false;
    this.pick(Math.floor(Math.random() * this.install.choices.length));
    return true;
  }
  closeInstall() { this.install.open = false; this.install.locked = false; this.install.skinOnly = false; $('install-modal').classList.add('hidden'); this.hideTip(); }

  openSkinClaim(skin = {}) {
    if (!skin?.id && !skin?.name && !skin?.allOwned) return;
    this.skinClaim = { ...skin, claimed: false };
    const box = $('install-choices');
    if (!this.install.open) {
      this.install = { open: true, choices: [], expires: 15, total: 15, locked: false, skinOnly: true };
      $('install-pending').textContent = localText('SKN', 'SKN');
      if (box) box.innerHTML = '';
      $('install-modal')?.classList.remove('hidden');
    }
    this.appendSkinClaimCard(box);
  }
  appendSkinClaimCard(box) {
    if (!box || !this.skinClaim || this.skinClaim.claimed) return;
    box.querySelectorAll('.skin-claim-card').forEach(x => x.remove());
    const skin = this.skinClaim;
    const d = document.createElement('div');
    d.className = `choice skin-claim-card rarity-${String(skin.rarity || (skin.allOwned ? 'complete' : '')).replace(/[^a-z0-9_-]/gi, '')}`;
    if (skin.allOwned) {
      d.innerHTML = `<div class="skin-claim-top"><span class="key">SKN</span><span class="skin-claim-title">${esc(localText('ВСЕ СКИНЫ ОТКРЫТЫ', 'ALL SKINS UNLOCKED'))}</span><span class="skin-claim-rarity">100%</span></div><span class="choice-sub">${esc(localText('Коллекция уже полная.', 'Collection already complete.'))}</span>`;
      this.setExplain(d, localText('КОЛЛЕКЦИЯ ЗАВЕРШЕНА', 'COLLECTION COMPLETE'), localText('Все доступные облики уже открыты.', 'Every available look is already unlocked.'), 'gold');
    } else {
      d.innerHTML = `<div class="skin-claim-top"><span class="key">SKN</span><span class="skin-claim-title">${esc(localText('ЗАБРАТЬ СКИН', 'CLAIM SKIN'))}</span><span class="skin-claim-rarity">${esc(rarityText(skin.rarity || 'skin'))}</span></div><span class="choice-sub">${esc(skin.name || skin.id || 'SKIN')}</span>`;
      this.setExplain(d, localText('СКИН ГОТОВ', 'SKIN READY'), localText('Скин уже открыт для забега. Нажми, чтобы закрыть карточку и отметить его как забранный.', 'The skin is unlocked for the run. Click to close this card and mark it claimed.'), 'purple');
    }
    d.addEventListener('click', () => { this.playUiSound(skin.allOwned ? 'ui_click' : 'install'); this.skinClaim.claimed = true; d.classList.add('picked'); d.remove(); if (this.install.skinOnly) this.closeInstall(); });
    box.prepend(d);
  }

  favorUiLabel(f = {}) {
    const id = String(f.id || '');
    const ru = {
      free_reroll: 'РЕРОЛЛ ВЫБОРА', clear_debt: 'СНЯТЬ СТАТИК-ШТОРМ',
      portal_insurance: 'СТРАХОВКА ОТ СМЕРТИ', epic_reroll: 'ДВА РЕРОЛЛА ВЫБОРА', double_favor: 'ДВОЙНОЙ СЛЕД. ПРИЗ'
    };
    const en = {
      free_reroll: 'CHEST REROLL', clear_debt: 'CLEAR STATIC STORM',
      portal_insurance: 'DEATH INSURANCE', epic_reroll: 'DOUBLE REROLL', double_favor: 'DOUBLE NEXT PRIZE'
    };
    return localText(ru[id] || f.labelRu || f.label || id.toUpperCase(), en[id] || f.label || id.toUpperCase());
  }
  favorUiBody(f = {}) {
    const id = String(f.id || '');
    const ru = {
      free_reroll: 'Один раз обновляет варианты WPN/ABL в этой комнате.',
      clear_debt: 'Ослабляет следующий статик-шторм перед входом в комнату.',
      portal_insurance: 'Один раз в этой комнате смертельный удар оставит тебя живым и даст 50 HP.',
      epic_reroll: 'Два раза обновляет варианты WPN/ABL в этой комнате.',
      double_favor: 'Если контракт выполнен, после комнаты будет два приза.'
    };
    const en = {
      free_reroll: 'Refreshes WPN/ABL choices once in this room.',
      clear_debt: 'Weakens the next Static Storm before you enter the room.',
      portal_insurance: 'Once this room, lethal damage keeps you alive and restores 50 HP.',
      epic_reroll: 'Refreshes WPN/ABL choices twice in this room.',
      double_favor: 'If the contract succeeds, the room grants two prizes.'
    };
    return localText(ru[id] || 'Бонус контракта действует только в этой комнате.', en[id] || 'Contract bonus for this room only.');
  }
  favorStatusText(f = {}) {
    const status = String(f.status || '').toLowerCase();
    const left = Math.max(0, f.uses || 0);
    if (status === 'used' || left <= 0) return localText('ИСПОЛЬЗОВАН', 'USED');
    if (status === 'pending') return localText('БУДЕТ АКТИВЕН', 'PENDING');
    return localText('АКТИВЕН', 'ACTIVE');
  }
  activeRerollFavorUses() {
    const active = this.latestRoom?.contractFavors?.active || [];
    const roomKey = `${this.latestRoom?.id || this.latestRoom?.roomId || ''}:${this.latestRoom?.depth || this.latestRoom?.runDepth || ''}`;
    if (this.rerollSpentRoomKey !== roomKey) { this.rerollSpentRoomKey = roomKey; this.localRerollSpent = 0; }
    const serverLeft = active.reduce((n, f) => n + ((f.id === 'free_reroll' || f.id === 'epic_reroll') ? Math.max(0, f.uses || 0) : 0), 0);
    return Math.max(0, serverLeft - Math.max(0, this.localRerollSpent || 0));
  }
  appendFavorRerollButton(box, kind) {
    let uses = this.activeRerollFavorUses();
    if (!box || uses <= 0) return;
    const d = document.createElement('div');
    d.className = 'choice favor-reroll';
    d.innerHTML = `<div class="favor-reroll-top"><span class="key favor-key">↻</span><span class="favor-reroll-title">${esc(localText('ПРИЗ КОНТРАКТА', 'CONTRACT PRIZE'))}</span><span class="favor-uses">x${uses}</span></div><span class="choice-sub">${esc(localText('РЕРОЛЛ ВЫБОРА · только эта комната', 'CHOICE REROLL · this room only'))}</span>`;
    this.setExplain(d, localText('РЕРОЛЛ ВЫБОРА', 'CHOICE REROLL'), localText('Обновляет варианты этого WPN/ABL выбора.', 'Refreshes the choices for this WPN/ABL pick.'), 'gold');
    d.addEventListener('click', () => {
      if (d.dataset.locked === '1' || uses <= 0) return;
      this.playUiSound('contract');
      d.dataset.locked = '1';
      d.classList.add('picked');
      this.localRerollSpent = Math.max(0, this.localRerollSpent || 0) + 1;
      uses = Math.max(0, uses - 1);
      this.net.sendRerollOffer(kind);
      if (uses <= 0) d.remove();
      else {
        const u = d.querySelector('.favor-uses'); if (u) u.textContent = `x${uses}`;
        setTimeout(() => { if (d.isConnected) { d.dataset.locked = '0'; d.classList.remove('picked'); } }, 250);
      }
    });
    box.appendChild(d);
  }

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
      const elementTag = elementClass ? `<span class="wpn-tag element ${elementClass}">${esc(weaponElementLabel(elementClass))}</span>` : '';
      const roleName = weaponRoleLabel(meta.role);
      const roleTag = `<span class="wpn-role ${meta.tone || 'utility'}">${esc(roleName)}</span>`;
      d.innerHTML = `
        <div class="wpn-choice-top"><span><span class="key">[${i + 1}]</span>${esc(locLabel(opt.label || opt.id))}</span><span class="wpn-tags">${roleTag}${elementTag}</span>${locked}</div>
        <span class="wpn-choice-read">${esc(meta.summary)}</span>
        <span class="wpn-choice-change">${esc(meta.change)}</span>`;
      const title = opt.disabled ? `${locLabel(opt.label || opt.id)} / ${t('unavailable').toUpperCase()}` : `${locLabel(opt.label || opt.id)} · ${roleName}`;
      const body = `${weaponRoleHint(meta.role)} ${meta.summary} ${meta.change}. ${optionDesc(opt)} ${opt.disabled ? `${t('unavailable')}: ${disabledReason(opt.disabledReason)}.` : t('available')}`;
      this.setExplain(d, title, body, opt.disabled ? 'red' : (meta.tone === 'dps' ? 'green' : 'cyan'));
      d.addEventListener('click', () => {
        if (opt.disabled) { this.playUiSound('denied'); return; }
        this.pickWeapon(i);
      });
      box.appendChild(d);
    });
    this.appendFavorRerollButton(box, 'weapon');
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
      const group = opt.group || (String(opt.kind || '').includes('mutation') ? 'MUTATION' : String(opt.kind || '').includes('core') ? 'Q' : 'SIDE');
      const groupLabel = group === 'CORE' ? 'Q' : group === 'MUTATION' ? localText('МУТАЦИЯ', 'MUTATION') : group === 'SIDE' ? localText('ДОП.', 'SIDE') : group;
      const rarity = opt.rarity || opt.tone || (String(opt.actionLabel || '').includes('ЗАМЕНИТ') ? 'rare' : group.toLowerCase());
      const tone = opt.disabled ? 'red' : (opt.tone || (rarity === 'cursed' ? 'red' : rarity === 'rare' ? 'purple' : (group === 'CORE' || group === 'Q') ? 'cyan' : 'green'));
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
          <div class="abl-tags"><span class="rarity-tag">${esc(String(groupLabel).toUpperCase())}</span>${role}${locked}</div>
        </div>`;
      const title = opt.disabled ? `${locLabel(opt.label || opt.id)} / ${t('unavailable').toUpperCase()}` : `${locLabel(opt.label || opt.id)} / ${String(groupLabel).toUpperCase()}`;
      const body = `${opt.actionLabel ? locAction(opt.actionLabel) + ': ' : ''}${optionDesc(opt)}${opt.disabled ? `\n\n${t('unavailable')}: ${disabledReason(opt.disabledReason)}.` : '\n\n' + t('available')}`;
      this.setExplain(d, title, body, opt.disabled ? 'red' : tone);
      d.addEventListener('click', () => {
        if (opt.disabled) { this.playUiSound('denied'); return; }
        this.pickAbility(i);
      });
      box.appendChild(d);
    });
    this.appendFavorRerollButton(box, 'ability');
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
    const errors = { 'BET FAILED': t('betFailed'), 'not enough GLD': t('gldLack'), 'НЕДОСТАТОЧНО GLD': t('gldLack'), 'НЕДОСТАТОЧНО HP': localText('НЕТ HP', 'NO HP'), 'not enough HP': localText('НЕТ HP', 'NO HP'), 'invalid stake': t('invalidStake') };
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
      const paidUnit = f.bloodTax ? 'HP' : 'GLD';
      const paid = f.bloodTax ? (f.hpStake || f.stake) : f.stake;
      const parts = [`-${paid} ${paidUnit}`];
      if (pl.gld) parts.push(`+${pl.gld} GLD`);
      if (pl.xp) parts.push(`+${pl.xp} EXP`);
      if (pl.heal) parts.push(`+${pl.heal} HP`);
      if (pl.dash) parts.push(locLabel('DASH +1'));
      if (pl.abilityLabel) parts.push(locLabel(pl.abilityLabel));
      if (pl.weaponLabel) parts.push(locLabel(pl.weaponLabel));
      if (pl.skinLabel) parts.push(`${localText('СКИН', 'SKN')}: ${pl.skinLabel}${pl.skinRarity ? ' / ' + rarityText(pl.skinRarity) : ''}`);
      if (pl.static) parts.push(t('nextRoomDebt'));
      if (f.outcome === 'JCK') parts.unshift(t('jackpot'));
      if (pl.gld && !f.bloodTax) parts.push(`${localText('ИТОГ', 'NET')} ${pl.gld - f.stake >= 0 ? '+' : ''}${pl.gld - f.stake} GLD`);
      el.innerHTML = parts.map(x => `<span>${esc(x)}</span>`).join('');
      this.feed(`${localText('BET НАГРАДА', 'BET REWARD')}: ${parts.map(locLabel).join(' · ')}`, f.outcome === 'LOSE' ? 'r' : f.outcome === 'STC' ? 'p' : 'g');
      el.style.color = f.outcome === 'LOSE' ? '#ff3048' : f.outcome === 'STC' ? '#b45cff' : '#00ff66';
      this.playUiSound(f.outcome === 'JCK' ? 'jackpot' : f.outcome === 'LOSE' ? 'casino_lose' : f.outcome === 'STC' ? 'casino_static' : f.outcome === 'WPN' ? 'casino_weapon' : (f.outcome === 'ABL' || f.outcome === 'SKN') ? 'casino_ability' : 'casino_win');
    }, 640);
    this.casino.reelTimers.push(timer);
  }

}
