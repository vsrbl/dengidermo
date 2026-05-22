import { GREEN, WORLD } from "../core/constants.js";
import { clamp, dist2, norm } from "../core/math.js";
import {
  EFFECT_HOOKS,
  dealDamage,
  runPlayerHook
} from "./effects.js";
import { companionDamageTags } from "./damageSourceMatrix.js";
import { finishEnemyKill } from "./enemyDeath.js";
import { pushVisualEffect } from "./effectCommands.js";
import { nextId } from "./entityIds.js";
import { pushEvent } from "./events.js";

const COMPANION_LIMIT = 8;
const ORBITAL_DEFAULT_RADIUS = 74;
const ORBITAL_DEFAULT_DAMAGE = 7;
const ORBITAL_DEFAULT_SPEED = 1.45;
const ORBITAL_DEFAULT_HIT_COOLDOWN = 0.38;
const DRONE_DEFAULT_RADIUS = 52;
const DRONE_DEFAULT_DAMAGE = 8;
const DRONE_DEFAULT_RANGE = 520;
const DRONE_DEFAULT_FIRE_RATE = 0.85;

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function ensureStore(state) {
  if (!state.companions) state.companions = {};
  return state.companions;
}

function desiredCompanionsForPlayer(state, player, dt) {
  const desired = [];
  const companionBoost = { damageMult: 0, hitCooldownMult: 0, rangeMult: 0 };
  runPlayerHook(state, player, EFFECT_HOOKS.PLAYER_TICK, { dt, desiredCompanions: desired, companionBoost }, {
    orbital(effect, c) {
      const count = Math.max(0, Math.min(COMPANION_LIMIT, Math.floor(finiteOr(effect.count, 0))));
      for (let i = 0; i < count; i += 1) {
        c.desiredCompanions.push({
          kind: "orbital",
          ownerId: c.player.id,
          slot: i,
          count,
          radius: clamp(finiteOr(effect.radius, ORBITAL_DEFAULT_RADIUS), 36, 160),
          damage: Math.max(1, finiteOr(effect.damage, ORBITAL_DEFAULT_DAMAGE)),
          orbitSpeed: clamp(finiteOr(effect.orbitSpeed, ORBITAL_DEFAULT_SPEED), 0.25, 4.5),
          hitCooldown: clamp(finiteOr(effect.hitCooldown, ORBITAL_DEFAULT_HIT_COOLDOWN), 0.08, 1.2)
        });
      }
    },
    drone(effect, c) {
      const count = Math.max(0, Math.min(COMPANION_LIMIT, Math.floor(finiteOr(effect.count, 0))));
      for (let i = 0; i < count; i += 1) {
        c.desiredCompanions.push({
          kind: "drone",
          ownerId: c.player.id,
          slot: i,
          count,
          radius: clamp(finiteOr(effect.radius, DRONE_DEFAULT_RADIUS), 30, 130),
          damage: Math.max(1, finiteOr(effect.damage, DRONE_DEFAULT_DAMAGE)),
          range: clamp(finiteOr(effect.range, DRONE_DEFAULT_RANGE), 160, 900),
          fireRate: clamp(finiteOr(effect.fireRate, DRONE_DEFAULT_FIRE_RATE), 0.15, 5.0),
          orbitSpeed: clamp(finiteOr(effect.orbitSpeed, 0.72), 0.1, 3.5)
        });
      }
    },
    companionBoost(effect, c) {
      c.companionBoost.damageMult += finiteOr(effect.damageMult, 0);
      c.companionBoost.hitCooldownMult += finiteOr(effect.hitCooldownMult, 0);
      c.companionBoost.rangeMult += finiteOr(effect.rangeMult, 0);
    }
  });

  const damageScale = Math.max(0.15, 1 + companionBoost.damageMult);
  const cooldownScale = Math.max(0.25, 1 + companionBoost.hitCooldownMult);
  const rangeScale = Math.max(0.4, 1 + companionBoost.rangeMult);
  for (const spec of desired) {
    spec.damage *= damageScale;
    if (spec.hitCooldown) spec.hitCooldown *= cooldownScale;
    if (spec.range) spec.range *= rangeScale;
  }
  return desired;
}

function companionKey(ownerId, kind, slot) {
  return `${ownerId}:${kind}:${slot}`;
}

function syncPlayerCompanions(state, player, dt) {
  const store = ensureStore(state);
  const desired = desiredCompanionsForPlayer(state, player, dt);
  const keep = new Set();

  for (const spec of desired) {
    const key = companionKey(spec.ownerId, spec.kind, spec.slot);
    keep.add(key);
    let companion = Object.values(store).find((c) => c.key === key);
    if (!companion) {
      const id = nextId("co");
      companion = {
        id,
        key,
        kind: spec.kind,
        ownerId: spec.ownerId,
        slot: spec.slot,
        x: player.x,
        y: player.y,
        angle: 0,
        cooldown: 0,
        hitCooldowns: {},
        age: 0
      };
      store[id] = companion;
    }
    Object.assign(companion, spec);
  }

  for (const companion of Object.values(store)) {
    if (companion.ownerId !== player.id) continue;
    if (!keep.has(companion.key)) delete store[companion.id];
  }
}

function removeInvalidCompanions(state) {
  const store = ensureStore(state);
  for (const companion of Object.values(store)) {
    const owner = state.players?.[companion.ownerId];
    if (!owner || owner.hp <= 0) delete store[companion.id];
  }
}

function nearestEnemy(state, x, y, range) {
  let best = null;
  let bestD = range * range;
  for (const enemy of Object.values(state.enemies || {})) {
    const d = dist2(x, y, enemy.x, enemy.y);
    if (d < bestD) {
      bestD = d;
      best = enemy;
    }
  }
  return best;
}

function moveCompanionAroundOwner(companion, owner, dt) {
  companion.age = (companion.age || 0) + dt;
  const count = Math.max(1, companion.count || 1);
  const slotAngle = ((companion.slot || 0) / count) * Math.PI * 2;
  const spin = (companion.kind === "orbital" ? 1 : -0.42) * (companion.orbitSpeed || 1) * companion.age * Math.PI * 2;
  const angle = slotAngle + spin;
  const radius = companion.radius || (companion.kind === "orbital" ? ORBITAL_DEFAULT_RADIUS : DRONE_DEFAULT_RADIUS);
  const tx = clamp(owner.x + Math.cos(angle) * radius, 16, WORLD.w - 16);
  const ty = clamp(owner.y + Math.sin(angle) * radius, 16, WORLD.h - 16);
  const smooth = companion.kind === "drone" ? 0.18 : 0.42;
  companion.x += (tx - companion.x) * Math.min(1, smooth + dt * 9);
  companion.y += (ty - companion.y) * Math.min(1, smooth + dt * 9);
  companion.angle = angle;
}

function tickHitCooldowns(companion, dt) {
  const table = companion.hitCooldowns || {};
  for (const [id, left] of Object.entries(table)) {
    const next = Math.max(0, left - dt);
    if (next <= 0) delete table[id];
    else table[id] = next;
  }
  companion.hitCooldowns = table;
}


function damageEnemyWithCompanion(state, companion, enemy, amount, x = enemy.x, y = enemy.y) {
  const damage = dealDamage(state, enemy, {
    amount,
    sourceId: companion.ownerId,
    companionId: companion.id,
    tags: companionDamageTags(companion.kind)
  });
  pushEvent(state, {
    type: "companionHit",
    companionId: companion.id,
    playerId: companion.ownerId,
    kind: companion.kind,
    x,
    y,
    amount: damage.done,
    tags: damage.tags
  });
  pushVisualEffect(state, {
    type: companion.kind === "drone" ? "droneBeam" : "orbitalHit",
    companionId: companion.id,
    x: Math.round(companion.x),
    y: Math.round(companion.y),
    x2: Math.round(enemy.x),
    y2: Math.round(enemy.y),
    r: companion.kind === "orbital" ? 18 : 12,
    color: GREEN,
    life: companion.kind === "drone" ? 0.12 : 0.16,
    maxLife: companion.kind === "drone" ? 0.12 : 0.16
  });
  if (damage.killed) finishEnemyKill(state, enemy, companion, damage);
  return damage;
}

function updateOrbital(state, companion, owner, dt) {
  tickHitCooldowns(companion, dt);
  moveCompanionAroundOwner(companion, owner, dt);
  const hitR = 15;
  for (const enemy of Object.values(state.enemies || {})) {
    if (companion.hitCooldowns[enemy.id] > 0) continue;
    const r = (enemy.radius || 10) + hitR;
    if (dist2(companion.x, companion.y, enemy.x, enemy.y) > r * r) continue;
    companion.hitCooldowns[enemy.id] = companion.hitCooldown || ORBITAL_DEFAULT_HIT_COOLDOWN;
    damageEnemyWithCompanion(state, companion, enemy, companion.damage || ORBITAL_DEFAULT_DAMAGE);
    if (!state.enemies[enemy.id]) break;
  }
}

function updateDrone(state, companion, owner, dt) {
  moveCompanionAroundOwner(companion, owner, dt);
  companion.cooldown = Math.max(0, (companion.cooldown || 0) - dt);
  if (companion.cooldown > 0) return;
  const target = nearestEnemy(state, companion.x, companion.y, companion.range || DRONE_DEFAULT_RANGE);
  if (!target) return;
  companion.cooldown = 1 / Math.max(0.15, companion.fireRate || DRONE_DEFAULT_FIRE_RATE);
  damageEnemyWithCompanion(state, companion, target, companion.damage || DRONE_DEFAULT_DAMAGE);
}

export function updateCompanions(state, dt) {
  // ARCHITECTURE GUARD: companions are owner-based entities and must live here,
  // not inside projectiles.js or renderer prediction. They may use shared damage,
  // hook and command primitives, but companion AI/state belongs to this system.
  ensureStore(state);
  for (const player of Object.values(state.players || {})) {
    if (player.hp > 0) syncPlayerCompanions(state, player, dt);
  }
  removeInvalidCompanions(state);

  for (const companion of Object.values(state.companions || {})) {
    const owner = state.players?.[companion.ownerId];
    if (!owner || owner.hp <= 0) continue;
    if (companion.kind === "orbital") updateOrbital(state, companion, owner, dt);
    else if (companion.kind === "drone") updateDrone(state, companion, owner, dt);
  }
}

export function companionSnapshot(companion) {
  return {
    id: companion.id,
    kind: companion.kind,
    ownerId: companion.ownerId,
    x: Number((companion.x || 0).toFixed(1)),
    y: Number((companion.y || 0).toFixed(1)),
    angle: Number((companion.angle || 0).toFixed(3)),
    slot: companion.slot || 0,
    count: companion.count || 1,
    cooldown: Number(Math.max(0, companion.cooldown || 0).toFixed(2))
  };
}

export function companionSummary(player, state) {
  const out = { orbital: 0, drone: 0 };
  for (const c of Object.values(state?.companions || {})) {
    if (c.ownerId !== player?.id) continue;
    if (c.kind === "orbital") out.orbital += 1;
    if (c.kind === "drone") out.drone += 1;
  }
  return out.orbital || out.drone ? out : null;
}
