import { VERSION, MAX_PLAYERS } from "./core/constants.js";
import { START_WEAPON, WEAPONS } from "./data/weapons.js";
import { RARITY_META, UPGRADES } from "./data/upgrades.js";
import { normalizePlayerName } from "./core/names.js";

export function createUi() {
  const el = {
    menu: document.getElementById("menu"),
    game: document.getElementById("game"),
    menuBox: document.getElementById("menuBox"),
    nameInput: document.getElementById("nameInput"),
    roomInput: document.getElementById("roomInput"),
    menuStatus: document.getElementById("menuStatus"),
    createBtn: document.getElementById("createBtn"),
    joinBtn: document.getElementById("joinBtn"),
    roomTitle: document.getElementById("roomTitle"),
    netStatus: document.getElementById("netStatus"),
    directorDebug: document.getElementById("directorDebug"),
    hpText: document.getElementById("hpText"),
    weaponText: document.getElementById("weaponText"),
    inventoryText: document.getElementById("inventoryText"),
    locationText: document.getElementById("locationText"),
    portalText: document.getElementById("portalText"),
    dashText: document.getElementById("dashText"),
    companionText: document.getElementById("companionText"),
    upgradePanel: document.getElementById("upgradePanel"),
    upgradeButtons: Array.from(document.querySelectorAll(".upgrade-choice"))
  };

  let upgradePickHandler = null;
  let upgradeOpen = false;
  let upgradeHovered = false;
  let lastUpgradeSignature = "";
  let revealSignature = "";
  let revealUntil = 0;

  function showMenu() {
    el.menu.classList.remove("hidden");
    el.game.classList.add("hidden");
  }

  function showGame(roomId) {
    el.menu.classList.add("hidden");
    el.game.classList.remove("hidden");
    el.roomTitle.textContent = roomId || "------";
  }

  function setMenuStatus(message = "", kind = "info") {
    if (!el.menuStatus) return;
    const text = String(message || "").replace(/_/g, " ").toUpperCase().slice(0, 42);
    el.menuStatus.textContent = text;
    el.menuStatus.classList.toggle("hidden", !text);
    el.menuStatus.classList.toggle("error", !!text && kind === "error");
    el.menuStatus.classList.toggle("info", !!text && kind !== "error");
  }

  function flashError(message = "") {
    el.menuBox.classList.remove("error-flash");
    void el.menuBox.offsetWidth;
    el.menuBox.classList.add("error-flash");
    if (message && el.menu && !el.menu.classList.contains("hidden")) {
      const label = String(message).replace(/_/g, " ").toUpperCase().slice(0, 42);
      setMenuStatus(label, "error");
      const oldPlaceholder = el.roomInput.placeholder || "ID";
      el.roomInput.placeholder = label.slice(0, 18);
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

  function setNet({ pingMs, role, playerId, players, playerNames, transportMode, dev = null }) {
    const ping = pingMs === null || pingMs === undefined ? "--" : String(pingMs);
    const mode = role === "host" ? "HOST" : role === "guest" ? "GUEST" : "--";
    const id = playerId || "--";
    const names = playerNames && typeof playerNames === "object" ? playerNames : {};
    const name = names[id] || id;
    const count = Array.isArray(players) ? players.length : 0;
    const tr = transportMode || "LINK";
    const devText = dev?.enabled
      ? ` | DEV ${dev.calm ? "CALM" : "FULL"}${dev.spawnsPaused ? " SPAWN-OFF" : ""}${dev.god ? " GOD" : ""}${dev.flash ? ` | ${dev.flash}` : ""}`
      : "";
    el.netStatus.textContent = `${VERSION.toUpperCase()} | PING ${ping} MS | ${mode} ${name}(${id}) | ${count}/${MAX_PLAYERS} | ${tr}${devText}`;
  }

  function setUpgradeMenu(choices = [], pending = false, selectedIndex = -1, offers = {}) {
    const list = Array.isArray(choices) ? choices : [];
    const offerMeta = offers && typeof offers === "object" ? offers : {};
    const signature = list.map((id) => {
      const meta = offerMeta[id] || {};
      return `${id || "-"}:${meta.rarity || "-"}:${meta.nextStack || 0}:${(meta.hints || []).join("/")}`;
    }).join("|");
    const now = performance.now();
    const shouldReveal = list.length > 0 && signature !== lastUpgradeSignature && !pending;
    if (shouldReveal) {
      const maxRevealMs = list.reduce((max, _id, index) => Math.max(max, index * 180 + 220), 0);
      revealSignature = signature;
      revealUntil = now + maxRevealMs + 320;
    }
    const revealActive = list.length > 0 && signature === revealSignature && now < revealUntil && !pending;
    upgradeOpen = list.length > 0;
    if (!upgradeOpen) {
      upgradeHovered = false;
      revealSignature = "";
      revealUntil = 0;
    }
    el.upgradePanel.classList.toggle("hidden", !upgradeOpen);
    el.upgradePanel.classList.toggle("pending", !!pending);
    el.upgradePanel.classList.toggle("reveal-seq", revealActive);
    if (shouldReveal) {
      void el.upgradePanel.offsetWidth;
    }
    el.upgradeButtons.forEach((btn, index) => {
      const id = list[index];
      const data = UPGRADES[id];
      const meta = offerMeta[id] || {};
      const rarity = meta.rarity || data?.rarity || "common";
      const rarityMeta = RARITY_META[rarity] || RARITY_META.common;
      const rarityLabel = rarityMeta.label || rarity.toUpperCase();
      const stackText = meta.maxStacks > 1 ? `STACK ${meta.nextStack || 1}/${meta.maxStacks}` : "SINGLE";
      const hint = Array.isArray(meta.hints) && meta.hints.length ? meta.hints[0] : "";
      btn.className = `upgrade-choice rarity-${rarity}${revealActive && id ? " reveal" : ""}`;
      btn.classList.toggle("selected", index === selectedIndex);
      btn.disabled = !id || (pending && index !== selectedIndex);
      btn.dataset.rarity = rarity;
      btn.dataset.slot = String(index + 1);
      btn.style.setProperty("--reveal-delay", `${index * 180}ms`);
      btn.style.setProperty("--reveal-duration", "220ms");
      btn.style.setProperty("--rarity-accent", rarityMeta.color || "#d8d8d8");
      btn.innerHTML = data
        ? `<span class="upgrade-key">${index + 1}</span><span class="upgrade-name">${data.name}</span><span class="upgrade-desc">${data.desc}</span><span class="upgrade-meta"><span class="upgrade-rarity">${rarityLabel}</span>${stackText ? ` · ${stackText}` : ""}${hint ? ` · ${hint}` : ""}</span>`
        : "";
    });
    lastUpgradeSignature = upgradeOpen ? signature : "";
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
  el.upgradePanel.addEventListener("wheel", (e) => {
    e.preventDefault();
    e.stopPropagation();
  }, { passive: false });
  el.upgradePanel.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  el.upgradeButtons.forEach((btn, index) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!upgradeOpen || btn.disabled) return;
      btn.blur();
      upgradePickHandler?.(index);
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });

  function setDirectorDebug(snapshot = null) {
    if (!el.directorDebug) return;
    const dev = snapshot?.dev || null;
    const director = snapshot?.director || null;
    const show = !!dev?.enabled && !!director;
    el.directorDebug.classList.toggle("hidden", !show);
    if (!show) {
      el.directorDebug.textContent = "";
      return;
    }

    const threat = director.threat || {};
    const last = director.lastSpawn || {};
    const enemies = Array.isArray(snapshot?.enemies) ? snapshot.enemies.length : 0;
    const gate = `${director.canSpawn ? "SPAWN" : "NO-SPAWN"}/${director.canOpenPortal ? "PORTAL" : "LOCK"}`;
    const objective = String(director.objective || "?").toUpperCase();
    const phase = String(director.phase || "?").toUpperCase();
    const stage = String(director.stageId || "-").toUpperCase();
    const budget = `${director.budget ?? 0}/${director.totalBudget ?? 0}`;
    const threatLine = `THR P:${Number(threat.pressure || 0).toFixed(2)} R:${Number(threat.relief || 0).toFixed(2)} D:${Number(threat.dominance || 0).toFixed(2)} K:${Number(threat.killRate || 0).toFixed(2)}`;
    const multLine = `MUL I:${Number(threat.intensityMult || 1).toFixed(2)} C:${Number(threat.capMult || 1).toFixed(2)} B:${Number(threat.batchMult || 1).toFixed(2)} T:${Number(threat.intervalMult || 1).toFixed(2)}`;
    const spawnLine = `LAST ${String(last.role || "-").toUpperCase()} ${String(last.kind || "-").toUpperCase()} @ ${String(last.zone || "-").toUpperCase()}`;
    el.directorDebug.textContent = [
      `DIR ${phase} / ${stage}`,
      `OBJ ${objective} | ${gate}`,
      `EN ${enemies}/${director.enemyCap ?? "?"} | CLEAN ${director.cleanupThreshold ?? "?"}`,
      `BUD ${budget} | WAVE ${director.wave ?? 0}`,
      threatLine,
      multLine,
      spawnLine
    ].join("\n");
  }

  function setHud(player, snapshot = null) {
    setDirectorDebug(snapshot);
    if (!player) {
      el.hpText.textContent = "--";
      el.weaponText.textContent = "--";
      el.locationText.textContent = snapshot?.location?.name || "--";
      el.portalText.textContent = "--";
      if (el.dashText) el.dashText.textContent = "--";
      if (el.companionText) el.companionText.textContent = "--";
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
    const dash = player.ability?.dash || null;
    if (el.dashText) {
      el.dashText.textContent = dash?.available
        ? (dash.ready || (dash.cooldownLeft || 0) <= 0 ? "SHIFT READY" : `${Number(dash.cooldownLeft || 0).toFixed(1)}S`)
        : "--";
    }
    if (el.companionText) {
      const comp = player.companions || null;
      const parts = [];
      if (comp?.orbital) parts.push(`ORB ${comp.orbital}`);
      if (comp?.drone) parts.push(`DRN ${comp.drone}`);
      el.companionText.textContent = parts.length ? parts.join(" ") : "--";
    }
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

  return { el, showMenu, showGame, setMenuStatus, flashError, flashCopied, setNet, setHud, setUpgradeMenu, onUpgradePick, isUpgradeOpen, isUpgradeHovered: () => upgradeHovered };
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
