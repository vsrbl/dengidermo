import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const MAX_PLAYERS = 4;
const TICK_MS = 1000 / 30;
const MARKER = 'netrogue-zero-0.1.0';
const clients = new Map();

const map = { cols: 48, rows: 30 };
const spawns = [[6,6],[41,6],[6,23],[41,23]];

const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    res.end(`${MARKER} ok /ws players ${clients.size}/${MAX_PLAYERS}\n`);
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found\n');
});

server.on('upgrade', (req, socket) => {
  if (!req.url?.startsWith('/ws')) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  if (clients.size >= MAX_PLAYERS) {
    accept(req, socket);
    send(socket, { t:'full' });
    socket.end();
    return;
  }
  accept(req, socket);
  const id = crypto.randomBytes(3).toString('hex');
  const spawn = spawns[clients.size] || [24,15];
  const client = { id, socket, x: spawn[0], y: spawn[1], keys: {}, alive: true, buffer: Buffer.alloc(0) };
  clients.set(socket, client);
  socket.on('data', (chunk) => onData(client, chunk));
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
  send(socket, { t:'welcome', id, tickRate: 30, maxPlayers: MAX_PLAYERS, marker: MARKER });
});

function accept(req, socket) {
  const key = req.headers['sec-websocket-key'];
  const acceptKey = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`,
    '\r\n'
  ].join('\r\n'));
}

function onData(client, chunk) {
  client.buffer = Buffer.concat([client.buffer, chunk]);
  while (client.buffer.length >= 2) {
    const b0 = client.buffer[0];
    const b1 = client.buffer[1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let off = 2;
    if (len === 126) {
      if (client.buffer.length < off + 2) return;
      len = client.buffer.readUInt16BE(off); off += 2;
    } else if (len === 127) {
      if (client.buffer.length < off + 8) return;
      const high = client.buffer.readUInt32BE(off); const low = client.buffer.readUInt32BE(off + 4); off += 8;
      if (high !== 0) { client.socket.destroy(); return; }
      len = low;
    }
    const maskLen = masked ? 4 : 0;
    if (client.buffer.length < off + maskLen + len) return;
    let mask;
    if (masked) { mask = client.buffer.subarray(off, off+4); off += 4; }
    const payload = Buffer.from(client.buffer.subarray(off, off+len));
    client.buffer = client.buffer.subarray(off+len);
    if (masked) for (let i=0;i<payload.length;i++) payload[i] ^= mask[i % 4];
    if (opcode === 0x8) { client.socket.end(); return; }
    if (opcode === 0x9) { sendRaw(client.socket, 0xA, payload); continue; }
    if (opcode !== 0x1) continue;
    let msg;
    try { msg = JSON.parse(payload.toString('utf8')); } catch { continue; }
    if (msg.t === 'input') client.keys = msg.keys || {};
    if (msg.t === 'ping') send(client.socket, { t:'pong', clientTime: msg.clientTime });
  }
}

function send(socket, obj) {
  sendRaw(socket, 0x1, Buffer.from(JSON.stringify(obj)));
}

function sendRaw(socket, opcode, payload) {
  if (socket.destroyed) return;
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(len, 6);
  }
  socket.write(Buffer.concat([header, payload]));
}

function step() {
  for (const c of clients.values()) {
    let dx = 0, dy = 0;
    if (c.keys.left) dx--;
    if (c.keys.right) dx++;
    if (c.keys.up) dy--;
    if (c.keys.down) dy++;
    const nx = Math.max(1, Math.min(map.cols - 2, c.x + Math.sign(dx)));
    const ny = Math.max(1, Math.min(map.rows - 2, c.y + Math.sign(dy)));
    c.x = nx; c.y = ny;
  }
  const snapshot = { t:'snapshot', time: Date.now(), players: [...clients.values()].map(c => ({ id:c.id, x:c.x, y:c.y })) };
  for (const c of clients.values()) send(c.socket, snapshot);
}

setInterval(step, TICK_MS);
server.listen(PORT, '0.0.0.0', () => console.log(`${MARKER} listening on ${PORT}`));
