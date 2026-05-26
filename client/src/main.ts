import './style.css';
import { ClientGame, type InputState } from './game';
import { NetClient } from './net';

const CELL_W = 14;
const CELL_H = 20;
const FONT = '18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

const canvas = mustGetCanvas('game');
const hud = mustGetElement('hud');
const context = mustGet2d(canvas);
const net = new NetClient();
const game = new ClientGame();
const input: InputState = { up: false, down: false, left: false, right: false };

let infoLine = 'connecting';
let lastFrameTime = performance.now();
let lastHeartbeatTime = 0;

net.onMessage((message) => {
  if (message.t === 'welcome') {
    game.applyWelcome(message);
    resizeCanvas();
    return;
  }

  if (message.t === 'snapshot') {
    game.applySnapshot(message);
    return;
  }

  if (message.t === 'info') {
    infoLine = message.text;
  }
});

net.onStatus((status) => {
  infoLine = status;
});

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;

  if (event.code === 'KeyR') {
    net.reconnectNow();
    return;
  }

  if (setKey(event.code, true)) {
    event.preventDefault();
    sendChangedInput();
  }
});

window.addEventListener('keyup', (event) => {
  if (setKey(event.code, false)) {
    event.preventDefault();
    sendChangedInput();
  }
});

window.addEventListener('resize', resizeCanvas);

net.connect();
requestAnimationFrame(frame);

function frame(now: number): void {
  const dtSeconds = Math.min(0.05, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  if (now - lastHeartbeatTime > 50) {
    lastHeartbeatTime = now;
    net.sendInput(game.buildInputHeartbeat(input));
  }

  game.predictLocal(input, dtSeconds);
  game.interpolate(dtSeconds);
  draw();
  updateHud();

  requestAnimationFrame(frame);
}

function draw(): void {
  const dpr = window.devicePixelRatio || 1;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  context.font = FONT;
  context.textBaseline = 'top';

  drawMap();
  drawPlayers();
}

function drawMap(): void {
  context.fillStyle = '#071009';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < game.map.length; y += 1) {
    const row = game.map[y];
    if (row === undefined) continue;

    for (let x = 0; x < row.length; x += 1) {
      const glyph = row[x];
      context.fillStyle = glyph === '#' ? '#6eff8e' : '#14301b';
      context.fillText(glyph ?? ' ', x * CELL_W, y * CELL_H);
    }
  }
}

function drawPlayers(): void {
  for (const player of game.players.values()) {
    const isLocal = player.id === game.localId;
    context.fillStyle = isLocal ? '#ffffff' : '#ffc46e';
    context.fillText(isLocal ? '@' : '&', player.x * CELL_W, player.y * CELL_H);

    context.fillStyle = isLocal ? '#bfffd0' : '#ffd99e';
    context.fillText(player.name, player.x * CELL_W - CELL_W, player.y * CELL_H - CELL_H * 0.72);
  }
}

function updateHud(): void {
  const ping = net.pingMs === null ? '—' : `${Math.round(net.pingMs)} ms`;
  const players = `${game.players.size}/4`;
  const correction = game.lastCorrection.toFixed(3);

  hud.textContent = [
    `status: ${net.status}`,
    `players: ${players}`,
    `ping: ${ping}`,
    `tick: ${game.serverTick}`,
    `correction: ${correction}`,
    `info: ${infoLine}`,
  ].join('\n');
}

function sendChangedInput(): void {
  const message = game.buildInput(input);
  if (message !== null) {
    net.sendInput(message);
  }
}

function setKey(code: string, pressed: boolean): boolean {
  switch (code) {
    case 'KeyW':
    case 'ArrowUp':
      input.up = pressed;
      return true;
    case 'KeyS':
    case 'ArrowDown':
      input.down = pressed;
      return true;
    case 'KeyA':
    case 'ArrowLeft':
      input.left = pressed;
      return true;
    case 'KeyD':
    case 'ArrowRight':
      input.right = pressed;
      return true;
    default:
      return false;
  }
}

function resizeCanvas(): void {
  const width = Math.max(1, maxRowLength(game.map) * CELL_W);
  const height = Math.max(1, game.map.length * CELL_H);
  const dpr = window.devicePixelRatio || 1;

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
}

function maxRowLength(rows: string[]): number {
  return rows.reduce((max, row) => Math.max(max, row.length), 48);
}

function mustGetCanvas(id: string): HTMLCanvasElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(`missing canvas #${id}`);
  }
  return element;
}

function mustGetElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`missing element #${id}`);
  }
  return element;
}

function mustGet2d(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const context2d = target.getContext('2d');
  if (context2d === null) {
    throw new Error('2d canvas is unavailable');
  }
  return context2d;
}
