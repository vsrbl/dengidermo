import { SNAPSHOT_RATE_P2P, SNAPSHOT_RATE_RELAY, SNAPSHOT_RELAY_STATE_LIMIT_BYTES, SNAPSHOT_RELAY_TARGET_BYTES } from "../core/constants.js";
import { addPlayer, makeSnapshot, removePlayer } from "../game/state.js";
import { fireWeapon } from "../game/combat.js";
import { emptyInput, normalizeHostInput, updateHostWorld } from "../game/simulation.js";
import { cycleWeapon, ensureInventory, getActiveWeaponId, switchWeaponSlot } from "../game/inventory.js";
import { chooseUpgrade } from "../game/upgrades.js";
import { performDash } from "../game/abilities.js";
import { requestInteractableActivation } from "../game/interactables.js";
import { requestCasinoSpin, casinoSpinResultSnapshot } from "../game/casino.js";
import { buildNetworkStatePacket } from "../game/snapshotBudget.js";

export function createHostRuntime(app, { session, upgrades } = {}) {
  let clientRuntime = null;

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

  function statePacketForMode(cache, mode) {
    if (cache[mode]) return cache[mode];
    const options = mode === "relay"
      ? { mode: "relay", targetBytes: SNAPSHOT_RELAY_TARGET_BYTES, limitBytes: SNAPSHOT_RELAY_STATE_LIMIT_BYTES }
      : { mode: "p2p" };
    cache[mode] = buildNetworkStatePacket(app.snapshot, options);
    return cache[mode];
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
      const statePacket = statePacketForMode(packetCache, mode);
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

  function handleNetData(msg, from) {
    if (msg.t === "leave" && from) {
      session.dropRemotePlayer(from);
      return true;
    }
    if (from) session.markRemotePlayerConnected?.(from);
    if (msg.t === "input" && from) {
      app.hostInputs[from] = normalizeHostInput(msg.input);
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

  function update(dt, now, gameNow) {
    ensureHostPlayers();
    const inputState = app.input.sample(app.localPose || app.hostState.players[app.playerId], app.camera);
    const me = app.hostState.players[app.playerId];
    app.inputSeq = (app.inputSeq || 0) + 1;
    app.hostInputs[app.playerId] = { ...inputState, inputSeq: app.inputSeq };
    updateHostWorld(app.hostState, app.hostInputs, dt);
    app.localPose = me;
    app.localInventory = ensureInventory(me);
    upgrades.syncFromHost(me.upgrades?.choices, me.upgrades?.offers, me.upgrades?.offerSeq);
    app.localWeapon = getActiveWeaponId(me);
    clientRuntime?.tryLocalShoot(gameNow, inputState);
    app.snapshot = makeSnapshot(app.hostState);

    const nextLocationId = app.snapshot.location?.id || null;
    if (nextLocationId && app.localLocationId && nextLocationId !== app.localLocationId) {
      app.localLocationId = nextLocationId;
      clientRuntime?.resetPredictionForLocationChange();
    } else if (nextLocationId && !app.localLocationId) {
      app.localLocationId = nextLocationId;
    }

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
    handleNetData,
    update
  };
}
