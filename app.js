(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const menu = $("menu");
  const game = $("game");
  const roomInput = $("roomInput");
  const serverInput = $("serverInput");
  const createBtn = $("createBtn");
  const joinBtn = $("joinBtn");
  const leaveBtn = $("leaveBtn");
  const menuStatus = $("menuStatus");
  const netStatus = $("netStatus");
  const roomTitle = $("roomTitle");
  const bossHud = $("bossHud");
  const canvas = $("screen");
  const ctx = canvas.getContext("2d");

  const DEFAULT_SIGNALING_URL = window.NN_SIGNALING_URL || "https://dengidermo-1.onrender.com";
  const RTC_CONFIG = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  };

  const ROOM_RE = /^[A-Z0-9-]{3,12}$/;
  const WORLD = { w: canvas.width, h: canvas.height };
  const PLAYER_SIZE = 8;
  const BOSS_SIZE = 20;
  const SPEED = 1.45;

  let ws = null;
  let peer = null;
  let channel = null;
  let role = null;
  let roomId = null;
  let gameLoop = 0;
  let hostStateTimer = 0;
  let relayFallbackTimer = 0;
  let peerReady = false;
  let networkMode = "none";
  let pendingCandidates = [];
  let lastState = null;

  const keys = {
    host: emptyInput(),
    guest: emptyInput()
  };

  function emptyInput() {
    return { left: false, right: false, up: false, down: false, hit: false };
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
    return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12);
  }

  function getServerHttpUrl() {
    const saved = localStorage.getItem("nn-signaling-url");
    const raw = (serverInput.value || saved || DEFAULT_SIGNALING_URL).trim();
    if (!raw) throw new Error("Missing Render server URL.");

    const withProtocol = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) {
      throw new Error("Server URL must start with https:// or wss://.");
    }
    url.pathname = url.pathname.replace(/\/$/, "");
    localStorage.setItem("nn-signaling-url", url.toString().replace(/\/$/, ""));
    return url.toString().replace(/\/$/, "");
  }

  function toWsUrl(urlString) {
    const url = new URL(urlString);
    url.protocol = url.protocol === "https:" ? "wss:" : url.protocol === "http:" ? "ws:" : url.protocol;
    return url.toString().replace(/\/$/, "");
  }

  function showGame() {
    roomTitle.textContent = roomId;
    menu.classList.add("hidden");
    game.classList.remove("hidden");
  }

  function showMenu(text = "Offline.") {
    game.classList.add("hidden");
    menu.classList.remove("hidden");
    setStatus(text);
  }

  function sendWs(message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(message));
    return true;
  }

  function sendToPeer(payload) {
    const message = JSON.stringify(payload);
    if (channel && channel.readyState === "open") {
      channel.send(message);
      return true;
    }
    if (ws && ws.readyState === WebSocket.OPEN && roomId && peerReady) {
      sendWs({ type: "relay", roomId, data: payload });
      return true;
    }
    return false;
  }

  function connectSignaling() {
    return new Promise((resolve, reject) => {
      const serverUrl = getServerHttpUrl();
      serverInput.value = serverUrl;
      const socket = new WebSocket(toWsUrl(serverUrl));
      let settled = false;

      socket.onopen = () => {
        settled = true;
        ws = socket;
        bindSignalingEvents(socket);
        resolve(socket);
      };

      socket.onerror = () => {
        if (!settled) reject(new Error("Cannot reach Render signaling server."));
      };

      socket.onclose = () => {
        if (!settled) reject(new Error("Signaling server closed the connection."));
      };
    });
  }

  function bindSignalingEvents(socket) {
    socket.onmessage = async (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === "created") {
        setStatus("Room created. Waiting for player...");
        showGame();
        updateUrlRoom(roomId);
        return;
      }

      if (msg.type === "joined") {
        setStatus("Joined. Connecting to host...");
        showGame();
        updateUrlRoom(roomId);
        armRelayFallback();
        return;
      }

      if (msg.type === "peer-joined") {
        setStatus("Player joined. Building P2P link...");
        showGame();
        armRelayFallback();
        await startHostRtc();
        return;
      }

      if (msg.type === "signal") {
        await handleSignal(msg.data);
        return;
      }

      if (msg.type === "relay") {
        if (networkMode !== "p2p") markPeerReady("relay");
        handlePeerPayload(msg.data);
        return;
      }

      if (msg.type === "peer-left" || msg.type === "room-closed") {
        setStatus("Peer left. Room closed.");
        stopAll(false);
        showMenu("Peer left. Create or join again.");
        return;
      }

      if (msg.type === "error") {
        stopAll(false);
        showMenu(msg.message || "Connection error.");
      }
    };

    socket.onclose = () => {
      if (roomId) {
        stopAll(false);
        showMenu("Disconnected from Render server.");
      }
    };
  }

  async function createGame() {
    try {
      stopAll(false);
      role = "host";
      roomId = randomRoomId();
      roomInput.value = roomId;
      setStatus("Connecting to Render...");
      await connectSignaling();
      initHostState();
      sendWs({ type: "create", roomId });
    } catch (error) {
      stopAll(false);
      showMenu(error.message);
    }
  }

  async function joinGame() {
    try {
      stopAll(false);
      role = "guest";
      roomId = normalizeRoomId(roomInput.value);
      roomInput.value = roomId;
      if (!ROOM_RE.test(roomId)) throw new Error("Enter a valid room ID first.");
      setStatus("Connecting to Render...");
      await connectSignaling();
      sendWs({ type: "join", roomId });
    } catch (error) {
      stopAll(false);
      showMenu(error.message);
    }
  }

  function createPeer() {
    if (peer) return peer;

    peer = new RTCPeerConnection(RTC_CONFIG);
    pendingCandidates = [];

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        sendWs({ type: "signal", roomId, data: { candidate: event.candidate } });
      }
    };

    peer.onconnectionstatechange = () => {
      if (["failed", "disconnected", "closed"].includes(peer.connectionState) && networkMode === "p2p") {
        networkMode = "none";
        armRelayFallback(200);
      }
    };

    peer.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };

    return peer;
  }

  async function startHostRtc() {
    createPeer();
    setupDataChannel(peer.createDataChannel("game", { ordered: false, maxRetransmits: 0 }));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    sendWs({ type: "signal", roomId, data: { description: peer.localDescription } });
  }

  function setupDataChannel(dataChannel) {
    channel = dataChannel;
    channel.onopen = () => markPeerReady("p2p");
    channel.onmessage = (event) => {
      try {
        handlePeerPayload(JSON.parse(event.data));
      } catch {
        // Ignore broken packets.
      }
    };
    channel.onclose = () => {
      if (networkMode === "p2p") armRelayFallback(200);
    };
  }

  async function handleSignal(data) {
    createPeer();

    if (data.description) {
      await peer.setRemoteDescription(data.description);
      await flushCandidates();

      if (data.description.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        sendWs({ type: "signal", roomId, data: { description: peer.localDescription } });
      }
      return;
    }

    if (data.candidate) {
      if (!peer.remoteDescription) {
        pendingCandidates.push(data.candidate);
      } else {
        await peer.addIceCandidate(data.candidate);
      }
    }
  }

  async function flushCandidates() {
    const candidates = pendingCandidates.splice(0);
    for (const candidate of candidates) {
      await peer.addIceCandidate(candidate);
    }
  }

  function armRelayFallback(delay = 7500) {
    clearTimeout(relayFallbackTimer);
    relayFallbackTimer = window.setTimeout(() => {
      if (!peerReady || networkMode !== "p2p") {
        markPeerReady("relay");
      }
    }, delay);
  }

  function markPeerReady(mode) {
    if (mode === "p2p") clearTimeout(relayFallbackTimer);
    peerReady = true;
    networkMode = mode;
    setStatus(mode === "p2p" ? "P2P connected." : "Relay fallback connected.");
    ensureGameLoop();

    if (role === "host") {
      ensureHostStateLoop();
    }
  }

  function updateUrlRoom(id) {
    const url = new URL(window.location.href);
    url.searchParams.set("room", id);
    window.history.replaceState({}, "", url.toString());
  }

  function initHostState() {
    lastState = {
      tick: 0,
      players: {
        host: { x: 42, y: 96, hp: 5, flash: 0 },
        guest: { x: 270, y: 96, hp: 5, flash: 0 }
      },
      boss: { x: 150, y: 88, hp: 20, maxHp: 20, flash: 0 }
    };
  }

  function ensureHostStateLoop() {
    if (hostStateTimer) return;
    hostStateTimer = window.setInterval(() => {
      if (role !== "host" || !lastState) return;
      updateHostState();
      sendToPeer({ t: "state", state: lastState });
    }, 1000 / 30);
  }

  function updateHostState() {
    lastState.tick += 1;
    movePlayer(lastState.players.host, keys.host);
    movePlayer(lastState.players.guest, keys.guest);

    if (lastState.boss.flash > 0) lastState.boss.flash -= 1;
    for (const player of Object.values(lastState.players)) {
      if (player.flash > 0) player.flash -= 1;
    }

    if (keys.host.hit) hitBoss(lastState.players.host);
    if (keys.guest.hit) hitBoss(lastState.players.guest);

    if (lastState.boss.hp <= 0) {
      lastState.boss.hp = lastState.boss.maxHp;
      lastState.boss.x = 64 + Math.floor(Math.random() * 168);
      lastState.boss.y = 42 + Math.floor(Math.random() * 96);
      lastState.boss.flash = 12;
    }
  }

  function movePlayer(player, input) {
    let dx = 0;
    let dy = 0;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;

    if (dx !== 0 && dy !== 0) {
      dx *= 0.707;
      dy *= 0.707;
    }

    player.x = clamp(player.x + dx * SPEED, 4, WORLD.w - PLAYER_SIZE - 4);
    player.y = clamp(player.y + dy * SPEED, 4, WORLD.h - PLAYER_SIZE - 4);
  }

  function hitBoss(player) {
    if (!lastState || lastState.tick % 9 !== 0) return;
    const boss = lastState.boss;
    const nearX = Math.abs(player.x + PLAYER_SIZE / 2 - (boss.x + BOSS_SIZE / 2)) < 22;
    const nearY = Math.abs(player.y + PLAYER_SIZE / 2 - (boss.y + BOSS_SIZE / 2)) < 22;
    if (nearX && nearY) {
      boss.hp -= 1;
      boss.flash = 4;
    }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function handlePeerPayload(packet) {
    if (!packet || typeof packet !== "object") return;

    if (role === "host" && packet.t === "input") {
      keys.guest = normalizeInput(packet.input);
      return;
    }

    if (role === "guest" && packet.t === "state") {
      lastState = packet.state;
    }
  }

  function normalizeInput(input) {
    return {
      left: Boolean(input && input.left),
      right: Boolean(input && input.right),
      up: Boolean(input && input.up),
      down: Boolean(input && input.down),
      hit: Boolean(input && input.hit)
    };
  }

  function ensureGameLoop() {
    if (gameLoop) return;
    const loop = () => {
      if (!roomId) return;
      updateLocalInput();
      if (role === "guest" && peerReady) {
        sendToPeer({ t: "input", input: keys.guest });
      }
      draw();
      gameLoop = requestAnimationFrame(loop);
    };
    gameLoop = requestAnimationFrame(loop);
  }

  const pressed = new Set();

  function updateLocalInput() {
    const target = role === "host" ? keys.host : keys.guest;
    target.left = pressed.has("arrowleft") || pressed.has("a");
    target.right = pressed.has("arrowright") || pressed.has("d");
    target.up = pressed.has("arrowup") || pressed.has("w");
    target.down = pressed.has("arrowdown") || pressed.has("s");
    target.hit = pressed.has(" ");
  }

  function draw() {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);

    drawGrid();

    if (!lastState) {
      drawText("WAITING FOR PEER", 88, 96);
      bossHud.textContent = "Boss HP: --";
      return;
    }

    const boss = lastState.boss;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.floor(boss.x), Math.floor(boss.y), BOSS_SIZE, BOSS_SIZE);
    if (boss.flash > 0) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(Math.floor(boss.x) + 4, Math.floor(boss.y) + 4, BOSS_SIZE - 8, BOSS_SIZE - 8);
    }

    drawPlayer(lastState.players.host, true);
    drawPlayer(lastState.players.guest, false);
    bossHud.textContent = `Boss HP: ${boss.hp}/${boss.maxHp}`;
  }

  function drawGrid() {
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD.w; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.h);
      ctx.stroke();
    }
    for (let y = 0; y < WORLD.h; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.w, y);
      ctx.stroke();
    }
  }

  function drawPlayer(player, filled) {
    const x = Math.floor(player.x);
    const y = Math.floor(player.y);
    if (filled) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(x, y, PLAYER_SIZE, PLAYER_SIZE);
      ctx.fillStyle = "#000";
      ctx.fillRect(x + 2, y + 2, 2, 2);
    } else {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, PLAYER_SIZE, PLAYER_SIZE);
      ctx.fillStyle = "#fff";
      ctx.fillRect(x + 3, y + 3, 2, 2);
    }
  }

  function drawText(text, x, y) {
    ctx.fillStyle = "#fff";
    ctx.font = "10px monospace";
    ctx.fillText(text, x, y);
  }

  function stopAll(sendLeave = true) {
    clearTimeout(relayFallbackTimer);
    clearInterval(hostStateTimer);
    hostStateTimer = 0;

    if (gameLoop) {
      cancelAnimationFrame(gameLoop);
      gameLoop = 0;
    }

    if (sendLeave && ws && ws.readyState === WebSocket.OPEN && roomId) {
      sendWs({ type: "leave", roomId });
    }

    if (channel) {
      try { channel.close(); } catch {}
      channel = null;
    }
    if (peer) {
      try { peer.close(); } catch {}
      peer = null;
    }
    if (ws) {
      try { ws.close(); } catch {}
      ws = null;
    }

    role = null;
    roomId = null;
    peerReady = false;
    networkMode = "none";
    pendingCandidates = [];
    lastState = null;
    keys.host = emptyInput();
    keys.guest = emptyInput();
    pressed.clear();

    const url = new URL(window.location.href);
    url.searchParams.delete("room");
    window.history.replaceState({}, "", url.toString());
  }

  window.addEventListener("keydown", (event) => {
    const k = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " ", "w", "a", "s", "d"].includes(k)) {
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
    const pos = roomInput.selectionStart;
    roomInput.value = normalizeRoomId(roomInput.value);
    roomInput.selectionStart = pos;
    roomInput.selectionEnd = pos;
  });

  serverInput.value = localStorage.getItem("nn-signaling-url") || DEFAULT_SIGNALING_URL;

  const startRoom = new URLSearchParams(window.location.search).get("room");
  if (startRoom) {
    roomInput.value = normalizeRoomId(startRoom);
    menuStatus.textContent = "Room link loaded. Press Join game.";
  }

  draw();
})();
