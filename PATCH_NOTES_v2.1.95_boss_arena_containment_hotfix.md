# PATCH NOTES v2.1.95 — Boss Arena Containment Hotfix

## Fixes

- Boss/core entities can no longer be pushed outside the playable arena.
- Added a boss containment pass that clamps every boss to the current room bounds each tick/snapshot.
- If a boss somehow ends up outside the arena or buried in a wall, it is safely rescued back to a valid arena position instead of staying alive off-screen.
- Bosses are no longer moved as strongly by body-overlap and crowd-separation pushes, so the player or enemy packs cannot gradually shove them out of the room.
- Wall collision resolution now uses the previous position when deciding which side of a wall to resolve to, preventing fast pushes from resolving entities onto the far/outside face of outer walls.
- Boss enemies are never removed by the generic ghost-enemy cleanup just because they briefly went outside the world bounds; they are recovered instead.

## Notes

This specifically targets the bug where a boss remains alive but disappears beyond the level boundary, blocking the run from progressing.
