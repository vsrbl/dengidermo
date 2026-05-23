import { UPGRADE_HIDE_MS, UPGRADE_RESEND_MS, UPGRADE_TIMEOUT_MS } from "../core/constants.js";

export function upgradeChoicesKey(choices) {
  return Array.isArray(choices) && choices.length ? choices.join("|") : "";
}

export function createUpgradeClient(app, { applyUpgradeRequest } = {}) {
  function reset() {
    app.localUpgradeChoices = [];
    app.localUpgradeOffers = {};
    app.upgradePickPending = false;
    app.upgradePendingAt = 0;
    app.pendingUpgradeIndex = -1;
    app.pendingUpgradeKey = "";
    app.pendingUpgradeLastSend = 0;
    window.clearTimeout(app.upgradeHideTimer);
    app.upgradeHideTimer = 0;
    app.ui.setUpgradeMenu([]);
  }

  function syncFromHost(choices, offers = {}) {
    const nextChoices = Array.isArray(choices) ? choices.filter((id) => typeof id === "string").slice(0, 3) : [];
    const nextKey = upgradeChoicesKey(nextChoices);

    if (!nextKey) {
      reset();
      return;
    }

    if (app.upgradePickPending && nextKey === app.pendingUpgradeKey) {
      app.localUpgradeChoices = [];
      app.ui.setUpgradeMenu([]);
      return;
    }

    if (app.pendingUpgradeKey && nextKey === app.pendingUpgradeKey) {
      app.localUpgradeChoices = [];
      app.ui.setUpgradeMenu([]);
      return;
    }

    app.localUpgradeChoices = nextChoices;
    app.localUpgradeOffers = offers && typeof offers === "object" ? offers : {};
    app.upgradePickPending = false;
    app.upgradePendingAt = 0;
    app.pendingUpgradeIndex = -1;
    app.pendingUpgradeKey = "";
    app.pendingUpgradeLastSend = 0;
    app.ui.setUpgradeMenu(app.localUpgradeChoices, false, -1, app.localUpgradeOffers);
  }

  function sendPending(now = performance.now()) {
    if (app.role !== "guest" || app.pendingUpgradeIndex < 0) return;
    app.pendingUpgradeLastSend = now;
    app.transport?.sendToHost({ t: "upgrade", index: app.pendingUpgradeIndex, key: app.pendingUpgradeKey });
  }

  function requestChoice(index) {
    if (!app.running || app.upgradePickPending || !app.localUpgradeChoices[index]) return;
    const key = upgradeChoicesKey(app.localUpgradeChoices);
    if (!key) return;

    app.upgradePickPending = true;
    app.upgradePendingAt = performance.now();
    app.pendingUpgradeIndex = index;
    app.pendingUpgradeKey = key;
    app.pendingUpgradeLastSend = 0;
    app.ui.setUpgradeMenu(app.localUpgradeChoices, true, index, app.localUpgradeOffers);
    window.clearTimeout(app.upgradeHideTimer);
    app.upgradeHideTimer = window.setTimeout(() => {
      if (app.upgradePickPending && app.pendingUpgradeKey === key) {
        app.localUpgradeChoices = [];
        app.ui.setUpgradeMenu([]);
      }
    }, UPGRADE_HIDE_MS);

    if (app.role === "host") {
      const ok = applyUpgradeRequest?.(app.playerId, { index, key });
      if (!ok) reset();
      return;
    }

    sendPending(app.upgradePendingAt);
  }

  function tick(now = performance.now()) {
    if (app.upgradePickPending && app.pendingUpgradeIndex >= 0 && now - app.pendingUpgradeLastSend > UPGRADE_RESEND_MS) {
      sendPending(now);
    }
    if (app.upgradePickPending && app.upgradePendingAt && now - app.upgradePendingAt > UPGRADE_TIMEOUT_MS) {
      reset();
    }
  }

  return { reset, syncFromHost, requestChoice, sendPending, tick, choicesKey: upgradeChoicesKey };
}
