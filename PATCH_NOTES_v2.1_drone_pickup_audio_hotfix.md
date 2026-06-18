# Terminal Casino Roguelike 2.1 — Drone / Pickup Audio Hotfix

## Audio
- Softened the ambient drone bed so it no longer swells in with an unpleasant delayed feel.
- Changed the drone bed oscillator from a brighter layer to a quieter low sine bed.
- Reduced drone/sub/pulse/scrape layer levels and shortened their smoothing time so the room tone responds faster without a late tail.
- Reworked GLD/EXP/HEA/generic pickup sounds into neutral dry terminal ticks.
- Removed toy-like pickup melodies and bright coin-style motion.

## Validation
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- ESM import smoke checks for sim/i18n/hud/audio
- `zip -T`
