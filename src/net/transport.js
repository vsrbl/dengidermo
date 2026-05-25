import { MAX_PLAYERS, PING_RATE_MS, RELAY_MESSAGE_HARD_LIMIT_BYTES, SERVER_HELLO_TIMEOUT_MS, SIGNALING_PROTOCOL_VERSION } from "../core/constants.js";

const CHANNEL_KIND_STATE = "state";
const CHANNEL_KIND_CMD = "cmd";
const CHANNEL_KIND_INPUT = "input";
const CHANNEL_KIND_LEGACY = "game";

const TRANSPORT_CHANNELS = Object.freeze({
  [CHANNEL_KIND_STATE]: Object.freeze({
    label: CHANNEL_KIND_STATE,
    options: Object.freeze({ ordered: false, maxRetransmits: 0 }),
    maxBufferedAmount: 128 * 1024,
    dropWhenBackpressured: true
  }),
  [CHANNEL_KIND_CMD]: Object.freeze({
    label: CHANNEL_KIND_CMD,
    options: Object.freeze({ ordered: true }),
    maxBufferedAmount: 512 * 1024,
    dropWhenBackpressured: false
  }),
  [CHANNEL_KIND_INPUT]: Object.freeze({
    label: CHANNEL_KIND_INPUT,
    options: Object.freeze({ ordered: false, maxRetransmits: 0 }),
    maxBufferedAmount: 64 * 1024,
    dropWhenBackpressured: false
  })
});

function toWebSocketUrl(url) {
  const u = new URL(url);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return u.toString();
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function channelKindForData(data) {
  if (data?.t === "state") return CHANNEL_KIND_STATE;
  if (data?.t === "input") return CHANNEL_KIND_INPUT;
  return CHANNEL_KIND_CMD;
}

function isKnownChannelKind(kind) {
  return kind === CHANNEL_KIND_STATE || kind === CHANNEL_KIND_CMD || kind === CHANNEL_KIND_INPUT;
}

function jsonStringify(data) {
  try { return JSON.stringify(data); } catch { return ""; }
}

function estimateJsonBytes(data) {
  const payload = jsonStringify(data);
  return payload ? new TextEncoder().encode(payload).length : 0;
}

export class Transport {
  constructor(signalingUrl, callbacks = {}) {
    this.signalingUrl = signalingUrl;
    this.callbacks = callbacks;
    this.ws = null;
    this.roomId = null;
    this.playerId = null;
    this.role = "none";
    this.players = new Set();
    this.names = new Map();
    this.peers = new Map();
    this.channels = new Map();
    this.peerModes = new Map();
    this.pendingCandidates = new Map();
    this.connected = false;
    this.pingMs = null;
    this.lastPing = 0;
    this.closedByClient = false;
    this.helloReady = false;
    this.pendingOpenAction = null;
    this.helloTimer = 0;
  }

  connectHost(roomId, options = {}) {
    this.role = "host";
    this.openWs(() => this.sendWs({ type: "create", roomId, maxPlayers: MAX_PLAYERS, name: options.name || "" }));
  }

  connectGuest(roomId, options = {}) {
    this.role = "guest";
    this.openWs(() => this.sendWs({ type: "join", roomId, name: options.name || "", reconnectToken: options.reconnectToken || "" }));
  }

  openWs(onOpen) {
    this.close(false);
    this.closedByClient = false;
    this.helloReady = false;
    this.pendingOpenAction = typeof onOpen === "function" ? onOpen : null;
    this.ws = new WebSocket(toWebSocketUrl(this.signalingUrl));
    this.ws.addEventListener("open", () => {
      globalThis.clearTimeout(this.helloTimer);
      this.helloTimer = globalThis.setTimeout(() => {
        if (this.helloReady || this.closedByClient) return;
        this.callbacks.onError?.("server_mismatch");
        this.close(false);
      }, SERVER_HELLO_TIMEOUT_MS);
    });
    this.ws.addEventListener("message", (e) => this.handleWs(safeJson(e.data)));
    this.ws.addEventListener("close", () => {
      globalThis.clearTimeout(this.helloTimer);
      this.helloTimer = 0;
      this.pendingOpenAction = null;
      this.helloReady = false;
      this.connected = false;
      if (!this.closedByClient) this.callbacks.onClose?.();
    });
    this.ws.addEventListener("error", () => this.callbacks.onError?.("network"));
  }

  namesObject() {
    const names = {};
    for (const [id, name] of this.names) names[id] = name;
    return names;
  }

  syncNames(names) {
    if (!names || typeof names !== "object") return;
    this.names.clear();
    for (const [id, name] of Object.entries(names)) {
      if (this.players.has(id)) this.names.set(id, String(name || id).slice(0, 12));
    }
  }

  handleWs(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "hello") {
      const protocol = Number(msg.protocol || 0);
      if (protocol !== SIGNALING_PROTOCOL_VERSION) {
        this.callbacks.onError?.("server_mismatch");
        this.close(false);
        return;
      }
      this.helloReady = true;
      globalThis.clearTimeout(this.helloTimer);
      this.helloTimer = 0;
      const action = this.pendingOpenAction;
      this.pendingOpenAction = null;
      action?.();
      return;
    }
    if (msg.type === "created" || msg.type === "joined") {
      this.roomId = msg.roomId;
      this.playerId = msg.playerId;
      this.connected = true;
      this.players = new Set(msg.players || [msg.playerId]);
      this.syncNames(msg.names);
      this.syncPeerModes();
      this.callbacks.onReady?.({ role: this.role, roomId: this.roomId, playerId: this.playerId, players: [...this.players], names: this.namesObject(), reconnectToken: msg.reconnectToken || "" });
      return;
    }
    if (msg.type === "players") {
      this.players = new Set(msg.players || []);
      this.syncNames(msg.names);
      this.syncPeerModes();
      this.callbacks.onPlayers?.([...this.players], this.namesObject());
      return;
    }
    if (msg.type === "player_joined") {
      const joinedId = msg.playerId;
      if (this.role === "host" && joinedId && joinedId !== this.playerId) {
        this.closePeer(joinedId);
      }
      if (Array.isArray(msg.players)) this.players = new Set(msg.players);
      else this.players.add(joinedId);
      this.syncNames(msg.names);
      this.syncPeerModes();
      this.callbacks.onPlayers?.([...this.players], this.namesObject());
      this.callbacks.onPlayerReplaced?.(joinedId, { reconnect: !!msg.reconnect });
      if (this.role === "host" && joinedId !== this.playerId) {
        this.createPeerForGuest(joinedId).catch(() => {
          this.callbacks.onPeerState?.(joinedId, "relay");
        });
      }
      return;
    }
    if (msg.type === "player_left") {
      if (Array.isArray(msg.players)) this.players = new Set(msg.players);
      else this.players.delete(msg.playerId);
      this.closePeer(msg.playerId);
      this.peerModes.delete(msg.playerId);
      this.syncNames(msg.names);
      this.callbacks.onPeerModes?.(this.peerModesObject());
      this.callbacks.onPlayerLeft?.(msg.playerId, msg.reason || "left", { players: [...this.players], names: this.namesObject() });
      this.callbacks.onPlayers?.([...this.players], this.namesObject());
      return;
    }
    if (msg.type === "signal") {
      this.handleSignal(msg.from, msg.data);
      return;
    }
    if (msg.type === "relay") {
      if (msg.from && !this.isStateChannelOpen(msg.from)) this.setPeerMode(msg.from, "RELAY");
      this.callbacks.onData?.(msg.data, msg.from, "relay");
      return;
    }
    if (msg.type === "room_closed") {
      this.connected = false;
      this.callbacks.onPlayerLeft?.("p1");
      this.callbacks.onError?.(msg.reason || "room_closed");
      return;
    }
    if (msg.type === "pong") {
      this.pingMs = Math.max(0, Math.round(performance.now() - msg.t));
      this.callbacks.onPing?.(this.pingMs);
      return;
    }
    if (msg.type === "error") this.callbacks.onError?.(msg.message || "error");
  }

  makePeer(remoteId) {
    if (typeof RTCPeerConnection === "undefined") {
      this.callbacks.onPeerState?.(remoteId, "relay");
      return null;
    }
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
    pc.onicecandidate = (e) => {
      if (e.candidate) this.sendSignal(remoteId, { candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState || "unknown";
      this.callbacks.onPeerState?.(remoteId, state);
      if (state === "failed" || state === "disconnected" || state === "closed") {
        this.setPeerMode(remoteId, "RELAY");
        if (state === "failed") this.callbacks.onPeerState?.(remoteId, "relay");
      }
    };
    this.peers.set(remoteId, pc);
    if (!this.pendingCandidates.has(remoteId)) this.pendingCandidates.set(remoteId, []);
    return pc;
  }

  channelRecord(remoteId) {
    let record = this.channels.get(remoteId);
    if (!record) {
      record = new Map();
      this.channels.set(remoteId, record);
    }
    return record;
  }

  peerModesObject() {
    const modes = {};
    for (const id of this.players) {
      if (!id || id === this.playerId) continue;
      modes[id] = this.peerModes.get(id) || "RELAY";
    }
    return modes;
  }

  syncPeerModes() {
    for (const id of [...this.peerModes.keys()]) {
      if (!this.players.has(id) || id === this.playerId) this.peerModes.delete(id);
    }
    for (const id of this.players) {
      if (id && id !== this.playerId && !this.peerModes.has(id)) this.peerModes.set(id, "RELAY");
    }
    this.callbacks.onPeerModes?.(this.peerModesObject());
  }

  setPeerMode(remoteId, mode) {
    if (!remoteId || remoteId === this.playerId) return;
    const normalized = mode === "P2P" ? "P2P" : "RELAY";
    const previous = this.peerModes.get(remoteId);
    this.peerModes.set(remoteId, normalized);
    if (previous !== normalized) {
      this.callbacks.onPeerMode?.(remoteId, normalized, this.peerModesObject());
      this.callbacks.onPeerModes?.(this.peerModesObject());
    }
  }

  isStateChannelOpen(remoteId) {
    const dc = this.getChannel(remoteId, CHANNEL_KIND_STATE);
    return dc?.readyState === "open";
  }

  getPeerTransportMode(remoteId) {
    return this.isStateChannelOpen(remoteId) ? "P2P" : (this.peerModes.get(remoteId) || "RELAY");
  }

  getPeerTransportModes() {
    const modes = {};
    for (const id of this.players) {
      if (!id || id === this.playerId) continue;
      modes[id] = this.getPeerTransportMode(id);
    }
    return modes;
  }

  attachChannel(remoteId, dc) {
    const kind = isKnownChannelKind(dc.label) ? dc.label : CHANNEL_KIND_LEGACY;
    dc.binaryType = "arraybuffer";
    dc.onopen = () => {
      this.callbacks.onPeerState?.(remoteId, kind === CHANNEL_KIND_LEGACY ? "open" : `${kind}_open`);
      if (kind === CHANNEL_KIND_STATE || kind === CHANNEL_KIND_LEGACY) this.setPeerMode(remoteId, "P2P");
    };
    dc.onclose = () => {
      this.callbacks.onPeerState?.(remoteId, kind === CHANNEL_KIND_LEGACY ? "closed" : `${kind}_closed`);
      if (kind === CHANNEL_KIND_STATE || kind === CHANNEL_KIND_LEGACY) this.setPeerMode(remoteId, "RELAY");
    };
    dc.onmessage = (e) => {
      const msg = typeof e.data === "string" ? safeJson(e.data) : null;
      if (msg) this.callbacks.onData?.(msg, remoteId, "p2p", { channel: kind });
    };
    this.channelRecord(remoteId).set(kind, dc);
  }

  createPeerChannels(guestId, pc) {
    for (const kind of [CHANNEL_KIND_STATE, CHANNEL_KIND_CMD, CHANNEL_KIND_INPUT]) {
      const config = TRANSPORT_CHANNELS[kind];
      const dc = pc.createDataChannel(config.label, config.options);
      this.attachChannel(guestId, dc);
    }
  }

  async createPeerForGuest(guestId) {
    if (this.peers.has(guestId)) return;
    const pc = this.makePeer(guestId);
    if (!pc) return;
    this.createPeerChannels(guestId, pc);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.sendSignal(guestId, { description: pc.localDescription });
  }

  async flushPendingCandidates(remoteId, pc) {
    const list = this.pendingCandidates.get(remoteId) || [];
    if (!list.length || !pc.remoteDescription) return;
    this.pendingCandidates.set(remoteId, []);
    for (const candidate of list) {
      try { await pc.addIceCandidate(candidate); } catch { /* keep relay fallback */ }
    }
  }

  async handleSignal(from, data) {
    try {
      let pc = this.peers.get(from);
      if (!pc) {
        pc = this.makePeer(from);
        if (!pc) return;
        pc.ondatachannel = (e) => this.attachChannel(from, e.channel);
      }
      if (data.description) {
        await pc.setRemoteDescription(data.description);
        await this.flushPendingCandidates(from, pc);
        if (data.description.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.sendSignal(from, { description: pc.localDescription });
        }
      }
      if (data.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
        else {
          const list = this.pendingCandidates.get(from) || [];
          list.push(data.candidate);
          this.pendingCandidates.set(from, list);
        }
      }
    } catch {
      this.callbacks.onPeerState?.(from, "relay");
      this.callbacks.onError?.("webrtc");
    }
  }

  sendWs(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  sendRelay(to, data) {
    const envelope = { type: "relay", roomId: this.roomId, to, data };
    const payload = jsonStringify(envelope);
    if (!payload) return "dropped";
    const bytes = new TextEncoder().encode(payload).length;
    if (bytes > RELAY_MESSAGE_HARD_LIMIT_BYTES) {
      this.callbacks.onPeerState?.(to, "relay_oversize");
      return "dropped";
    }
    if (this.ws?.readyState !== WebSocket.OPEN) return "unavailable";
    this.ws.send(payload);
    return "relay";
  }

  sendSignal(to, data) {
    this.sendWs({ type: "signal", roomId: this.roomId, to, data });
  }

  getChannel(remoteId, kind) {
    const record = this.channels.get(remoteId);
    if (!record) return null;
    return record.get(kind) || record.get(CHANNEL_KIND_LEGACY) || null;
  }

  sendViaDataChannel(remoteId, data, kind) {
    const channelKind = isKnownChannelKind(kind) ? kind : channelKindForData(data);
    const dc = this.getChannel(remoteId, channelKind);
    if (dc?.readyState !== "open") return "unavailable";
    const config = TRANSPORT_CHANNELS[channelKind] || TRANSPORT_CHANNELS[CHANNEL_KIND_CMD];
    if (dc.bufferedAmount > config.maxBufferedAmount) {
      this.callbacks.onPeerState?.(remoteId, `${channelKind}_backpressure`);
      return config.dropWhenBackpressured ? "dropped" : "unavailable";
    }
    const payload = jsonStringify(data);
    if (!payload) return "dropped";
    dc.send(payload);
    return "p2p";
  }

  sendToHost(data, options = {}) {
    const preferRelay = !!options.preferRelay;
    const relayFallback = options.relayFallback !== false;
    const kind = options.channel || channelKindForData(data);
    if (!preferRelay) {
      const mode = this.sendViaDataChannel("p1", data, kind);
      if (mode === "p2p" || mode === "dropped") return mode;
      if (!relayFallback) return mode;
    }
    const relayMode = this.sendRelay("host", data);
    if (relayMode === "relay") this.setPeerMode("p1", "RELAY");
    return relayMode;
  }

  sendTo(playerId, data, options = {}) {
    const preferRelay = !!options.preferRelay;
    const relayFallback = options.relayFallback !== false;
    const kind = options.channel || channelKindForData(data);
    if (!preferRelay) {
      const mode = this.sendViaDataChannel(playerId, data, kind);
      if (mode === "p2p" || mode === "dropped") return mode;
      if (!relayFallback) return mode;
    }
    const relayMode = this.sendRelay(playerId, data);
    if (relayMode === "relay") this.setPeerMode(playerId, "RELAY");
    return relayMode;
  }

  broadcast(data, options = {}) {
    let mode = "none";
    for (const id of this.players) {
      if (id === this.playerId) continue;
      const nextMode = this.sendTo(id, data, options);
      if (nextMode === "p2p") mode = "p2p";
      else if (nextMode === "relay" && mode !== "p2p") mode = "relay";
      else if (nextMode === "dropped" && mode === "none") mode = "dropped";
    }
    return mode;
  }

  tickPing(now) {
    if (!this.connected || now - this.lastPing < PING_RATE_MS) return;
    this.lastPing = now;
    this.sendWs({ type: "ping", t: now });
  }

  closePeer(id) {
    const record = this.channels.get(id);
    if (record) {
      for (const dc of record.values()) dc?.close?.();
    }
    this.peers.get(id)?.close?.();
    this.channels.delete(id);
    this.peers.delete(id);
    this.pendingCandidates.delete(id);
  }

  sendLeaveNotice() {
    if (!this.connected || !this.roomId) return;
    if (this.role === "guest") this.sendToHost({ t: "leave" }, { preferRelay: true });
    this.sendWs({ type: "leave", roomId: this.roomId });
  }

  close(sendLeave = true) {
    this.closedByClient = true;
    globalThis.clearTimeout(this.helloTimer);
    this.helloTimer = 0;
    this.pendingOpenAction = null;
    this.helloReady = false;
    const ws = this.ws;
    if (sendLeave && this.connected) this.sendLeaveNotice();
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    if (ws) {
      try { ws.onclose = null; ws.close(); } catch { /* socket may already be closed */ }
    }
    this.ws = null;
    this.connected = false;
    this.players.clear();
    this.names.clear();
    this.peerModes.clear();
  }
}
