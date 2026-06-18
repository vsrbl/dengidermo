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
    cooldown: 1.45, pellets: 1, spread: 0.015, dmg: 92, speed: 335, life: 2.25, size: 9, aoe: 94, knock: 210, detonateDist: 560
  }
};
export const WEAPON_ORDER = ['shotgun', 'seeker', 'rocketgun'];

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

  boss:     { label: 'BOS', hp: 1300, spd: 60,  size: 72, dmg: 26, boss: true, armor: 0.25, fireCd: 2.6, bulletSpd: 230, xp: 140, gld: 120, score: 20 }
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
  { id: 'orbital',  label: 'ORBITAL +1',           tier: 1, desc: 'Добавляет орбиталь, которая бьёт ближайших врагов рядом с собой.', apply: s => { s.orbitals += 1; } },
  { id: 'orb_speed', label: 'ORBITAL SEEK +20%',    tier: 1, desc: 'Орбитали быстрее тянутся к ближайшей угрозе.', apply: s => { s.orbSpeed += 1; } },
  { id: 'orb_range', label: 'ORBITAL RANGE +35%',   tier: 1, desc: 'Орбитали замечают врагов и пули немного дальше.', apply: s => { s.orbRange += 1; } },
  { id: 'luck',     label: 'LUCK +1',              tier: 1, desc: 'Лучше броски апгрейдов и казино.', apply: s => { s.luck += 1; } },
  { id: 'proc',     label: 'BLAST CHANCE 10%',     tier: 1, desc: 'Попадания пуль могут создавать маленький взрыв.', apply: s => { s.procBlast += 0.10; } },
  { id: 'echo',     label: 'ECHO SHOT 12%',        tier: 1, desc: 'Иногда оружие выпускает дополнительный выстрел. Повторные выборы делают это чаще.', apply: s => { s.echoShot += 0.12; } },
  { id: 'leech',    label: 'LIFESTEAL 2%',         tier: 1, desc: 'Лечение от нанесённого урона.', apply: s => { s.lifesteal += 0.02; } },
  { id: 'goldgun',  label: 'GLD ON KILL +40%',     tier: 1, desc: 'Больше золота за смерти врагов.', apply: s => { s.goldMul *= 1.4; } },

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
  { id: 'orbreflect',label: 'ORBITALS REFLECT',    tier: 2, desc: 'Орбитали могут стирать вражеские пули.', apply: s => { s.orbReflect += 1; } },
  { id: 'debtengine',label: 'STATIC CORE',         tier: 2, cursed: true, desc: 'Большой урон и удача, но боевые комнаты становятся опаснее от статик-шторма.', apply: s => { s.dmgMul *= 1.35; s.luck += 2; s.debtEngine += 1; } },
  { id: 'overload',  label: 'DMG +50% / HP -15',  tier: 2, cursed: true, apply: s => { s.dmgMul *= 1.5; s.maxHpAdd -= 15; } },
  { id: 'gamble',    label: 'LUCK +3 / SPD -10%', tier: 2, cursed: true, apply: s => { s.luck += 3; s.spdMul *= 0.9; } }
];

export const UPGRADE_LABELS = Object.fromEntries(UPGRADES.map(u => [u.id, u.label]));
export const CURSED_UPGRADE_IDS = UPGRADES.filter(u => u.cursed).map(u => u.id);

// INSTALL / level-up upgrades are HERO ONLY.
// Weapon-specific branches live in WPN chest choices, not level-up offers.
export const WEAPON_BRANCHES = ['ALL', 'SHG', 'SEK', 'RKT'];
export const HERO_UPGRADES = UPGRADES.filter(u => !WEAPON_BRANCHES.includes(u.branch) && u.branch !== 'Q');
export const WEAPON_UPGRADE_IDS = UPGRADES.filter(u => WEAPON_BRANCHES.includes(u.branch)).map(u => u.id);

export const WEAPON_CHEST_REWARDS = [
  { id: 'weapon_seeker', kind: 'weapon', weapon: 'seeker', label: 'SEK WEAPON', desc: 'Открывает SEEKER: медленный самонаводящийся цифровой снаряд с ограниченной дальностью.' },
  { id: 'weapon_rocketgun', kind: 'weapon', weapon: 'rocketgun', label: 'RKT WEAPON', desc: 'Открывает ROCKETGUN: тяжёлая ракета с большим областьным взрывом.' },
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
  { id: 'sek_chain', kind: 'weapon_upgrade', upgrade: 'sek_chain', reqWeapon: 'seeker', label: 'SEK CHAIN LOCK', desc: 'SEEKER лучше держит цель и летит дольше.' },
  { id: 'sek_swarm', kind: 'weapon_upgrade', upgrade: 'sek_swarm', reqWeapon: 'seeker', label: 'SEK SWARM RMB', desc: 'Апгрейд SEK: ПКМ выпускает рой самонаводящихся пуль, распределённых по разным врагам.' },
  { id: 'rkt_cluster', kind: 'weapon_upgrade', upgrade: 'rkt_cluster', reqWeapon: 'rocketgun', label: 'RKT CLUSTER +2', desc: 'Ракета добавляет мини-взрывы вокруг детонации.' },
  { id: 'rkt_mines', kind: 'weapon_upgrade', upgrade: 'rkt_mines', reqWeapon: 'rocketgun', label: 'RKT STATIC MINES', desc: 'Ракеты оставляют отложенные областьные мины.' },
  { id: 'rkt_stun', kind: 'weapon_upgrade', upgrade: 'rkt_stun', reqWeapon: 'rocketgun', label: 'RKT STUN BLASTS', desc: 'Ракетные взрывы могут оглушать врагов.' },
  { id: 'rkt_scatter', kind: 'weapon_upgrade', upgrade: 'rkt_scatter', reqWeapon: 'rocketgun', label: 'RKT SCATTER BLASTS', desc: 'Ракетные взрывы сильнее разбрасывают врагов.' },
  { id: 'rkt_remote', kind: 'weapon_upgrade', upgrade: 'rkt_remote', reqWeapon: 'rocketgun', label: 'RKT REMOTE DETONATOR', desc: 'ПКМ взрывает выпущенные ракеты по одной, начиная со старой.' },
  { id: 'wpn_dmg', kind: 'stat', stat: 'dmg', label: 'WEAPON DMG +18%', desc: 'Усиливает общий урон оружия.' },
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
    dmgMul: 1, fireMul: 1, spdMul: 1, maxHpAdd: 0, magnetMul: 1,
    dashAdd: 0, dashRegenMul: 1, drones: 0, orbitals: 0, luck: 0,
    procBlast: 0, echoShot: 0, lifesteal: 0, goldMul: 1,
    bulletBounce: 0, bulletRange: 1, bulletFire: 0, bulletFreeze: 0, bulletPoison: 0, bulletChain: 0, droneElementLink: 0, bulletElementAmp: 0, elementSpread: 0, shgBounce: 0, shgPellets: 0, shgLongshot: 0, sekSplit: 0, sekChain: 0, sekSwarm: 0, rktCluster: 0, rktMines: 0, rktStun: 0, rktScatter: 0, rktRemote: 0,
    voidStep: 0, dashCut: 0, dashClone: 0,
    activeSnap: 0, activeBlood: 0, activeOver: 0,
    droneProc: 0, orbReflect: 0, orbSpeed: 0, orbRange: 0, debtEngine: 0,
    tempFire: 0
  };
}

// ---- chests -------------------------------------------------------------
export const CHESTS = {
  basic_chest:   { label: 'BSC', cost: 0 },
  weapon_chest:  { label: 'WPN', cost: 60 },
  ability_chest: { label: 'ABL', cost: 55 },
  rare_chest:    { label: 'RAR', cost: 40 },
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
  { id: 'terminal_mint', name: 'TERMINAL MINT', rarity: 'basic', fill: '#f3f3f3', outline: '#00ff66', barrel: '#00ff66', dash: '#00ff66', dashAlt: '#f3f3f3', dashStyle: 'terminal', note: 'чистый базовый сигнал / зелёный dash-шов' },
  { id: 'debt_red', name: 'RED STATIC', rarity: 'basic', fill: '#120406', outline: '#ff3048', barrel: '#ff3048', dash: '#ff3048', dashAlt: '#f3f3f3', dashStyle: 'debt', note: 'красный статик-сигнал / красный dash-разрыв' },
  { id: 'void_cyan', name: 'VOID CYAN', rarity: 'uncommon', fill: '#061114', outline: '#66f6ff', barrel: '#f3f3f3', dash: '#66f6ff', dashAlt: '#b45cff', dashStyle: 'phase', note: 'холодная пустота / фазовый dash-шлейф' },
  { id: 'casino_gold', name: 'CASINO GOLD', rarity: 'uncommon', fill: '#171104', outline: '#ffd34d', barrel: '#00ff66', dash: '#ffd34d', dashAlt: '#00ff66', dashStyle: 'coin', note: 'выигрышная рамка / золотой рывок' },
  { id: 'bruise_purple', name: 'BRUISE PURPLE', rarity: 'uncommon', fill: '#100617', outline: '#b45cff', barrel: '#ff3048', dash: '#b45cff', dashAlt: '#ff3048', dashStyle: 'bruise', note: 'синяк сигнала / фиолетовый dash-надрез' },
  { id: 'bone_static', name: 'BONE STATIC', rarity: 'rare', fill: '#d8d0bd', outline: '#6f6f6f', barrel: '#66f6ff', dash: '#d8d0bd', dashAlt: '#66f6ff', dashStyle: 'static', note: 'костяной шум / scanline dash' },
  { id: 'black_lime', name: 'BLACK LIME', rarity: 'rare', fill: '#020202', outline: '#a6ff00', barrel: '#a6ff00', dash: '#a6ff00', dashAlt: '#f3f3f3', dashStyle: 'lime', note: 'кислотный крест / резкий lime dash' },
  { id: 'bad_tv', name: 'BAD TV', rarity: 'rare', fill: '#ffffff', outline: '#111111', barrel: '#ff3048', dash: '#f3f3f3', dashAlt: '#ff3048', dashStyle: 'tv', note: 'пересвет / TV dash-срыв' },
  { id: 'red_static', name: 'RED STATIC', rarity: 'superrare', fill: '#060101', outline: '#ff3048', barrel: '#66f6ff', dash: '#ff3048', dashAlt: '#66f6ff', dashStyle: 'red_static', note: 'красные помехи / dash оставляет битый канал' },
  { id: 'mirror_coin', name: 'MIRROR COIN', rarity: 'superrare', fill: '#090909', outline: '#ffd34d', barrel: '#ffd34d', dash: '#ffd34d', dashAlt: '#f3f3f3', dashStyle: 'mirror', note: 'ложная монета / зеркальный dash-дубль' },
  { id: 'terminal_ghost', name: 'TERMINAL GHOST', rarity: 'superrare', fill: '#e8fff2', outline: '#66f6ff', barrel: '#00ff66', dash: '#66f6ff', dashAlt: '#00ff66', dashStyle: 'ghost', note: 'призрачный терминал / спектральный рывок' },
  { id: 'jackpot_wound', name: 'JACKPOT WOUND', rarity: 'legendary', fill: '#160005', outline: '#ffd34d', barrel: '#ff3048', dash: '#ffd34d', dashAlt: '#ff3048', dashStyle: 'jackpot', legendarySfx: 'dash_jackpot', note: 'легендарная рана казино / рывок оставляет слот-осколки и монетные клетки' },
  { id: 'dead_channel', name: 'DEAD CHANNEL', rarity: 'legendary', fill: '#000000', outline: '#f3f3f3', barrel: '#66f6ff', dash: '#f3f3f3', dashAlt: '#66f6ff', dashStyle: 'dead_channel', legendarySfx: 'dash_dead_channel', note: 'мёртвый канал / рывок оставляет битые ТВ-кадры и строчные помехи' }
];
export const DEFAULT_UNLOCKED_SKINS = SKIN_PRESETS.filter(s => s.rarity === 'basic').map(s => s.id);

export function rollCasinoSkin(rng, stakeKey = 'low', luck = 0, unlocked = []) {
  const known = new Set(Array.isArray(unlocked) ? unlocked : []);
  const luckBoost = Math.min(luck, 12) * 0.18;
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
export const BET_STAKES = { low: 20, mid: 50, high: 120 };
export function spinCasino(rng, stakeKey, luck, unlockedSkins = []) {
  const stake = BET_STAKES[stakeKey];
  const l = Math.min(luck, 12) * 0.012;
  const r = rng();
  const known = new Set(Array.isArray(unlockedSkins) ? unlockedSkins : []);
  const hasLockedSkin = SKIN_PRESETS.some(s => s.rarity !== 'basic' && !known.has(s.id));
  // v2.1: ordinary BET was too generous. Good outcomes are roughly halved,
  // while LOSE/STC remain real risk. SKN is disabled if the local player owns all non-basic skins.
  const skinOdds = hasLockedSkin ? ((stakeKey === 'high' ? 0.028 : stakeKey === 'mid' ? 0.019 : 0.012) + l * 0.05) : 0;
  const odds = [
    ['JCK', 0.006 + l * 0.18],
    ['WPN', 0.020 + l * 0.36],
    ['ABL', stakeKey === 'low' ? 0 : (0.025 + l * 0.36)],
    ['SKN', skinOdds],
    ['HEA', 0.052 + l * 0.36],
    ['EXP', 0.073 + l * 0.36],
    ['GLD', 0.082 + l * 0.36],
    ['STC', 0.135]
  ];
  let acc = 0;
  let outcome = 'LOSE';
  for (const [id, chance] of odds) { acc += chance; if (r < acc) { outcome = id; break; } }
  const sym = () => ['GLD','HEA','EXP','WPN','ABL','STC','GLD','HEA','EXP'][Math.floor(rng()*9)];
  let symbols;
  if (outcome === 'LOSE') { symbols = [sym(), sym(), sym()]; if (symbols[0]===symbols[1]&&symbols[1]===symbols[2]) symbols[2]='STC'; }
  else if (outcome === 'JCK') symbols = ['JCK','JCK','JCK'];
  else symbols = [outcome, outcome, outcome];
  const payload = {};
  switch (outcome) {
    case 'GLD': payload.gld = Math.round(stake * (1.35 + rng() * 1.15)); break;
    case 'EXP': payload.xp = Math.round(stake * 1.05); break;
    case 'HEA': payload.heal = 30 + Math.round(rng() * 30); break;
    case 'WPN': payload.weapon = true; break;
    case 'ABL': payload.ability = true; break;
    case 'SKN': { const skin = rollCasinoSkin(rng, stakeKey, luck, unlockedSkins); payload.skin = true; payload.skinId = skin.id; payload.skinLabel = skin.name; payload.skinRarity = skin.rarity; break; }
    case 'STC': payload.static = true; break;
    case 'JCK': payload.gld = Math.round(stake * 6); payload.xp = Math.round(stake * 1.8); break;
    case 'LOSE': break;
  }
  return { symbols, outcome, payload, stake };
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
  anchor_gravity:  { id: 'anchor_gravity',  label: 'ANCHOR GRAVITY' },
  skin_cache:      { id: 'skin_cache',      label: 'SKN CACHE' }
};

export const ROOM_SEQUENCE = ['grid', 'void', 'core', 'boss'];
export const SPECIAL_ROOMS = {
  signal_contract: { id: 'signal_contract', label: 'SIGNAL CONTRACT' },
  reward_pocket:   { id: 'reward_pocket',   label: 'REWARD POCKET' },
  debt_node:       { id: 'debt_node',       label: 'STATIC NODE' },
  chill_room:      { id: 'chill_room',      label: 'CHILL ROOM' }
};
