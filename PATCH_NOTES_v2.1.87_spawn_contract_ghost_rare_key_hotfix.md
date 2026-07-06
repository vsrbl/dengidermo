# PATCH NOTES v2.1.87 — Spawn / Contract / Ghost / Rare / Key hotfix

Date: 2026-07-06
Build: `spawn_contract_ghost_rare_key_hotfix`

## Fixes

- Spawn-warning zones now disappear immediately once the enemy or enemy group has actually spawned from that zone.
- Contract HUD card is aligned with the top-right room dossier instead of being glued to the screen edge.
- `GHOST DECOY` now has a clear activation cue:
  - sound on activation;
  - `GHOST MODE` screen feedback;
  - the player body fades / flickers while ghosted;
  - a small cyan terminal frame and label show that stealth is active.
- R-active audio pass:
  - `TARGET LOCK` keeps acquire / retarget / end cues;
  - `REDLINE BOOST` keeps its start cue;
  - `REWIND MARK` keeps mark / return cues and now has expiry feedback;
  - `GHOST DECOY` has explicit activation sounds;
  - `KILL SWITCH` has explicit field-clear sounds.
- Rare chests now open a 2-option RAR choice window instead of instantly applying a random upgrade.
- BOSS KEY is now shown as `KEY current/max`, for example `KEY 1/1`.
- BOSS KEY charges are spent during the current loop and restored to max on the next loop after boss/core.
- GOLD FEVER boss/enemy loot stays pure `GLD`; boss burst loot no longer leaks EXP in greed rooms.

## Technical notes

- Added `rare_pick` client message and `rare_offer` server message.
- Added `BOSSKEYMAX` snapshot field while preserving existing snapshot indices.
- Added `rareChestOffer` state to players.
- Added client-side RAR modal reuse via the ability-choice panel.
