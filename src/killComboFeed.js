const MAX_SEEN = 96;
const COMBO_VISIBLE_THRESHOLD = 25;

function eventId(event = {}) {
  return String(event.id || `${event.type || "event"}:${event.action || "?"}:${event.t || 0}:${event.playerId || "team"}:${event.seq || 0}`);
}

function pruneSeen(order, set) {
  while (order.length > MAX_SEEN) {
    const old = order.shift();
    set.delete(old);
  }
}

export function createKillComboFeed() {
  const seen = new Set();
  const order = [];
  let active = null;

  function ingest(events = [], { playerId = null, now = performance.now() } = {}) {
    const list = Array.isArray(events) ? events : [];
    for (const event of list) {
      if (event?.type !== "kill_combo" || event.action !== "stack" || event.playerId !== playerId) continue;
      if (!(event.count >= COMBO_VISIBLE_THRESHOLD)) continue;
      const id = eventId(event);
      if (seen.has(id)) continue;
      seen.add(id);
      order.push(id);
      active = {
        id,
        createdAt: now,
        lifeMs: Math.max(1200, (Number(event.comboWindow) || 4.25) * 1000 + 220),
        count: Math.max(COMBO_VISIBLE_THRESHOLD, Math.floor(event.count || COMBO_VISIBLE_THRESHOLD)),
        best: Math.max(COMBO_VISIBLE_THRESHOLD, Math.floor(event.best || event.count || COMBO_VISIBLE_THRESHOLD)),
        seq: Math.max(0, Math.floor(event.seq || 0)),
        label: event.label || "SIGNAL CHAIN",
        code: event.code || "CHN",
        tier: event.tier || "trace",
        milestone: !!event.milestone,
        rewardMoney: Math.max(0, Math.floor(event.rewardMoney || 0)),
        rewardXp: Math.max(0, Math.floor(event.rewardXp || 0)),
        rewardLabel: event.rewardLabel || ""
      };
    }
    pruneSeen(order, seen);
    if (active && now - active.createdAt > active.lifeMs) active = null;
    return active ? { ...active, ageMs: Math.max(0, now - active.createdAt) } : null;
  }

  function clear() {
    active = null;
    seen.clear();
    order.length = 0;
  }

  return { ingest, clear };
}
