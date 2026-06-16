# v2.0.41 — skin selector / seeker readability fix

## Skin selector

- Fixed the skin preview centering: the skin core is now centered with transform-based placement instead of a hardcoded left offset.
- The selector keeps the same width as the menu controls.
- Added visible rarity color language on the selector border, preview border, and rarity/status line.
- Locked skins still show real model, name, rarity, and LOCKED state.

## Seeker

- SEK projectile size reduced to a smaller square lock-round.
- Projectile is now a square with cyan outline and inner white outline/cross mark.
- Removed the needle/chip look.
- Changed SEK shot sound to be closer to SHG: dry, chunky, shotgun-like, but higher-pitched.
- Removed the chirpy/bubbly lock-on tone.

## Checks

- node --check server/index.js
- node --check shared/*.js
- node --check src/*.js
- import smoke
