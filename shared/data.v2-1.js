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
  impact_driver: {
    id: 'impact_driver', label: 'DRV', name: 'УДАРНЫЙ ДРАЙВЕР',
    cooldown: 0, pellets: 0, spread: 0, dmg: 0, speed: 0, life: 0, size: 0
  },
  impact_wall: {
    id: 'impact_wall', label: 'FWL', name: 'ВРЕМЕННЫЙ ФАЙРВОЛ',
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
  wall_jumper: { label: 'WJP', hp: 58, spd: 92, size: 26, dmg: 16, wallJumper: true, wallSpd: 132, leapSpd: 650, leapCd: 2.5, windup: 0.58, leapTime: 0.72, leapRange: 610, xp: 18, gld: 12, score: 3, role: 'wall ambush', combo: 'wall pressure' },
  glitch:   { label: 'GLT', hp: 34,   spd: 70,  size: 24, dmg: 16, blinks: true, blinkCd: 2.2, blinkRange: 230, strikeCd: 0.5, xp: 14, gld: 10, score: 2, role: 'backline disruptor', combo: 'ambush pressure' },
  slot_mob: { label: 'SLT', hp: 3060, spd: 200, size: 44, dmg: 15, slotMob: true, touch: true, fireCd: 1.25, bulletSpd: 281, xp: 26, gld: 32, score: 5, role: 'casino overload process', combo: 'slot corruption' },

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

  boss:     { label: 'OCT', hp: 2860, spd: 410, size: 92, dmg: 26, boss: true, armor: 0, fireCd: 2.6, bulletSpd: 230, xp: 160, gld: 140, score: 24, bossRole: 'ricochet laser array' },

  // boss rotation v2.1.19
  boss_croupier: { label: 'CRP', hp: 1207, spd: 52, size: 78, dmg: 24, boss: true, armor: 0.24, fireCd: 2.35, bulletSpd: 245, xp: 150, gld: 132, score: 22, bossRole: 'casino rules' },
  boss_anchor_cashier: { label: 'ANC+', hp: 1520, spd: 42, size: 82, dmg: 25, boss: true, armor: 0.30, fireCd: 2.60, bulletSpd: 215, fieldR: 430, pull: 190, xp: 154, gld: 136, score: 23, bossRole: 'gravity control' },
  boss_hunter_chorus: { label: 'HNT', hp: 1360, spd: 74, size: 74, dmg: 24, boss: true, armor: 0.20, fireCd: 2.15, bulletSpd: 270, xp: 152, gld: 128, score: 22, bossRole: 'hunter shell' },
  boss_hunter_duelist: { label: 'HNT-I', hp: 520, spd: 92, size: 54, dmg: 20, boss: true, bossFragment: true, armor: 0.12, fireCd: 1.65, bulletSpd: 245, xp: 58, gld: 50, score: 9, bossRole: 'hunter fragment' },
  boss_hunter_marksman: { label: 'HNT-II', hp: 460, spd: 64, size: 50, dmg: 18, boss: true, bossFragment: true, armor: 0.10, fireCd: 1.45, bulletSpd: 300, xp: 54, gld: 48, score: 9, bossRole: 'hunter fragment' },
  boss_hunter_trapper: { label: 'HNT-III', hp: 480, spd: 72, size: 52, dmg: 18, boss: true, bossFragment: true, armor: 0.10, fireCd: 2.05, bulletSpd: 235, xp: 56, gld: 48, score: 9, bossRole: 'hunter fragment' },
  boss_q_revisor: { label: 'RUSH', hp: 1460, spd: 68, size: 76, dmg: 25, boss: true, armor: 0.23, fireCd: 1.90, bulletSpd: 245, windup: 0.48, chargeSpd: 720, chargeTime: 0.52, chargeCd: 1.05, xp: 156, gld: 136, score: 23, bossRole: 'dash pressure' },
  boss_trinode: { label: 'TRI', hp: 6720, spd: 177.1, size: 62, dmg: 22, boss: true, armor: 0.18, fireCd: 0.16, bulletSpd: 285, xp: 160, gld: 140, score: 24, bossRole: 'sequential crawler' }
  ,root_node: { label: 'ROOT', hp: 520, spd: 0, size: 58, dmg: 0, armor: 0.16, fireCd: 999, bulletSpd: 0, xp: 0, gld: 0, score: 1, immobile: true, rootNode: true }
};

// which kinds can spawn at which loop
export const SPAWN_POOLS = [
  ['grunt', 'runner', 'shooter', 'charger'],
  ['grunt', 'runner', 'shooter', 'charger', 'bomber', 'bouncer', 'splitter'],
  ['grunt', 'runner', 'shooter', 'charger', 'bomber', 'bouncer', 'wall_jumper', 'tank', 'glitch', 'anchor', 'leech', 'pulse', 'damper', 'warden'],
  ['grunt', 'runner', 'shooter', 'charger', 'bomber', 'bouncer', 'wall_jumper', 'tank', 'glitch', 'echo', 'orbiter', 'anchor', 'splitter', 'prism', 'pulse', 'leech', 'damper', 'warden', 'herald']
];

// ---- upgrades (INSTALL) -------------------------------------------------
// All stackable. No caps. Balatro rules.
export const UPGRADES = [
  { id: 'dmg',      label: 'DMG +15%',             tier: 0, desc: 'Весь исходящий урон растёт, включая подконтрольные процессы Контролёра.', apply: s => { s.dmgMul *= 1.15; } },
  { id: 'fire',     label: 'WEAPON CLOCK +12%',    tier: 0, desc: 'Оружейный такт ускоряет перезарядку всего оружия каждого героя, включая SAW и подконтрольные стрелковые процессы.', apply: s => { s.fireMul *= 1.12; } },
  { id: 'spd',      label: 'SPD +8%',              tier: 0, desc: 'Скорость движения растёт.', apply: s => { s.spdMul *= 1.08; } },
  { id: 'maxhp',    label: 'HP +20',               tier: 0, desc: 'Максимальное здоровье растёт.', apply: s => { s.maxHpAdd += 20; } },
  { id: 'magnet',   label: 'MAGNET +40%',          tier: 0, desc: 'Подборы притягиваются дальше.', apply: s => { s.magnetMul *= 1.4; } },
  { id: 'dash',     label: 'DASH +1',              tier: 1, desc: 'Больше зарядов рывка.', apply: s => { s.dashAdd += 1; } },
  { id: 'dash_length', label: 'DASH LENGTH +18%', tier: 1, desc: 'Рывок проходит дальше.', apply: s => { s.dashDistMul *= 1.18; } },
  { id: 'drone',    label: 'DRONE +1',             tier: 1, desc: 'Добавляет автостреляющего спутника.', apply: s => { s.drones += 1; } },
  { id: 'luck',     label: 'LUCK +1',              tier: 1, desc: 'Лучше исходы улучшений и казино.', apply: s => { s.luck += 1; } },
  { id: 'proc',     label: 'BLAST CHANCE 10%',     tier: 1, desc: 'Выстрелы героя и стрелковых процессов могут создавать маленький взрыв. Дронам нужен DRONE BLAST.', apply: s => { s.procBlast += 0.10; } },
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
  { id: 'sig_ghost_decoy', label: 'GHOST DECOY', tier: 1, bossSig: true, desc: 'R: антивирус надолго скрывается, а приманка отвлекает угрозы.', apply: s => { if (s.rActiveId === 'ghost_decoy') s.rActiveStacks += 1; else { s.rActiveId = 'ghost_decoy'; s.rActiveStacks = 1; } } },
  { id: 'sig_rewind_mark', label: 'REWIND MARK', tier: 1, bossSig: true, desc: 'R: ставит точку возврата. Повторное R возвращает назад и оглушает угрозы рядом.', apply: s => { if (s.rActiveId === 'rewind_mark') s.rActiveStacks += 1; else { s.rActiveId = 'rewind_mark'; s.rActiveStacks = 1; } } },
  { id: 'sig_kill_switch', label: 'KILL SWITCH', tier: 2, bossSig: true, desc: 'R: каждое применение стирает угрозы на экране, включая главную угрозу. MIRROR PAYOUT добавляет ещё одно применение без ограничения числа зарядов.', apply: s => { if (!s.killSwitchTaken) { s.killSwitchTaken = 1; s.rActiveId = 'kill_switch'; s.rActiveStacks = 1; s.killSwitchCharge = Math.max(0, s.killSwitchCharge || 0) + 1; } else if (s.rActiveId === 'kill_switch') { s.rActiveStacks = Math.max(1, s.rActiveStacks || 1) + 1; s.killSwitchCharge = Math.max(0, s.killSwitchCharge || 0) + 1; } } },
  { id: 'sig_spawn_hold', label: 'SPAWN HOLD', tier: 1, bossSig: true, desc: 'Поля предупреждения появления держатся дольше. Повторы усиливают задержку входа угроз.', apply: s => { s.spawnHoldStacks += 1; } },
  { id: 'sig_aegis_process', label: 'AEGIS PROCESS', tier: 1, bossSig: true, desc: 'Антивирус получает защитный слой оболочки. Повторы увеличивают запас защиты.', apply: s => { s.aegisStacks += 1; } },
  { id: 'sig_mirror_payout', label: 'MIRROR PAYOUT', tier: 1, bossSig: true, desc: 'Копирует следующий усиливаемый приз с выбором. Не копирует саму себя. Заряд возвращается после победы над главной угрозой.', apply: s => { s.mirrorCapacity += 1; } },
  { id: 'sig_null_revival', label: 'NULL REVIVAL', tier: 2, bossSig: true, desc: 'Резервное восстановление. При сбое возвращает игрока с 45% здоровья. Повторы дают ещё один заряд.', apply: s => { s.nullRevives += 1; } },
  { id: 'sig_boss_key', label: 'BOSS KEY', tier: 1, bossSig: true, desc: 'Первый сундук с выбором в цикле бесплатно становится максимальной редкости. Повторы дают ещё один ключ.', apply: s => { s.bossKeys += 1; } },

  // weapon branches. These are WPN-chest rewards only, not INSTALL rewards.
  { id: 'bullet_ricochet', label: 'ОТСКОК СНАРЯДОВ +1', tier: 1, branch: 'ALL', desc: 'Все твои снаряды получают дополнительный отскок от стен. Повторные выборы дают больше отскоков.', apply: s => { s.bulletBounce += 1; } },
  { id: 'bullet_range',    label: 'ДАЛЬНОСТЬ ОРУЖИЯ +22%',  tier: 1, branch: 'ALL', desc: 'Увеличивает дальность оружия, автооружия Живого казино и протоколов Контроллера.', apply: s => { s.bulletRange *= 1.22; } },
  { id: 'bullet_fire',     label: 'ТЕРМО-СБОЙ СНАРЯДОВ', tier: 1, branch: 'ALL', desc: 'Снаряды перегревают угрозы и наносят периодический урон.', apply: s => { s.bulletFire += 1; } },
  { id: 'bullet_freeze',   label: 'КРИО-СБОЙ СНАРЯДОВ', tier: 1, branch: 'ALL', desc: 'Снаряды охлаждают угрозы и могут коротко остановить их.', apply: s => { s.bulletFreeze += 1; } },
  { id: 'bullet_poison',   label: 'КОРРОЗИЯ СНАРЯДОВ', tier: 1, branch: 'ALL', desc: 'Снаряды заражают угрозы коррозией. Каждый уровень быстрее разрушает броню и усиливает периодический урон.', apply: s => { s.bulletPoison += 1; } },
  { id: 'drone_element_link', label: 'КАНАЛ СПУТНИКОВ', tier: 1, branch: 'ALL', desc: 'Спутники отдельно переносят термо-, крио- и коррозийные сбои снарядов.', apply: s => { s.droneElementLink += 1; } },
  { id: 'element_amp', label: 'СТАТУСНЫЙ СБОЙ +25%', tier: 1, branch: 'ALL', desc: 'Усиливает термо-, крио- и коррозийные сбои.', apply: s => { s.bulletElementAmp += 1; } },
  { id: 'element_spread', label: 'ПЕРЕНОС СБОЯ', tier: 1, branch: 'ALL', desc: 'Удаление угрозы переносит статусный сбой на ближайшие цели.', apply: s => { s.elementSpread += 1; } },
  { id: 'bullet_chain', label: 'СВЯЗЬ СНАРЯДОВ +1', tier: 1, branch: 'ALL', desc: 'Попадание оружием связывает ближайшие угрозы. Повторные выборы продлевают цепь.', apply: s => { s.bulletChain += 1; } },
  { id: 'bullet_chain_status_link', label: 'СТАТУСНЫЙ КАНАЛ СВЯЗИ', tier: 1, branch: 'ALL', desc: 'Связь снарядов переносит любые текущие и будущие оружейные статусы.', apply: s => { s.bulletChainStatuses = 1; } },
  { id: 'impact_damage', label: 'DRV: УДАР +25%', tier: 1, branch: 'IMPACT', desc: 'Усиливает удар при взлёте, приземление и след удара.', apply: s => { s.jumpImpactDamage += 1; } },
  { id: 'impact_radius', label: 'DRV: КОНТУР +18', tier: 1, branch: 'IMPACT', desc: 'Увеличивает точный радиус ударов при взлёте и приземлении.', apply: s => { s.jumpImpactRadius += 1; } },
  { id: 'impact_cycle', label: 'DRV: ПЕРЕЗАПУСК +14%', tier: 1, branch: 'IMPACT', desc: 'Сокращает паузу перед следующим прыжком.', apply: s => { s.jumpRecovery += 1; } },
  { id: 'impact_stun', label: 'DRV: ЖЁСТКАЯ ПОСАДКА', tier: 1, branch: 'IMPACT', desc: 'Приземление оглушает угрозы. Повторы увеличивают длительность.', apply: s => { s.jumpStun += 1; } },
  { id: 'impact_afterfield', label: 'DRV: СЛЕД УДАРА', tier: 1, branch: 'IMPACT', desc: 'На месте приземления остаётся короткий наносящий урон контур. Повторы усиливают его.', apply: s => { s.jumpAfterfield += 1; } },
  { id: 'impact_rebound', label: 'DRV: УПРУГИЙ КОНТУР', tier: 1, branch: 'IMPACT', desc: 'Отскоки от стен сохраняют больше скорости, а полёт длится дольше.', apply: s => { s.jumpRebound += 1; } },
  { id: 'impact_wall_unlock', label: 'DRV: ФАЙРВОЛ', tier: 1, branch: 'IMPACT', desc: 'Открывает ЛКМ-модуль: ставит одну временную стену в свободной достижимой точке.', apply: s => { s.impactWallUnlocked = 1; } },
  { id: 'impact_wall_count', label: 'DRV: ФАЙРВОЛ +1', tier: 1, branch: 'IMPACT', desc: 'Позволяет одновременно держать ещё одну временную стену.', apply: s => { s.impactWallCount += 1; } },
  { id: 'impact_wall_duration', label: 'DRV: СРОК ФАЙРВОЛА +25%', tier: 1, branch: 'IMPACT', desc: 'Каждый уровень увеличивает срок существования временных стен.', apply: s => { s.impactWallDuration += 1; } },
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
  { id: 'q_snap',    label: 'Q: FIELD SNAP',      tier: 1, branch: 'Q', desc: 'Q стягивает угрозы, надолго оглушает их и оставляет поле без урона.', apply: s => { s.activeSnap += 1; } },
  { id: 'q_blood',   label: 'Q: BLOOD PULSE',     tier: 1, branch: 'Q', desc: 'Q тратит HP на красный сигнальный взрыв.', apply: s => { s.activeBlood += 1; } },
  { id: 'q_over',    label: 'Q: OVERCLOCK',       tier: 1, branch: 'Q', desc: 'Q временно ускоряет стрельбу.', apply: s => { s.activeOver += 1; } },

  // high rarity rule-breakers
  { id: 'droneproc', label: 'DRONE BLAST CHANCE',  tier: 2, desc: 'Пули дронов иногда создают маленькие взрывы.', apply: s => { s.droneProc += 1; } },
  { id: 'debtengine',label: 'STATIC CORE',         tier: 2, cursed: true, desc: 'Большой урон и удача, но каждый стак добавляет 3 уровня Статик-шторма. Контрактное очищение навсегда глушит шторм ядра.', apply: s => { s.dmgMul *= 1.35; s.luck += 2; s.debtEngine += 1; } },
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
  { id: 'ctrl_process_power', label: 'CTRL: КОНТРОЛЬ +', branch: 'CTRL', tier: 1, desc: 'Команды быстрее заполняют захват цели; все атаки процессов становятся сильнее.', apply: s => { s.ctrlPower += 1; } },
  { id: 'ctrl_capture_tier', label: 'CTRL: АССИМИЛЯЦИЯ +', branch: 'CTRL', tier: 1, desc: 'Расширяет пул захвата: I — стойкие и сбойные, II — дальние и полевые, III — дирижёры роя, IV — боссы.', apply: s => { s.ctrlCaptureTier += 1; } },
  { id: 'ctrl_process_fire', label: 'CTRL: ТЕМП АТАК +', branch: 'CTRL', tier: 1, desc: 'Подконтрольные процессы атакуют чаще.', apply: s => { s.ctrlFire += 1; } },
  { id: 'saw_fallback_damage', label: 'SAW: АВАРИЙНЫЙ РАЗБОР', branch: 'CTRL', tier: 2, desc: 'SAW наносит урон целям, которые сейчас невозможно перехватить.', apply: s => { s.sawFallbackDamage = 1; } },
  { id: 'ctrl_process_contact_status', label: 'CTRL: ЖИВОЙ СНАРЯД', branch: 'CTRL', tier: 1, desc: 'Телесные атаки процессов переносят любые текущие и будущие оружейные статусы.', apply: s => { s.ctrlProcessContactStatus = 1; } },
  { id: 'ctrl_process_life', label: 'CTRL: СРОК +', branch: 'CTRL', tier: 1, desc: 'Подконтрольные процессы живут дольше. Срок также зависит от максимального HP процесса до захвата.', apply: s => { s.ctrlLife += 1; } },
  { id: 'ctrl_process_death_heal', label: 'CTRL: ВОЗВРАТ HP', branch: 'CTRL', tier: 1, desc: 'Гибель или завершение срока процесса лечит героя от его максимального HP. Стаки дают 2%, затем +3%, +4% и дальше.', apply: s => { s.ctrlDeathHeal += 1; } },
  { id: 'ctrl_process_persist', label: 'CTRL: ПЕРЕНОС', branch: 'CTRL', tier: 2, desc: 'Подконтрольные процессы не очищаются у портала и аккуратно переносятся в следующий сектор.', apply: s => { s.ctrlPersist += 1; } },
  { id: 'qrn_radius', label: 'QRN: ДАЛЬНОСТЬ +', branch: 'QRN', tier: 1, desc: 'Карантинный якорь цепляет процессы дальше от маркера.', apply: s => { s.qrRadius += 1; } },
  { id: 'qrn_hold', label: 'QRN: УДЕРЖАНИЕ +', branch: 'QRN', tier: 1, desc: 'Каждый уровень сильно увеличивает срок работы якоря.', apply: s => { s.qrHold += 1; } },
  { id: 'qrn_links', label: 'QRN: ЗАХВАТ +3', branch: 'QRN', tier: 1, desc: 'Добавляет 3 одновременных захвата. Предел одного якоря — 20 угроз.', apply: s => { s.qrLinks += 1; } },
  { id: 'qrn_damage', label: 'QRN: РАЗРЯД +', branch: 'QRN', tier: 1, desc: 'Каждый уровень заметно усиливает урон и ускоряет разряды цепей.', apply: s => { s.qrDamage += 1; } },
];

export const UPGRADE_LABELS = Object.fromEntries(UPGRADES.map(u => [u.id, u.label]));
export const CURSED_UPGRADE_IDS = UPGRADES.filter(u => u.cursed).map(u => u.id);

// INSTALL upgrades are HERO ONLY.
// Weapon-specific branches live in WPN chest choices, not INSTALL offers.
export const WEAPON_BRANCHES = ['ALL', 'SHG', 'SEK', 'RKT', 'RLT', 'CRD', 'CTRL', 'QRN', 'IMPACT'];
export const HERO_UPGRADES = UPGRADES.filter(u => !u.bossSig && !WEAPON_BRANCHES.includes(u.branch) && u.branch !== 'Q');
export const BOSS_SIGNATURE_UPGRADE_IDS = UPGRADES.filter(u => u.bossSig).map(u => u.id);
export const WEAPON_UPGRADE_IDS = UPGRADES.filter(u => WEAPON_BRANCHES.includes(u.branch)).map(u => u.id);

export const WEAPON_CHEST_REWARDS = [
  { id: 'weapon_shotgun', kind: 'weapon', weapon: 'shotgun', label: 'SHG WEAPON', desc: 'Открывает клиновой разряд: короткий веер очистки с зарядами.' },
  { id: 'weapon_seeker', kind: 'weapon', weapon: 'seeker', label: 'SEK WEAPON', desc: 'Открывает искатель: медленный сигнальный снаряд, который сам держит цель.' },
  { id: 'weapon_rocketgun', kind: 'weapon', weapon: 'rocketgun', label: 'RKT WEAPON', desc: 'Открывает разломный заряд: тяжёлый снаряд с широким взрывом.' },
  { id: 'ctrl_unlock_qrn', kind: 'weapon', weapon: 'quarantine_anchor', label: 'QRN: ЯКОРЬ', desc: 'Открывает карантинный якорь: ставится на полу или цепляется за стену и удерживает до 5 угроз.' },
  { id: 'ctrl_unlock_saw', kind: 'weapon', weapon: 'process_saw', label: 'SAW: РАЗБОР', desc: 'Открывает массовый разбор: большой импульс по области курсора быстро перехватывает несколько процессов.' },
  { id: 'bullet_ricochet', kind: 'weapon_upgrade', upgrade: 'bullet_ricochet', label: 'ОТСКОК СНАРЯДОВ +1', desc: 'Все снаряды получают дополнительный отскок от стен.' },
  { id: 'bullet_range', kind: 'weapon_upgrade', upgrade: 'bullet_range', label: 'ДАЛЬНОСТЬ ОРУЖИЯ +22%', desc: 'Увеличивает дальность оружия, автооружия Живого казино и протоколов Контроллера.' },
  { id: 'bullet_fire', kind: 'weapon_upgrade', upgrade: 'bullet_fire', label: 'ТЕРМО-СБОЙ СНАРЯДОВ', desc: 'Снаряды перегревают угрозы.' },
  { id: 'bullet_freeze', kind: 'weapon_upgrade', upgrade: 'bullet_freeze', label: 'КРИО-СБОЙ СНАРЯДОВ', desc: 'Снаряды охлаждают угрозы и могут коротко остановить их.' },
  { id: 'bullet_poison', kind: 'weapon_upgrade', upgrade: 'bullet_poison', label: 'КОРРОЗИЯ СНАРЯДОВ', desc: 'Снаряды заражают угрозы коррозией. Каждый уровень быстрее разрушает броню.' },
  { id: 'drone_element_link', kind: 'weapon_upgrade', upgrade: 'drone_element_link', label: 'КАНАЛ СПУТНИКОВ', desc: 'Спутники отдельно переносят статусные сбои снарядов.' },
  { id: 'element_amp', kind: 'weapon_upgrade', upgrade: 'element_amp', label: 'СТАТУСНЫЙ СБОЙ +25%', desc: 'Термо-, крио- и коррозийные сбои держатся дольше и бьют сильнее.' },
  { id: 'element_spread', kind: 'weapon_upgrade', upgrade: 'element_spread', label: 'ПЕРЕНОС СБОЯ', desc: 'Статусные сбои с удалённых угроз переходят на ближайшие цели.' },
  { id: 'bullet_chain', kind: 'weapon_upgrade', upgrade: 'bullet_chain', label: 'СВЯЗЬ СНАРЯДОВ +1', desc: 'Попадание оружием передаёт часть урона дальше. Статусы сами по цепи не переходят.' },
  { id: 'bullet_chain_status_link', kind: 'weapon_upgrade', upgrade: 'bullet_chain_status_link', label: 'СТАТУСНЫЙ КАНАЛ СВЯЗИ', desc: 'Связь снарядов переносит любые текущие и будущие оружейные статусы.' },
  { id: 'impact_damage', kind: 'weapon_upgrade', upgrade: 'impact_damage', label: 'DRV: УДАР +25%', desc: 'Усиливает весь урон взлёта, приземления и следа.' },
  { id: 'impact_radius', kind: 'weapon_upgrade', upgrade: 'impact_radius', label: 'DRV: КОНТУР +18', desc: 'Расширяет точную область ударов.' },
  { id: 'impact_cycle', kind: 'weapon_upgrade', upgrade: 'impact_cycle', label: 'DRV: ПЕРЕЗАПУСК +14%', desc: 'Быстрее готовит следующий прыжок.' },
  { id: 'impact_stun', kind: 'weapon_upgrade', upgrade: 'impact_stun', label: 'DRV: ЖЁСТКАЯ ПОСАДКА', desc: 'Оглушает угрозы в области приземления.' },
  { id: 'impact_afterfield', kind: 'weapon_upgrade', upgrade: 'impact_afterfield', label: 'DRV: СЛЕД УДАРА', desc: 'Оставляет наносящий урон контур в точке посадки.' },
  { id: 'impact_rebound', kind: 'weapon_upgrade', upgrade: 'impact_rebound', label: 'DRV: УПРУГИЙ КОНТУР', desc: 'Лучше сохраняет импульс после столкновения со стеной.' },
  { id: 'impact_wall_unlock', kind: 'weapon_upgrade', upgrade: 'impact_wall_unlock', label: 'DRV: ФАЙРВОЛ', desc: 'Открывает установку одной временной стены на ЛКМ.' },
  { id: 'impact_wall_count', kind: 'weapon_upgrade', upgrade: 'impact_wall_count', label: 'DRV: ФАЙРВОЛ +1', desc: 'Ещё одна одновременно существующая временная стена.' },
  { id: 'impact_wall_duration', kind: 'weapon_upgrade', upgrade: 'impact_wall_duration', label: 'DRV: СРОК ФАЙРВОЛА +25%', desc: 'Временные стены существуют дольше.' },
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
  { id: 'ctrl_process_fire', kind: 'weapon_upgrade', upgrade: 'ctrl_process_fire', reqWeapon: 'process_saw', label: 'CTRL: ТЕМП АТАК +', desc: 'Подконтрольные процессы атакуют чаще.' },
  { id: 'saw_fallback_damage', kind: 'weapon_upgrade', upgrade: 'saw_fallback_damage', reqWeapon: 'process_saw', label: 'SAW: АВАРИЙНЫЙ РАЗБОР', desc: 'Если цель сейчас нельзя перехватить, импульс SAW наносит ей урон. Работает и при заполненных слотах.' },
  { id: 'ctrl_process_contact_status', kind: 'weapon_upgrade', upgrade: 'ctrl_process_contact_status', reqWeapon: 'command_pulse', label: 'CTRL: ЖИВОЙ СНАРЯД', desc: 'Укусы, касания, наскоки, прыжки и самоподрыв переносят любые текущие и будущие оружейные статусы.' },
  { id: 'ctrl_process_life', kind: 'weapon_upgrade', upgrade: 'ctrl_process_life', reqWeapon: 'command_pulse', label: 'CTRL: СРОК +', desc: 'Подконтрольные процессы живут дольше; цели с большим запасом прочности держат контроль дольше.' },
  { id: 'ctrl_process_death_heal', kind: 'weapon_upgrade', upgrade: 'ctrl_process_death_heal', reqWeapon: 'command_pulse', label: 'CTRL: ВОЗВРАТ HP', desc: 'Гибель или завершение срока процесса лечит от его максимального HP. Стаки: 2%, затем +3%, +4% и дальше.' },
  { id: 'ctrl_process_persist', kind: 'weapon_upgrade', upgrade: 'ctrl_process_persist', reqWeapon: 'command_pulse', label: 'CTRL: ПЕРЕНОС', desc: 'Подконтрольные процессы аккуратно переходят в следующий сектор.' },
  { id: 'qrn_radius', kind: 'weapon_upgrade', upgrade: 'qrn_radius', reqWeapon: 'quarantine_anchor', label: 'QRN: ДАЛЬНОСТЬ +', desc: 'Карантинный якорь цепляет угрозы дальше от маркера.' },
  { id: 'qrn_hold', kind: 'weapon_upgrade', upgrade: 'qrn_hold', reqWeapon: 'quarantine_anchor', label: 'QRN: УДЕРЖАНИЕ +', desc: 'Каждый уровень сильно увеличивает срок работы якоря.' },
  { id: 'qrn_links', kind: 'weapon_upgrade', upgrade: 'qrn_links', reqWeapon: 'quarantine_anchor', label: 'QRN: ЗАХВАТ +3', desc: 'Добавляет 3 одновременных захвата. Предел одного якоря — 20 угроз.' },
  { id: 'qrn_damage', kind: 'weapon_upgrade', upgrade: 'qrn_damage', reqWeapon: 'quarantine_anchor', label: 'QRN: РАЗРЯД +', desc: 'Каждый уровень заметно усиливает урон и ускоряет разряды цепей.' },
  { id: 'wpn_dmg', kind: 'stat', stat: 'dmg', label: 'УРОН ОРУЖИЯ +18%', desc: 'Усиливает урон всего оружия. У Контролёра усиливает урон подконтрольных процессов.' },
  { id: 'wpn_fire', kind: 'stat', stat: 'fire', label: 'ОРУЖЕЙНЫЙ ТАКТ +14%', desc: 'Ускоряет перезарядку всего оружия каждого героя, включая SAW и подконтрольные стрелковые процессы.' }
];


export const ACTIVE_CORES = {
  blood_ring: {
    id: 'blood_ring', label: 'BLOOD RING', short: 'RING', tone: 'red', role: 'FOLLOW DAMAGE',
    desc: 'Q сразу запускает кровавое кольцо вокруг героя.',
    upgrade: ['+большой радиус', '+длительность', '+сильнее урон']
  },
  field_snap: {
    id: 'field_snap', label: 'FIELD SNAP', short: 'SNAP', tone: 'cyan', role: 'PULL / CONTROL',
    desc: 'Q сразу стягивает и надолго оглушает ближайшие угрозы, затем оставляет поле без урона.',
    upgrade: ['+большой радиус', '+сильнее стяжка', '+дольше оглушение и поле']
  },
  bullet_freeze: {
    id: 'bullet_freeze', label: 'BULLET FREEZE', short: 'FREEZE', tone: 'cyan', role: 'FREEZE / CONTROL',
    desc: 'Q сразу запускает холодную ауру вокруг героя.',
    upgrade: ['+большой радиус', '+длительность', '+дольше примерзание']
  },
  shell_ripper: {
    id: 'shell_ripper', label: 'SHELL RIPPER', short: 'RIP', tone: 'purple', role: 'SHELL / ABILITY LOCK',
    desc: 'Q наносит меньше урона угрозам без брони, зато вдвое сильнее ломает броню и надолго отключает все способности, включая боссов.',
    upgrade: ['+большой радиус', '+сильнее ломает броню', '+дольше блокировка способностей']
  },
  void_cut: {
    id: 'void_cut', label: 'VOID CUT', short: 'CUT', tone: 'purple', role: 'BUILD LASER',
    desc: 'Первое Q ставит начало. Следующие Q прокладывают звенья луча.',
    upgrade: ['+1 точка связи', '++длина каждого сегмента', '+урон луча']
  },
  signal_spike: {
    id: 'signal_spike', label: 'SIGNAL SPIKE', short: 'SPIKE', tone: 'cyan', role: 'DEPLOY NODE',
    desc: 'Q сразу устанавливает шип в точку курсора.',
    upgrade: ['+1 заряд', '++дальность и радиус', '+длительность и урон']
  },
  black_box: {
    id: 'black_box', label: 'BLACK BOX', short: 'BOX', tone: 'purple', role: 'STEALTH / SAFE',
    desc: 'Q сразу раскрывает чёрный ящик вокруг героя. Улучшения сжимают зону обнаружения.',
    upgrade: ['−радиус обнаружения', '+длительность', '+дольше скрытие']
  },
  static_strike: {
    id: 'static_strike', label: 'STATIC STRIKE', short: 'STRIKE', tone: 'cyan', role: 'CURSOR STRIKE',
    desc: 'Q помечает точку курсора. После задержки светлый шторм один раз бьёт все угрозы, чьи корпуса касаются зоны, и не оставляет поле.',
    upgrade: ['+урон', '+быстрее восстановление', '+диаметр']
  },
  debt_pulse: {
    id: 'debt_pulse', label: 'STATIC PULSE', short: 'STC', tone: 'red', role: 'BURST / EXPOSE',
    desc: 'Q сразу запускает статик-волну вокруг героя. Каждый уровень увеличивает урон предыдущего на 25%. Сама Q не создаёт статик-долг.',
    upgrade: ['+огромный радиус', '+25% урона за уровень', '+сильнее уязвимость']
  }
};

export const ACTIVE_MUTATIONS = {
  static: { id: 'static', label: 'STATIC', tone: 'cyan', role: 'FIELD', stackable: true, desc: 'Q оставляет замедляющее статик-поле.' },
  blood: { id: 'blood', label: 'BLOOD', tone: 'red', role: 'DAMAGE', stackable: true, desc: 'Q получает кровавый урон; часть применений стоит здоровье.' },
  echo: { id: 'echo', label: 'ECHO', tone: 'purple', role: 'RECAST', stackable: true, desc: 'Q повторяется слабее после короткой паузы.' },
  shrapnel: { id: 'shrapnel', label: 'SHRAPNEL', tone: 'cyan', role: 'BULLETS', stackable: true, desc: 'Q выпускает дополнительные снаряды.' },
  casino: { id: 'casino', label: 'CASINO', tone: 'green', role: 'POST-ROLL', stackable: false, desc: 'После Q может сработать казино-проверка.' },
  void: { id: 'void', label: 'VOID', tone: 'purple', role: 'PHASE', stackable: true, desc: 'Q даёт короткое окно неуязвимости.' },
  leech: { id: 'leech', label: 'LEECH', tone: 'green', role: 'SUSTAIN', stackable: true, desc: 'Попадания Q могут вернуть здоровье или кредиты.' },
  armor_crack: { id: 'armor_crack', label: 'ARMOR BREAK', tone: 'purple', role: 'AREA / SHELL', stackable: true, desc: 'Во всей зоне Q проходит мощный удар только по броне угроз.' },
  anchor: { id: 'anchor', label: 'ANCHOR', tone: 'purple', role: 'LOCK ZONE', stackable: true, desc: 'Q оставляет область, которая тянет угроз и тормозит пули.' },
  hunger: { id: 'hunger', label: 'HUNGER', tone: 'red', role: 'LOW HP BURST', stackable: true, desc: 'Q наносит небольшой урон вокруг героя. Чем меньше HP было при активации, тем сильнее импульс.' },
  bad_tape: { id: 'bad_tape', label: 'BAD TAPE', tone: 'purple', role: 'GLITCH REPEAT', stackable: true, desc: 'Q повторяется двумя слабыми сбоями.' }
};

// Compatibility export for older modules. Mutation ownership itself is no
// longer slot-limited; every distinct mutation can coexist.
export const ACTIVE_MUTATION_SLOTS = Number.POSITIVE_INFINITY;

// Repeatable ABL side rewards. Dash upgrades belong to INSTALL and must not be duplicated here.
export const ABILITY_CHEST_REWARDS = [
  { id: 'abl_active_recovery', kind: 'stat', stat: 'active_recovery', label: 'Q RECOVERY +20%', desc: 'Активный протокол восстанавливается быстрее.' }
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
    dashAdd: 0, dashRegenMul: 1, dashDistMul: 1, activeRegenMul: 1, drones: 0, orbitals: 0, luck: 0,
    procBlast: 0, echoShot: 0, lifesteal: 0, goldMul: 1,
    bulletBounce: 0, bulletRange: 1, bulletFire: 0, bulletFreeze: 0, bulletPoison: 0, bulletChain: 0, bulletChainStatuses: 0, droneElementLink: 0, bulletElementAmp: 0, elementSpread: 0, shgBounce: 0, shgPellets: 0, shgLongshot: 0, sekSplit: 0, sekChain: 0, sekSwarm: 0, rktCluster: 0, rktMines: 0, rktStun: 0, rktScatter: 0, rktRemote: 0, rltBounce: 0, rltZero: 0, rltDmg: 0, rltSize: 0, rltFrag: 0, rltDepth: 0, rltWallBuff: 0, rltSpeed: 0, crdCards: 0, crdDmg: 0, crdBounce: 0, ctrlMax: 0, ctrlPower: 0, ctrlCaptureTier: 0, ctrlFire: 0, sawFallbackDamage: 0, ctrlProcessContactStatus: 0, ctrlLife: 0, ctrlDeathHeal: 0, ctrlPersist: 0, qrRadius: 0, qrHold: 0, qrLinks: 0, qrDamage: 0,
    voidStep: 0, dashCut: 0, dashClone: 0,
    jumpImpactDamage: 0, jumpImpactRadius: 0, jumpRecovery: 0, jumpStun: 0, jumpAfterfield: 0, jumpRebound: 0,
    impactWallUnlocked: 0, impactWallCount: 0, impactWallDuration: 0,
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
const CASINO_PAY_SYMBOLS = new Set(['JCK','RAR','WPN','ABL','SKN','GLD','EXP','HEA','STC','BAD']);
function casinoCleanSymbol(s = '') {
  const x = String(s || '').toUpperCase().replace(/\s+X\d+$/i, '').trim();
  return CASINO_PAY_SYMBOLS.has(x) ? x : '';
}
export function casinoSymbolAllowedForStake(symbol = '', stakeKey = 'low') {
  const clean = casinoCleanSymbol(symbol);
  if (!clean) return false;
  if (clean === 'RAR') return stakeKey === 'high';
  return !(stakeKey === 'low' && (clean === 'WPN' || clean === 'ABL'));
}
function casinoMatch(symbols = []) {
  const clean = symbols.map(casinoCleanSymbol);
  const counts = new Map();
  for (const s of clean) if (s) counts.set(s, (counts.get(s) || 0) + 1);
  const triple = [...counts.entries()].find(([,n]) => n >= 3)?.[0] || '';
  const pair = triple || [...counts.entries()].find(([,n]) => n === 2)?.[0] || '';
  return { clean, triple, pair };
}
function casinoAdd(payload, key, value = 1) {
  payload[key] = Math.max(0, Number(payload[key] || 0)) + value;
}
function casinoApplyMatchReward(payload, symbol, count, stake, rng, stakeKey, luck, unlockedSkins) {
  const triple = count >= 3;
  switch (symbol) {
    case 'GLD': casinoAdd(payload, 'gld', Math.round(stake * (triple ? (1.35 + rng() * 0.75) : (1.10 + rng() * 0.20)))); casinoAdd(payload, 'gldCount', count); break;
    case 'EXP': casinoAdd(payload, 'xp', Math.round(stake * (triple ? 0.82 : 0.40))); casinoAdd(payload, 'xpCount', count); break;
    case 'HEA': casinoAdd(payload, 'heal', triple ? (24 + Math.round(rng() * 22)) : (14 + Math.round(rng() * 12))); casinoAdd(payload, 'healCount', count); break;
    case 'WPN':
      payload.weapon = true;
      if (triple) casinoAdd(payload, 'weaponUpgradeCount', 1);
      else casinoAdd(payload, 'weaponPairDamage', 1);
      break;
    case 'ABL': payload.ability = true; casinoAdd(payload, 'abilityCount', 1); break;
    case 'RAR': payload.rare = true; casinoAdd(payload, 'rareCount', 1); break;
    case 'SKN': {
      casinoAdd(payload, 'skinCount', 1);
      const skin = rollCasinoSkin(rng, stakeKey, luck, unlockedSkins);
      payload.skin = true; payload.skinId = skin.id; payload.skinLabel = skin.name; payload.skinRarity = skin.rarity;
      break;
    }
    case 'STC': payload.static = true; casinoAdd(payload, 'staticCount', 1); break;
    case 'JCK':
      payload.jackpotCount = count;
      // Two JCK are a pure, large cash jackpot. Three JCK keep the larger
      // cash payout and additionally grant one full WPN, ABL and RAR prize.
      casinoAdd(payload, 'gld', Math.round(stake * (triple ? 5.0 : 4.0)));
      if (triple) {
        payload.weapon = true;
        casinoAdd(payload, 'weaponUpgradeCount', 1);
        payload.ability = true;
        casinoAdd(payload, 'abilityCount', 1);
        payload.rare = true;
        casinoAdd(payload, 'rareCount', 1);
      }
      break;
    case 'BAD': casinoAdd(payload, 'missCount', count); break;
  }
}
export function casinoPayloadHasReward(payload = {}) {
  return !!(payload.gld || payload.xp || payload.heal || payload.weapon || payload.weaponCount || payload.weaponUpgradeCount || payload.weaponPairDamage || payload.ability || payload.abilityCount || payload.rare || payload.rareCount || payload.skin || payload.skinCount || payload.jackpotCount);
}
export function spinCasino(rng, stakeKey, luck, unlockedSkins = [], opts = {}) {
  const stake = BET_STAKES[stakeKey];
  const l = Math.max(0, Number(luck || 0) || 0);
  const known = new Set(Array.isArray(unlockedSkins) ? unlockedSkins : []);
  const hasLockedSkin = SKIN_PRESETS.some(s => s.rarity !== 'basic' && !known.has(s.id));
  const high = stakeKey === 'high';
  const mid = stakeKey === 'mid';
  const slotLocks = Array.isArray(opts.slotLocks)
    ? opts.slotLocks.slice(0, 3).map(symbol => casinoSymbolAllowedForStake(symbol, stakeKey) ? casinoCleanSymbol(symbol) : '')
    : [];
  while (slotLocks.length < 3) slotLocks.push('');
  const lockChoices = () => {
    const base = high
      ? ['JCK','RAR','WPN','ABL','SKN','GLD','EXP','HEA','STC']
      : mid
        ? ['WPN','ABL','GLD','EXP','HEA','STC']
        : ['GLD','EXP','HEA','STC'];
    return base.filter(x => x !== 'SKN' || hasLockedSkin);
  };
  const drawLockPrize = () => {
    const pool = lockChoices();
    return pool[Math.floor(rng() * pool.length)] || 'GLD';
  };
  const drawCell = () => {
    const r = rng();
    const odds = [
      ['JCK', 0.0022 + (high ? 0.0058 : mid ? 0.0022 : 0) + l * 0.0032],
      ['RAR', high ? (0.017 + l * 0.0045) : 0],
      ['WPN', stakeKey === 'low' ? 0 : 0.010 + (high ? 0.010 : mid ? 0.006 : 0) + l * 0.0055],
      ['ABL', stakeKey === 'low' ? 0 : 0.012 + (high ? 0.008 : 0) + l * 0.0055],
      ['SKN', hasLockedSkin ? ((high ? 0.013 : mid ? 0.008 : 0.004) + l * 0.0026) : 0],
      ['LOCK', 0.035 + (mid ? 0.016 : high ? 0.024 : 0) + l * 0.0042],
      ['HEA', 0.045 + l * 0.0042],
      ['EXP', 0.055 + l * 0.0046],
      ['GLD', 0.065 + l * 0.0050],
      ['STC', Math.max(0.012, 0.105 + (high ? 0.045 : mid ? 0.020 : 0) - l * 0.0025)]
    ];
    let acc = 0;
    for (const [id, chance] of odds) { acc += chance; if (r < acc) return id; }
    return 'BAD';
  };
  const payload = { cellRewards: [], lockSlots: [] };
  const symbols = [];
  const nextLocks = slotLocks.slice(0, 3);
  let usedLock = false;
  let createdLock = false;
  let lockAnchorSymbol = slotLocks.map(casinoCleanSymbol).find(Boolean) || '';
  for (let i = 0; i < 3; i++) {
    const locked = casinoCleanSymbol(slotLocks[i]);
    if (locked) {
      const finalLocked = locked === 'SKN' && !hasLockedSkin ? (high ? 'RAR' : 'GLD') : locked;
      nextLocks[i] = finalLocked; symbols[i] = finalLocked; usedLock = true;
      if (!lockAnchorSymbol) lockAnchorSymbol = finalLocked;
      payload.cellRewards.push({ slot: i, raw: finalLocked, symbol: finalLocked, locked: 1 });
      continue;
    }
    const raw = drawCell();
    if (raw === 'LOCK') {
      const finalSymRaw = lockAnchorSymbol || drawLockPrize();
      const finalSym = finalSymRaw === 'SKN' && !hasLockedSkin ? (high ? 'RAR' : 'GLD') : finalSymRaw;
      lockAnchorSymbol = finalSym; nextLocks[i] = finalSym; symbols[i] = finalSym; createdLock = true;
      payload.cellRewards.push({ slot: i, raw: 'LOCK', symbol: finalSym, lockCreated: 1 });
    } else {
      const finalSym = raw === 'SKN' && !hasLockedSkin ? (high ? 'RAR' : 'GLD') : raw;
      nextLocks[i] = ''; symbols[i] = finalSym;
      payload.cellRewards.push({ slot: i, raw, symbol: finalSym });
    }
  }
  payload.lockSlots = nextLocks.slice(0, 3);
  const match = casinoMatch(symbols);
  const matchSymbol = match.triple || match.pair;
  const matchCount = match.triple ? 3 : match.pair ? 2 : 0;
  payload.tripleMatch = match.triple ? 1 : 0;
  payload.pairMatch = !match.triple && match.pair ? 1 : 0;
  payload.paySymbol = matchSymbol;
  if (!matchSymbol) payload.noMatch = 1;
  if (matchSymbol) casinoApplyMatchReward(payload, matchSymbol, matchCount, stake, rng, stakeKey, luck, unlockedSkins);
  if (createdLock) {
    payload.lock = true; payload.lockCreated = 1;
    const lockSummary = new Map();
    for (const c of payload.cellRewards.filter(c => c.lockCreated)) {
      const sym = String(c.symbol || '').toUpperCase().trim() || '—';
      lockSummary.set(sym, (lockSummary.get(sym) || 0) + 1);
    }
    payload.lockLabel = [...lockSummary.entries()].map(([sym, n]) => n > 1 ? `${sym} x${n}` : sym).join(' + ');
  }
  let outcome = 'LOSE';
  if (match.triple) {
    if (matchSymbol === 'JCK') outcome = 'JCK';
    else if (matchSymbol === 'STC') outcome = 'STC';
    else if (matchSymbol && matchSymbol !== 'BAD') outcome = matchSymbol;
  } else if (match.pair) outcome = matchSymbol === 'BAD' ? 'LOSE' : matchSymbol === 'STC' ? 'STC' : 'PAIR';
  else if (createdLock) outcome = 'LOCK';
  return { symbols, outcome, payload, stake, usedLock, lockSymbol: usedLock ? slotLocks.filter(Boolean).join('+') : '', lockSlots: nextLocks.slice(0, 3) };
}
export function rerollCasinoPair(rng, stakeKey, luck, unlockedSkins = [], pending = {}) {
  return spinCasino(rng, stakeKey, luck, unlockedSkins, { slotLocks: pending.slotLocks || [] });
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
  skin_cache:      { id: 'skin_cache',      label: 'SKN CACHE' },
  trojan:          { id: 'trojan',          label: 'TROJAN CHEST' }
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
