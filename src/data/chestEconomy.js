import { CHEST_PRICE_BALANCE } from "./economyBalance.js";

export const CHEST_RARITY_IDS = Object.freeze({
  BASIC: "basic",
  WEAPON: "weapon",
  ABILITY: "ability",
  RARE: "rare",
  CURSED: "cursed"
});

export const CHEST_VISUALS = Object.freeze({
  basic_chest: Object.freeze({ code: "BSC", label: "BSC", accent: "white", color: "#f3f3f3" }),
  weapon_chest: Object.freeze({ code: "WPN", label: "WPN", accent: "green", color: "#00ff66" }),
  ability_chest: Object.freeze({ code: "ABL", label: "ABL", accent: "cyan", color: "#66f6ff" }),
  rare_chest: Object.freeze({ code: "RAR", label: "RAR", accent: "bright_green", color: "#baffd2" }),
  cursed_chest: Object.freeze({ code: "CRS", label: "CRS", accent: "purple", color: "#b45cff" })
});

export const CHEST_OPEN_PRICES = Object.freeze({
  basic_chest: Object.freeze(CHEST_PRICE_BALANCE.basic_chest),
  weapon_chest: Object.freeze(CHEST_PRICE_BALANCE.weapon_chest),
  ability_chest: Object.freeze(CHEST_PRICE_BALANCE.ability_chest),
  rare_chest: Object.freeze(CHEST_PRICE_BALANCE.rare_chest),
  cursed_chest: Object.freeze(CHEST_PRICE_BALANCE.cursed_chest)
});

function loopIndexFromContext(context = {}) {
  const value = Number.isFinite(context.loopIndex)
    ? context.loopIndex
    : Number.isFinite(context.roomPlan?.loopIndex)
      ? context.roomPlan.loopIndex
      : Number.isFinite(context.state?.roomPlan?.loopIndex)
        ? context.state.roomPlan.loopIndex
        : Number.isFinite(context.state?.loopIndex)
          ? context.state.loopIndex
          : 0;
  return Math.max(0, Math.floor(value));
}

export function chestVisualFor(chestId) {
  return CHEST_VISUALS[chestId] || CHEST_VISUALS.basic_chest;
}

export function chestOpenPriceConfig(chestId) {
  return CHEST_OPEN_PRICES[chestId] || CHEST_OPEN_PRICES.basic_chest;
}

export function chestOpenCostFor(chestId, context = {}) {
  const price = chestOpenPriceConfig(chestId);
  const loopIndex = loopIndexFromContext(context);
  const raw = (price.base || 0) + loopIndex * (price.perLoop || 0);
  const min = Number.isFinite(price.min) ? price.min : 0;
  const max = Number.isFinite(price.max) ? price.max : Infinity;
  return Math.max(min, Math.min(max, Math.floor(raw)));
}
