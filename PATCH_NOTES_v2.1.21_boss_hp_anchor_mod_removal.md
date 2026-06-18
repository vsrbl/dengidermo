# v2.1.21 — boss HP readout + anchor modifier removal

## Player-facing changes

- Removed the extra small white health indicator that could appear under the new bosses.
- Bosses now rely on their intended boss health readout only.
- Removed `ANCHOR GRAVITY` from the room modifier pool.
- `ANCHOR GRAVITY` can no longer be rolled as a normal room modifier or as a signal-contract modifier.

## What stayed

- The regular `ANC` enemy can still exist as a normal enemy type.
- The player `ANCHOR` active/mutation logic is untouched.
- The `ANCHOR+ / Якорный Кассир` boss remains in the boss rotation for now; it is its own boss pattern, not the removed room modifier.

## Technical notes

- Removed `anchor_gravity` from `ROOM_MODS`.
- Added `anchor_gravity` to removed room-mod normalization so old/stale generated plans drop it.
- Removed direct room-generation paths that could still inject `anchor_gravity`.
- Boss lower HP ticks now check `ENEMIES[kind].boss`, not only `kind === boss`.
- Version bumped to `v2.1.21`; protocol stays `3`.

## Checks

- `node --check` for server/shared/src files.
- Import checks for `sim`, `mapgen`, `data`, `hud`, `render`, `audio`, `protocol`.
- Archive integrity check with `unzip -t`.
