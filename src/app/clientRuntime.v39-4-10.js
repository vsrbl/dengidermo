import { clamp, dist2 } from "../core/math.js";
import { DASH_DENIAL_RECONCILE_MS, GAME_SPEED, INPUT_RATE, WORLD } from "../core/constants.js";
import { START_WEAPON, WEAPONS } from "../data/weapons.js";
import { makePredictedProjectile, resetRendererSmooth } from "../renderer.js";
import { fireWeapon } from "../game/combat.js";
import { makeShootPayload, movePlayer } from "../game/simulation.js";
import { attachActionPoseHint } from "../game/playerActionHints.js";
import { createInventory } from "../game/inventory.js";
import { canPredictDash, predictLocalDash } from "../game/abilities.js";
import { makeSnapshot } from "../game/state.js";
import { roomGeometryIdentityMatches } from "../game/roomGeometry.js";

const HOST_HARD_RECONCILE_D2 = 240 * 240;
const HOST_IMPULSE_HARD_RECONCILE_D2 = 260 * 260;
const HOST_RECONCILE_EXTRAPOLATE_MS = 80;
const INPUT_AIM_QUANTIZE = 16;
const PREDICTION_BUFFER_LIMIT = 180;
const RECONCILE_REPLAY_MAX_FRAMES = 120;
const RECONCILE_MAX_FRAME_DT = 1 / 20;

const LOCAL_CORRECTION_OFFSET_DECAY_RATE = 34;
const LOCAL_CORRECTION_OFFSET_CLEAR_D2 = 0.35 * 0.35;
const LOCAL_CORRECTION_OFFSET_SNAP_D2 = 420 * 420;

function shortestAngleDelta(from = 0, to = 0) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function cloneRenderPoseFromPhysics(pose, reason = "snap", offset = null) {
  if (!pose) return null;
  const ox = Number.isFinite(offset?.x) ? offset.x : 0;
  const oy = Number.isFinite(offset?.y) ? offset.y : 0;
  const oa = Number.isFinite(offset?.angle) ? offset.angle : 0;
  return {
    id: pose.id,
    name: pose.name,
    x: (pose.x || 0) + ox,
    y: (pose.y || 0) + oy,
    vx: pose.vx || 0,
    vy: pose.vy || 0,
    kx: pose.kx || 0,
    ky: pose.ky || 0,
    angle: (pose.angle || 0) + oa,
    radius: pose.radius || 13,
    hp: pose.hp,
    maxHp: pose.maxHp,
    activeWeapon: pose.activeWeapon,
    inventory: pose.inventory,
    upgrades: pose.upgrades,
    stats: pose.stats || {},
    ability: pose.ability || null,
    economy: pose.economy,
    orbiterPressure: pose.orbiterPressure,
    orbiterSlowMult: pose.orbiterSlowMult || 1,
    skin: pose.skin,
    _visualReason: reason
  };
}

function zeroCorrectionOffset(reason = "clear") {
  return { x: 0, y: 0, angle: 0, reason };
}

function inputTransportKey(input = {}) {
  const ax = Number.isFinite(input.aimX) ? Math.round(input.aimX / INPUT_AIM_QUANTIZE) : 0;
  const ay = Number.isFinite(input.aimY) ? Math.round(input.aimY / INPUT_AIM_QUANTIZE) : 0;
  return [
    input.left ? 1 : 0,
    input.right ? 1 : 0,
    input.up ? 1 : 0,
    input.down ? 1 : 0,
    input.fire ? 1 : 0,
    ax,
    ay
  ].join("/");
}

function clonePredictionInput(input = {}) {
  return {
    left: !!input.left,
    right: !!input.right,
    up: !!input.up,
    down: !!input.down,
    fire: !!input.fire,
    firePressed: !!input.firePressed,
    aimAngle: Number.isFinite(input.aimAngle) ? input.aimAngle : 0,
    aimX: Number.isFinite(input.aimX) ? input.aimX : null,
    aimY: Number.isFinite(input.aimY) ? input.aimY : null,
    inputSeq: Number.isFinite(input.inputSeq) ? Math.max(0, Math.floor(input.inputSeq)) : 0
  };
}

export function prunePredictionFrames(frames = [], ackedInputSeq = 0) {
  const ack = Math.max(0, Math.floor(Number.isFinite(ackedInputSeq) ? ackedInputSeq : 0));
  return (Array.isArray(frames) ? frames : [])
    .filter((frame) => frame && Number.isFinite(frame.inputSeq) && frame.inputSeq > ack)
    .slice(-RECONCILE_REPLAY_MAX_FRAMES);
}

export function replayPredictionFrames(basePose, frames = [], location = null) {
  const pose = { ...basePose };
  for (const frame of (Array.isArray(frames) ? frames : [])) {
    const dt = Math.max(0, Math.min(RECONCILE_MAX_FRAME_DT, Number.isFinite(frame.dt) ? frame.dt : 0));
    if (dt <= 0) continue;
    movePlayer(pose, frame.input || {}, dt, location);
  }
  return pose;
}

export function createClientRuntime(app, { session, host, upgrades } = {}) {
  function currentLocalPlayerFromSnapshot() {
    const fromSnapshot = app.snapshot?.players?.find((p) => p.id === app.playerId);
    if (fromSnapshot) return fromSnapshot;
    return app.localPose;
  }

  function hostRttMs() {
    const p2p = app.transport?.getPeerPingMs?.("p1");
    if (Number.isFinite(p2p)) return p2p;
    const cached = app.peerPingMs?.p1;
    if (Number.isFinite(cached)) return cached;
    return Number.isFinite(app.pingMs) ? app.pingMs : 0;
  }

  function resetPredictionForLocationChange() {
    app.predictedProjectiles = [];
    resetPredictionBuffer("location_change");
    resetRendererSmooth(app.renderer);
    app.camera.ready = false;
    markLocalVisualSnap("location_change");
    app.input.resetKeys();
  }

  function resetPredictionBuffer(reason = "reset") {
    app.predictionFrames = [];
    app.reconcileStats = {
      mode: "rollback-replay",
      reason,
      localSeq: app.inputSeq || 0,
      ackedSeq: app.lastAckedInputSeq || 0,
      pendingInputs: 0,
      replayed: 0,
      driftPx: 0,
      visualDriftPx: Math.round(Math.sqrt(visualDriftD2()))
    };
  }

  function localCorrectionOffset() {
    if (!app.localCorrectionOffset) app.localCorrectionOffset = zeroCorrectionOffset("init");
    return app.localCorrectionOffset;
  }

  function visualDriftD2() {
    const offset = app.localCorrectionOffset || null;
    const ox = Number.isFinite(offset?.x) ? offset.x : 0;
    const oy = Number.isFinite(offset?.y) ? offset.y : 0;
    return ox * ox + oy * oy;
  }

  function snapLocalRenderPose(reason = "snap") {
    app.localCorrectionOffset = zeroCorrectionOffset(reason);
    app.localRenderPose = cloneRenderPoseFromPhysics(app.localPose, reason, app.localCorrectionOffset);
    app.localVisualSnapReason = "";
    app.localVisualStats = {
      mode: "visual-shell",
      strategy: "correction-offset",
      reason,
      driftPx: 0,
      snap: true,
      latency: "zero-local"
    };
  }

  function markLocalVisualSnap(reason = "authoritative_snap") {
    app.localVisualSnapReason = reason;
  }

  function preserveVisualDuringCorrection(previousVisible, correctedPose, reason = "host_correction") {
    if (!previousVisible || !correctedPose) return;
    app.localCorrectionOffset = {
      x: (previousVisible.x || 0) - (correctedPose.x || 0),
      y: (previousVisible.y || 0) - (correctedPose.y || 0),
      angle: shortestAngleDelta(correctedPose.angle || 0, previousVisible.angle || correctedPose.angle || 0),
      reason
    };
  }

  function updateLocalRenderPose(dt = 0, reason = "frame") {
    if (!app.localPose) {
      app.localRenderPose = null;
      app.localCorrectionOffset = zeroCorrectionOffset("no_pose");
      app.localVisualStats = { mode: "visual-shell", strategy: "correction-offset", reason: "no_pose", driftPx: 0, snap: true };
      return null;
    }
    if (!app.localRenderPose) {
      snapLocalRenderPose(reason || "init");
      return app.localRenderPose;
    }

    const offset = localCorrectionOffset();
    const d2 = visualDriftD2();
    const snapReason = app.localVisualSnapReason;
    const mustSnap = !!snapReason || d2 > LOCAL_CORRECTION_OFFSET_SNAP_D2;
    if (mustSnap) {
      snapLocalRenderPose(snapReason || "large_correction_offset");
      return app.localRenderPose;
    }

    const decay = Math.exp(-LOCAL_CORRECTION_OFFSET_DECAY_RATE * Math.max(0, dt || 0));
    offset.x = (offset.x || 0) * decay;
    offset.y = (offset.y || 0) * decay;
    offset.angle = (offset.angle || 0) * Math.exp(-LOCAL_CORRECTION_OFFSET_DECAY_RATE * 1.25 * Math.max(0, dt || 0));
    if (visualDriftD2() <= LOCAL_CORRECTION_OFFSET_CLEAR_D2) {
      offset.x = 0;
      offset.y = 0;
      offset.angle = 0;
    }

    app.localRenderPose = cloneRenderPoseFromPhysics(app.localPose, reason, offset);
    app.localVisualStats = {
      mode: "visual-shell",
      strategy: "correction-offset",
      reason: offset.reason || reason,
      driftPx: Math.round(Math.sqrt(visualDriftD2())),
      snap: false,
      smoothing: Math.round((1 - decay) * 100),
      latency: "zero-local"
    };
    return app.localRenderPose;
  }

  function hostPoseFromSnapshot(me) {
    const radius = app.localPose?.radius || me.radius || 13;
    return {
      ...app.localPose,
      x: clamp(Number.isFinite(me.x) ? me.x : app.localPose.x, radius, WORLD.w - radius),
      y: clamp(Number.isFinite(me.y) ? me.y : app.localPose.y, radius, WORLD.h - radius),
      angle: Number.isFinite(me.angle) ? me.angle : (app.localPose.angle || 0),
      vx: Number.isFinite(me.vx) ? me.vx : 0,
      vy: Number.isFinite(me.vy) ? me.vy : 0,
      kx: Number.isFinite(me.kx) ? me.kx : 0,
      ky: Number.isFinite(me.ky) ? me.ky : 0,
      radius
    };
  }

  function reconcileLocalPoseFromHost(me, { locationChanged = false } = {}) {
    if (!app.localPose) return;
    const beforeX = app.localPose.x;
    const beforeY = app.localPose.y;
    const previousVisible = app.localRenderPose
      ? { ...app.localRenderPose }
      : cloneRenderPoseFromPhysics(app.localPose, "pre_reconcile", app.localCorrectionOffset || zeroCorrectionOffset("pre_reconcile"));
    const ackedInputSeq = Number.isFinite(me.inputSeq) ? Math.max(0, Math.floor(me.inputSeq)) : (app.lastAckedInputSeq || 0);
    app.lastAckedInputSeq = Math.max(app.lastAckedInputSeq || 0, ackedInputSeq);
    const hostImpulseSeq = Number.isFinite(me.hostImpulseSeq) ? me.hostImpulseSeq : 0;
    const impulseChanged = hostImpulseSeq !== (app.localPose._hostImpulseSeq || 0);
    const basePose = hostPoseFromSnapshot(me);
    const pendingFrames = prunePredictionFrames(app.predictionFrames, app.lastAckedInputSeq);
    const replayedPose = replayPredictionFrames(basePose, pendingFrames, app.snapshot?.location);
    const dx = replayedPose.x - beforeX;
    const dy = replayedPose.y - beforeY;
    const d2 = dx * dx + dy * dy;
    const dashPredictionAge = app.localPose._localDashPredictedAt ? performance.now() - app.localPose._localDashPredictedAt : 0;
    const staleDeniedDash = app.localPose._localDashPredictedAt && dashPredictionAge > DASH_DENIAL_RECONCILE_MS && (me.ability?.dash?.cooldownLeft || 0) <= 0 && d2 > 400;
    const hostImpulseHardDrift = impulseChanged && d2 > HOST_IMPULSE_HARD_RECONCILE_D2;

    app.predictionFrames = pendingFrames;
    app.localPose.x = replayedPose.x;
    app.localPose.y = replayedPose.y;
    app.localPose.vx = replayedPose.vx || 0;
    app.localPose.vy = replayedPose.vy || 0;
    app.localPose.kx = replayedPose.kx || 0;
    app.localPose.ky = replayedPose.ky || 0;
    app.localPose.angle = replayedPose.angle || 0;
    app.localPose._hostImpulseSeq = hostImpulseSeq;
    const hardSnap = !!(locationChanged || staleDeniedDash || hostImpulseHardDrift || d2 > HOST_HARD_RECONCILE_D2);
    if (hardSnap) app.localPose._localDashPredictedAt = 0;
    if (hardSnap) {
      markLocalVisualSnap(locationChanged ? "location_change" : hostImpulseHardDrift ? "host_impulse" : staleDeniedDash ? "dash_denied" : "large_reconcile");
    } else {
      preserveVisualDuringCorrection(previousVisible, app.localPose, "host_correction");
    }

    app.reconcileStats = {
      mode: "rollback-replay",
      localSeq: app.inputSeq || 0,
      ackedSeq: app.lastAckedInputSeq || 0,
      pendingInputs: pendingFrames.length,
      replayed: pendingFrames.length,
      driftPx: Math.round(Math.sqrt(d2)),
      hostImpulseSeq,
      extrapolateMs: Math.max(0, Math.min(HOST_RECONCILE_EXTRAPOLATE_MS, hostRttMs() * 0.5)),
      visualDriftPx: Math.round(Math.sqrt(visualDriftD2())),
      snap: hardSnap
    };
  }

  function recordPredictionFrame(inputState, dt, now) {
    if (!app.predictionFrames) app.predictionFrames = [];
    app.predictionFrames.push({
      inputSeq: Math.max(0, Math.floor(inputState.inputSeq || 0)),
      dt: Math.max(0, Math.min(RECONCILE_MAX_FRAME_DT, dt || 0)),
      at: now || performance.now(),
      input: clonePredictionInput(inputState)
    });
    if (app.predictionFrames.length > PREDICTION_BUFFER_LIMIT) app.predictionFrames = app.predictionFrames.slice(-PREDICTION_BUFFER_LIMIT);
  }

  function syncLocalFromSnapshot() {
    const me = app.snapshot?.players?.find((p) => p.id === app.playerId);
    if (!me) return;
    const nextLocationId = app.snapshot?.location?.id || null;
    const locationChanged = nextLocationId && app.localLocationId && nextLocationId !== app.localLocationId;
    if (nextLocationId && nextLocationId !== app.localLocationId) app.localLocationId = nextLocationId;
    if (locationChanged) resetPredictionForLocationChange();

    const oldWeapon = app.localWeapon;
    if (me.inventory) app.localInventory = { weapons: [...me.inventory.weapons], activeWeapon: me.inventory.activeWeapon, items: {}, passives: [...(me.inventory.passives || [])] };
    upgrades.syncFromHost(me.upgrades?.choices, me.upgrades?.offers, me.upgrades?.offerSeq);
    if (!app.localPose) {
      app.localWeapon = me.inventory?.activeWeapon || me.activeWeapon || START_WEAPON;
      app.localPose = { ...me, inventory: app.localInventory, upgrades: me.upgrades || { choices: [] }, stats: me.stats || {}, activeWeapon: app.localWeapon, vx: Number.isFinite(me.vx) ? me.vx : 0, vy: Number.isFinite(me.vy) ? me.vy : 0, kx: Number.isFinite(me.kx) ? me.kx : 0, ky: Number.isFinite(me.ky) ? me.ky : 0, radius: 13, orbiterSlowMult: me.orbiterPressure?.slowMult || 1, _hostImpulseSeq: me.hostImpulseSeq || 0 };
      app.lastAckedInputSeq = Number.isFinite(me.inputSeq) ? Math.max(app.lastAckedInputSeq || 0, me.inputSeq) : (app.lastAckedInputSeq || 0);
      resetPredictionBuffer("initial_snapshot");
      snapLocalRenderPose("initial_snapshot");
      return;
    }
    app.localPose.hp = me.hp;
    app.localPose.maxHp = me.maxHp;
    if ((me.inventory?.activeWeapon || me.activeWeapon) && (me.inventory?.activeWeapon || me.activeWeapon) !== oldWeapon) {
      app.localWeapon = me.inventory?.activeWeapon || me.activeWeapon;
    }
    app.localPose.activeWeapon = app.localWeapon;
    app.localPose.inventory = app.localInventory;
    app.localPose.upgrades = me.upgrades || { choices: [] };
    app.localPose.economy = me.economy || app.localPose.economy || { money: 0, xp: 0, lifetimeXp: 0, level: 1, nextLevelXp: 24 };
    app.localPose.stats = me.stats || app.localPose.stats || {};
    app.localPose.ability = me.ability || null;
    app.localPose.orbiterPressure = me.orbiterPressure || { count: 0, slowMult: 1 };
    app.localPose.orbiterSlowMult = me.orbiterPressure?.slowMult || 1;
    app.localPose.name = me.name || session.playerDisplayName(app.playerId);
    app.localPose.skin = me.skin;
    if ((me.ability?.dash?.cooldownLeft || 0) > 0) app.localPose._localDashPredictedAt = 0;
    reconcileLocalPoseFromHost(me, { locationChanged });
  }

  function handleNetData(msg) {
    if (msg.t !== "state") return false;
    if (!msg.snapshot || !Number.isFinite(msg.snapshot.tick)) return true;
    if (!roomGeometryIdentityMatches(msg.snapshot.location)) {
      const layout = msg.snapshot.location?.layoutId || "unknown";
      console.warn("Ignoring snapshot with mismatched room geometry identity", layout);
      app.release = {
        ...(app.release || {}),
        status: "geometry_mismatch",
        message: "GEOMETRY MISMATCH / RELOAD",
        blockConnection: true,
        checkedAt: Date.now(),
        geometryLayoutId: layout
      };
      app.ui.setNet?.({
        pingMs: app.pingMs,
        role: app.role,
        playerId: app.playerId,
        players: app.players,
        playerNames: app.playerNames,
        transportMode: app.transportMode,
        transportModes: app.transportModes,
        release: app.release
      });
      return true;
    }
    if (msg.snapshot.tick <= app.lastSnapshotTick) return true;
    app.lastSnapshotTick = msg.snapshot.tick;
    app.snapshot = msg.snapshot;
    syncLocalFromSnapshot();
    return true;
  }

  function localInventoryWeapons() {
    return Array.isArray(app.localInventory?.weapons) ? app.localInventory.weapons : [START_WEAPON];
  }

  function requestAbility(ability) {
    if (!app.running || ability !== "dash") return;
    const pose = app.localPose || currentLocalPlayerFromSnapshot();
    if (!pose) return;
    const inputState = app.input.sample(pose, app.camera);
    attachActionPoseHint(inputState, pose);
    app.abilitySeq += 1;

    if (app.role === "host") {
      host.applyAbilityRequest(app.playerId, { ability: "dash", input: inputState, seq: app.abilitySeq });
      app.snapshot = makeSnapshot(app.hostState);
      return;
    }

    const nowSec = (performance.now() / 1000) * GAME_SPEED;
    if (!canPredictDash(app.localPose, nowSec)) return;
    predictLocalDash(app.localPose, inputState, nowSec, app.snapshot?.location);
    snapLocalRenderPose("local_dash");
    app.transport?.sendToHost({ t: "ability", ability: "dash", input: inputState, seq: app.abilitySeq });
  }

  function requestWeaponSlot(slot) {
    if (!app.running || !Number.isInteger(slot)) return;
    if (app.role === "host") {
      host.applyWeaponRequest(app.playerId, { slot });
      return;
    }
    const weaponId = localInventoryWeapons()[slot];
    if (!weaponId) return;
    app.localWeapon = weaponId;
    app.localInventory.activeWeapon = weaponId;
    if (app.localPose) { app.localPose.activeWeapon = weaponId; app.localPose.inventory = app.localInventory; }
    app.transport?.sendToHost({ t: "weapon", slot });
  }

  function requestWeaponCycle(dir) {
    if (!app.running) return;
    const weapons = localInventoryWeapons();
    if (weapons.length <= 1) return;
    if (app.role === "host") {
      host.applyWeaponRequest(app.playerId, { dir });
      return;
    }
    const current = Math.max(0, weapons.indexOf(app.localWeapon));
    const next = (current + (dir > 0 ? 1 : -1) + weapons.length) % weapons.length;
    requestWeaponSlot(next);
  }

  function nearestInteractableTarget() {
    const pose = app.localPose || currentLocalPlayerFromSnapshot();
    if (!pose) return null;
    let best = null;
    let bestD2 = Infinity;
    for (const item of app.snapshot?.interactables || []) {
      if (item.opened || item.active === false) continue;
      const radius = (item.interactRadius || (item.radius || 18) + 20) + (pose.radius || 13);
      const d = dist2(pose.x, pose.y, item.x, item.y);
      if (d <= radius * radius && d < bestD2) {
        best = item;
        bestD2 = d;
      }
    }
    return best;
  }

  function requestInteract() {
    if (!app.running) return;
    const target = nearestInteractableTarget();
    if (!target) return;
    if (target.category === "casino" || target.casinoMachineId) {
      app.casinoClient?.open(target);
      return;
    }
    app.interactSeq += 1;
    const actionPose = app.localPose || currentLocalPlayerFromSnapshot();
    const hint = actionPose ? attachActionPoseHint({}, actionPose) : {};
    const request = { t: "interact", targetId: target.id, seq: app.interactSeq, ...hint };
    if (app.role === "host") {
      host.applyInteractRequest(app.playerId, request);
      app.snapshot = makeSnapshot(app.hostState);
      return;
    }
    app.transport?.sendToHost(request);
  }

  function applyLocalRecoil(pose, weapon, angle) {
    if (!pose || !weapon?.recoil) return;
    pose.kx = (pose.kx || 0) - Math.cos(angle) * weapon.recoil;
    pose.ky = (pose.ky || 0) - Math.sin(angle) * weapon.recoil;
  }

  function tryLocalShoot(nowSec, inputState) {
    if (!app.localPose) return;
    const weaponId = WEAPONS[app.localWeapon] ? app.localWeapon : (WEAPONS[app.localPose.activeWeapon] ? app.localPose.activeWeapon : START_WEAPON);
    const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
    const wantsFire = weapon.holdToFire ? inputState.fire : inputState.firePressed;
    if (!wantsFire) return;
    const fireRateMult = Math.max(0.1, app.localPose.stats?.fireRateMult || 1);
    if (nowSec < (app.localCooldowns[weaponId] || 0)) return;
    app.localCooldowns[weaponId] = nowSec + 1 / (weapon.fireRate * fireRateMult);
    app.fireSeq += 1;
    app.localPose.angle = (Number.isFinite(inputState.aimX) && Number.isFinite(inputState.aimY))
      ? Math.atan2(inputState.aimY - app.localPose.y, inputState.aimX - app.localPose.x)
      : inputState.aimAngle;
    const payload = makeShootPayload(app.playerId, app.localPose, weaponId, app.fireSeq, inputState);
    const baseId = `${app.playerId}-${app.fireSeq}`;
    if (app.role === "guest") {
      app.predictedProjectiles.push(...makePredictedProjectile(baseId, app.playerId, weaponId, app.localPose, app.localPose.stats));
      applyLocalRecoil(app.localPose, weapon, inputState.aimAngle);
    }
    if (app.role === "host") fireWeapon(app.hostState, app.playerId, payload);
    else app.transport?.sendToHost({ t: "shoot", shoot: payload });
  }

  function sendGuestInput(inputState, now) {
    const key = inputTransportKey(inputState);
    const changed = key !== app.lastInputKey;
    const due = now - app.lastInputSent > 1000 / INPUT_RATE;
    if (!changed && !due && !inputState.firePressed) return false;
    app.lastInputKey = key;
    app.lastInputSent = now;
    app.transport?.sendToHost({ t: "input", input: clonePredictionInput(inputState) }, { channel: "input" });
    return true;
  }

  function updateGuest(dt, now, gameNow) {
    if (!app.localPose) return;
    const inputState = app.input.sample(app.localPose, app.camera);
    app.inputSeq = (app.inputSeq || 0) + 1;
    inputState.inputSeq = app.inputSeq;
    sendGuestInput(inputState, now);
    movePlayer(app.localPose, inputState, dt, app.snapshot?.location);
    inputState.aimAngle = (Number.isFinite(inputState.aimX) && Number.isFinite(inputState.aimY))
      ? Math.atan2(inputState.aimY - app.localPose.y, inputState.aimX - app.localPose.x)
      : inputState.aimAngle;
    app.localPose.angle = inputState.aimAngle;
    app.localPose.x = clamp(app.localPose.x, app.localPose.radius, WORLD.w - app.localPose.radius);
    app.localPose.y = clamp(app.localPose.y, app.localPose.radius, WORLD.h - app.localPose.radius);
    recordPredictionFrame(inputState, dt, now);
    tryLocalShoot(gameNow, inputState);
    updateLocalRenderPose(dt, "prediction_frame");
  }

  function resetGuestPose(index) {
    app.localInventory = createInventory([START_WEAPON]);
    app.localWeapon = START_WEAPON;
    app.localCooldowns = Object.create(null);
    app.localRenderPose = null;
    app.localCorrectionOffset = zeroCorrectionOffset("guest_reset");
    app.localVisualStats = { mode: "visual-shell", strategy: "correction-offset", reason: "guest_reset", driftPx: 0, snap: true, latency: "zero-local" };
  }

  return {
    currentLocalPlayerFromSnapshot,
    resetPredictionForLocationChange,
    syncLocalFromSnapshot,
    handleNetData,
    localInventoryWeapons,
    requestAbility,
    requestWeaponSlot,
    requestWeaponCycle,
    requestInteract,
    tryLocalShoot,
    updateGuest,
    sendGuestInput,
    updateLocalRenderPose,
    snapLocalRenderPose,
    resetGuestPose
  };
}
