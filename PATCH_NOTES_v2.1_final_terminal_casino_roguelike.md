# Terminal Casino Roguelike 2.1 — final pass

## Identity
- Player-facing name changed to **Terminal Casino Roguelike**.
- Player-facing version changed to **2.1**.
- Runtime module files renamed to `v2-1`.

## Visual layer
- Added a light optimized global digital degradation pass:
  - subtle scanlines,
  - tiny pixel/noise grid,
  - mild contrast/saturation shift on the canvas,
  - pointer-events none and pure CSS, no per-frame JS work.

## Menu / skins
- Skin arrows are explicitly visible and simplified in the terminal-green style.
- Menu/logo sizing kept stable.

## Text cleanup
- Static Storm descriptions refer to dangerous/field **areas**, not squares.
- Menu subtitle uses `4 players coop`.

## Music rewrite
- High melodic stabs removed from the music layer; gameplay SFX owns the high-frequency range.
- Music is rebuilt around low/mid-low instruments:
  - bass-clarinet-like square/triangle lead,
  - cello-like filtered saw body,
  - low reed/organ triangle answer phrases,
  - very quiet sub and pulse only as floor texture.
- Authored melancholy motif families for menu/rest/combat/chaos/static/casino/boss/portal/resolve.
- Melodies are now repeated with controlled variations instead of random melodic jumps.
- Portal/open/objective events trigger low melodic signatures, not bright stingers.

## Checks
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- import checks: sim, audio, hud, i18n
- `zip -T`
