import { visualEffectPriority } from "./visualEffects.js";

export const SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES = 64 * 1024;
export const SNAPSHOT_WARNING_BYTES = 52 * 1024;
export const SNAPSHOT_NETWORK_TARGET_BYTES = SNAPSHOT_WARNING_BYTES;
export const SNAPSHOT_RELAY_TARGET_BYTES = 44 * 1024;
export const SNAPSHOT_RELAY_STATE_LIMIT_BYTES = SNAPSHOT_WARNING_BYTES;
export const SNAPSHOT_EFFECT_LIMIT = 48;

function estimateJsonBytes(value) {
  try {
    const json = JSON.stringify(value);
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(json).length;
    return json.length;
  } catch {
    return 0;
  }
}

function cloneJson(value) {
  if (!value || typeof value !== "object") return value;
  try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
}

function limitArray(owner, key, limit, stages, label = key) {
  const list = Array.isArray(owner?.[key]) ? owner[key] : null;
  if (!list || list.length <= limit) return false;
  owner[key] = list.slice(0, Math.max(0, limit));
  stages.push(`${label}:${list.length}->${owner[key].length}`);
  return true;
}

function dropField(owner, key, stages, label = key) {
  if (!owner || owner[key] == null) return false;
  delete owner[key];
  stages.push(`drop:${label}`);
  return true;
}

function stripLocationPlan(snapshot, stages) {
  const loc = snapshot?.location;
  if (!loc || typeof loc !== "object") return false;
  let changed = false;
  if (Array.isArray(loc.interactablePlan) && loc.interactablePlan.length) {
    loc.interactablePlan = [];
    changed = true;
  }
  if (Array.isArray(loc.pendingRoomModifiers) && loc.pendingRoomModifiers.length) {
    loc.pendingRoomModifiers = [];
    changed = true;
  }
  if (loc.modifierStack) {
    loc.modifierStack = null;
    changed = true;
  }
  if (loc.environmentTheme) {
    loc.environmentTheme = null;
    changed = true;
  }
  if (changed) stages.push("locationPlan:compact");
  return changed;
}

function stripPlayerStatSnapshots(snapshot, stages) {
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  let count = 0;
  for (const player of players) {
    if (!player || player.statSnapshot == null) continue;
    player.statSnapshot = null;
    count += 1;
  }
  if (count > 0) stages.push(`playerStatSnapshots:${count}->0`);
  return count > 0;
}

function stripPlayerDerivedStats(snapshot, stages) {
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  let count = 0;
  for (const player of players) {
    if (!player) continue;
    if (player.stats) {
      player.stats = {};
      count += 1;
    }
  }
  if (count > 0) stages.push(`playerStats:${count}->0`);
  return count > 0;
}

function trimEffectBudgetMeta(snapshot, before) {
  if (!snapshot?.budget?.effects || !Array.isArray(snapshot.effects)) return;
  const dropped = Math.max(0, before - snapshot.effects.length);
  snapshot.budget.effects = {
    ...snapshot.budget.effects,
    sent: snapshot.effects.length,
    dropped: Math.max(snapshot.budget.effects.dropped || 0, dropped),
    budgeted: dropped > 0 || !!snapshot.budget.effects.budgeted
  };
}

function compactEffects(snapshot, limit, stages) {
  const before = Array.isArray(snapshot?.effects) ? snapshot.effects.length : 0;
  const changed = limitArray(snapshot, "effects", limit, stages, "effects");
  if (changed) trimEffectBudgetMeta(snapshot, before);
  return changed;
}

function compactMiscPickups(snapshot, limit, stages) {
  let changed = false;
  changed = limitArray(snapshot, "loot", limit, stages, "loot") || changed;
  changed = limitArray(snapshot, "rewardPickups", limit, stages, "rewardPickups") || changed;
  changed = limitArray(snapshot, "economyPickups", limit, stages, "economyPickups") || changed;
  changed = limitArray(snapshot, "interactables", limit, stages, "interactables") || changed;
  changed = limitArray(snapshot, "portals", limit, stages, "portals") || changed;
  return changed;
}

function minimalLocation(location = {}) {
  return {
    id: location.id || null,
    name: location.name || "GRID",
    index: location.index || 0,
    runDepth: location.runDepth || location.index || 0,
    loopIndex: location.loopIndex || 0,
    roomInLoop: location.roomInLoop || 0,
    roomSequenceIndex: location.roomSequenceIndex || 0,
    baseRoomId: location.baseRoomId || location.id || null,
    resolvedRoomId: location.resolvedRoomId || location.id || null,
    category: location.category || "normal",
    tags: Array.isArray(location.tags) ? location.tags.slice(0, 8) : [],
    layoutId: location.layoutId || "open_arena",
    layoutVersion: location.layoutVersion || 1,
    geometryHash: location.geometryHash || null,
    modifiers: Array.isArray(location.modifiers) ? location.modifiers.slice(0, 8) : [],
    interactablePlan: [],
    pendingRoomModifiers: [],
    time: location.time || 0,
    accent: location.accent || "green",
    biomeId: location.biomeId || "grid",
    biomeName: location.biomeName || "BLACK GRID",
    gridStep: location.gridStep || 80
  };
}

function minimalPlayer(player = {}) {
  return {
    id: player.id,
    name: player.name || player.id,
    x: player.x,
    y: player.y,
    angle: player.angle || 0,
    hp: player.hp,
    maxHp: player.maxHp,
    activeWeapon: player.activeWeapon,
    inventory: player.inventory || null,
    abilityInventory: player.abilityInventory || null,
    economy: player.economy || null,
    upgrades: player.upgrades || null,
    stats: {},
    statSnapshot: null,
    shield: player.shield || null,
    damageImpact: player.damageImpact || null,
    orbiterPressure: player.orbiterPressure || null,
    ability: player.ability || null,
    companions: player.companions || null,
    skin: player.skin,
    netStatus: player.netStatus || "online",
    disconnected: !!player.disconnected,
    disconnectedAt: player.disconnectedAt || 0,
    hostImpulseSeq: player.hostImpulseSeq || 0,
    lastHostImpulse: player.lastHostImpulse || null,
    vx: player.vx || 0,
    vy: player.vy || 0,
    kx: player.kx || 0,
    ky: player.ky || 0
  };
}

function minimalEnemy(enemy = {}) {
  return {
    id: enemy.id,
    kind: enemy.kind,
    x: enemy.x,
    y: enemy.y,
    hp: enemy.hp,
    armor: enemy.armor || null,
    elite: enemy.elite || null,
    status: enemy.status || null,
    projectileDefenseFacingX: enemy.projectileDefenseFacingX ?? null,
    projectileDefenseFacingY: enemy.projectileDefenseFacingY ?? null
  };
}

function minimalProjectile(projectile = {}) {
  return {
    id: projectile.id,
    ownerId: projectile.ownerId,
    weaponId: projectile.weaponId,
    kind: projectile.kind,
    x: projectile.x,
    y: projectile.y,
    vx: projectile.vx,
    vy: projectile.vy,
    radius: projectile.radius,
    color: projectile.color
  };
}

function applyEmergencySnapshot(snapshot, stages) {
  stages.push("emergency:coreSnapshot");
  snapshot.location = minimalLocation(snapshot.location || {});
  snapshot.players = (Array.isArray(snapshot.players) ? snapshot.players : []).map((player) => minimalPlayer(player));
  snapshot.enemies = (Array.isArray(snapshot.enemies) ? snapshot.enemies : []).slice(0, 96).map((enemy) => minimalEnemy(enemy));
  snapshot.projectiles = (Array.isArray(snapshot.projectiles) ? snapshot.projectiles : []).slice(0, 64).map((projectile) => minimalProjectile(projectile));
  snapshot.companions = (Array.isArray(snapshot.companions) ? snapshot.companions : []).slice(0, 48);
  snapshot.loot = (Array.isArray(snapshot.loot) ? snapshot.loot : []).slice(0, 48);
  snapshot.rewardPickups = (Array.isArray(snapshot.rewardPickups) ? snapshot.rewardPickups : []).slice(0, 48);
  snapshot.economyPickups = (Array.isArray(snapshot.economyPickups) ? snapshot.economyPickups : []).slice(0, 48);
  snapshot.interactables = (Array.isArray(snapshot.interactables) ? snapshot.interactables : []).slice(0, 48);
  snapshot.portals = (Array.isArray(snapshot.portals) ? snapshot.portals : []).slice(0, 8);
  snapshot.effects = [];
  snapshot.events = [];
  snapshot.dev = null;
  snapshot.director = snapshot.director ? {
    active: !!snapshot.director.active,
    wave: snapshot.director.wave || 0,
    budget: snapshot.director.budget || 0,
    totalBudget: snapshot.director.totalBudget || 0,
    enemyCap: snapshot.director.enemyCap || 0
  } : null;
}

function stampNetworkBudget(snapshot, meta) {
  const base = snapshot.budget && typeof snapshot.budget === "object" ? snapshot.budget : {};
  snapshot.budget = {
    ...base,
    warningBytes: SNAPSHOT_WARNING_BYTES,
    limitBytes: SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES,
    network: { ...meta }
  };
  for (let i = 0; i < 2; i += 1) {
    const bytes = estimateStatePacketBytes(snapshot);
    snapshot.budget.network.bytes = bytes;
    snapshot.budget.bytes = estimateSnapshotBytes(snapshot);
    snapshot.budget.nearLimit = bytes >= SNAPSHOT_WARNING_BYTES;
    snapshot.budget.overLimit = bytes >= SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES;
  }
}

function finalizeNetworkPacket(snapshot, meta, limitBytes) {
  stampNetworkBudget(snapshot, meta);
  let bytes = estimateStatePacketBytes(snapshot);
  if (bytes > limitBytes && snapshot.budget?.network) {
    delete snapshot.budget.network;
    bytes = estimateStatePacketBytes(snapshot);
    snapshot.budget.bytes = estimateSnapshotBytes(snapshot);
    snapshot.budget.nearLimit = bytes >= SNAPSHOT_WARNING_BYTES;
    snapshot.budget.overLimit = bytes >= SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES;
  }
  const packet = { t: "state", snapshot };
  return {
    packet,
    meta: {
      ...meta,
      bytes,
      metadataDropped: !snapshot.budget?.network
    }
  };
}

export function budgetEffects(effects, limit = SNAPSHOT_EFFECT_LIMIT) {
  const list = Array.isArray(effects) ? effects : [];
  if (list.length <= limit) return { items: list.map((e) => ({ ...e })), meta: { total: list.length, sent: list.length, dropped: 0, budgeted: false } };
  const indexed = list.map((effect, index) => ({ effect, index, priority: visualEffectPriority(effect) }));
  indexed.sort((a, b) => (b.priority - a.priority) || (b.index - a.index));
  const picked = indexed.slice(0, limit).sort((a, b) => a.index - b.index).map((entry) => ({ ...entry.effect }));
  return { items: picked, meta: { total: list.length, sent: picked.length, dropped: Math.max(0, list.length - picked.length), budgeted: true } };
}

export function estimateSnapshotBytes(snapshot) {
  return estimateJsonBytes(snapshot);
}

export function estimateStatePacketBytes(snapshot) {
  return estimateJsonBytes({ t: "state", snapshot });
}

export function buildSnapshotBudgetMeta(snapshot, extra = {}) {
  const bytes = estimateSnapshotBytes(snapshot);
  return {
    bytes,
    warningBytes: SNAPSHOT_WARNING_BYTES,
    limitBytes: SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES,
    nearLimit: bytes >= SNAPSHOT_WARNING_BYTES,
    overLimit: bytes >= SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES,
    ...extra
  };
}

export function buildNetworkStatePacket(snapshot, options = {}) {
  const targetBytes = Number.isFinite(options.targetBytes) ? options.targetBytes : SNAPSHOT_NETWORK_TARGET_BYTES;
  const limitBytes = Number.isFinite(options.limitBytes) ? options.limitBytes : SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES;
  const originalBytes = estimateStatePacketBytes(snapshot);
  if (originalBytes <= targetBytes) {
    return {
      packet: { t: "state", snapshot },
      meta: {
        bytes: originalBytes,
        originalBytes,
        warningBytes: SNAPSHOT_WARNING_BYTES,
        targetBytes,
        limitBytes,
        mode: options.mode || "default",
        degraded: false,
        emergency: false,
        stages: []
      }
    };
  }

  const working = cloneJson(snapshot);
  const stages = [];
  const measure = () => estimateStatePacketBytes(working);
  const maybeDone = () => measure() <= targetBytes;

  dropField(working, "dev", stages, "dev");
  if (!maybeDone()) limitArray(working, "events", 24, stages, "events");
  if (!maybeDone()) compactEffects(working, 32, stages);
  if (!maybeDone()) stripLocationPlan(working, stages);
  if (!maybeDone()) limitArray(working, "events", 8, stages, "events");
  if (!maybeDone()) compactEffects(working, 16, stages);
  if (!maybeDone()) stripPlayerStatSnapshots(working, stages);
  if (!maybeDone()) limitArray(working, "projectiles", 192, stages, "projectiles");
  if (!maybeDone()) limitArray(working, "enemies", 180, stages, "enemies");
  if (!maybeDone()) limitArray(working, "companions", 96, stages, "companions");
  if (!maybeDone()) compactMiscPickups(working, 96, stages);
  if (!maybeDone()) stripPlayerDerivedStats(working, stages);
  if (!maybeDone()) limitArray(working, "projectiles", 128, stages, "projectiles");
  if (!maybeDone()) limitArray(working, "enemies", 140, stages, "enemies");
  if (!maybeDone()) compactEffects(working, 0, stages);
  if (!maybeDone()) limitArray(working, "events", 0, stages, "events");
  if (!maybeDone()) limitArray(working, "projectiles", 96, stages, "projectiles");
  if (!maybeDone()) limitArray(working, "enemies", 96, stages, "enemies");
  if (!maybeDone()) limitArray(working, "companions", 64, stages, "companions");
  if (!maybeDone()) compactMiscPickups(working, 64, stages);

  let emergency = false;
  if (measure() > limitBytes) {
    emergency = true;
    applyEmergencySnapshot(working, stages);
  }

  const meta = {
    bytes: measure(),
    originalBytes,
    warningBytes: SNAPSHOT_WARNING_BYTES,
    targetBytes,
    limitBytes,
    mode: options.mode || "default",
    degraded: true,
    emergency,
    stages
  };
  return finalizeNetworkPacket(working, meta, limitBytes);
}
