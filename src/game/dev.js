import { PLAYER_HP } from "../core/constants.js";

const DEV_FLASH_TIME = 1.35;
const CALM = Object.freeze({
  spawnCapMult: 0.28,
  spawnBatchMult: 0.34,
  spawnIntervalMult: 2.85,
  enemySpeedMult: 0.62,
  enemyDamageMult: 0.42,
  portalDelayMult: 0.35,
  portalHoldMult: 0.72,
  minCap: 4,
  maxCap: 10,
  minBatch: 1
});
const NORMAL = Object.freeze({
  spawnCapMult: 1,
  spawnBatchMult: 1,
  spawnIntervalMult: 1,
  enemySpeedMult: 1,
  enemyDamageMult: 1,
  portalDelayMult: 1,
  portalHoldMult: 1,
  minCap: 0,
  maxCap: Infinity,
  minBatch: 1
});

function isEnabled(state) {
  return !!state?.dev?.enabled;
}

function isCalm(state) {
  return isEnabled(state) && !!state.dev.calm;
}

function tuning(state) {
  return isCalm(state) ? CALM : NORMAL;
}

function flash(state, text) {
  if (!isEnabled(state)) return;
  state.dev.flash = String(text || "DEV").toUpperCase().slice(0, 42);
  state.dev.flashT = DEV_FLASH_TIME;
}

export function installDevMode(state, config = {}) {
  if (!config?.enabled) return state;
  state.dev = {
    enabled: true,
    access: config.access || "secret-link",
    profile: config.profile || "calm",
    calm: config.calm !== false,
    god: !!config.god,
    spawnsPaused: !!config.spawnsPaused,
    showHud: config.showHud !== false,
    commands: 0,
    flash: "DEV MODE",
    flashT: DEV_FLASH_TIME
  };
  return state;
}

export function hasDevMode(state) {
  return isEnabled(state);
}

export function isDevGod(state) {
  return isEnabled(state) && !!state.dev.god;
}

export function areDevSpawnsPaused(state) {
  return isEnabled(state) && !!state.dev.spawnsPaused;
}

export function devSpawnCap(state, normalCap) {
  const t = tuning(state);
  const cap = Math.floor(normalCap * t.spawnCapMult);
  return Math.max(t.minCap, Math.min(t.maxCap, cap));
}

export function devSpawnBatch(state, normalBatch) {
  const t = tuning(state);
  return Math.max(t.minBatch, Math.floor(normalBatch * t.spawnBatchMult));
}

export function devSpawnInterval(state, normalInterval) {
  return Math.max(0.25, normalInterval * tuning(state).spawnIntervalMult);
}

export function devEnemySpeedMult(state) {
  return tuning(state).enemySpeedMult;
}

export function devEnemyDamageMult(state) {
  return tuning(state).enemyDamageMult;
}

export function devPortalDelay(state, normalDelay) {
  return Math.max(1.2, normalDelay * tuning(state).portalDelayMult);
}

export function devPortalHold(state, normalHold) {
  return Math.max(0.45, normalHold * tuning(state).portalHoldMult);
}

export function tickDevMode(state, dt) {
  if (!isEnabled(state)) return;
  state.dev.flashT = Math.max(0, (state.dev.flashT || 0) - dt);
}

export function applyDevPlayerGuards(state) {
  if (!isDevGod(state)) return;
  for (const p of Object.values(state.players || {})) {
    if (!p) continue;
    p.maxHp = Math.max(p.maxHp || PLAYER_HP, PLAYER_HP);
    p.hp = Math.max(1, p.hp || 1);
    p.deadTimer = 0;
  }
}

export function applyDevCommand(state, command) {
  if (!isEnabled(state)) return false;
  const cmd = String(command || "").toLowerCase();
  state.dev.commands = (state.dev.commands || 0) + 1;

  if (cmd === "toggle-spawns") {
    state.dev.spawnsPaused = !state.dev.spawnsPaused;
    flash(state, `SPAWN ${state.dev.spawnsPaused ? "OFF" : "ON"}`);
    return true;
  }

  if (cmd === "clear-hostiles") {
    state.enemies = {};
    state.projectiles = {};
    state.effects = [];
    flash(state, "CLEAR HOSTILES");
    return true;
  }

  if (cmd === "toggle-god") {
    state.dev.god = !state.dev.god;
    flash(state, `GOD ${state.dev.god ? "ON" : "OFF"}`);
    return true;
  }

  if (cmd === "toggle-calm") {
    state.dev.calm = !state.dev.calm;
    flash(state, `CALM ${state.dev.calm ? "ON" : "OFF"}`);
    return true;
  }

  if (cmd === "ready-portal") {
    state.portalReadyAt = Math.min(state.portalReadyAt || 0, state.locationTime || 0);
    flash(state, "PORTAL READY");
    return true;
  }

  return false;
}

export function devSnapshot(state) {
  if (!isEnabled(state) || state.dev.showHud === false) return null;
  return {
    enabled: true,
    profile: state.dev.profile || "calm",
    calm: !!state.dev.calm,
    god: !!state.dev.god,
    spawnsPaused: !!state.dev.spawnsPaused,
    flash: state.dev.flashT > 0 ? state.dev.flash || "" : "",
    commands: state.dev.commands || 0
  };
}
