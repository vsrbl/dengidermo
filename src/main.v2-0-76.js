// nncckkrr boot v2: solo (offline), host (sim in your browser), guest (direct to host)
import { Net, VERSION, BUILD_ID, PROTOCOL, GAME_SPEED } from './net.v2-0-76.js';
import { Input } from './input.v2-0-76.js';
import { GameState, P } from './state.v2-0-76.js';
import { Effects } from './effects.v2-0-76.js';
import { Renderer } from './render.v2-0-76.js';
import { Hud } from './hud.v2-0-76.js';
import { AudioBus } from './audio.v2-0-76.js';
import { SKIN_PRESETS, SKIN_RARITIES, DEFAULT_UNLOCKED_SKINS, ACTIVE_CORES, ACTIVE_MUTATIONS, ROOM_MODS, SPECIAL_ROOMS, ROOM_SEQUENCE } from '../shared/data.v2-0-76.js';
import { setupLanguageButtons, onLangChange, t, skinNote, labelStatus, getLang, locRole, locAction } from './i18n.v2-0-76.js';

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
setupLanguageButtons();

// ---------------------------------------------------------------- menu
const status = $('menu-status');
const menuVersion = $('menu-version');
const NET_STATUS = {
  connecting: 'CONNECTING…',
  online: 'ONLINE',
  ready: 'NETWORK READY',
  waking: 'NETWORK WAKING · SOLO READY',
  down: 'NETWORK UNAVAILABLE · SOLO READY',
  update: 'UPDATE REQUIRED',
  code4: 'ROOM CODE MUST BE 4 SYMBOLS',
  roomNotFound: 'ROOM NOT FOUND',
  roomFull: 'ROOM FULL (4/4)',
  lost: 'CONNECTION LOST — REFRESH PAGE'
};
function setStatus(text, cls = '') { status.textContent = text; status.className = cls; }
function setMenuVersion(server = null) {
  if (!menuVersion) return;
  const serverText = server ? `SERVER ${server.version || 'UNKNOWN'} · BUILD ${server.buildId || 'UNKNOWN'} · PROTO ${server.protocol ?? '?'}` : 'SERVER …';
  menuVersion.textContent = `CLIENT ${VERSION} · BUILD ${BUILD_ID} · PROTO ${PROTOCOL} · ${serverText}`;
}
setMenuVersion();

const SKIN_BY_ID = Object.fromEntries(SKIN_PRESETS.map(s => [s.id, s]));
const skinSaveKey = 'nnc_skin_preset';
const skinUnlockKey = 'nnc_skins_unlocked_v1';
let skinIndex = 0;
let selectedSkinId = DEFAULT_UNLOCKED_SKINS[0] || SKIN_PRESETS[0]?.id || 'terminal_mint';

function presetById(id) { return SKIN_PRESETS.findIndex(s => s.id === id); }
function rarityMeta(rarity) { return SKIN_RARITIES[rarity] || SKIN_RARITIES.basic; }
function readUnlockedSkins() {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(skinUnlockKey) || '[]'); } catch { ids = []; }
  if (!Array.isArray(ids)) ids = [];
  const valid = new Set(SKIN_PRESETS.map(s => s.id));
  const unlocked = new Set([...DEFAULT_UNLOCKED_SKINS, ...ids.filter(id => valid.has(id))]);
  localStorage.setItem(skinUnlockKey, JSON.stringify([...unlocked]));
  if (typeof net !== 'undefined') net._skinUnlocks = [...unlocked];
  return unlocked;
}
function writeUnlockedSkins(set) { localStorage.setItem(skinUnlockKey, JSON.stringify([...set].filter(id => SKIN_BY_ID[id]))); if (typeof net !== 'undefined') net._skinUnlocks = [...readUnlockedSkins()]; }
function isSkinUnlocked(id) { return readUnlockedSkins().has(id); }
function unlockSkin(id) {
  if (!SKIN_BY_ID[id]) return false;
  const set = readUnlockedSkins();
  const had = set.has(id);
  set.add(id);
  writeUnlockedSkins(set);
  updateSkinPreview();
  return !had;
}
function firstUnlockedSkinId() {
  const set = readUnlockedSkins();
  return SKIN_PRESETS.find(s => set.has(s.id))?.id || SKIN_PRESETS[0]?.id || 'terminal_mint';
}
function readSkin() {
  const p = SKIN_BY_ID[selectedSkinId] && isSkinUnlocked(selectedSkinId) ? SKIN_BY_ID[selectedSkinId] : SKIN_BY_ID[firstUnlockedSkinId()];
  return { id: p.id, fill: p.fill, outline: p.outline, barrel: p.barrel };
}
function saveSkin() {
  const browsed = SKIN_PRESETS[skinIndex] || SKIN_PRESETS[0];
  if (browsed && isSkinUnlocked(browsed.id)) selectedSkinId = browsed.id;
  const skin = readSkin();
  localStorage.setItem(skinSaveKey, skin.id);
  updateSkinPreview();
  return skin;
}
function updateSkinPreview() {
  const p = SKIN_PRESETS[skinIndex] || SKIN_PRESETS[0];
  const editor = $('skin-editor');
  const core = document.querySelector('#skin-preview .skin-core');
  const name = $('skin-name');
  const note = $('skin-note');
  const unlocked = isSkinUnlocked(p.id);
  const selected = selectedSkinId === p.id && unlocked;
  const rarity = rarityMeta(p.rarity);
  if (editor) {
    // Show the real preset even while locked; lock state only blocks selection.
    editor.dataset.skin = p.id;
    editor.dataset.rarity = p.rarity || 'basic';
    editor.classList.toggle('locked', !unlocked);
    editor.classList.toggle('selected', !!selected);
    editor.style.setProperty('--skin-fill', p.fill);
    editor.style.setProperty('--skin-outline', p.outline);
    editor.style.setProperty('--skin-shadow', `0 0 ${p.rarity === 'legendary' ? 24 : p.rarity === 'superrare' ? 18 : 10}px ${p.outline}${unlocked ? '88' : '44'}`);
  }
  if (core) {
    core.style.background = p.fill;
    core.style.borderColor = p.outline;
    core.style.boxShadow = `0 0 ${p.rarity === 'legendary' ? 24 : p.rarity === 'superrare' ? 18 : 10}px ${p.outline}${unlocked ? '88' : '44'}`;
  }
  if (name) name.textContent = p.name;
  if (note) {
    const status = selected ? 'SELECTED' : (unlocked ? 'UNLOCKED' : 'LOCKED');
    note.textContent = `${rarity.label} · ${labelStatus(status)}`;
    note.title = skinNote(p);
  }
}
function setSkinIndex(next) {
  skinIndex = ((next % SKIN_PRESETS.length) + SKIN_PRESETS.length) % SKIN_PRESETS.length;
  const browsed = SKIN_PRESETS[skinIndex];
  if (browsed && isSkinUnlocked(browsed.id)) selectedSkinId = browsed.id;
  localStorage.setItem(skinSaveKey, selectedSkinId);
  updateSkinPreview();
}
function loadSkin() {
  readUnlockedSkins();
  const savedId = localStorage.getItem(skinSaveKey);
  selectedSkinId = savedId && isSkinUnlocked(savedId) ? savedId : firstUnlockedSkinId();
  const idx = presetById(selectedSkinId);
  skinIndex = idx >= 0 ? idx : 0;
  updateSkinPreview();
  return readSkin();
}
function fallbackLockedSkin(preferredRarity = '') {
  const known = readUnlockedSkins();
  const rarityOrder = ['uncommon', 'rare', 'superrare', 'legendary'];
  const ordered = [preferredRarity, ...rarityOrder].filter((r, i, a) => r && a.indexOf(r) === i);
  for (const rarity of ordered) {
    const candidate = SKIN_PRESETS.find(s => s.rarity === rarity && !known.has(s.id));
    if (candidate) return candidate;
  }
  return SKIN_PRESETS.find(s => s.rarity !== 'basic' && !known.has(s.id)) || null;
}
function handleSkinUnlock(id, source = 'casino') {
  if (!id || !SKIN_BY_ID[id]) return;
  let skin = SKIN_BY_ID[id];
  let finalId = id;
  let fallback = false;
  if (isSkinUnlocked(finalId)) {
    const alt = fallbackLockedSkin(skin?.rarity || '');
    if (!alt) {
      try { hud.feed(`SKN DUPLICATE: ${skin.rarity?.toUpperCase?.() || 'SKIN'}`, 'r'); } catch {}
      return;
    }
    skin = alt; finalId = alt.id; fallback = true;
  }
  const newly = unlockSkin(finalId);
  if (newly && skin) {
    selectedSkinId = skin.id;
    const idx = presetById(skin.id); if (idx >= 0) skinIndex = idx;
    localStorage.setItem(skinSaveKey, selectedSkinId);
    updateSkinPreview();
    const prefix = source === 'room' ? 'SKN CACHE' : 'SKN UNLOCK';
    const suffix = fallback ? ' / NO DUPLICATE' : '';
    try { hud.feed(`${prefix}: ${skin.name}${suffix}`, skin.rarity === 'legendary' || skin.rarity === 'superrare' ? 'p' : 'g'); } catch {}
  }
}
function handleCasinoSkinReward(pl = {}) {
  if (!pl.skin || !pl.skinId) return;
  handleSkinUnlock(pl.skinId, 'casino');
}
window.NNCCKKRR_UNLOCK_SKIN = unlockSkin;

function playerName() {
  const name = ($('name-input').value || 'PLAYER').trim().toUpperCase() || 'PLAYER';
  localStorage.setItem('nnc_name', name);
  return name;
}
$('name-input').value = localStorage.getItem('nnc_name') || '';
loadSkin();
$('skin-prev')?.addEventListener('click', () => setSkinIndex(skinIndex - 1));
$('skin-next')?.addEventListener('click', () => setSkinIndex(skinIndex + 1));
onLangChange(() => { updateSkinPreview(); });

async function connect() {
  setStatus(NET_STATUS.connecting);
  try {
    await net.connect(WS_URL, playerName(), saveSkin());
    setStatus(NET_STATUS.online, 'ok');
    return true;
  } catch (e) {
    setStatus(NET_STATUS.down, 'err');
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
  if (code.length !== 4) { setStatus(NET_STATUS.code4, 'err'); return; }
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
    setMenuVersion(h);
    setStatus(NET_STATUS.ready, 'ok');
    if (h.version !== VERSION) setStatus(`${NET_STATUS.update}: CLIENT ${VERSION} / SERVER ${h.version || 'UNKNOWN'}`, 'err');
  })
  .catch(() => { setMenuVersion(); setStatus(NET_STATUS.waking); });

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
    if (f?.t === 'skin_unlock' && f.skinId) handleSkinUnlock(f.skinId, f.source || 'room');
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
net.on('casino_result', (m) => { if (m?.id === state.myId) handleCasinoSkinReward(m.payload || {}); hud.casinoResult(m, state.myId); });
net.on('error', (m) => { if (!inGame) setStatus(m.error === 'room not found' ? NET_STATUS.roomNotFound : m.error === 'room full' ? NET_STATUS.roomFull : String(m.error || 'NETWORK ERROR').toUpperCase(), 'err'); });
net.on('room_closed', () => location.reload());
net.on('_closed', () => {
  if (inGame) {
    $('menu').classList.remove('hidden');
    setStatus(NET_STATUS.lost, 'err');
    inGame = false;
  }
});


// ---------------------------------------------------------------- developer mode (solo/host only)
let devOpen = false;
let devGod = false;
let devPanel = null;
function ensureDevPanel() {
  if (devPanel) return devPanel;
  devPanel = document.createElement('div');
  devPanel.id = 'dev-panel';
  devPanel.className = 'hidden';
  const coreOpts = Object.values(ACTIVE_CORES).map(c => `<option value="${c.id}">${c.label}</option>`).join('');
  const mutOpts = Object.values(ACTIVE_MUTATIONS).map(m => `<label><input type="checkbox" value="${m.id}"> ${m.label}</label>`).join('');
  const categoryOpts = [''].concat(ROOM_SEQUENCE, ['chill']).map(v => `<option value="${v}">${v ? v.toUpperCase() : 'AUTO'}</option>`).join('');
  const specialOpts = [''].concat(Object.keys(SPECIAL_ROOMS)).map(v => `<option value="${v}">${v ? v.toUpperCase() : 'NONE'}</option>`).join('');
  const archetypeOpts = ['', 'panic_box','compact','standard','wide','long_lane','lounge','boss'].map(v => `<option value="${v}">${v ? v.toUpperCase() : 'AUTO'}</option>`).join('');
  const roomModOpts = Object.values(ROOM_MODS).map(m => `<label><input type="checkbox" value="${m.id}"> ${m.label}</label>`).join('');
  devPanel.innerHTML = `
    <div class="dev-title">DEV MODE <span>F2</span></div>
    <div class="dev-note">SOLO/HOST only · room lab / WPN / portal / Q</div>
    <div class="dev-buttons dev-priority">
      <button id="dev-open-portal">OPEN PORTAL NOW</button>
      <button id="dev-wpn-offer">WPN OFFER</button>
    </div>
    <div class="dev-section-title">NEXT ROOM LAB</div>
    <div class="dev-row"><label>CAT</label><select id="dev-room-cat">${categoryOpts}</select></div>
    <div class="dev-row"><label>SPEC</label><select id="dev-room-special">${specialOpts}</select></div>
    <div class="dev-row"><label>ARCH</label><select id="dev-room-arch">${archetypeOpts}</select></div>
    <div class="dev-muts dev-room-mods" id="dev-room-mods">${roomModOpts}</div>
    <div class="dev-buttons dev-priority">
      <button id="dev-apply-next">LOCK NEXT ROOM</button>
      <button id="dev-clear-next">AUTO NEXT</button>
    </div>
    <div class="dev-section-title">Q / PLAYER</div>
    <div class="dev-row"><label>CORE</label><select id="dev-core">${coreOpts}</select></div>
    <div class="dev-row"><label>LVL</label><select id="dev-level"><option value="1">I</option><option value="2">II</option><option value="3" selected>III</option><option value="4">IV</option><option value="5">V</option><option value="6">VI</option><option value="7">VII</option><option value="8">VIII</option></select></div>
    <div class="dev-muts" id="dev-muts">${mutOpts}</div>
    <div class="dev-buttons">
      <button id="dev-apply">SET Q</button>
      <button id="dev-ready">READY</button>
      <button id="dev-abl">ABL OFFER</button>
      <button id="dev-pack">SPAWN PACK</button>
      <button id="dev-clear">CLEAR</button>
      <button id="dev-wpn">ALL WPN</button>
      <button id="dev-money">GLD/EXP</button>
      <button id="dev-skins">UNLOCK SKINS</button>
      <button id="dev-god">GOD: OFF</button>
    </div>`;
  document.body.appendChild(devPanel);
  const cmd = (action, extra = {}) => net.sendDev({ action, ...extra });
  const readNextRoomLab = () => ({
    category: devPanel.querySelector('#dev-room-cat')?.value || '',
    specialRoomId: devPanel.querySelector('#dev-room-special')?.value || '',
    archetype: devPanel.querySelector('#dev-room-arch')?.value || '',
    modifierIds: [...devPanel.querySelectorAll('#dev-room-mods input:checked')].map(x => x.value)
  });
  devPanel.querySelector('#dev-open-portal')?.addEventListener('click', () => { cmd('open_portal'); hud.feed('DEV: PORTAL OPEN', 'c'); });
  devPanel.querySelector('#dev-wpn-offer')?.addEventListener('click', () => { cmd('weapon_offer'); hud.feed('DEV: WPN OFFER', 'c'); });
  devPanel.querySelector('#dev-apply-next')?.addEventListener('click', () => { cmd('set_next_room', readNextRoomLab()); hud.feed('DEV: NEXT ROOM LOCKED', 'c'); });
  devPanel.querySelector('#dev-clear-next')?.addEventListener('click', () => { cmd('clear_next_room'); hud.feed('DEV: NEXT ROOM AUTO', ''); });
  devPanel.querySelector('#dev-apply')?.addEventListener('click', () => {
    const core = devPanel.querySelector('#dev-core')?.value || 'void_cut';
    const level = Number(devPanel.querySelector('#dev-level')?.value || 3);
    const mutations = [...devPanel.querySelectorAll('#dev-muts input:checked')].map(x => x.value).slice(0, 3);
    cmd('set_active', { core, level, mutations });
    hud.feed(`DEV Q: ${String(core).toUpperCase()}`, 'c');
  });
  devPanel.querySelector('#dev-ready')?.addEventListener('click', () => cmd('reset_cd'));
  devPanel.querySelector('#dev-abl')?.addEventListener('click', () => cmd('ability_offer'));
  devPanel.querySelector('#dev-pack')?.addEventListener('click', () => cmd('spawn_pack'));
  devPanel.querySelector('#dev-clear')?.addEventListener('click', () => cmd('clear_enemies'));
  devPanel.querySelector('#dev-wpn')?.addEventListener('click', () => cmd('give_all_weapons'));
  devPanel.querySelector('#dev-money')?.addEventListener('click', () => cmd('money_xp'));
  devPanel.querySelector('#dev-god')?.addEventListener('click', (e) => { devGod = !devGod; e.currentTarget.textContent = `GOD: ${devGod ? 'ON' : 'OFF'}`; cmd('god', { enabled: devGod }); });
  devPanel.querySelector('#dev-skins')?.addEventListener('click', () => {
    const set = readUnlockedSkins();
    for (const sk of SKIN_PRESETS) set.add(sk.id);
    writeUnlockedSkins(set);
    hud.feed('DEV: ALL SKINS UNLOCKED', 'c');
  });
  return devPanel;
}
function toggleDevPanel() {
  devOpen = !devOpen;
  const p = ensureDevPanel();
  p.classList.toggle('hidden', !devOpen);
  hud.feed(devOpen ? 'DEV MODE ON' : 'DEV MODE OFF', devOpen ? 'c' : '');
}

// ---------------------------------------------------------------- game loop
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!inGame) return;

  if (input.takeDevToggle()) toggleDevPanel();

  const me = state.me();
  const room = state.room;

  const modalOpen = hud.casino.open || hud.install.open || hud.weapon.open || hud.ability.open;
  input.blocked = modalOpen;

  if (input.takeEsc()) {
    if (hud.casino.open && !hud.casino.spinning) hud.closeCasino();
    else if (hud.install.open) hud.pickRandomInstall();
    else if (hud.weapon.open) hud.pickRandomWeapon();
    else if (hud.ability.open) hud.pickRandomAbility();
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
  const sendNow = now - lastSend >= 16; // guest inputs also send at frame cadence for less floaty control
  if (sendNow) {
    const sdt = Math.min(0.05, (now - (lastSend || now - 16)) / 1000) * GAME_SPEED;
    lastSend = now;
    const dash = input.takeDash();
    const inter = input.takeInter();
    const active = input.takeActive();
    const secondary = input.takeSecondary();
    const wpn = input.takeWeapon(me ? me[P.WEAPONS].length : 1);
    const pkt = state.applyLocalInput(mv, aim, input.fire && !modalOpen, dash && !modalOpen, inter && !modalOpen, active && !modalOpen, wpn, sdt, secondary && !modalOpen);
    net.sendInput(pkt);
  }

  effects.update(dt);
  const myPos = state.myRenderPos(dt);
  const view = state.interp();
  renderer.draw(state, effects, view, myPos, { x: input.mouseX, y: input.mouseY }, now / 1000);
  hud.update(state, dt * GAME_SPEED);
  audio.updateMusic(state, dt * GAME_SPEED);
  hud.setInspect(input.inspectMode);
  hud.setWorldHover(state, input, renderer);
  hud.setTab(input.tabOpen, state);
}
requestAnimationFrame(frame);
