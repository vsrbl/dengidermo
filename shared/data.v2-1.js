// terminal casino roguelike content data: weapons, enemies, upgrades, chests, casino, modifiers

export const WEAPONS = {
  shotgun: {
    id: 'shotgun', label: 'SHG', name: 'SHOTGUN',
    cooldown: 0.035, charges: 4, chargeRegen: 0.8, pellets: 6, spread: 0.42, dmg: 8, speed: 700, life: 0.42, size: 5, knock: 82
  },
  seeker: {
    id: 'seeker', label: 'SEK', name: 'SEEKER',
    cooldown: 0.72, pellets: 1, spread: 0.025, dmg: 20, speed: 340, life: 1.55, maxDist: 620, size: 4, homing: 4.6, knock: 36
  },
  rocketgun: {
    id: 'rocketgun', label: 'RKT', name: 'ROCKETGUN',
    cooldown: 1.38, pellets: 1, spread: 0.012, dmg: 124, speed: 455, life: 2.05, size: 7, aoe: 104, knock: 230, detonateDist: 620
  },
  living_casino: {
    id: 'living_casino', label: 'LVC', name: 'ЖИВОЕ КАЗИНО',
    cooldown: 0.45, pellets: 0, spread: 0, dmg: 0, speed: 0, life: 0, size: 0
  },
  roulette: {
    id: 'roulette', label: 'RLT', name: 'РУЛЕТКА',
    cooldown: 1.08, pellets: 1, spread: 0.004, dmg: 78, speed: 335, life: 2.25, maxDist: 980, size: 22, knock: 210, bounces: 0
  },
  deck: {
    id: 'deck', label: 'CRD', name: 'КОЛОДА',
    cooldown: 0.48, pellets: 3, spread: 0.30, dmg: 13, speed: 690, life: 0.82, maxDist: 610, size: 4, knock: 28, bounces: 0
  }
};
export const WEAPON_ORDER = ['shotgun', 'seeker', 'rocketgun', 'living_casino', 'roulette', 'deck'];

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
  { id: 'dmg',      label: 'DMG +15%',             tier: 0, desc: 'Весь исходящий урон растёт.', apply: s => { s.dmgMul *= 1.15; } },
  { id: 'fire',     label: 'FIRE RATE +12%',       tier: 0, desc: 'Перезарядка оружия становится короче.', apply: s => { s.fireMul *= 1.12; } },
  { id: 'spd',      label: 'SPD +8%',              tier: 0, desc: 'Скорость движения растёт.', apply: s => { s.spdMul *= 1.08; } },
  { id: 'maxhp',    label: 'HP +20',               tier: 0, desc: 'Максимальное здоровье растёт.', apply: s => { s.maxHpAdd += 20; } },
  { id: 'magnet',   label: 'MAGNET +40%',          tier: 0, desc: 'Радиус притяжения подборов растёт.', apply: s => { s.magnetMul *= 1.4; } },
  { id: 'dash',     label: 'DASH +1',              tier: 1, desc: 'Больше зарядов рывка.', apply: s => { s.dashAdd += 1; } },
  { id: 'drone',    label: 'DRONE +1',             tier: 1, desc: 'Добавляет спутника, который стреляет автоматически.', apply: s => { s.drones += 1; } },
  { id: 'luck',     label: 'LUCK +1',              tier: 1, desc: 'Лучше броски апгрейдов и казино.', apply: s => { s.luck += 1; } },
  { id: 'proc',     label: 'BLAST CHANCE 10%',     tier: 1, desc: 'Попадания пуль могут создавать маленький взрыв.', apply: s => { s.procBlast += 0.10; } },
  { id: 'echo',     label: 'ECHO SHOT 12%',        tier: 1, desc: 'Иногда оружие выпускает дополнительный выстрел. Повторные выборы делают это чаще.', apply: s => { s.echoShot += 0.12; } },
  { id: 'leech',    label: 'LIFESTEAL 2%',         tier: 1, desc: 'Лечение от нанесённого урона.', apply: s => { s.lifesteal += 0.02; } },
  { id: 'goldgun',  label: 'GLD ON KILL +40%',     tier: 1, desc: 'Больше золота за смерти врагов.', apply: s => { s.goldMul *= 1.4; } },
  { id: 'combo_gld', label: 'COMBO PAYS GLD', tier: 0, desc: 'Комбо при завершении выдаёт GLD: убийства × множитель.', apply: s => { s.comboPrize = 'gld'; } },
  { id: 'combo_exp', label: 'COMBO PAYS EXP', tier: 0, desc: 'Комбо при завершении выдаёт EXP: убийства × множитель.', apply: s => { s.comboPrize = 'exp'; } },
  { id: 'combo_hp',  label: 'COMBO PAYS HP',  tier: 0, desc: 'Комбо при завершении лечит: убийства × множитель × 0.1, округление до целого.', apply: s => { s.comboPrize = 'hp'; } },


  // boss signature modules: major powers extracted from defeated bosses.
  // These are not normal INSTALL rolls; they appear only after boss rooms.
  { id: 'sig_target_lock', label: 'TARGET LOCK', tier: 1, bossSig: true, desc: 'R: захватывает врага. Линия прицела смотрит в цель, а не в курсор. Стаки увеличивают длительность.', apply: s => { if (s.rActiveId === 'target_lock') s.rActiveStacks += 1; else { s.rActiveId = 'target_lock'; s.rActiveStacks = 1; } } },
  { id: 'sig_redline_boost', label: 'REDLINE BOOST', tier: 1, bossSig: true, desc: 'R: супер-ускорение. Короткий рывок темпа с кулдауном. Стаки увеличивают скорость и длительность.', apply: s => { if (s.rActiveId === 'redline_boost') s.rActiveStacks += 1; else { s.rActiveId = 'redline_boost'; s.rActiveStacks = 1; } } },
  { id: 'sig_ghost_decoy', label: 'GHOST DECOY', tier: 1, bossSig: true, desc: 'R: игрок становится невидимым, а на месте появляется призрак, который полностью отвлекает врагов.', apply: s => { if (s.rActiveId === 'ghost_decoy') s.rActiveStacks += 1; else { s.rActiveId = 'ghost_decoy'; s.rActiveStacks = 1; } } },
  { id: 'sig_rewind_mark', label: 'REWIND MARK', tier: 1, bossSig: true, desc: 'R: ставит точку возврата. Повторное R возвращает игрока назад, разбрасывает и станит врагов.', apply: s => { if (s.rActiveId === 'rewind_mark') s.rActiveStacks += 1; else { s.rActiveId = 'rewind_mark'; s.rActiveStacks = 1; } } },
  { id: 'sig_kill_switch', label: 'KILL SWITCH', tier: 2, bossSig: true, desc: 'R: один раз за run стирает всех врагов на экране, включая босса. После выбора больше не появляется в этом run.', apply: s => { if (!s.killSwitchTaken) { s.killSwitchTaken = 1; s.rActiveId = 'kill_switch'; s.rActiveStacks = Math.max(1, s.rActiveStacks || 1); s.killSwitchCharge = Math.max(0, s.killSwitchCharge || 0) + 1; } else if (s.rActiveId === 'kill_switch') { s.rActiveStacks = Math.max(1, s.rActiveStacks || 1) + 1; s.killSwitchCharge = Math.max(0, s.killSwitchCharge || 0) + 1; } } },
  { id: 'sig_spawn_hold', label: 'SPAWN HOLD', tier: 1, bossSig: true, desc: 'Spawn-warning поля висят намного дольше. Стаки усиливают задержку появления.', apply: s => { s.spawnHoldStacks += 1; } },
  { id: 'sig_aegis_process', label: 'AEGIS PROCESS', tier: 1, bossSig: true, desc: 'Игрок получает enemy-style shell shield. Каждый стак даёт +45 shield.', apply: s => { s.aegisStacks += 1; } },
  { id: 'sig_mirror_payout', label: 'MIRROR PAYOUT', tier: 1, bossSig: true, desc: 'Копирует следующую стакаемую награду с выбором. Не копирует саму себя. Charge восстанавливается после победы над главным процессом.', apply: s => { s.mirrorCapacity += 1; } },
  { id: 'sig_null_revival', label: 'NULL REVIVAL', tier: 2, bossSig: true, desc: 'Вторая жизнь. При смерти возвращает игрока с 45% HP. Стаки дают +1 revive charge.', apply: s => { s.nullRevives += 1; } },
  { id: 'sig_room_wager', label: 'ROOM WAGER', tier: 1, bossSig: true, desc: 'Открывает ставку справа от INSTALL перед комнатой. Платишь только при провале условия.', apply: s => { s.roomWagerUnlocked = 1; } },
  { id: 'sig_boss_key', label: 'BOSS KEY', tier: 1, bossSig: true, desc: 'Первый сундук в loop бесплатно становится максимальной редкости. Каждый стак даёт +1 ключ.', apply: s => { s.bossKeys += 1; } },

  // weapon branches. These are WPN-chest rewards only, not INSTALL/level-up rewards.
  { id: 'bullet_ricochet', label: 'BULLET RICOCHET +1', tier: 1, branch: 'ALL', desc: 'Все твои снаряды получают дополнительный отскок от стен. Повторные выборы дают больше отскоков.', apply: s => { s.bulletBounce += 1; } },
  { id: 'bullet_range',    label: 'BULLET RANGE +22%',  tier: 1, branch: 'ALL', desc: 'Все твои снаряды летят дальше и живут дольше.', apply: s => { s.bulletRange *= 1.22; } },
  { id: 'bullet_fire',     label: 'FIRE BULLETS',       tier: 1, branch: 'ALL', desc: 'Пули поджигают врагов и наносят периодический урон.', apply: s => { s.bulletFire += 1; } },
  { id: 'bullet_freeze',   label: 'FREEZE BULLETS',     tier: 1, branch: 'ALL', desc: 'Пули охлаждают врагов и могут коротко остановить их.', apply: s => { s.bulletFreeze += 1; } },
  { id: 'bullet_poison',   label: 'POISON BULLETS',     tier: 1, branch: 'ALL', desc: 'Пули отравляют врагов и наносят периодический урон.', apply: s => { s.bulletPoison += 1; } },
  { id: 'drone_element_link', label: 'DRONE ELEMENT LINK', tier: 1, branch: 'ALL', desc: 'Дроны наследуют огонь, холод и яд оружия.', apply: s => { s.droneElementLink += 1; } },
  { id: 'element_amp', label: 'ELEMENT AMP +25%', tier: 1, branch: 'ALL', desc: 'Усиливает огонь, холод и яд.', apply: s => { s.bulletElementAmp += 1; } },
  { id: 'element_spread', label: 'STATUS SPREAD', tier: 1, branch: 'ALL', desc: 'Смерть врага переносит часть огня, холода или яда на ближайших врагов.', apply: s => { s.elementSpread += 1; } },
  { id: 'bullet_chain', label: 'BULLET LINK +1', tier: 1, branch: 'ALL', desc: 'Попадание оружием связывает ближайших врагов тонкой линией. Повторные выборы продлевают цепь.', apply: s => { s.bulletChain += 1; } },
  { id: 'shg_teeth',  label: 'SHG TEETH +2 PELLETS', tier: 1, branch: 'SHG', desc: 'SHG получает две дополнительные дробины.', apply: s => { s.shgPellets += 2; } },
  { id: 'shg_longshot', label: 'SHG LONGSHOT RMB', tier: 1, branch: 'SHG', desc: 'ПКМ тратит все заряды SHG на один дальний тяжёлый выстрел. Повторные выборы усиливают его, но перезарядка становится дольше.', apply: s => { s.shgLongshot += 1; } },
  { id: 'sek_split',  label: 'SEK SPLIT ON KILL',  tier: 1, branch: 'SEK', desc: 'Убийства SEK выпускают маленькие самонаводящиеся фрагменты.', apply: s => { s.sekSplit += 1; } },
  { id: 'sek_chain',  label: 'SEK CHAIN LOCK',     tier: 1, branch: 'SEK', desc: 'У SEK улучшаются наведение и время жизни.', apply: s => { s.sekChain += 1; } },
  { id: 'sek_swarm', label: 'SEK SWARM RMB', tier: 1, branch: 'SEK', desc: 'ПКМ выпускает рой самонаводящихся SEK-пуль по разным врагам.', apply: s => { s.sekSwarm += 1; } },
  { id: 'rkt_cluster',label: 'RKT CLUSTER +2',     tier: 1, branch: 'RKT', desc: 'Ракеты распадаются на мини-взрывы.', apply: s => { s.rktCluster += 1; } },
  { id: 'rkt_mines',  label: 'RKT STATIC MINES',   tier: 1, branch: 'RKT', desc: 'Ракеты оставляют отложенные областьные мины.', apply: s => { s.rktMines += 1; } },
  { id: 'rkt_stun',   label: 'RKT STUN BLASTS',    tier: 1, branch: 'RKT', desc: 'Все RKT-взрывы могут оглушать врагов.', apply: s => { s.rktStun += 1; } },
  { id: 'rkt_scatter',label: 'RKT SCATTER BLASTS', tier: 1, branch: 'RKT', desc: 'Все RKT-взрывы сильнее разбрасывают врагов.', apply: s => { s.rktScatter += 1; } },
  { id: 'rkt_remote', label: 'RKT REMOTE DETONATOR', tier: 1, branch: 'RKT', desc: 'ПКМ взрывает выпущенные ракеты по одной: сначала самую старую, потом следующую.', apply: s => { s.rktRemote += 1; } },

  // ability / active branches
  { id: 'voidstep',  label: 'DASH: VOID RIFT',     tier: 1, branch: 'DASH', desc: 'Весь путь рывка становится пустотным разрезом и ранит врагов вдоль траектории.', apply: s => { s.voidStep += 1; } },
  { id: 'dashcut',   label: 'DASH STUN',          tier: 1, branch: 'DASH', desc: 'Рывок оглушает врагов рядом с траекторией.', apply: s => { s.dashCut += 1; } },
  { id: 'dashclone', label: 'DASH AFTERSHOCK',    tier: 1, branch: 'DASH', desc: 'После рывка в точке старта остаётся короткий ударный след, который ранит ближайших врагов.', apply: s => { s.dashClone += 1; } },
  { id: 'q_snap',    label: 'Q: FIELD SNAP',      tier: 1, branch: 'Q', desc: 'Q стягивает врагов к тебе и оставляет короткое замедляющее поле.', apply: s => { s.activeSnap += 1; } },
  { id: 'q_blood',   label: 'Q: BLOOD PULSE',     tier: 1, branch: 'Q', desc: 'Q тратит HP на красный сигнальный взрыв.', apply: s => { s.activeBlood += 1; } },
  { id: 'q_over',    label: 'Q: OVERCLOCK',       tier: 1, branch: 'Q', desc: 'Q временно ускоряет стрельбу.', apply: s => { s.activeOver += 1; } },

  // high rarity rule-breakers
  { id: 'droneproc', label: 'DRONE BLAST CHANCE',  tier: 2, desc: 'Пули дронов иногда создают маленькие взрывы.', apply: s => { s.droneProc += 1; } },
  { id: 'debtengine',label: 'STATIC CORE',         tier: 2, cursed: true, desc: 'Большой урон и удача, но боевые комнаты становятся опаснее от статик-шторма.', apply: s => { s.dmgMul *= 1.35; s.luck += 2; s.debtEngine += 1; } },
  { id: 'overload',  label: 'DMG +50% / HP -15',  tier: 2, cursed: true, apply: s => { s.dmgMul *= 1.5; s.maxHpAdd -= 15; } },
  { id: 'gamble',    label: 'LUCK +3 / SPD -10%', tier: 2, cursed: true, apply: s => { s.luck += 3; s.spdMul *= 0.9; } },
  { id: 'rlt_square_damage', label: 'RLT DAMAGE +', branch: 'RLT', tier: 1, desc: 'Квадраты рулетки бьют сильнее.', apply: s => { s.rltDmg += 1; } },
  { id: 'rlt_square_size', label: 'RLT SQUARE SIZE +', branch: 'RLT', tier: 1, desc: 'Стартовый квадрат рулетки становится больше.', apply: s => { s.rltSize += 1; } },
  { id: 'rlt_fragment_count', label: 'RLT FRAGMENTS +', branch: 'RLT', tier: 1, desc: 'При дроблении появляется больше малых квадратов.', apply: s => { s.rltFrag += 1; } },
  { id: 'rlt_split_depth', label: 'RLT SPLIT LIFE +', branch: 'RLT', tier: 1, desc: 'Осколки могут дробиться ещё один раз.', apply: s => { s.rltDepth += 1; } },
  { id: 'rlt_wall_charge', label: 'RLT WALL CHARGE +', branch: 'RLT', tier: 1, desc: 'Удар о стену сильнее заряжает следующие квадраты.', apply: s => { s.rltWallBuff += 1; } },
  { id: 'rlt_square_speed', label: 'RLT SPEED +', branch: 'RLT', tier: 1, desc: 'Квадраты рулетки летят быстрее.', apply: s => { s.rltSpeed += 1; } }
];

export const UPGRADE_LABELS = Object.fromEntries(UPGRADES.map(u => [u.id, u.label]));
export const CURSED_UPGRADE_IDS = UPGRADES.filter(u => u.cursed).map(u => u.id);

// INSTALL / level-up upgrades are HERO ONLY.
// Weapon-specific branches live in WPN chest choices, not level-up offers.
export const WEAPON_BRANCHES = ['ALL', 'SHG', 'SEK', 'RKT', 'RLT', 'CRD'];
export const HERO_UPGRADES = UPGRADES.filter(u => !u.bossSig && !WEAPON_BRANCHES.includes(u.branch) && u.branch !== 'Q');
export const BOSS_SIGNATURE_UPGRADE_IDS = UPGRADES.filter(u => u.bossSig).map(u => u.id);
export const WEAPON_UPGRADE_IDS = UPGRADES.filter(u => WEAPON_BRANCHES.includes(u.branch)).map(u => u.id);

export const WEAPON_CHEST_REWARDS = [
  { id: 'weapon_shotgun', kind: 'weapon', weapon: 'shotgun', label: 'SHG WEAPON', desc: 'Открывает дробовик: близкий дробовой протокол с зарядами.' },
  { id: 'weapon_seeker', kind: 'weapon', weapon: 'seeker', label: 'SEK WEAPON', desc: 'Открывает самонаводчик: медленный цифровой снаряд с ограниченной дальностью.' },
  { id: 'weapon_rocketgun', kind: 'weapon', weapon: 'rocketgun', label: 'RKT WEAPON', desc: 'Открывает ракетницу: тяжёлая ракета с большим областьным взрывом.' },
  { id: 'bullet_ricochet', kind: 'weapon_upgrade', upgrade: 'bullet_ricochet', label: 'BULLET RICOCHET +1', desc: 'Все снаряды получают дополнительный отскок от стен.' },
  { id: 'bullet_range', kind: 'weapon_upgrade', upgrade: 'bullet_range', label: 'BULLET RANGE +22%', desc: 'Все снаряды летят дальше и держатся дольше.' },
  { id: 'bullet_fire', kind: 'weapon_upgrade', upgrade: 'bullet_fire', label: 'FIRE BULLETS', desc: 'Пули поджигают врагов.' },
  { id: 'bullet_freeze', kind: 'weapon_upgrade', upgrade: 'bullet_freeze', label: 'FREEZE BULLETS', desc: 'Пули охлаждают врагов и могут коротко остановить их.' },
  { id: 'bullet_poison', kind: 'weapon_upgrade', upgrade: 'bullet_poison', label: 'POISON BULLETS', desc: 'Пули заражают врагов токсином.' },
  { id: 'drone_element_link', kind: 'weapon_upgrade', upgrade: 'drone_element_link', label: 'DRONE ELEMENT LINK', desc: 'Дроны переносят огонь, холод и яд оружия. Хорошо работает с DRONE +1.' },
  { id: 'element_amp', kind: 'weapon_upgrade', upgrade: 'element_amp', label: 'ELEMENT AMP +25%', desc: 'Усиливает длительность и силу огня, холода и яда на пулях.' },
  { id: 'element_spread', kind: 'weapon_upgrade', upgrade: 'element_spread', label: 'STATUS SPREAD', desc: 'Статусы с убитых врагов переходят на ближайшие цели.' },
  { id: 'bullet_chain', kind: 'weapon_upgrade', upgrade: 'bullet_chain', label: 'BULLET LINK +1', desc: 'Попадание оружием связывает ближайших врагов тонкой линией и передаёт часть урона дальше.' },
  { id: 'shg_teeth', kind: 'weapon_upgrade', upgrade: 'shg_teeth', reqWeapon: 'shotgun', label: 'SHG TEETH +2 PELLETS', desc: 'Апгрейд SHG: больше дробин в каждом залпе.' },
  { id: 'shg_longshot', kind: 'weapon_upgrade', upgrade: 'shg_longshot', reqWeapon: 'shotgun', label: 'SHG LONGSHOT RMB', desc: 'ПКМ тратит все заряды SHG на один дальний тяжёлый выстрел.' },
  { id: 'sek_split', kind: 'weapon_upgrade', upgrade: 'sek_split', reqWeapon: 'seeker', label: 'SEK SPLIT ON KILL', desc: 'Апгрейд SEK: убийства выпускают самонаводящиеся фрагменты.' },
  { id: 'sek_chain', kind: 'weapon_upgrade', upgrade: 'sek_chain', reqWeapon: 'seeker', label: 'SEK CHAIN LOCK', desc: 'Самонаводчик лучше держит цель и летит дольше.' },
  { id: 'sek_swarm', kind: 'weapon_upgrade', upgrade: 'sek_swarm', reqWeapon: 'seeker', label: 'SEK SWARM RMB', desc: 'Апгрейд SEK: ПКМ выпускает рой самонаводящихся пуль, распределённых по разным врагам.' },
  { id: 'rkt_cluster', kind: 'weapon_upgrade', upgrade: 'rkt_cluster', reqWeapon: 'rocketgun', label: 'RKT CLUSTER +2', desc: 'Ракета добавляет мини-взрывы вокруг детонации.' },
  { id: 'rkt_mines', kind: 'weapon_upgrade', upgrade: 'rkt_mines', reqWeapon: 'rocketgun', label: 'RKT STATIC MINES', desc: 'Ракеты оставляют отложенные областьные мины.' },
  { id: 'rkt_stun', kind: 'weapon_upgrade', upgrade: 'rkt_stun', reqWeapon: 'rocketgun', label: 'RKT STUN BLASTS', desc: 'Ракетные взрывы могут оглушать врагов.' },
  { id: 'rkt_scatter', kind: 'weapon_upgrade', upgrade: 'rkt_scatter', reqWeapon: 'rocketgun', label: 'RKT SCATTER BLASTS', desc: 'Ракетные взрывы сильнее разбрасывают врагов.' },
  { id: 'rkt_remote', kind: 'weapon_upgrade', upgrade: 'rkt_remote', reqWeapon: 'rocketgun', label: 'RKT REMOTE DETONATOR', desc: 'ПКМ взрывает выпущенные ракеты по одной, начиная со старой.' },
  { id: 'rlt_damage', kind: 'weapon_upgrade', upgrade: 'rlt_square_damage', reqWeapon: 'roulette', label: 'RLT DAMAGE +', desc: 'Рулетка: больше урон каждого квадрата.' },
  { id: 'rlt_size', kind: 'weapon_upgrade', upgrade: 'rlt_square_size', reqWeapon: 'roulette', label: 'RLT SIZE +', desc: 'Рулетка: стартовый квадрат крупнее.' },
  { id: 'rlt_fragments', kind: 'weapon_upgrade', upgrade: 'rlt_fragment_count', reqWeapon: 'roulette', label: 'RLT FRAGMENTS +', desc: 'Рулетка: больше квадратов при дроблении.' },
  { id: 'rlt_split_life', kind: 'weapon_upgrade', upgrade: 'rlt_split_depth', reqWeapon: 'roulette', label: 'RLT SPLIT LIFE +', desc: 'Рулетка: осколки дробятся дальше.' },
  { id: 'rlt_wall_charge', kind: 'weapon_upgrade', upgrade: 'rlt_wall_charge', reqWeapon: 'roulette', label: 'RLT WALL CHARGE +', desc: 'Рулетка: удар о стену сильнее заряжает осколки.' },
  { id: 'rlt_speed', kind: 'weapon_upgrade', upgrade: 'rlt_square_speed', reqWeapon: 'roulette', label: 'RLT SPEED +', desc: 'Рулетка: квадраты летят быстрее.' },
  { id: 'wpn_dmg', kind: 'stat', stat: 'dmg', label: 'WEAPON DMG +18%', desc: 'Усиливает урон всех оружий, включая оружие, открытое позже.' },
  { id: 'wpn_fire', kind: 'stat', stat: 'fire', label: 'WEAPON RATE +14%', desc: 'Оружие стреляет чаще.' }
];


export const ACTIVE_CORES = {
  blood_ring: {
    id: 'blood_ring', label: 'BLOOD RING', short: 'RING', tone: 'red', role: 'FOLLOW DAMAGE',
    desc: 'Кровавое кольцо следует за тобой. Урон: средний частыми импульсами; если враг остаётся внутри долго — становится высоким.',
    upgrade: ['+большой радиус', '+длительность', '+сильнее урон']
  },
  field_snap: {
    id: 'field_snap', label: 'FIELD SNAP', short: 'SNAP', tone: 'cyan', role: 'PULL / CONTROL',
    desc: 'Один раз резко стягивает врагов и подборы к тебе. После рывка остаётся короткое поле: оно уже не тянет, только замедляет, глушит пули и наносит слабый урон.',
    upgrade: ['+большой радиус', '+сила стяжки', '+дольше поле']
  },
  bullet_freeze: {
    id: 'bullet_freeze', label: 'BULLET FREEZE', short: 'FREEZE', tone: 'cyan', role: 'FREEZE / CONTROL',
    desc: 'Холодная аура следует за тобой. Урон: нет. Враги замирают, вражеские пули почти останавливаются.',
    upgrade: ['+большой радиус', '+длительность', '+дольше примерзание']
  },
  shell_ripper: {
    id: 'shell_ripper', label: 'SHELL RIPPER', short: 'RIP', tone: 'purple', role: 'ARMOR / EXPOSE',
    desc: 'Срывает защиту с врагов рядом. Урон: низкий, если защиты нет. Ослабленные враги получают больше урона от всего.',
    upgrade: ['+большой радиус', '+сильнее ломает защиту', '+сильнее уязвимость']
  },
  void_cut: {
    id: 'void_cut', label: 'VOID CUT', short: 'CUT', tone: 'purple', role: 'BUILD LASER',
    desc: 'Стреляет тонким пустотным лучом по направлению прицела. Урон: высокий по линии. Улучшения добавляют новые звенья луча.',
    upgrade: ['+1 точка связи', '++длина каждого сегмента', '+урон луча']
  },
  signal_spike: {
    id: 'signal_spike', label: 'SIGNAL SPIKE', short: 'SPIKE', tone: 'cyan', role: 'DEPLOY NODE',
    desc: 'Ставит сигнальный шип в точке прицела. Урон: низкий, но частый. Зона замедляет и глушит пули.',
    upgrade: ['+1 заряд', '+немного длительность', '+немного урон зоны']
  },
  black_box: {
    id: 'black_box', label: 'BLACK BOX', short: 'BOX', tone: 'purple', role: 'STEALTH / SAFE',
    desc: 'Прячет тебя в чёрной области. Урон: нет. Враги снаружи теряют тебя как цель, ближайшие враги сбиваются.',
    upgrade: ['+радиус скрытия', '+длительность', '+дольше скрытие']
  },
  debt_pulse: {
    id: 'debt_pulse', label: 'STATIC PULSE', short: 'STC', tone: 'red', role: 'RISK BURST',
    desc: 'Красный статик-взрыв вокруг тебя. Урон: высокий. Ослабляет врагов, но может добавить уровень статик-шторма.',
    upgrade: ['+огромный радиус', '+урон волны', '+сильнее уязвимость']
  }
};

export const ACTIVE_MUTATIONS = {
  static: { id: 'static', label: 'STATIC', tone: 'cyan', role: 'FIELD', desc: 'После Q остаётся область: враги и пули в ней сильно замедляются.' },
  blood: { id: 'blood', label: 'BLOOD', tone: 'red', role: 'DAMAGE', desc: 'Добавляет кровавый урон. Сильнее по плотным группам; иногда стоит HP.' },
  echo: { id: 'echo', label: 'ECHO', tone: 'purple', role: 'RECAST', desc: 'Повторяет часть Q через короткую паузу: слабее, но шире покрывает бой.' },
  shrapnel: { id: 'shrapnel', label: 'SHRAPNEL', tone: 'cyan', role: 'BULLETS', desc: 'Q выпускает дополнительные пули из точки эффекта. Они используют твои бонусы оружия.' },
  casino: { id: 'casino', label: 'CASINO', tone: 'green', role: 'POST-ROLL', desc: 'После каждого Q запускается маленькая казино-проверка: награда, повтор Q или опасность.' },
  void: { id: 'void', label: 'VOID', tone: 'purple', role: 'PHASE', desc: 'После Q ты получаешь короткое окно неуязвимости и пустотный всплеск.' },
  leech: { id: 'leech', label: 'LEECH', tone: 'green', role: 'SUSTAIN', desc: 'Попадания активкой возвращают HP или GLD.' },
  armor_crack: { id: 'armor_crack', label: 'ARMOR CRACK', tone: 'purple', role: 'SHELL', desc: 'Q сильнее ломает защиту врагов и лучше раскрывает бронированные цели.' },
  anchor: { id: 'anchor', label: 'ANCHOR', tone: 'purple', role: 'LOCK ZONE', desc: 'Оставляет тяжёлую якорную область: врагов тянет к центру, пули теряют скорость, зона держится дольше.' },
  hunger: { id: 'hunger', label: 'HUNGER', tone: 'red', role: 'CHARGE BITE', desc: 'Q создаёт зону голода: чем больше врагов попадает внутрь, тем сильнее финальный цифровой укус.' },
  bad_tape: { id: 'bad_tape', label: 'BAD TAPE', tone: 'purple', role: 'GLITCH REPEAT', desc: 'Битая плёнка повторяет Q два раза: слабее, но с заметными сбоями.' }
};

export const ACTIVE_MUTATION_SLOTS = 3;

// Legacy ABL list is kept for dash/mobility side rewards. Q rewards are generated dynamically in sim.
export const ABILITY_CHEST_REWARDS = [
  { id: 'abl_dash', kind: 'ability_upgrade', upgrade: 'dash', label: 'DASH +1', desc: 'Даёт дополнительный заряд рывка. Простая, всегда полезная мобильность.' },
  { id: 'abl_voidstep', kind: 'ability_upgrade', upgrade: 'voidstep', label: 'DASH: VOID RIFT', desc: 'Весь путь рывка становится void-разрезом: враги вдоль траектории получают заметный урон. Повторные выборы увеличивают ширину и урон.' },
  { id: 'abl_dashcut', kind: 'ability_upgrade', upgrade: 'dashcut', label: 'DASH STUN', desc: 'Рывок оглушает врагов рядом с траекторией. Прокачка увеличивает радиус и длительность стана.' },
  { id: 'abl_dashclone', kind: 'ability_upgrade', upgrade: 'dashclone', label: 'DASH AFTERSHOCK', desc: 'После рывка в точке старта остаётся короткий ударный след, который ранит ближайших врагов.' },
  { id: 'abl_speed', kind: 'stat', stat: 'spd', label: 'MOBILITY +12%', desc: 'Увеличивает скорость движения. Это усиление мобильности из ABL-сундука.' },
  { id: 'abl_dashflow', kind: 'stat', stat: 'dashflow', label: 'DASH FLOW +20%', desc: 'Ускоряет восстановление рывка на 20%.' }
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
    dashAdd: 0, dashRegenMul: 1, drones: 0, orbitals: 0, luck: 0,
    procBlast: 0, echoShot: 0, lifesteal: 0, goldMul: 1,
    bulletBounce: 0, bulletRange: 1, bulletFire: 0, bulletFreeze: 0, bulletPoison: 0, bulletChain: 0, droneElementLink: 0, bulletElementAmp: 0, elementSpread: 0, shgBounce: 0, shgPellets: 0, shgLongshot: 0, sekSplit: 0, sekChain: 0, sekSwarm: 0, rktCluster: 0, rktMines: 0, rktStun: 0, rktScatter: 0, rktRemote: 0, rltBounce: 0, rltZero: 0, rltDmg: 0, rltSize: 0, rltFrag: 0, rltDepth: 0, rltWallBuff: 0, rltSpeed: 0, crdCards: 0, crdDmg: 0, crdBounce: 0,
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
  { id: 'living_casino', name: 'ЖИВОЕ КАЗИНО', rarity: 'basic', fill: '#120910', outline: '#ffd34d', barrel: '#b45cff', dash: '#ffd34d', dashAlt: '#f3f3f3', dashStyle: 'coin', note: 'новое ядро: не стреляет напрямую, а активирует казино-секторы вокруг себя' },
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
export function spinCasino(rng, stakeKey, luck, unlockedSkins = [], opts = {}) {
  const stake = BET_STAKES[stakeKey];
  const l = Math.max(0, Number(luck || 0) || 0);
  const known = new Set(Array.isArray(unlockedSkins) ? unlockedSkins : []);
  const hasLockedSkin = SKIN_PRESETS.some(s => s.rarity !== 'basic' && !known.has(s.id));
  const high = stakeKey === 'high';
  const mid = stakeKey === 'mid';
  const cleanSym = s => {
    const x = String(s || '').toUpperCase().replace(/\s+X\d+$/i, '').trim();
    return ['JCK','WPN','ABL','RAR','SKN','GLD','EXP','HEA','STC','BAD'].includes(x) ? x : '';
  };
  const slotLocks = Array.isArray(opts.slotLocks)
    ? opts.slotLocks.slice(0, 3).map(cleanSym)
    : [];
  while (slotLocks.length < 3) slotLocks.push('');
  const lockChoices = () => {
    const base = high
      ? ['JCK','RAR','WPN','ABL','SKN','GLD','EXP','HEA','STC']
      : mid
        ? ['RAR','WPN','ABL','GLD','EXP','HEA','STC']
        : ['WPN','GLD','EXP','HEA','STC'];
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
      ['RAR', (high ? 0.017 : mid ? 0.007 : 0.0025) + l * 0.0045],
      ['WPN', 0.010 + (high ? 0.010 : mid ? 0.006 : 0) + l * 0.0055],
      ['ABL', (stakeKey === 'low' ? 0.0035 : (0.012 + (high ? 0.008 : 0))) + l * 0.0055],
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
  // v2.1.86: LOCK is a sticky-slot copier. The first locked symbol in the
  // terminal becomes the anchor. Every later LOCK, even in the same spin,
  // morphs into that same symbol and fixes its own slot until the BET terminal
  // closes. This allows lucky runs like WPN / LOCK / LOCK -> three fixed WPN.
  let lockAnchorSymbol = slotLocks.map(cleanSym).find(Boolean) || '';
  for (let i = 0; i < 3; i++) {
    const locked = cleanSym(slotLocks[i]);
    if (locked) {
      const finalLocked = locked === 'SKN' && !hasLockedSkin ? 'RAR' : locked;
      nextLocks[i] = finalLocked;
      symbols[i] = finalLocked;
      usedLock = true;
      if (!lockAnchorSymbol) lockAnchorSymbol = finalLocked;
      payload.cellRewards.push({ slot: i, raw: finalLocked, symbol: finalLocked, locked: 1 });
      continue;
    }
    const raw = drawCell();
    if (raw === 'LOCK') {
      const finalSymRaw = lockAnchorSymbol || drawLockPrize();
      const finalSym = finalSymRaw === 'SKN' && !hasLockedSkin ? 'RAR' : finalSymRaw;
      lockAnchorSymbol = finalSym;
      nextLocks[i] = finalSym;
      symbols[i] = finalSym;
      createdLock = true;
      payload.cellRewards.push({ slot: i, raw: 'LOCK', symbol: finalSym, lockCreated: 1, lockCopied: lockAnchorSymbol === finalSym ? 1 : 0 });
    } else {
      const finalSym = raw === 'SKN' && !hasLockedSkin ? 'RAR' : raw;
      nextLocks[i] = '';
      symbols[i] = finalSym;
      payload.cellRewards.push({ slot: i, raw, symbol: finalSym });
    }
  }
  payload.lockSlots = nextLocks.slice(0, 3);
  const add = (k, v = 1) => { payload[k] = Math.max(0, Number(payload[k] || 0)) + v; };
  const finalSymbols = symbols.map(x => String(x || '').toUpperCase().trim());
  const triple = finalSymbols.length === 3 && !!finalSymbols[0] && finalSymbols.every(x => x === finalSymbols[0]);
  const paySymbol = triple ? finalSymbols[0] : '';
  payload.tripleMatch = triple ? 1 : 0;
  payload.paySymbol = paySymbol;
  if (!triple) payload.noMatch = 1;

  // v2.1.84: casino payout is a real slot-machine rule again.
  // Individual prize-looking cells do not pay by themselves. A payout/penalty is
  // applied only when the three final cells match. LOCK still morphs and fixes
  // an individual slot, but its replacement symbol only matters for future
  // three-of-a-kind checks while the BET terminal stays open.
  if (triple) {
    switch (paySymbol) {
      case 'GLD': add('gld', Math.round(stake * (1.35 + rng() * 0.75))); add('gldCount'); break;
      case 'EXP': add('xp', Math.round(stake * 0.82)); add('xpCount'); break;
      case 'HEA': add('heal', 24 + Math.round(rng() * 22)); add('healCount'); break;
      case 'WPN': payload.weapon = true; add('weaponCount'); break;
      case 'ABL': payload.ability = true; add('abilityCount'); break;
      case 'RAR': payload.rare = true; add('rareCount'); break;
      case 'SKN': {
        add('skinCount');
        if (!payload.skin) {
          const skin = rollCasinoSkin(rng, stakeKey, luck, unlockedSkins);
          payload.skin = true; payload.skinId = skin.id; payload.skinLabel = skin.name; payload.skinRarity = skin.rarity;
        }
        break;
      }
      case 'STC': payload.static = true; add('staticCount'); break;
      case 'JCK': payload.jackpotCount = 3; add('gld', Math.round(stake * 2.75)); add('xp', Math.round(stake * 0.80)); break;
      case 'BAD': add('missCount', 3); break;
    }
  }
  if (createdLock) {
    payload.lock = true;
    payload.lockCreated = 1;
    const lockSummary = new Map();
    for (const c of payload.cellRewards.filter(c => c.lockCreated)) {
      const sym = String(c.symbol || '').toUpperCase().trim() || '—';
      lockSummary.set(sym, (lockSummary.get(sym) || 0) + 1);
    }
    payload.lockLabel = [...lockSummary.entries()].map(([sym, n]) => n > 1 ? `${sym} x${n}` : sym).join(' + ');
  }
  let outcome = 'LOSE';
  if (triple) {
    if (paySymbol === 'JCK') outcome = 'JCK';
    else if (paySymbol === 'STC') outcome = 'STC';
    else if (paySymbol && paySymbol !== 'BAD') outcome = paySymbol;
  } else if (createdLock) outcome = 'LOCK';
  return {
    symbols,
    outcome,
    payload,
    stake,
    usedLock,
    lockSymbol: usedLock ? slotLocks.filter(Boolean).join('+') : '',
    lockSlots: nextLocks.slice(0, 3)
  };
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
