import { WORLD } from "../core/constants.js";
import { clamp, dist2 } from "../core/math.js";
import { LOOT, weightedLoot } from "../data/loot.js";
import { getPlannedLocationForState } from "./runPlanner.js";
import { attractLootToPlayer, buildPlayerEffects, healPlayer, resolveLootRoll } from "./effects.js";
import { nextId } from "./entityIds.js";
import { pushEvent } from "./events.js";
import { giveWeapon } from "./inventory.js";

export function spawnLoot(state, kind, x, y, options = {}) {
  const data = LOOT[kind];
  if (!state || !data) return null;
  if (!state.loot) state.loot = {};
  const jitter = Number.isFinite(options.jitter) ? Math.max(0, options.jitter) : 0;
  const id = nextId("loot");
  const item = {
    id,
    kind,
    x: clamp(x + (jitter ? state.rng.range(-jitter, jitter) : 0), 20, WORLD.w - 20),
    y: clamp(y + (jitter ? state.rng.range(-jitter, jitter) : 0), 20, WORLD.h - 20),
    radius: data.radius,
    sourceType: options.sourceType || null,
    sourceId: options.sourceId || null
  };
  state.loot[id] = item;
  return item;
}

export function dropLoot(state, x, y, chance = 0.28, sourcePlayerId = null) {
  const source = sourcePlayerId ? state.players?.[sourcePlayerId] : null;
  // ARCHITECTURE GUARD: loot economy modifiers must flow through LOOT_ROLL.
  // Do not hand-read luck/magnet values here; add loot effects via hooks.
  const roll = source ? resolveLootRoll(state, source, { chance }) : { chance };
  if (state.rng.next() > roll.chance) return;

  const loc = getPlannedLocationForState(state);
  const kind = weightedLoot(state.rng, loc.lootPool);
  return spawnLoot(state, kind, x, y, { jitter: 18, sourceType: "enemy", sourceId: sourcePlayerId });
}

export function updateLoot(state, dt = 0.016) {
  for (const player of Object.values(state.players)) {
    player.effects = buildPlayerEffects(player);
    if (player.hp <= 0) continue;

    for (const item of Object.values(state.loot)) attractLootToPlayer(player, item, dt, state);

    for (const item of Object.values(state.loot)) {
      const data = LOOT[item.kind];
      const r = player.radius + data.radius + 4;
      if (dist2(player.x, player.y, item.x, item.y) > r * r) continue;
      if (data.type === "heal") {
        healPlayer(state, player, { amount: data.amount, sourceType: "loot", tags: ["loot", item.kind] });
      }
      if (data.type === "weapon") {
        giveWeapon(player, data.weaponId, true);
      }
      delete state.loot[item.id];
      pushEvent(state, { type: "pickup", playerId: player.id, kind: item.kind, x: item.x, y: item.y });
      break;
    }
  }
}
