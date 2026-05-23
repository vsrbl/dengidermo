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

export function buildRewardEventFeedItem(event, { playerId = null } = {}) {
  if (!event || !event.type || !event.action) return null;
  return buildInstallItem(event, playerId)
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
