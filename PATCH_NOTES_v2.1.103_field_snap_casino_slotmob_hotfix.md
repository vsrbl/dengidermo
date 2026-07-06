# PATCH NOTES v2.1.103 — Field Snap / Casino Result / Slot Mob Hotfix

Дата: 2026-07-06

## FIELD SNAP

- Fixed a bug where using FIELD SNAP near a wall could pull enemies through/behind walls and leave them invisible but alive.
- Forced enemy pulls now resolve against walls immediately.
- If a forced pull still lands inside geometry, the enemy is stepped back along the pull path and then searched around its original visible point before any rescue fallback.
- Enemy velocity is damped after the snap pull so it does not keep sliding into walls.

## Casino result text

- Removed duplicate semantic labels from the casino terminal result line.
- The top title keeps the broad category, while the lower line now shows only the concrete result:
  - weapon prize -> actual weapon name or `+15% weapon damage`;
  - ability prize -> actual mutation/upgraded ability name;
  - rare prize -> actual rare bonus;
  - loss -> exact cost;
  - LOCK -> exact fixed symbol;
  - static -> concrete static debt note.
- Tooltip still contains the full result summary for longer outcomes.

## SLOT MOB

- SLOT MOB HP increased x4 from the previous build: 1530 -> 6120.
- Added clearer charger-state rendering:
  - stronger red charge guide during windup;
  - red charge trail/afterimages while actually charging;
  - state label changes between AIMING / CHARGE / COOL.

## Technical

- Version/cache bumped to v2.1.103.
