import { WORLD } from "../core/constants.js";
import { clamp, dist2 } from "../core/math.js";
import { LOOT, weightedLoot } from "../data/loot.js";
import { getLocation } from "../data/locations.js";
import { nextId, pushEvent } from "./state.js";
import { giveWeapon } from "./inventory.js";

export function dropLoot(state, x, y, chance = 0.28) {
  if (state.rng.next() > chance) return;
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

export function updateLoot(state) {
  for (const player of Object.values(state.players)) {
    if (player.hp <= 0) continue;
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
