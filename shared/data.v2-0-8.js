// nncckkrr content data: weapons, enemies, upgrades, chests, casino, modifiers

export const WEAPONS = {
  shotgun: {
    id: 'shotgun', label: 'SHG', name: 'SHOTGUN',
    cooldown: 0.55, pellets: 6, spread: 0.38, dmg: 7, speed: 620, life: 0.45, size: 5, knock: 60
  },
  seeker: {
    id: 'seeker', label: 'SEK', name: 'SEEKER',
    cooldown: 0.34, pellets: 1, spread: 0.05, dmg: 13, speed: 480, life: 1.6, size: 6, homing: 7.5, knock: 30
  },
  rocketgun: {
    id: 'rocketgun', label: 'RKT', name: 'ROCKETGUN',
    cooldown: 0.92, pellets: 1, spread: 0.02, dmg: 32, speed: 360, life: 2.0, size: 8, aoe: 85, knock: 160, detonateDist: 520
  }
};
export const WEAPON_ORDER = ['shotgun', 'seeker', 'rocketgun'];

// ---- enemies ------------------------------------------------------------
// kinds communicate mechanics: silhouette + behavior contract
export const ENEMIES = {
  grunt:   { label: 'GRT', hp: 26,  spd: 115,  size: 24, dmg: 10, touch: true,  xp: 6,  gld: 4,  score: 1 },
  runner:  { label: 'RUN', hp: 16,  spd: 215, size: 18, dmg: 8,  touch: true,  xp: 7,  gld: 4,  score: 1 },
  tank:    { label: 'TNK', hp: 120, spd: 55,  size: 42, dmg: 18, touch: true,  xp: 18, gld: 12, score: 3, armor: 0.35 },
  shooter: { label: 'SHT', hp: 30,  spd: 80,  size: 24, dmg: 9,  ranged: true, fireCd: 1.4, bulletSpd: 260, keep: 320, xp: 10, gld: 7, score: 2 },
  charger: { label: 'CHG', hp: 44,  spd: 75,  size: 28, dmg: 22, charges: true, windup: 0.75, chargeSpd: 520, chargeTime: 0.55, chargeCd: 2.4, xp: 12, gld: 8, score: 2 },
  bomber:  { label: 'BMB', hp: 22,  spd: 130, size: 22, dmg: 30, bombs: true, fuse: 0.9, blast: 95, xp: 10, gld: 7, score: 2 },
  bouncer: { label: 'BNC', hp: 38,  spd: 240, size: 26, dmg: 12, bounces: true, push: 260, xp: 14, gld: 9, score: 2 },   // no fatigue, no stun
  glitch:  { label: 'GLT', hp: 34,  spd: 70,  size: 24, dmg: 16, blinks: true, blinkCd: 2.2, blinkRange: 230, strikeCd: 0.5, xp: 14, gld: 10, score: 2 },
  boss:    { label: 'BOS', hp: 1300, spd: 60,  size: 72, dmg: 26, boss: true, armor: 0.25, fireCd: 2.6, bulletSpd: 230, xp: 140, gld: 120, score: 20 }
};

// which kinds can spawn at which loop
export const SPAWN_POOLS = [
  ['grunt', 'runner', 'shooter', 'charger'],                                   // loop 0
  ['grunt', 'runner', 'shooter', 'charger', 'bomber', 'bouncer'],              // loop 1
  ['grunt', 'runner', 'shooter', 'charger', 'bomber', 'bouncer', 'tank', 'glitch'], // loop 2
  ['grunt', 'runner', 'shooter', 'charger', 'bomber', 'bouncer', 'tank', 'glitch'] // loop 3+
];

// ---- upgrades (INSTALL) -------------------------------------------------
// All stackable. No caps. Balatro rules.
export const UPGRADES = [
  { id: 'dmg',      label: 'DMG +15%',        tier: 0, apply: s => { s.dmgMul *= 1.15; } },
  { id: 'fire',     label: 'FIRE RATE +12%',  tier: 0, apply: s => { s.fireMul *= 1.12; } },
  { id: 'spd',      label: 'SPD +8%',         tier: 0, apply: s => { s.spdMul *= 1.08; } },
  { id: 'maxhp',    label: 'HP +20',          tier: 0, apply: s => { s.maxHpAdd += 20; } },
  { id: 'magnet',   label: 'MAGNET +40%',     tier: 0, apply: s => { s.magnetMul *= 1.4; } },
  { id: 'dash',     label: 'DASH +1',         tier: 1, apply: s => { s.dashAdd += 1; } },
  { id: 'drone',    label: 'DRONE +1',        tier: 1, apply: s => { s.drones += 1; } },
  { id: 'orbital',  label: 'ORBITAL +1',      tier: 1, apply: s => { s.orbitals += 1; } },
  { id: 'luck',     label: 'LUCK +1',         tier: 1, apply: s => { s.luck += 1; } },
  { id: 'proc',     label: 'BLAST PROC 10%',  tier: 1, apply: s => { s.procBlast += 0.10; } },
  { id: 'echo',     label: 'ECHO SHOT 12%',   tier: 1, apply: s => { s.echoShot += 0.12; } },
  { id: 'leech',    label: 'LIFESTEAL 2%',    tier: 1, apply: s => { s.lifesteal += 0.02; } },
  { id: 'goldgun',  label: 'GLD ON KILL +40%',tier: 1, apply: s => { s.goldMul *= 1.4; } },
  { id: 'overload', label: 'DMG +50% / HP -15', tier: 2, cursed: true, apply: s => { s.dmgMul *= 1.5; s.maxHpAdd -= 15; } },
  { id: 'gamble',   label: 'LUCK +3 / SPD -10%', tier: 2, cursed: true, apply: s => { s.luck += 3; s.spdMul *= 0.9; } }
];

export function rollUpgradeChoices(rng, luck, count = 3) {
  const choices = [];
  const used = new Set();
  let guard = 0;
  while (choices.length < count && guard++ < 60) {
    const tierRoll = rng() * 100 + luck * 4;
    let pool;
    if (tierRoll > 92) pool = UPGRADES.filter(u => u.tier === 2);
    else if (tierRoll > 60) pool = UPGRADES.filter(u => u.tier === 1);
    else pool = UPGRADES.filter(u => u.tier === 0);
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
    dashAdd: 0, drones: 0, orbitals: 0, luck: 0,
    procBlast: 0, echoShot: 0, lifesteal: 0, goldMul: 1
  };
}

// ---- chests -------------------------------------------------------------
export const CHESTS = {
  basic_chest:  { label: 'BSC', cost: 0 },
  weapon_chest: { label: 'WPN', cost: 60 },
  ability_chest:{ label: 'ABL', cost: 50 },
  rare_chest:   { label: 'RAR', cost: 90 },
  cursed_chest: { label: 'CRS', cost: 0, cursed: true }
};

// ---- casino / BET -------------------------------------------------------
export const BET_STAKES = { low: 20, mid: 50, high: 120 };
// symbols: GLD HEA EXP WPN ABL STC JCK
// returns {symbols:[a,b,c], outcome, payload}
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
    case 'ABL': payload.dash = 1; break;
    case 'STC': payload.static = true; break;          // debt: next room danger
    case 'JCK': payload.gld = stake * 10; payload.xp = stake * 3; break;
    case 'LOSE': break;
  }
  return { symbols, outcome, payload, stake };
}

// ---- room modifiers (rule events, not stat tweaks) ----------------------
export const ROOM_MODS = {
  blackout:   { id: 'blackout',   label: 'BLACKOUT' },     // visibility collapses, beacons pulse
  static_rain:{ id: 'static_rain',label: 'STATIC RAIN' },  // telegraphed strikes, baitable
  greed:      { id: 'greed',      label: 'GREED SIGNAL' }  // +gold +chests +enemy pressure
};

export const ROOM_SEQUENCE = ['grid', 'void', 'core', 'boss'];
