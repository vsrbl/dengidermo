import { WORLD } from "../core/constants.js";
import { clamp, dist2 } from "../core/math.js";
import { LOOT, weightedLoot } from "../data/loot.js";
import { getLocation } from "../data/locations.js";
import { attractLootToPlayer, buildPlayerEffects, playerEffectValue } from "./effects.js";
import { nextId, pushEvent } from "./state.js";
import { giveWeapon } from "./inventory.js";

export function dropLoot(state, x, y, chance = 0.28, sourcePlayerId = null) {
  const source = sourcePlayerId ? state.players?.[sourcePlayerId] : null;
  const luckBonus = source ? playerEffectValue(source, "luck", "dropChance", 0) : 0;
  const finalChance = Math.max(0, Math.min(1, chance + luckBonus));
  if (state.rng.next() > finalChance) return;

  const loc = getLocation(state.locationIndex || 0);
  const kind = weightedLoot(state.rng, loc.lootPool);
  const data = LOOT[kind];
  const id = nextId("loot");
  state.loot[id] = {
    id,
    kind,
    x: clamp(x + state.rng.range(-18, 18), 20, WORLD.w - 20),
    y: clamp(y + state.rng.range(-18, 18), 20, WORLD.h - 20),
    radius: data.radius
  };
}

export function updateLoot(state, dt = 0.016) {
  for (const player of Object.values(state.players)) {
    player.effects = buildPlayerEffects(player);
    if (player.hp <= 0) continue;

    for (const item of Object.values(state.loot)) attractLootToPlayer(player, item, dt);

    for (const item of Object.values(state.loot)) {
      const data = LOOT[item.kind];
      const r = player.radius + data.radius + 4;
      if (dist2(player.x, player.y, item.x, item.y) > r * r) continue;
      if (data.type === "heal") {
        player.hp = Math.min(player.maxHp, player.hp + data.amount);
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
