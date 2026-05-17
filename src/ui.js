import { VERSION, MAX_PLAYERS } from "./core/constants.js";

export function createUi() {
  const el = {
    menu: document.getElementById("menu"),
    game: document.getElementById("game"),
    menuBox: document.getElementById("menuBox"),
    roomInput: document.getElementById("roomInput"),
    createBtn: document.getElementById("createBtn"),
    joinBtn: document.getElementById("joinBtn"),
    roomTitle: document.getElementById("roomTitle"),
    netStatus: document.getElementById("netStatus"),
    hpText: document.getElementById("hpText"),
    weaponText: document.getElementById("weaponText")
  };

  function showMenu() {
    el.menu.classList.remove("hidden");
    el.game.classList.add("hidden");
  }

  function showGame(roomId) {
    el.menu.classList.add("hidden");
    el.game.classList.remove("hidden");
    el.roomTitle.textContent = roomId || "------";
  }

  function flashError() {
    el.menuBox.classList.remove("error-flash");
    void el.menuBox.offsetWidth;
    el.menuBox.classList.add("error-flash");
  }

  function flashCopied() {
    el.roomTitle.classList.remove("copy-flash");
    void el.roomTitle.offsetWidth;
    el.roomTitle.classList.add("copy-flash");
    setTimeout(() => el.roomTitle.classList.remove("copy-flash"), 220);
  }

  function setNet({ pingMs, role, playerId, players, transportMode }) {
    const ping = pingMs === null || pingMs === undefined ? "--" : String(pingMs);
    const mode = role === "host" ? "HOST" : role === "guest" ? "GUEST" : "--";
    const id = playerId || "--";
    const count = Array.isArray(players) ? players.length : 0;
    const tr = transportMode || "LINK";
    el.netStatus.textContent = `${VERSION.toUpperCase()} | PING ${ping} MS | ${mode} ${id} | ${count}/${MAX_PLAYERS} | ${tr}`;
  }

  function setHud(player) {
    if (!player) {
      el.hpText.textContent = "--";
      el.weaponText.textContent = "--";
      return;
    }
    el.hpText.textContent = `${Math.max(0, Math.round(player.hp))}/${player.maxHp || 100}`;
    el.weaponText.textContent = (player.weapon || "pistol").toUpperCase();
  }

  el.roomTitle.addEventListener("click", async () => {
    const text = el.roomTitle.textContent.trim();
    if (!text || text === "------") return;
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard can fail on http */ }
    flashCopied();
  });

  return { el, showMenu, showGame, flashError, flashCopied, setNet, setHud };
}

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
