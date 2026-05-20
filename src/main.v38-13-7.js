import { createUi } from "./ui.js";
import { createInput } from "./input.js";
import { createCamera, updateCamera } from "./camera.js";
import { createRenderer, render, updatePredictedProjectiles } from "./renderer.js";
import { GAME_SPEED, VERSION } from "./core/constants.js";
import { START_WEAPON } from "./data/weapons.js";
import { createInventory } from "./game/inventory.js";
import { makeSnapshot } from "./game/state.js";
import { readDevConfig } from "./dev/mode.js";
import { createUpgradeClient } from "./app/upgradeClient.v38-13-7.js";
import { createSessionRuntime } from "./app/session.v38-13-7.js";
import { createHostRuntime } from "./app/hostRuntime.v38-13-7.js";
import { createClientRuntime } from "./app/clientRuntime.v38-13-7.js";
import { createDevControls } from "./app/devControls.v38-13-7.js";

const SIGNALING_URL = window.NN_SIGNALING_URL || "https://dengidermo-1.onrender.com";

function createAppState() {
  const ui = createUi();
  const canvas = document.getElementById("screen");
  const renderer = createRenderer(canvas);
  const camera = createCamera();

  return {
    ui,
    canvas,
    renderer,
    camera,
    devConfig: readDevConfig(window.location),
    input: null,
    transport: null,
    running: false,
    role: "none",
    roomId: null,
    playerId: null,
    playerName: "",
    players: [],
    playerNames: {},
    pingMs: null,
    transportMode: "LINK",
    connecting: false,
    connectTimer: 0,
    hostState: null,
    hostInputs: Object.create(null),
    snapshot: null,
    localPose: null,
    localWeapon: START_WEAPON,
    localInventory: createInventory([START_WEAPON]),
    localUpgradeChoices: [],
    localUpgradeOffers: {},
    upgradePickPending: false,
    upgradePendingAt: 0,
    pendingUpgradeIndex: -1,
    pendingUpgradeKey: "",
    pendingUpgradeLastSend: 0,
    upgradeHideTimer: 0,
    predictedProjectiles: [],
    localCooldowns: Object.create(null),
    localLocationId: null,
    fireSeq: 0,
    abilitySeq: 0,
    lastInputSent: 0,
    lastSnapshotSent: 0,
    lastFrame: performance.now(),
    lastSnapshotTick: -1
  };
}

const app = createAppState();
let hostRuntime = null;
let clientRuntime = null;

const upgradeClient = createUpgradeClient(app, {
  applyUpgradeRequest: (id, request) => hostRuntime?.applyUpgradeRequest(id, request)
});

const sessionRuntime = createSessionRuntime(app, {
  signalingUrl: SIGNALING_URL,
  devConfig: app.devConfig,
  onNetData: handleNetData
});

hostRuntime = createHostRuntime(app, { session: sessionRuntime, upgrades: upgradeClient });
clientRuntime = createClientRuntime(app, { session: sessionRuntime, host: hostRuntime, upgrades: upgradeClient });
const devControls = createDevControls(app);

sessionRuntime.wire({ host: hostRuntime, upgrades: upgradeClient });
hostRuntime.wire({ client: clientRuntime });

app.input = createInput(app.canvas, {
  onEsc: () => sessionRuntime.leaveGame(),
  onWeaponSlot: (slot) => clientRuntime.requestWeaponSlot(slot),
  onWeaponCycle: (dir) => clientRuntime.requestWeaponCycle(dir),
  onDevCommand: (command) => devControls.request(command),
  onAbility: (ability) => clientRuntime.requestAbility(ability),
  isGameActive: () => app.running
});

function boot() {
  sessionRuntime.bindMenu();
  app.ui.onUpgradePick((index) => upgradeClient.requestChoice(index));
  app.ui.showMenu();
  requestAnimationFrame(loop);
}

function handleNetData(msg, from, mode) {
  if (!msg || !msg.t) return;
  app.transportMode = mode === "p2p" ? "P2P" : "RELAY";

  if (app.role === "host") {
    hostRuntime.handleNetData(msg, from);
    return;
  }

  clientRuntime.handleNetData(msg);
}

function updateHud() {
  const snapMe = clientRuntime.currentLocalPlayerFromSnapshot();
  const me = app.role === "host"
    ? (app.hostState?.players[app.playerId] ? { ...app.hostState.players[app.playerId], ability: snapMe?.ability || null, companions: snapMe?.companions || null } : null)
    : (app.localPose ? { ...snapMe, hp: snapMe?.hp ?? app.localPose.hp, maxHp: snapMe?.maxHp ?? app.localPose.maxHp, activeWeapon: app.localWeapon, inventory: app.localInventory, upgrades: { choices: app.localUpgradeChoices, offers: app.localUpgradeOffers }, stats: app.localPose.stats || {}, ability: app.localPose.ability || snapMe?.ability || null, companions: snapMe?.companions || null } : snapMe);
  app.ui.setHud(me || { inventory: app.localInventory, activeWeapon: app.localWeapon }, app.snapshot);
  app.ui.setNet({ pingMs: app.pingMs, role: app.role, playerId: app.playerId, players: app.players, playerNames: app.playerNames, transportMode: app.transportMode, dev: app.snapshot?.dev || (app.role === "host" ? makeSnapshot(app.hostState)?.dev : null) });
}

function loop(now) {
  const dt = Math.min(0.05, (now - app.lastFrame) / 1000 || 0.016);
  const gameDt = Math.min(0.05, dt * GAME_SPEED);
  const gameNow = (now / 1000) * GAME_SPEED;
  app.lastFrame = now;

  if (app.running) {
    upgradeClient.tick(now);
    app.transport?.tickPing(now);
    if (app.role === "host" && app.hostState) hostRuntime.update(gameDt, now, gameNow);
    if (app.role === "guest") clientRuntime.updateGuest(gameDt, now, gameNow);
    app.predictedProjectiles = updatePredictedProjectiles(app.predictedProjectiles, gameDt, app.snapshot);
    updateCamera(app.camera, app.localPose || clientRuntime.currentLocalPlayerFromSnapshot(), dt);
    render(app.renderer, app.snapshot, app.localPose, app.playerId, app.camera, app.input.mouse, app.predictedProjectiles, dt, gameDt);
    updateHud();
  }

  requestAnimationFrame(loop);
}

console.info(`nncckkrr ${VERSION}`);
boot();
