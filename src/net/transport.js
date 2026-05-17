import { MAX_PLAYERS, PING_RATE_MS } from "../core/constants.js";

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
    this.peers = new Map();
    this.channels = new Map();
    this.connected = false;
    this.pingMs = null;
    this.lastPing = 0;
    this.closedByClient = false;
  }

  connectHost(roomId) {
    this.role = "host";
    this.openWs(() => this.sendWs({ type: "create", roomId, maxPlayers: MAX_PLAYERS }));
  }

  connectGuest(roomId) {
    this.role = "guest";
    this.openWs(() => this.sendWs({ type: "join", roomId }));
  }

  openWs(onOpen) {
    this.close(false);
    this.closedByClient = false;
    this.ws = new WebSocket(toWebSocketUrl(this.signalingUrl));
    this.ws.addEventListener("open", onOpen);
    this.ws.addEventListener("message", (e) => this.handleWs(safeJson(e.data)));
    this.ws.addEventListener("close", () => {
      this.connected = false;
      if (!this.closedByClient) this.callbacks.onClose?.();
    });
    this.ws.addEventListener("error", () => this.callbacks.onError?.("network"));
  }

  handleWs(msg) {
    if (!msg || !msg.type) return;
    if (msg.type === "created" || msg.type === "joined") {
      this.roomId = msg.roomId;
      this.playerId = msg.playerId;
      this.connected = true;
      this.players = new Set(msg.players || [msg.playerId]);
      this.callbacks.onReady?.({ role: this.role, roomId: this.roomId, playerId: this.playerId, players: [...this.players] });
      return;
    }
    if (msg.type === "players") {
      this.players = new Set(msg.players || []);
      this.callbacks.onPlayers?.([...this.players]);
      return;
    }
    if (msg.type === "player_joined") {
      this.players.add(msg.playerId);
      this.callbacks.onPlayers?.([...this.players]);
      if (this.role === "host" && msg.playerId !== this.playerId) {
        this.createPeerForGuest(msg.playerId).catch(() => {
          this.callbacks.onPeerState?.(msg.playerId, "relay");
        });
      }
      return;
    }
    if (msg.type === "player_left") {
      this.players.delete(msg.playerId);
      this.closePeer(msg.playerId);
      this.callbacks.onPlayerLeft?.(msg.playerId);
      this.callbacks.onPlayers?.([...this.players]);
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
    if (msg.type === "pong") {
      this.pingMs = Math.max(0, Math.round(performance.now() - msg.t));
      this.callbacks.onPing?.(this.pingMs);
      return;
    }
    if (msg.type === "error") {
      this.callbacks.onError?.(msg.message || "error");
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
    pc.onconnectionstatechange = () => this.callbacks.onPeerState?.(remoteId, pc.connectionState);
    this.peers.set(remoteId, pc);
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
        if (data.description.type === "offer") {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.sendSignal(from, { description: pc.localDescription });
        }
      }
      if (data.candidate) await pc.addIceCandidate(data.candidate);
    } catch (err) {
      this.callbacks.onError?.("webrtc");
    }
  }

  sendWs(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  sendSignal(to, data) {
    this.sendWs({ type: "signal", roomId: this.roomId, to, data });
  }

  sendToHost(data) {
    const dc = this.channels.get("p1");
    if (dc?.readyState === "open") {
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
  }

  close(sendLeave = true) {
    this.closedByClient = true;
    if (sendLeave && this.connected) this.sendWs({ type: "leave", roomId: this.roomId });
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ws = null;
    this.connected = false;
    this.players.clear();
  }
}
