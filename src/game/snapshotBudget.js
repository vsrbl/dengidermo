import { visualEffectPriority } from "./visualEffects.js";

export const SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES = 64 * 1024;
export const SNAPSHOT_WARNING_BYTES = 52 * 1024;
export const SNAPSHOT_EFFECT_LIMIT = 48;

export function budgetEffects(effects, limit = SNAPSHOT_EFFECT_LIMIT) {
  const list = Array.isArray(effects) ? effects : [];
  if (list.length <= limit) return { items: list.map((e) => ({ ...e })), meta: { total: list.length, sent: list.length, dropped: 0, budgeted: false } };
  const indexed = list.map((effect, index) => ({ effect, index, priority: visualEffectPriority(effect) }));
  indexed.sort((a, b) => (b.priority - a.priority) || (b.index - a.index));
  const picked = indexed.slice(0, limit).sort((a, b) => a.index - b.index).map((entry) => ({ ...entry.effect }));
  return { items: picked, meta: { total: list.length, sent: picked.length, dropped: Math.max(0, list.length - picked.length), budgeted: true } };
}

export function estimateSnapshotBytes(snapshot) {
  try {
    const json = JSON.stringify(snapshot);
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(json).length;
    return json.length;
  } catch {
    return 0;
  }
}

export function buildSnapshotBudgetMeta(snapshot, extra = {}) {
  const bytes = estimateSnapshotBytes(snapshot);
  return {
    bytes,
    warningBytes: SNAPSHOT_WARNING_BYTES,
    limitBytes: SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES,
    nearLimit: bytes >= SNAPSHOT_WARNING_BYTES,
    overLimit: bytes >= SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES,
    ...extra
  };
}
