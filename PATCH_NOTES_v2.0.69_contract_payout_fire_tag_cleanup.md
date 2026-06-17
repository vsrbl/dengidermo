# PATCH NOTES v2.0.93 — contract payout clarity / WPN fire-rate tag cleanup

## WPN chest clarity

- Fixed misleading red `FIRE` elemental tag on `WEAPON FIRE +14%`.
- The tag logic now only shows elemental tags for real elemental bullet upgrades:
  - `FIRE BULLETS` → `FIRE`
  - `FREEZE BULLETS` → `FREEZE`
  - `POISON BULLETS` → `POISON`
  - `DRONE ELEMENT LINK` → `DRONE`
- `WEAPON FIRE +14%` is now shown as a normal weapon stat boost with no red elemental marker.

## Next design step: contract payout readability

- Room contracts now display concrete payout previews instead of vague reward words.
- Current room and NEXT room contract chips show the expected reward, for example:
  - `+12G +10XP`
  - `+6G +5XP · CHAIN x2 +8G +6XP`
  - `+6G +5XP +SKN`
- Contract-chain payout preview uses the current run streak so the player can understand why keeping the chain alive matters.
- The final `ROOM CHECK` still pays out from the same formula, so preview and actual reward stay aligned.

## Why

The player needs clearer dopamine/reward information before entering or finishing a room. Contract goals already existed, but the payout text was too abstract (`GLD`, `EXP`, `GLD+EXP`). This patch makes the reward readable without adding more HUD clutter.
