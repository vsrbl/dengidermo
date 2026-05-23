export const INTERACTABLE_AFFORDANCE_SCHEMA_VERSION = 1;

export const INTERACTABLE_DENIAL_REASONS = Object.freeze({
  INVALID_ACTOR: 'invalid_actor',
  UNKNOWN_INTERACTABLE: 'unknown_interactable',
  INACTIVE: 'inactive',
  USED: 'used',
  TOO_FAR: 'too_far',
  NOT_ENOUGH_MONEY: 'not_enough_money',
  SPINNING: 'spinning',
  BAD_STAKE: 'bad_stake'
});

export const INTERACTABLE_AFFORDANCE_LABELS = Object.freeze({
  open: 'OPEN',
  use: 'E',
  empty: '---',
  tooFar: 'MOVE IN',
  noMoney: 'NO GLD',
  locked: 'LOCKED',
  spinning: 'WAIT',
  bet: 'BET'
});

export const INTERACTABLE_AFFORDANCE_RULES = Object.freeze({
  promptExtraRadius: 0,
  previewRangeMultiplier: 2.6,
  deniedTextLife: 0.72,
  deniedFeedLifeMs: 1350,
  localPromptMaxDistance: 112
});

export function affordanceReasonLabel(reason, fallback = 'LOCKED') {
  if (reason === INTERACTABLE_DENIAL_REASONS.NOT_ENOUGH_MONEY) return INTERACTABLE_AFFORDANCE_LABELS.noMoney;
  if (reason === INTERACTABLE_DENIAL_REASONS.TOO_FAR) return INTERACTABLE_AFFORDANCE_LABELS.tooFar;
  if (reason === INTERACTABLE_DENIAL_REASONS.SPINNING) return INTERACTABLE_AFFORDANCE_LABELS.spinning;
  if (reason === INTERACTABLE_DENIAL_REASONS.INACTIVE || reason === INTERACTABLE_DENIAL_REASONS.USED) return INTERACTABLE_AFFORDANCE_LABELS.empty;
  return fallback;
}
