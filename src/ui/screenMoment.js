function safeText(value, fallback = "") {
  return String(value || fallback).toUpperCase().slice(0, 42);
}

export function renderScreenMoment(el, moment = null) {
  if (!el) return;
  if (!moment) {
    el.classList.remove("active", "screen-moment-bump");
    el.setAttribute("aria-hidden", "true");
    return;
  }
  const id = String(moment.id || `${moment.kind || "moment"}:${moment.text || "signal"}`);
  const changed = el.dataset.momentId !== id;
  el.dataset.momentId = id;
  el.className = `screen-moment active kind-${moment.kind || "signal"} tier-${moment.tier || moment.priority || "medium"}`;
  el.setAttribute("aria-hidden", "false");
  if (changed) {
    el.replaceChildren();
    const kicker = document.createElement("div");
    kicker.className = "screen-moment-kicker";
    kicker.textContent = safeText(moment.kicker || "SIGNAL");
    const title = document.createElement("div");
    title.className = "screen-moment-title";
    title.textContent = safeText(moment.text || "MOMENT");
    const detail = document.createElement("div");
    detail.className = "screen-moment-detail";
    detail.textContent = safeText(moment.detail || "");
    el.append(kicker, title, detail);
    el.classList.remove("screen-moment-bump");
    void el.offsetWidth;
    el.classList.add("screen-moment-bump");
  }
}
