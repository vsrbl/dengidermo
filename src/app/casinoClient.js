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
  let revealResult = null;
  let revealStartAt = 0;
  let revealedReels = 0;

  function isOpen() {
    return !!openTarget && !!panel && !panel.classList.contains("hidden");
  }

  function setStatus(text = "SELECT BET", kind = "info") {
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
      btn.querySelector(".casino-stake-name").textContent = stake?.name || "BET";
      btn.querySelector(".casino-stake-desc").textContent = stake?.description || "HOST VALIDATED";
    });
  }

  function open(target) {
    if (!panel || !target?.casinoMachineId) return false;
    openTarget = target;
    pending = false;
    revealResult = null;
    revealStartAt = 0;
    revealedReels = 0;
    panel.classList.remove("hidden");
    setReels([]);
    setStatus("SELECT BET", "info");
    refresh();
    return true;
  }

  function close() {
    openTarget = null;
    pending = false;
    revealResult = null;
    revealStartAt = 0;
    revealedReels = 0;
    panel?.classList.add("hidden");
  }

  function requestSpin(stakeId) {
    if (!openTarget || pending || !stakeId) return false;
    app.casinoSeq += 1;
    pending = true;
    revealResult = null;
    revealStartAt = 0;
    revealedReels = 0;
    setReels([]);
    setStatus("SIGNAL LOCK", "pending");
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

  function finalStatusForResult(result = {}) {
    const labels = Array.isArray(result.symbolLabels) && result.symbolLabels.length ? result.symbolLabels.join("-") : "RESOLVED";
    const outcome = result.outcomeLabel || (result.match ? "PAYOUT" : "BUST");
    const suffix = result.payoutText || (result.match ? "PAYOUT" : `LOST $${result.cost || ""}`);
    return `${labels} / ${outcome} / ${suffix}`;
  }

  function applyRevealFrame(now = performance.now()) {
    if (!revealResult) return false;
    const symbols = Array.isArray(revealResult.symbols) ? revealResult.symbols : [];
    const elapsed = now - revealStartAt;
    const step = Math.min(symbols.length, Math.max(0, Math.floor(elapsed / 210)));
    if (step !== revealedReels) {
      revealedReels = step;
      setReels(symbols.map((id, index) => (index < revealedReels ? id : "")));
      if (revealedReels < symbols.length) setStatus(`REEL ${revealedReels + 1} / SIGNAL`, "pending");
    }
    if (elapsed >= 210 * (symbols.length + 1)) {
      setReels(symbols);
      setStatus(finalStatusForResult(revealResult), revealResult.match ? "win" : "loss");
      lastResultAt = now;
      revealResult = null;
      revealStartAt = 0;
      revealedReels = 0;
      refresh();
      return false;
    }
    return true;
  }

  function receiveResult(result = {}) {
    if (!result || result.seq < (app.casinoSeq - 3)) return;
    pending = false;
    if (!result.ok) {
      revealResult = null;
      setStatus(result.reason || "SPIN DENIED", "error");
      setReels([]);
      refresh();
      return;
    }
    revealResult = result;
    revealStartAt = performance.now();
    revealedReels = 0;
    lastResultAt = 0;
    setReels([]);
    setStatus("REEL 1 / SIGNAL", "pending");
    refresh();
  }

  function tick() {
    if (!isOpen()) return;
    const target = targetFromSnapshot(app, openTarget.id);
    if (!target || target.opened || target.active === false) {
      close();
      return;
    }
    const now = performance.now();
    if (revealResult) applyRevealFrame(now);
    refresh();
    if (!pending && !revealResult && lastResultAt && now - lastResultAt > 2400) lastResultAt = 0;
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
