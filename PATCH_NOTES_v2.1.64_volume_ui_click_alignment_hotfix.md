# v2.1.64 — Volume UI Click Alignment Hotfix

## Changed
- Replaced the custom volume slider preview sound with the same dry `ui_click` sound used by normal UI buttons.
- Removed the slider-only body/noise transient that made the sound feel like a separate popping/farting cue.
- Kept the preview routed through the normal SFX/UI pool, so SFX volume still controls it.
- Added a modest drag throttle so holding a volume control does not chatter constantly.

## Checks
- `node --check src/audio.v2-1.js`
- `node --check src/main.v2-1.js`
- `node --check src/hud.v2-1.js`
- `node --check shared/sim.v2-1.js`
- protocol import smoke test
- CSS brace balance
- `unzip -t`
