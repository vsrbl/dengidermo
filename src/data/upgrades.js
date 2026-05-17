export const UPGRADES = {
  overclock: {
    id: "overclock",
    name: "OVERCLOCK",
    desc: "+14% fire rate",
    weight: 6,
    maxStacks: 6,
    mods: { fireRateMult: 0.14 }
  },

  lightFrame: {
    id: "lightFrame",
    name: "LIGHT FRAME",
    desc: "+12% move speed",
    weight: 6,
    maxStacks: 6,
    mods: { speedMult: 0.12 }
  },

  heavyPayload: {
    id: "heavyPayload",
    name: "HEAVY PAYLOAD",
    desc: "+15% damage",
    weight: 5,
    maxStacks: 6,
    mods: { damageMult: 0.15 }
  },

  fastRounds: {
    id: "fastRounds",
    name: "FAST ROUNDS",
    desc: "+15% projectile speed",
    weight: 4,
    maxStacks: 5,
    mods: { projectileSpeedMult: 0.15 }
  },

  blastCore: {
    id: "blastCore",
    name: "BLAST CORE",
    desc: "+18% explosions",
    weight: 4,
    maxStacks: 5,
    mods: { explosionRadiusMult: 0.18, explosionDamageMult: 0.12 }
  },

  extraHeart: {
    id: "extraHeart",
    name: "EXTRA HEART",
    desc: "+22 max HP, heal 22",
    weight: 5,
    maxStacks: 5,
    mods: { maxHp: 22, heal: 22 }
  },

  hardKick: {
    id: "hardKick",
    name: "HARD KICK",
    desc: "+20% knockback",
    weight: 3,
    maxStacks: 5,
    mods: { knockbackMult: 0.2 }
  }
};

export const UPGRADE_IDS = Object.keys(UPGRADES);

export function getUpgrade(id) {
  return UPGRADES[id] || null;
}

function stackCount(player, id) {
  return player.upgrades?.taken?.[id] || 0;
}

function canOffer(player, id) {
  const upgrade = getUpgrade(id);
  if (!upgrade) return false;
  return stackCount(player, id) < (upgrade.maxStacks || 1);
}

export function rollUpgradeChoices(rng, player, count = 3) {
  const pool = UPGRADE_IDS.filter((id) => canOffer(player, id));
  const choices = [];

  while (choices.length < count && pool.length) {
    const total = pool.reduce((sum, id) => sum + (UPGRADES[id].weight || 1), 0);
    let roll = rng.range(0, total);
    let picked = pool[0];
    for (const id of pool) {
      roll -= UPGRADES[id].weight || 1;
      if (roll <= 0) {
        picked = id;
        break;
      }
    }
    choices.push(picked);
    pool.splice(pool.indexOf(picked), 1);
  }

  return choices;
}
