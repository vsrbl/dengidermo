# v2.1.55 — music stream fix + slider loudness

## Changed
- Fixed the likely reason music was silent in v2.1.54: removed `crossOrigin=anonymous` from plain HTMLAudio music playback.
- Corrected the Fireflies file URL to `fireflies_all_over_the_sky.wav`.
- Music now tries local files first, then falls back to OpenGameArt direct URLs.
- Raised licensed track base volumes so music is easier to hear.
- Raised menu slider click preview volume significantly.
- Slider click remains routed through SFX/UI gain, so lowering SFX still lowers the slider tick.
- Kept procedural music disabled to avoid high-frequency clicking/hum.

## Checks
- JS syntax check.
- Shared protocol import smoke test.
- Zip integrity test.
