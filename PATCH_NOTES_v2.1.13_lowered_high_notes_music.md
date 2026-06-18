# PATCH NOTES — v2.1.13_lowered_high_notes_music

## Summary

This patch retunes the procedural music after feedback that the high notes still felt too intrusive and attention-grabbing. The score keeps the v2.1.6+ variety and v2.1.12 calmer pacing, but most high-register musical parts are folded down into mid / low-mid registers.

## Player-facing goal

- Music should remain varied and stylized.
- The top-end notes should no longer poke through the mix or feel obsessive.
- Early rooms should feel darker and calmer, not bright or nervous.
- Boss music should remain recognizable, but less piercing.

## Changed files

- `shared/protocol.v2-1.js`
  - Version updated to `v2.1.13`.
  - Build id updated to `lowered_high_notes_music`.
- `package.json`
  - Version updated to `2.1.13`.
- `index.html`
  - Version text and cache query updated to `2.1.13`.
- `404.html`
  - Version text/cache references updated to `2.1.13`.
- `src/audio.v2-1.js`
  - Retuned high-register music layers in the current v2.1.12 override.

## Music changes

### High note folding

The explicit high phrase notes were lowered substantially:

- Boss high phrase: `43 / 39 semitones` → `19 / 15 semitones`.
- Calm/portal/resolve high phrases: `36–43 semitones` → `12–19 semitones`.

This moves the phrase accents down by roughly two octaves instead of leaving them in the piercing upper register.

### Persistent layer retune

The persistent upper layers were also moved down:

- `glass`
  - Spawn frequency moved from `root * 8` to `root * 4`.
  - Runtime target moved from `root * 8/9` to `root * 4/5`.
  - Filter lowered from bright upper band to mid register.
- `highPad`
  - Spawn frequency moved from `root * 12` to `root * 4`.
  - Runtime target moved from `root * 10/12/16` to `root * 4/5/6`.
  - Filter lowered from ~1400–1880 Hz range to ~780–1040 Hz range.
- `bossLine`
  - Spawn frequency moved from `root * 8` to `root * 4`.
  - Runtime target moved from `root * 6/8` to `root * 3/4`.
  - Filter lowered.
- `needle`
  - Filter lowered so the noise layer is less sharp.

### Volume balance

Because lower notes take more body in the mix, these layers were also slightly reduced in volume:

- `glass`
- `highPad`
- `bossLine`

## Design notes

This patch does not remove musical variation. It changes the register of the variation. The score should still have motifs, boss identity, casino/static/chaos color, and room-reactive pacing, but the “upper note” material should now sit inside the dark terminal machinery instead of cutting over it.

## QA performed

- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- `node -e "import('./src/audio.v2-1.js').then(()=>console.log('audio import ok'))"`
- `node -e "import('./shared/protocol.v2-1.js').then(()=>console.log('protocol import ok'))"`
- `unzip -t terminal_casino_roguelike_2.1.13_lowered_high_notes_music.zip`

## Follow-up watch

- If the music becomes too muddy, raise only a few accent notes by one octave, not the whole high layer.
- If boss loses identity, brighten only the boss attack hook briefly, not the looping boss pad.
- Avoid returning to detune/drift-based brightness; that previously caused sour/fake-sounding overlaps.
