# v2.0.39 — legendary skin dash identity / layered SFX

## Goal
Legendary skins should not be just a recolored dash with a different beep. The player body stays static, but dash becomes the place where the skin identity appears.

## Sound design
- Reworked `JACKPOT WOUND` dash SFX into a layered WebAudio sound: hard transient, low body, slot-machine stepped tones, coin scrape, short glitter tail.
- Reworked `DEAD CHANNEL` dash SFX into a layered WebAudio sound: static snap, low sync-loss drop, high scanline zaps, dead-air tail.
- Kept all audio procedural; no external assets.

## Legendary dash VFX
- `JACKPOT WOUND` dash now draws slot-reel cells, tiny jackpot glyphs, coin-box fragments and red wound stitches along the dash line.
- `DEAD CHANNEL` dash now draws broken TV frames, scanline debris, antenna shapes and `NO SIG` terminal text.
- Added stronger square start/end dash impacts for legendary skins.
- Still no animated player skin body; identity lives in dash VFX/SFX.

## Version
- Bumped to `v2.0.39`.
- Module filenames updated from `v2-0-32` to `v2-0-39`.
