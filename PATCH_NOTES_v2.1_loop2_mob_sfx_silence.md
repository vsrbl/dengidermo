# Terminal Casino Roguelike 2.1 — Loop 2 Mob SFX Silence Hotfix

## Reason
Some loop 2 support enemies and pack-synergy markers could still play the same arrival sting used for real director waves. In play this made ordinary mobs feel like they were emitting strange unexplained event sounds.

## Changes
- `enemy_combo` events are now visual/readability markers only.
- Removed all one-shot wave/director audio from ordinary enemy combo markers:
  - `ANCHOR FIELD`
  - `DMP NEST`
  - `HERALD RALLY`
  - `ORB GUARD`
  - `SPL SWARM`
  - pack markers like `WRD BATTERY`, `LCH WALL`, `SCRAMBLE`, etc.
- Removed `enemy_combo` as a music-chaos trigger.
- Kept actual `director_wave` audio for real wave/pack arrivals.
- Kept all enemy mechanics and visuals intact.

## Checks
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- ESM import checks for `sim`, `i18n`, `hud`, `audio`
- `zip -T`
