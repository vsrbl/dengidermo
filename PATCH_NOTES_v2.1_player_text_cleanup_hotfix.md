# v2.1 — Player Text Cleanup Hotfix

Player-facing text pass for RU/EN.

## Changed
- Removed patch-note style wording from visible descriptions: “before/after”, “no longer”, “ROOM CHECK”, “duplicate not granted”, “numeric target”, hidden/internal storm explanations.
- Rewrote upgrade descriptions into simple player-facing effects.
- Rewrote WPN/ABL/chest/objective/favor tooltips to avoid internal implementation details.
- Cleaned Static Storm breakdown tooltip so it explains the current danger instead of the underlying stacking system.
- Cleaned contract reward language: “ROOM CHECK” is now presented as the room result / after-room prize.
- Rephrased fallback text and English/Russian mixed descriptions.

## Checks
- JS syntax checks.
- ESM import checks for core client modules.
- Archive integrity test.
