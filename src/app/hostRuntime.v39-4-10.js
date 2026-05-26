import { GAME_SPEED, HOST_SIM_FIXED_DT, HOST_SIM_MAX_CATCHUP_STEPS, HOST_SIM_MAX_FRAME_SECONDS, HOST_SIM_THROTTLE_WARN_MS, SNAPSHOT_RATE_P2P, SNAPSHOT_RATE_RELAY, SNAPSHOT_RELAY_STATE_LIMIT_BYTES, SNAPSHOT_RELAY_TARGET_BYTES } from "../core/constants.js";
import { addPlayer, makeSnapshot, removePlayer } from "../game/state.js";
import { fireWeapon } from "../game/combat.js";
import { emptyInput, normalizeHostInput, updateHostWorld } from "../game/simulation.js";
import { cycleWeapon, ensureInventory, getActiveWeaponId, switchWeaponSlot } from "../game/inventory.js";
import { chooseUpgrade } from "../game/upgrades.js";
import { performDash } from "../game/abilities.js";
import { requestInteractableActivation } from "../game/interactables.js";
import { requestCasinoSpin, casinoSpinResultSnapshot } from "../game/casino.js";
import { buildNetworkStatePacket } from "../game/snapshotBudget.js";


export function createInputStreamStats(initialSeq = -1) {
  const safeInitialSeq = Number.isFinite(initialSeq) ? Math.max(-1, Math.floor(initialSeq)) : -1;
  return {
    lastAcceptedSeq: safeInitialSeq,
    lastReceivedSeq: safeInitialSeq,
    lastRejectedSeq: -1,
    acceptedInputs: 0,
    staleDrops: 0,
    lastAcceptedAtMs: 0,
    lastReceivedAtMs: 0,
    lastRejectedAtMs: 0,
    inputAgeMs: 0,
    stale: false
  };
}

function nowMs() {
  const perf = globalThis.performance;
  if (perf && typeof perf.now === "function") return perf.now();
  return Date.now();
}

function inputStreamSnapshot(stats = null, atMs = nowMs()) {
  if (!stats) return null;
  const acceptedAt = Number.isFinite(stats.lastAcceptedAtMs) ? stats.lastAcceptedAtMs : 0;
  const age = acceptedAt > 0 ? Math.max(0, Math.round(atMs - acceptedAt)) : 0;
  return {
    lastAcceptedSeq: Math.max(0, Math.floor(stats.lastAcceptedSeq || 0)),
    lastReceivedSeq: Math.max(0, Math.floor(stats.lastReceivedSeq || 0)),
    lastRejectedSeq: Math.max(0, Math.floor(stats.lastRejectedSeq || 0)),
    acceptedInputs: Math.max(0, Math.floor(stats.acceptedInputs || 0)),
    staleDrops: Math.max(0, Math.floor(stats.staleDrops || 0)),
    inputAgeMs: age,
    stale: !!stats.stale
  };
}

function ensureInputStreamStats(app, playerId) {
  if (!app.inputStreamStats) app.inputStreamStats = Object.create(null);
  if (!app.inputStreamStats[playerId]) app.inputStreamStats[playerId] = createInputStreamStats();
  return app.inputStreamStats[playerId];
}

function publishInputStreamStats(app, playerId, stats, atMs = nowMs()) {
  const snapshot = inputStreamSnapshot(stats, atMs);
  const player = app.hostState?.players?.[playerId];
  if (player && snapshot) player.inputStream = snapshot;
  return snapshot;
}

function refreshInputStreamAges(app, atMs = nowMs()) {
  const byPlayer = app.inputStreamStats || {};
  let staleDrops = 0;
  let maxInputAgeMs = 0;
  let maxAcceptedSeq = 0;
  for (const playerId of Object.keys(byPlayer)) {
    const snapshot = publishInputStreamStats(app, playerId, byPlayer[playerId], atMs);
    if (!snapshot) continue;
    staleDrops += snapshot.staleDrops || 0;
    maxInputAgeMs = Math.max(maxInputAgeMs, snapshot.inputAgeMs || 0);
    maxAcceptedSeq = Math.max(maxAcceptedSeq, snapshot.lastAcceptedSeq || 0);
  }
  app.inputStreamSummary = {
    mode: "monotonic",
    lastAcceptedSeq: maxAcceptedSeq,
    inputAgeMs: maxInputAgeMs,
    staleDrops,
    players: Object.keys(byPlayer).length
  };
}

export function acceptMonotonicHostInput(app, playerId, rawInput, atMs = nowMs()) {
  if (!app || !playerId) return { accepted: false, reason: "missing_player" };
  if (!app.hostInputs) app.hostInputs = Object.create(null);
  const input = normalizeHostInput(rawInput);
  const stats = ensureInputStreamStats(app, playerId);
  const incomingSeq = Math.max(0, Math.floor(input.inputSeq || 0));
  const lastAcceptedSeq = Number.isFinite(stats.lastAcceptedSeq) ? stats.lastAcceptedSeq : -1;
  stats.lastReceivedSeq = incomingSeq;
  stats.lastReceivedAtMs = atMs;

  if (incomingSeq <= lastAcceptedSeq) {
    stats.staleDrops = (stats.staleDrops || 0) + 1;
    stats.lastRejectedSeq = incomingSeq;
    stats.lastRejectedAtMs = atMs;
    stats.stale = true;
    publishInputStreamStats(app, playerId, stats, atMs);
    return { accepted: false, stale: true, input, stats };
  }

  app.hostInputs[playerId] = input;
  stats.lastAcceptedSeq = incomingSeq;
  stats.acceptedInputs = (stats.acceptedInputs || 0) + 1;
  stats.lastAcceptedAtMs = atMs;
  stats.stale = false;
  publishInputStreamStats(app, playerId, stats, atMs);
  return { accepted: true, stale: false, input, stats };
}

export function resetRemoteInputStream(app, playerId, atMs = nowMs()) {
  if (!app || !playerId) return { reset: false, reason: "missing_player" };
  if (!app.hostInputs) app.hostInputs = Object.create(null);
  if (!app.inputStreamStats) app.inputStreamStats = Object.create(null);

  app.hostInputs[playerId] = emptyInput();
  const stats = createInputStreamStats(-1);
  app.inputStreamStats[playerId] = stats;

  const player = app.hostState?.players?.[playerId];
  if (player) {
    player.lastInputSeq = 0;
    player.inputStream = inputStreamSnapshot(stats, atMs);
  }

  refreshInputStreamAges(app, atMs);
  return { reset: true, playerId, input: app.hostInputs[playerId], stats, player: !!player };
}

export function createHostRuntime(app, { session, upgrades } = {}) {
  let clientRuntime = null;
  let fixedStepAccumulator = 0;
  let lastThrottleWarnAt = 0;

  function wire({ client } = {}) {
    clientRuntime = client || clientRuntime;
  }

  function applyHostPlayerNames() {
    if (!app.hostState) return;
    for (const id of Object.keys(app.hostState.players)) {
      app.hostState.players[id].name = session.playerDisplayName(id);
    }
  }

  function syncLocalHostPlayer() {
    const me = app.hostState?.players?.[app.playerId];
    if (!me) return;
    app.localPose = me;
    app.localInventory = ensureInventory(me);
    app.localWeapon = getActiveWeaponId(me);
  }

  function ensureHostPlayers() {
    if (!app.hostState) return;
    const disconnected = app.disconnectedPlayers || {};
    for (const [index, id] of app.players.entries()) {
      if (!app.hostState.players[id]) addPlayer(app.hostState, id, index, { name: session.playerDisplayName(id) });
      const player = app.hostState.players[id];
      if (player) {
        const offline = !!disconnected[id];
        player.disconnected = offline;
        player.netStatus = offline ? "disconnected" : "online";
        if (offline) {
          player.disconnectedAt = player.disconnectedAt || Date.now();
          app.hostInputs[id] = emptyInput();
        } else {
          player.disconnectedAt = 0;
        }
      }
    }
    applyHostPlayerNames();
    for (const id of Object.keys(app.hostState.players)) {
      if (!app.players.includes(id) && !disconnected[id]) removePlayer(app.hostState, id);
    }
  }

  function applyWeaponRequest(id, request = {}) {
    const player = app.hostState?.players[id];
    if (!player) return false;
    if (Number.isInteger(request.slot)) return switchWeaponSlot(player, request.slot);
    if (Number.isFinite(request.dir)) return cycleWeapon(player, request.dir > 0 ? 1 : -1);
    return false;
  }

  function applyUpgradeRequest(id, request = {}) {
    if (!app.hostState) return false;
    const player = app.hostState.players[id];
    if (!player) return false;
    const currentKey = upgrades.choicesKey(player.upgrades?.choices, player.upgrades?.offerSeq);
    if (request.key && request.key !== currentKey) return false;
    return chooseUpgrade(app.hostState, id, request.index);
  }

  function applyAbilityRequest(id, request = {}) {
    if (!app.hostState || request.ability !== "dash") return false;
    const inputState = request.input && typeof request.input === "object" ? normalizeHostInput(request.input) : (app.hostInputs[id] || emptyInput());
    const result = performDash(app.hostState, id, inputState, { seq: request.seq });
    return !!result.ok;
  }

  function applyInteractRequest(id, request = {}) {
    if (!app.hostState) return false;
    return requestInteractableActivation(app.hostState, id, request);
  }

  function applyCasinoSpinRequest(id, request = {}) {
    if (!app.hostState) return { ok: false, reason: "no_host_state" };
    const result = casinoSpinResultSnapshot(requestCasinoSpin(app.hostState, id, request));
    if (id && id !== app.playerId) app.transport?.sendTo(id, { t: "casinoResult", result }, { channel: "cmd" });
    return result;
  }

  function remotePlayerIds() {
    return app.players.filter((id) => id && id !== app.playerId);
  }

  function snapshotModeForPeer(peerId) {
    return app.transport?.getPeerTransportMode?.(peerId) === "P2P" ? "p2p" : "relay";
  }

  function snapshotIntervalForMode(mode) {
    return 1000 / (mode === "p2p" ? SNAPSHOT_RATE_P2P : SNAPSHOT_RATE_RELAY);
  }

  function statePacketForPeer(cache, peerId, mode) {
    const cacheKey = `${mode}:${peerId || "all"}`;
    if (cache[cacheKey]) return cache[cacheKey];
    const options = mode === "relay"
      ? { mode: "relay", focusPlayerId: peerId, targetBytes: SNAPSHOT_RELAY_TARGET_BYTES, limitBytes: SNAPSHOT_RELAY_STATE_LIMIT_BYTES }
      : { mode: "p2p", focusPlayerId: peerId };
    cache[cacheKey] = buildNetworkStatePacket(app.snapshot, options);
    return cache[cacheKey];
  }

  function broadcastSnapshots(now) {
    const peers = remotePlayerIds();
    if (!peers.length) return;
    if (!app.lastSnapshotSentByPeer) app.lastSnapshotSentByPeer = Object.create(null);
    const packetCache = Object.create(null);
    const metaByPeer = {};

    for (const peerId of peers) {
      const mode = snapshotModeForPeer(peerId);
      const lastSent = app.lastSnapshotSentByPeer[peerId] || 0;
      if (now - lastSent < snapshotIntervalForMode(mode)) continue;
      const statePacket = statePacketForPeer(packetCache, peerId, mode);
      const sendMode = app.transport?.sendTo(peerId, statePacket.packet, {
        channel: "state",
        preferRelay: mode === "relay",
        relayFallback: mode === "relay"
      });
      app.lastSnapshotSentByPeer[peerId] = now;
      metaByPeer[peerId] = { ...statePacket.meta, requestedMode: mode, sentMode: sendMode || "none" };
    }

    if (Object.keys(metaByPeer).length) {
      app.lastSnapshotPacket = Object.values(metaByPeer).at(-1);
      app.lastSnapshotPackets = metaByPeer;
    }
  }

  function sampleHostInput() {
    const inputState = app.input.sample(app.localPose || app.hostState.players[app.playerId], app.camera);
    app.inputSeq = (app.inputSeq || 0) + 1;
    app.hostInputs[app.playerId] = { ...inputState, inputSeq: app.inputSeq };
    return inputState;
  }

  function syncHostFrameState(inputState, gameNow) {
    const me = app.hostState.players[app.playerId];
    app.localPose = me;
    app.localInventory = ensureInventory(me);
    upgrades.syncFromHost(me.upgrades?.choices, me.upgrades?.offers, me.upgrades?.offerSeq);
    app.localWeapon = getActiveWeaponId(me);
    clientRuntime?.tryLocalShoot(gameNow, inputState);
    app.snapshot = makeSnapshot(app.hostState);

    const nextLocationId = app.snapshot.location?.id || null;
    if (nextLocationId && app.localLocationId && nextLocationId !== app.localLocationId) {
      app.localLocationId = nextLocationId;
      fixedStepAccumulator = 0;
      clientRuntime?.resetPredictionForLocationChange();
    } else if (nextLocationId && !app.localLocationId) {
      app.localLocationId = nextLocationId;
    }
  }

  function writeHostSimStats({ frameRealDt, accumulatedGameDt, steps, droppedSteps }) {
    const frameMs = Math.round(frameRealDt * 1000);
    const throttle = frameMs >= HOST_SIM_THROTTLE_WARN_MS || droppedSteps > 0;
    app.hostSim = {
      mode: "fixed-step",
      stepMs: Math.round(HOST_SIM_FIXED_DT * 1000),
      accumulatorMs: Math.round(fixedStepAccumulator * 1000),
      accumulatedMs: Math.round(accumulatedGameDt * 1000),
      steps,
      droppedSteps,
      frameMs,
      throttle
    };
    if (throttle && performance.now() - lastThrottleWarnAt > 2000) {
      lastThrottleWarnAt = performance.now();
      console.warn("Host simulation catch-up limited", app.hostSim);
    }
  }

  function handleNetData(msg, from) {
    if (msg.t === "leave" && from) {
      session.dropRemotePlayer(from);
      return true;
    }
    if (from) session.markRemotePlayerConnected?.(from);
    if (msg.t === "input" && from) {
      acceptMonotonicHostInput(app, from, msg.input);
      return true;
    }
    if (msg.t === "shoot" && from) {
      const player = app.hostState?.players[from];
      if (player && msg.shoot && msg.shoot.fireSeq > player.fireSeqSeen) {
        player.fireSeqSeen = msg.shoot.fireSeq;
        fireWeapon(app.hostState, from, msg.shoot);
      }
      return true;
    }
    if (msg.t === "weapon" && from) {
      applyWeaponRequest(from, msg);
      return true;
    }
    if (msg.t === "upgrade" && from) {
      applyUpgradeRequest(from, msg);
      return true;
    }
    if (msg.t === "ability" && from) {
      applyAbilityRequest(from, msg);
      return true;
    }
    if (msg.t === "interact" && from) {
      applyInteractRequest(from, msg);
      return true;
    }
    if (msg.t === "casinoSpin" && from) {
      applyCasinoSpinRequest(from, msg);
      return true;
    }
    return false;
  }

  function update(frameRealDt, now, gameNow) {
    ensureHostPlayers();
    const inputState = sampleHostInput();
    const safeFrameRealDt = Math.min(HOST_SIM_MAX_FRAME_SECONDS, Math.max(0, Number.isFinite(frameRealDt) ? frameRealDt : 0));
    const accumulatedGameDt = safeFrameRealDt * GAME_SPEED;
    fixedStepAccumulator += accumulatedGameDt;

    let steps = 0;
    while (fixedStepAccumulator >= HOST_SIM_FIXED_DT && steps < HOST_SIM_MAX_CATCHUP_STEPS) {
      updateHostWorld(app.hostState, app.hostInputs, HOST_SIM_FIXED_DT);
      fixedStepAccumulator -= HOST_SIM_FIXED_DT;
      steps += 1;
    }

    let droppedSteps = 0;
    if (fixedStepAccumulator >= HOST_SIM_FIXED_DT) {
      droppedSteps = Math.floor(fixedStepAccumulator / HOST_SIM_FIXED_DT);
      fixedStepAccumulator = fixedStepAccumulator % HOST_SIM_FIXED_DT;
    }

    refreshInputStreamAges(app);
    syncHostFrameState(inputState, gameNow);
    writeHostSimStats({ frameRealDt, accumulatedGameDt, steps, droppedSteps });
    broadcastSnapshots(now);
  }

  return {
    wire,
    applyHostPlayerNames,
    syncLocalHostPlayer,
    ensureHostPlayers,
    applyWeaponRequest,
    applyUpgradeRequest,
    applyAbilityRequest,
    applyInteractRequest,
    applyCasinoSpinRequest,
    resetRemoteInputStream: (id) => resetRemoteInputStream(app, id),
    handleNetData,
    update
  };
}
