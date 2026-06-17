# PATCH NOTES v2.0.80 — portal-open room timer fix

Timer semantics hotfix.

## Changed

- Room solve time now freezes at the exact moment the portal opens.
- `FAST CLEAN`, time-based contracts, room invoice timing, and objective progress use `solvedAt`, not the later moment when a player physically enters the portal.
- Added `solvedTime` / `solved` room snapshot fields so HUD/TAB can show room completion timing cleanly.
- `ROOM CHECK` now shows `SOLVED Ns` for clearer timing feedback.
- Chill rooms now use the same portal-open path as normal rooms, so they also mark `solvedAt` consistently.

## Rule

```txt
ROOM TIMER STOPS WHEN PORTAL OPENS.
ENTERING THE PORTAL IS ONLY THE TRANSITION ACTION.
```

## Checks

- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- smoke import: sim, hud
- regression: portal opens at 12s, player enters at 99s → invoice `SOLVED 12s`, `FAST` true
