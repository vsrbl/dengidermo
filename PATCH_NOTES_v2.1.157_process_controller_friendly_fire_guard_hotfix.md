# v2.1.157 — process_controller_friendly_fire_guard_hotfix

## Fix
- Controlled processes are now treated as true allies of their owner.
- The owner's own active fields, line fields, blasts and player-owned danger ticks no longer damage or hit-stagger their controlled processes.
- Enemy bullets, boss/room hazards, Static Storm and ownerless environmental damage still damage controlled processes.

## Technical
- `damageControlledProcess`, radius and segment helpers now accept `sourceOwner` and skip processes owned by that source.
- Player-owned active-field ticks pass their owner into the controlled-process damage helpers.
- Explosion splash now passes owner into the controlled-process damage helper so danger-style owner effects cannot friendly-fire the owner's own processes.
