export type ClientInputMessage = {
  t: 'input';
  seq: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type ClientHelloMessage = {
  t: 'hello';
  name?: string;
};

export type ClientPingMessage = {
  t: 'ping';
  clientTime: number;
};

export type ClientMessage = ClientHelloMessage | ClientInputMessage | ClientPingMessage;

export type PlayerSnapshot = {
  id: string;
  name: string;
  x: number;
  y: number;
  seq: number;
};

export type ServerWelcomeMessage = {
  t: 'welcome';
  id: string;
  tickRate: number;
  snapshotRate: number;
  serverTick: number;
  map: string[];
};

export type ServerSnapshotMessage = {
  t: 'snapshot';
  tick: number;
  players: PlayerSnapshot[];
};

export type ServerInfoMessage = {
  t: 'info';
  text: string;
};

export type ServerPongMessage = {
  t: 'pong';
  clientTime: number;
  serverTime: number;
};

export type ServerMessage =
  | ServerWelcomeMessage
  | ServerSnapshotMessage
  | ServerInfoMessage
  | ServerPongMessage;

export const MAX_NAME_LENGTH = 14;

export function parseClientMessage(raw: unknown): ClientMessage | null {
  if (!isRecord(raw) || typeof raw.t !== 'string') {
    return null;
  }

  if (raw.t === 'hello') {
    const name = typeof raw.name === 'string' ? cleanName(raw.name) : undefined;
    return name === undefined ? { t: 'hello' } : { t: 'hello', name };
  }

  if (raw.t === 'ping') {
    if (!isFiniteNumber(raw.clientTime)) return null;
    return { t: 'ping', clientTime: raw.clientTime };
  }

  if (raw.t === 'input') {
    if (!isSafeInteger(raw.seq)) return null;
    return {
      t: 'input',
      seq: raw.seq,
      up: raw.up === true,
      down: raw.down === true,
      left: raw.left === true,
      right: raw.right === true,
    };
  }

  return null;
}

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

function cleanName(value: string): string | undefined {
  const cleaned = value.replace(/[^a-zA-Z0-9_ -]/g, '').trim().slice(0, MAX_NAME_LENGTH);
  return cleaned.length > 0 ? cleaned : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
