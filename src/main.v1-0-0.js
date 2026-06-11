// nncckkrr boot: menu, connection, game loop
import { Net, VERSION } from './net.v1-0-0.js';
import { Input } from './input.v1-0-0.js';
import { GameState, P } from './state.v1-0-0.js';
import { Effects } from './effects.v1-0-0.js';
import { Renderer } from './render.v1-0-0.js';
import { Hud } from './hud.v1-0-0.js';

const $ = id => document.getElementById(id);
const cfg = window.NNCCKKRR_CONFIG || {};
const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
const WS_URL = isLocal ? `ws://${location.hostname}:10777/ws` : (cfg.BACKEND_WS_URL || 'wss://dengidermo-1.onrender.com/ws');

const canvas = $('game');
const net = new Net();
const input = new Input(canvas);
const state = new GameState();
const effects = new Effects();
const renderer = new Renderer(canvas);
const hud = new Hud(net);

let inGame = false;
let lastSend = 0;
let lastFrame = performance.now();

$('hud-version').textContent = VERSION;

// ---------------------------------------------------------------- menu
const status = $('menu-status');
function setStatus(text, cls = '') { status.textContent = text; status.className = cls; }

$('name-input').value = localStorage.getItem('nnc_name') || '';

async function connect() {
  setStatus('подключение к серверу…');
  try {
    const name = ($('name-input').value || 'PLAYER').trim().toUpperCase() || 'PLAYER';
    localStorage.setItem('nnc_name', name);
    await net.connect(WS_URL, name);
    setStatus('сервер на связи', 'ok');
    return true;
  } catch (e) {
    setStatus('сервер недоступен — попробуй ещё раз (бесплатный хостинг просыпается ~40 сек)', 'err');
    return false;
  }
}

$('btn-create').addEventListener('click', async () => {
  $('btn-create').disabled = true;
  if (net.connected || await connect()) net.createRoom();
  $('btn-create').disabled = false;
});
$('btn-join').addEventListener('click', async () => {
  const code = $('room-input').value.trim().toUpperCase();
  if (code.length !== 4) { setStatus('код комнаты — 4 символа', 'err'); return; }
  $('btn-join').disabled = true;
  if (net.connected || await connect()) net.joinRoom(code);
  $('btn-join').disabled = false;
});
$('room-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });
$('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-create').click(); });

// warm up the backend (free hosting cold start)
fetch((isLocal ? `http://${location.hostname}:10777` : cfg.BACKEND_HTTP_URL) + '/health')
  .then(r => r.json())
  .then(h => {
    setStatus(`сервер на связи · ${h.version} · комнат: ${h.rooms}`, 'ok');
    if (h.version !== VERSION) setStatus(`ВЕРСИИ РАЗОШЛИСЬ: клиент ${VERSION}, сервер ${h.version}`, 'err');
  })
  .catch(() => setStatus('бужу сервер… (до ~40 сек на бесплатном хостинге)'));

// ---------------------------------------------------------------- net handlers
net.on('welcome', (m) => {
  state.myId = m.id ?? net.id;
  state.setWalls(m.walls, m.world);
  $('menu').classList.add('hidden');
  hud.show();
  inGame = true;
});
net.on('walls', (m) => state.setWalls(m.walls, m.world));
net.on('s', (m) => {
  state.addSnapshot(m);
  for (const f of m.fx) {
    effects.handleFx(f, { myId: state.myId });
    hud.handleFx(f, state.myId, state);
  }
});
net.on('offer', (m) => hud.openInstall(m.choices, m.pending));
net.on('error', (m) => { if (!inGame) setStatus(m.error === 'room not found' ? 'комната не найдена' : m.error === 'room full' ? 'комната заполнена (4/4)' : m.error, 'err'); });
net.on('room_closed', () => location.reload());
net.on('_closed', () => {
  if (inGame) {
    $('menu').classList.remove('hidden');
    setStatus('связь потеряна — обнови страницу', 'err');
    inGame = false;
  }
});

// ---------------------------------------------------------------- game loop
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!inGame) return;

  const me = state.me();
  const room = state.room;

  // modal state machine
  const modalOpen = hud.casino.open || hud.install.open;
  input.blocked = modalOpen;

  if (input.takeEsc()) {
    if (hud.casino.open && !hud.casino.spinning) hud.closeCasino();
  }
  const num = input.takeNum();
  if (num >= 0) {
    if (hud.install.open) hud.pick(num);
    else if (hud.casino.open && !hud.casino.spinning) hud.placeBet(['low', 'mid', 'high'][num]);
  }
  // close install modal when server stops offering (offer applied → new offer or none)
  if (hud.install.open && me && me[P.PEND] === 0 && room && room.phase !== 'install') hud.closeInstall();
  if (room && room.phase === 'play' && hud.install.open) hud.closeInstall();

  // input → prediction + send at ~30Hz
  const mv = input.moveVec();
  const aim = renderer.screenToWorld(input.mouseX, input.mouseY);
  const sendNow = now - lastSend >= 33;
  if (sendNow) {
    lastSend = now;
    const dash = input.takeDash();
    const inter = input.takeInter();
    const wpn = input.takeWeapon(me ? me[P.WEAPONS].length : 1);
    const pkt = state.applyLocalInput(mv, aim, input.fire && !modalOpen, dash && !modalOpen, inter && !modalOpen, wpn, 0.033);
    net.sendInput(pkt);
  }

  effects.update(dt);
  const myPos = state.myRenderPos(dt);
  const view = state.interp();
  renderer.draw(state, effects, view, myPos, { x: input.mouseX, y: input.mouseY }, now / 1000);
  hud.update(state, dt);
  hud.setTab(input.tabHeld, state);
}
requestAnimationFrame(frame);
