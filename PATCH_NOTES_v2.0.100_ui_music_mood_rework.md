# PATCH NOTES v2.1 — UI/music mood rework

## UI / text
- Static Storm explanations now say “danger areas / области” instead of squares.
- English menu subtitle is now fixed to `4 players coop` to reduce language-switch layout jumps.
- Main menu layout is top-stabilized so changing language does not recenter the whole menu.
- Room modifier chips wrap onto their own stable top-left line so multiple modifiers do not collide with the language/version row.
- Audio sliders receive a final thin square terminal-green override:
  - no thick track;
  - no glow;
  - no native right-side green artifact;
  - terminal green track/thumb.
- Skin switcher visuals simplified to match the slider terminal-green style: no glow-heavy arrows.
- Skin claim/all-owned card now plays a UI sound when clicked.
- Menu language buttons now also emit a UI click sound.

## Music
- Music mood system rebuilt around explicit states:
  - menu;
  - rest/chill;
  - combat;
  - chaos;
  - static;
  - casino;
  - boss;
  - portal;
  - objective resolve.
- Bass/sub/pulse layers are pushed further into the background.
- Melody phrases are the main audible layer.
- Added event signatures for:
  - menu → game transition;
  - portal open;
  - objective completion / room invoice;
  - contract done;
  - boss down;
  - skin unlock.
- Melodic instruments are chosen by mood:
  - menu/rest: sine + triangle, sparse;
  - combat: triangle lead with lower answer phrase;
  - chaos/boss chaos: filtered saw/triangle, faster but still dark;
  - portal/resolve: more open, mournful transition phrases;
  - static/casino: altered intervals while staying in one dark tonal theme.

## Checks
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- import check: sim / i18n / hud / audio
