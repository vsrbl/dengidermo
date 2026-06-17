# PATCH NOTES — v2.0.90 Casino Virus Reels

## Goal
Make CASINO VIRUS feel like an actual slot event, not just a dry HUD timer, and fix the room rules around virus rain and director pressure.

## Changes

### CASINO VIRUS REELS overlay
- Added a separate non-blocking `VIRUS REELS` overlay.
- It does **not** open the BET modal.
- It does **not** block movement or shooting.
- It does **not** close or conflict with WPN / ABL / INSTALL / BET windows.
- The overlay rolls three square reels and stops on symbols based on the virus result:
  - `MOB / PACK / BAD`
  - `STC / RAIN / LVL2`
  - `BIG / RAIN / LVL5`
  - `ELT / PACK / RED`
  - `HER / BOSS / BAD`
  - `GLD / GLD / PAY`

### BIG STATIC RAIN fix
- `BIG STATIC RAIN` now creates full-room enhanced virus rain even if no smaller virus rain existed before.
- If regular virus rain is already active, BIG upgrades it to the big version.
- Virus rain is still room-local and does not seed next-room Static Rain debt.

### Director pressure in CASINO VIRUS rooms
- Normal director spawn remains active while the 3 virus spins are pending.
- Casino Virus no longer starves the room into an empty countdown.
- Director budget is lightly increased and capped so the modifier stays threatening without becoming endless.
- After all 3 spins are complete, director pressure stops so the player can clear remaining enemies and open the portal.

### Balance
- Casino Virus room quota reduction changed from 75% to 95% of normal room pressure.
- Extra director budget while spins are pending is limited by loop/depth and active enemy fullness.

## Validation
- Syntax checks for server/shared/src pass.
- Smoke import checks pass for sim, hud, render, audio.
- Smoke test confirms Casino Virus emits reel symbols.
- Smoke test confirms BIG STATIC RAIN creates `activeRainStacks = 5` from zero.
