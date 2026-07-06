// terminal casino roguelike protocol + version constants (single source of truth)
export const VERSION = 'v2.1.81';
export const BUILD_ID = 'casino_lock_8bit_hud_hotfix';
export const PROTOCOL = 5;

export const MAX_PLAYERS = 4;
export const SIM_HZ = 60;
export const SNAPSHOT_HZ = 30; // guest snapshots: 30Hz reduces remote/camera float without full 60Hz bandwidth
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
  PICK: 'pick',       // INSTALL pick {choiceIdx}
  WEAPON_PICK: 'weapon_pick', // WPN chest pick {choiceIdx}
  ABILITY_PICK: 'ability_pick', // ABL chest pick {choiceIdx}
  REROLL_OFFER: 'reroll_offer',
  ROOM_WAGER: 'room_wager', // contract favor reroll {kind}
  PING: 'ping',
  LEAVE: 'leave'
};

// server -> client
export const S = {
  WELCOME: 'welcome',
  STATE: 'state',
  EVENTS: 'events',
  OFFER: 'offer',     // INSTALL choices
  WEAPON_OFFER: 'weapon_offer',
  ABILITY_OFFER: 'ability_offer',
  ERROR: 'error',
  PONG: 'pong',
  ROOM_CLOSED: 'room_closed'
};
