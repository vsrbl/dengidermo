# v2.0.93 — fast clear / casino virus / shields polish

Base: v2.0.89_static_contract_clarity

## Gameplay fixes

- Casino Virus reels now resolve in two phases:
  - the reel animation/result appears first;
  - the gameplay effect is applied only after the reel delay finishes.
- Casino Virus mob/elite/boss outcomes are applied after the reel delay and reliably spawn their enemies.
- Casino Virus local Static Storm no longer creates next-room static debt/carry.
- Casino Virus opens the portal after all spins are resolved and all live enemies are dead.
- Fast Cleanup now uses a dynamic deadline based on room quota, room size/archetype and dangerous modifiers.
- Fast Cleanup means killing every enemy before the dynamic deadline, not merely reaching the numeric quota.
- Clear progress now distinguishes normal quota clear from full-room clear:
  - normal clear shows clamped quota progress plus live enemy count;
  - full-room clear shows live enemy count.
- Contract favor that clears static pressure is removed from the reward pool unless there is static debt/carry to clear.
- Enemy shields/shells now regenerate after a short no-damage delay, making shell different from HP.

## Naming and UI

- DASH CLONE has been renamed to DASH ECHO BURST / РЫВОК: ЭХО-ВСПЛЕСК.
- DRONES COPY PROC has been renamed to DRONE BLAST CHANCE / ДРОНЫ: ШАНС ВЗРЫВА.
- BLAST PROC has been renamed to BLAST CHANCE / ШАНС ВЗРЫВА.
- VIRUS REELS / ВИРУС-БАРАБАНЫ wording is replaced by CASINO VIRUS / ВИРУС КАЗИНО.
- Russian room-rule copy now avoids old confusing wording like static rain / moving walls in normal player text.
- TAB layout now uses fewer columns after removing old Tape/Memory blocks, reducing empty space.

## Checks

- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- import checks for sim/i18n/hud/audio
- Node smoke test for delayed Casino Virus mob pack and portal open after virus completion
