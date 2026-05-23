import { BUILD_ID, VERSION, MAX_PLAYERS } from "./core/constants.js";
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
    statPanel: document.getElementById("statPanel"),
    procFeed: document.getElementById("procFeed"),
    hpText: document.getElementById("hpText"),
    economyText: document.getElementById("economyText"),
    weaponText: document.getElementById("weaponText"),
    inventoryText: document.getElementById("inventoryText"),
    locationText: document.getElementById("locationText"),
    portalText: document.getElementById("portalText"),
    dashText: document.getElementById("dashText"),
    companionText: document.getElementById("companionText"),
    upgradePanel: document.getElementById("upgradePanel"),
    upgradeTitle: document.getElementById("upgradeTitle"),
    upgradeButtons: Array.from(document.querySelectorAll(".upgrade-choice"))
  };

  let upgradePickHandler = null;
  let upgradeOpen = false;
  let upgradeHovered = false;
  let lastUpgradeSignature = "";
  let revealSignature = "";
  let revealUntil = 0;
  let lastInstallQueue = 0;
  let economyTween = { playerId: null, money: null, xp: null, level: null, moneyFrom: 0, moneyTo: 0, xpFrom: 0, xpTo: 0, moneyStartedAt: 0, xpStartedAt: 0 };

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

  function setNet({ pingMs, role, playerId, players, playerNames, transportMode, dev = null, release = null }) {
    const ping = pingMs === null || pingMs === undefined ? "--" : String(pingMs);
    const mode = role === "host" ? "HOST" : role === "guest" ? "GUEST" : "--";
    const id = playerId || "--";
    const names = playerNames && typeof playerNames === "object" ? playerNames : {};
    const name = names[id] || id;
    const count = Array.isArray(players) ? players.length : 0;
    const tr = transportMode || "LINK";
    const build = BUILD_ID.replace(`${VERSION}-`, "").toUpperCase();
    const releaseText = release?.status && release.status !== "ok" && release.status !== "checking"
      ? ` | ${String(release.message || release.status).toUpperCase().slice(0, 64)}`
      : "";
    const devText = dev?.enabled
      ? ` | DEV ${dev.calm ? "CALM" : "FULL"}${dev.spawnsPaused ? " SPAWN-OFF" : ""}${dev.god ? " GOD" : ""}${dev.flash ? ` | ${dev.flash}` : ""}`
      : "";
    el.netStatus.textContent = `${VERSION.toUpperCase()} | BUILD ${build} | PING ${ping} MS | ${mode} ${name}(${id}) | ${count}/${MAX_PLAYERS} | ${tr}${releaseText}${devText}`;
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
    if (el.upgradeTitle) el.upgradeTitle.textContent = pending ? "INSTALLING..." : "INSTALL SELECT";
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
      const stackText = meta.unlimitedStacks ? `STACK x${meta.nextStack || 1}` : meta.maxStacks > 1 ? `STACK ${meta.nextStack || 1}/${meta.maxStacks}` : "SINGLE";
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



  function textNode(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
  }

  function statLine(label, value, className = "") {
    const row = document.createElement("div");
    row.className = `stat-panel-row${className ? ` ${className}` : ""}`;
    row.append(textNode("span", "stat-panel-label", label), textNode("span", "stat-panel-value", value));
    return row;
  }

  function statSection(title, rows = []) {
    const section = document.createElement("section");
    section.className = "stat-panel-section";
    section.append(textNode("div", "stat-panel-section-title", title));
    for (const row of rows) section.append(row);
    return section;
  }

  function signedPercent(value) {
    const n = Number.isFinite(value) ? value : 0;
    const rounded = Math.round(n * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${rounded >= 0 ? "+" : ""}${text}%`;
  }

  function flatPercent(value) {
    const n = Number.isFinite(value) ? value : 0;
    const rounded = Math.round(n * 10) / 10;
    return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}%`;
  }

  function integer(value, fallback = 0) {
    return Math.round(Number.isFinite(value) ? value : fallback);
  }

  function compactName(player = {}) {
    return normalizePlayerName(player.name || player.id || "PLAYER").slice(0, 12).toUpperCase();
  }

  function modifierLabels(snapshot = null) {
    const location = snapshot?.location || null;
    const stack = Array.isArray(location?.modifierStack) ? location.modifierStack : [];
    if (stack.length) {
      return stack.map((mod) => String(mod.name || mod.id || mod).replace(/_/g, " ").toUpperCase()).filter(Boolean).slice(0, 3);
    }
    const modifiers = Array.isArray(location?.modifiers) ? location.modifiers : [];
    return modifiers.map((id) => String(id || "").replace(/_/g, " ").toUpperCase()).filter(Boolean).slice(0, 3);
  }

  function buildSignalRows(statSnapshot = null, snapshot = null) {
    const runtime = statSnapshot?.runtime || {};
    const ability = statSnapshot?.ability || {};
    const utility = statSnapshot?.utility || {};
    const rows = [];
    if ((runtime.dashInvulnLeft || 0) > 0) rows.push(statLine("DASH INV", `${Number(runtime.dashInvulnLeft).toFixed(1)}S`, "accent"));
    if (ability.dash?.maxCharges > 1) rows.push(statLine("DASH", `${ability.dash.charges || 0}/${ability.dash.maxCharges} CHG`, ability.dash.ready ? "accent" : ""));
    else if ((runtime.dashCooldownLeft || 0) > 0) rows.push(statLine("DASH CD", `${Number(runtime.dashCooldownLeft).toFixed(1)}S`));
    else if (ability.dash) rows.push(statLine("DASH", "READY", "accent"));
    if ((utility.shieldCharges || 0) > 0 || (runtime.shieldChargesReady || 0) > 0) rows.push(statLine("SHIELD", `${Math.max(utility.shieldCharges || 0, runtime.shieldChargesReady || 0)} CHG`));
    for (const label of modifierLabels(snapshot)) rows.push(statLine("ROOM", label));
    if (!rows.length) rows.push(statLine("SIGNAL", "CLEAR"));
    return rows;
  }

  function renderStatPanel(player, snapshot = null, open = false) {
    if (!el.statPanel) return;
    const shouldOpen = !!open && !!player;
    el.statPanel.classList.toggle("open", shouldOpen);
    el.game?.classList.toggle("tab-stats", shouldOpen);
    el.statPanel.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
    if (!shouldOpen) return;

    const stat = player.statSnapshot || {};
    const percent = stat.percent || {};
    const utility = stat.utility || {};
    const economy = stat.economy || player.economy || {};
    const weapon = stat.weapon || {};
    const runtime = stat.runtime || {};
    const hpPercent = Number.isFinite(runtime.hpPercent) ? runtime.hpPercent : Math.round((player.hp || 0) / Math.max(1, player.maxHp || 100) * 100);
    const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
    const allies = players.filter((ally) => ally?.id && ally.id !== player.id).slice(0, 3);

    const header = document.createElement("div");
    header.className = "stat-panel-header";
    header.append(
      textNode("div", "stat-panel-kicker", "HOLD TAB / DIAGNOSTIC"),
      textNode("div", "stat-panel-title", "SYSTEM STATS"),
      textNode("div", "stat-panel-player", `${compactName(player)} · HP ${flatPercent(hpPercent)}`)
    );

    const coreRows = [
      statLine("DMG", signedPercent(percent.damage)),
      statLine("FIRE", signedPercent(percent.fireRate)),
      statLine("MOVE", signedPercent(percent.moveSpeed)),
      statLine("PROJ SPD", signedPercent(percent.projectileSpeed)),
      statLine("CRIT", flatPercent(percent.critChance)),
      statLine("LUCK DROP", signedPercent(percent.luckDropChance)),
      statLine("LUCK VALUE", signedPercent(percent.luckRareValue)),
      statLine("MAGNET", utility.magnetRadius ? `${integer(utility.magnetRadius)}R` : "--"),
      statLine("LIFESTEAL", flatPercent(percent.lifesteal))
    ];

    const weaponRows = [
      statLine("ACTIVE", `${String(weapon.code || weapon.id || "---").toUpperCase()} ${weapon.name ? `/${String(weapon.name).toUpperCase()}` : ""}`.trim()),
      statLine("DAMAGE", weapon.effective?.damage ? String(weapon.effective.damage) : "--"),
      statLine("RATE", weapon.effective?.fireRate ? `${weapon.effective.fireRate}/S` : "--"),
      statLine("OWNED", Array.isArray(weapon.owned) ? weapon.owned.map((id) => (WEAPONS[id]?.code || id.slice(0, 3)).toUpperCase()).join(" ") : "--")
    ];

    const ownQueue = Math.max(0, Math.floor(Number.isFinite(economy.pendingUpgradeCount) ? economy.pendingUpgradeCount : 0));
    const economyRows = [
      statLine("LVL", String(economy.level || 1)),
      statLine("EXP", `${economy.xp || 0}/${economy.nextLevelXp || "--"}`),
      statLine("MONEY", `$${economy.money || 0}`),
      statLine("INSTALL", ownQueue > 0 ? `x${ownQueue}` : "--", ownQueue > 0 ? "accent" : ""),
      statLine("QUEUE", economyQueueLabel(ownQueue, upgradeOpen), ownQueue > 0 ? "accent" : "")
    ];

    const allySection = document.createElement("section");
    allySection.className = "stat-panel-section stat-panel-allies";
    allySection.append(textNode("div", "stat-panel-section-title", "ALLIES"));
    if (!allies.length) {
      allySection.append(statLine("LINK", "SOLO"));
    } else {
      for (const ally of allies) {
        const aStat = ally.statSnapshot || {};
        const aEco = aStat.economy || ally.economy || {};
        const aRuntime = aStat.runtime || {};
        const aHp = Number.isFinite(aRuntime.hpPercent) ? aRuntime.hpPercent : Math.round((ally.hp || 0) / Math.max(1, ally.maxHp || 100) * 100);
        const install = (aEco.pendingUpgradeCount || 0) > 0 ? ` INST x${aEco.pendingUpgradeCount}` : "";
        allySection.append(statLine(compactName(ally), `L${aEco.level || 1} HP ${flatPercent(aHp)}${install}`));
      }
    }

    el.statPanel.replaceChildren(
      header,
      statSection("CORE", coreRows),
      statSection("WEAPON", weaponRows),
      statSection("ECONOMY", economyRows),
      statSection("TEMP SIGNALS", buildSignalRows(stat, snapshot)),
      allySection
    );
  }


  function renderProcFeed(items = []) {
    if (!el.procFeed) return;
    const list = Array.isArray(items) ? items.slice(0, 5) : [];
    el.procFeed.classList.toggle("active", list.length > 0);
    el.procFeed.replaceChildren(...list.map((item, index) => {
      const row = document.createElement("div");
      row.className = `proc-feed-row priority-${item.priority || "low"} kind-${item.kind || "event"}`;
      row.style.setProperty("--proc-index", String(index));
      const text = textNode("span", "proc-feed-text", String(item.text || "SIGNAL").toUpperCase().slice(0, 28));
      const detail = textNode("span", "proc-feed-detail", String(item.detail || "").toUpperCase().slice(0, 32));
      row.append(text, detail);
      return row;
    }));
  }


  function economyNumber(value, fallback = 0) {
    return Math.max(0, Math.round(Number.isFinite(value) ? value : fallback));
  }

  function economyQueueTier(queue) {
    return queue >= 4 ? 3 : queue >= 2 ? 2 : queue > 0 ? 1 : 0;
  }

  function economyQueueLabel(queue, upgradeOpen = false) {
    if (queue <= 0) return "NO INSTALL";
    if (upgradeOpen) return queue > 1 ? `INSTALL ${queue} QUEUED` : "INSTALL READY";
    return "EXIT TO INSTALL";
  }

  function renderEconomyHud(player, eco, display = {}) {
    if (!el.economyText) return;
    const queue = Math.max(0, Math.floor(Number.isFinite(eco.pendingUpgradeCount) ? eco.pendingUpgradeCount : 0));
    const next = Number.isFinite(eco.nextLevelXp) ? Math.max(1, Math.round(eco.nextLevelXp)) : null;
    const level = Math.max(1, Math.floor(Number.isFinite(eco.level) ? eco.level : 1));
    const xp = economyNumber(display.xp, eco.xp || 0);
    const money = economyNumber(display.money, eco.money || 0);
    const xpPct = next ? Math.max(0, Math.min(100, (xp / next) * 100)) : 0;
    const tier = economyQueueTier(queue);
    const stateLabel = economyQueueLabel(queue, upgradeOpen);

    const main = textNode("span", "economy-main", `$${money} · L${level} · EXP ${xp}/${next || "--"}`);
    const track = document.createElement("span");
    track.className = "economy-xp-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.className = "economy-xp-fill";
    fill.style.width = `${xpPct}%`;
    track.append(fill);

    const queueLine = textNode(
      "span",
      `economy-install-line${queue > 0 ? " active" : ""}`,
      queue > 0 ? `INSTALL x${queue} · ${stateLabel}` : stateLabel
    );

    el.economyText.classList.toggle("economy-queued", queue > 0);
    el.economyText.dataset.installTier = String(tier);
    el.economyText.title = queue > 0
      ? `Queued level-up installs: ${queue}. They open after portal transition / safe point.`
      : "No queued level-up install.";
    el.economyText.setAttribute(
      "aria-label",
      `money ${money}, level ${level}, experience ${xp} of ${next || "unknown"}, ${queue > 0 ? `${queue} install queued, exit to install` : "no install queued"}`
    );
    el.economyText.replaceChildren(main, track, queueLine);

    if (queue > lastInstallQueue) restartInstallPulse(queue);
    lastInstallQueue = queue;
  }


  function tweenNumber(from, to, startedAt, now, duration = 220) {
    if (from === null || from === undefined) return Math.round(to || 0);
    if (from === to) return Math.round(to || 0);
    const t = Math.min(1, Math.max(0, (now - startedAt) / duration));
    const eased = 1 - Math.pow(1 - t, 3);
    return Math.round(from + (to - from) * eased);
  }

  function economyDisplayValues(playerId, eco) {
    const now = performance.now();
    const money = Math.round(Number.isFinite(eco.money) ? eco.money : 0);
    const xp = Math.round(Number.isFinite(eco.xp) ? eco.xp : 0);
    const level = Math.round(Number.isFinite(eco.level) ? eco.level : 1);
    if (economyTween.playerId !== playerId) {
      economyTween = { playerId, money, xp, level, moneyFrom: money, moneyTo: money, xpFrom: xp, xpTo: xp, moneyStartedAt: now, xpStartedAt: now };
      return { money, xp };
    }
    if (money !== economyTween.moneyTo) {
      economyTween.moneyFrom = economyTween.money ?? economyTween.moneyTo ?? money;
      economyTween.moneyTo = money;
      economyTween.moneyStartedAt = now;
    }
    if (level !== economyTween.level || xp < (economyTween.xpTo ?? xp)) {
      economyTween.xpFrom = xp;
      economyTween.xpTo = xp;
      economyTween.xpStartedAt = now;
    } else if (xp !== economyTween.xpTo) {
      economyTween.xpFrom = economyTween.xp ?? economyTween.xpTo ?? xp;
      economyTween.xpTo = xp;
      economyTween.xpStartedAt = now;
    }
    economyTween.level = level;
    economyTween.money = tweenNumber(economyTween.moneyFrom, economyTween.moneyTo, economyTween.moneyStartedAt, now);
    economyTween.xp = tweenNumber(economyTween.xpFrom, economyTween.xpTo, economyTween.xpStartedAt, now);
    return { money: economyTween.money, xp: economyTween.xp };
  }

  function restartInstallPulse(queue) {
    if (!el.economyText) return;
    el.economyText.classList.remove("install-pulse", "install-pulse-1", "install-pulse-2", "install-pulse-3");
    void el.economyText.offsetWidth;
    const tier = queue >= 4 ? 3 : queue >= 2 ? 2 : 1;
    el.economyText.classList.add("install-pulse", `install-pulse-${tier}`);
  }

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

  function setHud(player, snapshot = null, options = {}) {
    setDirectorDebug(snapshot);
    renderStatPanel(player, snapshot, !!options.statPanelOpen);
    if (!player) {
      el.hpText.textContent = "--";
      if (el.economyText) {
        el.economyText.classList.remove("economy-queued", "install-pulse", "install-pulse-1", "install-pulse-2", "install-pulse-3");
        el.economyText.dataset.installTier = "0";
        el.economyText.textContent = "--";
        lastInstallQueue = 0;
      }
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
    if (el.economyText) {
      const eco = player.economy || { money: 0, xp: 0, level: 1, nextLevelXp: 24, pendingUpgradeCount: 0 };
      const display = economyDisplayValues(player.id, eco);
      renderEconomyHud(player, eco, display);
    }
    const activeWeapon = WEAPONS[active] || WEAPONS[START_WEAPON];
    el.weaponText.textContent = `[${activeWeapon.code || active.toUpperCase().slice(0, 3)}] ${activeWeapon.name.toUpperCase()}`;
    el.locationText.textContent = snapshot?.location?.name || "GRID 00";
    const portal = (snapshot?.portals || [])[0];
    el.portalText.textContent = portal ? (portal.active ? `${Math.round((portal.progress || 0) * 100)}%` : "LOCKED") : "--";
    const dash = player.ability?.dash || null;
    if (el.dashText) {
      el.dashText.textContent = dash?.available
        ? (dash.maxCharges > 1 && dash.ready ? `SHIFT ${Math.max(0, dash.charges || 0)}/${dash.maxCharges}` : (dash.ready || (dash.cooldownLeft || 0) <= 0 ? "SHIFT READY" : `${Number(dash.cooldownLeft || 0).toFixed(1)}S`))
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
      .map((id, index) => `${index + 1}${id === active ? ":" : "."}${(WEAPONS[id]?.code || id.slice(0, 3)).toUpperCase()}`)
      .join("  ");
  }

  el.roomTitle.addEventListener("click", async () => {
    const text = el.roomTitle.textContent.trim();
    if (!text || text === "------") return;
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard can fail on http */ }
    flashCopied();
  });

  return {
    el,
    showMenu,
    showGame,
    setMenuStatus,
    flashError,
    flashCopied,
    setNet,
    setHud,
    setProcFeed: renderProcFeed,
    setUpgradeMenu,
    onUpgradePick,
    isUpgradeOpen,
    isUpgradeHovered: () => upgradeHovered
  };
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
