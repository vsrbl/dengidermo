# v2.1.107 — room geometry rework

## Geometry pass
- Reworked the new v2.1.97 room archetypes so they are no longer thin-wall decorations inside open fields.
- `RIPPED TABLE`, `CROSS TERMINAL`, `RING TRACK`, `THREE PAYLINES`, `CLAMP ROOM`, and `MACHINE CORE` now use heavy structural blockers, real lanes, choke points, and safer center spawn clearance.
- New room walls now use chunky blockers instead of small decorative scraps.

## Cashier Maze
- Rebuilt `CASHIER MAZE / ЛАБИРИНТ КАССЫ` as a full-width procedural maze.
- Maze walls are much thicker and merged into longer runs to reduce visible seams.
- Removed shortcut carving: the route remains a real maze instead of a short arena with holes.
- Portal now picks the farthest reachable edge/dead-end style cell instead of a nearby/random cell.
- `BLACKOUT / ТЕМНОТА` is forced whenever this archetype is used, including dev override.
- Director pressure remains doubled for this archetype.

## Safety checks
- Smoke-tested all new room archetypes across many seeds.
- Checked default spawn area is clear.
- Checked portal does not spawn inside walls.
- Checked cashier maze portal stays far from the center.
