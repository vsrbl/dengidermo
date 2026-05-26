import { VERSION } from '../core/constants.js';

const DEFAULT_ROOM = 'nn_arena';

function normalizeEndpoint(endpoint) {
  const raw = String(endpoint || window.NN_COLYSEUS_URL || window.NN_SIGNALING_URL || '').trim();
  if (!raw) return '';
  return raw.replace(/\/$/, '');
}

export function hasColyseusSdk(globalObj = window) {
  return !!(globalObj?.Colyseus?.Client);
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
  if (!hasColyseusSdk(globalObj)) {
    throw new Error('Colyseus SDK is not loaded. Add @colyseus/sdk or expose window.Colyseus.Client before enabling net2.');
  }
  const endpoint = normalizeEndpoint(options.endpoint);
  if (!endpoint) throw new Error('Missing Colyseus endpoint');

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
