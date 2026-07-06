# PATCH NOTES v2.1.90 — WAGER / Contract / Chest hotfix

Build: `wager_contract_chest_hotfix`

## Fixes

- Reverted ordinary `RAR` chests to direct instant prize behavior.
  - They no longer open a 2-option choice window.
  - Valuable RAR chests can still add their GLD bonus directly.
- Added the intended 5-slot chest rule for WPN/ABL choice chests:
  - normal 1–4 slot WPN/ABL chests still pick 1 upgrade;
  - 5-slot WPN/ABL chests now let the player pick 2 upgrades from the 5 offered.
  - UI shows `PICK 2/2` then `PICK 1/2` and lists already taken options.
- Stopped non-contract room events from pretending to be contracts on loop 1:
  - Hunter Waves and Casino Virus completion messages now use room-event text/sfx, not contract-complete text.
- ROOM WAGER active state now appears as a top-right status card during the combat room.
  - It stacks under/above the contract card without overlap.
  - It shows risk, condition, prize, and live condition progress.
- ROOM WAGER accept/success/failure now have their own feedback events and sounds.
- ROOM WAGER `damage x100` prize now lasts for the whole next combat room instead of 12 seconds.

## Checks

- `node --check` passed for shared/client modules.
- Smoke-tested 5-slot WPN/ABL double-pick persistence.
- Smoke-tested active WAGER progress snapshot.
