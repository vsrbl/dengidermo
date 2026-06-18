# Terminal Casino Roguelike 2.1 — Text / Herald / Level FX Hotfix

## Player-facing text cleanup
- Audited RU/EN player-facing upgrade, ability, modifier, chest, enemy, and tooltip descriptions.
- Removed or softened technical/internal wording such as stacks/proc/core/cast/ticks/slug/reload penalty where it could show to players.
- Reworded fallback English text so untranslated descriptions no longer mention internal role tags.
- Kept game terms that are part of the UI identity: GLD, BET, WPN, ABL, INSTALL, Q.

## Herald floor line rework
- Herald cast line is now generated once per cast and kept fixed as a floor sigil.
- Each Herald cast gets a unique seeded path, so the broken drawing is no longer always the same.
- Removed crawling/moving dash animation from the line; it now reads as a drawn warning on the floor.
- The line still fills over the cast duration, but the shape itself stays stable.

## Level-up visual cleanup
- Removed the full-screen level-up sweep line.
- Added a terminal-green edge pulse, similar to a damage vignette but INSTALL-colored.
- Simplified the level-up plaque further: cleaner INSTALL-green terminal box, no extra progress bar.

## Checks
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- ESM import checks: sim, i18n, hud, effects
- `zip -T`
