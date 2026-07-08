# PATCH NOTES v2.1.115 — Living Casino Hero Prototype

## New hero/loadout: ЖИВОЕ КАЗИНО

- Added a new selectable basic loadout/skin: `ЖИВОЕ КАЗИНО`.
- This loadout does **not** use normal weapon firing.
- LMB now activates the currently aimed sector around the player core.
- The current first sector is `DMG`.

## Sector system prototype

Living Casino now keeps 1–6 square sectors around the player.
The cursor direction selects which sector is active.

Implemented base sectors:

- `DMG` — starts a timed auto-fire window. The hero launches homing casino bullets automatically for about 10 seconds, then the sector reloads.
- `GUARD` — pushes nearby enemies away and grants a temporary shield whose capacity decays over time.
- `CHAIN` — grants extra fast purple dash charges while the sector window is active. These are separate from normal dash charges.
- `BET` — makes a small random micro-stake using GLD / HP / EXP and pays a random GLD / HP / EXP result.
- `COPY` — repeats the previous non-copy sector at reduced power.
- `GHOST` — briefly hides the player from enemy aggro without making them immune to damage.

## WPN chest route for Living Casino

- WPN chests no longer offer normal weapons to Living Casino.
- They now offer:
  - adding a new sector slot and sector type;
  - upgrading an existing sector;
  - improving `COPY` power;
  - improving `BET` odds.

## Visuals

- Living Casino sectors are sent in the authoritative companion snapshot.
- Sector squares render around the player with ready/active/reload/selected states.
- `CHAIN` dash uses the purple dash trail language.

## Notes

This is the first playable prototype pass. The goal is to validate the feel of: no normal shooting, aim-to-select sectors, LMB-to-activate sector, and WPN-driven sector growth.
