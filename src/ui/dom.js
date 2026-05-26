export function textNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

export function statLine(label, value, className = "") {
  const row = document.createElement("div");
  row.className = `stat-panel-row${className ? ` ${className}` : ""}`;
  row.append(textNode("span", "stat-panel-label", label), textNode("span", "stat-panel-value", value));
  return row;
}

export function statSection(title, rows = []) {
  const section = document.createElement("section");
  section.className = "stat-panel-section";
  section.append(textNode("div", "stat-panel-section-title", title));
  for (const row of rows) section.append(row);
  return section;
}


export function replaceUpgradeChoiceContent(button, data, meta = {}, options = {}) {
  if (!button) return;
  button.replaceChildren();
  if (!data) return;
  const index = Number.isFinite(options.index) ? options.index : 0;
  const rarityLabel = options.rarityLabel || String(meta.rarity || data.rarity || "COMMON").toUpperCase();
  const stackText = options.stackText || "";
  const hint = options.hint || "";
  const metaText = [rarityLabel, stackText, hint].filter(Boolean).join(" · " );
  button.append(
    textNode("span", "upgrade-key", String(index + 1)),
    textNode("span", "upgrade-name", data.name || "UNKNOWN"),
    textNode("span", "upgrade-desc", data.desc || ""),
    textNode("span", "upgrade-meta", metaText)
  );
}
