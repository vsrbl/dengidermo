export function signedPercent(value) {
  const n = Number.isFinite(value) ? value : 0;
  const rounded = Math.round(n * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${rounded >= 0 ? "+" : ""}${text}%`;
}

export function flatPercent(value) {
  const n = Number.isFinite(value) ? value : 0;
  const rounded = Math.round(n * 10) / 10;
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}%`;
}

export function integer(value, fallback = 0) {
  return Math.round(Number.isFinite(value) ? value : fallback);
}

export function economyNumber(value, fallback = 0) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : fallback));
}

export function economyQueueTier(queue) {
  return queue >= 4 ? 3 : queue >= 2 ? 2 : queue > 0 ? 1 : 0;
}

export function economyQueueLabel(queue, upgradeOpen = false) {
  if (queue <= 0) return "NO INSTALL";
  if (upgradeOpen) return queue > 1 ? `INSTALL ${queue} QUEUED` : "INSTALL READY";
  return "EXIT TO INSTALL";
}

export function tweenNumber(from, to, startedAt, now, duration = 220) {
  if (from === null || from === undefined) return Math.round(to || 0);
  if (from === to) return Math.round(to || 0);
  const t = Math.min(1, Math.max(0, (now - startedAt) / duration));
  const eased = 1 - Math.pow(1 - t, 3);
  return Math.round(from + (to - from) * eased);
}


export function safeExpProgressText(xpValue, nextValue) {
  const xp = economyNumber(xpValue, 0);
  if (!Number.isFinite(nextValue)) return `EXP ${xp}`;
  const next = Math.max(1, economyNumber(nextValue, 1));
  return `EXP ${xp}/${next}`;
}

export function safeNextExpText(nextValue) {
  if (!Number.isFinite(nextValue)) return "NEXT --";
  return `NEXT ${Math.max(1, economyNumber(nextValue, 1))}`;
}
