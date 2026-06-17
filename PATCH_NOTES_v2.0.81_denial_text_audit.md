# PATCH NOTES — v2.0.89_denial_text_audit

## Goal
Fix misleading denial text where non-money failures could show `NO GLD` / `NOT ENOUGH GLD`.

## Fixes
- Added a shared client-side denial text mapper for FX/HUD prompts.
- Weapon ammo/secondary denials now show the actual reason:
  - `NO SHG CHARGES` instead of `NO GLD`.
  - `NO RKT ROCKETS` instead of `NO GLD`.
  - `NEED RKT REMOTE`, `NEED SEK SWARM`, `NEED SHG LONGSHOT` for locked RMB secondary actions.
  - `SEK COOLDOWN ...` and `SHG COOLDOWN ...` for secondary cooldowns.
- Q denials now use the actual reason:
  - `Q — NO ACTIVE` when no Q core is installed.
  - `NO SPIKE CHARGES` when Signal Spike has no charge.
- LMB shotgun with 0 charges now emits a clear deny event instead of silently doing nothing.
- Cost denials still correctly show `NO GLD current/cost` or `NO HP current/cost` in Blood Tax rooms.

## Safety
- No gameplay balance changes.
- No portal/room/contract logic changes.
