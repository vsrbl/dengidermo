# v2.0.43 — herald_casino_seeker_rework

## Herald summon readability

- Removed the always-on red tether feel from HRD.
- HRD now starts a clear summon windup instead of instantly spawning a random pack.
- During windup, a red signal line fills from Herald to the target player.
- When the line reaches the player, the summoned pack opens behind the player, on the opposite side from Herald.
- Added a visible summon gate / square socket animation at the spawn point so the player can read where the swarm is appearing.
- Summoned enemies receive a short rally target so they immediately pressure the called player.

## Casino mutation roll timing

- CASINO mutation no longer applies its result immediately.
- Using Q with CASINO now starts a top-screen slot roll first.
- The reward/penalty is applied only after the mini-roll stops.
- The HUD mini-roll now has spinning symbols, reel stop timing, and final result display.
- Extra Q casts from casino still skip casino recursion.

## Seeker redesign

- SEK projectile size reduced from 7 to 5.
- Replaced the large packet/bubble look with a smaller digital needle/chip projectile.
- Reworked `shot_sek` SFX again: compact dry lock-on tick, less harsh and not watery/bubbly.

## Checks

- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- import smoke tests
- zip integrity test
