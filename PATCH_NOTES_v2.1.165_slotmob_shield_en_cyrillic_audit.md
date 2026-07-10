# v2.1.165 — slotmob_shield_en_cyrillic_audit

## Gameplay
- Slot Overload / casino slot mob shield recovery retuned:
  - shield recovery delay after a hit is now x3 longer for `slot_mob`;
  - once recovery starts, shield regeneration rate is x3 faster for `slot_mob`.
- Other shell/shield enemies keep their previous recovery timing.

## EN localization audit
- Fixed the casino luck info card: EN now shows `LUCK +N` instead of `УДАЧА +N`.
- Localized floating effect labels that could receive RU strings from the server and display them raw in EN.
- Added EN fallbacks for runtime labels such as:
  - `УДАЧА`, `УДАЧА В КАЗИНО`;
  - `ВЫБОР СЕКТОРА`;
  - `ФОКУС`, `ПРИКАЗ`, `ПЕРЕХВАЧЕН`;
  - `СТАВКА: УРОН`, `ЗАДЕРЖКА ПОЯВЛЕНИЯ`.
- Dev luck trigger label is now EN-safe.

## Checks
- `node --check` all JS.
- ESM imports.
- Slot mob shield regen smoke: slot mob recovers x3 faster than a normal shell carrier after delay opens.
- EN label audit: checked key RU runtime labels resolve without Cyrillic in EN.
- `/health` reports v2.1.165.
