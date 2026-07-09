# v2.1.161 — living_casino_choice_fx_text_polish

## Living Casino
- Added a separate sector-pick pulse when the Living Casino ring closes with a selected sector.
- Added a stronger Living Casino selection sound (`lc_sector_pick`) separate from the small ring open/close tick.
- Weapon sectors and action sectors now both emit an explicit selection effect.

## Text / localization polish
- Cleaned ABL chest labels in Russian: dash/mobility rewards are localized through the UI label map.
- Shortened ABL, WPN, rare chest tooltips: removed repeated “available” lines and long duplicated role explanations.
- Fixed lingering English/dev wording in Russian tooltips, including `UNIQUE`, `MIRROR`, `RARITY`, and several dash/mobility labels.
- Cleaned RU/EN descriptions for dash rewards, Living Casino sectors, active mutations, and common chest hints.
- Fixed several small wording issues and typos in chest/readability text.

## Checks
- JS syntax check.
- ESM imports.
- Living Casino ring smoke: open emits `lc_sector_ring`, close/select emits `lc_sector_ring` + `lc_sector_pick`.
- i18n smoke: RU/EN labels and ABL descriptions localize cleanly.
- Server health check.
- Archive integrity check.
