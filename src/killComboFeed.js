const MAX_SEEN = 96;

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
      if (!(event.count >= 2)) continue;
      const id = eventId(event);
      if (seen.has(id)) continue;
      seen.add(id);
      order.push(id);
      active = {
        id,
        createdAt: now,
        lifeMs: Math.max(900, (Number(event.comboWindow) || 2.85) * 1000 + 180),
        count: Math.max(2, Math.floor(event.count || 2)),
        best: Math.max(2, Math.floor(event.best || event.count || 2)),
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
