import { createUi, isValidRoomId, normalizeRoomId, randomRoomId } from "./ui.js";
import { createInput } from "./input.js";
import { createCamera, updateCamera } from "./camera.js";
import { createRenderer, makePredictedProjectile, render, updatePredictedProjectiles } from "./renderer.js";
import { Transport } from "./net/transport.js";
import { INPUT_RATE, SNAPSHOT_RATE, VERSION, WORLD } from "./core/constants.js";
import { clamp } from "./core/math.js";
import { WEAPONS } from "./data/weapons.js";
import { addPlayer, createGameState, makeSnapshot, removePlayer, spawnPoint } from "./game/state.js";
import { fireWeapon } from "./game/combat.js";
import { emptyInput, makeShootPayload, movePlayer, updateHostWorld } from "./game/simulation.js";

const SIGNALING_URL = window.NN_SIGNALING_URL || "https://dengidermo-1.onrender.com";

const ui = createUi();
const canvas = document.getElementById("screen");
const renderer = createRenderer(canvas);
const camera = createCamera();
const input = createInput(canvas, { onEsc: leaveGame });

let transport = null;
let running = false;
let role = "none";
let roomId = null;
let playerId = null;
let players = [];
let pingMs = null;
let transportMode = "LINK";
let hostState = null;
let hostInputs = Object.create(null);
let snapshot = null;
let localPose = null;
let localWeapon = "pistol";
let predictedProjectiles = [];
let localNextFireAt = 0;
let fireSeq = 0;
let lastInputSent = 0;
let lastSnapshotSent = 0;
let lastFrame = performance.now();
let lastSnapshotTick = -1;

function boot() {
  ui.el.roomInput.addEventListener("input", () => {
    ui.el.roomInput.value = normalizeRoomId(ui.el.roomInput.value);
  });
  ui.el.createBtn.addEventListener("click", () => startHost());
  ui.el.joinBtn.addEventListener("click", () => startGuest());
  ui.el.roomInput.addEventListener("keydown", (e) => {
    if (e.code === "Enter") startGuest();
  });
  ui.showMenu();
  requestAnimationFrame(loop);
}

function makeTransport() {
  return new Transport(SIGNALING_URL, {
    onReady: handleReady,
    onPlayers: (list) => { players = list; },
    onPlayerLeft: handlePlayerLeft,
    onData: handleNetData,
    onPing: (ms) => { pingMs = ms; },
    onPeerState: (_id, state) => { if (state === "open") transportMode = "P2P"; },
    onError: () => ui.flashError(),
    onClose: () => { if (running) ui.setNet({ pingMs, role, playerId, players, transportMode: "OFF" }); }
  });
}

function startHost() {
  const id = randomRoomId();
  ui.el.roomInput.value = id;
  transport = makeTransport();
  transport.connectHost(id);
}

function startGuest() {
  const id = normalizeRoomId(ui.el.roomInput.value);
  ui.el.roomInput.value = id;
  if (!isValidRoomId(id)) {
    ui.flashError();
    return;
  }
  transport = makeTransport();
  transport.connectGuest(id);
}

function handleReady(info) {
  running = true;
  role = info.role;
  roomId = info.roomId;
  playerId = info.playerId;
  players = info.players;
  transportMode = "RELAY";
  pingMs = null;
  predictedProjectiles = [];
  localNextFireAt = 0;
  fireSeq = 0;
  camera.ready = false;
  input.resetKeys();

  if (role === "host") {
    hostState = createGameState(roomId);
    addPlayer(hostState, playerId, 0);
    hostInputs[playerId] = emptyInput();
    snapshot = makeSnapshot(hostState);
  } else {
    hostState = null;
    snapshot = null;
    const index = Math.max(0, players.indexOf(playerId));
    const p = spawnPoint(index);
    localPose = { id: playerId, x: p.x, y: p.y, vx: 0, vy: 0, angle: 0, radius: 13, hp: 100, maxHp: 100, weapon: "pistol", skin: index % 2 ? "green" : "default" };
  }

  ui.showGame(roomId);
  ui.setNet({ pingMs, role, playerId, players, transportMode });
}

function handlePlayerLeft(id) {
  if (role === "guest" && id === "p1") {
    leaveGame();
    ui.flashError();
    return;
  }
  if (hostState) removePlayer(hostState, id);
  delete hostInputs[id];
}

function leaveGame() {
  if (!running) return;
  running = false;
  role = "none";
  roomId = null;
  playerId = null;
  players = [];
  snapshot = null;
  hostState = null;
  hostInputs = Object.create(null);
  localPose = null;
  predictedProjectiles = [];
  input.resetKeys();
  transport?.close(true);
  transport = null;
  ui.showMenu();
}

function handleNetData(msg, from, mode) {
  if (!msg || !msg.t) return;
  transportMode = mode === "p2p" ? "P2P" : "RELAY";

  if (role === "host") {
    if (msg.t === "input" && from) {
      hostInputs[from] = msg.input || emptyInput();
      return;
    }
    if (msg.t === "shoot" && from) {
      const player = hostState?.players[from];
      if (player && msg.shoot && msg.shoot.fireSeq > player.fireSeqSeen) {
        player.fireSeqSeen = msg.shoot.fireSeq;
        fireWeapon(hostState, from, msg.shoot);
      }
    }
    return;
  }

  if (msg.t === "state") {
    if (msg.snapshot.tick <= lastSnapshotTick) return;
    lastSnapshotTick = msg.snapshot.tick;
    snapshot = msg.snapshot;
    syncLocalFromSnapshot();
  }
}

function syncLocalFromSnapshot() {
  const me = snapshot?.players?.find((p) => p.id === playerId);
  if (!me) return;
  localWeapon = me.weapon || localWeapon;
  if (!localPose) {
    localPose = { ...me, vx: 0, vy: 0, radius: 13 };
    return;
  }
  localPose.hp = me.hp;
  localPose.maxHp = me.maxHp;
  localPose.weapon = me.weapon;
  localPose.skin = me.skin;
  const dx = me.x - localPose.x;
  const dy = me.y - localPose.y;
  if (dx * dx + dy * dy > 90000) {
    localPose.x = me.x;
    localPose.y = me.y;
  }
}

function ensureHostPlayers() {
  if (!hostState) return;
  for (const [index, id] of players.entries()) {
    if (!hostState.players[id]) addPlayer(hostState, id, index);
  }
  for (const id of Object.keys(hostState.players)) {
    if (!players.includes(id)) removePlayer(hostState, id);
  }
}

function currentLocalPlayerFromSnapshot() {
  return snapshot?.players?.find((p) => p.id === playerId) || localPose;
}

function tryLocalShoot(nowSec, inputState) {
  if (!localPose || !inputState.fire) return;
  const weaponId = localWeapon || localPose.weapon || "pistol";
  const weapon = WEAPONS[weaponId] || WEAPONS.pistol;
  if (nowSec < localNextFireAt) return;
  localNextFireAt = nowSec + 1 / weapon.fireRate;
  fireSeq += 1;
  localPose.angle = inputState.aimAngle;
  const payload = makeShootPayload(playerId, localPose, weaponId, fireSeq);
  const baseId = `${playerId}-${fireSeq}`;
  predictedProjectiles.push(makePredictedProjectile(baseId, playerId, weaponId, localPose));
  if (role === "host") fireWeapon(hostState, playerId, payload);
  else transport?.sendToHost({ t: "shoot", shoot: payload });
}

function updateHost(dt, now) {
  ensureHostPlayers();
  const inputState = input.sample(localPose || hostState.players[playerId], camera);
  const me = hostState.players[playerId];
  localPose = me;
  inputState.px = Math.round(me.x);
  inputState.py = Math.round(me.y);
  hostInputs[playerId] = inputState;
  tryLocalShoot(now / 1000, inputState);
  updateHostWorld(hostState, hostInputs, dt);
  snapshot = makeSnapshot(hostState);

  if (now - lastSnapshotSent > 1000 / SNAPSHOT_RATE) {
    lastSnapshotSent = now;
    transport?.broadcast({ t: "state", snapshot });
  }
}

function updateGuest(dt, now) {
  if (!localPose) return;
  const inputState = input.sample(localPose, camera);
  movePlayer(localPose, inputState, dt);
  localPose.angle = inputState.aimAngle;
  localPose.x = clamp(localPose.x, localPose.radius, WORLD.w - localPose.radius);
  localPose.y = clamp(localPose.y, localPose.radius, WORLD.h - localPose.radius);
  inputState.px = Math.round(localPose.x);
  inputState.py = Math.round(localPose.y);
  tryLocalShoot(now / 1000, inputState);

  if (now - lastInputSent > 1000 / INPUT_RATE) {
    lastInputSent = now;
    transport?.sendToHost({ t: "input", input: inputState });
  }
}

function updateHud() {
  const me = role === "host" ? hostState?.players[playerId] : currentLocalPlayerFromSnapshot();
  ui.setHud(me);
  ui.setNet({ pingMs, role, playerId, players, transportMode });
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
  lastFrame = now;

  if (running) {
    transport?.tickPing(now);
    if (role === "host" && hostState) updateHost(dt, now);
    if (role === "guest") updateGuest(dt, now);
    predictedProjectiles = updatePredictedProjectiles(predictedProjectiles, dt);
    updateCamera(camera, localPose || currentLocalPlayerFromSnapshot(), dt);
    render(renderer, snapshot, localPose, playerId, camera, input.mouse, predictedProjectiles, dt);
    updateHud();
  }

  requestAnimationFrame(loop);
}

console.info(`nncckkrr ${VERSION}`);
boot();
