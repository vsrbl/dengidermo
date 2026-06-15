// nncckkrr protocol + version constants (single source of truth)
export const VERSION = 'v2.0.10';
export const BUILD_ID = 'v2.0.10-20260615';
export const PROTOCOL = 2;

export const MAX_PLAYERS = 4;
export const SIM_HZ = 60;
export const SNAPSHOT_HZ = 20;
export const GAME_SPEED = 2; // global sim/prediction tempo multiplier
export const MAX_MESSAGE_BYTES = 64 * 1024;
export const RATE_LIMIT_PER_WINDOW = 300;
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
