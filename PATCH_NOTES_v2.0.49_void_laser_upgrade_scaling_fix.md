# PATCH NOTES — v2.0.56 void laser upgrade scaling fix

- Fixed `VOID LASER` upgrades not feeling visible.
- Removed `activeScale()` from laser reach/duration because the global active nerf compressed the upgrade steps too much.
- New reach scaling is deliberately obvious:
  - Level I: short beam baseline.
  - Each upgrade adds a large +260px reach step before wall collision.
- New duration scaling is deliberately obvious:
  - Level I: ~2.55s.
  - Each upgrade adds ~+1.10s uptime, capped at 9s.
- Kept the minimalist visual language from v2.0.48: thin dirty-white core, weak purple signal glow, tiny square endpoints.
- Added smoke coverage that checks formula text for the visible length/duration scaling constants.
