# PATCH v2.0.90 — CONTRACT VISIBILITY + LIVE TIMING

## Player-facing contract plate

Added a dedicated center-top contract plate:

- does not live in the top-right room dossier;
- does not use the center banner lane;
- does not block input or menus;
- shows contract name, status, progress, and reward timing;
- animates in with a terminal/casino card style;
- turns red on failure and gold on completed contracts.

## Live contract timing

Contracts no longer wait blindly until portal-open to show their true result.

Early failure now happens as soon as the condition is broken:

- `NO HIT TAPE` fails immediately when damage is taken.
- `STATIC CLEAN` fails immediately when damage exceeds the limit.
- `FAST CLEAN` fails immediately when the timer is too late before clear.
- old ghost contracts still fail immediately if their tracked hazard is touched.

Early completion now appears when the condition is actually completed:

- `HUNTER WAVES` becomes DONE when all waves are cleared.
- `VIRUS CLEAN` becomes DONE when casino virus conditions are complete.
- `CLEAN SIGNAL` can become DONE once the room clear quota is met.

Portal opening still freezes the final result for payout/room check.

## Blood Tax objective clarification

`BLOOD PAID` now requires at least one HP purchase/tax event before payout.
If the player clears the room without paying HP, the contract fails as `NO BLOOD PAID`.

## Safety rule

Rewards still pay only after the transition / room check. The live contract plate is status feedback, not immediate payout.
