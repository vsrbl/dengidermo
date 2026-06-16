# PATCH NOTES — v2.0.55 dash stun + ESC random choice

## DASH STUN

- Replaced the unclear `DASH CUTS BULLETS` upgrade fantasy with `DASH STUN`.
- Kept the legacy internal id `dashcut` for save/offer compatibility, but all player-facing labels now say `DASH STUN`.
- Dash now stuns enemies close to the dash path instead of erasing enemy bullets.
- Each stack increases stun radius and stun duration.
- Stunned enemies do not move, shoot, wind up, or deal contact damage while stunned.
- Added a minimal `STUN` square outline on affected enemies and a compact `STUN xN` dash feedback.

## ESC choice safety

- If INSTALL/WPN/ABL choice windows are open and the player presses ESC, the game no longer closes the window with no reward.
- ESC now picks a random option from the currently shown list.
- WPN/ABL random selection prefers enabled options if any are available.
- Casino ESC still closes the casino modal, because casino is not a free reward choice window.
