export const MOMENT_FEED_SCHEMA_VERSION = 2;

const MAX_SEEN = 128;
const DEFAULT_LIFE_MS = 1550;
const ULTRA_LIFE_MS = 2200;
const COMBO_MOMENT_MIN_COUNT = 25;

function eventId(event = {}) {
  return String(event.id || `${event.type || "event"}:${event.action || "?"}:${event.t || 0}:${event.playerId || event.sourcePlayerId || "team"}`);
}

function rewardLabel(event = {}) {
  if (event.label) return String(event.label).toUpperCase().slice(0, 18);
  if (event.kind) return String(event.kind).toUpperCase().slice(0, 18);
  if (event.rewardKind) return String(event.rewardKind).toUpperCase().slice(0, 18);
  if (event.rewardType) return String(event.rewardType).toUpperCase().slice(0, 18);
  return "SIGNAL";
}

function buildInstallMoment(event, playerId) {
  if (event.type !== "economy" || event.action !== "queue_level_up" || event.playerId !== playerId) return null;
  const count = Math.max(1, Math.floor(event.levelsGained || 1));
  const pending = Math.max(0, Math.floor(event.pendingUpgradeCount || 0));
  return {
    kind: "install",
    tier: count > 1 || pending > 1 ? "ultra" : "high",
    kicker: "INSTALL SIGNAL",
    text: `INSTALL +${count}`,
    detail: pending > 1 ? `QUEUE x${pending}` : "LEVEL UP QUEUED",
    lifeMs: count > 1 ? ULTRA_LIFE_MS : DEFAULT_LIFE_MS
  };
}

function buildExitOpenMoment(event, playerId, snapshot = null) {
  if (event.type !== "portal" || event.action !== "exit_open") return null;
  const portals = Array.isArray(snapshot?.portals) ? snapshot.portals : [];
  const matchingPortal = portals.find((portal) => portal?.id === event.portalId) || portals.find((portal) => portal?.kind === "exit");
  if (!event.portalActive && !matchingPortal?.active) return null;
  return {
    kind: "exit",
    tier: "high",
    kicker: "ROOM CONTRACT",
    text: "EXIT OPEN",
    detail: String(event.locationName || event.locationId || "PORTAL READY").toUpperCase().slice(0, 24),
    lifeMs: DEFAULT_LIFE_MS
  };
}

function buildAbilityMoment(event, playerId) {
  if (event.type !== "rewardPickup" || event.action !== "claimed" || event.playerId !== playerId) return null;
  if (event.rewardType !== "ability_pickup" && event.rewardType !== "ability_shard") return null;
  const stack = Math.max(1, Math.floor(event.abilityStack || 1));
  return {
    kind: "ability",
    tier: stack >= 3 ? "ultra" : "high",
    kicker: "ABILITY SIGNAL",
    text: event.abilityIsNew ? "DASH ONLINE" : `DASH x${stack}`,
    detail: stack > 1 ? "CHARGE STACK" : "SHIFT READY",
    lifeMs: stack >= 3 ? ULTRA_LIFE_MS : DEFAULT_LIFE_MS
  };
}

function buildWeaponMoment(event, playerId) {
  if (event.type !== "rewardPickup" || event.action !== "claimed" || event.playerId !== playerId) return null;
  if (event.rewardType !== "loot") return null;
  const kind = String(event.kind || "").toLowerCase();
  if (!["shotgun", "seeker", "rocket"].includes(kind)) return null;
  const code = kind === "shotgun" ? "SHG" : kind === "seeker" ? "SEK" : "RKT";
  return {
    kind: "weapon",
    tier: "high",
    kicker: "WEAPON ACQUIRED",
    text: code,
    detail: kind === "rocket" ? "ROCKETGUN ONLINE" : `${kind.toUpperCase()} ONLINE`,
    lifeMs: DEFAULT_LIFE_MS
  };
}

function buildRareRewardMoment(event, playerId) {
  if (event.type !== "reward" || event.action !== "revealed") return null;
  const rare = event.chestTier === "rare" || event.chestTier === "cursed" || event.rewardType === "modifier_injection" || event.rewardType === "curse";
  if (!rare) return null;
  return {
    kind: event.chestTier === "cursed" ? "curse" : "rare",
    tier: "ultra",
    kicker: event.chestTier === "cursed" ? "CORRUPT REVEAL" : "RARE REVEAL",
    text: event.chestTier === "cursed" ? "CRS SIGNAL" : "RAR SIGNAL",
    detail: rewardLabel(event),
    lifeMs: ULTRA_LIFE_MS
  };
}

function buildCasinoMoment(event, playerId) {
  if (event.type !== "casino" || event.action !== "spin_resolved" || event.playerId !== playerId) return null;
  const win = !!event.match;
  const profile = String(event.revealProfile || "");
  const jackpot = profile.includes("jackpot") || String(event.outcome || "").includes("jackpot") || String(event.outcomeLabel || "").toUpperCase().includes("JACKPOT");
  const staticDebt = profile.includes("static") || String(event.outcome || "").includes("static") || String(event.payoutText || "").toUpperCase().includes("DEBT");
  if (!win && !jackpot && !staticDebt) return null;
  return {
    kind: jackpot ? "jackpot" : staticDebt ? "curse" : "casino",
    tier: jackpot || staticDebt ? "ultra" : "high",
    kicker: "BET SIGNAL",
    text: jackpot ? "JACKPOT" : staticDebt ? "STATIC DEBT" : "CASINO WIN",
    detail: String(event.payoutText || event.outcomeLabel || "PAYOUT").toUpperCase().slice(0, 24),
    lifeMs: jackpot || staticDebt ? ULTRA_LIFE_MS : DEFAULT_LIFE_MS
  };
}

function buildLoopMoment(event) {
  if (event.type !== "location" || !event.loopChanged) return null;
  const loop = Math.max(0, Math.floor(Number(event.loopIndex) || 0));
  const depth = Math.max(0, Math.floor(Number(event.runDepth) || 0));
  return {
    kind: "loop",
    tier: loop >= 2 ? "ultra" : "high",
    kicker: "RUN ESCALATION",
    text: `LOOP ${loop}`,
    detail: `DEPTH ${depth} // ${String(event.locationName || event.resolvedRoomId || "NEXT ROOM").toUpperCase().slice(0, 18)}`,
    lifeMs: loop >= 2 ? ULTRA_LIFE_MS : DEFAULT_LIFE_MS
  };
}

function buildComboMoment(event, playerId) {
  if (event.type !== "kill_combo" || event.action !== "stack" || event.playerId !== playerId || !event.milestone) return null;
  if (!(event.count >= COMBO_MOMENT_MIN_COUNT)) return null;
  const reward = event.rewardLabel || [event.rewardMoney > 0 ? `+${Math.round(event.rewardMoney)} GLD` : "", event.rewardXp > 0 ? `+${Math.round(event.rewardXp)} EXP` : ""].filter(Boolean).join(" / ");
  return {
    kind: "combo",
    tier: event.count >= 100 ? "ultra" : "high",
    kicker: "KILL FEED OVERLOAD",
    text: event.label || "SIGNAL KILL CHAIN",
    detail: `x${Math.max(1, event.count || 1)}${reward ? ` // ${reward}` : ""}`,
    lifeMs: event.count >= 100 ? ULTRA_LIFE_MS : DEFAULT_LIFE_MS
  };
}

function buildMoment(event, playerId, snapshot = null) {
  return buildInstallMoment(event, playerId)
    || buildExitOpenMoment(event, playerId, snapshot)
    || buildAbilityMoment(event, playerId)
    || buildWeaponMoment(event, playerId)
    || buildRareRewardMoment(event, playerId)
    || buildCasinoMoment(event, playerId)
    || buildLoopMoment(event)
    || buildComboMoment(event, playerId);
}

function pruneSeen(order, set) {
  while (order.length > MAX_SEEN) {
    const old = order.shift();
    set.delete(old);
  }
}

function momentPriority(moment = {}) {
  if (["loop", "exit", "jackpot"].includes(moment.kind)) return 100;
  if (moment.tier === "ultra") return 80;
  if (moment.kind === "casino" || moment.kind === "curse") return 72;
  if (moment.kind === "install" || moment.kind === "ability" || moment.kind === "weapon") return 64;
  if (moment.kind === "combo") return 34;
  return 50;
}

function trimMomentQueue(queue) {
  while (queue.length > 8) {
    let removeIndex = 0;
    for (let i = 1; i < queue.length; i += 1) {
      if ((queue[i].priority || 0) < (queue[removeIndex].priority || 0)) removeIndex = i;
    }
    queue.splice(removeIndex, 1);
  }
}

export function createMomentFeed() {
  const seen = new Set();
  const order = [];
  const queue = [];
  let active = null;

  function startNext(now) {
    if (active) return;
    const next = queue.shift();
    if (next) active = { ...next, createdAt: now };
  }

  function enqueue(moment, id, now) {
    const entry = { id, priority: momentPriority(moment), ...moment };
    if (!active) active = { ...entry, createdAt: now };
    else queue.push(entry);
    trimMomentQueue(queue);
  }

  function ingest(events = [], { playerId = null, now = performance.now(), snapshot = null } = {}) {
    if (active && now - active.createdAt > (active.lifeMs || DEFAULT_LIFE_MS)) active = null;
    startNext(now);

    const list = Array.isArray(events) ? events : [];
    for (const event of list) {
      const id = eventId(event);
      if (seen.has(id)) continue;
      const moment = buildMoment(event, playerId, snapshot);
      if (!moment) continue;
      seen.add(id);
      order.push(id);
      enqueue(moment, id, now);
    }
    pruneSeen(order, seen);
    if (active && now - active.createdAt > (active.lifeMs || DEFAULT_LIFE_MS)) {
      active = null;
      startNext(now);
    }
    return active ? { ...active, ageMs: Math.max(0, now - active.createdAt), queued: queue.length } : null;
  }

  function clear() {
    active = null;
    queue.length = 0;
    seen.clear();
    order.length = 0;
  }

  return { ingest, clear };
}
