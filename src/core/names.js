const NAME_RE = /^[A-Z0-9_-]{1,12}$/;

export function normalizePlayerName(value, fallback = "") {
  const clean = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 12);
  return clean || fallback;
}

export function displayPlayerName(value, fallback = "PLAYER") {
  const clean = normalizePlayerName(value);
  return NAME_RE.test(clean) ? clean : fallback;
}
