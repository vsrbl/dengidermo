# v2.1.140 — Living Casino BET / TABLE / wall projectile / text hotfix

Build ID: `living_casino_bet_table_wall_text_hotfix`

## Gameplay fixes

- Added a separate Living Casino BET recharge guard.
  - BET can no longer be re-triggered while its roll is still resolving or while its own cooldown is active.
  - COPY also respects this guard when trying to repeat BET.
- Fixed Living Casino ring selection with RLT / CRD.
  - Left mouse selection now waits for mouse release before the newly selected Roulette or Deck weapon can fire.
  - This prevents the selection click from immediately firing the chosen weapon.
- Hardened projectile-wall collision for fast or wall-adjacent shots.
  - Bullets now sweep between previous and current positions before wall resolution.
  - This reduces cases where a projectile fired while pressed against a wall appears from the far side.
- Fixed Roulette square disappearance in damper fields.
  - If an RLT square is stopped by projectile damping, it now performs the Roulette split effect instead of vanishing as a generic stopped bullet.

## Living Casino TABLE improvements

- Added new WPN-cache upgrade options for TABLE:
  - **КАРТА: РАДИУС +** — wider trap and slightly longer lifetime.
  - **КАРТА: МЕТКА +1** — one more threat can trigger the trap before it breaks.
  - **КАРТА: СТОП +** — longer stop and more hit damage.
- TABLE traps now store remaining triggers and avoid spending all triggers on the same threat.
- TABLE trap fields show remaining hits in their impact FX payload.

## Text and localization cleanup

- Replaced remaining player-facing “активка” wording with in-setting protocol/action phrasing.
- Cleaned more Russian terminology from English UI labels, especially casino symbols, Living Casino WPN choices, and menu/action labels.
- Replaced more Russian “комната” player-facing wording with “сектор”.
- Fixed several mixed RU/EN casino labels such as `РЕД`, `ДЖК`, and `ФИКС` in English explainers.

## Files touched

- `shared/protocol.v2-1.js`
- `shared/sim.v2-1.js`
- `src/hud.v2-1.js`
- `src/i18n.v2-1.js`
- `src/main.v2-1.js`
- `index.html`
- `404.html`
- `package.json`
