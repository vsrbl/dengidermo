# PATCH NOTES v2.1.98 — cursor / casino result / slot mob rebuild rework

## Cursor

- Restored the old custom terminal cursor visual.
- Removed the native crosshair fallback from v2.1.94.
- Cursor now hard-snaps to the latest pointer coordinates with no transition / smoothing / RAF queue.
- Input still uses a single pointer path (`pointerrawupdate` where available, otherwise `pointermove`, otherwise `mousemove`) to avoid stale fallback events overwriting fresher raw coordinates.

## Casino terminal result line

- Casino terminal now shows a short in-window result line again.
- The line describes what the player actually won or lost, not the visible reel symbols.
- Removed duplicated reel text from the bottom result line such as `ABL ABL ABL x3 ABL`.
- Examples:
  - `ВЫИГРЫШ: МУТАЦИЯ: ...`
  - `ВЫИГРЫШ: ПРОТОКОЛ: ...`
  - `ПРОИГРЫШ: -50 GLD`
  - `ПРОИГРЫШ: static debt`
  - `LOCK: зафиксирован WPN`

## Slot mob overload rework

- Slot mob now appears after the overload/break animation instead of immediately popping in.
- Full-lock casino abuse still triggers overload on the 11th spin.
- The broken slot now emits GLD/EXP-like fake particles that cannot be collected.
- Particles collapse toward the spawn point and assemble the slot mob.
- Slot mob no longer rerolls mode every 5 seconds.
- Slot mob rolls internally for 3 seconds on first spawn and on every rebuild.
- While rolling/rebuilding it is shielded and cannot take damage.
- After each roll it chooses one mode.
- Removed the bouncer/ricochet mode from slot mob.
- Slot mob mode pool is now:
  - shooter
  - charger
  - runner
  - pulse
- Slot mob HP increased x10 from the previous implementation.
- Every pseudo-death now breaks it into fake loot particles, then reforms for the next life.
- It still requires 10 kills/rebuilds to fully remove.

## Validation

- `node --check` passed for changed JS files.
- Module import smoke test passed for input / HUD / render / effects / sim.
