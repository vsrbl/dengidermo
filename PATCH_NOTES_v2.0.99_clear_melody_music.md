# PATCH NOTES v2.0.99 — clear melody music

Audio-only/music patch based on v2.0.98 music branch plus v2.0.97 menu/slider stability.

## Music
- Bass/sub/pulse layers pushed much further into the background.
- Music master raised slightly, but low-frequency layers reduced so melody sits in front.
- Added clearer procedural melodic phrases:
  - main lead phrase;
  - lower answer/counter-phrase;
  - occasional high lament line under danger/damage/crowd pressure.
- Added separate motif pools for menu/chill, normal, static-like, casino, and boss rooms.
- Kept one dark tonal center so the melodies stay in one theme and do not fight the bass.
- Removed the “bass as main loop” feel: bass now appears only as a rare shadow/accent.

## Checks
- node --check server/index.js
- node --check shared/*.js
- node --check src/*.js
- import checks for sim/i18n/hud/audio
- zip -T archive integrity
