# v2.1.70 — Casino click + LOCK badge hotfix

## Fixed
- Fixed BET buttons feeling dead/unresponsive by adding an immediate pointer-press handler for LOW/MID/HIGH.
- Removed the visible browser hand cursor from BET buttons so the casino matches the rest of the terminal UI.
- Stopped hover/readout layers from interfering with stake controls.
- Restored hover explanations on final result cells while keeping stake buttons clean.

## LOCK clarity
- LOCK is now always shown as a side plate while BET TERMINAL is open.
- Empty state shows `LOCK —` so the player can see where LOCK will appear.
- Active state shows the fixed symbol for the next bet.
- Used state briefly shows that LOCK was consumed.

## Notes
- HOLD / CSH / DEBT remain removed from the BET pool.
- LINK remains as the combo-related casino outcome.
