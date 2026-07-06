# PATCH NOTES v2.1.101 — Cursor / 5-slot chest / debug rooms / seeker swarm / boss key hotfix

## Cursor
- Forced the native system cursor to stay hidden over every UI element.
- Fixed cases where the Windows hand cursor could briefly appear over buttons, debug controls, casino controls, language buttons or overlay UI.
- Kept the custom terminal cursor hard-snapped with no transition/smoothing.

## Valuable 5-slot chests
- Hardened WPN/ABL 5-slot chest logic so they always keep `2 picks total` and `picks remaining` metadata.
- After the first pick from a 5-slot WPN/ABL chest, the offer stays open with 4 remaining cards and `1/2` picks left.
- Added fallback normalization for old/dev/saved offers that have `slotCount: 5` but missing `picksTotal` fields.

## Debug rooms
- Added the new room archetypes to the actual dev override whitelist, not just the dropdown UI.
- Debug room override now accepts:
  - RIPPED TABLE
  - CROSS TERMINAL
  - RING TRACK
  - THREE PAYLINES
  - CLAMP ROOM
  - CASHIER MAZE
  - MACHINE CORE
- Added readable labels for the new room types in the debug dropdown.

## Seeker swarm
- Seeker swarm bullets now launch with a tiny per-bullet delay instead of batches of 5 at once.
- This should make the swarm read as a stream rather than one merged visual blob.

## BOSS KEY
- Spending BOSS KEY now pushes a dedicated on-screen banner.
- Spending BOSS KEY now writes to the event history/feed.
- The message explicitly says that the chest was opened for free and upgraded to max rarity.

## Checks
- `node --check` passed for changed JS modules.
- Smoke-test confirmed 5-slot WPN/ABL keeps the second pick.
- `unzip -t` passed for the final archive.
