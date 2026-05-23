import { SNAPSHOT_RATE } from "../core/constants.js";
import { addPlayer, makeSnapshot, removePlayer } from "../game/state.js";
import { fireWeapon } from "../game/combat.js";
import { emptyInput, updateHostWorld } from "../game/simulation.js";
import { cycleWeapon, ensureInventory, getActiveWeaponId, switchWeaponSlot } from "../game/inventory.js";
import { chooseUpgrade } from "../game/upgrades.js";
import { performDash } from "../game/abilities.js";
import { requestInteractableActivation } from "../game/interactables.js";
import { requestCasinoSpin, casinoSpinResultSnapshot } from "../game/casino.js";

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
    for (const [index, id] of app.players.entries()) {
      if (!app.hostState.players[id]) addPlayer(app.hostState, id, index, { name: session.playerDisplayName(id) });
    }
    applyHostPlayerNames();
    for (const id of Object.keys(app.hostState.players)) {
      if (!app.players.includes(id)) removePlayer(app.hostState, id);
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
    const inputState = request.input && typeof request.input === "object" ? request.input : (app.hostInputs[id] || emptyInput());
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
    if (id && id !== app.playerId) app.transport?.sendTo(id, { t: "casinoResult", result });
    return result;
  }

  function handleNetData(msg, from) {
    if (msg.t === "leave" && from) {
      session.dropRemotePlayer(from);
      return true;
    }
    if (msg.t === "input" && from) {
      app.hostInputs[from] = msg.input || emptyInput();
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
    app.localPose = me;
    inputState.px = Math.round(me.x);
    inputState.py = Math.round(me.y);
    app.hostInputs[app.playerId] = inputState;
    app.localInventory = ensureInventory(me);
    upgrades.syncFromHost(me.upgrades?.choices, me.upgrades?.offers, me.upgrades?.offerSeq);
    app.localWeapon = getActiveWeaponId(me);
    clientRuntime?.tryLocalShoot(gameNow, inputState);
    updateHostWorld(app.hostState, app.hostInputs, dt);
    app.snapshot = makeSnapshot(app.hostState);

    const nextLocationId = app.snapshot.location?.id || null;
    if (nextLocationId && app.localLocationId && nextLocationId !== app.localLocationId) {
      app.localLocationId = nextLocationId;
      clientRuntime?.resetPredictionForLocationChange();
    } else if (nextLocationId && !app.localLocationId) {
      app.localLocationId = nextLocationId;
    }

    if (now - app.lastSnapshotSent > 1000 / SNAPSHOT_RATE) {
      app.lastSnapshotSent = now;
      app.transport?.broadcast({ t: "state", snapshot: app.snapshot });
    }
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
