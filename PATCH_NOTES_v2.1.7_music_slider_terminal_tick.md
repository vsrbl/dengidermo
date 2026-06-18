# PATCH NOTES — v2.1.7_music_slider_terminal_tick

**Base:** `v2.1.6_expanded_score_music`  
**Patch type:** audio/UI hotfix  
**Goal:** replace the unpleasant bubbling music-volume slider preview sound with a dry terminal-style tick that matches the rest of the game UI.

---

## Problem

The music volume slider used `previewVolume('music')` in `src/audio.v2-1.js`.

Before this patch, the music preview sound was a short triangle oscillator note with a downward pitch glide:

```js
triangle 220 Hz -> 165 Hz
lowpass around 820 Hz
long-ish exponential envelope
```

In practice this sounded like a liquid/bubbling UI blip, especially when dragging the music slider repeatedly. It did not match the rest of the game's dry terminal/casino SFX language.

The issue was not music layering. It was the slider preview SFX itself.

---

## Changes

### Music slider preview SFX

Replaced the old glide/bubble preview with a dry terminal tick:

- short square-wave click at a fixed pitch;
- small lower square body for tactile hardware feel;
- tiny bandpassed contact-noise layer;
- no pitch glide;
- no lowpass bubble;
- no liquid/chirp character;
- very short envelope, suitable for repeated slider dragging.

The preview still routes through `musicGain`, not `sfxGain`, so it continues to represent the selected music volume level.

### Versioning

Updated:

- `package.json` → `2.1.7`
- `shared/protocol.v2-1.js` → `VERSION = 'v2.1.7'`
- `BUILD_ID = 'music-slider-terminal-tick'`
- `index.html` cache query/version display → `2.1.7`

---

## Files changed

- `src/audio.v2-1.js`
- `shared/protocol.v2-1.js`
- `package.json`
- `index.html`
- `PATCH_NOTES_v2.1.7_music_slider_terminal_tick.md`

---

## Implementation notes

The new preview sound is intentionally UI-like rather than musical. It should feel like:

```txt
broken terminal switch / dry casino console tick / tiny contact snap
```

It should not feel like:

```txt
bubble / water drop / toy blip / pitchy melody
```

Keep this rule for future slider/menu preview sounds: short, dry, square/noise based, no melodic glide unless the user explicitly wants a musical UI cue.

---

## QA checklist

- Drag music volume slider repeatedly.
- Confirm preview sound is a dry tick, not bubbling.
- Confirm music volume still changes immediately.
- Confirm music preview is affected by the music volume slider.
- Confirm SFX slider preview still uses the existing SFX tick path.
- Confirm no JS syntax errors.

Checks run for this patch:

```bash
node --check server/index.js
node --check shared/*.js
node --check src/*.js
node -e "import('./shared/sim.v2-1.js').then(()=>console.log('sim import ok'))"
node -e "import('./src/i18n.v2-1.js').then(()=>console.log('i18n import ok'))"
node -e "import('./src/hud.v2-1.js').then(()=>console.log('hud import ok'))"
node -e "import('./src/effects.v2-1.js').then(()=>console.log('effects import ok'))"
node -e "import('./src/audio.v2-1.js').then(()=>console.log('audio import ok'))"
unzip -t terminal_casino_roguelike_2.1.7_music_slider_terminal_tick.zip
```
