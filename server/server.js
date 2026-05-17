"use strict";

const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number(process.env.PORT || 10000);
const MAX_ROOMS = Number(process.env.MAX_ROOMS || 5000);
const MAX_PLAYERS = 4;
const ROOM_RE = /^[A-Z0-9-]{3,12}$/;
const PLAYER_IDS = ["P1", "P2", "P3", "P4"];
const WORLD_W = 1800;
const WORLD_H = 1200;
const PLAYER_SIZE = 14;
const WALL_PAD = 16;

/** @type {Map<string, { id: string, hostId: string, clients: Map<string, WebSocket>, createdAt: number }>} */
const rooms = new Map();

const server = http.createServer((req, res) => {
  const path = req.url ? req.url.split("?")[0] : "/";

  if (path === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, maxPlayers: MAX_PLAYERS }));
    return;
  }

  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("nncckkrr.space room server\n");
});

const wss = new WebSocketServer({ server, maxPayload: 128 * 1024 });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.roomId = null;
  ws.playerId = null;

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

  ws.on("close", () => leaveRoom(ws, false));
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

  if (msg.type === "input") {
    routeInputToHost(ws, msg.input);
    return;
  }

  if (msg.type === "state") {
    routeStateFromHost(ws, msg.state);
    return;
  }

  if (msg.type === "leave") {
    leaveRoom(ws, true);
    return;
  }

  if (msg.type === "ping") {
    send(ws, { type: "pong", t: msg.t, now: Date.now() });
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
  if (old && old.clients.size > 0) {
    send(ws, { type: "error", message: "Room already exists." });
    return;
  }

  leaveRoom(ws, false);

  const room = { id: roomId, hostId: "P1", clients: new Map(), createdAt: Date.now() };
  rooms.set(roomId, room);
  addClientToRoom(room, ws, "P1");
}

function joinRoom(ws, roomId) {
  if (!validRoom(roomId)) {
    send(ws, { type: "error", message: "Invalid room ID." });
    return;
  }

  const room = rooms.get(roomId);
  if (!room || room.clients.size === 0 || !room.clients.has(room.hostId)) {
    send(ws, { type: "error", message: "Room not found." });
    return;
  }

  if (room.clients.size >= MAX_PLAYERS) {
    send(ws, { type: "error", message: "Room is full." });
    return;
  }

  leaveRoom(ws, false);
  addClientToRoom(room, ws, firstFreePlayerId(room));
}

function addClientToRoom(room, ws, playerId) {
  ws.roomId = room.id;
  ws.playerId = playerId;
  room.clients.set(playerId, ws);

  const players = Array.from(room.clients.keys()).sort();
  send(ws, {
    type: "joined",
    roomId: room.id,
    playerId,
    hostId: room.hostId,
    players,
    maxPlayers: MAX_PLAYERS,
    isHost: playerId === room.hostId
  });

  broadcast(room, {
    type: "player-joined",
    roomId: room.id,
    playerId,
    hostId: room.hostId,
    players,
    maxPlayers: MAX_PLAYERS
  }, playerId);
}

function firstFreePlayerId(room) {
  for (const id of PLAYER_IDS) {
    if (!room.clients.has(id)) return id;
  }
  return null;
}

function routeInputToHost(ws, input) {
  const room = getRoom(ws);
  if (!room || !ws.playerId) return;
  if (ws.playerId === room.hostId) return;

  const host = room.clients.get(room.hostId);
  if (!isOpen(host)) {
    send(ws, { type: "error", message: "Host is gone." });
    return;
  }

  send(host, { type: "input", from: ws.playerId, input: cleanInput(input) });
}

function routeStateFromHost(ws, state) {
  const room = getRoom(ws);
  if (!room || ws.playerId !== room.hostId) return;
  broadcast(room, { type: "state", state }, ws.playerId);
}

function cleanInput(input) {
  const rawX = Number(input && input.aimX);
  const rawY = Number(input && input.aimY);
  const aimX = Number.isFinite(rawX) ? rawX : 1;
  const aimY = Number.isFinite(rawY) ? rawY : 0;
  const len = Math.hypot(aimX, aimY) || 1;
  const px = Number(input && input.px);
  const py = Number(input && input.py);
  const clean = {
    left: Boolean(input && input.left),
    right: Boolean(input && input.right),
    up: Boolean(input && input.up),
    down: Boolean(input && input.down),
    fire: Boolean(input && input.fire),
    aimX: clamp(aimX / len, -1, 1),
    aimY: clamp(aimY / len, -1, 1),
    px: null,
    py: null
  };

  if (Number.isFinite(px) && Number.isFinite(py)) {
    clean.px = clamp(px, WALL_PAD, WORLD_W - WALL_PAD - PLAYER_SIZE);
    clean.py = clamp(py, WALL_PAD, WORLD_H - WALL_PAD - PLAYER_SIZE);
  }

  return clean;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function leaveRoom(ws, notifySelf) {
  if (!ws.roomId || !ws.playerId) return;

  const roomId = ws.roomId;
  const playerId = ws.playerId;
  const room = rooms.get(roomId);

  ws.roomId = null;
  ws.playerId = null;

  if (!room) return;
  room.clients.delete(playerId);

  if (playerId === room.hostId) {
    broadcast(room, { type: "room-closed", roomId, reason: "Host left." });
    for (const client of room.clients.values()) {
      client.roomId = null;
      client.playerId = null;
    }
    rooms.delete(roomId);
  } else if (room.clients.size === 0) {
    rooms.delete(roomId);
  } else {
    const players = Array.from(room.clients.keys()).sort();
    broadcast(room, { type: "player-left", roomId, playerId, players, hostId: room.hostId });
  }

  if (notifySelf && isOpen(ws)) send(ws, { type: "left", roomId });
}

function getRoom(ws) {
  if (!ws.roomId) return null;
  return rooms.get(ws.roomId) || null;
}

function broadcast(room, payload, exceptPlayerId = null) {
  for (const [playerId, client] of room.clients.entries()) {
    if (playerId === exceptPlayerId) continue;
    send(client, payload);
  }
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
    const stale = now - room.createdAt > 1000 * 60 * 60 * 6;
    if (room.clients.size === 0 || stale) {
      broadcast(room, { type: "room-closed", roomId, reason: "Room expired." });
      rooms.delete(roomId);
    }
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
  console.log(`nncckkrr.space room server listening on ${PORT}`);
});
