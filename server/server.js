"use strict";

const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS_DEFAULT = 4;
const SERVER_VERSION = "v38.13.6";
const SIGNALING_PROTOCOL_VERSION = 2;
const ROOM_RE = /^[A-Z0-9-]{3,12}$/;
const NAME_RE = /^[A-Z0-9_-]{1,12}$/;
const rooms = new Map();

function isOpen(ws) {
  return !!ws && ws.readyState === ws.OPEN;
}

function send(ws, msg) {
  if (isOpen(ws)) ws.send(JSON.stringify(msg));
}

function pruneClosedPlayers(room) {
  if (!room) return [];
  const removed = [];
  for (const [id, player] of room.players) {
    if (!isOpen(player.ws)) {
      room.players.delete(id);
      removed.push(id);
    }
  }
  if (removed.length) room.touched = Date.now();
  return removed;
}

function roomPlayers(room) {
  pruneClosedPlayers(room);
  return [...room.players.keys()];
}

function roomNames(room) {
  pruneClosedPlayers(room);
  const names = {};
  for (const [id, player] of room.players) names[id] = player.name || id.toUpperCase();
  return names;
}

function broadcast(room, msg, except = null) {
  pruneClosedPlayers(room);
  for (const [id, player] of room.players) {
    if (id === except) continue;
    send(player.ws, msg);
  }
}

function cleanRooms() {
  const now = Date.now();
  for (const [id, room] of rooms) {
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

function closeRoom(room, reason = "host_left") {
  if (!room) return;
  broadcast(room, { type: "room_closed", reason });
  for (const player of room.players.values()) {
    player.ws.nnRoom = null;
    player.ws.nnPlayerId = null;
  }
  rooms.delete(room.id);
}

function leave(ws) {
  const room = ws.nnRoom ? rooms.get(ws.nnRoom) : null;
  if (!room || !ws.nnPlayerId) return;
  const id = ws.nnPlayerId;
  room.players.delete(id);
  room.touched = Date.now();
  ws.nnRoom = null;
  ws.nnPlayerId = null;
  if (id === room.hostId) {
    closeRoom(room, "host_left");
    return;
  }
  broadcast(room, { type: "player_left", playerId: id, players: roomPlayers(room), names: roomNames(room) });
  if (room.players.size === 0) rooms.delete(room.id);
}

function handleCreate(ws, msg) {
  if (ws.nnRoom || ws.nnPlayerId) leave(ws);
  const roomId = normalizeRoomId(msg.roomId);
  if (!ROOM_RE.test(roomId)) return send(ws, { type: "error", message: "bad_room" });
  if (rooms.has(roomId)) return send(ws, { type: "error", message: "room_exists" });

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
  if (ws.nnRoom || ws.nnPlayerId) leave(ws);
  const roomId = normalizeRoomId(msg.roomId);
  const room = rooms.get(roomId);
  if (!room) return send(ws, { type: "error", message: "room_not_found" });
  pruneClosedPlayers(room);
  const host = room.players.get(room.hostId);
  if (!isOpen(host?.ws)) {
    closeRoom(room, "host_missing");
    return send(ws, { type: "error", message: "room_not_found" });
  }
  if (room.players.size >= room.maxPlayers) return send(ws, { type: "error", message: "room_full" });
  const playerId = nextPlayerId(room);
  if (!playerId) return send(ws, { type: "error", message: "room_full" });

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
  if (req.url === "/health") {
    for (const room of rooms.values()) pruneClosedPlayers(room);
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, version: SERVER_VERSION, protocol: SIGNALING_PROTOCOL_VERSION }));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
  res.end(`nncckkrr signaling ${SERVER_VERSION} protocol ${SIGNALING_PROTOCOL_VERSION}\n`);
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.nnRoom = null;
  ws.nnPlayerId = null;
  send(ws, { type: "hello", version: SERVER_VERSION, protocol: SIGNALING_PROTOCOL_VERSION });

  ws.on("message", (raw) => {
    let msg = null;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || !msg.type) return;
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

setInterval(cleanRooms, 60_000).unref();
server.listen(PORT, () => console.log(`nncckkrr signaling v38.13.6 on ${PORT}`));
