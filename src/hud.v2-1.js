// terminal casino roguelike HUD: bars, pips, feed, banners, TAB panel, install + casino modals
import { P, ENEMY_KINDS } from './state.v2-1.js';
import { UPGRADES, WEAPONS, CHESTS, SECTOR_MODS, BET_STAKES, ENEMIES, ACTIVE_CORES, ACTIVE_MUTATIONS, defaultStats } from '../shared/data.v2-1.js';
import { t, onLangChange, getLang, cleanPlayerText, activeNoneLabel, activeNoneDesc, activeShort as locActiveShort, activeDescFrom, chestDesc, pickupDesc, enemyDesc, weaponDesc, optionDesc, locAction, locRole, locLabel, locReward, disabledReason, objectStateText, priceText, localText, denyText, esc as escHtml } from './i18n.v2-1.js';
import { reconcileRerollAvailability } from './reroll-sync.v2-1.js';

const $ = id => document.getElementById(id);
const MOD_LABELS = Object.fromEntries(Object.values(SECTOR_MODS).map(m => [m.id, m.label]));
const WEAPON_BY_LABEL_LOCAL = Object.fromEntries(Object.values(WEAPONS).map(w => [w.label, w]));
const ARCH_LABELS = { panic_box: 'PANIC BOX', compact: 'COMPACT', standard: 'STANDARD', wide: 'WIDE FIELD', long_lane: 'LONG LANE', lounge: 'CASINO LOUNGE', boss: 'BOSS FLOOR', trinode_chase: 'TRI CHASE GRID', ripped_table: 'RIPPED TABLE', cross_terminal: 'CROSS TERMINAL', ring_track: 'RING TRACK', clamp_room: 'CLAMP SECTOR', cashier_maze: 'CASHIER MAZE', machine_core: 'MACHINE CORE' };
const ARCH_LABELS_RU = { panic_box: 'ТЕСНЫЙ СЕКТОР', compact: 'МАЛЫЙ СЕКТОР', standard: 'СТАНДАРТНЫЙ СЕКТОР', wide: 'ШИРОКИЙ СЕКТОР', long_lane: 'ДЛИННЫЙ КОРИДОР', lounge: 'КАЗИНО-ЛАУНЖ', boss: 'УЗЕЛ ГЛАВНОЙ УГРОЗЫ', trinode_chase: 'ЛАБИРИНТ TRI', ripped_table: 'РАЗОРВАННЫЙ СТОЛ', cross_terminal: 'КРЕСТОВОЙ ТЕРМИНАЛ', ring_track: 'КОЛЬЦЕВОЙ ТРЕК', clamp_room: 'СЕКТОР-ЗАЖИМ', cashier_maze: 'ЛАБИРИНТ КАССЫ', machine_core: 'ЯДРО АВТОМАТА' };
const MOD_LABELS_RU = {
  blackout: 'ТЕМНОТА', static_rain: 'СТАТИК-ШТОРМ', greed: 'ЗОЛОТАЯ ЛИХОРАДКА', debt_floor: 'СТАТИК-ПОЛ', hunter_contract: 'ВОЛНЫ ОХОТНИКОВ',
  casino_virus: 'КАЗИНО-ВИРУС', mirror_room: 'ЗЕРКАЛЬНЫЙ ЗАЛ', moving_room: 'ДВИЖУЩИЕСЯ ЗОНЫ', prism_grid: 'ПРИЗМ-СЕТКА', blood_tax: 'КРОВАВАЯ ОПЛАТА',
  shell_market: 'БИРЖА ЩИТОВ', echo_walls: 'ЭХО-ВЫСТРЕЛЫ', static_wires: 'СТАТИК-ПРОВОДА', hunted_exit: 'ОХОТА У ВЫХОДА', skin_cache: 'ОБЛИК-ТАЙНИК', trojan: 'ТРОЯНСКИЙ СУНДУК'
};
const TAG_RU = {
  'NORMAL CLEAR': 'ОБЫЧНАЯ ЗАЧИСТКА', 'NORMAL REWARD': 'ОБЫЧНАЯ НАГРАДА', LANES: 'ЛИНИИ', STATIC: 'СТАТИКА', GREED: 'ЗОЛОТО', ARMOR: 'БРОНЯ',
  'ARMOR WALL': 'СТЕНА БРОНИ', CONTROL: 'КОНТРОЛЬ', SWARM: 'РОЙ', RANGED: 'ДАЛЬНИЙ БОЙ', CHAOS: 'ХАОС', 'GLD↑': 'GLD↑', 'BET↑': 'BET↑',
  'SHELL GLD': 'GLD ЗА ЩИТЫ', 'EARLY EXIT': 'РАННИЙ ВЫХОД', 'OVERSTAY HUNTERS': 'ОХОТА ЗА ЗАДЕРЖКУ', SKIN: 'ОБЛИК', 'SKN CACHE': 'ОБЛИК-ТАЙНИК',
  'CLOSE RANGE': 'БЛИЖНИЙ БОЙ', 'DASH SPACE': 'ПРОСТОР ДЛЯ РЫВКА', CROSSFIRE: 'ПЕРЕКРЁСТНЫЙ ОГОНЬ', SHOP: 'ПОКУПКИ', 'LOCKED WAVES': 'ЗАКРЫТЫЕ ВОЛНЫ',
  '3 VIRUS SPINS': '3 БРОСКА ВИРУСА', 'DANGER ZONES': 'ОПАСНЫЕ ЗОНЫ', 'PRISM SLOW': 'ПРИЗМ-ЗАМЕДЛЕНИЕ', 'GRAVITY SOCKETS': 'ГРАВИТАЦИОННЫЕ УЗЛЫ',
  'HP SHOP': 'ПОКУПКИ ЗА HP', '50% ECHO SHOTS': '50% ЭХО-ВЫСТРЕЛОВ', 'PRIORITY TARGET': 'ВАЖНАЯ ЦЕЛЬ', 'NO ENEMIES': 'БЕЗ УГРОЗ',
  'GLD BONUS': 'БОНУС GLD', '3 SPINS': '3 БРОСКА', 'HP COSTS': 'ЦЕНЫ HP', 'REWARD↑': 'НАГРАДА↑', 'SAFE / SHOP': 'БЕЗОПАСНО / МАГАЗИН', 'INFECTED CHEST': 'ЗАРАЖЁННЫЙ СУНДУК', 'CHEST SWARM': 'РОЙ ИЗ СУНДУКА'
};
function roman(n) { const map = ['','I','II','III','IV','V','VI','VII','VIII','IX','X']; n = Math.max(1, Math.min(10, Number(n || 1) | 0)); return map[n] || String(n); }
const BUILD_BASE_STATS = defaultStats();
function buildNum(value, digits = 2) {
  const n = Number(value || 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(digits).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}
function buildValue(value, kind = 'level') {
  const n = Number(value || 0);
  if (kind === 'mult') return `×${buildNum(n)}`;
  if (kind === 'pct') return `${buildNum(n * 100, 1)}%`;
  if (kind === 'seconds') return `${buildNum(n, 1)}s`;
  if (kind === 'units') return buildNum(n, 0);
  if (kind === 'bool') return n > 0 ? localText('ДА', 'YES') : localText('НЕТ', 'NO');
  return buildNum(n, 1);
}
function buildGain(value, base, kind = 'level') {
  const n = Number(value || 0), b = Number(base || 0);
  if (kind === 'mult') return `${n >= b ? '+' : ''}${buildNum((n - b) * 100, 1)}%`;
  if (kind === 'pct') return `${n >= b ? '+' : ''}${buildNum((n - b) * 100, 1)} п.п.`;
  if (kind === 'bool') return n > b ? localText('ОТКРЫТО', 'UNLOCKED') : '—';
  const d = n - b;
  return `${d >= 0 ? '+' : ''}${buildNum(d, 1)}`;
}
function buildStatHtml(def, stats, me) {
  const base = def.base ?? BUILD_BASE_STATS[def.key] ?? 0;
  const value = typeof def.value === 'function' ? def.value(stats, me) : (stats[def.key] ?? base);
  const title = localText(def.ru, def.en);
  const hint = localText(
    `Текущее значение: ${buildValue(value, def.kind)}. Базовое: ${buildValue(base, def.kind)}. Прокачка: ${buildGain(value, base, def.kind)}.`,
    `Current: ${buildValue(value, def.kind)}. Base: ${buildValue(base, def.kind)}. Upgrade: ${buildGain(value, base, def.kind)}.`
  );
  return `<div class="tab-build-stat term" data-explain-title="${esc(title)}" data-explain="${esc(hint)}"><span>${esc(title)}</span><b>${esc(buildValue(value, def.kind))}</b><small>${esc(localText('БАЗА', 'BASE'))} ${esc(buildValue(base, def.kind))} · ${esc(buildGain(value, base, def.kind))}</small></div>`;
}
function tabBuildCard(titleRu, titleEn, rows, cls = '') {
  return `<section class="tab-build-card ${cls}"><h3>${esc(localText(titleRu, titleEn))}</h3><div class="tab-build-rows">${rows.join('')}</div></section>`;
}
function renderTabBuild(me) {
  const build = me?.[P.BUILD];
  if (!build?.stats) return `<section class="tab-build-card"><h3>${esc(localText('СБОРКА', 'BUILD'))}</h3><p class="muted">${esc(localText('СИНХРОНИЗАЦИЯ…', 'SYNCING…'))}</p></section>`;
  const s = { ...BUILD_BASE_STATS, ...build.stats };
  const coreDefs = [
    { key:'dmgMul', ru:'ВЕСЬ ИСХОДЯЩИЙ УРОН', en:'ALL OUTGOING DAMAGE', kind:'mult', value:()=>build.derived?.damageMul ?? s.dmgMul },
    { key:'weaponDmgMul', ru:'ДОБАВКА ОРУЖИЯ', en:'WEAPON DAMAGE BONUS', kind:'mult' },
    { key:'fireMul', ru:'СКОРОСТЬ ОРУЖИЯ', en:'WEAPON CLOCK', kind:'mult' },
    { key:'maxHpAdd', ru:'МАКС. HP', en:'MAX HP', kind:'units', base:100, value:(_,p)=>p[P.MAXHP] },
    { key:'spdMul', ru:'СКОРОСТЬ', en:'MOVE SPEED', kind:'units', base:260, value:(_,p)=>p[P.SPD] },
    { key:'magnetMul', ru:'МАГНИТ ДАННЫХ', en:'DATA MAGNET', kind:'mult' },
    { key:'luck', ru:'УДАЧА', en:'LUCK', kind:'level' },
    { key:'goldMul', ru:'ДОХОД GLD', en:'GLD INCOME', kind:'mult' },
    { key:'lifesteal', ru:'ВАМПИРИЗМ', en:'LIFESTEAL', kind:'pct' },
    { key:'procBlast', ru:'ШАНС ВЗРЫВА', en:'BLAST CHANCE', kind:'pct' },
    { key:'echoShot', ru:'ЭХО-ВЫСТРЕЛ', en:'ECHO SHOT', kind:'pct' },
    { key:'drones', ru:'СПУТНИКИ', en:'DRONES', kind:'level' },
    { key:'dashAdd', ru:'ЗАРЯДЫ РЫВКА', en:'DASH CHARGES', kind:'level', base:1, value:(_,p)=>p[P.DASHMAX] },
    { key:'dashDistMul', ru:'ДАЛЬНОСТЬ РЫВКА', en:'DASH DISTANCE', kind:'units', base:175, value:(_,p)=>p[P.DASHDIST] },
    { key:'dashRegenMul', ru:'ВОССТ. РЫВКА', en:'DASH RECOVERY', kind:'mult' },
    { key:'activeRegenMul', ru:'ВОССТ. Q', en:'Q RECOVERY', kind:'mult' }
  ];
  const armoryDefs = [
    { key:'bulletRange', ru:'ДАЛЬНОСТЬ ОРУЖИЯ', en:'WEAPON RANGE', kind:'mult' },
    { key:'bulletBounce', ru:'РИКОШЕТЫ', en:'RICOCHETS' },
    { key:'bulletFire', ru:'ОГОНЬ', en:'FIRE STATUS' },
    { key:'bulletFreeze', ru:'ЗАМОРОЗКА', en:'FREEZE STATUS' },
    { key:'bulletPoison', ru:'ЯД', en:'POISON STATUS' },
    { key:'bulletElementAmp', ru:'СИЛА СТАТУСОВ', en:'STATUS POWER' },
    { key:'elementSpread', ru:'ПЕРЕНОС СТАТУСОВ', en:'STATUS SPREAD' },
    { key:'bulletChain', ru:'СВЯЗЬ СНАРЯДОВ', en:'PROJECTILE LINK' },
    { key:'bulletChainStatuses', ru:'СТАТУСЫ ПО СВЯЗИ', en:'LINKED STATUSES', kind:'bool' },
    { key:'droneElementLink', ru:'СТАТУСЫ КОНТАКТА CTRL', en:'CTRL CONTACT STATUS', kind:'bool' },
    { key:'droneProc', ru:'ВЗРЫВЫ СПУТНИКОВ', en:'DRONE BLAST' }
  ];
  const weapons = new Set(build.weapons || []);
  const branches = [
    ['shotgun', [
      { key:'shgPellets', ru:'SHG: ДРОБЬ', en:'SHG: PELLETS' }, { key:'shgBounce', ru:'SHG: РИКОШЕТ', en:'SHG: BOUNCE' }, { key:'shgLongshot', ru:'SHG: ДАЛЬНИЙ БОЙ', en:'SHG: LONGSHOT' }
    ]],
    ['seeker', [
      { key:'sekSplit', ru:'SEK: ДЕЛЕНИЕ', en:'SEK: SPLIT' }, { key:'sekChain', ru:'SEK: ЦЕПЬ', en:'SEK: CHAIN' }, { key:'sekSwarm', ru:'SEK: РОЙ', en:'SEK: SWARM' }
    ]],
    ['rocketgun', [
      { key:'rktCluster', ru:'RKT: КАССЕТА', en:'RKT: CLUSTER' }, { key:'rktMines', ru:'RKT: МИНЫ', en:'RKT: MINES' }, { key:'rktStun', ru:'RKT: ОГЛУШЕНИЕ', en:'RKT: STUN' }, { key:'rktScatter', ru:'RKT: РАЗБРОС', en:'RKT: SCATTER' }, { key:'rktRemote', ru:'RKT: ПОДРЫВ', en:'RKT: REMOTE' }
    ]],
    ['roulette', [
      { key:'rltDmg', ru:'RLT: УРОН', en:'RLT: DAMAGE' }, { key:'rltSize', ru:'RLT: РАЗМЕР', en:'RLT: SIZE' }, { key:'rltFrag', ru:'RLT: ОСКОЛКИ', en:'RLT: FRAGMENTS' }, { key:'rltDepth', ru:'RLT: ГЛУБИНА', en:'RLT: DEPTH' }, { key:'rltBounce', ru:'RLT: РИКОШЕТ', en:'RLT: BOUNCE' }, { key:'rltSpeed', ru:'RLT: СКОРОСТЬ', en:'RLT: SPEED' }
    ]],
    ['deck', [
      { key:'crdCards', ru:'CRD: КАРТЫ', en:'CRD: CARDS' }, { key:'crdDmg', ru:'CRD: УРОН', en:'CRD: DAMAGE' }, { key:'crdBounce', ru:'CRD: РИКОШЕТ', en:'CRD: BOUNCE' }
    ]]
  ];
  for (const [weapon, defs] of branches) if (weapons.has(weapon) || defs.some(d => Number(s[d.key] || 0) > 0)) armoryDefs.push(...defs);

  const heroDefs = [];
  if (build.hero === 'process_controller') heroDefs.push(
    { key:'ctrlMax', ru:'ЛИМИТ ПРОЦЕССОВ', en:'PROCESS LIMIT', base:2, value:v=>2 + Number(v.ctrlMax || 0) },
    { key:'ctrlPower', ru:'СИЛА ПРОЦЕССОВ', en:'PROCESS POWER' },
    { key:'ctrlCaptureTier', ru:'РАНГ ЗАХВАТА', en:'CAPTURE TIER' },
    { key:'ctrlFire', ru:'ОГОНЬ ПРОЦЕССОВ', en:'PROCESS FIRE RATE' },
    { key:'ctrlProcessContactStatus', ru:'СТАТУСЫ ТЕЛОМ', en:'CONTACT STATUSES', kind:'bool' },
    { key:'ctrlLife', ru:'СРОК КОНТРОЛЯ', en:'CONTROL LIFETIME' },
    { key:'ctrlDeathHeal', ru:'ВОЗВРАТ HP', en:'PROCESS HP RETURN' },
    { key:'ctrlPersist', ru:'ПЕРЕХОД МЕЖДУ СЕКТОРАМИ', en:'ROOM PERSISTENCE', kind:'bool' },
    { key:'qrRadius', ru:'ЯКОРЬ: РАДИУС', en:'ANCHOR: RADIUS' },
    { key:'qrHold', ru:'ЯКОРЬ: ДЛИТЕЛЬНОСТЬ', en:'ANCHOR: DURATION' },
    { key:'qrLinks', ru:'ЯКОРЬ: ЗАХВАТЫ', en:'ANCHOR: LINKS', base:5, value:v=>5 + Number(v.qrLinks || 0) },
    { key:'qrDamage', ru:'ЯКОРЬ: УРОН', en:'ANCHOR: DAMAGE' }
  );
  else if (build.hero === 'living_casino') {
    const lc = build.livingCasino || {};
    heroDefs.push(
      { key:'lcTargets', ru:'ЦЕЛИ КАЗИНО', en:'CASINO TARGETS', base:2, value:()=>2 + Number(lc.targets || 0) },
      { key:'lcGunRange', ru:'ДАЛЬНОСТЬ ПУШЕК', en:'GUN RANGE', value:()=>Number(lc.gunRange || 0) },
      { key:'lcSparks', ru:'КОНТРОЛЬНЫЕ ИСКРЫ', en:'CONTROL SPARKS', kind:'bool', value:()=>lc.sparksUnlocked ? 1 : 0 },
      { key:'lcSparkCount', ru:'КАНАЛЫ ИСКР', en:'SPARK CHANNELS', base:0, value:()=>lc.sparksUnlocked ? 3 + Number(lc.sparkCount || 0) : 0 },
      { key:'lcSparkDamage', ru:'УРОН ИСКР', en:'SPARK DAMAGE', value:()=>Number(lc.sparkDamage || 0) },
      { key:'lcSparkHold', ru:'УДЕРЖАНИЕ ИСКР', en:'SPARK HOLD', value:()=>Number(lc.sparkHold || 0) },
      { key:'lcSparkRange', ru:'ДАЛЬНОСТЬ ИСКР', en:'SPARK RANGE', value:()=>Number(lc.sparkRange || 0) }
    );
  } else heroDefs.push(
    { key:'voidStep', ru:'РЫВОК: ФАЗА', en:'DASH: PHASE' },
    { key:'dashCut', ru:'РЫВОК: РАЗРЕЗ', en:'DASH: CUT' },
    { key:'dashClone', ru:'РЫВОК: ПРИЗРАК', en:'DASH: GHOST' }
  );
  const specialDefs = [
    ['spawnHoldStacks','R: УДЕРЖАНИЕ СПАВНА','R: SPAWN HOLD'], ['aegisStacks','R: ЭГИДА','R: AEGIS'], ['mirrorCapacity','R: ЗЕРКАЛО','R: MIRROR'], ['nullRevives','R: ВОЗВРАТ','R: REVIVE'], ['rActiveStacks','R: УРОВЕНЬ','R: LEVEL']
  ];
  for (const [key, ru, en] of specialDefs) if (Number(s[key] || 0) > 0) heroDefs.push({ key, ru, en });

  const active = build.active || {};
  const core = ACTIVE_CORES[active.core] || null;
  const mutationRows = [];
  mutationRows.push(`<div class="tab-build-q term" data-explain-title="${esc(core?.label || localText('Q НЕ УСТАНОВЛЕНА', 'NO Q INSTALLED'))}" data-explain="${esc(core?.desc || localText('Активный протокол ещё не выбран.', 'No active protocol selected yet.'))}"><span>Q</span><b>${esc(core?.label || '—')}</b><small>${esc(localText('УРОВЕНЬ', 'LEVEL'))} ${esc(active.level || 0)}</small></div>`);
  for (const owned of active.mutations || []) {
    const mut = ACTIVE_MUTATIONS[owned.id];
    if (!mut) continue;
    const lv = Math.max(1, Number(owned.level || 1) | 0);
    mutationRows.push(`<div class="tab-build-mutation term tone-${esc(mut.tone || 'cyan')}" data-explain-title="${esc(mut.label)} ${esc(lv <= 10 ? roman(lv) : `LV ${lv}`)}" data-explain="${esc(mut.desc || '')}"><span>${esc(mut.role || localText('МУТАЦИЯ', 'MUTATION'))}</span><b>${esc(mut.label)}</b><small>LV ${esc(lv)} · ${esc(mut.stackable === false ? localText('УНИКАЛЬНАЯ', 'UNIQUE') : localText('СТАКАЕТСЯ', 'STACKABLE'))}</small></div>`);
  }
  if (!(active.mutations || []).length) mutationRows.push(`<p class="muted">${esc(localText('МУТАЦИЙ ПОКА НЕТ', 'NO MUTATIONS YET'))}</p>`);

  return tabBuildCard('ОСНОВА', 'CORE', coreDefs.map(d => buildStatHtml(d, s, me)), 'core') +
    tabBuildCard('ОРУЖИЕ / СТАТУСЫ', 'WEAPON / STATUS', armoryDefs.map(d => buildStatHtml(d, s, me)), 'armory') +
    tabBuildCard('ГЕРОЙ / ОСОБОЕ', 'HERO / SPECIAL', heroDefs.map(d => buildStatHtml(d, s, me)), 'hero') +
    tabBuildCard('Q / МУТАЦИИ', 'Q / MUTATIONS', mutationRows, 'mutations');
}
function archLabel(id) { return localText(ARCH_LABELS_RU[id] || String(id || 'STANDARD').toUpperCase(), ARCH_LABELS[id] || String(id || 'STANDARD').toUpperCase()); }
function locTag(v) {
  const s = String(v || '').trim();
  if (!s) return s;
  if (s.includes('STATIC LVL')) return localText(s.replace('STATIC LVL', 'СТАТИК УР.'), s);
  return localText(TAG_RU[s] || s, s);
}
function locProgress(v) {
  let s = String(v || '—');
  if (s === '—') return s;
  if (document.documentElement.lang === 'en') return s;
  return s.replace(/READY/g, 'ГОТОВО').replace(/CLEAR/g, 'ЗАЧИСТКА').replace(/CLEAN/g, 'ЧИСТО').replace(/WAVES/g, 'ВОЛНЫ').replace(/SPINS LEFT/g, 'БРОСКОВ ОСТАЛОСЬ').replace(/HP PRICES/g, 'ЦЕНЫ HP').replace(/TOUCH/g, 'КАСАНИЕ').replace(/HIT/g, 'ПОПАДАНИЕ').replace(/DMG/g, 'УРОН').replace(/ENEMIES/g, 'УГРОЗЫ').replace(/LEFT/g, 'ОСТАЛОСЬ');
}
function locFail(v) {
  const s = String(v || '');
  const ru = { 'DAMAGE TAKEN':'ПОЛУЧЕН УРОН', 'TIME LOST':'ВРЕМЯ УШЛО', 'WIRE TOUCHED':'КАСАНИЕ ПРОВОДА', 'LANE HIT':'ПОПАДАНИЕ ЛИНИИ', 'TOO MUCH DMG':'СЛИШКОМ МНОГО УРОНА', 'SHELLS LEFT':'ЩИТЫ НЕ СЛОМАНЫ', 'CONDITION LOST':'УСЛОВИЕ СОРВАНО', 'ENEMIES LEFT':'УГРОЗЫ ОСТАЛИСЬ' };
  return localText(ru[s] || s, s);
}
function contractFavorPreviewLabel(f = {}) {
  const id = String(f.id || '');
  const ru = {
    free_reroll: 'ПЕРЕБРОС ВЫБОРА', clear_debt: 'СНЯТЬ СТАТИК-ШТОРМ',
    portal_insurance: 'СТРАХОВКА ОТ СМЕРТИ', epic_reroll: 'ДВА ПЕРЕБРОСА ВЫБОРА', double_favor: 'ДВОЙНОЙ СЛЕД. ПРИЗ',
    wpn_clearance: 'WPN-ДОПУСК', abl_clearance: 'ABL-ДОПУСК', rar_clearance: 'RAR-ДОПУСК',
    mod_veto: 'ВЕТО МОДИФИКАТОРА', credit_pass: 'КРЕДИТНЫЙ ПРОПУСК', salvage_protocol: 'ПРОТОКОЛ СБОРА'
  };
  const en = {
    free_reroll: 'CHEST REROLL', clear_debt: 'CLEAR STATIC STORM',
    portal_insurance: 'DEATH INSURANCE', epic_reroll: 'DOUBLE REROLL', double_favor: 'DOUBLE NEXT PRIZE'
  };
  const base = localText(ru[id] || f.labelRu || f.label || id.toUpperCase(), en[id] || f.label || id.toUpperCase());
  return `${base}${(f.uses || 0) > 1 ? ' x' + f.uses : ''}`;
}
function contractFavorPreviewBody(f = {}) {
  const id = String(f.id || '');
  const ru = {
    free_reroll: 'Один раз полностью обновляет текущие варианты WPN, ABL или приза главной угрозы. Заряд хранится, пока ты сам его не применишь.',
    clear_debt: 'Снимает весь накопленный Статик-шторм и навсегда отключает шторм от Статик-ядра в этом забеге. Новые явные источники статика всё ещё могут появляться.',
    portal_insurance: 'Один смертельный удар вместо смерти оставляет тебя в живых и восстанавливает 50 HP. Хранится до срабатывания.',
    epic_reroll: 'Даёт два отдельных полных переброса выбора WPN, ABL или приза главной угрозы. Заряды не пропадают между секторами.',
    double_favor: 'Следующий успешно выполненный контракт выдаст два разных контрактных приза вместо одного.',
    wpn_clearance: 'До обычного INSTALL откроется отдельное окно на 30 секунд: четыре улучшенных WPN-модуля, один устанавливается бесплатно. После выбора продолжится INSTALL.',
    abl_clearance: 'До обычного INSTALL откроется отдельное окно на 30 секунд: четыре улучшенных ABL-модуля, один устанавливается бесплатно. После выбора продолжится INSTALL.',
    rar_clearance: 'Следующий RAR-сундук гарантированно поднимается до усиленного безопасного качества.',
    mod_veto: 'Перед ближайшим подходящим сектором автоматически удаляет один опасный модификатор. Хранится, пока не найдётся подходящая цель.',
    credit_pass: 'Следующий платный сундук с выбором WPN или ABL открывается бесплатно. Бесплатные и заражённые сундуки заряд не тратят.',
    salvage_protocol: 'Первые десять убийств в следующем боевом секторе дают пятикратные командные GLD и EXP. Один сектор расходует один заряд.'
  };
  const en = {
    free_reroll: 'Fully refreshes one current WPN, ABL, or main-threat prize choice. The charge persists until you use it.',
    clear_debt: 'Clears all banked Static Storm and permanently disables Static Core storms for this run. New explicit static sources can still appear.',
    portal_insurance: 'One lethal hit keeps you alive and restores 50 HP. Persists until triggered.',
    epic_reroll: 'Grants two full rerolls for WPN, ABL, or main-threat prize choices. Charges persist between sectors.',
    double_favor: 'The next completed contract grants two different contract prizes instead of one.',
    wpn_clearance: 'Before regular INSTALL, opens a separate 30-second choice: four improved WPN modules, one installed free. INSTALL continues afterward.',
    abl_clearance: 'Before regular INSTALL, opens a separate 30-second choice: four improved ABL modules, one installed free. INSTALL continues afterward.',
    rar_clearance: 'The next RAR chest is guaranteed enhanced safe quality.',
    mod_veto: 'Automatically removes one dangerous modifier from the next eligible sector. Persists until a target exists.',
    credit_pass: 'The next WPN or ABL choice chest opens for free.',
    salvage_protocol: 'The first ten kills in the next combat sector grant x5 team GLD and EXP.'
  };
  return localText(ru[id] || 'Контрактный приз хранится до подходящего момента применения.', en[id] || f.desc || 'Contract prize persists until it can apply.');
}
function contractRewardText(reward = '', obj = null) {
  const preview = Array.isArray(obj?.prizePreview) ? obj.prizePreview : [];
  if (preview.length) return preview.map(contractFavorPreviewLabel).join(' + ');
  const s = String(reward || 'NEXT SECTOR FAVOR');
  if (/NEXT SECTOR/i.test(s) || /FAVOR/i.test(s)) return localText('конкретный бонус следующей сектора', 'specific next-room bonus');
  return cleanPlayerText(locLabel(s));
}
const nextStaticEligible = nx => !!nx && nx.cat !== 'boss' && nx.special !== 'chill_room';
const STATIC_SOURCE_RU = {
  room_modifier: 'мод сектора', debt_engine: 'статик-ядро (до очистки)', static_debt: 'статик-долг на 1 сектор', cursed_chest: 'проклятый сундук на 1 сектор', casino_bet: 'казино на 1 сектор', active_casino: 'активное казино на 1 сектор', previous_room_hits: 'попадания прошлого сектора', room_strikes: 'попадания прошлого сектора', casino_virus: 'казино-вирус только здесь'
};
const STATIC_SOURCE_EN = {
  room_modifier: 'room rule', debt_engine: 'Static Core (until cleansed)', static_debt: 'stored static for 1 room', cursed_chest: 'cursed chest for 1 room', casino_bet: 'casino for 1 room', active_casino: 'Q casino for 1 room', previous_room_hits: 'previous room hits', room_strikes: 'previous room hits', casino_virus: 'casino virus, this room only'
};
function staticSourceLabel(id) {
  const k = String(id || 'static_debt');
  return localText(STATIC_SOURCE_RU[k] || k.replace(/_/g, ' '), STATIC_SOURCE_EN[k] || k.replace(/_/g, ' '));
}
function staticBreakdownParts(bd = {}, sourceKey = 'sources') {
  const sources = Array.isArray(bd[sourceKey]) ? bd[sourceKey] : [];
  return sources.filter(x => (x?.level | 0) > 0).map((x, i) => `${i === 0 ? '' : '+'}${Math.max(0, x.level | 0)} ${staticSourceLabel(x.id)}`);
}
function staticBreakdownText(bd = {}, banked = 0) {
  const total = Math.max(0, bd.total | 0);
  const parts = staticBreakdownParts(bd, total > 0 ? 'sources' : 'bankedSources');
  if (total > 0) {
    return `${localText('СТАТИК-ШТОРМ УР.', 'STATIC STORM LVL')} ${total}${parts.length ? ' = ' + parts.join(' ') : ''}`;
  }
  if (banked > 0) return `${localText('СТАТИКА В ЗАПАСЕ УР.', 'STATIC BANKED LVL')} ${banked}${parts.length ? ' = ' + parts.join(' ') : ''}`;
  return '';
}
function staticBreakdownExplain(bd = {}, banked = 0) {
  const total = Math.max(0, bd.total | 0);
  const parts = staticBreakdownParts(bd, total > 0 ? 'sources' : 'bankedSources');
  const head = total > 0
    ? localText(`Общий уровень статик-шторма: ${total}.`, `Static Storm level: ${total}.`)
    : localText(`Статик ждёт следующий сектор: ${banked}.`, `Static waiting for the next room: ${banked}.`);
  const sum = parts.length ? localText(`Сумма: ${parts.join(' ')}.`, `Sum: ${parts.join(' ')}.`) : '';
  return `${head} ${sum} ${localText('Каждый источник усиливает один общий шторм.', 'Each source strengthens one shared storm.')}`;
}
function roomModLabel(m, room = null, forcedStaticLevel = 0) {
  const label = m === 'skin_cache' ? localText('СКРЫТЫЙ ОБЛИК', 'HIDDEN SHELL') : localText(MOD_LABELS_RU[m] || (MOD_LABELS[m] || String(m || '').toUpperCase()), MOD_LABELS[m] || String(m || '').toUpperCase());
  if (m === 'static_rain') {
    const lvl = forcedStaticLevel || Math.max(0, room?.staticRainStacks | 0);
    return lvl > 0 ? localText(`${label} УР. ${lvl}`, `${label} LVL ${lvl}`) : label;
  }
  return label;
}
function roomModHint(m, room = {}) {
  const mode = room.staticRainMode || '';
  const lvl = Math.max(0, room.staticRainStacks | 0);
  const hints = {
    blackout: localText('Свет ломается. Дальние угрозы хуже видны.', 'Light is broken. Long-range threats are harder to read.'),
    static_rain: String(mode).startsWith('paid')
      ? localText(`Статик-шторм ур. ${lvl}: опасные области появляются и затем бьют разрядом.`, `Static Storm LVL ${lvl}: danger areas appear, then lightning strikes them.`)
      : localText(`Статик-шторм ур. ${Math.max(1, lvl)}: сектор помечает опасные области и бьёт разрядом.`, `Static Storm LVL ${Math.max(1, lvl)}: the room marks danger areas and strikes them.`),
    greed: localText('Золотая лихорадка: больше GLD; вампиризм возвращает кредиты вместо HP.', 'Gold Fever: more GLD; lifesteal returns credits instead of HP.'),
    debt_floor: localText('Статик-пол: выгодные сделки усиливают следующий шторм.', 'Static Floor: good deals strengthen the next storm.'),
    hunter_contract: localText('Волны охотников: портал закрыт до конца волн.', 'Hunter Waves: portal is locked until the waves end.'),
    casino_virus: localText('Казино-вирус: три броска дают награды, штрафы или угроз.', 'Casino Virus: three spins give rewards, penalties, or enemy packs.'),
    mirror_room: localText('Зеркальный зал: больше эхо-пуль.', 'Mirror Room: more echo shots.'),
    moving_room: localText('Движущиеся зоны: красные области замедляют и бьют.', 'Shifting Zones: red areas slow and damage inside.'),
    prism_grid: localText('Призм-сетка: светлые клетки замедляют движение и пули.', 'Prism Grid: pale cells slow movement and bullets.'),
    blood_tax: localText('Кровавая оплата: ставки и покупки стоят HP.', 'Blood Payment: bets and buys cost HP.'),
    shell_market: localText('Биржа щитов: у угроз чаще есть защита.', 'Shell Market: enemies more often have shields.'),
    echo_walls: localText('Эхо-выстрелы: часть пуль получает копию.', 'Echo Shots: some bullets get a copy.'),
    static_wires: localText('Статик-провода: линии замедляют движение.', 'Static Wires: thin lines slow movement.'),
    hunted_exit: localText('Охота у выхода: задержка вызывает охотников.', 'Hunted Exit: staying too long calls hunters.'),
    skin_cache: localText('Тайник облика: после очистки появится карточка облика.', 'Shell Cache: a shell card appears after clearing.'),
    trojan: localText('Один сундук заражён: при открытии он взорвётся и выпустит рой.', 'One chest is infected: opening it makes it explode and release a swarm.')
  };
  return hints[m] || localText('Особое правило меняет бой.', 'A special rule changes combat.');
}
function roomRuleSummary(room, ids = []) {
  const mods = (ids || []).filter(Boolean);
  if (!mods.length) return localText('Чистый сектор: без особых правил.', 'Clean sector: no special rules.');
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
    shotgun: 'КЛИНОВОЙ РАЗРЯД', seeker: 'ИСКАТЕЛЬ', rocketgun: 'РАЗЛОМНЫЙ ЗАРЯД', ricochet: 'ОТСКОК',
    ability: 'Q', dash: 'РЫВОК', drone: 'ДРОН',
    fire: 'ПОДЖОГ', burn: 'ПОДЖОГ', poison: 'ЯД', freeze: 'ЗАМОРОЗКА', status: 'СТАТУС',
    blast: 'ВЗРЫВ', chain: 'ЦЕПЬ', weapon: 'ОРУЖИЕ'
  };
  const en = {
    shotgun: 'WEDGE', seeker: 'SEEKER', rocketgun: 'BREACH', ricochet: 'RICOCHET',
    ability: 'Q', dash: 'DASH', drone: 'DRONE',
    fire: 'BURN', burn: 'BURN', poison: 'POISON', freeze: 'FREEZE', status: 'STATUS',
    blast: 'BLAST', chain: 'CHAIN', weapon: 'WEAPON'
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
function renderComboHud(c = {}) {
  const mult = Number(c.mult || 1);
  const count = Math.max(0, c.count | 0);
  if (mult <= 1.01 || count <= 0 || (c.timer || 0) <= 0) return '';
  const pct = Math.max(0, Math.min(100, ((c.timer || 0) / Math.max(0.1, c.window || 3)) * 100));
  const methods = (c.recent || []).filter(m => !['shell','armor'].includes(String(m).toLowerCase())).map(comboMethodLabel).filter(Boolean).slice(0, 3);
  const methodLine = methods.length ? methods.join(' · ') : comboMethodLabel(c.lastMethod || 'weapon');
  const prizeLine = comboPrizeReadout(c);
  return `<div class="combo-readout${c.flash > 0 ? ' combo-pop' : ''}${c.drop > 0 ? ' combo-hit' : ''}">` +
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
  const headline = isNext ? localText('Короткий прогноз следующей сектора.', 'Short preview of the next room.') : localText('Короткая сводка текущей сектора.', 'Short summary of the current room.');
  return `${headline}
${dangerLabel(room)}
${localText('Правила', 'Rules')}: ${mods}
${localText('Угроза', 'Threat')}: ${threats}
${localText('Награда', 'Reward')}: ${rewards}
${localText('Подсказка', 'Hint')}: ${localText('подчёркнутые правила можно осмотреть.', 'underlined rules can be inspected.')}`;
}


function objectiveExplain(obj = {}) {
  if (!obj?.id) return localText('Контракт сектора. Выполни условие, чтобы получить бонус для следующей сектора.', 'Room contract. Complete the condition to earn a next-room bonus.');
  const map = {
    boss_cut: localText('Уничтожь главную угрозу и забери приз после сектора.', 'Destroy the core threat and claim the sector prize.'),
    lounge_cashout: localText('Безопасный сектор: покупай, ставь и выходи, когда готов.', 'Safe sector: shop, wager, and leave when ready.'),
    hunter_waves: localText('Пройди все волны очистки. Портал откроется после последней.', 'Clear all purge waves. The portal opens after the final wave.'),
    virus_clean: localText('Переживи 3 вирусных броска, затем зачисти угрозы.', 'Survive 3 virus spins, then clear every threat.'),
    wire_ghost: localText('Пройди сектор без касания опасных линий.', 'Clear the sector without touching hazard lines.'),
    grid_slow_clear: localText('Зачисти сектор с сеткой замедления.', 'Clear the slow-grid sector.'),
    blood_paid: localText('В этом секторе покупки требуют здоровья. Зачисти сектор.', 'Purchases in this sector cost health. Clear the sector.'),
    static_clean: localText('Пройди сектор со статик-штормом и получи мало урона.', 'Clear the static-storm sector while taking little damage.'),
    cache_claim: localText('Очисти сектор и забери скрытый облик через портал.', 'Clear the sector and claim the hidden shell through the portal.'),
    fast_clear: localText('Зачисти все угрозы, пока таймер не сгорел.', 'Clear every threat before the timer burns out.'),
    no_hit: localText('Зачисти все угрозы без полученного урона.', 'Clear every threat without taking damage.'),
    clean_signal: localText('Зачисти все угрозы сектора.', 'Clear every threat in the sector.')
  };
  const status = obj.statusLabel ? `${localText('Состояние', 'State')}: ${objectiveStatusText(obj)}${obj.failReason ? ' / ' + locFail(obj.failReason) : ''}` : `${localText('Состояние', 'State')}: ${localText('идёт', 'active')}`;
  const prize = contractRewardText(obj.reward, obj);
  return `${map[obj.id] || localText('Контракт сектора.', 'Sector contract.')}
${status}
${localText('Ход', 'Progress')}: ${locProgress(obj.progress || '—')}
${localText('Приз', 'Prize')}: ${prize}
${localText('Приз появится после сектора.', 'The prize appears after the sector.')}`;
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
  return `<div class="contract-kicker">${esc(localText('КОНТРАКТ СЕКТОРА', 'SECTOR CONTRACT'))}</div><div class="contract-title">${esc(title)}</div><div class="contract-sub">${esc(prog)}</div><div class="contract-reward">${esc(reward)}</div>`;
}
const rarityText = r => { const k = String(r || 'skin').toLowerCase(); const en = { basic:'BASIC', uncommon:'UNCOMMON', rare:'RARE', superrare:'SUPER RARE', legendary:'LEGENDARY', skin:'SKIN' }; const ru = { basic:'ОБЫЧНЫЙ', uncommon:'НЕОБЫЧНЫЙ', rare:'РЕДКИЙ', superrare:'СВЕРХРЕДКИЙ', legendary:'ЛЕГЕНДАРНЫЙ', skin:'ОБЛИК' }; return localText(ru[k] || String(r || '').toUpperCase(), en[k] || String(r || '').replace('superrare', 'SUPER RARE').toUpperCase()); };
const UPG = Object.fromEntries(UPGRADES.map(u => [u.id, u]));
const WEAPON_BY_LABEL = Object.fromEntries(Object.values(WEAPONS).map(w => [w.label, w]));
const CHEST_BY_LABEL = Object.fromEntries(Object.entries(CHESTS).map(([id, c]) => [c.label, { id, ...c }]));
const CHEST_DESC = {
  BSC: 'Бесплатный базовый сундук: GLD/EXP и редкий HEA. Хорошая безопасная награда.',
  WPN: 'Оружейный сундук: пушки, усиления пушек или общий прирост силы.',
  ABL: 'Сундук протоколов: Q-протоколы, мутации и модули движения.',
  РЕД: 'Редкий сундук: сильное усиление протокола.',
  CRS: 'Проклятый сундук: сильная награда, но протокол становится опаснее.'
};
const PICKUP_DESC = {
  GLD: 'Кредиты для сундуков и ставок. Подбор делится между живыми игроками.',
  EXP: 'Опыт для уровней. Новый выбор улучшения появится между секторами.',
  HEA: 'Лечение. Восстанавливает здоровье.'
};
const ENEMY_DESC = {
  grunt: 'Базовая угроза: давит количеством и контактным уроном.', runner: 'Быстрая угроза: закрывает дистанцию и ломает позицию.', tank: 'Бронированная угроза: блокирует пространство и впитывает урон.', shooter: 'Дальний процесс: держит дистанцию и стреляет красными снарядами.', charger: 'Готовится, затем рывок. Следи за красной линией.', bomber: 'Подходит, запускает взрыв и детонирует. Уходи из радиуса.', bouncer: 'Отскакивает от стен и толкает игрока.', glitch: 'Сбойный процесс: мигает рядом и бьёт.',
  echo: 'Эхо-процесс: стреляет знакомыми снарядами с дистанции.', orbiter: 'Орбитер: кружит рядом и держит фронтальный щит.', anchor: 'Якорь: поле тянет и замедляет.', splitter: 'Делитель: после смерти распадается на быстрые части.', prism: 'Призма: стреляет призменными линиями.', pulse: 'Импульс: атакует областьной волной.', leech: 'Пиявка: лечит раненые угрозы, приоритетная цель.', herald: 'Глашатай: ведёт линию давления и призывает рой.', boss: 'Главная угроза: залпы, подкрепление и усиленные фазы.'
};
const esc = escHtml;


function weaponReadability(opt = {}) {
  const key = String(opt.upgrade || opt.id || opt.stat || '');
  const req = opt.reqWeapon ? String(opt.reqWeapon).toUpperCase().replace('дробовик', 'SHG').replace('самонаводчик', 'SEK').replace('ракетница', 'RKT') : '';
  const m = {
    weapon_seeker: {
      role: 'NEW', tone: 'new',
      ru: 'Открывает искатель как новый слот оружия.', en: 'Unlocks Seeker as a new weapon slot.',
      changeRu: 'самонаводящийся снаряд · одиночное давление', changeEn: 'homing projectile · single-target pressure'
    },
    weapon_rocketgun: {
      role: 'NEW', tone: 'new',
      ru: 'Открывает разломный заряд как новый слот оружия.', en: 'Unlocks Breach Charge as a new weapon slot.',
      changeRu: 'тяжёлый взрыв · контроль зоны', changeEn: 'heavy blast · area control'
    },
    bullet_ricochet: {
      role: 'RANGE', tone: 'range',
      ru: 'Все снаряды получают дополнительный отскок.', en: 'All projectiles gain one extra wall bounce.',
      changeRu: '+1 отскок · лучше в узких секторах', changeEn: '+1 bounce · better in tight rooms'
    },
    bullet_range: {
      role: 'RANGE', tone: 'range',
      ru: 'Увеличивает дальность оружия всех героев, включая Живое казино и Контроллера.', en: 'Increases weapon range for every hero, including Living Casino and Controller.',
      changeRu: '+22% ко всей дальности оружия', changeEn: '+22% to all weapon range'
    },
    bullet_fire: {
      role: 'STATUS', tone: 'status', element: 'fire',
      ru: 'Пули поджигают угроз и наносят периодический урон.', en: 'Bullets burn enemies over time.',
      changeRu: 'огонь · сильнее с ядом', changeEn: 'burn · stronger with poison'
    },
    bullet_freeze: {
      role: 'CONTROL', tone: 'control', element: 'freeze',
      ru: 'Пули охлаждают и могут коротко остановить угроз.', en: 'Bullets chill and can briefly stop enemies.',
      changeRu: 'холод · безопаснее против толпы', changeEn: 'chill · safer versus swarms'
    },
    bullet_poison: {
      role: 'STATUS', tone: 'status', element: 'poison',
      ru: 'Коррозия наносит периодический урон; каждый уровень быстрее разрушает броню.', en: 'Corrosion deals damage over time; each stack strips armor faster.',
      changeRu: 'коррозия · каждый уровень быстрее снимает броню', changeEn: 'corrosion · each stack strips armor faster'
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
      ru: 'Статусы прыгают с убитых угроз на ближайшие цели.', en: 'Statuses jump from killed enemies to nearby targets.',
      changeRu: 'переход статуса при убийстве', changeEn: 'status spreads on kill'
    },
    bullet_chain: {
      role: 'CONTROL', tone: 'control',
      ru: 'Попадания передают урон ближайшим угрозам. Статусы сами по связи не идут.', en: 'Hits pass damage to nearby enemies. Statuses do not transfer by default.',
      changeRu: '+1 прыжок связи · только урон', changeEn: '+1 link jump · damage only'
    },
    bullet_chain_status_link: {
      role: 'SYNERGY', tone: 'synergy',
      ru: 'Связь переносит все текущие и будущие статусы оружия.', en: 'Projectile links carry all current and future weapon statuses.',
      changeRu: 'пассивно · действует и на будущие статусы', changeEn: 'passive · includes future statuses'
    },
    shg_teeth: {
      role: 'DPS', tone: 'dps',
      ru: 'Клиновой разряд получает больше осколков в каждом залпе.', en: 'SHG fires more shards per shot.',
      changeRu: '+2 дробины · сильнее вблизи', changeEn: '+2 pellets · stronger up close'
    },
    shg_longshot: {
      role: 'RANGE', tone: 'range',
      ru: 'Правая кнопка тратит все заряды клинового разряда на один дальний тяжёлый выстрел.', en: 'RMB spends all SHG charges on one heavy long shot.',
      changeRu: 'правая кнопка дальний тяжёлый выстрел', changeEn: 'RMB heavy long shot'
    },
    sek_split: {
      role: 'DPS', tone: 'dps',
      ru: 'Искатель выпускает фрагменты после удаления цели.', en: 'SEK kills release homing fragments.',
      changeRu: 'фрагменты при убийстве', changeEn: 'fragments on kill'
    },
    sek_chain: {
      role: 'CONTROL', tone: 'control',
      ru: 'Искатель лучше держит цель и живёт дольше.', en: 'SEK locks on harder and lives longer.',
      changeRu: 'лучше держит цель', changeEn: 'stronger lock-on'
    },
    sek_swarm: {
      role: 'DPS', tone: 'dps',
      ru: 'правая кнопка выпускает рой SEK-пуль.', en: 'RMB releases a burst swarm of SEK bullets.',
      changeRu: 'рой сигнальных снарядов', changeEn: 'homing bullet swarm'
    },
    rkt_cluster: {
      role: 'DPS', tone: 'dps',
      ru: 'Разломный заряд добавляет мини-взрывы вокруг детонации.', en: 'RKT adds mini-blasts around detonation.',
      changeRu: 'дополнительные мини-взрывы', changeEn: 'extra mini-blasts'
    },
    rkt_mines: {
      role: 'CONTROL', tone: 'control',
      ru: 'Разломный заряд оставляет отложенные мины.', en: 'RKT leaves delayed square mines.',
      changeRu: 'мины во время полёта', changeEn: 'mines during flight'
    },
    rkt_stun: {
      role: 'CONTROL', tone: 'control',
      ru: 'Разломные взрывы могут оглушать угрозы.', en: 'All RKT explosions can stun enemies.',
      changeRu: 'оглушение взрывом', changeEn: 'stun on blast'
    },
    rkt_scatter: {
      role: 'CONTROL', tone: 'control',
      ru: 'Разломные взрывы сильнее разбрасывают угрозы.', en: 'All RKT explosions scatter enemies harder.',
      changeRu: 'отбрасывание взрывом', changeEn: 'knockback on blast'
    },
    rkt_remote: {
      role: 'CONTROL', tone: 'control',
      ru: 'Правая кнопка взрывает выпущенные разломные заряды по очереди.', en: 'RMB detonates launched rockets one by one, oldest first.',
      changeRu: 'ручная детонация по очереди', changeEn: 'remote detonation one by one'
    },
    wpn_dmg: {
      role: 'DPS', tone: 'dps',
      ru: 'Повышает прямой урон всего оружия.', en: 'Increases direct damage for all weapons.',
      changeRu: '+18% урон оружия', changeEn: '+18% weapon damage'
    },
    wpn_fire: {
      role: 'DPS', tone: 'dps',
      ru: 'Оружейный такт ускоряет перезарядку всего оружия каждого героя, включая пушки Живого казино, SAW и стрелковые процессы.', en: 'Weapon Clock shortens every hero weapon cycle, including Living Casino guns, Controller SAW, and ranged controlled processes.',
      changeRu: '+14% оружейный такт', changeEn: '+14% Weapon Clock'
    }
  };
  if (String(opt.kind || '').startsWith('lc_')) {
    const key = String(opt.kind || '');
    const lc = {
      lc_spark_unlock: {
        role: 'CONTROL', tone: 'control',
        ru: 'Открывает модуль с тремя искрами контроля и вторую линию наведения.', en: 'Unlocks the control module with three sparks and its second targeting line.',
        changeRu: 'открыты 3 искры контроля', changeEn: '3 control sparks unlocked'
      },
      lc_target_slot: {
        role: 'TARGETING', tone: 'control',
        ru: 'Добавляет канал LVC: ещё один выстрел в залпе.', en: 'Adds an LVC channel: one more shot in each volley.',
        changeRu: '+1 отмеченная цель', changeEn: '+1 marked target'
      },
      lc_gun_range: {
        role: 'UTILITY', tone: 'utility',
        ru: 'Увеличивает дальность наведения и полёта выстрелов пушек Живого казино.', en: 'Increases Living Casino gun targeting and projectile range.',
        changeRu: '+15% дальность пушек', changeEn: '+15% gun range'
      },
      lc_spark_count: {
        role: 'CONTROL', tone: 'control',
        ru: 'Добавляет две одновременные искры и два указания цели. Прокачивается без лимита.', en: 'Adds two simultaneous control sparks and two target instructions. Repeatable without a limit.',
        changeRu: '+2 искры контроля', changeEn: '+2 control sparks'
      },
      lc_spark_damage: {
        role: 'DPS', tone: 'dps',
        ru: 'Даёт искрам урон во время связи. Без этого усиления они только контролируют угрозу.', en: 'Gives sparks damage while linked. Without this upgrade they only control the threat.',
        changeRu: 'урон искр', changeEn: 'spark damage'
      },
      lc_spark_hold: {
        role: 'CONTROL', tone: 'control',
        ru: 'Искры дольше удерживают угрозу перед отталкиванием.', en: 'Control sparks hold threats longer before release.',
        changeRu: 'дольше связь', changeEn: 'longer link'
      },
      lc_spark_range: {
        role: 'CONTROL', tone: 'control',
        ru: 'Искры замечают угрозы с большего расстояния.', en: 'Control sparks detect threats from farther away.',
        changeRu: 'дальность искр', changeEn: 'spark range'
      }
    };
    const out = lc[key] || { role: 'UTILITY', tone: 'utility', ru: cleanPlayerText(opt.desc || 'Усиление Живого казино.'), en: cleanPlayerText(opt.desc || 'Living Casino upgrade.'), changeRu: 'усиление', changeEn: 'upgrade' };
    return { role: out.role, tone: out.tone, summary: localText(out.ru, out.en), change: localText(out.changeRu, out.changeEn) };
  }
  if (opt.pcOnly) {
    const pc = {
      ctrl_process_slot: { role: 'CONTROL', tone: 'control', ru: 'Добавляет место для ещё одного подконтрольного процесса.', en: 'Adds room for one more controlled process.', changeRu: '+1 процесс под контролем', changeEn: '+1 controlled process' },
      ctrl_process_power: { role: 'CONTROL', tone: 'control', ru: 'Команды быстрее заполняют захват, а все атаки процессов становятся сильнее.', en: 'Commands capture faster and every process attack hits harder.', changeRu: 'быстрее перехват · сильнее все атаки', changeEn: 'faster capture · stronger attacks' },
      ctrl_capture_tier: { role: 'CONTROL', tone: 'control', ru: 'Открывает захват необычных угроз по ступеням; четвёртая ступень разрешает захват босса.', en: 'Unlocks capture tiers for unusual threats; the fourth tier allows boss capture.', changeRu: 'шире пул захвата', changeEn: 'wider capture pool' },
      ctrl_process_fire: { role: 'DPS', tone: 'dps', ru: 'Подконтрольные процессы атакуют чаще.', en: 'Controlled processes attack more often.', changeRu: 'чаще атаки процессов', changeEn: 'faster process attacks' },
      ctrl_process_contact_status: { role: 'SYNERGY', tone: 'synergy', ru: 'Телесные атаки процессов становятся живыми снарядами и переносят любые текущие и будущие статусы.', en: 'Process body attacks become living projectiles and carry all current and future statuses.', changeRu: 'укусы · касания · прыжки · самоподрыв', changeEn: 'bites · contact · leaps · self-destruct' },
      ctrl_process_life: { role: 'CONTROL', tone: 'control', ru: 'Подконтрольные процессы дольше держат сигнал. Цели с большим запасом прочности получают более долгий срок контроля.', en: 'Controlled processes keep their signal longer. Higher-durability targets get a longer control timer.', changeRu: 'дольше срок контроля', changeEn: 'longer process life' },
      ctrl_process_death_heal: { role: 'SUSTAIN', tone: 'sustain', ru: 'Гибель или завершение срока процесса возвращает герою часть HP от максимального здоровья процесса.', en: 'A process death or completed control lifetime restores hero HP based on that process maximum health.', changeRu: '2% · затем +3% · +4% · дальше', changeEn: '2% · then +3% · +4% · onward' },
      ctrl_process_persist: { role: 'CONTROL', tone: 'control', ru: 'Процессы не очищаются у портала и аккуратно переносятся в следующий сектор.', en: 'Processes survive portal transition and are safely repositioned in the next sector.', changeRu: 'перенос через портал', changeEn: 'portal carry' },
      qrn_radius: { role: 'CONTROL', tone: 'control', ru: 'Якорь цепляет угрозы дальше от напольного или настенного маркера.', en: 'The anchor can chain threats farther from its floor or wall marker.', changeRu: 'дальше цепи', changeEn: 'longer chains' },
      qrn_hold: { role: 'CONTROL', tone: 'control', ru: 'Каждый уровень сильно увеличивает срок работы якоря.', en: 'Each level strongly extends anchor duration.', changeRu: 'сильно дольше работа', changeEn: 'strongly longer duration' },
      qrn_links: { role: 'CONTROL', tone: 'control', ru: 'Добавляет 3 одновременных захвата. Базово — 5, максимум — 20.', en: 'Adds 3 simultaneous captures. Base capacity is 5; maximum is 20.', changeRu: '+3 захвата · максимум 20', changeEn: '+3 captures · maximum 20' },
      qrn_damage: { role: 'DPS', tone: 'dps', ru: 'Каждый уровень заметно усиливает разряд и ускоряет его повторение.', en: 'Each level noticeably strengthens the discharge and makes it repeat faster.', changeRu: 'сильнее и чаще разряд', changeEn: 'stronger, faster discharge' },
    };
    const out = pc[key] || { role: 'CONTROL', tone: 'control', ru: cleanPlayerText(opt.desc || 'Усиление команды контроля.'), en: cleanPlayerText(opt.desc || 'Control command upgrade.'), changeRu: 'усиление контроля', changeEn: 'control upgrade' };
    return { ...out, summary: localText(out.ru, out.en), change: localText(out.changeRu, out.changeEn) };
  }
  const out = m[key] || {
    role: opt.kind === 'weapon' ? 'NEW' : opt.kind === 'stat' ? 'DPS' : 'UTILITY', tone: opt.kind === 'weapon' ? 'new' : 'utility',
    ru: cleanPlayerText(opt.desc || opt.preview || 'Усиление выбранного ядра.'),
    en: cleanPlayerText(opt.desc || opt.preview || 'Core upgrade.'),
    changeRu: req ? `нужно ${req}` : 'усиление ядра',
    changeEn: req ? `needs ${req}` : 'core upgrade'
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
    NEW: 'Новый слот для выбранного ядра.', DPS: 'Больше урона, темпа или давления.', RANGE: 'Снаряды или зоны работают дальше.', STATUS: 'Огонь, холод, яд и их перенос.', CONTROL: 'Замедление, захват, зоны или цепи.', SYNERGY: 'Лучше работает с уже собранным ядром.', ECONOMY: 'Больше ресурсов.'
  };
  const en = {
    NEW: 'New slot for your core.', DPS: 'More damage, tempo, or pressure.', RANGE: 'Projectiles or zones work farther.', STATUS: 'Burn, chill, poison, and spread.', CONTROL: 'Slow, lock, zones, or chains.', SYNERGY: 'Works better with your current core.', ECONOMY: 'More resources.'
  };
  return localText(ru[r] || 'Категория выбора ядра.', en[r] || 'Core choice category.');
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

function displayLoopNumber(loop = 0) { return Math.max(1, (Number(loop) || 0) + 1); }
function finalGoalLine(room = {}) {
  const g = room.runGoal || { loops: 6, loop: 0 };
  const loop = Math.max(0, Math.min(g.loops || 6, g.loop || 0));
  return `${localText('ЦЕЛЬ', 'GOAL')} ${loop}/${g.loops || 6} ${localText('ЦИКЛОВ', 'LOOPS')}`;
}
function finalSummaryRows(sum = {}) {
  const players = Array.isArray(sum.players) ? sum.players : [];
  const weaponText = players.map(p => `${p.name || 'P'}: ${(p.weapons || []).join('/') || '—'}`).join(' · ');
  const playerText = players.map(p => `${p.name || 'P'} ${localText('HP', 'HP')} ${p.hp || 0}/${p.maxHp || 0} · ${localText('УРОВЕНЬ', 'LVL')} ${p.level || 0} · GLD ${p.gld || 0} · ${p.skin || localText('облик', 'skin')}`).join(' | ');
  const qText = players.map(p => `${p.name || 'P'}: ${p.q || '—'}`).join(' | ');
  const companionText = players.map(p => `${p.name || 'P'}: ${localText('РЫВОК', 'DASH')} ${p.dash || 1} · ${localText('ДРОНЫ', 'DRN')} ${p.drones || 0}`).join(' | ');
  return [
    [localText('ЦИКЛЫ', 'LOOPS'), `${sum.loopsCleared || 0}/${sum.loopsTarget || 6}`],
    [localText('СЕКТОРА', 'SECTORS'), String(sum.roomsCleared || 0)],
    [localText('УБИЙСТВА', 'KILLS'), String(sum.kills || 0)],
    [localText('ГЛАВНЫЕ УГРОЗЫ', 'CORE THREATS'), String(sum.bosses || 0)],
    ['GLD', String(sum.gld || 0)],
    ['EXP', String(sum.exp || 0)],
    ['HEA', String(sum.hea || 0)],
    [localText('УРОН ПОЛУЧЕН', 'DAMAGE TAKEN'), String(sum.damage || 0)],
    [localText('ЛУЧШЕЕ КОМБО', 'BEST COMBO'), `x${Number(sum.bestCombo || 1).toFixed(1)}`],
    [localText('БЕЗ УРОНА', 'NO HIT'), String(sum.noHitBest || 0)],
    [localText('БЫСТРЫЕ СЕКТОРА', 'FAST SECTORS'), String(sum.fastBest || 0)],
    [localText('КОНТРАКТЫ', 'CONTRACTS'), `${sum.contractsDone || 0}/${sum.contractsSeen || 0}`],
    [localText('СИГНАТУРЫ', 'SIGNATURES'), String(sum.signatures || 0)],
    [localText('ИГРОКИ', 'PLAYERS'), playerText || '—'],
    ['WPN', weaponText || '—'],
    ['Q', qText || '—'],
    [localText('СПУТНИКИ', 'COMPANIONS'), companionText || '—']
  ];
}

const activeLabel = p => p?.[P.ACTIVELABEL] || activeNoneLabel();
const activeDesc = p => activeDescFrom(activeLabel(p), p?.[P.ACTIVEDESC] || activeNoneDesc());
const activeShort = p => locActiveShort(activeLabel(p));

const BOSS_REWARD_HINTS = {
  'TARGET LOCK': [localText('МЕТКА ЦЕЛИ', 'TARGET LOCK'), localText('Наводка усиливает точность и давление по отмеченным угрозам.', 'Marking improves accuracy and pressure against tagged threats.')],
  'GHOST DECOY': [localText('ПРИЗРАЧНАЯ ПРИМАНКА', 'GHOST DECOY'), localText('Создаёт долгий обманный сигнал, который отвлекает угрозы и даёт время на позицию.', 'Creates a long-lasting false signal that distracts threats and buys positioning time.')],
  'REDLINE BOOST': [localText('КРАСНАЯ ЛИНИЯ', 'REDLINE BOOST'), localText('Рывок ускоряет антивирус. Повторы увеличивают силу и длительность.', 'The dash accelerates the antivirus. Stacks improve force and duration.')],
  'SPAWN HOLD': [localText('ЗАМОРОЗКА СПАВНА', 'SPAWN HOLD'), localText('На старте сектора угрозы задерживаются, чтобы антивирус успел занять позицию.', 'Threats are delayed at sector start so the antivirus can take position.')],
  'KILL SWITCH': [localText('АВАРИЙНАЯ ОЧИСТКА', 'KILL SWITCH'), localText('Один раз за протокол очищает экран от угроз, включая главную угрозу.', 'Once per protocol, clears the screen of threats, including the core threat.')],
  'MIRROR PAYOUT': [localText('ЗЕРКАЛЬНЫЙ ПРИЗ', 'MIRROR PAYOUT'), localText('Копирует следующий усиливаемый приз с выбором. Заряд возвращается после победы над главной угрозой.', 'Copies the next stackable choice prize. Charge returns after the core threat is cleared.')],
  'AEGIS PROCESS': [localText('ЭГИДА', 'AEGIS PROCESS'), localText('Даёт защитный слой оболочки. Повторы увеличивают запас защиты.', 'Adds a shell shield layer. Stacks increase its capacity.')],
  'NULL REVIVAL': [localText('НУЛЕВОЕ ВОССТАНОВЛЕНИЕ', 'NULL REVIVAL'), localText('Один раз возвращает антивирус после сбоя.', 'Restores the antivirus once after a crash.')],
  'BOSS KEY': [localText('КЛЮЧ ЯДРА', 'CORE KEY'), localText('Открывает следующий сундук с выбором бесплатно и повышает качество награды.', 'Makes the next choice chest free and upgrades its reward quality.')]
};
function bossRewardHint(label = '') {
  const key = String(label || '').toUpperCase().replace(/\s+\d+\/\d+$|\s+X\d+$/i, '').trim();
  return BOSS_REWARD_HINTS[key] || [label || localText('ПРИЗ ГЛАВНОЙ УГРОЗЫ', 'CORE THREAT PRIZE'), localText('Сильный приз после очистки главной угрозы.', 'A strong prize after clearing the core threat.')];
}
function casinoLockParts(raw = '') {
  const s = String(raw || '').toUpperCase().trim();
  if (!s) return { symbol: '', count: 0, label: '—' };
  const m = s.match(/^(.+?)\s+X(\d+)$/i);
  if (m) return { symbol: m[1].trim(), count: Math.max(1, Number(m[2]) || 1), label: s };
  const plus = s.includes('+') ? s.split('+').map(x => x.trim()).filter(Boolean) : [];
  if (plus.length) return { symbol: plus[0], count: plus.length, label: s };
  return { symbol: s, count: 1, label: s };
}
function casinoCellTone(symbol = '') {
  const x = String(symbol || '').toUpperCase().trim();
  if (!x || x === '—') return '';
  if (x === 'STC') return 'static';
  if (x === 'BAD' || x === 'LOSE' || x === 'NO' || x === 'ОТК') return 'lose';
  if (x === 'ФИКС' || x === 'LOCK' || x === 'NEXT' || x === 'CELL') return 'lock';
  if (x === 'ДЖК' || x === 'JCK') return 'jackpot';
  return 'win';
}
function casinoCellClass(symbol = '') {
  const tone = casinoCellTone(symbol);
  if (tone === 'static') return 'static';
  if (tone === 'lose') return 'lose';
  if (tone === 'jackpot') return 'win jackpot';
  if (tone === 'lock') return 'win lock-cell';
  if (tone === 'win') return 'win';
  return '';
}
function casinoIsBadCell(symbol = '') { return casinoCellTone(symbol) === 'lose'; }

function casinoNormalizeSlotLocks(locks = []) {
  const clean = s => {
    const x = String(s || '').toUpperCase().replace(/\s+X\d+$/i, '').trim();
    return ['ДЖК','JCK','WPN','ABL','РЕД','RAR','SKN','GLD','EXP','HEA','STC','BAD'].includes(x) ? ({JCK:'JCK',ДЖК:'JCK',RAR:'RAR',РЕД:'RAR'}[x] || x) : '';
  };
  return [0, 1, 2].map(i => clean(Array.isArray(locks) ? locks[i] : ''));
}
function casinoCellLine(c = {}) {
  const slot = Math.max(1, (Number(c.slot || 0) | 0) + 1);
  const raw = String(c.raw || '').toUpperCase();
  const sym = String(c.symbol || '').toUpperCase();
  const shown = casinoDisplaySymbol(sym || raw || '—');
  if (raw === 'LOCK' || raw === 'ФИКС') return `S${slot}: ${casinoDisplaySymbol('LOCK')}`;
  if (c.locked) return `S${slot}: ${shown} ${casinoDisplaySymbol('ФИКС')}`;
  return `S${slot}: ${shown}`;
}
function casinoDisplaySymbol(symbol = '') {
  const x = String(symbol || '').toUpperCase().trim();
  const ru = { 'ДЖК': 'ДЖК', JCK: 'ДЖК', 'РЕД': 'РЕД', RAR: 'РЕД', 'ФИКС': 'ФИКС', LOCK: 'ФИКС' };
  const en = { 'ДЖК': 'JCK', JCK: 'JCK', 'РЕД': 'RAR', RAR: 'RAR', 'ФИКС': 'LOCK', LOCK: 'LOCK' };
  return localText(ru[x] || x || '—', en[x] || x || '—');
}


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
    this.casinoLockSymbol = '';
    this.casinoLockSpinSymbol = '';
    this.casinoSlotLocks = ['', '', ''];
    this.casinoMeta = { heat: 0, rareProgress: 0, skinProgress: 0, pendingSkin: 0, pendingPrize: 0 };
    this.casinoDecisionPending = false;
    this.casinoSkinChoicePending = false;
    this.casinoPrizeChoicePending = false;
    this.install = { open: false, choices: [], expires: 0, total: 15, locked: false, skinOnly: false, waitingOnly: false, dataLoading: false, picked: false, bossSignature: false };
    this.installLatestOfferId = 0;
    this.installSyncKey = '';
    this.installSyncSeenAt = 0;
    this.skinClaim = null;
    this.weapon = { open: false, choices: [], locked: false };
    this.ability = { open: false, choices: [], locked: false };
    this.rare = { open: false, choices: [], locked: false };
    this.wagerRenderKey = '';
    this.names = new Map();
    this.localRerollSpent = 0;
    this.localRerollServerLeft = null;

    this.initExplain();
    onLangChange(() => {
      this.hideTip();
      // Rebuild immediately. A language change may happen while the game is
      // paused behind INSTALL, so waiting for a later animation frame can leave
      // the entry animation stuck at its transparent first keyframe.
      this.installPreviewSig = '';
      if (this.latestRoom) this.renderInstallNextRoom(this.latestRoom, this.latestMe?.[P.ID] || '');
    });
    const stakesEl = $('casino-stakes');
    this.lastStakePointerAt = 0;
    const betButtonFromEvent = (ev) => ev.target?.closest?.('button[data-stake]') || null;
    const triggerBetFromButton = (ev, btn, immediate = false) => {
      if (!btn || btn.disabled) return false;
      ev.preventDefault();
      ev.stopPropagation();
      if (immediate && typeof performance !== 'undefined') this.lastStakePointerAt = performance.now();
      this.placeBet(btn.dataset.stake);
      return true;
    };
    // Immediate pointer handler: BET should respond on press, not after hover/focus/tooltips.
    stakesEl?.addEventListener('pointerdown', (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      triggerBetFromButton(ev, betButtonFromEvent(ev), true);
    });
    stakesEl?.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const recentPointer = typeof performance !== 'undefined' && performance.now() - (this.lastStakePointerAt || 0) < 320;
        if (recentPointer) { ev.preventDefault(); ev.stopPropagation(); return; }
        triggerBetFromButton(ev, btn, false);
      });
    });
    // Safety delegation: keeps BET buttons responsive even if their inner markup changes.
    stakesEl?.addEventListener('click', (ev) => {
      const recentPointer = typeof performance !== 'undefined' && performance.now() - (this.lastStakePointerAt || 0) < 320;
      if (recentPointer) { ev.preventDefault(); ev.stopPropagation(); return; }
      triggerBetFromButton(ev, betButtonFromEvent(ev), false);
    });
    $('casino-skin-actions')?.addEventListener('click', (ev) => {
      const skinBtn = ev.target?.closest?.('button[data-casino-skin]');
      const prizeBtn = ev.target?.closest?.('button[data-casino-prize]');
      const btn = skinBtn || prizeBtn;
      if (!btn || btn.disabled) return;
      if (skinBtn && !this.casinoSkinChoicePending) return;
      if (prizeBtn && !this.casinoPrizeChoicePending) return;
      ev.preventDefault(); ev.stopPropagation();
      $('casino-skin-actions')?.querySelectorAll('button').forEach(b => { b.disabled = true; });
      if (skinBtn) {
        this.setCasinoPanelState(localText('ВЫБОР ОБЛИКА', 'SKIN CHOICE'), 'purple');
        this.net?.sendCasinoSkinPick?.(Number(skinBtn.dataset.casinoSkin) | 0);
      } else {
        this.setCasinoPanelState(localText('ВЫБОР ПРИЗА', 'PRIZE CHOICE'), 'gold');
        this.net?.sendCasinoPrizePick?.(Number(prizeBtn.dataset.casinoPrize) | 0);
      }
    });
  }


  ensureFinalePanel() {
    let el = document.getElementById('run-complete-panel');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'run-complete-panel';
    el.className = 'hidden';
    el.innerHTML = '<div class="run-complete-card"><div class="run-complete-kicker"></div><h2></h2><div class="run-complete-sub"></div><table></table><div class="run-complete-footer"></div></div>';
    document.body.appendChild(el);
    return el;
  }

  showRunComplete(room = {}) {
    const sum = room.finalSummary || {};
    const el = this.ensureFinalePanel();
    el.classList.remove('hidden');
    const kicker = el.querySelector('.run-complete-kicker');
    const title = el.querySelector('h2');
    const sub = el.querySelector('.run-complete-sub');
    const table = el.querySelector('table');
    const footer = el.querySelector('.run-complete-footer');
    if (kicker) kicker.textContent = localText('СИСТЕМА СТАБИЛЬНА', 'SYSTEM STABLE');
    if (title) title.textContent = localText('ОЧИСТКА ЗАВЕРШЕНА', 'CLEANUP COMPLETE');
    if (sub) sub.textContent = localText(`${sum.loopsTarget || 6} циклов пройдено. Заражённая ветка закрыта.`, `${sum.loopsTarget || 6} loops cleared. The infected branch is closed.`);
    if (table) table.innerHTML = finalSummaryRows(sum).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
    if (footer) footer.textContent = localText('КОНТРОЛЁР ПРОЦЕССОВ ДОСТУПЕН', 'PROCESS CONTROLLER AVAILABLE');
  }

  hideRunComplete() {
    const el = document.getElementById('run-complete-panel');
    if (el) el.classList.add('hidden');
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
    this.tipSize = { w: 260, h: 80 };
    this.tipMoveRaf = 0;
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
      if (this.tipMoveRaf || !this.tip || this.tip.classList.contains('hidden')) return;
      this.tipMoveRaf = requestAnimationFrame(() => {
        this.tipMoveRaf = 0;
        this.placeTip();
      });
    };
    window.addEventListener('pointermove', move, { passive: true });
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
    const rect = this.tip.getBoundingClientRect();
    this.tipSize = { w: rect.width || 260, h: rect.height || 80 };
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
    const tw = this.tipSize?.w || 260;
    const th = this.tipSize?.h || 80;
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
      const [, type, label, x, y, opened, cost, currency, valueLabel, valueTier] = o;
      if (dist2(x, y) > 34 ** 2) continue;
      if (type === 'bet') { const bs = room?.betStakes; const blood = (room?.mods || []).includes('blood_tax'); found = { title: t('betTitle'), body: bs ? `${t('betInspect')} LOW ${bs.low} / MID ${bs.mid} / HIGH ${bs.high} ${blood ? 'HP' : 'GLD'}. ${localText('Ставки также усиливают контракт сектора, если он активен.', 'Bets also wager on the room contract when one is active.')}` : t('betInspect'), tone: 'red' }; }
      else { const blood = (room?.mods || []).includes('blood_tax') || String(currency).toUpperCase() === 'HP'; const slotCount = Math.max(0, Number(o[10] || 0) | 0); const reason = String(o[11] || '').trim(); const contractFree = !!o[12]; const costBody = opened ? objectStateText(opened, cost, blood ? 'HP' : 'GLD') : (contractFree && cost > 0 ? localText(`ЦЕНА ${cost} ${blood ? 'HP' : 'GLD'} ЗАЧЁРКНУТА: КРЕДИТНЫЙ ПРОПУСК`, `PRICE ${cost} ${blood ? 'HP' : 'GLD'} WAIVED: CREDIT PASS`) : cost > 0 && blood ? localText(`СТОИТ HP: ${cost} — платится здоровьем`, `HP COST: ${cost} — paid with health`) : objectStateText(opened, cost, currency || 'GLD')); const valueText = valueLabel ? localText(`РЕДКОСТЬ: ${locLabel(valueLabel)}. `, `RARITY: ${valueLabel}. `) : ''; const slotText = slotCount ? localText(`СЛОТЫ: ${slotCount}. `, `SLOTS: ${slotCount}. `) : ''; const reasonText = reason ? localText(`ИСТОЧНИК: ${locLabel(reason)}. `, `SOURCE: ${reason}. `) : ''; found = { title: `${locLabel(label)}${valueLabel ? ' ' + locLabel(valueLabel) : ''} / ${t('chestTitle')}`, body: `${valueText}${slotText}${reasonText}${chestDesc(label)} ${costBody}`, tone: contractFree ? 'gold' : blood ? 'red' : (label === 'CRS' ? 'purple' : valueTier >= 2 ? 'gold' : '') }; }
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


  positionFeedBelowLeftTop() {
    const feed = $('feed');
    const leftTop = $('hud-lefttop');
    if (!feed || !leftTop) return;
    const r = leftTop.getBoundingClientRect();
    if (!Number.isFinite(r.left) || !Number.isFinite(r.bottom) || r.width <= 0) return;
    const left = Math.max(12, Math.round(r.left));
    const top = Math.max(96, Math.round(r.bottom + 10));
    feed.style.setProperty('left', `${left}px`, 'important');
    feed.style.setProperty('top', `${top}px`, 'important');
    feed.style.setProperty('width', `min(560px, ${Math.max(260, Math.round(window.innerWidth - left - 24))}px)`, 'important');
    feed.style.setProperty('max-height', `${Math.max(120, Math.round(window.innerHeight - top - 140))}px`, 'important');
  }


  wagerPart(w = {}, key = '') {
    return localText(w[`${key}TextRu`] || w[`${key}Text`] || '', w[`${key}TextEn`] || w[`${key}Text`] || '');
  }

  wagerFxBody(f = {}) {
    return cleanPlayerText(localText(f.bodyRu || f.body || '', f.bodyEn || f.body || ''));
  }

  roomWagerActiveHtml(w = {}) {
    const progress = w.progress || {};
    const pct = progress.max ? Math.max(0, Math.min(100, Math.round((Number(progress.value || 0) / Math.max(1, Number(progress.max || 1))) * 100))) : 0;
    const progText = String(localText(progress.textRu || progress.text || '', progress.textEn || progress.text || '')).trim();
    return `<div class="wager-title active">${esc(w.completed ? localText('СТАВКА ВЫПОЛНЕНА', 'WAGER COMPLETE') : localText('СТАВКА АКТИВНА', 'WAGER ACTIVE'))}</div>
      <div class="wager-line"><b>${esc(localText('РИСК', 'RISK'))}</b><span>${esc(this.wagerPart(w, 'stake') || '—')}</span></div>
      <div class="wager-line"><b>${esc(localText('УСЛОВИЕ', 'CONDITION'))}</b><span>${esc(this.wagerPart(w, 'condition') || '—')}</span></div>
      <div class="wager-line"><b>${esc(localText('НАГРАДА', 'PRIZE'))}</b><span>${esc(this.wagerPart(w, 'prize') || '—')}</span></div>
      ${progText ? `<div class="wager-progress"><span>${esc(w.completed ? localText('ПРИЗ: СО СЛЕДУЮЩЕГО СЕКТОРА', 'REWARD: NEXT SECTOR') : progText)}</span><i style="width:${w.completed ? 100 : pct}%"></i></div>` : ''}`;
  }

  positionRightStatusCards() {
    const contract = $('hud-contract-card');
    const wager = $('room-wager-card');
    const baseTop = Math.max(92, Math.round((($('hud-top')?.getBoundingClientRect?.().bottom) || 110) + 12));
    const right = Math.max(14, Math.round(window.innerWidth - (($('hud-right')?.getBoundingClientRect?.().right) || (window.innerWidth - 42))));
    const width = Math.min(570, Math.max(300, Math.round(Math.min(window.innerWidth * 0.44, 570))));
    let nextTop = baseTop;
    if (contract && !contract.classList.contains('hidden')) {
      contract.style.setProperty('right', `${right}px`, 'important');
      contract.style.setProperty('top', `${nextTop}px`, 'important');
      contract.style.setProperty('width', `min(${width}px, 44vw)`, 'important');
      nextTop += Math.max(72, Math.round(contract.getBoundingClientRect().height || contract.offsetHeight || 74)) + 10;
    }
    if (wager && !wager.classList.contains('hidden') && wager.classList.contains('active')) {
      if (wager.parentElement !== document.body) document.body.appendChild(wager);
      wager.style.setProperty('left', 'auto', 'important');
      wager.style.setProperty('right', `${right}px`, 'important');
      wager.style.setProperty('top', `${nextTop}px`, 'important');
      wager.style.setProperty('bottom', 'auto', 'important');
      wager.style.setProperty('transform', 'none', 'important');
      const wagerWidth = Math.min(390, Math.max(260, Math.round(Math.min(window.innerWidth * 0.34, 390))));
      wager.style.setProperty('width', `min(${wagerWidth}px, 34vw)`, 'important');
      wager.style.setProperty('max-width', `min(${wagerWidth}px, 34vw)`, 'important');
      wager.style.setProperty('min-width', '260px', 'important');
      wager.style.setProperty('z-index', '24', 'important');
      wager.style.setProperty('pointer-events', 'none', 'important');
    }
  }

  positionRoomWagerCard() {
    const card = $('room-wager-card');
    if (!card || card.classList.contains('hidden')) return;
    if (card.classList.contains('active')) { this.positionRightStatusCards(); return; }
    const modal = $('install-modal');
    if (card.parentElement !== document.body) document.body.appendChild(card);
    const panel = modal && !modal.classList.contains('hidden') ? modal.querySelector('.panel') : null;
    if (!panel) {
      card.classList.add('wager-standalone');
      card.style.setProperty('left', '50%', 'important');
      card.style.setProperty('top', '50%', 'important');
      card.style.setProperty('right', 'auto', 'important');
      card.style.setProperty('bottom', 'auto', 'important');
      card.style.setProperty('transform', 'translate(-50%, -50%)', 'important');
      card.style.setProperty('width', 'min(330px, calc(100vw - 40px))', 'important');
      card.style.setProperty('z-index', '520', 'important');
      card.style.setProperty('pointer-events', 'auto', 'important');
      return;
    }
    card.classList.remove('wager-standalone');
    const r = panel.getBoundingClientRect();
    const gap = 14;
    const available = Math.max(190, Math.round(window.innerWidth - r.right - gap - 14));
    const w = Math.min(306, available);
    card.style.setProperty('left', `${Math.round(r.right + gap)}px`, 'important');
    card.style.setProperty('right', 'auto', 'important');
    card.style.setProperty('top', `${Math.max(14, Math.round(r.top))}px`, 'important');
    card.style.setProperty('bottom', 'auto', 'important');
    card.style.setProperty('transform', 'none', 'important');
    card.style.setProperty('width', `${w}px`, 'important');
    card.style.setProperty('z-index', '520', 'important');
    card.style.setProperty('pointer-events', 'auto', 'important');
  }

  renderInstallNextRoom(room = {}, myId = '') {
    const el = $('install-next-room');
    const hidePreview = () => {
      if (!el) return;
      el.classList.add('hidden');
      el.replaceChildren();
      el.setAttribute('aria-hidden', 'true');
      this.installPreviewSig = '';
    };
    const next = room?.next || null;
    if (!el || room?.phase !== 'install' || !next) {
      hidePreview();
      return;
    }
    const mods = (next.mods || []).filter(Boolean).slice(0, 6);
    const previewStatic = next.staticRainBreakdown || null;
    const hasStaticIntel = Math.max(0, previewStatic?.total | 0) > 0
      || Math.max(0, previewStatic?.banked | 0) > 0
      || Math.max(0, previewStatic?.deferredCore | 0) > 0;
    // The authoritative vote payload normally arrives in room.contractChoice.
    // Keep the preview's baked choices as a fallback so the left INSTALL panel
    // cannot go blank during the first snapshot / local transition hand-off.
    const bakedContractChoices = Array.isArray(next.objectiveChoices) ? next.objectiveChoices : [];
    const previewContract = room?.contractChoice || (bakedContractChoices.length
      ? { choices: bakedContractChoices, votes: {}, selected: '' }
      : null);
    const hasContractIntel = (Array.isArray(previewContract?.choices) && previewContract.choices.length > 0) || !!next.objective;
    if (!mods.length && !hasStaticIntel && !hasContractIntel) {
      hidePreview();
      return;
    }
    const modHtml = mods.length
      ? mods.map(m => `<span>${esc(roomModLabel(m, next))}</span>`).join('')
      : `<span>${esc(localText('ЧИСТО', 'CLEAN'))}</span>`;
    const staticBd = next.staticRainBreakdown || null;
    const activeStatic = Math.max(0, staticBd?.total | 0);
    const bankedStatic = Math.max(0, staticBd?.banked | 0);
    const deferredCore = Math.max(0, staticBd?.deferredCore | 0);
    const staticParts = staticBd ? staticBreakdownParts(staticBd, activeStatic > 0 ? 'sources' : 'bankedSources') : [];
    const staticTitle = activeStatic > 0
      ? localText(`ШТОРМ СЛЕД. СЕКТОРА · УР. ${activeStatic}`, `NEXT-SECTOR STORM · LVL ${activeStatic}`)
      : bankedStatic > 0
        ? localText(`СТАТИК В ЗАПАСЕ · УР. ${bankedStatic}`, `STATIC BANKED · LVL ${bankedStatic}`)
        : deferredCore > 0
          ? localText(`СТАТИК-ЯДРО НА ПАУЗЕ · УР. ${deferredCore}`, `STATIC CORE PAUSED · LVL ${deferredCore}`)
          : '';
    const staticWait = activeStatic <= 0 && (bankedStatic > 0 || deferredCore > 0)
      ? `<div class="install-next-static-wait">${esc(localText('ЖДЁТ СЛЕДУЮЩИЙ БОЕВОЙ СЕКТОР', 'WAITS FOR THE NEXT COMBAT SECTOR'))}</div>`
      : '';
    const corePause = deferredCore > 0 && bankedStatic > 0
      ? `<span>${esc(localText(`СТАТИК-ЯДРО +${deferredCore} · ПАУЗА`, `STATIC CORE +${deferredCore} · PAUSED`))}</span>`
      : '';
    const staticForecast = staticTitle
      ? `<div class="install-next-static"><b>${esc(staticTitle)}</b>${staticParts.length || corePause ? `<div class="install-next-static-sources">${staticParts.map(x => `<span>${esc(x)}</span>`).join('')}${corePause}</div>` : ''}${staticWait}</div>`
      : '';
    const contractOffer = previewContract;
    const contractChoices = Array.isArray(contractOffer?.choices) ? contractOffer.choices : [];
    const voteCounts = {};
    for (const id of Object.values(contractOffer?.votes || {})) voteCounts[id] = (voteCounts[id] || 0) + 1;
    const authoritativeVote = String(contractOffer?.votes?.[myId] || '');
    const pendingVote = this.pendingContractPick?.depth === contractOffer?.depth ? String(this.pendingContractPick.id || '') : '';
    if (authoritativeVote) this.pendingContractPick = null;
    else if (this.pendingContractPick && this.pendingContractPick.depth !== contractOffer?.depth) this.pendingContractPick = null;
    const myVote = authoritativeVote || pendingVote;
    const selectedContract = myVote ? (contractChoices.find(o => o.id === contractOffer.selected) || contractChoices.find(o => o.id === myVote)) : null;
    const selectedContractHtml = selectedContract ? (() => {
      const previews = Array.isArray(selectedContract.prizePreview) ? selectedContract.prizePreview : [];
      const prize = previews.length ? previews.map(contractFavorPreviewLabel).join(' + ') : localText('КОНТРАКТНЫЙ ПРИЗ', 'CONTRACT PRIZE');
      const detail = previews.length ? previews.map(f => `${contractFavorPreviewLabel(f)}: ${contractFavorPreviewBody(f)}`).join('\n\n') : localText('Приз закреплён за выбранным контрактом.', 'The reward is locked to the selected contract.');
      return `<div class="install-next-contract contract-selected"><b>${esc(localText('КОНТРАКТ ВЫБРАН', 'CONTRACT SELECTED'))}</b><div class="contract-selected-card" data-explain-title="${esc(localText('ПРИЗ КОНТРАКТА', 'CONTRACT PRIZE'))}: ${esc(prize)}" data-explain="${esc(detail)}" data-explain-tone="gold"><strong>${esc(locLabel(selectedContract.label || selectedContract.id))}</strong><span>${esc(locLabel(selectedContract.goal || ''))}</span><em>${esc(localText('ПРИЗ', 'PRIZE'))}: ${esc(prize)}</em></div></div>`;
    })() : '';
    const contract = selectedContractHtml || (contractChoices.length
      ? `<div class="install-next-contract contract-choice"><b>${esc(localText('ВЫБЕРИ КОНТРАКТ', 'CHOOSE CONTRACT'))}</b>${contractChoices.map((o, i) => { const previews = Array.isArray(o.prizePreview) ? o.prizePreview : []; const prize = previews.length ? previews.map(contractFavorPreviewLabel).join(' + ') : localText('КОНТРАКТНЫЙ ПРИЗ', 'CONTRACT PRIZE'); const detail = previews.length ? previews.map(f => `${contractFavorPreviewLabel(f)}: ${contractFavorPreviewBody(f)}`).join('\n\n') : localText('Конкретный приз показывается до выбора контракта.', 'The exact prize is shown before the contract is selected.'); return `<button type="button" class="contract-choice-card" data-contract-choice="${i}" data-contract-id="${esc(o.id)}" data-explain-title="${esc(localText('ПРИЗ КОНТРАКТА', 'CONTRACT PRIZE'))}: ${esc(prize)}" data-explain="${esc(detail)}" data-explain-tone="gold"><strong>[${i + 1}] ${esc(locLabel(o.label || o.id))}</strong><span>${esc(locLabel(o.goal || ''))}</span><em>${esc(localText('ПРИЗ', 'PRIZE'))}: ${esc(prize)}${voteCounts[o.id] ? ` · ${voteCounts[o.id]} VOTE` : ''}</em></button>`; }).join('')}</div>`
      : next.objective
        ? `<div class="install-next-contract"><b>${esc(localText('КОНТРАКТ', 'CONTRACT'))}</b>${objectiveChip(next.objective, 'CONTRACT')}</div>`
        : '');
    const choiceSig = contractChoices.map(o => `${o.id}:${(o.prizePreview || []).map(x => x?.id || x?.label || '').join('+')}`).join(',');
    const voteSig = Object.entries(voteCounts).sort(([a], [b]) => String(a).localeCompare(String(b))).map(([id, n]) => `${id}:${n}`).join(',');
    const staticSig = staticBd ? JSON.stringify({ total: activeStatic, banked: bankedStatic, deferredCore, sources: staticBd.sources || [], bankedSources: staticBd.bankedSources || [] }) : '';
    const previewSig = `${next.id}|${next.archetype}|${mods.join(',')}|${staticSig}|${choiceSig}|${voteSig}|${contractOffer?.selected || ''}|${myVote}|${next.objective?.id || ''}|${getLang()}`;
    if (this.installPreviewSig === previewSig && el.children.length && el.textContent.trim()) {
      el.classList.remove('hidden');
      el.setAttribute('aria-hidden', 'false');
      return;
    }
    // Rebuild behind the hard hidden state: a modal transition can never expose
    // an empty bordered shell while the next-room payload is changing.
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<div class="install-next-title">${esc(localText('СЛЕДУЮЩИЙ СЕКТОР', 'NEXT SECTOR'))}</div>` +
      `<div class="install-next-arch">${esc(archLabel(next.archetype))}</div>` +
      `<div class="install-next-label">${esc(localText('МОДИФИКАТОРЫ', 'MODIFIERS'))}</div>` +
      `<div class="install-next-mods">${modHtml}</div>${staticForecast}${contract}`;
    el.querySelectorAll('[data-contract-choice]').forEach(btn => btn.addEventListener('click', () => {
      if (this.pendingContractPick || authoritativeVote) return;
      this.pendingContractPick = { depth: contractOffer?.depth, id: String(btn.dataset.contractId || '') };
      this.net?.sendContractPick?.(Number(btn.dataset.contractChoice) | 0);
      this.playUiSound('pick');
      this.installPreviewSig = '';
      this.renderInstallNextRoom(this.latestRoom || room, myId);
    }));
    if (this.installPreviewSig !== previewSig) {
      this.installPreviewSig = previewSig;
      [0, 140, 280].forEach((ms, i) => setTimeout(() => { if (this.installPreviewSig === previewSig) this.playUiSound(i === 2 ? 'pick' : 'hover'); }, ms));
    }
    if (!el.children.length || !el.textContent.trim()) {
      hidePreview();
      return;
    }
    el.classList.remove('hidden');
    el.setAttribute('aria-hidden', 'false');
  }

  // ------------------------------------------------- per-frame update
  update(state, dt) {
    const me = state.me();
    const room = state.room;
    if (!me || !room) {
      const preview = $('install-next-room');
      if (preview) { preview.classList.add('hidden'); preview.replaceChildren(); preview.setAttribute('aria-hidden', 'true'); }
      this.installPreviewSig = '';
      return;
    }
    this.latestRoom = room;
    this.latestMe = me;
    this.renderInstallNextRoom(room, state.myId);
    if (room.phase === 'won') this.showRunComplete(room); else this.hideRunComplete();
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
    const roomDisplay = this.net?.mode === 'solo' ? localText('ОДИНОЧНАЯ ИГРА', 'SINGLE PLAYER') : (this.net.roomId || '----');
    $('hud-room').textContent = `${roomDisplay} · ${room.id}`;
    $('hud-loop').textContent = `${localText('ЦИКЛ', 'LOOP')} ${displayLoopNumber(room.loop)} / ${localText('ГЛУБИНА', 'DEPTH')} ${room.depth} · ${finalGoalLine(room)}`;
    const modLabels = (room.mods || []).map(m => roomModLabel(m, room));
    const modTone = (m) => m === 'static_rain' ? 'purple' : m === 'prism_grid' ? 'cyan' : m === 'blood_tax' || m === 'moving_room' || m === 'hunter_contract' ? 'red' : m === 'casino_virus' || m === 'echo_walls' ? 'purple' : m === 'greed' ? 'gold' : '';
    const visibleMods = (room.mods || []).filter(m => m !== 'static_rain');
    $('hud-mods').innerHTML = visibleMods.map(m => `<span class="term" data-explain-title="${esc(roomModLabel(m, room))}" data-explain="${esc(roomModHint(m, room))}"${modTone(m) ? ` data-explain-tone="${modTone(m)}"` : ''}>${esc(roomModLabel(m, room))}</span>`).join(' · ');
    if (room.betStakes) {
      const names = { low: 'LOW', mid: 'MID', high: 'HIGH' };
      const blood = (room.mods || []).includes('blood_tax');
      this.updateCasinoHelpLanguage();
      document.querySelectorAll('#casino-stakes button').forEach(btn => {
        const k = btn.dataset.stake;
        const cost = room.betStakes[k];
        if (!cost) return;
        const prof = this.casinoStakeProfile(k, cost, blood, room);
        btn.innerHTML = `<span class="stake-name">${names[k] || String(k).toUpperCase()}</span><span class="stake-cost ${blood ? 'hp-cost' : ''}">${cost} ${prof.unit}</span>`;
        this.setExplain(btn, `${names[k] || String(k).toUpperCase()} · ${prof.risk}`, prof.body, k === 'high' ? 'red' : k === 'mid' ? 'gold' : 'green');
      });
    }
    this.casinoLockSymbol = String(me[P.CASINOLOCK] || '').toUpperCase();
    if (this.casino.open) {
      this.updateCasinoLockBadge('');
      this.updateCasinoLuckCard(me);
      if (!this.casino.spinning) this.paintStoredCasinoLockCells(false);
    }
    $('hud-ping').textContent = this.net.ping ? `${this.net.ping}ms` : '';
    const obj = $('hud-objective');
    const skn = room.skinReward ? ` · <span class="term" data-explain-title="${esc(localText('СКРЫТЫЙ ОБЛИК', 'HIDDEN SHELL'))}" data-explain="${esc(localText('В этой секторе есть скрытый облик. После зачистки появится отдельная карточка облика, даже если выбора улучшения нет.', 'This sector has a hidden shell. After cleanup, a separate shell card appears even if there is no install choice.'))}">${esc(localText('ОБЛИК', 'SKIN'))} ${rarityText(room.skinReward)}</span>` : '';
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
    const rainHud = staticLine ? `<div class="static-rain-status"><span class="term" data-explain-title="${esc(localText('ОБЩИЙ СТАТИК-ШТОРМ', 'TOTAL STATIC STORM'))}" data-explain="${esc(staticExplain)}" data-explain-tone="purple">${esc(staticLine)}</span></div>` : '';
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
    const currentHud = `<div class="room-current"><span class="term" data-explain-title="${esc(localText('ТЕКУЩИЙ СЕКТОР', 'CURRENT SECTOR'))}" data-explain="${esc(roomIntelExplain(room, false))}">${esc(localText('СЕЙЧАС', 'NOW'))}</span>: ${esc(archLabel(room.archetype))}${currentModChips ? ' · ' + currentModChips : ' · ' + esc(localText('ЧИСТО', 'CLEAN'))}</div>` +
      `<div class="room-intel"><span class="term" data-explain-title="${esc(localText('ОПАСНОСТЬ СЕКТОРА', 'SECTOR DANGER'))}" data-explain="${esc(roomIntelExplain(room, false))}">${esc(dangerLabel(room))}</span> · ${esc(localText('УГРОЗЫ', 'THREAT'))}: ${esc(currentThreats)} · ${esc(localText('НАГРАДА', 'REWARD'))}: ${esc(currentRewards)}</div>` +
      (currentObjective ? `<div class="room-objective">${currentObjective}</div>` : '');
    const nextModIds = nx ? (nx.mods || []).filter(m => m !== 'static_rain').slice(0, 5) : [];
    const nextModChips = nx ? nextModIds.map(m => modChipSmall(m, nx, m === 'static_rain' && (nx?.staticRainLevel || 0) ? nx.staticRainLevel : 0)) : [];
    const nextMods = nextModChips.slice(0, 5).join(' + ');
    const nextRewards = nx?.rewardTags?.length ? ` · ${localText('НАГРАДА', 'REWARD')}: ${tagJoin(nx.rewardTags)}` : '';
    const nextThreats = nx?.threatTags?.length ? ` · ${localText('УГРОЗЫ', 'THREAT')}: ${tagJoin(nx.threatTags)}` : '';
    const nextStatic = ''; // Static shown only once in the unified top-right readout.
    const nextObjective = nx?.objective ? ` · ${objectiveChip(nx.objective, 'CONTRACT')}` : '';
    const prophecyHud = nx ? `<div class="room-prophecy"><span class="term" data-explain-title="${esc(localText('СЛЕДУЮЩИЙ СЕКТОР', 'NEXT SECTOR'))}" data-explain="${esc(roomIntelExplain(nx, true))}">${esc(localText('ДАЛЬШЕ', 'NEXT'))}</span>: ${esc(archLabel(nx.archetype))}${nextMods ? ' · ' + nextMods : ' · ' + esc(localText('ЧИСТО', 'CLEAN'))} · ${esc(dangerLabel(nx))}${esc(nextThreats)}${esc(nextRewards)}${esc(nextStatic)}${nextObjective}</div>` : '';
    let goalHtml = '';
    const liveEnemies = Math.max(0, room.liveEnemies || 0);
    const killGoal = Math.max(0, room.quota || 0);
    const killProgress = Math.min(Math.max(0, room.kills || 0), killGoal);
    const fullClearIds = new Set(['fast_clear','virus_clean','hunter_waves','grid_slow_clear','blood_paid','static_clean','cache_claim','clean_signal']);
    const fullClear = fullClearIds.has(String(room.objective?.id || '')) || room.mods?.includes?.('casino_virus') || room.mods?.includes?.('hunter_contract');
    if (room.phase === 'won') goalHtml = `<span class="done">${localText('ПРОХОЖДЕНИЕ ЗАВЕРШЕНО', 'RUN COMPLETE')}</span>`;
    else if (room.phase === 'install') goalHtml = `<span class="done">${t('installPhase')}</span>`;
    else if (room.cat === 'boss') goalHtml = room.portal[2] ? `<span class="done">${room.finalBoss ? localText('ФИНАЛЬНЫЙ ПОРТАЛ', 'FINAL PORTAL') : t('portalOpen')} — E</span>${skn}` : `${room.finalBoss ? localText('ФИНАЛЬНАЯ УГРОЗА', 'FINAL THREAT') : t('killBoss')}${skn}`;
    else if (room.portal[2]) goalHtml = `<span class="done">${t('portalOpen')} — E</span>${skn}`;
    else if (fullClear) goalHtml = `${t('clear')}: ${esc(localText('живых угроз', 'live threats'))} ${liveEnemies}${skn}`;
    else goalHtml = `${t('clear')} ${killProgress} / ${killGoal}${liveEnemies ? ` · ${esc(localText('живых', 'alive'))} ${liveEnemies}` : ''}${skn}`;
    obj.innerHTML = `${rainHud}${virusHud}${hunterHud}${currentHud}${prophecyHud}<div>${goalHtml}</div>`;
    const contractCard = $('hud-contract-card');
    if (contractCard) {
      if (room.objective && room.phase !== 'install') {
        contractCard.classList.remove('hidden', 'failed', 'done');
        if (room.objective.status === 'failed') contractCard.classList.add('failed');
        else if (room.objective.status === 'done' || room.objective.status === 'done_pending') contractCard.classList.add('done');
        contractCard.innerHTML = contractCardHtml(room.objective);
        contractCard.dataset.explainTitle = localText('КОНТРАКТ СЕКТОРА', 'SECTOR CONTRACT');
        contractCard.dataset.explain = objectiveExplain(room.objective);
        contractCard.dataset.explainTone = room.objective.status === 'failed' ? 'red' : ((room.objective.status === 'done' || room.objective.status === 'done_pending') ? 'gold' : 'green');
      } else {
        contractCard.classList.add('hidden');
        contractCard.innerHTML = '';
        delete contractCard.dataset.explainTitle;
        delete contractCard.dataset.explain;
        delete contractCard.dataset.explainTone;
      }
    }

    // bars — EXP always with denominator
    const hp = me[P.HP], mhp = me[P.MAXHP];
    const sh = Math.max(0, me[P.SHIELD] || 0), shm = Math.max(0, me[P.SHIELDMAX] || 0);
    const sw = $('shield-wrap');
    if (sw) {
      sw.classList.toggle('hidden', shm <= 0);
      $('shield-bar').style.width = shm > 0 ? Math.max(0, sh / shm * 100) + '%' : '0%';
      $('shield-text').textContent = `${sh} / ${shm}`;
    }
    $('hp-bar').style.width = Math.max(0, hp / mhp * 100) + '%';
    $('hp-text').textContent = `${hp} / ${mhp}`;
    $('xp-bar').style.width = Math.max(0, me[P.XP] / me[P.NEXTXP] * 100) + '%';
    $('xp-text').textContent = `${me[P.XP]} / ${me[P.NEXTXP]}`;
    $('hud-gld').textContent = `GLD ${me[P.GLD]}`;
    $('hud-lvl').textContent = `LVL ${me[P.LVL]}`;
    const rEl = $('hud-r-active');
    if (rEl) {
      const rLabel = String(me[P.RLABEL] || 'R EMPTY');
      const rCd = Number(me[P.RCD] || 0), rT = Number(me[P.RT] || 0);
      const hasR = rLabel && rLabel !== 'R EMPTY';
      if (hasR) {
        const stateTxt = rT > 0 ? `${rT}s` : rCd > 0 ? `${rCd}s CD` : localText('ГОТОВА', 'READY');
        rEl.classList.remove('hidden', 'ready', 'cooldown', 'active', 'empty');
        rEl.classList.add(rT > 0 ? 'active' : rCd > 0 ? 'cooldown' : 'ready');
        rEl.textContent = `R ${locLabel(rLabel)} · ${stateTxt}`;
        this.setExplain(rEl, locLabel(rLabel), String(me[P.RDESC] || '').trim() || rEl.textContent || '', 'cyan');
      } else {
        rEl.classList.add('hidden');
        rEl.textContent = 'R —';
      }
    }
    const wagerCard = $('room-wager-card');
    if (wagerCard) {
      const offer = me[P.ROOMWAGER];
      const activeWager = me[P.ACTIVEWAGER];
      if (offer && room.phase === 'install') {
        const key = `offer:${getLang()}:${offer.id || 0}:${offer.text || ''}`;
        wagerCard.classList.remove('hidden', 'active');
        wagerCard.classList.add('offer');
        if (this.wagerRenderKey !== key) {
          this.wagerRenderKey = key;
          wagerCard.innerHTML = `<div class="wager-title">${esc(localText('СТАВКА НА СЛЕДУЮЩИЙ СЕКТОР', 'NEXT-SECTOR WAGER'))}</div><div class="wager-body">${esc(localText(offer.textRu || offer.text || '', offer.textEn || offer.text || ''))}</div><div class="wager-actions"><button id="room-wager-accept" type="button">${esc(localText('ПРИНЯТЬ', 'ACCEPT'))}</button><button id="room-wager-decline" type="button">${esc(localText('ПРОПУСТИТЬ', 'SKIP'))}</button></div>`;
          const decide = (accept) => (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const buttons = [...wagerCard.querySelectorAll('.wager-actions button')];
            if (buttons.some(x => x.disabled)) return;
            this.playUiSound(accept ? 'wager_accept_click' : 'wager_skip_click');
            this.net?.sendRoomWager?.(offer.id || 0, accept);
            buttons.forEach(x => { x.disabled = true; });
          };
          const acceptBtn = wagerCard.querySelector('#room-wager-accept');
          const declineBtn = wagerCard.querySelector('#room-wager-decline');
          acceptBtn?.addEventListener('pointerdown', decide(true));
          acceptBtn?.addEventListener('click', decide(true));
          declineBtn?.addEventListener('pointerdown', decide(false));
          declineBtn?.addEventListener('click', decide(false));
        }
        this.setExplain(wagerCard, localText('СТАВКА НА СЛЕДУЮЩИЙ СЕКТОР', 'NEXT-SECTOR WAGER'), localText('Прими риск для следующего сектора или продолжи без ставки.', 'Accept a risk for the next sector or continue without a wager.'), 'gold');
      } else if (activeWager) {
        const prog = activeWager.progress || {};
        const progKey = localText(prog.textRu || prog.text || '', prog.textEn || prog.text || '');
        const key = `active:${getLang()}:${activeWager.id || 0}:${activeWager.text || ''}:${progKey}:${activeWager.completed ? 1 : 0}`;
        wagerCard.classList.remove('hidden', 'offer');
        wagerCard.classList.add('active');
        wagerCard.classList.toggle('completed', !!activeWager.completed);
        if (this.wagerRenderKey !== key) {
          this.wagerRenderKey = key;
          wagerCard.innerHTML = this.roomWagerActiveHtml(activeWager);
        }
        this.setExplain(wagerCard, activeWager.completed ? 'WAGER COMPLETE' : 'WAGER ACTIVE', activeWager.completed ? localText('Условие уже выполнено. Награда сохранена и включится с начала следующего сектора.', 'Condition complete. The reward is queued and activates at the start of the next sector.') : localText('Активная ставка сектора. Сверху показаны риск, условие, награда и текущий прогресс.', 'Active room wager. The card shows risk, condition, reward, and current progress.'), activeWager.completed ? 'green' : 'cyan');
      } else { wagerCard.classList.add('hidden'); wagerCard.classList.remove('offer', 'active', 'completed', 'wager-standalone'); wagerCard.innerHTML = ''; this.wagerRenderKey = ''; }
    }
    this.positionRoomWagerCard();
    this.positionRightStatusCards();
    const inst = $('hud-install');
    if (me[P.PEND] > 0) { inst.textContent = `${localText('УЛУЧШЕНИЕ', 'INSTALL')} x${me[P.PEND]}`; inst.classList.remove('hidden'); }
    else inst.classList.add('hidden');
    const wait = room.installWait || null;
    const waitPlayers = Array.isArray(wait?.players) ? wait.players : [];
    const myWait = waitPlayers.find(p => String(p.id) === String(me[P.ID]));
    const otherWaiting = waitPlayers.some(p => p && p.waiting && String(p.id) !== String(me[P.ID]));
    const shouldShowWait = room.phase === 'install' && wait && !myWait?.waiting && otherWaiting && !this.install.skinOnly && (!this.install.open || this.install.waitingOnly || this.install.picked);
    const syncKey = room.phase === 'install' && wait && myWait?.waiting
      ? `${myWait.offerId || 'pending'}:${myWait.kind || ''}:${myWait.signature || 0}`
      : '';
    if (syncKey && syncKey !== this.installSyncKey) {
      this.installSyncKey = syncKey;
      this.installSyncSeenAt = performance.now();
    } else if (!syncKey) {
      this.installSyncKey = '';
      this.installSyncSeenAt = 0;
    }
    const multiplayerWait = wait && Math.max(1, wait.total || 1) > 1 && this.net?.mode !== 'solo';
    const shouldShowDataLoading = room.phase === 'install' && multiplayerWait && myWait?.waiting && myWait?.kind !== 'room_wager' && !this.install.skinOnly && (!this.install.open || (this.install.waitingOnly && this.install.dataLoading));
    if (shouldShowWait) {
      // A player with no pending level must not receive a fake empty upgrade
      // card while another player is choosing. Keep only the compact HUD state.
      if (this.install.open && this.install.waitingOnly) this.closeInstall();
      inst.textContent = localText('ОЖИДАНИЕ ДРУГИХ ИГРОКОВ', 'WAITING FOR OTHER PLAYERS');
      inst.classList.remove('hidden');
    }
    else if (shouldShowDataLoading) this.showInstallDataLoading(wait, me[P.ID]);
    else if (room.phase !== 'install' && this.install.open && !this.install.skinOnly) this.closeInstall();
    const sigEl = $('hud-signatures');
    if (sigEl) {
      const rawSigs = Array.isArray(room.signaturesActive) ? room.signaturesActive.slice(0, 12) : [];
      const badges = [];
      const seen = new Set();
      const addBadge = (label, body = '', tone = 'gold') => {
        const k = String(label || '').toUpperCase();
        if (!k || seen.has(k)) return;
        seen.add(k);
        const h = bossRewardHint(k);
        badges.push({ label, title: h[0], body: body || h[1], tone });
      };
      const explicit = new Set(['MIRROR PAYOUT', 'AEGIS PROCESS', 'NULL REVIVAL', 'BOSS KEY']);
      for (const x of rawSigs) {
        const ux = String(x || '').toUpperCase();
        if (explicit.has(ux)) continue;
        addBadge(x, '', ux.includes('MIRROR') ? 'purple' : 'gold');
      }
      if (me[P.MIRRORMAX] > 0) addBadge(`${localText('ЗЕРКАЛО', 'MIRROR')} ${me[P.MIRROR]}/${me[P.MIRRORMAX]}`, `${localText('ЗЕРКАЛЬНЫЙ ПРИЗ', 'MIRROR PRIZE')}: ${me[P.MIRROR]}/${me[P.MIRRORMAX]}. ${localText('Копирует следующий усиливаемый приз с выбором. Заряд возвращается после главной угрозы.', 'Copies the next stackable choice prize. Charge returns after the core threat.')}`, me[P.MIRROR] > 0 ? 'purple' : '');
      if (me[P.REVIVE] > 0) addBadge(`REVIVE x${me[P.REVIVE]}`, localText(`НУЛЕВОЕ ВОССТАНОВЛЕНИЕ: зарядов ${me[P.REVIVE]}. При сбое возвращает 45% здоровья.`, `NULL REVIVAL: ${me[P.REVIVE]} charge${me[P.REVIVE] === 1 ? '' : 's'}. Restores 45% health after a crash.`), 'cyan');
      const bossKeyCur = Math.max(0, Number(me[P.BOSSKEY] || 0) | 0);
      const bossKeyMax = Math.max(bossKeyCur, Number(me[P.BOSSKEYMAX] || 0) | 0);
      if (bossKeyMax > 0) addBadge(`${localText('КЛЮЧ', 'KEY')} ${bossKeyCur}/${bossKeyMax}`, `${localText('КЛЮЧ ЯДРА', 'CORE KEY')}: ${bossKeyCur}/${bossKeyMax}. ${localText('Следующий сундук с выбором станет бесплатным и получит лучшую редкость.', 'The next choice chest becomes free and rolls top rarity.')}`, bossKeyCur > 0 ? 'gold' : '');
      if (me[P.SHIELDMAX] > 0) addBadge(localText('ЭГИДА', 'AEGIS'), `${localText('ЭГИДА', 'AEGIS')}: ${localText('защитный слой оболочки', 'shell shield')} ${me[P.SHIELDMAX]}.`, 'cyan');
      if (badges.length) {
        sigEl.classList.remove('hidden');
        sigEl.innerHTML = badges.map(b => `<span class="term ${esc(b.tone || '')}" data-explain-title="${esc(b.title)}" data-explain="${esc(b.body)}"${b.tone ? ` data-explain-tone="${esc(b.tone)}"` : ''}>${esc(locLabel(b.label))}</span>`).join('');
        this.setExplain(sigEl, localText('СИГНАТУРЫ БОССОВ', 'BOSS SIGNATURES'), badges.map(b => `${locLabel(b.label)}: ${b.body}`).join('\n'), 'gold');
      } else { sigEl.classList.add('hidden'); sigEl.innerHTML = ''; }
    }
    const favorEl = $('hud-favor');
    if (favorEl) {
      const activeRaw = this.compactFavorItems(room.contractFavors?.active || []);
      const active = activeRaw.slice().sort((a,b) => ((b.uses || 0) > 0 ? 1 : 0) - ((a.uses || 0) > 0 ? 1 : 0));
      const pending = this.compactFavorItems(room.contractFavors?.pending || []);
      const used = this.compactFavorItems(room.contractFavors?.used || []);
      const items = active.length ? active : pending;
      if (items.length) {
        const allUsed = items.every(f => String(f.status || '').toLowerCase() === 'used' || (f.uses || 0) <= 0);
        favorEl.classList.remove('hidden', 'used', 'pending');
        if (!active.length) favorEl.classList.add('pending');
        if (allUsed) favorEl.classList.add('used');
        const title = items.length > 1 ? localText('ПРИЗЫ', 'PRIZES') : localText('ПРИЗ', 'PRIZE');
        const list = items.map(f => `<span class="favor-chip"><span class="favor-chip-name">${esc(this.favorUiLabel(f))}</span><em>${esc(this.favorCompactStatus(f))}</em></span>`).join('<span class="favor-sep">·</span>');
        favorEl.innerHTML = `<b>${esc(title)}</b> <span class="favor-list">${list}</span>`;
        this.setExplain(favorEl, localText('ПРИЗЫ КОНТРАКТА', 'CONTRACT PRIZES'), items.map(x => `${this.favorUiLabel(x)}: ${this.favorUiBody(x)} (${this.favorCompactStatus(x)})`).join('\n'), active.length ? 'gold' : 'cyan');
      } else if (used.length) {
        const f = used[0];
        favorEl.classList.remove('hidden', 'pending');
        favorEl.classList.add('used');
        favorEl.innerHTML = `<b>${esc(localText('ПРИЗ', 'PRIZE'))}</b> ${esc(this.favorUiLabel(f))} <em>${esc(localText('ИСПОЛЬЗОВАН', 'USED'))}</em>`;
        this.setExplain(favorEl, localText('ПРИЗ ИСПОЛЬЗОВАН', 'PRIZE USED'), localText('Этот приз контракта уже сработал в этой секторе.', 'This contract prize has already triggered in this room.'), 'gold');
      } else {
        favorEl.classList.add('hidden');
        favorEl.innerHTML = '';
      }
    }
    this.positionFeedBelowLeftTop();

    // dash pips: stable right edge. Cooldown and casino charge overflow live on the LEFT,
    // so the charge squares never shove the hand/weapon HUD when seconds or extra charges appear.
    const pips = $('dash-pips');
    const dashCd = Math.max(0, Number(me[P.DASHCD] || 0));
    const dashCdMax = Math.max(0.01, Number(me[P.DASHCDMAX] || 0.01));
    const dashCharge01 = dashCd > 0 ? Math.max(0, Math.min(1, 1 - dashCd / dashCdMax)) : 1;
    const want = `${me[P.DASH]}/${me[P.DASHMAX]}:${dashCd.toFixed(1)}:${dashCdMax.toFixed(1)}`;
    if (pips.dataset.v !== want) {
      pips.dataset.v = want;
      pips.innerHTML = '';

      const cd = document.createElement('span');
      cd.className = 'dash-cd-mini' + (dashCd > 0 ? '' : ' empty');
      cd.textContent = dashCd > 0 ? dashCd.toFixed(1) : '0.0';
      this.setExplain(cd, t('dashChargeTitle'), dashCd > 0 ? `${t('dashEmpty')} · ${dashCd.toFixed(1)}s` : t('dashReady'), 'cyan');
      pips.appendChild(cd);

      if (me[P.DASHMAX] > 14) {
        const over = document.createElement('span');
        over.className = 'dash-overmax-mini';
        over.textContent = `x${me[P.DASHMAX]}`;
        this.setExplain(over, t('dashChargeTitle'), `${t('dashReady')} · ${me[P.DASH]}/${me[P.DASHMAX]}`, 'cyan');
        pips.appendChild(over);
      }

      for (let i = 0; i < Math.min(me[P.DASHMAX], 14); i++) {
        const d = document.createElement('span');
        const isReady = i < me[P.DASH];
        const isCharging = !isReady && i === me[P.DASH] && dashCd > 0;
        d.className = 'pip' + (isReady ? ' full' : '') + (isCharging ? ' charging' : '');
        if (isCharging) d.style.setProperty('--dash-charge', `${Math.round(dashCharge01 * 100)}%`);
        this.setExplain(d, t('dashChargeTitle'), isReady ? t('dashReady') : `${t('dashEmpty')} · ${dashCd.toFixed(1)}s`, 'cyan');
        pips.appendChild(d);
      }
    }

    let lcHud = $('living-casino-selected');
    const lvc = me[P.LVC] || null;
    if (!lcHud && $('hud-right')) {
      lcHud = document.createElement('div');
      lcHud.id = 'living-casino-selected';
      $('hud-right').insertBefore(lcHud, $('weapon-slots') || null);
    }
    if (lcHud) {
      if (lvc?.hero === 'living_casino' && lvc.base && lvc.sparks) {
        const base = lvc.base;
        const sparks = lvc.sparks;
        const baseCd = Math.max(0, Number(base.cd || 0));
        const sparkRecharge = Math.max(0, Number(sparks.recharge || 0));
        const remaining = Math.max(0, Number(sparks.remaining || 0));
        const baseStatus = baseCd > 0 ? localText(`ОГОНЬ ${baseCd.toFixed(1)}`, `FIRE ${baseCd.toFixed(1)}`) : localText('НАВЕДЕНИЕ', 'TRACKING');
        const sparkStatus = Number(sparks.active || 0) > 0
          ? localText(`СВЯЗЬ ${Number(sparks.active || 0)} · ${remaining.toFixed(1)}`, `LINK ${Number(sparks.active || 0)} · ${remaining.toFixed(1)}`)
          : sparkRecharge > 0
            ? localText(`ЗАРЯД ${sparkRecharge.toFixed(1)}`, `CHARGE ${sparkRecharge.toFixed(1)}`)
            : localText('ГОТОВО', 'READY');
        lcHud.className = 'lc-dual-rack';
        lcHud.innerHTML = `
          <div class="lc-dual-head"><b>${escHtml(localText('ЖИВОЕ КАЗИНО', 'LIVING CASINO'))}</b><em>${escHtml(localText('АВТОКОНТУР', 'AUTO CIRCUIT'))}</em></div>
          <div class="lc-gun-row lc-base">
            <strong>LVC</strong><span>${escHtml(localText('КАНАЛЫ', 'CHANNELS'))} ${Number(base.maxTargets || 1)}</span><em>${escHtml(baseStatus)}</em>
          </div>
          ${sparks.unlocked ? `<div class="lc-gun-row lc-sparks">
            <strong>SPK</strong><span>${escHtml(localText('ЗАРЯДЫ', 'CHARGES'))} ${Number(sparks.charges || 0)}/${Number(sparks.maxCharges || 1)} · ${escHtml(localText('КАНАЛЫ', 'CHANNELS'))} ${Number(sparks.instructionMax || 1)}</span><em>${escHtml(sparkStatus)}</em>
          </div>` : ''}`;
        this.setExplain(lcHud, localText('ЖИВОЕ КАЗИНО', 'LIVING CASINO'), sparks.unlocked
          ? localText('Обе пушки работают одновременно. Отмеченные цели имеют приоритет.', 'Both guns run simultaneously. Marked targets have priority.')
          : localText('Автономная пушка работает постоянно. Искры открываются в оружейном сундуке.', 'The autonomous gun is always active. Sparks unlock from a weapon chest.'), 'gold');
      } else {
        lcHud.className = 'lc-dual-rack hidden';
        lcHud.innerHTML = '';
      }
    }


    let pcRack = $('process-controller-rack');
    let pcHud = $('process-controller-selected');
    const pc = me[P.CTRL] || null;
    if (!pcRack && $('hud-right')) {
      pcRack = document.createElement('div');
      pcRack.id = 'process-controller-rack';
      $('hud-right').insertBefore(pcRack, $('dash-pips') || $('weapon-slots') || null);
    }
    if (!pcHud && $('hud-right')) {
      pcHud = document.createElement('div');
      pcHud.id = 'process-controller-selected';
      $('hud-right').insertBefore(pcHud, $('weapon-slots') || null);
    }
    if (pcHud || pcRack) {
      if (pc && pc.hero === 'process_controller') {
        const controlled = Math.max(0, Number(pc.controlled || 0) | 0);
        const max = Math.max(1, Number(pc.max || 1) | 0);
        const regular = Math.max(0, Math.min(max, Number(pc.regular ?? controlled) | 0));
        const temporary = Math.max(0, Number(pc.temporary || 0) | 0);
        const cmd = Math.max(0, Number(pc.commandT || 0) || 0);
        const cap = Math.max(0, Number(pc.captureT || 0) || 0);
        const cd = Math.max(0, Number(pc.cd || 0) || 0);
        const cdPct = Math.max(0, Math.min(100, Number(pc.cdPct || 0) || 0));
        const persist = !!pc.persist;
        const selected = String(pc.selected || 'CMD').toUpperCase();
        const selectedName = String(pc.selectedName || selected).toUpperCase();
        const capPct = Math.max(0, Math.min(100, Number(pc.capturePct || 0) || 0));
        const capLabel = String(pc.captureLabel || '').trim();
        const status = cd > 0 ? localText(`ПЕРЕЗАРЯДКА ${cd.toFixed(1)}`, `COOLDOWN ${cd.toFixed(1)}`) : pc.captureActive ? localText(`ЗАХВАТ ${capPct}%${capLabel ? ' · ' + capLabel : ''}`, `CAPTURE ${capPct}%${capLabel ? ' · ' + capLabel : ''}`) : cmd > 0 ? localText(`ПРИКАЗ ${cmd.toFixed(1)}`, `ORDER ${cmd.toFixed(1)}`) : cap > 0 ? localText('ПЕРЕХВАТ', 'CAPTURED') : localText('ГОТОВО', 'READY');
        const allProcs = Array.isArray(pc.processes) ? pc.processes : [];
        const procs = allProcs.filter(pr => !pr?.bonus).slice(0, Math.min(10, max));
        const temporaryProcs = allProcs.filter(pr => !!pr?.bonus).slice(0, 18);
        const chips = [];
        for (let i = 0; i < Math.min(10, max); i++) {
          const pr = procs[i] || null;
          const l = pr ? Math.max(0, Math.min(100, Number(pr.life || 0) || 0)) : 0;
          const h = pr ? Math.max(0, Math.min(100, Number(pr.hp || 0) || 0)) : 0;
          const label = pr ? String(pr.label || 'PRC').slice(0, 3).toUpperCase() : String(i + 1).padStart(2, '0');
          chips.push(`<i class="pc-life-chip ${pr ? 'filled' : 'empty'}" style="--life:${l}%;--hp:${h}%"><b>${escHtml(label)}</b><span></span></i>`);
        }
        const temporaryChips = temporaryProcs.map(pr => {
          const l = Math.max(0, Math.min(100, Number(pr.life || 0) || 0));
          const h = Math.max(0, Math.min(100, Number(pr.hp || 0) || 0));
          const label = String(pr.label || 'TMP').slice(0, 3).toUpperCase();
          return `<i class="pc-life-chip filled temporary" style="--life:${l}%;--hp:${h}%"><b>${escHtml(label)}</b><span></span></i>`;
        });
        if (pcRack) {
          pcRack.className = `pc-process-rack ${controlled > 0 ? 'has-processes' : 'empty'} ${temporary > 0 ? 'has-temporary' : ''}`;
          pcRack.innerHTML = `<div class="pc-rack-head"><b>${escHtml(localText('ПРОЦЕССЫ', 'PROCESSES'))}</b><span>${regular}/${max}${temporary > 0 ? escHtml(localText(` · ВРЕМ +${temporary}`, ` · TEMP +${temporary}`)) : ''}${persist ? escHtml(localText(' · ПЕРЕНОС', ' · CARRY')) : ''}</span></div><div class="pc-life-grid pc-life-grid-regular">${chips.join('')}</div>${temporaryChips.length ? `<div class="pc-temp-head"><b>${escHtml(localText('ВРЕМЕННЫЕ СЛОТЫ', 'TEMPORARY SLOTS'))}</b><span>+${temporaryChips.length}</span></div><div class="pc-life-grid pc-life-grid-temporary">${temporaryChips.join('')}</div>` : ''}`;
          this.setExplain(pcRack, localText('ПОДКОНТРОЛЬНЫЕ ПРОЦЕССЫ', 'CONTROLLED PROCESSES'), localText('Обычные слоты заполняются первыми. Золотые временные слоты появляются только для призванных или отделившихся союзников, когда обычных мест не осталось.', 'Regular slots fill first. Gold temporary slots appear only for summoned or split allies when regular capacity is full.'), 'cyan');
        }
        document.body?.classList?.toggle('controller-temporary-slots', temporary > 0);
        document.documentElement?.style?.setProperty('--ctrl-temp-rows', String(Math.max(0, Math.ceil(temporary / 10))));
        if (pcHud) {
          pcHud.className = `pc-selected ctrl-main type-${selected.toLowerCase()} ${cd > 0 ? 'cooldown' : pc.captureActive ? 'capturing' : cmd > 0 ? 'command' : cap > 0 ? 'capture' : 'ready'}`;
          pcHud.style.setProperty('--pc-fill', `${cd > 0 ? 100 - cdPct : 100}%`);
          pcHud.innerHTML = `<i class="pc-fill" aria-hidden="true"></i><div class="pc-title"><b>${escHtml(selected)}</b><span>${escHtml(selectedName)}</span><em>${escHtml(status)}</em></div>`;
          this.setExplain(pcHud, localText('КОМАНДА КОНТРОЛЁРА', 'CONTROLLER COMMAND'), localText('Это активная команда ЛКМ. Заполнение показывает готовность/перезарядку команды. Сроки отдельных процессов вынесены выше отдельными плашками.', 'This is the active LMB command. The fill shows command readiness/cooldown. Individual process lifetimes are shown above in separate plates.'), 'cyan');
        }
      } else {
        if (pcRack) { pcRack.className = 'pc-process-rack hidden'; pcRack.innerHTML = ''; }
        if (pcHud) { pcHud.className = 'pc-selected hidden'; pcHud.innerHTML = ''; }
        document.body?.classList?.remove('controller-temporary-slots');
        document.documentElement?.style?.setProperty('--ctrl-temp-rows', '0');
      }
    }

    const acd = me[P.ACTIVECD] || 0;
    const qSilence = Math.max(0, Number(me[P.QSILENCE] || 0));
    const qName = activeLabel(me);
    const qTxt = qSilence > 0
      ? localText(`Q САЙЛЕНС ${qSilence.toFixed(1)}s`, `Q SILENCE ${qSilence.toFixed(1)}s`)
      : qName === activeNoneLabel() || qName === 'НЕТ АКТИВКИ' || qName === 'NO ACTIVE'
      ? t('qNoneLong')
      : (acd > 0 ? `${t('qCd')} ${acd.toFixed ? acd.toFixed(1) : acd}` : (me[P.ACTIVEBUFF] ? t('qOver') : activeShort(me)));
    const lvlEl = $('hud-lvl');
    lvlEl.textContent = `LVL ${me[P.LVL]} · ${qTxt}`;
    this.setExplain(lvlEl, t('activeQTitle'), qSilence > 0 ? localText(`Босс заглушил Q ещё на ${qSilence.toFixed(1)} сек. Оружие, рывок и R работают.`, `The boss has silenced Q for ${qSilence.toFixed(1)}s more. Weapons, dash, and R still work.`) : `${activeLabel(me)}. ${activeDesc(me)}${qName !== activeNoneLabel() && qName !== 'НЕТ АКТИВКИ' && qName !== 'NO ACTIVE' ? ' ' + t('activeQUse') : ''}`, qSilence > 0 ? 'purple' : (qName === activeNoneLabel() || qName === 'НЕТ АКТИВКИ' || qName === 'NO ACTIVE' ? '' : 'cyan'));

    const comboEl = $('hud-combo');
    if (comboEl) {
      const comboHtml = renderComboHud((room.playerCombos && room.playerCombos[me[P.ID]]) || room.combo || {});
      if (comboHtml) { comboEl.classList.remove('hidden'); comboEl.innerHTML = comboHtml; }
      else { comboEl.classList.add('hidden'); comboEl.innerHTML = ''; }
    }

    // weapon slots
    const slots = $('weapon-slots');
    const livingCasinoHero = !!(me[P.LVC] && me[P.LVC].hero === 'living_casino');
    const processControllerHero = !!(me[P.CTRL] && me[P.CTRL].hero === 'process_controller');
    document.body?.classList?.toggle('process-controller-mode', processControllerHero && !livingCasinoHero);
    const ctrlCapPct = processControllerHero ? Math.max(0, Math.min(100, Number(me[P.CTRL]?.capturePct || 0) || 0)) : 0;
    const ctrlCapActive = processControllerHero && !!me[P.CTRL]?.captureActive;
    document.body?.classList?.toggle('ctrl-capture-active', ctrlCapActive);
    document.documentElement?.style?.setProperty('--ctrl-capture-pct', `${ctrlCapPct}%`);
    if (slots) {
      slots.classList.toggle('hidden', livingCasinoHero);
      slots.classList.toggle('ctrl-slots', processControllerHero && !livingCasinoHero);
      slots.classList.remove('lc-slots');
    }
    const wKey = me[P.WEAPONS].join(',') + me[P.WIDX] + (livingCasinoHero ? ':lvc' : '') + (processControllerHero ? ':ctrl' : '');
    if (slots && slots.dataset.v !== wKey) {
      slots.dataset.v = wKey;
      slots.innerHTML = '';
      me[P.WEAPONS].forEach((w, i) => {
        const s = document.createElement('span');
        s.className = 'wslot' + (i === me[P.WIDX] ? ' active' : '');
        const wd = WEAPONS[w] || WEAPON_BY_LABEL[w];
        s.textContent = processControllerHero ? `${wd?.label || w}` : `${i + 1} ${wd?.label || w}`;
        if (livingCasinoHero) s.classList.add(i === 0 ? 'lc-slot-base' : 'lc-slot-sparks');
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
        const creditFree = !!near.contractFree && Math.max(0, Number(me[P.BOSSKEY] || 0) | 0) <= 0;
        const unit = blood ? 'HP' : 'GLD';
        if (near.cost > 0 && creditFree) prompt.innerHTML = `E / <span class="contract-free-price"><s>${near.cost} ${unit}</s><b>${esc(localText('БЕСПЛАТНО', 'FREE'))}</b></span> — ${esc(near.label)}`;
        else if (near.cost > 0 && blood) prompt.innerHTML = `E / <span class="hp-cost">${near.cost} HP</span> — ${esc(near.label)}`;
        else prompt.textContent = near.cost > 0 ? `E / ${near.cost} GLD — ${near.label}` : `E — ${near.label}`;
        const costTxt = near.cost > 0 ? (creditFree ? localText(`Цена ${near.cost} ${unit} отменена Кредитным пропуском.`, `The ${near.cost} ${unit} price is waived by Credit Pass.`) : blood ? localText(`Нужно ${near.cost} HP. Цена платится здоровьем, не золотом.`, `Need ${near.cost} HP. This price is paid with health, not gold.`) : t('chestNeed', { cost: near.cost })) : t('chestFree');
        this.setExplain(prompt, `${near.label} / ${t('chestTitle')}`, `${chestDesc(near.label)} ${costTxt}`, creditFree ? 'gold' : blood ? 'red' : (near.label === 'CRS' ? 'purple' : '')); 
      }
    } else if (!this.promptTimer) prompt.classList.add('hidden');

    // install timer bar — monotonic on clients. Network resends must not refill it.
    if (this.install.open) {
      if (this.install.waitingOnly && room.installWait) {
        const w = $('install-wait');
        if (this.install.dataLoading) {
          if (w) w.innerHTML = this.installDataLoadingHtml(room.installWait, me[P.ID]);
          this.install.expires = this.install.total;
        } else {
          if (w) w.innerHTML = this.installWaitHtml(room.installWait, me[P.ID]);
          const serverLeft = Number(room.installWait.nextExpires || 0);
          if (serverLeft > 0) this.install.expires = this.install.expires > 0 ? Math.min(this.install.expires, serverLeft) : serverLeft;
          else this.install.expires = Math.max(0, this.install.expires - dt);
        }
      } else {
        this.install.expires = Math.max(0, this.install.expires - dt);
      }
      const bar = $('install-timer-bar');
      if (bar) {
        const pct = this.install.total > 0 ? Math.max(0, Math.min(100, this.install.expires / Math.max(0.001, this.install.total) * 100)) : 0;
        bar.style.width = pct.toFixed(1) + '%';
      }
    }
    for (const kind of ['weapon', 'ability']) {
      const state = this[kind];
      const timer = $(`${kind}-choice-timer`);
      const timed = !!state?.open && !!state?.meta?.contractPrize;
      timer?.classList.toggle('hidden', !timed);
      if (!timed) continue;
      const label = timer?.querySelector('span');
      if (label) label.textContent = localText('КОНТРАКТНЫЙ ВЫБОР', 'CONTRACT CHOICE');
      state.expires = Math.max(0, Number(state.expires || 0) - dt);
      const pct = Math.max(0, Math.min(100, state.expires / Math.max(0.001, Number(state.total || 30)) * 100));
      const txt = $(`${kind}-choice-timer-text`);
      const bar = $(`${kind}-choice-timer-bar`);
      if (txt) txt.textContent = `${state.expires.toFixed(1)}s`;
      if (bar) bar.style.width = `${pct.toFixed(1)}%`;
    }
  }

  // ------------------------------------------------- fx handling
  handleFx(f, myId, state) {
    const name = id => id === myId ? t('you') : (this.names.get(id) || '??');
    switch (f.t) {
      case 'room': {
        this.localRerollSpent = 0;
        this.localRerollServerLeft = null;
        const mods = (f.mods || []).filter(m => m !== 'static_rain').map(m => roomModLabel(m, state?.room || null)).join(' + ');
        const skn = f.skinRarity ? ` · ${localText('СКРЫТЫЙ ОБЛИК', 'HIDDEN SHELL')} ${rarityText(f.skinRarity)}` : '';
        const arch = f.archetype ? ` · ${archLabel(f.archetype)}` : '';
        const danger = dangerLabel({ danger: f.danger, dangerLabel: f.dangerLabel });
        const threats = Array.isArray(f.threatTags) && f.threatTags.length ? ` · ${localText('УГРОЗЫ', 'THREAT')} ${tagJoin(f.threatTags.slice(0, 3))}` : '';
        const rewards = Array.isArray(f.rewardTags) && f.rewardTags.length ? ` · ${localText('НАГРАДА', 'REWARD')} ${tagJoin(f.rewardTags.slice(0, 3))}` : '';
        this.banner(f.cat === 'boss' ? t('bossFloor') : `${f.roomId}`, `${t('loop')} ${displayLoopNumber(f.loop)} · ${t('depth')} ${f.depth}${arch}${mods ? ' · ' + mods : ''} · ${danger}${threats}${rewards}${skn}`,
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
            const fs = this.compactFavorItems(f.contractFavorsEarned || []).map(x => `${this.favorUiLabel(x)}${(x.uses || 0) > 1 ? ' x' + x.uses : ''}`).join(' + ');
            marks.push(`${localText('КОНТРАКТ ОПЛАЧЕН', 'CONTRACT PAID')} ${locLabel(f.objective.label)}${fs ? ' · ' + localText('ПРИЗ', 'PRIZE') + ' ' + fs : ''}`);
          } else {
            marks.push(`${localText('КОНТРАКТ ПРОВАЛЕН', 'CONTRACT FAILED')} ${locLabel(f.objective.label)}${f.objective.failReason ? ' / ' + locFail(f.objective.failReason) : ''}`);
          }
        }
        if (f.contractChain >= 2) marks.push(`${localText('СЕРИЯ КОНТРАКТОВ', 'CONTRACT CHAIN')} x${f.contractChain}`);
        const tapes = Array.isArray(f.tapes) && f.tapes.length ? ` · ${localText('ПЛЁНКА', 'TAPE')}: ${f.tapes.map(locLabel).join(' / ')}` : '';
        const solved = Number.isFinite(Number(f.solvedTime)) ? ` · ${localText('РЕШЕНО', 'SOLVED')} ${Math.max(0, Math.round(Number(f.solvedTime)))}s` : '';
        const line = `${localText('УБИЙСТВА', 'KILLS')} ${f.kills || 0}${solved} · GLD +${f.gld || 0} · EXP +${f.exp || 0} · ${localText('УРОН', 'DMG')} ${f.dmg || 0}${marks.length ? ' · ' + marks.join(' / ') : ''}${tapes}`;
        this.banner(localText('ИТОГ СЕКТОРА', 'SECTOR RESULT'), line, f.noHit || f.fast ? 'green' : '');
        this.feed(`${localText('ИТОГ СЕКТОРА', 'SECTOR RESULT')}: ${line}`, f.noHit ? 'g' : '');
        break;
      }
      case 'join': this.feed(`${f.name} ${t('playerJoined')}`, 'g'); break;
      case 'leave': this.feed(`${f.name} ${t('playerLeft')}`, 'r'); break;
      case 'pick': {
        if (f.personal) {
          const who = name(f.id);
          const label = f.type === 'EXP' ? 'EXP' : f.type === 'HEA' ? 'HP' : 'GLD';
          this.feed(`${who}: ${locLabel(f.label || localText('ЛИЧНАЯ НАГРАДА', 'PERSONAL REWARD'))} +${f.val || 0} ${label}`, f.type === 'HEA' ? 'g' : 'c');
        }
        break;
      }
      case 'levelup':
        if (f.id === myId) { this.feed(`${localText('УРОВЕНЬ', 'LEVEL UP')} → ${f.level} · ${localText('УЛУЧШЕНИЕ', 'INSTALL')} x${f.pending}`, 'g'); document.getElementById('hud-left')?.classList.add('level-pulse'); setTimeout(() => document.getElementById('hud-left')?.classList.remove('level-pulse'), 850); }
        break;
      case 'pdown': this.feed(`${name(f.id)} ${t('down')}`, 'r'); if (f.id === myId) { this.cancelActiveRoll(); this.closeCasino(); this.banner(t('youDown'), t('carry'), 'red'); } break;
      case 'director_room':
        this.feed(`${t('eventSignal')}: ${localText('новая угроза', 'new threat')}`, 'c');
        break;
      case 'gld_hit': if (f.id === myId) { this.feed(`${localText('ЖАДНОСТЬ УДАР', 'GREED HIT')} -${f.cost || 0} GLD · BAL ${f.balance ?? 0}`, 'r'); } break;
      case 'casino_mob_defeated':
        this.banner(localText('СКРЫТЫЙ КАЗИНО-ВИРУС УДАЛЁН', 'HIDDEN CASINO VIRUS DELETED'), `${localText('ЖИВОЕ КАЗИНО ДОСТУПНО', 'LIVING CASINO AVAILABLE')} · GLD +${f.gld || 0}`, 'gold');
        this.feed(`${localText('СКРЫТЫЙ КАЗИНО-ВИРУС УДАЛЁН', 'HIDDEN CASINO VIRUS DELETED')} · GLD +${f.gld || 0}`, 'g');
        break;
      case 'room_wager_unlocked':
        if (f.id === myId || f.playerId === myId) {
          this.banner(localText('СТАВКИ ОТКРЫТЫ', 'WAGERS UNLOCKED'), localText('Новая ставка появляется перед каждым сектором.', 'A new wager appears before every sector.'), 'gold');
          this.feed(localText('ПРОТОКОЛ СТАВОК АКТИВЕН', 'WAGER PROTOCOL ONLINE'), 'g');
        }
        break;
      case 'casino_virus_spin': this.virusRoll(f); this.feed(`${localText('КАЗИНО-ВИРУС', 'CASINO VIRUS')}: ${locLabel(f.label || 'EVENT')} · ${f.spinsLeft || 0} ${localText('БРОСКОВ ОСТАЛОСЬ', 'SPINS LEFT')}`, 'p'); break;
      case 'director_wave':
        this.feed(`${localText('ВОЛНА', 'WAVE')} · ${f.count || 0}`, f.intent === 'armor' ? 'p' : (f.intent === 'ranged' || f.intent === 'control' ? 'c' : 'r'));
        break;
      case 'combo_payout': {
        const prize = comboPrizeLabel(f.type);
        const kills = Math.max(0, f.kills | 0);
        const mult = Number(f.mult || 1).toFixed(1);
        const amount = Math.max(0, f.amount | 0);
        const link = f.link ? ` · ${localText('LINK x2', 'LINK x2')}` : '';
        this.feed(`${name(f.id)}: ${localText('КОМБО', 'COMBO')} ${kills} × x${mult}${link} → +${amount} ${prize}`, f.type === 'hp' ? 'g' : 'c');
        break;
      }
      case 'combo_reel': {
        this.feed(`${name(f.id)}: ${localText('КОМБО-ВЫПЛАТА', 'COMBO REEL')} ${Array.isArray(f.symbols) ? f.symbols.join(' ') : ''} → ${locLabel(f.label || f.outcome)}`, f.outcome === 'STC' ? 'p' : 'g');
        break;
      }
      case 'combo_link_break': if (f.id === myId) this.feed(`${localText('COMBO LINK сорван уроном', 'COMBO LINK broken by damage')}`, 'r'); break;
      case 'skin_room': break;
      case 'skin_room_ready': this.banner(t('skinReady'), `${localText('карточка облика появится отдельно', 'skin card appears separately')} · ${rarityText(f.skinRarity)}`, 'purple'); this.feed(`${t('skinReady')} · ${rarityText(f.skinRarity)}`, 'p'); break;
      case 'portal_open': this.banner(t('portalOpen'), f.skinRarity ? `${localText('облик ждёт отдельной карточкой', 'skin waits as a separate card')} · ${rarityText(f.skinRarity)}` : t('portalNext'), f.skinRarity ? 'purple' : 'green'); this.feed(f.skinRarity ? `${t('portalOpen')} · ${localText('ОБЛИК ГОТОВ', 'SKIN READY')} ${rarityText(f.skinRarity)}` : t('portalOpen'), f.skinRarity ? 'p' : 'g'); break;
      case 'boss_down': this.banner(t('bossDown'), t('loot'), 'green'); break;
      case 'boss_q_silence': {
        const seconds = Math.max(0, Number(f.seconds || 0) | 0);
        const body = localText(`Q отключена на ${seconds} сек. Оружие, рывок и R доступны.`, `Q disabled for ${seconds}s. Weapons, dash, and R remain available.`);
        this.banner(localText('САЙЛЕНС БОССА', 'BOSS SILENCE'), body, 'purple');
        this.feed(`${localText('САЙЛЕНС БОССА', 'BOSS SILENCE')}: Q ${seconds}s`, 'p');
        break;
      }
      case 'boss_q_silence_end':
        if (f.id === myId || f.playerId === myId) {
          this.banner(localText('Q-КАНАЛ ВОССТАНОВЛЕН', 'Q CHANNEL RESTORED'), localText('Активные Q-протоколы снова доступны.', 'Active Q protocols are available again.'), 'green');
          this.feed(localText('Q-КАНАЛ ВОССТАНОВЛЕН', 'Q CHANNEL RESTORED'), 'g');
        }
        break;
      case 'chest_open': {
        const rewards = (f.rewards || []).map(locReward).join(' + ');
        const paid = f.costPaid ? `-${f.costPaid} ${f.costUnit || 'GLD'} · ` : '';
        const prefix = (f.personal || f.costPaid) ? `${name(f.id)}: ` : '';
        this.feed(`${prefix}${locLabel(f.chest)}: ${paid}${rewards}`, f.cursed ? 'p' : 'g');
        break;
      }
      case 'weapon_get': this.feed(`${name(f.id)} ${localText('ВЗЯЛ', 'TOOK')} ${f.w}`, 'c'); break;
      case 'weapon_mod': this.feed(`${name(f.id)}: WPN ${locLabel(f.label)}`, 'c'); break;
      case 'ability_get': this.feed(`${name(f.id)}: ${locLabel(f.label)}`, 'c'); break;
      case 'mirror_copy': if (f.id === myId || f.playerId === myId) this.feed(`${localText('ЗЕРКАЛО', 'MIRROR')}: ${f.ok ? localText('СКОПИРОВАНО', 'COPIED') : localText('НЕ СРАБОТАЛО', 'FAILED')} ${locLabel(f.label || '')}${f.body ? ` · ${localText(String(f.body).replace('+1 USE', '+1 ПРИМЕНЕНИЕ').replace('TOTAL', 'ВСЕГО'), f.body)}` : ''}`, f.ok ? 'p' : 'r'); break;
      case 'contract_selected': this.feed(`${localText('КОНТРАКТ ВЫБРАН', 'CONTRACT SELECTED')}: ${locLabel(f.label || '')}`, 'g'); break;
      case 'boss_key_used':
        if (f.id === myId || f.playerId === myId) {
          const left = f.left ? ` · ${f.left}` : '';
          this.banner(localText('BOSS KEY ИСПОЛЬЗОВАН', 'BOSS KEY USED'), localText('Сундук с выбором открыт бесплатно и поднят до max rarity.', 'Choice chest opened for free and upgraded to max rarity.') + left, 'gold');
          this.feed(`${localText('BOSS KEY ИСПОЛЬЗОВАН', 'BOSS KEY USED')}: ${localText('бесплатный max-rarity сундук с выбором', 'free max-rarity choice chest')}${left}`, 'p');
        }
        break;
      case 'active': if (f.id === myId) this.feed(`Q: ${locLabel(f.label)}`, 'c'); break;
      case 'active_denied': if (f.id === myId) { const msg = denyText(f); if (msg) { this.denyPrompt(msg); this.feed(`Q: ${msg}`, 'r'); } } break;
      case 'contract': this.banner(locLabel(f.label || t('contract')), t('contractBody'), 'red'); break;
      case 'room_event': this.banner(locLabel(f.label || localText('СОБЫТИЕ СЕКТОРА', 'SECTOR EVENT')), f.body ? cleanPlayerText(f.body) : localText('Особое правило сектора активно.', 'Special room rule active.'), 'purple'); break;
      case 'room_event_done': this.banner(locLabel(f.label || localText('СОБЫТИЕ', 'EVENT')), f.body ? cleanPlayerText(f.body) : localText('Завершено', 'Done'), 'green'); break;
      case 'contract_done': this.banner(t('contractDone'), `${locLabel(f.label || '')}${f.body ? ' · ' + cleanPlayerText(f.body) : ''}`, 'green'); break;
      case 'contract_paid': {
        const prizes = this.compactFavorItems(f.favors || []).map(x => `${this.favorUiLabel(x)}${(x.uses || 0) > 1 ? ' x' + x.uses : ''}`).join(' + ');
        this.banner(t('contractPaid'), `${locLabel(f.label || '')}${prizes ? ' · ' + prizes : f.body ? ' · ' + cleanPlayerText(f.body) : ''}`, 'green');
        break;
      }
      case 'contract_wager': break;
      case 'contract_wager_paid': this.feed(`${name(f.id)}: ${localText('БОНУС КАЗИНО ЗА СЕКТОР', 'SECTOR CASINO BONUS')} +${f.gld || 0} GLD +${f.exp || 0} EXP`, 'g'); break;
      case 'contract_wager_lost': if (f.id === myId) this.feed(`${localText('БОНУС КАЗИНО СГОРЕЛ', 'CASINO BONUS LOST')}: -${f.stake || 0}`, 'r'); break;
      case 'room_wager_accept': if (f.id === myId || f.playerId === myId) { const body = this.wagerFxBody(f); this.banner(localText('СТАВКА ПРИНЯТА', 'WAGER ACCEPTED'), body, 'gold'); this.feed(`${localText('СТАВКА ПРИНЯТА', 'WAGER ACCEPTED')}: ${body}`, 'p'); } break;
      case 'room_wager_declined': if ((f.id === myId || f.playerId === myId) && !f.timedOut) this.feed(localText('СТАВКА ПРОПУЩЕНА', 'WAGER SKIPPED'), ''); break;
      case 'room_wager_complete': if (f.id === myId || f.playerId === myId) { const body = this.wagerFxBody(f); this.banner(localText('СТАВКА ВЫПОЛНЕНА', 'WAGER COMPLETE'), `${body} · ${localText('СО СЛЕДУЮЩЕГО СЕКТОРА', 'STARTS NEXT SECTOR')}`, 'green'); this.feed(`${localText('СТАВКА ВЫПОЛНЕНА', 'WAGER COMPLETE')}: ${body}`, 'g'); } break;
      case 'room_wager_reward_active': if (f.id === myId || f.playerId === myId) { const body = this.wagerFxBody(f); this.banner(localText('ПРИЗ СТАВКИ АКТИВЕН', 'WAGER REWARD ACTIVE'), body, 'green'); this.feed(`${localText('ПРИЗ СТАВКИ АКТИВЕН', 'WAGER REWARD ACTIVE')}: ${body}`, 'g'); } break;
      case 'room_wager_paid': if (!f.silent && (f.id === myId || f.playerId === myId)) { const body = this.wagerFxBody(f); this.banner(localText('СТАВКА ВЫПОЛНЕНА', 'WAGER PAID'), body, 'green'); this.feed(`${localText('СТАВКА ВЫПОЛНЕНА', 'WAGER PAID')}: ${body}`, 'g'); } break;
      case 'room_wager_lost': if (f.id === myId || f.playerId === myId) { const body = this.wagerFxBody(f); this.banner(localText('СТАВКА ПРОВАЛЕНА', 'WAGER LOST'), body, 'red'); this.feed(`${localText('СТАВКА ПРОВАЛЕНА', 'WAGER LOST')}: ${body}`, 'r'); } break;
      case 'favor_earned': { this.localRerollSpent = 0; this.localRerollServerLeft = null; const fs = this.compactFavorItems(f.favors || []).map(x => `${this.favorUiLabel(x)}${(x.uses || 0) > 1 ? ' x' + x.uses : ''}`).join(' + '); this.banner(localText('ПРИЗ ПОЛУЧЕН', 'PRIZE RECEIVED'), fs || localText('Следующая сектор', 'Next room'), 'gold'); this.feed(`${localText('ПОЛУЧЕН ПРИЗ', 'PRIZE RECEIVED')}: ${fs}`, 'g'); break; }
      case 'favor_active': { const fs = this.compactFavorItems(f.favors || []).map(x => `${this.favorUiLabel(x)}${(x.uses || 0) > 1 ? ' x' + x.uses : ''}`).join(' + '); if (fs) this.feed(`${localText('БОНУС КОНТРАКТА АКТИВЕН', 'CONTRACT BONUS ACTIVE')}: ${fs}`, 'g'); break; }
      case 'favor_used': {
        const body = this.wagerFxBody(f);
        this.banner(localText('БОНУС ИСПОЛЬЗОВАН', 'BONUS USED'), `${this.favorUiLabel(f)}${body ? ' · ' + body : ''}`, 'gold');
        break;
      }
      case 'contract_fail': this.banner(t('contractFail'), `${locLabel(f.label || '')}${f.body ? ' · ' + cleanPlayerText(f.body) : ''}`, 'red'); break;
      case 'ctrl_capture': {
        const who = name(f.id || f.owner);
        const label = locLabel(f.label || f.kind || localText('ПРОЦЕСС', 'PROCESS'));
        this.feed(`${who}: ${localText('ЗАХВАЧЕН', 'CAPTURED')} ${label}`, 'g');
        break;
      }
      case 'ctrl_proc_expire': {
        const who = name(f.owner || f.id);
        const label = locLabel(f.label || f.kind || localText('ПРОЦЕСС', 'PROCESS'));
        const reason = f.reason === 'hp' ? localText('УНИЧТОЖЕН', 'DESTROYED') : localText('СИГНАЛ ИСЧЕЗ', 'SIGNAL LOST');
        this.feed(`${who}: ${label} · ${reason}`, f.reason === 'hp' ? 'r' : '');
        break;
      }
      case 'denied': if (f.id === myId) { const msg = denyText(f); if (msg) this.denyPrompt(msg); } break;
      case 'bet_ui': if (f.id === myId) this.openCasino(); break;
      case 'casino': this.casinoResult(f, myId); break;
      case 'active_casino_roll': if (f.id === myId) this.activeRoll(f); break;
      case 'install': if (f.id === myId) this.feed(`${localText('УЛУЧШЕНИЕ', 'INSTALL')}: ${locLabel(f.label)}`, f.cursed ? 'p' : 'g'); break;
      case 'transition': this.cancelActiveRoll(); break;
      case 'protocol_complete':
        this.banner(localText('ОЧИСТКА ЗАВЕРШЕНА', 'CLEANUP COMPLETE'), localText('6 ЦИКЛОВ ЗАВЕРШЕНЫ', '6 LOOPS COMPLETE'), 'green');
        this.feed(localText('ФИНАЛЬНЫЙ ПОРТАЛ ЗАКРЫЛ ЗАРАЖЁННУЮ ВЕТКУ', 'FINAL PORTAL CLOSED THE INFECTED BRANCH'), 'g');
        this.cancelActiveRoll(); this.closeInstall(); this.closeCasino(); this.closeWeaponChest(); this.closeAbilityChest();
        break;
      case 'protocol_lost':
        this.banner(t('protocolLost'), `${t('loop')} ${displayLoopNumber(f.loop)} · ${t('depth')} ${f.depth} — ${t('restart')}`, 'red');
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
            if (res) res.textContent = locLabel(f.label || 'VIRUS EVENT');
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
    const tabRoomHint = (r, isNext = false) => `${isNext ? localText('Следующий сектор.', 'Next room.') : localText('Текущий сектор.', 'Current room.')} ${localText('Подчёркнутые правила можно осмотреть.', 'Underlined rules can be inspected.')}`;
    const termLabel = (label, title, body, tone = '') => `<span class="term" ${explainAttr(title, body, tone)}>${esc(label)}</span>`;
    const modChip = (m, r = room) => `<span class="term" ${explainAttr(roomModLabel(m, r), roomModHint(m, r), m === 'static_rain' ? 'purple' : m === 'prism_grid' ? 'cyan' : m === 'blood_tax' || m === 'moving_room' || m === 'hunter_contract' ? 'red' : m === 'echo_walls' || m === 'casino_virus' ? 'purple' : m === 'greed' ? 'gold' : '')}>${esc(roomModLabel(m, r))}</span>`;
    const modList = (r) => (r?.mods || []).filter(m => m !== 'static_rain').length ? (r.mods || []).filter(m => m !== 'static_rain').map(m => modChip(m, r)).join(' ') : `<span class="muted">${esc(localText('ЧИСТО', 'CLEAN'))}</span>`;
    const tabStaticBd = room.staticRainBreakdown || { total: room.staticRainStacks || 0, sources: [] };
    const tabNextStaticBd = room.next?.staticRainBreakdown || room.staticRainNextBreakdown || null;
    const nextStaticLine = (tabStaticBd.total || 0) > 0
      ? staticBreakdownText(tabStaticBd)
      : (tabNextStaticBd ? staticBreakdownText(tabNextStaticBd, tabNextStaticBd.banked || 0) : '—');
    const portalState = room.portal?.[2] ? localText('ОТКРЫТ', 'OPEN') : localText('ЗАКРЫТ', 'CLOSED');
    const mem = room.protocolMemory || {};
    $('tab-run').innerHTML =
      `<div class="tab-dossier">` +
        `<div class="tab-card current"><h3><span class="term" ${explainAttr(localText('ТЕКУЩИЙ СЕКТОР', 'CURRENT SECTOR'), tabRoomHint(room, false), 'cyan')}>${esc(localText('СЕЙЧАС', 'NOW'))}</span> ${esc(archLabel(room.archetype))}</h3>` +
          `<div>${modList(room)}</div>` +
          `<p><span class="term" ${explainAttr(localText('ОПАСНОСТЬ', 'DANGER'), localText('Общий риск сектора: угрозы, правила и темп волн.', 'Overall sector risk: threats, rules, and wave pressure.'), 'red')}>${esc(dangerLabel(room))}</span></p>` +
          `<p>${termLabel(localText('УГРОЗЫ', 'THREAT'), localText('УГРОЗЫ', 'THREAT'), localText('Короткие теги того, что опаснее всего в этой секторе.', 'Short tags for the main dangers in this room.'), 'red')}: ${esc(tagJoin(room.threatTags, localText('ОБЫЧНО', 'NORMAL')))}</p>` +
          `<p>${termLabel(localText('НАГРАДА', 'REWARD'), localText('НАГРАДА', 'REWARD'), localText('Что здесь можно получить.', 'What this room can pay out.'), 'gold')}: ${esc(tagJoin(room.rewardTags, localText('ОБЫЧНО', 'NORMAL')))}</p>` +
          (room.objective ? `<p>${objectiveChip(room.objective, 'CONTRACT')}</p>` : '') +
          `</div>` +
        `<div class="tab-card next"><h3><span class="term" ${explainAttr(localText('СЛЕДУЮЩИЙ СЕКТОР', 'NEXT SECTOR'), next ? tabRoomHint(next, true) : '—', 'cyan')}>${esc(localText('ДАЛЬШЕ', 'NEXT'))}</span> ${next ? esc(archLabel(next.archetype)) : '—'}</h3>` +
          `<div>${next ? modList(next) : '<span class="muted">—</span>'}</div>` +
          `<p>${next ? termLabel(dangerLabel(next), localText('ОПАСНОСТЬ', 'DANGER'), localText('Примерный риск следующего сектора.', 'Estimated risk of the next room.'), 'red') : esc(localText('ОПАСНОСТЬ —', 'DANGER —'))}</p>` +
          `<p>${termLabel(localText('УГРОЗЫ', 'THREAT'), localText('УГРОЗЫ', 'THREAT'), localText('Короткие теги опасностей следующей сектора.', 'Short danger tags for the next room.'), 'red')}: ${next ? esc(tagJoin(next.threatTags, localText('ОБЫЧНО', 'NORMAL'))) : '—'}</p>` +
          `<p>${termLabel(localText('НАГРАДА', 'REWARD'), localText('НАГРАДА', 'REWARD'), localText('Что может дать следующая сектор.', 'What the next room can pay out.'), 'gold')}: ${next ? esc(tagJoin(next.rewardTags, localText('ОБЫЧНО', 'NORMAL'))) : '—'}</p>` +
          (next?.objective ? `<p>${objectiveChip(next.objective, 'CONTRACT')}</p>` : '') +
          `</div>` +
        `<div class="tab-card protocol"><h3>${esc(localText('ЗАБЕГ', 'RUN'))}</h3>` +
          `<p><span class="term" ${explainAttr(t('loopTitle'), t('loopBody'))}>${esc(t('loop'))}</span> ${displayLoopNumber(room.loop)} · <span class="term" ${explainAttr(t('depth'), localText('Сколько секторов уже очищено в текущем протоколе.', 'Sectors cleaned in this protocol.'))}>${esc(t('depth'))}</span> ${room.depth}</p>` +
          `<p><span class="term" ${explainAttr(t('room'), t('roomBody'))}>${esc(t('room'))}</span> ${esc(room.id)} · <span class="term" ${explainAttr(t('code'), t('codeBody'))}>${esc(t('code'))}</span> ${esc(this.net?.mode === 'solo' ? localText('ОДИНОЧНАЯ ИГРА', 'SINGLE PLAYER') : (this.net.roomId || '----'))}</p>` +
          `<p><span class="term" ${explainAttr(t('goal'), localText('Портал откроется, когда сектор очищен и угрозы удалены.', 'The portal opens when the sector is clean and threats are removed.'))}>${esc(t('clear'))}</span> ${esc(Math.min(Math.max(0, room.kills || 0), Math.max(0, room.quota || 0)))}/${esc(Math.max(0, room.quota || 0))} · ${esc(localText('ЖИВЫХ', 'ALIVE'))} ${esc(Math.max(0, room.liveEnemies || 0))} · ${esc(localText('ПОРТАЛ', 'PORTAL'))} ${esc(portalState)}</p>` +
          `<p><span class="term" ${explainAttr(localText('СТАТИК-ШТОРМ', 'STATIC STORM'), staticBreakdownExplain(tabStaticBd.total ? tabStaticBd : (tabNextStaticBd || {}), tabNextStaticBd?.banked || 0), 'purple')}>${esc(localText('СТАТИК', 'STATIC'))}</span> ${esc(nextStaticLine)}</p>` +
          `<p><span class="term" ${explainAttr(localText('СЕРИЯ КОНТРАКТОВ', 'CONTRACT CHAIN'), localText('Чем дольше серия выполненных контрактов, тем ценнее забег.', 'A longer contract streak makes the protocol more valuable.'), 'gold')}>${esc(localText('СЕРИЯ КОНТРАКТОВ', 'CONTRACT CHAIN'))}</span> x${esc(mem.contractStreak || 0)} / BEST x${esc(mem.bestContractStreak || 0)} · ${esc(localText('ПРИЗЫ', 'PRIZES'))} ${esc(mem.favorsEarned || 0)}</p>` +
          `${this.compactFavorItems(room.contractFavors?.active || []).length ? `<p><span class="term" ${explainAttr(localText('БОНУСЫ КОНТРАКТА', 'CONTRACT BONUSES'), this.compactFavorItems(room.contractFavors.active || []).map(f => `${this.favorUiLabel(f)}: ${this.favorUiBody(f)} (${this.favorStatusText(f)})`).join('\n'), 'gold')}>${esc(localText('БОНУСЫ', 'BONUSES'))}</span> ${this.compactFavorItems(room.contractFavors.active || []).map(f => `${esc(this.favorUiLabel(f))} · ${esc(this.favorStatusText(f))}${f.uses ? ` x${esc(f.uses)}` : ''}`).join(' · ')}</p>` : ''}` +
          `${this.compactFavorItems(room.contractFavors?.pending || []).length ? `<p><span class="term" ${explainAttr(localText('ПРИЗ КОНТРАКТА', 'CONTRACT PRIZE'), localText('Эти бонусы хранятся, пока не будут использованы.', 'These bonuses persist until used.'), 'gold')}>${esc(localText('ПРИЗ', 'PRIZE'))}</span> ${this.compactFavorItems(room.contractFavors.pending || []).map(f => esc(contractFavorPreviewLabel(f))).join(' · ')}</p>` : ''}</div>` +
      `</div>`;
    $('tab-build').innerHTML = renderTabBuild(state.me());
    const table = $('tab-table');
    let html = '<tr>' +
      `<th><span class="term" data-explain-title="${esc(t('player'))}" data-explain="${esc(t('nameBody'))}">${esc(t('player'))}</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('health'))}" data-explain="${esc(t('hpBody'))}">HP</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('level'))}" data-explain="${esc(t('lvlBody'))}">LVL</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('money'))}" data-explain="${esc(t('gldBody'))}">GLD</span></th>` +
      `<th><span class="term" data-explain-title="${esc(localText('ОПЫТ', 'EXP'))}" data-explain="${esc(t('xpBody'))}">${esc(localText('ОПЫТ', 'EXP'))}</span></th>` +
      `<th><span class="term" data-explain-title="${esc(localText('СКОРОСТЬ', 'SPEED'))}" data-explain="${esc(localText('Текущая скорость антивируса.', 'Current antivirus movement speed.'))}">${esc(localText('СКР', 'SPD'))}</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('dash').toUpperCase())}" data-explain="${esc(t('dashReady'))}">${esc(localText('РЫВОК', 'DASH'))}</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('drones'))}" data-explain="${esc(localText('Автостреляющие спутники антивируса.', 'Auto-firing antivirus drones.'))}">${esc(localText('СПТ', 'DRN'))}</span></th>` +
      `<th><span class="term" data-explain-title="${esc(localText('ОРУЖИЕ', 'WEAPONS'))}" data-explain="${esc(localText('Оружие антивируса. Активный слот помечен звёздочкой. Наведи на оружие для описания.', 'Antivirus weapons. Active slot is marked with an asterisk. Hover a weapon for details.'))}">${esc(localText('ОРУЖ.', 'WPN'))}</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('qAbility'))}" data-explain="${esc(t('activeQTitle'))}">Q</span></th>` +
      `<th><span class="term" data-explain-title="${esc(localText('ОБЛИК', 'SHELL'))}" data-explain="${esc(localText('Текущий облик антивируса.', 'Current antivirus shell.'))}">${esc(localText('ОБЛИК', 'SHELL'))}</span></th>` +
      `<th><span class="term" data-explain-title="${esc(t('installTitle'))}" data-explain="${esc(t('installBody'))}">${esc(t('installTitle'))}</span></th>` +
      '</tr>';
    for (const p of state.latest.players) {
      const cls = p[P.ID] === state.myId ? 'me' : (!p[P.ALIVE] ? 'dead' : '');
      const qTitle = esc(activeLabel(p));
      const qBody = esc(activeDesc(p));
      const qCell = `<span class="term" data-explain-title="${qTitle}" data-explain="${qBody}">${qTitle}</span>`;
      const weaponNames = (p[P.WEAPONS] || []).map((w, i) => {
        const wd = WEAPONS[w] || WEAPON_BY_LABEL_LOCAL[w] || { label: String(w || '').toUpperCase(), name: String(w || '').toUpperCase() };
        const active = i === p[P.WIDX] ? '*' : '';
        const title = localText(locLabel(wd.name || wd.label || w), wd.name || wd.label || w);
        const body = weaponDesc(wd, p[P.SHG] ?? 4);
        return `<span class="term weapon-term" data-explain-title="${esc(active + title)}" data-explain="${esc(body)}" data-explain-tone="cyan">${esc(active + (wd.label || w))}</span>`;
      }).join(' / ');
      const shellLabel = locLabel(p[P.SKINID] || '—');
      html += `<tr class="${cls}"><td>${esc(p[P.NAME])}</td><td>${p[P.ALIVE] ? p[P.HP] + '/' + p[P.MAXHP] : t('eliminated')}</td>` +
        `<td>${p[P.LVL]}</td><td>${p[P.GLD]}</td><td>${p[P.XP]}/${p[P.NEXTXP]}</td><td>${Math.round(p[P.SPD] || 0)}</td><td>${p[P.DASH]}/${p[P.DASHMAX]}</td>` +
        `<td>${p[P.DRONES]}</td><td>${weaponNames || '—'}</td><td>${qCell}</td><td>${esc(shellLabel)}</td><td>${p[P.PEND] > 0 ? 'x' + p[P.PEND] : '—'}</td></tr>`;
    }
    table.innerHTML = html;
  }

  // ------------------------------------------------- install modal
  installDataLoadingHtml(wait = null, myId = '') {
    const players = Array.isArray(wait?.players) ? wait.players : [];
    const mine = players.find(p => String(p.id) === String(myId));
    const sig = String(mine?.kind || '') === 'boss_signature' || !!mine?.signature;
    const dots = '.'.repeat(1 + (Math.floor(performance.now() / 420) % 3));
    const title = sig
      ? localText('ПОЛУЧЕНИЕ СИГНАТУРЫ', 'RECEIVING SIGNATURE')
      : localText('ПОЛУЧЕНИЕ ДАННЫХ', 'RECEIVING DATA');
    const line = sig
      ? localText('Считываем пакет угрозы от узла ведущего.', 'Reading threat packet from host node.')
      : localText('Синхронизация улучшений с ведущим узлом.', 'Syncing install data from host node.');
    const sub = localText('Не нажимай вслепую — варианты появятся сами.', 'Do not mash keys — options will appear automatically.');
    return `<b>${esc(title)}${esc(dots)}</b><br>${esc(line)}<span class="wait-names">${esc(sub)}</span>`;
  }

  installWaitHtml(wait = null, myId = '') {
    const players = Array.isArray(wait?.players) ? wait.players : [];
    const waiting = players.filter(p => p && p.waiting);
    const meWaiting = waiting.some(p => String(p.id) === String(myId));
    const names = waiting.map(p => String(p.name || p.id || 'PLAYER')).slice(0, 4).join(' · ');
    const count = Math.max(0, Number(wait?.waiting || waiting.length || 0));
    const total = Math.max(count, Number(wait?.total || players.length || 0));
    if (meWaiting) {
      return `<b>${esc(localText('ВЫБЕРИ УЛУЧШЕНИЕ', 'CHOOSE AN INSTALL'))}</b><br>${esc(localText(`ОЖИДАЕТСЯ ВЫБОР · ${Math.max(0, count)}/${Math.max(1, total)}`, `WAITING FOR PICKS · ${Math.max(0, count)}/${Math.max(1, total)}`))}${names ? `<span class="wait-names">${esc(names)}</span>` : ''}`;
    }
    return `<b>${esc(localText('ВЫБОР ПРИНЯТ', 'PICK LOCKED'))}</b><br>${esc(localText(`ЖДЁМ ОСТАЛЬНЫХ · ${Math.max(0, count)}/${Math.max(1, total)}`, `WAITING FOR OTHERS · ${Math.max(0, count)}/${Math.max(1, total)}`))}${names ? `<span class="wait-names">${esc(names)}</span>` : ''}`;
  }

  showInstallWaiting(wait = null, myId = '') {
    const modal = $('install-modal');
    const box = $('install-choices');
    const waitEl = $('install-wait');
    if (!modal || !box || !waitEl) return;
    const sig = Array.isArray(wait?.players) && wait.players.some(p => p && p.waiting && String(p.kind || '') === 'boss_signature');
    const left = Math.max(1, Number(wait?.nextExpires || 6));
    const prev = this.install.open && this.install.waitingOnly ? this.install : null;
    this.install = { open: true, choices: [], offerId: 0, expires: prev ? Math.min(Math.max(0, prev.expires || left), left) : left, total: prev ? Math.max(1, prev.total || left) : left, locked: true, waitingOnly: true, dataLoading: false, picked: true, bossSignature: sig };
    modal.classList.toggle('boss-signature-modal', sig);
    modal.classList.add('waiting-only');
    modal.classList.remove('data-loading', 'sig-opening', 'sig-closing', 'sig-open');
    $('install-pending').textContent = sig ? localText('СИГНАТУРА', 'SIGNATURE') : localText('ОЖИДАНИЕ', 'WAIT');
    box.innerHTML = '';
    waitEl.className = 'install-wait done' + (sig ? ' boss' : '');
    waitEl.innerHTML = this.installWaitHtml(wait, myId);
    modal.classList.remove('hidden');
  }

  showInstallDataLoading(wait = null, myId = '') {
    const modal = $('install-modal');
    const box = $('install-choices');
    const waitEl = $('install-wait');
    if (!modal || !box || !waitEl) return;
    const players = Array.isArray(wait?.players) ? wait.players : [];
    const mine = players.find(p => String(p.id) === String(myId));
    const sig = String(mine?.kind || '') === 'boss_signature' || !!mine?.signature;
    const prev = this.install.open && this.install.waitingOnly && this.install.dataLoading ? this.install : null;
    this.install = { open: true, choices: [], offerId: Math.max(0, mine?.offerId || 0), expires: 1, total: 1, locked: true, waitingOnly: true, dataLoading: true, picked: false, bossSignature: sig };
    if (prev) { this.install.expires = prev.expires || 1; this.install.total = prev.total || 1; }
    modal.classList.toggle('boss-signature-modal', sig);
    modal.classList.add('waiting-only', 'data-loading');
    modal.classList.remove('sig-opening', 'sig-closing', 'sig-open');
    $('install-pending').textContent = sig ? localText('СИГНАТУРА', 'SIGNATURE') : localText('СИГНАЛ', 'SIGNAL');
    box.innerHTML = '';
    waitEl.className = 'install-wait data' + (sig ? ' boss' : '');
    waitEl.innerHTML = this.installDataLoadingHtml(wait, myId);
    modal.classList.remove('hidden');
  }

  mirrorChargesReady() {
    const me = this.latestMe;
    if (!me) return 0;
    return Math.max(0, Number(me[P.MIRROR] || 0) || 0);
  }
  mirrorMetaForChoice(id, opt = null, context = '') {
    if (this.mirrorChargesReady() <= 0) return null;
    const bossStack = new Set(['sig_target_lock','sig_redline_boost','sig_ghost_decoy','sig_rewind_mark','sig_kill_switch','sig_spawn_hold','sig_aegis_process','sig_null_revival','sig_boss_key']);
    const ctx = String(context || '');
    if (ctx === 'install') return null;
    if (ctx === 'boss') {
      if (String(id || '') === 'sig_mirror_payout') return null;
      return bossStack.has(String(id || '')) ? { label: localText('ЗЕРКАЛО x2', 'MIRROR x2'), tone: 'purple', works: 1 } : { label: localText('УНИКАЛЬНО', 'UNIQUE'), tone: 'red', works: 0 };
    }
    if (ctx === 'weapon') {
      const k = String(opt?.kind || '');
      return (k === 'weapon_upgrade' || k === 'stat') ? { label: localText('ЗЕРКАЛО x2', 'MIRROR x2'), tone: 'purple', works: 1 } : { label: localText('УНИКАЛЬНО', 'UNIQUE'), tone: 'red', works: 0 };
    }
    if (ctx === 'ability') {
      const k = String(opt?.kind || '');
      return (k === 'active_core_install' || k === 'active_core_replace' || k === 'active_upgrade_core' || k === 'ability_upgrade' || k === 'stat') ? { label: localText('ЗЕРКАЛО x2', 'MIRROR x2'), tone: 'purple', works: 1 } : { label: localText('УНИКАЛЬНО', 'UNIQUE'), tone: 'red', works: 0 };
    }
    return null;
  }

  openInstall(choices, pending, offerId = 0, kind = '', expires = 0, total = 0) {
    const sig = String(kind || '') === 'boss_signature';
    const normalizedChoices = Array.isArray(choices) ? choices.slice(0, 3) : [];
    const nextOfferId = Math.max(0, offerId | 0);
    const currentOfferId = Math.max(0, Number(this.install?.offerId || 0) | 0);
    // Reject stale/empty normal INSTALL packets. Boss signatures are separate
    // rewards and are valid without a level-up pending counter.
    if ((!sig && Math.max(0, Number(pending || 0) | 0) <= 0) || normalizedChoices.length <= 0) {
      if (this.install.open && !this.install.skinOnly && (!nextOfferId || !currentOfferId || nextOfferId === currentOfferId)) this.closeInstall();
      return false;
    }
    // Reliable RTC and relay fallback can briefly overlap. Never let an older
    // packet replace a newer INSTALL that is already visible.
    if (nextOfferId && this.installLatestOfferId && nextOfferId < this.installLatestOfferId) return false;
    if (this.install.open && !this.install.waitingOnly && currentOfferId && nextOfferId && nextOfferId < currentOfferId) return false;
    if (nextOfferId) this.installLatestOfferId = Math.max(this.installLatestOfferId || 0, nextOfferId);
    const nextTotal = Math.max(1, Number(total || 0) || (sig ? 32 : 24));
    const serverLeftRaw = Number(expires || 0);
    const nextExpires = Math.max(0.001, Math.min(nextTotal, Number.isFinite(serverLeftRaw) && serverLeftRaw > 0 ? serverLeftRaw : nextTotal));
    const sameOffer = this.install.open && !this.install.waitingOnly && (this.install.offerId || 0) === nextOfferId && !!this.install.bossSignature === sig && JSON.stringify(this.install.choices || []) === JSON.stringify(normalizedChoices);
    if (sameOffer) {
      // Host resends the same offer for reliability. Do not rebuild the modal or refill the timer.
      this.install.total = Math.max(1, this.install.total || nextTotal);
      this.install.expires = Math.max(0, Math.min(this.install.expires || nextExpires, nextExpires));
      const p = $('install-pending'); if (p) p.textContent = sig ? localText('СИГНАТУРА', 'SIGNATURE') : `x${pending}`;
      return;
    }
    this.install = { open: true, choices: normalizedChoices, offerId: nextOfferId, expires: nextExpires, total: nextTotal, locked: false, waitingOnly: false, dataLoading: false, picked: false, bossSignature: sig };
    this.installSyncKey = '';
    this.installSyncSeenAt = 0;
    const modal = $('install-modal');
    modal?.classList.remove('waiting-only', 'data-loading', 'sig-closing');
    modal?.classList.toggle('boss-signature-modal', sig);
    if (modal && sig && !sameOffer) {
      modal.classList.remove('sig-opening', 'sig-open');
      void modal.offsetWidth;
      modal.classList.add('sig-opening');
      setTimeout(() => { if (this.install.open && this.install.bossSignature) { modal.classList.remove('sig-opening'); modal.classList.add('sig-open'); } }, 520);
    } else if (modal && !sig) {
      modal.classList.remove('sig-opening', 'sig-open');
    }
    const waitEl = $('install-wait'); if (waitEl) { waitEl.className = 'install-wait hidden'; waitEl.innerHTML = ''; }
    $('install-pending').textContent = sig ? localText('СИГНАТУРА', 'SIGNATURE') : `x${pending}`;
    const box = $('install-choices');
    box.innerHTML = '';
    normalizedChoices.forEach((id, i) => {
      const u = UPG[id];
      const d = document.createElement('div');
      d.className = 'choice' + (u?.cursed ? ' cursed' : '') + (sig ? ' boss-signature-choice' : '');
      d.dataset.choiceId = String(id || '');
      d.dataset.choiceIndex = String(i);
      const m = sig ? this.mirrorMetaForChoice(id, null, 'boss') : null;
      const mirrorTag = m ? `<span class="mirror-choice-tag ${m.works ? 'works' : 'unique'}">${esc(m.label)}</span>` : '';
      d.innerHTML = sig ? `<div class="sig-choice-top"><span class="key sig-key">[${i + 1}]</span><b>${esc(locLabel(u?.label || id))}</b>${mirrorTag}</div><span class="choice-sub">${esc(optionDesc(u || { id }))}</span>` : `<span class="key">[${i + 1}]</span>${esc(locLabel(u?.label || id))}`;
      const mirrorHint = m ? (m.works ? localText('ЗЕРКАЛО активно: этот выбор будет скопирован и даст дополнительный уровень/заряд.', 'MIRROR is active: this choice will be copied for an extra stack/charge.') : localText('ЗЕРКАЛО активно, но эта награда уникальна: заряд будет потрачен без копии.', 'MIRROR is active, but this reward is unique: the charge will be spent without a copy.')) : '';
      this.setExplain(d, sig ? localText('СИГНАТУРА УГРОЗЫ', 'THREAT SIGNATURE') + ' / ' + locLabel(u?.label || id) : locLabel(u?.label || id), `${optionDesc(u || { id })}${mirrorHint ? '\n\n' + mirrorHint : ''}`, sig ? 'gold' : (u?.cursed ? 'purple' : (u?.branch === 'Q' || u?.branch === 'DASH' ? 'cyan' : '')));
      d.addEventListener('click', () => this.pick(i, nextOfferId, id));
      box.appendChild(d);
    });
    if (sig) this.appendFavorRerollButton(box, 'boss');
    this.appendSkinClaimCard(box);
    modal?.classList.remove('hidden');
    return true;
  }
  pick(i, expectedOfferId = 0, expectedChoiceId = '') {
    // guard against double-picks: lock until the next offer (or close) arrives
    if (this.install.locked || !this.install.open) return;
    if (i < 0 || i >= this.install.choices.length) return;
    const liveOfferId = Math.max(0, Number(this.install.offerId || 0) | 0);
    const liveChoiceId = String(this.install.choices[i] || '');
    if (expectedOfferId && liveOfferId && expectedOfferId !== liveOfferId) return;
    if (expectedChoiceId && expectedChoiceId !== liveChoiceId) return;
    this.install.locked = true;
    this.install.picked = true;
    this.install.submittedChoiceId = liveChoiceId;
    const els = document.querySelectorAll('#install-choices > .choice');
    els.forEach((el, j) => el.classList.add(j === i ? 'picked' : 'dimmed'));
    const waitEl = $('install-wait');
    if (waitEl) {
      waitEl.className = 'install-wait done' + (this.install.bossSignature ? ' boss' : '');
      const solo = this.net?.mode === 'solo';
      const chosen = locLabel(UPG[liveChoiceId]?.label || liveChoiceId);
      waitEl.innerHTML = `<b>${esc(localText('УСТАНАВЛИВАЕМ', 'INSTALLING'))}: ${esc(chosen)}</b>` + (solo ? '' : `<br>${esc(localText('ПОДТВЕРЖДЕНИЕ УЗЛА', 'NODE CONFIRMATION'))}`);
    }
    this.net.sendPick(i, liveOfferId, liveChoiceId);
  }
  pickRandomInstall() {
    if (!this.install.open || this.install.locked || !this.install.choices.length) return false;
    this.pick(Math.floor(Math.random() * this.install.choices.length));
    return true;
  }
  closeInstall() {
    const wasBossSignature = !!this.install.bossSignature;
    const modal = $('install-modal');
    this.install.open = false; this.install.locked = false; this.install.skinOnly = false; this.install.waitingOnly = false; this.install.dataLoading = false; this.install.picked = false; this.install.bossSignature = false; this.installSyncKey = ''; this.installSyncSeenAt = 0;
    const w = $('install-wait'); if (w) { w.className = 'install-wait hidden'; w.innerHTML = ''; }
    const preview = $('install-next-room');
    if (preview) { preview.classList.add('hidden'); preview.replaceChildren(); preview.setAttribute('aria-hidden', 'true'); }
    this.installPreviewSig = '';
    if (modal && wasBossSignature && !modal.classList.contains('hidden')) {
      modal.classList.remove('waiting-only', 'data-loading', 'sig-opening', 'sig-open');
      modal.classList.add('sig-closing');
      setTimeout(() => {
        if (!this.install.open) modal.classList.add('hidden');
        modal.classList.remove('boss-signature-modal', 'waiting-only', 'data-loading', 'sig-opening', 'sig-open', 'sig-closing');
      }, 360);
    } else if (modal) {
      modal.classList.remove('boss-signature-modal', 'waiting-only', 'data-loading', 'sig-opening', 'sig-open', 'sig-closing');
      modal.classList.add('hidden');
    }
    this.hideTip();
  }
  closeInstallOffer(offerId = 0) {
    const closedOfferId = Math.max(0, Number(offerId || 0) | 0);
    const currentOfferId = Math.max(0, Number(this.install?.offerId || 0) | 0);
    // A delayed close for offer N must never close a newer offer N+1.
    if (closedOfferId && this.installLatestOfferId && closedOfferId < this.installLatestOfferId) return false;
    if (closedOfferId && currentOfferId && closedOfferId < currentOfferId) return false;
    this.closeInstall();
    return true;
  }
  resetInstallSync() {
    this.installLatestOfferId = 0;
    if (this.install.open && !this.install.skinOnly) this.closeInstall();
  }

  openSkinClaim(skin = {}) {
    if (!skin?.id && !skin?.name && !skin?.allOwned) return;
    this.skinClaim = { ...skin, claimed: false };
    const box = $('install-choices');
    if (!this.install.open) {
      this.install = { open: true, choices: [], expires: 15, total: 15, locked: false, skinOnly: true, waitingOnly: false, dataLoading: false };
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
      d.innerHTML = `<div class="skin-claim-top"><span class="key">SKN</span><span class="skin-claim-title">${esc(localText('ВСЕ ОБЛИКИ ОТКРЫТЫ', 'ALL SKINS UNLOCKED'))}</span><span class="skin-claim-rarity">100%</span></div><span class="choice-sub">${esc(localText('Коллекция уже полная.', 'Collection already complete.'))}</span>`;
      this.setExplain(d, localText('КОЛЛЕКЦИЯ ЗАВЕРШЕНА', 'COLLECTION COMPLETE'), localText('Все доступные облики уже открыты.', 'Every available look is already unlocked.'), 'gold');
    } else {
      d.innerHTML = `<div class="skin-claim-top"><span class="key">SKN</span><span class="skin-claim-title">${esc(localText('ЗАБРАТЬ ОБЛИК', 'CLAIM SKIN'))}</span><span class="skin-claim-rarity">${esc(rarityText(skin.rarity || 'skin'))}</span></div><span class="choice-sub">${esc(skin.name || skin.id || 'SKIN')}</span>`;
      this.setExplain(d, localText('ОБЛИК ГОТОВ', 'SKIN READY'), localText('Нажми, чтобы закрыть карточку.', 'Click to close this card.'), 'purple');
    }
    d.addEventListener('click', () => { this.playUiSound(skin.allOwned ? 'ui_click' : 'install'); this.skinClaim.claimed = true; d.classList.add('picked'); d.remove(); if (this.install.skinOnly) this.closeInstall(); });
    box.prepend(d);
  }

  compactFavorItems(items = []) {
    const out = [];
    const byId = new Map();
    for (const raw of Array.isArray(items) ? items : []) {
      if (!raw) continue;
      const id = String(raw.id || '').trim();
      if (!id) continue;
      let f = byId.get(id);
      if (!f) {
        f = { ...raw, id, uses: 0, usesTotal: 0, used: 0 };
        byId.set(id, f);
        out.push(f);
      }
      f.uses = Math.max(0, Number(f.uses || 0)) + Math.max(0, Number(raw.uses || 0));
      f.usesTotal = Math.max(0, Number(f.usesTotal || 0)) + Math.max(0, Number(raw.usesTotal || raw.uses || 0));
      f.used = Math.max(0, Number(f.used || 0)) + Math.max(0, Number(raw.used || 0));
      if (String(raw.status || '').toLowerCase() === 'active') f.status = 'active';
      else if (!f.status) f.status = raw.status || '';
    }
    return out;
  }
  favorUiLabel(f = {}) {
    const id = String(f.id || '');
    const ru = {
      free_reroll: 'ПЕРЕБРОС ВЫБОРА', clear_debt: 'СНЯТЬ СТАТИК-ШТОРМ',
      portal_insurance: 'СТРАХОВКА ОТ СМЕРТИ', epic_reroll: 'ДВА ПЕРЕБРОСА ВЫБОРА', double_favor: 'ДВОЙНОЙ СЛЕД. ПРИЗ',
      wpn_clearance: 'WPN-ДОПУСК', abl_clearance: 'ABL-ДОПУСК', rar_clearance: 'RAR-ДОПУСК',
      mod_veto: 'ВЕТО МОДИФИКАТОРА', credit_pass: 'КРЕДИТНЫЙ ПРОПУСК', salvage_protocol: 'ПРОТОКОЛ СБОРА'
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
      free_reroll: 'Один раз обновляет варианты оружия, протоколов или призов главной угрозы. Хранится, пока не используешь.',
      clear_debt: 'Снимает весь накопленный статик и навсегда глушит шторм Статик-ядра в этом забеге.',
      portal_insurance: 'Один раз в этой секторе смертельный удар оставит тебя живым и даст 50 HP.',
      epic_reroll: 'Два раза обновляет варианты оружия, протоколов или призов главной угрозы. Хранится, пока не используешь.',
      double_favor: 'Следующий выполненный контракт выдаёт два разных приза вместо одного. Один контракт расходует один заряд.',
      wpn_clearance: 'Перед INSTALL открывает отдельный выбор из четырёх улучшенных WPN-модулей. Один модуль устанавливается бесплатно.',
      abl_clearance: 'Перед INSTALL открывает отдельный выбор из четырёх улучшенных ABL-модулей. Один модуль устанавливается бесплатно.',
      rar_clearance: 'Следующий RAR-сундук получает усиленное безопасное качество. Один сундук расходует один заряд.',
      mod_veto: 'Снимает один опасный модификатор со следующего подходящего сектора. Если цели нет, заряд сохраняется.',
      credit_pass: 'Следующий платный WPN- или ABL-сундук открывается бесплатно. Бесплатные и заражённые сундуки заряд не тратят.',
      salvage_protocol: 'Первые десять убийств в следующем боевом секторе дают пятикратные командные GLD и EXP. Один сектор расходует один заряд.'
    };
    const en = {
      free_reroll: 'Refreshes weapon, protocol, or main-threat prize choices once. Persists until used.',
      clear_debt: 'Clears all banked Static Storm levels and permanently silences Static Core storms for this run.',
      portal_insurance: 'Once this room, lethal damage keeps you alive and restores 50 HP.',
      epic_reroll: 'Refreshes weapon, protocol, or main-threat prize choices twice. Persists until used.',
      double_favor: 'If the contract succeeds, the room grants two prizes.'
    };
    return (ru[id] || en[id] || f.descRu || f.desc) ? localText(ru[id] || f.descRu || contractFavorPreviewBody(f), en[id] || f.desc || contractFavorPreviewBody(f)) : contractFavorPreviewBody(f);
  }
  favorStatusText(f = {}) {
    const status = String(f.status || '').toLowerCase();
    const left = Math.max(0, f.uses || 0);
    if (status === 'used' || left <= 0) return localText('ИСПОЛЬЗОВАН', 'USED');
    if (status === 'pending') return localText('АКТИВЕН', 'ACTIVE');
    return localText('АКТИВЕН', 'ACTIVE');
  }
  favorCompactStatus(f = {}) {
    const id = String(f.id || '');
    const status = String(f.status || '').toLowerCase();
    const left = Math.max(0, Number(f.uses || 0) | 0);
    if (status === 'used' || left <= 0) return localText('использован', 'used');
    if (id === 'free_reroll' || id === 'epic_reroll') {
      return localText(`${left} ${left === 1 ? 'заряд' : (left >= 2 && left <= 4 ? 'заряда' : 'зарядов')}`, `${left} charge${left === 1 ? '' : 's'}`);
    }
    if (id === 'portal_insurance') return localText(`${left} ${left === 1 ? 'защита' : (left >= 2 && left <= 4 ? 'защиты' : 'защит')}`, `${left} save${left === 1 ? '' : 's'}`);
    if (id === 'clear_debt') return localText(`${left} ${left === 1 ? 'очистка' : (left >= 2 && left <= 4 ? 'очистки' : 'очисток')}`, `${left} clear${left === 1 ? '' : 's'}`);
    const units = {
      double_favor: ['контракт', 'контракта', 'контрактов', 'contract'],
      wpn_clearance: ['WPN-выбор', 'WPN-выбора', 'WPN-выборов', 'WPN choice'],
      abl_clearance: ['ABL-выбор', 'ABL-выбора', 'ABL-выборов', 'ABL choice'],
      rar_clearance: ['RAR-сундук', 'RAR-сундука', 'RAR-сундуков', 'RAR chest'],
      mod_veto: ['вето', 'вето', 'вето', 'veto'],
      credit_pass: ['открытие', 'открытия', 'открытий', 'opening'],
      salvage_protocol: ['сектор', 'сектора', 'секторов', 'room']
    };
    const u = units[id];
    if (u) return localText(`${left} ${left === 1 ? u[0] : (left >= 2 && left <= 4 ? u[1] : u[2])}`, `${left} ${u[3]}${left === 1 ? '' : 's'}`);
    if (status === 'pending') return localText(`${left} в очереди`, `${left} queued`);
    return localText(`${left} заряд${left === 1 ? '' : (left >= 2 && left <= 4 ? 'а' : 'ов')}`, `${left} charge${left === 1 ? '' : 's'}`);
  }
  activeRerollFavorUses() {
    const active = this.compactFavorItems(this.latestRoom?.contractFavors?.active || []);
    const serverLeft = active.reduce((n, f) => n + ((f.id === 'free_reroll' || f.id === 'epic_reroll') ? Math.max(0, f.uses || 0) : 0), 0);
    const sync = reconcileRerollAvailability(serverLeft, this.localRerollSpent, this.localRerollServerLeft);
    this.localRerollSpent = sync.pending;
    this.localRerollServerLeft = sync.seen;
    return sync.available;
  }
  appendFavorRerollButton(box, kind) {
    let uses = this.activeRerollFavorUses();
    if (!box || uses <= 0) return;
    const d = document.createElement('div');
    d.className = 'choice favor-reroll';
    d.innerHTML = `<div class="favor-reroll-top"><span class="key favor-key">↻</span><span class="favor-reroll-title">${esc(localText('ПРИЗ КОНТРАКТА', 'CONTRACT PRIZE'))}</span><span class="favor-uses">x${uses}</span></div><span class="choice-sub">${esc(localText('ПЕРЕБРОС ВЫБОРА · пока не используешь', 'CHOICE REROLL · persists until used'))}</span>`;
    this.setExplain(d, localText('ПЕРЕБРОС ВЫБОРА', 'CHOICE REROLL'), localText('Обновляет варианты этого выбора с анимацией. Новые варианты не повторяют текущие, если в пуле есть замена. Работает на выбор оружия, протоколов и призы главной угрозы.', 'Animates and refreshes this choice. New options avoid the current ones when the pool allows it. Works on weapon, protocol, and main-threat prize choices.'), 'gold');
    d.addEventListener('click', () => {
      if (d.dataset.locked === '1' || uses <= 0) return;
      this.playUiSound('contract');
      const host = d.closest('#install-choices, #weapon-choices, #ability-choices');
      if (host) { host.classList.remove('rerolling'); void host.offsetWidth; host.classList.add('rerolling'); setTimeout(() => host.classList.remove('rerolling'), 520); }
      d.dataset.locked = '1';
      d.classList.add('picked');
      uses = Math.max(0, uses - 1);
      this.localRerollSpent = Math.max(0, Number(this.localRerollSpent || 0) | 0) + 1;
      this.net.sendRerollOffer(kind);
      if (uses <= 0) d.remove();
      else {
        const u = d.querySelector('.favor-uses'); if (u) u.textContent = `x${uses}`;
        setTimeout(() => { if (d.isConnected) { d.dataset.locked = '0'; d.classList.remove('picked'); } }, 250);
      }
    });
    box.appendChild(d);
  }

  normalizeChestPickMeta(meta = {}, choices = []) {
    const slots = Math.max(1, Math.min(5, Number(meta.slots || choices.length || 1) | 0));
    const inferredPicks = slots >= 5 ? 2 : 1;
    const picksTotal = Math.max(1, inferredPicks, Number(meta.picksTotal || 0) | 0);
    const picksRemaining = Math.max(1, Math.min(picksTotal, Number(meta.picksRemaining || picksTotal) | 0));
    return { ...meta, slots, picksTotal, picksRemaining };
  }

  chestOfferLabel(meta = {}) {
    const label = String(meta.label || '').toUpperCase();
    const ru = String(meta.labelRu || '').trim();
    const outRu = ru || ({ SIMPLE: 'ПРОСТОЙ', GOOD: 'ХОРОШИЙ', VALUABLE: 'ЦЕННЫЙ', RARE: 'РЕДКИЙ' }[label] || label || 'СУНДУК');
    return localText(outRu, label || 'CHEST');
  }
  setChestOfferHeader(kind = 'weapon', choices = [], meta = {}) {
    const modal = (kind === 'ability' || kind === 'rare') ? $('ability-modal') : $('weapon-modal');
    if (!modal) return;
    const title = modal.querySelector('.panel-title');
    const slots = Math.max(1, Math.min(5, Number(meta.slots || choices.length || 1) | 0));
    const tier = Math.max(0, Math.min(3, Number(meta.tier || 0) | 0));
    const label = this.chestOfferLabel(meta);
        if (title) {
      const slotWord = localText(slots === 1 ? 'СЛОТ' : 'СЛОТОВ', slots === 1 ? 'SLOT' : 'SLOTS');
      const picksTotal = Math.max(1, Number(meta.picksTotal || 1) | 0);
      const picksRemaining = Math.max(1, Number(meta.picksRemaining || picksTotal) | 0);
      const pickText = picksTotal > 1 ? ` · ${esc(localText(`ВЫБЕРИ ${picksRemaining}/${picksTotal}`, `PICK ${picksRemaining}/${picksTotal}`))}` : '';
      const pcCommandChest = kind === 'weapon' && Array.isArray(choices) && choices.length && choices.every(x => x && x.pcOnly);
      const chestName = meta.contractPrize ? (kind === 'ability' ? localText('КОНТРАКТНЫЙ ABL-ПРИЗ', 'CONTRACT ABL PRIZE') : localText('КОНТРАКТНЫЙ WPN-ПРИЗ', 'CONTRACT WPN PRIZE')) : (kind === 'rare' ? localText('РЕДКИЙ СУНДУК', 'RARE CHEST') : (kind === 'ability' ? localText('СУНДУК ПРОТОКОЛОВ', 'PROTOCOL CHEST') : (pcCommandChest ? localText('ЯЩИК КОМАНД', 'COMMAND CACHE') : localText('ОРУЖЕЙНЫЙ СУНДУК', 'WEAPON CHEST'))));
      title.innerHTML = `${esc(chestName)} <span class="subtle chest-title-meta">${esc(label)} · ${slots} ${esc(slotWord)}${pickText}</span>`;
      title.dataset.explainTitle = chestName;
      title.dataset.explain = meta.contractPrize
        ? localText('Отдельный бесплатный приз за выполненный контракт. Выбери один модуль за 30 секунд; затем откроется обычный INSTALL.', 'A separate free reward for a completed contract. Pick one module within 30 seconds; regular INSTALL opens afterward.')
        : kind === 'rare'
        ? localText('Выбери один редкий приз.', 'Choose one rare prize.')
        : (picksTotal > 1 ? (pcCommandChest ? localText('Выбери усиления контроля.', 'Choose control upgrades.') : localText('Выбери два улучшения.', 'Choose two upgrades.')) : (pcCommandChest ? localText('Выбери командный модуль.', 'Choose a command module.') : localText('Выбери один модуль.', 'Choose one module.')));
    }
    let metaEl = modal.querySelector('.chest-offer-meta');
    if (!metaEl && title) {
      metaEl = document.createElement('div');
      metaEl.className = 'chest-offer-meta';
      title.insertAdjacentElement('afterend', metaEl);
    }
    if (metaEl) {
      metaEl.className = `chest-offer-meta tier-${tier}`;
      const cost = Math.max(0, Number(meta.cost || 0) | 0);
      const unit = String(meta.unit || 'GLD').toUpperCase();
      const reason = String(meta.reason || '').trim();
      const picksTotal = Math.max(1, Number(meta.picksTotal || 1) | 0);
      const picksRemaining = Math.max(1, Number(meta.picksRemaining || picksTotal) | 0);
      const picks = picksTotal > 1 ? `<span>${esc(localText('ВЫБОРЫ', 'PICKS'))}: <b>${picksRemaining}/${picksTotal}</b></span>` : '';
      const picked = Array.isArray(meta.pickedLabels) && meta.pickedLabels.length ? `<span class="chest-reason">${esc(localText('ВЗЯТО', 'TAKEN'))}: ${esc(meta.pickedLabels.map(locLabel).join(' + '))}</span>` : '';
      metaEl.innerHTML = `<span>${esc(localText('РЕДКОСТЬ', 'RARITY'))}: <b>${esc(label)}</b></span><span>${esc(localText('СЛОТЫ', 'SLOTS'))}: <b>${slots}</b></span>${picks}${cost ? `<span>${esc(localText('ЦЕНА', 'PRICE'))}: <b>${cost} ${esc(unit)}</b></span>` : ''}${reason ? `<span class="chest-reason">${esc(locLabel(reason))}</span>` : ''}${picked}`;
    }
    const hintTerm = modal.querySelector('.hint .term');
    if (hintTerm) {
      hintTerm.textContent = Array.from({ length: Math.min(5, slots) }, (_, i) => String(i + 1)).join(' / ');
      hintTerm.dataset.explainTitle = localText('БЫСТРЫЙ ВЫБОР', 'QUICK PICK');
      hintTerm.dataset.explain = localText('Клавиши выбирают слот сундука.', 'Number keys pick a chest slot.');
    }
  }

  // ------------------------------------------------- WPN chest modal
  openWeaponChest(choices = [], meta = {}) {
    meta = this.normalizeChestPickMeta(meta, choices);
    this.weapon = { open: true, choices, locked: false, meta, expires: Math.max(0, Number(meta.expires || 0)), total: Math.max(1, Number(meta.total || meta.expires || 30)) };
    this.setChestOfferHeader('weapon', choices, meta);
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
      const mirror = this.mirrorMetaForChoice(opt.id || opt.upgrade || opt.weapon || opt.label, opt, 'weapon');
      const mirrorTag = mirror ? `<span class="wpn-tag mirror ${mirror.works ? 'works' : 'unique'}">${esc(mirror.label)}</span>` : '';
      const roleName = weaponRoleLabel(meta.role);
      const roleTag = `<span class="wpn-role ${meta.tone || 'utility'}">${esc(roleName)}</span>`;
      d.innerHTML = `
        <div class="wpn-choice-top"><span><span class="key">[${i + 1}]</span>${esc(locLabel(opt.label || opt.id))}</span><span class="wpn-tags">${roleTag}${elementTag}${mirrorTag}</span>${locked}</div>
        <span class="wpn-choice-read">${esc(meta.summary)}</span>
        <span class="wpn-choice-change">${esc(meta.change)}</span>`;
      const title = opt.disabled ? `${locLabel(opt.label || opt.id)} / ${t('unavailable').toUpperCase()}` : `${locLabel(opt.label || opt.id)} · ${roleName}`;
      const body = `${optionDesc(opt)}${meta.change ? `\n${meta.change}.` : ''}${mirror ? '\n\n' + (mirror.works ? localText('ЗЕРКАЛО: выбор будет скопирован.', 'MIRROR: this choice will be copied.') : localText('ЗЕРКАЛО: уникальный выбор, копии не будет.', 'MIRROR: unique choice, no copy.')) : ''}${opt.disabled ? `\n\n${t('unavailable')}: ${disabledReason(opt.disabledReason)}.` : ''}`;
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
  closeWeaponChest() { this.weapon.open = false; this.weapon.locked = false; $('weapon-modal').classList.add('hidden'); $('weapon-choice-timer')?.classList.add('hidden'); this.hideTip(); }

  // ------------------------------------------------- ABL chest modal
  openAbilityChest(choices = [], meta = {}) {
    meta = this.normalizeChestPickMeta(meta, choices);
    this.ability = { open: true, choices, locked: false, meta, expires: Math.max(0, Number(meta.expires || 0)), total: Math.max(1, Number(meta.total || meta.expires || 30)) };
    this.setChestOfferHeader('ability', choices, meta);
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
      const mirror = this.mirrorMetaForChoice(opt.id || opt.upgrade || opt.core || opt.label, opt, 'ability');
      const mirrorTag = mirror ? `<span class="abl-role mirror ${mirror.works ? 'works' : 'unique'}">${esc(mirror.label)}</span>` : '';
      const action = opt.actionLabel ? `<div class="abl-action">${esc(locAction(opt.actionLabel))}</div>` : '';
      d.innerHTML = `
        <div class="abl-card-top">
          <span class="key abl-key">[${i + 1}]</span>
          <div class="abl-title-wrap">
            <div class="abl-name">${esc(locLabel(opt.label || opt.id))}</div>
            ${action}
          </div>
          <div class="abl-tags"><span class="rarity-tag">${esc(String(groupLabel).toUpperCase())}</span>${role}${mirrorTag}${locked}</div>
        </div>`;
      const title = opt.disabled ? `${locLabel(opt.label || opt.id)} / ${t('unavailable').toUpperCase()}` : `${locLabel(opt.label || opt.id)} / ${String(groupLabel).toUpperCase()}`;
      const mirrorHint = mirror ? (mirror.works ? localText('ЗЕРКАЛО: выбор будет скопирован.', 'MIRROR: this choice will be copied.') : localText('ЗЕРКАЛО: уникальный выбор, копии не будет.', 'MIRROR: unique choice, no copy.')) : '';
      const body = `${optionDesc(opt)}${mirrorHint ? '\n\n' + mirrorHint : ''}${opt.disabled ? `\n\n${t('unavailable')}: ${disabledReason(opt.disabledReason)}.` : ''}`;
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
  closeAbilityChest() { this.ability.open = false; this.ability.locked = false; $('ability-modal').classList.add('hidden'); $('ability-choice-timer')?.classList.add('hidden'); this.hideTip(); }


  // ------------------------------------------------- РЕД chest modal
  openRareChest(choices = [], meta = {}) {
    this.rare = { open: true, choices, locked: false, meta };
    this.ability.open = false;
    this.setChestOfferHeader('rare', choices, meta);
    const box = $('ability-choices');
    box.innerHTML = '';
    choices.forEach((opt, i) => {
      const d = document.createElement('div');
      const tier = Math.max(1, Number(opt.tier || 1) | 0);
      const tone = opt.disabled ? 'red' : (opt.tone || (opt.cursed ? 'red' : tier >= 2 ? 'purple' : 'gold'));
      d.className = `choice ability-choice ability-card rare-choice tone-${tone} rarity-rare` + (opt.disabled ? ' disabled' : '');
      const locked = opt.disabled ? `<span class="lock">${esc(disabledReason(opt.disabledReason))}</span>` : '';
      const bonus = Math.max(0, Number(meta.bonusGld || 0) | 0);
      const bonusLine = bonus > 0 ? `<div class="abl-action">${esc(localText('БОНУС', 'BONUS'))}: +${bonus} GLD</div>` : '';
      d.innerHTML = `
        <div class="abl-card-top">
          <span class="key abl-key">[${i + 1}]</span>
          <div class="abl-title-wrap">
            <div class="abl-name">${esc(locLabel(opt.label || opt.id))}</div>
            ${bonusLine}
          </div>
          <div class="abl-tags"><span class="rarity-tag">${esc(localText('РЕД', 'RAR'))}</span>${locked}</div>
        </div>`;
      const body = `${optionDesc(opt)}${bonus > 0 ? '\n\n' + localText('Бонус сундука добавится к выбору.', 'Chest bonus is added to the pick.') : ''}${opt.disabled ? `\n\n${t('unavailable')}: ${disabledReason(opt.disabledReason)}.` : ''}`;
      this.setExplain(d, `${locLabel(opt.label || opt.id)} / ${localText('РЕД', 'RAR')}`, body, opt.disabled ? 'red' : tone);
      d.addEventListener('click', () => {
        if (opt.disabled) { this.playUiSound('denied'); return; }
        this.pickRare(i);
      });
      box.appendChild(d);
    });
    $('ability-modal').classList.remove('hidden');
    this.playUiSound('chest_rare');
  }
  pickRare(i) {
    if (this.rare.locked || !this.rare.open) return;
    const opt = this.rare.choices[i];
    if (!opt || opt.disabled) { this.playUiSound('denied'); return; }
    this.rare.locked = true;
    const els = document.querySelectorAll('#ability-choices .choice');
    els.forEach((el, j) => el.classList.add(j === i ? 'picked' : 'dimmed'));
    this.net.sendRarePick(i);
  }
  pickRandomRare() {
    if (!this.rare.open || this.rare.locked || !this.rare.choices.length) return false;
    const valid = this.rare.choices.map((o, i) => ({ o, i })).filter(x => x.o && !x.o.disabled);
    const pool = valid.length ? valid : this.rare.choices.map((o, i) => ({ o, i }));
    this.pickRare(pool[Math.floor(Math.random() * pool.length)].i);
    return true;
  }
  closeRareChest() { this.rare.open = false; this.rare.locked = false; $('ability-modal').classList.add('hidden'); this.hideTip(); }


  casinoStakeProfile(stakeKey = 'low', cost = 0, blood = false, room = null) {
    const unit = blood ? 'HP' : 'GLD';
    const profiles = {
      low: { risk: localText('БАЗОВАЯ', 'BASE'), body: localText('GLD · EXP · HEA', 'GLD · EXP · HEA') },
      mid: { risk: localText('СБОРКА', 'BUILD'), body: localText('WPN · ABL · РЕД · ФИКС', 'WPN · ABL · RAR · LOCK') },
      high: { risk: localText('ПРЕМИУМ', 'PREMIUM'), body: localText('WPN · ABL · РЕД · ДЖК', 'WPN · ABL · RAR · JCK') }
    };
    const prof = profiles[stakeKey] || profiles.low;
    return { unit, risk: prof.risk, body: prof.body, text: `${cost} ${unit}` };
  }

  casinoOutcomeInfo(outcome = '', payload = {}) {
    const rawOutcome = String(outcome || '').toUpperCase();
    const o = ({ JCK: 'ДЖК', RAR: 'РЕД', LOCK: 'ФИКС' })[rawOutcome] || rawOutcome;
    const map = {
      ДЖК: [localText('ДЖЕКПОТ', 'JACKPOT'), '', 'gold'],
      GLD: ['GLD', '', 'green'],
      EXP: ['EXP', '', 'cyan'],
      HEA: ['HEA', '', 'green'],
      WPN: ['WPN', '', 'cyan'],
      ABL: ['ABL', '', 'cyan'],
      РЕД: [localText('РЕД', 'RAR'), '', 'gold'],
      SKN: ['SKN', '', 'gold'],
      ФИКС: [localText('ФИКС', 'LOCK'), '', 'cyan'],
      PAIR: [localText('ПАРА', 'PAIR'), '', 'gold'],
      MIX: [localText('ПРИЗ', 'REWARD'), '', 'green'],
      STC: [localText('СТАТИК-ДОЛГ', 'STATIC DEBT'), '', 'purple'],
      OVERLOAD: [localText('ПЕРЕГРЕВ', 'OVERHEAT'), '', 'red'],
      LOSE: [localText('ПРОИГРЫШ', 'LOSS'), '', 'red']
    };
    const [title, body, tone] = map[o] || [locLabel(o || 'BET'), '', 'green'];
    return { title, body, tone };
  }

  casinoSymbolInfo(symbol = '') {
    const raw = String(symbol || '').toUpperCase();
    const x = ({ JCK: 'ДЖК', RAR: 'РЕД', LOCK: 'ФИКС' })[raw] || raw;
    const map = {
      GLD: [localText('GLD', 'GLD'), localText('Деньги.', 'Money.'), 'green'],
      EXP: [localText('EXP', 'EXP'), localText('Опыт.', 'Experience.'), 'cyan'],
      HEA: [localText('HEA', 'HEA'), localText('Лечение.', 'Heal.'), 'green'],
      WPN: [localText('WPN', 'WPN'), localText('Оружейный приз.', 'Weapon prize.'), 'cyan'],
      ABL: [localText('ABL', 'ABL'), localText('Приз способности.', 'Ability prize.'), 'cyan'],
      РЕД: [localText('РЕД', 'RAR'), localText('Редкий приз.', 'Rare prize.'), 'gold'],
      SKN: [localText('SKN', 'SKN'), localText('Облик.', 'Skin.'), 'gold'],
      ДЖК: [localText('ДЖК', 'JCK'), localText('Джекпот.', 'Jackpot.'), 'gold'],
      STC: [localText('STC', 'STC'), localText('Статик-долг.', 'Static debt.'), 'purple'],
      BAD: [localText('BAD', 'BAD'), localText('Пустой / проигрышный блок.', 'Empty / losing block.'), 'red'],
      ФИКС: [localText('ФИКС', 'LOCK'), localText('Сохраняет символ до выхода. Два и больше ФИКСА ломают терминал на 10-й прокрутке.', 'Holds the symbol until exit. Two or more LOCKS break the terminal on the 10th spin.'), 'cyan'],
      NEXT: [localText('NEXT', 'NEXT'), localText('Следующая ставка.', 'Next bet.'), 'cyan'],
      COMBO: [localText('COMBO', 'COMBO'), localText('Комбо-награда.', 'Combo reward.'), 'purple']
    };
    const [title, body, tone] = map[x] || [locLabel(x || 'BET'), localText('Значение ставки.', 'Bet value.'), ''];
    return { title, body, tone };
  }

  clearExplain(el) {
    if (!el) return;
    delete el.dataset.explainTitle;
    delete el.dataset.explain;
    delete el.dataset.explainTone;
  }

  updateCasinoLockBadge(symbol = '', used = false) {
    // v2.1.81: the separate right-side ФИКС badge was removed.
    // ФИКС is now represented directly inside the casino cells.
    const el = $('casino-lock-badge');
    if (!el) return;
    el.classList.add('hidden');
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '';
    this.clearExplain(el);
  }

  paintStoredCasinoLockCells(force = false) {
    const reels = [...document.querySelectorAll('.reel')];
    const locks = casinoNormalizeSlotLocks(this.casinoSlotLocks || []);
    reels.forEach((r, i) => {
      if (!r) return;
      const s = locks[i] || '';
      if (!s) {
        r.classList.remove('lock-ready');
        if (force) { r.textContent = '—'; r.className = 'reel'; delete r.dataset.final; this.clearExplain(r); }
        return;
      }
      r.textContent = casinoDisplaySymbol(s);
      r.dataset.final = s;
      r.className = `reel locked lock-ready ${casinoCellClass(s)}`.trim();
      this.clearExplain(r);
    });
  }

  paintStoredCasinoLockCell(symbol = '', force = false) {
    // Legacy caller compatibility: v2.1.82 uses per-slot locks instead.
    if (symbol && !this.casinoSlotLocks?.some(Boolean)) this.casinoSlotLocks = [String(symbol).toUpperCase(), '', ''];
    this.paintStoredCasinoLockCells(force);
  }

  setCasinoPanelState(state = 'ready', tone = '') {
    const el = $('casino-state');
    if (!el) return;
    el.className = `casino-state ${tone || ''}`.trim();
    el.textContent = state;
  }

  casinoLuckInfo(luckRaw = 0) {
    const luck = Math.max(0, Number(luckRaw || 0) || 0);
    const pct = (v) => (Math.round(v * 10) / 10).toFixed(1).replace('.0', '');
    return {
      luck,
      useful: pct(luck * 4.4),
      jackpot: pct(luck * 0.32),
      weapon: pct(luck * 0.55),
      rare: pct(luck * 0.45),
      lock: pct(luck * 0.42)
    };
  }

  updateCasinoLuckCard(me = null) {
    const card = $('casino-luck-card');
    if (!card) return;
    const luck = me ? Number(me[P.LUCK] || 0) : Number(this.latestMe?.[P.LUCK] || 0);
    const info = this.casinoLuckInfo(luck);
    card.innerHTML = `
      <div class="casino-luck-title">${esc(localText('УДАЧА В КАЗИНО', 'CASINO LUCK'))}</div>
      <div class="casino-luck-value">${esc(localText('УДАЧА', 'LUCK'))} +${Math.round(info.luck)}</div>
      <div class="casino-luck-row"><b>${esc(localText('ДЖЕКПОТ', 'JACKPOT'))}</b><span>+${info.jackpot}%</span></div>
      <div class="casino-luck-row"><b>${esc(localText('ОРУЖИЕ', 'WEAPON'))}</b><span>+${info.weapon}%</span></div>
      <div class="casino-luck-row"><b>${esc(localText('РЕДКИЙ', 'RARE'))}</b><span>+${info.rare}%</span></div>
      <div class="casino-luck-row"><b>${esc(localText('ФИКСАЦИЯ', 'LOCK'))}</b><span>+${info.lock}%</span></div>
      <div class="casino-luck-note">${esc(localText(`Каждая удача усиливает ценные символы и снижает шанс сбоя.`, `Each luck point raises valuable symbols and lowers blank outcomes.`))}</div>
    `;
    this.positionCasinoLuckCard();
  }

  positionCasinoLuckCard() {
    const modal = $('casino-modal');
    const card = $('casino-luck-card');
    const panel = modal?.querySelector('.panel');
    if (!modal || modal.classList.contains('hidden') || !card || !panel) return;
    const r = panel.getBoundingClientRect();
    const gap = 14;
    const w = Math.max(220, Math.min(276, card.offsetWidth || 250));
    let left = r.right + gap;
    if (left + w > window.innerWidth - 12) left = Math.max(12, r.left - w - gap);
    card.style.left = `${Math.round(left)}px`;
    card.style.top = `${Math.round(r.top)}px`;
  }

  updateCasinoHelpLanguage() {
    const ru = localText('ru', 'en') === 'ru';
    document.querySelectorAll('#casino-help [data-ru]').forEach(el => { el.textContent = ru ? el.dataset.ru : (el.dataset.en || el.textContent); });
  }

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
    const modal = $('casino-modal');
    modal.classList.remove('hidden', 'bet-protocolning', 'bet-win', 'bet-lose', 'bet-debt', 'bet-jackpot');
    this.setCasinoPanelState(localText('ГОТОВ К СТАВКЕ', 'READY'), '');
    this.updateCasinoHelpLanguage();
    this.casinoLockSpinSymbol = '';
    this.updateCasinoLockBadge('');
    this.updateCasinoLuckCard(this.latestMe);
    const res = $('casino-result');
    res.innerHTML = `<span class="casino-result-title">${esc(localText('ВЫБЕРИ СТАВКУ', 'CHOOSE BET'))}</span>`;
    res.style.color = '';
    document.querySelectorAll('.reel').forEach(r => { r.textContent = '—'; r.className = 'reel'; delete r.dataset.final; this.clearExplain(r); });
    this.paintStoredCasinoLockCells(true);
  }
  closeCasino() {
    this.clearReels();
    this.casino.open = false;
    this.casino.spinning = false;
    this.setCasinoButtons(false);
    const modal = $('casino-modal');
    modal.classList.add('hidden');
    modal.classList.remove('bet-protocolning', 'bet-win', 'bet-lose', 'bet-debt', 'bet-jackpot');
    this.casinoLockSpinSymbol = '';
    this.casinoSlotLocks = ['', '', ''];
    try { this.net?.sendCasinoClose?.(); } catch {}
    this.updateCasinoLockBadge('');
    this.hideTip();
  }
  placeBet(stake) {
    if (this.casino.spinning || !this.casino.open) return;
    this.clearReels();
    this.casino.spinning = true;
    this.setCasinoButtons(true);
    const token = ++this.casino.spinToken;
    const modal = $('casino-modal');
    modal.classList.remove('bet-win', 'bet-lose', 'bet-debt', 'bet-jackpot');
    modal.classList.add('bet-protocolning');
    this.setCasinoPanelState(localText('СТАВКА', 'BET'), stake === 'high' ? 'red' : stake === 'mid' ? 'gold' : 'green');
    this.casinoLockSpinSymbol = this.casinoLockSymbol;
    this.updateCasinoLockBadge('');
    this.updateCasinoLuckCard(this.latestMe);
    const res = $('casino-result');
    res.innerHTML = `<span class="casino-result-title">${esc(localText('...', '...'))}</span>`;
    res.style.color = '';
    const syms = ['GLD', 'HEA', 'EXP', 'WPN', 'ABL', 'SKN', 'STC', 'ДЖК', 'ФИКС', 'РЕД', 'BAD'];
    const locks = casinoNormalizeSlotLocks(this.casinoSlotLocks || []);
    document.querySelectorAll('.reel').forEach((r, i) => {
      if (r._iv) clearInterval(r._iv);
      this.clearExplain(r);
      const fixed = locks[i] || '';
      if (fixed) {
        r.className = `reel locked lock-preview ${casinoCellClass(fixed)}`.trim();
        r.textContent = casinoDisplaySymbol(fixed);
        r.dataset.final = fixed;
        const info = this.casinoSymbolInfo(fixed);
        this.setExplain(r, localText('ФИКС-ЯЧЕЙКА', 'LOCK CELL'), localText(`Слот ${i + 1} зафиксирован до закрытия терминала: ${casinoDisplaySymbol(fixed)}.`, `Slot ${i + 1} is fixed until the terminal closes: ${casinoDisplaySymbol(fixed)}.`), info.tone || 'cyan');
        return;
      }
      r.className = 'reel spin';
      r.textContent = '···';
      r._iv = setInterval(() => { const spin = syms[(Math.floor(Math.random() * syms.length) + i) % syms.length]; r.textContent = casinoDisplaySymbol(spin); if (i === 0) this.playUiSound('casino_spin'); }, 68 + i * 11);
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
    const payload = f?.payload || {};
    const cells = Array.isArray(payload.cellRewards) ? payload.cellRewards : [];
    const bySlot = new Map(cells.map(c => [Number(c.slot || 0) | 0, c]));
    const nextLocks = casinoNormalizeSlotLocks(f?.lockSlots || payload.lockSlots || this.casinoSlotLocks || []);
    if (f) this.casinoSlotLocks = nextLocks;
    const spinSyms = ['GLD', 'HEA', 'EXP', 'WPN', 'ABL', 'SKN', 'STC', 'ДЖК', 'РЕД', 'BAD'];
    const settleCell = (r, sym, c = {}, lockedClass = false) => {
      const finalSymbol = String(sym || '—').toUpperCase();
      r.textContent = casinoDisplaySymbol(finalSymbol);
      r.dataset.final = finalSymbol;
      const info = this.casinoSymbolInfo(finalSymbol);
      this.setExplain(r, info.title, `${info.body} ${c.locked || lockedClass ? localText('Слот зафиксирован до закрытия терминала.', 'Slot is fixed until the terminal closes.') : ''}`.trim(), info.tone);
      const bad = f?.outcome === 'LOSE' || casinoIsBadCell(finalSymbol);
      r.className = `reel locked ${bad ? 'lose' : casinoCellClass(finalSymbol) || 'win'}${(c.locked || lockedClass) ? ' lock-ready' : ''}`.trim();
    };
    reels.forEach((r, i) => {
      const timer = setTimeout(() => {
        if (r._iv) clearInterval(r._iv);
        r._iv = null;
        r.classList.remove('spin', 'lock-preview');
        if (f && f.outcome === 'OVERLOAD') {
          const rawSym = String(f.symbols?.[i] || 'ERR').toUpperCase();
          r.textContent = i === 1 ? 'ERR' : rawSym;
          r.dataset.final = 'ERR';
          r.className = 'reel locked lose slot-overload-break';
          this.setExplain(r, localText('ПЕРЕГРУЗКА', 'OVERLOAD'), localText('Слот-терминал сломался и выпустил угрозу.', 'The slot terminal broke and released a threat.'), 'red');
          this.playUiSound(i === 1 ? 'slot_overload' : 'casino_static');
        } else if (f) {
          const c = bySlot.get(i) || { slot: i, raw: f.symbols?.[i] || '—', symbol: f.symbols?.[i] || '—' };
          const raw = String(c.raw || '').toUpperCase();
          const finalSymbol = String(c.symbol || f.symbols?.[i] || '—').toUpperCase();
          const created = !!c.lockCreated || raw === 'ФИКС';
          if (created) {
            r.textContent = 'ФИКС';
            r.dataset.final = 'ФИКС';
            r.className = 'reel locked lock-vanish win lock-cell';
            this.setExplain(r, 'ФИКС', localText('ФИКС растворяется и превращается в фиксированный слот до закрытия терминала.', 'LOCK dissolves into a fixed slot until the terminal closes.'), 'cyan');
            this.playUiSound('casino_reel_stop');
            const morphSpin = setTimeout(() => {
              r.className = 'reel spin lock-morph';
              let n = 0;
              r._iv = setInterval(() => {
                r.textContent = spinSyms[(n++ + i) % spinSyms.length];
                this.playUiSound('casino_spin');
              }, 48);
            }, 230);
            const morphFinal = setTimeout(() => {
              if (r._iv) clearInterval(r._iv);
              r._iv = null;
              settleCell(r, finalSymbol, c, true);
              this.playUiSound('casino_reel_stop');
            }, 610);
            this.casino.reelTimers.push(morphSpin, morphFinal);
          } else {
            settleCell(r, finalSymbol, c, !!nextLocks[i]);
            this.playUiSound('casino_reel_stop');
          }
        } else {
          r.textContent = '—';
          this.clearExplain(r);
          r.className = 'reel locked lose';
          this.playUiSound('casino_reel_stop');
        }
        if (i === 2) {
          const done = setTimeout(() => {
            this.casino.spinning = false;
            this.setCasinoButtons(false);
            this.setCasinoPanelState(localText('ИТОГ', 'RESULT'), f?.outcome === 'LOSE' ? 'red' : f?.outcome === 'STC' ? 'purple' : f?.outcome === 'ДЖК' ? 'gold' : 'green');
          }, 620);
          this.casino.reelTimers.push(done);
        }
      }, 150 * (i + 1));
      this.casino.reelTimers.push(timer);
    });
  }
  casinoDenied(f) {
    if (!this.casino.open) this.openCasino();
    this.playUiSound('denied');
    this.clearReels();
    this.casino.spinning = false;
    this.setCasinoButtons(false);
    $('casino-modal').classList.remove('bet-protocolning', 'bet-win', 'bet-debt', 'bet-jackpot');
    $('casino-modal').classList.add('bet-lose');
    this.setCasinoPanelState(localText('ОТКАЗ', 'DENIED'), 'red');
    document.querySelectorAll('.reel').forEach(r => { r.textContent = localText('ОТК', 'NO'); r.className = 'reel lose locked'; });
    const el = $('casino-result');
    const errors = { 'BET FAILED': t('betFailed'), 'not enough GLD': t('gldLack'), 'НЕДОСТАТОЧНО GLD': t('gldLack'), 'НЕДОСТАТОЧНО HP': localText('НЕТ HP', 'NO HP'), 'not enough HP': localText('НЕТ HP', 'NO HP'), 'invalid stake': t('invalidStake') };
    const msg = errors[f.error] || f.error || t('betFailed');
    el.textContent = msg;
    el.style.color = '#ff3048';
    this.feed(`${localText('BET ОТКАЗАН', 'BET DENIED')} · ${msg}`, 'r');
  }
  casinoPrizeLineForResult(f, pl, paid, paidUnit, abilityLabels = [], weaponLabels = [], rareLabels = []) {
    const clean = (x) => locLabel(String(x || '').replace(/^CASINO\s+/i, '').trim());
    const weaponDetail = (x) => {
      const raw = String(x || '').trim();
      const damagePct = raw.match(/(?:DMG|DAMAGE|УРОН)[^+]*\+(\d+(?:\.\d+)?)%/i)?.[1];
      if (damagePct) return localText(`урон оружия +${damagePct}%`, `weapon damage +${damagePct}%`);
      return clean(raw.replace(/^WPN\s+(?:PAIR|TRIPLE):\s*/i, '')) || localText('оружейное улучшение применено', 'weapon upgrade applied');
    };
    const abilityDetail = (x) => clean(x) || localText('новая мутация добавлена', 'new mutation added');
    const rareDetail = (x) => clean(x) || localText('редкое усиление применено', 'rare bonus applied');
    if (f.outcome === 'OVERLOAD') return localText('слот сломан, угрозу собирается', 'slot broken, enemy assembling');
    if (pl.static || pl.staticCount) return `${localText('следующая сектор загрязнена статикой', 'next room gets static debt')}${pl.staticCount > 1 ? ' x' + pl.staticCount : ''}`;
    if (pl.lockLabel) return `${localText('зафиксировано', 'fixed')} ${pl.lockLabel}`;
    if (weaponLabels.length) return weaponLabels.map(weaponDetail).filter(Boolean).join(' + ');
    if (abilityLabels.length) return abilityDetail(abilityLabels[0]);
    if (rareLabels.length) return rareDetail(rareLabels[0]);
    if (pl.skinLabel) return `${pl.skinLabel}${pl.skinRarity ? ' / ' + rarityText(pl.skinRarity) : ''}`;
    if (pl.gld) return `+${pl.gld} GLD`;
    if (pl.xp) return `+${pl.xp} EXP`;
    if (pl.heal) return `+${pl.heal} HP`;
    if (pl.dash) return locLabel('DASH +1');
    return `-${paid} ${paidUnit}`;
  }
  casinoDetailSummary(f, pl, paid, paidUnit, abilityLabels = [], weaponLabels = [], rareLabels = []) {
    const list = [];
    const add = (x) => { const s = locLabel(String(x || '').trim()); if (s && !list.includes(s)) list.push(s); };
    if (f.outcome === 'OVERLOAD') add(localText('перегрузка закрыла терминал и вызвала SLOT MOB', 'overload closed the terminal and spawned SLOT MOB'));
    if (pl.lockLabel) add(`${localText('фикс', 'fixed')}: ${pl.lockLabel}`);
    if (pl.gld) add(`+${pl.gld} GLD`);
    if (pl.xp) add(`+${pl.xp} EXP`);
    if (pl.heal) add(`+${pl.heal} HP`);
    if (pl.dash) add('DASH +1');
    for (const x of weaponLabels) add(this.casinoPrizeLineForResult({ outcome: 'WPN' }, {}, paid, paidUnit, [], [x], []));
    for (const x of abilityLabels) add(this.casinoPrizeLineForResult({ outcome: 'ABL' }, {}, paid, paidUnit, [x], [], []));
    for (const x of rareLabels) add(this.casinoPrizeLineForResult({ outcome: 'РЕД' }, {}, paid, paidUnit, [], [], [x]));
    if (pl.skinLabel) add(`${pl.skinLabel}${pl.skinRarity ? ' / ' + rarityText(pl.skinRarity) : ''}`);
    if (pl.static || pl.staticCount) add(`${localText('статик-долг', 'static debt')}${pl.staticCount > 1 ? ' x' + pl.staticCount : ''}`);
    if (pl.tripleMatch) add(`${localText('три одинаковых', 'three of a kind')}: ${String(pl.paySymbol || '').toUpperCase()}`);
    else if (pl.pairMatch) add(`${localText('пара', 'pair')}: ${String(pl.paySymbol || '').toUpperCase()}`);
    if (pl.noMatch && !pl.lockLabel && f.outcome !== 'OVERLOAD') add(localText('линия не собрана', 'no line'));
    add(`-${paid} ${paidUnit}`);
    return list.slice(0, 8);
  }

  casinoResult(f, myId) {
    if (f.ok === false) { this.casinoDenied(f); return; }
    if (f.id !== myId) {
      const RES = { ДЖК: localText(t('jackpot'), 'JACKPOT'), JCK: localText(t('jackpot'), 'JACKPOT'), PAIR: localText('ПАРА', 'PAIR'), LOSE: t('lose'), STC: t('staticDebt'), SKN: t('skin'), ФИКС: localText('ФИКС', 'LOCK'), РЕД: localText('РЕД', 'RARE'), OVERLOAD: localText('ПЕРЕГРУЗКА', 'OVERLOAD') };
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
      const abilityLabels = Array.isArray(pl.abilityLabels) && pl.abilityLabels.length ? pl.abilityLabels : (pl.abilityLabel ? [pl.abilityLabel] : []);
      const weaponLabels = Array.isArray(pl.weaponLabels) && pl.weaponLabels.length ? pl.weaponLabels : (pl.weaponLabel ? [pl.weaponLabel] : []);
      const rareLabels = Array.isArray(pl.rareLabels) && pl.rareLabels.length ? pl.rareLabels : (pl.rareLabel ? [pl.rareLabel] : []);
      const parts = this.casinoDetailSummary(f, pl, paid, paidUnit, abilityLabels, weaponLabels, rareLabels);
      const info = this.casinoOutcomeInfo(f.outcome, pl);
      const modal = $('casino-modal');
      modal.classList.remove('bet-protocolning', 'bet-win', 'bet-lose', 'bet-debt', 'bet-jackpot');
      modal.classList.add((f.outcome === 'ДЖК' || f.outcome === 'JCK') ? 'bet-jackpot' : (f.outcome === 'LOSE' || f.outcome === 'OVERLOAD') ? 'bet-lose' : f.outcome === 'STC' ? 'bet-debt' : 'bet-win');
      this.setCasinoPanelState(info.title, info.tone);
      const toneCls = info.tone ? ` ${info.tone}` : '';
      const resultLine = this.casinoPrizeLineForResult(f, pl, paid, paidUnit, abilityLabels, weaponLabels, rareLabels);
      const detailParts = parts.map(locLabel).filter(x => {
        const sx = String(x || '').trim();
        if (!sx || sx === info.title || sx === resultLine) return false;
        return true;
      }).slice(0, 5);
      const fullResultText = `${info.title}: ${resultLine}${detailParts.length ? ' · ' + detailParts.join(' · ') : ''}`;
      el.title = fullResultText;
      this.setExplain(el, info.title, fullResultText, info.tone);
      el.innerHTML = `<span class="casino-result-title${toneCls}">${esc(info.title)}</span><span class="casino-result-flow compact" title="${esc(fullResultText)}"><b>${esc(resultLine)}</b></span>`;
      const who = f.id === myId ? t('you') : (this.names.get(f.id) || '??');
      this.feed(`${who}: ${localText('BET', 'BET')} · ${parts.map(locLabel).join(' · ')}`, (f.outcome === 'LOSE' || f.outcome === 'OVERLOAD') ? 'r' : f.outcome === 'STC' ? 'p' : 'g');
      el.style.color = (f.outcome === 'LOSE' || f.outcome === 'OVERLOAD') ? '#ff3048' : f.outcome === 'STC' ? '#b45cff' : '#00ff66';
      this.casinoSlotLocks = casinoNormalizeSlotLocks(f.lockSlots || pl.lockSlots || this.casinoSlotLocks || []);
      this.paintStoredCasinoLockCells(false);
      this.casinoLockSpinSymbol = '';
      this.updateCasinoLockBadge('');
      const positive = (pl.gld || pl.xp || pl.heal || pl.weapon || pl.ability || pl.rare || pl.skin || pl.jackpotCount);
      this.playUiSound(f.outcome === 'OVERLOAD' ? 'slot_overload' : ((pl.jackpotCount || 0) >= 3 || f.outcome === 'ДЖК' || f.outcome === 'JCK' ? 'jackpot' : (!positive && (f.outcome === 'LOSE' || pl.missCount)) ? 'casino_lose' : (!positive && (f.outcome === 'STC' || pl.static)) ? 'casino_static' : (pl.weapon ? 'casino_weapon' : (pl.ability || pl.skin || pl.rare ? 'casino_ability' : 'casino_win'))));
      if (f.outcome === 'OVERLOAD') {
        const closeTimer = setTimeout(() => {
          if (resultToken === this.casino.spinToken) {
            this.playUiSound('slot_overload');
            this.playUiSound('casino_static');
            this.closeCasino();
          }
        }, 980);
        this.casino.reelTimers.push(closeTimer);
      }
    }, 640);
    this.casino.reelTimers.push(timer);
  }

}
