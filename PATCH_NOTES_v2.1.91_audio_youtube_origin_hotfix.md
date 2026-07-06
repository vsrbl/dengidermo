# PATCH NOTES v2.1.91 — Audio / YouTube origin hotfix

Date: 2026-07-06
Base: v2.1.90

## Fixes

- WebAudio no longer creates or resumes `AudioContext` from the frame loop before the player clicks/presses a key.
- `AudioContext` unlock is now gated behind a real user gesture, preventing browser startup warnings like `AudioContext was not allowed to start`.
- YouTube iframe API initialization is deferred until the player clicks LOAD/PLAY instead of running automatically on page load.
- YouTube player commands now wait for the official `onReady` event before `cuePlaylist`, `loadPlaylist`, `setVolume`, next/prev, or play commands are sent.
- YouTube iframe player is created with a stable site origin via `window.location.origin` and `widget_referrer`.
- Saved playlist still appears in the UI, but the iframe is not built until the player interacts.
- Bumped cache query and protocol version to `v2.1.91`.

## Notes

- This does not add real DSP over YouTube audio; YouTube iframe audio is still cross-origin and cannot be routed through the game's WebAudio graph.
