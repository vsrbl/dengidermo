# v2.1 Roomflow Pacing Revert Hotfix

## Goal
Restore the previous room pacing feel after the director-budget portal rule made rooms feel like endless wave drains.

## Changes
- Removed the portal requirement that forced rooms to wait until the full director budget was exhausted.
- Replaced it with a small staged encounter target:
  - the first tiny pack cannot immediately open the portal;
  - rooms usually need a short second/third beat;
  - the director does not keep spawning just to spend a huge budget.
- Director spawn ceiling is now a compact encounter target, not a late-loop meat budget.
- When a pack is cleared very fast, the next pack is pulled forward gently, not instantly.
- Static Storm source naming remains player-facing as “hits from previous room” / “попадания прошлой комнаты”.
- ORBITALS REFLECT behavior is preserved: orbitals still seek enemies, and additionally bend toward nearby enemy bullets when the reflect upgrade is owned.

## Validation
- Syntax checks passed for server, shared and client scripts.
- ESM import checks passed for sim/data/hud/i18n/audio.
- Zip integrity check passed.
