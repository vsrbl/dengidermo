// nncckkrr protocol + version constants (single source of truth)
export const VERSION = 'v1.0.0';
export const BUILD_ID = 'v1.0.0-20260611';
export const PROTOCOL = 1;

export const MAX_PLAYERS = 4;
export const SIM_HZ = 30;
export const SNAPSHOT_HZ = 15;
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const RATE_LIMIT_PER_WINDOW = 90;
export const RATE_WINDOW_MS = 1000;

// client -> server
export const C = {
  HELLO: 'hello',
  CREATE: 'create',
  JOIN: 'join',
  INPUT: 'input',
  CASINO: 'casino',
  PICK: 'pick',       // upgrade pick {choiceIdx}
  PING: 'ping',
  LEAVE: 'leave'
};

// server -> client
export const S = {
  WELCOME: 'welcome',
  STATE: 'state',
  EVENTS: 'events',
  OFFER: 'offer',     // upgrade choices
  ERROR: 'error',
  PONG: 'pong',
  ROOM_CLOSED: 'room_closed'
};
