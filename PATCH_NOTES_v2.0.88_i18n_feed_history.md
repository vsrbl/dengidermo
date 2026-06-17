# v2.0.88 — i18n text sweep + casino feed history

- Expanded RU/EN localization for HUD room dossier, TAB room intel, contract progress/fail reasons, contract favors, room checks, static-rain lines, casino-virus lines, WPN/ABL role tags, and denial messages.
- Cleaned Russian descriptions that still leaked English wording in weapon upgrades, dash/skin notes, enemy notes, and menu controls.
- Casino BET results now write a full summary into the top-left event feed for the local player and for other players.
- Feed history now keeps more entries for longer and supports multi-line long entries so casino rewards are not clipped.
- Casino denial errors from the sim are translated in HUD instead of leaking raw Russian into the English UI.

Checks to run:

```bash
node --check server/index.js
node --check shared/*.js
node --check src/*.js
node -e "import('./shared/sim.v2-0-88.js').then(()=>console.log('sim import ok'))"
node -e "import('./src/i18n.v2-0-88.js').then(()=>console.log('i18n import ok'))"
node -e "import('./src/hud.v2-0-88.js').then(()=>console.log('hud import ok'))"
node -e "import('./src/audio.v2-0-88.js').then(()=>console.log('audio import ok'))"
```
