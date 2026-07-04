# v2.1.66 — Dark Heaven / Hell Techno Mood Pass

## Music
- Kept the v2.1.65 procedural techno machine, but rewrote the mood layer.
- Slowed down calm/menu/float states so empty rooms no longer feel like happy arcade techno.
- Replaced brighter note pools with darker minor, half-step and tritone-heavy patterns.
- Lowered casino blips so they read as terminal/casino ticks instead of cheerful melodies.
- Added a clear heaven/hell split:
  - portal/clear states use slow soft high chords and sparse clean pulse;
  - boss/static/low HP states use lower roots, dirtier stabs and controlled hell scrapes.
- Reduced bright hats and acid motion in slow states.
- Boss, static storm and combat keep impact, but are slower, heavier and more ominous.
- Low rumble remains reactive, not a constant drone.

## Technical
- Added v2.1.66 final `updateMusic` override for the active procedural techno engine.
- Added `TM66_SEQ` state patterns and two extra procedural color events: `tm66SoftChord` and `tm66HellScrape`.
- Updated game version to v2.1.66.
