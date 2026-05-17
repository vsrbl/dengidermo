import { CONFIG } from "./config.js";
import { SignalingClient } from "./signaling.js";
import { PeerConnection } from "./peer.js";
import { startGame, applyNetworkMessage } from "./game.js";

const el = {
  createGame: document.querySelector("#createGame"),
  joinGame: document.querySelector("#joinGame"),
  roomCode: document.querySelector("#roomCode"),
  copyRoom: document.querySelector("#copyRoom"),
  ping: document.querySelector("#ping"),
  serverStatus: document.querySelector("#serverStatus"),
  roomStatus: document.querySelector("#roomStatus"),
  roleStatus: document.querySelector("#roleStatus"),
  p2pStatus: document.querySelector("#p2pStatus"),
  log: document.querySelector("#log"),
  canvas: document.querySelector("#game")
};

let roomId = null;
let playerId = null;
let targetPlayerId = null;
let isHost = false;
let peer = null;

const signaling = new SignalingClient(CONFIG.signalingUrl);

function makeRoomId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

function cleanRoomId(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function log(text) {
  const time = new Date().toLocaleTimeString();
  el.log.textContent += `[${time}] ${text}
`;
  el.log.scrollTop = el.log.scrollHeight;
}

function updateStatus() {
  el.roomStatus.textContent = roomId || "—";
  el.roleStatus.textContent = roomId ? (isHost ? "host" : "client") : "—";
}

function ensurePeer() {
  if (!roomId || !targetPlayerId) return null;
  if (peer) return peer;

  peer = new PeerConnection({
    sendSignal: data => {
      signaling.send({ type: "signal", roomId, targetPlayerId, data });
    },
    onOpen: () => {
      el.p2pStatus.textContent = "open";
      log("P2P opened");
    },
    onClose: () => {
      el.p2pStatus.textContent = "closed";
      log("P2P closed");
    },
    onState: state => {
      if (state === "connected" || state === "completed") el.p2pStatus.textContent = "open";
      if (state === "failed" || state === "disconnected") el.p2pStatus.textContent = state;
    },
    onData: data => {
      if (data.type === "ping") log("Peer ping received");
      if (data.type === "hello") log("Peer hello received");
      applyNetworkMessage(data);
    }
  });

  return peer;
}

function sendGameMessage(data) {
  return peer?.send(data) || false;
}

el.createGame.addEventListener("click", () => {
  const newRoomId = makeRoomId();
  el.roomCode.value = newRoomId;
  signaling.send({ type: "create-room", roomId: newRoomId, playerName: "Host" });
  log(`Creating game ${newRoomId}`);
});

el.joinGame.addEventListener("click", () => {
  const code = cleanRoomId(el.roomCode.value);
  if (!code) {
    log("Enter a room ID first");
    return;
  }
  el.roomCode.value = code;
  signaling.send({ type: "join-room", roomId: code, playerName: "Player" });
  log(`Joining game ${code}`);
});

el.copyRoom.addEventListener("click", async () => {
  if (!roomId) return;
  await navigator.clipboard.writeText(roomId);
  log("Room ID copied");
});

el.ping.addEventListener("click", () => {
  const ok = sendGameMessage({ type: "ping", time: Date.now() });
  log(ok ? "Ping sent" : "P2P is not open yet");
});

signaling.onStatus(status => {
  el.serverStatus.textContent = status;
  const online = status === "online";
  el.createGame.disabled = !online;
  el.joinGame.disabled = !online;
});

signaling.onMessage(async message => {
  if (message.type === "room-created") {
    roomId = message.roomId;
    playerId = message.playerId;
    isHost = true;
    el.roomCode.value = roomId;
    updateStatus();
    log(`Game created: ${roomId}`);
    return;
  }

  if (message.type === "room-joined") {
    roomId = message.roomId;
    playerId = message.playerId;
    targetPlayerId = message.hostPlayerId;
    isHost = false;
    updateStatus();
    log(`Joined game: ${roomId}`);

    ensurePeer();
    await peer.createOffer();
    return;
  }

  if (message.type === "player-joined") {
    targetPlayerId = message.playerId;
    ensurePeer();
    log("Peer joined");
    return;
  }

  if (message.type === "signal") {
    targetPlayerId = message.fromPlayerId;
    ensurePeer();
    await peer.handleSignal(message.data);
    return;
  }

  if (message.type === "player-left") {
    log("Peer left");
    el.p2pStatus.textContent = "closed";
    peer?.close();
    peer = null;
    targetPlayerId = null;
    return;
  }

  if (message.type === "error") {
    log(`Error: ${message.message}`);
  }
});

el.createGame.disabled = true;
el.joinGame.disabled = true;
startGame(el.canvas, sendGameMessage);
signaling.connect();
