import { ABILITY_IDS, ABILITIES, abilityIsKnown, getAbility } from "../data/abilities.js";

export function normalizeAbilityId(abilityId) {
  return abilityIsKnown(abilityId) ? abilityId : null;
}

export function createAbilityInventory(initialAbilities = [], activeAbility = null) {
  const ownedAbilities = [];
  for (const id of initialAbilities) {
    const abilityId = normalizeAbilityId(id);
    if (abilityId && !ownedAbilities.includes(abilityId)) ownedAbilities.push(abilityId);
  }
  const active = normalizeAbilityId(activeAbility) || ownedAbilities[0] || null;
  return {
    ownedAbilities,
    activeAbility: active && ownedAbilities.includes(active) ? active : (ownedAbilities[0] || null),
    shards: {}
  };
}

export function ensureAbilityInventory(player) {
  if (!player.abilityInventory) player.abilityInventory = createAbilityInventory();
  const inventory = player.abilityInventory;
  inventory.ownedAbilities = Array.isArray(inventory.ownedAbilities)
    ? inventory.ownedAbilities.filter((id, index, arr) => abilityIsKnown(id) && arr.indexOf(id) === index)
    : [];
  inventory.shards = inventory.shards && typeof inventory.shards === "object" ? inventory.shards : {};
  for (const id of Object.keys(inventory.shards)) {
    if (!abilityIsKnown(id)) delete inventory.shards[id];
    else inventory.shards[id] = Math.max(0, Math.floor(Number(inventory.shards[id]) || 0));
  }
  if (!abilityIsKnown(inventory.activeAbility) || !inventory.ownedAbilities.includes(inventory.activeAbility)) {
    inventory.activeAbility = inventory.ownedAbilities[0] || null;
  }
  return inventory;
}

export function hasAbility(player, abilityId) {
  const id = normalizeAbilityId(abilityId);
  if (!id) return false;
  return ensureAbilityInventory(player).ownedAbilities.includes(id);
}

export function grantAbility(player, abilityId, options = {}) {
  const id = normalizeAbilityId(abilityId);
  if (!player || !id) return { ok: false, reason: "unknown_ability" };
  const inventory = ensureAbilityInventory(player);
  const isNew = !inventory.ownedAbilities.includes(id);
  if (isNew) inventory.ownedAbilities.push(id);
  if (options.autoEquip !== false || !inventory.activeAbility) inventory.activeAbility = id;
  return { ok: true, abilityId: id, isNew, equipped: inventory.activeAbility === id };
}

export function grantAbilityShard(player, abilityId, amount = 1) {
  const id = normalizeAbilityId(abilityId);
  if (!player || !id) return { ok: false, reason: "unknown_ability" };
  const ability = getAbility(id);
  const inventory = ensureAbilityInventory(player);
  const add = Math.max(1, Math.floor(Number(amount) || 1));
  const current = Math.max(0, Math.floor(Number(inventory.shards[id]) || 0));
  const max = Math.max(1, Math.floor(Number(ability?.maxShards) || 3));
  inventory.shards[id] = Math.min(max, current + add);
  return { ok: true, abilityId: id, amount: add, total: inventory.shards[id], max };
}

export function activeAbilityConfig(player, abilityId = ABILITY_IDS.TELEPORT_DASH) {
  if (!hasAbility(player, abilityId)) return null;
  return ABILITIES[abilityId]?.config || null;
}

export function abilityInventorySnapshot(player) {
  const inventory = ensureAbilityInventory(player);
  return {
    ownedAbilities: inventory.ownedAbilities.slice(0, 8),
    activeAbility: inventory.activeAbility || null,
    shards: { ...inventory.shards }
  };
}
