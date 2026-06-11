// nncckkrr server entry: http + websocket, room registry
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';
import {
  VERSION, BUILD_ID, PROTOCOL, MAX_PLAYERS,
  C, S, MAX_MESSAGE_BYTES, RATE_LIMIT_PER_WINDOW, RATE_WINDOW_MS
} from './protocol.js';
import { Room } from './room.js';

const PORT = Number(process.env.PORT || 10000);
const ORIGINS = (process.env.CLIENT_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

const rooms = new Map(); // roomId -> Room

function roomCode() {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += abc[crypto.randomInt(abc.length)];
  return rooms.has(code) ? roomCode() : code;
}

const server = http.createServer((req, res) => {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
    'access-control-allow-origin': '*'
  };
  if (req.url === '/' || req.url === '/health') {
    let players = 0;
    for (const r of rooms.values()) players += r.playerCount;
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      ok: true, version: VERSION, buildId: BUILD_ID, protocol: PROTOCOL,
      rooms: rooms.size, players, maxPlayersPerRoom: MAX_PLAYERS
    }));
    return;
  }
  res.writeHead(404, headers);
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });

wss.on('connection', (ws, req) => {
  // origin check (allow no-origin for bots/tests in dev; enforce when list set)
  const origin = req.headers.origin;
  if (ORIGINS.length && origin && !ORIGINS.includes(origin)) {
    ws.close(4003, 'origin not allowed');
    return;
  }
  const playerId = crypto.randomBytes(4).toString('hex');
  let name = 'player';
  let room = null;
  let msgCount = 0;
  let windowStart = Date.now();

  const send = (msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };
  const fail = (error) => send({ t: S.ERROR, error });

  ws.on('message', (data) => {
    const now = Date.now();
    if (now - windowStart > RATE_WINDOW_MS) { windowStart = now; msgCount = 0; }
    if (++msgCount > RATE_LIMIT_PER_WINDOW) return;
    let m;
    try { m = JSON.parse(data.toString()); } catch { return; }
    if (!m || typeof m.t !== 'string') return;

    switch (m.t) {
      case C.HELLO: {
        if ((m.proto | 0) !== PROTOCOL) { fail(`protocol mismatch: server ${PROTOCOL}`); ws.close(4001, 'protocol'); return; }
        if (typeof m.name === 'string' && m.name.trim()) name = m.name.trim().slice(0, 12);
        send({ t: 'hello_ok', version: VERSION, buildId: BUILD_ID, protocol: PROTOCOL, id: playerId });
        break;
      }
      case C.CREATE: {
        if (room) return;
        const id = roomCode();
        const r = new Room(id, (rid) => rooms.delete(rid));
        rooms.set(id, r);
        const res = r.addPlayer(playerId, name, ws);
        if (res.error) { fail(res.error); return; }
        room = r;
        break;
      }
      case C.JOIN: {
        if (room) return;
        const id = String(m.roomId || '').toUpperCase().trim();
        const r = rooms.get(id);
        if (!r) { fail('room not found'); return; }
        const res = r.addPlayer(playerId, name, ws);
        if (res.error) { fail(res.error); return; }
        room = r;
        break;
      }
      case C.INPUT: if (room) room.handleInput(playerId, m); break;
      case C.CASINO: if (room) room.handleCasino(playerId, m.stake); break;
      case C.PICK: if (room) room.handlePick(playerId, m.choice); break;
      case C.PING: send({ t: S.PONG, ts: m.ts ?? null, now: Date.now() }); break;
      case C.LEAVE: if (room) { room.removePlayer(playerId); room = null; } break;
    }
  });

  ws.on('close', () => { if (room) room.removePlayer(playerId); });
  ws.on('error', () => { if (room) room.removePlayer(playerId); });
});

// keepalive: terminate dead sockets
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30_000);
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

server.listen(PORT, () => {
  console.log(`nncckkrr ${VERSION} (${BUILD_ID}) proto ${PROTOCOL} listening :${PORT}`);
});
