# PATCH NOTES v2.1.105 — Slot Mob Magnet Assembly / Charger Telegraph Hotfix

## Slot mob assembly

- Reworked the broken casino / slot-mob rebuild visual to feel like four real physical chunks:
  - exactly 4 square pieces;
  - each piece is half of the slot-mob size, so all four pieces visually form the mob body;
  - pieces scatter with procedural velocity/spin instead of repeating the same animation;
  - pieces bounce and settle visually before assembly;
  - wait-before-assembly reduced from 5s to 3s;
  - pieces magnetize back one by one with acceleration toward the assembly core;
  - each join produces stronger screen impact than the previous one;
  - final fourth join produces the strongest shake/impact.
- Slot mob rendering remains hidden until after the fourth chunk has magnetized into place, so the mob appears tied to the block animation instead of popping in independently.
- First-spawn delayed rebuild FX is now visual-only for audio timing; roll tick sounds happen during the real roll phase instead of too early.
- Increased slot-roll tick sound cadence during the 6s roll.

## Charger telegraph

- Normal charger and casino slot-mob charger now lock their charge direction at the moment windup begins.
- During windup the red line no longer rotates toward the player.
- Added a red square endpoint marker at the final charge target for both normal charger and casino charger.
- Slot-mob charger keeps using the normal charger mechanics, without custom jitter behavior.

## Version

- Bumped cache/version labels to v2.1.105.
