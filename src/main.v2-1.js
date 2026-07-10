// terminal casino roguelike boot v2: single-player (offline), host (sim in your browser), guest (direct to host)
import { Net, VERSION, BUILD_ID, PROTOCOL, GAME_SPEED } from './net.v2-1.js';
import { Input } from './input.v2-1.js';
import { GameState, P } from './state.v2-1.js';
import { Effects } from './effects.v2-1.js';
import { Renderer } from './render.v2-1.js';
import { Hud } from './hud.v2-1.js';
import { AudioBus } from './audio.v2-1.js';
import { SKIN_PRESETS, SKIN_RARITIES, DEFAULT_UNLOCKED_SKINS, ACTIVE_CORES, ACTIVE_MUTATIONS, ROOM_MODS, SPECIAL_ROOMS, ROOM_SEQUENCE, HERO_UPGRADES, WEAPON_CHEST_REWARDS, BOSS_SIGNATURE_UPGRADE_IDS } from '../shared/data.v2-1.js';
import { setupLanguageButtons, onLangChange, t, labelStatus, getLang, locRole, locAction, localText } from './i18n.v2-1.js';

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
function uiClick(type = 'ui_click') { try { audio.play(type); } catch {} }

let inGame = false;
let lastSend = 0;
let lastFrame = performance.now();

$('hud-version').textContent = VERSION;
setupLanguageButtons();
document.querySelectorAll('[data-lang-btn]').forEach(btn => btn.addEventListener('click', (ev) => { uiClick('ui_click'); ev.currentTarget?.blur?.(); }));
document.addEventListener('pointerup', (ev) => {
  const btn = ev.target?.closest?.('.yt-mini button, .lang-mini button, .lang-row button');
  if (btn) setTimeout(() => btn.blur?.(), 0);
}, { passive: true });

// ---------------------------------------------------------------- menu
const status = $('menu-status');
const menuVersion = $('menu-version');
const NET_STATUS = {
  connecting: ['ПОДКЛЮЧЕНИЕ…', 'CONNECTING…'],
  online: ['В СЕТИ', 'ONLINE'],
  ready: ['СЕТЬ ГОТОВА', 'NETWORK READY'],
  waking: ['СЕТЬ ПРОСЫПАЕТСЯ · ОДИНОЧНАЯ ИГРА ГОТОВА', 'NETWORK WAKING · SINGLE PLAYER READY'],
  down: ['СЕТЬ НЕДОСТУПНА · ОДИНОЧНАЯ ИГРА ГОТОВА', 'NETWORK UNAVAILABLE · SINGLE PLAYER READY'],
  update: ['НУЖНО ОБНОВИТЬ СТРАНИЦУ', 'UPDATE REQUIRED'],
  code4: ['КОД СЕКТОРА: 4 СИМВОЛА', 'SECTOR CODE MUST BE 4 SYMBOLS'],
  roomNotFound: ['СЕКТОР НЕ НАЙДЕН', 'SECTOR NOT FOUND'],
  roomFull: ['СЕКТОР ЗАПОЛНЕН (4/4)', 'SECTOR FULL (4/4)'],
  lost: ['СВЯЗЬ ПОТЕРЯНА — ОБНОВИ СТРАНИЦУ', 'CONNECTION LOST — REFRESH PAGE'],
  error: ['СЕТЕВАЯ ОШИБКА', 'NETWORK ERROR']
};
let currentStatusKey = 'connecting';
let currentStatusClass = '';
function netStatus(key) { const v = NET_STATUS[key] || NET_STATUS.error; return getLang() === 'en' ? v[1] : v[0]; }
function setStatusKey(key, cls = '') {
  currentStatusKey = key || 'error';
  currentStatusClass = cls || '';
  status.textContent = netStatus(currentStatusKey);
  status.className = currentStatusClass;
}
function setStatus(text, cls = '') {
  currentStatusKey = '';
  currentStatusClass = cls || '';
  status.textContent = Array.isArray(text) ? (getLang() === 'en' ? text[1] : text[0]) : text;
  status.className = currentStatusClass;
}
function refreshMenuStatusLanguage() {
  if (currentStatusKey) {
    status.textContent = netStatus(currentStatusKey);
    status.className = currentStatusClass;
  }
}
function setMenuVersion(server = null) {
  if (!menuVersion) return;
  // v2.1.75: keep this plate short and stable. Network status belongs to #menu-status.
  menuVersion.textContent = `${localText('ВЕРСИЯ', 'VERSION')} ${VERSION}`;
}
setMenuVersion();

const SKIN_BY_ID = Object.fromEntries(SKIN_PRESETS.map(s => [s.id, s]));
const skinSaveKey = 'nnc_skin_preset';
const skinUnlockKey = 'nnc_skins_unlocked_v1';
let skinIndex = 0;
let selectedSkinId = DEFAULT_UNLOCKED_SKINS[0] || SKIN_PRESETS[0]?.id || 'terminal_mint';
const heroSaveKey = 'tcr_selected_hero_v1';
const heroUnlockKey = 'tcr_heroes_unlocked_v1';
const DEFAULT_UNLOCKED_HEROES = ['base'];
const HEROES = {
  base: {
    id: 'base',
    labelRu: 'БАЗОВЫЙ АНТИВИРУС', labelEn: 'BASE ANTIVIRUS',
    descRu: 'прямой боевой протокол', descEn: 'direct combat protocol',
    explainRu: 'Стартовое ядро: прямой бой и классические модули оружия.',
    explainEn: 'Starter core: direct combat and classic weapon modules.'
  },
  living_casino: {
    id: 'living_casino',
    labelRu: 'ЖИВОЕ КАЗИНО', labelEn: 'LIVING CASINO',
    descRu: 'казино-протокол', descEn: 'casino protocol',
    explainRu: 'Автономная пушка сама ведёт огонь. Второй модуль — искры контроля — открывается во время забега.',
    explainEn: 'An autonomous gun fires on its own. The second module, Control Sparks, is unlocked during the run.',
    unlockRu: 'Удалить скрытый казино-вирус.', unlockEn: 'Delete the Hidden Casino Virus.'
  },
  process_controller: {
    id: 'process_controller',
    labelRu: 'КОНТРОЛЁР ПРОЦЕССОВ', labelEn: 'PROCESS CONTROLLER',
    descRu: 'контроль процессов', descEn: 'process control',
    explainRu: 'Ядро контроля: перехватывает процессы, отдаёт приказы и ставит карантинные якоря.',
    explainEn: 'Control core: captures processes, issues orders, and deploys quarantine anchors.',
    unlockRu: 'Завершить очистку.', unlockEn: 'Complete the cleanup.'
  }
};
function readUnlockedHeroes() {
  let ids = [];
  try { ids = JSON.parse(localStorage.getItem(heroUnlockKey) || '[]'); } catch { ids = []; }
  if (!Array.isArray(ids)) ids = [];
  const valid = new Set(Object.keys(HEROES));
  const unlocked = new Set([...DEFAULT_UNLOCKED_HEROES, ...ids.filter(id => valid.has(id))]);
  localStorage.setItem(heroUnlockKey, JSON.stringify([...unlocked]));
  return unlocked;
}
function writeUnlockedHeroes(set) {
  const valid = new Set(Object.keys(HEROES));
  localStorage.setItem(heroUnlockKey, JSON.stringify([...set].filter(id => valid.has(id))));
}
function isHeroUnlocked(id) { return readUnlockedHeroes().has(id); }
function unlockHero(id, source = '') {
  if (!HEROES[id]) return false;
  const set = readUnlockedHeroes(); const had = set.has(id); set.add(id); writeUnlockedHeroes(set);
  updateHeroSelector();
  if (!had && typeof hud !== 'undefined') {
    const h = HEROES[id];
    hud.banner?.(localText('АНТИВИРУС ОТКРЫТ', 'ANTIVIRUS UNLOCKED'), localText(h.labelRu, h.labelEn), 'gold');
    hud.feed?.(`${localText('ОТКРЫТ', 'UNLOCKED')}: ${localText(h.labelRu, h.labelEn)}`, 'g');
  }
  return !had;
}
function lockAllHeroes() {
  writeUnlockedHeroes(new Set(DEFAULT_UNLOCKED_HEROES));
  if (!isHeroUnlocked(selectedHeroId)) selectedHeroId = 'base';
  localStorage.setItem(heroSaveKey, selectedHeroId);
  updateHeroSelector();
}
const savedHeroId = localStorage.getItem(heroSaveKey);
let selectedHeroId = HEROES[savedHeroId] && isHeroUnlocked(savedHeroId) ? savedHeroId : 'base';
if (!HEROES[selectedHeroId] || !isHeroUnlocked(selectedHeroId)) selectedHeroId = 'base';

function hexTriplet(hex, fallback = '0,255,102') {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return fallback;
  const v = m[1];
  return `${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)}`;
}
function applySkinTheme(id = selectedSkinId) {
  const direct = SKIN_BY_ID[id] && isSkinUnlocked(id) ? SKIN_BY_ID[id] : null;
  const fallbackId = typeof firstUnlockedSkinId === 'function' ? firstUnlockedSkinId() : (DEFAULT_UNLOCKED_SKINS[0] || 'terminal_mint');
  const skin = direct || SKIN_BY_ID[selectedSkinId] || SKIN_BY_ID[fallbackId] || SKIN_PRESETS[0];
  if (!skin) return;
  for (const el of [document.documentElement, document.body]) {
    if (!el) continue;
    el.dataset.skinId = skin.id || 'terminal_mint';
    el.dataset.skinRarity = skin.rarity || 'basic';
    el.style.setProperty('--skin-fill', skin.fill || '#f3f3f3');
    el.style.setProperty('--skin-outline', skin.outline || '#00ff66');
    el.style.setProperty('--skin-barrel', skin.barrel || '#00ff66');
    el.style.setProperty('--skin-fill-rgb', hexTriplet(skin.fill || '#f3f3f3', '243,243,243'));
    el.style.setProperty('--skin-outline-rgb', hexTriplet(skin.outline || '#00ff66', '0,255,102'));
    el.style.setProperty('--skin-barrel-rgb', hexTriplet(skin.barrel || '#00ff66', '0,255,102'));
  }
}

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
  return { id: p.id, hero: selectedHeroId, fill: p.fill, outline: p.outline, barrel: p.barrel };
}
function saveSkin() {
  const browsed = SKIN_PRESETS[skinIndex] || SKIN_PRESETS[0];
  if (browsed && isSkinUnlocked(browsed.id)) selectedSkinId = browsed.id;
  const skin = readSkin();
  localStorage.setItem(skinSaveKey, skin.id);
  localStorage.setItem(heroSaveKey, selectedHeroId);
  updateSkinPreview();
  updateHeroSelector();
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
    note.removeAttribute('title');
  }
  applySkinTheme(selectedSkinId);
}
function setSkinIndex(next) {
  skinIndex = ((next % SKIN_PRESETS.length) + SKIN_PRESETS.length) % SKIN_PRESETS.length;
  const browsed = SKIN_PRESETS[skinIndex];
  if (browsed && isSkinUnlocked(browsed.id)) selectedSkinId = browsed.id;
  localStorage.setItem(skinSaveKey, selectedSkinId);
  updateSkinPreview();
}

function updateHeroSelector() {
  const status = $('hero-status');
  const ru = getLang() !== 'en';
  const selected = HEROES[selectedHeroId] || HEROES.base;
  const head = document.querySelector('#hero-selector .hero-head span:first-child');
  if (head) head.textContent = ru ? 'АНТИВИРУС' : 'ANTIVIRUS';
  if (status) status.textContent = ru ? selected.labelRu : selected.labelEn;
  const selector = $('hero-selector');
  if (selector) {
    selector.dataset.explainTitle = ru ? 'АНТИВИРУС' : 'ANTIVIRUS';
    selector.dataset.explain = ru ? 'Выбор антивирусного ядра для протокола.' : 'Choose the antivirus core for this protocol.';
  }
  document.querySelectorAll('[data-hero]').forEach(btn => {
    const h = HEROES[btn.dataset.hero] || HEROES.base;
    const unlocked = isHeroUnlocked(btn.dataset.hero);
    const on = btn.dataset.hero === selectedHeroId && unlocked;
    btn.classList.toggle('selected', on);
    btn.classList.toggle('locked', !unlocked);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-disabled', unlocked ? 'false' : 'true');
    const title = btn.querySelector('.hero-title');
    const desc = btn.querySelector('.hero-desc');
    if (title) title.textContent = ru ? h.labelRu : h.labelEn;
    if (desc) desc.textContent = unlocked ? (ru ? h.descRu : h.descEn) : localText('ЗАКРЫТО', 'LOCKED');
    btn.dataset.explainTitle = ru ? h.labelRu : h.labelEn;
    btn.dataset.explain = unlocked ? (ru ? h.explainRu : h.explainEn) : (ru ? (h.unlockRu || 'Завершите условие открытия.') : (h.unlockEn || 'Complete the unlock condition.'));
  });
}
function setHero(id) {
  const next = HEROES[id] ? id : 'base';
  if (!isHeroUnlocked(next)) {
    const h = HEROES[next] || HEROES.base;
    if (status) status.textContent = localText(h.unlockRu || 'ЗАКРЫТО', h.unlockEn || 'LOCKED');
    uiClick('denied');
    return false;
  }
  selectedHeroId = next;
  localStorage.setItem(heroSaveKey, selectedHeroId);
  updateHeroSelector();
  return true;
}
document.querySelectorAll('[data-hero]').forEach(btn => btn.addEventListener('click', () => { uiClick('ui_click'); setHero(btn.dataset.hero); }));

function loadSkin() {
  readUnlockedSkins();
  const savedId = localStorage.getItem(skinSaveKey);
  selectedSkinId = savedId && isSkinUnlocked(savedId) ? savedId : firstUnlockedSkinId();
  const idx = presetById(selectedSkinId);
  skinIndex = idx >= 0 ? idx : 0;
  updateSkinPreview();
  applySkinTheme(selectedSkinId);
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
      try {
        hud.feed(`${getLang() !== 'en' ? 'ВСЕ ОБЛИКИ ОТКРЫТЫ' : 'ALL SHELLS UNLOCKED'}: ${skin.rarity?.toUpperCase?.() || 'SHELL'}`, 'g');
        hud.openSkinClaim?.({ allOwned: 1, name: getLang() !== 'en' ? 'ВСЕ ОБЛИКИ ОТКРЫТЫ' : 'ALL SHELLS UNLOCKED', rarity: 'complete', source });
      } catch {}
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
    applySkinTheme(selectedSkinId);
    const ru = getLang() !== 'en';
    const prefix = source === 'room' ? (ru ? 'ОБЛИК ИЗ СЕКТОРА' : 'SECTOR SHELL') : (ru ? 'ОБЛИК ОТКРЫТ' : 'SHELL UNLOCKED');
    const suffix = fallback ? (ru ? ' / БЕЗ ДУБЛЯ' : ' / NO DUPLICATE') : '';
    try {
      hud.feed(`${prefix}: ${skin.name}${suffix}`, skin.rarity === 'legendary' || skin.rarity === 'superrare' ? 'p' : 'g');
      hud.openSkinClaim?.({ id: skin.id, name: skin.name, rarity: skin.rarity, source });
    } catch {}
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
updateHeroSelector();
applySkinTheme(selectedSkinId);
$('skin-prev')?.addEventListener('click', () => { uiClick('ui_click'); setSkinIndex(skinIndex - 1); });
$('skin-next')?.addEventListener('click', () => { uiClick('ui_click'); setSkinIndex(skinIndex + 1); });
const skinToggle = $('btn-skin-toggle');
skinToggle?.addEventListener('click', () => {
  uiClick('ui_click');
  const ed = $('skin-editor');
  if (!ed) return;
  const open = ed.classList.toggle('collapsed') === false;
  skinToggle.classList.toggle('open', open);
  skinToggle.textContent = open ? t('hideSkins') : t('changeSkin');
});

const FILTER_PRESETS = [
  { id: 'lcd', name: 'LED' }
];
const FILTER_KEY = 'tcr_filter_preset_v1';
let filterIndex = 0;
function applyVisualFilter() {
  const preset = FILTER_PRESETS[0];
  document.documentElement.dataset.filterPreset = preset.id;
  document.body.dataset.filterPreset = preset.id;
  localStorage.setItem(FILTER_KEY, preset.id);
  const btn = $('filter-switch');
  if (btn) btn.remove();
}
applyVisualFilter();

function paintRange(el) {
  if (!el) return;
  const min = Number(el.min || 0), max = Number(el.max || 100), val = Number(el.value || 0);
  const pct = ((val - min) / Math.max(1, max - min)) * 100;
  el.style.setProperty('--val', `${Math.max(0, Math.min(99.2, pct))}%`);
}
function syncAudioSliders() {
  const mv = $('music-volume'), sv = $('sfx-volume');
  const vals = audio.getVolumes?.() || { music: 0.7, sfx: 0.85 };
  if (mv) { mv.value = Math.round(vals.music * 100); paintRange(mv); }
  if (sv) { sv.value = Math.round(vals.sfx * 100); paintRange(sv); }
}
function bindVolumeSlider(id, kind) {
  const el = $(id);
  if (!el) return;
  const apply = e => {
    const v = Number(e.currentTarget.value) / 100;
    if (kind === 'music') audio.setMusicVolume?.(v);
    else audio.setSfxVolume?.(v);
    paintRange(e.currentTarget);
    audio.previewVolume?.(kind);
  };
  el.addEventListener('input', apply);
  el.addEventListener('pointerdown', apply);
  el.addEventListener('change', apply);
}
bindVolumeSlider('music-volume', 'music');
bindVolumeSlider('sfx-volume', 'sfx');
syncAudioSliders();

function bindYouTubeMusicUi() {
  const input = $('youtube-playlist');
  const load = $('youtube-load');
  const toggle = $('youtube-toggle');
  const status = $('youtube-status');
  const saved = localStorage.getItem('tc_youtube_playlist') || '';
  if (input && saved) input.value = saved;
  const setYtStatus = txt => { if (status) status.textContent = txt; };
  const setToggle = txt => { if (toggle) toggle.textContent = txt; };
  const setBusy = on => {
    if (load) load.disabled = !!on;
    if (toggle) toggle.disabled = !!on;
    const wrap = $('youtube-music');
    if (wrap) wrap.classList.toggle('yt-loading', !!on);
  };
  const sourceLabel = res => {
    if (!res?.ok) return '';
    return res.sourceType === 'video' ? `VIDEO ${res.sourceId || res.playlist}` : `PLAYLIST ${res.sourceId || res.playlist}`;
  };
  const friendlyYtError = code => {
    const c = String(code || '').trim();
    if (c === '2') return 'YT ERR 2 · BAD LINK';
    if (c === '5') return 'YT ERR 5 · HTML5';
    if (c === '100') return 'YT ERR 100 · NOT FOUND';
    if (c === '101' || c === '150') return 'YT ERR 150 · EMBED BLOCKED';
    return c ? `YT ERR ${c}` : 'YT ERR';
  };
  const syncYtUi = () => {
    try { audio.syncYouTubeState?.(); } catch {}
    if (audio.isYouTubeActive?.()) {
      setToggle('PAUSE');
      setYtStatus('PLAYING · INTERNAL AMBIENT MUTED');
      setBusy(false);
      return true;
    }
    if (audio.ytMusic?.error) {
      setToggle('PLAY');
      setYtStatus(friendlyYtError(audio.ytMusic.error));
      setBusy(false);
      return true;
    }
    const state = audio.ytMusic?.lastState;
    if (audio.ytMusic?.loading) {
      setToggle('PAUSE');
      setYtStatus(state === 3 ? 'BUFFERING...' : 'LOADING...');
      return false;
    }
    return false;
  };
  const watchYtStart = (maxMs = 5200) => {
    const started = performance.now();
    syncYtUi();
    const timer = setInterval(() => {
      if (syncYtUi() || performance.now() - started > maxMs) {
        clearInterval(timer);
        if (!audio.isYouTubeActive?.() && !audio.ytMusic?.error) {
          setToggle('PLAY');
          setBusy(false);
          setYtStatus(audio.ytMusic?.loading ? 'LOADING...' : 'CLICK PLAY ON VIDEO');
        }
      }
    }, 260);
  };
  const init = () => audio.initYouTubeMusic?.('youtube-player').catch?.(() => setYtStatus('API ERR'));
  if (load) load.addEventListener('click', async () => {
    uiClick('ui_click');
    const value = input?.value || '';
    if (!value.trim()) { setYtStatus('PASTE YOUTUBE LINK'); return; }
    setBusy(true);
    setYtStatus('LOADING...');
    try {
      const res = await audio.loadYouTubePlaylist?.(value);
      if (res?.ok) { setYtStatus(`LOADED ${sourceLabel(res)}`); setToggle('PLAY'); }
      else setYtStatus(res?.error === 'PLAYER_NOT_READY' ? 'PLAYER LOADING...' : 'BAD YOUTUBE LINK');
    } catch {
      setYtStatus('API ERR');
    } finally {
      setBusy(false);
    }
  });
  if (toggle) toggle.addEventListener('click', async () => {
    uiClick('ui_click');
    const savedNow = input?.value || localStorage.getItem('tc_youtube_playlist') || '';
    if (!savedNow.trim()) { setYtStatus('PASTE YOUTUBE LINK FIRST'); return; }
    if (audio.isYouTubeActive?.()) {
      audio.pauseYouTube?.();
      setToggle('PLAY');
      setYtStatus('PAUSED · INTERNAL AMBIENT');
      return;
    }
    setBusy(true);
    setYtStatus('LOADING...');
    try {
      const parsed = audio.parseYouTubeSource?.(savedNow);
      const current = localStorage.getItem('tc_youtube_playlist') || '';
      if (savedNow.trim() !== current.trim() || parsed?.id !== audio.ytMusic?.sourceId) {
        const loaded = await audio.loadYouTubePlaylist?.(savedNow);
        if (!loaded?.ok) { setYtStatus('BAD YOUTUBE LINK'); setBusy(false); return; }
      }
      setYtStatus('STARTING YOUTUBE...');
      const playing = await audio.playYouTube?.();
      setToggle(playing ? 'PAUSE' : 'PLAY');
      setYtStatus(playing ? 'BUFFERING...' : 'PLAYER BLOCKED');
      if (playing) watchYtStart();
      else setBusy(false);
    } catch {
      setToggle('PLAY');
      setYtStatus('API ERR');
      setBusy(false);
    }
  });
  if (input) input.addEventListener('change', () => { if (input.value.trim()) localStorage.setItem('tc_youtube_playlist', input.value.trim()); });
  // v2.1.91: do not build the YouTube iframe on page load.
  // The iframe/API is initialized by LOAD/PLAY click so browser autoplay/origin warnings do not spam startup.
  setInterval(() => {
    const txt = String(status?.textContent || '');
    if (/LOADING|BUFFERING|STARTING/.test(txt) && audio.isYouTubeActive?.()) {
      setToggle('PAUSE');
      setYtStatus('PLAYING · INTERNAL AMBIENT MUTED');
      setBusy(false);
    }
  }, 900);
  if (saved) { setYtStatus('YOUTUBE SAVED · CLICK PLAY'); setToggle('PLAY'); }
}
bindYouTubeMusicUi();
onLangChange(() => {
  updateSkinPreview();
  updateHeroSelector();
  if (skinToggle) skinToggle.textContent = $('skin-editor')?.classList.contains('collapsed') ? t('changeSkin') : t('hideSkins');
  applyVisualFilter(false);
  setMenuVersion(net.connected ? true : null);
  refreshMenuStatusLanguage();
});

async function connect() {
  setStatusKey('connecting');
  try {
    await net.connect(WS_URL, playerName(), saveSkin());
    setStatusKey('online', 'ok');
    return true;
  } catch (e) {
    setStatusKey('down', 'err');
    return false;
  }
}

// SINGLE PLAYER: no network at all — works even with the server down
$('btn-solo').addEventListener('click', () => {
  uiClick('run_start');
  state.localMode = true;
  net.startSolo(playerName(), saveSkin());
});
$('btn-create').addEventListener('click', async () => {
  uiClick('run_start');
  $('btn-create').disabled = true;
  state.localMode = true;            // host = sim in this browser, zero latency
  net._name = playerName();
  net._skin = saveSkin();
  if (net.connected || await connect()) net.createRoom();
  $('btn-create').disabled = false;
});
$('btn-join').addEventListener('click', async () => {
  uiClick('run_start');
  const code = $('room-input').value.trim().toUpperCase();
  if (code.length !== 4) { setStatusKey('code4', 'err'); return; }
  $('btn-join').disabled = true;
  state.localMode = false;
  net._name = playerName();
  net._skin = saveSkin();
  if (net.connected || await connect()) net.joinRoom(code);
  $('btn-join').disabled = false;
});
$('room-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-join').click(); });
$('name-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-create').click(); });

// status probe (informational only — single-player never needs it)
fetch((isLocal ? `http://${location.hostname}:10777` : cfg.BACKEND_HTTP_URL) + '/health')
  .then(r => r.json())
  .then(h => {
    setMenuVersion(h);
    const serverProto = Number(h?.protocol ?? PROTOCOL);
    if (serverProto !== PROTOCOL) {
      setStatusKey('update', 'err');
      return;
    }
    setStatusKey('ready', 'ok');
  })
  .catch(() => { setMenuVersion(); setStatusKey('waking'); });

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
    if (f?.t === 'hero_unlock' && f.heroId) unlockHero(f.heroId, f.source || 'run');
    audio.handleFx(f, { myId: state.myId });
    effects.handleFx(f, { myId: state.myId, getMyPos: () => state.myRenderPos(0), state });
    hud.handleFx(f, state.myId, state);
  }
});
net.on('offer', (m) => hud.openInstall(m.choices, m.pending, m.offerId || m.id || 0, m.kind || '', m.expires || 0, m.total || 0));
net.on('offer_close', () => { if (!hud.install.skinOnly && !(hud.install.picked && state.room?.phase === 'install')) hud.closeInstall(); });
net.on('weapon_offer', (m) => hud.openWeaponChest(m.choices, m.meta));
net.on('weapon_offer_close', () => hud.closeWeaponChest());
net.on('ability_offer', (m) => hud.openAbilityChest(m.choices, m.meta));
net.on('ability_offer_close', () => hud.closeAbilityChest());
net.on('rare_offer', (m) => hud.openRareChest(m.choices, m.meta));
net.on('rare_offer_close', () => hud.closeRareChest());
net.on('casino_result', (m) => { if (m?.id === state.myId && !m?.payload?.decisionPending) handleCasinoSkinReward(m.payload || {}); hud.casinoResult(m, state.myId); });
net.on('casino_lock_result', (m) => hud.casinoLockResult(m, state.myId));
net.on('casino_skin_result', (m) => { if (m?.ok && m?.id === state.myId && m.skinId) handleSkinUnlock(m.skinId, 'casino'); hud.casinoSkinResult(m, state.myId); });
net.on('casino_prize_result', (m) => hud.casinoPrizeResult(m, state.myId));
net.on('error', (m) => { if (!inGame) setStatusKey(m.error === 'room not found' ? 'roomNotFound' : m.error === 'room full' ? 'roomFull' : 'error', 'err'); });
net.on('room_closed', () => location.reload());
net.on('_closed', () => {
  if (inGame) {
    $('menu').classList.remove('hidden');
    setStatusKey('lost', 'err');
    inGame = false;
  }
});


// ---------------------------------------------------------------- developer mode (single-player/host only)
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
  const roomArchLabels = {
    panic_box: 'PANIC BOX', compact: 'COMPACT', standard: 'STANDARD', wide: 'WIDE', long_lane: 'LONG LANE', lounge: 'LOUNGE', boss: 'BOSS',
    ripped_table: 'РАЗОРВАННЫЙ СТОЛ', cross_terminal: 'КРЕСТОВОЙ ТЕРМИНАЛ', ring_track: 'КОЛЬЦЕВОЙ ТРЕК',
    clamp_room: 'СЕКТОР-ЗАЖИМ', cashier_maze: 'ЛАБИРИНТ КАССЫ', machine_core: 'ЯДРО АВТОМАТА'
  };
  const archetypeOpts = ['', 'panic_box','compact','standard','wide','long_lane','ripped_table','cross_terminal','ring_track','clamp_room','cashier_maze','machine_core','lounge','boss'].map(v => `<option value="${v}">${v ? (roomArchLabels[v] || v.toUpperCase()) : 'AUTO'}</option>`).join('');
  const roomModOpts = Object.values(ROOM_MODS).map(m => `<label><input type="checkbox" value="${m.id}"> ${m.label}</label>`).join('');
  const bossRewardLabel = id => String(id || '').replace(/^sig_/, '').replace(/_/g, ' ').toUpperCase();
  const bossRewardOpts = BOSS_SIGNATURE_UPGRADE_IDS.map(id => `<option value="${id}">${bossRewardLabel(id)}</option>`).join('');
  const rActiveOpts = [
    ['sig_target_lock', 'TARGET LOCK'],
    ['sig_redline_boost', 'REDLINE BOOST'],
    ['sig_ghost_decoy', 'GHOST DECOY'],
    ['sig_rewind_mark', 'REWIND MARK'],
    ['sig_kill_switch', 'KILL SWITCH']
  ].map(([id, label]) => `<option value="${id}">${label}</option>`).join('');
  devPanel.innerHTML = `
    <div class="dev-title">DEV MODE <span>F2</span></div>
    <div class="dev-note">SINGLE PLAYER/HOST only · full test lab · F2</div>
    <div class="dev-buttons dev-priority">
      <button id="dev-open-portal">OPEN PORTAL NOW</button>
      <button id="dev-wpn-offer">ОРУЖЕЙНЫЙ ВЫБОР</button>
      <button id="dev-wpn-chest">ОРУЖЕЙНЫЙ СУНДУК</button>
      <button id="dev-luck-plus">LUCK +1</button>
      <button id="dev-sig-offer">BOSS SIG OFFER</button>
      <button id="dev-win-run">WIN RUN</button>
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

    <div class="dev-section-title">BOSS / SIGNATURE</div>
    <div class="dev-row"><label>BOSS</label><select id="dev-boss-kind"><option value="boss_croupier">CROUPIER</option><option value="boss_hunter_chorus">HNT</option><option value="boss_q_revisor">RUSH</option><option value="boss_anchor_cashier">ANCHOR+</option><option value="boss">BOS</option></select></div>
    <div class="dev-row"><label>REWARD</label><select id="dev-boss-reward">${bossRewardOpts}</select></div>
    <div class="dev-row"><label>R</label><select id="dev-r-active">${rActiveOpts}</select></div>
    <div class="dev-buttons dev-priority">
      <button id="dev-give-boss-reward">GIVE REWARD</button>
      <button id="dev-offer-boss-reward">OFFER SELECTED</button>
      <button id="dev-set-r-active">SET R ACTIVE</button>
      <button id="dev-r-ready">R READY</button>
    </div>
    <div class="dev-buttons">
      <button id="dev-aegis">AEGIS +45</button>
      <button id="dev-spawn-hold">SPAWN HOLD +1</button>
      <button id="dev-mirror">MIRROR +1</button>
      <button id="dev-revive">REVIVE +1</button>
      <button id="dev-boss-key">BOSS KEY +1</button>
      <button id="dev-wager-offer">WAGER OFFER</button>
      <button id="dev-wagers-on">WAGERS ON</button>
      <button id="dev-wagers-off">WAGERS OFF</button>
      <button id="dev-hidden-virus">HIDDEN VIRUS</button>
      <button id="dev-reset-kill-switch">RESET KILL FLAG</button>
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
      <button id="dev-heroes-open">UNLOCK HEROES</button>
      <button id="dev-heroes-lock">LOCK HEROES</button>
      <button id="dev-skins-open">UNLOCK SKINS</button>
      <button id="dev-skins-lock">LOCK SKINS</button>
      <button id="dev-god">GOD: OFF</button>
      <button id="dev-all-installs">ALL INSTALLS</button>
      <button id="dev-all-wpn-mods">ALL WPN MODS</button>
      <button id="dev-all-sigs">ALL SIGS</button>
      <button id="dev-spawn-boss">SPAWN BOSS</button>
      <button id="dev-final">FINAL DEPTH</button>
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
  devPanel.querySelector('#dev-wpn-chest')?.addEventListener('click', () => { cmd('spawn_weapon_chest'); hud.feed('DEV: SPAWN WPN CHEST', 'c'); });
  devPanel.querySelector('#dev-luck-plus')?.addEventListener('click', () => { cmd('luck_plus'); hud.feed('DEV: LUCK +1', 'c'); });
  devPanel.querySelector('#dev-sig-offer')?.addEventListener('click', () => { const kind = devPanel.querySelector('#dev-boss-kind')?.value || 'boss'; cmd('boss_signature_offer', { kind }); hud.feed('DEV: BOSS SIG OFFER', 'c'); });
  devPanel.querySelector('#dev-give-boss-reward')?.addEventListener('click', () => { const id = devPanel.querySelector('#dev-boss-reward')?.value || 'sig_target_lock'; cmd('give_boss_reward', { id }); hud.feed(`DEV: ${id.replace(/^sig_/, '').replace(/_/g, ' ').toUpperCase()}`, 'c'); });
  devPanel.querySelector('#dev-offer-boss-reward')?.addEventListener('click', () => { const id = devPanel.querySelector('#dev-boss-reward')?.value || 'sig_target_lock'; const kind = devPanel.querySelector('#dev-boss-kind')?.value || 'boss'; cmd('boss_signature_offer', { kind, force: [id] }); hud.feed('DEV: FORCED BOSS OFFER', 'c'); });
  devPanel.querySelector('#dev-set-r-active')?.addEventListener('click', () => { const id = devPanel.querySelector('#dev-r-active')?.value || 'sig_target_lock'; cmd('give_boss_reward', { id }); hud.feed(`DEV R: ${id.replace(/^sig_/, '').replace(/_/g, ' ').toUpperCase()}`, 'c'); });
  devPanel.querySelector('#dev-r-ready')?.addEventListener('click', () => { cmd('r_ready'); hud.feed('DEV: R READY', 'c'); });
  devPanel.querySelector('#dev-aegis')?.addEventListener('click', () => cmd('give_boss_reward', { id: 'sig_aegis_process' }));
  devPanel.querySelector('#dev-spawn-hold')?.addEventListener('click', () => cmd('give_boss_reward', { id: 'sig_spawn_hold' }));
  devPanel.querySelector('#dev-mirror')?.addEventListener('click', () => cmd('give_boss_reward', { id: 'sig_mirror_payout' }));
  devPanel.querySelector('#dev-revive')?.addEventListener('click', () => cmd('give_boss_reward', { id: 'sig_null_revival' }));
  devPanel.querySelector('#dev-boss-key')?.addEventListener('click', () => cmd('give_boss_reward', { id: 'sig_boss_key' }));
  devPanel.querySelector('#dev-wager-offer')?.addEventListener('click', () => { cmd('force_room_wager_offer'); hud.feed('DEV: WAGER OFFER', 'c'); });
  devPanel.querySelector('#dev-wagers-on')?.addEventListener('click', () => { cmd('unlock_room_wagers'); hud.feed('DEV: WAGERS ON', 'c'); });
  devPanel.querySelector('#dev-wagers-off')?.addEventListener('click', () => { cmd('lock_room_wagers'); hud.feed('DEV: WAGERS OFF', 'r'); });
  devPanel.querySelector('#dev-hidden-virus')?.addEventListener('click', () => { cmd('spawn_hidden_casino_virus'); hud.feed('DEV: HIDDEN VIRUS', 'p'); });
  devPanel.querySelector('#dev-reset-kill-switch')?.addEventListener('click', () => { cmd('reset_kill_switch_flag'); hud.feed('DEV: KILL SWITCH RESET', 'c'); });
  devPanel.querySelector('#dev-win-run')?.addEventListener('click', () => { cmd('win_run'); hud.feed('DEV: WIN RUN', 'c'); });
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
  devPanel.querySelector('#dev-all-installs')?.addEventListener('click', () => cmd('give_all_installs'));
  devPanel.querySelector('#dev-all-wpn-mods')?.addEventListener('click', () => cmd('give_all_weapon_mods'));
  devPanel.querySelector('#dev-all-sigs')?.addEventListener('click', () => cmd('give_all_signatures'));
  devPanel.querySelector('#dev-spawn-boss')?.addEventListener('click', () => { const kind = devPanel.querySelector('#dev-boss-kind')?.value || 'boss_croupier'; cmd('spawn_boss', { kind }); });
  devPanel.querySelector('#dev-final')?.addEventListener('click', () => cmd('set_final_room'));
  devPanel.querySelector('#dev-heroes-open')?.addEventListener('click', () => {
    writeUnlockedHeroes(new Set(Object.keys(HEROES))); updateHeroSelector(); hud.feed('DEV: ALL HEROES UNLOCKED', 'c');
  });
  devPanel.querySelector('#dev-heroes-lock')?.addEventListener('click', () => { lockAllHeroes(); hud.feed('DEV: HEROES LOCKED', 'r'); });
  devPanel.querySelector('#dev-skins-open')?.addEventListener('click', () => {
    const set = readUnlockedSkins(); for (const sk of SKIN_PRESETS) set.add(sk.id); writeUnlockedSkins(set); updateSkinPreview(); hud.feed('DEV: ALL SKINS UNLOCKED', 'c');
  });
  devPanel.querySelector('#dev-skins-lock')?.addEventListener('click', () => {
    writeUnlockedSkins(new Set(DEFAULT_UNLOCKED_SKINS)); selectedSkinId = firstUnlockedSkinId(); localStorage.setItem(skinSaveKey, selectedSkinId); skinIndex = Math.max(0, presetById(selectedSkinId)); updateSkinPreview(); applySkinTheme(selectedSkinId); hud.feed('DEV: SKINS LOCKED', 'r');
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
  if (!inGame) { audio.updateMusic({ menu: true }, dt * GAME_SPEED); return; }

  if (input.takeDevToggle()) toggleDevPanel();

  const me = state.me();
  const room = state.room;

  const modalOpen = hud.casino.open || hud.install.open || hud.weapon.open || hud.ability.open || hud.rare.open;
  document.body.classList.toggle('modal-open', !!modalOpen);
  input.blocked = modalOpen;

  if (input.takeEsc()) {
    if (hud.casino.open && !hud.casino.spinning) hud.closeCasino();
    else if (hud.install.open && !hud.install.waitingOnly) hud.pickRandomInstall();
    else if (hud.weapon.open) hud.pickRandomWeapon();
    else if (hud.ability.open) hud.pickRandomAbility();
    else if (hud.rare.open) hud.pickRandomRare();
    else if (input.tabOpen) input.tabOpen = false;
  }
  const num = input.takeNum();
  if (num >= 0) {
    if (hud.install.open && !hud.install.waitingOnly) hud.pick(num);
    else if (hud.weapon.open) hud.pickWeapon(num);
    else if (hud.ability.open) hud.pickAbility(num);
    else if (hud.rare.open) hud.pickRare(num);
    else if (hud.casino.open && !hud.casino.spinning) hud.placeBet(['low', 'mid', 'high'][num]);
  }
  if (hud.install.open && !hud.install.skinOnly && me && me[P.PEND] === 0 && room && room.phase !== 'install') hud.closeInstall();
  if (room && room.phase === 'play' && hud.install.open && !hud.install.skinOnly) hud.closeInstall();
  // WPN/ABL/RAR choice windows are authoritative server offers. Do not close them just
  // because the room phase changed: valuable 5-slot chests may need a second pick after
  // the first selection. They close via *_offer_close or on actual room transition fx.

  const mv = input.moveVec();
  const aim = renderer.screenToWorld(input.mouseX, input.mouseY);
  const sendNow = now - lastSend >= 16; // guest inputs also send at frame cadence for less floaty control
  if (sendNow) {
    const sdt = Math.min(0.05, (now - (lastSend || now - 16)) / 1000) * GAME_SPEED;
    lastSend = now;
    const dash = input.takeDash();
    const inter = input.takeInter();
    const active = input.takeActive();
    const ractive = input.takeRActive();
    const secondary = input.takeSecondary();
    const livingCasinoActive = me?.[P.LVC]?.hero === 'living_casino';
    const rawWeapon = input.takeWeapon(me ? me[P.WEAPONS].length : 1);
    const wpn = livingCasinoActive ? -1 : rawWeapon;
    const pkt = state.applyLocalInput(mv, aim, input.fire && !modalOpen, dash && !modalOpen, inter && !modalOpen, active && !modalOpen, wpn, sdt, secondary && !modalOpen, ractive && !modalOpen);
    net.sendInput(pkt);
  }

  effects.update(dt, state);
  const myPos = state.myRenderPos(dt);
  const view = state.interp();
  const cameraPos = state.cameraRenderPos(view, myPos);
  renderer.draw(state, effects, view, myPos, { x: input.mouseX, y: input.mouseY }, now / 1000, cameraPos);
  hud.update(state, dt * GAME_SPEED);
  audio.updateMusic(state, dt * GAME_SPEED);
  hud.setInspect(input.inspectMode);
  hud.setWorldHover(state, input, renderer);
  hud.setTab(input.tabOpen, state);
}
requestAnimationFrame(frame);

// v2.1.80 — compact in-game YouTube controls in top-left HUD.
function bindYouTubeMiniControlsV2180() {
  const box = $('yt-mini-controls');
  const prev = $('yt-prev');
  const next = $('yt-next');
  const pp = $('yt-playpause');
  const minus = $('yt-vol-down');
  const plus = $('yt-vol-up');
  const bit = $('yt-bit');
  const label = $('yt-vol-label');
  if (!box) return;
  const update = () => {
    const active = !!audio.isYouTubeActive?.();
    const hasPlaylist = !!(localStorage.getItem('tc_youtube_playlist') || audio.ytMusic?.playlist || '').trim();
    box.classList.toggle('hidden', !hasPlaylist && !active);
    if (pp) pp.textContent = active ? 'PAUSE' : 'PLAY';
    const vol = Math.round(audio.youTubeVolume?.() ?? Math.min(100, (audio.musicVolume || 0.7) * 200));
    if (label) label.textContent = `YT ${vol}`;
    const video8Bit = !!audio.getYouTube8BitMask?.();
    if (bit) bit.classList.toggle('on', video8Bit);
    document.documentElement.classList.toggle('yt-video-8bit', video8Bit);
    $('youtube-music')?.classList.toggle('yt-video-8bit', video8Bit);
    $('youtube-player-wrap')?.classList.toggle('yt-video-8bit', video8Bit);
  };
  const blockGameClick = e => {
    e.stopPropagation();
    if (e.type === 'pointerdown' || e.type === 'mousedown') input.fire = false;
    e.target?.closest?.('button')?.blur?.();
  };
  ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'].forEach(type => {
    box.addEventListener(type, blockGameClick);
  });
  prev?.addEventListener('click', () => { uiClick('ui_click'); audio.youTubePrev?.(); update(); });
  next?.addEventListener('click', () => { uiClick('ui_click'); audio.youTubeNext?.(); update(); });
  pp?.addEventListener('click', async () => {
    uiClick('ui_click');
    if (audio.isYouTubeActive?.()) audio.pauseYouTube?.();
    else await audio.playYouTube?.();
    update();
  });
  minus?.addEventListener('click', () => { uiClick('ui_click'); audio.youTubeVolumeDelta?.(-10); update(); });
  plus?.addEventListener('click', () => { uiClick('ui_click'); audio.youTubeVolumeDelta?.(10); update(); });
  bit?.addEventListener('click', () => { uiClick('ui_click'); audio.setYouTube8BitMask?.(!audio.getYouTube8BitMask?.()); update(); });
  setInterval(update, 850);
  update();
}
bindYouTubeMiniControlsV2180();
