# Terminal Casino Roguelike 2.1 — Melancholy SFX + LED Filter Hotfix

## Visual filter
- Reverted LED filter strength back to the earlier/lighter level.
- Removed the visible FILTER/LED switch button entirely from the UI.
- LED overlay remains always-on over the whole game, HUD, menus, panels and text.

## Level-up feedback
- Lowered level-up SFX volume.
- Reworked level-up SFX into a quieter INSTALL-green terminal chime.
- Removed the bubbly/soft feel; the sound now has a short digital transient and minor terminal tone.

## Run start / restart / death feedback
- Reworked run-start and run-death markers from smooth waves into digital terminal pulses.
- Run start now sounds like a packet lock / progress begin marker.
- Run death now sounds like a descending terminal dropout.
- The music-bed event wave is now more restrained, digital and minor-coloured.

## Melancholy SFX pass
- Reduced cheerful/high reward sparkle on GLD, EXP, pickups, install, casino win/result, contract, jackpot and skin legendary sounds.
- Shifted these sounds toward quieter, minor, terminal, melancholic tones.
- Kept weapon/combat readability intact; gameplay SFX still cut through the ambient bed.

## Checks
- node --check server/index.js
- node --check shared/*.js
- node --check src/*.js
- import checks: sim, i18n, hud, audio
- zip -T
