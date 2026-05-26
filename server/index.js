import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const MAX_PLAYERS = 4;
const SERVER_HZ = 60;
const SNAPSHOT_HZ = 30;
const TICK_MS = 1000 / SERVER_HZ;
const SNAPSHOT_EVERY = Math.max(1, Math.round(SERVER_HZ / SNAPSHOT_HZ));
const MARKER = 'netrogue-green-0.2.0';

const map = { cols: 80, rows: 45 };
const spawns = [[10, 10], [69, 10], [10, 34], [69, 34]];
const clients = new Map();
let tick = 0;
let bulletSeq = 1;
let enemy = makeEnemy();
let bullets = [];

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
      'access-control-allow-origin': '*'
    });
    res.end(`${MARKER} ok /ws players ${clients.size}/${MAX_PLAYERS} bullets ${bullets.length} enemyHp ${enemy.hp}\n`);
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  res.end('not found\n');
});

server.on('upgrade', (req, socket) => {
  if (!req.url?.startsWith('/ws')) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }

  accept(req, socket);

  if (clients.size >= MAX_PLAYERS) {
    send(socket, { t: 'full', marker: MARKER });
    socket.end();
    return;
  }

  const id = crypto.randomBytes(3).toString('hex');
  const spawn = spawns[clients.size] || [Math.floor(map.cols / 2), Math.floor(map.rows / 2)];
  const client = {
    id,
    socket,
    x: spawn[0],
    y: spawn[1],
    vx: 0,
    vy: 0,
    hp: 100,
    keys: { up: false, down: false, left: false, right: false, fire: false },
    aim: 0,
    lastShotAt: 0,
    buffer: Buffer.alloc(0)
  };

  clients.set(socket, client);
  socket.on('data', (chunk) => onData(client, chunk));
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));

  send(socket, {
    t: 'welcome',
    id,
    marker: MARKER,
    serverHz: SERVER_HZ,
    snapshotHz: SNAPSHOT_HZ,
    maxPlayers: MAX_PLAYERS,
    map
  });
});

function makeEnemy() {
  return {
    id: 'dummy-01',
    x: 40,
    y: 22.5,
    vx: 0,
    vy: 0,
    hp: 240,
    maxHp: 240,
    r: 0.7,
    hitFlash: 0,
    respawnIn: 0,
    phase: 0
  };
}

function accept(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }
  const acceptKey = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

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
  if (client.buffer.length > 32_768) {
    client.socket.destroy();
    return;
  }

  while (client.buffer.length >= 2) {
    const b0 = client.buffer[0];
    const b1 = client.buffer[1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let off = 2;

    if (len === 126) {
      if (client.buffer.length < off + 2) return;
      len = client.buffer.readUInt16BE(off);
      off += 2;
    } else if (len === 127) {
      if (client.buffer.length < off + 8) return;
      const high = client.buffer.readUInt32BE(off);
      const low = client.buffer.readUInt32BE(off + 4);
      off += 8;
      if (high !== 0) {
        client.socket.destroy();
        return;
      }
      len = low;
    }

    const maskLen = masked ? 4 : 0;
    if (len > 8192) {
      client.socket.destroy();
      return;
    }
    if (client.buffer.length < off + maskLen + len) return;

    let mask;
    if (masked) {
      mask = client.buffer.subarray(off, off + 4);
      off += 4;
    }

    const payload = Buffer.from(client.buffer.subarray(off, off + len));
    client.buffer = client.buffer.subarray(off + len);

    if (masked) {
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    }

    if (opcode === 0x8) {
      client.socket.end();
      return;
    }
    if (opcode === 0x9) {
      sendRaw(client.socket, 0xA, payload);
      continue;
    }
    if (opcode !== 0x1) continue;

    let msg;
    try {
      msg = JSON.parse(payload.toString('utf8'));
    } catch {
      continue;
    }

    if (msg.t === 'input') {
      const k = msg.keys || {};
      client.keys.up = !!k.up;
      client.keys.down = !!k.down;
      client.keys.left = !!k.left;
      client.keys.right = !!k.right;
      client.keys.fire = !!k.fire;
      if (Number.isFinite(msg.aim)) client.aim = clampAngle(msg.aim);
    } else if (msg.t === 'ping') {
      send(client.socket, { t: 'pong', clientTime: msg.clientTime, serverTime: Date.now() });
    }
  }
}

function clampAngle(a) {
  if (!Number.isFinite(a)) return 0;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function send(socket, obj) {
  sendRaw(socket, 0x1, Buffer.from(JSON.stringify(obj)));
}

function sendRaw(socket, opcode, payload) {
  if (socket.destroyed || !socket.writable) return;

  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(len, 6);
  }

  socket.write(Buffer.concat([header, payload]));
}

function step() {
  tick++;
  const dt = 1 / SERVER_HZ;

  for (const c of clients.values()) {
    simulatePlayer(c, dt);
    maybeShoot(c);
  }

  simulateEnemy(dt);
  simulateBullets(dt);

  if (tick % SNAPSHOT_EVERY === 0) broadcastSnapshot();
}

function simulatePlayer(c, dt) {
  let dx = 0;
  let dy = 0;
  if (c.keys.left) dx -= 1;
  if (c.keys.right) dx += 1;
  if (c.keys.up) dy -= 1;
  if (c.keys.down) dy += 1;

  if (dx || dy) {
    const inv = 1 / Math.hypot(dx, dy);
    dx *= inv;
    dy *= inv;
  }

  const speed = 12.5;
  c.vx = dx * speed;
  c.vy = dy * speed;
  c.x = clamp(c.x + c.vx * dt, 1.2, map.cols - 2.2);
  c.y = clamp(c.y + c.vy * dt, 1.2, map.rows - 2.2);
}

function maybeShoot(c) {
  if (!c.keys.fire) return;

  const now = Date.now();
  const fireDelayMs = 55;
  if (now - c.lastShotAt < fireDelayMs) return;
  c.lastShotAt = now;

  const speed = 46;
  const muzzle = 0.72;
  const ca = Math.cos(c.aim);
  const sa = Math.sin(c.aim);
  bullets.push({
    id: bulletSeq++ % 1_000_000,
    owner: c.id,
    x: c.x + ca * muzzle,
    y: c.y + sa * muzzle,
    px: c.x,
    py: c.y,
    vx: ca * speed,
    vy: sa * speed,
    ttl: 0.62
  });

  if (bullets.length > 96) bullets.splice(0, bullets.length - 96);
}

function simulateEnemy(dt) {
  if (enemy.respawnIn > 0) {
    enemy.respawnIn -= dt;
    if (enemy.respawnIn <= 0) enemy = makeEnemy();
    return;
  }

  enemy.phase += dt;
  const target = nearestPlayer(enemy.x, enemy.y);
  let dx = 0;
  let dy = 0;

  if (target) {
    dx = target.x - enemy.x;
    dy = target.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
  }

  const wobbleX = Math.cos(enemy.phase * 2.1) * 0.35;
  const wobbleY = Math.sin(enemy.phase * 1.7) * 0.35;
  const speed = target ? 2.2 : 0.7;

  enemy.vx = dx * speed + wobbleX;
  enemy.vy = dy * speed + wobbleY;
  enemy.x = clamp(enemy.x + enemy.vx * dt, 3, map.cols - 4);
  enemy.y = clamp(enemy.y + enemy.vy * dt, 3, map.rows - 4);
  enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 9);
}

function simulateBullets(dt) {
  const kept = [];
  for (const b of bullets) {
    b.px = b.x;
    b.py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.ttl -= dt;

    const outside = b.x < 1 || b.y < 1 || b.x > map.cols - 2 || b.y > map.rows - 2;
    let hit = false;

    if (enemy.respawnIn <= 0) {
      const dist = Math.hypot(b.x - enemy.x, b.y - enemy.y);
      if (dist < enemy.r + 0.16) {
        enemy.hp -= 8;
        enemy.hitFlash = 1;
        hit = true;
        if (enemy.hp <= 0) {
          enemy.hp = 0;
          enemy.respawnIn = 1.25;
        }
      }
    }

    if (!outside && !hit && b.ttl > 0) kept.push(b);
  }
  bullets = kept;
}

function nearestPlayer(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const c of clients.values()) {
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

function broadcastSnapshot() {
  const snapshot = {
    t: 'snapshot',
    marker: MARKER,
    tick,
    time: Date.now(),
    map,
    players: [...clients.values()].map((c) => ({
      id: c.id,
      x: round(c.x),
      y: round(c.y),
      vx: round(c.vx),
      vy: round(c.vy),
      aim: round(c.aim),
      hp: c.hp
    })),
    enemy: enemy.respawnIn > 0 ? {
      id: enemy.id,
      x: round(enemy.x),
      y: round(enemy.y),
      vx: 0,
      vy: 0,
      hp: 0,
      maxHp: enemy.maxHp,
      hit: 0,
      respawnIn: round(enemy.respawnIn)
    } : {
      id: enemy.id,
      x: round(enemy.x),
      y: round(enemy.y),
      vx: round(enemy.vx),
      vy: round(enemy.vy),
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      hit: round(enemy.hitFlash),
      respawnIn: 0
    },
    bullets: bullets.map((b) => ({
      id: b.id,
      owner: b.owner,
      x: round(b.x),
      y: round(b.y),
      px: round(b.px),
      py: round(b.py),
      vx: round(b.vx),
      vy: round(b.vy),
      ttl: round(b.ttl)
    }))
  };

  for (const c of clients.values()) send(c.socket, snapshot);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function round(v) {
  return Math.round(v * 1000) / 1000;
}

setInterval(step, TICK_MS);
server.listen(PORT, '0.0.0.0', () => console.log(`${MARKER} listening on ${PORT}`));
