# PATCH NOTES v2.1.119 — Living Casino instant sector / UI hotfix

Дата: 2026-07-08

## Living Casino / Живое казино

- Sector ring plates are larger and wider.
- Removed the small inner square markers from sector plates.
- Removed tiny cooldown text from sector plates; cooldown remains in the HUD sector badge.
- Closed-ring companion/weapon clutter is cleaned up: the small LVC weapon block is hidden for Living Casino.
- GUARD, CHAIN and GHOST now trigger immediately when selected in the RMB sector ring.
- DMG, BET and COPY remain selected first and activate with the next LMB after the ring is closed.

## CHAIN

- CHAIN is now a persistent extra dash slot system instead of a timed dash buff.
- Base CHAIN gives 1 extra purple dash.
- Upgrading CHAIN increases the maximum extra purple dash slots.
- Activating CHAIN fills empty purple dash slots up to the current max; it does not stack above the slot cap.
- Purple dashes are still consumed before base dash charges.

## GUARD / GHOST

- GUARD now has its own activation FX and sound.
- GHOST still has its own activation sound and now triggers immediately from the sector ring.

## BET

- BET now shows an explicit three-slot roll above the player.
- Spin phase and result phase both draw slot panels with symbols.

## WPN rewards

- Living Casino WPN chests no longer replace the whole WPN pool with only sector upgrades.
- General weapon upgrades/stat upgrades are back.
- Direct weapon unlocks and weapon-specific SEK/RKT/SHG upgrades stay excluded for Living Casino.

## Combat

- Living Casino DMG auto-fire only shoots when a live spawned target has line-of-sight.
- It no longer fires at enemies behind walls or enemies that are still in spawn delay.
