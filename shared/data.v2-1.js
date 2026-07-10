// terminal casino roguelike content data: weapons, enemies, upgrades, chests, casino, modifiers

export const WEAPONS = {
  shotgun: {
    id: 'shotgun', label: 'SHG', name: 'КЛИНОВОЙ РАЗРЯД',
    cooldown: 0.035, charges: 4, chargeRegen: 0.8, pellets: 6, spread: 0.42, dmg: 8, speed: 700, life: 0.42, size: 5, knock: 82
  },
  seeker: {
    id: 'seeker', label: 'SEK', name: 'ИСКАТЕЛЬ',
    cooldown: 0.72, pellets: 1, spread: 0.025, dmg: 20, speed: 340, life: 1.55, maxDist: 620, size: 4, homing: 4.6, knock: 36
  },
  rocketgun: {
    id: 'rocketgun', label: 'RKT', name: 'РАЗЛОМНЫЙ ЗАРЯД',
    cooldown: 1.38, pellets: 1, spread: 0.012, dmg: 124, speed: 455, life: 2.05, size: 7, aoe: 104, knock: 230, detonateDist: 620
  },
  living_casino: {
    id: 'living_casino', label: 'LVC', name: 'ЖИВОЕ КАЗИНО',
    cooldown: 0.45, pellets: 0, spread: 0, dmg: 0, speed: 0, life: 0, size: 0
  },
  control_sparks: {
    id: 'control_sparks', label: 'SPK', name: 'ИСКРЫ КОНТРОЛЯ',
    cooldown: 0, pellets: 0, spread: 0, dmg: 0, speed: 0, life: 0, size: 0
  },
  roulette: {
    id: 'roulette', label: 'RLT', name: 'РУЛЕТКА',
    cooldown: 1.08, pellets: 1, spread: 0.004, dmg: 39, speed: 335, life: 1.50, maxDist: 653, size: 22, knock: 210, bounces: 0
  },
  deck: {
    id: 'deck', label: 'CRD', name: 'КОЛОДА',
    cooldown: 0.48, pellets: 2, spread: 0.30, dmg: 13, speed: 690, life: 0.41, maxDist: 305, size: 4, knock: 28, bounces: 0
  },
  command_pulse: {
    id: 'command_pulse', label: 'CMD', name: 'КОМАНДА ЗАХВАТА',
    cooldown: 6.00, pellets: 0, spread: 0, dmg: 0, speed: 0, life: 0, maxDist: 520, size: 0, knock: 0, control: 1, protocol: 1
  },
  quarantine_anchor: {
    id: 'quarantine_anchor', label: 'QRN', name: 'КАРАНТИННЫЙ ЯКОРЬ',
    cooldown: 8.00, pellets: 0, spread: 0, dmg: 0, speed: 0, life: 0, maxDist: 680, size: 0, knock: 0, quarantine: 1, protocol: 1
  },
  process_saw: {
    id: 'process_saw', label: 'SAW', name: 'РАЗБОР ПРОЦЕССА',
    cooldown: 12.00, pellets: 0, spread: 0, dmg: 0, speed: 0, life: 0, maxDist: 560, size: 0, knock: 0, control: 1, protocol: 1
  }
};
export const WEAPON_ORDER = ['shotgun', 'seeker', 'rocketgun', 'living_casino', 'control_sparks', 'roulette', 'deck'];

// ---- enemies ------------------------------------------------------------
// kinds communicate mechanics: silhouette + behavior contract
export const ENEMIES = {
  grunt:    { label: 'GRT', hp: 26,   spd: 115, size: 24, dmg: 10, touch: true,  xp: 6,  gld: 4,  score: 1, role: 'swarm body', combo: 'swarm pressure' },
  runner:   { label: 'RUN', hp: 16,   spd: 215, size: 18, dmg: 8,  touch: true,  xp: 7,  gld: 4,  score: 1, role: 'fast pressure', combo: 'fast pressure' },
  tank:     { label: 'TNK', hp: 120,  spd: 55,  size: 42, dmg: 18, touch: true,  xp: 18, gld: 12, score: 3, armor: 0.35, role: 'front wall', combo: 'front pressure' },
  shooter:  { label: 'SHT', hp: 30,   spd: 80,  size: 24, dmg: 9,  ranged: true, fireCd: 1.4, bulletSpd: 260, keep: 320, xp: 10, gld: 7, score: 2, role: 'ranged guard', combo: 'ranged pressure' },
  charger:  { label: 'CHG', hp: 44,   spd: 75,  size: 28, dmg: 22, charges: true, windup: 0.75, chargeSpd: 520, chargeTime: 0.55, chargeCd: 2.4, xp: 12, gld: 8, score: 2, role: 'line breaker', combo: 'line pressure' },
  bomber:   { label: 'BMB', hp: 22,   spd: 130, size: 22, dmg: 30, bombs: true, fuse: 0.9, blast: 95, xp: 10, gld: 7, score: 2, role: 'space breaker', combo: 'space pressure' },
  bouncer:  { label: 'BNC', hp: 38,   spd: 240, size: 26, dmg: 12, bounces: true, push: 260, xp: 14, gld: 9, score: 2, role: 'pinball displacement', combo: 'movement pressure' },
  glitch:   { label: 'GLT', hp: 34,   spd: 70,  size: 24, dmg: 16, blinks: true, blinkCd: 2.2, blinkRange: 230, strikeCd: 0.5, xp: 14, gld: 10, score: 2, role: 'backline disruptor', combo: 'ambush pressure' },
  slot_mob: { label: 'SLT', hp: 6120, spd: 200, size: 44, dmg: 15, slotMob: true, touch: true, fireCd: 1.25, bulletSpd: 281, xp: 26, gld: 32, score: 5, role: 'casino overload process', combo: 'slot corruption' },

  // anomaly pack
  echo:     { label: 'ECH', hp: 48,   spd: 145, size: 26, dmg: 12, echo: true, mirrorFireCd: 1.15, xp: 18, gld: 12, score: 3, role: 'weapon mimic', combo: 'mirror pressure' },
  orbiter:  { label: 'ORB', hp: 70,   spd: 120, size: 28, dmg: 14, orbiter: true, orbitR: 150, fireCd: 1.9, bulletSpd: 240, shield: 0.65, xp: 20, gld: 14, score: 3, role: 'mobile guard', combo: 'guard pressure' },
  anchor:   { label: 'ANC', hp: 150,  spd: 34,  size: 46, dmg: 8,  anchor: true, fieldR: 250, pull: 80, xp: 26, gld: 18, score: 4, armor: 0.20, role: 'control core', combo: 'pull pressure' },
  splitter: { label: 'SPL', hp: 90,   spd: 92,  size: 38, dmg: 13, splitter: true, splits: 2, xp: 20, gld: 12, score: 3, role: 'swarm seed', combo: 'flood pressure' },
  prism:    { label: 'PRS', hp: 56,   spd: 60,  size: 30, dmg: 12, prism: true, fireCd: 2.2, beamSpd: 310, xp: 18, gld: 13, score: 3, role: 'crossfire lane', combo: 'lane pressure' },
  pulse:    { label: 'PLS', hp: 62,   spd: 78,  size: 32, dmg: 16, pulse: true, fireCd: 2.3, waveSpd: 360, xp: 18, gld: 13, score: 3, role: 'wave pressure', combo: 'wave pressure' },
  leech:    { label: 'LCH', hp: 52,   spd: 105, size: 26, dmg: 9,  leech: true, healCd: 1.0, heal: 16, linkR: 360, xp: 22, gld: 14, score: 3, role: 'sustain support', combo: 'healing pressure' },
  warden:   { label: 'WRD', hp: 96,   spd: 68,  size: 36, dmg: 11, armorWarden: true, linkR: 380, xp: 28, gld: 18, score: 4, armor: 0.38, shellMul: 0.55, role: 'armor coordinator', combo: 'armor pressure' },
  damper:   { label: 'DMP', hp: 118,  spd: 38,  size: 44, dmg: 0,  damper: true, fieldR: 280, bulletDamp: 0.018, stopSpd: 42, xp: 30, gld: 18, score: 4, role: 'mobile bullet-safe nest', combo: 'safe-zone pressure' },
  herald:   { label: 'HRD', hp: 180,  spd: 52,  size: 48, dmg: 12, herald: true, summonCd: 4.2, tetherDmg: 3, xp: 36, gld: 28, score: 5, armor: 0.18, role: 'summon director', combo: 'summon pressure' },

  boss:     { label: 'BOS', hp: 1300, spd: 60,  size: 72, dmg: 26, boss: true, armor: 0.25, fireCd: 2.6, bulletSpd: 230, xp: 140, gld: 120, score: 20 },

  // boss rotation v2.1.19
  boss_croupier: { label: 'CRP', hp: 1207, spd: 52, size: 78, dmg: 24, boss: true, armor: 0.24, fireCd: 2.35, bulletSpd: 245, xp: 150, gld: 132, score: 22, bossRole: 'casino rules' },
  boss_anchor_cashier: { label: 'ANC+', hp: 1520, spd: 42, size: 82, dmg: 25, boss: true, armor: 0.30, fireCd: 2.60, bulletSpd: 215, fieldR: 430, pull: 190, xp: 154, gld: 136, score: 23, bossRole: 'gravity control' },
  boss_hunter_chorus: { label: 'HNT', hp: 1360, spd: 74, size: 74, dmg: 24, boss: true, armor: 0.20, fireCd: 2.15, bulletSpd: 270, xp: 152, gld: 128, score: 22, bossRole: 'hunter shell' },
  boss_hunter_duelist: { label: 'HNT-I', hp: 520, spd: 92, size: 54, dmg: 20, boss: true, bossFragment: true, armor: 0.12, fireCd: 1.65, bulletSpd: 245, xp: 58, gld: 50, score: 9, bossRole: 'hunter fragment' },
  boss_hunter_marksman: { label: 'HNT-II', hp: 460, spd: 64, size: 50, dmg: 18, boss: true, bossFragment: true, armor: 0.10, fireCd: 1.45, bulletSpd: 300, xp: 54, gld: 48, score: 9, bossRole: 'hunter fragment' },
  boss_hunter_trapper: { label: 'HNT-III', hp: 480, spd: 72, size: 52, dmg: 18, boss: true, bossFragment: true, armor: 0.10, fireCd: 2.05, bulletSpd: 235, xp: 56, gld: 48, score: 9, bossRole: 'hunter fragment' },
  boss_q_revisor: { label: 'RUSH', hp: 1460, spd: 68, size: 76, dmg: 25, boss: true, armor: 0.23, fireCd: 1.90, bulletSpd: 245, windup: 0.48, chargeSpd: 720, chargeTime: 0.52, chargeCd: 1.05, xp: 156, gld: 136, score: 23, bossRole: 'dash pressure' }
};

// which kinds can spawn at which loop
export const SPAWN_POOLS = [
  ['grunt', 'runner', 'shooter', 'charger'],
  ['grunt', 'runner', 'shooter', 'charger', 'bomber', 'bouncer', 'splitter'],
  ['grunt', 'runner', 'shooter', 'charger', 'bomber', 'bouncer', 'tank', 'glitch', 'anchor', 'leech', 'pulse', 'damper', 'warden'],
  ['grunt', 'runner', 'shooter', 'charger', 'bomber', 'bouncer', 'tank', 'glitch', 'echo', 'orbiter', 'anchor', 'splitter', 'prism', 'pulse', 'leech', 'damper', 'warden', 'herald']
];

// ---- upgrades (INSTALL) -------------------------------------------------
// All stackable. No caps. Balatro rules.
export const UPGRADES = [
  { id: 'dmg',      label: 'DMG +15%',             tier: 0, desc: 'Весь исходящий урон растёт, включая подконтрольные процессы Контролёра.', apply: s => { s.dmgMul *= 1.15; } },
  { id: 'fire',     label: 'FIRE RATE +12%',       tier: 0, desc: 'Оружие перезаряжается быстрее.', apply: s => { s.fireMul *= 1.12; } },
  { id: 'spd',      label: 'SPD +8%',              tier: 0, desc: 'Скорость движения растёт.', apply: s => { s.spdMul *= 1.08; } },
  { id: 'maxhp',    label: 'HP +20',               tier: 0, desc: 'Максимальное здоровье растёт.', apply: s => { s.maxHpAdd += 20; } },
  { id: 'magnet',   label: 'MAGNET +40%',          tier: 0, desc: 'Подборы притягиваются дальше.', apply: s => { s.magnetMul *= 1.4; } },
  { id: 'dash',     label: 'DASH +1',              tier: 1, desc: 'Больше зарядов рывка.', apply: s => { s.dashAdd += 1; } },
  { id: 'dash_length', label: 'DASH LENGTH +18%', tier: 1, desc: 'Рывок проходит дальше.', apply: s => { s.dashDistMul *= 1.18; } },
  { id: 'drone',    label: 'DRONE +1',             tier: 1, desc: 'Добавляет автостреляющего спутника.', apply: s => { s.drones += 1; } },
  { id: 'luck',     label: 'LUCK +1',              tier: 1, desc: 'Лучше исходы улучшений и казино.', apply: s => { s.luck += 1; } },
  { id: 'proc',     label: 'BLAST CHANCE 10%',     tier: 1, desc: 'Попадания пуль могут создавать маленький взрыв.', apply: s => { s.procBlast += 0.10; } },
  { id: 'echo',     label: 'ECHO SHOT 12%',        tier: 1, desc: 'Иногда появляется дополнительный выстрел.', apply: s => { s.echoShot += 0.12; } },
  { id: 'leech',    label: 'LIFESTEAL 2%',         tier: 1, desc: 'Лечение от нанесённого урона.', apply: s => { s.lifesteal += 0.02; } },
  { id: 'goldgun',  label: 'GLD ON KILL +40%',     tier: 1, desc: 'Больше кредитов за удаление угроз.', apply: s => { s.goldMul *= 1.4; } },
  { id: 'combo_gld', label: 'COMBO PAYS GLD', tier: 0, desc: 'Комбо при завершении выдаёт GLD: убийства × множитель.', apply: s => { s.comboPrize = 'gld'; } },
  { id: 'combo_exp', label: 'COMBO PAYS EXP', tier: 0, desc: 'Комбо при завершении выдаёт EXP: убийства × множитель.', apply: s => { s.comboPrize = 'exp'; } },
  { id: 'combo_hp',  label: 'COMBO PAYS HP',  tier: 0, desc: 'Комбо при завершении лечит: убийства × множитель × 0.1, округление до целого.', apply: s => { s.comboPrize = 'hp'; } },


  // boss signature modules: major powers extracted from defeated bosses.
  // These are not normal INSTALL rolls; they appear only after boss rooms.
  { id: 'sig_target_lock', label: 'TARGET LOCK', tier: 1, bossSig: true, desc: 'R: захватывает угрозу. Прицел держится на цели дольше с каждым уровнем.', apply: s => { if (s.rActiveId === 'target_lock') s.rActiveStacks += 1; else { s.rActiveId = 'target_lock'; s.rActiveStacks = 1; } } },
  { id: 'sig_redline_boost', label: 'REDLINE BOOST', tier: 1, bossSig: true, desc: 'R: супер-ускорение. Короткий рывок темпа с перезарядкой. Уровни увеличивают скорость и длительность.', apply: s => { if (s.rActiveId === 'redline_boost') s.rActiveStacks += 1; else { s.rActiveId = 'redline_boost'; s.rActiveStacks = 1; } } },
  { id: 'sig_ghost_decoy', label: 'GHOST DECOY', tier: 1, bossSig: true, desc: 'R: антивирус скрывается, а приманка отвлекает угрозы.', apply: s => { if (s.rActiveId === 'ghost_decoy') s.rActiveStacks += 1; else { s.rActiveId = 'ghost_decoy'; s.rActiveStacks = 1; } } },
  { id: 'sig_rewind_mark', label: 'REWIND MARK', tier: 1, bossSig: true, desc: 'R: ставит точку возврата. Повторное R возвращает назад и оглушает угрозы рядом.', apply: s => { if (s.rActiveId === 'rewind_mark') s.rActiveStacks += 1; else { s.rActiveId = 'rewind_mark'; s.rActiveStacks = 1; } } },
  { id: 'sig_kill_switch', label: 'KILL SWITCH', tier: 2, bossSig: true, desc: 'R: один раз за протокол стирает угрозы на экране, включая главную угрозу.', apply: s => { if (!s.killSwitchTaken) { s.killSwitchTaken = 1; s.rActiveId = 'kill_switch'; s.rActiveStacks = Math.max(1, s.rActiveStacks || 1); s.killSwitchCharge = Math.max(0, s.killSwitchCharge || 0) + 1; } else if (s.rActiveId === 'kill_switch') { s.rActiveStacks = Math.max(1, s.rActiveStacks || 1) + 1; s.killSwitchCharge = Math.max(0, s.killSwitchCharge || 0) + 1; } } },
  { id: 'sig_spawn_hold', label: 'SPAWN HOLD', tier: 1, bossSig: true, desc: 'Поля предупреждения появления держатся дольше. Повторы усиливают задержку входа угроз.', apply: s => { s.spawnHoldStacks += 1; } },
  { id: 'sig_aegis_process', label: 'AEGIS PROCESS', tier: 1, bossSig: true, desc: 'Антивирус получает защитный слой оболочки. Повторы увеличивают запас защиты.', apply: s => { s.aegisStacks += 1; } },
  { id: 'sig_mirror_payout', label: 'MIRROR PAYOUT', tier: 1, bossSig: true, desc: 'Копирует следующий усиливаемый приз с выбором. Не копирует саму себя. Заряд возвращается после победы над главной угрозой.', apply: s => { s.mirrorCapacity += 1; } },
  { id: 'sig_null_revival', label: 'NULL REVIVAL', tier: 2, bossSig: true, desc: 'Резервное восстановление. При сбое возвращает игрока с 45% здоровья. Повторы дают ещё один заряд.', apply: s => { s.nullRevives += 1; } },
  { id: 'sig_boss_key', label: 'BOSS KEY', tier: 1, bossSig: true, desc: 'Первый сундук цикла бесплатно становится максимальной редкости. Повторы дают ещё один ключ.', apply: s => { s.bossKeys += 1; } },

  // weapon branches. These are WPN-chest rewards only, not INSTALL rewards.
  { id: 'bullet_ricochet', label: 'ОТСКОК СНАРЯДОВ +1', tier: 1, branch: 'ALL', desc: 'Все твои снаряды получают дополнительный отскок от стен. Повторные выборы дают больше отскоков.', apply: s => { s.bulletBounce += 1; } },
  { id: 'bullet_range',    label: 'ДАЛЬНОСТЬ СНАРЯДОВ +22%',  tier: 1, branch: 'ALL', desc: 'Все твои снаряды летят дальше и живут дольше.', apply: s => { s.bulletRange *= 1.22; } },
  { id: 'bullet_fire',     label: 'ТЕРМО-СБОЙ СНАРЯДОВ', tier: 1, branch: 'ALL', desc: 'Снаряды перегревают угрозы и наносят периодический урон.', apply: s => { s.bulletFire += 1; } },
  { id: 'bullet_freeze',   label: 'КРИО-СБОЙ СНАРЯДОВ', tier: 1, branch: 'ALL', desc: 'Снаряды охлаждают угрозы и могут коротко остановить их.', apply: s => { s.bulletFreeze += 1; } },
  { id: 'bullet_poison',   label: 'КОРРОЗИЯ СНАРЯДОВ', tier: 1, branch: 'ALL', desc: 'Снаряды заражают угрозы коррозией и наносят периодический урон.', apply: s => { s.bulletPoison += 1; } },
  { id: 'drone_element_link', label: 'КАНАЛ СПУТНИКОВ', tier: 1, branch: 'ALL', desc: 'Спутники отдельно переносят термо-, крио- и коррозийные сбои снарядов.', apply: s => { s.droneElementLink += 1; } },
  { id: 'element_amp', label: 'СТАТУСНЫЙ СБОЙ +25%', tier: 1, branch: 'ALL', desc: 'Усиливает термо-, крио- и коррозийные сбои.', apply: s => { s.bulletElementAmp += 1; } },
  { id: 'element_spread', label: 'ПЕРЕНОС СБОЯ', tier: 1, branch: 'ALL', desc: 'Удаление угрозы переносит статусный сбой на ближайшие цели.', apply: s => { s.elementSpread += 1; } },
  { id: 'bullet_chain', label: 'СВЯЗЬ СНАРЯДОВ +1', tier: 1, branch: 'ALL', desc: 'Попадание оружием связывает ближайшие угрозы. Повторные выборы продлевают цепь.', apply: s => { s.bulletChain += 1; } },
  { id: 'shg_teeth',  label: 'SHG: ОСКОЛКИ +2', tier: 1, branch: 'SHG', desc: 'Клиновой разряд получает два дополнительных осколка.', apply: s => { s.shgPellets += 2; } },
  { id: 'shg_longshot', label: 'SHG: ДАЛЬНИЙ ЗАЛП', tier: 1, branch: 'SHG', desc: 'ПКМ тратит все заряды SHG на один дальний тяжёлый выстрел. Повторные выборы усиливают его, но перезарядка становится дольше.', apply: s => { s.shgLongshot += 1; } },
  { id: 'sek_split',  label: 'SEK: ФРАГМЕНТЫ',  tier: 1, branch: 'SEK', desc: 'Убийства SEK выпускают маленькие самонаводящиеся фрагменты.', apply: s => { s.sekSplit += 1; } },
  { id: 'sek_chain',  label: 'SEK: ЗАХВАТ',     tier: 1, branch: 'SEK', desc: 'У SEK улучшаются наведение и время жизни.', apply: s => { s.sekChain += 1; } },
  { id: 'sek_swarm', label: 'SEK: РОЙ', tier: 1, branch: 'SEK', desc: 'ПКМ выпускает рой снарядов-искателей по разным угрозам.', apply: s => { s.sekSwarm += 1; } },
  { id: 'rkt_cluster',label: 'RKT: МИНИ-ВЗРЫВЫ +2',     tier: 1, branch: 'RKT', desc: 'Ракеты распадаются на мини-взрывы.', apply: s => { s.rktCluster += 1; } },
  { id: 'rkt_mines',  label: 'RKT: СТАТИК-МИНЫ',   tier: 1, branch: 'RKT', desc: 'Разломные заряды оставляют отложенные мины.', apply: s => { s.rktMines += 1; } },
  { id: 'rkt_stun',   label: 'RKT: ОГЛУШЕНИЕ',    tier: 1, branch: 'RKT', desc: 'Разломные взрывы могут оглушать угрозы.', apply: s => { s.rktStun += 1; } },
  { id: 'rkt_scatter',label: 'RKT: ОТБРОС', tier: 1, branch: 'RKT', desc: 'Разломные взрывы сильнее разбрасывают угрозы.', apply: s => { s.rktScatter += 1; } },
  { id: 'rkt_remote', label: 'RKT: РУЧНОЙ ВЗРЫВ', tier: 1, branch: 'RKT', desc: 'ПКМ взрывает выпущенные ракеты по одной: сначала самую старую, потом следующую.', apply: s => { s.rktRemote += 1; } },

  // ability / active branches
  { id: 'voidstep',  label: 'DASH: VOID RIFT',     tier: 1, branch: 'DASH', desc: 'Рывок оставляет разрез пустоты и ранит угрозы вдоль траектории.', apply: s => { s.voidStep += 1; } },
  { id: 'dashcut',   label: 'DASH STUN',          tier: 1, branch: 'DASH', desc: 'Рывок оглушает угрозы рядом с траекторией.', apply: s => { s.dashCut += 1; } },
  { id: 'dashclone', label: 'DASH AFTERSHOCK',    tier: 1, branch: 'DASH', desc: 'После рывка в точке старта остаётся короткий ударный след.', apply: s => { s.dashClone += 1; } },
  { id: 'q_snap',    label: 'Q: FIELD SNAP',      tier: 1, branch: 'Q', desc: 'Q стягивает угрозы и оставляет короткое замедляющее поле.', apply: s => { s.activeSnap += 1; } },
  { id: 'q_blood',   label: 'Q: BLOOD PULSE',     tier: 1, branch: 'Q', desc: 'Q тратит HP на красный сигнальный взрыв.', apply: s => { s.activeBlood += 1; } },
  { id: 'q_over',    label: 'Q: OVERCLOCK',       tier: 1, branch: 'Q', desc: 'Q временно ускоряет стрельбу.', apply: s => { s.activeOver += 1; } },

  // high rarity rule-breakers
  { id: 'droneproc', label: 'DRONE BLAST CHANCE',  tier: 2, desc: 'Пули дронов иногда создают маленькие взрывы.', apply: s => { s.droneProc += 1; } },
  { id: 'debtengine',label: 'STATIC CORE',         tier: 2, cursed: true, desc: 'Большой урон и удача, но боевые сектора становятся опаснее от статик-шторма.', apply: s => { s.dmgMul *= 1.35; s.luck += 2; s.debtEngine += 1; } },
  { id: 'overload',  label: 'DMG +50% / HP -15',  tier: 2, cursed: true, apply: s => { s.dmgMul *= 1.5; s.maxHpAdd -= 15; } },
  { id: 'gamble',    label: 'LUCK +3 / SPD -10%', tier: 2, cursed: true, apply: s => { s.luck += 3; s.spdMul *= 0.9; } },
  { id: 'rlt_square_damage', label: 'RLT: УРОН +', branch: 'RLT', tier: 1, desc: 'Квадраты рулетки бьют сильнее.', apply: s => { s.rltDmg += 1; } },
  { id: 'rlt_square_size', label: 'RLT SQUARE SIZE +', branch: 'RLT', tier: 1, desc: 'Стартовый квадрат рулетки становится больше.', apply: s => { s.rltSize += 1; } },
  { id: 'rlt_fragment_count', label: 'RLT: ОСКОЛКИ +', branch: 'RLT', tier: 1, desc: 'При дроблении появляется больше малых квадратов.', apply: s => { s.rltFrag += 1; } },
  { id: 'rlt_split_depth', label: 'RLT: ДРОБЛЕНИЕ +', branch: 'RLT', tier: 1, desc: 'Осколки могут дробиться ещё один раз.', apply: s => { s.rltDepth += 1; } },
  { id: 'rlt_wall_charge', label: 'RLT: ОТСКОК +', branch: 'RLT', tier: 1, desc: 'Удар о стену сильнее заряжает следующие квадраты.', apply: s => { s.rltWallBuff += 1; } },
  { id: 'rlt_square_speed', label: 'RLT: СКОРОСТЬ +', branch: 'RLT', tier: 1, desc: 'Квадраты рулетки летят быстрее.', apply: s => { s.rltSpeed += 1; } },
  { id: 'crd_card_count', label: 'CRD: КАРТЫ +1', branch: 'CRD', tier: 1, desc: 'Колода выпускает на одну карту больше в каждом веере.', apply: s => { s.crdCards += 1; } },
  { id: 'ctrl_process_slot', label: 'CTRL: ПРОЦЕСС +1', branch: 'CTRL', tier: 1, desc: 'Контролёр держит ещё один подконтрольный процесс.', apply: s => { s.ctrlMax += 1; } },
  { id: 'ctrl_process_power', label: 'CTRL: КОНТРОЛЬ +', branch: 'CTRL', tier: 1, desc: 'Команды быстрее заполняют захват цели; процессы сильнее атакуют.', apply: s => { s.ctrlPower += 1; } },
  { id: 'ctrl_capture_tier', label: 'CTRL: АССИМИЛЯЦИЯ +', branch: 'CTRL', tier: 1, desc: 'Расширяет пул захвата: I — стойкие и сбойные, II — дальние и полевые, III — дирижёры роя, IV — боссы.', apply: s => { s.ctrlCaptureTier += 1; } },
  { id: 'ctrl_process_fire', label: 'CTRL: ТЕМП ПРИКАЗОВ +', branch: 'CTRL', tier: 1, desc: 'Подконтрольные процессы быстрее выполняют атакующие приказы.', apply: s => { s.ctrlFire += 1; } },
  { id: 'ctrl_process_life', label: 'CTRL: СРОК +', branch: 'CTRL', tier: 1, desc: 'Подконтрольные процессы живут дольше. Срок также зависит от максимального HP процесса до захвата.', apply: s => { s.ctrlLife += 1; } },
  { id: 'ctrl_process_persist', label: 'CTRL: ПЕРЕНОС', branch: 'CTRL', tier: 2, desc: 'Подконтрольные процессы не очищаются у портала и аккуратно переносятся в следующий сектор.', apply: s => { s.ctrlPersist += 1; } },
  { id: 'qrn_radius', label: 'QRN: ДАЛЬНОСТЬ +', branch: 'QRN', tier: 1, desc: 'Карантинный якорь цепляет процессы дальше от маркера.', apply: s => { s.qrRadius += 1; } },
  { id: 'qrn_hold', label: 'QRN: УДЕРЖАНИЕ +', branch: 'QRN', tier: 1, desc: 'Карантинные цепи держат дольше.', apply: s => { s.qrHold += 1; } },
  { id: 'qrn_links', label: 'QRN: ЦЕПЬ +1', branch: 'QRN', tier: 1, desc: 'Один якорь может держать ещё один процесс.', apply: s => { s.qrLinks += 1; } },
  { id: 'qrn_damage', label: 'QRN: РАЗРЯД +', branch: 'QRN', tier: 1, desc: 'Цепи якоря периодически обжигают зацепленные процессы.', apply: s => { s.qrDamage += 1; } },
];

export const UPGRADE_LABELS = Object.fromEntries(UPGRADES.map(u => [u.id, u.label]));
export const CURSED_UPGRADE_IDS = UPGRADES.filter(u => u.cursed).map(u => u.id);

// INSTALL upgrades are HERO ONLY.
// Weapon-specific branches live in WPN chest choices, not INSTALL offers.
export const WEAPON_BRANCHES = ['ALL', 'SHG', 'SEK', 'RKT', 'RLT', 'CRD', 'CTRL', 'QRN'];
export const HERO_UPGRADES = UPGRADES.filter(u => !u.bossSig && !WEAPON_BRANCHES.includes(u.branch) && u.branch !== 'Q');
export const BOSS_SIGNATURE_UPGRADE_IDS = UPGRADES.filter(u => u.bossSig).map(u => u.id);
export const WEAPON_UPGRADE_IDS = UPGRADES.filter(u => WEAPON_BRANCHES.includes(u.branch)).map(u => u.id);

export const WEAPON_CHEST_REWARDS = [
  { id: 'weapon_shotgun', kind: 'weapon', weapon: 'shotgun', label: 'SHG WEAPON', desc: 'Открывает клиновой разряд: короткий веер очистки с зарядами.' },
  { id: 'weapon_seeker', kind: 'weapon', weapon: 'seeker', label: 'SEK WEAPON', desc: 'Открывает искатель: медленный сигнальный снаряд, который сам держит цель.' },
  { id: 'weapon_rocketgun', kind: 'weapon', weapon: 'rocketgun', label: 'RKT WEAPON', desc: 'Открывает разломный заряд: тяжёлый снаряд с широким взрывом.' },
  { id: 'ctrl_unlock_qrn', kind: 'weapon', weapon: 'quarantine_anchor', label: 'QRN: ЯКОРЬ', desc: 'Открывает карантинный якорь: маркер цепляется за стену и держит угрозы на цепях.' },
  { id: 'ctrl_unlock_saw', kind: 'weapon', weapon: 'process_saw', label: 'SAW: РАЗБОР', desc: 'Открывает массовый разбор: большой импульс по области курсора быстро перехватывает несколько процессов.' },
  { id: 'bullet_ricochet', kind: 'weapon_upgrade', upgrade: 'bullet_ricochet', label: 'ОТСКОК СНАРЯДОВ +1', desc: 'Все снаряды получают дополнительный отскок от стен.' },
  { id: 'bullet_range', kind: 'weapon_upgrade', upgrade: 'bullet_range', label: 'ДАЛЬНОСТЬ СНАРЯДОВ +22%', desc: 'Все снаряды летят дальше и держатся дольше.' },
  { id: 'bullet_fire', kind: 'weapon_upgrade', upgrade: 'bullet_fire', label: 'ТЕРМО-СБОЙ СНАРЯДОВ', desc: 'Снаряды перегревают угрозы.' },
  { id: 'bullet_freeze', kind: 'weapon_upgrade', upgrade: 'bullet_freeze', label: 'КРИО-СБОЙ СНАРЯДОВ', desc: 'Снаряды охлаждают угрозы и могут коротко остановить их.' },
  { id: 'bullet_poison', kind: 'weapon_upgrade', upgrade: 'bullet_poison', label: 'КОРРОЗИЯ СНАРЯДОВ', desc: 'Снаряды заражают угрозы коррозией.' },
  { id: 'drone_element_link', kind: 'weapon_upgrade', upgrade: 'drone_element_link', label: 'КАНАЛ СПУТНИКОВ', desc: 'Спутники отдельно переносят статусные сбои снарядов.' },
  { id: 'element_amp', kind: 'weapon_upgrade', upgrade: 'element_amp', label: 'СТАТУСНЫЙ СБОЙ +25%', desc: 'Термо-, крио- и коррозийные сбои держатся дольше и бьют сильнее.' },
  { id: 'element_spread', kind: 'weapon_upgrade', upgrade: 'element_spread', label: 'ПЕРЕНОС СБОЯ', desc: 'Статусные сбои с удалённых угроз переходят на ближайшие цели.' },
  { id: 'bullet_chain', kind: 'weapon_upgrade', upgrade: 'bullet_chain', label: 'СВЯЗЬ СНАРЯДОВ +1', desc: 'Попадание оружием связывает ближайшие угрозы и передаёт часть урона дальше.' },
  { id: 'shg_teeth', kind: 'weapon_upgrade', upgrade: 'shg_teeth', reqWeapon: 'shotgun', label: 'SHG: ОСКОЛКИ +2', desc: 'Клиновой разряд получает больше осколков в залпе.' },
  { id: 'shg_longshot', kind: 'weapon_upgrade', upgrade: 'shg_longshot', reqWeapon: 'shotgun', label: 'SHG: ДАЛЬНИЙ ЗАЛП', desc: 'ПКМ тратит все заряды клинового разряда на один дальний тяжёлый выстрел.' },
  { id: 'sek_split', kind: 'weapon_upgrade', upgrade: 'sek_split', reqWeapon: 'seeker', label: 'SEK: ФРАГМЕНТЫ', desc: 'Искатель выпускает фрагменты после удаления цели.' },
  { id: 'sek_chain', kind: 'weapon_upgrade', upgrade: 'sek_chain', reqWeapon: 'seeker', label: 'SEK: ЗАХВАТ', desc: 'Искатель увереннее держит цель и летит дольше.' },
  { id: 'sek_swarm', kind: 'weapon_upgrade', upgrade: 'sek_swarm', reqWeapon: 'seeker', label: 'SEK: РОЙ', desc: 'ПКМ выпускает рой сигнальных снарядов по разным угрозам.' },
  { id: 'rkt_cluster', kind: 'weapon_upgrade', upgrade: 'rkt_cluster', reqWeapon: 'rocketgun', label: 'RKT: МИНИ-ВЗРЫВЫ +2', desc: 'Разломный заряд добавляет малые взрывы вокруг детонации.' },
  { id: 'rkt_mines', kind: 'weapon_upgrade', upgrade: 'rkt_mines', reqWeapon: 'rocketgun', label: 'RKT: СТАТИК-МИНЫ', desc: 'Разломные заряды оставляют отложенные мины.' },
  { id: 'rkt_stun', kind: 'weapon_upgrade', upgrade: 'rkt_stun', reqWeapon: 'rocketgun', label: 'RKT: ОГЛУШЕНИЕ', desc: 'Разломные взрывы могут оглушать угрозы.' },
  { id: 'rkt_scatter', kind: 'weapon_upgrade', upgrade: 'rkt_scatter', reqWeapon: 'rocketgun', label: 'RKT: ОТБРОС', desc: 'Разломные взрывы сильнее разбрасывают угрозы.' },
  { id: 'rkt_remote', kind: 'weapon_upgrade', upgrade: 'rkt_remote', reqWeapon: 'rocketgun', label: 'RKT: РУЧНОЙ ВЗРЫВ', desc: 'ПКМ взрывает выпущенные разломные заряды по очереди.' },
  { id: 'rlt_damage', kind: 'weapon_upgrade', upgrade: 'rlt_square_damage', reqWeapon: 'roulette', label: 'RLT: УРОН +', desc: 'Рулетка: каждый квадрат бьёт сильнее.' },
  { id: 'rlt_size', kind: 'weapon_upgrade', upgrade: 'rlt_square_size', reqWeapon: 'roulette', label: 'RLT: РАЗМЕР +', desc: 'Рулетка: стартовый квадрат крупнее.' },
  { id: 'rlt_fragments', kind: 'weapon_upgrade', upgrade: 'rlt_fragment_count', reqWeapon: 'roulette', label: 'RLT: ОСКОЛКИ +', desc: 'Рулетка: больше осколков при распаде.' },
  { id: 'rlt_split_life', kind: 'weapon_upgrade', upgrade: 'rlt_split_depth', reqWeapon: 'roulette', label: 'RLT: ДРОБЛЕНИЕ +', desc: 'Рулетка: осколки дробятся дальше.' },
  { id: 'rlt_wall_charge', kind: 'weapon_upgrade', upgrade: 'rlt_wall_charge', reqWeapon: 'roulette', label: 'RLT: ОТСКОК +', desc: 'Рулетка: удар о стену сильнее заряжает следующий распад.' },
  { id: 'rlt_speed', kind: 'weapon_upgrade', upgrade: 'rlt_square_speed', reqWeapon: 'roulette', label: 'RLT: СКОРОСТЬ +', desc: 'Рулетка: квадраты летят быстрее.' },
  { id: 'crd_card_count', kind: 'weapon_upgrade', upgrade: 'crd_card_count', reqWeapon: 'deck', label: 'CRD: КАРТЫ +1', desc: 'Колода выпускает на одну карту больше в каждом веере.' },
  { id: 'ctrl_process_slot', kind: 'weapon_upgrade', upgrade: 'ctrl_process_slot', reqWeapon: 'command_pulse', label: 'CTRL: ПРОЦЕСС +1', desc: 'Контролёр может держать ещё один подконтрольный процесс.' },
  { id: 'ctrl_process_power', kind: 'weapon_upgrade', upgrade: 'ctrl_process_power', reqWeapon: 'command_pulse', label: 'CTRL: КОНТРОЛЬ +', desc: 'Команды быстрее заполняют захват цели; процессы сильнее атакуют.' },
  { id: 'ctrl_capture_tier', kind: 'weapon_upgrade', upgrade: 'ctrl_capture_tier', reqWeapon: 'command_pulse', label: 'CTRL: АССИМИЛЯЦИЯ +', desc: 'Расширяет захват необычных мобов по ступеням. На четвёртой ступени разрешает перехват босса.' },
  { id: 'ctrl_process_fire', kind: 'weapon_upgrade', upgrade: 'ctrl_process_fire', reqWeapon: 'process_saw', label: 'CTRL: ТЕМП ПРИКАЗОВ +', desc: 'Подконтрольные процессы быстрее выполняют атакующие приказы.' },
  { id: 'ctrl_process_life', kind: 'weapon_upgrade', upgrade: 'ctrl_process_life', reqWeapon: 'command_pulse', label: 'CTRL: СРОК +', desc: 'Подконтрольные процессы живут дольше; цели с большим запасом прочности держат контроль дольше.' },
  { id: 'ctrl_process_persist', kind: 'weapon_upgrade', upgrade: 'ctrl_process_persist', reqWeapon: 'command_pulse', label: 'CTRL: ПЕРЕНОС', desc: 'Подконтрольные процессы аккуратно переходят в следующий сектор.' },
  { id: 'qrn_radius', kind: 'weapon_upgrade', upgrade: 'qrn_radius', reqWeapon: 'quarantine_anchor', label: 'QRN: ДАЛЬНОСТЬ +', desc: 'Карантинный якорь цепляет угрозы дальше от маркера.' },
  { id: 'qrn_hold', kind: 'weapon_upgrade', upgrade: 'qrn_hold', reqWeapon: 'quarantine_anchor', label: 'QRN: УДЕРЖАНИЕ +', desc: 'Карантинные цепи держатся дольше.' },
  { id: 'qrn_links', kind: 'weapon_upgrade', upgrade: 'qrn_links', reqWeapon: 'quarantine_anchor', label: 'QRN: ЦЕПЬ +1', desc: 'Один якорь может держать ещё одну угрозу.' },
  { id: 'qrn_damage', kind: 'weapon_upgrade', upgrade: 'qrn_damage', reqWeapon: 'quarantine_anchor', label: 'QRN: РАЗРЯД +', desc: 'Цепи якоря периодически наносят урон.' },
  { id: 'wpn_dmg', kind: 'stat', stat: 'dmg', label: 'УРОН ОРУЖИЯ +18%', desc: 'Усиливает урон всего оружия. У Контролёра усиливает урон подконтрольных процессов.' },
  { id: 'wpn_fire', kind: 'stat', stat: 'fire', label: 'ТЕМП ОРУЖИЯ +14%', desc: 'Оружие стреляет чаще.' }
];


export const ACTIVE_CORES = {
  blood_ring: {
    id: 'blood_ring', label: 'BLOOD RING', short: 'RING', tone: 'red', role: 'FOLLOW DAMAGE',
    desc: 'Кровавое кольцо следует за тобой. если угроза остаётся внутри долго — становится высоким.',
    upgrade: ['+большой радиус', '+длительность', '+сильнее урон']
  },
  field_snap: {
    id: 'field_snap', label: 'FIELD SNAP', short: 'SNAP', tone: 'cyan', role: 'PULL / CONTROL',
    desc: 'Один раз резко стягивает угрозы и подборы. После рывка остаётся короткое поле: оно уже не тянет, только замедляет, глушит пули и наносит слабый урон.',
    upgrade: ['+большой радиус', '+сила стяжки', '+дольше поле']
  },
  bullet_freeze: {
    id: 'bullet_freeze', label: 'BULLET FREEZE', short: 'FREEZE', tone: 'cyan', role: 'FREEZE / CONTROL',
    desc: 'Холодная аура следует за тобой. Враги замирают, вражеские пули почти останавливаются.',
    upgrade: ['+большой радиус', '+длительность', '+дольше примерзание']
  },
  shell_ripper: {
    id: 'shell_ripper', label: 'SHELL RIPPER', short: 'RIP', tone: 'purple', role: 'ARMOR / EXPOSE',
    desc: 'Срывает защиту с угроз рядом. Ослабленные угрозы получают больше урона от всех источников.',
    upgrade: ['+большой радиус', '+сильнее ломает защиту', '+сильнее уязвимость']
  },
  void_cut: {
    id: 'void_cut', label: 'VOID CUT', short: 'CUT', tone: 'purple', role: 'BUILD LASER',
    desc: 'Пускает тонкий луч по направлению прицела. Улучшения добавляют новые звенья луча.',
    upgrade: ['+1 точка связи', '++длина каждого сегмента', '+урон луча']
  },
  signal_spike: {
    id: 'signal_spike', label: 'SIGNAL SPIKE', short: 'SPIKE', tone: 'cyan', role: 'DEPLOY NODE',
    desc: 'Ставит сигнальный шип в точке прицела. Зона замедляет и глушит пули.',
    upgrade: ['+1 заряд', '+немного длительность', '+немного урон зоны']
  },
  black_box: {
    id: 'black_box', label: 'BLACK BOX', short: 'BOX', tone: 'purple', role: 'STEALTH / SAFE',
    desc: 'Прячет тебя в чёрной области. Угрозы снаружи теряют сигнал, ближайшие сбиваются.',
    upgrade: ['+радиус скрытия', '+длительность', '+дольше скрытие']
  },
  debt_pulse: {
    id: 'debt_pulse', label: 'STATIC PULSE', short: 'STC', tone: 'red', role: 'RISK BURST',
    desc: 'Красный статик-взрыв вокруг тебя. Ослабляет угрозы, но может добавить уровень статик-шторма.',
    upgrade: ['+огромный радиус', '+урон волны', '+сильнее уязвимость']
  }
};

export const ACTIVE_MUTATIONS = {
  static: { id: 'static', label: 'STATIC', tone: 'cyan', role: 'FIELD', desc: 'Q оставляет замедляющее статик-поле.' },
  blood: { id: 'blood', label: 'BLOOD', tone: 'red', role: 'DAMAGE', desc: 'Q получает кровавый урон; часть применений стоит здоровье.' },
  echo: { id: 'echo', label: 'ECHO', tone: 'purple', role: 'RECAST', desc: 'Q повторяется слабее после короткой паузы.' },
  shrapnel: { id: 'shrapnel', label: 'SHRAPNEL', tone: 'cyan', role: 'BULLETS', desc: 'Q выпускает дополнительные снаряды.' },
  casino: { id: 'casino', label: 'CASINO', tone: 'green', role: 'POST-ROLL', desc: 'После Q может сработать казино-проверка.' },
  void: { id: 'void', label: 'VOID', tone: 'purple', role: 'PHASE', desc: 'Q даёт короткое окно неуязвимости.' },
  leech: { id: 'leech', label: 'LEECH', tone: 'green', role: 'SUSTAIN', desc: 'Попадания Q могут вернуть здоровье или кредиты.' },
  armor_crack: { id: 'armor_crack', label: 'ARMOR CRACK', tone: 'purple', role: 'SHELL', desc: 'Q сильнее ломает защиту угроз.' },
  anchor: { id: 'anchor', label: 'ANCHOR', tone: 'purple', role: 'LOCK ZONE', desc: 'Q оставляет область, которая тянет угроз и тормозит пули.' },
  hunger: { id: 'hunger', label: 'HUNGER', tone: 'red', role: 'CHARGE BITE', desc: 'Q создаёт зону голода с финальным укусом.' },
  bad_tape: { id: 'bad_tape', label: 'BAD TAPE', tone: 'purple', role: 'GLITCH REPEAT', desc: 'Q повторяется двумя слабыми сбоями.' }
};

export const ACTIVE_MUTATION_SLOTS = 3;

// Legacy ABL list is kept for dash/mobility side rewards. Q rewards are generated dynamically in sim.
export const ABILITY_CHEST_REWARDS = [
  { id: 'abl_dash', kind: 'ability_upgrade', upgrade: 'dash', label: 'DASH +1', desc: 'Добавляет один заряд рывка.' },
  { id: 'abl_dash_length', kind: 'ability_upgrade', upgrade: 'dash_length', label: 'DASH LENGTH +18%', desc: 'Рывок проходит дальше.' },
  { id: 'abl_voidstep', kind: 'ability_upgrade', upgrade: 'voidstep', label: 'DASH: VOID RIFT', desc: 'Рывок оставляет разрез пустоты.' },
  { id: 'abl_dashcut', kind: 'ability_upgrade', upgrade: 'dashcut', label: 'DASH STUN', desc: 'Рывок оглушает угроз рядом с траекторией.' },
  { id: 'abl_dashclone', kind: 'ability_upgrade', upgrade: 'dashclone', label: 'DASH AFTERSHOCK', desc: 'После рывка остаётся ударный след.' },
  { id: 'abl_speed', kind: 'stat', stat: 'spd', label: 'MOBILITY +12%', desc: 'Скорость движения растёт.' },
  { id: 'abl_dashflow', kind: 'stat', stat: 'dashflow', label: 'DASH FLOW +20%', desc: 'Заряды рывка восстанавливаются быстрее.' }
];

export function rollUpgradeChoices(rng, luck, count = 3) {
  const choices = [];
  const used = new Set();
  let guard = 0;
  while (choices.length < count && guard++ < 100) {
    const tierRoll = rng() * 100 + luck * 4;
    let pool;
    if (tierRoll > 90) pool = HERO_UPGRADES.filter(u => u.tier === 2);
    else if (tierRoll > 47) pool = HERO_UPGRADES.filter(u => u.tier === 1);
    else pool = HERO_UPGRADES.filter(u => u.tier === 0);
    const u = pool[Math.floor(rng() * pool.length)];
    if (!u || used.has(u.id)) continue;
    used.add(u.id);
    choices.push(u.id);
  }
  return choices;
}

export function defaultStats() {
  return {
    dmgMul: 1, weaponDmgMul: 1, fireMul: 1, spdMul: 1, maxHpAdd: 0, magnetMul: 1,
    dashAdd: 0, dashRegenMul: 1, dashDistMul: 1, drones: 0, orbitals: 0, luck: 0,
    procBlast: 0, echoShot: 0, lifesteal: 0, goldMul: 1,
    bulletBounce: 0, bulletRange: 1, bulletFire: 0, bulletFreeze: 0, bulletPoison: 0, bulletChain: 0, droneElementLink: 0, bulletElementAmp: 0, elementSpread: 0, shgBounce: 0, shgPellets: 0, shgLongshot: 0, sekSplit: 0, sekChain: 0, sekSwarm: 0, rktCluster: 0, rktMines: 0, rktStun: 0, rktScatter: 0, rktRemote: 0, rltBounce: 0, rltZero: 0, rltDmg: 0, rltSize: 0, rltFrag: 0, rltDepth: 0, rltWallBuff: 0, rltSpeed: 0, crdCards: 0, crdDmg: 0, crdBounce: 0, ctrlMax: 0, ctrlPower: 0, ctrlCaptureTier: 0, ctrlFire: 0, ctrlLife: 0, ctrlPersist: 0, qrRadius: 0, qrHold: 0, qrLinks: 0, qrDamage: 0,
    voidStep: 0, dashCut: 0, dashClone: 0,
    activeSnap: 0, activeBlood: 0, activeOver: 0,
    droneProc: 0, orbReflect: 0, orbSpeed: 0, orbRange: 0, debtEngine: 0,
    comboPrize: 'gld', tempFire: 0,
    sigQuarantineBuffer: 0, sigEmergencyCleanse: 0, sigPayoutMirror: 0, sigFalseZero: 0, sigDeafCommand: 0, sigHuntRoute: 0, sigRedOverdrive: 0, sigAimGlitch: 0, sigIncompleteDelete: 0, sigInsuranceProcess: 0, rActiveId: '', rActiveStacks: 0, killSwitchTaken: 0, killSwitchCharge: 0, spawnHoldStacks: 0, aegisStacks: 0, mirrorCapacity: 0, nullRevives: 0, roomWagerUnlocked: 0, bossKeys: 0
  };
}

// ---- chests -------------------------------------------------------------
export const CHESTS = {
  basic_chest:   { label: 'BSC', cost: 0 },
  weapon_chest:  { label: 'WPN', cost: 70, value: 'standard', role: 'weapon route' },
  ability_chest: { label: 'ABL', cost: 65, value: 'standard', role: 'active route' },
  rare_chest:    { label: 'RAR', cost: 95, value: 'rare', role: 'run power' },
  cursed_chest:  { label: 'CRS', cost: 0, cursed: true }
};


// ---- skin presets / local unlock content --------------------------------
// Inventory is saved locally in the browser; the game/server only needs these static ids.
export const SKIN_RARITIES = {
  basic:      { id: 'basic',      label: 'BASIC',      weight: 56, tone: 'green' },
  uncommon:   { id: 'uncommon',   label: 'UNCOMMON',   weight: 26, tone: 'cyan' },
  rare:       { id: 'rare',       label: 'RARE',       weight: 12, tone: 'purple' },
  superrare:  { id: 'superrare',  label: 'SUPER RARE', weight: 5,  tone: 'red' },
  legendary:  { id: 'legendary',  label: 'LEGENDARY',  weight: 1,  tone: 'gold' }
};
export const SKIN_PRESETS = [
  { id: 'terminal_mint', name: 'HOUSE SIGNAL', rarity: 'basic', fill: '#f3f3f3', outline: '#00ff66', barrel: '#00ff66', dash: '#00ff66', dashAlt: '#f3f3f3', dashStyle: 'terminal', note: 'базовый сигнал дома / чистый терминальный след' },
  { id: 'debt_red', name: 'DEBT FRACTURE', rarity: 'basic', fill: '#120406', outline: '#ff3048', barrel: '#ff3048', dash: '#ff3048', dashAlt: '#f3f3f3', dashStyle: 'debt', note: 'долговой разрыв / красный надлом сигнала' },
  { id: 'void_cyan', name: 'VOID CHANNEL', rarity: 'uncommon', fill: '#061114', outline: '#66f6ff', barrel: '#f3f3f3', dash: '#66f6ff', dashAlt: '#b45cff', dashStyle: 'phase', note: 'холодный канал пустоты / фазовый хвост' },
  { id: 'casino_gold', name: 'CASHIER GLEAM', rarity: 'uncommon', fill: '#171104', outline: '#ffd34d', barrel: '#00ff66', dash: '#ffd34d', dashAlt: '#00ff66', dashStyle: 'coin', note: 'свет кассы / золотой жетонный след' },
  { id: 'bruise_purple', name: 'BRUISED CIRCUIT', rarity: 'uncommon', fill: '#100617', outline: '#b45cff', barrel: '#ff3048', dash: '#b45cff', dashAlt: '#ff3048', dashStyle: 'bruise', note: 'сбитая проводка / фиолетовый надрез' },
  { id: 'bone_static', name: 'BONE NOISE', rarity: 'rare', fill: '#090806', outline: '#e7dcc4', barrel: '#8df7ff', dash: '#e7dcc4', dashAlt: '#8df7ff', dashStyle: 'bone', note: 'костяная схема / сухой терминальный треск' },
  { id: 'black_lime', name: 'LIME BREACH', rarity: 'rare', fill: '#020202', outline: '#a6ff00', barrel: '#a6ff00', dash: '#a6ff00', dashAlt: '#f3f3f3', dashStyle: 'lime', note: 'кислотный пролом / резкие лаймовые искры' },
  { id: 'bad_tv', name: 'BAD BROADCAST', rarity: 'rare', fill: '#ffffff', outline: '#111111', barrel: '#ff3048', dash: '#f3f3f3', dashAlt: '#ff3048', dashStyle: 'tv', note: 'битый эфир / перегоревший экранный след' },
  { id: 'red_static', name: 'RED STORM', rarity: 'superrare', fill: '#060101', outline: '#ff3048', barrel: '#66f6ff', dash: '#ff3048', dashAlt: '#66f6ff', dashStyle: 'red_static', note: 'красный статик-шторм / битый канал в рывке' },
  { id: 'mirror_coin', name: 'FALSE JACKPOT', rarity: 'superrare', fill: '#090909', outline: '#ffd34d', barrel: '#ffd34d', dash: '#ffd34d', dashAlt: '#f3f3f3', dashStyle: 'mirror', note: 'ложный выигрыш / зеркальный жетонный дубль' },
  { id: 'terminal_ghost', name: 'TERMINAL GHOST', rarity: 'superrare', fill: '#e8fff2', outline: '#66f6ff', barrel: '#00ff66', dash: '#66f6ff', dashAlt: '#00ff66', dashStyle: 'ghost', note: 'призрак терминала / эфирный след с фантомом' },
  { id: 'jackpot_wound', name: 'JACKPOT WOUND', rarity: 'legendary', fill: '#160005', outline: '#ffd34d', barrel: '#ff3048', dash: '#ffd34d', dashAlt: '#ff3048', dashStyle: 'jackpot', legendarySfx: 'dash_jackpot', note: 'рана джекпота / лоскуты слота и монетные осколки' },
  { id: 'dead_channel', name: 'DEAD CHANNEL', rarity: 'legendary', fill: '#000000', outline: '#f3f3f3', barrel: '#66f6ff', dash: '#f3f3f3', dashAlt: '#66f6ff', dashStyle: 'dead_channel', legendarySfx: 'dash_dead_channel', note: 'мёртвый канал / порванный эфир и ТВ-обрывки' }
];
export const DEFAULT_UNLOCKED_SKINS = SKIN_PRESETS.filter(s => s.rarity === 'basic').map(s => s.id);

export function rollCasinoSkin(rng, stakeKey = 'low', luck = 0, unlocked = []) {
  const known = new Set(Array.isArray(unlocked) ? unlocked : []);
  const luckBoost = Math.max(0, Number(luck || 0) || 0) * 0.45;
  const stakeBoost = stakeKey === 'high' ? 1.35 : stakeKey === 'mid' ? 0.6 : 0;
  const lockedPool = SKIN_PRESETS.filter(s => s.rarity !== 'basic' && !known.has(s.id));
  const weighted = lockedPool.map(s => {
    const r = SKIN_RARITIES[s.rarity] || SKIN_RARITIES.uncommon;
    let w = r.weight;
    if (s.rarity === 'rare') w += stakeBoost + luckBoost;
    if (s.rarity === 'superrare') w += stakeBoost * 0.55 + luckBoost * 0.42;
    if (s.rarity === 'legendary') w += stakeBoost * 0.18 + luckBoost * 0.16;
    return [s, Math.max(0.4, w)];
  });
  const total = weighted.reduce((a, [,w]) => a + w, 0) || 1;
  let roll = rng() * total;
  for (const [skin, w] of weighted) { roll -= w; if (roll <= 0) return skin; }
  return weighted[0]?.[0] || SKIN_PRESETS.find(s => s.rarity !== 'basic') || SKIN_PRESETS[0];
}



export function rollRoomSkin(rng, depth = 0, mods = []) {
  const modSet = new Set(Array.isArray(mods) ? mods : []);
  const d = Math.max(0, depth | 0);
  const hard = Math.min(1, d / 28);
  const eventBoost = (modSet.has('casino_virus') || modSet.has('moving_room') || modSet.has('hunter_contract') || modSet.has('greed')) ? 0.8 : 0;
  const pool = SKIN_PRESETS.filter(s => s.rarity !== 'basic');
  const weighted = pool.map(s => {
    let w = (SKIN_RARITIES[s.rarity] || SKIN_RARITIES.uncommon).weight;
    if (s.rarity === 'uncommon') w *= 1.3;
    if (s.rarity === 'rare') w *= 0.78 + hard * 0.42 + eventBoost * 0.18;
    if (s.rarity === 'superrare') w *= 0.42 + hard * 0.5 + eventBoost * 0.12;
    if (s.rarity === 'legendary') w *= 0.18 + hard * 0.28 + eventBoost * 0.07;
    return [s, Math.max(0.08, w)];
  });
  const total = weighted.reduce((a, [, w]) => a + w, 0) || 1;
  let roll = rng() * total;
  for (const [skin, w] of weighted) { roll -= w; if (roll <= 0) return skin; }
  return weighted[0]?.[0] || pool[0] || SKIN_PRESETS[0];
}

// ---- casino / BET -------------------------------------------------------
export const BET_STAKES = { low: 20, mid: 55, high: 135 };

const CASINO_SYMBOLS = ['JCK','RAR','WPN','ABL','SKN','GLD','EXP','HEA','STC','LOCK','BAD'];
const CASINO_POSITIVE = new Set(['JCK','RAR','WPN','ABL','SKN','GLD','EXP','HEA']);
const CASINO_PAIRABLE = new Set(['JCK','RAR','WPN','ABL','SKN','GLD','EXP','HEA']);

function casinoCleanSymbol(s = '') {
  const x = String(s || '').toUpperCase().replace(/\s+X\d+$/i, '').trim();
  return CASINO_SYMBOLS.includes(x) ? x : '';
}

function casinoStakeProfile(stakeKey = 'low') {
  if (stakeKey === 'high') return {
    bad: 0.24, stc: 0.075, lock: 0.070, gld: 0.120, exp: 0.090, hea: 0.060,
    wpn: 0.105, abl: 0.085, rar: 0.042, skn: 0.021, jck: 0.012,
    premiumFloor: 0.27
  };
  if (stakeKey === 'mid') return {
    bad: 0.30, stc: 0.060, lock: 0.075, gld: 0.175, exp: 0.120, hea: 0.085,
    wpn: 0.075, abl: 0.060, rar: 0.025, skn: 0.012, jck: 0.004,
    premiumFloor: 0
  };
  return {
    bad: 0.36, stc: 0.035, lock: 0.070, gld: 0.245, exp: 0.145, hea: 0.105,
    wpn: 0.030, abl: 0.006, rar: 0.0025, skn: 0.0015, jck: 0.0008,
    premiumFloor: 0
  };
}

function casinoWeightedDraw(rng, stakeKey, luck, hasLockedSkin, mode = 'normal') {
  const l = Math.max(0, Number(luck || 0) || 0);
  const pr = casinoStakeProfile(stakeKey);
  const premium = mode === 'premium';
  const useful = mode === 'useful';
  let rows;
  if (premium) {
    rows = [
      ['WPN', 0.38 + l * 0.015], ['ABL', 0.30 + l * 0.014], ['RAR', 0.18 + l * 0.010],
      ['SKN', hasLockedSkin ? 0.085 + l * 0.005 : 0], ['JCK', 0.055 + l * 0.004]
    ];
  } else if (useful) {
    rows = [
      ['GLD', 0.34], ['EXP', 0.22], ['HEA', 0.17], ['WPN', stakeKey === 'low' ? 0.09 : 0.13],
      ['ABL', stakeKey === 'low' ? 0.035 : 0.08], ['RAR', stakeKey === 'high' ? 0.045 : 0.018],
      ['SKN', hasLockedSkin ? 0.012 : 0], ['JCK', stakeKey === 'high' ? 0.007 : 0.002]
    ];
  } else {
    const luckGood = Math.min(0.15, l * 0.0044);
    rows = [
      ['JCK', pr.jck + l * 0.0032],
      ['RAR', pr.rar + l * 0.0045],
      ['WPN', pr.wpn + l * 0.0055],
      ['ABL', pr.abl + l * 0.0055],
      ['SKN', hasLockedSkin ? (pr.skn + l * 0.0026) : 0],
      ['LOCK', pr.lock + l * 0.0042],
      ['HEA', pr.hea + l * 0.0042],
      ['EXP', pr.exp + l * 0.0046],
      ['GLD', pr.gld + l * 0.0050],
      ['STC', Math.max(0.01, pr.stc - l * 0.0025)],
      ['BAD', Math.max(0.06, pr.bad - luckGood)]
    ];
  }
  const total = rows.reduce((n, [,w]) => n + Math.max(0, w), 0) || 1;
  let r = rng() * total;
  for (const [id, w0] of rows) {
    r -= Math.max(0, w0);
    if (r <= 0) return id;
  }
  return rows[rows.length - 1]?.[0] || 'BAD';
}

function casinoPairInfo(symbols = []) {
  const clean = symbols.map(casinoCleanSymbol);
  const counts = new Map();
  clean.forEach((s, i) => {
    if (!CASINO_PAIRABLE.has(s)) return;
    const row = counts.get(s) || { symbol: s, slots: [] };
    row.slots.push(i); counts.set(s, row);
  });
  const triple = [...counts.values()].find(x => x.slots.length >= 3) || null;
  const pair = triple || [...counts.values()].find(x => x.slots.length === 2) || null;
  const oddSlot = pair && pair.slots.length === 2 ? [0,1,2].find(i => !pair.slots.includes(i)) : -1;
  return { triple, pair, oddSlot: Number.isFinite(oddSlot) ? oddSlot : -1 };
}

function casinoAdd(payload, key, value = 1) {
  payload[key] = Math.max(0, Number(payload[key] || 0)) + value;
}

function casinoApplySymbolReward(payload, symbol, count, stake, rng) {
  const n = Math.max(1, count | 0);
  switch (symbol) {
    case 'GLD': {
      const mul = n >= 3 ? (2.05 + rng() * 0.35) : n === 2 ? (0.95 + rng() * 0.16) : (0.24 + rng() * 0.10);
      casinoAdd(payload, 'gld', Math.round(stake * mul)); casinoAdd(payload, 'gldCount', n); break;
    }
    case 'EXP': {
      const mul = n >= 3 ? 1.45 : n === 2 ? 0.68 : 0.20;
      casinoAdd(payload, 'xp', Math.round(stake * mul)); casinoAdd(payload, 'xpCount', n); if (n >= 3) payload.forceInstall = 1; break;
    }
    case 'HEA': {
      casinoAdd(payload, 'heal', n >= 3 ? 36 : n === 2 ? 20 : 11); casinoAdd(payload, 'healCount', n);
      if (n >= 2) payload.fullHeal = 1;
      if (n >= 3) payload.healShield = 1;
      break;
    }
    case 'WPN': {
      if (n >= 2) casinoAdd(payload, 'weaponCount', n >= 3 ? 1 : 1);
      casinoAdd(payload, 'weaponBoost', n >= 3 ? 2 : n === 2 ? 1 : 1);
      payload.weapon = n >= 2; break;
    }
    case 'ABL': {
      if (n >= 2) casinoAdd(payload, 'abilityCount', 1);
      casinoAdd(payload, 'activeCdReduce', n >= 3 ? 14 : n === 2 ? 7 : 3);
      payload.ability = n >= 2; break;
    }
    case 'RAR': {
      if (n >= 2) casinoAdd(payload, 'rareCount', n >= 3 ? 2 : 1);
      else casinoAdd(payload, 'rareProgress', 1);
      payload.rare = n >= 2; break;
    }
    case 'SKN': {
      if (n >= 2) casinoAdd(payload, 'skinCount', 1);
      else casinoAdd(payload, 'skinProgress', 1);
      payload.skin = n >= 2;
      if (n >= 3) payload.skinChoice = 1;
      break;
    }
    case 'JCK': {
      casinoAdd(payload, 'jackpotCount', n);
      const mul = n >= 3 ? 4.6 : n === 2 ? 1.75 : 0.48;
      casinoAdd(payload, 'gld', Math.round(stake * mul));
      casinoAdd(payload, 'xp', Math.round(stake * (n >= 3 ? 1.20 : n === 2 ? 0.48 : 0.12)));
      break;
    }
    case 'STC': payload.static = true; casinoAdd(payload, 'staticCount', n); break;
    case 'BAD': casinoAdd(payload, 'missCount', n); break;
    case 'LOCK': casinoAdd(payload, 'lockCredits', n); break;
  }
}

function evaluateCasinoSymbols(rng, stakeKey, symbols, stake, unlockedSkins = [], cellRewards = [], opts = {}) {
  const clean = symbols.map(s => casinoCleanSymbol(s) || 'BAD');
  const payload = { cellRewards, lockSlots: Array.isArray(opts.slotLocks) ? opts.slotLocks.slice(0, 3) : ['', '', ''] };
  const counts = new Map();
  clean.forEach(s => counts.set(s, (counts.get(s) || 0) + 1));
  for (const [symbol, count] of counts.entries()) casinoApplySymbolReward(payload, symbol, count, stake, rng);

  const { triple, pair, oddSlot } = casinoPairInfo(clean);
  payload.tripleMatch = triple ? 1 : 0;
  payload.pairMatch = !triple && pair ? 1 : 0;
  payload.paySymbol = triple?.symbol || pair?.symbol || '';
  payload.pairSymbol = pair?.symbol || '';
  payload.pairSlots = pair?.slots || [];
  payload.oddSlot = oddSlot;

  const positiveKinds = clean.filter(s => CASINO_POSITIVE.has(s));
  const distinctPositive = new Set(positiveKinds);
  if (!triple && !pair && distinctPositive.size >= 3) {
    payload.mixedBonus = 1;
    casinoAdd(payload, 'gld', Math.round(stake * 0.12));
    casinoAdd(payload, 'xp', Math.round(stake * 0.08));
    // The premium WPN + ABL + RAR trio becomes a real player choice instead
    // of silently applying three small, unfocused bonuses.
    if (['WPN','ABL','RAR'].every(x => distinctPositive.has(x))) {
      payload.mixedChoicePending = 1;
      payload.mixedChoiceOptions = ['WPN','ABL','RAR'];
      delete payload.weapon; delete payload.weaponCount; delete payload.weaponBoost;
      delete payload.ability; delete payload.abilityCount; delete payload.activeCdReduce;
      delete payload.rare; delete payload.rareCount; delete payload.rareProgress;
    }
  }

  // A pair grants a random locked skin. A triple lets the player choose
  // between up to three still-locked skins.
  const skinCount = Math.max(0, Number(payload.skinCount || 0) | 0);
  if (skinCount > 0) {
    if (payload.skinChoice) {
      const seen = new Set(Array.isArray(unlockedSkins) ? unlockedSkins : []);
      const options = [];
      for (let i = 0; i < 3; i++) {
        const lockedLeft = SKIN_PRESETS.filter(s => s.rarity !== 'basic' && !seen.has(s.id));
        if (!lockedLeft.length) break;
        const skin = rollCasinoSkin(rng, stakeKey, opts.luck || 0, [...seen]);
        if (!skin || seen.has(skin.id)) break;
        seen.add(skin.id);
        options.push({ id: skin.id, name: skin.name, rarity: skin.rarity });
      }
      if (options.length) {
        payload.skin = true;
        payload.skinOptions = options;
        payload.skinChoicePending = 1;
      } else {
        const skin = rollCasinoSkin(rng, stakeKey, opts.luck || 0, unlockedSkins);
        payload.skin = true; payload.skinId = skin.id; payload.skinLabel = skin.name; payload.skinRarity = skin.rarity;
        delete payload.skinChoice;
      }
    } else {
      const skin = rollCasinoSkin(rng, stakeKey, opts.luck || 0, unlockedSkins);
      payload.skin = true; payload.skinId = skin.id; payload.skinLabel = skin.name; payload.skinRarity = skin.rarity;
    }
  }

  const positive = !!(payload.gld || payload.xp || payload.heal || payload.weaponCount || payload.weaponBoost || payload.abilityCount || payload.activeCdReduce || payload.rareCount || payload.rareProgress || payload.skinCount || payload.skinProgress || payload.jackpotCount);
  payload.positive = positive ? 1 : 0;
  payload.noMatch = (!triple && !pair) ? 1 : 0;

  let outcome = 'LOSE';
  if (payload.pairMatch && opts.allowPairDecision !== false) outcome = 'PAIR';
  else if (triple?.symbol === 'JCK') outcome = 'JCK';
  else if (triple && CASINO_POSITIVE.has(triple.symbol)) outcome = triple.symbol;
  else if (positive && distinctPositive.size > 1) outcome = 'MIX';
  else if (positive) outcome = positiveKinds[0] || 'MIX';
  else if (payload.staticCount) outcome = 'STC';
  else if (payload.lockCredits) outcome = 'LOCK';
  return { symbols: clean, outcome, payload, stake };
}

export function casinoPayloadHasReward(payload = {}) {
  return !!(payload.gld || payload.xp || payload.heal || payload.mixedChoicePending || payload.weaponCount || payload.weaponBoost || payload.abilityCount || payload.activeCdReduce || payload.rareCount || payload.rareProgress || payload.skinCount || payload.skinProgress || payload.jackpotCount);
}

export function spinCasino(rng, stakeKey, luck, unlockedSkins = [], opts = {}) {
  const stake = BET_STAKES[stakeKey];
  const known = new Set(Array.isArray(unlockedSkins) ? unlockedSkins : []);
  const hasLockedSkin = SKIN_PRESETS.some(s => s.rarity !== 'basic' && !known.has(s.id));
  const slotLocks = Array.isArray(opts.slotLocks) ? opts.slotLocks.slice(0, 3).map(casinoCleanSymbol) : [];
  while (slotLocks.length < 3) slotLocks.push('');
  const symbols = ['', '', ''];
  const cells = [];
  for (let i = 0; i < 3; i++) {
    if (slotLocks[i]) {
      symbols[i] = slotLocks[i];
      cells.push({ slot: i, raw: slotLocks[i], symbol: slotLocks[i], locked: 1 });
    }
  }
  const free = [0,1,2].filter(i => !symbols[i]);
  const pity = Math.max(0, Number(opts.pity || 0) | 0);

  // HIGH always exposes at least one real reward symbol. Around a quarter of
  // high rolls receive a premium WPN/ABL/RAR/SKN/JCK cell.
  if (stakeKey === 'high' && free.length && !symbols.some(s => CASINO_POSITIVE.has(s))) {
    const slot = free.splice(Math.floor(rng() * free.length), 1)[0];
    const mode = rng() < casinoStakeProfile('high').premiumFloor ? 'premium' : 'useful';
    symbols[slot] = casinoWeightedDraw(rng, stakeKey, luck, hasLockedSkin, mode);
    cells.push({ slot, raw: symbols[slot], symbol: symbols[slot], guaranteed: 1 });
  }
  if (pity >= 4 && free.length >= 2) {
    const pairSym = casinoWeightedDraw(rng, stakeKey, luck, hasLockedSkin, stakeKey === 'high' ? 'premium' : 'useful');
    const a = free.splice(Math.floor(rng() * free.length), 1)[0];
    const b = free.splice(Math.floor(rng() * free.length), 1)[0];
    symbols[a] = pairSym; symbols[b] = pairSym;
    cells.push({ slot: a, raw: pairSym, symbol: pairSym, pity: 4 }, { slot: b, raw: pairSym, symbol: pairSym, pity: 4 });
  } else if (pity >= 2 && free.length && !symbols.some(s => CASINO_POSITIVE.has(s))) {
    const slot = free.splice(Math.floor(rng() * free.length), 1)[0];
    symbols[slot] = casinoWeightedDraw(rng, stakeKey, luck, hasLockedSkin, 'useful');
    cells.push({ slot, raw: symbols[slot], symbol: symbols[slot], pity: 2 });
  }
  for (const slot of free) {
    const symbol = casinoWeightedDraw(rng, stakeKey, luck, hasLockedSkin, 'normal');
    symbols[slot] = symbol;
    cells.push({ slot, raw: symbol, symbol });
  }
  cells.sort((a,b) => a.slot - b.slot);
  const result = evaluateCasinoSymbols(rng, stakeKey, symbols, stake, unlockedSkins, cells, { slotLocks, luck, allowPairDecision: opts.allowPairDecision !== false });
  result.usedLock = slotLocks.some(Boolean);
  result.lockSymbol = slotLocks.filter(Boolean).join('+');
  result.lockSlots = slotLocks.slice(0, 3);
  result.payload.lockSlots = result.lockSlots;
  return result;
}

export function rerollCasinoPair(rng, stakeKey, luck, unlockedSkins = [], pending = {}) {
  const symbols = Array.isArray(pending.symbols) ? pending.symbols.slice(0, 3).map(casinoCleanSymbol) : ['BAD','BAD','BAD'];
  while (symbols.length < 3) symbols.push('BAD');
  const oddSlot = Math.max(0, Math.min(2, Number(pending.oddSlot || 0) | 0));
  const known = new Set(Array.isArray(unlockedSkins) ? unlockedSkins : []);
  const hasLockedSkin = SKIN_PRESETS.some(s => s.rarity !== 'basic' && !known.has(s.id));
  const raw = casinoWeightedDraw(rng, stakeKey, luck, hasLockedSkin, stakeKey === 'high' && rng() < 0.18 ? 'premium' : 'normal');
  symbols[oddSlot] = raw;
  const slotLocks = Array.isArray(pending.slotLocks) ? pending.slotLocks.slice(0, 3).map(casinoCleanSymbol) : ['', '', ''];
  const cells = symbols.map((symbol, slot) => ({ slot, raw: symbol, symbol, locked: slotLocks[slot] ? 1 : 0, rerolled: slot === oddSlot ? 1 : 0 }));
  const result = evaluateCasinoSymbols(rng, stakeKey, symbols, pending.stake || BET_STAKES[stakeKey], unlockedSkins, cells, { slotLocks, luck, allowPairDecision: false });
  result.usedLock = slotLocks.some(Boolean);
  result.lockSymbol = slotLocks.filter(Boolean).join('+');
  result.lockSlots = slotLocks;
  result.payload.lockSlots = slotLocks;
  result.payload.rerolled = 1;
  result.payload.rerollSlot = oddSlot;
  return result;
}

// ---- room modifiers (rule events, not stat tweaks) ----------------------
export const ROOM_MODS = {
  blackout:        { id: 'blackout',        label: 'BLACKOUT' },
  static_rain:     { id: 'static_rain',     label: 'STATIC STORM' },
  greed:           { id: 'greed',           label: 'GOLD FEVER' },
  hunter_contract: { id: 'hunter_contract', label: 'HUNTER WAVES' },
  casino_virus:    { id: 'casino_virus',    label: 'CASINO VIRUS' },
  moving_room:     { id: 'moving_room',     label: 'SHIFTING ZONES' },
  prism_grid:      { id: 'prism_grid',      label: 'PRISM GRID' },
  blood_tax:       { id: 'blood_tax',       label: 'BLOOD PAYMENT' },
  echo_walls:      { id: 'echo_walls',      label: 'ECHO SHOTS' },
  skin_cache:      { id: 'skin_cache',      label: 'SKN CACHE' }
};

// Backward-compatible alias for UI modules that use the setting name after the locale pass.
export const SECTOR_MODS = ROOM_MODS;

export const ROOM_SEQUENCE = ['grid', 'void', 'core', 'boss'];
export const SPECIAL_ROOMS = {
  signal_contract: { id: 'signal_contract', label: 'SIGNAL CONTRACT' },
  reward_pocket:   { id: 'reward_pocket',   label: 'REWARD POCKET' },
  debt_node:       { id: 'debt_node',       label: 'STATIC NODE' },
  chill_room:      { id: 'chill_room',      label: 'CHILL ROOM' }
};
