# v2.1.111 — Slot Mob Strict Piece Gate Hotfix

## Fixed
- Reworked casino slot mob assembly into an authoritative sequential state machine.
- The slot mob enemy entity is never created while the four blocks are lying, flying, or magnetizing.
- The sequence is now strictly:
  1. casino slot closes/breaks,
  2. 4 blocks scatter,
  3. blocks lie still,
  4. block 1 flies in and impacts,
  5. block 2 flies in and impacts,
  6. block 3 flies in and impacts,
  7. block 4 flies in and triggers final impact,
  8. blocks fade/disappear,
  9. only then the real slot mob enemy is spawned,
  10. only then the slot roll starts inside the mob.
- Removed the old timer-crossing logic that could let assembly and spawn happen too close together.
- The simulation now tracks joined block count (`joined === 4`) as the actual spawn condition.
- Adjusted the visual block chain to match the new sequential server-side timing.

## Validation
- Smoke-tested overload sequence: no `slot_mob` in `run.enemies` before final block impact.
- Smoke-tested snapshot: no slot mob appears client-side before the final gate.
- Smoke-tested large-dt frames: slot mob still cannot spawn before the 4th block impact.
