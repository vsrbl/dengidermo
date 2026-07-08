# v2.1.112 — Slot Mob No-Ghost-AI Hotfix

- Removed the hidden/rebuild enemy workaround from casino slot mob assembly.
- A casino slot mob entity is not created until the four assembly pieces have finished the strict sequence.
- After the final piece impact, the newly-created mob uses a visible non-combat roll/spawn state.
- During that roll state it cannot move, shoot, touch-damage, or be hit.
- Removed the extra `slot_mob_rebuild` visual event on intermediate lives so block assembly is no longer a separate fake animation layered over a live enemy.
- Roll tick sounds now start only after the actual visible slot mob entity exists.
- This prevents invisible casino mob shots/sounds before assembly is complete.
