# nncckkrr v2.0.73 — Weapon Crate Readability

## Goal
Make WPN chest decisions readable at a glance. The player should understand whether a choice is DPS, RANGE, STATUS, CONTROL, SYNERGY, or a new weapon before clicking.

## Changes
- Added WPN choice role tags:
  - `NEW` for new weapon slots.
  - `DPS` for damage / fire-rate / burst upgrades.
  - `RANGE` for bounce, range, and projectile lifetime.
  - `STATUS` for FIRE / FREEZE / POISON systems and status scaling.
  - `CONTROL` for freeze-lock, chain, lock-on, mines, and area denial.
  - `SYNERGY` for build-linking upgrades like drone element inheritance.
- Added a second line on each WPN choice explaining the practical effect.
- Added a third line showing the exact gameplay change, such as:
  - `+18% weapon damage · always works`
  - `+14% fire rate · NOT fire element`
  - `+1 bounce · better in tight rooms`
- Updated tooltips to explain the role tag and the effect.
- Renamed `WEAPON FIRE +14%` display text to `WEAPON RATE +14%` in data to avoid confusion with elemental FIRE.
- Preserved Russian label as `СКОРОСТРЕЛЬНОСТЬ ОРУЖИЯ +14%`.
- Kept red `FIRE` elemental tag only for true `FIRE BULLETS`.

## QA
- `wpn_fire` shows DPS role, not elemental FIRE tag.
- `bullet_fire` still shows elemental FIRE tag.
- Disabled weapon-specific choices still show their role/effect, plus the requirement lock reason.
