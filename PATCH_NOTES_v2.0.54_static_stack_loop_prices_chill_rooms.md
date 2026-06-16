# PATCH NOTES — v2.0.55 static stack / loop prices / chill rooms

- `STATIC RAIN` now tracks how many strikes landed in a room. If the room produced many strikes, the next room receives stacked static rain pressure.
- Static rain stacks increase strike frequency, strike count, radius, and damage.
- Static debt is no longer a boolean; it can carry multiple stacks into the next eligible non-boss room.
- Chest prices now scale by loop so late-run GLD stockpiles stay meaningful.
- BET terminal stakes now scale by loop as activities become more expensive.
- Added rare `CHILL ROOM` special rooms: no enemies, portal open from the start, casino terminals, and very expensive WPN/ABL chests.
- Chill room WPN/ABL chests use extra cost multipliers on top of loop scaling.
