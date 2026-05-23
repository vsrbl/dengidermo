import { isValidRoomId, normalizeRoomId, randomRoomId } from "../ui.js";
import { normalizePlayerName } from "../core/names.js";
import { CONNECT_TIMEOUT_MS } from "../core/constants.js";
import { START_WEAPON } from "../data/weapons.js";
import { createInventory } from "../game/inventory.js";
import { addPlayer, createGameState, makeSnapshot, removePlayer, spawnPoint } from "../game/state.js";
import { emptyInput } from "../game/simulation.js";
import { Transport } from "../net/transport.js";

export function createSessionRuntime(app, { signalingUrl, devConfig, onNetData } = {}) {
  let hostRuntime = null;
  let upgradeClient = null;

  function wire({ host, upgrades } = {}) {
    hostRuntime = host || hostRuntime;
    upgradeClient = upgrades || upgradeClient;
  }

  function makeTransport() {
    return new Transport(signalingUrl, {
      onReady: handleReady,
      onPlayers: (list, names) => {
        app.players = Array.isArray(list) ? list.slice(0, 4) : [];
        setPlayerNames(names);
      },
      onPlayerLeft: handlePlayerLeft,
      onPlayerReplaced: handlePlayerReplaced,
      onData: (msg, from, mode) => onNetData?.(msg, from, mode),
      onPing: (ms) => { app.pingMs = ms; },
      onPeerState: (_id, state) => { if (state === "open") app.transportMode = "P2P"; },
      onError: (message) => handleConnectError(message),
      onClose: () => handleTransportClose()
    });
  }

  function setConnecting(value) {
    app.connecting = value;
    app.ui.el.createBtn.disabled = value;
    app.ui.el.joinBtn.disabled = value;
    if (value) app.ui.setMenuStatus?.("connecting", "info");
    if (!value) {
      window.clearTimeout(app.connectTimer);
      app.connectTimer = 0;
      app.ui.setMenuStatus?.("", "info");
    }
  }

  function armConnectTimeout() {
    window.clearTimeout(app.connectTimer);
    app.connectTimer = window.setTimeout(() => {
      if (!app.connecting || app.running) return;
      app.transport?.close(false);
      app.transport = null;
      setConnecting(false);
      app.ui.flashError("connection timeout");
    }, CONNECT_TIMEOUT_MS);
  }

  function beginConnect(nextTransport) {
    app.transport?.close(false);
    app.transport = nextTransport;
    setConnecting(true);
    armConnectTimeout();
  }

  function handleConnectError(message = "error") {
    if (!app.running) {
      app.transport?.close(false);
      app.transport = null;
      setConnecting(false);
      app.ui.flashError(message);
      return;
    }
    app.ui.flashError(message);
  }

  function handleTransportClose() {
    if (app.connecting && !app.running) {
      setConnecting(false);
      app.ui.flashError("connection closed");
      return;
    }
    if (app.running) app.ui.setNet({ pingMs: app.pingMs, role: app.role, playerId: app.playerId, players: app.players, playerNames: app.playerNames, transportMode: "OFF", release: app.release });
  }

  function currentMenuName() {
    const name = normalizePlayerName(app.ui.el.nameInput.value);
    app.ui.el.nameInput.value = name;
    if (name) localStorage.setItem("nncckkrr.name", name);
    return name;
  }

  function setPlayerNames(names = {}) {
    app.playerNames = names && typeof names === "object" ? { ...names } : {};
  }

  function playerDisplayName(id) {
    return app.playerNames[id] || id?.toUpperCase?.() || "PLAYER";
  }

  function bindWindowLifecycle() {
    const closeActiveTransport = () => {
      if (!app.running && !app.connecting) return;
      app.transport?.close(true);
    };
    window.addEventListener("pagehide", closeActiveTransport);
    window.addEventListener("beforeunload", closeActiveTransport);
  }

  function bindMenu() {
    bindWindowLifecycle();
    const savedName = normalizePlayerName(localStorage.getItem("nncckkrr.name") || "");
    if (savedName) app.ui.el.nameInput.value = savedName;
    app.ui.el.nameInput.addEventListener("input", () => {
      app.ui.el.nameInput.value = normalizePlayerName(app.ui.el.nameInput.value);
      localStorage.setItem("nncckkrr.name", app.ui.el.nameInput.value);
    });
    app.ui.el.roomInput.addEventListener("input", () => {
      app.ui.el.roomInput.value = normalizeRoomId(app.ui.el.roomInput.value);
    });
    app.ui.el.createBtn.addEventListener("click", () => startHost());
    app.ui.el.joinBtn.addEventListener("click", () => startGuest());
    app.ui.el.roomInput.addEventListener("keydown", (e) => {
      if (e.code === "Enter") startGuest();
    });
  }

  function canStartConnection() {
    if (app.release?.blockConnection) {
      app.ui.flashError(app.release.message || "server mismatch");
      return false;
    }
    return true;
  }

  function startHost() {
    if (app.connecting || app.running) return;
    if (!canStartConnection()) return;
    const id = randomRoomId();
    const name = currentMenuName();
    app.ui.el.roomInput.value = id;
    const next = makeTransport();
    beginConnect(next);
    next.connectHost(id, { name });
  }

  function startGuest() {
    if (app.connecting || app.running) return;
    if (!canStartConnection()) return;
    const id = normalizeRoomId(app.ui.el.roomInput.value);
    app.ui.el.roomInput.value = id;
    if (!isValidRoomId(id)) {
      app.ui.flashError("bad room");
      return;
    }
    const name = currentMenuName();
    const next = makeTransport();
    beginConnect(next);
    next.connectGuest(id, { name });
  }

  function resetRunIdentity(info) {
    app.running = true;
    app.role = info.role;
    app.roomId = info.roomId;
    app.playerId = info.playerId;
    app.players = Array.isArray(info.players) ? info.players.slice(0, 4) : [info.playerId];
    setPlayerNames(info.names);
    app.playerName = playerDisplayName(app.playerId);
    app.lastSnapshotTick = -1;
    app.lastInputSent = 0;
    app.lastSnapshotSent = 0;
    app.transportMode = "RELAY";
    app.pingMs = null;
    app.predictedProjectiles = [];
    app.localCooldowns = Object.create(null);
    app.localLocationId = null;
    app.fireSeq = 0;
    app.abilitySeq = 0;
    app.localWeapon = START_WEAPON;
    app.localInventory = createInventory([START_WEAPON]);
    upgradeClient?.reset();
    app.camera.ready = false;
    app.input.resetKeys();
  }

  function handleReady(info) {
    setConnecting(false);
    resetRunIdentity(info);

    if (app.role === "host") {
      app.hostState = createGameState(app.roomId, { dev: devConfig?.enabled ? devConfig : null });
      addPlayer(app.hostState, app.playerId, 0, { name: app.playerName });
      app.hostInputs[app.playerId] = emptyInput();
      hostRuntime?.syncLocalHostPlayer();
      app.snapshot = makeSnapshot(app.hostState);
      app.localLocationId = app.snapshot.location?.id || null;
    } else {
      app.hostState = null;
      app.snapshot = null;
      const index = Math.max(0, app.players.indexOf(app.playerId));
      const p = spawnPoint(index);
      app.localInventory = createInventory([START_WEAPON]);
      app.localPose = { id: app.playerId, name: app.playerName, x: p.x, y: p.y, vx: 0, vy: 0, kx: 0, ky: 0, angle: 0, radius: 13, hp: 100, maxHp: 100, activeWeapon: START_WEAPON, inventory: app.localInventory, upgrades: { choices: [] }, stats: {}, ability: null, skin: index % 2 ? "green" : "default" };
    }

    app.ui.showGame(app.roomId);
    app.ui.setNet({ pingMs: app.pingMs, role: app.role, playerId: app.playerId, players: app.players, playerNames: app.playerNames, transportMode: app.transportMode, dev: app.snapshot?.dev || (app.role === "host" ? makeSnapshot(app.hostState)?.dev : null), release: app.release });
  }

  function dropRemotePlayer(id) {
    if (!id || id === app.playerId) return;
    app.players = app.players.filter((player) => player !== id);
    delete app.playerNames[id];
    if (app.hostState) removePlayer(app.hostState, id);
    delete app.hostInputs[id];
  }

  function handlePlayerLeft(id) {
    if (app.role === "guest" && id === "p1") {
      leaveGame();
      app.ui.flashError();
      return;
    }
    dropRemotePlayer(id);
  }

  function handlePlayerReplaced(id) {
    if (app.role !== "host") return;
    dropRemotePlayer(id);
  }

  function leaveGame() {
    if (!app.running) {
      if (app.connecting) {
        app.transport?.close(false);
        app.transport = null;
        setConnecting(false);
      }
      return;
    }
    app.running = false;
    app.role = "none";
    app.roomId = null;
    app.playerId = null;
    app.players = [];
    app.playerNames = {};
    app.playerName = "";
    app.snapshot = null;
    app.hostState = null;
    app.hostInputs = Object.create(null);
    app.localPose = null;
    app.predictedProjectiles = [];
    app.localInventory = createInventory([START_WEAPON]);
    upgradeClient?.reset();
    app.localCooldowns = Object.create(null);
    app.localLocationId = null;
    app.abilitySeq = 0;
    app.input.resetKeys();
    app.transport?.close(true);
    app.transport = null;
    app.ui.showMenu();
  }

  return {
    wire,
    bindMenu,
    startHost,
    startGuest,
    leaveGame,
    dropRemotePlayer,
    playerDisplayName,
    setPlayerNames,
    currentMenuName,
    setConnecting,
    handleConnectError,
    handleTransportClose
  };
}
