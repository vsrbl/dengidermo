# v2.1.113 — Slot Mob Authoritative Chunks Hotfix

## Fixed
- Intermediate casino slot-mob deaths again create the visible four physical chunks.
- The intermediate rebuild still uses `pendingSlotMobs`; no hidden/live slot-mob enemy exists while the chunks are lying, flying, or snapping back together.
- The final assemble burst now clears any matching local chunk animation so the live slot mob cannot visually overlap loose blocks or appear while client-side chunks are still drifting.
- Slot mob transient states are now consistently non-combat: spawn-roll, hidden, and rebuild states cannot take damage, touch players, or push other enemies.

## Validation
- `node --check shared/sim.v2-1.js`
- `node --check src/effects.v2-1.js`
- Smoke test: intermediate death emits `slot_mob_break` + `slot_mob_rebuild`, removes the old enemy, and leaves exactly one pending assembly.
- Smoke test: no `slot_mob` entity exists before the fourth piece impact and post-block gate complete.
- Smoke test: post-assembly roll state ignores damage until the roll completes.
