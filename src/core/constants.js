export const VERSION = "v39.3.35";
export const BUILD_ID = "v39.3.35-20260525";
export const RELEASE_CHANNEL = "prod";
export const SIGNALING_PROTOCOL_VERSION = 2;
export const SERVER_HELLO_TIMEOUT_MS = 900;
export const MAX_PLAYERS = 4;
export const WORLD = { w: 2400, h: 1600 };
export const VIEW = { w: 1600, h: 675 };
export const CENTER = { x: WORLD.w / 2, y: WORLD.h / 2 };
export const GAME_SPEED = 2;
export const PLAYER_RADIUS = 13;
export const PLAYER_SPEED = 270;
export const PLAYER_ACCEL = 18;
export const PLAYER_FRICTION = 13;
export const PLAYER_HP = 100;
export const SNAPSHOT_RATE_P2P = 40;
export const SNAPSHOT_RATE_RELAY = 15;
export const SNAPSHOT_RATE = SNAPSHOT_RATE_P2P;
export const RELAY_MESSAGE_HARD_LIMIT_BYTES = 64 * 1024;
export const SNAPSHOT_RELAY_TARGET_BYTES = 44 * 1024;
export const SNAPSHOT_RELAY_STATE_LIMIT_BYTES = 52 * 1024;
export const HOST_SIM_RATE = 60;
export const HOST_SIM_FIXED_DT = GAME_SPEED / HOST_SIM_RATE;
export const HOST_SIM_MAX_CATCHUP_STEPS = 5;
export const HOST_SIM_MAX_FRAME_SECONDS = 0.25;
export const HOST_SIM_THROTTLE_WARN_MS = 250;
export const INPUT_RATE = 60;
export const PING_RATE_MS = 1000;
export const CONNECT_TIMEOUT_MS = 30000;
export const DASH_DENIAL_RECONCILE_MS = 700;
export const UPGRADE_HIDE_MS = 170;
export const UPGRADE_RESEND_MS = 900;
export const UPGRADE_TIMEOUT_MS = 8000;
export const GREEN = "#00ff66";
export const RED = "#ff3048";
export const SPAWN_OFFSETS = [
  { x: -34, y: -26 },
  { x: 34, y: -26 },
  { x: -34, y: 26 },
  { x: 34, y: 26 }
];
