import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const rooms = new Map();
const socketToPlayer = new Map();

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }

  res.writeHead(200, { "content-type": "text/plain" });
  res.end("dengidermo signaling server");
});

const wss = new WebSocketServer({ server });

function makeId(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < length; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

function makeRoomId() {
  let roomId = makeId(6);
  while (rooms.has(roomId)) roomId = makeId(6);
  return roomId;
}

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(room, message, exceptPlayerId = null) {
  for (const player of room.players.values()) {
    if (player.id !== exceptPlayerId) send(player.socket, message);
  }
}

function cleanup(socket) {
  const meta = socketToPlayer.get(socket);
  if (!meta) return;

  const room = rooms.get(meta.roomId);
  socketToPlayer.delete(socket);
  if (!room) return;

  room.players.delete(meta.playerId);

  broadcast(room, {
    type: "player-left",
    roomId: room.id,
    playerId: meta.playerId
  });

  if (room.players.size === 0) {
    rooms.delete(room.id);
    console.log(`room deleted ${room.id}`);
    return;
  }

  if (room.hostId === meta.playerId) {
    room.hostId = room.players.keys().next().value;
    console.log(`new host in ${room.id}: ${room.hostId}`);
  }
}

function safePlayerName(value, fallback) {
  if (typeof value !== "string") return fallback;
  return value.slice(0, 18).trim() || fallback;
}

wss.on("connection", socket => {
  socket.on("message", raw => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(socket, { type: "error", message: "Invalid JSON" });
      return;
    }

    if (message.type === "create-room") {
      const roomId = makeRoomId();
      const playerId = makeId(10);
      const player = {
        id: playerId,
        name: safePlayerName(message.playerName, "Host"),
        socket
      };

      rooms.set(roomId, {
        id: roomId,
        hostId: playerId,
        players: new Map([[playerId, player]])
      });

      socketToPlayer.set(socket, { roomId, playerId });
      send(socket, { type: "room-created", roomId, playerId, isHost: true });
      console.log(`room created ${roomId}`);
      return;
    }

    if (message.type === "join-room") {
      const roomId = String(message.roomId || "").trim().toUpperCase();
      const room = rooms.get(roomId);

      if (!room) {
        send(socket, { type: "error", message: "Room not found" });
        return;
      }

      if (room.players.size >= 2) {
        send(socket, { type: "error", message: "Room is full" });
        return;
      }

      const playerId = makeId(10);
      const player = {
        id: playerId,
        name: safePlayerName(message.playerName, "Player"),
        socket
      };

      room.players.set(playerId, player);
      socketToPlayer.set(socket, { roomId, playerId });

      send(socket, {
        type: "room-joined",
        roomId,
        playerId,
        isHost: false,
        hostPlayerId: room.hostId
      });

      broadcast(room, {
        type: "player-joined",
        roomId,
        playerId,
        playerName: player.name
      }, playerId);

      console.log(`player ${playerId} joined ${roomId}`);
      return;
    }

    if (message.type === "signal") {
      const meta = socketToPlayer.get(socket);
      if (!meta) {
        send(socket, { type: "error", message: "You are not in a room" });
        return;
      }

      const room = rooms.get(meta.roomId);
      if (!room || room.id !== message.roomId) {
        send(socket, { type: "error", message: "Bad room" });
        return;
      }

      const target = room.players.get(message.targetPlayerId);
      if (!target) {
        send(socket, { type: "error", message: "Target player not found" });
        return;
      }

      send(target.socket, {
        type: "signal",
        roomId: room.id,
        fromPlayerId: meta.playerId,
        data: message.data
      });
    }
  });

  socket.on("close", () => cleanup(socket));
  socket.on("error", () => cleanup(socket));
});

const port = Number(process.env.PORT || 10000);
server.listen(port, "0.0.0.0", () => {
  console.log(`signaling server listening on 0.0.0.0:${port}`);
});
