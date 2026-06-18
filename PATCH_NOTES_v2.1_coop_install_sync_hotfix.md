# Terminal Casino Roguelike 2.1 — Co-op INSTALL Sync Hotfix

Fixes a possible co-op upgrade-selection desync where one player could appear unable to choose or could lose one queued INSTALL stack.

## Changed
- INSTALL offers now have a server-side offer id/token.
- Client sends the token back with the selected option, preventing stale/delayed picks from applying to the wrong offer.
- If a stale/invalid pick arrives, the host resends the current offer instead of leaving the client locked.
- If the host auto-picks an expired INSTALL offer, the target client now receives a reliable `offer_close` when the queue is empty.
- INSTALL timeout increased from 15s to 24s per queued choice.
- Removed the old global 60s install-phase cutoff. Multiple queued choices across multiple players are now resolved one-by-one; the room advances only after every connected player has no pending INSTALL offer left.
- Added a guard that recreates an INSTALL offer if a connected player has `pending > 0` but no active offer.

## Why
Previously the per-offer timer and the global phase timer could conflict when several players had multiple queued INSTALL choices, especially in co-op where EXP is shared. The phase could advance while one player still effectively had pending INSTALL stacks, which looked like a skipped upgrade.

## Checks
- `node --check` on server/shared/src JS files.
- ESM import checks for sim/audio/hud/i18n/local/net. `main` is browser-only and was syntax-checked with `node --check`.
- Manual Node simulation: 2 players, one with 4 pending INSTALL and one with 1 pending INSTALL. The room stayed in install phase until all 5 choices resolved.
