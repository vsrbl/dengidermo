import { VERSION } from '../core/constants.js';

const DEFAULT_ROOM = 'nn_arena';

function normalizeEndpoint(endpoint) {
  const raw = String(endpoint || window.NN_COLYSEUS_URL || window.NN_SIGNALING_URL || '').trim();
  if (!raw) return '';
  return raw.replace(/\/$/, '');
}

function sdkVersionQuery() {
  return VERSION.replace(/^v/, '');
}

function unique(list) {
  return Array.from(new Set(list.filter(Boolean)));
}

function sdkCandidates(endpoint) {
  const version = sdkVersionQuery();
  const candidates = [`./vendor/colyseus.js?v=${version}`];
  try {
    if (endpoint) candidates.push(new URL(`/vendor/colyseus.js?v=${version}`, endpoint).toString());
  } catch {}
  return unique(candidates);
}

function loadBrowserScript(globalObj, src) {
  const doc = globalObj?.document || (typeof document !== 'undefined' ? document : null);
  if (!doc?.createElement) return Promise.reject(new Error('document is not available'));
  return new Promise((resolve, reject) => {
    const existing = Array.from(doc.querySelectorAll('script[data-nn-colyseus-sdk]')).find((node) => node.getAttribute('src') === src);
    if (existing?.dataset?.loaded === 'true') {
      resolve();
      return;
    }
    const script = existing || doc.createElement('script');
    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
    const onLoad = () => {
      cleanup();
      script.dataset.loaded = 'true';
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error(`failed to load ${src}`));
    };
    script.dataset.nnColyseusSdk = 'true';
    script.async = true;
    script.src = src;
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    if (!existing) (doc.head || doc.documentElement).appendChild(script);
  });
}

export function hasColyseusSdk(globalObj = window) {
  // Keep the browser SDK injection contract explicit: window.Colyseus.Client is the expected UMD global.
  return !!(globalObj?.Colyseus?.Client);
}

export async function ensureColyseusSdk(globalObj = window, endpoint = '') {
  if (hasColyseusSdk(globalObj)) return true;
  let lastError = null;
  for (const src of sdkCandidates(endpoint)) {
    try {
      await loadBrowserScript(globalObj, src);
      if (hasColyseusSdk(globalObj)) return true;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Colyseus SDK is not loaded after vendor fallback (${lastError?.message || 'unknown error'})`);
}

export function initialColyseusClientState(endpoint) {
  return {
    enabled: false,
    status: 'idle',
    endpoint: normalizeEndpoint(endpoint),
    roomName: DEFAULT_ROOM,
    roomId: '',
    playerId: '',
    lastAckSeq: 0,
    lastReject: null,
    error: null,
    version: VERSION
  };
}

export async function connectColyseusArena(options = {}) {
  const globalObj = options.globalObj || window;
  const endpoint = normalizeEndpoint(options.endpoint);
  if (!endpoint) throw new Error('Missing Colyseus endpoint');
  await ensureColyseusSdk(globalObj, endpoint);

  const client = new globalObj.Colyseus.Client(endpoint);
  const room = await client.joinOrCreate(options.roomName || DEFAULT_ROOM, {
    playerId: options.playerId,
    name: options.name || '',
    clientVersion: VERSION
  });

  const state = initialColyseusClientState(endpoint);
  state.enabled = true;
  state.status = 'joined';
  state.roomName = room.name || options.roomName || DEFAULT_ROOM;
  state.roomId = room.id || '';

  room.onMessage('joined', (payload) => {
    state.playerId = payload?.playerId || state.playerId;
    state.roomId = payload?.roomId || state.roomId;
  });
  room.onMessage('inputAck', (payload) => {
    state.lastAckSeq = Number(payload?.seq || state.lastAckSeq || 0);
  });
  room.onMessage('inputReject', (payload) => {
    state.lastReject = payload || null;
  });
  room.onLeave((code) => {
    state.status = 'left';
    state.leaveCode = code;
  });
  room.onError((code, message) => {
    state.status = 'error';
    state.error = `${code}: ${message}`;
  });

  return { client, room, state };
}

export function sendColyseusInput(room, input) {
  if (!room) return false;
  room.send('input', input);
  return true;
}
