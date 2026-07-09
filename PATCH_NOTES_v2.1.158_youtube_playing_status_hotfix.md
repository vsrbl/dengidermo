# v2.1.158 — YouTube playing status hotfix

- Fixed YouTube UI staying on `LOADING...` after the iframe has already started audible playback.
- Added `syncYouTubeState()` polling around the official iframe `getPlayerState()` result.
- `PLAYING` now immediately clears loading, sets the main toggle to `PAUSE`, and shows `PLAYING · INTERNAL AMBIENT MUTED`.
- `BUFFERING`, `PAUSED`, `CUED`, and `ENDED` now clear/set loading consistently so the status cannot get stuck after the player state changes.
- The menu YouTube controls now keep polling for a few seconds after `PLAY`, then passively correct stale `LOADING/BUFFERING/STARTING` labels if playback becomes active later.

Verification:
- JS syntax check passed.
- ESM imports passed.
- YouTube state stub: `PLAYING` changes loading=false and active=true.
- `/health` returns `v2.1.158`.
- Archive integrity check passed.
