# Terminal Casino Roguelike 2.1 — Static Storm Stack Hotfix

## Fixed
- Consolidated every Static Storm source into one unified stack level.
- Current room Static Storm now stacks from:
  - natural room modifier `static_rain`;
  - banked Static debt from cursed chests;
  - casino/bet Static debt;
  - active casino mutation debt;
  - bad tape false reel debt;
  - debt pulse debt;
  - previous Static room real strike carry;
  - Debt Engine player stat;
  - Casino Virus local storm.
- Casino Virus no longer runs a hidden separate Static rain loop; its active static is folded into the same total level.
- Natural Static Storm rooms can still seed next-room storm from real strikes; banked debt, Debt Engine, and Casino Virus do not cascade by themselves.
- Static Storm HUD is now a single top-right line only: total level plus visible source breakdown.
- Removed duplicate Static Storm labels from modifier chips, threat tags, Casino Virus reel text, and room invoice feed.
- `CLEAR STATIC STORM` still removes one banked/upcoming level, now preserving source accounting.

## Checks
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- ESM import checks for sim/audio/hud/i18n
- `zip -T`
