# v2.1.57 — dynamic hum / portal bloom hotfix

## Audio
- Reworked the low ambient hum into a situational breathing layer instead of a permanent bed.
- The low body now grows during danger, static/casino-virus rooms, low HP, combat pressure, and bosses.
- In calm/clear states the hum fades close to silence.
- When the portal/clear state is active, the low hum is suppressed and replaced by a softer consonant portal bloom.
- Added `portalBloom`, `portalGlass`, and `softCurrent` layers for open-portal/room-clear moments.
- Portal state now retunes pads into a brighter, cleaner chord area instead of letting the dark low layer continue.
- Portal/room-clear/boss-down events now set resolve/portal music energy without re-enabling old glitch or roll stingers.

## Technical
- Added final v2.1.57 audio override on top of the v2.1.56 procedural digital ambient system.
- Kept the external licensed music disabled.
- Kept the old clicky breakcore/glitch layers disabled.
- Version bumped to v2.1.57.
