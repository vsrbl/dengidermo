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
const SERVER_PREDICTION_BUFFER_LIMIT = 180;
const REMOTE_INTERPOLATION_DELAY_MS = 110;
const REMOTE_INTERPOLATION_BUFFER_LIMIT = 36;
const COMPACT_COMBAT_SNAPSHOT_PROTOCOL = "compact-combat-snapshot-v1";

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

function isCompactCombatSnapshot(snapshot) {
  return !!(
    snapshot &&
    snapshot.protocol === COMPACT_COMBAT_SNAPSHOT_PROTOCOL &&
    Array.isArray(snapshot.enemies) &&
    Array.isArray(snapshot.projectiles)
  );
}

function compactEnemiesToEntities(snapshot) {
  if (!isCompactCombatSnapshot(snapshot)) return null;
  return snapshot.enemies.map((row) => ({
    id: String(row?.[0] ?? ''),
    kind: "grunt",
    x: readNumber(row?.[1], 0),
    y: readNumber(row?.[2], 0),
    hp: readNumber(row?.[3], 40),
    maxHp: 40,
    radius: readNumber(row?.[4], 18),
    armor: null,
    elite: null,
    status: {}
  })).filter((enemy) => enemy.id);
}

function compactProjectilesToEntities(snapshot) {
  if (!isCompactCombatSnapshot(snapshot)) return null;
  return snapshot.projectiles.map((row) => ({
    id: String(row?.[0] ?? ''),
    kind: "bullet",
    x: readNumber(row?.[1], 0),
    y: readNumber(row?.[2], 0),
    vx: readNumber(row?.[3], 0),
    vy: readNumber(row?.[4], 0),
    ownerId: String(row?.[5] || ''),
    radius: readNumber(row?.[6], 5)
  })).filter((projectile) => projectile.id);
}

function compactPickupsToEconomyPickups(snapshot) {
  if (!isCompactCombatSnapshot(snapshot) || !Array.isArray(snapshot.pickups)) return null;
  return snapshot.pickups.map((row) => ({
    id: String(row?.[0] ?? ''),
    x: readNumber(row?.[1], 0),
    y: readNumber(row?.[2], 0),
    type: String(row?.[3] || 'money'),
    amount: Math.max(1, Math.round(readNumber(row?.[4], 1))),
    radius: readNumber(row?.[5], 11),
    sourceId: String(row?.[6] || ''),
    spawnX: readNumber(row?.[7], readNumber(row?.[1], 0)),
    spawnY: readNumber(row?.[8], readNumber(row?.[2], 0)),
    claimable: true,
    sourceType: 'server-combat',
    revealProfile: 'basic'
  })).filter((pickup) => pickup.id);
}

function compactCombatDiagnostics(snapshot) {
  if (!isCompactCombatSnapshot(snapshot)) return {
    protocol: "schema-map-fallback",
    source: "schema-map",
    tick: 0,
    byteEstimate: 0,
    enemyCount: 0,
    projectileCount: 0
  };
  return {
    protocol: snapshot.protocol,
    source: "compact-message",
    tick: readNumber(snapshot.tick, 0),
    timeMs: readNumber(snapshot.timeMs, 0),
    byteEstimate: readNumber(snapshot.byteEstimate, 0),
    enemyCount: readNumber(snapshot.counts?.enemies, snapshot.enemies.length),
    projectileCount: readNumber(snapshot.counts?.projectiles, snapshot.projectiles.length),
    pickupCount: readNumber(snapshot.counts?.pickups, Array.isArray(snapshot.pickups) ? snapshot.pickups.length : 0),
    damageAuthority: snapshot.combat?.authority || "server-owned-combat-damage-v1",
    enemyHits: readNumber(snapshot.combat?.enemyHits, 0),
    enemyKills: readNumber(snapshot.combat?.enemyKills, 0),
    playerHits: readNumber(snapshot.combat?.playerHits, 0),
    pickupsSpawned: readNumber(snapshot.combat?.pickupsSpawned, 0)
  };
}

function buildServerSnapshot(roomState, localPlayerId = "", options = {}) {
  const localPoseOverride = options.localPoseOverride || null;
  const players = mapEntries(roomState?.players).map(([id, p]) => {
    const localOverride = id === localPlayerId ? localPoseOverride : null;
    const lastAcceptedSeq = readNumber(p.lastInputSeq, 0);
    const lastProcessedInputSeq = readNumber(p.lastProcessedInputSeq, 0);
    return ({
      id,
      name: p.name || id,
      x: readNumber(localOverride?.x, readNumber(p.x)),
      y: readNumber(localOverride?.y, readNumber(p.y)),
      vx: readNumber(localOverride?.vx, readNumber(p.vx, 0)),
      vy: readNumber(localOverride?.vy, readNumber(p.vy, 0)),
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
        lastAcceptedSeq,
        lastProcessedInputSeq,
        serverTick: readNumber(p.serverTick, readNumber(roomState?.tick, 0)),
        inputAgeMs: 0,
        staleDrops: 0
      }
    });
  });

  const compactCombat = isCompactCombatSnapshot(options.compactCombatSnapshot) ? options.compactCombatSnapshot : null;
  const enemies = compactEnemiesToEntities(compactCombat) || mapEntries(roomState?.enemies).map(([id, e]) => ({
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

  const projectiles = compactProjectilesToEntities(compactCombat) || mapEntries(roomState?.projectiles).map(([id, p]) => ({
    id,
    kind: "bullet",
    x: readNumber(p.x),
    y: readNumber(p.y),
    vx: readNumber(p.vx),
    vy: readNumber(p.vy),
    ownerId: p.ownerId || "",
    radius: 5
  }));
  const economyPickups = compactPickupsToEconomyPickups(compactCombat) || [];
  const combatDiagnostics = compactCombatDiagnostics(compactCombat);

  return {
    authority: "server",
    netMode: "colyseus",
    tick: readNumber(roomState?.tick, 0),
    time: readNumber(roomState?.timeMs, 0) / 1000,
    players,
    enemies,
    projectiles,
    combatSnapshot: combatDiagnostics,
    loot: [],
    rewardPickups: [],
    economyPickups,
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


function cloneEntity(entity) {
  return entity && typeof entity === "object" ? { ...entity } : entity;
}

function cloneSnapshot(snapshot) {
  if (!snapshot) return null;
  return {
    ...snapshot,
    players: Array.isArray(snapshot.players) ? snapshot.players.map(cloneEntity) : [],
    enemies: Array.isArray(snapshot.enemies) ? snapshot.enemies.map(cloneEntity) : [],
    projectiles: Array.isArray(snapshot.projectiles) ? snapshot.projectiles.map(cloneEntity) : [],
    loot: Array.isArray(snapshot.loot) ? snapshot.loot.map(cloneEntity) : [],
    rewardPickups: Array.isArray(snapshot.rewardPickups) ? snapshot.rewardPickups.map(cloneEntity) : [],
    economyPickups: Array.isArray(snapshot.economyPickups) ? snapshot.economyPickups.map(cloneEntity) : []
  };
}

function entityMap(list = []) {
  const out = new Map();
  for (const item of Array.isArray(list) ? list : []) {
    if (item?.id !== undefined && item?.id !== null) out.set(String(item.id), item);
  }
  return out;
}

function lerp(a, b, ratio) {
  return readNumber(a, readNumber(b, 0)) + (readNumber(b, readNumber(a, 0)) - readNumber(a, readNumber(b, 0))) * ratio;
}

function lerpAngle(a, b, ratio) {
  const from = readNumber(a, readNumber(b, 0));
  const to = readNumber(b, from);
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * ratio;
}

function interpolateEntity(before, after, ratio) {
  if (!before && !after) return null;
  if (!before) return cloneEntity(after);
  if (!after) return cloneEntity(before);
  const out = { ...after };
  for (const key of ["x", "y", "vx", "vy"]) {
    if (Number.isFinite(Number(before[key])) || Number.isFinite(Number(after[key]))) out[key] = lerp(before[key], after[key], ratio);
  }
  if (Number.isFinite(Number(before.angle)) || Number.isFinite(Number(after.angle))) out.angle = lerpAngle(before.angle, after.angle, ratio);
  return out;
}

function interpolateEntityList(beforeList = [], afterList = [], ratio = 1, options = {}) {
  const beforeById = entityMap(beforeList);
  const afterById = entityMap(afterList);
  const order = Array.isArray(afterList) && afterList.length ? afterList : beforeList;
  const out = [];
  for (const item of order) {
    const id = String(item?.id ?? "");
    if (!id) continue;
    if (options.localPlayerId && id === options.localPlayerId && options.localPoseOverride) {
      out.push({ ...item, ...options.localPoseOverride });
      continue;
    }
    out.push(interpolateEntity(beforeById.get(id), afterById.get(id), ratio));
  }
  return out.filter(Boolean);
}

function pushRemoteInterpolationFrame(buffer = [], snapshot = null, receivedAt = 0) {
  if (!snapshot) return Array.isArray(buffer) ? buffer : [];
  const frame = {
    tick: readNumber(snapshot.tick, 0),
    time: readNumber(snapshot.time, 0),
    receivedAt: readNumber(receivedAt, 0),
    snapshot: cloneSnapshot(snapshot)
  };
  const frames = Array.isArray(buffer) ? buffer.slice() : [];
  const last = frames[frames.length - 1];
  if (last && last.tick === frame.tick && last.time === frame.time) {
    frames[frames.length - 1] = frame;
  } else {
    frames.push(frame);
  }
  frames.sort((a, b) => readNumber(a.receivedAt, 0) - readNumber(b.receivedAt, 0));
  while (frames.length > REMOTE_INTERPOLATION_BUFFER_LIMIT) frames.shift();
  return frames;
}

function sampleRemoteInterpolation(buffer = [], renderAt = 0, localPlayerId = "", localPoseOverride = null) {
  const frames = Array.isArray(buffer) ? buffer : [];
  if (!frames.length) return null;
  const target = readNumber(renderAt, 0);
  let before = frames[0];
  let after = frames[frames.length - 1];
  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (readNumber(frame.receivedAt, 0) <= target) before = frame;
    if (readNumber(frame.receivedAt, 0) >= target) {
      after = frame;
      break;
    }
  }
  const beforeAt = readNumber(before.receivedAt, 0);
  const afterAt = readNumber(after.receivedAt, beforeAt);
  const ratio = afterAt > beforeAt ? clamp((target - beforeAt) / (afterAt - beforeAt), 0, 1) : 1;
  const base = cloneSnapshot(after.snapshot || before.snapshot);
  if (!base) return null;
  const beforeSnapshot = before.snapshot || base;
  const afterSnapshot = after.snapshot || base;
  base.players = interpolateEntityList(beforeSnapshot.players, afterSnapshot.players, ratio, { localPlayerId, localPoseOverride });
  base.enemies = interpolateEntityList(beforeSnapshot.enemies, afterSnapshot.enemies, ratio);
  base.projectiles = interpolateEntityList(beforeSnapshot.projectiles, afterSnapshot.projectiles, ratio);
  base.loot = interpolateEntityList(beforeSnapshot.loot, afterSnapshot.loot, ratio);
  base.rewardPickups = interpolateEntityList(beforeSnapshot.rewardPickups, afterSnapshot.rewardPickups, ratio);
  base.economyPickups = interpolateEntityList(beforeSnapshot.economyPickups, afterSnapshot.economyPickups, ratio);
  base.interpolation = {
    mode: "remote-interpolation-buffer",
    delayMs: REMOTE_INTERPOLATION_DELAY_MS,
    frames: frames.length,
    renderAt: target,
    beforeTick: readNumber(before.tick, 0),
    afterTick: readNumber(after.tick, 0),
    ratio
  };
  return base;
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

function normalizedMove(input = {}) {
  const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len <= 0.0001) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

function normalizedAimFromSample(sampled = {}, pose = null) {
  const fallbackAngle = readNumber(pose?.angle, 0);
  const rawAimX = Number(sampled.aimX);
  const rawAimY = Number(sampled.aimY);
  let aimX = Math.cos(fallbackAngle);
  let aimY = Math.sin(fallbackAngle);
  if (Number.isFinite(rawAimX) && Number.isFinite(rawAimY) && pose) {
    aimX = rawAimX - readNumber(pose.x, 0);
    aimY = rawAimY - readNumber(pose.y, 0);
  }
  const len = Math.hypot(aimX, aimY);
  if (!Number.isFinite(len) || len <= 0.0001) return { x: Math.cos(fallbackAngle) || 1, y: Math.sin(fallbackAngle) || 0 };
  return { x: aimX / len, y: aimY / len };
}

function copyServerPose(player) {
  if (!player) return null;
  return {
    id: player.id,
    x: readNumber(player.x),
    y: readNumber(player.y),
    vx: readNumber(player.vx, 0),
    vy: readNumber(player.vy, 0),
    hp: readNumber(player.hp, 100),
    maxHp: readNumber(player.maxHp, 100),
    angle: readNumber(player.angle, 0),
    radius: PLAYER_RADIUS,
    serverTick: readNumber(player.inputStream?.serverTick, 0),
    lastProcessedInputSeq: readNumber(player.inputStream?.lastProcessedInputSeq, 0)
  };
}

function applyPredictionFrame(pose, frame) {
  if (!pose || !frame) return pose;
  const dtSeconds = Math.min(0.05, Math.max(0, readNumber(frame.dt, INPUT_SEND_MS / 1000)));
  const move = normalizedMove(frame);
  const vx = move.x * PLAYER_SPEED;
  const vy = move.y * PLAYER_SPEED;
  const next = {
    ...pose,
    vx,
    vy,
    x: clamp(readNumber(pose.x) + vx * dtSeconds, PLAYER_RADIUS, ARENA_WIDTH - PLAYER_RADIUS),
    y: clamp(readNumber(pose.y) + vy * dtSeconds, PLAYER_RADIUS, ARENA_HEIGHT - PLAYER_RADIUS)
  };
  next.angle = Math.atan2(readNumber(frame.aimY, Math.sin(readNumber(pose.angle, 0))), readNumber(frame.aimX, Math.cos(readNumber(pose.angle, 0))));
  return next;
}

function predictionErrorPx(predicted, serverPose) {
  if (!predicted || !serverPose) return 0;
  return Math.hypot(readNumber(predicted.x) - readNumber(serverPose.x), readNumber(predicted.y) - readNumber(serverPose.y));
}

function prunePredictionFrames(frames = [], ackSeq = 0) {
  const ack = Math.max(0, Math.floor(readNumber(ackSeq, 0)));
  const pending = (Array.isArray(frames) ? frames : [])
    .filter((frame) => readNumber(frame?.seq, 0) > ack)
    .sort((a, b) => readNumber(a.seq, 0) - readNumber(b.seq, 0));
  if (pending.length <= SERVER_PREDICTION_BUFFER_LIMIT) return pending;
  return pending.slice(pending.length - SERVER_PREDICTION_BUFFER_LIMIT);
}

function replayPredictionFrames(serverPose, pendingInputs = []) {
  let pose = serverPose ? { ...serverPose } : null;
  for (const frame of pendingInputs) pose = applyPredictionFrame(pose, frame);
  return pose;
}

function reconcileLocalPrediction(previousPredicted, serverPose, pendingInputs = [], ackSeq = 0) {
  if (!serverPose) {
    return { pose: previousPredicted || null, pendingInputs: Array.isArray(pendingInputs) ? pendingInputs : [], replayed: 0, predictionErrorPx: 0, snap: false };
  }
  const pending = prunePredictionFrames(pendingInputs, ackSeq);
  const errorPx = predictionErrorPx(previousPredicted, serverPose);
  const snap = errorPx > LOCAL_RECONCILE_SNAP_PX;
  const pose = replayPredictionFrames(serverPose, pending);
  if (pose) {
    pose.serverDriftPx = errorPx;
    pose.serverSnap = snap;
    pose.lastProcessedInputSeq = Math.max(readNumber(ackSeq, 0), readNumber(serverPose.lastProcessedInputSeq, 0));
    pose.replayedInputCount = pending.length;
  }
  return { pose, pendingInputs: pending, replayed: pending.length, predictionErrorPx: errorPx, snap };
}

function predictLocalPose(predicted, sampled, dtSeconds) {
  if (!predicted) return predicted;
  const frame = createPredictionFrame(0, sampled, predicted, dtSeconds);
  return applyPredictionFrame(predicted, frame);
}

function createPredictionFrame(seq, sampled = {}, pose = null, dtSeconds = INPUT_SEND_MS / 1000) {
  const aim = normalizedAimFromSample(sampled, pose);
  return {
    seq: Math.max(0, Math.floor(readNumber(seq, 0))),
    dt: Math.min(0.05, Math.max(0.001, readNumber(dtSeconds, INPUT_SEND_MS / 1000))),
    left: !!sampled.left,
    right: !!sampled.right,
    up: !!sampled.up,
    down: !!sampled.down,
    shoot: !!sampled.fire || !!sampled.firePressed || !!sampled.shoot,
    dash: !!sampled.dash,
    interact: !!sampled.interact,
    aimX: aim.x,
    aimY: aim.y
  };
}

function frameToServerInput(frame) {
  return {
    seq: frame.seq,
    inputSeq: frame.seq,
    left: !!frame.left,
    right: !!frame.right,
    up: !!frame.up,
    down: !!frame.down,
    shoot: !!frame.shoot,
    dash: !!frame.dash,
    interact: !!frame.interact,
    aimX: readNumber(frame.aimX, 1),
    aimY: readNumber(frame.aimY, 0)
  };
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
  app.reconcileStats = { mode: "server-authoritative-reconcile", localSeq: 0, ackedSeq: 0, serverAckSeq: 0, pendingInputs: 0, replayed: 0, driftPx: 0, predictionErrorPx: 0, correctionSnapCount: 0, avgServerRttMs: 0, roomSessionId: "" };
  app.localPose = null;
  app.localRenderPose = null;
  app.localCorrectionOffset = { x: 0, y: 0, angle: 0, reason: "server_mode" };
  app.localVisualStats = { mode: "server-authoritative", strategy: "input-seq-replay-reconciliation", driftPx: 0, snap: true, reason: "server_mode_reconcile", latency: "predicted-local/interpolated-remote" };
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
    predictedLocalPose: null,
    lastReconcile: null,
    correctionSnapCount: 0,
    remoteInterpolationBuffer: [],
    latestCombatSnapshot: null,
    latestCombatSnapshotAt: 0,
    lastCombatSnapshotCount: 0
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
      runtime.lastInputSentAt = 0;
      runtime.predictedLocalPose = null;
      runtime.lastReconcile = null;
      runtime.correctionSnapCount = 0;
      runtime.remoteInterpolationBuffer = [];
      runtime.latestCombatSnapshot = null;
      runtime.latestCombatSnapshotAt = 0;
      runtime.lastCombatSnapshotCount = 0;
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
    app.predictionFrames = [];
    runtime.remoteInterpolationBuffer = [];
    runtime.latestCombatSnapshot = null;
    runtime.latestCombatSnapshotAt = 0;
    runtime.lastCombatSnapshotCount = 0;
    app.ui.showMenu();
  }

  function update(now) {
    const room = runtime.room;
    if (!room || !app.running || app.role !== "server") return;
    runtime.state.playerId = findLocalPlayerId(room, runtime.state);
    runtime.state.roomId = room.id || runtime.state.roomId;
    app.playerId = runtime.state.playerId || app.playerId;
    app.roomId = runtime.state.roomId || app.roomId || "SERVER";

    if (runtime.state.combatSnapshotCount !== runtime.lastCombatSnapshotCount && isCompactCombatSnapshot(runtime.state.lastCombatSnapshot)) {
      runtime.lastCombatSnapshotCount = runtime.state.combatSnapshotCount;
      runtime.latestCombatSnapshot = runtime.state.lastCombatSnapshot;
      runtime.latestCombatSnapshotAt = now;
    }
    const serverSnapshot = buildServerSnapshot(room.state, app.playerId, { compactCombatSnapshot: runtime.latestCombatSnapshot });
    runtime.remoteInterpolationBuffer = pushRemoteInterpolationFrame(runtime.remoteInterpolationBuffer, serverSnapshot, now);
    const serverMe = serverSnapshot.players.find((p) => p.id === app.playerId) || serverSnapshot.players[0] || null;
    if (serverMe) app.playerId = serverMe.id;

    const dtSeconds = runtime.lastUpdateAt > 0 ? Math.min(0.05, Math.max(0, (now - runtime.lastUpdateAt) / 1000)) : INPUT_SEND_MS / 1000;
    runtime.lastUpdateAt = now;

    const serverPose = copyServerPose(serverMe);
    const serverAckSeq = readNumber(serverMe?.inputStream?.lastProcessedInputSeq, 0);
    let reconcile = runtime.lastReconcile || { replayed: 0, predictionErrorPx: 0, snap: false };
    if (serverPose) {
      reconcile = reconcileLocalPrediction(runtime.predictedLocalPose, serverPose, app.predictionFrames, serverAckSeq);
      runtime.predictedLocalPose = reconcile.pose;
      app.predictionFrames = reconcile.pendingInputs;
      app.lastAckedInputSeq = serverAckSeq;
      runtime.state.lastAckSeq = serverAckSeq;
      runtime.state.serverTick = readNumber(serverMe?.inputStream?.serverTick, 0);
      if (reconcile.snap) runtime.correctionSnapCount += 1;
      runtime.lastReconcile = reconcile;
    }

    const samplePose = runtime.predictedLocalPose || serverMe;
    const sampled = samplePose ? app.input.sample(samplePose, app.camera) : null;

    if (serverPose && sampled && now - runtime.lastInputSentAt >= INPUT_SEND_MS) {
      const frame = createPredictionFrame(++app.inputSeq, sampled, samplePose, dtSeconds);
      app.predictionFrames.push(frame);
      app.predictionFrames = prunePredictionFrames(app.predictionFrames, app.lastAckedInputSeq);
      runtime.predictedLocalPose = applyPredictionFrame(runtime.predictedLocalPose || serverPose, frame);
      reconcile = { ...reconcile, replayed: app.predictionFrames.length };
      if (sendColyseusInput(room, frameToServerInput(frame))) runtime.lastInputSentAt = now;
    }

    const visualMe = runtime.predictedLocalPose || serverMe;
    const snapshot = sampleRemoteInterpolation(
      runtime.remoteInterpolationBuffer,
      now - REMOTE_INTERPOLATION_DELAY_MS,
      app.playerId,
      visualMe
    ) || buildServerSnapshot(room.state, app.playerId, { localPoseOverride: visualMe, compactCombatSnapshot: runtime.latestCombatSnapshot });
    app.snapshot = snapshot;
    app.players = snapshot.players.map((p) => p.id);
    app.playerNames = Object.fromEntries(snapshot.players.map((p) => [p.id, p.name || p.id]));
    const me = snapshot.players.find((p) => p.id === app.playerId) || snapshot.players[0] || null;
    if (me) {
      app.localPose = { ...me, stats: {}, ability: null };
      app.localRenderPose = app.localPose;
      app.playerId = me.id;
    }

    const driftPx = Math.round(readNumber(runtime.predictedLocalPose?.serverDriftPx, reconcile.predictionErrorPx || 0));
    const predictionError = Math.round(readNumber(reconcile.predictionErrorPx, driftPx));
    app.reconcileStats = {
      mode: "server-authoritative-reconcile",
      localSeq: app.inputSeq,
      ackedSeq: app.lastAckedInputSeq,
      serverAckSeq: app.lastAckedInputSeq,
      pendingInputs: app.predictionFrames.length,
      pendingInputCount: app.predictionFrames.length,
      replayed: readNumber(reconcile.replayed, app.predictionFrames.length),
      driftPx,
      predictionErrorPx: predictionError,
      correctionSnapCount: runtime.correctionSnapCount,
      avgServerRttMs: readNumber(runtime.state.avgServerRttMs, 0),
      roomSessionId: room.sessionId || "",
      serverTick: readNumber(runtime.state.serverTick, readNumber(room.state?.tick, 0)),
      strategy: "input-seq-ack-replay",
      remoteInterpolationDelayMs: REMOTE_INTERPOLATION_DELAY_MS,
      remoteBufferedFrames: runtime.remoteInterpolationBuffer.length,
      remoteInterpolationMode: "remote-interpolation-buffer",
      combatSnapshotMode: serverSnapshot.combatSnapshot?.source || "schema-map",
      combatSnapshotProtocol: serverSnapshot.combatSnapshot?.protocol || "schema-map-fallback",
      combatSnapshotAgeMs: runtime.latestCombatSnapshotAt ? Math.max(0, Math.round(now - runtime.latestCombatSnapshotAt)) : 0,
      combatSnapshotBytes: serverSnapshot.combatSnapshot?.byteEstimate || 0,
      compactEnemyCount: serverSnapshot.combatSnapshot?.enemyCount ?? snapshot.enemies.length,
      compactProjectileCount: serverSnapshot.combatSnapshot?.projectileCount ?? snapshot.projectiles.length,
      compactPickupCount: serverSnapshot.combatSnapshot?.pickupCount ?? snapshot.economyPickups.length,
      serverDamageAuthority: serverSnapshot.combatSnapshot?.damageAuthority || "server-owned-combat-damage-v1",
      serverEnemyHits: serverSnapshot.combatSnapshot?.enemyHits || 0,
      serverEnemyKills: serverSnapshot.combatSnapshot?.enemyKills || 0,
      serverPlayerHits: serverSnapshot.combatSnapshot?.playerHits || 0,
      serverPickupsSpawned: serverSnapshot.combatSnapshot?.pickupsSpawned || 0
    };
    app.localVisualStats = {
      mode: "server-authoritative",
      strategy: "input-seq-replay-reconciliation",
      driftPx: predictionError,
      snap: !!runtime.predictedLocalPose?.serverSnap,
      reason: "server_mode_reconcile",
      latency: "predicted-local/interpolated-remote"
    };
  }

  return { bindMenu, start, leave, update, state: runtime.state };
}

export {
  buildServerSnapshot,
  applyPredictionFrame,
  createPredictionFrame,
  frameToServerInput,
  predictLocalPose,
  prunePredictionFrames,
  reconcileLocalPrediction,
  compactCombatDiagnostics,
  compactEnemiesToEntities,
  compactProjectilesToEntities,
  compactPickupsToEconomyPickups,
  isCompactCombatSnapshot,
  pushRemoteInterpolationFrame,
  replayPredictionFrames,
  sampleRemoteInterpolation
};
