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
    id: 'impact_wall', label: 'FWL', name: 'КВАДРАТНЫЙ ФАЙРВОЛ',
    cooldown: 0, pellets: 0, spread: 0, dmg: 0, speed: 0, life: 0, size: 66
  },
  impact_push: {
    id: 'impact_push', label: 'PUSH', name: 'ВЕКТОР БЛОКА',
    cooldown: 0, pellets: 0, spread: 0, dmg: 40, speed: 520, life: 0, size: 0
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
  { id: 'fire',     label: 'WEAPON CLOCK +12%',    tier: 0, desc: 'Оружейный такт ускоряет циклы оружия, дронов, пушек Живого казино, протоколов Контроллера и Вектор блока Драйвера. Установка блоков, прыжки, Q и R не ускоряются.', apply: s => { s.fireMul *= 1.12; } },
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
  { id: 'sig_mirror_payout', label: 'MIRROR PAYOUT', tier: 1, bossSig: true, desc: 'Каждое готовое зеркало копирует следующий приз босса. Все готовые зеркала срабатывают вместе и восстанавливаются после следующего босса. Сам MIRROR PAYOUT не копируется.', apply: s => { s.mirrorCapacity += 1; } },
  { id: 'sig_null_revival', label: 'NULL REVIVAL', tier: 2, bossSig: true, desc: 'Резервное восстановление. При сбое возвращает игрока с 45% здоровья. Повторы дают ещё один заряд.', apply: s => { s.nullRevives += 1; } },
  { id: 'sig_boss_key', label: 'BOSS KEY', tier: 1, bossSig: true, desc: 'Первый сундук с выбором в цикле бесплатно становится максимальной редкости. Повторы дают ещё один ключ.', apply: s => { s.bossKeys += 1; } },

  // weapon branches. These are WPN-chest rewards only, not INSTALL rewards.
  { id: 'bullet_ricochet', label: 'ОТСКОК СНАРЯДОВ +1', tier: 1, branch: 'ALL', desc: 'Все твои снаряды получают дополнительный отскок от стен. Повторные выборы дают больше отскоков.', apply: s => { s.bulletBounce += 1; } },
  { id: 'bullet_range',    label: 'ДАЛЬНОСТЬ ОРУЖИЯ +22%',  tier: 1, branch: 'ALL', desc: 'Увеличивает дальность текущего и открытого позже оружия, включая пули дронов всех героев. У Драйвера увеличивает путь толчка и притягивания блока.', apply: s => { s.bulletRange *= 1.22; } },
  { id: 'bullet_fire',     label: 'ТЕРМО-СБОЙ СНАРЯДОВ', tier: 1, branch: 'ALL', desc: 'Снаряды перегревают угрозы и наносят периодический урон.', apply: s => { s.bulletFire += 1; } },
  { id: 'bullet_freeze',   label: 'КРИО-СБОЙ СНАРЯДОВ', tier: 1, branch: 'ALL', desc: 'Снаряды охлаждают угрозы и могут коротко остановить их.', apply: s => { s.bulletFreeze += 1; } },
  { id: 'bullet_poison',   label: 'КОРРОЗИЯ СНАРЯДОВ', tier: 1, branch: 'ALL', desc: 'Снаряды заражают угрозы коррозией. Каждый уровень быстрее разрушает броню и усиливает периодический урон.', apply: s => { s.bulletPoison += 1; } },
  { id: 'drone_element_link', label: 'КАНАЛ СПУТНИКОВ', tier: 1, branch: 'ALL', desc: 'Спутники отдельно переносят термо-, крио- и коррозийные сбои снарядов.', apply: s => { s.droneElementLink += 1; } },
  { id: 'element_amp', label: 'СТАТУСНЫЙ СБОЙ +25%', tier: 1, branch: 'ALL', desc: 'Усиливает термо-, крио- и коррозийные сбои.', apply: s => { s.bulletElementAmp += 1; } },
  { id: 'element_spread', label: 'ПЕРЕНОС СБОЯ', tier: 1, branch: 'ALL', desc: 'Удаление угрозы переносит статусный сбой на ближайшие цели.', apply: s => { s.elementSpread += 1; } },
  { id: 'bullet_chain', label: 'СВЯЗЬ СНАРЯДОВ +1', tier: 1, branch: 'ALL', desc: 'Попадание оружием связывает ближайшие угрозы. Повторные выборы продлевают цепь.', apply: s => { s.bulletChain += 1; } },
  { id: 'bullet_chain_status_link', label: 'СТАТУСНЫЙ КАНАЛ СВЯЗИ', tier: 1, branch: 'ALL', desc: 'Связь снарядов переносит любые текущие и будущие оружейные статусы.', apply: s => { s.bulletChainStatuses = 1; } },
  { id: 'impact_damage', label: 'DRV: УДАР +25%', tier: 1, branch: 'IMPACT', desc: 'Усиливает удар при взлёте, приземление и след удара.', apply: s => { s.jumpImpactDamage += 1; } },
  { id: 'impact_radius', label: 'DRV: КОНТУР +10%', tier: 1, branch: 'IMPACT', desc: 'Каждый уровень добавляет 10% базового радиуса ударов при взлёте и приземлении.', apply: s => { s.jumpImpactRadius += 1; } },
  { id: 'impact_distance', label: 'DRV: ДАЛЬНОСТЬ +20%', tier: 1, branch: 'IMPACT', desc: 'Каждый уровень увеличивает дальность прыжка, не меняя его базовую перезарядку.', apply: s => { s.jumpDistance += 1; } },
  { id: 'impact_stun', label: 'DRV: ЖЁСТКАЯ ПОСАДКА', tier: 1, branch: 'IMPACT', desc: 'Приземление оглушает угрозы. Повторы увеличивают длительность.', apply: s => { s.jumpStun += 1; } },
  { id: 'impact_afterfield', label: 'DRV: СЛЕД УДАРА', tier: 1, branch: 'IMPACT', desc: 'На месте приземления остаётся короткий наносящий урон контур. Повторы усиливают его.', apply: s => { s.jumpAfterfield += 1; } },
  { id: 'impact_rebound', label: 'DRV: УПРУГИЙ КОНТУР +25%', tier: 1, branch: 'IMPACT', desc: 'Открывает множитель отскоков. Каждый стак добавляет 25% дальности полёта после первого отскока от стены.', apply: s => { s.jumpRebound += 1; } },
  { id: 'impact_wall_unlock', label: 'DRV: ФАЙРВОЛ-БЛОК', tier: 1, branch: 'IMPACT', desc: 'Базовый SPACE-модуль Драйвера: ставит временный квадратный блок в точке курсора.', apply: s => { s.impactWallUnlocked = 1; } },
  { id: 'impact_wall_count', label: 'DRV: ФАЙРВОЛ-БЛОК +1', tier: 1, branch: 'IMPACT', desc: 'Позволяет одновременно держать ещё один квадратный блок.', apply: s => { s.impactWallCount += 1; } },
  { id: 'impact_wall_duration', label: 'DRV: СРОК БЛОКА +25%', tier: 1, branch: 'IMPACT', desc: 'Каждый уровень увеличивает срок существования квадратных блоков.', apply: s => { s.impactWallDuration += 1; } },
  { id: 'impact_push_unlock', label: 'DRV: ВЕКТОР БЛОКА', tier: 1, branch: 'IMPACT', desc: 'Без перезарядки: ЛКМ толкает выбранный блок, ПКМ притягивает блок, ближайший к курсору.', apply: s => { s.impactPushUnlocked = 1; } },
  { id: 'impact_push_range', label: 'PUSH: ПУТЬ +20%', tier: 1, branch: 'IMPACT', desc: 'Увеличивает путь толкнутого или притянутого блока на 20%. Выбор блока всегда доступен на любой дистанции.', apply: s => { s.impactPushRange += 1; } },
  { id: 'impact_push_damage', label: 'PUSH: УРОН +25%', tier: 1, branch: 'IMPACT', desc: 'Усиливает урон блока при прохождении сквозь угрозы. Стакается без ограничений.', apply: s => { s.impactPushDamage += 1; } },
  { id: 'impact_push_bounce', label: 'PUSH: РИКОШЕТ СТЕНЫ', tier: 1, branch: 'IMPACT', desc: 'Летящий блок начинает отскакивать от стен, пока не исчерпает дальность.', apply: s => { s.impactPushBounce = 1; } },
  { id: 'impact_push_multiplier', label: 'PUSH: МНОЖИТЕЛЬ ОТСКОКА +25%', tier: 1, branch: 'IMPACT', desc: 'Каждый отскок сильнее повышает урон летящего блока. Стакается без ограничений.', apply: s => { s.impactPushMultiplier += 1; } },
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
  { id: 'overload',  label: 'DMG +50% / MAX HP -15', tier: 2, cursed: true, desc: 'Урон +50%, максимум HP -15. Скорость движения и прыжка не меняется.', apply: s => { s.dmgMul *= 1.5; s.maxHpAdd -= 15; } },
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
  { id: 'bullet_range', kind: 'weapon_upgrade', upgrade: 'bullet_range', label: 'ДАЛЬНОСТЬ ОРУЖИЯ +22%', desc: 'Работает на всё текущее и открытое позже оружие, включая пули дронов всех героев. У Драйвера увеличивает путь толчка и притягивания блока.' },
  { id: 'bullet_fire', kind: 'weapon_upgrade', upgrade: 'bullet_fire', label: 'ТЕРМО-СБОЙ СНАРЯДОВ', desc: 'Снаряды перегревают угрозы.' },
  { id: 'bullet_freeze', kind: 'weapon_upgrade', upgrade: 'bullet_freeze', label: 'КРИО-СБОЙ СНАРЯДОВ', desc: 'Снаряды охлаждают угрозы и могут коротко остановить их.' },
  { id: 'bullet_poison', kind: 'weapon_upgrade', upgrade: 'bullet_poison', label: 'КОРРОЗИЯ СНАРЯДОВ', desc: 'Снаряды заражают угрозы коррозией. Каждый уровень быстрее разрушает броню.' },
  { id: 'drone_element_link', kind: 'weapon_upgrade', upgrade: 'drone_element_link', label: 'КАНАЛ СПУТНИКОВ', desc: 'Спутники отдельно переносят статусные сбои снарядов.' },
  { id: 'element_amp', kind: 'weapon_upgrade', upgrade: 'element_amp', label: 'СТАТУСНЫЙ СБОЙ +25%', desc: 'Термо-, крио- и коррозийные сбои держатся дольше и бьют сильнее.' },
  { id: 'element_spread', kind: 'weapon_upgrade', upgrade: 'element_spread', label: 'ПЕРЕНОС СБОЯ', desc: 'Статусные сбои с удалённых угроз переходят на ближайшие цели.' },
  { id: 'bullet_chain', kind: 'weapon_upgrade', upgrade: 'bullet_chain', label: 'СВЯЗЬ СНАРЯДОВ +1', desc: 'Попадание оружием передаёт часть урона дальше. Статусы сами по цепи не переходят.' },
  { id: 'bullet_chain_status_link', kind: 'weapon_upgrade', upgrade: 'bullet_chain_status_link', label: 'СТАТУСНЫЙ КАНАЛ СВЯЗИ', desc: 'Связь снарядов переносит любые текущие и будущие оружейные статусы.' },
  { id: 'impact_damage', kind: 'weapon_upgrade', upgrade: 'impact_damage', heroOnly: 'impact_driver', label: 'DRV: УДАР +25%', desc: 'Усиливает весь урон взлёта, приземления и следа.' },
  { id: 'impact_radius', kind: 'weapon_upgrade', upgrade: 'impact_radius', heroOnly: 'impact_driver', label: 'DRV: КОНТУР +10%', desc: 'Каждый уровень добавляет 10% базового радиуса ударов.' },
  { id: 'impact_distance', kind: 'weapon_upgrade', upgrade: 'impact_distance', heroOnly: 'impact_driver', label: 'DRV: ДАЛЬНОСТЬ +20%', desc: 'Каждый уровень увеличивает дальность прыжка без ускорения его перезарядки.' },
  { id: 'impact_stun', kind: 'weapon_upgrade', upgrade: 'impact_stun', heroOnly: 'impact_driver', label: 'DRV: ЖЁСТКАЯ ПОСАДКА', desc: 'Оглушает угрозы в области приземления.' },
  { id: 'impact_afterfield', kind: 'weapon_upgrade', upgrade: 'impact_afterfield', heroOnly: 'impact_driver', label: 'DRV: СЛЕД УДАРА', desc: 'Оставляет наносящий урон контур в точке посадки.' },
  { id: 'impact_rebound', kind: 'weapon_upgrade', upgrade: 'impact_rebound', heroOnly: 'impact_driver', label: 'DRV: УПРУГИЙ КОНТУР +25%', desc: 'Открывает множитель отскоков. Каждый стак даёт +25% дальности после первого отскока.' },
  { id: 'impact_wall_count', kind: 'weapon_upgrade', upgrade: 'impact_wall_count', heroOnly: 'impact_driver', label: 'DRV: ФАЙРВОЛ-БЛОК +1', desc: 'Ещё один одновременно существующий квадратный блок.' },
  { id: 'impact_wall_duration', kind: 'weapon_upgrade', upgrade: 'impact_wall_duration', heroOnly: 'impact_driver', label: 'DRV: СРОК БЛОКА +25%', desc: 'Квадратные блоки существуют дольше.' },
  { id: 'impact_push_range', kind: 'weapon_upgrade', upgrade: 'impact_push_range', heroOnly: 'impact_driver', label: 'PUSH: ПУТЬ +20%', desc: 'Увеличивает путь толкнутого или притянутого блока на 20%. Выбор блока всегда доступен на любой дистанции.' },
  { id: 'impact_push_damage', kind: 'weapon_upgrade', upgrade: 'impact_push_damage', heroOnly: 'impact_driver', label: 'PUSH: УРОН +25%', desc: 'Усиливает урон летящего блока. Без лимита.' },
  { id: 'impact_push_bounce', kind: 'weapon_upgrade', upgrade: 'impact_push_bounce', heroOnly: 'impact_driver', label: 'PUSH: РИКОШЕТ СТЕНЫ', desc: 'Открывает отскоки летящего блока от стен.' },
  { id: 'impact_push_multiplier', kind: 'weapon_upgrade', upgrade: 'impact_push_multiplier', heroOnly: 'impact_driver', label: 'PUSH: МНОЖИТЕЛЬ ОТСКОКА +25%', desc: 'Каждый отскок сильнее повышает урон блока. Без лимита.' },
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
  { id: 'wpn_fire', kind: 'stat', stat: 'fire', label: 'ОРУЖЕЙНЫЙ ТАКТ +14%', desc: 'Ускоряет оружейные циклы героев, дронов, Живого казино, Контроллера и Вектор блока Драйвера. Не ускоряет установку блоков, прыжки, Q или R.' }
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
    jumpImpactDamage: 0, jumpImpactRadius: 0, jumpDistance: 0, jumpStun: 0, jumpAfterfield: 0, jumpRebound: 0,
    impactWallUnlocked: 0, impactWallCount: 0, impactWallDuration: 0,
    impactPushUnlocked: 0, impactPushRange: 0, impactPushDamage: 0, impactPushBounce: 0, impactPushMultiplier: 0,
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
    payload.lockLabel = [...lockSummary.entries()].map(([sym, n]) => n > 1 ? `${sym} ×${n}` : sym).join(' + ');
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

// ---- complete bilingual player-facing catalog --------------------------
// Legacy label/name/desc fields remain untouched because snapshots and older
// clients can still carry them. UI code should prefer the explicit *Ru/*En
// fields below. Gameplay abbreviations (Q/R, SHG, WPN, GLD, etc.) are stable
// protocol glyphs; prose never relies on them as untranslated English words.
const WEAPON_TEXT = {
  shotgun: ['КЛИНОВОЙ РАЗРЯД', 'WEDGE DISCHARGE'], seeker: ['ИСКАТЕЛЬ', 'SEEKER'],
  rocketgun: ['РАЗЛОМНЫЙ ЗАРЯД', 'RIFT CHARGE'], living_casino: ['ЖИВОЕ КАЗИНО', 'LIVING CASINO'],
  control_sparks: ['ИСКРЫ КОНТРОЛЯ', 'CONTROL SPARKS'], impact_driver: ['УДАРНЫЙ ДРАЙВЕР', 'IMPACT DRIVER'],
  impact_wall: ['КВАДРАТНЫЙ ФАЙРВОЛ', 'SQUARE FIREWALL'], impact_push: ['ВЕКТОР БЛОКА', 'BLOCK VECTOR'],
  roulette: ['РУЛЕТКА', 'ROULETTE'], deck: ['КОЛОДА', 'DECK'],
  command_pulse: ['КОМАНДА ЗАХВАТА', 'CAPTURE COMMAND'], quarantine_anchor: ['КАРАНТИННЫЙ ЯКОРЬ', 'QUARANTINE ANCHOR'],
  process_saw: ['РАЗБОР ПРОЦЕССА', 'PROCESS DISASSEMBLY']
};

const UPGRADE_TEXT = {
  dmg: ['УРОН +15%', 'Весь исходящий урон растёт, включая урон подконтрольных процессов.', 'DAMAGE +15%', 'Increases all outgoing damage, including damage dealt by controlled processes.'],
  fire: ['ОРУЖЕЙНЫЙ ТАКТ +12%', 'Ускоряет оружие, спутники, пушки Живого казино, протоколы Контролёра и Вектор блока. Не влияет на блоки, прыжок, Q и R.', 'WEAPON CLOCK +12%', 'Speeds up weapons, drones, Living Casino guns, Controller protocols and Block Vector. Does not affect block placement, jumping, Q or R.'],
  spd: ['СКОРОСТЬ +8%', 'Увеличивает скорость движения.', 'SPEED +8%', 'Increases movement speed.'],
  maxhp: ['ЗДОРОВЬЕ +20', 'Увеличивает максимальное здоровье.', 'HEALTH +20', 'Increases maximum health.'],
  magnet: ['МАГНИТ +40%', 'Подборы притягиваются с большей дистанции.', 'MAGNET +40%', 'Pickups are attracted from farther away.'],
  dash: ['РЫВОК +1', 'Добавляет один заряд рывка.', 'DASH +1', 'Adds one dash charge.'],
  dash_length: ['ДЛИНА РЫВКА +18%', 'Рывок проходит дальше.', 'DASH LENGTH +18%', 'Increases dash distance.'],
  drone: ['СПУТНИК +1', 'Добавляет автостреляющего спутника.', 'DRONE +1', 'Adds an automatically firing drone.'],
  luck: ['УДАЧА +1', 'Улучшает исходы наград и казино.', 'LUCK +1', 'Improves reward and casino outcomes.'],
  proc: ['ШАНС ВЗРЫВА 10%', 'Выстрелы героя и стрелковых процессов могут взрываться. Спутникам нужен отдельный модуль взрыва.', 'BLAST CHANCE 10%', 'Hero shots and ranged process shots may explode. Drones require the separate Drone Blast module.'],
  echo: ['ЭХО-ВЫСТРЕЛ 12%', 'Иногда создаёт дополнительный выстрел.', 'ECHO SHOT 12%', 'Occasionally creates an additional shot.'],
  leech: ['ВАМПИРИЗМ 2%', 'Часть нанесённого урона возвращается здоровьем.', 'LIFESTEAL 2%', 'Returns part of dealt damage as health.'],
  goldgun: ['КРЕДИТЫ ЗА УБИЙСТВА +40%', 'Угрозы оставляют больше кредитов.', 'KILL CREDITS +40%', 'Threats drop more credits.'],
  combo_gld: ['КОМБО: КРЕДИТЫ', 'Завершённое комбо выдаёт кредиты за убийства и множитель.', 'COMBO PAYS CREDITS', 'A finished combo awards credits based on kills and multiplier.'],
  combo_exp: ['КОМБО: ОПЫТ', 'Завершённое комбо выдаёт опыт за убийства и множитель.', 'COMBO PAYS EXPERIENCE', 'A finished combo awards experience based on kills and multiplier.'],
  combo_hp: ['КОМБО: ЛЕЧЕНИЕ', 'Завершённое комбо восстанавливает здоровье за убийства и множитель.', 'COMBO PAYS HEALTH', 'A finished combo restores health based on kills and multiplier.'],
  sig_target_lock: ['ЗАХВАТ ЦЕЛИ', 'R захватывает угрозу. Уровни продлевают удержание прицела.', 'TARGET LOCK', 'R locks onto a threat. Levels extend target retention.'],
  sig_redline_boost: ['КРАСНАЯ ЗОНА', 'R даёт короткое сверхускорение. Уровни усиливают скорость и длительность.', 'REDLINE BOOST', 'R grants a short burst of extreme speed. Levels increase speed and duration.'],
  sig_ghost_decoy: ['ПРИЗРАЧНАЯ ПРИМАНКА', 'R надолго скрывает героя и оставляет приманку для угроз.', 'GHOST DECOY', 'R conceals the hero and leaves a decoy that distracts threats.'],
  sig_rewind_mark: ['МЕТКА ВОЗВРАТА', 'Первое R ставит метку. Повторное возвращает героя и оглушает угрозы рядом.', 'REWIND MARK', 'First R places a mark. Press R again to return and stun nearby threats.'],
  sig_kill_switch: ['АВАРИЙНОЕ УДАЛЕНИЕ', 'Каждый заряд R стирает все угрозы на экране, включая босса. Зеркальная выплата добавляет заряды без ограничения.', 'KILL SWITCH', 'Each R charge erases every on-screen threat, including the boss. Mirror Payout adds charges without a cap.'],
  sig_spawn_hold: ['ЗАДЕРЖКА ЗАПУСКА', 'Угрозы дольше остаются в зоне предупреждения. Повторы усиливают задержку.', 'SPAWN HOLD', 'Threats remain in spawn warnings longer. Repeats extend the delay.'],
  sig_aegis_process: ['ПРОЦЕСС ЭГИДЫ', 'Добавляет защитную оболочку. Повторы увеличивают её запас.', 'AEGIS PROCESS', 'Adds a protective shell. Repeats increase its capacity.'],
  sig_mirror_payout: ['ЗЕРКАЛЬНАЯ ВЫПЛАТА', 'Каждое готовое зеркало копирует следующий приз босса. Все зеркала срабатывают вместе и восстанавливаются после следующего босса.', 'MIRROR PAYOUT', 'Each ready mirror copies the next boss prize. All mirrors trigger together and recover after the following boss.'],
  sig_null_revival: ['НУЛЕВОЕ ВОЗВРАЩЕНИЕ', 'При смертельном сбое возвращает героя с 45% здоровья. Повторы дают заряды.', 'NULL REVIVAL', 'On a lethal failure, revives the hero with 45% health. Repeats add charges.'],
  sig_boss_key: ['КЛЮЧ БОССА', 'Первый сундук с выбором в цикле бесплатно получает максимальную редкость. Повторы дают ключи.', 'BOSS KEY', 'The first choice chest in a loop gains maximum rarity for free. Repeats add keys.'],
  bullet_ricochet: ['ОТСКОК СНАРЯДОВ +1', 'Все снаряды получают дополнительный отскок от стен.', 'PROJECTILE RICOCHET +1', 'All projectiles gain one additional wall ricochet.'],
  bullet_range: ['ДАЛЬНОСТЬ ОРУЖИЯ +22%', 'Увеличивает дальность всего текущего и будущего оружия, включая спутники и Вектор блока.', 'WEAPON RANGE +22%', 'Increases the range of all current and future weapons, including drones and Block Vector.'],
  bullet_fire: ['ТЕРМО-СБОЙ СНАРЯДОВ', 'Снаряды перегревают угрозы и наносят периодический урон.', 'THERMAL PROJECTILES', 'Projectiles overheat threats and deal damage over time.'],
  bullet_freeze: ['КРИО-СБОЙ СНАРЯДОВ', 'Снаряды охлаждают угрозы и могут ненадолго остановить их.', 'CRYO PROJECTILES', 'Projectiles chill threats and may briefly stop them.'],
  bullet_poison: ['КОРРОЗИЯ СНАРЯДОВ', 'Снаряды заражают угрозы коррозией. Каждый уровень ускоряет разрушение брони и усиливает периодический урон.', 'CORROSIVE PROJECTILES', 'Projectiles corrode threats. Each level breaks armor faster and increases damage over time.'],
  drone_element_link: ['КАНАЛ СПУТНИКОВ', 'Спутники переносят термо-, крио- и коррозийные сбои снарядов.', 'DRONE CHANNEL', 'Drones carry thermal, cryo and corrosive projectile effects.'],
  element_amp: ['УСИЛЕНИЕ СБОЯ +25%', 'Усиливает термо-, крио- и коррозийные сбои.', 'STATUS AMPLIFIER +25%', 'Strengthens thermal, cryo and corrosive effects.'],
  element_spread: ['ПЕРЕНОС СБОЯ', 'После удаления угрозы её статусы переходят на ближайшие цели.', 'STATUS TRANSFER', 'When a threat is deleted, its statuses spread to nearby targets.'],
  bullet_chain: ['СВЯЗЬ СНАРЯДОВ +1', 'Попадание связывает ближайшие угрозы. Статусы переходят только с отдельным модулем.', 'PROJECTILE LINK +1', 'Hits link nearby threats. Statuses transfer only with the separate channel module.'],
  bullet_chain_status_link: ['СТАТУСНЫЙ КАНАЛ СВЯЗИ', 'Связь переносит любые текущие и будущие оружейные статусы.', 'LINK STATUS CHANNEL', 'Projectile Link carries all current and future weapon statuses.'],
  impact_damage: ['ДРАЙВЕР: УДАР +25%', 'Усиливает взлёт, приземление и ударный след.', 'DRIVER: IMPACT +25%', 'Increases takeoff, landing and impact-trail damage.'],
  impact_radius: ['ДРАЙВЕР: КОНТУР +10%', 'Увеличивает радиус ударов при взлёте и приземлении.', 'DRIVER: AREA +10%', 'Increases takeoff and landing impact radius.'],
  impact_distance: ['ДРАЙВЕР: ДАЛЬНОСТЬ +20%', 'Увеличивает дальность прыжка.', 'DRIVER: RANGE +20%', 'Increases jump distance.'],
  impact_stun: ['ДРАЙВЕР: ЖЁСТКАЯ ПОСАДКА', 'Приземление оглушает угрозы. Повторы продлевают оглушение.', 'DRIVER: HARD LANDING', 'Landing stuns threats. Repeats extend the stun.'],
  impact_afterfield: ['ДРАЙВЕР: УДАРНЫЙ СЛЕД', 'После приземления остаётся короткий наносящий урон контур.', 'DRIVER: IMPACT TRAIL', 'Landing leaves a brief damaging outline.'],
  impact_rebound: ['ДРАЙВЕР: УПРУГИЙ КОНТУР +25%', 'Открывает множитель отскоков. Уровни увеличивают дальность после первого отскока.', 'DRIVER: REBOUND +25%', 'Unlocks the rebound multiplier. Levels increase travel after the first wall bounce.'],
  impact_wall_unlock: ['ДРАЙВЕР: ФАЙРВОЛ-БЛОК', 'Открывает установку временного квадратного блока в точке курсора.', 'DRIVER: FIREWALL BLOCK', 'Unlocks temporary square block placement at the cursor.'],
  impact_wall_count: ['ДРАЙВЕР: БЛОК +1', 'Позволяет одновременно держать ещё один блок.', 'DRIVER: BLOCK +1', 'Allows one more block to exist at once.'],
  impact_wall_duration: ['ДРАЙВЕР: СРОК БЛОКА +25%', 'Блоки существуют дольше.', 'DRIVER: BLOCK DURATION +25%', 'Blocks last longer.'],
  impact_push_unlock: ['ДРАЙВЕР: ВЕКТОР БЛОКА', 'Без перезарядки: левая кнопка толкает выбранный блок, правая притягивает блок, ближайший к курсору.', 'DRIVER: BLOCK VECTOR', 'No cooldown: left click pushes the selected block; right click pulls the block nearest the cursor.'],
  impact_push_range: ['ВЕКТОР: ПУТЬ +20%', 'Увеличивает путь толкнутого или притянутого блока.', 'VECTOR: TRAVEL +20%', 'Increases the travel distance of pushed and pulled blocks.'],
  impact_push_damage: ['ВЕКТОР: УРОН +25%', 'Усиливает урон движущегося блока без ограничения уровней.', 'VECTOR: DAMAGE +25%', 'Increases moving-block damage without a level cap.'],
  impact_push_bounce: ['ВЕКТОР: РИКОШЕТ', 'Движущийся блок отскакивает от стен, пока не исчерпает дальность.', 'VECTOR: WALL RICOCHET', 'A moving block ricochets from walls until it runs out of range.'],
  impact_push_multiplier: ['ВЕКТОР: МНОЖИТЕЛЬ +25%', 'Каждый отскок сильнее повышает урон блока.', 'VECTOR: BOUNCE MULTIPLIER +25%', 'Each bounce increases block damage further.'],
  shg_teeth: ['КЛИНОВОЙ РАЗРЯД: ОСКОЛКИ +2', 'Добавляет два осколка в залп.', 'WEDGE DISCHARGE: PELLETS +2', 'Adds two pellets to each burst.'],
  shg_longshot: ['КЛИНОВОЙ РАЗРЯД: ДАЛЬНИЙ ЗАЛП', 'Правая кнопка тратит все заряды на один дальний тяжёлый выстрел.', 'WEDGE DISCHARGE: LONG SHOT', 'Right click spends all charges on one long-range heavy shot.'],
  sek_split: ['ИСКАТЕЛЬ: ФРАГМЕНТЫ', 'После удаления цели выпускает малые самонаводящиеся фрагменты.', 'SEEKER: FRAGMENTS', 'Deleting a target releases small homing fragments.'],
  sek_chain: ['ИСКАТЕЛЬ: ЗАХВАТ', 'Улучшает наведение и время жизни снаряда.', 'SEEKER: LOCK', 'Improves homing and projectile lifetime.'],
  sek_swarm: ['ИСКАТЕЛЬ: РОЙ', 'Правая кнопка выпускает рой по разным угрозам.', 'SEEKER: SWARM', 'Right click launches a swarm at different threats.'],
  rkt_cluster: ['РАЗЛОМНЫЙ ЗАРЯД: МИНИ-ВЗРЫВЫ +2', 'Добавляет два малых взрыва при детонации.', 'RIFT CHARGE: MINI BLASTS +2', 'Adds two small blasts to each detonation.'],
  rkt_mines: ['РАЗЛОМНЫЙ ЗАРЯД: МИНЫ', 'Детонации оставляют отложенные мины.', 'RIFT CHARGE: STATIC MINES', 'Detonations leave delayed mines.'],
  rkt_stun: ['РАЗЛОМНЫЙ ЗАРЯД: ОГЛУШЕНИЕ', 'Взрывы могут оглушать угрозы.', 'RIFT CHARGE: STUN', 'Blasts may stun threats.'],
  rkt_scatter: ['РАЗЛОМНЫЙ ЗАРЯД: ОТБРОС', 'Взрывы сильнее разбрасывают угрозы.', 'RIFT CHARGE: KNOCKBACK', 'Blasts push threats farther away.'],
  rkt_remote: ['РАЗЛОМНЫЙ ЗАРЯД: РУЧНОЙ ВЗРЫВ', 'Правая кнопка по очереди взрывает выпущенные заряды.', 'RIFT CHARGE: REMOTE DETONATION', 'Right click detonates launched charges one by one.'],
  voidstep: ['РЫВОК: РАЗРЕЗ ПУСТОТЫ', 'Рывок оставляет разрез, ранящий угрозы вдоль пути.', 'DASH: VOID RIFT', 'Dash leaves a rift that damages threats along its path.'],
  dashcut: ['РЫВОК: ОГЛУШЕНИЕ', 'Рывок оглушает угрозы рядом с траекторией.', 'DASH STUN', 'Dash stuns threats near its path.'],
  dashclone: ['РЫВОК: ПОСЛЕУДАР', 'В точке старта рывка остаётся короткий ударный след.', 'DASH AFTERSHOCK', 'Dash leaves a brief damaging trail at its starting point.'],
  q_snap: ['Q: СТЯЖКА ПОЛЯ', 'Стягивает и надолго оглушает угрозы, не нанося урон.', 'Q: FIELD SNAP', 'Pulls threats together and stuns them for a long time without dealing damage.'],
  q_blood: ['Q: КРОВАВЫЙ ИМПУЛЬС', 'Тратит здоровье на красный сигнальный взрыв.', 'Q: BLOOD PULSE', 'Spends health to create a red signal blast.'],
  q_over: ['Q: РАЗГОН', 'Временно ускоряет стрельбу.', 'Q: OVERCLOCK', 'Temporarily increases fire rate.'],
  droneproc: ['ВЗРЫВ СПУТНИКА', 'Пули спутников иногда создают небольшие взрывы.', 'DRONE BLAST', 'Drone bullets may create small blasts.'],
  debtengine: ['СТАТИК-ЯДРО', 'Даёт большой урон и удачу, но каждый уровень добавляет три Статик-шторма. Контрактное очищение навсегда глушит шторм ядра.', 'STATIC CORE', 'Grants major damage and luck, but each level adds three Static Storms. Contract cleansing permanently silences the core storm.'],
  overload: ['УРОН +50% / ЗДОРОВЬЕ −15', 'Урон растёт на 50%, максимальное здоровье снижается на 15.', 'DAMAGE +50% / HEALTH −15', 'Increases damage by 50% and reduces maximum health by 15.'],
  gamble: ['УДАЧА +3 / СКОРОСТЬ −10%', 'Удача растёт на 3, скорость движения снижается на 10%.', 'LUCK +3 / SPEED −10%', 'Increases luck by 3 and reduces movement speed by 10%.'],
  rlt_square_damage: ['РУЛЕТКА: УРОН +', 'Квадраты рулетки наносят больше урона.', 'ROULETTE: DAMAGE +', 'Roulette squares deal more damage.'],
  rlt_square_size: ['РУЛЕТКА: РАЗМЕР +', 'Стартовый квадрат становится больше.', 'ROULETTE: SIZE +', 'Increases the starting square size.'],
  rlt_fragment_count: ['РУЛЕТКА: ОСКОЛКИ +', 'При распаде появляется больше малых квадратов.', 'ROULETTE: FRAGMENTS +', 'Creates more small squares when splitting.'],
  rlt_split_depth: ['РУЛЕТКА: ДРОБЛЕНИЕ +', 'Осколки могут дробиться ещё раз.', 'ROULETTE: SPLIT DEPTH +', 'Fragments may split one more time.'],
  rlt_wall_charge: ['РУЛЕТКА: ОТСКОК +', 'Удар о стену сильнее заряжает последующий распад.', 'ROULETTE: WALL CHARGE +', 'Wall impacts strengthen the following split.'],
  rlt_square_speed: ['РУЛЕТКА: СКОРОСТЬ +', 'Квадраты летят быстрее.', 'ROULETTE: SPEED +', 'Squares travel faster.'],
  crd_card_count: ['КОЛОДА: КАРТЫ +1', 'Добавляет одну карту в каждый веер.', 'DECK: CARDS +1', 'Adds one card to every fan.'],
  ctrl_process_slot: ['КОНТРОЛЁР: ПРОЦЕСС +1', 'Добавляет один постоянный слот подконтрольного процесса.', 'CONTROLLER: PROCESS +1', 'Adds one permanent controlled-process slot.'],
  ctrl_process_power: ['КОНТРОЛЁР: КОНТРОЛЬ +', 'Ускоряет захват и усиливает все атаки подконтрольных процессов.', 'CONTROLLER: CONTROL +', 'Speeds up capture and strengthens all controlled-process attacks.'],
  ctrl_capture_tier: ['КОНТРОЛЁР: АССИМИЛЯЦИЯ +', 'Расширяет список доступных для захвата угроз. Четвёртый уровень разрешает захват боссов.', 'CONTROLLER: ASSIMILATION +', 'Expands the set of capturable threats. Level four enables boss capture.'],
  ctrl_process_fire: ['КОНТРОЛЁР: ТЕМП АТАК +', 'Подконтрольные процессы атакуют чаще.', 'CONTROLLER: ATTACK CLOCK +', 'Controlled processes attack more often.'],
  saw_fallback_damage: ['РАЗБОР: АВАРИЙНЫЙ УРОН', 'Если цель нельзя захватить, импульс наносит ей урон.', 'DISASSEMBLY: FALLBACK DAMAGE', 'If a target cannot be captured, the pulse damages it instead.'],
  ctrl_process_contact_status: ['КОНТРОЛЁР: ЖИВОЙ СНАРЯД', 'Телесные атаки процессов переносят все текущие и будущие оружейные статусы.', 'CONTROLLER: LIVING PROJECTILE', 'Body attacks from controlled processes carry all current and future weapon statuses.'],
  ctrl_process_life: ['КОНТРОЛЁР: СРОК +', 'Подконтрольные процессы живут дольше. Их базовый срок зависит от максимального здоровья.', 'CONTROLLER: DURATION +', 'Controlled processes last longer. Their base duration depends on maximum health.'],
  ctrl_process_death_heal: ['КОНТРОЛЁР: ВОЗВРАТ ЗДОРОВЬЯ', 'Гибель или окончание контроля лечит героя от максимального здоровья процесса: 2%, затем +3%, +4% и далее.', 'CONTROLLER: HEALTH RETURN', 'Process death or control expiry heals from its maximum health: 2%, then +3%, +4% and onward.'],
  ctrl_process_persist: ['КОНТРОЛЁР: ПЕРЕНОС', 'Подконтрольные процессы переходят в следующий сектор.', 'CONTROLLER: TRANSFER', 'Controlled processes carry into the next sector.'],
  qrn_radius: ['ЯКОРЬ: ДАЛЬНОСТЬ +', 'Якорь захватывает угрозы дальше от маркера.', 'ANCHOR: RANGE +', 'The anchor captures threats farther from its marker.'],
  qrn_hold: ['ЯКОРЬ: УДЕРЖАНИЕ +', 'Сильно увеличивает срок работы якоря.', 'ANCHOR: HOLD +', 'Greatly extends anchor duration.'],
  qrn_links: ['ЯКОРЬ: ЗАХВАТ +3', 'Добавляет три одновременных захвата. Предел одного якоря — 20 угроз.', 'ANCHOR: CAPTURE +3', 'Adds three simultaneous captures. One anchor can hold up to 20 threats.'],
  qrn_damage: ['ЯКОРЬ: РАЗРЯД +', 'Усиливает урон и ускоряет разряды цепей.', 'ANCHOR: DISCHARGE +', 'Increases damage and speeds up chain discharges.']
};

const WPN_ONLY_TEXT = {
  weapon_shotgun: ['КЛИНОВОЙ РАЗРЯД', 'Открывает короткий веерный залп с зарядами.', 'WEDGE DISCHARGE', 'Unlocks a short charged fan burst.'],
  weapon_seeker: ['ИСКАТЕЛЬ', 'Открывает медленный самонаводящийся сигнальный снаряд.', 'SEEKER', 'Unlocks a slow homing signal projectile.'],
  weapon_rocketgun: ['РАЗЛОМНЫЙ ЗАРЯД', 'Открывает тяжёлый снаряд с широким взрывом.', 'RIFT CHARGE', 'Unlocks a heavy projectile with a wide blast.'],
  ctrl_unlock_qrn: ['КАРАНТИННЫЙ ЯКОРЬ', 'Открывает якорь, который ставится на полу или стене и удерживает до пяти угроз.', 'QUARANTINE ANCHOR', 'Unlocks an anchor placed on floors or walls that holds up to five threats.'],
  ctrl_unlock_saw: ['РАЗБОР ПРОЦЕССА', 'Открывает большой импульс, быстро захватывающий несколько процессов.', 'PROCESS DISASSEMBLY', 'Unlocks a wide pulse that rapidly captures several processes.'],
  rlt_damage: ['РУЛЕТКА: УРОН +', 'Квадраты рулетки наносят больше урона.', 'ROULETTE: DAMAGE +', 'Roulette squares deal more damage.'],
  rlt_size: ['РУЛЕТКА: РАЗМЕР +', 'Стартовый квадрат становится больше.', 'ROULETTE: SIZE +', 'Increases the starting square size.'],
  rlt_fragments: ['РУЛЕТКА: ОСКОЛКИ +', 'При распаде появляется больше малых квадратов.', 'ROULETTE: FRAGMENTS +', 'Creates more small squares when splitting.'],
  rlt_split_life: ['РУЛЕТКА: ДРОБЛЕНИЕ +', 'Осколки дробятся глубже.', 'ROULETTE: SPLIT DEPTH +', 'Fragments split one level deeper.'],
  rlt_wall_charge: ['РУЛЕТКА: ОТСКОК +', 'Удар о стену сильнее заряжает следующий распад.', 'ROULETTE: WALL CHARGE +', 'Wall impacts strengthen the next split.'],
  rlt_speed: ['РУЛЕТКА: СКОРОСТЬ +', 'Квадраты летят быстрее.', 'ROULETTE: SPEED +', 'Squares travel faster.'],
  wpn_dmg: ['УРОН ОРУЖИЯ +18%', 'Усиливает всё оружие и атаки подконтрольных процессов.', 'WEAPON DAMAGE +18%', 'Increases all weapon damage and controlled-process attack damage.'],
  wpn_fire: ['ОРУЖЕЙНЫЙ ТАКТ +14%', 'Ускоряет оружие, спутники, Живое казино, Контролёра и Вектор блока. Не влияет на блоки, прыжок, Q и R.', 'WEAPON CLOCK +14%', 'Speeds up weapons, drones, Living Casino, Controller and Block Vector. Does not affect blocks, jumping, Q or R.']
};

const CORE_TEXT = {
  blood_ring: ['КРОВАВОЕ КОЛЬЦО', 'УРОН ВОКРУГ ГЕРОЯ', 'Q сразу запускает кровавое кольцо вокруг героя.', ['+радиус', '+длительность', '+урон'], 'BLOOD RING', 'FOLLOWING DAMAGE', 'Q immediately creates a blood ring around the hero.', ['+radius', '+duration', '+damage']],
  field_snap: ['СТЯЖКА ПОЛЯ', 'СТЯЖКА И КОНТРОЛЬ', 'Q стягивает и надолго оглушает ближайшие угрозы, не нанося урон.', ['+радиус', '+сила стяжки', '+оглушение'], 'FIELD SNAP', 'PULL AND CONTROL', 'Q pulls nearby threats together and stuns them for a long time without dealing damage.', ['+radius', '+pull strength', '+stun duration']],
  bullet_freeze: ['ЗАМОРОЗКА ПУЛЬ', 'ЗАМОРОЗКА И КОНТРОЛЬ', 'Q создаёт холодную ауру вокруг героя.', ['+радиус', '+длительность', '+заморозка'], 'BULLET FREEZE', 'FREEZE AND CONTROL', 'Q creates a freezing aura around the hero.', ['+radius', '+duration', '+freeze duration']],
  shell_ripper: ['РАЗРЫВ ОБОЛОЧКИ', 'БРОНЯ И БЛОКИРОВКА', 'Q наносит половинный урон без брони, вдвое сильнее ломает броню и временно отключает все способности угроз, включая боссов.', ['+радиус', '+урон броне', '+блокировка'], 'SHELL RIPPER', 'ARMOR AND ABILITY LOCK', 'Q deals half damage to unarmored threats, double damage to armor and temporarily disables every enemy ability, including boss abilities.', ['+radius', '+armor damage', '+lock duration']],
  void_cut: ['РАЗРЕЗ ПУСТОТЫ', 'СОСТАВНОЙ ЛУЧ', 'Первое Q ставит начало. Следующие Q прокладывают звенья луча.', ['+точка связи', '+длина звена', '+урон'], 'VOID CUT', 'CHAINED BEAM', 'First Q places the origin. Further Q presses build connected beam segments.', ['+link point', '+segment length', '+damage']],
  signal_spike: ['СИГНАЛЬНЫЙ ШИП', 'УСТАНОВКА УЗЛА', 'Q ставит шип в точку курсора.', ['+заряд', '+дальность и радиус', '+длительность и урон'], 'SIGNAL SPIKE', 'DEPLOYED NODE', 'Q deploys a spike at the cursor.', ['+charge', '+range and radius', '+duration and damage']],
  black_box: ['ЧЁРНЫЙ ЯЩИК', 'СКРЫТИЕ И ЗАЩИТА', 'Q раскрывает чёрный ящик вокруг героя. Улучшения уменьшают зону обнаружения.', ['−радиус обнаружения', '+длительность', '+скрытие'], 'BLACK BOX', 'STEALTH AND SAFETY', 'Q opens a black box around the hero. Upgrades shrink its detection area.', ['−detection radius', '+duration', '+stealth duration']],
  static_strike: ['СТАТИК-УДАР', 'УДАР ПО КУРСОРУ', 'Q помечает область. После задержки светлый шторм один раз бьёт все касающиеся её угрозы и исчезает.', ['+урон', '+восстановление', '+диаметр'], 'STATIC STRIKE', 'CURSOR STRIKE', 'Q marks an area. After a delay, a pale storm hits every touching threat once and disappears.', ['+damage', '+recovery', '+diameter']],
  debt_pulse: ['СТАТИК-ИМПУЛЬС', 'ИМПУЛЬС И УЯЗВИМОСТЬ', 'Q выпускает статик-волну вокруг героя. Каждый уровень повышает урон предыдущего на 25%. Способность не создаёт статик-долг.', ['+радиус', '+25% урона', '+уязвимость'], 'STATIC PULSE', 'BURST AND EXPOSE', 'Q releases a static wave around the hero. Each level increases the previous level damage by 25%. The ability creates no static debt.', ['+radius', '+25% damage', '+vulnerability']]
};

const MUTATION_TEXT = {
  static: ['СТАТИК', 'ПОЛЕ', 'Q оставляет поле, замедляющее вражеские пули.', 'STATIC', 'FIELD', 'Q leaves a field that slows hostile projectiles.'],
  blood: ['КРОВЬ', 'УРОН', 'Q получает кровавый урон; часть применений стоит здоровья.', 'BLOOD', 'DAMAGE', 'Q gains blood damage; some activations cost health.'],
  echo: ['ЭХО', 'ПОВТОР', 'Q повторяется слабее после короткой паузы.', 'ECHO', 'RECAST', 'Q repeats at reduced strength after a short delay.'],
  shrapnel: ['ШРАПНЕЛЬ', 'СНАРЯДЫ', 'Q выпускает дополнительные снаряды.', 'SHRAPNEL', 'PROJECTILES', 'Q releases additional projectiles.'],
  casino: ['КАЗИНО', 'ПОСЛЕ БРОСКА', 'После Q может сработать казино-проверка. Повторно не выпадает.', 'CASINO', 'POST-ROLL', 'Q may trigger a casino check. This mutation cannot appear twice.'],
  void: ['ПУСТОТА', 'ФАЗА', 'Q даёт короткое окно неуязвимости.', 'VOID', 'PHASE', 'Q grants a brief invulnerability window.'],
  leech: ['ПИЯВКА', 'ВОССТАНОВЛЕНИЕ', 'Попадания Q могут вернуть здоровье или кредиты.', 'LEECH', 'SUSTAIN', 'Q hits may restore health or credits.'],
  armor_crack: ['РАЗЛОМ БРОНИ', 'ОБЛАСТЬ И БРОНЯ', 'Во всей зоне Q проходит мощный удар только по броне угроз.', 'ARMOR BREAK', 'AREA AND ARMOR', 'The entire Q area deals a powerful hit only to enemy armor.'],
  anchor: ['ЯКОРЬ', 'ЗОНА ЗАХВАТА', 'Q оставляет область, которая тянет угрозы и замедляет только вражеские пули.', 'ANCHOR', 'LOCK ZONE', 'Q leaves an area that pulls threats and slows hostile projectiles only.'],
  hunger: ['ГОЛОД', 'ВСПЛЕСК ПРИ МАЛОМ ЗДОРОВЬЕ', 'Q наносит урон вокруг героя. Чем меньше здоровья при активации, тем сильнее импульс.', 'HUNGER', 'LOW-HEALTH BURST', 'Q deals damage around the hero. The lower the activation health, the stronger the burst.'],
  bad_tape: ['БИТАЯ ЛЕНТА', 'СБОЙНЫЙ ПОВТОР', 'Q повторяется двумя слабыми сбоями.', 'BAD TAPE', 'GLITCH REPEAT', 'Q repeats as two weaker glitches.']
};

function attachText(target, text, kind = 'label') {
  if (!target || !text) return;
  if (kind === 'name') { target.nameRu = text[0]; target.nameEn = text[1]; return; }
  target.labelRu = text[0]; target.descRu = text[1] || '';
  target.labelEn = text[2] || text[0]; target.descEn = text[3] || '';
}

for (const [id, text] of Object.entries(WEAPON_TEXT)) attachText(WEAPONS[id], text, 'name');
const ENEMY_TEXT = {
  grunt: ['РЯДОВОЙ', 'ТЕЛО РОЯ', 'ДАВЛЕНИЕ РОЯ', 'GRUNT', 'SWARM BODY', 'SWARM PRESSURE'],
  runner: ['БЕГУН', 'БЫСТРЫЙ НАТИСК', 'СКОРОСТНОЕ ДАВЛЕНИЕ', 'RUNNER', 'FAST PRESSURE', 'SPEED PRESSURE'],
  tank: ['ТАНК', 'ПЕРЕДНЯЯ СТЕНА', 'ЛОБОВОЕ ДАВЛЕНИЕ', 'TANK', 'FRONT WALL', 'FRONT PRESSURE'],
  shooter: ['СТРЕЛОК', 'ДАЛЬНИЙ СТРАЖ', 'ДАЛЬНЕЕ ДАВЛЕНИЕ', 'SHOOTER', 'RANGED GUARD', 'RANGED PRESSURE'],
  charger: ['ТАРАН', 'РАЗРЫВ ЛИНИИ', 'ЛИНЕЙНОЕ ДАВЛЕНИЕ', 'CHARGER', 'LINE BREAKER', 'LINE PRESSURE'],
  bomber: ['ПОДРЫВНИК', 'РАЗРЫВ ПРОСТРАНСТВА', 'ДАВЛЕНИЕ ЗОН', 'BOMBER', 'SPACE BREAKER', 'AREA PRESSURE'],
  bouncer: ['ОТСКОК', 'СМЕЩЕНИЕ', 'ДАВЛЕНИЕ ДВИЖЕНИЯ', 'BOUNCER', 'DISPLACEMENT', 'MOVEMENT PRESSURE'],
  wall_jumper: ['НАСТЕННЫЙ ПРЫГУН', 'ЗАСАДА СО СТЕНЫ', 'ДАВЛЕНИЕ СТЕН', 'WALL JUMPER', 'WALL AMBUSH', 'WALL PRESSURE'],
  glitch: ['СБОЙ', 'РАЗРЫВ ТЫЛА', 'ДАВЛЕНИЕ ЗАСАДЫ', 'GLITCH', 'BACKLINE DISRUPTOR', 'AMBUSH PRESSURE'],
  slot_mob: ['АВТОМАТ', 'ПЕРЕГРУЗКА КАЗИНО', 'ЗАРАЖЕНИЕ СЛОТА', 'SLOT MOB', 'CASINO OVERLOAD', 'SLOT CORRUPTION'],
  echo: ['ЭХО', 'КОПИЯ ОРУЖИЯ', 'ЗЕРКАЛЬНОЕ ДАВЛЕНИЕ', 'ECHO', 'WEAPON MIMIC', 'MIRROR PRESSURE'],
  orbiter: ['ОРБИТЕР', 'ПОДВИЖНЫЙ СТРАЖ', 'ДАВЛЕНИЕ ЗАЩИТЫ', 'ORBITER', 'MOBILE GUARD', 'GUARD PRESSURE'],
  anchor: ['ЯКОРЬ', 'ЯДРО КОНТРОЛЯ', 'ДАВЛЕНИЕ СТЯЖКИ', 'ANCHOR', 'CONTROL CORE', 'PULL PRESSURE'],
  splitter: ['ДЕЛИТЕЛЬ', 'СЕМЯ РОЯ', 'ДАВЛЕНИЕ ПОТОКА', 'SPLITTER', 'SWARM SEED', 'FLOOD PRESSURE'],
  prism: ['ПРИЗМА', 'ЛИНИЯ ПЕРЕКРЁСТНОГО ОГНЯ', 'ДАВЛЕНИЕ ЛИНИЙ', 'PRISM', 'CROSSFIRE LANE', 'LANE PRESSURE'],
  pulse: ['ИМПУЛЬС', 'ВОЛНОВОЙ НАТИСК', 'ДАВЛЕНИЕ ВОЛН', 'PULSE', 'WAVE ATTACK', 'WAVE PRESSURE'],
  leech: ['ЛЕКАРЬ', 'ПОДДЕРЖКА ВОССТАНОВЛЕНИЯ', 'ДАВЛЕНИЕ ЛЕЧЕНИЯ', 'LEECH', 'SUSTAIN SUPPORT', 'HEALING PRESSURE'],
  warden: ['НАДЗИРАТЕЛЬ', 'КООРДИНАТОР БРОНИ', 'ДАВЛЕНИЕ БРОНИ', 'WARDEN', 'ARMOR COORDINATOR', 'ARMOR PRESSURE'],
  damper: ['ГЛУШИТЕЛЬ', 'ПОДВИЖНОЕ УКРЫТИЕ', 'ДАВЛЕНИЕ БЕЗОПАСНОЙ ЗОНЫ', 'DAMPER', 'MOBILE SAFE NEST', 'SAFE-ZONE PRESSURE'],
  herald: ['ВЕСТНИК', 'ДИРИЖЁР ПРИЗЫВА', 'ДАВЛЕНИЕ ПРИЗЫВА', 'HERALD', 'SUMMON DIRECTOR', 'SUMMON PRESSURE'],
  boss: ['ВОСЬМИУГОЛЬНИК', 'РИКОШЕТНЫЙ ЛАЗЕРНЫЙ МАССИВ', 'БОСС', 'OCTAGON', 'RICOCHET LASER ARRAY', 'BOSS'],
  boss_croupier: ['КРУПЬЕ', 'ПРАВИЛА КАЗИНО', 'БОСС', 'CROUPIER', 'CASINO RULES', 'BOSS'],
  boss_anchor_cashier: ['ЯКОРНЫЙ КАССИР', 'КОНТРОЛЬ ГРАВИТАЦИИ', 'БОСС', 'ANCHOR CASHIER', 'GRAVITY CONTROL', 'BOSS'],
  boss_hunter_chorus: ['ХОР ОХОТНИКА', 'ОБОЛОЧКА ОХОТНИКА', 'БОСС', 'HUNTER CHORUS', 'HUNTER SHELL', 'BOSS'],
  boss_hunter_duelist: ['ОХОТНИК-ДУЭЛЯНТ', 'ФРАГМЕНТ ОХОТНИКА', 'БОСС-ФРАГМЕНТ', 'HUNTER DUELIST', 'HUNTER FRAGMENT', 'BOSS FRAGMENT'],
  boss_hunter_marksman: ['ОХОТНИК-СТРЕЛОК', 'ФРАГМЕНТ ОХОТНИКА', 'БОСС-ФРАГМЕНТ', 'HUNTER MARKSMAN', 'HUNTER FRAGMENT', 'BOSS FRAGMENT'],
  boss_hunter_trapper: ['ОХОТНИК-ЛОВЧИЙ', 'ФРАГМЕНТ ОХОТНИКА', 'БОСС-ФРАГМЕНТ', 'HUNTER TRAPPER', 'HUNTER FRAGMENT', 'BOSS FRAGMENT'],
  boss_q_revisor: ['РЕВИЗОР Q', 'ДАВЛЕНИЕ РЫВКА', 'БОСС', 'Q REVISOR', 'DASH PRESSURE', 'BOSS'],
  boss_trinode: ['ТРОЙНОЙ УЗЕЛ', 'ПОСЛЕДОВАТЕЛЬНЫЙ ПОЛЗУН', 'БОСС', 'TRINODE', 'SEQUENTIAL CRAWLER', 'BOSS'],
  root_node: ['КОРНЕВОЙ УЗЕЛ', 'ЗАЩИТНЫЙ УЗЕЛ', 'ЦЕЛЬ', 'ROOT NODE', 'DEFENSE NODE', 'OBJECTIVE']
};
for (const [id, text] of Object.entries(ENEMY_TEXT)) {
  const enemy = ENEMIES[id];
  if (!enemy) continue;
  Object.assign(enemy, { nameRu: text[0], roleRu: text[1], comboRu: text[2], nameEn: text[3], roleEn: text[4], comboEn: text[5] });
}
for (const item of UPGRADES) attachText(item, UPGRADE_TEXT[item.id]);
for (const item of WEAPON_CHEST_REWARDS) {
  const text = WPN_ONLY_TEXT[item.id] || UPGRADE_TEXT[item.upgrade || item.id];
  attachText(item, text);
}
attachText(ABILITY_CHEST_REWARDS[0], ['ВОССТАНОВЛЕНИЕ Q +20%', 'Активный протокол восстанавливается быстрее.', 'Q RECOVERY +20%', 'The active protocol recovers faster.']);

for (const [id, text] of Object.entries(CORE_TEXT)) {
  const core = ACTIVE_CORES[id];
  if (!core) continue;
  [core.labelRu, core.roleRu, core.descRu, core.upgradeRu, core.labelEn, core.roleEn, core.descEn, core.upgradeEn] = text;
  core.shortRu = core.labelRu;
  core.shortEn = core.short;
}
for (const [id, text] of Object.entries(MUTATION_TEXT)) {
  const mutation = ACTIVE_MUTATIONS[id];
  if (!mutation) continue;
  [mutation.labelRu, mutation.roleRu, mutation.descRu, mutation.labelEn, mutation.roleEn, mutation.descEn] = text;
}

const CHEST_TEXT = {
  basic_chest: ['БАЗ', 'БАЗОВЫЙ СУНДУК', 'BSC', 'BASIC CHEST'], weapon_chest: ['ОРУЖ', 'ОРУЖЕЙНЫЙ СУНДУК', 'WPN', 'WEAPON CHEST'],
  ability_chest: ['АКТ', 'СУНДУК АКТИВНОСТИ', 'ABL', 'ABILITY CHEST'], rare_chest: ['РЕД', 'РЕДКИЙ СУНДУК', 'RAR', 'RARE CHEST'],
  cursed_chest: ['ПРК', 'ПРОКЛЯТЫЙ СУНДУК', 'CRS', 'CURSED CHEST']
};
for (const [id, text] of Object.entries(CHEST_TEXT)) {
  Object.assign(CHESTS[id], { labelRu: text[0], nameRu: text[1], labelEn: text[2], nameEn: text[3] });
}
Object.assign(CHESTS.weapon_chest, { roleRu: 'ветка оружия', roleEn: 'weapon route' });
Object.assign(CHESTS.ability_chest, { roleRu: 'ветка активностей', roleEn: 'ability route' });
Object.assign(CHESTS.rare_chest, { roleRu: 'сила забега', roleEn: 'run power' });

const ROOM_TEXT = {
  blackout: ['ЗАТМЕНИЕ', 'BLACKOUT'], static_rain: ['СТАТИК-ШТОРМ', 'STATIC STORM'], greed: ['ЗОЛОТАЯ ЛИХОРАДКА', 'GOLD FEVER'],
  hunter_contract: ['ВОЛНЫ ОХОТНИКА', 'HUNTER WAVES'], casino_virus: ['ВИРУС КАЗИНО', 'CASINO VIRUS'], moving_room: ['СДВИГ ЗОН', 'SHIFTING ZONES'],
  prism_grid: ['ПРИЗМЕННАЯ СЕТЬ', 'PRISM GRID'], blood_tax: ['КРОВАВАЯ ПЛАТА', 'BLOOD PAYMENT'], echo_walls: ['ЭХО-ВЫСТРЕЛЫ', 'ECHO SHOTS'],
  skin_cache: ['ТАЙНИК ОБЛИКОВ', 'SKIN CACHE'], trojan: ['ТРОЯНСКИЙ СУНДУК', 'TROJAN CHEST']
};
for (const [id, text] of Object.entries(ROOM_TEXT)) Object.assign(ROOM_MODS[id], { labelRu: text[0], labelEn: text[1] });
const SPECIAL_TEXT = {
  signal_contract: ['СИГНАЛЬНЫЙ КОНТРАКТ', 'SIGNAL CONTRACT'], reward_pocket: ['КАРМАН НАГРАД', 'REWARD POCKET'],
  debt_node: ['СТАТИК-УЗЕЛ', 'STATIC NODE'], chill_room: ['ТИХАЯ КОМНАТА', 'CHILL ROOM']
};
for (const [id, text] of Object.entries(SPECIAL_TEXT)) Object.assign(SPECIAL_ROOMS[id], { labelRu: text[0], labelEn: text[1] });

const RARITY_TEXT = {
  basic: ['БАЗОВЫЙ', 'BASIC'], uncommon: ['НЕОБЫЧНЫЙ', 'UNCOMMON'], rare: ['РЕДКИЙ', 'RARE'],
  superrare: ['СВЕРХРЕДКИЙ', 'SUPER RARE'], legendary: ['ЛЕГЕНДАРНЫЙ', 'LEGENDARY']
};
for (const [id, text] of Object.entries(RARITY_TEXT)) Object.assign(SKIN_RARITIES[id], { labelRu: text[0], labelEn: text[1] });
const SKIN_TEXT = {
  terminal_mint: ['СИГНАЛ ДОМА', 'Базовый домашний сигнал. Чистый терминальный след.', 'HOUSE SIGNAL', 'Base house signal. Clean terminal trail.'],
  debt_red: ['ДОЛГОВОЙ РАЗЛОМ', 'Красный надлом сигнала.', 'DEBT FRACTURE', 'A red fracture through the signal.'],
  void_cyan: ['КАНАЛ ПУСТОТЫ', 'Холодный фазовый хвост.', 'VOID CHANNEL', 'A cold phase trail.'],
  casino_gold: ['БЛЕСК КАССЫ', 'Золотой жетонный след.', 'CASHIER GLEAM', 'A golden token trail.'],
  bruise_purple: ['СБИТАЯ ЦЕПЬ', 'Фиолетовый надрез проводки.', 'BRUISED CIRCUIT', 'A purple cut through damaged circuitry.'],
  bone_static: ['КОСТЯНОЙ ШУМ', 'Сухой терминальный треск.', 'BONE NOISE', 'A dry terminal crackle.'],
  black_lime: ['ЛАЙМОВЫЙ ПРОЛОМ', 'Резкие кислотные искры.', 'LIME BREACH', 'Sharp acidic sparks.'],
  bad_tv: ['БИТЫЙ ЭФИР', 'Перегоревший экранный след.', 'BAD BROADCAST', 'A burned-out screen trail.'],
  red_static: ['КРАСНЫЙ ШТОРМ', 'Битый канал в рывке.', 'RED STORM', 'A broken channel inside the dash.'],
  mirror_coin: ['ЛОЖНЫЙ ДЖЕКПОТ', 'Зеркальный жетонный дубль.', 'FALSE JACKPOT', 'A mirrored token duplicate.'],
  terminal_ghost: ['ПРИЗРАК ТЕРМИНАЛА', 'Эфирный след с фантомом.', 'TERMINAL GHOST', 'An ethereal trail with a phantom.'],
  jackpot_wound: ['РАНА ДЖЕКПОТА', 'Монетные осколки и лоскуты автомата.', 'JACKPOT WOUND', 'Coin shards and torn slot fragments.'],
  dead_channel: ['МЁРТВЫЙ КАНАЛ', 'Порванный эфир и экранные обрывки.', 'DEAD CHANNEL', 'A torn broadcast with screen fragments.']
};
for (const skin of SKIN_PRESETS) {
  const text = SKIN_TEXT[skin.id];
  if (text) Object.assign(skin, { nameRu: text[0], noteRu: text[1], nameEn: text[2], noteEn: text[3] });
}

export function contentText(entry, lang = 'en', field = 'label') {
  if (!entry) return '';
  const suffix = String(lang).toLowerCase().startsWith('ru') ? 'Ru' : 'En';
  return entry[`${field}${suffix}`] ?? entry[field] ?? '';
}
