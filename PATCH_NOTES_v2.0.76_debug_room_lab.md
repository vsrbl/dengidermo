# v2.0.91 — Debug Room Lab

## Dev mode expansion
- Expanded the F2 developer panel into a room/debug lab for solo/host testing.
- Added `OPEN PORTAL NOW`: immediately opens the current portal through the normal `openPortal()` path, so portal-open contract settlement still happens correctly.
- Added `WPN OFFER`: opens a WPN chest offer directly without needing to find/open a weapon chest.

## Next room forcing
- Added a NEXT ROOM LAB section to the F2 panel.
- Host can lock the next generated room by:
  - category: AUTO / GRID / VOID / CORE / BOSS / CHILL
  - special room: NONE / SIGNAL CONTRACT / REWARD POCKET / DEBT NODE / CHILL ROOM
  - archetype: AUTO / PANIC BOX / COMPACT / STANDARD / WIDE / LONG LANE / LOUNGE / BOSS
  - room modifiers: any explicit set up to 4 mods.
- Added `AUTO NEXT` to clear the forced override and return to normal generation.
- The override updates the visible NEXT preview immediately and is consumed by the normal room generation path.

## Exact modifier testing
- Forced room modifiers are exact: signal/debt/reward special rooms no longer auto-inject extra special modifiers when the debug override supplies an explicit modifier list.
- This makes it possible to test individual modifiers and combinations without random noise.

## Safety
- Debug commands remain host/solo only.
- Guest clients cannot execute dev commands.
- Portal/contract logic was not bypassed; instant portal still uses the real portal-open settlement rules from v2.0.71.
