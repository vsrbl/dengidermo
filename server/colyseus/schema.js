'use strict';

const schema = require('@colyseus/schema');
const { Schema, MapSchema, defineTypes } = schema;

class PlayerState extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.hp = 100;
    this.maxHp = 100;
    this.angle = 0;
    this.name = '';
    this.sessionId = '';
    this.online = true;
    this.lastInputSeq = 0;
    this.lastProcessedInputSeq = 0;
    this.serverTick = 0;
    this.vx = 0;
    this.vy = 0;
  }
}

defineTypes(PlayerState, {
  x: 'number',
  y: 'number',
  hp: 'number',
  maxHp: 'number',
  angle: 'number',
  name: 'string',
  sessionId: 'string',
  online: 'boolean',
  lastInputSeq: 'number',
  lastProcessedInputSeq: 'number',
  serverTick: 'number',
  vx: 'number',
  vy: 'number'
});

class EnemyState extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.hp = 40;
  }
}

defineTypes(EnemyState, {
  x: 'number',
  y: 'number',
  hp: 'number'
});

class ProjectileState extends Schema {
  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.ownerId = '';
  }
}

defineTypes(ProjectileState, {
  x: 'number',
  y: 'number',
  vx: 'number',
  vy: 'number',
  ownerId: 'string'
});

class ArenaRoomState extends Schema {
  constructor() {
    super();
    this.tick = 0;
    this.timeMs = 0;
    this.serverHz = 60;
    this.authority = 'server';
    this.players = new MapSchema();
    this.enemies = new MapSchema();
    this.projectiles = new MapSchema();
  }
}

defineTypes(ArenaRoomState, {
  tick: 'number',
  timeMs: 'number',
  serverHz: 'number',
  authority: 'string',
  players: { map: PlayerState },
  enemies: { map: EnemyState },
  projectiles: { map: ProjectileState }
});

function upsertMapEntry(map, key, Type) {
  let item = map.get(key);
  if (!item) {
    item = new Type();
    map.set(key, item);
  }
  return item;
}

function syncArenaToSchema(schemaState, arena, options = {}) {
  const syncFastCombat = options.syncFastCombat !== false;
  schemaState.tick = arena.tick;
  schemaState.timeMs = Math.round(arena.timeMs);

  for (const [id, source] of Object.entries(arena.players)) {
    const target = upsertMapEntry(schemaState.players, id, PlayerState);
    target.x = source.x;
    target.y = source.y;
    target.hp = source.hp;
    target.maxHp = 100;
    target.angle = Number.isFinite(source.angle) ? source.angle : 0;
    target.vx = Number.isFinite(source.vx) ? source.vx : 0;
    target.vy = Number.isFinite(source.vy) ? source.vy : 0;
    target.name = source.name || id;
    target.sessionId = source.sessionId || '';
    target.online = !!source.online;
    target.lastInputSeq = source.lastInputSeq;
    target.lastProcessedInputSeq = Number.isFinite(source.lastProcessedInputSeq) ? source.lastProcessedInputSeq : 0;
    target.serverTick = Number.isFinite(source.serverTick) ? source.serverTick : arena.tick;
  }
  for (const id of Array.from(schemaState.players.keys())) {
    if (!arena.players[id]) schemaState.players.delete(id);
  }

  if (syncFastCombat) {
    for (const [id, source] of Object.entries(arena.enemies)) {
      const target = upsertMapEntry(schemaState.enemies, id, EnemyState);
      target.x = source.x;
      target.y = source.y;
      target.hp = source.hp;
    }
    for (const id of Array.from(schemaState.enemies.keys())) {
      if (!arena.enemies[id]) schemaState.enemies.delete(id);
    }

    for (const [id, source] of Object.entries(arena.projectiles)) {
      const target = upsertMapEntry(schemaState.projectiles, id, ProjectileState);
      target.x = source.x;
      target.y = source.y;
      target.vx = source.vx || 0;
      target.vy = source.vy || 0;
      target.ownerId = source.ownerId;
    }
    for (const id of Array.from(schemaState.projectiles.keys())) {
      if (!arena.projectiles[id]) schemaState.projectiles.delete(id);
    }
  } else {
    for (const id of Array.from(schemaState.enemies.keys())) schemaState.enemies.delete(id);
    for (const id of Array.from(schemaState.projectiles.keys())) schemaState.projectiles.delete(id);
  }
}

module.exports = {
  ArenaRoomState,
  PlayerState,
  EnemyState,
  ProjectileState,
  syncArenaToSchema
};
