// v37 upgrade synergy registry.
// ARCHITECTURE GUARD: synergy rules are data. Gameplay systems should consume
// synergyEffectsForPlayer()/synergyOfferMeta() instead of hardcoding upgrade
// pairs inside combat, UI or simulation.

export const SYNERGY_RULES = Object.freeze([
  {
    id: "burnChain",
    name: "BURN CHAIN",
    desc: "chain arcs can carry your burn build",
    requires: ["burnMark", "chainFork"],
    tags: ["status", "burn", "chain"],
    completeMultiplier: 2.15,
    effects: [
      { type: "chainStatus", scope: "projectile", status: "burn", statusScale: 0.62 }
    ]
  },
  {
    id: "critLeech",
    name: "CRIT LEECH",
    desc: "critical builds feed your direct lifesteal",
    requires: ["critChip", "lifesteal"],
    tags: ["crit", "sustain"],
    completeMultiplier: 1.9,
    effects: [
      { type: "lifesteal", scope: "projectile", percent: 0.018 }
    ]
  },
  {
    id: "droneAura",
    name: "DRONE AURA",
    desc: "team aura overclocks companion damage",
    requires: ["drone", "teamAura"],
    tags: ["companion", "team"],
    completeMultiplier: 1.85,
    effects: [
      { type: "companionBoost", scope: "player", damageMult: 0.16 }
    ]
  },
  {
    id: "orbitalShield",
    name: "ORBITAL SHIELD",
    desc: "shielded close-range builds hit harder",
    requires: ["orbital", "shield"],
    tags: ["companion", "defense"],
    completeMultiplier: 1.75,
    effects: [
      { type: "companionBoost", scope: "player", damageMult: 0.1, hitCooldownMult: -0.08 }
    ]
  },
  {
    id: "rocketCore",
    name: "ROCKET CORE",
    desc: "rocket mutations like each other",
    requires: ["splitRockets", "clusterBomb"],
    tags: ["rocket", "explosion"],
    completeMultiplier: 1.65,
    effects: [
      { type: "screenShake", scope: "projectile", weaponIds: ["rocket"], power: 1.2, life: 0.16 }
    ]
  }
]);

function taken(player) {
  return player?.upgrades?.taken || {};
}

export function hasUpgradeStack(player, id) {
  return (taken(player)[id] || 0) > 0;
}

export function synergyIsActive(player, rule) {
  return !!rule && rule.requires.every((id) => hasUpgradeStack(player, id));
}

export function activeSynergies(player) {
  return SYNERGY_RULES.filter((rule) => synergyIsActive(player, rule));
}

export function synergyEffectsForPlayer(player, scope = null) {
  const out = [];
  for (const rule of activeSynergies(player)) {
    for (const effect of rule.effects || []) {
      if (scope && effect.scope !== scope) continue;
      out.push({ ...effect, synergyId: rule.id, synergyName: rule.name, source: rule.id });
    }
  }
  return out;
}

function candidateCompletesRule(player, candidateId, rule) {
  if (!rule?.requires?.includes(candidateId)) return false;
  return rule.requires.every((id) => id === candidateId || hasUpgradeStack(player, id));
}

function candidateMovesTowardRule(player, candidateId, rule, candidate = null) {
  if (candidateCompletesRule(player, candidateId, rule)) return true;
  if (rule?.requires?.includes(candidateId)) return true;
  const tags = candidate?.tags || [];
  return tags.some((tag) => (rule.tags || []).includes(tag)) && rule.requires.some((id) => hasUpgradeStack(player, id));
}

export function synergyOfferMeta(player, candidateId, candidate = null) {
  let multiplier = 1;
  const hints = [];
  const ids = [];

  for (const rule of SYNERGY_RULES) {
    if (synergyIsActive(player, rule)) continue;
    if (candidateCompletesRule(player, candidateId, rule)) {
      multiplier *= rule.completeMultiplier || 1.8;
      hints.push(rule.name);
      ids.push(rule.id);
    } else if (candidateMovesTowardRule(player, candidateId, rule, candidate)) {
      multiplier *= 1.18;
    }
  }

  return { multiplier, hints: hints.slice(0, 2), synergyIds: ids.slice(0, 2) };
}
