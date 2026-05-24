"use strict";

const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS_DEFAULT = 4;
const SERVER_VERSION = "v39.3.22j";
const SERVER_BUILD_ID = "v39.3.22j-20260524";
const SERVER_RELEASE_CHANNEL = "prod";
const SIGNALING_PROTOCOL_VERSION = 2;
const MAX_MESSAGE_BYTES = 64 * 1024;
const RATE_WINDOW_MS = 1000;
const RATE_LIMIT_PER_WINDOW = 120;
const HEARTBEAT_INTERVAL_MS = 4_000;
const HEARTBEAT_TIMEOUT_MS = 9_000;
const ROOM_RE = /^[A-Z0-9-]{3,12}$/;
const NAME_RE = /^[A-Z0-9_-]{1,12}$/;
const rooms = new Map();
const serverStartedAt = new Date().toISOString();

function isOpen(ws) {
  return !!ws && ws.readyState === ws.OPEN;
}

function send(ws, msg) {
  if (isOpen(ws)) ws.send(JSON.stringify(msg));
}

function markSocketAlive(ws) {
  ws.nnAlive = true;
  ws.nnLastSeen = Date.now();
}

function closeAbusiveSocket(ws, code = 1008, reason = "policy") {
  try { ws.close(code, reason); } catch { /* socket may already be closed */ }
}

function acceptMessage(ws, raw) {
  markSocketAlive(ws);
  const size = typeof raw === "string" ? Buffer.byteLength(raw) : raw?.length || 0;
  if (size > MAX_MESSAGE_BYTES) {
    closeAbusiveSocket(ws, 1009, "message_too_large");
    return false;
  }
  const now = Date.now();
  if (!ws.nnRateWindowStart || now - ws.nnRateWindowStart > RATE_WINDOW_MS) {
    ws.nnRateWindowStart = now;
    ws.nnRateCount = 0;
  }
  ws.nnRateCount += 1;
  if (ws.nnRateCount > RATE_LIMIT_PER_WINDOW) {
    closeAbusiveSocket(ws, 1008, "rate_limited");
    return false;
  }
  return true;
}

function rawRoomPlayers(room) {
  return [...room.players.keys()];
}

function rawRoomNames(room) {
  const names = {};
  for (const [id, player] of room.players) names[id] = player.name || id.toUpperCase();
  return names;
}

function sendToRoom(room, msg, except = null) {
  for (const [id, player] of room.players) {
    if (id === except) continue;
    send(player.ws, msg);
  }
}

function detachPlayer(room, playerId) {
  const player = room?.players?.get(playerId);
  if (!room || !player) return false;
  player.ws.nnRoom = null;
  player.ws.nnPlayerId = null;
  room.players.delete(playerId);
  room.touched = Date.now();
  return true;
}

function notifyPlayerLeft(room, playerId, reason = "left") {
  sendToRoom(room, { type: "player_left", playerId, reason, players: rawRoomPlayers(room), names: rawRoomNames(room) });
}

function closeRoom(room, reason = "host_left") {
  if (!room) return;
  sendToRoom(room, { type: "room_closed", reason });
  for (const player of room.players.values()) {
    player.ws.nnRoom = null;
    player.ws.nnPlayerId = null;
  }
  room.players.clear();
  rooms.delete(room.id);
}

function pruneClosedPlayers(room) {
  if (!room) return [];
  const removed = [];
  for (const [id, player] of room.players) {
    if (!isOpen(player.ws)) removed.push(id);
  }
  if (!removed.length) return removed;

  if (removed.includes(room.hostId)) {
    detachPlayer(room, room.hostId);
    closeRoom(room, "host_missing");
    return removed;
  }

  for (const id of removed) {
    if (detachPlayer(room, id)) notifyPlayerLeft(room, id, "stale_socket");
  }
  if (room.players.size === 0) rooms.delete(room.id);
  return removed;
}

function roomPlayers(room) {
  pruneClosedPlayers(room);
  return rawRoomPlayers(room);
}

function roomNames(room) {
  pruneClosedPlayers(room);
  return rawRoomNames(room);
}

function broadcast(room, msg, except = null) {
  pruneClosedPlayers(room);
  if (!rooms.has(room.id)) return;
  sendToRoom(room, msg, except);
}

function cleanRooms() {
  const now = Date.now();
  for (const [id, room] of rooms) {
    pruneClosedPlayers(room);
    if (!rooms.has(id)) continue;
    if (room.players.size === 0 || now - room.touched > 60 * 60 * 1000) rooms.delete(id);
  }
}

function normalizeRoomId(id) {
  return String(id || "").trim().toUpperCase().slice(0, 12);
}

function normalizePlayerName(name, fallback = "PLAYER") {
  const clean = String(name || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 12);
  return NAME_RE.test(clean) ? clean : fallback;
}

function nextPlayerId(room) {
  for (let i = 1; i <= room.maxPlayers; i += 1) {
    const id = `p${i}`;
    if (!room.players.has(id)) return id;
  }
  return null;
}

function leave(ws) {
  const room = ws.nnRoom ? rooms.get(ws.nnRoom) : null;
  if (!room || !ws.nnPlayerId) {
    ws.nnRoom = null;
    ws.nnPlayerId = null;
    return;
  }
  const id = ws.nnPlayerId;
  if (id === room.hostId) {
    detachPlayer(room, id);
    closeRoom(room, "host_left");
    return;
  }
  if (!detachPlayer(room, id)) return;
  notifyPlayerLeft(room, id, "left");
  if (room.players.size === 0) rooms.delete(room.id);
}

function handleCreate(ws, msg) {
  const roomId = normalizeRoomId(msg.roomId);
  if (!ROOM_RE.test(roomId)) return send(ws, { type: "error", message: "bad_room" });
  if (rooms.has(roomId)) return send(ws, { type: "error", message: "room_exists" });
  if (ws.nnRoom || ws.nnPlayerId) leave(ws);

  const room = {
    id: roomId,
    hostId: "p1",
    maxPlayers: Math.min(4, Math.max(2, Number(msg.maxPlayers) || MAX_PLAYERS_DEFAULT)),
    players: new Map(),
    touched: Date.now()
  };
  room.players.set("p1", { ws, joinedAt: Date.now(), name: normalizePlayerName(msg.name, "HOST") });
  rooms.set(roomId, room);
  ws.nnRoom = roomId;
  ws.nnPlayerId = "p1";
  send(ws, { type: "created", roomId, playerId: "p1", players: roomPlayers(room), names: roomNames(room) });
}

function handleJoin(ws, msg) {
  const roomId = normalizeRoomId(msg.roomId);
  if (!ROOM_RE.test(roomId)) return send(ws, { type: "error", message: "bad_room" });
  const room = rooms.get(roomId);
  if (!room) return send(ws, { type: "error", message: "room_not_found" });
  pruneClosedPlayers(room);
  if (!rooms.has(roomId)) return send(ws, { type: "error", message: "room_not_found" });
  const host = room.players.get(room.hostId);
  if (!isOpen(host?.ws)) {
    closeRoom(room, "host_missing");
    return send(ws, { type: "error", message: "room_not_found" });
  }
  if (room.players.size >= room.maxPlayers && ws.nnRoom !== roomId) return send(ws, { type: "error", message: "room_full" });
  const playerId = ws.nnRoom === roomId && ws.nnPlayerId ? ws.nnPlayerId : nextPlayerId(room);
  if (!playerId) return send(ws, { type: "error", message: "room_full" });
  if ((ws.nnRoom || ws.nnPlayerId) && ws.nnRoom !== roomId) leave(ws);

  room.players.set(playerId, { ws, joinedAt: Date.now(), name: normalizePlayerName(msg.name, playerId.toUpperCase()) });
  room.touched = Date.now();
  ws.nnRoom = roomId;
  ws.nnPlayerId = playerId;
  const playerList = roomPlayers(room);
  const names = roomNames(room);
  send(ws, { type: "joined", roomId, playerId, players: playerList, names });
  broadcast(room, { type: "player_joined", playerId, players: playerList, names }, playerId);
}

function handleSignal(ws, msg) {
  const room = rooms.get(ws.nnRoom || normalizeRoomId(msg.roomId));
  if (!room || !ws.nnPlayerId) return;
  const target = room.players.get(msg.to);
  if (!target) return;
  room.touched = Date.now();
  send(target.ws, { type: "signal", from: ws.nnPlayerId, data: msg.data });
}

function handleRelay(ws, msg) {
  const room = rooms.get(ws.nnRoom || normalizeRoomId(msg.roomId));
  if (!room || !ws.nnPlayerId) return;
  room.touched = Date.now();
  const packet = { type: "relay", from: ws.nnPlayerId, data: msg.data };

  if (msg.to === "host") {
    const host = room.players.get(room.hostId);
    if (host && room.hostId !== ws.nnPlayerId) send(host.ws, packet);
    return;
  }
  if (msg.to === "all") {
    broadcast(room, packet, ws.nnPlayerId);
    return;
  }
  const target = room.players.get(msg.to);
  if (target) send(target.ws, packet);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/health") {
    for (const room of rooms.values()) pruneClosedPlayers(room);
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*", "cache-control": "no-store" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, version: SERVER_VERSION, buildId: SERVER_BUILD_ID, channel: SERVER_RELEASE_CHANNEL, protocol: SIGNALING_PROTOCOL_VERSION, startedAt: serverStartedAt, now: new Date().toISOString() }));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*", "cache-control": "no-store" });
  res.end(`nncckkrr signaling ${SERVER_VERSION} protocol ${SIGNALING_PROTOCOL_VERSION} build ${SERVER_BUILD_ID}\n`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.nnRoom = null;
  ws.nnPlayerId = null;
  ws.nnRateWindowStart = Date.now();
  ws.nnRateCount = 0;
  markSocketAlive(ws);
  send(ws, { type: "hello", version: SERVER_VERSION, buildId: SERVER_BUILD_ID, channel: SERVER_RELEASE_CHANNEL, protocol: SIGNALING_PROTOCOL_VERSION });

  ws.on("pong", () => markSocketAlive(ws));

  ws.on("message", (raw) => {
    if (!acceptMessage(ws, raw)) return;
    let msg = null;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.type !== "string") return;
    if (msg.type === "create") return handleCreate(ws, msg);
    if (msg.type === "join") return handleJoin(ws, msg);
    if (msg.type === "signal") return handleSignal(ws, msg);
    if (msg.type === "relay") return handleRelay(ws, msg);
    if (msg.type === "leave") return leave(ws);
    if (msg.type === "ping") return send(ws, { type: "pong", t: msg.t });
  });

  ws.on("close", () => leave(ws));
  ws.on("error", () => leave(ws));
});

function heartbeatClients() {
  const now = Date.now();
  for (const ws of wss.clients) {
    if (ws.readyState !== ws.OPEN) continue;
    if (ws.nnAlive === false && now - (ws.nnLastSeen || 0) > HEARTBEAT_TIMEOUT_MS) {
      try { ws.terminate(); } catch { /* socket may already be closed */ }
      continue;
    }
    ws.nnAlive = false;
    try { ws.ping(); } catch { try { ws.terminate(); } catch { /* socket may already be closed */ } }
  }
}

setInterval(heartbeatClients, HEARTBEAT_INTERVAL_MS).unref();
setInterval(cleanRooms, 60_000).unref();
server.listen(PORT, () => console.log(`nncckkrr signaling v39.3.22j protocol ${SIGNALING_PROTOCOL_VERSION} build ${SERVER_BUILD_ID} on ${PORT}`));
