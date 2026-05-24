export const REWARD_EVENT_FEED_SCHEMA_VERSION = 1;

export const REWARD_EVENT_FEED_SCOPE = Object.freeze({
  LOCAL: "local",
  TEAM: "team"
});

export const REWARD_EVENT_FEED_PRIORITY = Object.freeze({
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low"
});

const DEFAULT_LIFE_MS = 1450;
const HIGH_LIFE_MS = 1750;
const MAX_VISIBLE = 5;
const MAX_SEEN = 96;

function eventId(event = {}) {
  return String(event.id || `${event.type || "event"}:${event.action || "?"}:${event.t || 0}:${event.playerId || event.sourcePlayerId || "team"}`);
}

function pickupCode(type) {
  if (type === "money") return "GLD";
  if (type === "xp") return "EXP";
  if (type === "heal") return "HEA";
  return String(type || "DROP").toUpperCase().slice(0, 3);
}

function chestTierCode(tier) {
  if (tier === "weapon") return "WPN";
  if (tier === "ability") return "ABL";
  if (tier === "rare") return "RAR";
  if (tier === "cursed") return "CRS";
  return "BSC";
}

function rewardLabel(event = {}) {
  if (event.label) return String(event.label).toUpperCase().slice(0, 16);
  if (event.rewardKind) return String(event.rewardKind).toUpperCase().slice(0, 16);
  if (event.rewardType) return String(event.rewardType).toUpperCase().slice(0, 16);
  return "REWARD";
}

function numberText(value) {
  return Number.isFinite(value) && value > 0 ? ` +${Math.round(value)}` : "";
}

function isLocalPlayerEvent(event = {}, playerId = null) {
  if (!playerId) return false;
  return event.playerId === playerId || event.sourcePlayerId === playerId || event.collectorId === playerId;
}

function includesRecipient(event = {}, playerId = null) {
  return !!playerId && Array.isArray(event.recipients) && event.recipients.includes(playerId);
}


function buildChestDeniedItem(event, playerId) {
  if (event.type !== "chest" || event.action !== "open_denied" || event.playerId !== playerId) return null;
  const cost = Number.isFinite(event.cost) && event.cost > 0 ? ` ${Math.round(event.cost)}G` : "";
  return {
    kind: "chest_denied",
    priority: REWARD_EVENT_FEED_PRIORITY.LOW,
    scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
    text: event.reason === "not_enough_money" ? "NO GLD" : "CHEST LOCK",
    detail: `${chestTierCode(event.chestTier)}${cost}`,
    lifeMs: DEFAULT_LIFE_MS
  };
}

function buildInteractableDeniedItem(event, playerId) {
  if (event.type !== "interactable" || event.action !== "activation_denied" || event.playerId !== playerId) return null;
  return {
    kind: "interactable_denied",
    priority: REWARD_EVENT_FEED_PRIORITY.LOW,
    scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
    text: event.reason === "too_far" ? "MOVE IN" : "LOCKED",
    detail: String(event.kind || "OBJECT").toUpperCase().slice(0, 16),
    lifeMs: DEFAULT_LIFE_MS
  };
}

function buildCasinoDeniedItem(event, playerId) {
  if (event.type !== "casino" || event.action !== "spin_denied" || event.playerId !== playerId) return null;
  const cost = Number.isFinite(event.cost) && event.cost > 0 ? ` NEED ${Math.round(event.cost)}G` : "";
  return {
    kind: "casino_denied",
    priority: REWARD_EVENT_FEED_PRIORITY.LOW,
    scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
    text: event.reason === "not_enough_money" ? "NO GLD" : "BET DENIED",
    detail: `${String(event.stakeId || "BET").toUpperCase()}${cost}`.slice(0, 22),
    lifeMs: DEFAULT_LIFE_MS
  };
}

function buildChestOpenItem(event) {
  if (event.type !== "chest" || event.action !== "opened") return null;
  const tier = chestTierCode(event.chestTier);
  return {
    kind: "chest",
    priority: event.chestTier === "rare" || event.chestTier === "cursed" ? REWARD_EVENT_FEED_PRIORITY.HIGH : REWARD_EVENT_FEED_PRIORITY.MEDIUM,
    scope: REWARD_EVENT_FEED_SCOPE.TEAM,
    text: event.chestTier === "cursed" ? "CRS RISK" : event.chestTier === "rare" ? "RAR BURST" : `${tier} CHEST`,
    detail: event.revealLabel ? `REVEAL ${String(event.revealLabel).toUpperCase().slice(0, 16)}` : `${Math.max(0, event.rewards || 0)} REWARD`,
    lifeMs: event.chestTier === "rare" || event.chestTier === "cursed" ? HIGH_LIFE_MS : DEFAULT_LIFE_MS
  };
}

function buildRewardRevealItem(event, playerId) {
  if (event.type !== "reward" || event.action !== "revealed") return null;
  if (event.sourceType === "chest") {
    const notable = event.chestTier && event.chestTier !== "basic";
    const specialType = event.rewardType && event.rewardType !== "economy_pickup";
    if (!notable && !specialType) return null;
    return {
      kind: "reward_reveal",
      priority: event.chestTier === "rare" || event.chestTier === "cursed" ? REWARD_EVENT_FEED_PRIORITY.HIGH : REWARD_EVENT_FEED_PRIORITY.MEDIUM,
      scope: REWARD_EVENT_FEED_SCOPE.TEAM,
      text: `${chestTierCode(event.chestTier)} REVEAL`,
      detail: rewardLabel(event),
      lifeMs: DEFAULT_LIFE_MS
    };
  }
  if (event.sourceType === "casino") {
    if (event.playerId && event.playerId !== playerId) return null;
    if (event.rewardType === "economy_pickup") return null;
    return {
      kind: "casino_reveal",
      priority: REWARD_EVENT_FEED_PRIORITY.MEDIUM,
      scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
      text: "CASINO REVEAL",
      detail: rewardLabel(event),
      lifeMs: DEFAULT_LIFE_MS
    };
  }
  return null;
}

function buildCasinoResolvedItem(event, playerId) {
  if (event.type !== "casino" || event.action !== "spin_resolved" || event.playerId !== playerId) return null;
  const win = !!event.match;
  const profile = String(event.revealProfile || "");
  const jackpot = profile.includes("jackpot") || String(event.outcome || "").includes("jackpot") || String(event.outcomeLabel || "").toUpperCase().includes("JACKPOT");
  const staticDebt = profile.includes("static") || String(event.outcome || "").includes("static") || String(event.payoutText || "").toUpperCase().includes("DEBT");
  return {
    kind: win ? "casino_win" : "casino_loss",
    priority: jackpot || staticDebt ? REWARD_EVENT_FEED_PRIORITY.HIGH : REWARD_EVENT_FEED_PRIORITY.MEDIUM,
    scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
    text: jackpot ? "JACKPOT" : staticDebt ? "STATIC DEBT" : win ? "CASINO WIN" : "CASINO LOSS",
    detail: String(event.payoutText || event.outcomeLabel || (win ? "PAYOUT" : `-$${event.cost || 0}`)).toUpperCase().slice(0, 22),
    lifeMs: jackpot || staticDebt ? HIGH_LIFE_MS : DEFAULT_LIFE_MS
  };
}

function buildInstallItem(event, playerId) {
  if (event.type !== "economy" || event.action !== "queue_level_up" || event.playerId !== playerId) return null;
  const count = Math.max(1, Math.floor(Number.isFinite(event.levelsGained) ? event.levelsGained : 1));
  const pending = Math.max(0, Math.floor(Number.isFinite(event.pendingUpgradeCount) ? event.pendingUpgradeCount : 0));
  return {
    kind: "install",
    priority: REWARD_EVENT_FEED_PRIORITY.HIGH,
    scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
    text: `INSTALL +${count}`,
    detail: pending > 1 ? `QUEUE x${pending}` : "LEVEL UP QUEUED",
    lifeMs: HIGH_LIFE_MS
  };
}

function buildInstallConsumedItem(event, playerId) {
  if (event.type !== "economy" || event.action !== "consume_pending_upgrade" || event.playerId !== playerId) return null;
  const pending = Math.max(0, Math.floor(Number.isFinite(event.pendingUpgradeCount) ? event.pendingUpgradeCount : 0));
  return {
    kind: "install",
    priority: pending > 0 ? REWARD_EVENT_FEED_PRIORITY.MEDIUM : REWARD_EVENT_FEED_PRIORITY.LOW,
    scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
    text: "INSTALL OK",
    detail: pending > 0 ? `${pending} LEFT` : "QUEUE CLEAR",
    lifeMs: DEFAULT_LIFE_MS
  };
}

function buildLuckDropItem(event, playerId) {
  if (event.type !== "drop" || event.action !== "economy_drop_hook_roll" || !event.luckProc) return null;
  if (event.sourcePlayerId && event.sourcePlayerId !== playerId) return null;
  const code = pickupCode(event.pickupType);
  return {
    kind: "luck",
    priority: REWARD_EVENT_FEED_PRIORITY.MEDIUM,
    scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
    text: "LUCK PROC",
    detail: `BONUS ${code}`,
    lifeMs: DEFAULT_LIFE_MS
  };
}

function buildModifierDropItem(event, playerId) {
  if (event.type !== "drop" || event.action !== "economy_drop_hook_roll" || !event.modifierProc || event.luckProc) return null;
  if (event.sourcePlayerId && event.sourcePlayerId !== playerId) return null;
  return {
    kind: "modifier",
    priority: REWARD_EVENT_FEED_PRIORITY.MEDIUM,
    scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
    text: "ALGO BOOST",
    detail: `BONUS ${pickupCode(event.pickupType)}`,
    lifeMs: DEFAULT_LIFE_MS
  };
}

function buildRareHealItem(event, playerId) {
  if (event.type === "drop" && event.action === "economy_drop_hook_roll" && event.pickupType === "heal" && event.rareRoll) {
    return {
      kind: "rare_heal",
      priority: REWARD_EVENT_FEED_PRIORITY.HIGH,
      scope: REWARD_EVENT_FEED_SCOPE.TEAM,
      text: "RARE HEA",
      detail: "DROP ONLINE",
      lifeMs: HIGH_LIFE_MS
    };
  }
  if (event.type === "economyPickup" && event.action === "claimed" && event.pickupType === "heal" && includesRecipient(event, playerId)) {
    return {
      kind: "rare_heal",
      priority: REWARD_EVENT_FEED_PRIORITY.HIGH,
      scope: REWARD_EVENT_FEED_SCOPE.TEAM,
      text: "HEA CLAIMED",
      detail: `SHARED x${Math.max(1, event.recipientCount || 1)}`,
      lifeMs: DEFAULT_LIFE_MS
    };
  }
  return null;
}


function buildAbilityClaimItem(event, playerId) {
  if (event.type !== "rewardPickup" || event.action !== "claimed" || event.playerId !== playerId) return null;
  if (event.rewardType !== "ability_pickup" && event.rewardType !== "ability_shard") return null;
  const stack = Math.max(1, Math.floor(Number.isFinite(event.abilityStack) ? event.abilityStack : 1));
  return {
    kind: "ability_claim",
    priority: REWARD_EVENT_FEED_PRIORITY.HIGH,
    scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
    text: event.abilityIsNew ? "DASH ONLINE" : `DASH x${stack}`,
    detail: stack > 1 ? "CHARGE STACK" : "ABILITY READY",
    lifeMs: HIGH_LIFE_MS
  };
}

function buildClaimBonusItem(event, playerId) {
  if (event.type !== "economyPickup" || event.action !== "claimed" || !includesRecipient(event, playerId)) return null;
  if (!event.lucky && !event.boosted) return null;
  if (event.pickupType === "heal") return null;
  if (event.lucky) return null; // LUCK PROC is surfaced at drop roll time to avoid duplicate feed spam.
  return {
    kind: "bonus_claim",
    priority: REWARD_EVENT_FEED_PRIORITY.LOW,
    scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
    text: `BONUS ${pickupCode(event.pickupType)}`,
    detail: `SHARED${numberText(event.amount)}`,
    lifeMs: DEFAULT_LIFE_MS
  };
}

function buildKillComboItem(event, playerId) {
  if (event.type !== "kill_combo" || event.action !== "stack" || event.playerId !== playerId) return null;
  if (!(event.count >= 3) && !event.milestone) return null;
  const reward = event.rewardLabel || [event.rewardMoney > 0 ? `+${Math.round(event.rewardMoney)}G` : "", event.rewardXp > 0 ? `+${Math.round(event.rewardXp)}XP` : ""].filter(Boolean).join(" ");
  return {
    kind: "kill_combo",
    priority: event.milestone ? REWARD_EVENT_FEED_PRIORITY.HIGH : REWARD_EVENT_FEED_PRIORITY.MEDIUM,
    scope: REWARD_EVENT_FEED_SCOPE.LOCAL,
    text: event.label || `COMBO x${event.count}`,
    detail: reward ? `x${event.count} ${reward}` : `x${event.count}`,
    lifeMs: event.milestone ? HIGH_LIFE_MS : DEFAULT_LIFE_MS
  };
}

export function buildRewardEventFeedItem(event, { playerId = null } = {}) {
  if (!event || !event.type || !event.action) return null;
  return buildInstallItem(event, playerId)
    || buildKillComboItem(event, playerId)
    || buildInstallConsumedItem(event, playerId)
    || buildChestDeniedItem(event, playerId)
    || buildInteractableDeniedItem(event, playerId)
    || buildCasinoDeniedItem(event, playerId)
    || buildCasinoResolvedItem(event, playerId)
    || buildChestOpenItem(event, playerId)
    || buildRewardRevealItem(event, playerId)
    || buildAbilityClaimItem(event, playerId)
    || buildRareHealItem(event, playerId)
    || buildLuckDropItem(event, playerId)
    || buildModifierDropItem(event, playerId)
    || buildClaimBonusItem(event, playerId);
}

function pruneSeen(seenOrder, seenSet) {
  while (seenOrder.length > MAX_SEEN) {
    const old = seenOrder.shift();
    seenSet.delete(old);
  }
}

export function createRewardEventFeed(options = {}) {
  const maxVisible = Math.max(1, Math.floor(Number.isFinite(options.maxVisible) ? options.maxVisible : MAX_VISIBLE));
  const seen = new Set();
  const seenOrder = [];
  let items = [];

  function ingest(events = [], { playerId = null, now = performance.now() } = {}) {
    const list = Array.isArray(events) ? events : [];
    for (const event of list) {
      const id = eventId(event);
      if (seen.has(id)) continue;
      seen.add(id);
      seenOrder.push(id);
      const item = buildRewardEventFeedItem(event, { playerId });
      if (item) {
        items.unshift({
          id,
          createdAt: now,
          lifeMs: item.lifeMs || DEFAULT_LIFE_MS,
          ...item
        });
      }
    }
    pruneSeen(seenOrder, seen);
    items = items.filter((item) => now - item.createdAt <= item.lifeMs).slice(0, maxVisible);
    return items.map((item) => ({
      id: item.id,
      text: item.text,
      detail: item.detail || "",
      kind: item.kind || "event",
      priority: item.priority || REWARD_EVENT_FEED_PRIORITY.LOW,
      scope: item.scope || REWARD_EVENT_FEED_SCOPE.LOCAL,
      ageMs: Math.max(0, now - item.createdAt),
      lifeMs: item.lifeMs
    }));
  }

  function clear() {
    items = [];
    seen.clear();
    seenOrder.length = 0;
  }

  return { ingest, clear };
}
