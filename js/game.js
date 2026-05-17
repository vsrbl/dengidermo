const local = { x: 180, y: 270, hp: 100 };
const remote = { x: 760, y: 270, hp: 100 };
let bossHp = 300;
let lastInput = { x: 0, y: 0 };

const keys = new Set();

window.addEventListener("keydown", event => keys.add(event.key.toLowerCase()));
window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));

export function startGame(canvas, sendGameMessage, log) {
  const ctx = canvas.getContext("2d");
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    update(dt, sendGameMessage);
    draw(ctx, canvas);
    requestAnimationFrame(frame);
  }

  log("game loop started");
  requestAnimationFrame(frame);
}

export function applyNetworkMessage(message, log) {
  if (message.type === "player-state") {
    remote.x = message.x;
    remote.y = message.y;
    remote.hp = message.hp;
    return;
  }

  if (message.type === "boss-hit") {
    bossHp = Math.max(0, bossHp - message.damage);
    log(`boss took ${message.damage} damage, hp=${bossHp}`);
    return;
  }
}

function update(dt, sendGameMessage) {
  const speed = 220;
  let dx = 0;
  let dy = 0;

  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;

  const len = Math.hypot(dx, dy) || 1;
  local.x = clamp(local.x + (dx / len) * speed * dt, 28, 932);
  local.y = clamp(local.y + (dy / len) * speed * dt, 28, 512);

  if (dx !== lastInput.x || dy !== lastInput.y) {
    lastInput = { x: dx, y: dy };
  }

  sendGameMessage({
    type: "player-state",
    x: Math.round(local.x),
    y: Math.round(local.y),
    hp: local.hp,
    time: Date.now()
  });

  if (keys.has(" ")) {
    sendGameMessage({ type: "boss-hit", damage: 1, time: Date.now() });
  }
}

function draw(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  for (let x = 0; x < canvas.width; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  drawBoss(ctx);
  drawPlayer(ctx, local.x, local.y, "#14b8a6", "YOU");
  drawPlayer(ctx, remote.x, remote.y, "#8b5cf6", "PEER");

  ctx.fillStyle = "#f8fafc";
  ctx.font = "18px system-ui";
  ctx.fillText("WASD/стрелки — движение, SPACE — тестовый удар по боссу", 24, 34);
}

function drawPlayer(ctx, x, y, color, label) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.font = "bold 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - 32);
  ctx.textAlign = "left";
}

function drawBoss(ctx) {
  const x = 480;
  const y = 270;

  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(x, y, 62, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.fillRect(x - 100, y - 94, 200, 14);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(x - 100, y - 94, 200 * (bossHp / 300), 14);

  ctx.fillStyle = "white";
  ctx.font = "bold 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("BOSS PROTOTYPE", x, y + 6);
  ctx.textAlign = "left";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
