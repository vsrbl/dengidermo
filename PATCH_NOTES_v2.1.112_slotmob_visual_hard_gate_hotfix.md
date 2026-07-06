# v2.1.112 — slot mob visual hard gate hotfix

- Added a client-side visual hard gate for casino slot mob assembly.
- If the four block assembly FX is still active near the spawn point, `slot_mob` is not drawn even if a snapshot already contains the enemy.
- `slot_mob_roll`, roll ticks, and assemble burst are suppressed/deferred while the active block assembly is still visible.
- Increased the authoritative post-block spawn gate so the server waits much longer after the 4th block impact before creating the enemy.
- This makes the visible sequence strict: blocks lie -> block 1 sticks -> block 2 -> block 3 -> block 4 -> final impact -> blocks gone -> mob appears/rolls.
