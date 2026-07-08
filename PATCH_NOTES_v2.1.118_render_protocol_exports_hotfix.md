# PATCH NOTES v2.1.118 — Render protocol exports hotfix

## Fix

- Restored the full `shared/protocol.v2-1.js` export surface after the v2.1.117 build accidentally kept only `VERSION` and `BUILD_ID`.
- Fixed Render/server startup crash: `server/index.js` can import `PROTOCOL`, `MAX_PLAYERS`, `MAX_MESSAGE_BYTES`, `RATE_LIMIT_PER_WINDOW`, and `RATE_WINDOW_MS` again.
- Restored client-side protocol constants used by local/network play: `S`, `C`, `SIM_HZ`, `SNAPSHOT_HZ`, and `GAME_SPEED`.
- Updated `package.json` version to `2.1.118` so deployment logs match the archive.

## Verification

- `node --check` over all JS files passes.
- `npm start` boots the signaling server and `/health` returns JSON instead of crashing during module import.
