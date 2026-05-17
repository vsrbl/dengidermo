"use strict";

const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number(process.env.PORT || 10000);
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 5000);
const ROOM_RE = /^[A-Z0-9-]{3,12}$/;

/** @type {Map<string, { host: WebSocket | null, guest: WebSocket | null, createdAt: number }>} */
const rooms = new Map();

const server = http.createServer((req, res) => {
  const path = req.url ? req.url.split("?")[0] : "/";

  if (path === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("nncckkrr.space signaling server\n");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.roomId = null;
  ws.role = null;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (buffer) => {
    let msg;
    try {
      msg = JSON.parse(buffer.toString());
    } catch {
      send(ws, { type: "error", message: "Bad JSON." });
      return;
    }

    handleMessage(ws, msg);
  });

  ws.on("close", () => {
    leaveRoom(ws, false);
  });
});

function handleMessage(ws, msg) {
  if (!msg || typeof msg !== "object") {
    send(ws, { type: "error", message: "Bad message." });
    return;
  }

  if (msg.type === "create") {
    createRoom(ws, normalizeRoomId(msg.roomId));
    return;
  }

  if (msg.type === "join") {
    joinRoom(ws, normalizeRoomId(msg.roomId));
    return;
  }

  if (msg.type === "signal") {
    routeToPeer(ws, { type: "signal", data: msg.data });
    return;
  }

  if (msg.type === "relay") {
    routeToPeer(ws, { type: "relay", data: msg.data });
    return;
  }

  if (msg.type === "leave") {
    leaveRoom(ws, true);
    return;
  }

  if (msg.type === "ping") {
    send(ws, { type: "pong", now: Date.now() });
    return;
  }

  send(ws, { type: "error", message: "Unknown message type." });
}

function createRoom(ws, roomId) {
  if (!validRoom(roomId)) {
    send(ws, { type: "error", message: "Invalid room ID." });
    return;
  }

  if (rooms.size >= MAX_ROOMS && !rooms.has(roomId)) {
    send(ws, { type: "error", message: "Server room limit reached." });
    return;
  }

  const old = rooms.get(roomId);
  if (old && isOpen(old.host)) {
    send(ws, { type: "error", message: "Room already exists." });
    return;
  }

  leaveRoom(ws, false);

  rooms.set(roomId, { host: ws, guest: null, createdAt: Date.now() });
  ws.roomId = roomId;
  ws.role = "host";

  send(ws, { type: "created", roomId });
}

function joinRoom(ws, roomId) {
  if (!validRoom(roomId)) {
    send(ws, { type: "error", message: "Invalid room ID." });
    return;
  }

  const room = rooms.get(roomId);
  if (!room || !isOpen(room.host)) {
    send(ws, { type: "error", message: "Room not found." });
    return;
  }

  if (isOpen(room.guest)) {
    send(ws, { type: "error", message: "Room is full." });
    return;
  }

  leaveRoom(ws, false);

  room.guest = ws;
  ws.roomId = roomId;
  ws.role = "guest";

  send(ws, { type: "joined", roomId });
  send(room.host, { type: "peer-joined", roomId });
}

function routeToPeer(ws, payload) {
  const peer = getPeer(ws);
  if (!peer) {
    send(ws, { type: "error", message: "Peer is not connected." });
    return;
  }
  send(peer, payload);
}

function getPeer(ws) {
  if (!ws.roomId || !ws.role) return null;
  const room = rooms.get(ws.roomId);
  if (!room) return null;

  const peer = ws.role === "host" ? room.guest : room.host;
  return isOpen(peer) ? peer : null;
}

function leaveRoom(ws, notifySelf) {
  if (!ws.roomId) return;

  const roomId = ws.roomId;
  const role = ws.role;
  const room = rooms.get(roomId);

  ws.roomId = null;
  ws.role = null;

  if (!room) return;

  if (room.host === ws) room.host = null;
  if (room.guest === ws) room.guest = null;

  if (role === "host") {
    if (isOpen(room.guest)) {
      const guest = room.guest;
      room.guest = null;
      guest.roomId = null;
      guest.role = null;
      send(guest, { type: "room-closed", roomId });
    }
    rooms.delete(roomId);
  } else if (role === "guest") {
    if (isOpen(room.host)) send(room.host, { type: "peer-left", roomId });
    if (!isOpen(room.host)) rooms.delete(roomId);
  }

  if (notifySelf && isOpen(ws)) send(ws, { type: "left", roomId });
}

function send(ws, payload) {
  if (!isOpen(ws)) return false;
  ws.send(JSON.stringify(payload));
  return true;
}

function isOpen(ws) {
  return Boolean(ws && ws.readyState === WebSocket.OPEN);
}

function normalizeRoomId(value) {
  return String(value || "").trim().toUpperCase();
}

function validRoom(roomId) {
  return ROOM_RE.test(roomId);
}

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) {
      leaveRoom(ws, false);
      ws.terminate();
      continue;
    }

    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

const janitor = setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    const empty = !isOpen(room.host) && !isOpen(room.guest);
    const stale = now - room.createdAt > 1000 * 60 * 60 * 6;
    if (empty || stale) rooms.delete(roomId);
  }
}, 60000);

wss.on("close", () => {
  clearInterval(heartbeat);
  clearInterval(janitor);
});

server.on("clientError", (_err, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(PORT, () => {
  console.log(`nncckkrr.space signaling server listening on ${PORT}`);
});
