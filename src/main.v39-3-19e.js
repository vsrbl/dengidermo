import { createUi } from "./ui.js";
import { createInput } from "./input.js";
import { createCamera, updateCamera } from "./camera.js";
import { createRenderer, render, updatePredictedProjectiles } from "./renderer.js";
import { BUILD_ID, GAME_SPEED, VERSION } from "./core/constants.js";
import { START_WEAPON } from "./data/weapons.js";
import { createInventory } from "./game/inventory.js";
import { makeSnapshot } from "./game/state.js";
import { readDevConfig } from "./dev/mode.js";
import { checkReleaseIntegrity, initialReleaseState } from "./app/releaseIntegrity.v39-3-19e.js";
import { createUpgradeClient } from "./app/upgradeClient.v39-3-19e.js";
import { createSessionRuntime } from "./app/session.v39-3-19e.js";
import { createHostRuntime } from "./app/hostRuntime.v39-3-19e.js";
import { createClientRuntime } from "./app/clientRuntime.v39-3-19e.js";
import { createDevControls } from "./app/devControls.v39-3-19e.js";
import { createCasinoClient } from "./app/casinoClient.v39-3-19e.js";
import { createRewardEventFeed } from "./rewardEventFeed.js";

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
    localUpgradeOfferSeq: 0,
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
    interactSeq: 0,
    casinoSeq: 0,
    casinoClient: null,
    rewardEventFeed: createRewardEventFeed(),
    lastInputSent: 0,
    lastSnapshotSent: 0,
    lastFrame: performance.now(),
    lastSnapshotTick: -1,
    release: initialReleaseState(SIGNALING_URL)
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
const casinoClient = createCasinoClient(app, { host: hostRuntime });
app.casinoClient = casinoClient;

sessionRuntime.wire({ host: hostRuntime, upgrades: upgradeClient });
hostRuntime.wire({ client: clientRuntime });

app.input = createInput(app.canvas, {
  onEsc: () => sessionRuntime.leaveGame(),
  onWeaponSlot: (slot) => clientRuntime.requestWeaponSlot(slot),
  onWeaponCycle: (dir) => clientRuntime.requestWeaponCycle(dir),
  onDevCommand: (command) => devControls.request(command),
  onAbility: (ability) => clientRuntime.requestAbility(ability),
  onInteract: () => clientRuntime.requestInteract(),
  isGameActive: () => app.running
});

function renderReleaseStatus(release) {
  if (!release || app.running) return;
  const kind = release.blockConnection || release.status === "deploy_mismatch" || release.status === "health_unreachable" || release.status === "invalid_config"
    ? "error"
    : "info";
  app.ui.setMenuStatus(release.message || `CLIENT ${VERSION.toUpperCase()} BUILD ${BUILD_ID}`, kind);
}

function refreshReleaseIntegrity() {
  app.release = initialReleaseState(SIGNALING_URL);
  renderReleaseStatus(app.release);
  checkReleaseIntegrity(SIGNALING_URL).then((release) => {
    app.release = release;
    console.info("nncckkrr release", release);
    renderReleaseStatus(release);
  }).catch((err) => {
    app.release = {
      ...initialReleaseState(SIGNALING_URL),
      status: "health_unreachable",
      message: "SERVER CHECK FAILED",
      blockConnection: false,
      error: err?.message || String(err),
      checkedAt: Date.now()
    };
    renderReleaseStatus(app.release);
  });
}

function boot() {
  sessionRuntime.bindMenu();
  app.ui.onUpgradePick((index) => upgradeClient.requestChoice(index));
  app.ui.showMenu();
  refreshReleaseIntegrity();
  requestAnimationFrame(loop);
}

function handleNetData(msg, from, mode) {
  if (!msg || !msg.t) return;
  app.transportMode = mode === "p2p" ? "P2P" : "RELAY";

  if (app.role === "host") {
    hostRuntime.handleNetData(msg, from);
    return;
  }

  if (msg.t === "casinoResult") {
    casinoClient.receiveResult(msg.result);
    return;
  }

  clientRuntime.handleNetData(msg);
}

function updateHud() {
  const snapMe = clientRuntime.currentLocalPlayerFromSnapshot();
  const me = app.role === "host"
    ? (app.hostState?.players[app.playerId] ? { ...app.hostState.players[app.playerId], ability: snapMe?.ability || null, companions: snapMe?.companions || null } : null)
    : (app.localPose ? { ...snapMe, hp: snapMe?.hp ?? app.localPose.hp, maxHp: snapMe?.maxHp ?? app.localPose.maxHp, activeWeapon: app.localWeapon, inventory: app.localInventory, upgrades: { choices: app.localUpgradeChoices, offers: app.localUpgradeOffers, offerSeq: app.localUpgradeOfferSeq }, stats: app.localPose.stats || {}, ability: app.localPose.ability || snapMe?.ability || null, companions: snapMe?.companions || null } : snapMe);
  app.ui.setHud(me || { inventory: app.localInventory, activeWeapon: app.localWeapon }, app.snapshot, { statPanelOpen: app.input?.isTabHeld?.() });
  app.ui.setProcFeed(app.rewardEventFeed.ingest(app.snapshot?.events || [], { playerId: app.playerId }));
  app.ui.setNet({ pingMs: app.pingMs, role: app.role, playerId: app.playerId, players: app.players, playerNames: app.playerNames, transportMode: app.transportMode, dev: app.snapshot?.dev || (app.role === "host" ? makeSnapshot(app.hostState)?.dev : null), release: app.release });
}

function loop(now) {
  const dt = Math.min(0.05, (now - app.lastFrame) / 1000 || 0.016);
  const gameDt = Math.min(0.05, dt * GAME_SPEED);
  const gameNow = (now / 1000) * GAME_SPEED;
  app.lastFrame = now;

  if (app.running) {
    upgradeClient.tick(now);
    casinoClient.tick();
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

console.info(`nncckkrr ${VERSION} build ${BUILD_ID}`);
boot();
