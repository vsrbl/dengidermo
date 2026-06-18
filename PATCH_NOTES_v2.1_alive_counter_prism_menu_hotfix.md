# v2.1 Alive Counter / Prism Grid / Menu Version Hotfix

## Goal
Fix rooms where the objective/HUD still showed enemies alive even when no visible combat enemies remained, clarify Prism Grid, and make the current build easier to identify from the menu.

## Changes
- Added a combat-visible enemy filter for objective progress and room cleanup checks.
- Objective counters now ignore invalid, off-room, unknown, or wall-buried ghost enemies instead of letting them block cleanup forever.
- Added a safety cleanup/rescue pass:
  - invalid/off-world enemies are removed from the active room list;
  - enemies stuck inside solid walls are relocated back onto playable floor after a short grace period.
- Snapshot enemy list now uses the same combat-visible filter as the objective counter, so the HUD count and drawn enemies agree better.
- Casino Virus cleanup now uses the corrected live enemy count, reducing false “LEFT” states after virus events.
- Rewrote Prism Grid player-facing text:
  - it is now described as floor cells that slow movement and bullets;
  - removed outdated wording about warning lines / dangerous beams.
- Menu version now shows the current build label: `alive-counter-prism`, so test builds are easier to tell apart.

## Validation
- Syntax checks passed for server, shared and client scripts.
- ESM import checks passed for sim/data/hud/i18n/audio.
- Basic snapshot sanity check passed for invalid/off-world/wall-buried enemies.
- Zip integrity check passed.
