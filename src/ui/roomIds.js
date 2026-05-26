export function randomRoomId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function normalizeRoomId(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
}

export function isValidRoomId(value) {
  return /^[A-Z0-9-]{3,12}$/.test(value);
}
