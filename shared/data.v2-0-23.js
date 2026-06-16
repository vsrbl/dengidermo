// nncckkrr content data: weapons, enemies, upgrades, chests, casino, modifiers

export const WEAPONS = {
  shotgun: {
    id: 'shotgun', label: 'SHG', name: 'SHOTGUN',
    cooldown: 0.035, charges: 4, chargeRegen: 0.8, pellets: 6, spread: 0.42, dmg: 8, speed: 700, life: 0.42, size: 5, knock: 82
  },
  seeker: {
    id: 'seeker', label: 'SEK', name: 'SEEKER',
    cooldown: 0.72, pellets: 1, spread: 0.025, dmg: 20, speed: 340, life: 1.55, maxDist: 620, size: 7, homing: 4.6, knock: 36
  },
  rocketgun: {
    id: 'rocketgun', label: 'RKT', name: 'ROCKETGUN',
    cooldown: 1.45, pellets: 1, spread: 0.015, dmg: 46, speed: 335, life: 2.25, size: 9, aoe: 94, knock: 210, detonateDist: 560
  }
};
export const WEAPON_ORDER = ['shotgun', 'seeker', 'rocketgun'];

// ---- enemies ------------------------------------------------------------
// kinds communicate mechanics: silhouette + behavior contract
export const ENEMIES = {
  grunt:    { label: 'GRT', hp: 26,   spd: 115, size: 24, dmg: 10, touch: true,  xp: 6,  gld: 4,  score: 1 },
  runner:   { label: 'RUN', hp: 16,   spd: 215, size: 18, dmg: 8,  touch: true,  xp: 7,  gld: 4,  score: 1 },
  tank:     { label: 'TNK', hp: 120,  spd: 55,  size: 42, dmg: 18, touch: true,  xp: 18, gld: 12, score: 3, armor: 0.35 },
  shooter:  { label: 'SHT', hp: 30,   spd: 80,  size: 24, dmg: 9,  ranged: true, fireCd: 1.4, bulletSpd: 260, keep: 320, xp: 10, gld: 7, score: 2 },
  charger:  { label: 'CHG', hp: 44,   spd: 75,  size: 28, dmg: 22, charges: true, windup: 0.75, chargeSpd: 520, chargeTime: 0.55, chargeCd: 2.4, xp: 12, gld: 8, score: 2 },
  bomber:   { label: 'BMB', hp: 22,   spd: 130, size: 22, dmg: 30, bombs: true, fuse: 0.9, blast: 95, xp: 10, gld: 7, score: 2 },
  bouncer:  { label: 'BNC', hp: 38,   spd: 240, size: 26, dmg: 12, bounces: true, push: 260, xp: 14, gld: 9, score: 2 },
  glitch:   { label: 'GLT', hp: 34,   spd: 70,  size: 24, dmg: 16, blinks: true, blinkCd: 2.2, blinkRange: 230, strikeCd: 0.5, xp: 14, gld: 10, score: 2 },

  // anomaly pack
  echo:     { label: 'ECH', hp: 48,   spd: 145, size: 26, dmg: 12, echo: true, mirrorFireCd: 1.15, xp: 18, gld: 12, score: 3 },
  orbiter:  { label: 'ORB', hp: 70,   spd: 120, size: 28, dmg: 14, orbiter: true, orbitR: 150, fireCd: 1.9, bulletSpd: 240, shield: 0.65, xp: 20, gld: 14, score: 3 },
  anchor:   { label: 'ANC', hp: 150,  spd: 34,  size: 46, dmg: 8,  anchor: true, fieldR: 250, pull: 80, xp: 26, gld: 18, score: 4, armor: 0.20 },
  splitter: { label: 'SPL', hp: 90,   spd: 92,  size: 38, dmg: 13, splitter: true, splits: 2, xp: 20, gld: 12, score: 3 },
  prism:    { label: 'PRS', hp: 56,   spd: 60,  size: 30, dmg: 12, prism: true, fireCd: 2.2, beamSpd: 310, xp: 18, gld: 13, score: 3 },
  pulse:    { label: 'PLS', hp: 62,   spd: 78,  size: 32, dmg: 16, pulse: true, fireCd: 2.3, waveSpd: 360, xp: 18, gld: 13, score: 3 },
  leech:    { label: 'LCH', hp: 52,   spd: 105, size: 26, dmg: 9,  leech: true, healCd: 1.0, heal: 16, linkR: 360, xp: 22, gld: 14, score: 3 },
  warden:   { label: 'WRD', hp: 96,   spd: 68,  size: 36, dmg: 11, armorWarden: true, linkR: 380, xp: 28, gld: 18, score: 4, armor: 0.38, shellMul: 0.55 },
  damper:   { label: 'DMP', hp: 118,  spd: 0,   size: 44, dmg: 0,  damper: true, immobile: true, fieldR: 280, bulletDamp: 0.018, stopSpd: 42, xp: 30, gld: 18, score: 4 },
  herald:   { label: 'HRD', hp: 180,  spd: 52,  size: 48, dmg: 12, herald: true, summonCd: 4.2, tetherDmg: 3, xp: 36, gld: 28, score: 5, armor: 0.18 },

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
  { id: 'magnet',   label: 'MAGNET +40%',          tier: 0, desc: 'Радиус притяжения pickups растёт.', apply: s => { s.magnetMul *= 1.4; } },
  { id: 'dash',     label: 'DASH +1',              tier: 1, desc: 'Больше зарядов рывка.', apply: s => { s.dashAdd += 1; } },
  { id: 'drone',    label: 'DRONE +1',             tier: 1, desc: 'Добавляет спутника, который стреляет автоматически.', apply: s => { s.drones += 1; } },
  { id: 'orbital',  label: 'ORBITAL +1',           tier: 1, desc: 'Добавляет орбиталь с контактным уроном.', apply: s => { s.orbitals += 1; } },
  { id: 'luck',     label: 'LUCK +1',              tier: 1, desc: 'Лучше броски апгрейдов и казино.', apply: s => { s.luck += 1; } },
  { id: 'proc',     label: 'BLAST PROC 10%',       tier: 1, desc: 'Попадания пуль могут создавать взрывы. Больше 100% даёт дополнительные взрывы.', apply: s => { s.procBlast += 0.10; } },
  { id: 'echo',     label: 'ECHO SHOT 12%',        tier: 1, desc: 'Больше дополнительных выстрелов. Больше 100% даёт дополнительные пули.', apply: s => { s.echoShot += 0.12; } },
  { id: 'leech',    label: 'LIFESTEAL 2%',         tier: 1, desc: 'Лечение от нанесённого урона.', apply: s => { s.lifesteal += 0.02; } },
  { id: 'goldgun',  label: 'GLD ON KILL +40%',     tier: 1, desc: 'Больше золота за смерти врагов.', apply: s => { s.goldMul *= 1.4; } },

  // weapon branches. These are WPN-chest rewards only, not INSTALL/level-up rewards.
  { id: 'bullet_ricochet', label: 'BULLET RICOCHET +1', tier: 1, branch: 'ALL', desc: 'Все снаряды игрока получают +1 отскок от стен: SHG, SEK, дроны, фрагменты и RKT-ракеты. Каждый стак добавляет ещё один отскок.', apply: s => { s.bulletBounce += 1; } },
  { id: 'bullet_range',    label: 'BULLET RANGE +22%',  tier: 1, branch: 'ALL', desc: 'Дальность/время жизни растёт для всех снарядов игрока: SHG, SEK, RKT, дронов, фрагментов и мин.', apply: s => { s.bulletRange *= 1.22; } },
  { id: 'shg_teeth',  label: 'SHG TEETH +2 PELLETS', tier: 1, branch: 'SHG', desc: 'SHG получает две дополнительные дробины.', apply: s => { s.shgPellets += 2; } },
  { id: 'sek_split',  label: 'SEK SPLIT ON KILL',  tier: 1, branch: 'SEK', desc: 'Убийства SEK выпускают маленькие самонаводящиеся фрагменты.', apply: s => { s.sekSplit += 1; } },
  { id: 'sek_chain',  label: 'SEK CHAIN LOCK',     tier: 1, branch: 'SEK', desc: 'У SEK улучшаются наведение и время жизни.', apply: s => { s.sekChain += 1; } },
  { id: 'rkt_cluster',label: 'RKT CLUSTER +2',     tier: 1, branch: 'RKT', desc: 'Ракеты распадаются на мини-взрывы.', apply: s => { s.rktCluster += 1; } },
  { id: 'rkt_mines',  label: 'RKT STATIC MINES',   tier: 1, branch: 'RKT', desc: 'Ракеты оставляют отложенные квадратные мины.', apply: s => { s.rktMines += 1; } },

  // ability / active branches
  { id: 'voidstep',  label: 'DASH: VOID STEP',     tier: 1, branch: 'DASH', desc: 'Рывок оставляет наносящий урон циановый разрез.', apply: s => { s.voidStep += 1; } },
  { id: 'dashcut',   label: 'DASH CUTS BULLETS',  tier: 1, branch: 'DASH', desc: 'Рывок стирает вражеские пули рядом с траекторией.', apply: s => { s.dashCut += 1; } },
  { id: 'dashclone', label: 'DASH CLONE',         tier: 1, branch: 'DASH', desc: 'Рывок выпускает echo-всплеск в точке старта.', apply: s => { s.dashClone += 1; } },
  { id: 'q_snap',    label: 'Q: FIELD SNAP',      tier: 1, branch: 'Q', desc: 'Q стягивает врагов внутрь и наносит урон.', apply: s => { s.activeSnap += 1; } },
  { id: 'q_blood',   label: 'Q: BLOOD PULSE',     tier: 1, branch: 'Q', desc: 'Q тратит HP ради красного квадратного взрыва.', apply: s => { s.activeBlood += 1; } },
  { id: 'q_over',    label: 'Q: OVERCLOCK',       tier: 1, branch: 'Q', desc: 'Q временно ускоряет стрельбу.', apply: s => { s.activeOver += 1; } },

  // high rarity rule-breakers
  { id: 'droneproc', label: 'DRONES COPY PROC',    tier: 2, desc: 'Пули дронов получают часть BLAST PROC.', apply: s => { s.droneProc += 1; } },
  { id: 'orbreflect',label: 'ORBITALS REFLECT',    tier: 2, desc: 'Орбитали могут стирать вражеские пули.', apply: s => { s.orbReflect += 1; } },
  { id: 'debtengine',label: 'DEBT ENGINE',         tier: 2, cursed: true, desc: 'Большой урон и удача, но следующие комнаты получают статический долг.', apply: s => { s.dmgMul *= 1.35; s.luck += 2; s.debtEngine += 1; } },
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
  { id: 'weapon_rocketgun', kind: 'weapon', weapon: 'rocketgun', label: 'RKT WEAPON', desc: 'Открывает ROCKETGUN: тяжёлая ракета с дистанционной детонацией.' },
  { id: 'bullet_ricochet', kind: 'weapon_upgrade', upgrade: 'bullet_ricochet', label: 'BULLET RICOCHET +1', desc: 'Общий апгрейд оружия: все снаряды игрока получают дополнительный отскок от стен, включая ракеты RKT.' },
  { id: 'bullet_range', kind: 'weapon_upgrade', upgrade: 'bullet_range', label: 'BULLET RANGE +22%', desc: 'Общий апгрейд оружия: дальность/жизнь растёт у всех снарядов игрока, включая ракеты.' },
  { id: 'shg_teeth', kind: 'weapon_upgrade', upgrade: 'shg_teeth', reqWeapon: 'shotgun', label: 'SHG TEETH +2 PELLETS', desc: 'Апгрейд SHG: больше дробин в каждом залпе.' },
  { id: 'sek_split', kind: 'weapon_upgrade', upgrade: 'sek_split', reqWeapon: 'seeker', label: 'SEK SPLIT ON KILL', desc: 'Апгрейд SEK: убийства выпускают самонаводящиеся фрагменты.' },
  { id: 'sek_chain', kind: 'weapon_upgrade', upgrade: 'sek_chain', reqWeapon: 'seeker', label: 'SEK CHAIN LOCK', desc: 'Апгрейд SEK: лучше наведение и дольше жизнь снаряда.' },
  { id: 'rkt_cluster', kind: 'weapon_upgrade', upgrade: 'rkt_cluster', reqWeapon: 'rocketgun', label: 'RKT CLUSTER +2', desc: 'Апгрейд RKT: ракета добавляет мини-взрывы вокруг детонации.' },
  { id: 'rkt_mines', kind: 'weapon_upgrade', upgrade: 'rkt_mines', reqWeapon: 'rocketgun', label: 'RKT STATIC MINES', desc: 'Апгрейд RKT: ракеты оставляют отложенные квадратные мины.' },
  { id: 'wpn_dmg', kind: 'stat', stat: 'dmg', label: 'WEAPON DMG +18%', desc: 'Усиливает общий урон оружия. Доступно всегда.' },
  { id: 'wpn_fire', kind: 'stat', stat: 'fire', label: 'WEAPON FIRE +14%', desc: 'Ускоряет перезарядку оружия. Доступно всегда.' }
];


export const ACTIVE_CORES = {
  blood_ring: {
    id: 'blood_ring', label: 'BLOOD RING', short: 'RING', tone: 'red',
    desc: 'Квадратная зона вокруг игрока. Пульсирует, наносит урон врагам рядом и играет от позиционирования.',
    upgrade: ['+радиус', '+урон тиков', '-cooldown']
  },
  field_snap: {
    id: 'field_snap', label: 'FIELD SNAP', short: 'SNAP', tone: 'cyan',
    desc: 'Стягивает врагов и pickups к игроку, затем бьёт импульсом. Отлично собирает толпу под оружие.',
    upgrade: ['+радиус', '+сила стяжки', '+урон']
  },
  bullet_freeze: {
    id: 'bullet_freeze', label: 'BULLET FREEZE', short: 'FREEZE', tone: 'cyan',
    desc: 'На короткое время ломает вражеские пули вокруг игрока: замедляет, гасит и даёт окно для выхода.',
    upgrade: ['+радиус', '+длительность', '+число стёртых пуль']
  },
  shell_ripper: {
    id: 'shell_ripper', label: 'SHELL RIPPER', short: 'RIP', tone: 'purple',
    desc: 'Бьёт по armor/shell вокруг игрока, рвёт linked armor и превращает броню врагов в уязвимость.',
    upgrade: ['+радиус', '+урон по shell', '+осколки']
  }
};

export const ACTIVE_MUTATIONS = {
  static: { id: 'static', label: 'STATIC', tone: 'cyan', desc: 'После каста остаётся квадратное поле: враги и пули в нём замедляются.' },
  blood: { id: 'blood', label: 'BLOOD', tone: 'red', desc: 'Добавляет кровавый урон. Сильнее, когда рядом много врагов; иногда стоит HP.' },
  echo: { id: 'echo', label: 'ECHO', tone: 'purple', desc: 'Повторяет часть активки через короткую задержку, слабее, но хаотичнее.' },
  shrapnel: { id: 'shrapnel', label: 'SHRAPNEL', tone: 'cyan', desc: 'Каст выпускает player bullets из точки эффекта. Работает с рикошетом, дальностью и уроном.' },
  casino: { id: 'casino', label: 'CASINO', tone: 'green', desc: 'Добавляет roll: jackpot может дать GLD/HEA/EXP, но иногда создаёт STATIC DEBT.' },
  void: { id: 'void', label: 'VOID', tone: 'purple', desc: 'После каста игрок получает короткий phase/invuln и грязный циановый разрез.' },
  leech: { id: 'leech', label: 'LEECH', tone: 'green', desc: 'Попадания активкой возвращают HP или GLD.' },
  armor_crack: { id: 'armor_crack', label: 'ARMOR CRACK', tone: 'purple', desc: 'Активка сильнее ломает shell и linked armor.' }
};

export const ACTIVE_MUTATION_SLOTS = 3;

// Legacy ABL list is kept for dash/mobility side rewards. Q core/mutation offers are generated dynamically in sim.
export const ABILITY_CHEST_REWARDS = [
  { id: 'abl_dash', kind: 'ability_upgrade', upgrade: 'dash', label: 'DASH +1', desc: 'Даёт дополнительный заряд рывка. Простая, всегда полезная мобильность.' },
  { id: 'abl_voidstep', kind: 'ability_upgrade', upgrade: 'voidstep', label: 'DASH: VOID STEP', desc: 'Рывок оставляет циановый разрез, который наносит урон по линии.' },
  { id: 'abl_dashcut', kind: 'ability_upgrade', upgrade: 'dashcut', label: 'DASH CUTS BULLETS', desc: 'Рывок стирает вражеские пули рядом с траекторией.' },
  { id: 'abl_dashclone', kind: 'ability_upgrade', upgrade: 'dashclone', label: 'DASH CLONE', desc: 'Рывок оставляет echo-всплеск в точке старта.' },
  { id: 'abl_speed', kind: 'stat', stat: 'spd', label: 'MOBILITY +12%', desc: 'Увеличивает скорость движения. Это награда ABL, не level-up оружейная ветка.' },
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
    bulletBounce: 0, bulletRange: 1, shgBounce: 0, shgPellets: 0, sekSplit: 0, sekChain: 0, rktCluster: 0, rktMines: 0,
    voidStep: 0, dashCut: 0, dashClone: 0,
    activeSnap: 0, activeBlood: 0, activeOver: 0,
    droneProc: 0, orbReflect: 0, debtEngine: 0,
    tempFire: 0
  };
}

// ---- chests -------------------------------------------------------------
export const CHESTS = {
  basic_chest:   { label: 'BSC', cost: 0 },
  weapon_chest:  { label: 'WPN', cost: 60 },
  ability_chest: { label: 'ABL', cost: 50 },
  rare_chest:    { label: 'RAR', cost: 90 },
  cursed_chest:  { label: 'CRS', cost: 0, cursed: true }
};

// ---- casino / BET -------------------------------------------------------
export const BET_STAKES = { low: 20, mid: 50, high: 120 };
export function spinCasino(rng, stakeKey, luck) {
  const stake = BET_STAKES[stakeKey];
  const l = Math.min(luck, 12) * 0.012;
  const r = rng();
  let outcome;
  if (r < 0.015 + l * 0.5) outcome = 'JCK';
  else if (r < 0.06 + l) outcome = 'WPN';
  else if (r < 0.12 + l) outcome = 'ABL';
  else if (r < 0.24 + l) outcome = 'HEA';
  else if (r < 0.40 + l) outcome = 'EXP';
  else if (r < 0.58 + l) outcome = 'GLD';
  else if (r < 0.70) outcome = 'STC';
  else outcome = 'LOSE';
  const sym = () => ['GLD','HEA','EXP','WPN','ABL','STC'][Math.floor(rng()*6)];
  let symbols;
  if (outcome === 'LOSE') { symbols = [sym(), sym(), sym()]; if (symbols[0]===symbols[1]&&symbols[1]===symbols[2]) symbols[2]='STC'; }
  else if (outcome === 'JCK') symbols = ['JCK','JCK','JCK'];
  else symbols = [outcome, outcome, outcome];
  const payload = {};
  switch (outcome) {
    case 'GLD': payload.gld = Math.round(stake * (2 + rng() * 2)); break;
    case 'EXP': payload.xp = Math.round(stake * 1.6); break;
    case 'HEA': payload.heal = 30 + Math.round(rng() * 30); break;
    case 'WPN': payload.weapon = true; break;
    case 'ABL': payload.ability = true; break;
    case 'STC': payload.static = true; break;
    case 'JCK': payload.gld = stake * 10; payload.xp = stake * 3; break;
    case 'LOSE': break;
  }
  return { symbols, outcome, payload, stake };
}

// ---- room modifiers (rule events, not stat tweaks) ----------------------
export const ROOM_MODS = {
  blackout:        { id: 'blackout',        label: 'BLACKOUT' },
  static_rain:     { id: 'static_rain',     label: 'STATIC RAIN' },
  greed:           { id: 'greed',           label: 'GREED SIGNAL' },
  debt_floor:      { id: 'debt_floor',      label: 'DEBT FLOOR' },
  hunter_contract: { id: 'hunter_contract', label: 'HUNTER CONTRACT' },
  casino_virus:    { id: 'casino_virus',    label: 'CASINO VIRUS' },
  mirror_room:     { id: 'mirror_room',     label: 'MIRROR ROOM' }
};

export const ROOM_SEQUENCE = ['grid', 'void', 'core', 'boss'];
export const SPECIAL_ROOMS = {
  signal_contract: { id: 'signal_contract', label: 'SIGNAL CONTRACT' },
  reward_pocket:   { id: 'reward_pocket',   label: 'REWARD POCKET' },
  debt_node:       { id: 'debt_node',       label: 'DEBT NODE' }
};
