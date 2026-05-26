import { visualEffectPriority } from "./visualEffects.js";

export const SNAPSHOT_SERVER_MESSAGE_LIMIT_BYTES = 64 * 1024;
export const SNAPSHOT_WARNING_BYTES = 52 * 1024;
export const SNAPSHOT_NETWORK_TARGET_BYTES = SNAPSHOT_WARNING_BYTES;
export const SNAPSHOT_RELAY_TARGET_BYTES = 44 * 1024;
export const SNAPSHOT_RELAY_STATE_LIMIT_BYTES = SNAPSHOT_WARNING_BYTES;
export const SNAPSHOT_EFFECT_LIMIT = 48;
export const SNAPSHOT_INTEREST_RADIUS = 820;
export const SNAPSHOT_HAZARD_RADIUS = 980;
export const SNAPSHOT_PICKUP_RADIUS = 760;
export const SNAPSHOT_FAR_ENTITY_RESERVE = 24;

function finiteNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function entityX(entity) {
  return finiteNumber(entity?.x ?? entity?.cx ?? entity?.x2, 0);
}

function entityY(entity) {
  return finiteNumber(entity?.y ?? entity?.cy ?? entity?.y2, 0);
}

function distSqToFocus(entity, focus) {
  if (!focus) return Number.POSITIVE_INFINITY;
  const dx = entityX(entity) - focus.x;
  const dy = entityY(entity) - focus.y;
  return dx * dx + dy * dy;
}

function resolveInterestFocus(snapshot, options = {}) {
  if (Number.isFinite(options.focusX) && Number.isFinite(options.focusY)) {
    return { id: options.focusPlayerId || null, x: options.focusX, y: options.focusY };
  }
  const players = Array.isArray(snapshot?.players) ? snapshot.players : [];
  const player = players.find((p) => p?.id === options.focusPlayerId) || players[0] || null;
  if (!player || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return null;
  return { id: player.id || null, x: player.x, y: player.y };
}

function effectInterestDistance(effect, focus) {
  if (!focus || !effect) return Number.POSITIVE_INFINITY;
  const points = [
    [effect.x, effect.y],
    [effect.x2, effect.y2],
    [effect.cx, effect.cy]
  ].filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!points.length) return Number.POSITIVE_INFINITY;
  return Math.min(...points.map(([x, y]) => {
    const dx = x - focus.x;
    const dy = y - focus.y;
    return dx * dx + dy * dy;
  }));
}

function sortByInterest(list, focus, options = {}) {
  const radius = Number.isFinite(options.radius) ? options.radius : SNAPSHOT_INTEREST_RADIUS;
  const radius2 = radius * radius;
  const priorityOf = typeof options.priority === "function" ? options.priority : (() => 0);
  const distanceOf = typeof options.distance === "function" ? options.distance : distSqToFocus;
  return (Array.isArray(list) ? list : []).map((item, index) => {
    const d2 = distanceOf(item, focus);
    const near = d2 <= radius2;
    return { item, index, near, d2, priority: priorityOf(item, focus) };
  }).sort((a, b) => {
    if (a.near !== b.near) return a.near ? -1 : 1;
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (a.d2 !== b.d2) return a.d2 - b.d2;
    return a.index - b.index;
  }).map((entry) => entry.item);
}

function interestTrimArray(owner, key, limit, stages, label = key) {
  const list = Array.isArray(owner?.[key]) ? owner[key] : null;
  if (!list || list.length <= limit) return false;
  owner[key] = list.slice(0, Math.max(0, limit));
  stages.push(`${label}:interest:${list.length}->${owner[key].length}`);
  return true;
}

function projectilePriority(projectile, focus) {
  let score = 0;
  if (projectile?.ownerId && focus?.id && projectile.ownerId !== focus.id) score += 4;
  if (projectile?.kind && /hostile|enemy|bullet|rocket|bomb|laser|orb/i.test(projectile.kind)) score += 2;
  if (Number.isFinite(projectile?.vx) && Number.isFinite(projectile?.vy) && focus) {
    const toFocusX = focus.x - entityX(projectile);
    const toFocusY = focus.y - entityY(projectile);
    const closing = toFocusX * projectile.vx + toFocusY * projectile.vy;
    if (closing > 0) score += 3;
  }
  return score;
}

function enemyPriority(enemy) {
  let score = 0;
  if (enemy?.elite) score += 4;
  if (enemy?.kind && /boss|charger|bomber|shooter|glitch|prism/i.test(enemy.kind)) score += 2;
  if ((enemy?.hp || 0) > 0) score += 1;
  return score;
}

function pickupPriority(item) {
  let score = 0;
  if (item?.rarity && /rare|epic|legend|boss/i.test(String(item.rarity))) score += 3;
  if (item?.rewardType || item?.kind === "weapon" || item?.kind === "ability") score += 2;
  return score;
}

function effectPriority(effect, focus) {
  return visualEffectPriority(effect) + (effectInterestDistance(effect, focus) <= SNAPSHOT_HAZARD_RADIUS * SNAPSHOT_HAZARD_RADIUS ? 2 : 0);
}

function stampInterestMeta(snapshot, meta) {
  const base = snapshot.budget && typeof snapshot.budget === "object" ? snapshot.budget : {};
  snapshot.budget = {
    ...base,
    interest: {
      ...(base.interest || {}),
      ...meta
    }
  };
}

function applyInterestPriority(snapshot, options = {}, stages = []) {
  const focus = resolveInterestFocus(snapshot, options);
  if (!focus) return { applied: false, focusPlayerId: options.focusPlayerId || null };
  const before = {
    enemies: Array.isArray(snapshot.enemies) ? snapshot.enemies.length : 0,
    projectiles: Array.isArray(snapshot.projectiles) ? snapshot.projectiles.length : 0,
    companions: Array.isArray(snapshot.companions) ? snapshot.companions.length : 0,
    effects: Array.isArray(snapshot.effects) ? snapshot.effects.length : 0
  };

  snapshot.projectiles = sortByInterest(snapshot.projectiles, focus, {
    radius: SNAPSHOT_HAZARD_RADIUS,
    priority: projectilePriority
  });
  snapshot.enemies = sortByInterest(snapshot.enemies, focus, {
    radius: SNAPSHOT_HAZARD_RADIUS,
    priority: enemyPriority
  });
  snapshot.companions = sortByInterest(snapshot.companions, focus, {
    radius: SNAPSHOT_INTEREST_RADIUS,
    priority: (c) => c?.ownerId === focus.id ? 3 : (c?.group ? 1 : 0)
  });
  snapshot.loot = sortByInterest(snapshot.loot, focus, { radius: SNAPSHOT_PICKUP_RADIUS, priority: pickupPriority });
  snapshot.rewardPickups = sortByInterest(snapshot.rewardPickups, focus, { radius: SNAPSHOT_PICKUP_RADIUS, priority: pickupPriority });
  snapshot.economyPickups = sortByInterest(snapshot.economyPickups, focus, { radius: SNAPSHOT_PICKUP_RADIUS, priority: pickupPriority });
  snapshot.interactables = sortByInterest(snapshot.interactables, focus, { radius: SNAPSHOT_PICKUP_RADIUS, priority: pickupPriority });
  snapshot.effects = sortByInterest(snapshot.effects, focus, {
    radius: SNAPSHOT_HAZARD_RADIUS,
    priority: effectPriority,
    distance: effectInterestDistance
  });

  const meta = {
    applied: true,
    focusPlayerId: focus.id || options.focusPlayerId || null,
    focusX: Math.round(focus.x),
    focusY: Math.round(focus.y),
    hazardRadius: SNAPSHOT_HAZARD_RADIUS,
    interestRadius: SNAPSHOT_INTEREST_RADIUS,
    pickupRadius: SNAPSHOT_PICKUP_RADIUS,
    counts: before
  };
  stampInterestMeta(snapshot, meta);
  stages.push(`interest:${meta.focusPlayerId || "focus"}`);
  return meta;
}

function applyRelayInterestPreTrim(snapshot, stages) {
  let changed = false;
  changed = interestTrimArray(snapshot, "effects", 24, stages, "effects") || changed;
  changed = interestTrimArray(snapshot, "companions", 72, stages, "companions") || changed;
  changed = interestTrimArray(snapshot, "projectiles", 144, stages, "projectiles") || changed;
  changed = interestTrimArray(snapshot, "enemies", 128, stages, "enemies") || changed;
  changed = interestTrimArray(snapshot, "loot", 80, stages, "loot") || changed;
  changed = interestTrimArray(snapshot, "rewardPickups", 80, stages, "rewardPickups") || changed;
  changed = interestTrimArray(snapshot, "economyPickups", 80, stages, "economyPickups") || changed;
  changed = interestTrimArray(snapshot, "interactables", 80, stages, "interactables") || changed;
  return changed;
}


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
    inputSeq: Math.max(0, Math.floor(player.inputSeq || 0)),
    inputStream: player.inputStream || null,
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
  const mode = options.mode || "default";
  const focusPlayerId = options.focusPlayerId || null;
  const originalBytes = estimateStatePacketBytes(snapshot);
  const stages = [];

  if (originalBytes <= targetBytes && !focusPlayerId) {
    return {
      packet: { t: "state", snapshot },
      meta: {
        bytes: originalBytes,
        originalBytes,
        warningBytes: SNAPSHOT_WARNING_BYTES,
        targetBytes,
        limitBytes,
        mode,
        focusPlayerId,
        interest: { applied: false, focusPlayerId },
        degraded: false,
        emergency: false,
        stages: []
      }
    };
  }

  const working = cloneJson(snapshot);
  const interestMeta = applyInterestPriority(working, options, stages);
  if (mode === "relay") applyRelayInterestPreTrim(working, stages);

  const interestBytes = estimateStatePacketBytes(working);
  if (interestBytes <= targetBytes) {
    return finalizeNetworkPacket(working, {
      bytes: interestBytes,
      originalBytes,
      warningBytes: SNAPSHOT_WARNING_BYTES,
      targetBytes,
      limitBytes,
      mode,
      focusPlayerId,
      interest: interestMeta,
      degraded: interestBytes < originalBytes || stages.length > 0,
      emergency: false,
      stages
    }, limitBytes);
  }

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
    mode,
    focusPlayerId,
    interest: interestMeta,
    degraded: true,
    emergency,
    stages
  };
  return finalizeNetworkPacket(working, meta, limitBytes);
}
