# v2.0.94 — room mod tooltips / casino virus cleanup / shield readability

Base: v2.0.90_fast_clear_casino_virus_shields

## Critical fixes

- Casino Virus no longer blocks room completion because of a long empty wait between slot rolls:
  - If all enemies are dead and Casino Virus still has spins left, the next spin accelerates.
  - The portal can open only after all Casino Virus outcomes have applied and all live enemies are dead.
  - Delayed reel outcomes still apply after the reel animation, not instantly.
- Gold Fever no longer forces ordinary BET/casino to pay guaranteed GLD.
  - BET remains a risky spin.
  - Gold Fever only gives a modest GLD bonus when the spin actually pays GLD.
- Moving red zones now visibly and mechanically damage both players and enemies.
  - They pulse a hit effect when they deal damage.
  - They remain hollow hazard zones, not solid walls.

## UI / readability

- Room rules no longer list every possible rule.
- Active room modifier names are underlined hover targets in the top HUD and room dossier.
- Hovering a modifier name shows its exact detailed rule.
- Target/tooltip placement avoids the top-right room dossier area more aggressively.
- Added a small visible contract prize plaque near the HP/GLD HUD line.
  - Shows active / pending / used status.
  - Tooltip explains the concrete prize.
- Removed the confusing Skin Cache Signal contract prize from the reward pool.
- Shielded enemies now show a shell bar above the enemy.
  - The bar shrinks as shell is damaged.
  - The bar changes when shell regeneration starts.

## Balance / naming

- Ordinary casino odds are roughly twice less generous than before.
- Prices scale 1.5x faster than v2.0.90.
- DASH ECHO BURST was renamed to DASH AFTERSHOCK / РЫВОК: УДАРНЫЙ СЛЕД.
- HUNGER wording was changed away from “final bite” into an explicit stored-hit / finishing-hit description.
- Static Stack wording was cleaned into Static Storm wording in player-facing text.

## Validation

- Static syntax checks passed for server/shared/src JS.
- Import checks passed for sim/i18n/hud/audio.
- Archive test passed with `zip -T`.
