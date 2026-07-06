# PATCH NOTES v2.1.97 — Extra Room Shapes / Cashier Maze

## Room shapes

- Added new procedural room archetypes on top of the existing pool:
  - `RIPPED TABLE / РАЗОРВАННЫЙ СТОЛ`
  - `CROSS TERMINAL / КРЕСТОВОЙ ТЕРМИНАЛ`
  - `RING TRACK / КОЛЬЦЕВОЙ ТРЕК`
  - `THREE PAYLINES / ТРИ ЛИНИИ ВЫПЛАТЫ`
  - `CLAMP ROOM / КОМНАТА-ЗАЖИМ`
  - `MACHINE CORE / ЯДРО АВТОМАТА`
  - `CASHIER MAZE / ЛАБИРИНТ КАССЫ`

## Explicitly not added

- `DOUBLE SECTOR / ДВОЙНОЙ СЕКТОР` is not in the generation pool.
- `PULSING SQUARE / ПУЛЬСИРУЮЩИЙ КВАДРАТ` is not in the generation pool.
- `SPLIT GRID / РАСЩЕПЛЁННАЯ СЕТКА` is not in the generation pool.

## Cashier Maze

- Reworked `CASHIER MAZE` as a real procedural maze, not short cover walls.
- Maze uses connected cell carving with long paths and dead ends.
- Player spawn lobby is kept clear for all 4 multiplayer spawn positions.
- Portal is placed in a far corner cell, away from the center/start area.
- Cashier Maze has approximately x2 base room quota.
- Director target budget is also multiplied for Cashier Maze, on top of normal loop/modifier scaling.

## HUD / Dev

- Added RU/EN labels for all new archetypes.
- Added new archetypes to the dev room override dropdown.
- Added threat tags and room tips for the new shapes.

## Safety checks

- Smoke-tested forced generation for all new archetypes across many seeds.
- Verified default player spawn points do not start inside walls.
- Verified generated portals do not start inside walls.
- Verified Cashier Maze portals are placed far from center.
