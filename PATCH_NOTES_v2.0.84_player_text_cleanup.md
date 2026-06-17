# PATCH NOTES — v2.0.91_player_text_cleanup

## Goal
Player-facing text cleanup pass for RU/EN.

## Changes
- Removed developer-facing wording from player descriptions:
  - no "old/new/now changed" style text;
  - no protocol/snapshot/client/server style wording in player tooltips;
  - no raw implementation details such as room.mods or payout internals.
- Russian version cleanup:
  - removed long English explanations from RU descriptions;
  - translated terms such as cooldown, damage-over-time, freeze-lock, eligible combat, cursed, pickups, side-upgrades;
  - added clean RU descriptions for Q cores and mutations instead of using raw fallback text.
- English version cleanup:
  - EN runtime descriptions no longer fall back to Russian data strings;
  - added missing EN descriptions for q_snap, q_blood, q_over and other upgrade/core/mutation surfaces;
  - simplified player-facing wording in upgrade/core/mutation/chest/enemy descriptions.
- Simplified menu/build text:
  - menu version now shows player-safe `VERSION vX · ONLINE/CHECKING` instead of CLIENT/SERVER/PROTO details;
  - update mismatch message no longer exposes client/server versions.
- Cleaned static HTML explains:
  - removed host/server wording from player hints;
  - removed "now/previous" style phrasing.
- Localized skin unlock duplicate feed in RU.

## Verification
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- Import smoke: `sim`, `hud`, `i18n`, `render`
- Runtime i18n audit:
  - EN upgrade/core/mutation/chest/enemy/weapon descriptions: 0 Cyrillic strings
  - RU upgrade/core/mutation/chest/enemy descriptions: 0 flagged dev/English technical terms
