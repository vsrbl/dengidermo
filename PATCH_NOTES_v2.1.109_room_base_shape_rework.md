# v2.1.109 — Room Base Shape Rework

## Core idea
- Reworked the new room archetypes as base-room silhouettes instead of using procedural/internal walls as the main room identity.
- Each new archetype now changes its playable footprint, base size, borders, voids, and committed corridors before any smaller per-run variation is applied.
- Procedural variation remains a secondary layer only; it no longer carries the whole concept of the room.

## Cashier Maze
- Rebuilt `ЛАБИРИНТ КАССЫ` as a very wide blackout cashier bunker.
- Maze now uses 8x4 wide cells with thick merged seamless walls.
- Main maze walls are intentionally thick enough to prevent dash skipping.
- Center spawn remains a small hub, not a wide empty arena.
- Portal still goes to a far reachable cell and `BLACKOUT` is forced every time.

## New room archetypes
- Reworked base silhouettes for:
  - `РАЗОРВАННЫЙ СТОЛ`
  - `КРЕСТОВОЙ ТЕРМИНАЛ`
  - `КОЛЬЦЕВОЙ ТРЕК`
  - `ТРИ ЛИНИИ ВЫПЛАТЫ`
  - `КОМНАТА-ЗАЖИМ`
  - `ЯДРО АВТОМАТА`
- These now use different base sizes/footprints instead of all inheriting the same full-size arena.
- Added structural voids, thick base boundaries, real lanes, hubs, jaws, arms, and corridors.

## Safety / validation
- Improved portal placement fallback so portals do not fall back into structural base walls in tighter room shapes.
- Smoke-tested all new archetypes over 1000 seeds:
  - all four player spawns clear;
  - portal clear;
  - portal not centered;
  - cashier maze always has blackout.
