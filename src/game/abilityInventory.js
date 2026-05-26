import { ABILITY_IDS, ABILITIES, abilityIsKnown, getAbility } from "../data/abilities.js";

export function normalizeAbilityId(abilityId) {
  return abilityIsKnown(abilityId) ? abilityId : null;
}

function finitePositiveInt(value, fallback = 0) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function compactAbilityMap(raw = {}) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!abilityIsKnown(id)) continue;
    out[id] = finitePositiveInt(value, 0);
  }
  return out;
}

export function createAbilityInventory(initialAbilities = [], activeAbility = null) {
  const ownedAbilities = [];
  const stacks = {};
  for (const id of initialAbilities) {
    const abilityId = normalizeAbilityId(id);
    if (!abilityId) continue;
    if (!ownedAbilities.includes(abilityId)) ownedAbilities.push(abilityId);
    stacks[abilityId] = (stacks[abilityId] || 0) + 1;
  }
  const active = normalizeAbilityId(activeAbility) || ownedAbilities[0] || null;
  return {
    ownedAbilities,
    activeAbility: active && ownedAbilities.includes(active) ? active : (ownedAbilities[0] || null),
    stacks,
    shards: {}
  };
}

export function ensureAbilityInventory(player) {
  if (!player.abilityInventory) player.abilityInventory = createAbilityInventory();
  const inventory = player.abilityInventory;
  inventory.ownedAbilities = Array.isArray(inventory.ownedAbilities)
    ? inventory.ownedAbilities.filter((id, index, arr) => abilityIsKnown(id) && arr.indexOf(id) === index)
    : [];
  inventory.stacks = compactAbilityMap(inventory.stacks);
  for (const id of inventory.ownedAbilities) {
    if (!inventory.stacks[id]) inventory.stacks[id] = 1;
  }
  for (const id of Object.keys(inventory.stacks)) {
    if (!inventory.ownedAbilities.includes(id)) inventory.ownedAbilities.push(id);
  }
  inventory.shards = compactAbilityMap(inventory.shards);
  if (!abilityIsKnown(inventory.activeAbility) || !inventory.ownedAbilities.includes(inventory.activeAbility)) {
    inventory.activeAbility = inventory.ownedAbilities[0] || null;
  }
  return inventory;
}

export function hasAbility(player, abilityId) {
  const id = normalizeAbilityId(abilityId);
  if (!id) return false;
  return abilityStackCount(player, id) > 0;
}

export function abilityStackCount(player, abilityId) {
  const id = normalizeAbilityId(abilityId);
  if (!player || !id) return 0;
  const inventory = ensureAbilityInventory(player);
  return finitePositiveInt(inventory.stacks[id], 0);
}

export function grantAbility(player, abilityId, options = {}) {
  const id = normalizeAbilityId(abilityId);
  if (!player || !id) return { ok: false, reason: "unknown_ability" };
  const inventory = ensureAbilityInventory(player);
  const before = finitePositiveInt(inventory.stacks[id], 0);
  const isNew = before <= 0;
  if (isNew && !inventory.ownedAbilities.includes(id)) inventory.ownedAbilities.push(id);
  inventory.stacks[id] = before + 1;
  if (options.autoEquip !== false || !inventory.activeAbility) inventory.activeAbility = id;
  return {
    ok: true,
    abilityId: id,
    isNew,
    equipped: inventory.activeAbility === id,
    stack: inventory.stacks[id],
    total: inventory.stacks[id],
    unlimited: true
  };
}

export function grantAbilityShard(player, abilityId, amount = 1) {
  const id = normalizeAbilityId(abilityId);
  if (!player || !id) return { ok: false, reason: "unknown_ability" };
  const inventory = ensureAbilityInventory(player);
  const add = Math.max(1, Math.floor(Number(amount) || 1));
  const current = Math.max(0, Math.floor(Number(inventory.shards[id]) || 0));
  inventory.shards[id] = current + add;
  const abilityGrant = grantAbility(player, id, { autoEquip: true });
  return {
    ok: abilityGrant.ok,
    abilityId: id,
    amount: add,
    total: inventory.shards[id],
    stack: abilityGrant.stack || abilityStackCount(player, id),
    unlimited: true,
    shardConvertedToStack: true
  };
}

export function activeAbilityConfig(player, abilityId = ABILITY_IDS.TELEPORT_DASH) {
  const id = normalizeAbilityId(abilityId);
  if (!id || !hasAbility(player, id)) return null;
  const ability = getAbility(id);
  const stack = abilityStackCount(player, id);
  return {
    ...(ability?.config || {}),
    stackCount: stack,
    maxCharges: Math.max(1, stack),
    unlimited: true
  };
}

export function abilityInventorySnapshot(player) {
  const inventory = ensureAbilityInventory(player);
  return {
    ownedAbilities: inventory.ownedAbilities.slice(0, 32),
    activeAbility: inventory.activeAbility || null,
    stacks: { ...inventory.stacks },
    shards: { ...inventory.shards }
  };
}
