# PATCH NOTES v2.1.121 — Hero Selector / Menu YouTube Cleanup

## Fixed / Changed

- Living Casino sector ring no longer prints the extra `ВЫБРАТЬ` label above the selected plate.
- Main menu YouTube block no longer shows the embedded player/visual window.
  - Playlist input, LOAD and PLAY controls remain.
  - The hidden iframe container is kept offscreen for playback only.
- Added a dedicated `ГЕРОЙ` selector in the freed menu space.
  - `БАЗОВЫЙ МОДУЛЬ` — regular starting core.
  - `ЖИВОЕ КАЗИНО` — starts with LVC and sector mechanics.
- Hero selection is now sent as `skin.hero` and is handled separately from skin visuals.
  - Skins remain cosmetic.
  - Living Casino is no longer only a skin-driven mode.

## Technical

- Added `hero` sanitization to the player appearance payload.
- `isLivingCasinoPlayer` now checks hero/loadout state instead of relying on skin id.
- Bumped version to `v2.1.121` / build `hero_selector_menu_youtube_cleanup`.
