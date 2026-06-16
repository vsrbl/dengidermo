# v2.0.43 — BLACK BOX stealth / CASINO mutation roll

## BLACK BOX rework

BLACK BOX is no longer a second freeze aura.

- It creates a follow stealth zone around the player.
- Enemies outside the BLACK BOX stop selecting that player as a valid target.
- Enemies already inside the box are only briefly confused/slowed.
- The field no longer ticks damage.
- Bullet handling is reduced to a light signal jam for immediate incoming trash; it is not a freeze clone.

## BLACK BOX visual identity

- Added a dedicated VFX: two square frames rotating in opposite directions.
- The zone reads as a black-box/hidden-state object around the player.
- Initial cast creates a stronger double-square snap.

## CASINO mutation rework

CASINO is now a post-cast roll instead of a simple pickup/debt proc.

After Q is used, the HUD shows a top roll strip with three symbols and an outcome.

Possible outcomes:

- `Q x2` — schedules one extra Q cast after a short delay.
- `Q x10` — rare jackpot: schedules ten weak glitch recasts.
- `CASINO GLD` — drops GLD.
- `CASINO EXP` — drops EXP.
- `CASINO HEAL` — restores HP.
- `CASINO HIT` — damages the player.
- `STATIC DEBT` — turns on static debt.

Extra casts from CASINO do not trigger CASINO again, to prevent infinite recursion.

## Version

- Bumped to `v2.0.43`.
- Module filenames updated from `v2-0-33` to `v2-0-43`.
