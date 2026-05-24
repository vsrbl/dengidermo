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
