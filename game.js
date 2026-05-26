(() => {
  const cfg = window.NETROGUE_CONFIG || {};
  const WS_URL = cfg.BACKEND_WS_URL || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const hud = document.getElementById('hud');
  const stage = document.getElementById('stage');

  const world = { cols: 80, rows: 45 };
  const input = { up: false, down: false, left: false, right: false, fire: false };
  const mouse = { x: 0, y: 0, worldX: 40, worldY: 22.5, inside: false };

  let socket = null;
  let status = 'boot';
  let marker = 'unknown';
  let myId = null;
  let seq = 0;
  let ping = 0;
  let lastSnapshotAt = 0;
  let lastServerTime = 0;
  let lastInputSentAt = 0;
  let snapshotPlayers = [];
  let renderPlayers = new Map();
  let bullets = [];
  let enemy = null;
  let local = null;
  let correction = 0;
  let reconnectTimer = 0;
  let frames = 0;
  let fps = 0;
  let fpsLast = performance.now();
  let lastFrame = performance.now();

  function resizeCanvas() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(640, Math.floor(rect.width * dpr));
    const height = Math.max(360, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function setKey(code, down) {
    if (code === 'KeyW' || code === 'ArrowUp') input.up = down;
    if (code === 'KeyS' || code === 'ArrowDown') input.down = down;
    if (code === 'KeyA' || code === 'ArrowLeft') input.left = down;
    if (code === 'KeyD' || code === 'ArrowRight') input.right = down;
    if (code === 'Space') input.fire = down;
  }

  addEventListener('keydown', (e) => {
    setKey(e.code, true);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  });

  addEventListener('keyup', (e) => setKey(e.code, false));

  canvas.addEventListener('pointermove', (e) => {
    mouse.inside = true;
    updateMouse(e);
  });
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    mouse.inside = true;
    updateMouse(e);
    input.fire = true;
  });
  canvas.addEventListener('pointerup', (e) => {
    updateMouse(e);
    input.fire = false;
  });
  canvas.addEventListener('pointerleave', () => {
    mouse.inside = false;
    input.fire = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function updateMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / rect.width;
    const sy = (e.clientY - rect.top) / rect.height;
    mouse.x = sx;
    mouse.y = sy;
    mouse.worldX = sx * world.cols;
    mouse.worldY = sy * world.rows;
  }

  function connect() {
    clearTimeout(reconnectTimer);
    status = 'connecting';
    socket = new WebSocket(WS_URL);

    socket.addEventListener('open', () => {
      status = 'open';
    });

    socket.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }

      if (msg.t === 'welcome') {
        myId = msg.id;
        marker = msg.marker || marker;
        if (msg.map) {
          world.cols = msg.map.cols || world.cols;
          world.rows = msg.map.rows || world.rows;
        }
        status = 'joined';
      } else if (msg.t === 'pong') {
        ping = Math.max(0, Date.now() - msg.clientTime);
      } else if (msg.t === 'snapshot') {
        onSnapshot(msg);
      } else if (msg.t === 'full') {
        marker = msg.marker || marker;
        status = 'server full';
      }
    });

    socket.addEventListener('close', () => {
      status = 'closed; reconnecting';
      reconnectTimer = setTimeout(connect, 900);
    });

    socket.addEventListener('error', () => {
      status = 'socket error';
    });
  }

  function onSnapshot(msg) {
    lastSnapshotAt = performance.now();
    lastServerTime = msg.time || 0;
    marker = msg.marker || marker;
    if (msg.map) {
      world.cols = msg.map.cols || world.cols;
      world.rows = msg.map.rows || world.rows;
    }

    snapshotPlayers = msg.players || [];
    bullets = msg.bullets || [];
    enemy = msg.enemy || null;

    for (const p of snapshotPlayers) {
      let rp = renderPlayers.get(p.id);
      if (!rp) {
        rp = { x: p.x, y: p.y, tx: p.x, ty: p.y, vx: p.vx || 0, vy: p.vy || 0, aim: p.aim || 0, hp: p.hp || 100 };
        renderPlayers.set(p.id, rp);
      }
      rp.tx = p.x;
      rp.ty = p.y;
      rp.vx = p.vx || 0;
      rp.vy = p.vy || 0;
      rp.aim = p.aim || 0;
      rp.hp = p.hp || 100;

      if (p.id === myId) {
        if (!local) local = { x: p.x, y: p.y, aim: p.aim || 0 };
        const err = Math.hypot(local.x - p.x, local.y - p.y);
        correction = Math.max(correction, err);
        if (err > 2.5) {
          local.x = p.x;
          local.y = p.y;
        } else {
          local.x += (p.x - local.x) * 0.22;
          local.y += (p.y - local.y) * 0.22;
        }
      }
    }

    for (const id of renderPlayers.keys()) {
      if (!snapshotPlayers.some((p) => p.id === id)) renderPlayers.delete(id);
    }
  }

  function send(obj) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(obj));
  }

  function aimAngle() {
    const base = local || renderPlayers.get(myId) || { x: world.cols / 2, y: world.rows / 2 };
    return Math.atan2(mouse.worldY - base.y, mouse.worldX - base.x);
  }

  function sendInput(force = false) {
    const now = performance.now();
    if (!force && now - lastInputSentAt < 1000 / 60) return;
    lastInputSentAt = now;
    send({
      t: 'input',
      seq: ++seq,
      keys: input,
      aim: aimAngle()
    });
  }

  setInterval(() => send({ t: 'ping', clientTime: Date.now() }), 1000);

  function simulateLocal(dt) {
    if (!local) return;

    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (dx || dy) {
      const inv = 1 / Math.hypot(dx, dy);
      dx *= inv;
      dy *= inv;
    }

    const speed = 12.5;
    local.x = clamp(local.x + dx * speed * dt, 1.2, world.cols - 2.2);
    local.y = clamp(local.y + dy * speed * dt, 1.2, world.rows - 2.2);
    local.aim = aimAngle();
    correction *= Math.pow(0.04, dt);
  }

  function updateRemotePlayers(dt) {
    const alpha = 1 - Math.pow(0.001, dt);
    for (const [id, p] of renderPlayers) {
      if (id === myId && local) {
        p.x = local.x;
        p.y = local.y;
        p.aim = local.aim;
        continue;
      }
      const extrap = Math.min(0.07, Math.max(0, (performance.now() - lastSnapshotAt) / 1000));
      const ex = p.tx + p.vx * extrap;
      const ey = p.ty + p.vy * extrap;
      p.x += (ex - p.x) * alpha;
      p.y += (ey - p.y) * alpha;
    }
  }

  function update(dt) {
    simulateLocal(dt);
    updateRemotePlayers(dt);
    sendInput();
  }

  function worldToScreen(x, y) {
    const m = metrics();
    return [m.x0 + x * m.cell, m.y0 + y * m.cell];
  }

  function metrics() {
    const pad = 18;
    const cell = Math.floor(Math.min((canvas.width - pad * 2) / world.cols, (canvas.height - pad * 2) / world.rows));
    const w = world.cols * cell;
    const h = world.rows * cell;
    return { cell, w, h, x0: Math.floor((canvas.width - w) / 2), y0: Math.floor((canvas.height - h) / 2) };
  }

  function draw() {
    resizeCanvas();
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    update(dt);

    frames++;
    if (now - fpsLast >= 500) {
      fps = Math.round((frames * 1000) / (now - fpsLast));
      frames = 0;
      fpsLast = now;
    }

    drawScene(now);
    updateHud(now);
    requestAnimationFrame(draw);
  }

  function drawScene(now) {
    ctx.fillStyle = '#020602';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const m = metrics();
    ctx.save();
    ctx.translate(m.x0, m.y0);

    drawGlowBox(m);
    drawGrid(m, now);
    drawBullets(m, now);
    drawEnemy(m, now);
    drawPlayers(m, now);
    drawCrosshair(m, now);

    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#7dff7a';
    for (let y = 0; y < canvas.height; y += 4) ctx.fillRect(0, y, canvas.width, 1);
    ctx.restore();
  }

  function drawGlowBox(m) {
    ctx.strokeStyle = '#1cff3a';
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, m.w - 1, m.h - 1);
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = 8;
    ctx.strokeRect(2, 2, m.w - 4, m.h - 4);
    ctx.globalAlpha = 1;
  }

  function drawGrid(m, now) {
    const cell = m.cell;
    ctx.save();
    ctx.font = `${Math.max(8, Math.floor(cell * 0.56))}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.strokeStyle = '#123f16';
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= world.cols; x += 2) {
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, m.h);
    }
    for (let y = 0; y <= world.rows; y += 2) {
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(m.w, y * cell + 0.5);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.72;
    for (let y = 0; y < world.rows; y++) {
      for (let x = 0; x < world.cols; x++) {
        const wall = x === 0 || y === 0 || x === world.cols - 1 || y === world.rows - 1;
        if (wall) {
          ctx.fillStyle = '#3cff53';
          ctx.fillText('#', x * cell + cell / 2, y * cell + cell / 2);
        } else if ((x * 7 + y * 11 + Math.floor(now / 180)) % 29 === 0) {
          ctx.fillStyle = '#17691f';
          ctx.fillText('.', x * cell + cell / 2, y * cell + cell / 2);
        }
      }
    }
    ctx.restore();
  }

  function drawPlayers(m) {
    const cell = m.cell;
    ctx.save();
    ctx.font = `${Math.max(14, Math.floor(cell * 1.18))}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const [id, p] of renderPlayers) {
      const sx = p.x * cell;
      const sy = p.y * cell;
      const own = id === myId;

      ctx.globalAlpha = own ? 0.22 : 0.14;
      ctx.fillStyle = own ? '#b7ffb0' : '#5cff73';
      ctx.beginPath();
      ctx.arc(sx, sy, cell * (own ? 1.05 : 0.82), 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
      ctx.fillStyle = own ? '#f0ffed' : '#70ff80';
      ctx.fillText(own ? '@' : '&', sx, sy);

      const ax = sx + Math.cos(p.aim || 0) * cell * 0.95;
      const ay = sy + Math.sin(p.aim || 0) * cell * 0.95;
      ctx.strokeStyle = own ? '#f0ffed' : '#70ff80';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ax, ay);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(m, now) {
    if (!enemy) return;
    const cell = m.cell;
    const alive = enemy.hp > 0;
    const exAge = Math.min(0.07, Math.max(0, (performance.now() - lastSnapshotAt) / 1000));
    const x = (enemy.x + (enemy.vx || 0) * exAge) * cell;
    const y = (enemy.y + (enemy.vy || 0) * exAge) * cell;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(15, Math.floor(cell * 1.25))}px ui-monospace, Menlo, Consolas, monospace`;
    const pulse = 0.5 + Math.sin(now / 90) * 0.5;

    ctx.globalAlpha = alive ? 0.28 + (enemy.hit || 0) * 0.25 : 0.18;
    ctx.fillStyle = alive ? '#9dff61' : '#315b34';
    ctx.beginPath();
    ctx.arc(x, y, cell * (1.2 + pulse * 0.12), 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = alive ? ((enemy.hit || 0) > 0.05 ? '#ffffff' : '#aaff66') : '#315b34';
    ctx.fillText(alive ? 'M' : 'x', x, y);

    ctx.font = `${Math.max(8, Math.floor(cell * 0.45))}px ui-monospace, Menlo, Consolas, monospace`;
    ctx.fillStyle = '#8cff7f';
    if (alive) {
      ctx.fillText(`${enemy.hp}/${enemy.maxHp}`, x, y - cell * 1.25);
    } else {
      ctx.fillText(`respawn ${Math.max(0, enemy.respawnIn || 0).toFixed(1)}`, x, y - cell * 1.25);
    }
    ctx.restore();
  }

  function drawBullets(m) {
    const cell = m.cell;
    const ex = Math.min(0.045, Math.max(0, (performance.now() - lastSnapshotAt) / 1000));
    ctx.save();
    ctx.lineCap = 'round';

    for (const b of bullets) {
      const x = (b.x + b.vx * ex) * cell;
      const y = (b.y + b.vy * ex) * cell;
      const px = (b.px + b.vx * ex) * cell;
      const py = (b.py + b.vy * ex) * cell;
      const mine = b.owner === myId;

      ctx.globalAlpha = mine ? 0.95 : 0.62;
      ctx.strokeStyle = mine ? '#efffea' : '#6dff76';
      ctx.lineWidth = mine ? 2.2 : 1.4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();

      ctx.globalAlpha = mine ? 1 : 0.75;
      ctx.fillStyle = mine ? '#ffffff' : '#78ff80';
      ctx.beginPath();
      ctx.arc(x, y, mine ? 2.2 : 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawCrosshair(m, now) {
    if (!mouse.inside) return;
    const cell = m.cell;
    const x = mouse.worldX * cell;
    const y = mouse.worldY * cell;
    const r = 5 + Math.sin(now / 80) * 1.5;

    ctx.save();
    ctx.strokeStyle = input.fire ? '#ffffff' : '#52ff63';
    ctx.globalAlpha = input.fire ? 0.95 : 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r);
    ctx.lineTo(x, y + r);
    ctx.stroke();
    ctx.restore();
  }

  function updateHud(now) {
    const snapAge = lastSnapshotAt ? Math.round(now - lastSnapshotAt) : '--';
    const srvAge = lastServerTime ? Date.now() - lastServerTime : '--';
    const count = snapshotPlayers.length;
    const b = bullets.length;
    const e = enemy ? `${enemy.hp}/${enemy.maxHp}` : '--';
    const mode = input.fire ? 'FIRE' : 'MOVE';

    hud.textContent =
      `status ${status} · ${mode}\n` +
      `players ${count}/4 · bullets ${b} · enemy ${e}\n` +
      `fps ${fps} · ping ${ping}ms · snap ${snapAge}ms · srv ${srvAge}ms\n` +
      `correction ${correction.toFixed(3)} · ${marker}`;

    if (stage) stage.textContent = status.toUpperCase();
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  connect();
  draw();
})();
