// nncckkrr signaling server v2 — a phonebook, NOT a game server.
// The simulation runs in the host player's browser. This server only:
//   1) hands out room codes, 2) relays WebRTC handshakes, 3) relays game
//   messages as a fallback when a direct WebRTC connection can't be made.
import http from 'node:http';
import crypto from 'node:crypto';
import { WebSocketServer } from 'ws';

const VERSION = 'v2.0.62';
const BUILD_ID = 'v2.0.62-20260616';
const PROTOCOL = 2;
const MAX_PLAYERS = 4;
const MAX_MESSAGE_BYTES = 64 * 1024;
const RATE_LIMIT_PER_WINDOW = 300;
const RATE_WINDOW_MS = 1000;

const PORT = Number(process.env.PORT || 10777);
const ORIGINS = (process.env.CLIENT_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

// roomCode -> { host: ws, guests: Map<gid, ws> }
const rooms = new Map();

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
    for (const r of rooms.values()) players += 1 + r.guests.size;
    res.writeHead(200, headers);
    res.end(JSON.stringify({
      ok: true, version: VERSION, buildId: BUILD_ID, protocol: PROTOCOL,
      role: 'signaling', rooms: rooms.size, players, maxPlayersPerRoom: MAX_PLAYERS
    }));
    return;
  }
  res.writeHead(404, headers);
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: MAX_MESSAGE_BYTES });

wss.on('connection', (ws, req) => {
  const origin = req.headers.origin;
  if (ORIGINS.length && origin && !ORIGINS.includes(origin)) {
    ws.close(4003, 'origin not allowed');
    return;
  }
  let name = 'PLAYER';
  let skin = null;
  let role = null;        // 'host' | 'guest'
  let code = null;        // room code this socket belongs to
  let gid = null;         // guest id
  let msgCount = 0;
  let windowStart = Date.now();

  const send = (sock, msg) => { if (sock && sock.readyState === 1) sock.send(JSON.stringify(msg)); };
  const fail = (error) => send(ws, { t: 'error', error });

  ws.on('message', (data) => {
    const now = Date.now();
    if (now - windowStart > RATE_WINDOW_MS) { windowStart = now; msgCount = 0; }
    if (++msgCount > RATE_LIMIT_PER_WINDOW) return;
    let m; try { m = JSON.parse(data.toString()); } catch { return; }
    const room = code ? rooms.get(code) : null;

    switch (m.t) {
      case 'hello': {
        if (m.proto !== PROTOCOL) { fail(`protocol mismatch: server ${PROTOCOL}`); ws.close(4001); return; }
        name = String(m.name || 'PLAYER').slice(0, 12);
        skin = m.skin && typeof m.skin === 'object' ? m.skin : null;
        send(ws, { t: 'hello_ok', version: VERSION });
        break;
      }
      case 'host': {
        if (role) return;
        role = 'host';
        code = roomCode();
        rooms.set(code, { host: ws, guests: new Map() });
        send(ws, { t: 'host_ok', code });
        break;
      }
      case 'join': {
        if (role) return;
        const c = String(m.code || '').toUpperCase();
        const r = rooms.get(c);
        if (!r) { fail('room not found'); return; }
        if (r.guests.size + 1 >= MAX_PLAYERS) { fail('room full'); return; }
        role = 'guest';
        code = c;
        gid = crypto.randomBytes(4).toString('hex');
        r.guests.set(gid, ws);
        send(ws, { t: 'join_ok', code: c });
        send(r.host, { t: 'guest_join', gid, name, skin: (m.skin && typeof m.skin === 'object') ? m.skin : skin });
        break;
      }
      case 'rtc': {        // WebRTC handshake relay
        if (!room) return;
        if (role === 'host' && room.guests.has(m.to)) send(room.guests.get(m.to), { t: 'rtc', from: 'host', d: m.d });
        else if (role === 'guest') send(room.host, { t: 'rtc', from: gid, d: m.d });
        break;
      }
      case 'g': {          // guest -> host game message (relay fallback)
        if (room && role === 'guest') send(room.host, { t: 'g', from: gid, d: m.d });
        break;
      }
      case 'h': {          // host -> guest game message (relay fallback)
        if (room && role === 'host' && room.guests.has(m.to)) send(room.guests.get(m.to), { t: 'h', d: m.d });
        break;
      }
      case 'leave': ws.close(); break;
    }
  });

  ws.on('close', () => {
    const room = code ? rooms.get(code) : null;
    if (!room) return;
    if (role === 'host') {
      for (const g of room.guests.values()) send(g, { t: 'room_closed' });
      rooms.delete(code);
    } else if (role === 'guest') {
      room.guests.delete(gid);
      send(room.host, { t: 'guest_leave', gid });
    }
  });
});

server.listen(PORT, () => {
  console.log(`nncckkrr signaling ${VERSION} (${BUILD_ID}) proto ${PROTOCOL} listening :${PORT}`);
});
