# v2.1.138 — render export sector mods hotfix

- Fixed browser module startup error caused by `SECTOR_MODS` import after the sector/room naming cleanup.
- Added a safe `SECTOR_MODS` export alias backed by existing `ROOM_MODS`.
- Added extra full module import smoke checks before packaging.
- Updated version/cache metadata.
