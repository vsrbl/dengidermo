# Terminal Casino Roguelike 2.1 — Ambient Bed Hotfix

## Music direction
- Reworked the score toward a Brian-Eno-style generative ambient background bed.
- Music is now slower, softer, and more continuous: overlapping authored cells with different lengths instead of frequent melodic bursts.
- Removed bright/high musical stabs from the score; gameplay SFX keeps the high-frequency space.
- Kept low/mid-low colors: filtered triangle/sine/saw pads, bass-clarinet/cello-like lines, low reed/organ answers.
- Ambient reacts to menu/rest/combat/chaos/static/casino/boss/portal/resolve, but as a bed, not as a loud song.
- Added soft slow noise only for static/chaos as low texture, not piercing hiss.

## Technical
- Added `ambientNote()` with slow attack/release envelopes.
- Added `ambientNoise()` for optimized short low-noise texture events.
- Overrode the final 2.1 music functions with the ambient-bed system.
- No external assets; still WebAudio-only.
