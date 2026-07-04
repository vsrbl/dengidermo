# v2.1.68 — BET Terminal LOCK cleanup hotfix

## Casino flow
- Removed `HOLD` from BET outcomes.
- Removed `CSH` from BET outcomes.
- Removed `DEBT` from BET outcomes.
- Kept `LOCK` as the only special BET effect.
- `LOCK` now stores one fixed useful symbol for the next bet.

## LOCK clarity
- Added a separate `LOCK` badge to the right of BET TERMINAL.
- The badge shows which symbol is locked for the next bet.
- Hovering the badge gives one short explanation.
- If a locked bet is used, the badge clears.

## BET input hotfix
- Raised the casino modal above HUD overlays.
- Forced stake buttons to stay clickable.
- Added safe delegated click handling for the stake row.
- Allowed BET resolution in cleared rooms as well as active play, so open terminals do not feel dead after a room transition.

## Text cleanup
- Removed long stake hover descriptions.
- Removed removed symbols from the casino spin preview list.
- Kept explanations on final result cells only.
