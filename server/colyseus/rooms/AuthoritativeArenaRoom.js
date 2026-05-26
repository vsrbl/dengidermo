'use strict';

const { Room } = require('@colyseus/core');
const {
  FIXED_DT_MS,
  addPlayer,
  applyInput,
  compactSnapshot,
  createArenaState,
  markPlayerOffline,
  removePlayer,
  stepArena
} = require('../../authoritative/arenaCore');
const { ArenaRoomState, syncArenaToSchema } = require('../schema');

const MAX_CLIENTS = 4;
const RECONNECT_GRACE_SECONDS = 20;
const PATCH_RATE_MS = 1000 / 60;

function slotName(index) {
  return `p${index + 1}`;
}

class AuthoritativeArenaRoom extends Room {
  constructor(...args) {
    super(...args);
    this.maxClients = MAX_CLIENTS;
    this.autoDispose = true;
    this.sessionToPlayerId = new Map();
    this.playerIdToSession = new Map();
    this.arena = null;
  }

  onCreate(options = {}) {
    this.arena = createArenaState({ seed: options.seed || Date.now(), enemyCount: options.enemyCount ?? 5 });
    this.setState(new ArenaRoomState());
    this.setPatchRate(PATCH_RATE_MS);
    this.setMetadata({ mode: 'authoritative-colyseus-spike', maxClients: MAX_CLIENTS });

    this.onMessage('input', (client, payload) => this.handleInput(client, payload));
    this.onMessage('cmd', (client, payload) => this.handleCommand(client, payload));
    this.onMessage('debugSnapshot', (client) => client.send('debugSnapshot', compactSnapshot(this.arena)));

    this.setSimulationInterval(() => this.update(), FIXED_DT_MS);
    syncArenaToSchema(this.state, this.arena);
  }

  allocatePlayerId(preferredId) {
    if (preferredId && /^p[1-4]$/.test(preferredId) && !this.playerIdToSession.has(preferredId)) {
      return preferredId;
    }
    for (let i = 0; i < MAX_CLIENTS; i += 1) {
      const id = slotName(i);
      if (!this.playerIdToSession.has(id)) return id;
    }
    return null;
  }

  onJoin(client, options = {}) {
    const playerId = this.allocatePlayerId(options.playerId);
    if (!playerId) {
      client.error(4001, 'room full');
      client.leave();
      return;
    }

    client.userData = client.userData || {};
    client.userData.playerId = playerId;
    client.userData.name = options.name || playerId;
    this.sessionToPlayerId.set(client.sessionId, playerId);
    this.playerIdToSession.set(playerId, client.sessionId);
    addPlayer(this.arena, playerId, { sessionId: client.sessionId, name: options.name || playerId });
    syncArenaToSchema(this.state, this.arena);

    client.send('joined', {
      playerId,
      roomId: this.roomId,
      authority: 'server',
      tickRate: 60,
      patchRate: 60,
      protocol: 'colyseus-authoritative-spike-v1'
    });
    this.broadcast('serverEvent', { type: 'player_joined', playerId }, { except: client });
  }

  async onLeave(client, consented) {
    const playerId = this.sessionToPlayerId.get(client.sessionId) || client.userData?.playerId;
    if (!playerId) return;

    markPlayerOffline(this.arena, playerId);
    syncArenaToSchema(this.state, this.arena);
    this.broadcast('serverEvent', { type: 'player_offline', playerId });

    if (consented) {
      this.forgetPlayer(client.sessionId, playerId);
      removePlayer(this.arena, playerId);
      syncArenaToSchema(this.state, this.arena);
      this.broadcast('serverEvent', { type: 'player_left', playerId });
      return;
    }

    try {
      await this.allowReconnection(client, RECONNECT_GRACE_SECONDS);
      const player = addPlayer(this.arena, playerId, { sessionId: client.sessionId, name: client.userData?.name || playerId });
      player.online = true;
      syncArenaToSchema(this.state, this.arena);
      this.broadcast('serverEvent', { type: 'player_reconnected', playerId });
    } catch {
      this.forgetPlayer(client.sessionId, playerId);
      removePlayer(this.arena, playerId);
      syncArenaToSchema(this.state, this.arena);
      this.broadcast('serverEvent', { type: 'player_timeout', playerId });
    }
  }

  forgetPlayer(sessionId, playerId) {
    this.sessionToPlayerId.delete(sessionId);
    if (this.playerIdToSession.get(playerId) === sessionId) this.playerIdToSession.delete(playerId);
  }

  handleInput(client, payload = {}) {
    const playerId = this.sessionToPlayerId.get(client.sessionId) || client.userData?.playerId;
    const result = applyInput(this.arena, playerId, payload);
    if (result.accepted) {
      client.send('inputAck', { seq: result.seq, tick: this.arena.tick });
    } else if (result.reason === 'stale') {
      client.send('inputReject', { reason: result.reason, seq: result.seq, lastInputSeq: result.lastInputSeq, tick: this.arena.tick });
    }
  }

  handleCommand(client, payload = {}) {
    const playerId = this.sessionToPlayerId.get(client.sessionId) || client.userData?.playerId;
    client.send('cmdAck', {
      playerId,
      tick: this.arena.tick,
      type: payload.type || 'unknown',
      accepted: false,
      reason: 'cmd_pipeline_reserved_for_v39.4.x'
    });
  }

  update() {
    stepArena(this.arena, FIXED_DT_MS);
    syncArenaToSchema(this.state, this.arena);
  }
}

module.exports = { AuthoritativeArenaRoom };
