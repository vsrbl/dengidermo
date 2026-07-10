# v2.1.169 — Living Casino guns, unlocks, Trojan rooms

## Living Casino rebuild
- Removed the casino-ring combat loop from active Living Casino play.
- Living Casino now carries two automatic guns: the base LVC gun and SPK Control Sparks.
- LMB marks targets for the base gun; RMB marks targets for Control Sparks.
- Each gun draws its own aim line and rotates toward priority targets before committing fire.
- Base LVC shots now home toward their assigned target while still colliding with walls, enemies, and obstacles.
- Added multi-target LVC marking, base-gun damage, and base-gun fire-rate upgrades.
- Added SPK upgrades for spark count, damage, hold time, detection range, and reload.
- Added a right-side Living Casino HUD card for target slots, spark locks, spark cooldown, and gun state.

## Progression and unlocks
- A full cleanup now ends after 5 loops instead of 10.
- Living Casino and Process Controller are locked by default.
- Living Casino unlocks after deleting the Hidden Casino Virus.
- Process Controller unlocks after completing the cleanup.
- Debug tools can now unlock/lock all heroes and skins.

## Hidden Casino Virus
- The slot-mob final defeat is now presented as the Hidden Casino Virus deletion.
- Its defeat uses a boss-style victory burst and pays a large loop-scaled GLD payout.
- The victory event displays the Living Casino unlock message.

## Room Wager
- Room Wager is no longer tied to the boss prize flow.
- It turns on permanently after the second boss for the rest of the run.
- Added hero-specific wager stakes, conditions, and prizes for Living Casino and Process Controller.

## Trojan modifier
- Added the Trojan room modifier.
- One eligible chest can be infected.
- Opening an infected chest detonates it, visibly knocks the player back, spawns a small swarm, and locks the portal until the room is clean.

## Enemy pool
- Added Wall Clinger from loop 3 onward.
- It moves along walls, keeps distance, opens to fire fast three-shot bursts, then closes into a strong shield during reload.
- It is wired into existing enemy visuals, shields, bullets, rooms, and hero interactions.

## Fixes and verification
- Added Russian/English labels for new room and HUD states.
- Checked all JavaScript files with `node --check`.
- Verified `shared/sim.v2-1.js` import and a small Living Casino simulation smoke test.
