const local = { x: 180, y: 270, hp: 100 };
const remote = { x: 760, y: 270, hp: 100, online: false };
let bossHp = 300;
let lastSend = 0;

const keys = new Set();

window.addEventListener("keydown", event => keys.add(event.key.toLowerCase()));
window.addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));

export function startGame(canvas, sendGameMessage) {
  const ctx = canvas.getContext("2d");
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt, now, sendGameMessage);
    draw(ctx, canvas);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

export function applyNetworkMessage(message) {
  if (message.type === "player-state") {
    remote.x = message.x;
    remote.y = message.y;
    remote.hp = message.hp;
    remote.online = true;
    return;
  }

  if (message.type === "boss-hit") {
    bossHp = Math.max(0, bossHp - message.damage);
  }
}

function update(dt, now, sendGameMessage) {
  const speed = 220;
  let dx = 0;
  let dy = 0;

  if (keys.has("w") || keys.has("arrowup")) dy -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dy += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;

  const len = Math.hypot(dx, dy) || 1;
  local.x = clamp(local.x + (dx / len) * speed * dt, 20, 940);
  local.y = clamp(local.y + (dy / len) * speed * dt, 20, 520);

  if (keys.has(" ")) {
    bossHp = Math.max(0, bossHp - 1);
    sendGameMessage({ type: "boss-hit", damage: 1, time: Date.now() });
  }

  if (now - lastSend > 66) {
    lastSend = now;
    sendGameMessage({
      type: "player-state",
      x: Math.round(local.x),
      y: Math.round(local.y),
      hp: local.hp,
      time: Date.now()
    });
  }
}

function draw(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#dddddd";
  for (let x = 0; x <= canvas.width; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  drawBoss(ctx);
  drawPlayer(ctx, local.x, local.y, "YOU");
  if (remote.online) drawPlayer(ctx, remote.x, remote.y, "PEER");

  ctx.fillStyle = "#000000";
  ctx.font = "16px Arial";
  ctx.fillText("WASD / arrows: move | Space: hit boss", 20, 28);
}

function drawPlayer(ctx, x, y, label) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#000000";
  ctx.font = "bold 12px Arial";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - 28);
  ctx.textAlign = "left";
}

function drawBoss(ctx) {
  const x = 480;
  const y = 270;

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.rect(x - 48, y - 48, 96, 96);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 100, y - 78, 200, 12);
  ctx.fillStyle = "#000000";
  ctx.fillRect(x - 100, y - 78, 200 * (bossHp / 300), 12);

  ctx.fillStyle = "#000000";
  ctx.font = "bold 14px Arial";
  ctx.textAlign = "center";
  ctx.fillText("BOSS", x, y + 5);
  ctx.textAlign = "left";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
