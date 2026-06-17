# nncckkrr v2.0.77 — RKT remote detonation / inspect key / EN text sweep

## Input
- Inspect mode moved from right mouse button to `Space`.
- `Space` no longer fires the weapon.
- Left mouse remains primary fire.
- Right mouse button is now reserved for weapon secondary actions.

## ROCKETGUN rework
- Added `RKT REMOTE DETONATOR` WPN upgrade.
  - RMB detonates launched rockets one by one.
  - Detonation order is oldest rocket first, then next oldest, etc.
  - Without the upgrade, RMB does not detonate rockets.
- Added `RKT STUN BLASTS` WPN upgrade.
  - All ROCKETGUN explosions can briefly stun enemies.
  - Applies to main rocket explosions, cluster mini-blasts, and static mines.
- Added `RKT SCATTER BLASTS` WPN upgrade.
  - All ROCKETGUN explosions push enemies outward harder.
  - Applies to main rocket explosions, cluster mini-blasts, and static mines.
- Doubled radius of RKT additional explosions:
  - cluster mini-blast radius is now doubled;
  - RKT static mine blast radius is now doubled.

## English localization
- Fixed English-mode fallback text so Russian fallback descriptions are not shown in English tooltips.
- Added English descriptions for new RKT upgrades.
- Updated controls text in RU/EN:
  - `LMB` = fire;
  - `RMB` = RKT detonate;
  - `Space` = inspect.

## Notes
- Existing portal/contract timing from v2.0.71 is unchanged.
- Existing square green portal burst from v2.0.73 is unchanged.
