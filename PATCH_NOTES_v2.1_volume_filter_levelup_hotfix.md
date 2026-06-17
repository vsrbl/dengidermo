# Terminal Casino Roguelike 2.1 — volume/filter/level-up hotfix

## Audio
- Doubled the music gain ceiling: the MUSIC slider now reaches 2x the previous maximum output.
- Added a dedicated warm low-mid `levelup` SFX, avoiding sharp high notes.

## Visual filters
- Strengthened the existing JPEG preset.
- Added `JPEG+`: heavier SVG displacement / color quantization / block compression look.
- Added `GLITCH`: heavier displacement + unstable terminal buffer look.
- Filter presets still cycle with the `FILTER` button or F7 and remain saved in localStorage.

## Level-up feedback
- Level-up now has a stronger terminal-style screen animation with a cyan frame, sweep bars, and a level label.
