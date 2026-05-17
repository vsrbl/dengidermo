import { CONFIG } from "./config.js";
import { SignalingClient } from "./signaling.js";
import { PeerConnection } from "./peer.js";
import { startGame, applyNetworkMessage } from "./game.js";

const el = {
  playerName: document.querySelector("#playerName"),
  roomCode: document.querySelector("#roomCode"),
  createRoom: document.querySelector("#createRoom"),
  joinRoom: document.querySelector("#joinRoom"),
  sendPing: document.querySelector("#sendPing"),
  sendInput: document.querySelector("#sendInput"),
  serverStatus: document.querySelector("#serverStatus"),
  roomStatus: document.querySelector("#roomStatus"),
  playerStatus: document.querySelector("#playerStatus"),
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
let started = false;

const signaling = new SignalingClient(CONFIG.signalingUrl);

function log(message) {
  const time = new Date().toLocaleTimeString();
  el.log.textContent += `[${time}] ${message}\n`;
  el.log.scrollTop = el.log.scrollHeight;
}

function updateStatus() {
  el.roomStatus.textContent = roomId || "—";
  el.playerStatus.textContent = playerId || "—";
  el.roleStatus.textContent = roomId ? (isHost ? "HOST" : "CLIENT") : "—";
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
      log("P2P DataChannel открыт");
    },
    onClose: () => {
      el.p2pStatus.textContent = "closed";
      log("P2P DataChannel закрыт");
    },
    onData: data => {
      log(`P2P <= ${JSON.stringify(data)}`);
      applyNetworkMessage(data, log);
    }
  });

  return peer;
}

function sendGameMessage(data) {
  return peer?.send(data) || false;
}

el.createRoom.addEventListener("click", () => {
  signaling.send({
    type: "create-room",
    playerName: el.playerName.value.trim() || "Host"
  });
});

el.joinRoom.addEventListener("click", () => {
  signaling.send({
    type: "join-room",
    roomId: el.roomCode.value.trim().toUpperCase(),
    playerName: el.playerName.value.trim() || "Player"
  });
});

el.sendPing.addEventListener("click", () => {
  const ok = sendGameMessage({ type: "ping", from: playerId, time: Date.now() });
  log(ok ? "P2P => ping" : "P2P еще не открыт");
});

el.sendInput.addEventListener("click", () => {
  const ok = sendGameMessage({
    type: "player-input",
    input: { up: false, down: false, left: false, right: true, attack: false },
    tick: Date.now()
  });
  log(ok ? "P2P => test input" : "P2P еще не открыт");
});

signaling.onStatus(status => {
  el.serverStatus.textContent = status;
  log(`Signaling: ${status}`);
});

signaling.onMessage(async message => {
  log(`Signal <= ${JSON.stringify(message)}`);

  if (message.type === "room-created") {
    roomId = message.roomId;
    playerId = message.playerId;
    isHost = true;
    el.roomCode.value = roomId;
    updateStatus();
    return;
  }

  if (message.type === "room-joined") {
    roomId = message.roomId;
    playerId = message.playerId;
    targetPlayerId = message.hostPlayerId;
    isHost = false;
    updateStatus();

    const pc = ensurePeer();
    await pc.createOffer();
    return;
  }

  if (message.type === "player-joined") {
    targetPlayerId = message.playerId;
    ensurePeer();
    updateStatus();
    return;
  }

  if (message.type === "signal") {
    targetPlayerId = message.fromPlayerId;
    const pc = ensurePeer();
    await pc.handleSignal(message.data);
    return;
  }

  if (message.type === "player-left") {
    log(`Игрок вышел: ${message.playerId}`);
    targetPlayerId = null;
    peer?.close();
    peer = null;
    el.p2pStatus.textContent = "closed";
    return;
  }

  if (message.type === "error") {
    log(`ОШИБКА: ${message.message}`);
  }
});

signaling.connect();
updateStatus();

if (!started) {
  started = true;
  startGame(el.canvas, sendGameMessage, log);
}
