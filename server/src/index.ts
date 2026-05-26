import cors from 'cors';
import express from 'express';
import http from 'node:http';
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { WebSocket, WebSocketServer } from 'ws';
import { GameRoom, MAX_PLAYERS, SNAPSHOT_RATE, TICK_RATE } from './game.js';
import { encodeServerMessage, parseClientMessage, type ServerMessage } from './protocol.js';

const PORT = Number(process.env.PORT ?? 8787);
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const MAX_MESSAGE_BYTES = 1024;
const HEARTBEAT_MS = 15_000;
const SERVER_VERSION = 'netrogue-server-0.1.1';
const room = new GameRoom();

const app = express();
app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (origin === undefined || CLIENT_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin not allowed: ${origin}`));
  },
}));

app.get('/', (_request, response) => {
  response.type('text/plain').send(`${SERVER_VERSION} ok /ws players ${room.size}/${MAX_PLAYERS}`);
});

app.get('/health', (_request, response) => {
  response.json({ ok: true, version: SERVER_VERSION, wsPath: '/ws', players: room.size, maxPlayers: MAX_PLAYERS, tick: room.tick });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const sockets = new Map<WebSocket, { id: string; alive: boolean }>();

wss.on('connection', (socket) => {
  if (!room.canJoin()) {
    socket.close(1013, 'room full');
    return;
  }

  const id = crypto.randomUUID().slice(0, 8);
  const name = `p${room.size + 1}`;
  const welcome = room.addPlayer(id, name);

  sockets.set(socket, { id, alive: true });
  safeSend(socket, welcome);
  broadcastInfo(`${name} joined`);

  socket.on('pong', () => {
    const meta = sockets.get(socket);
    if (meta !== undefined) meta.alive = true;
  });

  socket.on('message', (data) => {
    if (rawDataByteLength(data) > MAX_MESSAGE_BYTES) {
      socket.close(1009, 'message too large');
      return;
    }

    const message = parseWireMessage(data);
    if (message === null) return;

    if (message.t === 'input') {
      room.setInput(id, message);
      return;
    }

    if (message.t === 'ping') {
      safeSend(socket, { t: 'pong', clientTime: message.clientTime, serverTime: Date.now() });
    }
  });

  socket.on('close', () => {
    sockets.delete(socket);
    room.removePlayer(id);
    broadcastInfo(`${name} left`);
  });
});

setInterval(() => {
  room.step(1 / TICK_RATE);
}, 1000 / TICK_RATE);

setInterval(() => {
  const snapshot = room.snapshot();
  for (const socket of sockets.keys()) {
    safeSend(socket, snapshot);
  }
}, 1000 / SNAPSHOT_RATE);

setInterval(() => {
  for (const [socket, meta] of sockets.entries()) {
    if (!meta.alive) {
      socket.terminate();
      continue;
    }

    meta.alive = false;
    socket.ping();
  }
}, HEARTBEAT_MS);

server.listen(PORT, () => {
  console.log(`${SERVER_VERSION} listening on :${PORT}`);
});

function broadcastInfo(text: string): void {
  for (const socket of sockets.keys()) {
    safeSend(socket, { t: 'info', text });
  }
}

function safeSend(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(encodeServerMessage(message));
}

function parseWireMessage(data: WebSocket.RawData): ReturnType<typeof parseClientMessage> {
  try {
    const text = rawDataToString(data);
    return parseClientMessage(JSON.parse(text));
  } catch {
    return null;
  }
}

function rawDataByteLength(data: WebSocket.RawData): number {
  if (typeof data === 'string') return Buffer.byteLength(data, 'utf8');
  if (Array.isArray(data)) return data.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  return data.byteLength;
}

function rawDataToString(data: WebSocket.RawData): string {
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  return data.toString('utf8');
}
