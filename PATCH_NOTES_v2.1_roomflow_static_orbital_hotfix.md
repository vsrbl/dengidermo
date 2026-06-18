# Terminal Casino Roguelike 2.1 — Roomflow / Static / Orbital Hotfix

## Fixed
- Room completion no longer uses the small room quota as the director stop condition.
- Normal combat rooms now wait for the encounter director's real spawn budget before opening the portal.
- Clearing the first small pack quickly now pulls the next director pack forward instead of opening the portal early.
- HUD room clear count now uses the effective director encounter target, so the visible goal matches the actual room flow.
- Static Storm carry source label changed from residual wording to previous-room hit wording.
- Static Storm carry is now converted from real hits into storm pressure, instead of treating raw hit count as direct storm levels.
- Static Storm strike radius and extra strike growth were softened so high stacks do not cover the whole room as easily.
- ORBITALS REFLECT description now explicitly says orbitals still seek enemies and additionally intercept nearby enemy bullets.

## Notes
- Hunter Waves and Casino Virus keep their special completion rules.
- Failed contracts still do not block portal opening once the actual room encounter is complete.
