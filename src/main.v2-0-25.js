// nncckkrr boot v2: solo (offline), host (sim in your browser), guest (direct to host)
import { Net, VERSION, GAME_SPEED } from './net.v2-0-25.js';
import { Input } from './input.v2-0-25.js';
import { GameState, P } from './state.v2-0-25.js';
import { Effects } from './effects.v2-0-25.js';
import { Renderer } from './render.v2-0-25.js';
import { Hud } from './hud.v2-0-25.js';
import { AudioBus } from './audio.v2-0-25.js';

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
const audio = new AudioBus();
const hud = new Hud(net, audio);

let inGame = false;
let lastSend = 0;
let lastFrame = performance.now();

$('hud-version').textContent = VERSION;

// ---------------------------------------------------------------- menu
const status = $('menu-status');
function setStatus(text, cls = '') { status.textContent = text; status.className = cls; }

const SKIN_PRESETS = [
  { id: 'terminal_mint', name: 'TERMINAL MINT', fill: '#f3f3f3', outline: '#00ff66', barrel: '#00ff66', note: 'белая сердцевина / зелёный сигнал / чистый ствол' },
  { id: 'debt_red', name: 'DEBT RED', fill: '#120406', outline: '#ff3048', barrel: '#ff3048', note: 'долговая красная рамка / грязная внутрянка / тревожный ствол' },
  { id: 'void_cyan', name: 'VOID CYAN', fill: '#061114', outline: '#66f6ff', barrel: '#f3f3f3', note: 'холодная пустота / циан обводка / белый укол' },
  { id: 'casino_gold', name: 'CASINO GOLD', fill: '#171104', outline: '#ffd34d', barrel: '#00ff66', note: 'жёлтый выигрыш / зелёный сигнал / жирная ставка' },
  { id: 'bruise_purple', name: 'BRUISE PURPLE', fill: '#100617', outline: '#b45cff', barrel: '#ff3048', note: 'фиолетовый синяк / красный разрез / плохой сон' },
  { id: 'bone_static', name: 'BONE STATIC', fill: '#d8d0bd', outline: '#6f6f6f', barrel: '#66f6ff', note: 'кость и шум / серый контур / циан-игла' },
  { id: 'black_lime', name: 'BLACK LIME', fill: '#020202', outline: '#a6ff00', barrel: '#a6ff00', note: 'чёрное тело / кислотная рамка / резкий laser-tick' },
  { id: 'bad_tv', name: 'BAD TV', fill: '#ffffff', outline: '#111111', barrel: '#ff3048', note: 'пересвеченная внутрянка / чёрная рамка / красный сбой' }
];
let skinIndex = 0;
function presetById(id) { return SKIN_PRESETS.findIndex(s => s.id === id); }
function readSkin() {
  const p = SKIN_PRESETS[skinIndex] || SKIN_PRESETS[0];
  return { id: p.id, fill: p.fill, outline: p.outline, barrel: p.barrel };
}
function saveSkin() {
  const skin = readSkin();
  localStorage.setItem('nnc_skin_preset', skin.id);
  updateSkinPreview();
  return skin;
}
function updateSkinPreview() {
  const p = SKIN_PRESETS[skinIndex] || SKIN_PRESETS[0];
  const editor = $('skin-editor');
  const core = document.querySelector('#skin-preview .skin-core');
  const stick = document.querySelector('#skin-preview .skin-stick');
  const name = $('skin-name');
  const note = $('skin-note');
  if (editor) editor.dataset.skin = p.id;
  if (core) { core.style.background = p.fill; core.style.borderColor = p.outline; core.style.boxShadow = `0 0 12px ${p.outline}66`; }
  if (stick) { stick.style.background = p.barrel; stick.style.boxShadow = `0 0 10px ${p.barrel}99`; }
  if (name) name.textContent = p.name;
  if (note) note.textContent = p.note;
}
function setSkinIndex(next) {
  skinIndex = ((next % SKIN_PRESETS.length) + SKIN_PRESETS.length) % SKIN_PRESETS.length;
  saveSkin();
}
function loadSkin() {
  const savedId = localStorage.getItem('nnc_skin_preset');
  // Migration from old manual color saves: snap back to authored preset set.
  const idx = presetById(savedId);
  skinIndex = idx >= 0 ? idx : 0;
  updateSkinPreview();
  return readSkin();
}
function playerName() {
  const name = ($('name-input').value || 'PLAYER').trim().toUpperCase() || 'PLAYER';
  localStorage.setItem('nnc_name', name);
  return name;
}
$('name-input').value = localStorage.getItem('nnc_name') || '';
loadSkin();
$('skin-prev')?.addEventListener('click', () => setSkinIndex(skinIndex - 1));
$('skin-next')?.addEventListener('click', () => setSkinIndex(skinIndex + 1));

async function connect() {
  setStatus('подключение…');
  try {
    await net.connect(WS_URL, playerName(), saveSkin());
    setStatus('на связи', 'ok');
    return true;
  } catch (e) {
    setStatus('сервер-связной недоступен — попробуй ещё раз (просыпается ~40 сек). СОЛО работает и без него', 'err');
    return false;
  }
}

// SOLO: no network at all — works even with the server down
$('btn-solo').addEventListener('click', () => {
  state.localMode = true;
  net.startSolo(playerName(), saveSkin());
});
$('btn-create').addEventListener('click', async () => {
  $('btn-create').disabled = true;
  state.localMode = true;            // host = sim in this browser, zero latency
  net._name = playerName();
  net._skin = saveSkin();
  if (net.connected || await connect()) net.createRoom();
  $('btn-create').disabled = false;
});
$('btn-join').addEventListener('click', async () => {
  const code = $('room-input').value.trim().toUpperCase();
  if (code.length !== 4) { setStatus('код комнаты — 4 символа', 'err'); return; }
  $('btn-join').disabled = true;
  state.localMode = false;
  net._name = playerName();
  net._skin = saveSkin();
  if (net.connected || await connect()) net.joinRoom(code);
  $('btn-join').disabled = false;
});
$('room-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });
$('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-create').click(); });

// status probe (informational only — solo never needs it)
fetch((isLocal ? `http://${location.hostname}:10777` : cfg.BACKEND_HTTP_URL) + '/health')
  .then(r => r.json())
  .then(h => {
    setStatus(`связной на месте · ${h.version} · комнат: ${h.rooms}`, 'ok');
    if (h.version !== VERSION) setStatus(`ВЕРСИИ РАЗОШЛИСЬ: клиент ${VERSION}, связной ${h.version}`, 'err');
  })
  .catch(() => setStatus('связной спит (нужен только для игры с друзьями) — СОЛО доступно сразу'));

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
    audio.handleFx(f, { myId: state.myId });
    effects.handleFx(f, { myId: state.myId });
    hud.handleFx(f, state.myId, state);
  }
});
net.on('offer', (m) => hud.openInstall(m.choices, m.pending));
net.on('offer_close', () => hud.closeInstall());
net.on('weapon_offer', (m) => hud.openWeaponChest(m.choices));
net.on('weapon_offer_close', () => hud.closeWeaponChest());
net.on('ability_offer', (m) => hud.openAbilityChest(m.choices));
net.on('ability_offer_close', () => hud.closeAbilityChest());
net.on('casino_result', (m) => hud.casinoResult(m, state.myId));
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

  const modalOpen = hud.casino.open || hud.install.open || hud.weapon.open || hud.ability.open;
  input.blocked = modalOpen;

  if (input.takeEsc()) {
    if (hud.casino.open && !hud.casino.spinning) hud.closeCasino();
    else if (hud.weapon.open) hud.closeWeaponChest();
    else if (hud.ability.open) hud.closeAbilityChest();
    else if (input.tabOpen) input.tabOpen = false;
  }
  const num = input.takeNum();
  if (num >= 0) {
    if (hud.install.open) hud.pick(num);
    else if (hud.weapon.open) hud.pickWeapon(num);
    else if (hud.ability.open) hud.pickAbility(num);
    else if (hud.casino.open && !hud.casino.spinning) hud.placeBet(['low', 'mid', 'high'][num]);
  }
  if (hud.install.open && me && me[P.PEND] === 0 && room && room.phase !== 'install') hud.closeInstall();
  if (room && room.phase === 'play' && hud.install.open) hud.closeInstall();
  if (room && room.phase !== 'play' && hud.weapon.open) hud.closeWeaponChest();
  if (room && room.phase !== 'play' && hud.ability.open) hud.closeAbilityChest();

  const mv = input.moveVec();
  const aim = renderer.screenToWorld(input.mouseX, input.mouseY);
  const sendNow = now - lastSend >= (state.localMode ? 16 : 33);
  if (sendNow) {
    const sdt = Math.min(0.05, (now - (lastSend || now - 16)) / 1000) * GAME_SPEED;
    lastSend = now;
    const dash = input.takeDash();
    const inter = input.takeInter();
    const active = input.takeActive();
    const wpn = input.takeWeapon(me ? me[P.WEAPONS].length : 1);
    const pkt = state.applyLocalInput(mv, aim, input.fire && !modalOpen, dash && !modalOpen, inter && !modalOpen, active && !modalOpen, wpn, sdt);
    net.sendInput(pkt);
  }

  effects.update(dt);
  const myPos = state.myRenderPos(dt);
  const view = state.interp();
  renderer.draw(state, effects, view, myPos, { x: input.mouseX, y: input.mouseY }, now / 1000);
  hud.update(state, dt * GAME_SPEED);
  hud.setInspect(input.inspectMode);
  hud.setWorldHover(state, input, renderer);
  hud.setTab(input.tabOpen, state);
}
requestAnimationFrame(frame);
