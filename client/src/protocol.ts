export type InputMessage = {
  t: 'input';
  seq: number;
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

export type PlayerSnapshot = {
  id: string;
  name: string;
  x: number;
  y: number;
  seq: number;
};

export type WelcomeMessage = {
  t: 'welcome';
  id: string;
  tickRate: number;
  snapshotRate: number;
  serverTick: number;
  map: string[];
};

export type SnapshotMessage = {
  t: 'snapshot';
  tick: number;
  players: PlayerSnapshot[];
};

export type InfoMessage = {
  t: 'info';
  text: string;
};

export type PongMessage = {
  t: 'pong';
  clientTime: number;
  serverTime: number;
};

export type ServerMessage = WelcomeMessage | SnapshotMessage | InfoMessage | PongMessage;

export function parseServerMessage(raw: unknown): ServerMessage | null {
  if (!isRecord(raw) || typeof raw.t !== 'string') return null;

  if (raw.t === 'welcome') {
    if (
      typeof raw.id !== 'string' ||
      typeof raw.tickRate !== 'number' ||
      typeof raw.snapshotRate !== 'number' ||
      typeof raw.serverTick !== 'number' ||
      !Array.isArray(raw.map) ||
      !raw.map.every((row) => typeof row === 'string')
    ) {
      return null;
    }

    return {
      t: 'welcome',
      id: raw.id,
      tickRate: raw.tickRate,
      snapshotRate: raw.snapshotRate,
      serverTick: raw.serverTick,
      map: raw.map,
    };
  }

  if (raw.t === 'snapshot') {
    if (typeof raw.tick !== 'number' || !Array.isArray(raw.players)) return null;
    const players = raw.players.map(parsePlayer).filter((p) => p !== null);
    return { t: 'snapshot', tick: raw.tick, players };
  }

  if (raw.t === 'info') {
    if (typeof raw.text !== 'string') return null;
    return { t: 'info', text: raw.text };
  }

  if (raw.t === 'pong') {
    if (typeof raw.clientTime !== 'number' || typeof raw.serverTime !== 'number') return null;
    return { t: 'pong', clientTime: raw.clientTime, serverTime: raw.serverTime };
  }

  return null;
}

function parsePlayer(value: unknown): PlayerSnapshot | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.x !== 'number' ||
    typeof value.y !== 'number' ||
    typeof value.seq !== 'number'
  ) {
    return null;
  }

  return { id: value.id, name: value.name, x: value.x, y: value.y, seq: value.seq };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
