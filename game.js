(() => {
  const cfg = window.NETROGUE_CONFIG || {};
  const WS_URL = cfg.BACKEND_WS_URL || ((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const hud = document.getElementById('hud');
  const cols = 48;
  const rows = 30;
  const cw = canvas.width / cols;
  const ch = canvas.height / rows;
  let socket = null;
  let status = 'boot';
  let myId = null;
  let seq = 0;
  let lastSnapshotAt = 0;
  let ping = 0;
  let players = [];
  let keys = { up:false, down:false, left:false, right:false };
  let reconnectTimer = 0;

  function setKey(code, down) {
    if (code === 'KeyW' || code === 'ArrowUp') keys.up = down;
    if (code === 'KeyS' || code === 'ArrowDown') keys.down = down;
    if (code === 'KeyA' || code === 'ArrowLeft') keys.left = down;
    if (code === 'KeyD' || code === 'ArrowRight') keys.right = down;
  }
  addEventListener('keydown', (e) => { setKey(e.code, true); if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault(); });
  addEventListener('keyup', (e) => setKey(e.code, false));

  function connect() {
    clearTimeout(reconnectTimer);
    status = 'connecting';
    socket = new WebSocket(WS_URL);
    socket.addEventListener('open', () => { status = 'open'; });
    socket.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.t === 'welcome') { myId = msg.id; status = 'joined'; }
      if (msg.t === 'pong') { ping = Math.max(0, Date.now() - msg.clientTime); }
      if (msg.t === 'snapshot') {
        lastSnapshotAt = Date.now();
        players = msg.players || [];
      }
      if (msg.t === 'full') status = 'server full';
    });
    socket.addEventListener('close', () => {
      status = 'closed; reconnecting';
      reconnectTimer = setTimeout(connect, 1000);
    });
    socket.addEventListener('error', () => { status = 'socket error'; });
  }

  function send(obj) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(obj));
  }

  setInterval(() => {
    send({ t:'input', seq:++seq, keys });
  }, 50);
  setInterval(() => {
    send({ t:'ping', clientTime: Date.now() });
  }, 1000);

  function draw() {
    ctx.fillStyle = '#071008';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.font = '18px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let y=0;y<rows;y++) {
      for (let x=0;x<cols;x++) {
        const wall = x===0 || y===0 || x===cols-1 || y===rows-1;
        if (wall) {
          ctx.fillStyle = '#285f2c';
          ctx.fillText('#', x*cw+cw/2, y*ch+ch/2);
        } else if ((x+y)%13===0) {
          ctx.fillStyle = '#163118';
          ctx.fillText('.', x*cw+cw/2, y*ch+ch/2);
        }
      }
    }
    for (const p of players) {
      ctx.fillStyle = p.id === myId ? '#e8ffe5' : '#7cc7ff';
      ctx.fillText(p.id === myId ? '@' : '&', p.x*cw+cw/2, p.y*ch+ch/2);
      ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
      ctx.fillText(p.id.slice(0,4), p.x*cw+cw/2, p.y*ch+ch*0.15);
      ctx.font = '18px ui-monospace, Menlo, Consolas, monospace';
    }
    const age = lastSnapshotAt ? Date.now() - lastSnapshotAt : -1;
    hud.textContent = `status ${status} · players ${players.length}/4 · ping ${ping}ms · snap ${age < 0 ? '--' : age + 'ms'}\nws ${WS_URL}`;
    requestAnimationFrame(draw);
  }
  connect();
  draw();
})();
