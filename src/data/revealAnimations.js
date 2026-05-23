export const REVEAL_PERSONALITY_IDS = Object.freeze({
  BASIC: "basic",
  WEAPON: "weapon",
  ABILITY: "ability",
  RARE: "rare",
  CURSED: "cursed",
  CASINO_WIN: "casino_win",
  CASINO_LOSS: "casino_loss",
  CASINO_JACKPOT: "casino_jackpot",
  CASINO_STATIC: "casino_static"
});

export const CHEST_REVEAL_PROFILES = Object.freeze({
  basic: Object.freeze({
    id: REVEAL_PERSONALITY_IDS.BASIC,
    openingTime: 0.46,
    claimDelay: 0.46,
    popDistance: 18,
    sparkCount: 16,
    sparkPower: 155,
    shakePower: 1.4,
    shakeLife: 0.08,
    pulseLife: 0.34,
    secondPulseDelay: 0,
    label: "BSC OPEN"
  }),
  weapon: Object.freeze({
    id: REVEAL_PERSONALITY_IDS.WEAPON,
    openingTime: 0.56,
    claimDelay: 0.52,
    popDistance: 22,
    sparkCount: 20,
    sparkPower: 180,
    shakePower: 1.8,
    shakeLife: 0.1,
    pulseLife: 0.4,
    secondPulseDelay: 0.12,
    label: "WPN REVEAL"
  }),
  ability: Object.freeze({
    id: REVEAL_PERSONALITY_IDS.ABILITY,
    openingTime: 0.6,
    claimDelay: 0.56,
    popDistance: 22,
    sparkCount: 20,
    sparkPower: 178,
    shakePower: 1.8,
    shakeLife: 0.1,
    pulseLife: 0.42,
    secondPulseDelay: 0.14,
    label: "ABL SIGNAL"
  }),
  rare: Object.freeze({
    id: REVEAL_PERSONALITY_IDS.RARE,
    openingTime: 0.72,
    claimDelay: 0.64,
    popDistance: 30,
    sparkCount: 30,
    sparkPower: 230,
    shakePower: 2.8,
    shakeLife: 0.14,
    pulseLife: 0.52,
    secondPulseDelay: 0.18,
    label: "RAR BURST"
  }),
  cursed: Object.freeze({
    id: REVEAL_PERSONALITY_IDS.CURSED,
    openingTime: 0.78,
    claimDelay: 0.68,
    popDistance: 32,
    sparkCount: 34,
    sparkPower: 240,
    shakePower: 3.2,
    shakeLife: 0.16,
    pulseLife: 0.58,
    secondPulseDelay: 0.2,
    label: "CRS RISK"
  })
});

const DEFAULT_CHEST_REVEAL_PROFILE = CHEST_REVEAL_PROFILES.basic;

export function chestRevealProfileForTier(tier = "basic") {
  return CHEST_REVEAL_PROFILES[tier] || DEFAULT_CHEST_REVEAL_PROFILE;
}

export const CASINO_REVEAL_TIMING = Object.freeze({
  reelStepMs: 245,
  settleMs: 290,
  winHoldMs: 2600,
  lossHoldMs: 1900,
  jackpotHoldMs: 3300,
  staticHoldMs: 2900
});

export const CASINO_REVEAL_PROFILES = Object.freeze({
  loss: Object.freeze({
    id: REVEAL_PERSONALITY_IDS.CASINO_LOSS,
    sparkCount: 10,
    sparkPower: 150,
    shakePower: 1.8,
    shakeLife: 0.09,
    pulseLife: 0.32,
    color: "#ff3048",
    text: "LOSS CUT"
  }),
  win: Object.freeze({
    id: REVEAL_PERSONALITY_IDS.CASINO_WIN,
    sparkCount: 22,
    sparkPower: 205,
    shakePower: 2.4,
    shakeLife: 0.12,
    pulseLife: 0.44,
    color: "#00ff66",
    text: "WIN SNAP"
  }),
  jackpot: Object.freeze({
    id: REVEAL_PERSONALITY_IDS.CASINO_JACKPOT,
    sparkCount: 38,
    sparkPower: 260,
    shakePower: 4.4,
    shakeLife: 0.18,
    pulseLife: 0.64,
    color: "#00ff66",
    text: "JACKPOT"
  }),
  static: Object.freeze({
    id: REVEAL_PERSONALITY_IDS.CASINO_STATIC,
    sparkCount: 28,
    sparkPower: 230,
    shakePower: 3.5,
    shakeLife: 0.16,
    pulseLife: 0.56,
    color: "#ff3048",
    text: "STATIC DEBT"
  })
});

export function casinoRevealProfileForResult(result = {}) {
  const outcome = String(result.outcome || result.outcomeId || "").toLowerCase();
  const label = String(result.outcomeLabel || result.payoutText || "").toLowerCase();
  if (outcome.includes("jackpot") || label.includes("jackpot")) return CASINO_REVEAL_PROFILES.jackpot;
  if (outcome.includes("static") || label.includes("debt") || label.includes("static")) return CASINO_REVEAL_PROFILES.static;
  if (result.match) return CASINO_REVEAL_PROFILES.win;
  return CASINO_REVEAL_PROFILES.loss;
}
