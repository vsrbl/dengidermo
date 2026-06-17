# PATCH NOTES v2.0.99 — deeper adaptive music

Focus: make the procedural music darker, less bass-forward, and more varied.

## Audio / Music
- Lowered the continuous sub and pulse bass layers again.
- Raised the musical pad/choir/phrase layers relative to the bass.
- Rebuilt the procedural phrase system around darker descending motif families.
- Added state-specific motif pools for static, casino, boss, chill/menu, and normal combat.
- Added more rhythmic gaps, swing, register changes, rare high lament lines, scrape noise, and glass tones.
- Kept all music layers locked to one tonal root so the music does not fight the bass.
- Bass is now mostly a subliminal pressure layer and only lightly appears during boss/damage/high danger.
- Menu music remains active but is slower and less melody-loop-like.

## Notes
- This follows the same internal WebAudio/no-external-assets setup.
- The design uses adaptive layering and sparse horror ambience: multiple low-volume layers, rare events, and state-driven phrase density instead of a constant loud bass loop.
