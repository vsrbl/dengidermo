# v2.1.71 — Boss Signature / R-Active Rework

## Boss rewards
- Replaced the old weak boss signatures with a new boss reward pool.
- Boss reward offers now show 2 choices instead of 3.
- Removed old post-boss options from the active pool: QUARANTINE BUFFER, EMERGENCY CLEANSE, FALSE ZERO, DEAF COMMAND, HUNT ROUTE, RED OVERDRIVE, AIM GLITCH, INCOMPLETE DELETE, INSURANCE PROCESS.
- Added new boss reward types:
  - TARGET LOCK
  - REDLINE BOOST
  - GHOST DECOY
  - REWIND MARK
  - KILL SWITCH
  - SPAWN HOLD
  - AEGIS PROCESS
  - MIRROR PAYOUT
  - NULL REVIVAL
  - ROOM WAGER
  - BOSS KEY

## R-active slot
- Added a new R-active input on `R`.
- Added HUD readout for current R-active, duration and cooldown.
- R-active choices replace the current R-active unless the same one is picked again.
- Repeated TARGET LOCK, REDLINE BOOST, GHOST DECOY and REWIND MARK picks stack their intended values.

## TARGET LOCK
- `R` locks onto an enemy near the cursor.
- While active, the aiming line and weapon direction track the locked enemy instead of the cursor.
- Has duration and cooldown.
- Stacks only increase lock duration.

## REDLINE BOOST
- `R` gives a strong speed burst.
- Base duration is 3 seconds.
- Cooldown is 14 seconds.
- Stacks increase speed and duration.

## GHOST DECOY
- `R` makes the player hidden from enemy targeting.
- A decoy stays at the activation point.
- Enemies target and fire toward the decoy while it lasts.
- Stacks increase duration.

## REWIND MARK
- First `R` places a return mark.
- Second `R` returns the player to the mark.
- On return, nearby enemies are knocked away and stunned.
- Enemy bullets near the return point are erased.
- Stacks increase return window and stun strength.

## KILL SWITCH
- One-use R-active.
- Kills all current enemies on screen, including bosses.
- Erases enemy bullets.
- Once KILL SWITCH has been chosen in a run, it can never appear again in that same run.
- MIRROR does not duplicate KILL SWITCH.

## AEGIS PROCESS
- Adds a real player shield layer.
- Each stack gives +45 shield capacity.
- Shield restores at room start.
- Shield absorbs damage before HP.
- Player shield uses the enemy shell visual language: square dashed frame, inner frame, cracks and break pulse.
- Added a SHIELD bar above HP.

## SPAWN HOLD
- Enemy spawn warning fields last much longer.
- Stacks increase delay.
- Delayed spawns show as longer warning fields before enemies enter the room.

## MIRROR PAYOUT
- Works only on reward screens with choices.
- Does not work on RAR, skins, BET wins, pickups, GLD/EXP/HEA drops or no-choice rewards.
- Does not compensate unique/non-stackable rewards.
- If a mirrored reward cannot stack, the mirror charge is spent and shows MIRROR FAILED — UNIQUE.
- Mirror charges are spent once per loop and restored at the beginning of the next loop.

## NULL REVIVAL
- Adds revive charges.
- If the player would die, one charge restores the player at 45% max HP.
- Clears nearby enemy bullets, knocks/stuns nearby enemies and gives brief invulnerability.

## ROOM WAGER
- Unlocks a new wager card during the install phase.
- The wager appears to the right of the install/reward window.
- One button: ACCEPT.
- The player pays the stake only if the condition fails.
- Supports room, loop and permanent risk/prize categories.
- Implemented initial wager conditions around dash, Q/R use, kills, HP and no-damage play.

## BOSS KEY
- Adds key charges.
- The first chest opened in a loop automatically consumes a key.
- The key makes that chest free, max rarity and 5-slot where applicable.

## UI / visuals
- Added R-active HUD text.
- Added SHIELD bar beside HP.
- Added ROOM WAGER card.
- Added player AEGIS shell rendering.
- Added ghost decoy world rendering.
- TARGET LOCK changes the aim tether from cursor-line to locked target-line.
