import { VERSION, MAX_PLAYERS } from "./core/constants.js";
import { START_WEAPON, WEAPONS } from "./data/weapons.js";
import { UPGRADES } from "./data/upgrades.js";

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
    weaponText: document.getElementById("weaponText"),
    inventoryText: document.getElementById("inventoryText"),
    locationText: document.getElementById("locationText"),
    portalText: document.getElementById("portalText"),
    upgradePanel: document.getElementById("upgradePanel"),
    upgradeButtons: Array.from(document.querySelectorAll(".upgrade-choice"))
  };

  let upgradePickHandler = null;
  let upgradeOpen = false;
  let upgradeHovered = false;

  function showMenu() {
    el.menu.classList.remove("hidden");
    el.game.classList.add("hidden");
  }

  function showGame(roomId) {
    el.menu.classList.add("hidden");
    el.game.classList.remove("hidden");
    el.roomTitle.textContent = roomId || "------";
  }

  function flashError(message = "") {
    el.menuBox.classList.remove("error-flash");
    void el.menuBox.offsetWidth;
    el.menuBox.classList.add("error-flash");
    if (message && el.menu && !el.menu.classList.contains("hidden")) {
      const oldPlaceholder = el.roomInput.placeholder || "ID";
      const label = String(message).replace(/_/g, " ").toUpperCase().slice(0, 18);
      el.roomInput.placeholder = label;
      window.clearTimeout(el.roomInput.nnPlaceholderTimer);
      el.roomInput.nnPlaceholderTimer = window.setTimeout(() => {
        el.roomInput.placeholder = oldPlaceholder;
      }, 1200);
    }
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

  function setUpgradeMenu(choices = [], pending = false) {
    const list = Array.isArray(choices) ? choices : [];
    upgradeOpen = list.length > 0;
    el.upgradePanel.classList.toggle("hidden", !upgradeOpen);
    el.upgradePanel.classList.toggle("pending", !!pending);
    el.upgradeButtons.forEach((btn, index) => {
      const id = list[index];
      const data = UPGRADES[id];
      btn.disabled = !id || pending;
      btn.innerHTML = data
        ? `<span class="upgrade-key">${index + 1}</span><span class="upgrade-name">${data.name}</span><span class="upgrade-desc">${data.desc}</span>`
        : "";
    });
  }

  function onUpgradePick(handler) {
    upgradePickHandler = handler;
  }

  function isUpgradeOpen() {
    return upgradeOpen;
  }

  el.upgradePanel.addEventListener("pointerenter", () => { upgradeHovered = true; });
  el.upgradePanel.addEventListener("pointerleave", () => { upgradeHovered = false; });
  el.upgradePanel.addEventListener("pointerdown", (e) => e.stopPropagation());
  el.upgradePanel.addEventListener("pointerup", (e) => e.stopPropagation());

  el.upgradeButtons.forEach((btn, index) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!upgradeOpen || !upgradeHovered) return;
      upgradePickHandler?.(index);
    });
  });

  function setHud(player, snapshot = null) {
    if (!player) {
      el.hpText.textContent = "--";
      el.weaponText.textContent = "--";
      el.locationText.textContent = snapshot?.location?.name || "--";
      el.portalText.textContent = "--";
      el.inventoryText.textContent = "--";
      return;
    }
    const inv = player.inventory || { weapons: [START_WEAPON], activeWeapon: START_WEAPON };
    const active = inv.activeWeapon || player.activeWeapon || START_WEAPON;
    el.hpText.textContent = `${Math.max(0, Math.round(player.hp))}/${player.maxHp || 100}`;
    el.weaponText.textContent = (WEAPONS[active]?.name || WEAPONS[START_WEAPON].name).toUpperCase();
    el.locationText.textContent = snapshot?.location?.name || "GRID 00";
    const portal = (snapshot?.portals || [])[0];
    el.portalText.textContent = portal ? (portal.active ? `${Math.round((portal.progress || 0) * 100)}%` : "LOCKED") : "--";
    el.inventoryText.textContent = (inv.weapons || [START_WEAPON])
      .slice(0, 9)
      .map((id, index) => `${index + 1}${id === active ? ":" : "."}${(WEAPONS[id]?.name || id).toUpperCase()}`)
      .join("  ");
  }

  el.roomTitle.addEventListener("click", async () => {
    const text = el.roomTitle.textContent.trim();
    if (!text || text === "------") return;
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard can fail on http */ }
    flashCopied();
  });

  return { el, showMenu, showGame, flashError, flashCopied, setNet, setHud, setUpgradeMenu, onUpgradePick, isUpgradeOpen, isUpgradeHovered: () => upgradeHovered };
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
