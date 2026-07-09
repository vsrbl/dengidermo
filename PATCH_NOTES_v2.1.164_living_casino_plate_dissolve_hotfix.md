# v2.1.164 — living_casino_plate_dissolve_hotfix

## Fixes
- Removed the Living Casino world-area ring/pick animation around the player.
- Living Casino sector selection now emits the pick FX at the selected action plate position.
- Added a terminal-style plate dissolve animation for the selected Living Casino action/weapon card.
- Kept the small selection sound/tactile kick without drawing a large area around the hero.

## Checks
- JS syntax check passed.
- ESM imports passed.
- Living Casino smoke: open emits ring tick only, selection emits `lc_sector_pick` at the plate coordinates.
