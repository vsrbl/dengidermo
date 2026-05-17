(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const menu = $("menu");
  const game = $("game");
  const roomInput = $("roomInput");
  const createBtn = $("createBtn");
  const joinBtn = $("joinBtn");
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
  const GREEN = "#00ff66";
  const STATE_SEND_MS = 33;
  const INPUT_SEND_MS = 16;
  const PING_SEND_MS = 1000;
  const SNAP_DISTANCE = 520;
  const VERSION = "v8";

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
  let renderState = null;
  let playersInRoom = new Set();
  let connected = false;
  let hasCamera = false;
  let camera = { x: 0, y: 0 };
  let gotFirstState = false;
  let pingMs = null;
  let lastPingSent = 0;
  let lastPongAt = 0;
  let localPose = null;

  const pressed = new Set();
  const inputs = Object.create(null);
  const mouse = { x: VIEW.w / 2, y: VIEW.h / 2, down: false };
  let localInput = emptyInput();
  let lastSentInput = "";

  function emptyInput() {
    return { left: false, right: false, up: false, down: false, fire: false, aimX: 1, aimY: 0, px: null, py: null };
  }

  function setStatus(text) {
    menuStatus.textContent = text;
  }

  function updateNetStatus() {
    if (!netStatus) return;
    if (!connected) {
      netStatus.textContent = "OFFLINE";
      return;
    }
    const ping = pingMs === null ? "--" : String(pingMs);
    const mode = role === "host" ? "HOST" : "GUEST";
    const id = playerId || "--";
    const sync = gotFirstState ? "OK" : "WAIT";
    netStatus.textContent = `V8 | PING ${ping} MS | ${mode} ${id} | ${playersInRoom.size}/${MAX_PLAYERS} | ${sync}`;
  }

  function maybePing(now) {
    if (!connected) return;
    if (now - lastPingSent >= PING_SEND_MS) {
      lastPingSent = now;
      sendWs({ type: "ping", t: now });
    }
    if (lastPongAt && now - lastPongAt > 5000) pingMs = null;
    updateNetStatus();
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

      if (msg.type === "pong") {
        if (typeof msg.t === "number") {
          pingMs = Math.max(0, Math.round(performance.now() - msg.t));
          lastPongAt = performance.now();
        }
        updateNetStatus();
        return;
      }

      if (msg.type === "joined") {
        connected = true;
        roomId = msg.roomId;
        playerId = msg.playerId;
        role = msg.isHost ? "host" : "guest";
        pingMs = null;
        lastPingSent = -PING_SEND_MS;
        lastPongAt = 0;
        localPose = null;
        playersInRoom = new Set(msg.players || [playerId]);
        inputs[playerId] = emptyInput();
        roomTitle.textContent = roomId;
        showGame();
        updateUrlRoom(roomId);

        if (role === "host") {
          lastState = createInitialState(Array.from(playersInRoom));
          renderState = lastState;
          localPose = clone(lastState.players[playerId]);
          gotFirstState = true;
          setStatus("Room ready. Join anytime.");
        } else {
          renderState = null;
          gotFirstState = false;
          setStatus("Connected.");
        }

        updateNetStatus();
        ensureLoop();
        return;
      }

      if (msg.type === "player-joined") {
        playersInRoom = new Set(msg.players || Array.from(playersInRoom).concat(msg.playerId));
        if (role === "host" && lastState) ensurePlayer(msg.playerId);
        setStatus(`${playersInRoom.size}/${MAX_PLAYERS} players online.`);
        updateNetStatus();
        return;
      }

      if (msg.type === "player-left") {
        playersInRoom = new Set(msg.players || []);
        if (role === "host" && lastState) {
          delete lastState.players[msg.playerId];
          delete inputs[msg.playerId];
        }
        setStatus(`${playersInRoom.size}/${MAX_PLAYERS} players online.`);
        updateNetStatus();
        return;
      }

      if (msg.type === "input" && role === "host") {
        inputs[msg.from] = normalizeInput(msg.input);
        return;
      }

      if (msg.type === "state" && role !== "host") {
        receiveState(msg.state);
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

      updateLocalInput(dt);
      maybePing(now);

      if (role === "host" && lastState) {
        inputs[playerId] = localInput;
        updateHostWorld(dt);
        renderState = lastState;
        if (now - lastStateSent > STATE_SEND_MS) {
          lastStateSent = now;
          sendWs({ type: "state", state: packState(lastState) });
        }
      } else {
        updateRenderState(dt);
        updateGuestLocalPose(dt);
        const outboundInput = withLocalPose(localInput);
        const sig = inputSignature(outboundInput);
        if (now - lastInputSent > INPUT_SEND_MS || sig !== lastSentInput) {
          lastInputSent = now;
          lastSentInput = sig;
          sendWs({ type: "input", input: outboundInput });
        }
      }

      draw(dt);
      loopId = requestAnimationFrame(loop);
    };
    loopId = requestAnimationFrame(loop);
  }

  function updateLocalInput() {
    const state = renderState || lastState;
    const me = state && playerId ? state.players[playerId] : null;
    const aim = aimVectorFor(me);

    localInput = {
      left: pressed.has("ArrowLeft") || pressed.has("KeyA"),
      right: pressed.has("ArrowRight") || pressed.has("KeyD"),
      up: pressed.has("ArrowUp") || pressed.has("KeyW"),
      down: pressed.has("ArrowDown") || pressed.has("KeyS"),
      fire: mouse.down || pressed.has("Space") || pressed.has("Enter"),
      aimX: aim.x,
      aimY: aim.y
    };
  }

  function aimVectorFor(player) {
    if (!player) return { x: localInput.aimX || 1, y: localInput.aimY || 0 };
    const wx = camera.x + mouse.x;
    const wy = camera.y + mouse.y;
    const px = player.x + PLAYER_SIZE / 2;
    const py = player.y + PLAYER_SIZE / 2;
    const dx = wx - px;
    const dy = wy - py;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return { x: player.aimX || 1, y: player.aimY || 0 };
    return { x: dx / len, y: dy / len };
  }

  function normalizeInput(input) {
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
      clean.px = clamp(px, WALL_PAD, WORLD.w - WALL_PAD - PLAYER_SIZE);
      clean.py = clamp(py, WALL_PAD, WORLD.h - WALL_PAD - PLAYER_SIZE);
    }
    return clean;
  }

  function withLocalPose(input) {
    const me = localPose || (renderState && playerId ? renderState.players[playerId] : null) || (lastState && playerId ? lastState.players[playerId] : null);
    if (!me) return input;
    return { ...input, px: r1(me.x), py: r1(me.y) };
  }

  function isMovingInput(input) {
    return Boolean(input && (input.left || input.right || input.up || input.down));
  }

  function inputSignature(input) {
    return `${input.left ? 1 : 0}${input.right ? 1 : 0}${input.up ? 1 : 0}${input.down ? 1 : 0}${input.fire ? 1 : 0}:${Math.round(input.aimX * 100)}:${Math.round(input.aimY * 100)}:${Math.round((input.px || 0) * 10)}:${Math.round((input.py || 0) * 10)}`;
  }

  function ensureLocalPoseFromServer() {
    if (!playerId) return null;
    const serverPlayer = lastState && lastState.players ? lastState.players[playerId] : null;
    if (!localPose && serverPlayer) {
      localPose = clone(serverPlayer);
    }
    return serverPlayer;
  }

  function updateGuestLocalPose(dt) {
    if (role !== "guest") return;
    const serverPlayer = ensureLocalPoseFromServer();
    if (!localPose) return;

    if (serverPlayer) {
      localPose.hp = serverPlayer.hp;
      localPose.maxHp = serverPlayer.maxHp;
      localPose.weapon = serverPlayer.weapon;
      localPose.dead = Boolean(serverPlayer.dead);
      localPose.kills = serverPlayer.kills || localPose.kills || 0;

      const error = Math.hypot((serverPlayer.x || 0) - localPose.x, (serverPlayer.y || 0) - localPose.y);
      if (localPose.dead || error > SNAP_DISTANCE) {
        localPose.x = serverPlayer.x;
        localPose.y = serverPlayer.y;
      }
    }

    updatePlayer(localPose, localInput, dt, false, false);

    if (!renderState) renderState = cloneState(lastState || createEmptyRenderState());
    renderState.players = renderState.players || {};
    renderState.players[playerId] = clone(localPose);
  }

  function createEmptyRenderState() {
    return { tick: 0, time: 0, wave: 1, world: { w: WORLD.w, h: WORLD.h }, players: {}, mobs: [], bullets: [], loot: [] };
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

    for (const player of Object.values(state.players)) {
      const input = normalizeInput(inputs[player.id]);
      const useClientPose = player.id !== playerId && input.px !== null && input.py !== null;
      updatePlayer(player, input, dt, true, useClientPose);
    }
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

  function updatePlayer(player, input, dt, canShoot, useClientPose = false) {
    if (player.dead) {
      player.respawn = Math.max(0, (Number(player.respawn) || 0) - dt);
      if (canShoot && player.respawn <= 0) {
        player.dead = false;
        player.hp = player.maxHp;
        player.x = WORLD.w / 2 + rand(-50, 50);
        player.y = WORLD.h / 2 + rand(-50, 50);
      }
      return;
    }

    const aimLen = Math.hypot(input.aimX, input.aimY);
    if (aimLen > 0.001) {
      player.aimX = input.aimX / aimLen;
      player.aimY = input.aimY / aimLen;
    }

    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;

    if (useClientPose) {
      player.x = input.px;
      player.y = input.py;
    } else if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const speed = 196;
      player.x = clamp(player.x + dx * speed * dt, WALL_PAD, WORLD.w - WALL_PAD - PLAYER_SIZE);
      player.y = clamp(player.y + dy * speed * dt, WALL_PAD, WORLD.h - WALL_PAD - PLAYER_SIZE);
    }

    player.fireCd = Math.max(0, (Number(player.fireCd) || 0) - dt);
    player.hitCd = Math.max(0, (Number(player.hitCd) || 0) - dt);
    if (canShoot && input.fire && player.fireCd <= 0) shootPlayerWeapon(player);

    if (!canShoot) return;
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

  function receiveState(state) {
    lastState = state;
    const serverMe = state && state.players ? state.players[playerId] : null;
    if (serverMe && !localPose) localPose = clone(serverMe);

    if (!gotFirstState) {
      gotFirstState = true;
      setStatus(`${playersInRoom.size}/${MAX_PLAYERS} players online.`);
      updateNetStatus();
    }
    if (!renderState) {
      renderState = cloneState(state);
      if (localPose && renderState.players) renderState.players[playerId] = clone(localPose);
      const me = (playerId && renderState.players[playerId]) || Object.values(renderState.players)[0];
      if (me) {
        camera = cameraFor(me, renderState);
        hasCamera = true;
      }
    }
  }

  function updateRenderState(dt) {
    if (!lastState) {
      renderState = null;
      return;
    }
    if (!renderState) renderState = cloneState(lastState);

    const a = Math.min(1, dt * 12);
    renderState.tick = lastState.tick;
    renderState.time = lastState.time;
    renderState.wave = lastState.wave;
    renderState.world = lastState.world || WORLD;
    renderState.players = smoothPlayers(renderState.players || {}, lastState.players || {}, a, dt);
    renderState.mobs = smoothArray(renderState.mobs || [], lastState.mobs || [], a, smoothMob);
    renderState.bullets = smoothArray(renderState.bullets || [], lastState.bullets || [], Math.min(1, dt * 20), smoothBullet);
    renderState.loot = smoothArray(renderState.loot || [], lastState.loot || [], a, smoothLoot);
  }

  function smoothPlayers(current, target, alpha, dt) {
    const out = {};
    for (const [id, next] of Object.entries(target)) {
      const prev = current[id];
      if (!prev) {
        out[id] = clone(next);
        continue;
      }
      if (role === "guest" && id === playerId) {
        out[id] = predictLocalPlayer(prev, next, dt);
        continue;
      }
      out[id] = smoothPlayer(prev, next, alpha);
    }
    return out;
  }

  function predictLocalPlayer(prev, serverPlayer, dt) {
    if (!localPose) localPose = clone(prev || serverPlayer);
    if (serverPlayer) {
      localPose.hp = serverPlayer.hp;
      localPose.maxHp = serverPlayer.maxHp;
      localPose.weapon = serverPlayer.weapon;
      localPose.dead = Boolean(serverPlayer.dead);
      localPose.kills = serverPlayer.kills || localPose.kills || 0;
      const error = Math.hypot((serverPlayer.x || 0) - localPose.x, (serverPlayer.y || 0) - localPose.y);
      if (localPose.dead || error > SNAP_DISTANCE) {
        localPose.x = serverPlayer.x;
        localPose.y = serverPlayer.y;
      }
    }
    return clone(localPose);
  }

  function smoothObjectMap(current, target, alpha, smoother) {
    const out = {};
    for (const [id, next] of Object.entries(target)) {
      const prev = current[id];
      out[id] = prev ? smoother(prev, next, alpha) : clone(next);
    }
    return out;
  }

  function smoothArray(current, target, alpha, smoother) {
    const prevById = new Map(current.map((item) => [item.id, item]));
    return target.map((next) => {
      const prev = prevById.get(next.id);
      return prev ? smoother(prev, next, alpha) : clone(next);
    });
  }

  function smoothPlayer(prev, next, a) {
    return {
      ...next,
      x: lerp(prev.x, next.x, a),
      y: lerp(prev.y, next.y, a),
      aimX: lerp(prev.aimX || 1, next.aimX || 1, a),
      aimY: lerp(prev.aimY || 0, next.aimY || 0, a)
    };
  }

  function smoothMob(prev, next, a) {
    return { ...next, x: lerp(prev.x, next.x, a), y: lerp(prev.y, next.y, a) };
  }

  function smoothBullet(prev, next, a) {
    return { ...next, x: lerp(prev.x, next.x, a), y: lerp(prev.y, next.y, a) };
  }

  function smoothLoot(prev, next, a) {
    return { ...next, x: lerp(prev.x, next.x, a), y: lerp(prev.y, next.y, a) };
  }

  function cloneState(state) {
    return {
      tick: state.tick || 0,
      time: state.time || 0,
      wave: state.wave || 1,
      world: state.world || { w: WORLD.w, h: WORLD.h },
      players: clone(state.players || {}),
      mobs: clone(state.mobs || []),
      bullets: clone(state.bullets || []),
      loot: clone(state.loot || [])
    };
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function packState(state) {
    const players = {};
    for (const [id, p] of Object.entries(state.players)) {
      players[id] = {
        id,
        x: r1(p.x),
        y: r1(p.y),
        hp: r1(p.hp),
        maxHp: p.maxHp,
        weapon: p.weapon,
        aimX: r2(p.aimX || 1),
        aimY: r2(p.aimY || 0),
        dead: Boolean(p.dead),
        kills: p.kills || 0
      };
    }

    return {
      tick: state.tick,
      time: r2(state.time),
      wave: state.wave,
      world: state.world,
      players,
      mobs: state.mobs.map((m) => ({
        id: m.id,
        type: m.type,
        x: r1(m.x),
        y: r1(m.y),
        hp: r1(m.hp),
        maxHp: m.maxHp,
        size: m.size
      })),
      bullets: state.bullets.map((b) => ({
        id: b.id,
        team: b.team,
        owner: b.owner,
        x: r1(b.x),
        y: r1(b.y),
        size: b.size
      })),
      loot: state.loot.map((item) => ({
        id: item.id,
        x: r1(item.x),
        y: r1(item.y),
        kind: item.kind,
        weapon: item.weapon,
        ttl: r1(item.ttl)
      }))
    };
  }

  function draw(dt) {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);

    const state = renderState || lastState;
    if (!state) {
      drawScreenText("WAITING", VIEW.w / 2 - 28, VIEW.h / 2);
      gameHud.textContent = "HP -- | WEAPON -- | MOBS --";
      return;
    }

    const me = (role === "guest" && localPose) ? localPose : (state.players[playerId] || Object.values(state.players)[0]);
    if (role === "guest" && localPose && state.players) state.players[playerId] = clone(localPose);
    updateCamera(me, state, dt || 0.016);

    drawGrid(camera);
    drawWorldBorder(camera, state);
    drawLoot(camera, state);
    drawBullets(camera, state);
    drawMobs(camera, state);
    drawPlayers(camera, state);
    drawCrosshair();

    const hp = me ? `${Math.max(0, Math.ceil(me.hp))}/${me.maxHp}` : "--";
    const weapon = me ? (WEAPONS[me.weapon] || WEAPONS.pistol).label : "--";
    gameHud.textContent = `P ${playersInRoom.size}/${MAX_PLAYERS} | HP ${hp} | ${weapon} | WAVE ${state.wave} | MOBS ${state.mobs.length}`;
  }

  function updateCamera(player, state, dt) {
    if (!player) return;
    const target = cameraFor(player, state);
    if (!hasCamera) {
      camera = target;
      hasCamera = true;
      return;
    }
    const a = Math.min(1, dt * 18);
    camera.x = lerp(camera.x, target.x, a);
    camera.y = lerp(camera.y, target.y, a);
  }

  function cameraFor(player, state = lastState) {
    const world = (state && state.world) || WORLD;
    if (!player) return { x: 0, y: 0 };
    return {
      x: clamp(player.x + PLAYER_SIZE / 2 - VIEW.w / 2, 0, world.w - VIEW.w),
      y: clamp(player.y + PLAYER_SIZE / 2 - VIEW.h / 2, 0, world.h - VIEW.h)
    };
  }

  function worldX(x, cam) {
    return Math.floor(x - cam.x);
  }

  function worldY(y, cam) {
    return Math.floor(y - cam.y);
  }

  function drawGrid(cam) {
    ctx.strokeStyle = "#151515";
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

  function drawWorldBorder(cam, state) {
    const world = (state && state.world) || WORLD;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(worldX(0, cam), worldY(0, cam), world.w, world.h);
  }

  function visible(x, y, pad, cam) {
    return x >= cam.x - pad && x <= cam.x + VIEW.w + pad && y >= cam.y - pad && y <= cam.y + VIEW.h + pad;
  }

  function drawPlayers(cam, state) {
    for (const player of Object.values(state.players)) {
      if (!visible(player.x, player.y, PLAYER_SIZE + 28, cam)) continue;
      const x = worldX(player.x, cam);
      const y = worldY(player.y, cam);
      const centerX = x + PLAYER_SIZE / 2;
      const centerY = y + PLAYER_SIZE / 2;

      if (!player.dead) {
        ctx.strokeStyle = player.id === playerId ? GREEN : "#fff";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + (player.aimX || 1) * 18, centerY + (player.aimY || 0) * 18);
        ctx.stroke();
      }

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

      drawSmallText(player.id, x - 1, y - 6, player.id === playerId ? GREEN : "#fff");
      drawBar(x, y + PLAYER_SIZE + 4, PLAYER_SIZE, 3, player.hp / player.maxHp);
    }
  }

  function drawMobs(cam, state) {
    for (const mob of state.mobs) {
      if (!visible(mob.x, mob.y, mob.size + 30, cam)) continue;
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

  function drawBullets(cam, state) {
    for (const b of state.bullets) {
      if (!visible(b.x, b.y, 20, cam)) continue;
      ctx.fillStyle = b.team === "player" ? "#fff" : "#888";
      const s = b.size || 2;
      ctx.fillRect(worldX(b.x - s / 2, cam), worldY(b.y - s / 2, cam), s, s);
    }
  }

  function drawLoot(cam, state) {
    for (const item of state.loot) {
      if (!visible(item.x, item.y, 24, cam)) continue;
      const x = worldX(item.x, cam);
      const y = worldY(item.y, cam);
      ctx.strokeStyle = GREEN;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.stroke();
      drawSmallText(item.kind === "heal" ? "+" : item.weapon[0].toUpperCase(), x - 3, y + 3, GREEN);
    }
  }

  function drawCrosshair() {
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mouse.x - 4, mouse.y);
    ctx.lineTo(mouse.x + 4, mouse.y);
    ctx.moveTo(mouse.x, mouse.y - 4);
    ctx.lineTo(mouse.x, mouse.y + 4);
    ctx.stroke();
  }

  function drawBar(x, y, w, h, value) {
    const v = clamp(value || 0, 0, 1);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, Math.max(0, Math.floor(w * v)), h);
  }

  function drawSmallText(text, x, y, color = "#fff") {
    ctx.fillStyle = color;
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
    renderState = null;
    lastFrame = 0;
    lastStateSent = 0;
    lastInputSent = 0;
    lastSentInput = "";
    playersInRoom = new Set();
    pressed.clear();
    mouse.down = false;
    hasCamera = false;
    gotFirstState = false;
    pingMs = null;
    lastPingSent = 0;
    lastPongAt = 0;
    camera = { x: 0, y: 0 };
    updateNetStatus();
    for (const key of Object.keys(inputs)) delete inputs[key];
    localInput = emptyInput();

    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * clamp(t, 0, 1);
  }

  function r1(value) {
    return Math.round(Number(value || 0) * 10) / 10;
  }

  function r2(value) {
    return Math.round(Number(value || 0) * 100) / 100;
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

  function updateMousePosition(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = clamp(((event.clientX - rect.left) / rect.width) * VIEW.w, 0, VIEW.w);
    mouse.y = clamp(((event.clientY - rect.top) / rect.height) * VIEW.h, 0, VIEW.h);
  }

  async function copyRoomId() {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
    } catch {
      const temp = document.createElement("textarea");
      temp.value = roomId;
      temp.style.position = "fixed";
      temp.style.left = "-999px";
      document.body.appendChild(temp);
      temp.select();
      document.execCommand("copy");
      temp.remove();
    }
  }

  const gameKeys = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Enter", "KeyW", "KeyA", "KeyS", "KeyD"]);

  function inGame() {
    return connected && !game.classList.contains("hidden");
  }

  function resetControls() {
    pressed.clear();
    mouse.down = false;
    localInput = emptyInput();
    if (role !== "host") sendWs({ type: "input", input: withLocalPose(localInput) });
  }

  window.addEventListener("keydown", (event) => {
    if (!inGame() || !gameKeys.has(event.code)) return;
    event.preventDefault();
    pressed.add(event.code);
  });

  window.addEventListener("keyup", (event) => {
    pressed.delete(event.code);
  });

  window.addEventListener("blur", resetControls);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetControls();
  });

  canvas.addEventListener("mousemove", updateMousePosition);
  canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    updateMousePosition(event);
    mouse.down = true;
    event.preventDefault();
  });
  window.addEventListener("mouseup", () => {
    mouse.down = false;
  });
  window.addEventListener("pointercancel", resetControls);
  canvas.addEventListener("mouseleave", () => {
    mouse.down = false;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  window.addEventListener("beforeunload", () => stopAll(true));

  createBtn.addEventListener("click", createGame);
  joinBtn.addEventListener("click", joinGame);
  function flashRoomTitle() {
    roomTitle.classList.add("copying");
    window.setTimeout(() => roomTitle.classList.remove("copying"), 120);
  }

  roomTitle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    flashRoomTitle();
  });
  roomTitle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    copyRoomId();
  });
  roomTitle.setAttribute("tabindex", "0");
  roomTitle.addEventListener("keydown", (event) => {
    if (event.code === "Enter" || event.code === "Space") {
      event.preventDefault();
      flashRoomTitle();
      copyRoomId();
    }
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

  updateNetStatus();
  draw(0.016);
})();
