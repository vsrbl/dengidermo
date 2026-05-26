import { textNode } from "./dom.js";

export function renderProcFeed(procFeedEl, items = []) {
  if (!procFeedEl) return;
  const list = Array.isArray(items) ? items.slice(0, 5) : [];
  procFeedEl.classList.toggle("active", list.length > 0);
  procFeedEl.replaceChildren(...list.map((item, index) => {
    const row = document.createElement("div");
    row.className = `proc-feed-row priority-${item.priority || "low"} kind-${item.kind || "event"}`;
    row.style.setProperty("--proc-index", String(index));
    const text = textNode("span", "proc-feed-text", String(item.text || "SIGNAL").toUpperCase().slice(0, 28));
    const detail = textNode("span", "proc-feed-detail", String(item.detail || "").toUpperCase().slice(0, 32));
    row.append(text, detail);
    return row;
  }));
}
