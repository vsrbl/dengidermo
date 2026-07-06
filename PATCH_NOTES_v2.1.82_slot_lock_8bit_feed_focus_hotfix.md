# PATCH NOTES v2.1.82 — Slot LOCK / 8BIT / feed focus hotfix

## Fixed

- Feed/history under the version HUD is now aligned with the visually scaled top-left HUD block instead of sitting too far left.
- Removed browser focus outlines after clicking YouTube mini-player buttons and language buttons.
- Casino results now report all slot-level rewards, misses, static debt, LOCK morphs, and fixed-slot usage into the event feed.
- Casino LOCK is now per-slot:
  - when `LOCK` appears inside any reel cell, that cell resolves immediately;
  - `LOCK` dissolves, then spins a mini morph animation;
  - it becomes a random non-LOCK block such as `GLD`, `STC`, `WPN`, `EXP`, etc.;
  - that exact slot stays fixed while the BET terminal remains open;
  - only non-fixed slots keep spinning on later bets;
  - all three slots can become fixed;
  - closing the BET terminal clears all slot locks.
- Removed the old “LOCK as next whole-outcome override” behavior.

## Audio

- 8BIT is much stronger:
  - game audio uses a harsher 3-bit / low sample-rate crusher;
  - YouTube mode gets a much louder chiptune mask layer because iframe audio cannot be directly routed through WebAudio.

## Notes

- `casino_close` was added as a client-to-host game message so slot locks reset on terminal close.
