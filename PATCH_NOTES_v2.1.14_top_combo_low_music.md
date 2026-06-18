# PATCH NOTES v2.1.14 — top combo + low music

**Base:** `v2.1.13_lowered_high_notes_music`  
**Patch type:** UI readability + music register hotfix  
**Goal:** make the combo counter readable and correctly positioned, and push remaining intrusive high musical content down into the low / low-mid register.

---

## Why this patch exists

Two problems were reported after v2.1.13:

1. **Combo counter placement/readability**
   - The counter on the left side was ugly and hard to read.
   - The user wants it top-center, slightly below the top HUD area.
   - The counter should be simpler: no persistent method list, no heavy clutter.

2. **Music still has too many high notes**
   - v2.1.13 lowered many high parts, but some high melodic/pad layers still felt intrusive.
   - The user asked to keep pushing them down.

---

## Combo UI changes

Touched:

- `src/hud.v2-1.js`
- `style.css`

### New placement

`#hud-combo` is now placed:

```txt
top center, slightly below the upper HUD
```

Implementation:

```css
left: 50%;
top: 58px;
transform: translateX(-50%);
```

On smaller screens it moves slightly lower:

```css
top: 86px;
```

This keeps it away from:

- bottom HP/EXP/weapon HUD;
- top-left feed/meta block;
- top-right objective/dossier block;
- world enemy labels, because combo is not drawn in-world.

### Simplified persistent view

Old visible state included a side panel with more visual noise.  
New visible state is just:

```txt
КОМБО   xN.N   #count
[small timer bar]
```

Persistent method details remain removed from the visible combat UI. Tooltip still explains rules.

### Visual style

The counter now uses:

- compact square frame;
- scanline / terminal filter;
- subdued glow;
- reduced saturation;
- smaller height;
- very short pop/hit animation.

It should feel more like part of the existing terminal HUD and less like a separate widget.

---

## Music changes

Touched:

- `src/audio.v2-1.js`

### New final music override

Added a final `v2.1.14 LOW REGISTER HOTFIX` override at the bottom of `audio.v2-1.js`.

This intentionally overrides the previous v2.1.12/v2.1.13 music functions without deleting old patch history in the file.

Overridden:

- `ensureMusic`
- `playDirgePhrase`
- `updateMusic`

### Register changes

Remaining high musical layers are folded down:

- `glass` now starts around low/mid register instead of bright shimmer;
- `highPad` now functions as a low/mid soft pad, not a high layer;
- `bossLine` lowered;
- `casino` layer lowered;
- `needle` noise filter lowered;
- authored motif playback is folded down by default.

The patch does **not** remove musical variation. It changes where that variation lives: low and low-mid instead of high.

### Filter clamp

Treble-heavy filters were lowered so gameplay sound effects keep ownership of the bright/high frequency range.

Approximate new ranges:

```txt
highPad filter: ~360–460 Hz
glass filter:  low-mid only
bossLine filter: ~420–530 Hz
needle filter: ~520–740 Hz
```

### Early-room pacing preserved

The early-room slowdown from v2.1.12 remains:

- fewer phrase triggers in early loops;
- reduced pulse/drive until later loops;
- boss still has a separate stronger musical identity.

---

## Versioning

Updated:

- `shared/protocol.v2-1.js`
  - `VERSION = v2.1.14`
  - `BUILD_ID = top_combo_low_music`
- `package.json`
  - `version = 2.1.14`
- `index.html` / `404.html`
  - cache query and visible version bumped to `2.1.14`

---

## QA

Run checks:

```bash
node --check server/index.js
node --check shared/*.js
node --check src/*.js
node -e "import('./src/audio.v2-1.js').then(()=>console.log('audio import ok'))"
node -e "import('./src/hud.v2-1.js').then(()=>console.log('hud import ok'))"
node -e "import('./shared/sim.v2-1.js').then(()=>console.log('sim import ok'))"
unzip -t terminal_casino_roguelike_2.1.14_top_combo_low_music.zip
```

Manual checks recommended:

1. Start a room and build combo.
2. Confirm combo appears top-center, not left/bottom.
3. Confirm it only shows combo label, multiplier, count, and timer bar.
4. Confirm HP/EXP/weapons/feed/objective remain readable.
5. Listen to early rooms at high music volume.
6. Confirm remaining high musical parts are no longer piercing or intrusive.
7. Check boss room: boss theme should still exist, but lower and less sharp.

---

## Follow-up risk

Music is now much darker and lower. If it becomes too muddy, the next pass should add brightness through rhythm/noise texture or short filtered clicks, not sustained high notes.
