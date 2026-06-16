# v2.0.39 — BULLET FREEZE true freeze pass

## Goal
`BULLET FREEZE` should read as a real freeze/control ability, not as a generic slow/damage aura.

## Gameplay
- Added dedicated `frozenT` enemy state.
- Frozen enemies do not move.
- Frozen enemies do not shoot.
- Frozen enemies do not continue windup/attack progress while frozen.
- Frozen enemies do not deal contact damage during the freeze pause.
- `BULLET FREEZE` deals no damage by itself.
- Enemy bullets inside the aura are nearly stopped instead of being treated as damage targets.

## Visuals
- Frozen enemies now get a cyan square freeze-lock overlay.
- Added small shard/cross markers around frozen enemies.
- Added `FROZEN` label under affected enemies.
- Added short `enemy_frozen` FX pulses so the freeze pickup is readable even on fast casts.
- Freeze aura remains a stable square follow-zone, not an expanding wave.

## Data/UI
- Updated `BULLET FREEZE` description and role to clarify it is `FREEZE / CONTROL`.

## Technical
- Bumped to `v2.0.39`.
- Module filenames updated from `v2-0-34` to `v2-0-39`.
- Snapshot enemy rows now include a frozen flag after exposed state.
