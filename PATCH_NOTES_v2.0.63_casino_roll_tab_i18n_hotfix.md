# PATCH NOTES v2.0.65 — casino roll audio / TAB dossier / install i18n hotfix

## Fixes

- Fixed CASINO mutation roll spin continuing forever if the player dies during the rolling phase.
- Active roll timers/intervals now clear on:
  - player down;
  - run lost;
  - room transition;
  - new room entry;
  - dead-player update state.
- Casino modal reel intervals are also cleared on player down.

## HUD / room info

- Removed gameplay "TIP" lines from the live room HUD and feed.
- Room info now keeps mechanic/rule descriptions in hover explanations instead of pushing advice text during combat.
- Current/next room information still shows NOW / NEXT, danger, threat, reward and rules.

## TAB panel

- TAB panel is widened for desktop layouts.
- On wide windows it no longer gets the generic modal scroll behavior.
- Added room dossier cards:
  - NOW room;
  - NEXT room;
  - RUN/static/portal state.
- Added more player info to TAB:
  - EXP;
  - SPD;
  - weapon list with active slot marker;
  - skin id;
  - existing HP/LVL/GLD/DASH/DRN/ORB/Q/INSTALL.
- Extra explanations are available on hover through terminal-style tooltips.

## Localization

- INSTALL upgrade labels now localize in RU where previously raw English labels leaked.
- Added missing descriptions for high-tier/cursed INSTALL upgrades:
  - DRONES COPY PROC;
  - ORBITALS REFLECT;
  - DEBT ENGINE;
  - DMG +50% / HP -15;
  - LUCK +3 / SPD -10%.

## Checks

- node --check server/index.js
- node --check shared/*.js
- node --check src/*.js
- smoke import: sim / i18n / hud
- simulation smoke: create run → create player → start room → step → snapshot
- zip integrity test
