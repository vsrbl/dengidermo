# v2.1.80 — Contract Reroll / YouTube Controls / Casino Text Hotfix

## Casino
- Fixed long BET result text overflowing or being cut off.
- Casino result area is now fixed-height and scrolls internally, so the modal does not jump.
- Result chips now wrap instead of truncating important text.

## HUD
- Re-aligned the action history/feed to the left HUD blocks.

## Contract prizes
- Contract prizes are no longer next-room-only.
- Contract prizes now persist until used.
- Used contract-prize badges remain visible for the current room and disappear on the next room.
- Contract reroll now works on WPN, ABL and boss reward choices.
- Reroll now animates the choice cards.
- Reroll avoids giving the same options again when the pool has alternatives.

## TARGET LOCK
- TARGET LOCK now jumps to another live enemy on screen/near player when the locked target dies while the lock timer is still active.

## YouTube music
- Added compact top-left YouTube controls while a playlist exists/is active:
  - previous track;
  - play/pause;
  - next track;
  - volume -/+;
  - 8BIT mask toggle.
- Added an in-game 8-bit mask layer over YouTube playback. Browser restrictions prevent directly processing iframe audio through WebAudio, so this is a synced game-side mask rather than a true DSP filter on the YouTube stream.

## Version
- Updated to v2.1.80.
