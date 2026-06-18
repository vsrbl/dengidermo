# PATCH NOTES — v2.1.6_expanded_score_music

**Project:** Terminal Casino Roguelike / nncckkrr-style browser canvas roguelite  
**Base:** v2.1.5_tonal_lock_music  
**New version:** v2.1.6_expanded_score_music  
**Patch type:** audio / procedural music / score expansion  
**Date:** 2026-06-18

---

## Why this patch exists

v2.1.5 fixed the unpleasant “false / sour” feeling in the music by locking the soundtrack to a safer tonal center and removing detuned overlaps. That solved the immediate problem, but it also made the score too restrained: fewer layers, less motion, and not enough musical variety.

The goal of v2.1.6 is to expand the procedural score again without returning to the previous problem where multiple musical layers sounded out of tune when stacked.

Target feeling:

```txt
more music
more variation
same dirty terminal / cursed casino style
safe tonal compatibility
music slider can be loud without sour pitch clashes
```

---

## Main changes

### 1. Expanded procedural scorebook

The music director now has more phrase families instead of relying mostly on a simple drone / pulse bed.

Added / emphasized score moods:

- calm high-note phrases for menu, rest, low-pressure, portal and resolve moments;
- darker drive motifs for combat and high pressure;
- casino-flavored broken machine phrases;
- static / prism / anchor / anomaly pressure phrases;
- boss / chaos phrases with stronger low-mid motion;
- resolve phrases after room completion.

Important design rule:

```txt
variation now comes from rhythm, register, phrase choice and timbre — not from random detune
```

---

### 2. One shared tonal home remains

The patch keeps the v2.1.5 fix: all generated musical phrases stay inside one compatible dark tonal grid.

This is important because older versions could schedule long-decay notes from one room/mood and then layer a new phrase from another tonal root. That caused the “false / off-key” feeling.

v2.1.6 keeps tonal consistency while adding more phrase variety.

---

### 3. New / expanded music layers

The audio director now uses more distinct musical roles:

| Layer | Role |
| --- | --- |
| `highPad` | Calm upper-register notes for quiet, portal, menu and low-pressure moments. |
| `drive` | Dark low-mid rhythmic/melodic motion for combat, boss and pressure. |
| `needle` | Dirty terminal/casino/static accent layer for chaos and special modifiers. |
| low drone / bass pulse | Still provides the heavy terminal foundation. |
| noise / hat / support layers | Still provide combat dirt and machine texture. |

The important distinction is that higher notes are now calmer and more sparse, while drive phrases carry motion in the low/mid register.

---

### 4. Better loud-music behavior

The music should now tolerate a higher music slider value better than before.

Changes:

- increased practical music headroom;
- reduced unsafe pitch drift;
- reduced long sour overlaps;
- kept high notes sparse enough that they do not constantly fight SFX;
- kept drive motifs lower and darker so they can be louder without becoming piercing.

This does **not** mean the music is just globally louder. It means the mix should remain more stable if the player chooses to turn music up.

---

## What was deliberately not changed

- No external audio assets were added.
- The game still uses synthetic WebAudio music.
- The style remains broken terminal / cursed casino / dark signal.
- The patch does not change gameplay, enemies, economy, room generation, contracts or weapons.
- The patch does not add player-facing UI text.

---

## Implementation notes for future chats

Likely changed file:

```txt
src/audio.v2-1.js
```

Expected implementation shape:

- music phrase scheduling expanded;
- tonal grid preserved from v2.1.5;
- new layer state/gain handling for highPad / drive / needle;
- music state selection reacts to room mood and combat intensity;
- no intentional detune/drift for musical notes.

Future chat should inspect `src/audio.v2-1.js` first if continuing music work.

---

## QA / checks performed

Run checks passed:

```bash
node --check server/index.js
node --check shared/*.js
node --check src/*.js
node -e "import('./shared/sim.v2-1.js').then(()=>console.log('sim import ok'))"
node -e "import('./src/i18n.v2-1.js').then(()=>console.log('i18n import ok'))"
node -e "import('./src/hud.v2-1.js').then(()=>console.log('hud import ok'))"
node -e "import('./src/effects.v2-1.js').then(()=>console.log('effects import ok'))"
node -e "import('./src/audio.v2-1.js').then(()=>console.log('audio import ok'))"
unzip -t terminal_casino_roguelike_2.1.6_expanded_score_music.zip
```

---

## Follow-up direction

The user wants:

```txt
music should be plentiful and varied
same style across all music
music can be made loud
sometimes calm high notes
sometimes driven dark melodies
avoid sour/false-sounding stacked tones
```

Recommended future work:

1. Add a small in-game music debug readout only in dev mode: current music mood, active layers, intensity, phrase family.
2. Add per-room score presets: `casino`, `static`, `boss`, `rest`, `blood`, `anchor`, `prism`, `panic`.
3. Add soft crossfade discipline so old phrase tails do not fight new section starts.
4. Add phrase cooldowns to prevent the same motif repeating too often.
5. Keep tonal compatibility strict unless the user explicitly asks for harsher dissonance.

---

## Patch note policy going forward

Starting from this point, every generated game patch should include a dev-facing patch notes markdown file named like:

```txt
PATCH_NOTES_vX.Y.Z_short_patch_name.md
```

The patch notes should summarize:

- what changed;
- why it changed;
- important implementation notes;
- changed files when known;
- QA checks performed;
- follow-up risks / next steps.

These notes are for development continuity in future chats, not for normal player-facing UI.
