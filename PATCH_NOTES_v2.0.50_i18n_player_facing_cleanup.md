# PATCH NOTES — v2.0.50 i18n player-facing cleanup

## Player-facing explanations cleanup

- Rechecked static UI tooltips and many dynamic HUD explanations.
- Removed/rewrote text that exposed internal implementation details to players:
  - no deploy/cache wording in the version tooltip;
  - no “host browser runs the simulation” wording in create-room tooltip;
  - no “server/signaling/room count” status text in the main menu;
  - no direct “host decides result” casino wording;
  - no director/internal pack label in the room banner.
- Reworded explanations to be gameplay-facing: room, portal, chests, BET, Q, resources, run state.

## RU / ENG language selection

- Added language selector in the main menu: `RU / ENG`.
- Added compact language selector in the HUD top row.
- Language is saved in `localStorage`.
- Switching language updates:
  - menu labels;
  - buttons and placeholders;
  - HUD tooltips;
  - run objective text;
  - interaction prompts;
  - TAB panel;
  - install / weapon / ability chest explanations;
  - casino result/status text;
  - feed/banner messages where they are player-facing;
  - skin status labels;
  - common world inspect hints.

## New code

- Added `src/i18n.v2-0-50.js`:
  - language state;
  - static UI translation pass;
  - player-facing text cleanup helpers;
  - localized descriptions for weapons, chests, pickups, enemies, upgrades, Q cores, and Q mutations.

## Notes

- Short code-like labels such as `GLD`, `EXP`, `WPN`, `ABL`, `SHG`, `SEK`, `RKT`, `Q`, `SKN`, enemy codes, and room mod names remain in the game’s dirty terminal language.
- Dev Mode remains developer-only and is not treated as normal player-facing UI.
