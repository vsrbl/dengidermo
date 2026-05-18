import { createUi, isValidRoomId, normalizeRoomId, randomRoomId } from "./ui.js";
import { createInput } from "./input.js";
import { createCamera, updateCamera } from "./camera.js";
import { createRenderer, makePredictedProjectile, render, resetRendererSmooth, updatePredictedProjectiles } from "./renderer.js";
import { Transport } from "./net/transport.js";
import { GAME_SPEED, INPUT_RATE, SNAPSHOT_RATE, VERSION, WORLD } from "./core/constants.js";
import { clamp } from "./core/math.js";
import { START_WEAPON, WEAPONS } from "./data/weapons.js";
import { addPlayer, createGameState, makeSnapshot, removePlayer, spawnPoint } from "./game/state.js";
import { fireWeapon } from "./game/combat.js";
import { emptyInput, makeShootPayload, movePlayer, updateHostWorld } from "./game/simulation.js";
import { createInventory, cycleWeapon, ensureInventory, getActiveWeaponId, switchWeaponSlot } from "./game/inventory.js";
import { chooseUpgrade } from "./game/upgrades.js";
import { readDevConfig } from "./dev/mode.js";
import { applyDevCommand, hasDevMode } from "./game/dev.js";

const SIGNALING_URL = window.NN_SIGNALING_URL || "https://dengidermo-1.onrender.com";

const ui = createUi();
const canvas = document.getElementById("screen");
const renderer = createRenderer(canvas);
const camera = createCamera();
const devConfig = readDevConfig(window.location);
const input = createInput(canvas, { onEsc: leaveGame, onWeaponSlot: requestWeaponSlot, onWeaponCycle: requestWeaponCycle, onDevCommand: requestDevCommand, isGameActive: () => running });

let transport = null;
let running = false;
let role = "none";
let roomId = null;
let playerId = null;
let players = [];
let pingMs = null;
let transportMode = "LINK";
let connecting = false;
let connectTimer = 0;
let hostState = null;
let hostInputs = Object.create(null);
let snapshot = null;
let localPose = null;
let localWeapon = START_WEAPON;
let localInventory = createInventory([START_WEAPON]);
let localUpgradeChoices = [];
let upgradePickPending = false;
let upgradePendingAt = 0;
let pendingUpgradeIndex = -1;
let pendingUpgradeKey = "";
let pendingUpgradeLastSend = 0;
let upgradeHideTimer = 0;
let predictedProjectiles = [];
let localCooldowns = Object.create(null);
let localLocationId = null;
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
  ui.onUpgradePick(requestUpgradeChoice);
  ui.showMenu();
  requestAnimationFrame(loop);
}

function makeTransport() {
  return new Transport(SIGNALING_URL, {
    onReady: handleReady,
    onPlayers: (list) => { players = Array.isArray(list) ? list.slice(0, 4) : []; },
    onPlayerLeft: handlePlayerLeft,
    onData: handleNetData,
    onPing: (ms) => { pingMs = ms; },
    onPeerState: (_id, state) => { if (state === "open") transportMode = "P2P"; },
    onError: (message) => handleConnectError(message),
    onClose: () => handleTransportClose()
  });
}

function setConnecting(value) {
  connecting = value;
  ui.el.createBtn.disabled = value;
  ui.el.joinBtn.disabled = value;
  if (!value) {
    window.clearTimeout(connectTimer);
    connectTimer = 0;
  }
}

function armConnectTimeout() {
  window.clearTimeout(connectTimer);
  connectTimer = window.setTimeout(() => {
    if (!connecting || running) return;
    transport?.close(false);
    transport = null;
    setConnecting(false);
    ui.flashError("connection timeout");
  }, 9000);
}

function beginConnect(nextTransport) {
  transport?.close(false);
  transport = nextTransport;
  setConnecting(true);
  armConnectTimeout();
}

function handleConnectError(message = "error") {
  if (!running) {
    transport?.close(false);
    transport = null;
    setConnecting(false);
    ui.flashError(message);
    return;
  }
  ui.flashError(message);
}

function handleTransportClose() {
  if (connecting && !running) {
    setConnecting(false);
    ui.flashError("connection closed");
    return;
  }
  if (running) ui.setNet({ pingMs, role, playerId, players, transportMode: "OFF" });
}

function startHost() {
  if (connecting || running) return;
  const id = randomRoomId();
  ui.el.roomInput.value = id;
  const next = makeTransport();
  beginConnect(next);
  next.connectHost(id);
}

function startGuest() {
  if (connecting || running) return;
  const id = normalizeRoomId(ui.el.roomInput.value);
  ui.el.roomInput.value = id;
  if (!isValidRoomId(id)) {
    ui.flashError("bad room");
    return;
  }
  const next = makeTransport();
  beginConnect(next);
  next.connectGuest(id);
}

function handleReady(info) {
  setConnecting(false);
  running = true;
  role = info.role;
  roomId = info.roomId;
  playerId = info.playerId;
  players = Array.isArray(info.players) ? info.players.slice(0, 4) : [info.playerId];
  lastSnapshotTick = -1;
  lastInputSent = 0;
  lastSnapshotSent = 0;
  transportMode = "RELAY";
  pingMs = null;
  predictedProjectiles = [];
  localCooldowns = Object.create(null);
  localLocationId = null;
  fireSeq = 0;
  localWeapon = START_WEAPON;
  localInventory = createInventory([START_WEAPON]);
  resetUpgradeUi();
  camera.ready = false;
  input.resetKeys();

  if (role === "host") {
    hostState = createGameState(roomId, { dev: devConfig.enabled ? devConfig : null });
    addPlayer(hostState, playerId, 0);
    hostInputs[playerId] = emptyInput();
    localInventory = ensureInventory(hostState.players[playerId]);
    localWeapon = getActiveWeaponId(hostState.players[playerId]);
    snapshot = makeSnapshot(hostState);
    localLocationId = snapshot.location?.id || null;
  } else {
    hostState = null;
    snapshot = null;
    const index = Math.max(0, players.indexOf(playerId));
    const p = spawnPoint(index);
    localInventory = createInventory([START_WEAPON]);
    localPose = { id: playerId, x: p.x, y: p.y, vx: 0, vy: 0, kx: 0, ky: 0, angle: 0, radius: 13, hp: 100, maxHp: 100, activeWeapon: START_WEAPON, inventory: localInventory, upgrades: { choices: [] }, stats: {}, skin: index % 2 ? "green" : "default" };
  }

  ui.showGame(roomId);
  ui.setNet({ pingMs, role, playerId, players, transportMode, dev: snapshot?.dev || (role === "host" ? makeSnapshot(hostState)?.dev : null) });
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
  if (!running) {
    if (connecting) {
      transport?.close(false);
      transport = null;
      setConnecting(false);
    }
    return;
  }
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
  localInventory = createInventory([START_WEAPON]);
  resetUpgradeUi();
  localCooldowns = Object.create(null);
  localLocationId = null;
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
      return;
    }
    if (msg.t === "weapon" && from) {
      applyWeaponRequest(from, msg);
      return;
    }
    if (msg.t === "upgrade" && from) {
      applyUpgradeRequest(from, msg);
      return;
    }
    return;
  }

  if (msg.t === "state") {
    if (!msg.snapshot || !Number.isFinite(msg.snapshot.tick)) return;
    if (msg.snapshot.tick <= lastSnapshotTick) return;
    lastSnapshotTick = msg.snapshot.tick;
    snapshot = msg.snapshot;
    syncLocalFromSnapshot();
  }
}

function syncLocalFromSnapshot() {
  const me = snapshot?.players?.find((p) => p.id === playerId);
  if (!me) return;
  const nextLocationId = snapshot?.location?.id || null;
  const locationChanged = nextLocationId && localLocationId && nextLocationId !== localLocationId;
  if (nextLocationId && nextLocationId !== localLocationId) localLocationId = nextLocationId;
  if (locationChanged) {
    predictedProjectiles = [];
    resetRendererSmooth(renderer);
    camera.ready = false;
    input.resetKeys();
  }
  const oldWeapon = localWeapon;
  if (me.inventory) localInventory = { weapons: [...me.inventory.weapons], activeWeapon: me.inventory.activeWeapon, items: {}, passives: [...(me.inventory.passives || [])] };
  syncUpgradeChoicesFromHost(me.upgrades?.choices);
  if (!localPose) {
    localWeapon = me.inventory?.activeWeapon || me.activeWeapon || START_WEAPON;
    localPose = { ...me, inventory: localInventory, upgrades: me.upgrades || { choices: [] }, stats: me.stats || {}, activeWeapon: localWeapon, vx: 0, vy: 0, kx: 0, ky: 0, radius: 13 };
    return;
  }
  localPose.hp = me.hp;
  localPose.maxHp = me.maxHp;
  if ((me.inventory?.activeWeapon || me.activeWeapon) && (me.inventory?.activeWeapon || me.activeWeapon) !== oldWeapon) {
    localWeapon = me.inventory?.activeWeapon || me.activeWeapon;
  }
  localPose.activeWeapon = localWeapon;
  localPose.inventory = localInventory;
  localPose.upgrades = me.upgrades || { choices: [] };
  localPose.stats = me.stats || localPose.stats || {};
  localPose.skin = me.skin;
  const dx = me.x - localPose.x;
  const dy = me.y - localPose.y;
  if (locationChanged || dx * dx + dy * dy > 90000) {
    localPose.x = me.x;
    localPose.y = me.y;
    localPose.vx = 0;
    localPose.vy = 0;
    localPose.kx = 0;
    localPose.ky = 0;
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
  const fromSnapshot = snapshot?.players?.find((p) => p.id === playerId);
  if (fromSnapshot) return fromSnapshot;
  return localPose;
}

function applyWeaponRequest(id, request = {}) {
  const player = hostState?.players[id];
  if (!player) return false;
  if (Number.isInteger(request.slot)) return switchWeaponSlot(player, request.slot);
  if (Number.isFinite(request.dir)) return cycleWeapon(player, request.dir > 0 ? 1 : -1);
  return false;
}

function applyUpgradeRequest(id, request = {}) {
  if (!hostState) return false;
  const player = hostState.players[id];
  if (!player) return false;
  const currentKey = upgradeChoicesKey(player.upgrades?.choices);
  if (request.key && request.key !== currentKey) return false;
  return chooseUpgrade(hostState, id, request.index);
}

function upgradeChoicesKey(choices) {
  return Array.isArray(choices) && choices.length ? choices.join("|") : "";
}

function resetUpgradeUi() {
  localUpgradeChoices = [];
  upgradePickPending = false;
  upgradePendingAt = 0;
  pendingUpgradeIndex = -1;
  pendingUpgradeKey = "";
  pendingUpgradeLastSend = 0;
  window.clearTimeout(upgradeHideTimer);
  upgradeHideTimer = 0;
  ui.setUpgradeMenu([]);
}

function syncUpgradeChoicesFromHost(choices) {
  const nextChoices = Array.isArray(choices) ? choices.filter((id) => typeof id === "string").slice(0, 3) : [];
  const nextKey = upgradeChoicesKey(nextChoices);

  if (!nextKey) {
    resetUpgradeUi();
    return;
  }

  if (upgradePickPending && nextKey === pendingUpgradeKey) {
    localUpgradeChoices = [];
    ui.setUpgradeMenu([]);
    return;
  }

  if (pendingUpgradeKey && nextKey === pendingUpgradeKey) {
    localUpgradeChoices = [];
    ui.setUpgradeMenu([]);
    return;
  }

  localUpgradeChoices = nextChoices;
  upgradePickPending = false;
  upgradePendingAt = 0;
  pendingUpgradeIndex = -1;
  pendingUpgradeKey = "";
  pendingUpgradeLastSend = 0;
  ui.setUpgradeMenu(localUpgradeChoices, false);
}

function sendPendingUpgradeRequest(now = performance.now()) {
  if (role !== "guest" || pendingUpgradeIndex < 0) return;
  pendingUpgradeLastSend = now;
  transport?.sendToHost({ t: "upgrade", index: pendingUpgradeIndex, key: pendingUpgradeKey });
}

function requestUpgradeChoice(index) {
  if (!running || upgradePickPending || !localUpgradeChoices[index]) return;
  const key = upgradeChoicesKey(localUpgradeChoices);
  if (!key) return;

  upgradePickPending = true;
  upgradePendingAt = performance.now();
  pendingUpgradeIndex = index;
  pendingUpgradeKey = key;
  pendingUpgradeLastSend = 0;
  ui.setUpgradeMenu(localUpgradeChoices, true, index);
  window.clearTimeout(upgradeHideTimer);
  upgradeHideTimer = window.setTimeout(() => {
    if (upgradePickPending && pendingUpgradeKey === key) {
      localUpgradeChoices = [];
      ui.setUpgradeMenu([]);
    }
  }, 170);

  if (role === "host") {
    const ok = applyUpgradeRequest(playerId, { index, key });
    if (!ok) {
      resetUpgradeUi();
    }
    return;
  }

  sendPendingUpgradeRequest(upgradePendingAt);
}

function localInventoryWeapons() {
  return Array.isArray(localInventory?.weapons) ? localInventory.weapons : [START_WEAPON];
}

function requestDevCommand(command) {
  if (!running || role !== "host" || !hasDevMode(hostState)) return;
  applyDevCommand(hostState, command);
  snapshot = makeSnapshot(hostState);
  transport?.broadcast({ t: "state", snapshot });
}

function requestWeaponSlot(slot) {
  if (!running || !Number.isInteger(slot)) return;
  if (role === "host") {
    applyWeaponRequest(playerId, { slot });
    return;
  }
  const weaponId = localInventoryWeapons()[slot];
  if (!weaponId) return;
  localWeapon = weaponId;
  localInventory.activeWeapon = weaponId;
  if (localPose) { localPose.activeWeapon = weaponId; localPose.inventory = localInventory; }
  transport?.sendToHost({ t: "weapon", slot });
}

function requestWeaponCycle(dir) {
  if (!running) return;
  const weapons = localInventoryWeapons();
  if (weapons.length <= 1) return;
  if (role === "host") {
    applyWeaponRequest(playerId, { dir });
    return;
  }
  const current = Math.max(0, weapons.indexOf(localWeapon));
  const next = (current + (dir > 0 ? 1 : -1) + weapons.length) % weapons.length;
  requestWeaponSlot(next);
}

function applyLocalRecoil(pose, weapon, angle) {
  if (!pose || !weapon?.recoil) return;
  pose.kx = (pose.kx || 0) - Math.cos(angle) * weapon.recoil;
  pose.ky = (pose.ky || 0) - Math.sin(angle) * weapon.recoil;
}

function tryLocalShoot(nowSec, inputState) {
  if (!localPose || !inputState.fire) return;
  const weaponId = WEAPONS[localWeapon] ? localWeapon : (WEAPONS[localPose.activeWeapon] ? localPose.activeWeapon : START_WEAPON);
  const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
  const fireRateMult = Math.max(0.1, localPose.stats?.fireRateMult || 1);
  if (nowSec < (localCooldowns[weaponId] || 0)) return;
  localCooldowns[weaponId] = nowSec + 1 / (weapon.fireRate * fireRateMult);
  fireSeq += 1;
  localPose.angle = inputState.aimAngle;
  const payload = makeShootPayload(playerId, localPose, weaponId, fireSeq);
  const baseId = `${playerId}-${fireSeq}`;
  if (role === "guest") {
    predictedProjectiles.push(...makePredictedProjectile(baseId, playerId, weaponId, localPose, localPose.stats));
    applyLocalRecoil(localPose, weapon, inputState.aimAngle);
  }
  if (role === "host") fireWeapon(hostState, playerId, payload);
  else transport?.sendToHost({ t: "shoot", shoot: payload });
}

function updateHost(dt, now, gameNow) {
  ensureHostPlayers();
  const inputState = input.sample(localPose || hostState.players[playerId], camera);
  const me = hostState.players[playerId];
  localPose = me;
  inputState.px = Math.round(me.x);
  inputState.py = Math.round(me.y);
  hostInputs[playerId] = inputState;
  localInventory = ensureInventory(me);
  syncUpgradeChoicesFromHost(me.upgrades?.choices);
  localWeapon = getActiveWeaponId(me);
  tryLocalShoot(gameNow, inputState);
  updateHostWorld(hostState, hostInputs, dt);
  snapshot = makeSnapshot(hostState);
  const nextLocationId = snapshot.location?.id || null;
  if (nextLocationId && localLocationId && nextLocationId !== localLocationId) {
    localLocationId = nextLocationId;
    predictedProjectiles = [];
    resetRendererSmooth(renderer);
    camera.ready = false;
    input.resetKeys();
  } else if (nextLocationId && !localLocationId) {
    localLocationId = nextLocationId;
  }

  if (now - lastSnapshotSent > 1000 / SNAPSHOT_RATE) {
    lastSnapshotSent = now;
    transport?.broadcast({ t: "state", snapshot });
  }
}

function updateGuest(dt, now, gameNow) {
  if (!localPose) return;
  const inputState = input.sample(localPose, camera);
  movePlayer(localPose, inputState, dt);
  localPose.angle = inputState.aimAngle;
  localPose.x = clamp(localPose.x, localPose.radius, WORLD.w - localPose.radius);
  localPose.y = clamp(localPose.y, localPose.radius, WORLD.h - localPose.radius);
  inputState.px = Math.round(localPose.x);
  inputState.py = Math.round(localPose.y);
  tryLocalShoot(gameNow, inputState);

  if (now - lastInputSent > 1000 / INPUT_RATE) {
    lastInputSent = now;
    transport?.sendToHost({ t: "input", input: inputState });
  }
}

function updateHud() {
  const snapMe = currentLocalPlayerFromSnapshot();
  const me = role === "host"
    ? hostState?.players[playerId]
    : (localPose ? { ...snapMe, hp: snapMe?.hp ?? localPose.hp, maxHp: snapMe?.maxHp ?? localPose.maxHp, activeWeapon: localWeapon, inventory: localInventory, upgrades: { choices: localUpgradeChoices }, stats: localPose.stats || {} } : snapMe);
  ui.setHud(me || { inventory: localInventory, activeWeapon: localWeapon }, snapshot);
  ui.setNet({ pingMs, role, playerId, players, transportMode, dev: snapshot?.dev || (role === "host" ? makeSnapshot(hostState)?.dev : null) });
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
  const gameDt = Math.min(0.05, dt * GAME_SPEED);
  const gameNow = (now / 1000) * GAME_SPEED;
  lastFrame = now;

  if (running) {
    if (upgradePickPending && pendingUpgradeIndex >= 0 && now - pendingUpgradeLastSend > 900) {
      sendPendingUpgradeRequest(now);
    }
    if (upgradePickPending && upgradePendingAt && now - upgradePendingAt > 8000) {
      resetUpgradeUi();
    }
    transport?.tickPing(now);
    if (role === "host" && hostState) updateHost(gameDt, now, gameNow);
    if (role === "guest") updateGuest(gameDt, now, gameNow);
    predictedProjectiles = updatePredictedProjectiles(predictedProjectiles, gameDt, snapshot);
    updateCamera(camera, localPose || currentLocalPlayerFromSnapshot(), dt);
    render(renderer, snapshot, localPose, playerId, camera, input.mouse, predictedProjectiles, dt, gameDt);
    updateHud();
  }

  requestAnimationFrame(loop);
}

console.info(`nncckkrr ${VERSION}`);
boot();
