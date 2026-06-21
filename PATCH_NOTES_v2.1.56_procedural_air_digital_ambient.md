# v2.1.56 — procedural air digital ambient

## Changed
- Replaced external licensed music streaming with a new procedural WebAudio score: `air_digital_ambient_v2156`.
- Disabled external music playback during the active procedural score.
- Removed the breakcore/click-rain direction from the active soundtrack.
- Built the score from slow evolving sine/triangle pads, soft data pulses, low-noise air beds, and sparse melodic motifs.
- Added separate music states: menu, float, clear, combat, storm, boss.
- Reduced constant low-end hum with a higher music high-pass filter.
- Reduced harsh headphone highs with a music low-pass filter and no high-Q 8–10 kHz events.
- All notes/noise grains use soft attack/release ramps to avoid clicks.
- Music slider preview remains in the SFX/UI pool, so global SFX volume affects it.

## Notes
- The soundtrack is procedural again, but intentionally ambient: fewer events, more space, no dense percussion layer.
- Music now reacts to enemies, bullets, danger, boss state, static/casino modifiers, low HP, portal/resolve events.

## Checks
- `node --check src/audio.v2-1.js`
- `node --check src/main.v2-1.js`
- `node --check shared/sim.v2-1.js`
- import smoke tests
- `unzip -t`
