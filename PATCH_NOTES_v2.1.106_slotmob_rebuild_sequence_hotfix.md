# v2.1.106 — Slot Mob rebuild sequence hotfix

- Rebuilt the casino overload/slot-mob visual chain as one strict sequence:
  1. casino reels overload inside the terminal;
  2. casino window closes with an extra scary break sound;
  3. the world slot chest shakes inactive;
  4. the slot chest physically breaks into exactly four colored quarter-blocks;
  5. the blocks bounce/settle with procedural velocities;
  6. after 3 seconds they magnetize back one by one;
  7. each join has stronger shake/audio/impact than the previous join;
  8. only after the fourth join and final burst does the visible slot mob roll start.
- Removed the duplicate first-spawn `slot_mob_rebuild` visual that made a second independent block animation and made the mob appear before the four blocks finished assembling.
- Slot mob hidden stage is now non-physical for crowd/player push so the invisible mob cannot drift while the block animation is playing.
- Four rebuild blocks are now different colors and are sized as exact quarters of the slot mob body, so the final square is literally assembled from them.
- Added server-driven FX/audio events for slot break, each magnet impact, and the final assemble burst.
- Casino overload modal close now plays the scary break/static sound exactly when the BET window closes.
