(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const menu = $("menu");
  const game = $("game");
  const roomInput = $("roomInput");
  const createBtn = $("createBtn");
  const joinBtn = $("joinBtn");
  const leaveBtn = $("leaveBtn");
  const menuStatus = $("menuStatus");
  const netStatus = $("netStatus");
  const roomTitle = $("roomTitle");
  const gameHud = $("gameHud");
  const canvas = $("screen");
  const ctx = canvas.getContext("2d");

  const SIGNALING_URL = window.NN_SIGNALING_URL || "https://dengidermo-1.onrender.com";
  const ROOM_RE = /^[A-Z0-9-]{3,12}$/;
  const WORLD = { w: 1800, h: 1200 };
  const VIEW = { w: canvas.width, h: canvas.height };
  const MAX_PLAYERS = 4;
  const PLAYER_SIZE = 14;
  const WALL_PAD = 16;

  const WEAPONS = {
    pistol: { label: "PISTOL", cd: 0.18, speed: 560, life: 0.75, dmg: 1, pellets: 1, spread: 0, size: 3 },
    smg: { label: "SMG", cd: 0.07, speed: 520, life: 0.65, dmg: 1, pellets: 1, spread: 0.13, size: 2 },
    shotgun: { label: "SHOTGUN", cd: 0.42, speed: 500, life: 0.42, dmg: 1, pellets: 6, spread: 0.58, size: 3 },
    rail: { label: "RAIL", cd: 0.62, speed: 880, life: 0.72, dmg: 5, pellets: 1, spread: 0, size: 4 }
  };

  const MOB_DATA = {
    grunt: { hp: 2, speed: 72, size: 13, touch: 1 },
    fast: { hp: 1, speed: 128, size: 9, touch: 1 },
    tank: { hp: 8, speed: 42, size: 22, touch: 2 },
    shooter: { hp: 3, speed: 50, size: 14, touch: 1 },
    boss: { hp: 90, speed: 28, size: 40, touch: 3 }
  };

  let ws = null;
  let role = "none";
  let roomId = null;
  let playerId = null;
  let loopId = 0;
  let lastFrame = 0;
  let lastStateSent = 0;
  let lastInputSent = 0;
  let lastState = null;
  let playersInRoom = new Set();
  let connected = false;

  const pressed = new Set();
  const inputs = Object.create(null);
  let localInput = emptyInput();

  function emptyInput() {
    return { left: false, right: false, up: false, down: false, fire: false };
  }

  function setStatus(text) {
    menuStatus.textContent = text;
    netStatus.textContent = text;
  }

  function randomRoomId() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  }

  function normalizeRoomId(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
  }

  function toWsUrl(raw) {
    const withProtocol = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    url.protocol = url.protocol === "https:" ? "wss:" : url.protocol === "http:" ? "ws:" : url.protocol;
    return url.toString().replace(/\/$/, "");
  }

  function sendWs(message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(message));
    return true;
  }

  function connectSignaling() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(toWsUrl(SIGNALING_URL));
      let settled = false;

      socket.onopen = () => {
        settled = true;
        ws = socket;
        bindSignalingEvents(socket);
        resolve(socket);
      };

      socket.onerror = () => {
        if (!settled) reject(new Error("Cannot reach game server."));
      };

      socket.onclose = () => {
        if (!settled) reject(new Error("Game server closed the connection."));
      };
    });
  }

  function bindSignalingEvents(socket) {
    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "joined") {
        connected = true;
        roomId = msg.roomId;
        playerId = msg.playerId;
        role = msg.isHost ? "host" : "guest";
        playersInRoom = new Set(msg.players || [playerId]);
        inputs[playerId] = emptyInput();
        roomTitle.textContent = roomId;
        showGame();
        updateUrlRoom(roomId);

        if (role === "host") {
          lastState = createInitialState(Array.from(playersInRoom));
          setStatus("Room created. Players can join anytime.");
        } else {
          setStatus("Joined. Waiting for world state...");
        }

        ensureLoop();
        return;
      }

      if (msg.type === "player-joined") {
        playersInRoom = new Set(msg.players || Array.from(playersInRoom).concat(msg.playerId));
        if (role === "host" && lastState) ensurePlayer(msg.playerId);
        setStatus(`${playersInRoom.size}/${MAX_PLAYERS} players online.`);
        return;
      }

      if (msg.type === "player-left") {
        playersInRoom = new Set(msg.players || []);
        if (role === "host" && lastState) {
          delete lastState.players[msg.playerId];
          delete inputs[msg.playerId];
        }
        setStatus(`${playersInRoom.size}/${MAX_PLAYERS} players online.`);
        return;
      }

      if (msg.type === "input" && role === "host") {
        inputs[msg.from] = normalizeInput(msg.input);
        return;
      }

      if (msg.type === "state" && role !== "host") {
        lastState = msg.state;
        return;
      }

      if (msg.type === "room-closed") {
        stopAll(false);
        showMenu("Host left. Create or join again.");
        return;
      }

      if (msg.type === "error") {
        stopAll(false);
        showMenu(msg.message || "Connection error.");
      }
    };

    socket.onclose = () => {
      if (connected) {
        stopAll(false);
        showMenu("Disconnected from game server.");
      }
    };
  }

  async function createGame() {
    try {
      stopAll(false);
      roomId = randomRoomId();
      roomInput.value = roomId;
      setStatus("Connecting...");
      await connectSignaling();
      sendWs({ type: "create", roomId });
    } catch (error) {
      stopAll(false);
      showMenu(error.message);
    }
  }

  async function joinGame() {
    try {
      stopAll(false);
      roomId = normalizeRoomId(roomInput.value);
      roomInput.value = roomId;
      if (!ROOM_RE.test(roomId)) throw new Error("Enter a room ID.");
      setStatus("Connecting...");
      await connectSignaling();
      sendWs({ type: "join", roomId });
    } catch (error) {
      stopAll(false);
      showMenu(error.message);
    }
  }

  function showGame() {
    menu.classList.add("hidden");
    game.classList.remove("hidden");
  }

  function showMenu(text = "Offline.") {
    game.classList.add("hidden");
    menu.classList.remove("hidden");
    setStatus(text);
  }

  function updateUrlRoom(id) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", id);
    window.history.replaceState({}, "", url.toString());
  }

  function createInitialState(playerIds) {
    const state = {
      tick: 0,
      time: 0,
      wave: 1,
      world: { w: WORLD.w, h: WORLD.h },
      players: {},
      mobs: [],
      bullets: [],
      loot: [],
      nextMobId: 1,
      nextBulletId: 1,
      nextLootId: 1,
      spawnClock: 0.15,
      waveClock: 0,
      bossClock: 18
    };
    lastState = state;
    for (const id of playerIds) ensurePlayer(id);
    for (let i = 0; i < 7; i += 1) spawnMob(randomMobType());
    return state;
  }

  function ensurePlayer(id) {
    if (!lastState || !id || lastState.players[id]) return;
    const slot = Number(id.slice(1)) || 1;
    const offsets = [
      { x: -24, y: -18 },
      { x: 24, y: -18 },
      { x: -24, y: 18 },
      { x: 24, y: 18 }
    ];
    const off = offsets[(slot - 1) % offsets.length];
    lastState.players[id] = {
      id,
      x: WORLD.w / 2 + off.x,
      y: WORLD.h / 2 + off.y,
      hp: 8,
      maxHp: 8,
      weapon: "pistol",
      aimX: 1,
      aimY: 0,
      fireCd: 0,
      hitCd: 0,
      dead: false,
      respawn: 0,
      kills: 0
    };
    inputs[id] = inputs[id] || emptyInput();
  }

  function ensureLoop() {
    if (loopId) return;
    lastFrame = performance.now();
    const loop = (now) => {
      if (!connected) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
      lastFrame = now;
      updateLocalInput();

      if (role === "host" && lastState) {
        inputs[playerId] = localInput;
        updateHostWorld(dt);
        if (now - lastStateSent > 50) {
          lastStateSent = now;
          sendWs({ type: "state", state: packState(lastState) });
        }
      } else if (role === "guest" && now - lastInputSent > 30) {
        lastInputSent = now;
        sendWs({ type: "input", input: localInput });
      }

      draw();
      loopId = requestAnimationFrame(loop);
    };
    loopId = requestAnimationFrame(loop);
  }

  function updateLocalInput() {
    localInput = {
      left: pressed.has("arrowleft") || pressed.has("a"),
      right: pressed.has("arrowright") || pressed.has("d"),
      up: pressed.has("arrowup") || pressed.has("w"),
      down: pressed.has("arrowdown") || pressed.has("s"),
      fire: pressed.has(" ") || pressed.has("enter")
    };
  }

  function normalizeInput(input) {
    return {
      left: Boolean(input && input.left),
      right: Boolean(input && input.right),
      up: Boolean(input && input.up),
      down: Boolean(input && input.down),
      fire: Boolean(input && input.fire)
    };
  }

  function updateHostWorld(dt) {
    const state = lastState;
    state.tick += 1;
    state.time += dt;
    state.waveClock += dt;
    state.spawnClock -= dt;
    state.bossClock -= dt;

    if (state.waveClock >= 20) {
      state.waveClock = 0;
      state.wave += 1;
    }

    for (const id of playersInRoom) ensurePlayer(id);

    for (const player of Object.values(state.players)) updatePlayer(player, normalizeInput(inputs[player.id]), dt);
    updateBullets(dt);
    updateMobs(dt);
    updateLoot(dt);

    const onlineCount = Math.max(1, playersInRoom.size);
    const mobCap = 12 + onlineCount * 5 + Math.min(12, state.wave * 2);
    if (state.spawnClock <= 0 && state.mobs.length < mobCap) {
      state.spawnClock = Math.max(0.35, 1.1 - state.wave * 0.045);
      spawnMob(randomMobType());
    }

    const bossAlive = state.mobs.some((mob) => mob.type === "boss");
    if (state.bossClock <= 0 && !bossAlive) {
      state.bossClock = 38;
      spawnMob("boss");
    }

    if (state.bullets.length > 150) state.bullets.splice(0, state.bullets.length - 150);
    if (state.loot.length > 50) state.loot.splice(0, state.loot.length - 50);
  }

  function updatePlayer(player, input, dt) {
    if (player.dead) {
      player.respawn -= dt;
      if (player.respawn <= 0) {
        player.dead = false;
        player.hp = player.maxHp;
        player.x = WORLD.w / 2 + rand(-50, 50);
        player.y = WORLD.h / 2 + rand(-50, 50);
      }
      return;
    }

    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      player.aimX = dx;
      player.aimY = dy;
      const speed = 196;
      player.x = clamp(player.x + dx * speed * dt, WALL_PAD, WORLD.w - WALL_PAD - PLAYER_SIZE);
      player.y = clamp(player.y + dy * speed * dt, WALL_PAD, WORLD.h - WALL_PAD - PLAYER_SIZE);
    }

    player.fireCd = Math.max(0, player.fireCd - dt);
    player.hitCd = Math.max(0, player.hitCd - dt);
    if (input.fire && player.fireCd <= 0) shootPlayerWeapon(player);

    for (let i = lastState.loot.length - 1; i >= 0; i -= 1) {
      const item = lastState.loot[i];
      if (dist(player.x + 7, player.y + 7, item.x, item.y) > 18) continue;
      if (item.kind === "heal") {
        player.hp = Math.min(player.maxHp, player.hp + 3);
      } else if (item.kind === "weapon") {
        player.weapon = item.weapon;
      }
      lastState.loot.splice(i, 1);
    }
  }

  function shootPlayerWeapon(player) {
    const weapon = WEAPONS[player.weapon] || WEAPONS.pistol;
    player.fireCd = weapon.cd;
    const baseAngle = Math.atan2(player.aimY || 0, player.aimX || 1);
    const pellets = weapon.pellets;

    for (let i = 0; i < pellets; i += 1) {
      const spread = pellets === 1 ? randomSpread(weapon.spread) : (-weapon.spread / 2) + (weapon.spread * i) / Math.max(1, pellets - 1);
      const angle = baseAngle + spread + randomSpread(weapon.spread * 0.25);
      lastState.bullets.push({
        id: lastState.nextBulletId++,
        team: "player",
        owner: player.id,
        x: player.x + PLAYER_SIZE / 2,
        y: player.y + PLAYER_SIZE / 2,
        vx: Math.cos(angle) * weapon.speed,
        vy: Math.sin(angle) * weapon.speed,
        life: weapon.life,
        dmg: weapon.dmg,
        size: weapon.size
      });
    }
  }

  function updateBullets(dt) {
    const bullets = lastState.bullets;
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (b.life <= 0 || b.x < -20 || b.y < -20 || b.x > WORLD.w + 20 || b.y > WORLD.h + 20) {
        bullets.splice(i, 1);
        continue;
      }

      if (b.team === "player") {
        const hitIndex = lastState.mobs.findIndex((mob) => dist(b.x, b.y, mob.x, mob.y) < mob.size / 2 + b.size + 2);
        if (hitIndex >= 0) {
          const mob = lastState.mobs[hitIndex];
          mob.hp -= b.dmg;
          bullets.splice(i, 1);
          if (mob.hp <= 0) killMob(hitIndex, b.owner);
        }
      } else {
        for (const player of Object.values(lastState.players)) {
          if (player.dead) continue;
          if (dist(b.x, b.y, player.x + 7, player.y + 7) < 10 + b.size) {
            damagePlayer(player, b.dmg || 1);
            bullets.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  function updateMobs(dt) {
    for (let i = lastState.mobs.length - 1; i >= 0; i -= 1) {
      const mob = lastState.mobs[i];
      const target = nearestPlayer(mob.x, mob.y);
      if (!target) continue;

      const dx = target.x + PLAYER_SIZE / 2 - mob.x;
      const dy = target.y + PLAYER_SIZE / 2 - mob.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = mob.speed * (1 + Math.min(0.7, lastState.wave * 0.035));
      mob.x = clamp(mob.x + (dx / d) * speed * dt, WALL_PAD, WORLD.w - WALL_PAD);
      mob.y = clamp(mob.y + (dy / d) * speed * dt, WALL_PAD, WORLD.h - WALL_PAD);
      mob.hitCd = Math.max(0, mob.hitCd - dt);
      mob.fireCd = Math.max(0, mob.fireCd - dt);

      if (d < mob.size / 2 + 10 && mob.hitCd <= 0) {
        mob.hitCd = mob.type === "boss" ? 0.6 : 0.8;
        damagePlayer(target, mob.touch);
      }

      if ((mob.type === "shooter" || mob.type === "boss") && mob.fireCd <= 0) {
        mob.fireCd = mob.type === "boss" ? 0.75 : 1.25;
        shootMob(mob, target);
      }
    }
  }

  function shootMob(mob, target) {
    const angle = Math.atan2(target.y + PLAYER_SIZE / 2 - mob.y, target.x + PLAYER_SIZE / 2 - mob.x);
    const shots = mob.type === "boss" ? 5 : 1;
    const spread = mob.type === "boss" ? 0.55 : 0;
    for (let i = 0; i < shots; i += 1) {
      const a = angle + (shots === 1 ? 0 : -spread / 2 + (spread * i) / (shots - 1));
      lastState.bullets.push({
        id: lastState.nextBulletId++,
        team: "mob",
        owner: mob.id,
        x: mob.x,
        y: mob.y,
        vx: Math.cos(a) * 230,
        vy: Math.sin(a) * 230,
        life: 1.45,
        dmg: mob.type === "boss" ? 2 : 1,
        size: mob.type === "boss" ? 4 : 3
      });
    }
  }

  function updateLoot(dt) {
    for (let i = lastState.loot.length - 1; i >= 0; i -= 1) {
      lastState.loot[i].ttl -= dt;
      if (lastState.loot[i].ttl <= 0) lastState.loot.splice(i, 1);
    }
  }

  function damagePlayer(player, amount) {
    if (player.hitCd > 0 || player.dead) return;
    player.hitCd = 0.4;
    player.hp -= amount;
    if (player.hp <= 0) {
      player.hp = 0;
      player.dead = true;
      player.respawn = 2.5;
      dropLoot(player.x + 8, player.y + 8, true);
    }
  }

  function killMob(index, ownerId) {
    const mob = lastState.mobs[index];
    lastState.mobs.splice(index, 1);
    const owner = lastState.players[ownerId];
    if (owner) owner.kills += mob.type === "boss" ? 10 : 1;
    dropLoot(mob.x, mob.y, mob.type === "boss" || Math.random() < 0.28);
  }

  function dropLoot(x, y, force) {
    if (!force && Math.random() > 0.22) return;
    const roll = Math.random();
    let item;
    if (roll < 0.28) {
      item = { kind: "heal" };
    } else {
      const weapons = roll < 0.58 ? ["smg", "shotgun"] : ["smg", "shotgun", "rail"];
      item = { kind: "weapon", weapon: weapons[Math.floor(Math.random() * weapons.length)] };
    }
    lastState.loot.push({
      id: lastState.nextLootId++,
      x: clamp(x + rand(-18, 18), 24, WORLD.w - 24),
      y: clamp(y + rand(-18, 18), 24, WORLD.h - 24),
      ttl: 18,
      ...item
    });
  }

  function spawnMob(type) {
    if (!lastState) return;
    const data = MOB_DATA[type] || MOB_DATA.grunt;
    const edge = Math.floor(Math.random() * 4);
    let x = rand(80, WORLD.w - 80);
    let y = rand(80, WORLD.h - 80);
    if (edge === 0) y = 40;
    if (edge === 1) x = WORLD.w - 40;
    if (edge === 2) y = WORLD.h - 40;
    if (edge === 3) x = 40;

    lastState.mobs.push({
      id: lastState.nextMobId++,
      type,
      x,
      y,
      hp: Math.ceil(data.hp * (1 + lastState.wave * 0.08)),
      maxHp: Math.ceil(data.hp * (1 + lastState.wave * 0.08)),
      speed: data.speed,
      size: data.size,
      touch: data.touch,
      hitCd: 0,
      fireCd: rand(0.2, 1.4)
    });
  }

  function randomMobType() {
    const wave = lastState ? lastState.wave : 1;
    const r = Math.random();
    if (wave >= 2 && r > 0.82) return "shooter";
    if (wave >= 2 && r > 0.66) return "tank";
    if (r > 0.42) return "fast";
    return "grunt";
  }

  function nearestPlayer(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const player of Object.values(lastState.players)) {
      if (player.dead) continue;
      const d = dist(x, y, player.x, player.y);
      if (d < bestD) {
        best = player;
        bestD = d;
      }
    }
    return best;
  }

  function packState(state) {
    return state;
  }

  function draw() {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);

    if (!lastState) {
      drawScreenText("WAITING", VIEW.w / 2 - 28, VIEW.h / 2);
      gameHud.textContent = "HP -- | WEAPON -- | MOBS --";
      return;
    }

    const me = lastState.players[playerId] || Object.values(lastState.players)[0];
    const cam = cameraFor(me);

    drawGrid(cam);
    drawWorldBorder(cam);
    drawLoot(cam);
    drawBullets(cam);
    drawMobs(cam);
    drawPlayers(cam);

    const hp = me ? `${Math.max(0, Math.ceil(me.hp))}/${me.maxHp}` : "--";
    const weapon = me ? (WEAPONS[me.weapon] || WEAPONS.pistol).label : "--";
    gameHud.textContent = `P ${playersInRoom.size}/${MAX_PLAYERS} | HP ${hp} | ${weapon} | WAVE ${lastState.wave} | MOBS ${lastState.mobs.length}`;
  }

  function cameraFor(player) {
    if (!player) return { x: 0, y: 0 };
    return {
      x: clamp(player.x + PLAYER_SIZE / 2 - VIEW.w / 2, 0, WORLD.w - VIEW.w),
      y: clamp(player.y + PLAYER_SIZE / 2 - VIEW.h / 2, 0, WORLD.h - VIEW.h)
    };
  }

  function worldX(x, cam) {
    return Math.floor(x - cam.x);
  }

  function worldY(y, cam) {
    return Math.floor(y - cam.y);
  }

  function drawGrid(cam) {
    ctx.strokeStyle = "#1c1c1c";
    ctx.lineWidth = 1;
    const step = 48;
    const startX = Math.floor(cam.x / step) * step;
    const startY = Math.floor(cam.y / step) * step;
    for (let x = startX; x < cam.x + VIEW.w; x += step) {
      ctx.beginPath();
      ctx.moveTo(worldX(x, cam), 0);
      ctx.lineTo(worldX(x, cam), VIEW.h);
      ctx.stroke();
    }
    for (let y = startY; y < cam.y + VIEW.h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, worldY(y, cam));
      ctx.lineTo(VIEW.w, worldY(y, cam));
      ctx.stroke();
    }
  }

  function drawWorldBorder(cam) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(worldX(0, cam), worldY(0, cam), WORLD.w, WORLD.h);
  }

  function drawPlayers(cam) {
    for (const player of Object.values(lastState.players)) {
      const x = worldX(player.x, cam);
      const y = worldY(player.y, cam);
      if (player.dead) {
        ctx.strokeStyle = "#555";
        ctx.strokeRect(x, y, PLAYER_SIZE, PLAYER_SIZE);
        continue;
      }

      if (player.id === playerId) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(x, y, PLAYER_SIZE, PLAYER_SIZE);
        ctx.fillStyle = "#000";
        ctx.fillRect(x + 4, y + 4, 3, 3);
      } else {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, PLAYER_SIZE, PLAYER_SIZE);
      }

      drawSmallText(player.id, x - 1, y - 6);
      drawBar(x, y + PLAYER_SIZE + 4, PLAYER_SIZE, 3, player.hp / player.maxHp);
    }
  }

  function drawMobs(cam) {
    for (const mob of lastState.mobs) {
      const x = worldX(mob.x - mob.size / 2, cam);
      const y = worldY(mob.y - mob.size / 2, cam);
      ctx.strokeStyle = "#fff";
      ctx.fillStyle = "#fff";
      ctx.lineWidth = 2;

      if (mob.type === "fast") {
        ctx.fillRect(x, y, mob.size, mob.size);
      } else if (mob.type === "tank") {
        ctx.strokeRect(x, y, mob.size, mob.size);
        ctx.strokeRect(x + 4, y + 4, mob.size - 8, mob.size - 8);
      } else if (mob.type === "shooter") {
        ctx.strokeRect(x, y, mob.size, mob.size);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + mob.size, y + mob.size);
        ctx.moveTo(x + mob.size, y);
        ctx.lineTo(x, y + mob.size);
        ctx.stroke();
      } else if (mob.type === "boss") {
        ctx.strokeRect(x, y, mob.size, mob.size);
        ctx.strokeRect(x + 6, y + 6, mob.size - 12, mob.size - 12);
        drawSmallText("BOSS", x + 3, y - 6);
      } else {
        ctx.strokeRect(x, y, mob.size, mob.size);
      }
      drawBar(x, y + mob.size + 4, mob.size, 3, mob.hp / mob.maxHp);
    }
  }

  function drawBullets(cam) {
    for (const b of lastState.bullets) {
      ctx.fillStyle = b.team === "player" ? "#fff" : "#888";
      const s = b.size || 2;
      ctx.fillRect(worldX(b.x - s / 2, cam), worldY(b.y - s / 2, cam), s, s);
    }
  }

  function drawLoot(cam) {
    for (const item of lastState.loot) {
      const x = worldX(item.x, cam);
      const y = worldY(item.y, cam);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.stroke();
      drawSmallText(item.kind === "heal" ? "+" : item.weapon[0].toUpperCase(), x - 3, y + 3);
    }
  }

  function drawBar(x, y, w, h, value) {
    const v = clamp(value || 0, 0, 1);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, Math.max(0, Math.floor(w * v)), h);
  }

  function drawSmallText(text, x, y) {
    ctx.fillStyle = "#fff";
    ctx.font = "8px monospace";
    ctx.fillText(text, x, y);
  }

  function drawScreenText(text, x, y) {
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    ctx.fillText(text, x, y);
  }

  function stopAll(sendLeave = true) {
    connected = false;

    if (loopId) {
      cancelAnimationFrame(loopId);
      loopId = 0;
    }

    if (sendLeave && ws && ws.readyState === WebSocket.OPEN && roomId) {
      sendWs({ type: "leave" });
    }

    if (ws) {
      try { ws.close(); } catch {}
      ws = null;
    }

    role = "none";
    roomId = null;
    playerId = null;
    lastState = null;
    lastFrame = 0;
    lastStateSent = 0;
    lastInputSent = 0;
    playersInRoom = new Set();
    pressed.clear();
    for (const key of Object.keys(inputs)) delete inputs[key];
    localInput = emptyInput();

    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomSpread(amount) {
    return amount ? rand(-amount / 2, amount / 2) : 0;
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  window.addEventListener("keydown", (event) => {
    const k = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "enter", "w", "a", "s", "d"].includes(k)) {
      event.preventDefault();
      pressed.add(k);
    }
  });

  window.addEventListener("keyup", (event) => {
    pressed.delete(event.key.toLowerCase());
  });

  window.addEventListener("beforeunload", () => stopAll(true));

  createBtn.addEventListener("click", createGame);
  joinBtn.addEventListener("click", joinGame);
  leaveBtn.addEventListener("click", () => {
    stopAll(true);
    showMenu("Offline.");
  });

  roomInput.addEventListener("input", () => {
    const pos = roomInput.selectionStart || 0;
    roomInput.value = normalizeRoomId(roomInput.value);
    roomInput.selectionStart = pos;
    roomInput.selectionEnd = pos;
  });

  const startRoom = new URLSearchParams(window.location.search).get("room");
  if (startRoom) {
    roomInput.value = normalizeRoomId(startRoom);
    menuStatus.textContent = "Room link loaded. Press Join.";
  }

  draw();
})();
