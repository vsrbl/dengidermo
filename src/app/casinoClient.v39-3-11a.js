import { CASINO_MACHINES } from "../data/casinoMachines.js";
import { CASINO_STAKES } from "../data/casinoStakes.js";
import { CASINO_SYMBOLS } from "../data/casinoSymbols.js";

function moneyOf(player) {
  return Math.max(0, Math.floor(player?.economy?.money || 0));
}

function currentPlayer(app) {
  return app.snapshot?.players?.find((p) => p.id === app.playerId) || app.localPose || null;
}

function targetFromSnapshot(app, targetId) {
  return (app.snapshot?.interactables || []).find((item) => item.id === targetId) || null;
}

function symbolLabel(symbolId) {
  const symbol = CASINO_SYMBOLS[symbolId];
  return symbol?.glyph || symbol?.label || "?";
}

export function createCasinoClient(app, { host } = {}) {
  const panel = document.getElementById("casinoPanel");
  const machineTitle = document.getElementById("casinoMachineTitle");
  const moneyText = document.getElementById("casinoMoneyText");
  const statusText = document.getElementById("casinoStatusText");
  const reels = Array.from(document.querySelectorAll(".casino-reel"));
  const stakeButtons = Array.from(document.querySelectorAll(".casino-stake"));
  const closeBtn = document.getElementById("casinoCloseBtn");
  let openTarget = null;
  let pending = false;
  let lastResultAt = 0;

  function isOpen() {
    return !!openTarget && !!panel && !panel.classList.contains("hidden");
  }

  function setStatus(text = "SELECT STAKE", kind = "info") {
    if (!statusText) return;
    statusText.textContent = String(text || "").toUpperCase().slice(0, 48);
    statusText.dataset.kind = kind;
  }

  function setReels(symbols = []) {
    reels.forEach((el, index) => {
      const id = symbols[index] || "";
      el.textContent = id ? symbolLabel(id) : "?";
      el.dataset.symbol = id;
    });
  }

  function refresh() {
    if (!panel || !openTarget) return;
    const latest = targetFromSnapshot(app, openTarget.id);
    if (latest) openTarget = latest;
    const machine = CASINO_MACHINES[openTarget.casinoMachineId] || null;
    const me = currentPlayer(app);
    const money = moneyOf(me);
    if (machineTitle) machineTitle.textContent = machine?.name || openTarget.label || "SIGNAL SLOT";
    if (moneyText) moneyText.textContent = `$${money}`;
    stakeButtons.forEach((btn) => {
      const stake = CASINO_STAKES[btn.dataset.stakeId];
      const allowed = !!stake && (!machine || machine.allowedStakes.includes(stake.id));
      btn.disabled = pending || !allowed || money < (stake?.cost || 0);
      const cost = stake ? `$${stake.cost}` : "--";
      btn.querySelector(".casino-stake-cost").textContent = cost;
      btn.querySelector(".casino-stake-name").textContent = stake?.name || "STAKE";
      btn.querySelector(".casino-stake-desc").textContent = stake?.description || "HOST VALIDATED";
    });
  }

  function open(target) {
    if (!panel || !target?.casinoMachineId) return false;
    openTarget = target;
    pending = false;
    panel.classList.remove("hidden");
    setReels([]);
    setStatus("SELECT STAKE", "info");
    refresh();
    return true;
  }

  function close() {
    openTarget = null;
    pending = false;
    panel?.classList.add("hidden");
  }

  function requestSpin(stakeId) {
    if (!openTarget || pending || !stakeId) return false;
    app.casinoSeq += 1;
    pending = true;
    setReels([]);
    setStatus("SPIN REQUEST", "pending");
    refresh();
    const request = { t: "casinoSpin", interactableId: openTarget.id, machineId: openTarget.casinoMachineId, stakeId, seq: app.casinoSeq };
    if (app.role === "host") {
      const result = host?.applyCasinoSpinRequest(app.playerId, request);
      receiveResult(result || { ok: false, reason: "host_failed", seq: request.seq });
      return true;
    }
    app.transport?.sendToHost(request);
    return true;
  }

  function receiveResult(result = {}) {
    if (!result || result.seq < (app.casinoSeq - 3)) return;
    pending = false;
    lastResultAt = performance.now();
    if (!result.ok) {
      setStatus(result.reason || "SPIN DENIED", "error");
      setReels([]);
      refresh();
      return;
    }
    setReels(result.symbols || []);
    const labels = Array.isArray(result.symbolLabels) && result.symbolLabels.length ? result.symbolLabels.join("-") : "RESOLVED";
    const outcome = result.outcomeLabel || (result.match ? "PAYOUT" : "BUST");
    const suffix = result.payoutText || (result.match ? "PAYOUT" : `LOST $${result.cost || ""}`);
    setStatus(`${labels} / ${outcome} / ${suffix}`, result.match ? "win" : "loss");
    refresh();
  }

  function tick() {
    if (!isOpen()) return;
    const target = targetFromSnapshot(app, openTarget.id);
    if (!target || target.opened || target.active === false) {
      close();
      return;
    }
    refresh();
    if (!pending && lastResultAt && performance.now() - lastResultAt > 2400) lastResultAt = 0;
  }

  function bind() {
    if (!panel) return;
    panel.addEventListener("pointerdown", (e) => e.stopPropagation());
    panel.addEventListener("pointerup", (e) => e.stopPropagation());
    panel.addEventListener("wheel", (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    closeBtn?.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    });
    stakeButtons.forEach((btn) => {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled) return;
        requestSpin(btn.dataset.stakeId);
      });
    });
  }

  bind();

  return {
    open,
    close,
    isOpen,
    receiveResult,
    tick
  };
}
