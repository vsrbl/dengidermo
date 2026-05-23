import { WORLD } from "../../core/constants.js";
import { dist2, norm } from "../../core/math.js";
import { ROOM_MODIFIER_HOOKS, runRoomModifierHooks } from "../roomModifiers.js";
import { EFFECT_HOOKS, DAMAGE_TAGS, numberOr, clamp } from "./defs.js";
import { runLootHook } from "./damage.js";


const BASELINE_ECONOMY_ATTRACT_RADIUS = 42;
const BASELINE_ECONOMY_ATTRACT_FORCE = 118;
const CLEAR_ECONOMY_ATTRACT_RADIUS_BONUS = 78;
const CLEAR_ECONOMY_ATTRACT_FORCE_BONUS = 92;

function isEconomyPickup(item) {
  return item && (item.type === "money" || item.type === "xp" || item.type === "heal") && (item.delivery || item.recipientRule || item.sourceContractId);
}

function roomIsClearForPickupVacuum(state) {
  if (!state) return false;
  return Object.keys(state.enemies || {}).length === 0;
}

export function resolveLootRoll(state, player, spec = {}) {
  const baseChance = Math.max(0, numberOr(spec.chance, 0));
  const ctx = runLootHook(state, player, null, EFFECT_HOOKS.LOOT_ROLL, {
    chance: baseChance,
    baseChance,
    rareBonus: 0,
    tags: [...new Set(["loot", "roll", ...(Array.isArray(spec.tags) ? spec.tags : [])])]
  }, {
    luck(effect, c) {
      c.chance += numberOr(effect.dropChance, 0);
      // Reserved by design: tracked for future loot value / rarity weighting,
      // but v36 still uses the existing weightedLoot table unchanged.
      c.rareBonus += numberOr(effect.rare, 0);
    }
  });

  const roomCtx = runRoomModifierHooks(state, ROOM_MODIFIER_HOOKS.LOOT_ROLL, ctx);

  return {
    chance: clamp(roomCtx.chance, 0, 1),
    baseChance,
    rareBonus: clamp(roomCtx.rareBonus || 0, 0, 1),
    tags: roomCtx.tags
  };
}

export function attractLootToPlayer(player, item, dt, state = null) {
  if (!player || !item || player.hp <= 0) return null;

  const ctx = runLootHook(state, player, item, EFFECT_HOOKS.LOOT_ATTRACT, {
    dt,
    radius: 0,
    force: 0
  }, {
    magnet(effect, c) {
      c.radius += numberOr(effect.radius, 0);
      c.force += numberOr(effect.force, 0);
    }
  });

  if (isEconomyPickup(item)) {
    ctx.radius = Math.max(0, ctx.radius || 0) + BASELINE_ECONOMY_ATTRACT_RADIUS;
    ctx.force = Math.max(0, ctx.force || 0) + BASELINE_ECONOMY_ATTRACT_FORCE;
    ctx.baselineMagnet = true;
    if (roomIsClearForPickupVacuum(state)) {
      ctx.radius += CLEAR_ECONOMY_ATTRACT_RADIUS_BONUS;
      ctx.force += CLEAR_ECONOMY_ATTRACT_FORCE_BONUS;
      ctx.clearVacuumBoost = true;
    }
  }

  const radius = Math.max(0, ctx.radius || 0);
  if (!radius) return ctx;
  const d2 = dist2(player.x, player.y, item.x, item.y);
  if (d2 > radius * radius) return ctx;
  const d = norm(player.x - item.x, player.y - item.y);
  const force = Math.max(40, ctx.force || 420);
  const proximity = 1 - Math.min(1, Math.sqrt(d2) / radius);
  item.x = clamp(item.x + d.x * force * (0.25 + proximity) * dt, 8, WORLD.w - 8);
  item.y = clamp(item.y + d.y * force * (0.25 + proximity) * dt, 8, WORLD.h - 8);
  ctx.moved = true;
  return ctx;
}
