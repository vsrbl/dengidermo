export const CASINO_SYMBOL_IDS = Object.freeze({
  COIN: "coin",
  HEART: "heart",
  XP: "xp",
  WEAPON: "weapon",
  ABILITY: "ability",
  STATIC: "static",
  JACKPOT: "jackpot"
});

export const CASINO_SYMBOLS = Object.freeze({
  [CASINO_SYMBOL_IDS.COIN]: Object.freeze({ id: CASINO_SYMBOL_IDS.COIN, label: "COIN", glyph: "$", accent: "green", weight: 18, tags: Object.freeze(["money", "payout"]) }),
  [CASINO_SYMBOL_IDS.HEART]: Object.freeze({ id: CASINO_SYMBOL_IDS.HEART, label: "HEART", glyph: "+", accent: "green", weight: 14, tags: Object.freeze(["heal", "payout"]) }),
  [CASINO_SYMBOL_IDS.XP]: Object.freeze({ id: CASINO_SYMBOL_IDS.XP, label: "XP", glyph: "XP", accent: "green", weight: 16, tags: Object.freeze(["xp", "payout"]) }),
  [CASINO_SYMBOL_IDS.WEAPON]: Object.freeze({ id: CASINO_SYMBOL_IDS.WEAPON, label: "WEAPON", glyph: "W", accent: "white", weight: 7, tags: Object.freeze(["weapon", "reward"]) }),
  [CASINO_SYMBOL_IDS.ABILITY]: Object.freeze({ id: CASINO_SYMBOL_IDS.ABILITY, label: "ABILITY", glyph: "A", accent: "white", weight: 5, tags: Object.freeze(["ability", "reward"]) }),
  [CASINO_SYMBOL_IDS.STATIC]: Object.freeze({ id: CASINO_SYMBOL_IDS.STATIC, label: "STATIC", glyph: "#!", accent: "red", weight: 6, tags: Object.freeze(["curse", "static", "risk"]) }),
  [CASINO_SYMBOL_IDS.JACKPOT]: Object.freeze({ id: CASINO_SYMBOL_IDS.JACKPOT, label: "JACKPOT", glyph: "777", accent: "green", weight: 2, tags: Object.freeze(["jackpot", "rare"]) })
});

export function getCasinoSymbol(symbolId) {
  return CASINO_SYMBOLS[symbolId] || null;
}

export function casinoSymbolIsKnown(symbolId) {
  return !!getCasinoSymbol(symbolId);
}
