# v2.1.61 — UI corner frame + dark adaptive ambient

## UI
- Reduced the in-game HUD/overlay scale by 10% without shrinking the menu.
- Added thin terminal-colored corner brackets at the screen edges.
- Corner brackets use equal inset and short line lengths so they frame the view without covering HUD text.

## Music
- Added a darker adaptive melodic layer over the procedural digital ambient.
- Melodic phrases now change by game state: menu, float, combat, static/casino virus, boss, clear/portal.
- Combat, storm and boss states use darker roots, denser phrase timing and lower filters.
- Portal/clear state keeps the hum suppressed and uses softer consonant high phrases.
- Existing bright helper layers are reduced during danger so the darker adaptive phrase leads.
- The low hum remains situational; this patch focuses on making the melody react too.

## Checks
- JS syntax checks for audio, main, HUD and sim files.
- Shared protocol import smoke test.
- CSS brace balance check.
- Zip integrity test.
