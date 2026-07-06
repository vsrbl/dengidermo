# v2.1.110 — Slot Mob Gate + Ranged LOS Hotfix

## Casino slot mob assembly

- Casino slot mob can no longer be created in the same simulation tick as the fourth block magnet impact.
- The four-block assembly is now the hard spawn gate:
  1. pending sequence exists, but no `slot_mob` enemy exists;
  2. fourth block impact fires;
  3. post-block spawn gate starts;
  4. only after the gate expires is the real `slot_mob` entity created;
  5. only then can the roll phase begin.
- Large/laggy `dt` frames are handled explicitly, so the final impact and enemy creation cannot collapse into one frame.
- `slotMobSequencePending()` now counts both unfinished assembly timers and post-impact spawn gates, so the portal still treats the assembly as an active threat.

## Shooter line-of-sight fix

- Added shared ranged line-of-sight checks against room walls.
- Shooter-like mobs no longer fire when a wall blocks the line to the player.
- Blocked shooters now try to reposition around the wall instead of standing still and dumping bullets into geometry.
- Applied to:
  - normal `shooter`;
  - `echo` mimic shots;
  - `orbiter` shots;
  - `prism` volleys;
  - `pulse` waves;
  - casino slot mob `shooter` mode;
  - casino slot mob `pulse` mode;
  - aimed boss bursts.

## Validation

- `node --check shared/sim.v2-1.js`
- Full JS syntax check pass.
- Smoke test: huge `dt` no longer creates slot mob on the same tick as final block impact.
- Smoke test: shooter behind a wall does not fire, then fires again when LOS is clear.
