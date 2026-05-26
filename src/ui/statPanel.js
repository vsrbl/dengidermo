import { WEAPONS } from "../data/weapons.js";
import { normalizePlayerName } from "../core/names.js";
import { statLine, statSection, textNode } from "./dom.js";
import { flatPercent, integer, safeExpProgressText, signedPercent } from "./format.js";

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

function dashChargeText(dash = null) {
  if (!dash?.available) return "--";
  const max = Math.max(1, Math.floor(Number(dash.maxCharges) || 1));
  const charges = Math.max(0, Math.min(max, Math.floor(Number(dash.charges) || 0)));
  const cooldown = Math.max(0, Number(dash.cooldown) || 0);
  const rechargeLeft = Math.max(0, Number(dash.rechargeLeft || dash.cooldownLeft || 0));
  const cells = Array.from({ length: Math.min(max, 10) }, (_, index) => index < charges ? "■" : (index === charges && charges < max && rechargeLeft > 0 ? "▒" : "□")).join("");
  const more = max > 10 ? `+${max - 10}` : "";
  const next = charges < max ? ` +1 ${rechargeLeft.toFixed(1)}S` : " FULL";
  return `${cells}${more} ${charges}/${max}${next}`;
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

export function renderStatPanel(statPanelEl, gameEl, player, snapshot = null, { open = false, upgradeOpen = false, economyQueueLabel = null } = {}) {
  if (!statPanelEl) return;
  const shouldOpen = !!open && !!player;
  statPanelEl.classList.toggle("open", shouldOpen);
  gameEl?.classList.toggle("tab-stats", shouldOpen);
  statPanelEl.setAttribute("aria-hidden", shouldOpen ? "false" : "true");
  if (!shouldOpen) return;

  const stat = player.statSnapshot || {};
  const percent = stat.percent || {};
  const utility = stat.utility || {};
  const economy = stat.economy || player.economy || {};
  const weapon = stat.weapon || {};
  const runtime = stat.runtime || {};
  const hpNow = Math.max(0, Math.round(player.hp || runtime.hp || 0));
  const maxHp = Math.max(1, Math.round(player.maxHp || runtime.maxHp || 100));
  const hpPercent = Number.isFinite(runtime.hpPercent) ? runtime.hpPercent : Math.round(hpNow / maxHp * 100);
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  const allies = players.filter((ally) => ally?.id && ally.id !== player.id).slice(0, 3);
  const location = snapshot?.location || {};
  const loop = Number.isFinite(location.loopIndex) ? location.loopIndex : 0;
  const depth = Number.isFinite(location.runDepth) ? location.runDepth : (Number.isFinite(location.index) ? location.index : 0);
  const roomId = String(location.resolvedRoomId || location.baseRoomId || location.id || "unknown").toUpperCase();
  const mods = modifierLabels(snapshot);

  const header = document.createElement("div");
  header.className = "stat-panel-header";
  header.append(
    textNode("div", "stat-panel-kicker", "HOLD TAB / RUN"),
    textNode("div", "stat-panel-title", `LOOP ${loop} / DEPTH ${depth}`),
    textNode("div", "stat-panel-player", `${compactName(player)} · HP ${hpNow}/${maxHp}`)
  );

  const queueLabel = typeof economyQueueLabel === "function" ? economyQueueLabel : ((queue) => queue > 0 ? "EXIT TO INSTALL" : "NO INSTALL");
  const ownQueue = Math.max(0, Math.floor(Number.isFinite(economy.pendingUpgradeCount) ? economy.pendingUpgradeCount : 0));
  const dash = stat.ability?.dash || player.ability?.dash || null;
  const dashText = dashChargeText(dash);

  const themeLabel = String(location.environmentTheme?.label || location.environmentThemeId || location.biomeName || location.biomeId || "GRID").replace(/_/g, " ").toUpperCase();
  const routeLabel = String(location.routeNodeId || location.roomPoolId || "BASE ROUTE").replace(/_/g, " ").toUpperCase();
  const runRows = [
    statLine("ROOM", roomId),
    statLine("THEME", themeLabel),
    statLine("ROUTE", routeLabel),
    statLine("MODS", mods.length ? mods.join(" + ") : "CLEAR")
  ];

  const playerRows = [
    statLine("HP", `${hpNow}/${maxHp}`),
    statLine("EXP", safeExpProgressText(economy.xp || 0, economy.nextLevelXp)),
    statLine("GLD", `$${economy.money || 0}`),
    statLine("INSTALL", ownQueue > 0 ? `x${ownQueue}` : "--", ownQueue > 0 ? "accent" : ""),
    statLine("QUEUE", queueLabel(ownQueue, upgradeOpen), ownQueue > 0 ? "accent" : ""),
    statLine("DASH", dashText, dash?.ready ? "accent" : ""),
    statLine("WEAPON", `${String(weapon.code || weapon.id || "---").toUpperCase()}${weapon.name ? ` / ${String(weapon.name).toUpperCase()}` : ""}`.trim())
  ];

  const statRows = [
    statLine("DMG", signedPercent(percent.damage)),
    statLine("FIRE", signedPercent(percent.fireRate)),
    statLine("SPD", signedPercent(percent.moveSpeed)),
    statLine("PROJ", signedPercent(percent.projectileSpeed)),
    statLine("CRIT", flatPercent(percent.critChance)),
    statLine("LUCK", `${signedPercent(percent.luckDropChance)} DROP / ${signedPercent(percent.luckRareValue)} VALUE`),
    statLine("MAGNET", utility.magnetRadius ? `${integer(utility.magnetRadius)}R` : "--"),
    statLine("LIFESTEAL", flatPercent(percent.lifesteal))
  ];

  const weaponRows = [
    statLine("DAMAGE", weapon.effective?.damage ? String(weapon.effective.damage) : "--"),
    statLine("RATE", weapon.effective?.fireRate ? `${weapon.effective.fireRate}/S` : "--"),
    statLine("OWNED", Array.isArray(weapon.owned) ? weapon.owned.map((id) => (WEAPONS[id]?.code || id.slice(0, 3)).toUpperCase()).join(" ") : "--")
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

  const grid = document.createElement("div");
  grid.className = "stat-panel-grid";
  grid.append(
    statSection("RUN", runRows),
    statSection("PLAYER", playerRows),
    statSection("STATS", statRows),
    statSection("WEAPON", weaponRows),
    statSection("TEMP SIGNALS", buildSignalRows(stat, snapshot)),
    allySection
  );

  statPanelEl.replaceChildren(header, grid);
}
