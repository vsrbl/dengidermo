# v2.1.76 — Casino / R HUD / boss reward stabilization hotfix

## Casino LOCK
- LOCK badge is aligned to the top of the BET TERMINAL panel.
- LOCK badge remains visible during the full casino spin, even if the server state consumes the lock before the animation ends.
- LOCK can now stack: a LOCK result can add more than one stored lock charge, especially on MID/HIGH bets.
- LOCK badge shows stacked state like `WPN x2` or multiple stored symbols.
- BET result text is constrained to a fixed-height area so long payout text no longer changes the casino window size.

## R-active HUD
- R-active is no longer plain inline text.
- R-active now renders as a compact ability card: key cell, ability name, timer/cooldown/status line.
- R-active hover tooltip includes detailed active/passive boss reward state.

## Shield HUD
- Removed the word `SHIELD` from inside the shield bar.
- Shield bar now shows only numeric value, matching HP/EXP bar style more cleanly.

## GHOST DECOY
- Slightly reduced the decoy duration curve.
- Reduced decoy visual size so it does not look oversized next to the player.

## KILL SWITCH
- KILL SWITCH no longer kills enemies by applying giant damage numbers.
- It now clears the field through the same direct-kill style as dev clear.
- Added a screen-space KILL SWITCH animation/flash on use.
- Enemy bullets are still deleted.

## ROOM WAGER
- ROOM WAGER card is positioned next to the INSTALL panel instead of being hidden at the far right.
- ROOM WAGER card has pointer-events enabled and is clickable.
- Wager card hover explains that the stake is paid only on failure.

## Boss reward visibility
- Boss passive/relic bonuses now appear as HUD badges with detailed hover descriptions.
- MIRROR status is visible as `MIRROR current/max`.
- NULL REVIVAL, BOSS KEY and AEGIS also show readable badge/tooltips.

## Install wait cleanup
- Removed noisy solo-mode “waiting for network confirm” behavior after upgrade selection.
- Data-loading wait panel is restricted to actual multiplayer wait cases.

## Splitter enemy fix
- Splitter children now appear immediately when the parent splits.
- Splitter children no longer run through the normal spawn-warning delay.
