# Terminal Casino Roguelike 2.1 — Big Balance / UI / Bugfix Pass

## Fixed
- Portal cleanup now opens when the room is actually clean; failed contracts such as Fast Cleanup no longer block portal opening.
- Gold Fever description rewritten to match the actual room rule.
- Blood Payment casino/chest HP prices no longer collapse to identical 100 HP values in deeper loops.
- Blood Payment can now be lethal by design; Death Insurance can save the player from lethal HP payments.
- Casino LOW stakes no longer roll ABL rewards.
- Static Storm stack readout no longer shows a first leading `+`, and player-facing cap/limit wording is removed.
- `STATIC Q` upgrade renamed to `STATIC CORE`.
- Hidden skin event feed no longer duplicates the same message.
- Chill-room chest prices no longer use late-loop price scaling.
- Herald now stays inside the DMP nest radius when spawned as a Herald/DMP synergy.
- Level-up no longer flashes the screen edge; it now blinks only the HP/XP/LVL HUD area.
- Level-up card was moved lower to avoid portal-open overlap.
- Menu sliders were simplified to remove the right-edge green strip artifact.
- Menu language layout now uses fixed heights/widths to reduce jumping.
- Locked skin visual was reworked into a cleaner terminal locked card.
- Top-left HUD spacing was expanded so feed/modifiers/prize rows overlap less.

## Balance
- DASH: VOID RIFT dash slash damage cut by 50%.
- Music max output doubled again.
- Late-loop music now reacts more to loop/depth and enemy crowding; cleared rooms calm down more.
- BSC chest loot scales much faster with loop depth.
- Mob GLD/EXP loot now scales moderately with loop depth.
- RAR chest is now cheaper than ABL chest.

## Audio
- Added careful Static Storm strike sound.
- Static Storm strikes add a small music-chaos pulse.

## Checks
- `node --check server/index.js`
- `node --check shared/*.js`
- `node --check src/*.js`
- import checks for sim/audio/hud/effects/data
- `zip -T`
