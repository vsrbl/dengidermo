import { MAX_PLAYERS, PING_RATE_MS, SERVER_HELLO_TIMEOUT_MS, SIGNALING_PROTOCOL_VERSION } from "../core/constants.js";

const RECONNECT_BASE_MS = 400;
const RECONNECT_MAX_MS = 5000;
const RECONNECT_TRANSIENT_ERRORS = new Set(["host_reconnecting", "room_exists"]);

function toWebSocketUrl(url) {
  const u = new URL(url);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  return u.toString();
}

function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
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
    this.pendingCandidates = new Map();
    this.connected = false;
    this.pingMs = null;
    this.lastPing = 0;
    this.closedByClient = false;
    this.helloReady = false;
    this.pendingOpenAction = null;
    this.helloTimer = 0;
    this.reconnectTimer = 0;
    this.reconnectAttempts = 0;
    this.intent = null;
    this.everReady = false;
  }

  connectHost(roomId, options = {}) {
    this.role = "host";
    this.roomId = roomId;
    this.intent = { role: "host", roomId, name: options.name || "", maxPlayers: MAX_PLAYERS };
    this.openWs(() => this.sendIntent());
  }

  connectGuest(roomId, options = {}) {
    this.role = "guest";
    this.roomId = roomId;
    this.intent = { role: "guest", roomId, name: options.name || "" };
    this.openWs(() => this.sendIntent());
  }

  sendIntent() {
    if (!this.intent) return;
    if (this.intent.role === "host") {
      this.sendWs({ type: "create", roomId: this.intent.roomId, maxPlayers: this.intent.maxPlayers || MAX_PLAYERS, name: this.intent.name || "" });
      return;
    }
    this.sendWs({ type: "join", roomId: this.intent.roomId, name: this.intent.name || "" });
  }

  reconnectDelay() {
    return Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.max(1, 2 ** Math.min(4, this.reconnectAttempts)));
  }

  scheduleReconnect(reason = "socket_closed") {
    if (this.closedByClient || !this.intent || !this.everReady) return;
    if (this.reconnectTimer) return;
    const delay = this.reconnectDelay();
    this.reconnectAttempts += 1;
    this.callbacks.onReconnect?.({ reason, delay, attempt: this.reconnectAttempts });
    this.reconnectTimer = globalThis.setTimeout(() => {
      this.reconnectTimer = 0;
      if (this.closedByClient || !this.intent) return;
      this.openWs(() => this.sendIntent());
    }, delay);
  }

  scheduleIntentRetry(reason = "transient") {
    if (this.closedByClient || !this.intent || !this.everReady) return;
    if (this.reconnectTimer) return;
    const delay = this.reconnectDelay();
    this.reconnectAttempts += 1;
    this.callbacks.onReconnect?.({ reason, delay, attempt: this.reconnectAttempts });
    this.reconnectTimer = globalThis.setTimeout(() => {
      this.reconnectTimer = 0;
      if (this.closedByClient || !this.intent) return;
      if (this.ws?.readyState === WebSocket.OPEN && this.helloReady) this.sendIntent();
      else this.openWs(() => this.sendIntent());
    }, delay);
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
        const shouldRetryHello = this.everReady;
        this.close(false);
        if (shouldRetryHello) {
          this.closedByClient = false;
          this.scheduleReconnect("hello_timeout");
        }
      }, SERVER_HELLO_TIMEOUT_MS);
    });
    this.ws.addEventListener("message", (e) => this.handleWs(safeJson(e.data)));
    this.ws.addEventListener("close", () => {
      globalThis.clearTimeout(this.helloTimer);
      this.helloTimer = 0;
      this.pendingOpenAction = null;
      this.helloReady = false;
      this.connected = false;
      if (!this.closedByClient) {
        this.callbacks.onClose?.();
        this.scheduleReconnect("socket_closed");
      }
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
        const shouldRetryHello = this.everReady;
        this.close(false);
        if (shouldRetryHello) {
          this.closedByClient = false;
          this.scheduleReconnect("hello_timeout");
        }
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
      this.everReady = true;
      this.reconnectAttempts = 0;
      globalThis.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = 0;
      this.players = new Set(msg.players || [msg.playerId]);
      this.syncNames(msg.names);
      this.callbacks.onReady?.({ role: this.role, roomId: this.roomId, playerId: this.playerId, players: [...this.players], names: this.namesObject(), reconnect: !!msg.reconnect });
      return;
    }
    if (msg.type === "players") {
      this.players = new Set(msg.players || []);
      this.syncNames(msg.names);
      this.callbacks.onPlayers?.([...this.players], this.namesObject());
      return;
    }
    if (msg.type === "player_joined") {
      const joinedId = msg.playerId;
      const replacedExistingSlot = !!joinedId && this.players.has(joinedId);
      if (this.role === "host" && joinedId && joinedId !== this.playerId) {
        this.closePeer(joinedId);
      }
      if (Array.isArray(msg.players)) this.players = new Set(msg.players);
      else this.players.add(joinedId);
      this.syncNames(msg.names);
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
      this.syncNames(msg.names);
      this.callbacks.onPlayerLeft?.(msg.playerId, msg.reason || "left", { players: [...this.players], names: this.namesObject() });
      this.callbacks.onPlayers?.([...this.players], this.namesObject());
      return;
    }
    if (msg.type === "signal") {
      this.handleSignal(msg.from, msg.data);
      return;
    }
    if (msg.type === "relay") {
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
    if (msg.type === "error") {
      const message = msg.message || "error";
      this.callbacks.onError?.(message);
      if (RECONNECT_TRANSIENT_ERRORS.has(message) && this.everReady) this.scheduleIntentRetry(message);
    }
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
      if (state === "failed") this.callbacks.onPeerState?.(remoteId, "relay");
    };
    this.peers.set(remoteId, pc);
    if (!this.pendingCandidates.has(remoteId)) this.pendingCandidates.set(remoteId, []);
    return pc;
  }

  attachChannel(remoteId, dc) {
    dc.binaryType = "arraybuffer";
    dc.onopen = () => this.callbacks.onPeerState?.(remoteId, "open");
    dc.onclose = () => this.callbacks.onPeerState?.(remoteId, "closed");
    dc.onmessage = (e) => {
      const msg = typeof e.data === "string" ? safeJson(e.data) : null;
      if (msg) this.callbacks.onData?.(msg, remoteId, "p2p");
    };
    this.channels.set(remoteId, dc);
  }

  async createPeerForGuest(guestId) {
    if (this.peers.has(guestId)) return;
    const pc = this.makePeer(guestId);
    if (!pc) return;
    const dc = pc.createDataChannel("game");
    this.attachChannel(guestId, dc);
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

  sendSignal(to, data) {
    this.sendWs({ type: "signal", roomId: this.roomId, to, data });
  }

  sendToHost(data, options = {}) {
    const preferRelay = !!options.preferRelay;
    const dc = this.channels.get("p1");
    if (!preferRelay && dc?.readyState === "open") {
      dc.send(JSON.stringify(data));
      return "p2p";
    }
    this.sendWs({ type: "relay", roomId: this.roomId, to: "host", data });
    return "relay";
  }

  sendTo(playerId, data) {
    const dc = this.channels.get(playerId);
    if (dc?.readyState === "open") {
      dc.send(JSON.stringify(data));
      return "p2p";
    }
    this.sendWs({ type: "relay", roomId: this.roomId, to: playerId, data });
    return "relay";
  }

  broadcast(data) {
    let mode = "none";
    for (const id of this.players) {
      if (id === this.playerId) continue;
      mode = this.sendTo(id, data);
    }
    return mode;
  }

  tickPing(now) {
    if (!this.connected || now - this.lastPing < PING_RATE_MS) return;
    this.lastPing = now;
    this.sendWs({ type: "ping", t: now });
  }

  closePeer(id) {
    this.channels.get(id)?.close?.();
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
    globalThis.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = 0;
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
    if (sendLeave) {
      this.intent = null;
      this.everReady = false;
      this.reconnectAttempts = 0;
    }
  }
}
