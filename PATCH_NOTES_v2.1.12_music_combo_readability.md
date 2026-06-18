# PATCH NOTES — v2.1.12_music_combo_readability

## Summary
This patch softens the early-room music pacing and simplifies the new COMBO readout.
The goal is to keep the expanded musical variety from v2.1.6–v2.1.8, but stop early rooms from feeling too bright, fast, or intrusive. It also makes COMBO easier to read by reducing the HUD widget to the core information: multiplier, timer bar, and hit count.

## Player-facing changes

### Music
- Early loops now use a softer music profile:
  - longer phrase gaps;
  - lower drive/pulse layers;
  - fewer high notes;
  - less needle/noise pressure;
  - slower phrase movement outside boss rooms.
- Menu music remains close to the previous feel.
- Boss music still has a recognizable theme, but the general music director no longer opens regular early rooms with overly bright/fast material.
- The variety system remains: room mood, casino/static/boss/portal/resolve states still select different motifs and layers.

### COMBO HUD
- COMBO display is simpler and less noisy:
  - removed the always-visible recent-method list;
  - removed the visible seconds text;
  - kept only `КОМБО / COMBO`, multiplier, timer bar, and count.
- COMBO HUD moved away from the bottom-center area.
- New location: left-middle side of the screen on desktop, with a compact fallback near bottom-left on smaller screens.
- Added a dedicated terminal-style filter to the COMBO element:
  - scanline overlay;
  - low-contrast frame;
  - subtle color-channel text shadow;
  - reduced glow and saturation.
- Detailed COMBO explanation still exists on hover, but the combat display stays minimal.

## Implementation notes

### Files changed
- `shared/protocol.v2-1.js`
  - `VERSION = 'v2.1.12'`
  - `BUILD_ID = 'music-combo-readability'`
- `package.json`
  - version updated to `2.1.12`
- `index.html` / `404.html`
  - version text and cache query strings updated to `2.1.12`
- `src/audio.v2-1.js`
  - appended v2.1.12 music overrides for `ensureMusic`, `playDirgePhrase`, and `updateMusic`
  - added early-loop restraint via `earlyHold`
  - reduced non-boss intensity on early loops
  - made early phrase spacing longer
  - reduced early drive/high/needle layer activity
- `src/hud.v2-1.js`
  - simplified `renderComboHud`
  - shortened combo hover explanation
- `style.css`
  - replaced v2.1.10 bottom-center combo styling with v2.1.12 compact side styling
  - added combo-specific visual filtering and scanline treatment

## Design rule
- Music should be able to be loud, varied, and stylistic, but early rooms should not feel like they start at full boss-level brightness or speed.
- COMBO should read as a small terminal counter, not a full information panel.
- No labels should be drawn around enemies for combo.

## QA checklist
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- Import checks:
  - `import('./src/audio.v2-1.js')`
  - `import('./src/hud.v2-1.js')`
  - `import('./shared/sim.v2-1.js')`
- `unzip -t terminal_casino_roguelike_2.1.12_music_combo_readability.zip`

## Follow-up risks
- COMBO left-middle placement should be checked in real play. If it still distracts, next option is a small top-left-under-feed placement or a near-crosshair tiny multiplier only.
- Early music is intentionally calmer now. Later loops and boss should still feel more active; tune `earlyHold`, phrase spacing, and layer volumes if the contrast is too strong or too weak.
