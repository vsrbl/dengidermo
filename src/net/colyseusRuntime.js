import { VERSION } from "../core/constants.js";
import { START_WEAPON } from "../data/weapons.js";
import { createInventory } from "../game/inventory.js";
import { connectColyseusArena, initialColyseusClientState, sendColyseusInput } from "./colyseusClient.js";

const DEFAULT_ROOM = "nn_arena";
const INPUT_SEND_MS = 1000 / 60;
const ARENA_WIDTH = 1600;
const ARENA_HEIGHT = 900;
const PLAYER_SPEED = 280;
const PLAYER_RADIUS = 13;
const LOCAL_RECONCILE_SNAP_PX = 96;
const LOCAL_RECONCILE_BLEND = 0.18;

function normalizeEndpoint(endpoint) {
  return String(endpoint || window.NN_COLYSEUS_URL || window.NN_SIGNALING_URL || "").replace(/\/$/, "");
}

function normalizeName(raw) {
  return String(raw || "PLAYER").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 12) || "PLAYER";
}

function mapEntries(mapLike) {
  if (!mapLike) return [];
  if (typeof mapLike.entries === "function") return Array.from(mapLike.entries());
  return Object.entries(mapLike);
}

function readNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildServerSnapshot(roomState, localPlayerId = "", options = {}) {
  const localPoseOverride = options.localPoseOverride || null;
  const players = mapEntries(roomState?.players).map(([id, p]) => {
    const localOverride = id === localPlayerId ? localPoseOverride : null;
    return ({
    id,
    name: p.name || id,
    x: readNumber(localOverride?.x, readNumber(p.x)),
    y: readNumber(localOverride?.y, readNumber(p.y)),
    vx: readNumber(localOverride?.vx, 0),
    vy: readNumber(localOverride?.vy, 0),
    hp: readNumber(p.hp, 100),
    maxHp: readNumber(p.maxHp, 100),
    angle: readNumber(localOverride?.angle, readNumber(p.angle, 0)),
    online: p.online !== false,
    activeWeapon: START_WEAPON,
    inventory: createInventory([START_WEAPON]),
    economy: { money: 0, xp: 0, level: 1, nextLevelXp: 24, pendingUpgradeCount: 0 },
    stats: {},
    ability: null,
    skin: id === localPlayerId ? "green" : "white",
    inputStream: {
      lastAcceptedSeq: readNumber(p.lastInputSeq, 0),
      inputAgeMs: 0,
      staleDrops: 0
    }
    });
  });

  const enemies = mapEntries(roomState?.enemies).map(([id, e]) => ({
    id,
    kind: "grunt",
    x: readNumber(e.x),
    y: readNumber(e.y),
    hp: readNumber(e.hp, 40),
    maxHp: 40,
    radius: 18,
    armor: null,
    elite: null,
    status: {}
  }));

  const projectiles = mapEntries(roomState?.projectiles).map(([id, p]) => ({
    id,
    kind: "bullet",
    x: readNumber(p.x),
    y: readNumber(p.y),
    vx: readNumber(p.vx),
    vy: readNumber(p.vy),
    ownerId: p.ownerId || "",
    radius: 5
  }));

  return {
    authority: "server",
    netMode: "colyseus",
    tick: readNumber(roomState?.tick, 0),
    time: readNumber(roomState?.timeMs, 0) / 1000,
    players,
    enemies,
    projectiles,
    loot: [],
    rewardPickups: [],
    economyPickups: [],
    interactables: [],
    portals: [],
    companions: [],
    effects: [],
    events: [],
    location: {
      id: "server-arena",
      name: "SERVER ARENA",
      accent: "green",
      loopIndex: 0,
      runDepth: 0,
      geometry: { w: 1600, h: 900, walls: [] }
    },
    dev: { enabled: true, calm: false, spawnsPaused: false, god: false, flash: "SERVER MODE" }
  };
}

function findLocalPlayerId(room, state) {
  if (state.playerId) return state.playerId;
  const sessionId = room?.sessionId || "";
  if (!sessionId) return "";
  for (const [id, p] of mapEntries(room?.state?.players)) {
    if (p?.sessionId === sessionId) return id;
  }
  return "";
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizedMove(sampled = {}) {
  const dx = (sampled.right ? 1 : 0) - (sampled.left ? 1 : 0);
  const dy = (sampled.down ? 1 : 0) - (sampled.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len <= 0.0001) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

function angleFromAim(sampled, pose) {
  const ax = Number(sampled?.aimX);
  const ay = Number(sampled?.aimY);
  if (Number.isFinite(ax) && Number.isFinite(ay) && pose) {
    return Math.atan2(ay - pose.y, ax - pose.x);
  }
  return readNumber(pose?.angle, 0);
}

function copyServerPose(player) {
  if (!player) return null;
  return {
    id: player.id,
    x: readNumber(player.x),
    y: readNumber(player.y),
    vx: 0,
    vy: 0,
    hp: readNumber(player.hp, 100),
    maxHp: readNumber(player.maxHp, 100),
    angle: readNumber(player.angle, 0),
    radius: PLAYER_RADIUS
  };
}

function reconcileLocalPrediction(predicted, serverPose) {
  if (!serverPose) return predicted;
  if (!predicted) return { ...serverPose };
  const dx = serverPose.x - predicted.x;
  const dy = serverPose.y - predicted.y;
  const drift = Math.hypot(dx, dy);
  if (drift > LOCAL_RECONCILE_SNAP_PX) {
    return { ...serverPose, serverDriftPx: drift, serverSnap: true };
  }
  return {
    ...predicted,
    x: predicted.x + dx * LOCAL_RECONCILE_BLEND,
    y: predicted.y + dy * LOCAL_RECONCILE_BLEND,
    hp: serverPose.hp,
    maxHp: serverPose.maxHp,
    serverDriftPx: drift,
    serverSnap: false
  };
}

function predictLocalPose(predicted, sampled, dtSeconds) {
  if (!predicted) return predicted;
  const move = normalizedMove(sampled);
  const vx = move.x * PLAYER_SPEED;
  const vy = move.y * PLAYER_SPEED;
  const next = {
    ...predicted,
    vx,
    vy,
    x: clamp(predicted.x + vx * dtSeconds, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS),
    y: clamp(predicted.y + vy * dtSeconds, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS)
  };
  next.angle = angleFromAim(sampled, next);
  return next;
}

function resetForServerMode(app, state) {
  app.running = true;
  app.role = "server";
  app.netMode = "colyseus";
  app.roomId = state.roomId || "SERVER";
  app.playerId = state.playerId || "";
  app.playerName = app.playerId || "SERVER";
  app.players = app.playerId ? [app.playerId] : [];
  app.playerNames = {};
  app.transportMode = "SERVER";
  app.transportModes = {};
  app.pingMs = null;
  app.peerPingMs = {};
  app.hostState = null;
  app.hostInputs = Object.create(null);
  app.inputStreamStats = Object.create(null);
  app.inputStreamSummary = null;
  app.localWeapon = START_WEAPON;
  app.localInventory = createInventory([START_WEAPON]);
  app.localUpgradeChoices = [];
  app.localUpgradeOffers = {};
  app.localUpgradeOfferSeq = 0;
  app.upgradePickPending = false;
  app.predictedProjectiles = [];
  app.localCooldowns = Object.create(null);
  app.inputSeq = 0;
  app.lastAckedInputSeq = 0;
  app.predictionFrames = [];
  app.reconcileStats = { mode: "server-authoritative", localSeq: 0, ackedSeq: 0, pendingInputs: 0, replayed: 0, driftPx: 0 };
  app.localPose = null;
  app.localRenderPose = null;
  app.localCorrectionOffset = { x: 0, y: 0, angle: 0, reason: "server_mode" };
  app.localVisualStats = { mode: "server-authoritative", strategy: "server-render", driftPx: 0, snap: true, reason: "server_mode", latency: "server" };
  app.hostSim = { mode: "server", accumulatorMs: 0, steps: 0, droppedSteps: 0, frameMs: 0, throttle: false };
  app.camera.ready = false;
  app.input?.resetKeys?.();
  app.ui.showGame("SERVER");
}

export function createColyseusRuntime(app, { endpoint } = {}) {
  const runtime = {
    client: null,
    room: null,
    state: initialColyseusClientState(endpoint),
    connecting: false,
    lastInputSentAt: 0,
    lastUpdateAt: 0,
    predictedLocalPose: null
  };
  runtime.state.endpoint = normalizeEndpoint(endpoint);

  function setStatus(message, kind = "info") {
    app.ui.setMenuStatus?.(message, kind);
  }

  async function start() {
    if (runtime.connecting || app.running) return;
    if (app.transport) {
      app.transport.close(false);
      app.transport = null;
    }
    runtime.connecting = true;
    if (app.ui.el.serverBtn) app.ui.el.serverBtn.disabled = true;
    if (app.ui.el.createBtn) app.ui.el.createBtn.disabled = true;
    if (app.ui.el.joinBtn) app.ui.el.joinBtn.disabled = true;
    setStatus("server connecting", "info");

    try {
      const name = normalizeName(app.ui.el.nameInput?.value || localStorage.getItem("nncckkrr.name") || "PLAYER");
      if (app.ui.el.nameInput) app.ui.el.nameInput.value = name;
      try { localStorage.setItem("nncckkrr.name", name); } catch {}
      const connected = await connectColyseusArena({
        endpoint: runtime.state.endpoint,
        roomName: DEFAULT_ROOM,
        name
      });
      runtime.client = connected.client;
      runtime.room = connected.room;
      runtime.state = connected.state;
      runtime.state.status = "joined";
      runtime.state.enabled = true;
      runtime.state.endpoint = normalizeEndpoint(runtime.state.endpoint || endpoint);
      resetForServerMode(app, runtime.state);
      runtime.lastUpdateAt = 0;
      runtime.predictedLocalPose = null;
      setStatus("", "info");
    } catch (err) {
      runtime.state.status = "error";
      runtime.state.error = err?.message || String(err);
      app.ui.flashError(runtime.state.error || "server failed");
    } finally {
      runtime.connecting = false;
      if (!app.running) {
        if (app.ui.el.serverBtn) app.ui.el.serverBtn.disabled = false;
        if (app.ui.el.createBtn) app.ui.el.createBtn.disabled = false;
        if (app.ui.el.joinBtn) app.ui.el.joinBtn.disabled = false;
      }
    }
  }

  function bindMenu() {
    if (!app.ui.el.serverBtn) return;
    app.ui.el.serverBtn.addEventListener("click", () => start());
  }

  function leave() {
    try { runtime.room?.leave?.(); } catch {}
    runtime.client = null;
    runtime.room = null;
    runtime.state = initialColyseusClientState(runtime.state.endpoint || endpoint);
    app.running = false;
    app.role = "none";
    app.netMode = "legacy";
    app.snapshot = null;
    app.localPose = null;
    app.ui.showMenu();
  }

  function update(now) {
    const room = runtime.room;
    if (!room || !app.running || app.role !== "server") return;
    runtime.state.playerId = findLocalPlayerId(room, runtime.state);
    runtime.state.roomId = room.id || runtime.state.roomId;
    app.playerId = runtime.state.playerId || app.playerId;
    app.roomId = runtime.state.roomId || app.roomId || "SERVER";

    const serverSnapshot = buildServerSnapshot(room.state, app.playerId);
    const serverMe = serverSnapshot.players.find((p) => p.id === app.playerId) || serverSnapshot.players[0] || null;
    if (serverMe) app.playerId = serverMe.id;

    const dtSeconds = runtime.lastUpdateAt > 0 ? Math.min(0.05, Math.max(0, (now - runtime.lastUpdateAt) / 1000)) : 0;
    runtime.lastUpdateAt = now;

    runtime.predictedLocalPose = reconcileLocalPrediction(runtime.predictedLocalPose, copyServerPose(serverMe));
    const samplePose = runtime.predictedLocalPose || serverMe;
    const sampled = samplePose ? app.input.sample(samplePose, app.camera) : null;
    if (sampled) runtime.predictedLocalPose = predictLocalPose(runtime.predictedLocalPose, sampled, dtSeconds);

    const visualMe = runtime.predictedLocalPose || serverMe;
    const snapshot = buildServerSnapshot(room.state, app.playerId, { localPoseOverride: visualMe });
    app.snapshot = snapshot;
    app.players = snapshot.players.map((p) => p.id);
    app.playerNames = Object.fromEntries(snapshot.players.map((p) => [p.id, p.name || p.id]));
    const me = snapshot.players.find((p) => p.id === app.playerId) || snapshot.players[0] || null;
    if (me) {
      app.localPose = { ...me, stats: {}, ability: null };
      app.localRenderPose = app.localPose;
      app.playerId = me.id;
    }

    if (Number.isFinite(runtime.state.lastAckSeq)) app.lastAckedInputSeq = runtime.state.lastAckSeq;
    const driftPx = readNumber(runtime.predictedLocalPose?.serverDriftPx, 0);
    app.reconcileStats = {
      mode: "server-authoritative-local-prediction",
      localSeq: app.inputSeq,
      ackedSeq: app.lastAckedInputSeq,
      pendingInputs: Math.max(0, app.inputSeq - app.lastAckedInputSeq),
      replayed: 0,
      driftPx
    };
    app.localVisualStats = {
      mode: "server-authoritative",
      strategy: "local-prediction-corrected",
      driftPx,
      snap: !!runtime.predictedLocalPose?.serverSnap,
      reason: "server_mode_prediction",
      latency: "zero-local-render"
    };

    if (!me || !sampled || now - runtime.lastInputSentAt < INPUT_SEND_MS) return;
    const aimX = Number.isFinite(sampled.aimX) ? sampled.aimX - me.x : Math.cos(me.angle || 0);
    const aimY = Number.isFinite(sampled.aimY) ? sampled.aimY - me.y : Math.sin(me.angle || 0);
    const input = {
      seq: ++app.inputSeq,
      left: !!sampled.left,
      right: !!sampled.right,
      up: !!sampled.up,
      down: !!sampled.down,
      shoot: !!sampled.fire || !!sampled.firePressed,
      aimX,
      aimY
    };
    if (sendColyseusInput(room, input)) runtime.lastInputSentAt = now;
  }

  return { bindMenu, start, leave, update, state: runtime.state };
}

export { buildServerSnapshot };
