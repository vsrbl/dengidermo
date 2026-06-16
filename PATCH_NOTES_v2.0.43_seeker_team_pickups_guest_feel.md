# v2.0.44 — seeker pitch / team pickups / guest feel

## Seeker SFX
- `SEK` shot sound moved higher again.
- Still keeps the dry shotgun-like snap family: chunky square attack + bright terminal crack.
- No bubble/chirp character.

## Team pickup economy
- Non-casino `GLD` and `EXP` pickups are now explicitly team-shared.
- When one player collects ordinary gold/XP, every connected player receives the same amount.
- Spending remains individual because every player still has their own wallet, pending level-up offers, WPN purchases and casino stake flow.
- Casino rewards are unchanged: the player who gambles receives/pays the result.
- `HEA` pickups remain local to the player who touched the heal.

## Guest control/camera feel
- Host felt crisp because host receives full-rate local sim snapshots synchronously.
- Guest previously had 33ms input cadence + 20Hz snapshots + 110ms entity interpolation + smoothed own camera position.
- Guest input is now sent at frame cadence.
- Guest snapshots are now 30Hz.
- Remote interpolation delay reduced to 55ms.
- Guest camera now follows local predicted player position directly instead of smoothing toward it.

## Version
- Bumped to `v2.0.44`.
- Module filenames/imports updated to `v2-0-44`.
