import { clamp, dist2 } from "../core/math.js";
import { DASH_DENIAL_RECONCILE_MS, GAME_SPEED, INPUT_RATE, WORLD } from "../core/constants.js";
import { START_WEAPON, WEAPONS } from "../data/weapons.js";
import { makePredictedProjectile, resetRendererSmooth } from "../renderer.js";
import { fireWeapon } from "../game/combat.js";
import { makeShootPayload, movePlayer } from "../game/simulation.js";
import { createInventory } from "../game/inventory.js";
import { canPredictDash, predictLocalDash } from "../game/abilities.js";
import { makeSnapshot } from "../game/state.js";
import { roomGeometryIdentityMatches } from "../game/roomGeometry.js";

const HOST_IMPULSE_RECONCILE_D2 = 14 * 14;
const HOST_SMOOTH_RECONCILE_D2 = 24 * 24;
const HOST_HARD_RECONCILE_D2 = 128 * 128;

export function createClientRuntime(app, { session, host, upgrades } = {}) {
  function currentLocalPlayerFromSnapshot() {
    const fromSnapshot = app.snapshot?.players?.find((p) => p.id === app.playerId);
    if (fromSnapshot) return fromSnapshot;
    return app.localPose;
  }

  function resetPredictionForLocationChange() {
    app.predictedProjectiles = [];
    resetRendererSmooth(app.renderer);
    app.camera.ready = false;
    app.input.resetKeys();
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
      app.localPose = { ...me, inventory: app.localInventory, upgrades: me.upgrades || { choices: [] }, stats: me.stats || {}, activeWeapon: app.localWeapon, vx: 0, vy: 0, kx: Number.isFinite(me.kx) ? me.kx : 0, ky: Number.isFinite(me.ky) ? me.ky : 0, radius: 13, orbiterSlowMult: me.orbiterPressure?.slowMult || 1, _hostImpulseSeq: me.hostImpulseSeq || 0 };
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
    const hostImpulseSeq = Number.isFinite(me.hostImpulseSeq) ? me.hostImpulseSeq : 0;
    const impulseChanged = hostImpulseSeq !== (app.localPose._hostImpulseSeq || 0);
    if (impulseChanged) app.localPose._hostImpulseSeq = hostImpulseSeq;
    const dx = me.x - app.localPose.x;
    const dy = me.y - app.localPose.y;
    const d2 = dx * dx + dy * dy;
    const dashPredictionAge = app.localPose._localDashPredictedAt ? performance.now() - app.localPose._localDashPredictedAt : 0;
    const staleDeniedDash = app.localPose._localDashPredictedAt && dashPredictionAge > DASH_DENIAL_RECONCILE_MS && (me.ability?.dash?.cooldownLeft || 0) <= 0 && d2 > 400;
    const impulseDrift = impulseChanged && d2 > HOST_IMPULSE_RECONCILE_D2;
    if (locationChanged || staleDeniedDash || impulseDrift || d2 > HOST_HARD_RECONCILE_D2) {
      app.localPose.x = me.x;
      app.localPose.y = me.y;
      app.localPose.vx = Number.isFinite(me.vx) ? me.vx : 0;
      app.localPose.vy = Number.isFinite(me.vy) ? me.vy : 0;
      app.localPose.kx = Number.isFinite(me.kx) ? me.kx : 0;
      app.localPose.ky = Number.isFinite(me.ky) ? me.ky : 0;
      app.localPose._localDashPredictedAt = 0;
    } else if (d2 > HOST_SMOOTH_RECONCILE_D2) {
      app.localPose.x += dx * 0.35;
      app.localPose.y += dy * 0.35;
      if (impulseChanged) {
        app.localPose.kx = Number.isFinite(me.kx) ? me.kx : app.localPose.kx;
        app.localPose.ky = Number.isFinite(me.ky) ? me.ky : app.localPose.ky;
      }
    } else if (impulseChanged) {
      app.localPose.kx = Number.isFinite(me.kx) ? me.kx : app.localPose.kx;
      app.localPose.ky = Number.isFinite(me.ky) ? me.ky : app.localPose.ky;
    }
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
    app.abilitySeq += 1;

    if (app.role === "host") {
      host.applyAbilityRequest(app.playerId, { ability: "dash", input: inputState, seq: app.abilitySeq });
      app.snapshot = makeSnapshot(app.hostState);
      return;
    }

    const nowSec = (performance.now() / 1000) * GAME_SPEED;
    if (!canPredictDash(app.localPose, nowSec)) return;
    predictLocalDash(app.localPose, inputState, nowSec, app.snapshot?.location);
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
    const pose = currentLocalPlayerFromSnapshot();
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
    const request = { t: "interact", targetId: target.id, seq: app.interactSeq };
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
    if (!app.localPose || !inputState.fire) return;
    const weaponId = WEAPONS[app.localWeapon] ? app.localWeapon : (WEAPONS[app.localPose.activeWeapon] ? app.localPose.activeWeapon : START_WEAPON);
    const weapon = WEAPONS[weaponId] || WEAPONS[START_WEAPON];
    const fireRateMult = Math.max(0.1, app.localPose.stats?.fireRateMult || 1);
    if (nowSec < (app.localCooldowns[weaponId] || 0)) return;
    app.localCooldowns[weaponId] = nowSec + 1 / (weapon.fireRate * fireRateMult);
    app.fireSeq += 1;
    app.localPose.angle = inputState.aimAngle;
    const payload = makeShootPayload(app.playerId, app.localPose, weaponId, app.fireSeq);
    const baseId = `${app.playerId}-${app.fireSeq}`;
    if (app.role === "guest") {
      app.predictedProjectiles.push(...makePredictedProjectile(baseId, app.playerId, weaponId, app.localPose, app.localPose.stats));
      applyLocalRecoil(app.localPose, weapon, inputState.aimAngle);
    }
    if (app.role === "host") fireWeapon(app.hostState, app.playerId, payload);
    else app.transport?.sendToHost({ t: "shoot", shoot: payload });
  }

  function updateGuest(dt, now, gameNow) {
    if (!app.localPose) return;
    const inputState = app.input.sample(app.localPose, app.camera);
    movePlayer(app.localPose, inputState, dt, app.snapshot?.location);
    app.localPose.angle = inputState.aimAngle;
    app.localPose.x = clamp(app.localPose.x, app.localPose.radius, WORLD.w - app.localPose.radius);
    app.localPose.y = clamp(app.localPose.y, app.localPose.radius, WORLD.h - app.localPose.radius);
    tryLocalShoot(gameNow, inputState);

    if (now - app.lastInputSent > 1000 / INPUT_RATE) {
      app.lastInputSent = now;
      app.transport?.sendToHost({ t: "input", input: inputState });
    }
  }

  function resetGuestPose(index) {
    app.localInventory = createInventory([START_WEAPON]);
    app.localWeapon = START_WEAPON;
    app.localCooldowns = Object.create(null);
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
    resetGuestPose
  };
}
