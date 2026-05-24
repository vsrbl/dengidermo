function safeText(value, fallback = "") {
  return String(value || fallback).toUpperCase().slice(0, 36);
}

function rewardLine(combo = {}) {
  if (combo.rewardLabel) return safeText(combo.rewardLabel, "");
  const parts = [];
  if (combo.rewardMoney > 0) parts.push(`+${Math.round(combo.rewardMoney)} GLD`);
  if (combo.rewardXp > 0) parts.push(`+${Math.round(combo.rewardXp)} EXP`);
  if (parts.length) return parts.join(" / ");
  if (combo.nextRewardLabel) return safeText(combo.nextRewardLabel, "");
  return "";
}

export function renderKillCombo(el, combo = null) {
  if (!el) return;
  if (!combo || !(combo.count >= 1)) {
    el.classList.remove("active", "combo-bump", "milestone");
    el.setAttribute("aria-hidden", "true");
    return;
  }
  const seq = String(combo.seq || combo.id || combo.count);
  const changed = el.dataset.comboSeq !== seq;
  el.dataset.comboSeq = seq;
  el.className = `kill-combo active tier-${combo.tier || "trace"}${combo.milestone ? " milestone" : ""}`;
  el.setAttribute("aria-hidden", "false");
  if (changed || !el.firstChild) {
    el.replaceChildren();
    const count = document.createElement("div");
    count.className = "kill-combo-count";
    count.textContent = `x${Math.max(1, Math.floor(combo.count || 1))}`;
    const label = document.createElement("div");
    label.className = "kill-combo-label";
    label.textContent = safeText(combo.label || "KILL TRACE");
    const reward = document.createElement("div");
    reward.className = "kill-combo-reward";
    reward.textContent = rewardLine(combo);
    el.append(count, label, reward);
    el.classList.remove("combo-bump");
    void el.offsetWidth;
    el.classList.add("combo-bump");
  } else {
    const count = el.querySelector(".kill-combo-count");
    if (count) count.textContent = `x${Math.max(1, Math.floor(combo.count || 1))}`;
    const label = el.querySelector(".kill-combo-label");
    if (label) label.textContent = safeText(combo.label || "KILL TRACE");
    const reward = el.querySelector(".kill-combo-reward");
    if (reward) reward.textContent = rewardLine(combo);
  }
}
