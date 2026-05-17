import { START_WEAPON, WEAPONS } from "../data/weapons.js";

export function normalizeWeaponId(weaponId) {
  return WEAPONS[weaponId] ? weaponId : START_WEAPON;
}

export function createInventory(initialWeapons = [START_WEAPON]) {
  const weapons = [];
  for (const id of initialWeapons) {
    if (WEAPONS[id] && !weapons.includes(id)) weapons.push(id);
  }
  if (!weapons.length) weapons.push(START_WEAPON);
  return {
    weapons,
    activeWeapon: weapons[0],
    items: {},
    passives: []
  };
}

export function ensureInventory(player) {
  if (!player.inventory) player.inventory = createInventory([START_WEAPON]);
  player.inventory.weapons = player.inventory.weapons.filter((id, index, arr) => WEAPONS[id] && arr.indexOf(id) === index);
  if (!player.inventory.weapons.length) player.inventory.weapons.push(START_WEAPON);
  if (!WEAPONS[player.inventory.activeWeapon] || !player.inventory.weapons.includes(player.inventory.activeWeapon)) {
    player.inventory.activeWeapon = player.inventory.weapons[0];
  }
  return player.inventory;
}

export function getActiveWeaponId(player) {
  return ensureInventory(player).activeWeapon;
}

export function getActiveWeaponDef(player) {
  return WEAPONS[getActiveWeaponId(player)] || WEAPONS[START_WEAPON];
}

export function getWeaponList(player) {
  return ensureInventory(player).weapons;
}

export function hasWeapon(player, weaponId) {
  const id = normalizeWeaponId(weaponId);
  return ensureInventory(player).weapons.includes(id);
}

export function giveWeapon(player, weaponId, autoEquip = true) {
  const id = normalizeWeaponId(weaponId);
  const inventory = ensureInventory(player);
  const isNew = !inventory.weapons.includes(id);
  if (isNew) inventory.weapons.push(id);
  if (autoEquip || !WEAPONS[inventory.activeWeapon]) inventory.activeWeapon = id;
  return { weaponId: id, isNew };
}

export function switchWeapon(player, weaponId) {
  const id = normalizeWeaponId(weaponId);
  const inventory = ensureInventory(player);
  if (!inventory.weapons.includes(id)) return false;
  inventory.activeWeapon = id;
  return true;
}

export function switchWeaponSlot(player, slotIndex) {
  const inventory = ensureInventory(player);
  const id = inventory.weapons[slotIndex];
  if (!id) return false;
  return switchWeapon(player, id);
}

export function cycleWeapon(player, dir = 1) {
  const inventory = ensureInventory(player);
  if (inventory.weapons.length <= 1) return false;
  const current = inventory.weapons.indexOf(inventory.activeWeapon);
  const next = (current + dir + inventory.weapons.length) % inventory.weapons.length;
  return switchWeapon(player, inventory.weapons[next]);
}

export function inventorySnapshot(player) {
  const inventory = ensureInventory(player);
  return {
    weapons: inventory.weapons.slice(0, 9),
    activeWeapon: inventory.activeWeapon
  };
}
