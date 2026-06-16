# PATCH NOTES v2.0.62 — room info / Static Rain audit

## Player-facing room information

- HUD now shows a stronger current-room block on the top-right:
  - `NOW: <ROOM SIZE> · <ROOM MODIFIERS>`
  - `RULE: <short explanation of what this room does>`
- HUD still shows `NEXT`, but the next-room preview is clearer:
  - next room size/archetype;
  - next room modifiers;
  - reward tags;
  - immediate Static Rain only when it actually applies to the next room.
- TAB panel also distinguishes immediate Static Rain from banked Static Rain.

## Static Rain logic audit/fix

Confirmed and fixed a real clarity/logic bug:

- During a natural/seeding Static Rain room, real strike count can seed the next eligible room:
  - 1 strike = next level 1;
  - 2 strikes = next level 2;
  - etc., capped at LVL 7.
- During transition, the strike count is moved into carry exactly once.
- Fixed UI/logic double-counting where `NEXT STATIC` could briefly include both current strikes and already-carried strikes.
- Payoff Static Rain rooms are now explicitly marked internally as `paid`.
- Payoff rooms do not seed another Static Rain, even if they produce strikes.
- If Static Rain is banked but the immediate next room is boss/chill/otherwise ineligible, HUD shows `STATIC BANKED LVL X` instead of implying it is in the very next room.

## Static Rain modes

- `seeding`: natural/debt-engine Static Rain room; real strikes can create next static level.
- `paid`: pending Static Rain debt is being paid in this room; strikes do not create another debt.

## Checks

- Syntax checks passed for server/shared/src JS.
- Smoke imports passed for sim/mapgen/audio/hud.
- Static Rain regression passed:
  - natural room with 2 strikes shows next level 2;
  - transition keeps level 2, not 4;
  - next payoff room gets LVL 2;
  - payoff room strikes do not seed a new next Static Rain.
