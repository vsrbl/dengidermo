"use strict";

const http = require("http");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS_DEFAULT = 4;
const ROOM_RE = /^[A-Z0-9-]{3,12}$/;
const rooms = new Map();

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function roomPlayers(room) {
  return [...room.players.keys()];
}

function broadcast(room, msg, except = null) {
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

function nextPlayerId(room) {
  for (let i = 1; i <= room.maxPlayers; i += 1) {
    const id = `p${i}`;
    if (!room.players.has(id)) return id;
  }
  return null;
}

function leave(ws) {
  const room = ws.nnRoom ? rooms.get(ws.nnRoom) : null;
  if (!room || !ws.nnPlayerId) return;
  const id = ws.nnPlayerId;
  room.players.delete(id);
  room.touched = Date.now();
  broadcast(room, { type: "player_left", playerId: id, players: roomPlayers(room) });
  broadcast(room, { type: "players", players: roomPlayers(room) });
  ws.nnRoom = null;
  ws.nnPlayerId = null;
  if (room.players.size === 0) rooms.delete(room.id);
}

function handleCreate(ws, msg) {
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
  room.players.set("p1", { ws, joinedAt: Date.now() });
  rooms.set(roomId, room);
  ws.nnRoom = roomId;
  ws.nnPlayerId = "p1";
  send(ws, { type: "created", roomId, playerId: "p1", players: roomPlayers(room) });
}

function handleJoin(ws, msg) {
  const roomId = normalizeRoomId(msg.roomId);
  const room = rooms.get(roomId);
  if (!room) return send(ws, { type: "error", message: "room_not_found" });
  if (room.players.size >= room.maxPlayers) return send(ws, { type: "error", message: "room_full" });
  const playerId = nextPlayerId(room);
  if (!playerId) return send(ws, { type: "error", message: "room_full" });

  room.players.set(playerId, { ws, joinedAt: Date.now() });
  room.touched = Date.now();
  ws.nnRoom = roomId;
  ws.nnPlayerId = playerId;
  send(ws, { type: "joined", roomId, playerId, players: roomPlayers(room) });
  broadcast(room, { type: "player_joined", playerId, players: roomPlayers(room) }, playerId);
  broadcast(room, { type: "players", players: roomPlayers(room) });
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
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  res.writeHead(200, { "content-type": "text/plain", "access-control-allow-origin": "*" });
  res.end("nncckkrr signaling v37.4\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.nnRoom = null;
  ws.nnPlayerId = null;

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
server.listen(PORT, () => console.log(`nncckkrr signaling v37.4 on ${PORT}`));
